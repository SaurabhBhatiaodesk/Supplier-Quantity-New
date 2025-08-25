import type { MetaFunction } from "@remix-run/react";
import React, { useMemo, useRef, useState } from "react";
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
} from "@shopify/polaris";
import { useFetcher } from "@remix-run/react";

/**
 * DefaultSettingsPopup — Polaris Modal version
 */
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
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Rules Settings"
      primaryAction={{ content: "Save", onAction: onSave }}
      secondaryActions={[{ content: "Close", onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Continue Selling */}
          <BlockStack>
            <Text as="span"  >
              Continue Selling When Out of Stock
            </Text>
            <Select
                          options={[
                              { label: "No (DENY)", value: "DENY" },
                              { label: "Yes (CONTINUE)", value: "CONTINUE" },
                          ]}
                          value={form.belowZero}
                          onChange={(v) => setForm((p: any) => ({ ...p, belowZero: v }))} label={undefined}            />
          </BlockStack>

          {/* Warehouse Locations (single for simplicity) */}
          <BlockStack>
            <Text as="span"  >
              Choose Warehouse Location
            </Text>
            <Select
                          options={[{ label: "Select", value: "" }, ...locationOptions]}
                          value={form.locationIds?.[0] ?? ""}
                          onChange={(v) => setForm((p: any) => ({ ...p, locationIds: v ? [v] : [] }))} label={undefined}            />
          </BlockStack>

          {/* Buffer Quantity */}
          <BlockStack>
            <Text as="span"  >
              Specify Buffer Quantity
            </Text>
            <Select
                          options={[
                              { label: "No", value: "no" },
                              { label: "Yes", value: "yes" },
                          ]}
                          value={form.bufferQuantity}
                          onChange={(v) => setForm((p: any) => ({ ...p, bufferQuantity: v }))} label={undefined}            />
            {form.bufferQuantity === "yes" && (
              <input
                type="text"
                value={form.inputBufferQuantity}
                onChange={(e) =>
                  setForm((p: any) => ({
                    ...p,
                    inputBufferQuantity: e.target.value.replace(/\D+/g, ""),
                  }))
                }
                className="Polaris-TextField__Input"
                style={{ border: "1px solid var(--p-color-border)", padding: 8 }}
                placeholder="Quantity"
              />
            )}
            {errors.inputBufferQuantity && (
              <Banner tone="critical">{errors.inputBufferQuantity}</Banner>
            )}
          </BlockStack>

          {/* Expiry Date */}
          <BlockStack>
            <Text as="span"  >
              Expiry Date
            </Text>
            <input
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm((p: any) => ({ ...p, expiryDate: e.target.value }))}
              className="Polaris-TextField__Input"
              style={{ border: "1px solid var(--p-color-border)", padding: 8 }}
            />
            {errors.expiryDate && <Banner tone="critical">{errors.expiryDate}</Banner>}
          </BlockStack>

          {/* Tag selection if rules = tag */}
          {form.selectionRules === "tag" && (
            <BlockStack>
              <Text as="span"  >
                Select Tag (from CSV "Tags")
              </Text>
              <Select
                              options={[{ label: "Select", value: "" }, ...tagOptions]}
                              value={form.singleTag}
                              onChange={(v) => setForm((p: any) => ({ ...p, singleTag: v, selectTag: v ? [v] : [] }))} label={undefined}              />
              {errors.selectTag && <Banner tone="critical">{errors.selectTag}</Banner>}
            </BlockStack>
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

  // popup state mirrors your old DefaultSettingsPopup form
  const [activePopup, setActivePopup] = useState<boolean>(false);
  const [form, setForm] = useState<any>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return {
      selectionRules: "allExcels", // allExcels | tag | selectSku
      selectTag: [] as string[],
      singleTag: "",
      belowZero: "DENY", // CONTINUE | DENY
      locationIds: [] as string[],
      bufferQuantity: "no" as "yes" | "no",
      inputBufferQuantity: "0",
      expiryDate: d.toISOString().slice(0, 10),
      // mapping
      fileHeader: "",
      shopifyHeader: "sku" as "sku" | "barcode",
      fileInventoryHeader: "",
      shopifyInventoryHeader: "inventory-quantity" as const,
      fileTagHeader: "",
    };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchLocations = useFetcher<{ status: boolean; data: any }>();
  const tagCheck = useFetcher<{ status: boolean }>();
  const uploader = useFetcher<{ status: boolean; processedCount: number }>();

  // load locations on mount
  React.useEffect(() => {
    if (fetchLocations.state === "idle" && !fetchLocations.data) {
      fetchLocations.load("/api/fetchStoreLocation");
    }
  }, []);

  const locationOptions = useMemo(() => {
    const edges = fetchLocations.data?.data?.data?.shop?.locations?.edges ?? [];
    return edges.map((e: any) => {
      const gid = e?.node?.id as string; // gid://shopify/Location/123
      return { label: e?.node?.name, value: gid.split("/").pop() as string };
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
      complete: (res) => {
        const rows = (res.data ?? []).filter((r) => Object.keys(r).length);
        setCsvRows(rows as CSVRow[]);
        // auto-open popup after short delay like old code
        setTimeout(() => setActivePopup(true), 500);
      },
    });
  }

  // auto prepare first tag when tag mode
  React.useEffect(() => {
    if (form.selectionRules === "tag" && csvRows.length) {
      const first = csvRows[0]?.["Tags"];
      if (first) setForm((p: any) => ({ ...p, selectTag: [first], singleTag: first }));
    } else if (form.selectionRules !== "tag") {
      setForm((p: any) => ({ ...p, selectTag: [], singleTag: "" }));
    }
  }, [form.selectionRules, csvRows]);

  // match tag on change (optional)
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

  function validateBeforeSave() {
    const next: Record<string, string> = {};
    if (form.bufferQuantity === "yes" && Number(form.inputBufferQuantity) < 1) {
      next.inputBufferQuantity = "Buffer quantity must be greater than 0.";
    }
    // date must be today or future
    if (form.expiryDate) {
      const chosen = new Date(form.expiryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      chosen.setHours(0, 0, 0, 0);
      if (chosen < today) next.expiryDate = "Expiry date must be future date.";
    }
    if (form.selectionRules === "tag" && !form.singleTag) {
      next.selectTag = "Please select valid tag";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

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
    if (!canSubmit) return;
    setProgress(1); // show bar

    uploader.submit(
      JSON.stringify({
        defaultSetting: form.selectionRules,
        csvFileData: csvRows,
        productTags: form.selectTag,
        continueSell: form.belowZero,
        locations: form.locationIds,
        bufferQqantity: form.inputBufferQuantity,
        expireDate: form.expiryDate,
        fileHeaders: form.fileHeader,
        shopifyInventoryHeaders: form.shopifyHeader,
        fileInventoryHeaders: form.fileInventoryHeader,
        shopifyQqantityInventoryHeaders: form.shopifyInventoryHeader,
        fileTagHeader: form.fileTagHeader,
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

                <InlineStack gap="400" wrap>
                  <BlockStack gap="150" inlineAlign="start">
                    <Text as="span"  >
                      CSV Unique Identifier
                    </Text>
                    <Select
                                          options={[{ label: "Select", value: "" }, ...csvHeaders.map((h) => ({ label: h, value: h }))]}
                                          value={form.fileHeader}
                                          onChange={(v) => setForm((p: any) => ({ ...p, fileHeader: v }))} label={undefined}                    />
                  </BlockStack>

                  <BlockStack gap="150" inlineAlign="start">
                    <Text as="span"  >
                      Shopify Unique Identifier
                    </Text>
                    <Select
                                          options={[
                                              { label: "SKU", value: "sku" },
                                              { label: "Barcode", value: "barcode" },
                                          ]}
                                          value={form.shopifyHeader}
                                          onChange={(v) => setForm((p: any) => ({ ...p, shopifyHeader: v }))} label={undefined}                    />
                  </BlockStack>
                </InlineStack>

                <InlineStack gap="400" wrap>
                  <BlockStack gap="150" inlineAlign="start">
                    <Text as="span"  >
                      CSV Inventory Mapping Field
                    </Text>
                    <Select
                                          options={[{ label: "Select", value: "" }, ...csvHeaders.map((h) => ({ label: h, value: h }))]}
                                          value={form.fileInventoryHeader}
                                          onChange={(v) => setForm((p: any) => ({ ...p, fileInventoryHeader: v }))} label={undefined}                    />
                  </BlockStack>

                  <BlockStack gap="150" inlineAlign="start">
                    <Text as="span"  >
                      Shopify Inventory Mapping Field
                    </Text>
                    <Select
                                          options={[{ label: "Inventory quantity", value: "inventory-quantity" }]}
                                          value={form.shopifyInventoryHeader}
                                          onChange={() => { } } label={undefined}                    />
                  </BlockStack>
                </InlineStack>

                <InlineStack gap="400" wrap>
                  <BlockStack gap="150" inlineAlign="start">
                    <Text as="span"  >
                      CSV Tags Mapping Field
                    </Text>
                    <Select
                                          options={[{ label: "Select", value: "" }, ...csvHeaders.map((h) => ({ label: h, value: h }))]}
                                          value={form.fileTagHeader}
                                          onChange={(v) => setForm((p: any) => ({ ...p, fileTagHeader: v }))} label={undefined}                    />
                  </BlockStack>

                  <BlockStack gap="150" inlineAlign="start">
                    <Text as="span"  >
                      Selection Rule
                    </Text>
                    <Select
                                          options={[
                                              { label: "All rows in CSV", value: "allExcels" },
                                              { label: "Filter by Tags", value: "tag" },
                                              { label: "Only SKUs listed in CSV", value: "selectSku" },
                                          ]}
                                          value={form.selectionRules}
                                          onChange={(v) => setForm((p: any) => ({ ...p, selectionRules: v }))} label={undefined}                    />
                  </BlockStack>
                </InlineStack>

                {form.selectionRules === "tag" && (
                  <InlineStack gap="400" wrap>
                    <BlockStack gap="150" inlineAlign="start">
                      <Text as="span"  >
                        Pick Tag (from CSV "Tags")
                      </Text>
                      <Select
                                              options={[{ label: "Select", value: "" }, ...tagOptions]}
                                              value={form.singleTag}
                                              onChange={(v) => setForm((p: any) => ({ ...p, singleTag: v, selectTag: v ? [v] : [] }))} label={undefined}                      />
                    </BlockStack>
                    {tagCheck.data && (
                      <Banner tone={tagCheck.data.status ? "success" : "critical"}>
                        {tagCheck.data.status ? "Tag exists in Shopify." : "Tag not found in Shopify."}
                      </Banner>
                    )}
                  </InlineStack>
                )}
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
              <Button variant="primary" onClick={onSubmit} disabled={!canSubmit || uploader.state !== "idle"}>
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

      {/* Popup */}
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
