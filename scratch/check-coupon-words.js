async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  const regex = /coupon[a-zA-Z0-9_]*/gi;
  const matches = new Set(t.match(regex));
  console.log('Coupon matches:', Array.from(matches));

  // Find where coupon is read or passed in Ze
  const idx = t.indexOf('couponCode');
  if (idx !== -1) {
    console.log('\n--- couponCode usage ---');
    console.log(t.slice(Math.max(0, idx - 100), idx + 300));
  }
}
run().catch(console.error);
