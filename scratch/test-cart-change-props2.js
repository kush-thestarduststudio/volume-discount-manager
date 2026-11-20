async function testPropertyUpdate() {
  const addRes = await fetch('https://thestarduststudio.com/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ id: 46920435957812, quantity: 2 }] })
  });
  const cookie = addRes.headers.get('set-cookie');
  const addData = await addRes.json();
  console.log('Add response items:', addData.items?.map(it => ({ id: it.id, key: it.key })));

  const key = addData.items?.[0]?.key || '1';

  const changeRes = await fetch('https://thestarduststudio.com/cart/change.js', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie || ''
    },
    body: JSON.stringify({
      id: key,
      quantity: 2,
      properties: {
        _isYtBundle: 'true',
        _bundleItems: JSON.stringify([
          { variantId: 46920435957812, quantity: 2, price: 360 }
        ])
      }
    })
  });
  const text = await changeRes.text();
  console.log('Change status:', changeRes.status);
  console.log('Change response:', text.slice(0, 300));
}

testPropertyUpdate().catch(console.error);
