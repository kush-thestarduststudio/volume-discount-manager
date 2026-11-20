async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  // Search where products are mapped from cart
  const idx = t.indexOf('.items.map(');
  if (idx !== -1) {
    console.log('Found .items.map:');
    console.log(t.slice(Math.max(0, idx - 100), idx + 400));
  } else {
    const idx2 = t.indexOf('products:');
    console.log('Searching products:');
    console.log(t.slice(idx2, idx2 + 400));
  }
}
run().catch(console.error);
