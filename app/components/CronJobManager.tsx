import { useState, useEffect } from 'react';
import {
  Card,
  Layout,
  Button,
  Text,
  Box,
  Badge,
  InlineStack,
  BlockStack,
  Banner,
  Icon,
  Spinner,
  TextField,
  Select,
  Checkbox,
  Collapsible
} from '@shopify/polaris';
import {
  ClockIcon,
  PlayIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  SettingsIcon
} from '@shopify/polaris-icons';

interface CronJobManagerProps {
  connectionId?: string;
}

interface ScheduleConfig {
  enabled: boolean;
  time: string; // Format: "09:00"
  frequency: 'daily' | 'weekly' | 'monthly';
}

interface SyncResult {
  connectionName: string;
  totalProducts: number;
  created: number;
  updated: number;
  skipped: number;
  success: boolean;
  error?: string;
}

export default function CronJobManager({ connectionId }: CronJobManagerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [lastSync, setLastSync] = useState<string>('');
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
  const [error, setError] = useState<string>('');
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    enabled: false,
    time: '09:00',
    frequency: 'daily'
  });
  const [showScheduleSettings, setShowScheduleSettings] = useState(false);

  // Load last sync time
  useEffect(() => {
    loadLastSyncTime();
  }, []);

  const loadLastSyncTime = async () => {
    try {
      const response = await fetch('/app/api/connections');
      const data = await response.json();
      if (data.success && data.connections) {
        const connection = data.connections.find((c: any) => 
          connectionId ? c.id === connectionId : true
        );
        if (connection?.lastSync) {
          setLastSync(connection.lastSync);
        }
      }
    } catch (error) {
      console.error('Error loading last sync time:', error);
    }
  };

  const runCronJob = async () => {
    setIsRunning(true);
    setError('');
    setSyncResults([]);

    try {
      console.log('🚀 Starting cron job...');
      
      const response = await fetch('/app/api/cron', {
        method: 'POST'
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Cron job completed:', data.results);
        setSyncResults(data.results || []);
        await loadLastSyncTime(); // Refresh last sync time
      } else {
        setError(data.error || 'Cron job failed');
      }
    } catch (error) {
      console.error('❌ Cron job error:', error);
      setError('Failed to run cron job');
    } finally {
      setIsRunning(false);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  };

  const getStatusBadge = (success: boolean) => {
    if (success) {
      return <Badge tone="success" icon={CheckCircleIcon}>Success</Badge>;
    } else {
      return <Badge tone="critical" icon={AlertCircleIcon}>Failed</Badge>;
    }
  };

  return (
    <Layout>
      <Layout.Section>
        <Card>
          <Box padding="400">
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack>
                  <Text as="h2" variant="headingMd">Automatic Sync</Text>
                  <Text as="p" tone="subdued">
                    Automatically sync products from your API connections
                  </Text>
                </BlockStack>
                <InlineStack gap="200">
                  <Button
                    icon={SettingsIcon}
                    onClick={() => setShowScheduleSettings(!showScheduleSettings)}
                  >
                    Schedule Settings
                  </Button>
                  <Button
                    variant="primary"
                    icon={PlayIcon}
                    onClick={runCronJob}
                    disabled={isRunning}
                    loading={isRunning}
                  >
                    {isRunning ? 'Running...' : 'Run Sync Now'}
                  </Button>
                </InlineStack>
              </InlineStack>

              {lastSync && (
                <Banner>
                  <InlineStack gap="200" blockAlign="center">
                    <Icon source={ClockIcon} />
                    <Text as="p">
                      Last sync: {getTimeAgo(lastSync)}
                    </Text>
                  </InlineStack>
                </Banner>
              )}

              {error && (
                <Banner tone="critical">
                  <Text as="p">{error}</Text>
                </Banner>
              )}

              {/* Schedule Settings */}
              <Collapsible
                open={showScheduleSettings}
                id="schedule-settings"
                transition={{duration: '200ms', timingFunction: 'ease-in-out'}}
              >
                <Card background="bg-surface-secondary">
                  <Box padding="400">
                    <BlockStack gap="400">
                      <Text as="h3" variant="headingSm">Schedule Configuration</Text>
                      
                      <Checkbox
                        label="Enable automatic sync"
                        checked={scheduleConfig.enabled}
                        onChange={(checked) => 
                          setScheduleConfig(prev => ({ ...prev, enabled: checked }))
                        }
                      />

                      {scheduleConfig.enabled && (
                        <BlockStack gap="300">
                          <InlineStack gap="300">
                            <Box minWidth="150px">
                              <TextField
                                label="Sync Time"
                                type="time"
                                value={scheduleConfig.time}
                                onChange={(value) => 
                                  setScheduleConfig(prev => ({ ...prev, time: value }))
                                }
                                helpText="Set the time for automatic sync"
                                autoComplete="off"
                              />
                            </Box>
                            <Box minWidth="150px">
                              <Select
                                label="Frequency"
                                options={[
                                  { label: 'Daily', value: 'daily' },
                                  { label: 'Weekly', value: 'weekly' },
                                  { label: 'Monthly', value: 'monthly' }
                                ]}
                                value={scheduleConfig.frequency}
                                onChange={(value) => 
                                  setScheduleConfig(prev => ({ 
                                    ...prev, 
                                    frequency: value as 'daily' | 'weekly' | 'monthly' 
                                  }))
                                }
                              />
                            </Box>
                          </InlineStack>

                          <Banner>
                            <Text as="p">
                              Next sync: {scheduleConfig.frequency} at {scheduleConfig.time}
                            </Text>
                          </Banner>

                          <InlineStack gap="200">
                            <Button onClick={() => console.log('Save schedule:', scheduleConfig)}>
                              Save Schedule
                            </Button>
                            <Button variant="secondary" onClick={() => 
                              setScheduleConfig({ enabled: false, time: '09:00', frequency: 'daily' })
                            }>
                              Reset
                            </Button>
                          </InlineStack>
                        </BlockStack>
                      )}
                    </BlockStack>
                  </Box>
                </Card>
              </Collapsible>

              {syncResults.length > 0 && (
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">Sync Results</Text>
                  
                  {syncResults.map((result, index) => (
                    <Card key={index} background="bg-surface-secondary">
                      <Box padding="300">
                        <BlockStack gap="200">
                          <InlineStack align="space-between" blockAlign="center">
                            <Text as="h4" variant="bodyMd" fontWeight="semibold">
                              {result.connectionName}
                            </Text>
                            {getStatusBadge(result.success)}
                          </InlineStack>

                          {result.success ? (
                            <BlockStack gap="100">
                              <InlineStack gap="400">
                                <Text as="span" variant="bodySm">
                                  Total: {result.totalProducts}
                                </Text>
                                <Text as="span" variant="bodySm" tone="success">
                                  Created: {result.created}
                                </Text>
                                <Text as="span" variant="bodySm">
                                  Updated: {result.updated}
                                </Text>
                                <Text as="span" variant="bodySm" tone="subdued">
                                  Skipped: {result.skipped}
                                </Text>
                              </InlineStack>
                            </BlockStack>
                          ) : (
                            <Text as="p" tone="critical" variant="bodySm">
                              {result.error}
                            </Text>
                          )}
                        </BlockStack>
                      </Box>
                    </Card>
                  ))}
                </BlockStack>
              )}

              <Card background="bg-surface-secondary">
                <Box padding="300">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">How it works</Text>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm">
                        • <strong>Daily Sync:</strong> Automatically runs every day at 9:00 AM
                      </Text>
                      <Text as="p" variant="bodySm">
                        • <strong>Smart Updates:</strong> Existing products are updated, new ones are created
                      </Text>
                      <Text as="p" variant="bodySm">
                        • <strong>Duplicate Prevention:</strong> Products are matched by SKU or title
                      </Text>
                      <Text as="p" variant="bodySm">
                        • <strong>Error Handling:</strong> Failed products are logged and skipped
                      </Text>
                    </BlockStack>
                  </BlockStack>
                </Box>
              </Card>
            </BlockStack>
          </Box>
        </Card>
      </Layout.Section>
    </Layout>
  );
}
