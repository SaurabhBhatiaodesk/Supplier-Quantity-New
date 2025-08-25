import {
  Card,
  Layout,
  Button,
  RadioButton, 
  BlockStack,
  Text,
  Box,
  ButtonGroup,
  Divider,
  InlineStack
} from '@shopify/polaris';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PackageIcon,
  FilterIcon,
  FileIcon
} from '@shopify/polaris-icons';

type ImportType = 'all' | 'attribute';

interface ImportTypeStepProps {
  importType: ImportType;
  onImportTypeChange: (value: ImportType) => void;
  csvData?: any;
  dataSource?: 'api' | 'csv';
  onNext: () => void;
  onPrevious: () => void;
}

export default function ImportTypeStep({
  importType,
  onImportTypeChange,
  csvData,
  dataSource,
  onNext,
  onPrevious
}: ImportTypeStepProps) {

  const importOptions = [
    {
      value: 'all',
      title: 'Import All Products',
      description: 'Import all available products from the data source',
      icon: PackageIcon,
      recommended: false
    }
  ];

  return (
    <Layout>
      <Layout.Section>
        <Card>
          <Box padding="600">
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <div> 
                <Text variant="headingMd" as="h3">Step 2: Import Configuration</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Configure your product import settings
                </Text>
                </div>

              </InlineStack> 

              <BlockStack gap="200">
                <Text variant="headingMd" as="h2">Import Configuration</Text>
                
                {/* CSV Data Display */}
                {dataSource === 'csv' && csvData && (
                  <Card background="bg-surface-secondary">
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="headingMd" as="h3">📁 CSV File Information</Text>
                        <Text variant="bodySm" tone="success" as="p">✅ File Uploaded Successfully</Text>
                      </InlineStack>
                      
                      <BlockStack gap="200">
                        <InlineStack gap="400">
                          <BlockStack gap="100">
                            <Text as="p" variant="bodySm" tone="subdued">File Name</Text>
                            <Text as="p" variant="bodyMd" fontWeight="semibold">{csvData.fileName}</Text>
                          </BlockStack>
                          
                          <BlockStack gap="100">
                            <Text as="p" variant="bodySm" tone="subdued">Total Rows</Text>
                            <Text as="p" variant="bodyMd" fontWeight="semibold">{csvData.totalRows} products</Text>
                          </BlockStack>
                        </InlineStack>
                        
                        <BlockStack gap="100">
                          <Text as="p" variant="bodySm" tone="subdued">Detected Headers (Available for Mapping)</Text>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {csvData.headers && csvData.headers.map((header: string, index: number) => (
                              <div key={index} style={{ 
                                background: '#e3f2fd', 
                                padding: '4px 8px', 
                                borderRadius: '4px', 
                                border: '1px solid #2196f3',
                                fontSize: '12px',
                                fontWeight: '500'
                              }}>
                                {header}
                              </div>
                            ))}
                          </div>
                        </BlockStack>
                        

                      </BlockStack>
                    </BlockStack>
                  </Card>
                )}
                
                <div  style={{ background: '#eef5fe', padding: '1rem', border: '3px solid #95b4e7', borderRadius: '10px', color: '#1970ff' }}>
                  {importOptions.map((option) => (
                    
                       <InlineStack   blockAlign="center">
                        <RadioButton
                          label=""
                          checked={importType === option.value}
                          id={option.value}
                          name="importType"
                          onChange={() => onImportTypeChange(option.value as ImportType)}
                        />
                        
                        <BlockStack gap="100" inlineAlign="stretch">
                          <BlockStack gap="100" >
                            <Text variant="headingSm" as="h3">{option.title}</Text>
                            {option.recommended && (
                              <Box>
                                <Text as="span" variant="bodySm" tone="success" fontWeight="semibold">
                                  Recommended
                                </Text>
                              </Box>
                            )}
                          </BlockStack>
                          
                          <Text as="p" variant="bodyMd" tone="subdued">
                            {option.description}
                          </Text>
                          
                          {option.value === 'all' && (
                            <Box>
                              <Text as="p" variant="bodySm" tone="subdued">
                                Best for: First-time imports, small product catalogs, or when you want everything from the supplier.
                              </Text>
                            </Box>
                          )}
                          
                          {option.value === 'attribute' && (
                            <Box>
                              <Text as="p" variant="bodySm" tone="subdued">
                                Best for: Large catalogs, specific product categories, or when you only want products matching certain criteria.
                              </Text>
                            </Box>
                          )}
                        </BlockStack>
                      </InlineStack>
                     
                  ))}
                </div>
              </BlockStack>

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
                    onClick={onNext}
                    disabled={!importType}
                  >
                    Next: Key Mapping
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