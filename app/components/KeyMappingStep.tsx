import {useState, useMemo, useEffect} from "react";
import {
  Page,
  Card,
  Layout,
  Text,
  Box,
  BlockStack,
  InlineStack,
  Button,
  Select,
  Badge,
  Icon,
  TextField,
  InlineGrid,
  Divider,
  Banner
} from "@shopify/polaris";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PlusIcon,
  DeleteIcon,
  LinkIcon,
  DatabaseIcon,
  CartIcon
} from "@shopify/polaris-icons";
import {useNavigate} from "@remix-run/react"; 

// ---- helpers ----
function toOptions(values: string[], icon?: any) {
  return values.map((v) => ({
    label: v, 
    value: v,
    prefix: icon ? <Icon source={icon} tone="subdued" /> : undefined
  }));
}

function uniqFilter(values: string[], taken: Set<string>) {
  return values.filter((v) => !taken.has(v));
}

interface KeyMappingStepProps {
  mappings: Record<string, string>;
  onMappingsChange: (next: Record<string, string>) => void;
  dataSource: 'api' | 'csv';
  apiCredentials?: { apiUrl: string; accessToken: string };
  csvData: any;
  onNext: () => void;
  onPrevious: () => void;
}

export default function KeyMappingStep({
  mappings,
  onMappingsChange,
  dataSource,
  apiCredentials,
  csvData,
  onNext,
  onPrevious,
}: KeyMappingStepProps) {
  const [showPreview, setShowPreview] = useState(false);
  const navigate = useNavigate();

  const [sourceFields, setSourceFields] = useState<string[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);

  // Debug logs for props
  console.log('🔍 KeyMappingStep props:', {
    dataSource,
    csvData: csvData ? {
      fileName: csvData.fileName,
      headers: csvData.headers,
      totalRows: csvData.totalRows,
      hasRows: csvData.rows && csvData.rows.length > 0
    } : null,
    apiCredentials,
    mappings
  });

  // Saved connections loaded from the database
  type SavedConnection = {
    id: string;
    name: string;
    type: 'api' | 'csv' | string;
    apiUrl?: string | null;
    csvFileName?: string | null;
    status?: string | null;
    updatedAt?: string | null;
  };
  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);

  function getTimeAgo(dateInput?: string | null) {
    if (!dateInput) return '—';
    const date = new Date(dateInput);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);
    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? '' : 's'} ago`;
    if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
    return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  }

  async function loadConnections() {
    setIsLoadingConnections(true);
    setConnectionsError(null);
    try {
      const resp = await fetch('/app/api/connections');
      const data = await resp.json();
      if (resp.ok && data?.success) {
        const list: SavedConnection[] = (data.connections || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          apiUrl: c.apiUrl ?? null,
          csvFileName: c.csvFileName ?? null,
          status: c.status ?? 'connected',
          updatedAt: c.updatedAt ?? null,
        }));
        setConnections(list);
      } else {
        setConnections([]);
        setConnectionsError(typeof data?.error === 'string' ? data.error : 'Failed to load connections');
      }
    } catch (e) {
      setConnections([]);
      setConnectionsError('Failed to load connections');
    } finally {
      setIsLoadingConnections(false);
    }
  }

  async function fetchApiSourceFields() {
    if (!apiCredentials?.apiUrl || !apiCredentials?.accessToken) return;
    setIsLoadingFields(true);
    try {
      const formData = new FormData();
      formData.append('action', 'fetchSampleFields');
      formData.append('apiUrl', apiCredentials.apiUrl);
      formData.append('accessToken', apiCredentials.accessToken);
      const resp = await fetch('/app/api/external', { method: 'POST', body: formData });
      const data = await resp.json();
      if (resp.ok && data?.success) {
        setSourceFields(Array.isArray(data.fields) ? data.fields : []);
      } else {
        setSourceFields([]);
      }
    } catch {
      setSourceFields([]);
    } finally {
      setIsLoadingFields(false);
    }
  }

  // Load fields on mount if API
  useEffect(() => {
    console.log('🔍 KeyMappingStep useEffect - dataSource:', dataSource);
    console.log('🔍 CSV Data received:', csvData);
    console.log('🔍 CSV Data type:', typeof csvData);
    console.log('🔍 CSV Data keys:', csvData ? Object.keys(csvData) : 'null');
    
    if (dataSource === 'api') {
      console.log('🔍 Loading API source fields...');
      fetchApiSourceFields();
    } else {
      // Derive from CSV header when CSV is the source
      console.log('🔍 Loading CSV source fields...');
      
      let headers: string[] = [];
      let csvDataToUse = csvData;
      
      // If no CSV data, try to restore from localStorage
      if (!csvDataToUse) {
        console.log('🔍 No CSV data, checking localStorage...');
        const savedData = localStorage.getItem('csvData');
        if (savedData) {
          try {
            csvDataToUse = JSON.parse(savedData);
            console.log('🔍 Restored CSV data from localStorage:', csvDataToUse);
          } catch (error) {
            console.log('❌ Error parsing localStorage data:', error);
          }
        }
      }
      
      if (csvDataToUse) {
        // Try different possible structures
        if (Array.isArray(csvDataToUse.headers)) {
          console.log('✅ CSV headers found in csvData.headers:', csvDataToUse.headers);
          headers = csvDataToUse.headers;
        } else if (csvDataToUse.rows && csvDataToUse.rows.length > 0) {
          // Fallback: extract headers from first row
          console.log('🔍 Extracting headers from CSV rows...');
          const firstRow = csvDataToUse.rows[0];
          headers = Object.keys(firstRow);
          console.log('✅ Extracted headers from rows:', headers);
        } else if (csvDataToUse.data && Array.isArray(csvDataToUse.data)) {
          // Another possible structure
          console.log('🔍 Trying csvData.data structure...');
          if (csvDataToUse.data.length > 0) {
            headers = Object.keys(csvDataToUse.data[0]);
            console.log('✅ Extracted headers from csvData.data:', headers);
          }
        } else {
          console.log('❌ No recognizable CSV structure found');
          console.log('🔍 csvData structure:', JSON.stringify(csvDataToUse, null, 2));
        }
      } else {
        console.log('❌ No CSV data provided');
      }
      
      console.log('🔍 Final headers to set:', headers);
      
      // Check for duplicates in headers
      const duplicateHeaders = headers.filter((item, index) => headers.indexOf(item) !== index);
      if (duplicateHeaders.length > 0) {
        console.warn('⚠️ Duplicate headers found:', duplicateHeaders);
      }
      
      // Remove duplicates from headers before setting
      const uniqueHeaders = [...new Set(headers)];
      if (uniqueHeaders.length !== headers.length) {
        console.log('🔍 Removed duplicate headers. Original count:', headers.length, 'Unique count:', uniqueHeaders.length);
      }
      
      setSourceFields(uniqueHeaders);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSource, apiCredentials?.apiUrl, apiCredentials?.accessToken, csvData]);

  // Ensure source fields are restored when component mounts
  useEffect(() => {
    if (sourceFields.length === 0) {
      console.log('🔍 Source fields empty, attempting to restore...');
      
      if (dataSource === 'csv') {
        // Try to restore CSV headers
        const savedData = localStorage.getItem('csvData');
        if (savedData) {
          try {
            const csvDataToUse = JSON.parse(savedData);
            if (Array.isArray(csvDataToUse.headers)) {
              console.log('✅ Restored CSV headers from localStorage:', csvDataToUse.headers);
              setSourceFields(csvDataToUse.headers);
            }
          } catch (error) {
            console.log('❌ Error restoring CSV headers:', error);
          }
        }
      }
    }
  }, [dataSource, sourceFields.length]);

  // Load saved connections once so we can show a simple list for reference
  useEffect(() => {
    loadConnections();
  }, []);

  const shopifyFields = [
    "title *",
    "body_html",
    "vendor",
    "product_type",
    "tags",
    "price *",
    "compare_at_price",
    "inventory_quantity",
    "weight",
    "weight_unit",
    "sku *",
    "barcode",
    "requires_shipping",
    "taxable",
    "status",
    "image_src",
  ];

  type Row = { id: string; source: string; target: string };
  const [rows, setRows] = useState<Row[]>([]);

  // Initialize with empty row if no rows exist
  useEffect(() => {
    if (rows.length === 0) {
      console.log('🔍 Initializing with empty row');
      setRows([{ id: crypto.randomUUID(), source: "", target: "" }]);
    }
  }, []); // Only run once on mount

  // Restore mappings from props when component mounts
  useEffect(() => {
    console.log('🔍 Restoring mappings from props:', mappings);
    
    // Only restore if mappings changed and we don't already have rows
    if (mappings && Object.keys(mappings).length > 0 && rows.length === 0) {
      const restoredRows: Row[] = Object.entries(mappings).map(([source, target]) => ({
        id: crypto.randomUUID(),
        source,
        target: String(target)
      }));
      
      // Add empty row if no mappings
      if (restoredRows.length === 0) {
        restoredRows.push({ id: crypto.randomUUID(), source: "", target: "" });
      }
      
      console.log('🔍 Restored rows from mappings:', restoredRows);
      setRows(restoredRows);
    } else if (!mappings || Object.keys(mappings).length === 0) {
      // Check localStorage for saved mappings only if no props
      const savedMappings = localStorage.getItem('import_key_mappings');
      if (savedMappings && rows.length === 0) {
        try {
          const parsedMappings = JSON.parse(savedMappings);
          console.log('🔍 Restoring mappings from localStorage:', parsedMappings);
          
          if (parsedMappings && Object.keys(parsedMappings).length > 0) {
            const restoredRows: Row[] = Object.entries(parsedMappings).map(([source, target]) => ({
              id: crypto.randomUUID(),
              source,
              target: String(target)
            }));
            
            console.log('🔍 Restored rows from localStorage:', restoredRows);
            setRows(restoredRows);
          }
        } catch (error) {
          console.log('❌ Error parsing saved mappings:', error);
        }
      }
    }
  }, [mappings]); // Only depend on mappings, not rows

  const mappedCount = useMemo(() => {
    const count = rows.filter(r => r.source && r.target).length;
    return count;
  }, [rows]);

  // Persist mappings upward whenever rows change
  useEffect(() => {
    const nextMappings: Record<string, string> = {};
    for (const r of rows) {
      if (r.source && r.target) {
        nextMappings[r.source] = r.target;
      }
    }
    onMappingsChange(nextMappings);
  }, [rows, onMappingsChange]);

  const takenSources = useMemo(
    () => new Set(rows.map((r) => r.source).filter(Boolean)),
    [rows]
  );
  const takenTargets = useMemo(
    () => new Set(rows.map((r) => r.target).filter(Boolean)),
    [rows]
  );

  const sourceOptions = useMemo(
    () => {
      // Get all currently selected source values
      const selectedSources = rows.map(r => r.source).filter(Boolean);
      
      // Include all source fields plus currently selected values
      const allOptions = [...new Set([...sourceFields, ...selectedSources])];
      const options = toOptions(allOptions, DatabaseIcon);
      
      console.log('🔍 Source options generated:', {
        sourceFields,
        selectedSources,
        allOptions,
        options
      });
      return options;
    },
    [sourceFields, rows.map(r => r.source).join(',')] // Use string instead of array
  );

  // Function to get source options for a specific row (excluding already selected ones)
  const getSourceOptionsForRow = (currentRowId: string) => {
    // Get all currently selected source values except the current row's value
    const otherSelectedSources = rows
      .filter(r => r.id !== currentRowId && r.source)
      .map(r => r.source);
    
    // Filter out already selected sources from other rows
    const availableOptions = sourceFields.filter(field => !otherSelectedSources.includes(field));
    
    // Add the current row's selected value back if it exists and is not already in availableOptions
    const currentRow = rows.find(r => r.id === currentRowId);
    if (currentRow?.source && !availableOptions.includes(currentRow.source)) {
      availableOptions.push(currentRow.source);
    }
    
    // Remove duplicates and return
    const uniqueOptions = [...new Set(availableOptions)];
    return toOptions(uniqueOptions, DatabaseIcon);
  };
  const targetOptions = useMemo(
    () => {
      // Get all currently selected target values
      const selectedTargets = rows.map(r => r.target).filter(Boolean);
      
      // Include all Shopify fields plus currently selected values
      const allOptions = [...new Set([...shopifyFields, ...selectedTargets])];
      const options = toOptions(allOptions, CartIcon);
      
      console.log('🔍 Target options generated:', {
        shopifyFields,
        selectedTargets,
        allOptions,
        options
      });
      return options;
    },
    [shopifyFields, rows.map(r => r.target).join(',')] // Use string instead of array
  );

  // Function to get target options for a specific row (excluding already selected ones)
  const getTargetOptionsForRow = (currentRowId: string) => {
    // Get all currently selected target values except the current row's value
    const otherSelectedTargets = rows
      .filter(r => r.id !== currentRowId && r.target)
      .map(r => r.target);
    
    // Filter out already selected targets from other rows
    const availableOptions = shopifyFields.filter(field => !otherSelectedTargets.includes(field));
    
    // Add the current row's selected value back if it exists and is not already in availableOptions
    const currentRow = rows.find(r => r.id === currentRowId);
    if (currentRow?.target && !availableOptions.includes(currentRow.target)) {
      availableOptions.push(currentRow.target);
    }
    
    // Remove duplicates and return
    const uniqueOptions = [...new Set(availableOptions)];
    return toOptions(uniqueOptions, CartIcon);
  };

  function addRow() {
    console.log('🔍 addRow called');
    setRows((prev) => {
      const newRows = [...prev, { id: crypto.randomUUID(), source: "", target: "" }];
      console.log('🔍 New rows after add:', newRows);
      return newRows;
    });
  }

  function removeRow(id: string) {
    console.log('🔍 removeRow called with id:', id);
    setRows((prev) => {
      const filteredRows = prev.filter((r) => r.id !== id);
      console.log('🔍 Rows after remove:', filteredRows);
      return filteredRows;
    });
  }

  function updateRow(id: string, key: keyof Row, value: string) {
    console.log('🔍 updateRow called:', { id, key, value });
    setRows((prev) => {
      const updated = prev.map((r) => (r.id === id ? { ...r, [key]: value } : r));
      console.log('🔍 Rows after update:', updated);
      return updated;
    });
  }

  const canProceed = mappedCount > 0;

  // Validation logic for required fields
  const requiredFields = ['title *', 'price *', 'sku *'];
  const mappedTargets = rows.map(r => r.target).filter(Boolean);
  const missingRequiredFields = requiredFields.filter(field => !mappedTargets.includes(field));
  const hasRequiredFields = missingRequiredFields.length === 0;
  
  // Show validation error if required fields are missing
  const showValidationError = mappedCount > 0 && !hasRequiredFields;

  return (
    <Card>
    <Page
      title="Step 3: Key Mapping"
      subtitle="Map your API fields to Shopify product attributes using dropdown selectors"
    >
      <Layout>
        {/* KPI Strip */}
         <Layout.Section>
              <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
                <div style={{ background: '#faf5fe', padding: '1rem', border: '1px solid #e9baff', borderRadius: '10px' }} >
                  <Box padding="100">
                    <BlockStack gap="100">
                      <BlockStack gap="100" inlineAlign="start">
                        <div style={{ textAlign: 'left', display: 'flex',alignItems:'center', gap: '5px' }}> 
                          <Icon source={DatabaseIcon} tone="magic" /> 
                          <Text as="p" variant="bodySm" fontWeight="semibold" tone="magic" >Source Fields</Text>
                        </div>
                      </BlockStack>
                      <Text variant="headingLg" as="p" tone="magic">{sourceFields.length}</Text>
                      <Text variant="headingXs" as="p" tone="magic">Available sources</Text>
                    </BlockStack>
                  </Box>
                </div>
             
                <div style={{ background: '#eef5fe', padding: '1rem', border: '1px solid #95b4e7', borderRadius: '10px', color: '#1970ff' }} >
                  <Box padding="100">
                    <BlockStack gap="100">
                      <BlockStack gap="100" inlineAlign="start">
                        <div style={{ textAlign: 'left', display: 'flex', gap: '5px' }}>
                          <Icon source={CartIcon} tone="info" />
                          <Text as="p" variant="bodyMd" fontWeight="semibold"  >Shopify Fields</Text>
                        </div>
                      </BlockStack>
                      <Text variant="headingLg" as="p" >{shopifyFields.length}</Text>
                      <Text variant="headingXs" as="p"  >Available targets</Text>

                    </BlockStack>
                  </Box>
                </div> 

                   <div style={{ background: '#f0fdf4', padding: '1rem', border: '1px solid #6cb191', borderRadius: '10px' }} >
                  <Box padding="100">
                    <BlockStack gap="100">
                      <BlockStack gap="100" inlineAlign="start">
                        <div style={{ textAlign: 'left', display: 'flex', gap: '5px' }}>
                          <Icon source={LinkIcon} tone="success" />
                          <Text as="p" variant="bodyMd" fontWeight="semibold" tone="success">Mapped</Text>
                        </div>
                      </BlockStack>
                      <Text variant="headingLg" as="p" tone="success">{mappedCount}</Text>
                      <Text variant="headingXs" as="p" tone="success">Active mappings</Text>

                    </BlockStack>
                  </Box>
                </div>
              </InlineGrid>
            </Layout.Section>

        {/* Field Mappings */}
        <Layout.Section>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <Text variant="headingMd" as="h3">
                Field Mappings
              </Text>
              <Button onClick={addRow} size="slim">
                Add Mapping
              </Button>
            </InlineStack>

            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h4">
                  Required Fields: title *, price *, sku * - These fields are required for product creation. Make sure to map at least these three fields.
                </Text>
                
                {missingRequiredFields.length > 0 && (
                  <Banner tone="warning">
                    Missing Required Fields: Please map the following required fields: {missingRequiredFields.join(', ')}
                  </Banner>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'center' }}>
                  <Text variant="headingSm" as="h5" fontWeight="semibold">
                    <InlineStack gap="200" align="center">
                      <Icon source={DatabaseIcon} />
                      SOURCE FIELD
                    </InlineStack>
                  </Text>
                  <Text variant="headingSm" as="h5" fontWeight="semibold">
                    <InlineStack gap="200" align="center">
                      <Icon source={CartIcon} />
                      SHOPIFY FIELD
                    </InlineStack>
                  </Text>
                  <div></div>
                </div>

                {sourceFields.length === 0 && dataSource === 'csv' && (
                  <div style={{ background: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '8px', padding: '12px' }}>
                    <Text as="p" variant="bodySm" tone="critical">
                      <strong>⚠️ CSV Headers Not Found:</strong> No CSV headers were detected. Please ensure your CSV file has headers in the first row and try uploading again.
                    </Text>
                  </div>
                )}

                <Divider />

                {/* rows */}
                <BlockStack gap="200">
                  {rows.map((row) => (
                    <div key={row.id} style={{border:'1px solid #ccc', padding:'10px', borderRadius:'10px'}}>
                      <InlineGrid columns={{xs: 1, md: 2}} gap="200" alignItems="center">
                        <Select
                          label="Select source field"
                          labelHidden
                          options={getSourceOptionsForRow(row.id)}
                          value={row.source}
                          onChange={(v) => {
                            console.log('🔍 Source field changed:', { rowId: row.id, oldValue: row.source, newValue: v });
                            updateRow(row.id, "source", v);
                          }}
                          placeholder={sourceFields.length === 0 ? "No CSV headers found" : "Select source field"}
                          disabled={sourceFields.length === 0}
                        />
                        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                          <div style={{width:'90%'}}>
                            <Select
                              label="Select Shopify field"
                              labelHidden
                              options={getTargetOptionsForRow(row.id)}
                              value={row.target}
                              onChange={(v) => {
                                console.log('🔍 Shopify field changed:', { rowId: row.id, oldValue: row.target, newValue: v });
                                updateRow(row.id, "target", v);
                              }}
                              placeholder="Select Shopify field"
                            />
                          </div>
                          <div>
                            <Button icon={DeleteIcon} onClick={() => removeRow(row.id)} accessibilityLabel="Remove mapping" />
                          </div>
                        </div>
                      </InlineGrid>
                    </div>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>



        {/* Footer Nav */}
        <Layout.Section>
          <InlineStack gap="300">
            <Button   icon={ArrowLeftIcon} onClick={onPrevious}>
              Previous Step
            </Button>
            <Button  
              icon={ArrowRightIcon} 
              onClick={onNext}
              disabled={!canProceed || !hasRequiredFields}
            >
              Next Step
            </Button>
          </InlineStack>
        </Layout.Section>
      </Layout>
    </Page>
    </Card>
  );
}
