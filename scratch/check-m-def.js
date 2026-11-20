async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  // Find m= or function m(
  const matches = [...t.matchAll(/(?:var|let|const|function)\s+m\s*=\s*|function\s+m\s*\(/g)];
  for (const match of matches) {
    console.log('Match at', match.index, ':', t.slice(match.index, match.index + 200));
  }
}
run().catch(console.error);
