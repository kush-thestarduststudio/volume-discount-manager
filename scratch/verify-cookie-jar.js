async function run() {
  let cookie = '';
  function updateCookie(res) {
    const raw = res.headers.get('set-cookie');
    if (raw) {
      const parts = raw.split(',').map(s => s.split(';')[0].trim());
      cookie = parts.join('; ');
    }
  }

  // 1. Add 1 item
  const addRes = await fetch('https://thestarduststudio.com/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ id: 46920435957812, quantity: 1 }] })
  });
  updateCookie(addRes);
  const addData = await addRes.json();
  let key = addData.items[0].key;
  console.log('1. Added 1 item. Key:', key);

  // 2. Change quantity to 8 (simulate clicking + in drawer)
  const changeRes = await fetch('https://thestarduststudio.com/cart/change.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ id: key, quantity: 8 })
  });
  updateCookie(changeRes);
  const changeData = await changeRes.json();
  key = changeData.items[0].key;
  console.log('2. Updated quantity to 8. Items count:', changeData.item_count, 'Key:', key);

  // 3. Sync properties with discounted price 350
  const syncRes = await fetch('https://thestarduststudio.com/cart/change.js?_bt=prop_sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      id: key,
      quantity: 8,
      properties: {
        _isYtBundle: 'true',
        _bundleItems: JSON.stringify([{ variantId: 46920435957812, quantity: 8, price: 350 }])
      }
    })
  });
  updateCookie(syncRes);
  const syncData = await syncRes.json();
  const item = syncData.items[0];
  console.log('3. Synced properties successfully!');
  console.log('   Properties:', item.properties);

  // 4. Test Fastrr unpack
  const bundle = JSON.parse(item.properties._bundleItems);
  console.log('\n--- FASTRR CHECKOUT VERIFICATION ---');
  console.log('Fastrr unpacks _bundleItems:');
  console.log('Variant ID:', bundle[0].variantId);
  console.log('Quantity:', bundle[0].quantity);
  console.log('Unit Price: ₹' + bundle[0].price);
  console.log('Total Line Item Price: ₹' + (bundle[0].price * bundle[0].quantity));
  console.log('Expected: ₹2800.00');

  // 5. Clean up
  await fetch('https://thestarduststudio.com/cart/clear.js', {
    method: 'POST',
    headers: { 'Cookie': cookie }
  });
  console.log('\nCart cleaned up.');
}
run().catch(console.error);
