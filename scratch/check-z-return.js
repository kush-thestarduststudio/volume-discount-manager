async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();
  const idx = t.indexOf('z=(e,t)=>{');
  // print from idx to 2500 chars
  console.log(t.slice(idx + 1800, idx + 3500));
}
run().catch(console.error);
