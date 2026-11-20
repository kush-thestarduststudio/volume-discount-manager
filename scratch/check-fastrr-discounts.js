async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  const keywords = ['total_discount', 'discount_codes', 'discount_applications', 'discountCode', 'appliedDiscount'];
  for (const kw of keywords) {
    let idx = 0;
    let count = 0;
    while ((idx = t.indexOf(kw, idx)) !== -1) {
      count++;
      console.log(`--- Keyword: ${kw} ---`);
      console.log(t.slice(Math.max(0, idx - 100), idx + 200));
      idx += kw.length;
    }
  }
}
run().catch(console.error);
