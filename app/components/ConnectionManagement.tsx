import {
  Page,
  Layout,
  Card,
  Text,
  Box,
  BlockStack,
  InlineStack,
  Icon,
  Divider,
  TextField,
  Button,
  Tabs,
  Badge,
  InlineGrid,
  Popover,
  ActionList,
  Modal,
  Select,
  Checkbox,
  Banner
} from '@shopify/polaris';
import {
  StatusActiveIcon,
  XCircleIcon,
  AlertCircleIcon,
  LinkIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
  PlusIcon,
  SearchIcon,
  CalendarIcon,
  ImportIcon,
  MenuHorizontalIcon,
  UploadIcon,
  ClockIcon,
  PlayIcon
} from '@shopify/polaris-icons';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from '@remix-run/react';

interface ScheduleConfig {
  enabled: boolean;
  time: string;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'test';
  markupEnabled: boolean;
  markupType: 'percentage' | 'fixed';
  markupValue: number;
  priceFrom: number;
  priceTo: number;
  conditionOperator: string;
}

const ConnectionManagement = () => {

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState<Record<string, boolean>>({});
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<any>(null);
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    enabled: false,
    time: '09:00',
    frequency: 'daily',
    markupEnabled: false,
    markupType: 'percentage',
    markupValue: 0,
    priceFrom: 0,
    priceTo: 0,
    conditionOperator: 'between'
  });
  
  // Edit connection state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    apiUrl: '',
    accessToken: '',
    supplierName: '',
    supplierEmail: ''
  });

  // Cron job test timer
  const [testTimer, setTestTimer] = useState<number | null>(null);
  const [testTimerActive, setTestTimerActive] = useState(false);

  // Schedule countdown timers
  const [scheduleTimers, setScheduleTimers] = useState<Record<string, number>>({});
  


  // Start 5-minute test timer
  const startTestTimer = () => {
    setTestTimer(300); // 5 minutes = 300 seconds
    setTestTimerActive(true);
    
    const interval = setInterval(() => {
      setTestTimer(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setTestTimerActive(false);
          // Auto-trigger cron job when timer reaches 0
          handleManualSync();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Calculate time until next schedule
  const calculateTimeUntilSchedule = (time: string, frequency: string) => {
    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    const scheduleTime = new Date();
    scheduleTime.setHours(hours, minutes, 0, 0);
    
    // If schedule time has passed today, set it for tomorrow
    if (scheduleTime <= now) {
      scheduleTime.setDate(scheduleTime.getDate() + 1);
    }
    
    const diffMs = scheduleTime.getTime() - now.getTime();
    return Math.floor(diffMs / 1000); // Return seconds
  };

  // Format schedule countdown
  const formatScheduleCountdown = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h ${mins}m`;
    } else if (hours > 0) {
      return `${hours}h ${mins}m ${secs}s`;
    } else if (mins > 0) {
      return `${mins}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Format timer display
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Get supplier data from navigation state, URL parameters, and localStorage
  const supplierData = location.state?.supplierData;
  const isEditMode = location.state?.editMode || false;
  
  // Also check URL parameters as fallback
  const urlParams = new URLSearchParams(location.search);
  const urlSupplierName = urlParams.get('supplier');
  const urlEditMode = urlParams.get('editMode') === 'true';
  
  // Check localStorage as another fallback
  const [supplierDataFromStorage, setSupplierDataFromStorage] = useState<any>(null);
  
  // Debug logging
  console.log('🔍 ConnectionManagement Debug:');
  console.log('Location state:', location.state);
  console.log('URL params:', { supplier: urlSupplierName, editMode: urlEditMode });
  console.log('Supplier data:', supplierData);
  console.log('Is edit mode:', isEditMode);
  
  // Load from localStorage on component mount
  useEffect(() => {
    const storedData = localStorage.getItem('editSupplierData');
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData);
        console.log('📦 Loaded supplier data from localStorage:', parsedData);
        setSupplierDataFromStorage(parsedData);
        // Clear localStorage after loading
        localStorage.removeItem('editSupplierData');
      } catch (error) {
        console.error('❌ Error parsing localStorage data:', error);
      }
    }
  }, []);
  
  // If we have URL params but no state, we need to load the supplier data
  const [supplierDataFromUrl, setSupplierDataFromUrl] = useState<any>(null);
  
  useEffect(() => {
    if (urlSupplierName && !supplierData) {
      console.log('🔄 Loading supplier data from URL parameter:', urlSupplierName);
      loadSupplierDataFromName(urlSupplierName);
    }
  }, [urlSupplierName, supplierData]);
  
  async function loadSupplierDataFromName(supplierName: string) {
    try {
      const resp = await fetch('/app/api/connections');
      const data = await resp.json();
      if (resp.ok && data?.success) {
        // Find supplier by name
        const allConnections = data.connections || [];
        const supplierConnections = allConnections.filter((c: any) => 
          c.name === supplierName
        );
        
        if (supplierConnections.length > 0) {
          // Group connections by supplier name (same logic as SupplierListingStep)
          const groupedConnections = supplierConnections.reduce((acc: any, c: any) => {
            const name = c.name || 'Unknown Supplier';
            if (!acc[name]) {
              acc[name] = {
                name: name,
                connections: [],
                totalProducts: 0,
                lastSync: null,
                status: 'connected'
              };
            }
            acc[name].connections.push(c);
            if (typeof c.productCount === 'number') {
              acc[name].totalProducts += c.productCount;
            }
            if (c.updatedAt) {
              const syncDate = new Date(c.updatedAt);
              if (!acc[name].lastSync || syncDate > new Date(acc[name].lastSync!)) {
                acc[name].lastSync = c.updatedAt;
              }
            }
            if (c.status === 'error') {
              acc[name].status = 'error';
            }
            return acc;
          }, {});
          
          const supplierData = groupedConnections[supplierName];
          console.log('📊 Loaded supplier data from URL:', supplierData);
          setSupplierDataFromUrl(supplierData);
        }
      }
    } catch (error) {
      console.error('❌ Error loading supplier data:', error);
    }
  }
  
  // State for actual connections data
  const [connections, setConnections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load actual connections for this supplier
  useEffect(() => {
    const finalSupplierData = supplierData || supplierDataFromUrl || supplierDataFromStorage;
    if (finalSupplierData?.name) {
      console.log('🔄 Setting connections from supplier data:', finalSupplierData.connections);
      setConnections(finalSupplierData.connections || []);
      setIsLoading(false);
    } else {
      // If no supplier data, fetch from API
      const fetchConnections = async () => {
        try {
          setIsLoading(true);
          const response = await fetch('/app/api/connections');
          const data = await response.json();
          
          if (data.success) {
            console.log('📡 Fetched connections from API:', data.connections);
            
            // Parse schedule data for each connection
            const connectionsWithSchedule = data.connections.map((c: any) => {
              let scheduleEnabled = false;
              let scheduleFrequency: any = 'daily';
              let scheduleTime = '09:00';
              
              // Parse schedule data from scheduledTime field
              if (c.scheduledTime) {
                try {
                  // Try to parse as JSON first
                  const scheduleData = JSON.parse(c.scheduledTime);
                  if (scheduleData.enabled !== undefined) {
                    scheduleEnabled = scheduleData.enabled;
                    scheduleFrequency = scheduleData.frequency || 'daily';
                    scheduleTime = scheduleData.time || '09:00';
                  } else {
                    // If not JSON, treat as simple time string
                    scheduleEnabled = true;
                    scheduleTime = c.scheduledTime;
                  }
                } catch (e) {
                  // If parsing fails, treat as simple time string
                  scheduleEnabled = true;
                  scheduleTime = c.scheduledTime;
                }
              }
              
              return {
                ...c,
                scheduleEnabled,
                scheduleFrequency,
                scheduleTime
              };
            });
            
            console.log('🔍 Connections with parsed schedule data:', connectionsWithSchedule.map((c: any) => ({
              id: c.id,
              name: c.name,
              apiUrl: c.apiUrl,
              scheduleEnabled: c.scheduleEnabled,
              scheduleFrequency: c.scheduleFrequency,
              scheduleTime: c.scheduleTime,
              scheduledTime: c.scheduledTime
            })));
            
            setConnections(connectionsWithSchedule || []);
          } else {
            console.error('❌ Failed to fetch connections:', data.error);
          }
        } catch (error) {
          console.error('❌ Error fetching connections:', error);
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchConnections();
    }
  }, [supplierData, supplierDataFromUrl, supplierDataFromStorage]);

  // Update schedule timers every second
  useEffect(() => {
    const interval = setInterval(() => {
      setScheduleTimers(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(connectionId => {
          if (updated[connectionId] > 0) {
            updated[connectionId] -= 1; // Decrease by 1 second
          }
        });
        return updated;
      });
    }, 1000); // Update every second
    
    return () => clearInterval(interval);
  }, []);

  const handleCardClick = (connectionId: string) => {
    console.log(`Opening connection ${connectionId}`);
    // Add your navigation logic here
  };

 const handleAddNewConnection = () => {  
    navigate('/app');
  };

  const handleEditSchedule = (connection: any) => {
    console.log('Edit schedule clicked for connection:', connection);
    setSelectedConnection(connection);
    
    // Load existing schedule if available
    let scheduleEnabled = false;
    let scheduleTime = '09:00';
    let scheduleFrequency = 'daily';
    
    // Try to parse schedule data from scheduledTime field
    if (connection.scheduledTime) {
      try {
        const scheduleData = JSON.parse(connection.scheduledTime);
        scheduleEnabled = scheduleData.enabled || false;
        scheduleTime = scheduleData.time || '09:00';
        scheduleFrequency = scheduleData.frequency || 'daily';
      } catch (e) {
        // If not JSON, treat as simple time string
        scheduleTime = connection.scheduledTime;
        scheduleEnabled = !!connection.scheduledTime;
      }
    }
    
    // Parse markup data from schedule data
    let markupEnabled = false;
    let markupType = 'percentage';
    let markupValue = 0;
    let priceFrom = 0;
    let priceTo = 0;
    let conditionOperator = 'between';
    
    if (connection.scheduledTime) {
      try {
        const scheduleData = JSON.parse(connection.scheduledTime);
        markupEnabled = scheduleData.markupEnabled || false;
        markupType = scheduleData.markupType || 'percentage';
        markupValue = scheduleData.markupValue || 0;
        priceFrom = scheduleData.priceFrom || 0;
        priceTo = scheduleData.priceTo || 0;
        conditionOperator = scheduleData.conditionOperator || 'between';
      } catch (e) {
        // Use defaults if parsing fails
      }
    }
    
    setScheduleConfig({
      enabled: scheduleEnabled,
      time: scheduleTime,
      frequency: scheduleFrequency as 'hourly' | 'daily' | 'weekly' | 'monthly' | 'test',
      markupEnabled,
      markupType: markupType as 'percentage' | 'fixed',
      markupValue,
      priceFrom,
      priceTo,
      conditionOperator
    });
    
    setScheduleModalOpen(true);
    setMenuOpen(prev => ({ ...prev, [`api${connection.id}`]: false }));
  };

  const handleEditConnection = (connection: any) => {
    console.log('Edit connection clicked for:', connection);
    setEditingConnection(connection);
    setEditFormData({
      name: connection.name || '',
      apiUrl: connection.apiUrl || '',
      accessToken: connection.accessToken || '',
      supplierName: connection.supplierName || '',
      supplierEmail: connection.supplierEmail || ''
    });
    setEditModalOpen(true);
    setMenuOpen(prev => ({ ...prev, [`api${connection.id}`]: false }));
  };



  const handleDeleteConnection = async (connection: any) => {
    const confirmed = confirm(`Are you sure you want to delete the connection "${connection.name}"?\n\nThis action cannot be undone and will remove all associated data.`);
    
    if (!confirmed) {
      return;
    }

    try {
      console.log('🗑️ Deleting connection:', connection.name);
      
      const response = await fetch('/app/api/connections', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          connectionId: connection.id
        })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Connection deleted successfully');
        // Remove from local state
        setConnections(prev => prev.filter(conn => conn.id !== connection.id));
        alert('✅ Connection deleted successfully!');
      } else {
        console.error('❌ Failed to delete connection:', data.error);
        alert('❌ Failed to delete connection: ' + data.error);
      }
    } catch (error) {
      console.error('❌ Error deleting connection:', error);
      alert('❌ Error deleting connection. Please try again.');
    }
  };

  const handleSaveConnection = async () => {
    try {
      console.log('Saving connection:', editingConnection.id, editFormData);
      
      const response = await fetch('/app/api/connections', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          connectionId: editingConnection.id,
          ...editFormData
        })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Connection updated successfully');
        // Update local state
        setConnections(prev => prev.map(conn => 
          conn.id === editingConnection.id 
            ? { ...conn, ...editFormData }
            : conn
        ));
        setEditModalOpen(false);
        setEditingConnection(null);
      } else {
        console.error('❌ Failed to update connection:', data.error);
        alert('Failed to update connection: ' + data.error);
      }
    } catch (error) {
      console.error('❌ Error updating connection:', error);
      alert('Error updating connection');
    }
  };

  const handleSaveSchedule = async () => {
    console.log('Saving schedule for connection:', selectedConnection);
    console.log('Schedule config:', scheduleConfig);
    
    try {
      // Save schedule to database
      const scheduleData = {
        enabled: scheduleConfig.enabled,
        frequency: scheduleConfig.frequency,
        time: scheduleConfig.time
      };
      
      console.log('📝 Sending schedule data to backend:', scheduleData);
      
      const response = await fetch('/app/api/connections', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          connectionId: selectedConnection.id,
          scheduleEnabled: scheduleConfig.enabled,
          scheduleFrequency: scheduleConfig.frequency,
          scheduleTime: scheduleConfig.time
        })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Schedule saved to database successfully');
        
        // Update connection state with schedule info
        if (selectedConnection) {
          setConnections(prev => prev.map(conn => 
            conn.id === selectedConnection.id 
              ? { 
                  ...conn, 
                  scheduleEnabled: scheduleConfig.enabled,
                  scheduleFrequency: scheduleConfig.frequency,
                  scheduleTime: scheduleConfig.time
                }
              : conn
          ));
        }
        
        // If it's a test schedule (5 minutes), start the test timer
        if (scheduleConfig.frequency === 'test' && scheduleConfig.enabled) {
          console.log('🕐 Starting test schedule for 5 minutes...');
          startTestTimer();
          alert('Test schedule started! Cron job will run in 5 minutes.');
        } else if (scheduleConfig.enabled) {
          // Start schedule countdown timer
          const timeUntilSchedule = calculateTimeUntilSchedule(scheduleConfig.time, scheduleConfig.frequency);
          setScheduleTimers(prev => ({
            ...prev,
            [selectedConnection.id]: timeUntilSchedule
          }));
          alert('Schedule saved successfully!');
        } else {
          alert('Schedule saved successfully!');
        }
      } else {
        console.error('❌ Failed to save schedule:', data.error);
        alert('Failed to save schedule: ' + data.error);
      }
    } catch (error) {
      console.error('❌ Error saving schedule:', error);
      alert('Error saving schedule');
    }
    
    setScheduleModalOpen(false);
  };

  const handleManualSync = async () => {
    try {
      console.log('🚀 Starting manual sync for all connections...');
      
      const response = await fetch('/app/api/cron', {
        method: 'POST'
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Manual sync completed:', data.results);
        // TODO: Show success message to user
        alert('Manual sync completed successfully!');
      } else {
        console.error('❌ Manual sync failed:', data.error);
        alert('Manual sync failed: ' + data.error);
      }
    } catch (error) {
      console.error('❌ Error during manual sync:', error);
      alert('Error during manual sync');
    }
  };



  // Filter API connections with search
  const apiConnections = connections
    .filter(c => c.type === 'api')
    .filter(c => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        c.name?.toLowerCase().includes(query) ||
        c.apiUrl?.toLowerCase().includes(query) ||
        c.supplierName?.toLowerCase().includes(query) ||
        c.supplierEmail?.toLowerCase().includes(query)
      );
    });

  // Filter CSV connections with search
  const csvConnections = connections
    .filter(c => c.type === 'csv')
    .filter(c => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        c.name?.toLowerCase().includes(query) ||
        c.csvFileName?.toLowerCase().includes(query)
      );
    });

  // Calculate total products for each connection type
  const apiTotalProducts = apiConnections.reduce((sum, c) => sum + (c.productCount || 0), 0);
  const csvTotalProducts = csvConnections.reduce((sum, c) => sum + (c.productCount || 0), 0);

  // Get supplier info
  const finalSupplierData = supplierData || supplierDataFromUrl || supplierDataFromStorage;
  const supplierName = finalSupplierData?.name || 'Unknown Supplier';
  const supplierEmail = finalSupplierData?.connections?.[0]?.apiUrl || finalSupplierData?.connections?.[0]?.csvFileName || 'No email available';
  const totalProducts = finalSupplierData?.totalProducts || 0;
  
  console.log('📊 Supplier Info:', {
    name: supplierName,
    email: supplierEmail,
    totalProducts: totalProducts,
    connections: finalSupplierData?.connections
  });

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

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'connected':
        return <Badge tone="success">Connected</Badge>;
      case 'error':
        return <Badge tone="critical">Error</Badge>;
      case 'disconnected':
        return <Badge>Disconnected</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'connected':
        return '#16a34a';
      case 'error':
        return '#ef4444';
      case 'disconnected':
        return '#9ca3af';
      default:
        return '#9ca3af';
    }
  };

  // If no supplier data, show a message
  if (!supplierData && !supplierDataFromUrl && !supplierDataFromStorage) {
    return (
      <Page>
        <Card>
          <Box padding="400">
            <Text as="h2" variant="headingMd">No Supplier Selected</Text>
            <Text as="p" tone="subdued">Please go back and select a supplier to edit.</Text>
            <Button onClick={() => navigate(-1)}>Back to Suppliers</Button>
          </Box>
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      {/* Header Section */}
      <div style={{background:'#fff', boxShadow:'1px 2px 2px rgb(219, 219, 219)', borderRadius:'12px', marginBottom:'15px'}}>
        <Box padding="400">
          <InlineStack align="space-between" blockAlign="center">
            {/* Left side - Navigation and Supplier Info */}
            <BlockStack gap="200">
              <div style={{ alignSelf: 'flex-start' }}>
                <Button 
                  variant="plain" 
                  icon={ChevronRightIcon} 
                  onClick={() => navigate(-1)}
                >
                  Back to Suppliers
                </Button>
    </div>
              
              <InlineStack gap="300" blockAlign="center">
                <Text as="h1" variant="headingLg" fontWeight="semibold">
                  {supplierName}
                </Text>
                <Badge tone="success">active</Badge>
              </InlineStack>
              
              <InlineStack gap="300" blockAlign="center">
                <Text as="span" variant="bodyMd" tone="subdued">
                  {supplierEmail}
                </Text>
                <Text as="span" variant="bodyMd" tone="subdued">
                  {totalProducts.toLocaleString()} total products
                </Text>
              </InlineStack>
            </BlockStack>
            
            {/* Right side - Add Connection Button */}
            <Button
              variant="primary"
              icon={PlusIcon}
              onClick={handleAddNewConnection}
            >
              + Add Connection
            </Button>
          </InlineStack>
        </Box>
          </div>

      {/* Connection Management Section */}
      <Card>
        <Box padding="400">
          <BlockStack gap="400">
            {/* Title and Description */}
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd" fontWeight="semibold">
                Connection Management
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Manage API and CSV connections for {supplierName}
              </Text>
            </BlockStack>

            {/* Tabs and Search */}
            <InlineStack align="space-between" blockAlign="center">
          <Tabs
            tabs={[
              {
                id: 'api-connections',
                    content: `API-Based Connections (${apiConnections.length})`,
                accessibilityLabel: 'API Connections',
              },
              {
                id: 'csv-connections',
                    content: `CSV-Based Connections (${csvConnections.length})`,
                accessibilityLabel: 'CSV Connections',
              },
            ]}
            selected={selectedTab}
                onSelect={(selectedTabIndex) => setSelectedTab(selectedTabIndex)}
              />
              
              <div style={{ width: 320 }}>
                <TextField
                  label=""
                  placeholder={selectedTab === 0 ? "Search API connections..." : "Search CSV files..."}
                  prefix={<Icon source={SearchIcon} />}
                  value={searchQuery}
                  onChange={setSearchQuery}
                  clearButton
                  onClearButtonClick={() => setSearchQuery('')}
                  autoComplete="off"
                />
              </div>
            </InlineStack>

            {/* Connections List */}
                  <BlockStack gap="300">
              {isLoading ? (
                <Box paddingBlockStart="400" paddingBlockEnd="400">
                  <Text as="p" tone="subdued">Loading connections...</Text>
                </Box>
                              ) : selectedTab === 0 ? (
                  // API Connections
                  apiConnections.length > 0 ? (
                    apiConnections.map((connection) => (
                      <Card key={connection.id} background="bg-surface-secondary">
                      <Box padding="400">
                          <InlineStack align="space-between" blockAlign="start">
                            {/* Left side - Connection Info */}
                            <div style={{ flex: 1 }}>
                          <BlockStack gap="200">
                                {/* First Line - Title and Status Chips */}
                                <InlineStack gap="300" blockAlign="center">
                                  <div style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: '50%',
                                    background: getStatusColor(connection.status),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}>
                                    {connection.status === 'connected' && (
                                      <div style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        background: '#fff'
                                      }} />
                                    )}
                                    {connection.status === 'error' && (
                                      <div style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        background: '#fff'
                                      }} />
                                    )}
                                    {connection.status === 'disconnected' && (
                                      <div style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        background: '#fff'
                                      }} />
                                    )}
                              </div>

                                  <div style={{ flex: 1, minWidth: 0 }}>
                                <Text variant="bodyLg" as="p" fontWeight="semibold">
                                      {connection.name || 'API Connection'}
                                </Text>
                                  </div>
                                  
                                  <Badge tone={connection.status === 'connected' ? 'success' : 
                                              connection.status === 'error' ? 'critical' : undefined}>
                                    {connection.status || 'Unknown'}
                                  </Badge>
                                  
                                  <div style={{ flexShrink: 0 }}>
                                    <InlineStack gap="100" blockAlign="center">
                                      <Icon source={LinkIcon} tone="subdued" />
                                      <Text as="span" variant="bodySm" tone="subdued">API</Text>
                                </InlineStack>
                              </div>
                            </InlineStack>

                                {/* Second Line - URL */}
                                <Text as="p" variant="bodyMd" tone="subdued">
                                  {connection.apiUrl || 'No URL'}
                                </Text>

                                {/* Third Line - Product Count and Last Activity */}
                                <InlineStack gap="300" blockAlign="center">
                                  <Text as="span" variant="bodySm" tone="subdued">
                                    Products: {(connection.productCount || 0).toLocaleString()}
                                  </Text>
                                  <Text as="span" variant="bodySm" tone="subdued">
                                    Last activity: {getTimeAgo(connection.updatedAt)}
                                  </Text>
                                </InlineStack>
                              </BlockStack>
                            </div>

                            {/* Right side - Schedule and Actions */}
                            <InlineStack gap="300" blockAlign="center">
                              {/* Schedule Display */}
                              <div style={{ textAlign: 'right' }}>
                                {connection.scheduleEnabled ? (
                                  <BlockStack gap="100">
                                    <div style={{ color: '#7c3aed' }}>
                                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                                        {connection.scheduleTime}
                                      </Text>
                                    </div>
                                    <div style={{ textTransform: 'capitalize' }}>
                                      <Text as="p" variant="bodySm" tone="subdued">
                                        {connection.scheduleFrequency}
                                      </Text>
                                    </div>
                                  </BlockStack>
                                ) : (
                                  <Text as="p" variant="bodySm" tone="subdued">
                                    Manual
                                  </Text>
                                )}
                              </div>

                              {/* Actions Menu */}
                            <Popover
                                active={menuOpen[`api${connection.id}`] || false}
                                onClose={() => setMenuOpen(prev => ({ ...prev, [`api${connection.id}`]: false }))}
                              activator={
                                  <Button
                                    variant="plain"
                                    icon={MenuHorizontalIcon}
                                    onClick={() => setMenuOpen(prev => ({ ...prev, [`api${connection.id}`]: !prev[`api${connection.id}`] }))}
                                  />
                              }
                            >
                              <ActionList
                                items={[
                                    { 
                                      content: 'Edit Connection', 
                                      prefix: <Icon source={LinkIcon} />,
                                      onAction: () => handleEditConnection(connection)
                                    },
                                    // { 
                                    //   content: 'Edit Schedule', 
                                    //   prefix: <Icon source={CalendarIcon} />,
                                    //   onAction: () => handleEditSchedule(connection)
                                    // },
                                    { 
                                      content: 'Delete Connection', 
                                      destructive: true, 
                                      prefix: <Icon source={AlertCircleIcon} tone="critical" />,
                                      onAction: () => handleDeleteConnection(connection)
                                    },
                                ]}
                              />
                            </Popover>
                          </InlineStack>
                          </InlineStack>
                      </Box>
                    </Card>
                    ))
                  ) : searchQuery ? (
                    <Box paddingBlockStart="400" paddingBlockEnd="400">
                      <Text as="p" tone="subdued">No API connections found matching "{searchQuery}".</Text>
                      <Button variant="plain" onClick={() => setSearchQuery('')}>
                        Clear search
                      </Button>
                    </Box>
                  ) : (
                    <Box paddingBlockStart="400" paddingBlockEnd="400">
                      <Text as="p" tone="subdued">No API connections found for this supplier.</Text>
                    </Box>
                  )
                ) : (
                  // CSV Connections
                  csvConnections.length > 0 ? (
                    csvConnections.map((connection) => (
                      <Card key={connection.id} background="bg-surface-secondary">
                      <Box padding="400">
                          <InlineStack align="space-between" blockAlign="start">
                            {/* Left side - Connection Info */}
                            <div style={{ flex: 1 }}>
                          <BlockStack gap="200">
                                {/* First Line - Title and File Info */}
                                <InlineStack gap="300" blockAlign="center">
                                  <div style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: '50%',
                                    background: '#16a34a',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}>
                                    <div style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: '50%',
                                      background: '#fff'
                                    }} />
                              </div>

                                  <div style={{ flex: 1, minWidth: 0 }}>
                                <Text variant="bodyLg" as="p" fontWeight="semibold">
                                      {connection.name || 'CSV Connection'}
                                </Text>
                                  </div>
                                  
                                  <div style={{ flexShrink: 0 }}>
                                    <InlineStack gap="100" blockAlign="center">
                                      <Icon source={ImportIcon} tone="subdued" />
                                      <Text as="span" variant="bodySm" tone="subdued">CSV</Text>
                                </InlineStack>
                              </div>
                            </InlineStack>

                                {/* Second Line - File Name */}
                                <Text as="p" variant="bodyMd" tone="subdued">
                                  {connection.csvFileName || 'No file name'}
                                </Text>

                                {/* Third Line - Upload Date and Last Activity */}
                                <InlineStack gap="300" blockAlign="center">
                                  <Text as="span" variant="bodySm" tone="subdued">
                                    Upload: {getTimeAgo(connection.createdAt)}
                                  </Text>
                                  <Text as="span" variant="bodySm" tone="subdued">
                                    Last activity: {getTimeAgo(connection.updatedAt)}
                                  </Text>
                                </InlineStack>
                          </BlockStack>
                            </div>

                            {/* Right side - Actions Menu (Limited for CSV) */}
                            <InlineStack gap="300" blockAlign="center">
                              {/* Actions Menu */}
                            <Popover
                                active={menuOpen[`csv${connection.id}`] || false}
                                onClose={() => setMenuOpen(prev => ({ ...prev, [`csv${connection.id}`]: false }))}
                              activator={
                                  <Button
                                    variant="plain"
                                    icon={MenuHorizontalIcon}
                                    onClick={() => setMenuOpen(prev => ({ ...prev, [`csv${connection.id}`]: !prev[`csv${connection.id}`] }))}
                                  />
                              }
                            >
                              <ActionList
                                items={[
                                    { 
                                      content: 'Delete Connection', 
                                      destructive: true, 
                                      prefix: <Icon source={AlertCircleIcon} tone="critical" />,
                                      onAction: () => handleDeleteConnection(connection)
                                    },
                                ]}
                              />
                            </Popover>
                          </InlineStack>
                          </InlineStack>
                        </Box>
                      </Card>
                    ))
                  ) : searchQuery ? (
                    <Box paddingBlockStart="400" paddingBlockEnd="400">
                      <Text as="p" tone="subdued">No CSV connections found matching "{searchQuery}".</Text>
                      <Button variant="plain" onClick={() => setSearchQuery('')}>
                        Clear search
                      </Button>
                    </Box>
                  ) : (
                    <Box paddingBlockStart="400" paddingBlockEnd="400">
                      <Text as="p" tone="subdued">No CSV connections found for this supplier.</Text>
                    </Box>
                  )
                )}
            </BlockStack>
          </BlockStack>
                      </Box>
                    </Card>

      {/* Schedule Modal */}
      <Modal
        open={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title={`Schedule Settings - ${selectedConnection?.name || 'Connection'}`}
        primaryAction={{
          content: 'Save Schedule',
          onAction: handleSaveSchedule,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setScheduleModalOpen(false),
          },
        ]}
        size="large"
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Checkbox
              label="Enable automatic sync for this connection"
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
                        { label: 'Hourly', value: 'hourly' },
                        { label: 'Daily', value: 'daily' },
                        { label: 'Weekly', value: 'weekly' },
                        { label: 'Test (5 minutes)', value: 'test' }
                      ]}
                      value={scheduleConfig.frequency}
                      onChange={(value) => 
                        setScheduleConfig(prev => ({ 
                          ...prev, 
                          frequency: value as 'hourly' | 'daily' | 'weekly' | 'test' 
                        }))
                      }
                    />
                  </Box>
                            </InlineStack>

                <Card background="bg-surface-secondary">
                  <Box padding="300">
                    <Text as="p" variant="bodySm">
                      {scheduleConfig.frequency === 'test' 
                        ? 'Next sync: Test run in 5 minutes'
                        : `Next sync: ${scheduleConfig.frequency} at ${scheduleConfig.time}`
                      }
                    </Text>
                      </Box>
                    </Card>
                  </BlockStack>
            )}
                </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Edit Connection Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit Connection - ${editingConnection?.name || 'Connection'}`}
        primaryAction={{
          content: 'Save Changes',
          onAction: handleSaveConnection,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setEditModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
                <BlockStack gap="400">
            <TextField
              label="Connection Name"
              value={editFormData.name}
              onChange={(value) => setEditFormData(prev => ({ ...prev, name: value }))}
              autoComplete="off"
            />
            
            <TextField
              label="API URL"
              value={editFormData.apiUrl}
              onChange={(value) => setEditFormData(prev => ({ ...prev, apiUrl: value }))}
              autoComplete="off"
            />
            
            <TextField
              label="Access Token"
              value={editFormData.accessToken}
              onChange={(value) => setEditFormData(prev => ({ ...prev, accessToken: value }))}
              type="password"
              autoComplete="off"
            />
            
            <TextField
              label="Supplier Name"
              value={editFormData.supplierName}
              onChange={(value) => setEditFormData(prev => ({ ...prev, supplierName: value }))}
              autoComplete="off"
            />
            
            <TextField
              label="Supplier Email"
              value={editFormData.supplierEmail}
              onChange={(value) => setEditFormData(prev => ({ ...prev, supplierEmail: value }))}
              type="email"
              autoComplete="off"
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Manual Sync Button - Commented Out */}
      {/* 
      <Layout.Section>
        <Card>
          <Box padding="400"> 
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack>
                  <Text as="h2" variant="headingMd">Manual Sync</Text>
                  <Text as="p" tone="subdued">
                    Manually sync all connections for {supplierName}
                  </Text>
                </BlockStack>
                <Button
                  variant="primary"
                  icon={CalendarIcon}
                  onClick={handleManualSync}
                >
                  Run Manual Sync
                </Button>
              </InlineStack>

              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" fontWeight="semibold">Test Cron Job (5 minutes)</Text>
                {testTimerActive ? (
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="p" tone="subdued">Next auto-sync in:</Text>
                    <Badge tone="info">{formatTimer(testTimer!)}</Badge>
                    <Button 
                      variant="plain" 
                      onClick={() => {
                        setTestTimer(null);
                        setTestTimerActive(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </InlineStack>
                ) : (
                  <Button 
                    variant="secondary" 
                    onClick={startTestTimer}
                    icon={ClockIcon}
                  >
                    Start 5-Minute Test Timer
                  </Button>
                )}
              </BlockStack>
            </BlockStack>
          </Box>
        </Card>
      </Layout.Section>
      */}
      </Page>
  );
};

export default ConnectionManagement;