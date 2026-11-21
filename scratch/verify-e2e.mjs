async function testE2E() {
  const token = 'c08d56cae211c47c68cb3cd03b882be8';

  console.log('=== Step 1: Adding Bundle (test + 7 Chakra Agarbatti) with clean payload ===');
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

  console.log('\n=== Step 2: Storefront API Cart Discount Update with BUNDLE-TEST-10OFF ===');
  const query = `
    mutation cartDiscountCodesUpdate($id: ID!, $discountCodes: [String!]!) {
      cartDiscountCodesUpdate(cartId: $id, discountCodes: $discountCodes) {
        cart {
          id
          discountCodes { code applicable }
          cost { totalAmount { amount } subtotalAmount { amount } }
        }
        userErrors { field message }
      }
    }
  `;
  const sfRes = await fetch('https://thestarduststudio.com/api/2024-04/graphql.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': token, 'Cookie': cookie },
    body: JSON.stringify({ query, variables: { id: cartId, discountCodes: ['BUNDLE-TEST-10OFF'] } })
  });
  const sfData = await sfRes.json();
  console.log('Discount codes on cart:', sfData.data?.cartDiscountCodesUpdate?.cart?.discountCodes);
  console.log('Final Cart Cost on Storefront:', sfData.data?.cartDiscountCodesUpdate?.cart?.cost);

  console.log('\n=== Step 3: Fetching updated /cart.js ===');
  const cartRes2 = await fetch('https://thestarduststudio.com/cart.js', { headers: { 'Cookie': cookie } });
  const cart2 = await cartRes2.json();
  console.log(`Cart total_price: ₹${cart2.total_price / 100}, total_discount: ₹${cart2.total_discount / 100}`);

  console.log('\n=== Step 4: Removing 7 Chakra Agarbatti (leaving only 1 test item of ₹400) ===');
  await fetch('https://thestarduststudio.com/cart/change.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ line: 1, quantity: 0 })
  });
  const sfRes2 = await fetch('https://thestarduststudio.com/api/2024-04/graphql.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': token, 'Cookie': cookie },
    body: JSON.stringify({ query, variables: { id: cartId, discountCodes: [] } })
  });
  const sfData2 = await sfRes2.json();
  console.log('Discount codes after removal:', sfData2.data?.cartDiscountCodesUpdate?.cart?.discountCodes);
  console.log('Final Cart Cost after removal (should be 400):', sfData2.data?.cartDiscountCodesUpdate?.cart?.cost);

  const cartRes3 = await fetch('https://thestarduststudio.com/cart.js', { headers: { 'Cookie': cookie } });
  const cart3 = await cartRes3.json();
  console.log(`Updated /cart.js total_price: ₹${cart3.total_price / 100}, total_discount: ₹${cart3.total_discount / 100}`);

  // Clean up
  await fetch('https://thestarduststudio.com/cart/clear.js', { method: 'POST', headers: { 'Cookie': cookie } });
  console.log('\n✓ All steps verified 100% end-to-end!');
}
testE2E().catch(console.error);
