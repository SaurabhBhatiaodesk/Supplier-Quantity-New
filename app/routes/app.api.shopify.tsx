import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

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
        return productBySku;
      }
    }

    // If not found by SKU, try to find by title
    if (title) {
      const productByTitle = await prisma.importedProduct.findFirst({
        where: {
          shop: shop,
          title: title
        }
      });
      if (productByTitle) {
        return productByTitle;
      }
    }

    return null;
  } catch (error) {
    console.error('Error checking product in database:', error);
    return null;
  }
}

function limitTagsArray(tags: string[], maxLength: number = 250): string[] {
  if (!tags || tags.length <= maxLength) {
    return tags || [];
  }
  
  console.log(`⚠️ Tags array too large (${tags.length}), limiting to ${maxLength} items`);
  return tags.slice(0, maxLength);
}

async function publishProductToSalesChannels(admin: any, productId: string) {
  try {
    console.log('🔄 Publishing product to sales channels:', productId);
    
    // First, get all available publications
    const getPublicationsQuery = `#graphql
      query {
        publications(first: 10) {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    `;
    
    const publicationsResp = await admin.graphql(getPublicationsQuery);
    const publicationsResult = await publicationsResp.json();
    
    if (!publicationsResult.data?.publications?.edges) {
      console.log('❌ No publications found');
      return;
    }
    
    const publications = publicationsResult.data.publications.edges.map((edge: any) => edge.node);
    console.log('📋 Available publications:', publications.map((p: any) => ({ name: p.name, id: p.id })));
    
    // Publish to all available publications
    for (const publication of publications) {
      try {
        const publishMutation = `#graphql
          mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
            publishablePublish(id: $id, input: $input) {
              publishable {
                ... on Product {
                  id
                  title
                }
              }
              userErrors {
                field
                message
              }
            }
          }
        `;
        
        const publishResp = await admin.graphql(publishMutation, {
          variables: {
            id: productId,
            input: [
              {
                publicationId: publication.id
              }
            ]
          }
        });
        
        const publishResult = await publishResp.json();
        
        if (publishResult.data?.publishablePublish?.publishable) {
          console.log(`✅ Product published to ${publication.name} successfully`);
        } else if (publishResult.data?.publishablePublish?.userErrors?.length > 0) {
          console.log(`⚠️ Failed to publish to ${publication.name}:`, publishResult.data.publishablePublish.userErrors);
        } else {
          console.log(`❌ Failed to publish to ${publication.name}`);
        }
      } catch (error) {
        console.log(`❌ Error publishing to ${publication.name}:`, error);
      }
    }
    
    console.log('✅ Product publishing process completed');
  } catch (error) {
    console.log('❌ Error in publishProductToSalesChannels:', error);
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (!session?.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  try {
    switch (action) {
      case "getProgress": {
        const sessionId = url.searchParams.get('sessionId');
        if (!sessionId) {
          return json({ success: false, error: "Missing session ID" }, { status: 400 });
        }
        
        const importSession = await prisma.importSession.findUnique({
          where: { id: sessionId }
        });
        
        if (!importSession) {
          return json({ success: false, error: "Session not found" }, { status: 404 });
        }
        
        // Get current processing status
        const currentSession = await prisma.importSession.findUnique({
          where: { id: sessionId }
        });
        
        // Get the latest imported product to show current progress
        const latestProduct = await prisma.importedProduct.findFirst({
          where: { importSessionId: sessionId },
          orderBy: { createdAt: 'desc' }
        });
        
        const currentProductName = currentSession?.status === 'processing' 
          ? (latestProduct?.title || 'Processing...')
          : 'Import completed';
        
        const responseData = {
          success: true,
          sessionId: importSession.id,
          imported: currentSession?.importedProducts || 0, // Use session data
          failed: currentSession?.failedProducts || 0,     // Use session data
          totalProducts: currentSession?.totalProducts || 0, // Use session data
          currentProduct: currentProductName,
          status: currentSession?.status || 'pending'
        };
        
        console.log('📤 Sending progress response:', responseData);
        console.log('🔍 Session data from DB:', {
          id: currentSession?.id,
          importedProducts: currentSession?.importedProducts,
          failedProducts: currentSession?.failedProducts,
          totalProducts: currentSession?.totalProducts,
          status: currentSession?.status
        });
        return json(responseData);
      }
      
      default:
        return json({ success: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error('Loader error:', error);
    return json({ success: false, error: "Internal server error" }, { status: 500 });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);
    const url = new URL(request.url);
    const formData = await request.formData();
    const action = url.searchParams.get('action') || formData.get("action");

    console.log('🔐 Authentication check:', { 
      hasAdmin: !!admin, 
      hasSession: !!session, 
      shop: session?.shop,
      action: action 
    });
    
    console.log('📨 Form data entries:', Array.from(formData.entries()));
    console.log('🔍 Action from URL params:', url.searchParams.get('action'));
    console.log('🔍 Action from form data:', formData.get("action"));

    if (!session?.shop) {
      console.error('❌ Authentication failed: No shop in session');
      return json({ success: false, error: "Authentication failed - No shop found" }, { status: 401 });
    }

  try {
    switch (action) {
      case "bulkCreateProducts": {
        console.log('🚀 bulkCreateProducts action started');
        console.log('📨 Form data received:', Object.fromEntries(formData.entries()));
        
        try {
        
        const payloadRaw = formData.get("data");
        if (typeof payloadRaw !== "string") {
          console.error('❌ Missing data in request');
          return json({ success: false, error: "Missing data" }, { status: 400 });
        }
        
        let payload;
        try {
          payload = JSON.parse(payloadRaw);
          console.log('📦 Payload parsed successfully');
          console.log('📊 Payload keys:', Object.keys(payload));
        } catch (parseError) {
          console.error('❌ Failed to parse payload:', parseError);
          return json({ success: false, error: "Invalid JSON payload" }, { status: 400 });
        }
        
        console.log('Received import payload:', {
          dataSource: payload.dataSource,
          hasCsvData: !!payload.csvData,
          hasApiCredentials: !!payload.apiCredentials,
          csvRows: payload.csvData?.rows?.length || 0,
          keyMappings: payload.keyMappings,
          importFilters: payload.importFilters,
          csvDataKeys: payload.csvData ? Object.keys(payload.csvData) : [],
          csvHeaders: payload.csvData?.headers?.slice(0, 5) || []
        });
        
        // Create import session
        console.log('📝 Creating import session...');
        const importSession = await prisma.importSession.create({
          data: {
            shop: session.shop,
            dataSource: payload.dataSource || 'csv',
            importType: payload.importType || 'all',
            importConfig: payload.importConfig || 'draft',
            keyMappings: JSON.stringify(payload.keyMappings || {}),
            importFilters: JSON.stringify(payload.importFilters || {}),
            markupConfig: JSON.stringify(payload.markupConfig || {}),
            totalProducts: payload.totalProducts || 0,
            status: 'running'
          }
        });
        console.log('✅ Import session created:', importSession.id);

        // Save connection if not already saved (for API imports)
        let connectionId = payload.apiCredentials?.connectionId;
        if (payload.dataSource === 'api' && payload.apiCredentials && !connectionId) {
          console.log('🔗 Creating connection for API import...');
          try {
            const connection = await prisma.connection.create({
              data: {
                shop: session.shop,
                type: 'api',
                name: 'API Import Connection',
                apiUrl: payload.apiCredentials.apiUrl,
                accessToken: payload.apiCredentials.accessToken,
                supplierName: 'API Supplier',
                supplierEmail: 'api@supplier.com',
                status: 'connected',
                productCount: 0,
              },
            });
            connectionId = connection.id;
            console.log('✅ Connection created:', connectionId);
          } catch (error) {
            console.error('❌ Failed to create connection:', error);
          }
        }

        // Get products based on data source
        let productsToProcess: any[] = [];
        
        console.log('🔄 === IMPORT PROCESSING START ===');
        console.log('📊 Data source:', payload.dataSource);
        console.log('📊 Total products expected:', payload.totalProducts);
        console.log('Payload received:', {
          dataSource: payload.dataSource,
          hasCsvData: !!payload.csvData,
          hasApiCredentials: !!payload.apiCredentials,
          importFilters: payload.importFilters,
          keyMappings: payload.keyMappings
        });
        
        console.log('=== FILTER ANALYSIS ===');
        console.log('Import filters type:', typeof payload.importFilters);
        console.log('Import filters:', JSON.stringify(payload.importFilters, null, 2));
        if (payload.importFilters?.selectedValues) {
          console.log('Selected values count:', payload.importFilters.selectedValues.length);
          console.log('Selected values:', payload.importFilters.selectedValues);
        } else {
          console.log('No selected values found in filters');
        }
        console.log('=== END FILTER ANALYSIS ===');

        if (payload.dataSource === 'csv' && payload.csvData) {
          console.log('Processing CSV data...');
          productsToProcess = processCsvData(payload.csvData, payload.importFilters, payload.keyMappings);
        } else if (payload.dataSource === 'api' && payload.apiCredentials) {
          console.log('Processing API data...');
          console.log('API Credentials:', {
            hasUrl: !!payload.apiCredentials.apiUrl,
            hasToken: !!payload.apiCredentials.accessToken,
            url: payload.apiCredentials.apiUrl
          });
          productsToProcess = await fetchApiData(payload.apiCredentials, payload.importFilters, payload.keyMappings);
          console.log('API processing result:', {
            productsCount: productsToProcess.length,
            firstProduct: productsToProcess[0] || 'No products'
          });
        } else {
          console.log('No valid data source, using fallback...');
          productsToProcess = [{
            title: 'Imported Product',
            status: payload.importConfig === 'published' ? 'ACTIVE' : 'DRAFT',
            price: '10.00'
          }];
          console.log('Using fallback demo product');
        }

        console.log('=== FINAL SUMMARY ===');
        console.log('Data Source:', payload.dataSource);
        console.log('Total Products to Process:', productsToProcess.length);
        console.log('Import Config:', payload.importConfig);
        console.log('Markup Config:', payload.markupConfig);
        console.log('=====================');

        // If no products found, create a demo product for testing
        if (productsToProcess.length === 0) {
          console.log('⚠️ No products found! Creating demo product for testing...');
          productsToProcess = [{
            title: 'Demo Product - Test Import',
            descriptionHtml: '<p>This is a demo product created for testing the import process.</p>',
            vendor: 'Demo Vendor',
            productType: 'Test',
            tags: ['demo', 'test'],
            status: payload.importConfig === 'published' ? 'ACTIVE' : 'DRAFT',
            variants: [{
              price: '10.00',
              compareAtPrice: '12.00',
              sku: 'DEMO-001',
              barcode: '123456789'
            }]
          }];
          console.log('✅ Demo product created for testing');
        }

        const results: any[] = [];
        let importedCount = 0;
        let failedCount = 0;

        console.log(`🔄 Starting to process ${productsToProcess.length} products...`);
        
                // Process each product with real-time progress tracking
        for (let i = 0; i < productsToProcess.length; i++) {
          const productData = productsToProcess[i];
            
            console.log(`🔄 Processing product ${i + 1}/${productsToProcess.length}: ${productData.title}`);
            
            // Update progress in session before processing each product
            await prisma.importSession.update({
              where: { id: importSession.id },
              data: { 
                status: 'processing',
                importedProducts: importedCount,
                failedProducts: failedCount,
                totalProducts: productsToProcess.length
              }
            });
            
            console.log(`📊 Progress before processing: Imported=${importedCount}, Failed=${failedCount}, Total=${productsToProcess.length}`);
            
            // Add small delay for progress visibility
            await new Promise(resolve => setTimeout(resolve, 200));
            
            try {
            // Apply markup rules
            const processedProduct = applyMarkupRules(productData, payload.markupConfig);
            console.log('After markup application:', {
              title: processedProduct.title,
              originalPrice: productData.variants?.[0]?.price,
              newPrice: processedProduct.variants?.[0]?.price,
              markupApplied: processedProduct.markupApplied
            });
            
            // Set status based on import config
            processedProduct.status = payload.importConfig === 'published' ? 'ACTIVE' : 'DRAFT';
            
            console.log('🔧 Status setting:', {
              importConfig: payload.importConfig,
              finalStatus: processedProduct.status,
              isPublished: payload.importConfig === 'published',
              isDraft: payload.importConfig === 'draft'
            });
            
            // Extract image URLs for later use
            let productImages: any[] = [];
            if (processedProduct.variants && processedProduct.variants.length > 0) {
              for (const variant of processedProduct.variants) {
                const imageUrl = variant.image_url;
                if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim()) {
                  productImages.push(imageUrl.trim());
                  console.log('Found image URL for product:', imageUrl);
                }
              }
            }

            // Check if product already exists in database
            const existingProduct = await checkProductInDatabase(
              session.shop, 
              processedProduct.variants?.[0]?.sku || '', 
              processedProduct.title
            );

            let productId: string = '';
            let isUpdate = false;

            if (existingProduct && existingProduct.shopifyProductId) {
              // Product exists, update it
              console.log(`🔄 Product already exists, updating: ${processedProduct.title}`);
              try {
                const updatedProduct = await updateShopifyProduct(admin, existingProduct.shopifyProductId, processedProduct);
                productId = updatedProduct.id;
                isUpdate = true;
                console.log(`✅ Product updated successfully: ${productId}`);
              } catch (updateError) {
                console.error(`❌ Failed to update product: ${processedProduct.title}`, updateError);
                // If update fails, try to create new product
                console.log(`🔄 Update failed, trying to create new product: ${processedProduct.title}`);
                isUpdate = false;
              }
            }

            if (!isUpdate) {
              // Product doesn't exist or update failed, create new product
              console.log(`🆕 Creating new product: ${processedProduct.title}`);
              
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
                title: processedProduct.title,
                descriptionHtml: processedProduct.descriptionHtml,
                vendor: processedProduct.vendor,
                productType: processedProduct.productType,
                tags: processedProduct.tags,
                status: processedProduct.status
              };
              
              console.log('Creating product:', productInput.title);
              const productResp = await admin.graphql(createProductMutation, { variables: { input: productInput } });
              const productResult = await productResp.json();
              
                              if (productResult.data?.productCreate?.product) {
                  productId = productResult.data.productCreate.product.id;
                  console.log('Product created successfully:', productId);
                  
                  // Add product options for variants

                
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
                console.log('🔧 Checking variants for product:', processedProduct.title);
                console.log('🔧 processedProduct.variants:', JSON.stringify(processedProduct.variants, null, 2));
                
                if (processedProduct.variants && processedProduct.variants.length > 0) {
                  const createVariantsMutation = `#graphql
                    mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
                      productVariantsBulkCreate(productId: $productId, variants: $variants) {
                        productVariants { id title price }
                        userErrors { field message }
                      }
                    }
                  `;

                  // Note: Images are added separately, variants will inherit product images
                  
                  const variantInputs = processedProduct.variants.map((variant: any) => {
                    const toMoneyString = (val: any): string => {
                      if (val === null || val === undefined) return '0.00';
                      const cleaned = String(val).trim();
                      if (cleaned === '') return '0.00';
                      const num = parseFloat(cleaned.replace(/[^0-9.\-]/g, ''));
                      if (Number.isNaN(num)) return '0.00';
                      return num.toFixed(2);
                    };

                    const variantInput: any = {
                      inventoryItem: {
                        sku: variant.sku || variant.supplier_sku_code || ''
                      },
                      optionValues: [
                        {
                          optionName: "Title",
                          name: processedProduct.title || "Default"
                        }
                      ]
                    };

                    // Add price
                    variantInput.price = toMoneyString(variant.price);
                    console.log(`🔧 Variant price: original="${variant.price}" -> processed="${variantInput.price}"`);

                    // Add compareAtPrice if available
                    if (variant.compareAtPrice) {
                      variantInput.compareAtPrice = toMoneyString(variant.compareAtPrice);
                    }

                    return variantInput;
                  });

                  console.log('Creating variants:', variantInputs.length, 'variants');
                  console.log('Variant inputs:', JSON.stringify(variantInputs, null, 2));
                  
                  const variantsResp = await admin.graphql(createVariantsMutation, {
                    variables: {
                      productId: productId,
                      variants: variantInputs
                    }
                  });
                  const variantsResult = await variantsResp.json();
                  
                  console.log('Variant creation response:', JSON.stringify(variantsResult, null, 2));

                  if (variantsResult.data?.productVariantsBulkCreate?.productVariants) {
                    console.log('Variants created successfully:', variantsResult.data.productVariantsBulkCreate.productVariants.length, 'variants');
                  } else if (variantsResult.data?.productVariantsBulkCreate?.userErrors) {
                    console.error('Variant creation failed:', variantsResult.data.productVariantsBulkCreate.userErrors);
                  } else {
                    console.error('❌ Variant creation failed - no productVariants or userErrors in response');
                  }
                }

                console.log('Product and variants created successfully');
                
                // Publish product to sales channels
                await publishProductToSalesChannels(admin, productId);
                
                // Increment success counter
                importedCount++;
                
                // Update progress in real-time
                console.log(`✅ Product success: Imported=${importedCount}, Failed=${failedCount}, Total=${productsToProcess.length}`);
                try {
                  await prisma.importSession.update({
                    where: { id: importSession.id },
                    data: {
                      importedProducts: importedCount,
                      failedProducts: failedCount,
                      status: 'processing'
                    }
                  });
                  console.log(`✅ Session updated successfully: Imported=${importedCount}, Failed=${failedCount}`);
                } catch (updateError) {
                  console.error('❌ Failed to update session:', updateError);
                }
                
                // Save to database
                try {
                  await prisma.importedProduct.create({
                    data: {
                      shop: session.shop,
                      connectionId: connectionId, // Use the connectionId variable
                      importSessionId: importSession.id,
                      shopifyProductId: productId,
                      title: processedProduct.title || '',
                      bodyHtml: processedProduct.descriptionHtml || '',
                      vendor: processedProduct.vendor || '',
                      productType: processedProduct.productType || '',
                      tags: JSON.stringify(processedProduct.tags || []),
                      status: processedProduct.status || 'draft',
                      price: String(processedProduct.variants?.[0]?.price || ''),
                      compareAtPrice: processedProduct.variants?.[0]?.compareAtPrice || '',
                      sku: processedProduct.variants?.[0]?.sku || '',
                      barcode: processedProduct.variants?.[0]?.barcode || '',
                      weight: processedProduct.variants?.[0]?.weight || 0,
                      weightUnit: processedProduct.variants?.[0]?.weightUnit || 'kg',
                      inventoryQuantity: processedProduct.variants?.[0]?.inventoryQuantity || 0,
                      requiresShipping: processedProduct.variants?.[0]?.requiresShipping !== false,
                      taxable: processedProduct.variants?.[0]?.taxable !== false,
                      images: JSON.stringify(processedProduct.images || []),
                      options: JSON.stringify(processedProduct.options || []),
                      variants: JSON.stringify(processedProduct.variants || []),
                      markupApplied: !!processedProduct.markupApplied,
                      markupType: processedProduct.markupType || '',
                      markupValue: processedProduct.markupValue || ''
                    }
                  });
                } catch (dbError) {
                  console.error('Failed to save product to database:', dbError);
                }
                
                results.push({ success: true, product: productResult.data.productCreate.product });
              } else {
                console.error('Product creation failed:', productResult.data?.productCreate?.userErrors);
                failedCount++;
                results.push({ success: false, product: processedProduct.title, error: 'Product creation failed' });
              }
            }
            
            // Handle update case
            if (isUpdate) {
              // Product was updated successfully
              console.log(`✅ Product updated successfully: ${productId}`);
              
              // Publish product to sales channels
              await publishProductToSalesChannels(admin, productId);
              
              // Increment success counter
              importedCount++;
              
              // Update progress in real-time
              console.log(`✅ Product updated: Imported=${importedCount}, Failed=${failedCount}, Total=${productsToProcess.length}`);
              try {
                await prisma.importSession.update({
                  where: { id: importSession.id },
                  data: {
                    importedProducts: importedCount,
                    failedProducts: failedCount,
                    status: 'processing'
                  }
                });
                console.log(`✅ Session updated successfully: Imported=${importedCount}, Failed=${failedCount}`);
              } catch (updateError) {
                console.error('❌ Failed to update session:', updateError);
              }
              
              // Save to database
              try {
                await prisma.importedProduct.create({
                  data: {
                    shop: session.shop,
                    connectionId: connectionId,
                    importSessionId: importSession.id,
                    shopifyProductId: productId,
                    title: processedProduct.title || '',
                    bodyHtml: processedProduct.descriptionHtml || '',
                    vendor: processedProduct.vendor || '',
                    productType: processedProduct.productType || '',
                    tags: JSON.stringify(processedProduct.tags || []),
                    status: processedProduct.status || 'draft',
                    price: String(processedProduct.variants?.[0]?.price || ''),
                    compareAtPrice: processedProduct.variants?.[0]?.compareAtPrice || '',
                    sku: processedProduct.variants?.[0]?.sku || '',
                    barcode: processedProduct.variants?.[0]?.barcode || '',
                    weight: processedProduct.variants?.[0]?.weight || 0,
                    weightUnit: processedProduct.variants?.[0]?.weightUnit || 'kg',
                    inventoryQuantity: processedProduct.variants?.[0]?.inventoryQuantity || 0,
                    requiresShipping: processedProduct.variants?.[0]?.requiresShipping !== false,
                    taxable: processedProduct.variants?.[0]?.taxable !== false,
                    images: JSON.stringify(processedProduct.images || []),
                    options: JSON.stringify(processedProduct.options || []),
                    variants: JSON.stringify(processedProduct.variants || []),
                    markupApplied: !!processedProduct.markupApplied,
                    markupType: processedProduct.markupType || '',
                    markupValue: processedProduct.markupValue || ''
                  }
                });
              } catch (dbError) {
                console.error('Failed to save product to database:', dbError);
              }
              
              results.push({ success: true, product: { id: productId, title: processedProduct.title } });
            }
          } catch (err: any) {
            failedCount++;
            
            // Update progress for failed product
            await prisma.importSession.update({
              where: { id: importSession.id },
              data: {
                importedProducts: importedCount,
                failedProducts: failedCount,
                status: 'processing'
              }
            });
            
            results.push({ 
              success: false, 
              product: productData.title,
              error: err?.message || 'Unknown error' 
            });
            console.log(`❌ Skipped product: ${productData.title} - ${err?.message || 'Unknown error'}`);
          }
        }

        // Update import session
        await prisma.importSession.update({
          where: { id: importSession.id },
          data: {
            importedProducts: importedCount,
            failedProducts: failedCount,
            status: 'completed',
            completedAt: new Date()
          }
        });

        console.log('✅ Import completed! Final stats:', {
          imported: importedCount,
          failed: failedCount,
          total: productsToProcess.length,
          sessionId: importSession.id
        });
        
        const responseData = { 
          success: true, 
          results,
          sessionId: importSession.id,
          imported: importedCount,
          failed: failedCount,
          totalProducts: productsToProcess.length
        };
        
        console.log('📤 Sending final import response:', responseData);
        return json(responseData);
        } catch (importError) {
          console.error('❌ Import processing error:', importError);
          return json({ 
            success: false, 
            error: importError instanceof Error ? importError.message : 'Import processing failed' 
          }, { status: 500 });
        }
      }

      case "createProduct": {
        const productData = JSON.parse(formData.get("data") as string);
        
        const product = new admin.rest.resources.Product({ session });
        product.title = productData.title;
        product.body_html = productData.body_html;
        product.vendor = productData.vendor;
        product.product_type = productData.product_type;
        product.tags = productData.tags;
        product.status = productData.status || "draft";
        
        if (productData.variants && productData.variants.length > 0) {
          product.variants = productData.variants.map((variant: any) => ({
            price: variant.price,
            compare_at_price: variant.compare_at_price,
            inventory_quantity: variant.inventory_quantity,
            sku: variant.sku,
            barcode: variant.barcode,
            weight: variant.weight,
            weight_unit: variant.weight_unit,
            requires_shipping: variant.requires_shipping,
            taxable: variant.taxable,
          }));
        }

        const savedProduct = await product.save({
          update: true,
        });

        return json({ success: true, product: savedProduct });
      }

      case "updateProduct": {
        const productId = formData.get("productId") as string;
        const productData = JSON.parse(formData.get("data") as string);
        
        const product = new admin.rest.resources.Product({ session });
        // product.id = productId;
        
        Object.assign(product, productData);

        const savedProduct = await product.save({
          update: true,
        });

        return json({ success: true, product: savedProduct });
      }

      case "getProducts": {
        const products = await admin.rest.resources.Product.all({
          session,
          limit: 50,
        });

        return json({ success: true, products: products.data });
      }

      case "deleteProduct": {
        const productId = formData.get("productId") as string;
        
        await admin.rest.resources.Product.delete({
          session,
          id: productId,
        });

        return json({ success: true });
      }

      default:
        throw new Response("Invalid action", { status: 400 });
    }
    } catch (error: any) {
    console.error("Shopify API error:", error);
      console.error("Error details:", {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
        cause: error?.cause
      });
      return json({ 
        success: false, 
        error: `Shopify API error: ${error?.message || 'Unknown error'}` 
      }, { status: 500 });
    }
  } catch (authError) {
    console.error("Authentication error:", authError);
    return json({ success: false, error: "Authentication failed" }, { status: 401 });
  }
};

function checkCondition(product: any, condition: any) {
  console.log('🔍 checkCondition called with:', {
    product: product.title || product.name || 'Unknown',
    condition: JSON.stringify(condition, null, 2)
  });
  
  const field = condition.field || condition.attribute; // Use field first, fallback to attribute for backward compatibility
  const operator = condition.operator;
  const value = condition.value;
  
  console.log('🔍 Condition details:', { field, operator, value });
  
  let productValue = product[field];
  
  console.log('🔍 Initial productValue:', productValue);
  
  // Handle nested fields like variants[0].price
  if (field && field.includes('.')) {
    const parts = field.split('.');
    productValue = product;
    for (const part of parts) {
      productValue = productValue?.[part];
      console.log(`🔍 Nested field ${part}:`, productValue);
    }
  }
  
  // Special handling for price field - check multiple locations
  if (field === 'price' || field === 'Variant Price') {
    console.log('🔍 Price field detected, checking multiple locations');
    if (product.variants && product.variants.length > 0 && product.variants[0].price) {
      productValue = product.variants[0].price;
      console.log('🔍 Found price in variants[0].price:', productValue);
    } else if (product.price) {
      productValue = product.price;
      console.log('🔍 Found price in product.price:', productValue);
    } else {
      console.log('🔍 No price found in any location');
      console.log('🔍 Available product fields:', Object.keys(product));
      console.log('🔍 Variants structure:', product.variants);
    }
  }
  
  // Special handling for compareAtPrice field - check multiple locations
  if (field === 'compareAtPrice' || field === 'Compare At Price') {
    console.log('🔍 CompareAtPrice field detected, checking multiple locations');
    if (product.variants && product.variants.length > 0 && product.variants[0].compareAtPrice) {
      productValue = product.variants[0].compareAtPrice;
      console.log('🔍 Found compareAtPrice in variants[0].compareAtPrice:', productValue);
    } else if (product.compareAtPrice) {
      productValue = product.compareAtPrice;
      console.log('🔍 Found compareAtPrice in product.compareAtPrice:', productValue);
    } else {
      console.log('🔍 No compareAtPrice found in any location');
      console.log('🔍 Available product fields:', Object.keys(product));
      console.log('🔍 Variants structure:', product.variants);
    }
  }
  
  // Special handling for title field
  if (field === 'Title' || field === 'title') {
    productValue = product.title;
    console.log('🔍 Found title:', productValue);
  }
  
  // Special handling for SKU field - check multiple locations
  if (field === 'SKU' || field === 'sku') {
    if (product.variants && product.variants.length > 0 && product.variants[0].sku) {
      productValue = product.variants[0].sku;
      console.log('🔍 Found SKU in variants[0].sku:', productValue);
    } else if (product.sku) {
      productValue = product.sku;
      console.log('🔍 Found SKU in product.sku:', productValue);
    } else {
      console.log('🔍 No SKU found in any location');
    }
  }
  
  // Special handling for Tags field - check both cases and array format
  if (field === 'Tags' || field === 'tags' || field === 'tag') {
    if (Array.isArray(product.tags)) {
      productValue = product.tags; // Keep as array for proper comparison
      console.log('🔍 Found tags array:', productValue);
    } else if (product.tags) {
      productValue = product.tags;
      console.log('🔍 Found tags string:', productValue);
    } else {
      console.log('🔍 No tags found in product');
    }
  }
  
  // Special handling for Vendor field
  if (field === 'Vendor' || field === 'vendor') {
    productValue = product.vendor;
    console.log('🔍 Found vendor:', productValue);
  }
  
  // Special handling for Type field
  if (field === 'Type' || field === 'type') {
    productValue = product.productType;
    console.log('🔍 Found product type:', productValue);
  }
  
  if (productValue === undefined || productValue === null) {
    console.log(`❌ Field ${field} not found in product`);
    return false;
  }
  
  // Special handling for Tags field comparison
  if ((field === 'Tags' || field === 'tags' || field === 'tag') && Array.isArray(productValue)) {
    const conditionValueStr = String(value).trim().toLowerCase();
    console.log(`🔍 Comparing tags array: [${productValue.join(', ')}] ${operator} "${conditionValueStr}"`);
    
    let result = false;
    
    switch (operator) {
      case 'eq':
      case 'equals':
        result = productValue.some(tag => String(tag).toLowerCase() === conditionValueStr);
        break;
      case 'neq':
      case 'not_equals':
        result = !productValue.some(tag => String(tag).toLowerCase() === conditionValueStr);
        break;
      case 'starts':
      case 'starts_with':
        result = productValue.some(tag => String(tag).toLowerCase().startsWith(conditionValueStr));
        break;
      case 'ends':
      case 'ends_with':
        result = productValue.some(tag => String(tag).toLowerCase().endsWith(conditionValueStr));
        break;
      case 'contains':
        result = productValue.some(tag => String(tag).toLowerCase().includes(conditionValueStr));
        break;
      case 'ncontains':
      case 'not_contains':
        result = !productValue.some(tag => String(tag).toLowerCase().includes(conditionValueStr));
        break;
      default:
        console.log(`❌ Unknown operator for tags: ${operator}`);
        return false;
    }
    
    console.log(`🔍 Tags comparison result: ${result}`);
    return result;
  }
  
  // Regular string comparison for other fields
  const productValueStr = String(productValue).trim();
  const conditionValueStr = String(value).trim();
  
  console.log(`🔍 Comparing: "${productValueStr}" ${operator} "${conditionValueStr}"`);
  
  let result = false;
  
  switch (operator) {
    case 'eq':
    case 'equals':
      result = productValueStr.toLowerCase() === conditionValueStr.toLowerCase();
      break;
    case 'neq':
    case 'not_equals':
      result = productValueStr.toLowerCase() !== conditionValueStr.toLowerCase();
      break;
    case 'starts':
    case 'starts_with':
      result = productValueStr.toLowerCase().startsWith(conditionValueStr.toLowerCase());
      break;
    case 'ends':
    case 'ends_with':
      result = productValueStr.toLowerCase().endsWith(conditionValueStr.toLowerCase());
      break;
    case 'contains':
      result = productValueStr.toLowerCase().includes(conditionValueStr.toLowerCase());
      break;
    case 'ncontains':
    case 'not_contains':
      result = !productValueStr.toLowerCase().includes(conditionValueStr.toLowerCase());
      break;
    case 'between':
      const [min, max] = conditionValueStr.split('-').map(Number);
      const numValue = parseFloat(productValueStr);
      result = numValue >= min && numValue <= max;
      console.log(`🔍 Between check: ${numValue} >= ${min} && ${numValue} <= ${max} = ${result}`);
      break;
    default:
      console.log(`❌ Unknown operator: ${operator}`);
      return false;
  }
  
  console.log(`🔍 Comparison result: ${result}`);
  return result;
}

function processCsvData(csvData: any, importFilters: any, keyMappings: any) {
  console.log('=== CSV DATA PROCESSING START ===');
  console.log('csvData:', {
    hasRows: !!csvData?.rows,
    rowsLength: csvData?.rows?.length || 0,
    hasHeaders: !!csvData?.headers,
    headersLength: csvData?.headers?.length || 0,
    firstRow: csvData?.rows?.[0] || 'No rows'
  });
  
  if (!csvData?.rows || !Array.isArray(csvData.rows)) {
    console.log('No CSV rows found, returning empty array');
    return [];
  }
  
  console.log('Processing CSV data:', {
    totalRows: csvData.rows.length,
    filters: importFilters,
    keyMappings: keyMappings
  });
  
  let filteredRows = csvData.rows;
  
  // Simple logic - if any values selected, import those products
  if (importFilters?.selectedValues?.length > 0) {
    console.log('=== SELECTED PRODUCTS MODE ===');
    console.log('Selected values count:', importFilters.selectedValues.length);
    console.log('Selected values:', importFilters.selectedValues);
    
    // Get unique product indices from selected values
    const selectedIndices = new Set<number>();
    
    console.log('🔍 === DETAILED FILTER ANALYSIS ===');
    console.log('CSV Headers:', csvData.headers);
    console.log('CSV Rows count:', csvData.rows.length);
    console.log('First few rows:', csvData.rows.slice(0, 3));
    
    // Create a map of selected values for exact matching
    const selectedValueMap = new Map();
    for (const token of importFilters.selectedValues) {
      const [key, value] = token.split('::');
      if (!key || !value) continue;
      
      if (!selectedValueMap.has(key)) {
        selectedValueMap.set(key, new Set());
      }
      selectedValueMap.get(key).add(value.toLowerCase());
    }
    
    console.log('🔍 Selected value map:', Object.fromEntries(
      Array.from(selectedValueMap.entries()).map(([key, values]) => [key, Array.from(values)])
    ));
    
    // Find rows that match EXACTLY the selected values
    csvData.rows.forEach((row: any, index: number) => {
      // Handle case where row might be an array instead of object
      let processedRow = row;
      if (Array.isArray(row) && csvData.headers) {
        // Convert array to object using headers
        processedRow = {};
        csvData.headers.forEach((header: string, i: number) => {
          processedRow[header] = row[i] || '';
        });
      } else if (typeof row === 'object' && row !== null) {
        // Row is already an object
        processedRow = row;
      } else {
        console.error(`❌ Invalid row structure at index ${index}:`, row);
        return; // Skip this row
      }
      
      // Check if this row matches ANY of the selected values
      let rowMatches = false;
      for (const [key, selectedValues] of selectedValueMap) {
        const rowValue = String(processedRow[key] || '').trim().toLowerCase();
        if (selectedValues.has(rowValue)) {
          console.log(`  ✅ Row ${index} matches selected value: ${key}="${rowValue}"`);
          rowMatches = true;
          break; // Found a match, no need to check other keys
        }
        
        // Handle decimal tolerance for price fields
        if (key === 'price' || key.toLowerCase().includes('price')) {
          const rowPrice = parseFloat(rowValue);
          if (!isNaN(rowPrice)) {
            for (const selectedValue of selectedValues) {
              const filterPrice = parseFloat(selectedValue);
              if (!isNaN(filterPrice)) {
                // Allow tolerance of ±0.01 for price matching
                const tolerance = 0.01;
                if (Math.abs(rowPrice - filterPrice) <= tolerance) {
                  console.log(`  ✅ Row ${index} matches price with tolerance: ${key}="${rowValue}" ≈ "${selectedValue}" (tolerance: ±${tolerance})`);
                  rowMatches = true;
                  break; // Found a match, no need to check other keys
                }
              }
            }
          }
        }
      }
      
      if (rowMatches) {
        console.log(`  ✅ Adding row ${index} to selected products`);
        selectedIndices.add(index);
      }
    });
    
    console.log('🔍 === FILTER RESULTS ===');
    console.log('Selected indices:', Array.from(selectedIndices));
    console.log('Selected indices count:', selectedIndices.size);
    console.log('Expected products:', importFilters.selectedValues.length);
    console.log('Selected values:', importFilters.selectedValues);
    console.log('=== END FILTER ANALYSIS ===');
    
    // Get selected rows
    filteredRows = Array.from(selectedIndices).map(index => csvData.rows[index]);
    
    console.log(`Selected ${filteredRows.length} products from ${csvData.rows.length} total`);
    console.log('Selected products:', filteredRows.map((row: any, i: number) => 
      `${i + 1}. ${row.Title || row.title || row.name || 'No Title'}`
    ));
  } else {
    console.log('=== ALL PRODUCTS MODE ===');
    console.log('No specific filters, keeping all products');
  }
  
  // Convert filtered rows to product format
  const products = filteredRows.map((row: any, index: number) => {
    // Debug logging for row structure
    console.log(`🔍 Processing row ${index}:`, {
      rowType: typeof row,
      isArray: Array.isArray(row),
      rowKeys: Array.isArray(row) ? 'Array' : Object.keys(row),
      rowValues: Array.isArray(row) ? row : Object.values(row),
      sampleValue: Array.isArray(row) ? row[0] : row[Object.keys(row)[0]]
    });
    
    // Ensure row is an object with proper field names
    let processedRow = row;
    if (Array.isArray(row) && csvData.headers) {
      // Convert array to object using headers
      processedRow = {};
      csvData.headers.forEach((header: string, i: number) => {
        processedRow[header] = row[i] || '';
      });
      console.log(`🔧 Converted array row to object:`, processedRow);
    } else if (typeof row === 'object' && row !== null) {
      // Row is already an object, ensure it has the expected structure
      processedRow = row;
      console.log(`🔧 Row is already an object:`, processedRow);
    } else {
      console.error(`❌ Invalid row structure:`, row);
      // Create a fallback object
      processedRow = {
        Title: `Product ${index + 1}`,
        SKU: `SKU-${index + 1}`,
        Tags: '',
        price: '10.00'
      };
    }
    
    // Extract tags properly - handle both string and array formats
    let tags: string[] = [];
    
    // Check multiple possible tag field names
    const possibleTagFields = ['Tags', 'tags', 'Tag', 'tag', 'Categories', 'categories'];
    let foundTagField = null;
    
    for (const fieldName of possibleTagFields) {
      if (processedRow[fieldName]) {
        foundTagField = fieldName;
        console.log(`🔍 Found tags in field: ${fieldName} = ${processedRow[fieldName]}`);
        break;
      }
    }
    
    if (foundTagField) {
      const tagValue = processedRow[foundTagField];
      if (typeof tagValue === 'string') {
        // Split by comma and clean up
        tags = tagValue.split(',').map((tag: string) => tag.trim()).filter(Boolean);
        console.log(`🔍 Extracted tags from string: [${tags.join(', ')}]`);
      } else if (Array.isArray(tagValue)) {
        // Already an array, clean up
        tags = tagValue.map((tag: string) => String(tag).trim()).filter(Boolean);
        console.log(`🔍 Extracted tags from array: [${tags.join(', ')}]`);
      }
    } else {
      console.log(`⚠️ No tags field found. Available fields: ${Object.keys(processedRow).join(', ')}`);
    }
    
    const product = {
      title: processedRow.Title || processedRow.title || processedRow['Product Title'] || `Product ${index + 1}`,
      descriptionHtml: processedRow.Description || processedRow.description || '',
      vendor: processedRow.Vendor || processedRow.vendor || 'Default Vendor',
      productType: processedRow.Type || processedRow.type || 'Default Type',
      tags: tags,
      status: 'DRAFT',
      variants: [{
        price: processedRow['Variant Price'] || processedRow.price || processedRow['Buffer Quantity'] || '10.00',
        compareAtPrice: processedRow['Variant Compare At Price'] || processedRow.compareAtPrice || '',
        sku: processedRow.SKU || processedRow.sku || `SKU-${index + 1}`,
        barcode: processedRow['Variant Barcode'] || processedRow.barcode || '',
        inventoryQuantity: processedRow['Variant Inventory Quantity'] || processedRow.inventoryQuantity || 0,
        image_url: processedRow['Image URL'] || processedRow.image_url || ''
      }]
    };
    
         // Use the original tags from CSV, don't override with filter values
     // The tags should come from the CSV data itself, not from selected filters
     console.log(`✅ Using original CSV tags: ${product.tags.join(', ')}`);
    
    return product;
  });
  
  console.log(`=== CSV PROCESSING COMPLETE ===`);
  console.log(`Total products created: ${products.length}`);
  console.log(`First product:`, products[0] || 'No products');
  
  return products;
}

async function fetchApiData(apiCredentials: any, importFilters: any, keyMappings: any) {
  try {
    console.log('=== API DATA FETCHING START ===');
    console.log('API URL:', apiCredentials.apiUrl);
    console.log('Access Token:', apiCredentials.accessToken ? 'Present' : 'Missing');
    
    const normalizedToken = apiCredentials.accessToken.replace(/^Bearer\s+/i, "");
    
    const res = await fetch(apiCredentials.apiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${normalizedToken}`,
        Accept: "application/json",
        "User-Agent": "Shopify-Product-Import/1.0"
      },
      signal: AbortSignal.timeout(10000)
    });
    
    console.log('API Response Status:', res.status);
    console.log('API Response Headers:', Object.fromEntries(res.headers.entries()));
    
    if (!res.ok) {
      console.error('API fetch failed:', res.status, res.statusText);
      return [];
    }
    
    const body = await res.json();
    console.log('API Response Body:', JSON.stringify(body, null, 2));
    
    // Extract items from API response
    let items: any[] = [];
    if (Array.isArray(body)) {
      items = body;
      console.log('API returned array with', items.length, 'items');
    } else if (body && typeof body === 'object') {
      console.log('API returned object, searching for array...');
      for (const key of Object.keys(body)) {
        const val = (body as any)[key];
        console.log('Checking key:', key, 'type:', typeof val, 'isArray:', Array.isArray(val));
        if (Array.isArray(val) && val.length > 0) {
          items = val;
          console.log('Found array in key:', key, 'with', items.length, 'items');
          break;
        }
      }
    }
    
    console.log('Final items array length:', items.length);
    if (items.length > 0) {
      console.log('Sample item:', items[0]);
      console.log('Available fields in API item:', Object.keys(items[0]));
      
      // Show all available product names for debugging
      console.log('=== ALL AVAILABLE API PRODUCTS ===');
      items.forEach((item: any, index: number) => {
        console.log(`${index + 1}. "${item.name || 'No Name'}"`);
      });
      console.log('=== END AVAILABLE API PRODUCTS ===');
    }
    
    // Apply filters
    let filteredItems = items;
    
    // Check if user selected "All Products" (no specific filters)
    const hasSpecificFilters = importFilters?.selectedValues?.length > 0;
    const isAllProductsSelected = !hasSpecificFilters || importFilters.selectedValues.length === 0;
    
    // Only treat as "All Products" if no filters are selected
    const isAllProductsMode = isAllProductsSelected;
    
    console.log('=== FILTER ANALYSIS ===');
    console.log('importFilters:', importFilters);
    console.log('importFilters.selectedValues:', importFilters?.selectedValues);
    console.log('hasSpecificFilters:', hasSpecificFilters);
    console.log('isAllProductsSelected:', isAllProductsSelected);
    console.log('isAllProductsMode:', isAllProductsMode);
    console.log('=== END FILTER ANALYSIS ===');
    
    if (isAllProductsMode) {
      console.log('=== ALL PRODUCTS MODE ===');
      console.log('All products mode detected, keeping all API products');
      console.log(`Total API products: ${items.length}`);
      filteredItems = items; // Keep all products
    } else if (importFilters?.selectedValues?.length) {
      console.log('=== API FILTERING DEBUG ===');
      console.log('Import filters received:', JSON.stringify(importFilters, null, 2));
      console.log('Selected values:', importFilters.selectedValues);
      console.log('Total API items before filtering:', items.length);
      
      filteredItems = items.filter((item: any) => {
        console.log(`Checking API item: ${item.name || 'Unknown'}`);
        
        // If no filters, keep all items
        if (importFilters.selectedValues.length === 0) {
          console.log(`✅ No filters, keeping API item: ${item.name || 'Unknown'}`);
          return true;
        }
        
        // Group filters by attribute key
        const filtersByAttribute: Record<string, string[]> = {};
        for (const token of importFilters.selectedValues) {
          const [key, value] = token.split('::');
          if (key && value) {
            if (!filtersByAttribute[key]) {
              filtersByAttribute[key] = [];
            }
            filtersByAttribute[key].push(value);
          }
        }
        
        // Check if ANY selected value matches (exact match only)
        for (const token of importFilters.selectedValues) {
          const [key, value] = token.split('::');
          if (!key || !value) continue;
          
          const itemValue = String(item[key] || '').trim();
          const filterValue = String(value).trim();
          
          console.log(`Checking API item ${key}: "${itemValue}" vs "${filterValue}"`);
          
          // Exact match with tolerance for decimal differences (case-insensitive)
          if (itemValue.toLowerCase() === filterValue.toLowerCase()) {
            console.log(`✅ Exact match found for ${key}: "${itemValue}"`);
            return true; // Found a match, include this item
          }
          
          // Handle decimal tolerance for price fields
          if (key === 'price' || key.toLowerCase().includes('price')) {
            const itemPrice = parseFloat(itemValue);
            const filterPrice = parseFloat(filterValue);
            
            if (!isNaN(itemPrice) && !isNaN(filterPrice)) {
              // Allow tolerance of ±0.01 for price matching
              const tolerance = 0.01;
              if (Math.abs(itemPrice - filterPrice) <= tolerance) {
                console.log(`✅ Price match with tolerance: "${itemValue}" ≈ "${filterValue}" (tolerance: ±${tolerance})`);
                return true; // Found a match, include this item
              }
            }
          }
        }
        
        console.log(`❌ No matches found for API item: ${item.name || 'Unknown'}`);
        return false;
      });
      
      console.log(`After API filtering: ${filteredItems.length} items remaining`);
      console.log('Filtered API items:', filteredItems.map((item: any) => item.name || 'Unknown'));
      console.log('=== END API FILTERING DEBUG ===');
    } else {
      console.log('No API filters applied, keeping all items');
    }
    
    // Transform using key mappings and convert to Shopify format
    const transformedProducts = filteredItems.map((item: any) => {
      console.log('=== TRANSFORMING API ITEM ===');
      console.log('Original item:', JSON.stringify(item, null, 2));
      console.log('Key mappings:', JSON.stringify(keyMappings, null, 2));
      
      const product: any = {};
      
      // Apply key mappings
      for (const [sourceKey, targetKey] of Object.entries(keyMappings || {})) {
        console.log(`Mapping ${sourceKey} -> ${targetKey}: ${item[sourceKey as string]}`);
        if (item[sourceKey as string] !== undefined) {
          product[targetKey as string] = item[sourceKey as string];
        } else {
          console.log(`❌ Source key "${sourceKey}" not found in item`);
        }
      }
      
      console.log('Mapped product:', JSON.stringify(product, null, 2));
      
      // Convert to Shopify format (same as CSV)
      const shopifyProduct: any = {
        title: product.title || item.name || item.title || 'Imported Product',
        descriptionHtml: product.bodyHtml || product.descriptionHtml || item.description || '',
        vendor: product.vendor || item.vendor || '',
        productType: product.productType || item.type || '',
        tags: product.tags ? [product.tags] : [],
        status: 'DRAFT', // Will be set later
        variants: [{
          price: product.price || item.price || '0.00',
          compareAtPrice: product.compareAtPrice || item.compareAtPrice || '',
          sku: product.sku || item.sku || '',
          barcode: product.barcode || item.barcode || '',
          image_url: product.image_url || item.image_url || item.image || item.mediaSrc || ''
        }]
      };
      
             // Use the original tags from API data, don't override with filter values
       // The tags should come from the API data itself, not from selected filters
       console.log(`✅ Using original API tags: ${shopifyProduct.tags.join(', ')}`);
      
             // Ensure tags array exists for markup conditions
       if (!shopifyProduct.tags || shopifyProduct.tags.length === 0) {
         shopifyProduct.tags = ['default']; // Only add default tag
         console.log('Added default tag to product for markup conditions:', shopifyProduct.tags);
       }
      
      // Limit tags array to prevent Shopify API errors
      shopifyProduct.tags = limitTagsArray(shopifyProduct.tags, 250);
      
      console.log(`✅ Transformed API product: ${shopifyProduct.title} - Price: ${shopifyProduct.variants[0].price} - Tags: ${shopifyProduct.tags?.join(', ') || 'none'}`);
      console.log('=== END TRANSFORMING API ITEM ===');
      return shopifyProduct;
    });
    
    console.log('=== API DATA FETCHING END ===');
    console.log('Final transformed products:', transformedProducts.length);
    return transformedProducts;
  } catch (error) {
    console.error('Error fetching API data:', error);
    return [];
  }
}

function applyMarkupRules(product: any, markupConfig: any) {
  console.log('🔧 ===== MARKUP RULES DEBUG =====');
  console.log('🔧 Product:', {
    title: product.title,
    sku: product.variants?.[0]?.sku,
    price: product.variants?.[0]?.price,
    tags: product.tags,
    tagsType: typeof product.tags,
    tagsLength: Array.isArray(product.tags) ? product.tags.length : 'not array'
  });
  console.log('🔧 Markup config received:', JSON.stringify(markupConfig, null, 2));
  console.log('🔧 Conditions type:', markupConfig?.conditionsType);
  console.log('🔧 Rules count:', markupConfig?.rules?.length || 0);
  
  // Only apply markup if this is a selected product
  if (!markupConfig || (!markupConfig.rules && !markupConfig.conditions) || 
      (markupConfig.rules && markupConfig.rules.length === 0) || 
      (markupConfig.conditions && markupConfig.conditions.length === 0)) {
    console.log('🔧 No markup config or rules/conditions found, skipping markup');
    return product;
  }
  
  // Handle both "conditions" and "rules" structure
  const conditions = markupConfig?.conditions || markupConfig?.rules || [];
  
  if (!conditions.length) {
    console.log('❌ No markup conditions found, returning product as-is');
    return product;
  }

  console.log('🔧 Applying markup rules to product:', product.title);
  console.log('🔧 Markup config:', JSON.stringify(markupConfig, null, 2));
  console.log('🔧 Conditions to check:', conditions.length);
  
  // Check if conditions match based on logic type
  let conditionsMatch = false;
  
  if (markupConfig.conditionsType === 'all') {
    // AND logic - all conditions must match
    conditionsMatch = conditions.every((condition: any) => checkCondition(product, condition));
    console.log('🔧 AND Logic: All conditions must match');
  } else {
    // OR logic - any condition can match
    conditionsMatch = conditions.some((condition: any) => checkCondition(product, condition));
    console.log('🔧 OR Logic: Any condition can match');
  }

  console.log('🔧 Conditions match result:', conditionsMatch);

  if (conditionsMatch) {
    console.log('🔧 Conditions match, applying priority-based markup');
    
    // Special logic for overlapping ranges - prioritize specific ranges
    const currentPrice = parseFloat(product.variants?.[0]?.price || '0');
    console.log(`🔧 Current price: $${currentPrice}`);
    
    // Sort conditions by specificity (more specific ranges first)
    const sortedConditions = [...conditions].sort((a, b) => {
      // Handle both "equals" and "between" operators for range values
      let aOperator = a.operator;
      let bOperator = b.operator;
      let aValue = a.value;
      let bValue = b.value;
      
      // Convert "equals" to "between" if value contains "-"
      if (a.operator === 'equals' && a.value.includes('-')) {
        aOperator = 'between';
        aValue = a.value;
      }
      if (b.operator === 'equals' && b.value.includes('-')) {
        bOperator = 'between';
        bValue = b.value;
      }
      
      // If both are between operators, sort by range size (smaller range = more specific)
      if (aOperator === 'between' && bOperator === 'between') {
        const aRange = aValue.split('-').map(Number);
        const bRange = bValue.split('-').map(Number);
        const aSize = aRange[1] - aRange[0];
        const bSize = bRange[1] - bRange[0];
        console.log(`🔧 Range comparison: "${aValue}" (size: ${aSize}) vs "${bValue}" (size: ${bSize})`);
        return aSize - bSize; // Smaller range first (more specific)
      }
      return 0;
    });
    
    console.log('🔧 Sorted conditions by specificity:', sortedConditions.map(c => `${c.field} ${c.operator} "${c.value}"`));
    
    // Find the first matching condition (most specific first)
    let appliedCondition = null;
    for (const condition of sortedConditions) {
      // Handle case where frontend sends "equals" operator for range values
      let operatorToUse = condition.operator;
      let valueToUse = condition.value;
      
      // If operator is "equals" but value contains "-", treat it as "between"
      if (condition.operator === 'equals' && condition.value.includes('-')) {
        operatorToUse = 'between';
        valueToUse = condition.value;
        console.log(`🔧 Converting operator from "equals" to "between" for range value: "${condition.value}"`);
      }
      
      const conditionMatches = checkCondition(product, {
        ...condition,
        operator: operatorToUse,
        value: valueToUse
      });
      console.log(`🔧 Checking condition: ${condition.field} ${operatorToUse} "${valueToUse}" - Match: ${conditionMatches}`);
      
      if (conditionMatches) {
        appliedCondition = condition;
        console.log(`🔧 Found matching condition: ${condition.field} ${operatorToUse} "${valueToUse}"`);
        break; // Use the first (most specific) matching condition
      }
    }
    
    if (appliedCondition) {
      const markupType = appliedCondition.markupType;
      const markupValue = parseFloat(appliedCondition.markupValue || '0');
      
      console.log(`🔧 Applying markup: ${markupType} ${markupValue}%`);
      
      let resultingPrice = currentPrice;
      
      // Calculate resulting price
      if ((markupType === 'percent' || markupType === 'percentage') && markupValue > 0) {
        resultingPrice = currentPrice * (1 + markupValue / 100);
        console.log(`🔧 Price calculation: $${currentPrice} → $${resultingPrice.toFixed(2)} (${markupValue}% markup)`);
      } else if (markupType === 'fixed' && markupValue > 0) {
        resultingPrice = currentPrice + markupValue;
        console.log(`🔧 Price calculation: $${currentPrice} → $${resultingPrice.toFixed(2)} ($${markupValue} fixed markup)`);
      }
      
      // Apply the markup to both price and compareAtPrice
      product.variants[0].price = resultingPrice.toFixed(2);
      product.variants[0].compareAtPrice = resultingPrice.toFixed(2);
      product.markupApplied = true;
      product.markupType = (markupType === 'percent' || markupType === 'percentage') ? 'percentage' : 'fixed';
      product.markupValue = markupValue.toString();
      console.log(`🔧 Final price after markup: $${product.variants[0].price}`);
      console.log(`🔧 Final compareAtPrice after markup: $${product.variants[0].compareAtPrice}`);
    } else {
      console.log('🔧 No matching condition found - price unchanged');
    }
  } else {
    console.log('🔧 Conditions do not match, no markup applied');
  }

  console.log('🔧 ===== END MARKUP RULES DEBUG =====');
  return product;
}