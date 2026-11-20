async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  const idx = t.indexOf('m(Ze, z)');
  console.log('Around m(Ze, z):');
  console.log(t.slice(idx - 200, idx + 400));

  // Find z definition
  const idxZ = t.indexOf('z=');
  console.log('Around z=:');
  console.log(t.slice(idxZ, idxZ + 1200));
}
run().catch(console.error);
