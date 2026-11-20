async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();
  const allM = [...t.matchAll(/(?:var|let|const|,)\s*m=([^,;]+)/g)];
  for (const m of allM) {
    if (m[1].length < 100) {
      console.log('m= at', m.index, ':', m[1]);
    }
  }
}
run().catch(console.error);
