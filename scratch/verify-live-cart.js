async function run() {
  // Step 1: Add 1 test product without any bundle properties (simulating PDP native Add to Cart)
  const addRes = await fetch('https://thestarduststudio.com/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ id: 46920435957812, quantity: 1 }] })
  });
  const cookie = addRes.headers.get('set-cookie');
  console.log('Added 1 item. Cookie received.');

  // Step 2: Now simulate updating quantity to 8 (like customer clicking + 7 times in Shiprocket drawer)
  const cartRes = await fetch('https://thestarduststudio.com/cart.js', {
    headers: { 'Cookie': cookie || '' }
  });
  const cart = await cartRes.json();
  const key = cart.items?.[0]?.key;
  console.log('Item key:', key, 'Current qty:', cart.items?.[0]?.quantity);

  const changeRes = await fetch('https://thestarduststudio.com/cart/change.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie || '' },
    body: JSON.stringify({ id: key, quantity: 8 })
  });
  const changedCart = await changeRes.json();
  console.log('Cart updated to 8 items.');
  console.log('Item 0 properties before script sync:', changedCart.items?.[0]?.properties);

  // Step 3: Now simulate what our syncFastrrProperties does for this cart
  // Base price = 400. Tier for 2+ gives 10% off -> 360 (or if 350 from GraphQL)
  const syncPropsRes = await fetch('https://thestarduststudio.com/cart/change.js?_bt=prop_sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie || '' },
    body: JSON.stringify({
      id: key,
      quantity: 8,
      properties: {
        _isYtBundle: 'true',
        _bundleItems: JSON.stringify([{ variantId: 46920435957812, quantity: 8, price: 360 }])
      }
    })
  });
  const syncedCart = await syncPropsRes.json();
  console.log('Properties after sync:', syncedCart.items?.[0]?.properties);

  // Step 4: Verify how Fastrr z() reads this cart
  const fastrrItem = syncedCart.items?.[0];
  const fastrrBundle = JSON.parse(fastrrItem.properties._bundleItems);
  console.log('\n--- FASTRR CHECKOUT VERIFICATION ---');
  console.log('Fastrr detects _isYtBundle:', fastrrItem.properties._isYtBundle === 'true');
  console.log('Fastrr unpacks items:', fastrrBundle);
  console.log('Fastrr line item unit price: ₹' + fastrrBundle[0].price);
  console.log('Fastrr line item total: ₹' + (fastrrBundle[0].price * fastrrBundle[0].quantity));

  // Step 5: Clean up test cart
  await fetch('https://thestarduststudio.com/cart/clear.js', {
    method: 'POST',
    headers: { 'Cookie': cookie || '' }
  });
  console.log('Cart cleared.');
}
run().catch(console.error);
