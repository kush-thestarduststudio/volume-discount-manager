async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  const idx = t.indexOf('Ge=');
  console.log('--- Ge definition ---');
  console.log(t.slice(idx, idx + 2000));
}
run().catch(console.error);
