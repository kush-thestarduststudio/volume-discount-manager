async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  const idx = t.indexOf('m(Ze,z)');
  console.log('Index of m(Ze,z):', idx);
  // Find where m is assigned in the outer scope
  // Or check if m is a composer function: m = (f, g) => (x, y) => f(g(x, y))
  // Search backward from idx for `m=`
  const sliceBefore = t.slice(idx - 15000, idx);
  // Look for `m=`
  const mAssigns = [...sliceBefore.matchAll(/\bm\s*=\s*/g)];
  for (const ma of mAssigns) {
    const absIdx = (idx - 15000) + ma.index;
    console.log('m= at', absIdx, ':', t.slice(absIdx, absIdx + 150));
  }
}
run().catch(console.error);
