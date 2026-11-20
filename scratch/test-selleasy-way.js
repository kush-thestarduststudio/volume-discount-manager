async function test() {
  const token = 'c08d56cae211c47c68cb3cd03b882be8';

  // 1. Add 2 test items (like user clicking Add to Cart on PDP or widget)
  const addRes = await fetch('https://thestarduststudio.com/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ id: 46920435957812, quantity: 2 }] })
  });
  const cookie = addRes.headers.get('set-cookie');
  const cartRes = await fetch('https://thestarduststudio.com/cart.js', {
    headers: { 'Cookie': cookie }
  });
  const cart = await cartRes.json();
  console.log('1. Added 2 items. Cart total:', cart.total_price);

  // 2. Selleasy way: mutateCartDiscountCodes with ['TEST-BUY2-10OFF']
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
      variables: { id: cartId, discountCodes: ['TEST-BUY2-10OFF'] }
    })
  });
  const sfData = await sfRes.json();
  console.log('2. Storefront discount update:', sfData.data?.cartDiscountCodesUpdate?.cart?.discountCodes);

  // 3. What does /cart.js show?
  const cartRes2 = await fetch('https://thestarduststudio.com/cart.js', {
    headers: { 'Cookie': cookie }
  });
  const cart2 = await cartRes2.json();
  console.log('3. /cart.js:');
  console.log('   Original Total:', cart2.original_total_price);
  console.log('   Total Price:', cart2.total_price);
  console.log('   Item 0 final_price:', cart2.items[0]?.final_price);
  console.log('   Item 0 final_line_price:', cart2.items[0]?.final_line_price);

  // 4. Now simulate user reducing quantity to 1 in cart
  const changeRes = await fetch('https://thestarduststudio.com/cart/change.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ id: cart2.items[0].key, quantity: 1 })
  });
  const changedCart = await changeRes.json();
  console.log('\n4. Reduced to 1 item. Quantity:', changedCart.items[0]?.quantity);

  // 5. Quantity is 1 < minQuantity 2 -> Selleasy removes discount code
  const sfRes2 = await fetch('https://thestarduststudio.com/api/2024-04/graphql.json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
      'Cookie': cookie
    },
    body: JSON.stringify({
      query,
      variables: { id: cartId, discountCodes: [] }
    })
  });
  const sfData2 = await sfRes2.json();
  console.log('5. Storefront codes after qty 1:', sfData2.data?.cartDiscountCodesUpdate?.cart?.discountCodes);

  const cartRes3 = await fetch('https://thestarduststudio.com/cart.js', {
    headers: { 'Cookie': cookie }
  });
  const cart3 = await cartRes3.json();
  console.log('6. /cart.js after clearing:');
  console.log('   Total Price:', cart3.total_price);
  console.log('   Item 0 final_price:', cart3.items[0]?.final_price);

  // 7. Clean up
  await fetch('https://thestarduststudio.com/cart/clear.js', {
    method: 'POST',
    headers: { 'Cookie': cookie }
  });
  console.log('\nCart cleaned up.');
}
test().catch(console.error);
