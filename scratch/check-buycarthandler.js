async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  const idx = t.indexOf('shiprocketCheckoutBuyCartHandler');
  if (idx !== -1) {
    console.log('Context around shiprocketCheckoutBuyCartHandler:');
    console.log(t.slice(idx, idx + 1500));
  }
}
run().catch(console.error);
