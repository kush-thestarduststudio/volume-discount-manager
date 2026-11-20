async function run() {
  const r = await fetch('https://cdn.shopify.com/extensions/01a1aadd-5e78-72cd-8295-3e65bff7f8e1/shiprocket-smart-cart-259/assets/liquid-handlers.min.js');
  const t = await r.text();
  console.log('liquid-handlers.min.js length:', t.length);

  const idx = t.indexOf('saved with');
  if (idx !== -1) {
    console.log('Found "saved with":');
    console.log(t.slice(Math.max(0, idx - 200), idx + 200));
  } else {
    // search "saved"
    let idx2 = t.indexOf('saved');
    if (idx2 !== -1) console.log(t.slice(idx2 - 100, idx2 + 200));
  }
}
run().catch(console.error);
