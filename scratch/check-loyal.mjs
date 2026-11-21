async function checkLoyal() {
  const token = 'c08d56cae211c47c68cb3cd03b882be8';
  // Let's test LOYAL with different cart totals: 599 vs 1000 vs 1600!
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
            cost { totalAmount { amount } subtotalAmount { amount } }
            discountCodes { code applicable }
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
    const data = await sfRes.json();
    const dCodes = data.data?.cartDiscountCodesUpdate?.cart?.discountCodes;
    const cost = data.data?.cartDiscountCodesUpdate?.cart?.cost;
    console.log(`Qty ${qty} (Subtotal ₹${qty * 400}): LOYAL applicable?`, dCodes?.[0]?.applicable, 'Cost:', cost?.totalAmount?.amount);

    await fetch('https://thestarduststudio.com/cart/clear.js', { method: 'POST', headers: { 'Cookie': cookie } });
  }
}
checkLoyal().catch(console.error);
