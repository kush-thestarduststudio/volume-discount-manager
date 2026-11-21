async function testBothCodes() {
  const token = 'c08d56cae211c47c68cb3cd03b882be8';

  const addRes = await fetch('https://thestarduststudio.com/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [
        { id: 46920435957812, quantity: 1 },
        { id: 67911497547828, quantity: 1 }
      ]
    })
  });
  const cookie = addRes.headers.get('set-cookie');
  const cartRes = await fetch('https://thestarduststudio.com/cart.js', { headers: { 'Cookie': cookie } });
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
          cost {
            subtotalAmount { amount }
            totalAmount { amount }
          }
        }
        userErrors { field message }
      }
    }
  `;

  // Test 1: Just LOYAL (without bundle code)
  const sf1 = await (await fetch('https://thestarduststudio.com/api/2024-04/graphql.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': token, 'Cookie': cookie },
    body: JSON.stringify({ query, variables: { id: cartId, discountCodes: ['LOYAL'] } })
  })).json();
  console.log('\n--- Test 1: Just LOYAL: ---');
  console.log('Codes:', sf1.data?.cartDiscountCodesUpdate?.cart?.discountCodes);
  console.log('Cost:', sf1.data?.cartDiscountCodesUpdate?.cart?.cost);

  // Test 2: Both BUNDLE-TEST-10OFF and LOYAL
  const sf2 = await (await fetch('https://thestarduststudio.com/api/2024-04/graphql.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': token, 'Cookie': cookie },
    body: JSON.stringify({ query, variables: { id: cartId, discountCodes: ['BUNDLE-TEST-10OFF', 'LOYAL'] } })
  })).json();
  console.log('\n--- Test 2: Both BUNDLE-TEST-10OFF and LOYAL: ---');
  console.log('Codes:', sf2.data?.cartDiscountCodesUpdate?.cart?.discountCodes);
  console.log('Cost:', sf2.data?.cartDiscountCodesUpdate?.cart?.cost);

  // Clean up
  await fetch('https://thestarduststudio.com/cart/clear.js', { method: 'POST', headers: { 'Cookie': cookie } });
}
testBothCodes().catch(console.error);
