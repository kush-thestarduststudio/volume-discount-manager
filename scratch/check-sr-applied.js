async function run() {
  const r = await fetch('https://cdn.shopify.com/extensions/01a1aadd-5e78-72cd-8295-3e65bff7f8e1/shiprocket-smart-cart-259/assets/smart-cart.min.js');
  const t = await r.text();

  let idx = 0;
  while ((idx = t.indexOf('saved with', idx)) !== -1) {
    console.log('--- MATCH ---');
    console.log(t.slice(Math.max(0, idx - 150), idx + 200));
    idx += 10;
  }

  // Also search how applied coupon is rendered in smart cart
  const idx2 = t.indexOf('applied-coupon');
  if (idx2 !== -1) {
    console.log('--- applied-coupon ---');
    console.log(t.slice(idx2 - 100, idx2 + 300));
  }

  const idx3 = t.indexOf('sr-applied-coupon');
  if (idx3 !== -1) {
    console.log('--- sr-applied-coupon ---');
    console.log(t.slice(idx3 - 100, idx3 + 300));
  }
}
run().catch(console.error);
