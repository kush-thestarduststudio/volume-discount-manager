async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();
  const idx = t.indexOf('m(Ze,z)');
  console.log(t.slice(idx - 100, idx + 200));
}
run().catch(console.error);
