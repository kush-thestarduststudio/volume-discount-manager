async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  const idx = t.indexOf('ze=e=>{');
  if (idx !== -1) {
    console.log('--- ze definition ---');
    console.log(t.slice(idx, idx + 2000));
  }
}
run().catch(console.error);
