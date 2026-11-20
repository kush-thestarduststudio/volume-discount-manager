async function run() {
  const r = await fetch('https://cdn.shopify.com/extensions/01a1e958-7277-7672-a766-00ff8e06dbe4/lb-upsell-470/assets/lb-selleasy.js');
  const t = await r.text();
  console.log('lb-selleasy.js size:', t.length);

  // Search for how it applies discounts or handles cart/checkout
  const keywords = ['discount', 'checkout', 'coupon', 'cart/change', 'cart/add', 'shiprocket', 'fastrr', 'properties'];
  for (const kw of keywords) {
    let count = 0;
    let idx = 0;
    while ((idx = t.indexOf(kw, idx)) !== -1) {
      count++;
      idx += kw.length;
    }
    console.log(`Keyword "${kw}": ${count} occurrences`);
  }
}
run().catch(console.error);
