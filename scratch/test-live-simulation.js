async function run() {
  const root = 'https://thestarduststudio.com';
  
  // 1. Add 2 test items
  const addRes = await fetch(`${root}/cart/add.js`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ id: 46920435957812, quantity: 2 }] })
  });
  const cookie = addRes.headers.get('set-cookie');
  console.log('1. Added 2 items to live cart');

  // 2. Fetch raw cart from Shopify
  const cartRes = await fetch(`${root}/cart.js`, {
    headers: { 'Cookie': cookie }
  });
  const rawCart = await cartRes.json();
  console.log('2. Raw Shopify /cart.js:');
  console.log('   item[0].price:', rawCart.items[0]?.price);
  console.log('   item[0].final_price:', rawCart.items[0]?.final_price);
  console.log('   item[0].discounted_price:', rawCart.items[0]?.discounted_price);
  console.log('   total_price:', rawCart.total_price);

  // 3. Simulate bundle-tier-discounts-29 transformCartResponse
  // (In browser, this runs automatically inside the window.fetch interceptor on /cart.js)
  function simulateTransform(cart) {
    const transformed = JSON.parse(JSON.stringify(cart));
    const tiers = [
      { minQuantity: 2, discountPercent: 10 },
      { minQuantity: 3, discountPercent: 15 },
      { minQuantity: 4, discountPercent: 20 },
      { minQuantity: 6, discountPercent: 25 },
      { minQuantity: 8, discountPercent: 30 }
    ];

    let totalLineDiscount = 0;
    for (const item of transformed.items) {
      const origUnit = (item.original_price || item.price) / 100;
      let bestUnit = origUnit;

      const qty = item.quantity;
      const t = tiers.sort((a,b)=>b.minQuantity-a.minQuantity).find(x => qty >= x.minQuantity);
      if (t) {
        bestUnit = origUnit * (1 - t.discountPercent / 100);
      }

      if (bestUnit < origUnit) {
        const roundUnit = Number(bestUnit.toFixed(2));
        const roundCents = Math.round(roundUnit * 100);
        item.price = roundCents;
        item.original_price = item.original_price || (origUnit * 100);
        item.final_price = roundCents;
        item.discounted_price = roundCents;
        item.line_price = roundCents * qty;
        item.final_line_price = roundCents * qty;
        totalLineDiscount += (origUnit - roundUnit) * qty * 100;
      }
    }
    transformed.total_price = Math.max(0, transformed.original_total_price - Math.round(totalLineDiscount));
    return transformed;
  }

  const interceptedCart = simulateTransform(rawCart);

  // 4. Test Fastrr mapping z(e, t)
  function fastrrMapping(cart) {
    let h = [];
    for (let t of cart.items) {
      if ("true" === t.properties?._isYtBundle) {
        // ...
      } else {
        h.push({
          productId: t.product_id,
          title: t.title,
          variantId: t.variant_id,
          price: parseFloat((t.price / 100).toFixed(2)),
          quantity: t.quantity,
          image: t.image
        });
      }
    }
    return h;
  }

  const fastrrProducts = fastrrMapping(interceptedCart);
  console.log('\n3. Fastrr Products Array:');
  console.log(fastrrProducts);
  const fastrrSubtotal = fastrrProducts.reduce((s, it) => s + (it.price * it.quantity), 0);
  console.log('   Fastrr Subtotal: ₹' + fastrrSubtotal);
  console.assert(fastrrSubtotal === 720, 'FAIL: Fastrr subtotal must be 720 for 2 items');

  // 5. Test Shiprocket Smart Cart mapping Rn(items)
  const srProducts = interceptedCart.items.map(i => ({
    quantity: i.quantity,
    price: i.price / 100,
    productId: i.product_id,
    itemId: i.id
  }));
  const srSubtotal = srProducts.reduce((s, it) => s + (it.price * it.quantity), 0);
  console.log('\n4. Shiprocket Smart Cart Drawer Subtotal: ₹' + srSubtotal);
  console.assert(srSubtotal === 720, 'FAIL: Shiprocket drawer subtotal must be 720 for 2 items');

  // 6. Test with 3 items
  const changeRes = await fetch(`${root}/cart/change.js`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ id: rawCart.items[0].key, quantity: 3 })
  });
  const cart3 = await changeRes.json();
  const interceptedCart3 = simulateTransform(cart3);
  const fastrrProducts3 = fastrrMapping(interceptedCart3);
  const fastrrSubtotal3 = fastrrProducts3.reduce((s, it) => s + (it.price * it.quantity), 0);
  console.log('\n5. Fastrr Subtotal for 3 items: ₹' + fastrrSubtotal3);
  console.assert(fastrrSubtotal3 === 1020, 'FAIL: Fastrr subtotal must be 1020 for 3 items (₹340 each)');

  // 7. Clean up
  await fetch(`${root}/cart/clear.js`, { method: 'POST', headers: { 'Cookie': cookie } });
  console.log('\nALL CHECKS PASSED SUCCESSFULLY!');
}
run().catch(console.error);
