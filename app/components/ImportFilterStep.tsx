import {useEffect, useMemo, useState, useCallback} from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Box,
  BlockStack,
  InlineStack,
  Button,
  TextField,
  Badge,
  Checkbox,
  InlineGrid,
  Divider,
  Tag,
  ButtonGroup
} from "@shopify/polaris";
import {useNavigate} from "@remix-run/react";
import { SaveIcon, ArrowLeftIcon, ArrowRightIcon, ChevronDownIcon, ChevronUpIcon, FileIcon, XIcon } from "@shopify/polaris-icons";

type Value = { label: string; count: number; originalValue?: string };
type Attribute = { key: string; label: string; values: Value[] };

type Selected = Record<string, string[]>;

const STATIC_ATTRS: Attribute[] = [
  { key: "category", label: "Category", values: [ { label: "Clothing", count: 189 }, { label: "Home-Garden", count: 156 }, { label: "Sports", count: 123 } ] },
  { key: "brand", label: "Brand", values: [ { label: "Apple", count: 89 }, { label: "Nike", count: 156 }, { label: "Samsung", count: 134 } ] },
  { key: "color", label: "Color", values: [ { label: "Red", count: 67 }, { label: "Blue", count: 145 }, { label: "Black", count: 234 }, { label: "Green", count: 88 } ] },
  { key: "material", label: "Material", values: [ { label: "Cotton", count: 89 }, { label: "Leather", count: 56 }, { label: "Plastic", count: 123 } ] }
];

export default function ImportFilterStep({
  filters,
  onFiltersChange,
  importType,
  dataSource,
  apiCredentials,
  csvData,
  mappings,
  onNext,
  onPrevious,
  onProductCountChange
}: {
  filters: { selectedAttributes: string[]; selectedValues: string[] };
  onFiltersChange: (next: { selectedAttributes: string[]; selectedValues: string[] }) => void;
  importType: 'all' | 'attribute';
  dataSource: 'api' | 'csv';
  apiCredentials: { apiUrl: string; accessToken: string };
  csvData: any;
  mappings?: Record<string, string>;
  onNext: () => void;
  onPrevious: () => void;
  onProductCountChange: (count: number) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedAttributes, setExpandedAttributes] = useState<Record<string, boolean>>({});
  const [apiData, setApiData] = useState<any[]>([]);
  const [isLoadingApiData, setIsLoadingApiData] = useState(false);

  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Selected>({});
  const [selectionMode, setSelectionMode] = useState<'attribute' | 'single'>('attribute');

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setQuery(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Clear search function
  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setQuery('');
  }, []);



  // Fetch API data for attributes
  const fetchApiData = async () => {
    if (dataSource !== 'api' || !apiCredentials?.apiUrl || !apiCredentials?.accessToken) return;
    
    setIsLoadingApiData(true);
    try {
      const formData = new FormData();
      formData.append('action', 'fetchSampleData');
      formData.append('apiUrl', apiCredentials.apiUrl);
      formData.append('accessToken', apiCredentials.accessToken);
      
      const resp = await fetch('/app/api/external', { method: 'POST', body: formData });
      const data = await resp.json();
      
      if (resp.ok && data?.success && data?.items) {
        console.log('API data fetched:', data.items.length, 'items');
        setApiData(data.items);
      } else {
        console.error('Failed to fetch API data:', data?.error);
        setApiData([]);
      }
    } catch (error) {
      console.error('Error fetching API data:', error);
      setApiData([]);
    } finally {
      setIsLoadingApiData(false);
    }
  };

  // Load API data on mount if API source
  useEffect(() => {
    if (dataSource === 'api') {
      fetchApiData();
      // Clear selected state for API case to prevent pre-selection
      setSelected({});
      setOpenGroups({});
    }
  }, [dataSource, apiCredentials?.apiUrl, apiCredentials?.accessToken]);

  // Also fetch when we have mappings but no API data
  useEffect(() => {
    if (dataSource === 'api' && mappings && Object.keys(mappings).length > 0 && apiData.length === 0 && !isLoadingApiData) {
      console.log('Fetching API data because we have mappings:', mappings);
      fetchApiData();
    }
  }, [dataSource, mappings, apiData.length, isLoadingApiData]);

  const computedCsvAttributes: Attribute[] = useMemo(() => {
    if (dataSource !== 'csv' || !csvData || !Array.isArray(csvData.headers) || !Array.isArray(csvData.rows)) return [];
    const headers: string[] = csvData.headers.filter((h: string) => !!h);
    const rows: Array<Record<string, string>> = csvData.rows;
    const attributes: Attribute[] = headers.map((header) => {
      const counts = new Map<string, number>();
      const valueToProduct = new Map<string, string>(); // Store product name for each value
      
      for (const row of rows) {
        const valueRaw = row[header];
        const value = (valueRaw ?? '').toString().trim();
        if (!value) continue;
        
        counts.set(value, (counts.get(value) ?? 0) + 1);
        
        // Store the first product name for this value
        if (!valueToProduct.has(value)) {
          const productName = row.Title || row['Product Title'] || 'Unknown Product';
          valueToProduct.set(value, productName);
        }
      }
      
      const values: Value[] = Array.from(counts.entries())
        .map(([label, count]) => {
          const productName = valueToProduct.get(label) || '';
          let displayLabel = label;
          
          // For price fields, show just the price value
          if (header === 'Variant Price' || header === 'Price') {
            displayLabel = label; // Just show the price, no product name
          }
          // For other fields, show just the value if it's short, otherwise truncate
          else if (label.length > 30) {
            displayLabel = `${label.substring(0, 30)}...`;
          }
          
          return { 
            label: displayLabel, 
            count,
            originalValue: label // Keep original value for filtering
          };
        })
        .sort((a, b) => b.count - a.count);
      return { key: header, label: header, values } as Attribute;
    });
    return attributes;
  }, [dataSource, csvData]);

  const computedApiAttributes: Attribute[] = useMemo(() => {
    if (dataSource !== 'api' || !Array.isArray(apiData) || apiData.length === 0) return [];
    
    // Get all unique keys from API data
    const allKeys = new Set<string>();
    for (const item of apiData) {
      if (item && typeof item === 'object') {
        Object.keys(item).forEach(key => allKeys.add(key));
      }
    }
    
    const attributes: Attribute[] = Array.from(allKeys).map((key) => {
      const counts = new Map<string, number>();
      const valueToItems = new Map<string, any[]>(); // Track items for each value
      
      for (const item of apiData) {
        if (!item || typeof item !== 'object') continue;
        const valueRaw = item[key];
        const value = (valueRaw ?? '').toString().trim();
        if (!value) continue;
        
        counts.set(value, (counts.get(value) ?? 0) + 1);
        
        // Track items for this value
        if (!valueToItems.has(value)) {
          valueToItems.set(value, []);
        }
        valueToItems.get(value)!.push(item);
      }
      
      const values: Value[] = Array.from(counts.entries())
        .map(([label, count]) => {
          let displayLabel = label;
          
          // For price fields, show just the price value
          if (key.toLowerCase().includes('price') || key.toLowerCase().includes('cost')) {
            displayLabel = label; // Just show the price, no product name
          } else {
            // For other fields, truncate long values
            if (label.length > 50) {
              displayLabel = label.substring(0, 47) + '...';
            }
          }
          
          return { 
            label: displayLabel, 
            count,
            originalValue: label // Keep original value for filtering
          };
        })
        .sort((a, b) => b.count - a.count);
        
      return { key, label: key, values } as Attribute;
    });
    console.log('Computed API attributes:', attributes.length, 'attributes');
    return attributes;
  }, [dataSource, apiData]);

  // Create attributes from mappings if no API data yet
  const mappedAttributes: Attribute[] = useMemo(() => {
    if (dataSource !== 'api' || !mappings || Object.keys(mappings).length === 0) return [];
    
    return Object.keys(mappings).map((key) => ({
      key,
      label: key,
      values: [] // Empty values until API data loads
    }));
  }, [dataSource, mappings]);

  const BASE_ATTRS: Attribute[] = useMemo(() => {
    console.log('Building BASE_ATTRS:', { dataSource, csvAttrs: computedCsvAttributes.length, apiAttrs: computedApiAttributes.length, mappedAttrs: mappedAttributes.length, mappings: mappings ? Object.keys(mappings) : [] });
    
    if (dataSource === 'csv' && computedCsvAttributes.length > 0) {
      if (mappings && Object.keys(mappings).length > 0) {
        const mappedSources = new Set(Object.keys(mappings));
        const filtered = computedCsvAttributes.filter(a => mappedSources.has(a.key));
        return filtered.length > 0 ? filtered : computedCsvAttributes;
      }
      return computedCsvAttributes;
    } else if (dataSource === 'api') {
      // If we have API data, use it
      if (computedApiAttributes.length > 0) {
        if (mappings && Object.keys(mappings).length > 0) {
          const mappedSources = new Set(Object.keys(mappings));
          const filtered = computedApiAttributes.filter(a => mappedSources.has(a.key));
          return filtered.length > 0 ? filtered : computedApiAttributes;
        }
        return computedApiAttributes;
      }
      // If no API data yet but we have mappings, show mapped keys
      if (mappedAttributes.length > 0) {
        return mappedAttributes;
      }
    }
    return STATIC_ATTRS;
  }, [dataSource, computedCsvAttributes, computedApiAttributes, mappedAttributes, mappings]);

  // Check if all products are selected
  const isAllProductsSelected = useMemo(() => {
    if (BASE_ATTRS.length === 0) return false;
    
    // Check if all attributes have values selected
    return BASE_ATTRS.every(attr => {
      const selectedValues = selected[attr.key] || [];
      return selectedValues.length > 0;
    });
  }, [selected, BASE_ATTRS]);

  // Get button text based on selection state
  const getButtonText = () => {
    return isAllProductsSelected ? "Unselect All Products" : "Select All Products";
  };

  const filteredAttrs = useMemo(() => {
    if (!query.trim()) return BASE_ATTRS;
    const q = query.toLowerCase();
    return BASE_ATTRS.map((a) => ({
      ...a,
      values: a.values.filter((v) => a.label.toLowerCase().includes(q) || v.label.toLowerCase().includes(q)),
    })).filter((a) => a.values.length > 0);
  }, [query, BASE_ATTRS]);

  const willImportCount = useMemo(() => {
    if (dataSource === 'csv' && csvData && Array.isArray(csvData.rows)) {
      const rows: Array<Record<string, string>> = csvData.rows;
      const selectedEntries = Object.entries(selected);
      if (selectedEntries.length === 0) return rows.length;
      const matches = rows.filter((row) => {
        for (const [attrKey, values] of selectedEntries) {
          if (!values || values.length === 0) continue;
          const cell = (row[attrKey] ?? '').toString();
          if (!values.includes(cell)) return false;
        }
        return true;
      });
      return matches.length;
    } else if (dataSource === 'api' && Array.isArray(apiData)) {
      const selectedEntries = Object.entries(selected);
      if (selectedEntries.length === 0) return apiData.length;
      const matches = apiData.filter((item) => {
        for (const [attrKey, values] of selectedEntries) {
          if (!values || values.length === 0) continue;
          const cell = (item[attrKey] ?? '').toString();
          if (!values.includes(cell)) return false;
        }
        return true;
      });
      return matches.length;
    }
    // Fallback for API source or missing data
    const base = 1247;
    const selectedCount = Object.values(selected).reduce((acc, arr) => acc + arr.length, 0);
    return Math.max(0, base - selectedCount * 7);
  }, [selected, dataSource, csvData, apiData]);

  useEffect(() => {
    onProductCountChange(willImportCount);
  }, [willImportCount, onProductCountChange]);

  // Auto-select mapped fields and their values - REMOVED for API case
  useEffect(() => {
    if (dataSource === 'csv' && mappings && Object.keys(mappings).length > 0) {
      // Only auto-select for CSV case, not for API case
      const next: Selected = {};
      
      // Get all available attributes (CSV or API)
      const availableAttrs = dataSource === 'csv' ? computedCsvAttributes : computedApiAttributes;
      
      // Auto-select mapped fields and their values
      for (const [sourceKey, targetKey] of Object.entries(mappings)) {
        const attr = availableAttrs.find(a => a.key === sourceKey);
        if (attr && attr.values.length > 0) {
          // Auto-select all values for this mapped field
          next[sourceKey] = attr.values.map(v => v.originalValue || v.label);
          console.log(`Auto-selected ${sourceKey}:`, next[sourceKey]);
        }
      }
      
      // Merge with existing selections
      setSelected(prev => ({ ...prev, ...next }));
    }
  }, [mappings, dataSource, computedCsvAttributes, computedApiAttributes]);

  // Initialize selection from incoming filters (if present)
  useEffect(() => {
    if (!filters) return;
    const next: Selected = {};
    const attrs = Array.isArray(filters.selectedAttributes) ? filters.selectedAttributes : [];
    const vals = Array.isArray(filters.selectedValues) ? filters.selectedValues : [];
    for (const a of attrs) {
      next[a] = next[a] || [];
    }
    for (const token of vals) {
      const parts = typeof token === 'string' ? token.split('::') : [];
      if (parts.length === 2) {
        const [attrKey, value] = parts;
        next[attrKey] = next[attrKey] || [];
        if (!next[attrKey].includes(value)) next[attrKey].push(value);
      }
    }
    setSelected(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist selection outward so Step 5 can show it
  useEffect(() => {
    const selectedAttributes = Object.keys(selected);
    const selectedValues: string[] = [];
    for (const [key, values] of Object.entries(selected)) {
      for (const v of values) {
        selectedValues.push(`${key}::${v}`);
      }
    }
    onFiltersChange({ selectedAttributes, selectedValues });
  }, [selected, onFiltersChange]);

  function groupBadge(a: Attribute) {
    return <Badge tone="info">{`${a.values.length} values`}</Badge>;
  }

  function toggleOpen(key: string) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function onToggleValue(attr: Attribute, value: Value, checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      const arr = new Set(next[attr.key] ?? []);
      // Use original value for filtering, but display label for UI
      const valueToStore = value.originalValue || value.label;
      if (checked) arr.add(valueToStore);
      else arr.delete(valueToStore);
      next[attr.key] = Array.from(arr);
      if (next[attr.key].length === 0) delete next[attr.key];
      if (checked) setOpenGroups((og) => ({ ...og, [attr.key]: true }));
      return next;
    });
  }

  function onSelectAll(attr: Attribute, checked: boolean) {
    // Don't allow selection if no values
    if (attr.values.length === 0) return;
    
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) {
        // Select all values for this attribute
        next[attr.key] = attr.values.map(v => v.originalValue || v.label);
        setOpenGroups((og) => ({ ...og, [attr.key]: true }));
      } else {
        // Deselect all values for this attribute
        delete next[attr.key];
      }
      return next;
    });
  }

  function isAllSelected(attr: Attribute): boolean {
    const selectedValues = selected[attr.key] || [];
    return selectedValues.length === attr.values.length && attr.values.length > 0;
  }

  function isPartiallySelected(attr: Attribute): boolean {
    const selectedValues = selected[attr.key] || [];
    return selectedValues.length > 0 && selectedValues.length < attr.values.length;
  }

  const handleClearAllFilters = () => {
    setSelected({});
    onFiltersChange({
      selectedAttributes: [],
      selectedValues: []
    });
  };

  const calculateWillImportCount = () => {
    // Check if "All Products" is selected (all values selected for all attributes)
    const allAttributesSelected = Object.keys(selected).length > 0;
    const allValuesSelected = Object.values(selected).every(values => values.length > 0);
    
    // If all attributes have values selected, treat as "All Products"
    const isAllProductsMode = allAttributesSelected && allValuesSelected;
    
    if (dataSource === 'csv' && csvData && Array.isArray(csvData.rows)) {
      const rows: Array<Record<string, string>> = csvData.rows;
      
      // If "All Products" mode, return all products
      if (isAllProductsMode) {
        console.log('=== ALL PRODUCTS MODE (CSV) ===');
        console.log('All attributes selected, returning all products:', rows.length);
        return rows.length;
      }
      
      const selectedEntries = Object.entries(selected);
      if (selectedEntries.length === 0) return rows.length;
      const matches = rows.filter((row) => {
        for (const [attrKey, values] of selectedEntries) {
          if (!values || values.length === 0) continue;
          const cell = (row[attrKey] ?? '').toString();
          if (!values.includes(cell)) return false;
        }
        return true;
      });
      return matches.length;
    } else if (dataSource === 'api' && Array.isArray(apiData)) {
      // If "All Products" mode, return all products
      if (isAllProductsMode) {
        console.log('=== ALL PRODUCTS MODE (API) ===');
        console.log('All attributes selected, returning all products:', apiData.length);
        return apiData.length;
      }
      
      const selectedEntries = Object.entries(selected);
      if (selectedEntries.length === 0) return apiData.length;
      const matches = apiData.filter((item) => {
        for (const [attrKey, values] of selectedEntries) {
          if (!values || values.length === 0) continue;
          const cell = (item[attrKey] ?? '').toString();
          if (!values.includes(cell)) return false;
        }
        return true;
      });
      return matches.length;
    }
    // Fallback for API source or missing data
    const base = 1247;
    const selectedCount = Object.values(selected).reduce((acc, arr) => acc + arr.length, 0);
    return Math.max(0, base - selectedCount * 7);
  };

  const handleNext = () => {
    // Check if any attributes are selected
    if (Object.keys(selected).length === 0) {
      console.log('No attributes selected, cannot proceed');
      return;
    }
    
    let selectedAttributes: string[];
    let selectedValues: string[];
    
    if (selectionMode === 'single') {
      // Single product selection mode
      const selectedEntries = Object.entries(selected);
      if (selectedEntries.length > 0) {
        // Take only the first selected product's attributes
        const [firstAttrKey, firstAttrValues] = selectedEntries[0];
        selectedAttributes = [firstAttrKey];
        selectedValues = firstAttrValues.map(value => `${firstAttrKey}::${value}`);
      } else {
        selectedAttributes = [];
        selectedValues = [];
      }
    } else {
      // Attribute-based selection mode (original logic)
      selectedAttributes = Object.keys(selected);
      selectedValues = Object.entries(selected).flatMap(([key, values]) =>
        values.map(value => `${key}::${value}`)
      );
    }
    
    onFiltersChange({
      selectedAttributes,
      selectedValues
    });
    
    // Calculate product count based on filters
    const count = calculateWillImportCount();
    onProductCountChange(count);
    
    onNext();
  };

  return (
    <Card>
    <Page
      title="Step 4: Import Filters"
      subtitle="Configure attribute-based filters for your import"
    >
      <Layout>
        <Layout.Section>
          <Card>
            <Box padding="300">
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Select Attributes</Text>
                  <InlineStack gap="200">
                    <Button
                      variant="primary"
                      onClick={() => {
                        if (isAllProductsSelected) {
                          // Unselect All Products: Clear all selections
                          setSelected({});
                          setOpenGroups({});
                        } else {
                          // Select All Products: Select all unique values from all products
                          const allProductsSelected: Selected = {};
                          
                          if (dataSource === 'csv' && csvData && Array.isArray(csvData.rows)) {
                            const rows = csvData.rows;
                            
                            // Collect all unique values for each attribute from all products
                            BASE_ATTRS.forEach(attr => {
                              const uniqueValues = new Set<string>();
                              rows.forEach((row: any) => {
                                const value = String(row[attr.key] || '').trim();
                                if (value) {
                                  uniqueValues.add(value);
                                }
                              });
                              allProductsSelected[attr.key] = Array.from(uniqueValues);
                            });
                          } else if (dataSource === 'api' && Array.isArray(apiData)) {
                            // For API data, use the computed attributes to get original values
                            BASE_ATTRS.forEach(attr => {
                              const uniqueValues = new Set<string>();
                              attr.values.forEach(v => {
                                // Use originalValue for filtering, not the display label
                                const value = v.originalValue || v.label;
                                if (value) {
                                  uniqueValues.add(value);
                                }
                              });
                              allProductsSelected[attr.key] = Array.from(uniqueValues);
                            });
                          } else {
                            // Fallback: select all values from attributes
                            BASE_ATTRS.forEach(attr => {
                              allProductsSelected[attr.key] = attr.values.map(v => v.originalValue || v.label);
                            });
                          }
                          
                          setSelected(allProductsSelected);
                          
                          // Open all groups
                          const allOpen: Record<string, boolean> = {};
                          BASE_ATTRS.forEach(attr => {
                            allOpen[attr.key] = true;
                          });
                          setOpenGroups(allOpen);
                        }
                      }}
                    >
                      {getButtonText()}
                    </Button>
                  </InlineStack>
                </InlineStack>
                
                <div style={{ width: '100%' }}>
                  <TextField
                    label="Search attributes and values..."
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Type to search..."
                    autoComplete="off"
                    connectedRight={
                      searchTerm && (
                        <Button
                          icon={XIcon}
                          onClick={clearSearch}
                          variant="tertiary"
                          accessibilityLabel="Clear search"
                        />
                      )
                    }
                  />
                </div>
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>

        <Layout.Section>
          {isLoadingApiData ? (
            <Box padding="400">
              <Text as="p" tone="subdued">Loading API data...</Text>
            </Box>
          ) : (
            <InlineGrid columns={{xs: 1, md: 2}} gap="300">
              {filteredAttrs.map((attr) => (
                <Card key={attr.key} padding="0">
                  <Box padding="300">
                    <BlockStack gap="200">
                      <InlineStack align="space-between" blockAlign="center">
                        <InlineStack gap="200" blockAlign="center">
                          <Checkbox
                            label={attr.label}
                            checked={isAllSelected(attr)}
                            disabled={attr.values.length === 0}
                            onChange={(newChecked) => {
                              onSelectAll(attr, newChecked);
                            }}
                          />
                          {groupBadge(attr)}
                        </InlineStack>
                        <Button
                          variant="tertiary"
                          icon={openGroups[attr.key] ? ChevronUpIcon : ChevronDownIcon}
                          onClick={() => toggleOpen(attr.key)}
                        />
                      </InlineStack>

                      {openGroups[attr.key] && (
                        <BlockStack gap="150">
                          <Text as="p" tone="subdued">SELECT VALUES</Text>
                          <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e1e3e5', borderRadius: '8px', padding: '8px' }}>
                            <BlockStack gap="100">
                              {attr.values.length > 0 ? (
                                attr.values.map((v) => (
                                  <InlineStack key={v.label} align="space-between" blockAlign="center">
                                    <Checkbox
                                      label={v.label}
                                      checked={!!selected[attr.key]?.includes(v.originalValue || v.label)}
                                      onChange={(checked) => onToggleValue(attr, v, checked)}
                                    />
                                    <Text as="span" tone="subdued">{v.count} products</Text>
                                  </InlineStack>
                                ))
                              ) : (
                                <Box padding="200">
                                  <Text as="p" tone="subdued" variant="bodySm">NO VALUE FOUND</Text>
                                </Box>
                              )}
                            </BlockStack>
                          </div>
                        </BlockStack>
                      )}
                    </BlockStack>
                  </Box>
                </Card>
              ))}
            </InlineGrid>
          )}
        </Layout.Section>

        <Layout.Section>
          <Card>
            <Box padding="300">
              <Badge tone="success">
                {Object.keys(selected).length > 0 ? "Selected Attributes" : "No attributes selected"}
              </Badge>
              <BlockStack gap="300">
                {Object.entries(selected).map(([key, values]) => {
                  const a = BASE_ATTRS.find((x) => x.key === key);
                  if (!a) return null; // Skip if attribute not found
                  return (
                    <Box key={key} padding="200" borderColor="border" borderWidth="025" borderRadius="200">
                      <InlineStack align="space-between">
                        <Text as="h4" variant="bodyMd" fontWeight="semibold">{a.label || a.key}</Text>
                        <Text as="span" tone="subdued">{values.length} values selected</Text>
                      </InlineStack>
                      <InlineStack gap="150" wrap>
                        {values.map((val) => (
                          <Tag key={val} onRemove={() => onToggleValue(a, {label: val, count: 0}, false)}>
                            {val}
                          </Tag>
                        ))}
                      </InlineStack>
                    </Box>
                  );
                })}
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>

        <Layout.Section> 
            <Box padding="300" background="bg-fill-success-secondary" borderRadius="300">
              <Text as="p">{willImportCount} products will be imported</Text>
              <Text as="span" tone="subdued">All available products</Text>
            </Box> 
        </Layout.Section>

        <Layout.Section>
          <BlockStack align="end">
                  <ButtonGroup>
                    <Button 
                      icon={ArrowLeftIcon}
                      onClick={onPrevious}
                    >
                      Previous
                    </Button>
                    
                    <Button 
                      variant="primary"
                      icon={ArrowRightIcon}
                      onClick={handleNext}
                      disabled={Object.keys(selected).length === 0}
                    >
                      Next: Markup Configuration
                    </Button>
                  </ButtonGroup>
                </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
    </Card>
  );
}
