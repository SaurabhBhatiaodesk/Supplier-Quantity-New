    export const Q_SHOP_LOCATIONS = /* GraphQL */ `
  query Locations($first: Int!) {
    shop {
      locations(first: $first) {
        edges { node { id name } }
      }
    }
  }
`;

export const Q_PRODUCT_BY_SKU = /* GraphQL */ `
  query ProductBySku($sku: String!) {
    products(first: 1, query: $sku) {
      edges {
        node {
          variants(first: 1) {
            edges {
              node {
                id
                sku
                inventoryItem { id }
              }
            }
          }
        }
      }
    }
  }
`;

// utils/graphql.server.ts
export const Q_PRODUCT_BY_BARCODE = /* GraphQL */ `
  query ProductByBarcode($barcode: String!) {
    products(first: 10, query: $barcode) {
      edges {
        node {
          id
          title
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

// utils/graphql.server.ts
export const M_SET_ON_HAND = /* GraphQL */ `
mutation inventorySetOnHandQuantities($inventoryItemId: ID!, $locationId: ID!, $quantity: Int!) {
    inventorySetOnHandQuantities(
        input: {
            reason: "correction"
            setQuantities: {
                inventoryItemId: $inventoryItemId
                locationId: $locationId
                quantity: $quantity
            }
        }
    ) {
        userErrors {
            field
            message
        }
    }
}
`; 

export const M_VARIANT_POLICY = /* GraphQL */ `
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
 


export const Q_ALL_TAGS = /* GraphQL */ `
  query AllTags($first: Int!) {
    shop { productTags(first: $first) { edges { node } } }
  }
`;

// util to extract first variant + inventoryItem
export function pickVariantIds(data: any): { variantId?: string; inventoryItemId?: string; productId?: string } {
  const variant = data?.products?.edges?.[0]?.node?.variants?.edges?.[0]?.node;
  
  // Extract productId from the product node
  const productId = data?.products?.edges?.[0]?.node?.id;  // Assuming productId is directly on the product node

  return {
    variantId: variant?.id,
    inventoryItemId: variant?.inventoryItem?.id,
    productId: productId,  // Add productId here
  };
}
