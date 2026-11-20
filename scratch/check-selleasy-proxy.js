async function run() {
  const r = await fetch('https://cdn.shopify.com/extensions/01a1e958-7277-7672-a766-00ff8e06dbe4/lb-upsell-470/assets/lb-selleasy.js');
  const t = await r.text();
  const idx = t.indexOf('PROXY_PATH');
  if (idx !== -1) {
    console.log(t.slice(Math.max(0, idx - 100), idx + 200));
  }
}
run().catch(console.error);
