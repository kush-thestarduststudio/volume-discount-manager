async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  // Find Ve=, Ke=, Ye=, Qe=, $e=
  for (const name of ['Ve', 'Ke', 'Ye', 'Qe', '$e']) {
    const idx = t.indexOf(name + '=');
    console.log(name, 'at', idx, ':', t.slice(idx, idx + 400));
    console.log('---');
  }
}
run().catch(console.error);
