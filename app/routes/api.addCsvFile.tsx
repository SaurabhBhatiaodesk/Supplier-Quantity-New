// app/routes/api.addCsvFile.tsx
import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// GraphQL queries and mutations
const Q_PRODUCT_BY_SKU = /* GraphQL */ `
  query ProductBySku($query: String!) {
    products(first: 1, query: $query) {
      edges {
        node {
          id
          title
          tags
          variants(first: 10) {
            edges {
              node {
                id
                sku
                barcode
                inventoryItem { 
                  id 
                }
              }
            }
          }
        }
      }
    }
  }
`;

const Q_INVENTORY_ITEM_BY_BARCODE = /* GraphQL */ `
  query InventoryItemByBarcode($barcode: String!, $first: Int!) {
    inventoryItems(first: $first, query: $barcode) {
      edges {
        node {
          id
          variant {
            id
            sku
            barcode
            product {
              id
              title
              tags
            }
          }
        }
      }
    }
  }
`;

// Query to get products by tags
const Q_PRODUCTS_BY_TAGS = (tags: string[]) => {
    const tagQuery = tags.map(tag => `tag:${tag}`).join(' OR ');
    return /* GraphQL */ `
    query ProductsByTags($first: Int!) {
      products(first: $first, query: "${tagQuery}") {
        edges {
          node {
            id
            title
            tags
            variants(first: 10) {
              edges {
                node {
                  id
                  sku
                  barcode
                  inventoryItem { 
                    id 
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
};

const M_SET_ON_HAND = /* GraphQL */ `
  mutation inventorySetOnHandQuantities($input: InventorySetOnHandQuantitiesInput!) {
    inventorySetOnHandQuantities(input: $input) {
      userErrors {
        field
        message
      }
    }
  }
`;

const M_VARIANT_POLICY = /* GraphQL */ `
  mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      product {
        id
      }
      productVariants {
        id
        inventoryPolicy
      }
      userErrors {
        field
        message
      }
    }
  }
`;

type Body = {
    csvFileData: Record<string, any>[];
    defaultSetting: "allExcels" | "tag" | "selectSku";
    productTags: string[];
    continueSell: "CONTINUE" | "DENY";
    locations: string[];
    bufferQqantity: string | number;
    expireDate: string;
    fileHeaders: string;
    shopifyInventoryHeaders: "sku" | "barcode";
    fileInventoryHeaders: string;
    shopifyQqantityInventoryHeaders: "inventory-quantity";
    fileTagHeader?: string;
    shopifyTagHeader?: string;
};

export async function action({ request }: ActionFunctionArgs) {
    const { admin, session } = await authenticate.admin(request);
    const body = (await request.json()) as Body;

    const {
        csvFileData,
        productTags,
        defaultSetting,
        continueSell,
        locations,
        bufferQqantity,
        fileHeaders,
        shopifyInventoryHeaders,
        fileInventoryHeaders,
        fileTagHeader,
    } = body;

    // Convert location IDs to Shopify's GID format
    const locGIDs = (locations ?? [])
        .filter(id => id && id.toString().trim() !== '')
        .map((id) => {
            const idStr = id.toString();
            if (idStr.startsWith('gid://shopify/Location/')) {
                return idStr;
            }
            const numericId = idStr.replace('gid://shopify/Location/', '');
            return `gid://shopify/Location/${numericId}`;
        });

    const buf = Number(bufferQqantity ?? 0);
    let processed = 0;
    const variantUpdatesByProduct = new Map<string, any[]>();
    const errors: string[] = [];
    const inventoryUpdates: { inventoryItemId: string; locationId: string; quantity: number }[] = [];

    // If processing by tags, fetch all products with matching tags first
    let taggedProducts: any[] = [];
    if (defaultSetting === "tag" && productTags?.length > 0) {
        try {
            const tagsQuery = Q_PRODUCTS_BY_TAGS(productTags);
            const tagsResp = await admin.graphql(tagsQuery, {
                variables: {
                    first: 250
                }
            });
            const tagsData = await tagsResp.json();
            taggedProducts = tagsData?.data?.products?.edges?.map((edge: any) => edge.node) || [];

            console.log(`✅ Found ${taggedProducts.length} products with tags: ${productTags.join(', ')}`);

            // Log all found products with their tags for debugging
            taggedProducts.forEach((product, index) => {
                console.log(`Product ${index + 1}: ${product.title}, Tags: ${product.tags}`);
            });

        } catch (error: any) {
            console.error("Error fetching products by tags:", error);
            errors.push(`Error fetching products by tags: ${error.message}`);
        }
    }

    // Debug logging
    console.log(`✅ Starting processing with ${csvFileData.length} rows`);
    console.log(`✅ Selected tags: ${productTags?.join(', ') || 'None'}`);
    console.log(`✅ Default setting: ${defaultSetting}`);
    console.log(`✅ File header: ${fileHeaders}`);
    console.log(`✅ Shopify header: ${shopifyInventoryHeaders}`);

    function findMatchingColumn(row: Record<string, any>, possibleKeys: string[]): string | null {
        const rowKeys = Object.keys(row);

        for (const possibleKey of possibleKeys) {
            // Exact match
            if (rowKeys.includes(possibleKey)) {
                return possibleKey;
            }

            // Case-insensitive match
            const lowerPossibleKey = possibleKey.toLowerCase();
            for (const rowKey of rowKeys) {
                if (rowKey.toLowerCase() === lowerPossibleKey) {
                    return rowKey;
                }
            }

            // Partial match (e.g., "skuss" contains "sku")
            for (const rowKey of rowKeys) {
                if (rowKey.toLowerCase().includes(lowerPossibleKey) ||
                    lowerPossibleKey.includes(rowKey.toLowerCase())) {
                    return rowKey;
                }
            }
        }

        return null;
    }
    // First pass: collect all inventory updates
    for (const row of csvFileData) {
        const identifierColumn = findMatchingColumn(row, [fileHeaders, "sku", "barcode", "id", "productid"]);
        const quantityColumn = findMatchingColumn(row, [fileInventoryHeaders, "quantity", "qty", "buffer", "stock"]);
        const tagColumn = findMatchingColumn(row, [fileTagHeader || "", "tag", "tags", "category", "type"]);

        const idValue = identifierColumn ? String(row[identifierColumn] || "").trim() : "";
        const qtyRaw = quantityColumn ? row[quantityColumn] : null;
        const rowTag = tagColumn ? String(row[tagColumn] || "").trim() : "";

        // Debug logging for SKU values
        if (identifierColumn && row[identifierColumn]) {
            console.log(`🔍 Original SKU value: "${row[identifierColumn]}" (type: ${typeof row[identifierColumn]})`);
            console.log(`🔍 Processed SKU value: "${idValue}"`);
        }

        console.log(`🔍 Found columns: identifier=${identifierColumn}, quantity=${quantityColumn}, tag=${tagColumn}`);
        // Skip rows with missing data
        if ((!idValue || idValue === "") && (!rowTag || rowTag === "")) {
            console.log(`⏩ Skipping row - missing data`);
            continue;
        }

        const qty = Number(qtyRaw) - buf;
        if (qtyRaw == null || qtyRaw === "") {
            console.log(`⏩ Skipping row - missing quantity data`);
            continue;
        }

        // Determine query type
        const isSkuQuery = shopifyInventoryHeaders.toLowerCase() === "sku";
        const isBarcodeQuery = shopifyInventoryHeaders.toLowerCase() === "barcode";
        const isTagBased = defaultSetting === "tag";

        try {
            if (isTagBased && taggedProducts.length > 0) {
                // TAG-BASED PROCESSING
                console.log("🔖 Processing by tags for row with tag:", rowTag);

                // First check if this row's tag matches selected tags
                if (!productTags?.includes(rowTag)) {
                    console.log(`⏩ Skipping row - tag "${rowTag}" not in selected tags: ${productTags?.join(', ')}`);
                    continue;
                }

                // ✅ FIX: Skip if no tag found
                if (!rowTag || rowTag === "") {
                    console.log(`⏩ Skipping row - no tag found`);
                    continue;
                }

                // ✅ PROCESS ALL PRODUCTS WITH THIS TAG
                console.log("🔄 Processing ALL products with tag:", rowTag);

                for (const product of taggedProducts) {
                    // Check if product has the row's tag
                    const productTagsFromShopify = product.tags || [];
                    if (productTagsFromShopify.includes(rowTag)) {
                        // Process all variants of this product
                        for (const variantEdge of product.variants.edges) {
                            const variant = variantEdge.node;
                            const productId = product.id;
                            const variantId = variant.id;
                            const inventoryItemId = variant.inventoryItem?.id;

                            console.log("✅ Processing product:", product.title);
                            console.log("🔧 Variant ID:", variantId);
                            console.log("📦 Quantity to set:", qty);

                            // Add inventory updates for all locations
                            for (const locId of locGIDs) {
                                inventoryUpdates.push({
                                    inventoryItemId,
                                    locationId: locId,
                                    quantity: Math.max(0, qty)
                                });
                            }

                            // Collect variant updates by product
                            if (!variantUpdatesByProduct.has(productId)) {
                                variantUpdatesByProduct.set(productId, []);
                            }
                            variantUpdatesByProduct.get(productId)!.push({
                                id: variantId,
                                inventoryPolicy: continueSell,
                            });

                            processed++;
                        }
                    }
                }
            } else if (isSkuQuery) {
                // SKU query - search by SKU
                console.log("🔍 Processing by SKU:", idValue);
                const query = `sku:${idValue}`;
                const prodResp = await admin.graphql(Q_PRODUCT_BY_SKU, {
                    variables: { query }
                });
                const prodData = await prodResp.json();

                // Extract variant info from SKU search
                const product = prodData?.data?.products?.edges?.[0]?.node;
                if (product) {
                    const productId = product.id;
                    const variant = product.variants?.edges?.[0]?.node;
                    if (variant) {
                        const variantId = variant.id;
                        const inventoryItemId = variant.inventoryItem?.id;

                        console.log("✅ Processing SKU:", idValue);
                        console.log("🔧 Variant ID:", variantId);
                        console.log("📦 Quantity to set:", qty);

                        // Add inventory updates for all locations
                        for (const locId of locGIDs) {
                            inventoryUpdates.push({
                                inventoryItemId,
                                locationId: locId,
                                quantity: Math.max(0, qty)
                            });
                        }

                        // Collect variant updates by product
                        if (!variantUpdatesByProduct.has(productId)) {
                            variantUpdatesByProduct.set(productId, []);
                        }
                        variantUpdatesByProduct.get(productId)!.push({
                            id: variantId,
                            inventoryPolicy: continueSell,
                        });

                        processed++;
                    } else {
                        console.log(`❌ No variant found for SKU: ${idValue}`);
                        errors.push(`No variant found for SKU: ${idValue}`);
                    }
                } else {
                    console.log(`❌ No product found with SKU: ${idValue}`);
                    errors.push(`No product found with SKU: ${idValue}`);
                }
            } else if (isBarcodeQuery) {
                // BARCODE query - search inventory items by barcode
                console.log("🔍 Processing by barcode:", idValue);
                const invResp = await admin.graphql(Q_INVENTORY_ITEM_BY_BARCODE, {
                    variables: {
                        barcode: `barcode:${idValue}`,
                        first: 10
                    }
                });
                const invData = await invResp.json();

                // Iterate over all matching inventory items
                const inventoryItems = invData?.data?.inventoryItems?.edges || [];
                let foundMatch = false;

                for (const edge of inventoryItems) {
                    const node = edge.node;
                    if (node.variant?.barcode === idValue) {
                        const variantId = node.variant.id;
                        const inventoryItemId = node.id;
                        const productId = node.variant.product?.id;

                        console.log("✅ Processing barcode via inventory item:", idValue);
                        console.log("🔧 Variant ID:", variantId);

                        // Add to inventory updates for each location
                        for (const locId of locGIDs) {
                            inventoryUpdates.push({
                                inventoryItemId,
                                locationId: locId,
                                quantity: Math.max(0, qty)
                            });
                        }

                        // Collect variant updates by product
                        if (!variantUpdatesByProduct.has(productId)) {
                            variantUpdatesByProduct.set(productId, []);
                        }
                        variantUpdatesByProduct.get(productId)!.push({
                            id: variantId,
                            inventoryPolicy: continueSell,
                        });

                        foundMatch = true;
                        processed++;
                        break;
                    }
                }

                if (!foundMatch) {
                    console.log(`🔄 Inventory item search failed for barcode: ${idValue}, trying product search...`);
                    const query = `barcode:${idValue}`;
                    const prodResp = await admin.graphql(Q_PRODUCT_BY_SKU, {
                        variables: { query }
                    });
                    const prodData = await prodResp.json();

                    const product = prodData?.data?.products?.edges?.[0]?.node;
                    if (product) {
                        const productId = product.id;
                        let variantId: string | undefined;
                        let inventoryItemId: string | undefined;

                        // Search through variants to find the one with matching barcode
                        for (const variantEdge of product.variants.edges) {
                            const variant = variantEdge.node;
                            if (variant.barcode === idValue) {
                                variantId = variant.id;
                                inventoryItemId = variant.inventoryItem?.id;
                                break;
                            }
                        }

                        if (variantId && inventoryItemId) {
                            console.log("✅ Processing barcode via product search:", idValue);

                            // Add inventory updates for all locations
                            for (const locId of locGIDs) {
                                inventoryUpdates.push({
                                    inventoryItemId,
                                    locationId: locId,
                                    quantity: Math.max(0, qty)
                                });
                            }

                            // Collect variant updates by product
                            if (!variantUpdatesByProduct.has(productId)) {
                                variantUpdatesByProduct.set(productId, []);
                            }
                            variantUpdatesByProduct.get(productId)!.push({
                                id: variantId,
                                inventoryPolicy: continueSell,
                            });

                            processed++;
                        } else {
                            console.log(`❌ No variant found with barcode: ${idValue}`);
                            errors.push(`No product found with barcode: ${idValue}`);
                        }
                    } else {
                        console.log(`❌ No product found with barcode: ${idValue}`);
                        errors.push(`No product found with barcode: ${idValue}`);
                    }
                }
            }
        } catch (error: any) {
            console.error(`❌ Error processing row with ${fileHeaders}: ${idValue}`, error);
            errors.push(`Error processing ${idValue}: ${error.message}`);
        }
    }

    console.log(`📊 Total processed: ${processed}, Inventory updates: ${inventoryUpdates.length}`);

    // Batch process inventory updates
    const BATCH_SIZE = 200;
    for (let i = 0; i < inventoryUpdates.length; i += BATCH_SIZE) {
        const batch = inventoryUpdates.slice(i, i + BATCH_SIZE);
        try {
            const response = await admin.graphql(M_SET_ON_HAND, {
                variables: {
                    input: {
                        reason: "correction",
                        setQuantities: batch
                    }
                },
            });

            const responseData = await response.json();

            if (responseData?.data?.inventorySetOnHandQuantities?.userErrors?.length > 0) {
                const errorMsg = responseData.data.inventorySetOnHandQuantities.userErrors[0]?.message;
                console.error("❌ Error setting inventory:", errorMsg);
                errors.push(`Inventory batch error: ${errorMsg}`);
            } else {
                console.log(`✅ Inventory set successfully for batch ${i / BATCH_SIZE + 1}`);
            }
        } catch (err: any) {
            console.error("❌ Error setting inventory batch:", err);
            errors.push(`Inventory batch error: ${err.message}`);
        }
    }

    // Now perform bulk updates for all variants of the products
    for (const [productId, variants] of variantUpdatesByProduct) {
        try {
            const bulkUpdateResponse = await admin.graphql(M_VARIANT_POLICY, {
                variables: {
                    productId,
                    variants,
                },
            });

            const bulkUpdateData = await bulkUpdateResponse.json();

            if (bulkUpdateData?.data?.productVariantsBulkUpdate?.userErrors?.length > 0) {
                const errorMsg = bulkUpdateData.data.productVariantsBulkUpdate.userErrors.map((e: any) => e.message).join(', ');
                console.error("❌ Bulk update errors:", errorMsg);
                errors.push(`Bulk update errors for product ${productId}: ${errorMsg}`);
            } else {
                console.log("✅ Bulk update successful for product:", productId);
            }
        } catch (error: any) {
            console.error("❌ Error in bulk variant update:", error);
            errors.push(`Bulk update error for product ${productId}: ${error.message}`);
        }
    }

    return json({
        status: true,
        message: "CSV file processed",
        processedCount: processed,
        errorCount: errors.length,
        errors: errors.slice(0, 10),
        shop: session.shop,
    }, { status: 200 });
}