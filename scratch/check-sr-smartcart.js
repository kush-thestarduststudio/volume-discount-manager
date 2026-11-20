async function run() {
  const r = await fetch('https://cdn.shopify.com/extensions/01a1aadd-5e78-72cd-8295-3e65bff7f8e1/shiprocket-smart-cart-259/assets/smart-cart.min.js');
  const t = await r.text();
  console.log('Size:', t.length);

  const idx = t.indexOf('handleShiprocketSmartCartBuy');
  console.log('handleShiprocketSmartCartBuy at:', idx);
  console.log(t.slice(idx - 100, idx + 800));

  // Also search for window.checkoutBuyer
  const idxBuyer = t.indexOf('checkoutBuyer');
  console.log('checkoutBuyer at:', idxBuyer);
  console.log(t.slice(idxBuyer - 100, idxBuyer + 500));
}
run().catch(console.error);
