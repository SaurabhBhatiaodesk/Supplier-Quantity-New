import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// Import markup function from shopify.tsx
function applyMarkupRules(product: any, markupConfig: any) {
  if (!markupConfig?.conditions?.length) {
    console.log('No markup conditions found, returning product as-is');
    return product;
  }

  console.log('Applying markup rules to product:', product.title || product.name);
  console.log('Markup config:', JSON.stringify(markupConfig, null, 2));
  
  // Check if conditions match
  const conditionsMatch = markupConfig.conditionsType === 'all' 
    ? markupConfig.conditions.every((condition: any) => checkCondition(product, condition))
    : markupConfig.conditions.some((condition: any) => checkCondition(product, condition));

  console.log('Conditions match result:', conditionsMatch);

  if (conditionsMatch) {
    console.log('Conditions match, applying markup');
    
    // Find the highest priority condition
    const highestPriorityCondition = markupConfig.conditions.reduce((highest: any, current: any) => 
      current.priority > highest.priority ? current : highest
    );

    console.log('Highest priority condition:', JSON.stringify(highestPriorityCondition, null, 2));

    const markupType = highestPriorityCondition.markupType;
    const markupValue = parseFloat(highestPriorityCondition.markupValue || '0');
    
    // Get current price from different possible locations
    let currentPrice = 0;
    if (product.variants && product.variants.length > 0 && product.variants[0].price) {
      currentPrice = parseFloat(product.variants[0].price);
    } else if (product.price) {
      currentPrice = parseFloat(product.price);
    } else if (product.variants && product.variants.length > 0 && product.variants[0].price) {
      currentPrice = parseFloat(product.variants[0].price);
    }

    console.log(`Markup details: type=${markupType}, value=${markupValue}, currentPrice=${currentPrice}`);

    if (markupType === 'percentage' && markupValue > 0 && currentPrice > 0) {
      const newPrice = currentPrice * (1 + markupValue / 100);
      
      // Update price in the correct location
      if (product.variants && product.variants.length > 0) {
        product.variants[0].price = newPrice.toFixed(2);
      } else {
        product.price = newPrice.toFixed(2);
      }
      
      product.markupApplied = true;
      product.markupType = 'percentage';
      product.markupValue = markupValue.toString();
      console.log(`Applied ${markupValue}% markup: ${currentPrice} → ${newPrice.toFixed(2)}`);
    } else if (markupType === 'fixed' && markupValue > 0 && currentPrice > 0) {
      const newPrice = currentPrice + markupValue;
      
      // Update price in the correct location
      if (product.variants && product.variants.length > 0) {
        product.variants[0].price = newPrice.toFixed(2);
      } else {
        product.price = newPrice.toFixed(2);
      }
      
      product.markupApplied = true;
      product.markupType = 'fixed';
      product.markupValue = markupValue.toString();
      console.log(`Applied fixed markup: ${currentPrice} → ${newPrice.toFixed(2)}`);
    } else {
      console.log(`Markup not applied: type=${markupType}, value=${markupValue}, currentPrice=${currentPrice}`);
    }
  } else {
    console.log('Conditions do not match, no markup applied');
  }

  return product;
}

function checkCondition(product: any, condition: any) {
  const field = condition.field;
  const operator = condition.operator;
  const value = condition.value;
  
  let productValue = product[field];
  
  // Handle nested fields like variants[0].price
  if (field.includes('.')) {
    const parts = field.split('.');
    productValue = product;
    for (const part of parts) {
      productValue = productValue?.[part];
    }
  }
  
  // Special handling for price field - check multiple locations
  if (field === 'price') {
    if (product.variants && product.variants.length > 0 && product.variants[0].price) {
      productValue = product.variants[0].price;
    } else if (product.price) {
      productValue = product.price;
    }
  }
  
  if (operator === 'between' || operator === 'range') {
    const [min, max] = value.split('-').map(Number);
    const numValue = parseFloat(productValue);
    console.log(`🔍 Price check: ${productValue} (${numValue}) in range ${min}-${max}`);
    return numValue >= min && (max === 0 || numValue <= max);
  }
  
  // Handle other operators
  switch (operator) {
    case 'eq': // Frontend sends 'eq' for "is equal to"
      return String(productValue).toLowerCase() === String(value).toLowerCase();
    case 'neq': // Frontend sends 'neq' for "is not equal to"
      return String(productValue).toLowerCase() !== String(value).toLowerCase();
    case 'contains':
      return String(productValue).toLowerCase().includes(String(value).toLowerCase());
    case 'ncontains': // Frontend sends 'ncontains' for "does not contain"
      return !String(productValue).toLowerCase().includes(String(value).toLowerCase());
    case 'starts': // Frontend sends 'starts' for "starts with"
      return String(productValue).toLowerCase().startsWith(String(value).toLowerCase());
    case 'ends': // Frontend sends 'ends' for "ends with"
      return String(productValue).toLowerCase().endsWith(String(value).toLowerCase());
    default:
      console.log(`Unknown operator: ${operator}, defaulting to equals`);
      return String(productValue).toLowerCase() === String(value).toLowerCase();
  }
}

// Cron job setup for testing - runs every 5 minutes
let cronJobInterval: NodeJS.Timeout | null = null;

// Start cron job when module loads
if (!cronJobInterval) {
  console.log('🕐 Setting up cron job to run every 5 minutes...');
  cronJobInterval = setInterval(async () => {
    try {
      console.log('🔄 Cron job triggered automatically at:', new Date().toISOString());
      // This will be called every 5 minutes
      // For now, just log - actual sync will be triggered via API
    } catch (error) {
      console.error('❌ Cron job error:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes in milliseconds
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  
  if (!session?.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  try {
    // Get all active connections for this shop
    const connections = await prisma.connection.findMany({
      where: { 
        shop: session.shop, 
        isActive: true,
        type: 'api' // Only API connections for now
      },
      select: {
        id: true,
        name: true,
        apiUrl: true,
        accessToken: true,
        scheduledTime: true,
        status: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    console.log('🔍 All connections from database:', connections.map(c => ({
      id: c.id,
      name: c.name,
      apiUrl: c.apiUrl,
      hasAccessToken: !!c.accessToken,
      accessTokenLength: c.accessToken ? c.accessToken.length : 0
    })));

    console.log(`🔄 Cron job started for shop: ${session.shop}`);
    console.log(`📊 Found ${connections.length} active connections`);

    const results = [];

    for (const connection of connections) {
      try {
        console.log(`🔄 Processing connection: ${connection.name}`);
        console.log('🔍 Connection Debug:', {
          id: connection.id,
          name: connection.name,
          apiUrl: connection.apiUrl,
          accessToken: connection.accessToken ? `${connection.accessToken.substring(0, 10)}...` : 'undefined',
          accessTokenLength: connection.accessToken ? connection.accessToken.length : 0,
          scheduledTime: connection.scheduledTime
        });
        
        // Parse schedule data to get markup configuration
        let markupConfig = null;
        if (connection.scheduledTime) {
          try {
            const scheduleData = JSON.parse(connection.scheduledTime);
            if (scheduleData.markupEnabled) {
              markupConfig = {
                conditions: [{
                  field: 'price',
                  operator: scheduleData.conditionOperator || 'between',
                  value: `${scheduleData.priceFrom}-${scheduleData.priceTo}`,
                  priority: 1,
                  markupType: scheduleData.markupType,
                  markupValue: scheduleData.markupValue
                }],
                conditionsType: 'all'
              };
              console.log('💰 Markup config loaded:', markupConfig);
            }
          } catch (e) {
            console.log('⚠️ Could not parse markup config from schedule data');
          }
        }

        // Validate API credentials
        if (!connection.apiUrl || !connection.accessToken) {
          console.error(`❌ Missing API credentials for connection: ${connection.name}`);
          console.error('API URL:', connection.apiUrl);
          console.error('Access Token:', connection.accessToken ? 'Present' : 'Missing');
          results.push({
            connectionName: connection.name,
            error: 'Missing API credentials (URL or Access Token)',
            success: false
          });
          continue;
        }

        // Fetch latest data from API
        const apiData = await fetchApiData({
          apiUrl: connection.apiUrl,
          accessToken: connection.accessToken
        }, null, {});

        if (apiData.length === 0) {
          console.log(`⚠️ No products found for connection: ${connection.name}`);
          continue;
        }

        console.log(`📦 Found ${apiData.length} products from API`);

        // Get existing Shopify products
        const existingProducts = await getShopifyProducts(admin);
        console.log(`🏪 Found ${existingProducts.length} existing Shopify products`);

        let created = 0;
        let updated = 0;
        let skipped = 0;

        for (const productData of apiData) {
          try {
            // Validate product data
            if (!productData || typeof productData !== 'object') {
              console.warn('⚠️ Invalid product data, skipping:', productData);
              skipped++;
              continue;
            }

            // Debug: Log product data structure
            console.log('🔍 Product data structure:', {
              keys: Object.keys(productData),
              title: productData.title,
              name: productData.name,
              product_name: productData.product_name,
              productName: productData.productName,
              price: productData.price,
              variants: productData.variants ? `${productData.variants.length} variants` : 'no variants',
              hasPrice: !!productData.price,
              hasVariants: !!(productData.variants && productData.variants.length > 0)
            });

            const productTitle = productData.title || productData.name || productData.product_name || productData.productName || 'Unknown Product';
            const productSku = productData.variants?.[0]?.sku || productData.sku || productData.sku_code || productData.skuCode;
            
            console.log(`🔄 Processing product: ${productTitle} (SKU: ${productSku})`);
            
            // Step 1: Check if product exists in our database
            const existingInDb = await checkProductInDatabase(session.shop, productSku, productTitle);
            
            // Apply markup if configured
            let processedProductData = productData;
            if (markupConfig) {
              processedProductData = applyMarkupRules(productData, markupConfig);
              console.log(`💰 Applied markup to product: ${productTitle}`);
            }

            // Step 2: Check if product exists in Shopify
            const existingInShopify = findExistingProduct(processedProductData, existingProducts);
            
            if (existingInDb && existingInShopify) {
              // Product exists in both places - UPDATE
              console.log(`📝 Product exists in both DB and Shopify - Updating...`);
              await updateShopifyProduct(admin, existingInShopify.id, productData);
              await updateProductInDatabase(existingInDb.id, productData);
              updated++;
              console.log(`✅ Updated product: ${productTitle}`);
            } else if (existingInDb && !existingInShopify) {
              // Product exists in DB but not in Shopify - CREATE in Shopify
              console.log(`🆕 Product exists in DB but not in Shopify - Creating in Shopify...`);
              const newShopifyProduct = await createShopifyProduct(admin, productData, connection.id);
              if (newShopifyProduct) {
                await updateProductInDatabase(existingInDb.id, productData, newShopifyProduct.id);
              }
              created++;
              console.log(`✅ Created product in Shopify: ${productTitle}`);
            } else if (!existingInDb && existingInShopify) {
              // Product exists in Shopify but not in DB - CREATE in DB
              console.log(`💾 Product exists in Shopify but not in DB - Creating in DB...`);
              await createProductInDatabase(session.shop, connection.id, productData, existingInShopify.id);
              updated++;
              console.log(`✅ Added product to DB: ${productTitle}`);
            } else {
              // Product doesn't exist anywhere - CREATE in both
              console.log(`🆕 Product doesn't exist anywhere - Creating in both...`);
              const newShopifyProduct = await createShopifyProduct(admin, productData, connection.id);
              if (newShopifyProduct) {
                await createProductInDatabase(session.shop, connection.id, productData, newShopifyProduct.id);
              }
              created++;
              console.log(`✅ Created product in both: ${productTitle}`);
            }
          } catch (error) {
            const productTitle = productData?.title || productData?.name || 'Unknown Product';
            console.error(`❌ Error processing product ${productTitle}:`, error);
            skipped++;
          }
        }

        // Update connection last sync time
        await prisma.connection.update({
          where: { id: connection.id },
          data: { 
            lastSync: new Date(),
            productCount: apiData.length
          }
        });

        results.push({
          connectionName: connection.name,
          totalProducts: apiData.length,
          created,
          updated,
          skipped,
          success: true
        });

        console.log(`✅ Connection ${connection.name} processed: ${created} created, ${updated} updated, ${skipped} skipped`);

      } catch (error) {
        console.error(`❌ Error processing connection ${connection.name}:`, error);
        results.push({
          connectionName: connection.name,
          error: error instanceof Error ? error.message : String(error),
          success: false
        });
      }
    }

    return json({ 
      success: true, 
      message: 'Cron job completed successfully',
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cron job error:', error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

// Helper functions
async function fetchApiData(apiCredentials: any, filters: any, keyMappings: any) {
  try {
    console.log('🔍 API Credentials Debug:', {
      apiUrl: apiCredentials.apiUrl,
      accessToken: apiCredentials.accessToken ? `${apiCredentials.accessToken.substring(0, 10)}...` : 'undefined',
      accessTokenLength: apiCredentials.accessToken ? apiCredentials.accessToken.length : 0
    });

    const response = await fetch(apiCredentials.apiUrl, {
      headers: {
        'Authorization': `Bearer ${apiCredentials.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📡 API Response Status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:', errorText);
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('📦 API Response Data:', {
      hasProducts: !!data.products,
      hasData: !!data.data,
      productsLength: data.products?.length || 0,
      dataLength: data.data?.length || 0,
      keys: Object.keys(data)
    });
    
    return data.products || data.data || data || [];
  } catch (error) {
    console.error('API fetch error:', error);
    return [];
  }
}

async function getShopifyProducts(admin: any) {
  try {
    const query = `#graphql
      query getProducts($first: Int!) {
        products(first: $first) {
          edges {
            node {
              id
              title
              variants(first: 10) {
                edges {
                  node {
                    id
                    sku
                    price
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await admin.graphql(query, {
      variables: { first: 250 }
    });

    const data = await response.json();
    return data.data.products.edges.map((edge: any) => edge.node);
  } catch (error) {
    console.error('Error fetching Shopify products:', error);
    return [];
  }
}

function findExistingProduct(productData: any, existingProducts: any[]) {
  // Validate productData
  if (!productData || typeof productData !== 'object') {
    console.warn('Invalid productData provided to findExistingProduct:', productData);
    return null;
  }

  // Try to find by SKU first
  const sku = productData.variants?.[0]?.sku || productData.sku;
  if (sku && typeof sku === 'string') {
    const found = existingProducts.find(product => 
      product.variants.edges.some((variant: any) => variant.node.sku === sku)
    );
    if (found) return found;
  }

  // Try to find by title
  const title = productData.title || productData.name || productData.product_name || productData.productName;
  if (title && typeof title === 'string') {
    return existingProducts.find(product => 
      product.title && product.title.toLowerCase() === title.toLowerCase()
    );
  }

  return null;
}

async function updateShopifyProduct(admin: any, productId: string, productData: any) {
  try {
    console.log(`📝 Updating Shopify product: ${productData.title}`);
    
    // Step 1: Update the product
    const productMutation = `#graphql
      mutation productUpdate($input: ProductInput!) {
        productUpdate(input: $input) {
          product { 
            id 
            title 
            handle
            status
          }
          userErrors { field message }
        }
      }
    `;

    const productInput = {
      id: productId,
      title: productData.title || productData.name || productData.product_name || productData.productName || 'Unknown Product',
      descriptionHtml: productData.descriptionHtml || productData.description || productData.description_html || productData.productDescription || '',
      vendor: productData.vendor || productData.brand || productData.manufacturer || '',
      productType: productData.productType || productData.product_type || productData.category || '',
      tags: productData.tags || productData.categories || [],
      status: productData.status || 'ACTIVE'
    };

    const productResponse = await admin.graphql(productMutation, { variables: { input: productInput } });
    const productResult = await productResponse.json();
    
    if (productResult.data?.productUpdate?.userErrors?.length > 0) {
      throw new Error(productResult.data.productUpdate.userErrors[0].message);
    }

    const product = productResult.data?.productUpdate?.product;
    if (!product) {
      throw new Error('Failed to update product');
    }

    console.log(`✅ Product updated: ${product.title} (ID: ${product.id})`);

               // Step 2: Update variants using bulk update mutation
      console.log(`🔄 Updating variants using bulk update...`);
      
      // First, get existing variants to update them
      const getVariantsQuery = `#graphql
        query getProductVariants($productId: ID!) {
          product(id: $productId) {
            variants(first: 10) {
              edges {
                node {
                  id
                  sku
                  price
                }
              }
            }
          }
        }
      `;

      const variantsResponse = await admin.graphql(getVariantsQuery, {
        variables: { productId: product.id }
      });
      const variantsResult = await variantsResponse.json();
      const existingVariants = variantsResult.data?.product?.variants?.edges || [];

      if (existingVariants.length > 0) {
        const existingVariant = existingVariants[0]?.node;

        if (existingVariant) {
          const bulkUpdateVariantsMutation = `#graphql
            mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                product { id }
                productVariants { 
                  id 
                  sku 
                  price 
                  barcode
                }
                userErrors { field message }
              }
            }
          `;

          const toMoneyString = (val: any): string | undefined => {
            if (val === null || val === undefined) return undefined;
            const cleaned = String(val).trim();
            if (cleaned === '') return undefined;
            const num = parseFloat(cleaned.replace(/[^0-9.\-]/g, ''));
            if (Number.isNaN(num)) return undefined;
            return num.toFixed(2);
          };

          const variantInput: any = {
            id: existingVariant.id
          };

          // Update price from product data
          const priceStr = toMoneyString(productData.price);
          if (priceStr !== undefined) {
            variantInput.price = priceStr;
          }

          // Update SKU from product data
          if (productData.supplier_sku_code) {
            variantInput.inventoryItem = {
              sku: String(productData.supplier_sku_code)
            };
          }

          // Update barcode from product data
          if (productData.barcode) {
            variantInput.barcode = String(productData.barcode);
          }

          console.log('Updating variant with data:', JSON.stringify(variantInput, null, 2));

          const variantUpdateResponse = await admin.graphql(bulkUpdateVariantsMutation, {
            variables: { 
              productId: product.id,
              variants: [variantInput]
            }
          });

          const variantUpdateResult = await variantUpdateResponse.json();
          
          if (variantUpdateResult.data?.productVariantsBulkUpdate?.userErrors?.length > 0) {
            console.warn('⚠️ Variant update warnings:', variantUpdateResult.data.productVariantsBulkUpdate.userErrors);
          } else {
            console.log(`✅ Updated variant: ${productData.supplier_sku_code || 'No SKU'}`);
          }
        }
      }

                   // Step 3: Images update skipped as requested
      console.log(`🖼️ Images update skipped for existing product`);

    return product;
  } catch (error) {
    console.error(`❌ Error updating Shopify product: ${productData.title}`, error);
    throw error;
  }
}

// Database helper functions
async function checkProductInDatabase(shop: string, sku: string, title: string) {
  try {
    // First try to find by SKU
    if (sku) {
      const productBySku = await prisma.importedProduct.findFirst({
        where: {
          shop: shop,
          sku: sku
        }
      });
      if (productBySku) {
        console.log(`🔍 Found product in DB by SKU: ${sku}`);
        return productBySku;
      }
    }

    // If not found by SKU, try by title
    if (title) {
      const productByTitle = await prisma.importedProduct.findFirst({
        where: {
          shop: shop,
          title: title
        }
      });
      if (productByTitle) {
        console.log(`🔍 Found product in DB by title: ${title}`);
        return productByTitle;
      }
    }

    console.log(`🔍 Product not found in DB: ${title} (SKU: ${sku})`);
    return null;
  } catch (error) {
    console.error('Error checking product in database:', error);
    return null;
  }
}

async function updateProductInDatabase(productId: string, productData: any, shopifyProductId?: string) {
  try {
    await prisma.importedProduct.update({
      where: { id: productId },
      data: {
        title: productData.title || productData.name || productData.product_name || productData.productName || 'Unknown Product',
        bodyHtml: productData.descriptionHtml || productData.description || productData.description_html || productData.productDescription || '',
        vendor: productData.vendor || productData.brand || productData.manufacturer || '',
        productType: productData.productType || productData.product_type || productData.category || '',
        tags: JSON.stringify(productData.tags || productData.categories || []),
        status: productData.status,
        price: String(productData.price || productData.variants?.[0]?.price || ''),
        sku: productData.supplier_sku_code || productData.sku || productData.sku_code || productData.skuCode || productData.variants?.[0]?.sku || '',
        images: JSON.stringify(productData.images || productData.image_urls || [productData.image_url].filter(Boolean) || []),
        variants: JSON.stringify(productData.variants || []),
        ...(shopifyProductId && { shopifyProductId: shopifyProductId })
      }
    });
    console.log(`💾 Updated product in DB: ${productData.title}`);
  } catch (error) {
    console.error('Error updating product in database:', error);
    throw error;
  }
}

async function createProductInDatabase(shop: string, connectionId: string, productData: any, shopifyProductId: string) {
  try {
    await prisma.importedProduct.create({
      data: {
        shop: shop,
        connectionId: connectionId,
        shopifyProductId: shopifyProductId,
        title: productData.title || productData.name || productData.product_name || productData.productName || 'Unknown Product',
        bodyHtml: productData.descriptionHtml || productData.description || productData.description_html || productData.productDescription || '',
        vendor: productData.vendor || productData.brand || productData.manufacturer || '',
        productType: productData.productType || productData.product_type || productData.category || '',
        tags: JSON.stringify(productData.tags || productData.categories || []),
        status: productData.status,
                 price: String(productData.price || productData.variants?.[0]?.price || ''),
         sku: productData.supplier_sku_code || productData.sku || productData.sku_code || productData.skuCode || productData.variants?.[0]?.sku || '',
        images: JSON.stringify(productData.images || productData.image_urls || []),
        variants: JSON.stringify(productData.variants || [])
      }
    });
    console.log(`💾 Created product in DB: ${productData.title}`);
  } catch (error) {
    console.error('Error creating product in database:', error);
    throw error;
  }
}

async function createShopifyProduct(admin: any, productData: any, connectionId: string) {
  try {
    console.log(`🆕 Creating Shopify product: ${productData.title}`);
    
    // Extract image URLs for later use
    let productImages: any[] = [];
    
    // Check if image_url exists directly on product
    if (productData.image_url && typeof productData.image_url === 'string' && productData.image_url.trim()) {
      productImages.push(productData.image_url.trim());
      console.log('Found image URL for product:', productData.image_url);
    }
    
    // Also check variants if they exist
    if (productData.variants && productData.variants.length > 0) {
      for (const variant of productData.variants) {
        const imageUrl = variant.image_url;
        if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim()) {
          productImages.push(imageUrl.trim());
          console.log('Found image URL for variant:', imageUrl);
        }
      }
    }

    // Step 1: Create product (without images)
    const createProductMutation = `#graphql
      mutation productCreate($input: ProductInput!) {
        productCreate(input: $input) {
          product { 
            id 
            title 
            status 
            descriptionHtml
          }
          userErrors { field message }
        }
      }
    `;
    
    const productInput = {
      title: productData.title || productData.name || productData.product_name || productData.productName || 'Unknown Product',
      descriptionHtml: productData.descriptionHtml || productData.description || productData.description_html || productData.productDescription || '',
      vendor: productData.vendor || productData.brand || productData.manufacturer || '',
      productType: productData.productType || productData.product_type || productData.category || '',
      tags: productData.tags || productData.categories || [],
      status: productData.status || 'ACTIVE'
    };
    
    console.log('Creating product:', productInput.title);
    const productResp = await admin.graphql(createProductMutation, { variables: { input: productInput } });
    const productResult = await productResp.json();
    
    if (productResult.data?.productCreate?.product) {
      const productId = productResult.data.productCreate.product.id;
      console.log('Product created successfully:', productId);
      
             // Step 1.5: Add images to product if available
       if (productImages.length > 0) {
         const addImagesMutation = `#graphql
           mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
             productCreateMedia(productId: $productId, media: $media) {
               media {
                 id
                 ... on MediaImage {
                   id
                   image {
                     url
                   }
                 }
               }
               userErrors { field message }
             }
           }
         `;
         
         const mediaInputs = productImages.map(imageUrl => ({
           originalSource: imageUrl,
           mediaContentType: "IMAGE"
         }));
         
         console.log('Adding images to product:', productImages.length, 'images');
         const imagesResp = await admin.graphql(addImagesMutation, {
           variables: {
             productId: productId,
             media: mediaInputs
           }
         });
         const imagesResult = await imagesResp.json();
         
         if (imagesResult.data?.productCreateMedia?.media) {
           console.log('Images added successfully:', imagesResult.data.productCreateMedia.media.length, 'images');
         } else if (imagesResult.data?.productCreateMedia?.userErrors) {
           console.error('Image creation failed:', imagesResult.data.productCreateMedia.userErrors);
           // Log specific image URL that failed
           productImages.forEach((imageUrl, index) => {
             console.error(`Failed image ${index + 1}:`, imageUrl);
           });
         }
       }
       
       // Step 2: Create variants using bulk mutation
       // Since API data is flat, create a single variant from product data
       if (productData) {
         const createVariantsMutation = `#graphql
           mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
             productVariantsBulkCreate(productId: $productId, variants: $variants) {
               productVariants { id title price }
               userErrors { field message }
             }
           }
         `;

         // Note: Images are added separately, variants will inherit product images
         
         const toMoneyString = (val: any): string | undefined => {
           if (val === null || val === undefined) return undefined;
           const cleaned = String(val).trim();
           if (cleaned === '') return undefined;
           const num = parseFloat(cleaned.replace(/[^0-9.\-]/g, ''));
           if (Number.isNaN(num)) return undefined;
           return num.toFixed(2);
         };

         // Create single variant from product data
         const variantInput: any = {};

         const priceStr = toMoneyString(productData.price);
         // price is required
         variantInput.price = priceStr ?? '0.00';

         const compareAtStr = toMoneyString(productData.rrp);
         if (compareAtStr !== undefined) variantInput.compareAtPrice = compareAtStr;

         // SKU goes inside inventoryItem
         if (productData.supplier_sku_code) {
           variantInput.inventoryItem = {
             sku: String(productData.supplier_sku_code)
           };
         }

         // Barcode is supported directly
         if (productData.barcode) variantInput.barcode = String(productData.barcode);

         // Note: Images are added at product level, variants inherit them automatically

         // Add option values for Title
         variantInput.optionValues = [
           {
             optionName: "Title",
             name: productData.name || "Default"
           }
         ];

         console.log('Creating variant for product:', JSON.stringify(variantInput, null, 2));
         const variantsResp = await admin.graphql(createVariantsMutation, { 
           variables: { 
             productId: productId,
             variants: [variantInput] 
           } 
         });
         const variantsResult = await variantsResp.json();
         
         console.log('Variant creation response:', JSON.stringify(variantsResult, null, 2));
         
         if (variantsResult.data?.productVariantsBulkCreate?.productVariants) {
           console.log('Variant created successfully:', variantsResult.data.productVariantsBulkCreate.productVariants.length, 'variants');
           console.log('Variant details:', variantsResult.data.productVariantsBulkCreate.productVariants);
         } else if (variantsResult.data?.productVariantsBulkCreate?.userErrors) {
           console.error('Variant creation failed with errors:', variantsResult.data.productVariantsBulkCreate.userErrors);
         } else {
           console.error('Variant creation failed - no productVariants or userErrors in response');
           console.error('Full variant response:', JSON.stringify(variantsResult, null, 2));
         }
       }
      
      console.log('Product and variants created successfully');
      return productResult.data.productCreate.product;
    } else {
      throw new Error('Failed to create product');
    }
  } catch (error) {
    console.error(`❌ Error creating Shopify product: ${productData.title}`, error);
    throw error;
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  // Manual trigger for testing
  return loader({ request } as LoaderFunctionArgs);
};
