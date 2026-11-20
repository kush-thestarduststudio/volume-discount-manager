async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  // Find definition of function l(
  // Let's find occurrences of `l=` or `function l(` or `let l=` or `const l=`
  const matches = [...t.matchAll(/(?:var|let|const|function)\s+l\s*=[^;]+|function\s+l\s*\([^)]*\)\s*\{/g)];
  for (const m of matches) {
    console.log('Match:', m[0]);
    console.log(t.slice(m.index, m.index + 500));
    console.log('---');
  }
}
run().catch(console.error);
