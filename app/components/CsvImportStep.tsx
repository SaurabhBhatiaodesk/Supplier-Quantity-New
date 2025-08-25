import { useState, useCallback } from 'react';
import {
  Card,
  Layout,
  Button, 
  Text,
  Box,
  ButtonGroup,
  Banner,
  Badge,
  DataTable,
  Icon,
  Divider,
  DropZone,
  Thumbnail,
  BlockStack
} from '@shopify/polaris';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  UploadIcon,
  FileIcon,
  CheckCircleIcon,
  AlertCircleIcon
} from '@shopify/polaris-icons';

type ValidationStatus = 'success' | 'warning' | 'error' | null;

interface ProcessedCsvData {
  fileName: string;
  fileSize: number;
  headers: string[];
  rows: Array<Record<string, string>>;
  totalRows: number;
  processedAt: string;
}

interface CsvImportStepProps { 
  onCsvImported: (data: ProcessedCsvData) => void; 
  onGoBack: () => void; 
}

export default function CsvImportStep({ 
  onCsvImported, 
  onGoBack 
}: CsvImportStepProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [csvData, setCsvData] = useState<ProcessedCsvData | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>(null); // null, 'success', 'warning', 'error'

  const handleDropZoneDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (file) {
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setCsvFile(file);
        processCsvFile(file);
      } else {
        setValidationErrors(['Please upload a valid CSV file (.csv extension)']);
        setValidationStatus('error');
      }
    }
  }, []);

  const processCsvFile = async (file: File) => {
    setIsProcessing(true);
    setValidationErrors([]);
    setValidationStatus(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter((line) => line.trim());
      
      if (lines.length < 2) {
        throw new Error('CSV file must have at least a header row and one data row');
      }

      // Parse CSV with better delimiter detection
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
      
      // Validate required columns
      const requiredColumns: string[] = ['name', 'price']; // Minimum required
      const missingColumns = requiredColumns.filter((col) => 
        !headers.some((header) => header.toLowerCase().includes(col.toLowerCase()))
      );

      const errors: string[] = [];
      const warnings: string[] = [];

      if (missingColumns.length > 0) {
        errors.push(`Missing required columns: ${missingColumns.join(', ')}`);
      }

      // Check for common issues
      const emptyRows = rows.filter((row) => 
        Object.values(row).every((val) => !val.trim())
      ).length;
      
      if (emptyRows > 0) {
        warnings.push(`Found ${emptyRows} empty rows that will be skipped`);
      }

      const validRows = rows.filter((row) => 
        Object.values(row).some((val) => val.trim())
      );

      if (validRows.length === 0) {
        errors.push('No valid data rows found');
      }

      // Price validation
      const priceColumn = headers.find((h) => h.toLowerCase().includes('price'));
      if (priceColumn) {
        const invalidPrices = validRows.filter((row) => {
          const price = row[priceColumn];
          return price && (isNaN(parseFloat(price)) || parseFloat(price) < 0);
        }).length;
        
        if (invalidPrices > 0) {
          warnings.push(`Found ${invalidPrices} rows with invalid prices`);
        }
      }

      setValidationErrors([...errors, ...warnings]);
      
      if (errors.length > 0) {
        setValidationStatus('error');
      } else if (warnings.length > 0) {
        setValidationStatus('warning');
      } else {
        setValidationStatus('success');
      }

      const processedData: ProcessedCsvData = {
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

      setCsvData(processedData);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setValidationErrors(['Error processing CSV file: ' + message]);
      setValidationStatus('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const getFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getBannerStatus = () => {
    switch (validationStatus) {
      case 'success':
        return 'success' as const;
      case 'warning':
        return 'warning' as const;
      case 'error':
        return 'critical' as const;
      default:
        return 'info' as const;
    }
  };

  const canProceed = validationStatus === 'success' || validationStatus === 'warning';

  // Preview data for table
  const previewRows = csvData ? csvData.rows.slice(0, 5).map((row, index) => [
    index + 1,
    ...csvData.headers.slice(0, 4).map(header => row[header] || '-')
  ]) : [];

  const previewHeadings = csvData ? [
    'Row',
    ...csvData.headers.slice(0, 4).map(header => header || 'Unknown')
  ] : [];

  const handleProceed = () => {
    console.log('🔍 handleProceed called');
    console.log('🔍 csvData in CsvImportStep:', csvData);
    if (csvData) {
      console.log('🔍 Calling onCsvImported with data:', csvData);
      onCsvImported(csvData);
    } else {
      console.log('❌ No csvData available to pass');
    }
  };

  const fileUpload = !csvFile && (
    <DropZone onDrop={handleDropZoneDrop}>
      <DropZone.FileUpload />
    </DropZone>
  );

  const uploadedFile = csvFile && (
    <BlockStack gap="200">
      <BlockStack gap="200" inlineAlign="center">
        <Thumbnail
          size="small"
          alt={csvFile.name}
          source={FileIcon}
        />
        <BlockStack gap="100">
          <Text as="p" variant="bodyMd" fontWeight="semibold">{csvFile.name}</Text>
          <Text as="p" variant="bodySm" tone="subdued">{getFileSize(csvFile.size)}</Text>
        </BlockStack>
      </BlockStack>
      <Button 
        onClick={() => {
          setCsvFile(null);
          setCsvData(null);
          setValidationErrors([]);
          setValidationStatus(null);
        }}
      >
        Remove file
      </Button>
    </BlockStack>
  );

  return (
    <Layout>
      <Layout.Section>
        <Card>
          <Box padding="600">
            <BlockStack gap="400">
              <BlockStack gap="200">
                <Text variant="headingLg" as="h1">CSV Import</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Upload a CSV file containing your product data
                </Text>
              </BlockStack>

              <Banner tone="info">
                <p>
                  Your CSV file should include columns for product name, price, and any other product details. 
                  The first row should contain column headers.
                </p>
              </Banner>

              <Divider />

              {/* File Upload */}
              <Card>
                <BlockStack gap="400">
                  <BlockStack gap="200" inlineAlign="center">
                    <Icon source={UploadIcon} />
                    <Text variant="headingMd" as="h2">Upload CSV File</Text>
                  </BlockStack>
                  
                  {csvFile ? uploadedFile : fileUpload}
                  
                  {isProcessing && (
                    <Box paddingBlockStart="400">
                      <BlockStack gap="200" inlineAlign="center">
                        <Text as="p" variant="bodyMd" tone="subdued">Processing file...</Text>
                      </BlockStack>
                    </Box>
                  )}
                </BlockStack>
              </Card>

              {/* Validation Results */}
              {validationErrors.length > 0 && (
                <Banner tone={getBannerStatus()}>
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      {validationStatus === 'error' ? 'Validation Failed' : 
                       validationStatus === 'warning' ? 'Validation Warnings' : 
                       'Validation Successful'}
                    </Text>
                    <BlockStack gap="100">
                      {validationErrors.map((error, index) => (
                        <Text key={index} as="p" variant="bodySm">• {error}</Text>
                      ))}
                    </BlockStack>
                  </BlockStack>
                </Banner>
              )}

              {/* File Summary */}
              {csvData && (
                <Card>
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h2">File Summary</Text>
                    
                    <BlockStack gap="400">
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySm" tone="subdued">File Name</Text>
                        <Text as="p" variant="bodyMd">{csvData.fileName}</Text>
                      </BlockStack>
                      
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySm" tone="subdued">Total Rows</Text>
                        <Badge tone="success">{`${csvData.totalRows} products`}</Badge>
                      </BlockStack>
                      
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySm" tone="subdued">Columns Detected</Text>
                        <BlockStack gap="100">
                          {csvData.headers.map((header, index) => (
                            <Badge key={index}>{header}</Badge>
                          ))}
                        </BlockStack>
                      </BlockStack>
                      
                    </BlockStack>
                  </BlockStack>
                </Card>
              )}

              {/* Data Preview */}
              {csvData && previewRows.length > 0 && (
                <Card>
                  <BlockStack gap="200">
                    <Text variant="headingMd" as="h2">Data Preview</Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Showing first 5 rows and 4 columns
                    </Text>
                    
                    <DataTable
                      columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                      headings={previewHeadings}
                      rows={previewRows}
                      hoverable={false}
                    />
                  </BlockStack>
                </Card>
              )}

              <BlockStack align="end">
                <ButtonGroup>
                  <Button 
                    icon={ArrowLeftIcon}
                    onClick={onGoBack}
                  >
                    Back
                  </Button>
                  
                  <Button 
                    icon={ArrowRightIcon}
                    onClick={handleProceed}
                    disabled={!canProceed}
                    loading={isProcessing}
                  >
                    Continue with CSV Data
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