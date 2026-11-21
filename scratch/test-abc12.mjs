async function testAbc12() {
  const token = 'c08d56cae211c47c68cb3cd03b882be8';

  const query = `
    mutation cartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          id
          cost {
            subtotalAmount { amount }
            totalAmount { amount }
          }
          lines(first: 5) {
            nodes {
              merchandise {
                ... on ProductVariant {
                  product { title }
                }
              }
              cost {
                subtotalAmount { amount }
                totalAmount { amount }
              }
              discountAllocations {
                discountedAmount { amount }
              }
            }
          }
          discountCodes {
            code
            applicable
          }
        }
        userErrors { field message }
      }
    }
  `;

  // Test with BUNDLE-TEST-10OFF + abc12 (abc12 is ACTIVE)
  const sf = await (await fetch('https://thestarduststudio.com/api/2024-04/graphql.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': token },
    body: JSON.stringify({
      query,
      variables: {
        input: {
          lines: [
            { merchandiseId: 'gid://shopify/ProductVariant/46920435957812', quantity: 1 }, // test (400)
            { merchandiseId: 'gid://shopify/ProductVariant/67911497547828', quantity: 1 }, // 7 chakra (199)
          ],
          discountCodes: ['BUNDLE-TEST-10OFF', 'abc12']
        }
      }
    })
  })).json();

  const cart = sf.data?.cartCreate?.cart;
  console.log('Discount codes:', JSON.stringify(cart?.discountCodes));
  console.log('Subtotal:', cart?.cost?.subtotalAmount?.amount);
  console.log('Total:', cart?.cost?.totalAmount?.amount);
}
testAbc12().catch(console.error);
