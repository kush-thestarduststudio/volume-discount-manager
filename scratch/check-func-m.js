async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();
  const allFuncM = [...t.matchAll(/function\s+m\s*\([^)]*\)\s*\{[^}]*\}/g)];
  for (const f of allFuncM) {
    console.log('function m at', f.index, ':', f[0]);
  }
}
run().catch(console.error);
