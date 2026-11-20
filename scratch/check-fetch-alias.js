async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  // Search if fetch is assigned to any variable
  let idx = 0;
  while ((idx = t.indexOf('fetch', idx)) !== -1) {
    console.log(t.slice(Math.max(0, idx - 40), idx + 40));
    idx += 5;
    if (idx > 2000) break;
  }
}
run().catch(console.error);
