async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();
  const idx = t.indexOf('l("/cart.js"');
  // Look at characters around 58558
  console.log('Around 58558:');
  console.log(t.slice(58400, 58700));

  // Also look at the other occurrences of l("/cart.js") or where l is assigned in that file
  const allL = [...t.matchAll(/l\s*=\s*(?:async\s*)?\([^)]*\)/g)];
  for (const m of allL) {
    console.log('l assignment at', m.index, ':', t.slice(m.index, m.index + 200));
  }
}
run().catch(console.error);
