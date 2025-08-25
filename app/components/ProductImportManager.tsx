import { useState } from 'react';
import { Page, Layout, Badge } from '@shopify/polaris';
import { IMPORT_STEPS, INITIAL_STATE } from '../constants/importSteps';
import { createNavigationHelpers } from '../utils/navigationHelpers';
import ProgressSteps from './ProgressSteps';
import StepRenderer from './StepRenderer';

export default function ProductImportManager() {
  const [state, setState] = useState(INITIAL_STATE);
  
  const navigationHelpers = createNavigationHelpers(setState);

  const handleCompleteImport = () => {
    setState(INITIAL_STATE);
  };

  const handleCsvImported = (data: any) => {
    setState(prev => ({
      ...prev,
      csvData: data,
      dataSource: 'csv',
      showCsvImport: false,
      showApiList: false,
      showSupplierListing: false,
      showSupplierDetails: false,
      currentStep: 2
    }));
  };

  const getPageTitle = () => {
    if (state.currentStep === 1 && state.showSupplierListing) {
      return 'Supplier Management Dashboard';
    } else if (state.currentStep === 1 && state.showSupplierDetails) {
      return 'Supplier Connection Details';
    } else if (state.currentStep === 1 && state.showCsvImport) {
      return 'CSV Import';
    } else {
      const currentStepInfo = IMPORT_STEPS.find(step => step.number === state.currentStep);
      return `Step ${state.currentStep} of ${IMPORT_STEPS.length}: ${currentStepInfo?.title}`;
    }
  };

  const showProgressSteps = !(state.currentStep === 1 && (
    state.showSupplierListing || state.showSupplierDetails || state.showCsvImport
  ));

  return (
    <Page
      title="Product Import Manager"
      subtitle="Import products from external APIs to your Shopify store"
      primaryAction={{
        content: `Step ${state.currentStep} of ${IMPORT_STEPS.length}`,
        disabled: true
      }}
    >
      <Layout>
        {showProgressSteps && (
          <Layout.Section>
            <ProgressSteps currentStep={state.currentStep} steps={IMPORT_STEPS} />
          </Layout.Section>
        )}

        <Layout.Section>
          <StepRenderer
            state={state}
            setState={setState}
            navigationHelpers={navigationHelpers}
            onCompleteImport={handleCompleteImport}
            onCsvImported={handleCsvImported}
          />
        </Layout.Section>
      </Layout>
    </Page>
  );
}