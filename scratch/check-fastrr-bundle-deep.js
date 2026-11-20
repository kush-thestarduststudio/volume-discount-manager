async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/static/js/main.9447a641f4155db6cd3b.js');
  const t = await r.text();
  console.log('Size:', t.length);

  // Search for how products are parsed from url hash #cart=
  const idx = t.indexOf('JSON.parse(decodeURIComponent');
  console.log('JSON.parse(decodeURIComponent at:', idx);
  if (idx !== -1) {
    console.log(t.slice(idx - 100, idx + 800));
  }

  // Search for _isYtBundle or _bundleItems
  const idxBundle = t.indexOf('_bundleItems');
  console.log('_bundleItems at:', idxBundle);
}
run().catch(console.error);
