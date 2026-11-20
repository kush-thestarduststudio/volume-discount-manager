async function test() {
  const token = 'c08d56cae211c47c68cb3cd03b882be8';
  // 3 items of Test (₹1200)
  const addRes = await fetch('https://thestarduststudio.com/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ id: 46920435957812, quantity: 3 }] })
  });
  const cookie = addRes.headers.get('set-cookie');
  const cartRes = await fetch('https://thestarduststudio.com/cart.js', { headers: { 'Cookie': cookie } });
  const cart = await cartRes.json();
  const cartId = `gid://shopify/Cart/${cart.token}`;

  const query = `
    mutation cartDiscountCodesUpdate($id: ID!, $discountCodes: [String!]!) {
      cartDiscountCodesUpdate(cartId: $id, discountCodes: $discountCodes) {
        cart {
          discountCodes {
            code
            applicable
          }
          discountAllocations {
            discountedAmount { amount }
            ... on CartAutomaticDiscountAllocation { title }
            ... on CartCodeDiscountAllocation { code }
          }
          cost {
            totalAmount { amount }
            subtotalAmount { amount }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  const sfRes = await fetch('https://thestarduststudio.com/api/2024-04/graphql.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': token, 'Cookie': cookie },
    body: JSON.stringify({ query, variables: { id: cartId, discountCodes: ['LOYAL'] } })
  });
  console.log(JSON.stringify(await sfRes.json(), null, 2));

  await fetch('https://thestarduststudio.com/cart/clear.js', { method: 'POST', headers: { 'Cookie': cookie } });
}
test().catch(console.error);
