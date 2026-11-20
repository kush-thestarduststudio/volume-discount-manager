async function run() {
  const shop = 'stardustt-studio.myshopify.com';
  // Let's query via storefront or render sync
  const query = `
    query {
      node(id: "gid://shopify/DiscountAutomaticNode/1652761591860") {
        ... on DiscountAutomaticNode {
          id
          automaticDiscount {
            ... on DiscountAutomaticBasic {
              title
              status
              combinesWith {
                orderDiscounts
                productDiscounts
                shippingDiscounts
              }
              customerGets {
                value {
                  ... on DiscountPercentage { percentage }
                }
                items {
                  ... on DiscountProducts {
                    products(first: 10) {
                      nodes { id title }
                    }
                  }
                }
              }
              minimumRequirement {
                ... on DiscountQuantity {
                  greaterThanOrEqualToQuantity
                }
              }
            }
          }
        }
      }
    }
  `;
  // Let's query sync-discount with this custom query or inspect activeRulesPayload
  console.log('Query ready');
}
run();
