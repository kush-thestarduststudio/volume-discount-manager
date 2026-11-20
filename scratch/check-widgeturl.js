async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  const idx = t.indexOf('widgetUrl');
  if (idx !== -1) {
    console.log(t.slice(Math.max(0, idx - 400), idx + 200));
  }
}
run().catch(console.error);
