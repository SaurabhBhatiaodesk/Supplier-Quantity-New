export const createNavigationHelpers = (setState: any) => {
  const handleNextStep = (currentStep: number) => {
    if (currentStep < 7) {
      setState((prev: any) => ({ ...prev, currentStep: currentStep + 1 }));
    }
  };

  const handlePreviousStep = (currentStep: number) => {
    if (currentStep > 1) {
      setState((prev: any) => ({ ...prev, currentStep: currentStep - 1 }));
    }
  };

  const handleAddNewApi = () => {
    setState((prev: any) => ({
      ...prev,
      showApiList: false,
      showSupplierListing: false,
      showSupplierDetails: false,
      editingApi: null,
      apiCredentials: { apiUrl: '', accessToken: '' }
    }));
  };

  const handleGoToApiList = () => {
    setState((prev: any) => ({
      ...prev,
      showApiList: true,
      showSupplierListing: false,
      showSupplierDetails: false,
      editingApi: null
    }));
  };

  const handleSupplierClick = (supplier: any) => {
    setState((prev: any) => ({
      ...prev,
      selectedSupplier: supplier,
      showSupplierListing: false,
      showSupplierDetails: true,
      showApiList: false
    }));
  };

  const handleGoBackToSupplierListing = () => {
    setState((prev: any) => ({
      ...prev,
      showSupplierListing: true,
      showSupplierDetails: false,
      selectedSupplier: null,
      showApiList: false
    }));
  };

  return {
    handleNextStep,
    handlePreviousStep,
    handleAddNewApi,
    handleGoToApiList,
    handleSupplierClick,
    handleGoBackToSupplierListing
  };
};