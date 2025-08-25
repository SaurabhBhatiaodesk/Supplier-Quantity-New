export const MOCK_SUPPLIERS = [
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
    connectionTypes: ['api', 'csv']
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
    connectionTypes: ['api']
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
    connectionTypes: ['csv']
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
    connectionTypes: ['api']
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
    connectionTypes: ['csv']
  }
];

export const MOCK_ATTRIBUTES = [
  {
    name: 'Category',
    values: ['Electronics', 'Clothing', 'Home & Garden', 'Sports', 'Books', 'Toys']
  },
  {
    name: 'Brand',
    values: ['Apple', 'Samsung', 'Nike', 'Adidas', 'Sony', 'Microsoft', 'Dell', 'HP']
  },
  {
    name: 'Color',
    values: ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Pink', 'Purple']
  },
  {
    name: 'Size',
    values: ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  },
  {
    name: 'Material',
    values: ['Cotton', 'Polyester', 'Leather', 'Wool', 'Silk', 'Denim']
  },
  {
    name: 'Price Range',
    values: ['$0-$25', '$25-$50', '$50-$100', '$100-$250', '$250+']
  }
];

export const SHOPIFY_FIELDS = [
  { label: 'Product Title', value: 'title' },
  { label: 'SKU', value: 'sku' },
  { label: 'Price', value: 'price' },
  { label: 'Compare at Price', value: 'compare_at_price' },
  { label: 'Description', value: 'body_html' },
  { label: 'Vendor', value: 'vendor' },
  { label: 'Product Type', value: 'product_type' },
  { label: 'Tags', value: 'tags' },
  { label: 'Weight', value: 'weight' },
  { label: 'Inventory Quantity', value: 'inventory_quantity' },
  { label: 'Images', value: 'images' },
  { label: 'Variant Option 1', value: 'option1' },
  { label: 'Variant Option 2', value: 'option2' },
  { label: 'Variant Option 3', value: 'option3' },
  { label: 'Do Not Map', value: 'unmapped' }
];