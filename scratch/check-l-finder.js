async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  // Find where l is called with "/cart.js"
  const idx = t.indexOf('l("/cart.js"');
  console.log('Index of l("/cart.js"):', idx);

  // Search backward for the definition of l
  // Let's find all function declarations or arrow functions before idx
  const scope = t.slice(0, idx);
  // Look for `l = function` or `function l(` or `l = (` or `const l =`
  const pos = scope.lastIndexOf('function l(');
  console.log('lastIndexOf function l(:', pos);
  if (pos !== -1) {
    console.log(scope.slice(pos, pos + 400));
  } else {
    // Search regex in scope
    const matches = [...scope.matchAll(/\b([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g)];
    console.log('Last 10 arrow funcs:');
    for (const m of matches.slice(-10)) {
      console.log(m[0], 'at', m.index);
    }
  }
}
run().catch(console.error);
