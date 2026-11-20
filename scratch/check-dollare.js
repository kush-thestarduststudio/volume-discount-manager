async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  const idx = t.indexOf('$e=');
  if (idx !== -1) {
    console.log(t.slice(idx, idx + 1500));
  }
}
run().catch(console.error);
