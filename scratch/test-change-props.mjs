async function run() {
  // 1. Add 1 item
  const addRes = await fetch('https://thestarduststudio.com/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ id: 46920435957812, quantity: 1 }] })
  });
  const cookie = addRes.headers.get('set-cookie');
  const cartRes = await fetch('https://thestarduststudio.com/cart.js', {
    headers: { 'Cookie': cookie }
  });
  const cart = await cartRes.json();
  const lineItem = cart.items[0];
  console.log('1. Initial item properties:', lineItem.properties);

  // 2. Change quantity to 2 and add properties
  const changeRes = await fetch('https://thestarduststudio.com/cart/change.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      id: lineItem.key,
      quantity: 2,
      properties: {
        _isYtBundle: "true",
        _bundleItems: JSON.stringify([{ variantId: 46920435957812, quantity: 2, price: 360 }])
      }
    })
  });
  const changedCart = await changeRes.json();
  console.log('2. Updated item properties:', changedCart.items[0]?.properties);

  // Clean up
  await fetch('https://thestarduststudio.com/cart/clear.js', {
    method: 'POST',
    headers: { 'Cookie': cookie }
  });
  console.log('Cleaned up.');
}
run().catch(console.error);
