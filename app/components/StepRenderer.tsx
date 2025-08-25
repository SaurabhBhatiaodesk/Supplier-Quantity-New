import SupplierListingStep from './SupplierListingStep';
import SupplierDetailsStep from './SupplierDetailsStep';
import ApiCredentialsStep from './ApiCredentialsStep';
import KeyMappingStep from './KeyMappingStep';
import ImportTypeStep from './ImportTypeStep';
import ImportFilterStep from './ImportFilterStep';
import MarkupConfigurationStep from './MarkupConfigurationStep';
import ImportConfigurationStep from './ImportConfigurationStep';
import ImportProcessStep from './ImportProcessStep';
import CsvImportStep from './CsvImportStep';

interface StepRendererProps {
  state: any;
  setState: any;
  navigationHelpers: any;
  onCompleteImport: () => void;
  onCsvImported: (data: any) => void;
}

export default function StepRenderer({ 
  state, 
  setState, 
  navigationHelpers, 
  onCompleteImport,
  onCsvImported 
}: StepRendererProps) {
  const {
    handleNextStep,
    handlePreviousStep,
    handleAddNewApi,
    handleSupplierClick,
    handleGoBackToSupplierListing
  } = navigationHelpers;

  const handleAddNewSupplier = () => {
    handleAddNewApi();
  };

  const handleAddNewConnection = (supplier: any) => {
    setState((prev: any) => ({ ...prev, selectedSupplier: supplier }));
    handleAddNewApi();
  };

  switch (state.currentStep) {
    case 1:
      if (state.showSupplierListing) {
        return (
          <SupplierListingStep
            onSupplierClick={handleSupplierClick}
            onAddNewSupplier={handleAddNewSupplier}
          />
        );
      } else if (state.showSupplierDetails && state.selectedSupplier) {
        return (
          <SupplierDetailsStep
            supplier={state.selectedSupplier}
            onGoBack={handleGoBackToSupplierListing}
            onAddNewConnection={handleAddNewConnection}
          />
        );
      } else if (state.showCsvImport) {
        return (
          <CsvImportStep
            onCsvImported={onCsvImported}
            onGoBack={() => setState((prev:any) => ({ 
              ...prev, 
              showCsvImport: false,
              showSupplierListing: true 
            }))}
          />
        );
      } else {
        return (
          <ApiCredentialsStep
            credentials={state.apiCredentials}
            onCredentialsChange={(creds: any) => 
              setState((prev: any) => ({ ...prev, apiCredentials: creds }))
            }
            onNext={() => handleNextStep(state.currentStep)}
            onGoToList={handleGoBackToSupplierListing}
            editingApi={state.editingApi}
          />
        );
      }
    case 2:
      return (
        <ImportTypeStep
          importType={state.importType}
          onImportTypeChange={(type: string) => 
            setState((prev: any) => ({ ...prev, importType: type }))
          }
          onNext={() => handleNextStep(state.currentStep)}
          onPrevious={() => handlePreviousStep(state.currentStep)}
        />
      );
    case 3:
      return (
        <KeyMappingStep
          mappings={state.keyMappings}
          onMappingsChange={(mappings: any) => 
            setState((prev: any) => ({ ...prev, keyMappings: mappings }))
          }
          dataSource={state.dataSource}
          apiCredentials={state.apiCredentials}
          csvData={state.csvData}
          onNext={() => handleNextStep(state.currentStep)}
          onPrevious={() => handlePreviousStep(state.currentStep)}
        />
      );
    case 4:
      return (
        <ImportFilterStep
          filters={state.importFilters}
          onFiltersChange={(filters: any) => 
            setState((prev: any) => ({ ...prev, importFilters: filters }))
          }
          importType={state.importType}
          dataSource={state.dataSource}
          apiCredentials={state.apiCredentials}
          csvData={state.csvData}
          onNext={() => handleNextStep(state.currentStep)}
          onPrevious={() => handlePreviousStep(state.currentStep)}
          onProductCountChange={(count: number) => 
            setState((prev: any) => ({ ...prev, productCount: count }))
          }
        />
      );
    case 5:
      return (
        <MarkupConfigurationStep
          value={state.markupConfig}
          onChange={(config: any) => 
            setState((prev: any) => ({ ...prev, markupConfig: config }))
          }
          apiCredentials={state.apiCredentials}
          onNext={() => handleNextStep(state.currentStep)}
          onPrevious={() => handlePreviousStep(state.currentStep)}
        />
      );
    case 6:
      return (
        <ImportConfigurationStep
          config={state.importConfig}
          onConfigChange={(config: string) => 
            setState((prev: any) => ({ ...prev, importConfig: config }))
          }
          onNext={() => handleNextStep(state.currentStep)}
          onPrevious={() => handlePreviousStep(state.currentStep)}
        />
      );
    case 7:
      return (
        <ImportProcessStep
          dataSource={state.dataSource}
          apiCredentials={state.apiCredentials}
          csvData={state.csvData}
          keyMappings={state.keyMappings}
          importFilters={state.importFilters}
          markupConfig={state.markupConfig}
          importConfig={state.importConfig}
          productCount={state.productCount}
        />
      );
    default:
      return null;
  }
}