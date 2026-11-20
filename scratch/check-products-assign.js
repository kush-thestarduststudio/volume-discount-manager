async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  let idx = 0;
  while ((idx = t.indexOf('products:', idx + 1)) !== -1) {
    console.log('--- products: at', idx, '---');
    console.log(t.slice(Math.max(0, idx - 50), idx + 250));
  }
}
run().catch(console.error);
