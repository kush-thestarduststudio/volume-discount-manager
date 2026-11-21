async function testLoyalRequirements() {
  const token = 'c08d56cae211c47c68cb3cd03b882be8';
  for (const qty of [1, 2, 3, 4]) {
    const addRes = await fetch('https://thestarduststudio.com/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ id: 46920435957812, quantity: qty }] })
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
      body: JSON.stringify({ query, variables: { id: cartId, discountCodes: ['LOYAL'] } })
    });
    const sfData = await sfRes.json();
    console.log(`Qty ${qty} (₹${qty * 400}) with LOYAL:`, JSON.stringify(sfData.data?.cartDiscountCodesUpdate?.cart?.discountCodes));

    await fetch('https://thestarduststudio.com/cart/clear.js', { method: 'POST', headers: { 'Cookie': cookie } });
  }
}
testLoyalRequirements().catch(console.error);
