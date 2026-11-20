async function run() {
  const token = 'c08d56cae211c47c68cb3cd03b882be8';

  const addRes = await fetch('https://thestarduststudio.com/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [
        { id: 46920435957812, quantity: 1 },
        { id: 67910792216628, quantity: 1 }
      ]
    })
  });
  const cookie = addRes.headers.get('set-cookie');
  const cartRes = await fetch('https://thestarduststudio.com/cart.js', {
    headers: { 'Cookie': cookie }
  });
  const cart = await cartRes.json();
  const cartId = `gid://shopify/Cart/${cart.token}`;

  const query = `
    mutation cartDiscountCodesUpdate($id: ID!, $discountCodes: [String!]!) {
      cartDiscountCodesUpdate(cartId: $id, discountCodes: $discountCodes) {
        cart {
          id
          discountCodes {
            code
            applicable
          }
          lines(first: 10) {
            nodes {
              id
              quantity
              cost {
                totalAmount { amount }
                subtotalAmount { amount }
              }
              discountAllocations {
                discountedAmount { amount }
                ... on CartCodeDiscountAllocation { code }
                ... on CartAutomaticDiscountAllocation { title }
              }
            }
          }
          cost {
            subtotalAmount { amount }
            totalAmount { amount }
          }
        }
        userErrors { field message }
      }
    }
  `;

  const sfRes = await fetch('https://thestarduststudio.com/api/2024-04/graphql.json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
      'Cookie': cookie
    },
    body: JSON.stringify({
      query,
      variables: { id: cartId, discountCodes: ['BUNDLE-TEST-10OFF'] }
    })
  });
  const sfData = await sfRes.json();
  console.log('User errors:', sfData.data?.cartDiscountCodesUpdate?.userErrors);
  console.log('Discount codes:', sfData.data?.cartDiscountCodesUpdate?.cart?.discountCodes);
  console.log('Lines:', JSON.stringify(sfData.data?.cartDiscountCodesUpdate?.cart?.lines, null, 2));
  console.log('Cost:', JSON.stringify(sfData.data?.cartDiscountCodesUpdate?.cart?.cost, null, 2));

  // Clean up
  await fetch('https://thestarduststudio.com/cart/clear.js', {
    method: 'POST',
    headers: { 'Cookie': cookie }
  });
}
run().catch(console.error);
