async function run() {
  const r = await fetch('https://cdn.shopify.com/extensions/01a1aadd-5e78-72cd-8295-3e65bff7f8e1/shiprocket-smart-cart-259/assets/smart-cart.min.js');
  const t = await r.text();

  let idx = 0;
  while ((idx = t.indexOf('/cart/change', idx)) !== -1) {
    console.log('--- FOUND /cart/change in smart-cart.min.js ---');
    console.log(t.slice(Math.max(0, idx - 100), idx + 300));
    idx += 12;
  }
}
run().catch(console.error);
