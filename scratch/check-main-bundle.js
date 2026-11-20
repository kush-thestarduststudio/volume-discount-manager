async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/static/js/main.9447a641f4155db6cd3b.js');
  const t = await r.text();
  console.log('main bundle length:', t.length);

  // Search how cart is parsed from hash
  const idx = t.indexOf('location.hash');
  if (idx !== -1) {
    console.log('--- location.hash ---');
    console.log(t.slice(Math.max(0, idx - 50), idx + 400));
  }

  // Search _isYtBundle or _bundleItems or price calculation in the buyer iframe
  for (const word of ['_isYtBundle', '_bundleItems', 'fastrrCart', 'products', 'subtotal', 'bill_summary']) {
    let i = 0, count = 0;
    while ((i = t.indexOf(word, i)) !== -1) {
      count++;
      if (count <= 2) {
        console.log(`--- Match for ${word} ---`);
        console.log(t.slice(Math.max(0, i - 100), i + 200));
      }
      i += word.length;
    }
  }
}
run().catch(console.error);
