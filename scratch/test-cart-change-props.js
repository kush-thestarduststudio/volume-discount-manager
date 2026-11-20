async function testPropertyUpdate() {
  // Add 1 item
  const addRes = await fetch('https://thestarduststudio.com/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ id: 46920435957812, quantity: 2 }] })
  });
  const cookie = addRes.headers.get('set-cookie');

  // Update properties via /cart/change.js
  const changeRes = await fetch('https://thestarduststudio.com/cart/change.js', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie || ''
    },
    body: JSON.stringify({
      id: 46920435957812,
      quantity: 2,
      properties: {
        _isYtBundle: 'true',
        _bundleItems: JSON.stringify([
          { variantId: 46920435957812, quantity: 2, price: 360 }
        ])
      }
    })
  });
  const cart = await changeRes.json();
  console.log('Cart item properties after change.js:');
  console.log(JSON.stringify(cart.items.map(it => ({
    id: it.id,
    title: it.title,
    quantity: it.quantity,
    properties: it.properties
  })), null, 2));
}

testPropertyUpdate().catch(console.error);
