async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();
  console.log('shopify.js length:', t.length);

  const idx = t.indexOf('buyCart');
  if (idx !== -1) {
    console.log('Context around buyCart:');
    console.log(t.slice(Math.max(0, idx - 100), idx + 800));
  }
}
run().catch(console.error);
