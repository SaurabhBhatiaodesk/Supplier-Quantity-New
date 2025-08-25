import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Layout,
  Button,
  Badge,
  TextField,
  Tabs,
  DataTable, 
  BlockStack,
  Text,
  Box,
  Icon,
  EmptyState,
  ButtonGroup,
  Popover,
  ActionList,
  Pagination
} from '@shopify/polaris';
import {
  ArrowLeftIcon,
  SearchIcon,
  PlusIcon,
  MenuIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  EditIcon,
  DeleteIcon,
  RefreshIcon,
  ClockIcon,
  UploadIcon,
  EmailIcon,
  LinkIcon,
  DatabaseIcon
} from '@shopify/polaris-icons';

interface Supplier {
  id: number | string;
  name: string;
  email: string;
  status: 'connected' | 'disconnected' | 'error' | string;
  totalProducts: number;
}

interface Connection {
  id: number;
  type: 'api' | 'csv';
  name: string;
  url?: string;
  csvFileName?: string;
  status: 'connected' | 'disconnected' | 'error' | string;
  lastSync: string;
  productCount: number;
  scheduledTime: string | null;
  supplierEmail: string;
  updatedAt?: string;
}

interface SupplierDetailsStepProps { 
  supplier: Supplier; 
  onGoBack: () => void; 
  onAddNewConnection: (supplier: Supplier) => void; 
}

export default function SupplierDetailsStep({ 
  supplier, 
  onGoBack, 
  onAddNewConnection 
}: SupplierDetailsStepProps) {
  const [selectedTab, setSelectedTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activePopovers, setActivePopovers] = useState<Record<number, boolean>>({});
  const itemsPerPage = 10;

  const [allConnections, setAllConnections] = useState<Connection[]>([]);

  const loadConnections = async () => {
    try {
      const resp = await fetch('/app/api/connections');
      const data = await resp.json();
      if (resp.ok && data?.success) {
        const normalized: Connection[] = (data.connections || []).map((c: any, idx: number) => ({
          id: idx + 1,
          type: (c.type === 'csv' ? 'csv' : 'api') as 'api' | 'csv',
          name: c.name,
          url: c.apiUrl || undefined,
          csvFileName: c.csvFileName || undefined,
          status: c.status || 'connected',
          lastSync: c.updatedAt ? new Date(c.updatedAt).toLocaleString() : '—',
          productCount: c.productCount ?? 0,
          scheduledTime: c.scheduledTime || null,
          supplierEmail: c.supplierEmail || supplier.email,
          updatedAt: c.updatedAt || undefined,
        }));
        setAllConnections(normalized);
      }
    } catch (e) {
      // ignore for now
    }
  };

  useEffect(() => {
    loadConnections();
  }, [supplier]);

  const stats = useMemo(() => {
    const apiCount = allConnections.filter(c => c.type === 'api').length;
    const csvCount = allConnections.filter(c => c.type === 'csv').length;
    const totalProducts = allConnections.reduce((sum, c) => sum + (c.productCount || 0), 0);
    const latest = allConnections
      .map(c => (c.updatedAt ? new Date(c.updatedAt).getTime() : 0))
      .reduce((a, b) => Math.max(a, b), 0);
    const lastSyncDisplay = latest ? new Date(latest).toLocaleString() : '—';
    return { apiCount, csvCount, totalProducts, lastSyncDisplay };
  }, [allConnections]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge tone="success">Connected</Badge>;
      case 'disconnected':
        return <Badge>Disconnected</Badge>;
      case 'error':
        return <Badge tone="critical">Error</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const formatDisplayTime = (timeString: string | null) => {
    if (!timeString) return 'Manual';
    const [hour, minute] = timeString.split(':');
    const hourNum = parseInt(hour);
    const period = hourNum >= 12 ? 'PM' : 'AM';
    const displayHour = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
    return `${displayHour}:${minute} ${period}`;
  };

  // Handler functions for dropdown actions
  const handleEditConnection = (connection: Connection) => {
    console.log('Edit connection:', connection);
    alert(`Edit ${connection.name}`);
  };

  const handleTestConnection = (connection: Connection) => {
    console.log('Test connection:', connection);
    alert(`Testing ${connection.name}...`);
  };

  const handleEditSchedule = (connection: Connection) => {
    console.log('Edit schedule:', connection);
    alert(`${connection.scheduledTime ? 'Edit' : 'Add'} schedule for ${connection.name}`);
  };

  const handleDeleteConnection = (connection: Connection) => {
    console.log('Delete connection:', connection);
    if (confirm(`Are you sure you want to delete ${connection.name}?`)) {
      alert(`Deleted ${connection.name}`);
    }
  };

  const handleUploadNewCsv = (connection: Connection) => {
    console.log('Upload new CSV:', connection);
    alert(`Upload new CSV for ${connection.name}`);
  };

  const togglePopover = (connectionId: number) => {
    setActivePopovers(prev => ({
      ...prev,
      [connectionId]: !prev[connectionId]
    }));
  };

  const getActionItems = (connection: Connection) => [
    {
      content: 'Edit Connection',
      icon: EditIcon,
      onAction: () => {
        handleEditConnection(connection);
        setActivePopovers(prev => ({ ...prev, [connection.id]: false }));
      }
    },
    {
      content: connection.type === 'api' ? 'Test Connection' : 'Upload New CSV',
      icon: connection.type === 'api' ? RefreshIcon : UploadIcon,
      onAction: () => {
        if (connection.type === 'api') {
          handleTestConnection(connection);
        } else {
          handleUploadNewCsv(connection);
        }
        setActivePopovers(prev => ({ ...prev, [connection.id]: false }));
      }
    },
    // {
    //   content: connection.scheduledTime ? 'Edit Schedule' : 'Add Schedule',
    //   icon: ClockIcon,
    //   onAction: () => {
    //     handleEditSchedule(connection);
    //     setActivePopovers(prev => ({ ...prev, [connection.id]: false }));
    //   }
    // },
    {
      content: 'Delete Connection',
      icon: DeleteIcon,
      destructive: true,
      onAction: () => {
        handleDeleteConnection(connection);
        setActivePopovers(prev => ({ ...prev, [connection.id]: false }));
      }
    }
  ];

  // Filter connections by type and search term
  const getFilteredConnections = (type: 'api' | 'csv') => {
    return allConnections
      .filter(conn => conn.type === type)
      .filter(conn => 
        conn.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (conn.url && conn.url.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (conn.csvFileName && conn.csvFileName.toLowerCase().includes(searchTerm.toLowerCase()))
      );
  };

  const apiConnections = getFilteredConnections('api');
  const csvConnections = getFilteredConnections('csv');
  
  const currentConnections = selectedTab === 0 ? apiConnections : csvConnections;
  
  // Pagination logic
  const totalPages = Math.ceil(currentConnections.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedConnections = currentConnections.slice(startIndex, endIndex);

  // Prepare data for DataTable
  const getTableRows = (connections: Connection[]) => {
    return connections.map((connection) => [
      <BlockStack key={connection.id} gap="200" inlineAlign="center">
        <Icon 
          source={connection.type === 'api' ? LinkIcon : DatabaseIcon} 
          tone={connection.type === 'api' ? 'info' : 'magic'}
        />
        <BlockStack gap="100">
          <Text as="p" variant="bodyMd" fontWeight="semibold">{connection.name}</Text>
          <Text as="p" variant="bodySm" tone="subdued">
            {connection.type === 'api' ? connection.url : connection.csvFileName}
          </Text>
        </BlockStack>
      </BlockStack>,
      getStatusBadge(connection.status),
      connection.productCount.toLocaleString(),
      connection.lastSync,
      formatDisplayTime(connection.scheduledTime),
      <ButtonGroup key={connection.id}>
        {connection.type === 'csv' && (
          <Button 
            size="slim" 
            icon={UploadIcon}
            onClick={() => handleUploadNewCsv(connection)}
          >
            Update CSV
          </Button>
        )}
        <Popover
          active={Boolean(activePopovers[connection.id])}
          activator={
            <Button 
              size="slim"
              icon={MenuIcon}
              onClick={() => togglePopover(connection.id)}
              accessibilityLabel="More actions"
            />
          }
          onClose={() => togglePopover(connection.id)}
        >
          <ActionList items={getActionItems(connection)} />
        </Popover>
      </ButtonGroup>
    ]);
  };

  const tabs = [
    {
      id: 'api-tab',
      content: `API Connections (${apiConnections.length})`,
      accessibilityLabel: 'API connections',
    },
    {
      id: 'csv-tab',
      content: `CSV Connections (${csvConnections.length})`,
      accessibilityLabel: 'CSV connections',
    }
  ];

  const headings = [
    'Connection Details',
    'Status',
    'Products',
    'Last Sync',
    'Schedule',
    'Actions'
  ];

  return (
    <Layout>
      {/* Header */}
      <Layout.Section>
        <Card>
          <Box padding="600">
            <BlockStack align="space-between" inlineAlign="center">
              <BlockStack gap="400" inlineAlign="center">
                <Button 
                  icon={ArrowLeftIcon}
                  onClick={onGoBack}
                >
                  Back to Suppliers
                </Button>
                <BlockStack gap="200">
                  <BlockStack gap="200" inlineAlign="center">
                    <Text variant="headingLg" as="h1">{supplier.name}</Text>
                    <Badge tone="success">{supplier.status}</Badge>
                  </BlockStack>
                  <BlockStack gap="400">
                    <BlockStack gap="200" inlineAlign="center">
                      <Icon source={EmailIcon} />
                      <Text as="p" variant="bodyMd" tone="subdued">{supplier.email}</Text>
                    </BlockStack>
                    <BlockStack gap="100" inlineAlign="center">
                      <Text as="p" variant="bodyMd" tone="subdued">Last sync: {stats.lastSyncDisplay}</Text>
                    </BlockStack>
                    <BlockStack gap="100" inlineAlign="center">
                      <Text as="p" variant="bodyMd" tone="subdued">{stats.apiCount} API</Text>
                      <Text as="p" variant="bodyMd" tone="subdued">{stats.csvCount} CSV</Text>
                      <Text as="p" variant="bodyMd" tone="subdued">{stats.totalProducts.toLocaleString()} Products</Text>
                    </BlockStack>
                  </BlockStack>
                </BlockStack>
              </BlockStack>
              <Button 
                variant="primary"
                icon={PlusIcon}
                onClick={() => onAddNewConnection(supplier)}
              >
                Add Connection
              </Button>
            </BlockStack>
          </Box>
        </Card>
      </Layout.Section>

      {/* Connections Management */}
      <Layout.Section>
        <Card>
          <Box padding="600">
            <BlockStack gap="400">
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2">Connection Management</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Manage API and CSV connections for {supplier.name}
                </Text>
              </BlockStack>

              <BlockStack align="space-between" inlineAlign="center">
                <Box width="50%">
                  <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} />
                </Box>
                
                <Box width="40%">
                  <TextField
                    label=""
                    placeholder={`Search ${selectedTab === 0 ? 'API' : 'CSV'} connections...`}
                    value={searchTerm}
                    onChange={(value) => {
                      setSearchTerm(value);
                      setCurrentPage(1);
                    }}
                    prefix={<Icon source={SearchIcon} />}
                    clearButton
                    onClearButtonClick={() => {
                      setSearchTerm('');
                      setCurrentPage(1);
                    }}
                    autoComplete="off"
                  />
                </Box>
              </BlockStack>

              {/* Connections List */}
              {paginatedConnections.length > 0 ? (
                <BlockStack gap="400">
                  <DataTable
                    columnContentTypes={[
                      'text',
                      'text', 
                      'numeric',
                      'text',
                      'text',
                      'text'
                    ]}
                    headings={headings}
                    rows={getTableRows(paginatedConnections)}
                    hoverable
                  />
                  
                  {totalPages > 1 && (
                    <Box paddingBlockStart="400">
                      <BlockStack align="center">
                        <Pagination
                          label={`${startIndex + 1}-${Math.min(endIndex, currentConnections.length)} of ${currentConnections.length} connections`}
                          hasPrevious={currentPage > 1}
                          onPrevious={() => setCurrentPage(currentPage - 1)}
                          hasNext={currentPage < totalPages}
                          onNext={() => setCurrentPage(currentPage + 1)}
                        />
                      </BlockStack>
                    </Box>
                  )}
                </BlockStack>
              ) : (
                <Box paddingBlockStart="800" paddingBlockEnd="800">
                  <EmptyState
                    heading={
                      searchTerm 
                        ? `No ${selectedTab === 0 ? 'API' : 'CSV'} connections found matching "${searchTerm}"` 
                        : `No ${selectedTab === 0 ? 'API' : 'CSV'} connections configured yet`
                    }
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    action={searchTerm ? {
                      content: 'Clear search',
                      onAction: () => setSearchTerm('')
                    } : {
                      content: 'Add Connection',
                      onAction: () => onAddNewConnection(supplier)
                    }}
                  />
                </Box>
              )}
            </BlockStack>
          </Box>
        </Card>
      </Layout.Section>
    </Layout>
  );
}