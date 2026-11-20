async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  // Search for how fastrr talks to backend or creates checkout
  const matches = t.match(/https?:\/\/[a-zA-Z0-9.-]+\.pickrr\.com\/[^\s"'`)]+/g) || [];
  const unique = Array.from(new Set(matches));
  console.log('Pickrr endpoints in shopify.js:');
  console.log(unique);
}
run().catch(console.error);
