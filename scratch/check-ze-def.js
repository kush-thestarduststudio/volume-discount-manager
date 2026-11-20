async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  // Find Ze=
  const matches = [...t.matchAll(/(?:var|let|const|,)\s*Ze\s*=\s*/g)];
  for (const match of matches) {
    console.log('Ze at', match.index, ':', t.slice(match.index, match.index + 500));
  }
}
run().catch(console.error);
