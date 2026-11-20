async function run() {
  const r = await fetch('https://cdn.shopify.com/extensions/01a1aadd-5e78-72cd-8295-3e65bff7f8e1/shiprocket-smart-cart-259/assets/smart-cart.min.js');
  const t = await r.text();

  // Search for how checkout is initiated
  const terms = ['handleShiprocketSmartCartBuy', 'buyCart', 'checkoutBuyer', 'initiateCart'];
  for (const term of terms) {
    const idx = t.indexOf(term);
    if (idx !== -1) {
      console.log(`=== Found ${term} ===`);
      console.log(t.slice(Math.max(0, idx - 100), idx + 400));
    }
  }
}

run().catch(console.error);
