async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  let idx = 0;
  while ((idx = t.indexOf('coupon', idx)) !== -1) {
    console.log('--- coupon match ---');
    console.log(t.slice(Math.max(0, idx - 100), idx + 200));
    idx += 6;
  }
}
run().catch(console.error);
