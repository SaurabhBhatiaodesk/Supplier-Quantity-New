import { useEffect, useState } from 'react';
import { useNavigate } from '@remix-run/react';
import {
  Page,
  Card,
  Layout,
  Button,
  Badge,
  TextField,
  DataTable,
  BlockStack,
  Text,
  Box,
  Icon,
  EmptyState,
  ButtonGroup,
  InlineGrid,
  InlineStack
} from '@shopify/polaris';
import {
  PlusIcon,
  SearchIcon,
  StoreIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClipboardChecklistIcon,
  StatusActiveIcon,
  DomainLandingPageIcon,
  DatabaseIcon,
  AlertCircleIcon,
  EmailIcon,
  ChevronRightIcon
} from '@shopify/polaris-icons';

interface Supplier {
  id: number;
  name: string;
  email: string;
  website: string;
  status: 'active' | 'inactive' | 'error' | string;
  apiConnections: number;
  csvConnections: number;
  totalProducts: number;
  lastActivity: string;
  connectionTypes: Array<'api' | 'csv'>;
}

interface SupplierListingStepProps {
  onSupplierClick: (supplier: Supplier) => void;
  onAddNewSupplier: () => void;
}

export default function SupplierListingStep({
  onSupplierClick,
  onAddNewSupplier
}: SupplierListingStepProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  // Load saved connections from the database
  type SavedConnection = {
    id: string;
    name: string;
    type: 'api' | 'csv' | string;
    apiUrl?: string | null;
    accessToken?: string | null;
    csvFileName?: string | null;
    status?: string | null;
    updatedAt?: string | null;
    supplierName?: string | null;
    productCount?: number | null;
    scheduleEnabled?: boolean;
    scheduleFrequency?: string;
    scheduleTime?: string;
    scheduledTime?: string | null;
  };
  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);
  const [totalImportedProducts, setTotalImportedProducts] = useState(0);

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
    try {
      const resp = await fetch('/app/api/connections');
      const data = await resp.json();
      if (resp.ok && data?.success) {
        const rawList: SavedConnection[] = (data.connections || []).map((c: any) => {
          // Parse schedule data
          let scheduleEnabled = false;
          let scheduleFrequency = 'daily';
          let scheduleTime = '09:00';
          
          if (c.scheduledTime) {
            try {
              const scheduleData = JSON.parse(c.scheduledTime);
              if (scheduleData.enabled !== undefined) {
                scheduleEnabled = scheduleData.enabled;
                scheduleFrequency = scheduleData.frequency || 'daily';
                scheduleTime = scheduleData.time || '09:00';
              }
            } catch (e) {
              // If parsing fails, treat as simple time string
              scheduleEnabled = true;
              scheduleTime = c.scheduledTime;
            }
          }
          
          return {
            id: c.id,
            name: c.name,
            type: c.type,
            apiUrl: c.apiUrl ?? null,
            accessToken: c.accessToken ?? null,
            csvFileName: c.csvFileName ?? null,
            status: c.status ?? 'connected',
            updatedAt: c.updatedAt ?? null,
            supplierName: c.supplierName ?? null,
            productCount: c.productCount ?? null,
            scheduleEnabled,
            scheduleFrequency,
            scheduleTime,
            scheduledTime: c.scheduledTime
          };
        });
        
        // Remove duplicates based on supplier name and API URL
        const uniqueConnections = rawList.reduce((acc: SavedConnection[], current) => {
          const existingIndex = acc.findIndex(item => 
            item.supplierName === current.supplierName && 
            item.apiUrl === current.apiUrl
          );
          
          if (existingIndex === -1) {
            // New unique connection
            acc.push(current);
          } else {
            // Duplicate found - keep the most recent one
            const existing = acc[existingIndex];
            const existingDate = existing.updatedAt ? new Date(existing.updatedAt) : new Date(0);
            const currentDate = current.updatedAt ? new Date(current.updatedAt) : new Date(0);
            
            if (currentDate > existingDate) {
              // Replace with newer connection
              acc[existingIndex] = current;
            }
          }
          
          return acc;
        }, []);
        
        console.log(`Removed ${rawList.length - uniqueConnections.length} duplicate connections`);
        console.log('🔍 SupplierListing: Connections with schedule data:', uniqueConnections.map(c => ({
          id: c.id,
          name: c.name,
          scheduleEnabled: c.scheduleEnabled,
          scheduleFrequency: c.scheduleFrequency,
          scheduleTime: c.scheduleTime,
          scheduledTime: c.scheduledTime
        })));
        setConnections(uniqueConnections);
        setTotalImportedProducts(data.totalImportedProducts || 0);
      } else {
        setConnections([]);
        setTotalImportedProducts(0);
      }
    } catch {
      setConnections([]);
    } finally {
      setIsLoadingConnections(false);
    }
  }

  useEffect(() => {
    loadConnections();
  }, []);

  // Mock supplier data
  const suppliers = [
    {
      id: 1,
      name: 'Premium Suppliers Ltd',
      email: 'api@premiumsuppliers.com',
      website: 'https://premiumsuppliers.com',
      status: 'active',
      apiConnections: 2,
      csvConnections: 1,
      totalProducts: 3247,
      lastActivity: '2 hours ago',
      connectionTypes: ['api', 'csv'] as Array<'api' | 'csv'>
    },
    {
      id: 2,
      name: 'Global Wholesale Inc',
      email: 'tech@globalwholesale.net',
      website: 'https://globalwholesale.net',
      status: 'active',
      apiConnections: 1,
      csvConnections: 0,
      totalProducts: 892,
      lastActivity: '1 day ago',
      connectionTypes: ['api'] as Array<'api' | 'csv'>
    },
    {
      id: 3,
      name: 'Fashion Distributors Co',
      email: 'support@fashiondistributors.com',
      website: 'https://fashiondistributors.com',
      status: 'active',
      apiConnections: 0,
      csvConnections: 2,
      totalProducts: 2156,
      lastActivity: '30 minutes ago',
      connectionTypes: ['csv'] as Array<'api' | 'csv'>
    },
    {
      id: 4,
      name: 'Electronics Hub Corp',
      email: 'integration@electronicshub.com',
      website: 'https://electronicshub.com',
      status: 'inactive',
      apiConnections: 1,
      csvConnections: 0,
      totalProducts: 634,
      lastActivity: '3 days ago',
      connectionTypes: ['api'] as Array<'api' | 'csv'>
    },
    {
      id: 5,
      name: 'Beauty Products Direct',
      email: 'api@beautyproductsdirect.com',
      website: 'https://beautyproductsdirect.com',
      status: 'error',
      apiConnections: 0,
      csvConnections: 1,
      totalProducts: 543,
      lastActivity: '1 hour ago',
      connectionTypes: ['csv'] as Array<'api' | 'csv'>
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge tone="success">Active</Badge>;
      case 'inactive':
        return <Badge>Inactive</Badge>;
      case 'error':
        return <Badge tone="critical">Error</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  // Filter suppliers based on search term
  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate dynamic stats from real connections data
  const totalSuppliers = connections.length > 0 ? 
    new Set(connections.map(c => c.name)).size : 0;
  
  const activeConnections = connections.filter(c => 
    (c.status || '').toLowerCase() === 'connected'
  ).length;
  
  const totalConnections = connections.length;
  
  // Use total imported products from database instead of connection product counts
  const totalProducts = totalImportedProducts;

  // Prepare data for DataTable
  const rows = filteredSuppliers.map((supplier) => [
    supplier.name,
    supplier.email,
    getStatusBadge(supplier.status),
    supplier.apiConnections + supplier.csvConnections,
    supplier.totalProducts.toLocaleString(),
    supplier.lastActivity,
    <ButtonGroup key={supplier.id}>
      <Button onClick={() => onSupplierClick(supplier)}>View Details</Button>
    </ButtonGroup>
  ]);

  const headings = [
    'Supplier Name',
    'Email',
    'Status',
    'Connections',
    'Products',
    'Last Activity',
    'Actions'
  ];

  const handleCardClick = (supplier: any) => {
    navigate('/app/connection-management', { 
      state: { 
        editMode: true, 
        supplierData: supplier 
      } 
    });
  };

  const handleCleanupDuplicates = async () => {
    try {
      const response = await fetch('/app/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          action: 'cleanupDuplicates'
        })
      });
      
      const result = await response.json();
      if (result.success) {
        console.log('✅ Duplicates cleaned up:', result.message);
        // Reload suppliers after cleanup
        loadConnections();
      }
    } catch (error) {
      console.error('❌ Error cleaning up duplicates:', error);
    }
  };

  return (
    <Page title="Supplier Directory" subtitle="Manage your supplier relationships and connection configurations">
      <Layout>
        {/* Header Stats Cards */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
            {/* Total Suppliers Card */}
            <Card background="bg-surface-secondary">
              <Box padding="400">
                <InlineStack gap="200" blockAlign="center">
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#dbe6ff',
                    color: '#1740ff'
                  }}>
                    <Icon source={StoreIcon} />
                  </div>
                  <div>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">Total Suppliers</Text>
                    <Text as="h2" variant="headingLg">{totalSuppliers}</Text>
                  </div>
                </InlineStack>
              </Box>
            </Card>

            {/* Active Card */}
            <Card background="bg-surface-secondary">
              <Box padding="400">
                <InlineStack gap="200" blockAlign="center">
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#d7f7e0',
                    color: '#1a7f37'
                  }}>
                    <Icon source={CheckCircleIcon} />
                  </div>
                  <div>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">Active</Text>
                    <Text as="h2" variant="headingLg" tone="success">{activeConnections}</Text>
                  </div>
                </InlineStack>
              </Box>
            </Card>

            {/* Connections Card */}
            <Card background="bg-surface-secondary">
              <Box padding="400">
                <InlineStack gap="200" blockAlign="center">
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#e4ecff',
                    color: '#4a5cff'
                  }}>
                    <Icon source={DomainLandingPageIcon} />
                  </div>
                  <div>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">Connections</Text>
                    <Text as="h2" variant="headingLg">{totalConnections}</Text>
                  </div>
                </InlineStack>
              </Box>
            </Card>

            {/* Total Products Card */}
            <Card background="bg-surface-secondary">
              <Box padding="400">
                <InlineStack gap="200" blockAlign="center">
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#ffe8cc',
                    color: '#c76b00'
                  }}>
                    <Icon source={DatabaseIcon} />
                  </div>
                  <div>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">Total Products</Text>
                    <Text as="h2" variant="headingLg">{totalProducts.toLocaleString()}</Text>
                  </div>
                </InlineStack>
              </Box>
            </Card>
          </InlineGrid>
        </Layout.Section>

        {/* Main Content */}
        <Layout.Section>
          <Card>
            <Box padding="400">
              <BlockStack gap="400">
                {/* Header with Search and Add Button */}
                <InlineStack align="space-between" blockAlign="center" gap="400">
                  <div style={{ flex: 1 }}>
                    <TextField
                      label=""
                      placeholder="Search suppliers by name or email..."
                      value={searchTerm}
                      onChange={setSearchTerm}
                      prefix={<Icon source={SearchIcon} />}
                      clearButton
                      onClearButtonClick={() => setSearchTerm('')}
                      autoComplete="off"
                    />
                  </div>
                  <Button
                    variant="primary"
                    icon={PlusIcon}
                    onClick={onAddNewSupplier}
                  >
                    + Add New Supplier & API
                  </Button>
                </InlineStack>

                {/* Column Headers */}
                <Card background="bg-surface-secondary">
                  <Box padding="400">
                    <InlineGrid columns={{ xs: 1, md: 6 }} gap="400">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Text as="p" variant="bodyMd" fontWeight="semibold">Supplier Title</Text>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <Text as="p" variant="bodyMd" fontWeight="semibold">Last Activity</Text>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <Text as="p" variant="bodyMd" fontWeight="semibold">Active Status</Text>
                      </div>
                      <div style={{ minWidth: 0, textAlign: 'center' }}>
                        <Text as="p" variant="bodyMd" fontWeight="semibold">CSV Count</Text>
                      </div>
                      <div style={{ minWidth: 0, textAlign: 'center' }}>
                        <Text as="p" variant="bodyMd" fontWeight="semibold">API Count</Text>
                      </div>
                      <div style={{ minWidth: 0, textAlign: 'right' }}>
                        <Text as="p" variant="bodyMd" fontWeight="semibold">Total Products</Text>
                      </div>
                    </InlineGrid>
                  </Box>
                </Card>

                {/* Supplier Cards */}
                {connections.length > 0 ? (
                  <BlockStack gap="300">
                    {(() => {
                      // Group connections by supplier name to avoid duplicates
                      const groupedConnections = connections.reduce((acc, c) => {
                        const supplierName = c.name || 'Unknown Supplier';
                        if (!acc[supplierName]) {
                          acc[supplierName] = {
                            name: supplierName,
                            connections: [],
                            totalProducts: 0,
                            lastSync: null,
                            status: 'connected'
                          };
                        }
                        acc[supplierName].connections.push(c);
                        if (typeof c.productCount === 'number') {
                          acc[supplierName].totalProducts += c.productCount;
                        }
                        if (c.updatedAt) {
                          const syncDate = new Date(c.updatedAt);
                          if (!acc[supplierName].lastSync || syncDate > new Date(acc[supplierName].lastSync!)) {
                            acc[supplierName].lastSync = c.updatedAt;
                          }
                        }
                        if (c.status === 'error') {
                          acc[supplierName].status = 'error';
                        }
                        return acc;
                      }, {} as Record<string, any>);

                      // Convert to array and sort by last sync
                      const uniqueSuppliers = Object.values(groupedConnections)
                        .sort((a: any, b: any) => {
                          if (!a.lastSync && !b.lastSync) return 0;
                          if (!a.lastSync) return 1;
                          if (!b.lastSync) return -1;
                          return new Date(b.lastSync).getTime() - new Date(a.lastSync).getTime();
                        });

                      return uniqueSuppliers.map((supplier: any) => {
                        const isConnected = supplier.status === 'connected';
                        const statusLabel = isConnected ? 'Active' : (supplier.status || 'Unknown');
                        
                        // Count API and CSV connections
                        const apiConnections = supplier.connections.filter((c: any) => c.type === 'api').length;
                        const csvConnections = supplier.connections.filter((c: any) => c.type === 'csv').length;
                        
                        return (
                          <div 
                            key={supplier.name}
                            onClick={() => handleCardClick(supplier)}
                            style={{ cursor: 'pointer' }}
                          >
                            <Card background="bg-surface-secondary">
                              <Box padding="400">
                                {/* Fixed Grid Layout for Supplier Columns */}
                                <InlineGrid columns={{ xs: 1, md: 6 }} gap="400">
                                  {/* Supplier Title */}
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <InlineStack gap="200" blockAlign="center">
                                      <div style={{
                                        width: 12,
                                        height: 12,
                                        background: isConnected ? '#00c951' : (supplier.status === 'error' ? '#fb2c36' : '#99a1af'),
                                        borderRadius: '50%',
                                        flexShrink: 0
                                      }} />
                                                                             <div style={{ minWidth: 0, flex: 1 }}>
                                         <div style={{
                                           overflow: 'hidden',
                                           textOverflow: 'ellipsis',
                                           whiteSpace: 'nowrap'
                                         }}>
                                           <Text 
                                             variant="bodyMd" 
                                             as="p" 
                                             fontWeight="semibold"
                                           >
                                             {supplier.name}
                                           </Text>
                                         </div>
                                       </div>
                                    </InlineStack>
                                  </div>

                                  {/* Last Activity */}
                                  <div style={{ 
                                    minWidth: 0,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    <Text 
                                      as="span" 
                                      variant="bodySm" 
                                      tone="subdued"
                                    >
                                      {getTimeAgo(supplier.lastSync)}
                                    </Text>
                                  </div>

                                  {/* Active Status */}
                                  <div style={{ minWidth: 0 }}>
                                    <Badge tone={isConnected ? 'success' : 'critical'}>
                                      {statusLabel}
                                    </Badge>
                                  </div>

                                  {/* CSV Count */}
                                  <div style={{ minWidth: 0, textAlign: 'center' }}>
                                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                                      {csvConnections}
                                    </Text>
                                  </div>

                                  {/* API Count */}
                                  <div style={{ minWidth: 0, textAlign: 'center' }}>
                                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                                      {apiConnections}
                                    </Text>
                                  </div>

                                  {/* Total Products */}
                                  <div style={{ minWidth: 0, textAlign: 'right' }}>
                                    <InlineStack gap="200" blockAlign="center" align="end">
                                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                                        {supplier.totalProducts.toLocaleString()}
                                      </Text>
                                      <Icon source={ChevronRightIcon} tone="subdued" />
                                    </InlineStack>
                                  </div>
                                </InlineGrid>
                              </Box>
                            </Card>
                          </div>
                        );
                      });
                    })()}
                  </BlockStack>
                ) : (
                  <Box paddingBlockStart="800" paddingBlockEnd="800">
                    <EmptyState
                      heading={searchTerm ? `No suppliers found matching "${searchTerm}"` : "No suppliers yet"}
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                      action={{
                        content: searchTerm ? 'Clear search' : 'Add New Supplier & API',
                        onAction: searchTerm ? () => setSearchTerm('') : onAddNewSupplier,
                      }}
                    >
                      {!searchTerm && (
                        <p>Click "Add New Supplier & API" to get started</p>
                      )}
                    </EmptyState>
                  </Box>
                )}
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}