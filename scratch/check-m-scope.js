async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  const idx = t.indexOf('l("/cart.js","GET",(function(e){');
  console.log('Index:', idx);
  console.log(t.slice(idx - 300, idx + 200));

  // Let's find definition of m
  // In `m(Ze,z)(e,t)`
  // Search backward from idx for `m=` or `function m`
  const scope = t.slice(idx - 2000, idx);
  console.log('--- Scope before idx: ---');
  console.log(scope.slice(-600));
}
run().catch(console.error);
