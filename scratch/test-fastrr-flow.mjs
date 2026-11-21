async function testFastrr() {
  // 1. Add bundle items exactly like our widget does
  const addRes = await fetch('https://thestarduststudio.com/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [
        {
          id: 46920435957812,
          quantity: 1,
          properties: {
            _isYtBundle: "true",
            _bundleItems: JSON.stringify([{
              productId: 7488883753012,
              variantId: 46920435957812,
              title: "test",
              quantity: 1,
              price: 360
            }])
          }
        },
        {
          id: 67911497547828,
          quantity: 1,
          properties: {
            _isYtBundle: "true",
            _bundleItems: JSON.stringify([{
              productId: 15455228297268,
              variantId: 67911497547828,
              title: "7 Chakra Ashtaganda Agarbatti",
              quantity: 1,
              price: 179.10
            }])
          }
        }
      ]
    })
  });
  const cookie = addRes.headers.get('set-cookie');

  // 2. Fetch cart.js
  const cartRes = await fetch('https://thestarduststudio.com/cart.js', {
    headers: { 'Cookie': cookie }
  });
  const cart = await cartRes.json();
  console.log('Cart Items in cart.js:');
  cart.items.forEach(it => {
    console.log(`  Title: ${it.title}`);
    console.log(`  Price: ${it.price}`);
    console.log(`  Properties:`, it.properties);
  });

  // 3. Run Fastrr's z(cart, {}) logic from fastrr-shopify.js!
  let h = [];
  const f = e => {
    try {
      const o = JSON.parse(e.properties?._bundleItems);
      const i = o?.map(t => ({
        variantId: t.variantId,
        quantity: t.quantity,
        price: t.price,
        customAttributes: e.properties
      }));
      if (Array.isArray(o)) h = [...h, ...i];
    } catch (e) {
      console.error('f error:', e);
    }
  };

  for (let t of cart.items) {
    if ("true" === t.properties?._isYtBundle) {
      console.log('Item is _isYtBundle: true!');
      f(t);
    } else {
      console.log('Item is NOT _isYtBundle: true!');
      let i = {
        productId: t.product_id,
        title: t.title,
        variantId: t.variant_id,
        price: parseFloat((t.price / 100).toFixed(2)),
        quantity: t.quantity,
      };
      h.push(i);
    }
  }

  console.log('\nFastrr products payload (h):');
  console.log(JSON.stringify(h, null, 2));

  // Clean up
  await fetch('https://thestarduststudio.com/cart/clear.js', {
    method: 'POST',
    headers: { 'Cookie': cookie }
  });
}
testFastrr().catch(console.error);
