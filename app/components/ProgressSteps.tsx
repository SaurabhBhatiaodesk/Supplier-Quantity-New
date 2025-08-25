import {
  Card, 
  Text,
  Box,
  Badge,
  Icon,
  Divider,
  BlockStack,
  ProgressBar,
  InlineStack,
  InlineGrid 
} from '@shopify/polaris';
import {
  CheckCircleIcon,
  ChevronRightIcon
} from '@shopify/polaris-icons';

interface Step {
  number: number;
  title: string;
  description: string;
}

interface ProgressStepsProps {
  currentStep: number;
  steps: Step[];
}

export default function ProgressSteps({ currentStep, steps }: ProgressStepsProps) {
  const progressValue = Math.round((currentStep / steps.length) * 100);

  return (
    <Card>
      <Box padding="600">
        <BlockStack gap="400">
          {/* Steps Row */}
          <div style={{width: '100%', overflow: 'auto'}}>
          <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '32px', // space between steps
      padding: '8px 0',
    }}
  >
              {steps.map((step, index) => (
                <div key={step.number}  style={{  minWidth: 'max-content',padding: '0 5px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center'}}>
                  {/* Step Circle */}
                  <div>
                    <BlockStack gap="200" inlineAlign="center">
                      <Box>
                        {step.number < currentStep ? (
                          <Box>
                            <Icon source={CheckCircleIcon} tone="success" />
                          </Box>
                        ) : step.number === currentStep ? (
                          <Badge tone="info" size="large">
                            {String(step.number)}
                          </Badge>
                        ) : (
                          <Badge size="large">
                            {String(step.number)}
                          </Badge>
                        )}
                      </Box>
                      <BlockStack gap="100" inlineAlign="center">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">{step.title}</Text>
                        <Text as="p" variant="bodyMd"   tone="subdued">{step.description}</Text>
                       </BlockStack>
                    </BlockStack>
                  </div>
                  
                  {/* Arrow between steps */}
                  {index < steps.length - 1 && (
                    <Box>
                      <Icon source={ChevronRightIcon} tone="subdued" />
                    </Box>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <Divider />
          
          {/* Progress Bar */}
          <BlockStack gap="200">
            <ProgressBar progress={progressValue} size="small" tone="primary" />
            <InlineStack align="space-between">
              <Text as="p" variant="bodySm" tone="subdued">0%</Text>
              <Text as="p" variant="bodySm" tone="subdued">{progressValue}% Complete</Text>
              <Text as="p" variant="bodySm" tone="subdued">100%</Text>
            </InlineStack>
          </BlockStack>
        </BlockStack>
      </Box>
    </Card>
  );
}