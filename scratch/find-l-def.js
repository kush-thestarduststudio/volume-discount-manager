async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();
  // Find where `l("/cart.js", "GET"` is called. In that function, what is `l`?
  // Let's search for `l=` where l is a function that takes (url, method, ...)
  const matches = [...t.matchAll(/(?:var|let|const|,)\s*l\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g)];
  for (const m of matches) {
    if (m[1].includes(',') || m[1].includes('url') || m[1].includes('e')) {
      console.log('Candidate at', m.index, 'args:', m[1]);
      console.log(t.slice(m.index, m.index + 300));
      console.log('---');
    }
  }
}
run().catch(console.error);
