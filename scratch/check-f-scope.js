async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();
  const idx = t.indexOf('_isYtBundle');
  console.log(t.slice(idx - 600, idx + 200));
}
run().catch(console.error);
