async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  const idx = t.indexOf('checkoutBuyer');
  console.log('--- checkoutBuyer definition ---');
  console.log(t.slice(Math.max(0, idx - 50), idx + 200));
}
run().catch(console.error);
