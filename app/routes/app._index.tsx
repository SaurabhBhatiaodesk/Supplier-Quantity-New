import { useState, useEffect, useCallback } from 'react';
import { json, LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { authenticate } from '../shopify.server';
import {
  Page,
  Card,
  Layout,
  Badge,
  Button,
  ProgressBar,
  Text,
  Icon,
  Box,
  BlockStack,
  InlineStack,
  Divider,
  LegacyCard, Tabs
} from '@shopify/polaris';
import { CheckCircleIcon, ChevronRightIcon } from '@shopify/polaris-icons';

// Import step components
import SupplierListingStep from '../components/SupplierListingStep';
import SupplierDetailsStep from '../components/SupplierDetailsStep';
import ApiCredentialsStep from '../components/ApiCredentialsStep';
import KeyMappingStep from '../components/KeyMappingStep';
import ImportTypeStep from '../components/ImportTypeStep';
import ImportFilterStep from '../components/ImportFilterStep';
import MarkupConfigurationStep from '../components/MarkupConfigurationStep';
import ImportConfigurationStep from '../components/ImportConfigurationStep';
import ImportProcessStep from '../components/ImportProcessStep';
import CsvImportStep from '../components/CsvImportStep';
import ProgressSteps from '../components/ProgressSteps';
import AppCsvFile from '../components/AppCsvFile'; 
export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return null;
}

export default function Index() {
  type ImportType = 'all' | 'attribute';
  type DataSource = 'api' | 'csv';
  type ImportConfig = 'draft' | 'published';
  type MarkupCondition = {
    id: string;
    attribute: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between';
    value: string;
    markupType: 'percentage' | 'fixed';
    markupValue: string;
    priority: number;
  };
  type MarkupConfig = {
    conditions: MarkupCondition[];
    conditionsType: 'all' | 'any';
    tieBreaker: 'higher' | 'lower' | 'priority';
  };

  const [currentStep, setCurrentStep] = useState(1);
  const [showApiList, setShowApiList] = useState(false);
  const [showSupplierListing, setShowSupplierListing] = useState(true);
  const [showSupplierDetails, setShowSupplierDetails] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [editingApi, setEditingApi] = useState(null);
  const [dataSource, setDataSource] = useState<DataSource>('api');
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [apiCredentials, setApiCredentials] = useState({
    apiUrl: '',
    accessToken: ''
  });
  const [csvData, setCsvData] = useState<any>(null);
  const [keyMappings, setKeyMappings] = useState<Record<string, string>>({});
  const [importType, setImportType] = useState<ImportType>('all');
  const [importFilters, setImportFilters] = useState<{ selectedAttributes: string[]; selectedValues: string[] }>({
    selectedAttributes: [],
    selectedValues: []
  });
  const [markupConfig, setMarkupConfig] = useState<MarkupConfig>({
    conditions: [],
    conditionsType: 'any',
    tieBreaker: 'higher'
  });
  const [importConfig, setImportConfig] = useState<ImportConfig>('draft');
  const [isImporting, setIsImporting] = useState(false);
  const [productCount, setProductCount] = useState(0);

  // Data persistence keys
  const PERSISTENCE_KEYS = {
    CURRENT_STEP: 'import_current_step',
    DATA_SOURCE: 'import_data_source',
    API_CREDENTIALS: 'import_api_credentials',
    CSV_DATA: 'import_csv_data',
    KEY_MAPPINGS: 'import_key_mappings',
    IMPORT_TYPE: 'import_import_type',
    IMPORT_FILTERS: 'import_filters',
    MARKUP_CONFIG: 'import_markup_config',
    IMPORT_CONFIG: 'import_config',
    SELECTED_SUPPLIER: 'import_selected_supplier',
    EDITING_API: 'import_editing_api'
  };

  // Save state to localStorage
  const saveState = (key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.log('❌ Error saving state to localStorage:', error);
    }
  };

  // Load state from localStorage
  const loadState = (key: string, defaultValue: any) => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch (error) {
      console.log('❌ Error loading state from localStorage:', error);
      return defaultValue;
    }
  };

  // Initialize state from localStorage
  useEffect(() => {
    console.log('🔍 Initializing state from localStorage...');
    
    // Load all states
    const savedCurrentStep = loadState(PERSISTENCE_KEYS.CURRENT_STEP, 1);
    const savedDataSource = loadState(PERSISTENCE_KEYS.DATA_SOURCE, 'api');
    const savedApiCredentials = loadState(PERSISTENCE_KEYS.API_CREDENTIALS, { apiUrl: '', accessToken: '' });
    const savedCsvData = loadState(PERSISTENCE_KEYS.CSV_DATA, null);
    const savedKeyMappings = loadState(PERSISTENCE_KEYS.KEY_MAPPINGS, {});
    const savedImportType = loadState(PERSISTENCE_KEYS.IMPORT_TYPE, 'all');
    const savedImportFilters = loadState(PERSISTENCE_KEYS.IMPORT_FILTERS, { selectedAttributes: [], selectedValues: [] });
    const savedMarkupConfig = loadState(PERSISTENCE_KEYS.MARKUP_CONFIG, { conditions: [], conditionsType: 'any', tieBreaker: 'higher' });
    const savedImportConfig = loadState(PERSISTENCE_KEYS.IMPORT_CONFIG, 'draft');
    const savedSelectedSupplier = loadState(PERSISTENCE_KEYS.SELECTED_SUPPLIER, null);
    const savedEditingApi = loadState(PERSISTENCE_KEYS.EDITING_API, null);

    // Set states
    setCurrentStep(savedCurrentStep);
    setDataSource(savedDataSource);
    setApiCredentials(savedApiCredentials);
    setCsvData(savedCsvData);
    setKeyMappings(savedKeyMappings);
    setImportType(savedImportType);
    setImportFilters(savedImportFilters);
    setMarkupConfig(savedMarkupConfig);
    setImportConfig(savedImportConfig);
    setSelectedSupplier(savedSelectedSupplier);
    setEditingApi(savedEditingApi);

    console.log('✅ State restored from localStorage');
  }, []);

  // Persist state changes
  useEffect(() => {
    saveState(PERSISTENCE_KEYS.CURRENT_STEP, currentStep);
  }, [currentStep]);

  useEffect(() => {
    saveState(PERSISTENCE_KEYS.DATA_SOURCE, dataSource);
  }, [dataSource]);

  useEffect(() => {
    saveState(PERSISTENCE_KEYS.API_CREDENTIALS, apiCredentials);
  }, [apiCredentials]);

  useEffect(() => {
    saveState(PERSISTENCE_KEYS.CSV_DATA, csvData);
  }, [csvData]);

  useEffect(() => {
    saveState(PERSISTENCE_KEYS.KEY_MAPPINGS, keyMappings);
  }, [keyMappings]);

  useEffect(() => {
    saveState(PERSISTENCE_KEYS.IMPORT_TYPE, importType);
  }, [importType]);

  useEffect(() => {
    saveState(PERSISTENCE_KEYS.IMPORT_FILTERS, importFilters);
  }, [importFilters]);

  useEffect(() => {
    saveState(PERSISTENCE_KEYS.MARKUP_CONFIG, markupConfig);
  }, [markupConfig]);

  useEffect(() => {
    saveState(PERSISTENCE_KEYS.IMPORT_CONFIG, importConfig);
  }, [importConfig]);

  useEffect(() => {
    saveState(PERSISTENCE_KEYS.SELECTED_SUPPLIER, selectedSupplier);
  }, [selectedSupplier]);

  useEffect(() => {
    saveState(PERSISTENCE_KEYS.EDITING_API, editingApi);
  }, [editingApi]);

  // Clear all persisted data
  const clearAllPersistedData = () => {
    Object.values(PERSISTENCE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    localStorage.removeItem('csvData'); // Legacy key
    
    // Reset all states
    setCurrentStep(1);
    setDataSource('api');
    setApiCredentials({ apiUrl: '', accessToken: '' });
    setCsvData(null);
    setKeyMappings({});
    setImportType('all');
    setImportFilters({ selectedAttributes: [], selectedValues: [] });
    setMarkupConfig({ conditions: [], conditionsType: 'any', tieBreaker: 'higher' });
    setImportConfig('draft');
    setSelectedSupplier(null);
    setEditingApi(null);
    
    console.log('🧹 All persisted data manually cleared');
  };

  // Clear any test data and ensure real CSV data
  useEffect(() => {
    if (dataSource === 'csv') {
      const savedData = localStorage.getItem('csvData');
      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData);
          // If it's test data, clear it
          if (parsedData.fileName === 'test.csv') {
            console.log('🧹 Clearing test CSV data from localStorage');
            localStorage.removeItem('csvData');
            setCsvData(null);
          }
        } catch (error) {
          console.log('❌ Error checking localStorage data:', error);
        }
      }
    }
  }, [dataSource]);

  // Preserve csvData during navigation
  useEffect(() => {
    if (dataSource === 'csv' && csvData && currentStep >= 2) {
      console.log('🔍 CSV data preserved during navigation:', csvData);
    }
  }, [currentStep, dataSource, csvData]);

  // Ensure CSV data persists across steps
  useEffect(() => {
    if (dataSource === 'csv' && csvData) {
      console.log('🔍 Ensuring CSV data persistence:', csvData);
      // Store in localStorage as backup
      localStorage.setItem('csvData', JSON.stringify(csvData));
    }
  }, [csvData, dataSource]);

  // Restore CSV data if lost
  useEffect(() => {
    if (dataSource === 'csv' && !csvData && currentStep >= 2) {
      const savedCsvData = localStorage.getItem('csvData');
      if (savedCsvData) {
        try {
          const parsedData = JSON.parse(savedCsvData);
          console.log('🔍 Restoring CSV data from localStorage:', parsedData);
          setCsvData(parsedData);
        } catch (error) {
          console.log('❌ Error restoring CSV data:', error);
        }
      }
    }
  }, [dataSource, csvData, currentStep]);

  // Debug useEffect to track csvData changes
  useEffect(() => {
    console.log('🔍 csvData changed:', csvData);
    console.log('🔍 Current step:', currentStep);
    console.log('🔍 Data source:', dataSource);
  }, [csvData, currentStep, dataSource]);

  // Immediate data restoration for any step
  useEffect(() => {
    if (dataSource === 'csv' && !csvData && currentStep >= 2) {
      const savedCsvData = localStorage.getItem('csvData');
      if (savedCsvData) {
        try {
          const parsedData = JSON.parse(savedCsvData);
          // Don't restore test data
          if (parsedData.fileName !== 'test.csv') {
            console.log(`🔍 Immediate restore for Step ${currentStep}:`, parsedData);
            setCsvData(parsedData);
          }
        } catch (error) {
          console.log(`❌ Error immediate restore for Step ${currentStep}:`, error);
        }
      }
    }
  }, [currentStep, dataSource, csvData]);

  const steps = [
    { number: 1, title: 'Data Source', description: 'Choose API or CSV import' },
    { number: 2, title: 'Import Configuration', description: 'Configure import settings' },
    { number: 3, title: 'Key Mapping', description: 'Map data fields to Shopify keys' },
    { number: 4, title: 'Import Filters', description: 'Filter products to import' },
    { number: 5, title: 'Markup Configuration', description: 'Configure pricing markup rules' },
    { number: 6, title: 'Import Settings', description: 'Choose draft vs published import' },
    { number: 7, title: 'Import Process', description: 'Start importing products' }
  ];

  const handleNextStep = () => {
    if (currentStep < 7) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      
      // If moving to any step and CSV data is missing, restore it
      if (dataSource === 'csv' && !csvData) {
        const savedCsvData = localStorage.getItem('csvData');
        if (savedCsvData) {
          try {
            const parsedData = JSON.parse(savedCsvData);
            console.log(`🔍 Restoring CSV data for Step ${nextStep}:`, parsedData);
            setCsvData(parsedData);
          } catch (error) {
            console.log(`❌ Error restoring CSV data for Step ${nextStep}:`, error);
          }
        }
      }
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleAddNewApi = () => {
    setShowApiList(false);
    setShowSupplierListing(false);
    setShowSupplierDetails(false);
    setEditingApi(null);
    setApiCredentials({ apiUrl: '', accessToken: '' });
  };

  const handleEditApi = (api:any) => {
    setShowApiList(false);
    setShowSupplierListing(false);
    setShowSupplierDetails(false);
    setEditingApi(api);
    setApiCredentials({ apiUrl: api.url, accessToken: '' });
  };

  const handleGoToApiList = () => {
    setShowApiList(true);
    setShowSupplierListing(false);
    setShowSupplierDetails(false);
    setEditingApi(null);
  };

  const handleSupplierClick = (supplier: any) => {
    setSelectedSupplier(supplier);
    setShowSupplierListing(false);
    setShowSupplierDetails(true);
    setShowApiList(false);
  };

  const handleGoBackToSupplierListing = () => {
    setShowSupplierListing(true);
    setShowSupplierDetails(false);
    setSelectedSupplier(null);
    setShowApiList(false);
  };

  const handleAddNewSupplier = () => {
    handleAddNewApi();
  };

  const handleAddNewConnection = (supplier: any) => {
    setSelectedSupplier(supplier);
    handleAddNewApi();
  };

  const handleCompleteImport = () => {
    setCurrentStep(1);
    setShowSupplierListing(true);
    setShowApiList(false);
    setShowSupplierDetails(false);
    setSelectedSupplier(null);
    setEditingApi(null);
    setIsImporting(false);
    setShowCsvImport(false);
    setDataSource('api');
    setApiCredentials({ apiUrl: '', accessToken: '' });
    setCsvData(null);
    setKeyMappings({});
    setImportFilters({ selectedAttributes: [], selectedValues: [] });
    setMarkupConfig({ conditions: [], conditionsType: 'any', tieBreaker: 'higher' });
    setImportConfig('draft');
    setProductCount(0);
    
    // Clear all persisted data
    Object.values(PERSISTENCE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    localStorage.removeItem('csvData'); // Legacy key
    
    console.log('🧹 All persisted data cleared');
  };

  const handleImportCsv = () => {
    setShowCsvImport(true);
    setShowApiList(false);
    setShowSupplierListing(false);
    setShowSupplierDetails(false);
  };

  const handleCsvImported = (data:any) => {
    console.log('🔍 handleCsvImported called with data:', data);
    
    // Ensure data is properly structured
    const csvDataToSet = {
      fileName: data.fileName,
      headers: data.headers || [],
      rows: data.rows || [],
      totalRows: data.totalRows || 0,
      processedAt: data.processedAt || new Date().toISOString()
    };
    
    console.log('🔍 Setting CSV data:', csvDataToSet);
    setCsvData(csvDataToSet);
    setDataSource('csv');
    
    // Store in localStorage immediately
    localStorage.setItem('csvData', JSON.stringify(csvDataToSet));
    
    // Verify data was set correctly
    setTimeout(() => {
      console.log('🔍 Verifying CSV data after upload:', csvDataToSet);
      console.log('🔍 Current csvData state:', csvData);
      console.log('🔍 localStorage data:', localStorage.getItem('csvData'));
    }, 100);
    
    setShowCsvImport(false);
    setShowApiList(false);
    setShowSupplierListing(false);
    setShowSupplierDetails(false);
    setCurrentStep(2);
  };



  const handleGoBackToApiList = () => {
    setShowCsvImport(false);
    if (showSupplierDetails && selectedSupplier) {
      setShowSupplierDetails(true);
    } else {
      setShowSupplierListing(true);
    }
  };

  const getStepIcon = (stepNumber:any) => {
    if (stepNumber < currentStep) {
      return <Icon source={CheckCircleIcon} tone="success" />;
    }
    return null;
  };

  const getCurrentStepInfo = () => {
    return steps.find(step => step.number === currentStep);
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        if (showSupplierListing) {
          return (
            <SupplierListingStep
              onSupplierClick={handleSupplierClick}
              onAddNewSupplier={handleAddNewSupplier}
            />
          );
        } else if (showSupplierDetails && selectedSupplier) {
          return (
            <SupplierDetailsStep
              supplier={selectedSupplier}
              onGoBack={handleGoBackToSupplierListing}
              onAddNewConnection={handleAddNewConnection}
            />
          );
        } else if (showCsvImport) {
          return (
            <CsvImportStep
              onCsvImported={handleCsvImported}
              onGoBack={handleGoBackToApiList}
            />
          );
        } else {
          return (
            <ApiCredentialsStep
              credentials={apiCredentials}
              onCredentialsChange={setApiCredentials}
              onNext={selectedSupplier ? () => setShowSupplierDetails(true) : (editingApi ? handleGoToApiList : handleNextStep)}
              onGoToList={handleGoBackToSupplierListing}
              editingApi={editingApi}
              onConnectionTypeChange={(type) => setDataSource(type)}
            />
          );
        }
      case 2:
        return (
          <>
            {/* Ensure CSV data is available for Step 2 */}
            {dataSource === 'csv' && !csvData && (() => {
              const savedCsvData = localStorage.getItem('csvData');
              if (savedCsvData) {
                try {
                  const parsedData = JSON.parse(savedCsvData);
                  console.log('🔍 Immediate restore for Step 2:', parsedData);
                  setCsvData(parsedData);
                } catch (error) {
                  console.log('❌ Error immediate restore for Step 2:', error);
                }
              }
              return null;
            })()}
            
            <ImportTypeStep
              importType={importType}
              onImportTypeChange={setImportType}
              csvData={csvData}
              dataSource={dataSource}
              onNext={handleNextStep}
              onPrevious={handlePreviousStep}
            />
          </>
        );
      case 3:
        return (
          <>
            {/* Ensure CSV data is available for Step 3 */}
            {dataSource === 'csv' && !csvData && (() => {
              const savedCsvData = localStorage.getItem('csvData');
              if (savedCsvData) {
                try {
                  const parsedData = JSON.parse(savedCsvData);
                  console.log('🔍 Immediate restore for Step 3:', parsedData);
                  setCsvData(parsedData);
                } catch (error) {
                  console.log('❌ Error immediate restore for Step 3:', error);
                }
              }
              return null;
            })()}
            
            <KeyMappingStep
              mappings={keyMappings}
              onMappingsChange={setKeyMappings}
              dataSource={dataSource}
              apiCredentials={apiCredentials}
              csvData={csvData}
              onNext={handleNextStep}
              onPrevious={handlePreviousStep}
            />

          </>
        );
      case 4:
        return (
          <ImportFilterStep
            filters={importFilters}
            onFiltersChange={(next) => setImportFilters(next)}
            importType={importType}
            dataSource={dataSource}
            apiCredentials={apiCredentials}
            csvData={csvData}
            mappings={keyMappings}
            onNext={handleNextStep}
            onPrevious={handlePreviousStep}
            onProductCountChange={setProductCount}
          />
        );
      case 5:
        return (
          <MarkupConfigurationStep
            apiCredentials={apiCredentials}
            onNext={handleNextStep}
            onPrevious={handlePreviousStep}
            value={{
              conditions: (markupConfig.conditions || []).map((c) => {
                const operatorMap: Record<string, string> = {
                  equals: 'eq',
                  contains: 'contains',
                  greater_than: 'gt',
                  less_than: 'lt',
                  between: 'between',
                };
                const mappedOperator = operatorMap[c.operator] || 'eq';
                const isPercent = c.markupType === 'percentage';
                const presetCandidates = ['10','15','20','25','30','50'];
                const isPreset = isPercent && presetCandidates.includes(c.markupValue);
                return {
                  id: c.id,
                  field: c.attribute || 'tag',
                  operator: mappedOperator,
                  tagText: c.value || '',
                  markupType: isPercent ? 'percent' : 'fixed',
                  percentagePreset: isPercent ? (isPreset ? c.markupValue : 'custom') : '10',
                  customPercent: isPercent ? (isPreset ? '' : c.markupValue) : '',
                  value: isPercent ? (isPreset ? c.markupValue : (c.markupValue || '')) : (c.markupValue || '0'),
                } as any;
              }),
              conditionsType: markupConfig.conditionsType,
              tieBreaker: markupConfig.tieBreaker,
            }}
            selectedFiltersSummary={(() => {
              const attrSet = new Set(importFilters?.selectedAttributes || []);
              const map = new Map<string, Set<string>>();
              // Initialize all selected attributes with empty sets
              for (const a of attrSet) {
                map.set(a, new Set<string>());
              }
              // Fill values from selectedValues tokens
              for (const token of (importFilters?.selectedValues || [])) {
                const [key, val] = token.split('::');
                if (!key) continue;
                if (!map.has(key)) map.set(key, new Set<string>());
                if (val) map.get(key)!.add(val);
              }
              // Convert to array format
              return Array.from(map.entries()).map(([key, set]) => ({ key, values: Array.from(set) }));
            })()}
            availableTags={(() => {
              // Extract all available tags from selected filters
              const allTags: string[] = [];
              const attrSet = new Set(importFilters?.selectedAttributes || []);
              const map = new Map<string, Set<string>>();
              
              // Initialize all selected attributes with empty sets
              for (const a of attrSet) {
                map.set(a, new Set<string>());
              }
              
              // Fill values from selectedValues tokens
              for (const token of (importFilters?.selectedValues || [])) {
                const [key, val] = token.split('::');
                if (!key) continue;
                if (!map.has(key)) map.set(key, new Set<string>());
                if (val) map.get(key)!.add(val);
              }
              
              // Extract tags from all attributes
              for (const [key, set] of map.entries()) {
                allTags.push(...Array.from(set));
              }
              
              return allTags;
            })()}
            onChange={(cfg) => {
              setMarkupConfig({
                conditions: (cfg?.conditions ?? []).map((c, idx) => ({
                  id: c.id || String(idx),
                  attribute: (c as any).field || 'tag',
                  operator: ((): any => {
                    const rev: Record<string, any> = { 
                      eq: 'equals', 
                      contains: 'contains',
                      gt: 'greater_than',
                      lt: 'less_than',
                      between: 'between'
                    };
                    return rev[(c as any).operator] || 'equals';
                  })(),
                  value: (c as any).tagText ?? '',
                  markupType: ((c as any).markupType === 'percent' ? 'percentage' : 'fixed') as any,
                  markupValue: ((): string => {
                    if ((c as any).markupType === 'percent') {
                      return (c as any).percentagePreset === 'custom' ? ((c as any).customPercent || '0') : ((c as any).percentagePreset || '0');
                    }
                    return (c as any).value || '0';
                  })(),
                  priority: idx + 1,
                })),
                conditionsType: cfg?.conditionsType ?? 'any',
                tieBreaker: markupConfig.tieBreaker,
              });
            }}
          />
        );
      case 6:
        return (
          <ImportConfigurationStep
            config={importConfig}
            onConfigChange={setImportConfig}
            onNext={handleNextStep}
            onPrevious={handlePreviousStep}
          />
        );
      case 7:
        return (
          <ImportProcessStep
            dataSource={dataSource}
            apiCredentials={apiCredentials}
            csvData={csvData}
            keyMappings={keyMappings}
            importFilters={importFilters}
            markupConfig={markupConfig}
            importConfig={importConfig}
            productCount={productCount}
          />
        );
      default:
        return null;
    }
  };

  const currentStepInfo = getCurrentStepInfo();
  const progressValue = Math.round((currentStep / 7) * 100);

  const getPageTitle = () => {
    if (currentStep === 1 && showSupplierListing) {
      return 'Supplier Management Dashboard';
    } else if (currentStep === 1 && showSupplierDetails) {
      return 'Supplier Connection Details';
    } else if (currentStep === 1 && showCsvImport) {
      return 'CSV Import';
    } else {
      return `Step ${currentStep} of ${steps.length}: ${currentStepInfo?.title}`;
    }
  };

  const [selected, setSelected] = useState(0);

  const handleTabChange = useCallback(
    (selectedTabIndex:any) => setSelected(selectedTabIndex),
    []
  );
 
  const tabs = [
    {
      id: "supplier-directory",
      content: "Supplier Directory",
      panelID: "supplier-directory-content",
    },
    {
      id: "stock-adjustment",
      content: "Stock Adjustment",
      panelID: "stock-adjustment-content",
    },
  ];

  return (
    <Page
      title="Product Import Manager"
      subtitle="Import products from external APIs to your Shopify store"
      primaryAction={{
        content: `Step ${currentStep} of 7`,
        disabled: true
      }}
    >
  <Tabs tabs={tabs} selected={selected} onSelect={handleTabChange}>
        <Layout>
          {selected === 0 && (
            <>
              {/* Progress Steps - Hide when on supplier management screens */}
              {!(currentStep === 1 &&
                (showSupplierListing || showSupplierDetails || showCsvImport)) && (
                <Layout.Section>
                  <ProgressSteps currentStep={currentStep} steps={steps} />
                </Layout.Section>
              )}

              {/* Current Step Content */}
              <Layout.Section>{renderCurrentStep()}</Layout.Section>
            </>
          )}

          {selected === 1 && (
            <Layout.Section>
              <AppCsvFile />
            </Layout.Section>
          )}
        </Layout>
      </Tabs>

    </Page>
  );
}