async function run() {
  const r = await fetch('https://cdn.shopify.com/extensions/01a1aadd-5e78-72cd-8295-3e65bff7f8e1/shiprocket-smart-cart-259/assets/smart-cart.min.js');
  const t = await r.text();

  const matches = t.match(/https?:\/\/[a-zA-Z0-9.-]+\.pickrr\.com\/[^\s"'`)]+/g) || [];
  const unique = Array.from(new Set(matches));
  console.log('Pickrr endpoints in smart-cart.min.js:');
  console.log(unique);
}
run().catch(console.error);
