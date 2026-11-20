async function run() {
  const r = await fetch('https://cdn.shopify.com/extensions/01a1e958-7277-7672-a766-00ff8e06dbe4/lb-upsell-470/assets/lb-selleasy.js');
  const t = await r.text();

  ['discount', 'cart/change', 'cart/add', 'properties'].forEach(kw => {
    console.log(`\n================== KEYWORD: ${kw} ==================`);
    let idx = 0;
    while ((idx = t.indexOf(kw, idx)) !== -1) {
      console.log('--- Context ---');
      console.log(t.slice(Math.max(0, idx - 150), idx + 250));
      idx += kw.length + 100;
    }
  });
}
run().catch(console.error);
