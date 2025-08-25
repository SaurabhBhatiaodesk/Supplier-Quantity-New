import {
  Card,
  Layout,
  Button,
  RadioButton,
  BlockStack,
  Text,
  Box,
  ButtonGroup,
  Banner,
  Icon,
  Divider,
  InlineStack
} from '@shopify/polaris';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ViewIcon,
  HideIcon,
  InfoIcon
} from '@shopify/polaris-icons';

type ImportConfig = 'draft' | 'published';

interface ImportConfigurationStepProps {
  config: ImportConfig;
  onConfigChange: (value: ImportConfig) => void;
  onNext: () => void;
  onPrevious: () => void;
}

export default function ImportConfigurationStep({
  config,
  onConfigChange,
  onNext,
  onPrevious
}: ImportConfigurationStepProps) {

  const importOptions = [
    {
      value: 'draft',
      title: 'Import as Draft',
      description: 'Products will be imported as drafts and need to be published manually',
      icon: ViewIcon,
      recommended: true,
      benefits: [
        'Review products before they go live',
        'Make adjustments to pricing, descriptions, or images',
        'Prevent potential issues from affecting your storefront',
        'Better control over what customers see'
      ],
      considerations: [
        'Products won\'t be visible to customers until published',
        'Requires manual review and publishing step'
      ]
    },
    {
      value: 'published',
      title: 'Import as Published',
      description: 'Products will be immediately available to customers after import',
      icon: HideIcon,
      recommended: false,
      benefits: [
        'Products are immediately available for sale',
        'No additional publishing step required',
        'Faster time to market'
      ],
      considerations: [
        'Products go live immediately without review',
        'Potential pricing or content issues may be visible to customers',
        'Less control over product presentation'
      ]
    }
  ] as const;

  const selectedOption = importOptions.find(option => option.value === config);

  return (
    <Layout>
      <Layout.Section>
        <Card>
          <Box padding="600">
            <BlockStack gap="400">
              <BlockStack gap="200">
                <Text variant="headingLg" as="h1">Import Settings</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Choose how imported products should be handled in your store
                </Text>
              </BlockStack>

              <Banner tone="info">
                <p>
                  This setting determines whether imported products will be immediately visible to customers 
                  or saved as drafts for your review first.
                </p>
              </Banner>

              <Divider />

              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Product Status</Text>
                
                <BlockStack gap="200">
                  {importOptions.map((option) => (
                    <Card key={option.value}> 
                      <div style={{display:'flex', alignItems:'flex-start'}}>
                         <RadioButton
                          label=""
                          checked={config === option.value}
                          id={option.value}
                          name="importConfig"
                          onChange={() => onConfigChange(option.value as ImportConfig)}
                        />
                        
                        <InlineStack gap="400"  >  
                          {/* Benefits */}
                           <div> 
                        <Text variant="headingSm" as="h3">{option.title}</Text>
                            <Text as="p" variant="bodyMd" tone="subdued">
                            {option.description}
                          </Text>
                        </div>
                        <InlineStack gap="400"  >  

                          <BlockStack gap="100">
                            <Text as="p" variant="bodySm" fontWeight="semibold" tone="success">
                              Benefits:
                            </Text>
                            <Box  >
                              <BlockStack gap="100">
                                {option.benefits.map((benefit, index) => (
                                  <Text key={index} as="p" variant="bodySm" tone="subdued">
                                    • {benefit}
                                  </Text>
                                ))}
                              </BlockStack>
                            </Box>
                          </BlockStack>

                          {/* Considerations */}
                          <BlockStack gap="100">
                            <Text as="p" variant="bodySm" fontWeight="semibold" tone="critical">
                              Considerations:
                            </Text>
                            <Box>
                              <BlockStack gap="100">
                                {option.considerations.map((consideration, index) => (
                                  <Text key={index} as="p" variant="bodySm" tone="subdued">
                                    • {consideration}
                                  </Text>
                                ))}
                              </BlockStack>
                            </Box>
                          </BlockStack>
                        </InlineStack>
                        </InlineStack>
                      </div>
                    </Card>
                  ))}
                </BlockStack>
              </BlockStack>

              {selectedOption && (
                <Banner tone={selectedOption.value === 'draft' ? 'success' : 'warning'}>
                  <p>
                    <strong>Selected: {selectedOption.title}</strong><br />
                    {selectedOption.value === 'draft' 
                      ? 'Products will be imported as drafts. You can review and publish them from your Shopify admin when ready.'
                      : 'Products will be published immediately after import. Make sure your pricing and content are ready for customers to see.'
                    }
                  </p>
                </Banner>
              )}

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
                    disabled={!config}
                  >
                    Next: Start Import
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