import { useState, useEffect } from 'react';
import {
  Card,
  Layout,
  Button,
  TextField,
  Select,
  Banner,
  Badge,
  RadioButton,
  BlockStack,
  Text,
  Box,
  Icon,
  Spinner,
  ButtonGroup,
  FormLayout,
  Divider,
  InlineStack,
  InlineGrid
} from '@shopify/polaris';
import {
  CheckCircleIcon,
  AlertCircleIcon,
  ListBulletedIcon,
  ArrowLeftIcon,
  PlusIcon,
  OrganizationIcon,
  EmailIcon,
  UploadIcon,
  FileIcon,
  LinkIcon,
  DatabaseIcon,
  KeyIcon
} from '@shopify/polaris-icons';

type ValidationStatus = 'success' | 'error' | null;

interface Credentials {
  apiUrl: string;
  accessToken: string;
  connectionId?: string;
}

interface ApiCredentialsStepProps {
  credentials: Credentials;
  onCredentialsChange: (next: Credentials) => void;
  onNext: () => void;
  onGoToList?: () => void;
  editingApi?: { name: string } | null;
  onConnectionTypeChange?: (type: 'api' | 'csv') => void;
  onSelectCsvImport?: () => void;
}

export default function ApiCredentialsStep({ credentials, onCredentialsChange, onNext, onGoToList, editingApi = null, onConnectionTypeChange, onSelectCsvImport }: ApiCredentialsStepProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>(null); // null, 'success', 'error'
  const [validationMessage, setValidationMessage] = useState<string>('');
  
  // Supplier and connection type management
  const [supplierName, setSupplierName] = useState<string>('');
  const [supplierEmail, setSupplierEmail] = useState<string>('');
  const [connectionType, setConnectionType] = useState<'api' | 'csv'>('api'); // 'api' or 'csv'
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUploadSuccess, setCsvUploadSuccess] = useState<boolean>(false); // Track CSV upload success
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [savedConnections, setSavedConnections] = useState<any[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);
  
  // Load saved connections from database
  useEffect(() => {
    async function loadConnections() {
      setIsLoadingConnections(true);
      try {
        const resp = await fetch('/app/api/connections');
        const data = await resp.json();
        if (resp.ok && data?.success) {
          setSavedConnections(data.connections || []);
        }
      } catch (error) {
        console.error('Error loading connections:', error);
      } finally {
        setIsLoadingConnections(false);
      }
    }
    loadConnections();
  }, []);
  
  // Build suppliers list from saved connections - deduplicate by supplier email
  const uniqueSuppliers = savedConnections.reduce((acc: any[], conn) => {
    const existingIndex = acc.findIndex(s => s.supplierEmail === conn.supplierEmail);
    if (existingIndex === -1) {
      acc.push({
        label: `${conn.supplierName || conn.name} (${conn.supplierEmail || 'No email'})`,
        value: conn.id,
        supplierName: conn.supplierName || conn.name,
        supplierEmail: conn.supplierEmail
      });
    }
    return acc;
  }, []);

  const suppliers = [
    ...uniqueSuppliers,
    { label: 'Add New Supplier', value: 'add-new' }
  ];

  const handleInputChange = (field: keyof Credentials | 'apiName', value: string) => {
    if (field === 'apiName') return; // not stored in credentials
    onCredentialsChange({
      ...credentials,
      [field]: value
    });
    // Reset validation when inputs change
    setValidationStatus(null);
    setValidationMessage('');
  };

  const handleSupplierChange = (value: string) => {
    setSelectedSupplier(value);
    if (value === 'add-new') {
      setSupplierName('');
      setSupplierEmail('');
      // Clear connectionId for new supplier
      onCredentialsChange({
        ...credentials,
        connectionId: undefined
      });
    } else {
      const supplier = suppliers.find(s => s.value === value);
      if (supplier && 'supplierName' in supplier) {
        setSupplierName(supplier.supplierName || '');
        setSupplierEmail(supplier.supplierEmail || '');
        // Set connectionId for existing supplier
        onCredentialsChange({
          ...credentials,
          connectionId: value
        });
      }
    }
  };

  const handleFileUpload = (files: FileList | null) => {
    console.log('🔍 handleFileUpload called with:', files);
    const file = files && files[0];
    console.log('🔍 Selected file:', file);
    
    if (file) {
      console.log('🔍 File details:', {
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified
      });
      
      // Check for CSV file type - handle different MIME types
      const isCsvFile = file.type === 'text/csv' || 
                       file.type === 'application/csv' ||
                       file.name.toLowerCase().endsWith('.csv');
      
      if (isCsvFile) {
        console.log('✅ Valid CSV file selected:', file.name);
        setCsvFile(file);
        setCsvUploadSuccess(true); // Set success when CSV is uploaded
        // Clear any previous validation messages
        setValidationStatus(null);
        setValidationMessage('');
        
        // Process CSV file to extract headers and data
        processCsvFile(file);
      } else {
        console.log('❌ Invalid file type:', file.type, 'File name:', file.name);
        // Show error banner
        setValidationStatus('error');
        setValidationMessage(`Please select a valid CSV file. Selected file: ${file.name} (${file.type})`);
        setCsvUploadSuccess(false);
      }
    } else {
      console.log('❌ No file selected');
      setValidationStatus('error');
      setValidationMessage('Please select a file');
      setCsvUploadSuccess(false);
    }
  };

  // Process CSV file to extract headers and data
  const processCsvFile = async (file: File) => {
    console.log('🔍 Processing CSV file:', file.name);
    
    try {
      const text = await file.text();
      const lines = text.split('\n').filter((line) => line.trim());
      
      if (lines.length < 2) {
        console.log('❌ CSV file must have at least a header row and one data row');
        return;
      }

      // Parse CSV with delimiter detection
      const detectDelimiter = (line: string): string => {
        const delimiters = [',', ';', '\t', '|'];
        const counts = delimiters.map(d => (line.match(new RegExp(`\\${d}`, 'g')) || []).length);
        const maxCount = Math.max(...counts);
        return delimiters[counts.indexOf(maxCount)];
      };
      
      const delimiter = detectDelimiter(lines[0]);
      const headers: string[] = lines[0].split(delimiter).map((h: string) => h.trim().replace(/"/g, ''));
      
      const rows: Array<Record<string, string>> = lines.slice(1).map((line: string) => {
        const values = line.split(delimiter).map((v: string) => v.trim().replace(/"/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((header: string, index: number) => {
          row[header] = values[index] || '';
        });
        return row;
      });
      
      const validRows = rows.filter((row) => 
        Object.values(row).some((val) => val.trim())
      );

      const processedData = {
        fileName: file.name,
        fileSize: file.size,
        headers,
        rows: validRows,
        totalRows: validRows.length,
        processedAt: new Date().toISOString()
      };

      console.log('🔍 Processed CSV data:', {
        fileName: processedData.fileName,
        headers: processedData.headers,
        totalRows: processedData.totalRows,
        sampleRow: processedData.rows[0]
      });

      // Store processed data in localStorage
      localStorage.setItem('csvData', JSON.stringify(processedData));
      console.log('✅ CSV data stored in localStorage');

    } catch (error) {
      console.log('❌ Error processing CSV file:', error);
      setValidationStatus('error');
      setValidationMessage('Error processing CSV file. Please try again.');
    }
  };

  const validateCredentials = async () => {
    // Check if supplier info is filled
    if (!supplierName || !supplierEmail) {
      setValidationStatus('error');
      setValidationMessage('Please fill in supplier name and email');
      return;
    }

    // Check validation based on connection type
    if (connectionType === 'api') {
      if (!credentials.apiUrl || !credentials.accessToken) {
        setValidationStatus('error');
        setValidationMessage('Please fill in both API URL and access token for API connection');
        return;
      }
    } else if (connectionType === 'csv') {
      if (!csvFile) {
        setValidationStatus('error');
        setValidationMessage('Please upload a CSV file for CSV connection');
        return;
      }
    }

    setIsValidating(true);
    try {
      if (connectionType === 'api') {
        const formData = new FormData();
        formData.append('action', 'validateConnection');
        formData.append('apiUrl', credentials.apiUrl);
        formData.append('accessToken', credentials.accessToken);

        const resp = await fetch('/app/api/external', {
          method: 'POST',
          body: formData
        });

        const data = await resp.json().catch(() => ({}));

        if (resp.ok && data?.success) {
          setValidationStatus('success');
          setValidationMessage('API credentials validated successfully!');
        } else {
          setValidationStatus('error');
          setValidationMessage(
            typeof data?.error === 'string' && data.error
              ? data.error
              : 'Invalid API credentials or unable to reach API.'
          );
        }
      } else if (connectionType === 'csv') {
        if (csvFile && csvFile.type === 'text/csv') {
          setValidationStatus('success');
          setValidationMessage(`CSV file "${csvFile.name}" uploaded successfully! Supplier information is complete. Ready to proceed.`);
        } else {
          setValidationStatus('error');
          setValidationMessage('Invalid CSV file. Please upload a valid CSV file.');
        }
      }
    } catch (error: any) {
      setValidationStatus('error');
      setValidationMessage(error?.message || 'Error validating credentials. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const canProceed = validationStatus === 'success' && 
    // For CSV uploads, ensure supplier info is complete even after validation
    (connectionType === 'api' || (connectionType === 'csv' && Boolean(supplierName) && Boolean(supplierEmail)));

  const saveConnection = async () => {
    const formData = new FormData();
    formData.append('action', 'create');
    formData.append('data', JSON.stringify({
      type: connectionType,
      name: editingApi?.name || supplierName || 'API Connection',
      apiUrl: connectionType === 'api' ? credentials.apiUrl : null,
      accessToken: connectionType === 'api' ? credentials.accessToken : null,
      csvFileName: connectionType === 'csv' ? csvFile?.name : null,
      supplierName,
      supplierEmail,
      status: 'connected',
      scheduledTime: null,
      productCount: 0,
    }));

    const resp = await fetch('/app/api/connections', {
      method: 'POST',
      body: formData
    });
    
    if (resp.ok) {
      const data = await resp.json();
      if (data.success && data.connection?.id) {
        // Add connectionId to credentials
        onCredentialsChange({
          ...credentials,
          connectionId: data.connection.id
        });
      }
    }
    
    return resp.ok;
  };

  const canValidate = () => {
    const hasSupplierInfo = Boolean(supplierName) && Boolean(supplierEmail);
    if (connectionType === 'api') {
      return hasSupplierInfo && Boolean(credentials.apiUrl) && Boolean(credentials.accessToken);
    } else if (connectionType === 'csv') {
      return hasSupplierInfo && Boolean(csvFile);
    }
    return false; 
  };

  // Helper function to check if supplier info is complete
  const hasCompleteSupplierInfo = () => {
    if (selectedSupplier === 'add-new') {
      return Boolean(supplierName) && Boolean(supplierEmail);
    } else {
      return Boolean(selectedSupplier) && Boolean(supplierEmail);
    }
  };

  const getBannerStatus = () => {
    switch (validationStatus) {
      case 'success':
        return 'success' as const;
      case 'error':
        return 'critical' as const;
      default:
        return 'info' as const;
    }
  };

  return (
    <Layout>
      <Layout.Section>
        <Card>
          <Box padding="600">
            <BlockStack gap="400"> 
               <InlineStack align="space-between" blockAlign="center">
              <BlockStack>
                <Text as="h1" variant="headingLg">
                  {editingApi ? 'Edit Supplier Connection' : 'Step 1: Supplier & API Credentials'}
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  {editingApi 
                    ? `Update connection details for ${editingApi?.name}`
                    : 'Set up your supplier connection using either API integration or CSV import'
                  }
                </Text>
              </BlockStack>
              {onGoToList && (
                <Button  icon={ListBulletedIcon} onClick={onGoToList}>
                  Return to Supplier List
                </Button>
              )}
            </InlineStack>
              {editingApi && (
                <Banner>
                  <p>You are editing an existing supplier connection. Changes will be saved when you validate the credentials.</p>
                </Banner>
              )}
 

              {/* Supplier Information Section */}
              <Card background="bg-surface-secondary">
                <BlockStack > 
                  <div  style={{display:'flex', gap:'2px', marginBottom:'10px'}}> 
                    <div>
                    <Icon source={OrganizationIcon} tone='info' />
                    </div>
                    <Text as="h2" variant="headingMd">Supplier Information</Text>
                    </div> 
                  
                  {/* Special reminder for CSV upload case */}
                  {connectionType === 'csv' && csvUploadSuccess && (
                    <Banner tone="info">
                      <p>📋 <strong>CSV uploaded successfully!</strong> Please complete supplier information below to proceed.</p>
                    </Banner>
                  )}
                  
                  <FormLayout>
                    <FormLayout.Group>
                      <Select
                        label="Supplier *"
                        options={suppliers}
                        value={selectedSupplier}
                        onChange={handleSupplierChange}
                        placeholder={isLoadingConnections ? "Loading suppliers..." : "Select or add supplier"}
                        disabled={isLoadingConnections}
                        error={connectionType === 'csv' && csvUploadSuccess && !selectedSupplier ? "Supplier selection is required" : undefined}
                      />
                      
                      <TextField
                        label="Supplier Email *"
                        type="email"
                        autoComplete="email"
                        value={supplierEmail}
                        onChange={setSupplierEmail}
                        placeholder="supplier@company.com"
                        prefix={<Icon source={EmailIcon} />}
                        error={connectionType === 'csv' && csvUploadSuccess && !supplierEmail ? "Supplier email is required" : undefined}
                      />
                    </FormLayout.Group>

                    {selectedSupplier === 'add-new' && (
                      <TextField
                        label="Supplier Name"
                        value={supplierName}
                        autoComplete="off"
                        onChange={setSupplierName}
                        placeholder="Enter supplier company name"
                        error={connectionType === 'csv' && csvUploadSuccess && selectedSupplier === 'add-new' && !supplierName ? "Supplier name is required" : undefined}
                      />
                    )}
                  </FormLayout>
                </BlockStack>
              </Card>

              {/* Connection Type Selection */}
              <Card background="bg-surface-secondary">
                <BlockStack>
                    <div style={{display:'flex', gap:'2px', marginBottom:'10px'}}> 
                    <div>
                    <Icon source={DatabaseIcon} tone='magic' />
                    </div>
                    <Text as="h2" variant="headingMd">Connection Type</Text>
                  </div>
                  
                  <BlockStack>
               <InlineGrid gap="400" columns={2}>

                    <RadioButton
                      label="API Connection"
                      checked={connectionType === 'api'}
                      id="api"
                      name="connectionType"
                      onChange={() => {
                        setConnectionType('api');
                        setValidationStatus(null);
                        setValidationMessage('');
                        setCsvFile(null);
                        setCsvUploadSuccess(false); // Reset CSV upload success
                        onConnectionTypeChange?.('api');
                      }}
                    />
                    <RadioButton
                      label="CSV Import"
                      checked={connectionType === 'csv'}
                      id="csv"
                      name="connectionType"
                      onChange={() => {
                        setConnectionType('csv');
                        setValidationStatus(null);
                        setValidationMessage('');
                        setCsvUploadSuccess(false); // Reset CSV upload success
                        onConnectionTypeChange?.('csv');
                        onSelectCsvImport?.();
                      }}
                    />
                    </InlineGrid>
                  </BlockStack>
                </BlockStack>
              </Card>

              {/* API Connection Fields */}
              {connectionType === 'api' && (
                <Card>
                  <BlockStack>
                     <div  style={{display:'flex', gap:'2px', color: '#0094d5', marginBottom:'10px'}}>
                      <div>
                      <Icon source={LinkIcon} tone='info' />
                      </div>
                      <Text as="h2" variant="headingMd">API Connection Details</Text>
                    </div>
                    
                    <FormLayout>
                      {editingApi && (
                        <TextField
                          label="API Name *"
                          value={editingApi?.name || ''}
                          autoComplete="off"
                          onChange={(value) => handleInputChange('apiName', value)}
                          placeholder="Enter a name for this API"
                        />
                      )}
                      
                      <TextField
                        label="API URL *"
                        type="url"
                        autoComplete="url"
                        value={credentials.apiUrl}
                        onChange={(value) => handleInputChange('apiUrl', value)}
                        placeholder="https://api.example.com/products"
                      />
                      
                      <TextField
                        label="Access Token *"
                        type="password"
                        autoComplete="off"
                        value={credentials.accessToken}
                        onChange={(value) => handleInputChange('accessToken', value)}
                        placeholder="Enter your access token"
                        prefix={<Icon source={KeyIcon} />}
                      />
                    </FormLayout>
                  </BlockStack>
                </Card>
              )}

              {/* CSV Connection Fields */}
              {connectionType === 'csv' && (
                <Card>
                  <BlockStack>
                     <div  style={{display:'flex', gap:'2px', color: '#0094d5', marginBottom:'10px'}}>
                      <div>
                      <Icon source={UploadIcon} tone='info' />
                      </div>
                      <Text as="h2" variant="headingMd">CSV Import Details</Text>
                    </div>
                    
                    {/* Guidance banner for CSV selection */}
                    {!hasCompleteSupplierInfo() && (
                      <Banner tone="info">
                        <p>📋 <strong>CSV Import Selected!</strong> Please complete supplier information above before uploading your CSV file.</p>
                      </Banner>
                    )}
                    
                    <FormLayout>
                      <div>
                        <Text as="p" variant="bodyMd" fontWeight="bold">CSV File *</Text>
                        <div style={{ marginTop: '8px' }}>
                          <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => handleFileUpload(e.target.files)}
                            style={{ display: 'none' }}
                            id="csv-upload"
                            disabled={false} // Temporarily enable for testing
                          />
                          <label htmlFor="csv-upload">
                            <Button 
                              icon={UploadIcon}
                              disabled={false} // Temporarily enable for testing
                              onClick={() => {
                                console.log('🔍 CSV upload button clicked');
                                document.getElementById('csv-upload')?.click();
                              }}
                            >
                              Choose CSV File
                            </Button>
                          </label>
                        </div>
                        {csvFile && (
                          <div style={{ marginTop: '8px' }}>
                            <Badge tone="success" icon={FileIcon}>
                              {csvFile.name}
                            </Badge>
                          </div>
                        )}
                        <Text as="p" variant="bodySm" tone="subdued">
                          Upload a CSV file with your product data. Accepted format: .csv
                        </Text>
                      </div>
                    </FormLayout>
                  </BlockStack>
                </Card>
              )}

              {validationMessage && (
                <Banner tone={getBannerStatus()}>
                  <p>{validationMessage}</p>
                </Banner>
              )}

              <BlockStack>
                <ButtonGroup>
                  {editingApi && onGoToList && (
                    <Button 
                      icon={ArrowLeftIcon}
                      onClick={onGoToList}
                    >
                      Back to List
                    </Button>
                  )}
                  
                  <Button
                    onClick={validateCredentials}
                    disabled={isValidating || !canValidate()}
                    loading={isValidating}
                  >
                    {editingApi ? 'Update & Validate' : connectionType === 'csv' ? 'Validate CSV' : 'Validate Connection'}
                  </Button>
                  
                  <Button
                    variant="primary"
                    onClick={async () => {
                      if (!canProceed) return;
                      const ok = await saveConnection();
                      if (ok) onNext();
                    }}
                    disabled={!canProceed}
                  >
                    {editingApi ? 'Save Changes' : 'Next Step'}
                  </Button>
                </ButtonGroup>
              </BlockStack>
            </BlockStack>
          </Box>
        </Card>
      </Layout.Section>
    </Layout>
  );
}