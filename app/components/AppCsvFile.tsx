import type { MetaFunction } from "@remix-run/react";
import React, { useMemo, useRef, useState, useCallback } from "react";
import Papa from "papaparse";
import {
    Page,
    Card,
    BlockStack,
    InlineStack,
    Text,
    Button,
    Banner,
    Select,
    ProgressBar,
    Modal,
    Autocomplete,
    TextField,
    LegacyStack,
    Tag,
    RadioButton,
    Box
} from "@shopify/polaris";
import { useFetcher } from "@remix-run/react";

function DefaultSettingsPopup({
    open,
    onClose,
    form,
    setForm,
    locationOptions,
    tagOptions,
    errors,
    onSave,
}: {
    open: boolean;
    onClose: () => void;
    form: any;
    setForm: React.Dispatch<React.SetStateAction<any>>;
    locationOptions: { label: string; value: string }[];
    tagOptions: { label: string; value: string }[];
    errors: Record<string, string>;
    onSave: () => void;
}) {
    const [activeStep, setActiveStep] = useState("supplierRules");
    const [locationInputValue, setLocationInputValue] = useState('');
    const [filteredLocationOptions, setFilteredLocationOptions] = useState(locationOptions);
    const updateLocationText = useCallback(
        (value: string) => {
            setLocationInputValue(value);

            if (value === '') {
                setFilteredLocationOptions(locationOptions);
                return;
            }

            const filterRegex = new RegExp(value, 'i');
            const resultOptions = locationOptions.filter((option) =>
                option.label.match(filterRegex),
            );
            setFilteredLocationOptions(resultOptions);
        },
        [locationOptions],
    );

    const removeLocationTag = useCallback(
        (tag: string) => {
            const options = [...form.location];
            options.splice(options.indexOf(tag), 1);
            setForm({ ...form, location: options });
        },
        [form.location],
    );

    const locationVerticalContent = form.location?.length > 0 ? (
        <LegacyStack spacing="extraTight" alignment="center">
            {form.location.map((option: string) => {
                const location = locationOptions.find(loc => loc.value === option);
                return (
                    <Tag key={`location-${option}`} onRemove={() => removeLocationTag(option)}>
                        {location?.label || option}
                    </Tag>
                );
            })}
        </LegacyStack>
    ) : null;

    const locationTextField = (
        <Autocomplete.TextField
            onChange={updateLocationText}
            label=" "
            value={locationInputValue}
            placeholder="Select locations..."
            verticalContent={locationVerticalContent}
            autoComplete="off"
        />
    );

    const handleContinue = () => setActiveStep("selectionRules");
    const handleBack = () => setActiveStep("supplierRules");

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={activeStep === "supplierRules" ? "Supplier Quantity Update Rules" : "Rules Settings"}
            primaryAction={{
                content: activeStep === "selectionRules" ? "Save" : "Continue",
                onAction: activeStep === "selectionRules" ? onSave : handleContinue,
            }}
            secondaryActions={activeStep === "selectionRules" ? [{ content: "Back", onAction: handleBack }] : []}
        >
            <Modal.Section>
                <BlockStack gap="400">
                    {/* First Step: Supplier Rules */}
                    {activeStep === "supplierRules" && (
                        <form className="DefaultSettingsPopup-form-os">
                            <div className="default-heading-bar-os">
                                <Text as="h3" variant="headingMd">
                                    Supplier Quantity Update Rules
                                </Text>
                            </div>

                            <BlockStack gap="200">
                                <RadioButton
                                    label="Quantity updates based on all the products from the CSV"
                                    checked={form.selectionRules === 'allExcels'}
                                    id="allExcels"
                                    name="selectionRules"
                                    onChange={() => setForm({ ...form, selectionRules: 'allExcels' })}
                                />

                                <RadioButton
                                    label="Quantity updates based on specific product tags"
                                    checked={form.selectionRules === 'tag'}
                                    id="tag"
                                    name="selectionRules"
                                    onChange={() => setForm({ ...form, selectionRules: 'tag' })}
                                />

                                {form.selectionRules === 'tag' && (
                                    <Box paddingInlineStart="400" paddingBlockStart="100">
                                        <Autocomplete
                                            options={tagOptions}
                                            selected={form.selectTag || []}
                                            onSelect={(selectedTags) => setForm({ ...form, selectTag: selectedTags })}
                                            allowMultiple
                                            textField={
                                                <Autocomplete.TextField
                                                    label="Select Tag (from CSV 'Tags')"
                                                    value={(form.selectTag || []).join(', ')}
                                                    onChange={() => { }}
                                                    autoComplete="off"
                                                />
                                            }
                                        />
                                    </Box>
                                )}

                                <RadioButton
                                    label="Quantity updates only for specific SKUs mentioned in CSV"
                                    checked={form.selectionRules === 'selectSku'}
                                    id="selectSku"
                                    name="selectionRules"
                                    onChange={() => setForm({ ...form, selectionRules: 'selectSku' })}
                                />
                            </BlockStack>
                        </form>
                    )}

                    {/* Second Step: Selection Rules */}
                    {activeStep === "selectionRules" && (
                        <form onSubmit={onSave} className="DefaultSettingsPopup-form-os">
                            <BlockStack gap="400">

                                <Text variant="headingMd" as="h3">
                                    Rules Settings
                                </Text>

                                <BlockStack gap="400">
                                    {/* Continue Selling When Out of Stock */}
                                    <InlineStack align="space-between" blockAlign="center">
                                        <Text as="span" variant="bodyMd">
                                            Continue Selling When Out of Stock:
                                        </Text>
                                        <InlineStack gap="400">
                                            <RadioButton
                                                label="Yes"
                                                checked={form.belowZero === 'CONTINUE'}
                                                id="continue"
                                                name="belowZero"
                                                onChange={() => setForm({ ...form, belowZero: 'CONTINUE' })}
                                            />
                                            <RadioButton
                                                label="No"
                                                checked={form.belowZero === 'DENY'}
                                                id="deny"
                                                name="belowZero"
                                                onChange={() => setForm({ ...form, belowZero: 'DENY' })}
                                            />
                                        </InlineStack>
                                    </InlineStack>

                                    {/* Warehouse Location */}
                                    <InlineStack align="space-between" blockAlign="center">
                                        <Text as="span" variant="bodyMd">
                                            Choose Warehouse Location:
                                        </Text>
                                        <Box minWidth="275px">
                                            <Autocomplete
                                                allowMultiple
                                                options={filteredLocationOptions}
                                                selected={form.location || []}
                                                textField={locationTextField}
                                                onSelect={(selectedValues) => {
                                                    setForm({ ...form, location: selectedValues });
                                                    setLocationInputValue('');
                                                }}
                                                listTitle="Available Locations"
                                            />
                                        </Box>
                                    </InlineStack>

                                    {/* Buffer Quantity */}
                                    <InlineStack align="space-between" blockAlign="center">
                                        <Text as="span" variant="bodyMd">
                                            <Text as="span" tone="critical">
                                                *
                                            </Text>{' '}
                                            Specify Buffer Quantity:
                                        </Text>
                                        <InlineStack gap="400">
                                            <RadioButton
                                                label="Yes"
                                                checked={form.bufferQuantity === 'yes'}
                                                id="bufferYes"
                                                name="bufferQuantity"
                                                onChange={() => setForm({ ...form, bufferQuantity: 'yes' })}
                                            />
                                            <RadioButton
                                                label="No"
                                                checked={form.bufferQuantity === 'no'}
                                                id="bufferNo"
                                                name="bufferQuantity"
                                                onChange={() => setForm({ ...form, bufferQuantity: 'no' })}
                                            />
                                            {form.bufferQuantity === 'yes' && (
                                                <InlineStack align="end">
                                                    <Box minWidth="100px">
                                                        <TextField
                                                            type="number"
                                                            label=""
                                                            value={form.inputBufferQuantity}
                                                            onChange={(value) =>
                                                                setForm({ ...form, inputBufferQuantity: value.replace(/\D+/g, '') })
                                                            }
                                                            placeholder="Enter quantity"
                                                            autoComplete="off"
                                                        />
                                                    </Box>
                                                </InlineStack>
                                            )}
                                        </InlineStack>
                                    </InlineStack>


                                    <InlineStack align="space-between" blockAlign="center">
                                        <Text as="span"  >
                                            Expiry Date :
                                        </Text>
                                        <InlineStack gap="400">
                                            <input
                                                type="date"
                                                value={form.expiryDate}
                                                onChange={(e) => setForm((p: any) => ({ ...p, expiryDate: e.target.value }))}
                                                className="Polaris-TextField__Input"
                                                style={{ border: "1px solid #797979ff", padding: 8, borderRadius: '8px' }}
                                            />
                                            {errors.expiryDate && <Banner tone="critical">{errors.expiryDate}</Banner>}
                                        </InlineStack>
                                    </InlineStack>
                                </BlockStack>
                            </BlockStack>
                        </form>
                    )}
                </BlockStack>
            </Modal.Section>
        </Modal>
    );
}

export const meta: MetaFunction = () => [{ title: "Stock Adjustments" }];

type CSVRow = Record<string, string>;

export default function CsvFileScreen() {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [csvRows, setCsvRows] = useState<CSVRow[]>([]);
    const [fileName, setFileName] = useState<string>("");
    const [progress, setProgress] = useState<number | null>(null);

    const [activePopup, setActivePopup] = useState<boolean>(false);
    const [form, setForm] = useState<any>(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return {
            selectionRules: "allExcels",
            selectTag: [] as string[],
            singleTag: "",
            belowZero: "DENY",
            location: [] as string[], // Changed from locationIds to location
            bufferQuantity: "no" as "yes" | "no",
            inputBufferQuantity: "0",
            expiryDate: d.toISOString().slice(0, 10),
            fileHeader: "",
            shopifyHeader: "sku" as "sku" | "barcode",
            fileInventoryHeader: "",
            shopifyInventoryHeader: "inventory-quantity" as const,
            fileTagHeader: "",
            shopifyTagHeader: "tag",
        };
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const fetchLocations = useFetcher<{ status: boolean; data: any }>();
    const tagCheck = useFetcher<{ status: boolean }>();
    const uploader = useFetcher<{ status: boolean; processedCount: number }>();

    React.useEffect(() => {
        if (fetchLocations.state === "idle" && !fetchLocations.data) {
            fetchLocations.load("/api/fetchStoreLocation");
        }
    }, []);

    const locationOptions = useMemo(() => {
        const edges = fetchLocations.data?.data?.data?.shop?.locations?.edges ?? [];
        return edges.map((e: any) => {
            const gid = e?.node?.id as string;
            return { label: e?.node?.name, value: gid.split("/").pop() as string }; // Return numeric ID only
        });
    }, [fetchLocations.data]);

    const csvHeaders = useMemo(
        () => (csvRows.length ? Object.keys(csvRows[0]) : []),
        [csvRows]
    );

    function onPickFile() {
        fileInputRef.current?.click();
    }

    function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0];
        if (!f) return;
        setFileName(f.name);
        Papa.parse<CSVRow>(f, {
            header: true,
            dynamicTyping: false, // Ensure all values are treated as strings
            complete: (res) => {
                const rows = (res.data ?? []).filter((r) => Object.keys(r).length);
                
                // Debug logging for CSV parsing
                console.log('🔍 Papa.parse results:', {
                    originalData: res.data?.slice(0, 2), // First 2 rows
                    processedRows: rows.slice(0, 2), // First 2 rows
                    sampleSKU: rows[0]?.['SKUs'],
                    sampleSKUType: typeof rows[0]?.['SKUs']
                });
                
                setCsvRows(rows as CSVRow[]);
                setTimeout(() => setActivePopup(true), 500);
            },
        });
    }

    React.useEffect(() => {
        if (form.selectionRules === "tag" && csvRows.length) {
            const first = csvRows[0]?.["Tags"];
            if (first) setForm((p: any) => ({ ...p, selectTag: [first], singleTag: first }));
        } else if (form.selectionRules !== "tag") {
            setForm((p: any) => ({ ...p, selectTag: [], singleTag: "" }));
        }
    }, [form.selectionRules, csvRows]);

    React.useEffect(() => {
        if (form.selectionRules === "tag" && form.singleTag) {
            tagCheck.submit(
                { tags: form.singleTag },
                { method: "post", action: "/api/matchShopTags", encType: "application/json" }
            );
        }
    }, [form.selectionRules, form.singleTag]);

    const tagOptions = useMemo(
        () =>
            [...new Set(csvRows.map((r) => r["Tags"]).filter(Boolean))].map((t) => ({
                label: t as string,
                value: t as string,
            })),
        [csvRows]
    );

    // इस function को replace करो
    function validateBeforeSave() {
        const next: Record<string, string> = {};
        if (form.bufferQuantity === "yes" && Number(form.inputBufferQuantity) < 1) {
            next.inputBufferQuantity = "Buffer quantity must be greater than 0.";
        }
        if (form.expiryDate) {
            const chosen = new Date(form.expiryDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            chosen.setHours(0, 0, 0, 0);
            if (chosen < today) next.expiryDate = "Expiry date must be future date.";
        }
        if (form.selectionRules === "tag" && (!form.selectTag || form.selectTag.length === 0)) {
            next.selectTag = "Please select valid tag";
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    }

    React.useEffect(() => {
        if (form.selectionRules === "tag" && csvRows.length) {
            const first = csvRows[0]?.["Tags"];
            if (first) setForm((p: any) => ({ ...p, selectTag: [first], singleTag: first }));
        } else if (form.selectionRules !== "tag") {
            setForm((p: any) => ({ ...p, selectTag: [], singleTag: "" }));
        }
    }, [form.selectionRules, csvRows]);
    React.useEffect(() => {
        if (form.selectionRules === "tag" && form.singleTag) {
            tagCheck.submit(
                { tags: form.singleTag },
                { method: "post", action: "/api/matchShopTags", encType: "application/json" }
            );
        }
    }, [form.selectionRules, form.singleTag]);

    function onSavePopup() {
        if (!validateBeforeSave()) return;
        setActivePopup(false);
    }

    const canSubmit =
        csvRows.length > 0 &&
        form.fileHeader &&
        form.fileInventoryHeader &&
        !(form.bufferQuantity === "yes" && Number(form.inputBufferQuantity) < 1);

    function onSubmit() {

        setProgress(1);

        // Convert location IDs to numeric format for payload
        const numericLocationIds = form.location.map((locationId: string) => {
            return locationId; // Already numeric from locationOptions
        });

        console.log("Submitting with locations:", numericLocationIds);

        uploader.submit(
            JSON.stringify({
                defaultSetting: form.selectionRules,
                csvFileData: csvRows,
                productTags: form.selectTag,
                continueSell: form.belowZero,
                locations: numericLocationIds, // Send numeric IDs
                bufferQqantity: form.inputBufferQuantity,
                expireDate: form.expiryDate,
                fileHeaders: form.fileHeader,
                shopifyInventoryHeaders: form.shopifyHeader,
                fileInventoryHeaders: form.fileInventoryHeader,
                shopifyQqantityInventoryHeaders: form.shopifyInventoryHeader,
                fileTagHeader: form.fileTagHeader,
                shopifyTagHeader: form.shopifyTagHeader,
            }),
            { method: "post", action: "/api/addCsvFile", encType: "application/json" }
        );
    }

    React.useEffect(() => {
        if (uploader.data?.status) setProgress(100);
    }, [uploader.data]);

    return (
        <Page title="Stock Adjustments">
            <BlockStack gap="400">
                <Card>
                    <BlockStack gap="300">
                        <InlineStack align="space-between">
                            <Text as="h3" variant="headingMd">
                                Upload CSV
                            </Text>
                            <Button
                                onClick={() => window.location.assign("/file-format.csv")}
                                variant="secondary"
                            >
                                Download Sample CSV
                            </Button>
                        </InlineStack>

                        {fileName ? (
                            <Banner tone="success">
                                CSV "{fileName}" uploaded. Map fields below.
                            </Banner>
                        ) : (
                            <Banner tone="info">
                                The inventory quantity uploaded in CSV will overwrite inventory for mapped
                                items in Shopify.
                            </Banner>
                        )}

                        <InlineStack gap="300">
                            <input ref={fileInputRef} type="file" accept=".csv" onChange={onFileChange} hidden />
                            <Button onClick={onPickFile} variant="primary">
                                Upload CSV
                            </Button>
                            <Button
                                onClick={() => setActivePopup(true)}
                                variant="secondary"
                                disabled={csvRows.length === 0}
                            >
                                Open Rules Settings
                            </Button>
                        </InlineStack>
                    </BlockStack>
                </Card>

                {csvRows.length > 0 && (
                    <>
                        <Card>
                            <BlockStack gap="300">
                                <Text as="h3" variant="headingMd">
                                    Mapping
                                </Text>

                                <InlineStack gap="400" align="space-between">
                                    <Box minWidth="48%">
                                        <Text as="span"  >
                                            CSV Unique Identifier
                                        </Text>
                                        <Select
                                            options={[{ label: "Select", value: "" }, ...csvHeaders.map((h) => ({ label: h, value: h }))]}
                                            value={form.fileHeader}
                                            onChange={(v) => setForm((p: any) => ({ ...p, fileHeader: v }))} label={undefined} />
                                    </Box>

                                    <Box minWidth="48%">
                                        <Text as="span"  >
                                            Shopify Unique Identifier
                                        </Text>
                                        <Select
                                            options={[
                                                { label: "SKU", value: "sku" },
                                                { label: "Barcode", value: "barcode" },
                                            ]}
                                            value={form.shopifyHeader}
                                            onChange={(v) => setForm((p: any) => ({ ...p, shopifyHeader: v }))} label={undefined} />

                                    </Box>
                                </InlineStack>

                                <InlineStack gap="400" align="space-between">
                                    <Box minWidth="48%">
                                        <Text as="span"  >
                                            CSV Inventory Mapping Field
                                        </Text>
                                        <Select
                                            options={[{ label: "Select", value: "" }, ...csvHeaders.map((h) => ({ label: h, value: h }))]}
                                            value={form.fileInventoryHeader}
                                            onChange={(v) => setForm((p: any) => ({ ...p, fileInventoryHeader: v }))} label={undefined} />
                                    </Box>

                                    <Box minWidth="48%">
                                        <Text as="span"  >
                                            Shopify Inventory Mapping Field
                                        </Text>
                                        <Select
                                            options={[{ label: "Inventory quantity", value: "inventory-quantity" }]}
                                            value={form.shopifyInventoryHeader}
                                            onChange={() => { }} label={undefined} />
                                    </Box>
                                </InlineStack>

                                <InlineStack gap="400" align="space-between">
                                    <Box minWidth="48%">
                                        <Text as="span">
                                            CSV Tags Mapping Field
                                        </Text>
                                        <Select
                                            options={[{ label: "Select", value: "" }, ...csvHeaders.map((h) => ({ label: h, value: h }))]}
                                            value={form.fileTagHeader}
                                            onChange={(v) => setForm((p: any) => ({ ...p, fileTagHeader: v }))}
                                            label={undefined}
                                        />
                                    </Box>
                                    <Box minWidth="48%">
                                        <Text as="span">
                                            Shopify Tags Mapping Field
                                        </Text>
                                        <Select
                                            options={[{ label: "Tags", value: "tags" }]}
                                            value={form.shopifyTagHeader}
                                            onChange={(v) => setForm((p: any) => ({ ...p, shopifyTagHeader: v }))}
                                            label={undefined}
                                        />
                                    </Box>
                                </InlineStack>
                            </BlockStack>
                        </Card>

                        {progress !== null && (
                            <Card>
                                <BlockStack gap="200">
                                    <Text as="span"  >
                                        Processing…
                                    </Text>
                                    <ProgressBar progress={progress ?? 0} />
                                </BlockStack>
                            </Card>
                        )}

                        <InlineStack gap="400">
                            <Button variant="primary" onClick={onSubmit}  >
                                Submit
                            </Button>
                            {uploader.data?.status && (
                                <Banner tone="success">
                                    Fields Mapping & CSV Upload done. Processed: {uploader.data.processedCount}
                                </Banner>
                            )}
                        </InlineStack>

                        {/* Preview first 10 rows */}
                        <Card>
                            <BlockStack gap="300">
                                <Text as="h3" variant="headingMd">
                                    Preview (first 10 rows)
                                </Text>
                                <div style={{ overflowX: "auto" }}>
                                    <table className="Polaris-DataTable__Table" style={{ minWidth: 600 }}>
                                        <thead>
                                            <tr>
                                                {csvHeaders.map((h) => (
                                                    <th key={h} style={{ textAlign: "left", padding: 8 }}>
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {csvRows.slice(0, 10).map((r, i) => (
                                                <tr key={i}>
                                                    {csvHeaders.map((h) => (
                                                        <td key={h} style={{ padding: 8 }}>
                                                            {r[h]}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </BlockStack>
                        </Card>
                    </>
                )}
            </BlockStack>

            <DefaultSettingsPopup
                open={activePopup}
                onClose={() => setActivePopup(false)}
                form={form}
                setForm={setForm}
                locationOptions={locationOptions}
                tagOptions={tagOptions}
                errors={errors}
                onSave={onSavePopup}
            />

            <input type="file" hidden />
        </Page>
    );
}