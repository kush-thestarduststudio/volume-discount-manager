async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  const idx = t.indexOf('Ze=');
  console.log('--- Ze definition ---');
  console.log(t.slice(idx, idx + 3000));
}
run().catch(console.error);
