import { useState } from 'react';
import { useFetcher } from '@remix-run/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

import { 
  FileText,
  CheckCircle,
  Plus,
  Settings,
  XCircle,
  AlertCircle,
  Database,
  List
} from 'lucide-react';

interface ApiListStepProps {
  onAddNew: () => void;
  onEdit: (api: any) => void;
  onNext: () => void;
  dataSource: string;
  onDataSourceChange: (source: string) => void;
  csvData: any;
  onCsvDataChange: (data: any) => void;
  onImportCsv: () => void;
  shop: string;
}

export default function ApiListStep({ 
  onAddNew, 
  onEdit, 
  onNext, 
  dataSource, 
  onDataSourceChange, 
  csvData, 
  onCsvDataChange,
  onImportCsv,
  shop
}: ApiListStepProps) {
  const fetcher = useFetcher();
  
  // Mock data - in real implementation, this would come from the database
  const [apis] = useState([
    {
      id: 1,
      name: 'Premium Suppliers API',
      url: 'https://api.premiumsuppliers.com/v2',
      status: 'connected',
      lastSync: '2 hours ago',
      productCount: 1247,
      scheduledTime: '09:00'
    },
    {
      id: 2,
      name: 'Global Wholesale API',
      url: 'https://api.globalwholesale.net/products',
      status: 'error',
      lastSync: '1 day ago',
      productCount: 892,
      scheduledTime: null
    }
  ]);



  const canProceed = () => {
    return apis.some(api => api.status === 'connected');
  };

  // Mock API data headers - in real implementation, this would come from API response
  const apiDataHeaders = [
    'id', 'name', 'title', 'description', 'price', 'sku', 'category', 
    'brand', 'vendor', 'tags', 'images', 'variants', 'inventory_quantity',
    'weight', 'dimensions', 'barcode', 'status', 'created_at', 'updated_at'
  ];

  return (
    <div className="space-y-6">
      {/* API Data Information - Similar to CSV File Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            API Data Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">✅ Data Retrieved Successfully</span>
            </div>
            
            <div className="space-y-2">
              <div>
                <span className="font-medium text-sm text-gray-700">API Source</span>
                <p className="text-sm text-gray-900">Premium Suppliers API</p>
              </div>
              
              <div>
                <span className="font-medium text-sm text-gray-700">Total Products</span>
                <p className="text-sm text-gray-900">{apis.reduce((total, api) => total + (api.productCount || 0), 0)} products</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detected Fields - Similar to CSV Headers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="w-5 h-5" />
            Detected Fields (Available for Mapping)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {apiDataHeaders.map((header, index) => (
              <Badge key={index} className="text-xs bg-gray-100 text-gray-800 border border-gray-200">
                {header}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-900">Connected</span>
          </div>
          <div className="text-xl font-medium text-green-700">
            {apis.filter(api => api.status === 'connected').length}
          </div>
        </div>
        
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-900">Disconnected</span>
          </div>
          <div className="text-xl font-medium text-gray-700">
            {apis.filter(api => api.status === 'disconnected').length}
          </div>
        </div>
        
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-900">Errors</span>
          </div>
          <div className="text-xl font-medium text-red-700">
            {apis.filter(api => api.status === 'error').length}
          </div>
        </div>
      </div>

      {/* API Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Connections</CardTitle>
              <CardDescription>
                Manage your supplier API connections
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={onImportCsv}   className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Import CSV
              </Button>
              <Button onClick={onAddNew} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add New API
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {apis.length > 0 ? (
            <div className="space-y-4">
              {apis.map((api) => (
                <div key={api.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className={`w-3 h-3 rounded-full ${
                        api.status === 'connected' ? 'bg-green-500' :
                        api.status === 'error' ? 'bg-red-500' : 'bg-gray-400'
                      }`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">{api.name}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{api.url}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>Last sync: {api.lastSync}</span>
                        <span>Products: {api.productCount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <Button  
                    onClick={() => onEdit(api)}
                  >
                    Edit
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Settings className="w-8 h-8 mx-auto mb-4 text-gray-300" />
              <p className="text-sm mb-2">No APIs connected yet</p>
              <p className="text-xs">Click "Add New API" to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Continue Button */}
      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!canProceed()}>
          Continue to Import Configuration
        </Button>
      </div>
    </div>
  );
}