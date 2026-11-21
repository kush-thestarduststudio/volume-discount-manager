async function testCheckout() {
  const token = 'c08d56cae211c47c68cb3cd03b882be8';

  // 1. Create a cart with test (400) + 7 chakra agarbatti (199)
  const query = `
    mutation cartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          id
          checkoutUrl
          totalQuantity
          cost {
            subtotalAmount { amount }
            totalAmount { amount }
            totalAmountEstimated
          }
          lines(first: 10) {
            nodes {
              id
              quantity
              merchandise {
                ... on ProductVariant {
                  id
                  title
                  price { amount }
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
          discountAllocations {
            discountedAmount { amount }
            discountApplication {
              __typename
              targetSelection
              targetType
              value {
                ... on PricingPercentageValue { percentage }
                ... on MoneyV2 { amount }
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
          ]
        }
      }
    })
  })).json();

  const cart = sf.data?.cartCreate?.cart;
  console.log('Cart subtotal:', cart?.cost?.subtotalAmount?.amount);
  console.log('Cart total:', cart?.cost?.totalAmount?.amount);
  console.log('Discount allocations:', JSON.stringify(cart?.discountAllocations, null, 2));
  cart?.lines?.nodes?.forEach(l => {
    console.log(l.merchandise?.product?.title, 'qty:', l.quantity, 'subtotal:', l.cost?.subtotalAmount?.amount, 'total:', l.cost?.totalAmount?.amount, 'discounts:', JSON.stringify(l.discountAllocations));
  });
}
testCheckout().catch(console.error);
