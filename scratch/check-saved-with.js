async function run() {
  const r = await fetch('https://cdn.shopify.com/extensions/01a1aadd-5e78-72cd-8295-3e65bff7f8e1/shiprocket-smart-cart-259/assets/smart-cart.min.js');
  const t = await r.text();

  // Search case insensitive "saved with"
  const re = /saved with/gi;
  let m;
  while ((m = re.exec(t)) !== null) {
    console.log('--- FOUND ---');
    console.log(t.slice(Math.max(0, m.index - 150), m.index + 200));
  }

  // Also search "saved" followed by coupon
  const re2 = /saved[^<]*with/gi;
  while ((m = re2.exec(t)) !== null) {
    console.log('--- FOUND 2 ---');
    console.log(t.slice(Math.max(0, m.index - 150), m.index + 200));
  }
}
run().catch(console.error);
