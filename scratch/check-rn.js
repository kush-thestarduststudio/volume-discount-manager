async function run() {
  const r = await fetch('https://cdn.shopify.com/extensions/01a1aadd-5e78-72cd-8295-3e65bff7f8e1/shiprocket-smart-cart-259/assets/smart-cart.min.js');
  const t = await r.text();

  const idx = t.indexOf('Rn=');
  console.log('--- Rn definition ---');
  console.log(t.slice(idx, idx + 800));
}
run().catch(console.error);
