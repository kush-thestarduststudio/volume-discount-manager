async function run() {
  const r = await fetch('https://cdn.shopify.com/extensions/01a1aadd-5e78-72cd-8295-3e65bff7f8e1/shiprocket-smart-cart-259/assets/smart-cart.min.js');
  const t = await r.text();

  // Search where item price is rendered in cart drawer
  const idx = t.indexOf('final_price');
  if (idx !== -1) {
    console.log('--- final_price in smart-cart ---');
    console.log(t.slice(Math.max(0, idx - 50), idx + 200));
  } else {
    console.log('final_price NOT in smart-cart');
    // search discounted_price or price
    const idx2 = t.indexOf('discounted_price');
    if (idx2 !== -1) console.log('discounted_price in smart-cart:', t.slice(idx2 - 50, idx2 + 100));
  }
}
run().catch(console.error);
