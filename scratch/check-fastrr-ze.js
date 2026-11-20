async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  // Search for Ze (the initiation function)
  const idx = t.indexOf('Ze=');
  if (idx !== -1) {
    console.log('--- Ze definition ---');
    console.log(t.slice(idx, idx + 2000));
  }
}
run().catch(console.error);
