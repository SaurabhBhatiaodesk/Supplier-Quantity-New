export const IMPORT_STEPS = [
  { number: 1, title: 'Data Source', description: 'Choose API or CSV import' },
  { number: 2, title: 'Import Configuration', description: 'Configure import settings' },
  { number: 3, title: 'Key Mapping', description: 'Map data fields to Shopify keys' },
  { number: 4, title: 'Import Filters', description: 'Filter products to import' },
  { number: 5, title: 'Markup Configuration', description: 'Configure pricing markup rules' },
  { number: 6, title: 'Import Settings', description: 'Choose draft vs published import' },
  { number: 7, title: 'Import Process', description: 'Start importing products' }
];

export const INITIAL_STATE = {
  currentStep: 1,
  showApiList: false,
  showSupplierListing: true,
  showSupplierDetails: false,
  selectedSupplier: null,
  editingApi: null,
  dataSource: 'api',
  showCsvImport: false,
  apiCredentials: { apiUrl: '', accessToken: '' },
  csvData: null,
  keyMappings: {},
  importType: 'all',
  importFilters: { selectedAttributes: [], selectedValues: [] },
  markupConfig: { conditions: [], conditionsType: 'all', tieBreaker: 'higher' },
  importConfig: 'draft',
  isImporting: false,
  productCount: 0
};