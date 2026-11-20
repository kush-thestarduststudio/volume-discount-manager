async function run() {
  const r = await fetch('https://cdn.shopify.com/extensions/01a1e958-7277-7672-a766-00ff8e06dbe4/lb-upsell-470/assets/lb-selleasy.js');
  const t = await r.text();

  // Find module 343 (discountHandler)
  const idx = t.indexOf('343:');
  if (idx !== -1) {
    console.log('--- FOUND Module 343 (discountHandler) ---');
    console.log(t.slice(idx, idx + 4000));
  } else {
    // Search mutateDiscount
    const idx2 = t.indexOf('mutateDiscount:');
    console.log('--- mutateDiscount ---');
    console.log(t.slice(idx2 - 500, idx2 + 2500));
  }
}
run().catch(console.error);
