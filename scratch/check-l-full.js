async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();
  const idx = t.indexOf('l=async');
  console.log(t.slice(idx, idx + 800));
}
run().catch(console.error);
