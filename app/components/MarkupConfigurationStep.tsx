import { useEffect, useMemo, useState } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Box,
  BlockStack,
  InlineStack,
  Button,
  Select,
  TextField,
  Icon,
  ChoiceList,
  ButtonGroup,
  Divider,
  RadioButton,
  InlineGrid,
  Banner,
  Combobox,
  Listbox,
  Popover,
} from "@shopify/polaris";
import { useNavigate } from "@remix-run/react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  DeleteIcon,
  PlusIcon,
  SettingsIcon,
  InfoIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@shopify/polaris-icons";

// ----- constants / options -----
const FIELD_OPTIONS = [
  { label: "SKU", value: "sku" },
  { label: "Tags", value: "tags" },
  { label: "Type", value: "type" },
  { label: "Vendor", value: "vendor" },
  { label: "Price", value: "price" },
  { label: "Cost Price", value: "cost_price" },
  { label: "Retail Price", value: "retail_price" },
  { label: "Weight", value: "weight" },
  { label: "Inventory quantity", value: "inventory" },
  { label: "Title", value: "title" },
];

const CONDITION_OPTIONS = [
  { label: "is equal to", value: "eq" },
  { label: "is not equal to", value: "neq" },
  { label: "starts with", value: "starts" },
  { label: "ends with", value: "ends" },
  { label: "contains", value: "contains" },
  { label: "does not contain", value: "ncontains" },
  { label: "greater than", value: "gt" },
  { label: "less than", value: "lt" },
  { label: "between", value: "between" },
];

const MARKUP_TYPES = [
  { label: "Percentage", value: "percent" },
  { label: "Fixed Amount", value: "fixed" },
];

const PERCENTAGE_PRESETS = [
  { label: "5%", value: "5" },
  { label: "10%", value: "10" },
  { label: "15%", value: "15" },
  { label: "20%", value: "20" },
  { label: "25%", value: "25" },
  { label: "30%", value: "30" },
  { label: "50%", value: "50" },
  { label: "Custom...", value: "custom" },
];

function uid() {
  return Math.random().toString(36).slice(2);
}

// ----- props -----
interface MarkupConfigurationStepProps {
  apiCredentials: { apiUrl: string; accessToken: string };
  onNext: () => void;
  onPrevious: () => void;
  value?: {
    conditions: Array<{
      id: string;
      field: string;
      operator: string;
      tagText: string;
      markupType: "percent" | "fixed";
      percentagePreset: string;
      customPercent: string;
      value: string;
    }>;
    conditionsType: "all" | "any";
    connector?: "AND" | "OR";
    tieBreaker?: "higher" | "lower" | "priority";
  };
  onChange?: (config: MarkupConfigurationStepProps["value"]) => void;
  selectedFiltersSummary?: Array<{ key: string; values: string[] }>;
  // Add new props for dynamic tag fetching
  availableTags?: string[];
  onTagSearch?: (searchTerm: string) => Promise<string[]>;
}

export default function MarkupConfigurationStep({
  apiCredentials,
  onNext,
  onPrevious,
  value,
  onChange,
  selectedFiltersSummary,
  availableTags = [],
}: MarkupConfigurationStepProps) {
  const navigate = useNavigate();

  type Row = {
    id: string;
    field: string;              // sku, tag, vendor, etc.
    operator: string;           // eq, neq, gt, lt, ...
    tagText: string;            // for text inputs (sku/tag/title/vendor)
    markupType: "percent" | "fixed";
    percentagePreset: string;   // one of presets or 'custom'
    customPercent: string;      // only when preset === 'custom'
    value: string;              // numeric value (for fixed) or readonly for percent
  };

  const MAX_CONDITIONS = 5; // Increased to allow more conditions

  const [matchMode, setMatchMode] = useState<"all" | "any">("any");
  const [connector, setConnector] = useState<"AND" | "OR">("OR");
  const [collapsedConditions, setCollapsedConditions] = useState<Record<string, boolean>>({});
  
  // Dynamic tag search state
  const [tagSearchResults, setTagSearchResults] = useState<string[]>([]);
  const [tagSearchTerm, setTagSearchTerm] = useState<string>('');
  
  // Debug logging for value prop
  useEffect(() => {
    console.log('🔧 MarkupConfigurationStep - Received value prop:', {
      value,
      currentMatchMode: matchMode,
      currentConnector: connector
    });
  }, [value, matchMode, connector]);
  
  // Sync connector with matchMode
  useEffect(() => {
    if (matchMode === "all") {
      setConnector("AND");
    } else {
      setConnector("OR");
    }
  }, [matchMode]);
  
  // Sync matchMode with connector
  const handleConnectorChange = (newConnector: "AND" | "OR") => {
    setConnector(newConnector);
    // Always use "any" logic internally, regardless of UI selection
    setMatchMode("any");
  };

  // Toggle condition collapse state
  const toggleConditionCollapse = (conditionId: string) => {
    setCollapsedConditions(prev => ({
      ...prev,
      [conditionId]: !prev[conditionId]
    }));
  };

  // Dynamic tag search function
  const handleTagSearch = (searchTerm: string, rowId: string) => {
    if (!searchTerm.trim()) {
      setTagSearchResults([]);
      return;
    }
    
    const filteredTags = availableTags.filter(tag => 
      tag.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setTagSearchResults(filteredTags);
  };

  const [rows, setRows] = useState<Row[]>(
    value?.conditions && value.conditions.length > 0
              ? (value.conditions as Row[]).map(c => ({
            ...c,
            operator: (c.field === 'price' || c.field === 'Variant Price' || c.field.toLowerCase().includes('price')) ? 'between' : c.operator // Auto-set between for price fields
          }))
      : [
          {
            id: uid(),
            field: "title",
            operator: "eq",
            tagText: "",
            markupType: "percent",
            percentagePreset: "10",
            customPercent: "",
            value: "10",
          }
        ]
  );

  // Initialize first condition as open when rows change
  useEffect(() => {
    if (rows.length > 0) {
      const firstConditionId = rows[0].id;
      setCollapsedConditions(prev => ({
        ...prev,
        [firstConditionId]: false // false means open
      }));
      console.log('🔧 Setting first condition as open:', firstConditionId);
    }
  }, [rows.length]);

  // Sync outward when values change
  useEffect(() => {
    console.log('🔧 MarkupConfigurationStep - Sending config:', {
      matchMode,
      connector,
      conditionsType: "any", // Always send "any" regardless of UI selection
      rowsCount: rows.length
    });
    
    onChange?.({
      conditions: rows,
      conditionsType: "any", // Always send "any" regardless of UI selection
      connector,
      tieBreaker: value?.tieBreaker ?? "higher",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, matchMode, connector]);

  // Build dynamic field options from Step 4 selections + defaults
  const dynamicFieldOptions = useMemo(() => {
    // Always include default field options
    const defaultOptions = [...FIELD_OPTIONS];
    
    // Add selected filters from Step 4 if available
    if (selectedFiltersSummary && selectedFiltersSummary.length > 0) {
      const fromFilters = selectedFiltersSummary
        .map((g) => ({ label: g.key, value: g.key }))
        .filter((o) => typeof o.value === 'string' && o.value.trim().length > 0);
      
      // Merge with defaults, avoiding duplicates
      const allOptions = [...defaultOptions];
      for (const filter of fromFilters) {
        if (!allOptions.some(opt => opt.value === filter.value)) {
          allOptions.push(filter);
        }
      }
      
      console.log('🔧 Dynamic field options:', {
        selectedFilters: selectedFiltersSummary,
        fromFilters,
        allOptions: allOptions.map(o => o.value)
      });
      
      return allOptions;
    }
    
    console.log('🔧 Using default field options:', defaultOptions.map(o => o.value));
    // Return defaults when no filters selected
    return defaultOptions;
  }, [selectedFiltersSummary]);

  const fieldOptionsWithPlaceholder = useMemo(() => {
    // Avoid placeholder to reduce edge-cases; return pure list
    return dynamicFieldOptions;
  }, [dynamicFieldOptions]);

  // Ensure current rows use valid fields - only validate if field doesn't exist in any options
  useEffect(() => {
    const allAvailableFields = new Set(dynamicFieldOptions.map(o => o.value));
    console.log('🔧 Field validation:', {
      allAvailableFields: Array.from(allAvailableFields),
      currentRows: rows.map(r => ({ id: r.id, field: r.field }))
    });
    
    setRows(prev => {
      let changed = false;
      const next = prev.map(r => {
        if (!allAvailableFields.has(r.field)) {
          const first = dynamicFieldOptions[0]?.value || 'title';
          console.log(`🔧 Invalid field "${r.field}" changed to "${first}"`);
          changed = true;
          return { ...r, field: first };
        }
        return r;
      });
      return changed ? next : prev;
    });
  }, [dynamicFieldOptions]);

  const canAddRow = rows.length < MAX_CONDITIONS;

  function addRow() {
    if (!canAddRow) return;
    setRows((prev) => [
      ...prev,
      {
        id: uid(),
        field: "title",
        operator: "eq",
        tagText: "",
        markupType: "percent",
        percentagePreset: "10",
        customPercent: "",
        value: "10",
      },
    ]);
  }

  function removeRow(id: string) {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      // always keep at least one row visible
      if (next.length === 0) {
        return [{
          id: uid(),
          field: "title",
          operator: "eq",
          tagText: "",
          markupType: "percent",
          percentagePreset: "10",
          customPercent: "",
          value: "10",
        }];
      }
      return next;
    });
  }

  function updateRow(id: string, key: keyof Row, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
    console.log('🔧 Row updated:', { id, key, value });
  }

  function onChangePercentagePreset(id: string, preset: string) {
    setRows((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      if (preset === "custom") {
        return { ...r, percentagePreset: preset, customPercent: "", value: "" };
      }
      return { ...r, percentagePreset: preset, customPercent: "", value: preset };
    }));
    console.log('🔧 Percentage preset changed:', { id, preset });
  }

  const previewText = useMemo(() => {
    if (rows.length === 0) return "No conditions configured";
    
    const conds = rows.map((r) => {
      const field = FIELD_OPTIONS.find((f) => f.value === r.field)?.label ?? r.field;
      const op = CONDITION_OPTIONS.find((o) => o.value === r.operator)?.label ?? r.operator;
      const lhs = field;
      
      // Handle price range display
      let rhs = r.tagText ? `"${r.tagText}"` : "\"\"";
      if ((r.field === 'price' || r.field === 'Variant Price' || r.field.toLowerCase().includes('price')) && r.operator === 'between' && r.tagText.includes('-')) {
        const [from, to] = r.tagText.split('-');
        rhs = `"$${from || '0'} to $${to || '0'}"`;
      }
      
      const mark =
        r.markupType === "percent"
          ? `${r.percentagePreset === "custom" ? r.customPercent || "0" : r.percentagePreset}% markup`
          : `$${r.value || 0} fixed markup`;
      return `${lhs} ${op} ${rhs} — ${mark}`;
    });
    
    const joiner = connector === "AND" ? " AND " : " OR ";
    const conditionText = matchMode === "all" 
      ? "Product must match ALL of the following conditions"
      : "Product must match ANY of the following conditions";
    
    return `${conditionText}: ${conds.join(joiner)}`;
  }, [rows, matchMode, connector]);

  // Generate JSON output for backend
  const jsonOutput = useMemo(() => {
    const rules = rows.map(row => ({
      field: row.field,
      operator: row.operator,
      value: row.tagText,
      markupType: row.markupType,
      markupValue: row.markupType === "percent" 
        ? (row.percentagePreset === "custom" ? parseFloat(row.customPercent) || 0 : parseFloat(row.percentagePreset) || 0)
        : parseFloat(row.value) || 0
    }));

    return {
      conditionsType: connector,
      rules: rules
    };
  }, [rows, connector]);

  // ---- small render helper for a single condition card ----
  function ConditionCard({ row }: { row: Row }) {
    const isCollapsed = collapsedConditions[row.id] !== false; // Default to collapsed except first one
    
    const conditionSummary = useMemo(() => {
      const field = FIELD_OPTIONS.find((f) => f.value === row.field)?.label ?? row.field;
      const op = CONDITION_OPTIONS.find((o) => o.value === row.operator)?.label ?? row.operator;
      const value = row.tagText || '""';
      const markup = row.markupType === "percent"
        ? `${row.percentagePreset === "custom" ? row.customPercent || "0" : row.percentagePreset}%`
        : `$${row.value || "0"}`;
      
      return `${field} ${op} ${value} → ${markup} markup`;
    }, [row]);

    return (
      <Card key={row.id} background="bg-surface-secondary">
        <Box padding="300">
          <BlockStack gap="300">
            {/* Collapsible Header */}
            <InlineStack align="space-between" blockAlign="center">
              <Button
                variant="tertiary"
                onClick={() => toggleConditionCollapse(row.id)}
                icon={isCollapsed ? ChevronDownIcon : ChevronUpIcon}
                accessibilityLabel={isCollapsed ? "Expand condition" : "Collapse condition"}
              >
                {conditionSummary}
              </Button>
              <Button
                icon={DeleteIcon}
                onClick={() => removeRow(row.id)}
                accessibilityLabel="Delete condition"
                variant="tertiary"
              />
            </InlineStack>

            {/* Collapsible Content */}
            {!isCollapsed && (
              <BlockStack gap="300">
                <InlineGrid columns={{ xs: 1, md: 3 }} gap="300">
                  <Select
                    label="Field"
                    options={fieldOptionsWithPlaceholder}
                    value={fieldOptionsWithPlaceholder.some(o => o.value === row.field) ? row.field : (fieldOptionsWithPlaceholder[0]?.value || 'title')}
                    onChange={(val) => {
                      updateRow(row.id, "field", val);
                      // Auto-set operator to "between" for price fields
                      if (val === 'price' || val === 'Variant Price' || val.toLowerCase().includes('price')) {
                        updateRow(row.id, "operator", "between");
                      }
                    }}
                  />
                  <Select
                    label="Condition"
                    options={CONDITION_OPTIONS}
                    value={row.operator}
                    onChange={(val) => updateRow(row.id, "operator", val)}
                  />
                  <Box>
                    {/* Empty box for layout consistency */}
                  </Box>
                </InlineGrid>

                {(row.field === 'price' || row.field === 'Variant Price' || row.field.toLowerCase().includes('price')) ? (
                  <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
                    <TextField
                      label="From"
                      placeholder="Enter minimum price"
                      value={row.tagText.split('-')[0] || ''}
                      onChange={(val) => {
                        const currentTo = row.tagText.split('-')[1] || '';
                        updateRow(row.id, "tagText", `${val}-${currentTo}`);
                      }}
                      autoComplete="off"
                      type="number"
                      suffix="$"
                      onFocus={(e) => {
                        if (e?.target) {
                          const target = e.target as HTMLInputElement;
                          if (target) target.select();
                        }
                      }}
                    />
                    <TextField
                      label="To"
                      placeholder="Enter maximum price"
                      value={row.tagText.split('-')[1] || ''}
                      onChange={(val) => {
                        const currentFrom = row.tagText.split('-')[0] || '';
                        updateRow(row.id, "tagText", `${currentFrom}-${val}`);
                      }}
                      autoComplete="off"
                      type="number"
                      suffix="$"
                      onFocus={(e) => {
                        if (e?.target) {
                          const target = e.target as HTMLInputElement;
                          if (target) target.select();
                        }
                      }}
                    />
                  </InlineGrid>
                ) : row.field === 'tags' ? (
                  <div style={{ position: 'relative' }}>
                    <TextField
                      label={`Enter ${row.field}`}
                      placeholder={`Search or type ${row.field}`}
                      value={row.tagText}
                      onChange={(val) => {
                        updateRow(row.id, "tagText", val);
                        handleTagSearch(val, row.id);
                      }}
                      autoComplete="off"
                      onFocus={(e) => {
                        if (e?.target) {
                          const target = e.target as HTMLInputElement;
                          if (target) target.select();
                        }
                      }}
                    />
                    {tagSearchResults.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 1000,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}>
                        {tagSearchResults.map((tag, index) => (
                          <div
                            key={index}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              borderBottom: index < tagSearchResults.length - 1 ? '1px solid #eee' : 'none'
                            }}
                            onClick={() => {
                              updateRow(row.id, "tagText", tag);
                              setTagSearchResults([]);
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f5f5f5';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'white';
                            }}
                          >
                            {tag}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <TextField
                    label={`Enter ${row.field}`}
                    placeholder={`Enter ${row.field}`}
                    value={row.tagText}
                    onChange={(val) => updateRow(row.id, "tagText", val)}
                    autoComplete="off"
                    onFocus={(e) => {
                      if (e?.target) {
                        const target = e.target as HTMLInputElement;
                        if (target) target.select();
                      }
                    }}
                  />
                )}

                <InlineGrid columns={{ xs: 1, md: 3 }} gap="300">
                  <Select
                    label="Markup Type"
                    options={MARKUP_TYPES}
                    value={row.markupType}
                    onChange={(val) => updateRow(row.id, "markupType", val as Row["markupType"])}
                  />

                  {row.markupType === "percent" ? (
                    <Select
                      label="Percentage"
                      options={PERCENTAGE_PRESETS}
                      value={row.percentagePreset}
                      onChange={(val) => onChangePercentagePreset(row.id, val)}
                    />
                  ) : (
                    <TextField
                      label="Fixed Amount"
                      type="number"
                      value={row.value}
                      onChange={(val) => updateRow(row.id, "value", val)}
                      autoComplete="off"
                      suffix="$"
                      placeholder="Enter amount"
                      onFocus={(e) => {
                        if (e?.target) {
                          const target = e.target as HTMLInputElement;
                          if (target) target.select();
                        }
                      }}
                    />
                  )}

                  {row.markupType === "percent" && row.percentagePreset !== "custom" ? (
                    <TextField
                      label="Value"
                      value={row.value}
                      onChange={(val) => updateRow(row.id, "value", val)}
                      readOnly
                      suffix="%"
                      autoComplete="off"
                    />
                  ) : row.markupType === "percent" ? (
                    <TextField
                      label="Custom %"
                      placeholder="Enter %"
                      type="number"
                      value={row.customPercent}
                      onChange={(val) => {
                        updateRow(row.id, "customPercent", val);
                        updateRow(row.id, "value", val); // Also update value field
                      }}
                      suffix="%"
                      autoComplete="off"
                      onFocus={(e) => {
                        if (e?.target) {
                          const target = e.target as HTMLInputElement;
                          if (target) target.select();
                        }
                      }}
                    />
                  ) : (
                    <TextField
                      label="Amount"
                      value={row.value}
                      onChange={(val) => updateRow(row.id, "value", val)}
                      type="number"
                      suffix="$"
                      placeholder="Enter amount"
                      autoComplete="off"
                      onFocus={(e) => {
                        if (e?.target) {
                          const target = e.target as HTMLInputElement;
                          if (target) target.select();
                        }
                      }}
                    />
                  )}
                </InlineGrid>
              </BlockStack>
            )}
          </BlockStack>
        </Box>
      </Card>
    );
  }

  return (
    <Card>
    <Page title="Step 5: Markup Configuration" subtitle="Set up conditions-based markup rules for your products">
      <Layout>
        {/* Purpose Explanation */}
        <Layout.Section>
          <Banner
            title="Condition Builder for Product Markup"
            tone="info"
            icon={InfoIcon}
          >
            <BlockStack gap="200">
              <Text as="p" variant="bodySm">
                <strong>Purpose:</strong> Create markup rules that automatically apply to products based on their attributes. 
                Markup can be either a percentage or fixed amount, applied when products match your specified conditions.
              </Text>
              <Text as="p" variant="bodySm">
                <strong>Input Fields:</strong> SKU, Tag, Price, Vendor, Type, and other product attributes. 
                Choose markup type (Percentage or Fixed Amount) and set the value.
              </Text>
              <Text as="p" variant="bodySm">
                <strong>Logic:</strong> Use OR mode (any condition can match) 
                to control when markup applies.
              </Text>
            </BlockStack>
          </Banner>
        </Layout.Section>

        {selectedFiltersSummary && selectedFiltersSummary.length > 0 && (
          <Layout.Section>
            <Card>
              <div style={{ position: 'relative', zIndex: 1 }}>
              <Box padding="300">
                <BlockStack gap="150">
                  <Text as="h3" variant="headingSm">Selected Filters from Step 4</Text>
                  {selectedFiltersSummary.map((g) => (
                    <Box key={g.key} padding="200" borderColor="border" borderWidth="025" borderRadius="200">
                      <InlineStack align="space-between">
                        <Text as="h4" variant="bodyMd" fontWeight="semibold">{g.key}</Text>
                        <Text as="span" tone="subdued">{g.values.length} selected</Text>
                      </InlineStack>
                      <InlineStack gap="150" wrap>
                        {g.values.map((v) => (
                          <span key={v} style={{background:'#f6f8fb', padding:'4px 8px', borderRadius:12}}>{v}</span>
                        ))}
                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>
              </Box>
              </div>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <Box padding="400">
              <BlockStack gap="300">
                <InlineStack gap="200" blockAlign="center">
                  <div>
                    <Icon source={SettingsIcon} tone="info" />
                  </div>
                  <Text as="h3" variant="headingMd">Condition Builder</Text>
                </InlineStack>

                {/* Example */}
                <Box padding="300" background="bg-surface-info" borderRadius="300">
                  <BlockStack gap="200">
                    <Text as="h4" variant="headingSm">Example Configuration:</Text>
                    <Text as="p" variant="bodySm">
                      <strong>Condition 1:</strong> Tag = 'Premium', Markup 20%
                    </Text>
                    <Text as="p" variant="bodySm">
                      <strong>Condition 2:</strong> Price &gt; $500, Markup $50
                    </Text>
                    <Text as="p" variant="bodySm">
                      <strong>OR Mode:</strong> Either condition can be true for markup to apply
                    </Text>
                  </BlockStack>
                </Box>

                {/* OR Condition Selection - Hidden for single condition */}
                {/* <InlineStack gap="300" blockAlign="center">
                  <Text as="span">Products must match:</Text>
                  <InlineStack gap="200" blockAlign="center" align="start">
                    <RadioButton
                      label="any condition"
                      id="match-any"
                      name="match-mode"
                      checked={matchMode === "any"}
                      onChange={(checked) => checked && setMatchMode("any")}
                    />
                  </InlineStack>
                </InlineStack> */}

                {/* Explanation */}
                <Box padding="300" background="bg-surface-secondary" borderRadius="300">
                  <BlockStack gap="200">
                    <Text as="h4" variant="headingSm">How it works:</Text>
                    <Text as="p" variant="bodySm">
                      <strong>OR Logic:</strong> Any one condition can match for markup to apply. 
                      Example: Tag = "premium" OR Vendor = "Brand A" → Product needs either "premium" tag OR be from "Brand A" vendor.
                    </Text>
                    <Text as="p" variant="bodySm">
                      <strong>Markup Types:</strong> Choose between Percentage (e.g., 20% markup) or Fixed Amount (e.g., $50 markup) based on your pricing strategy.
                    </Text>
                    <Text as="p" variant="bodySm">
                      <strong>Field Bases:</strong> Apply markup based on any product attribute: SKU, Tags, Price, Vendor, Type, etc. Select the field that best fits your business rules.
                    </Text>
                  </BlockStack>
                </Box>

                {/* Conditions */}
                <BlockStack gap="400">
                  {rows.map((row, index) => (
                    <div key={row.id}>
                      <ConditionCard row={row} />
                      
                      {/* AND/OR connector between conditions - Hidden for single condition */}
                      {/* {index < rows.length - 1 && (
                        <InlineStack align="center" blockAlign="center" gap="300">
                          <div style={{ flex: 1 }}>
                            <Divider />
                          </div>
                          <Select
                            label=""
                            labelHidden
                            options={[{ label: "OR", value: "OR" }]}
                            value={connector}
                            onChange={(v) => handleConnectorChange(v as "AND" | "OR")}
                          />
                          <div style={{ flex: 1 }}>
                            <Divider />
                          </div>
                        </InlineStack>
                      )} */}
                    </div>
                  ))}

                  {/* Add row button - Hidden for single condition */}
                  {/* {canAddRow && (
                    <div>
                      <Button icon={PlusIcon} onClick={addRow}>
                        Add another condition
                      </Button>
                    </div>
                  )} */}
                </BlockStack>
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>

        {/* Preview */}
        <Layout.Section>
          <Box padding="300" background="bg-surface-success" borderRadius="300">
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Configuration Preview</Text>
              <Text as="p" tone="subdued">{previewText}</Text>
            </BlockStack>
          </Box>
        </Layout.Section>

        {/* JSON Output Preview */}
        <Layout.Section>
          <Card>
            <Box padding="300">
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">JSON Output for Backend</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  This JSON object will be sent to the backend to apply markup rules:
                </Text>
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <pre style={{ 
                    fontSize: '12px', 
                    overflow: 'auto', 
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {JSON.stringify(jsonOutput, null, 2)}
                  </pre>
                </Box>
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>

        {/* Footer */}
        <Layout.Section>
          <ButtonGroup>
            <Button icon={ArrowLeftIcon} onClick={onPrevious}>Previous</Button>
            <Button variant="primary" icon={ArrowRightIcon} onClick={onNext}>Next: Import Settings</Button>
          </ButtonGroup>
        </Layout.Section>
      </Layout>
    </Page>
    </Card>
  );
}

// Small helper to keep 3-column layout like screenshot
function InlineGridLike({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr auto",
        gap: "12px",
        alignItems: "end",
      }}
    >
      {children}
    </div>
  );
}
