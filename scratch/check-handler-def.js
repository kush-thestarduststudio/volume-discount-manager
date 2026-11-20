async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  // Find where shiprocketCheckoutBuyCartHandler is DEFINED
  const idx = t.indexOf('function shiprocketCheckoutBuyCartHandler');
  const idx2 = t.indexOf('shiprocketCheckoutBuyCartHandler=');
  const idx3 = t.indexOf('shiprocketCheckoutBuyCartHandler:');
  console.log('Definitions indices:', { idx, idx2, idx3 });

  // Print context around the function definition
  const target = idx !== -1 ? idx : (idx2 !== -1 ? idx2 : idx3);
  if (target !== -1) {
    console.log(t.slice(target - 100, target + 1500));
  }
}
run().catch(console.error);
