async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/main.9447a641f4155db6cd3b.js');
  const t = await r.text();
  console.log('Size of main bundle:', t.length);

  // Search for `_isYtBundle` or `_bundleItems`
  const idx = t.indexOf('_isYtBundle');
  const idx2 = t.indexOf('_bundleItems');
  console.log('Indices in main bundle:', { idx, idx2 });

  if (idx !== -1) {
    console.log(t.slice(idx - 100, idx + 400));
  }
}
run().catch(console.error);
