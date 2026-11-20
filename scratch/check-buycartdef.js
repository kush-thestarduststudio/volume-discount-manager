async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  const idx = t.indexOf('function shiprocketCheckoutBuyCartHandler');
  if (idx !== -1) {
    console.log(t.slice(idx, idx + 1500));
  } else {
    const idx2 = t.indexOf('shiprocketCheckoutBuyCartHandler=');
    console.log(t.slice(idx2, idx2 + 1500));
  }
}
run().catch(console.error);
