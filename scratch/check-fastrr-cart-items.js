async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  // Search for how items or prices are passed to checkout
  const idx = t.indexOf('shopifyCartItems');
  if (idx !== -1) {
    console.log(t.slice(Math.max(0, idx - 100), idx + 600));
  }
}
run().catch(console.error);
