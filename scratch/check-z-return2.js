async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();
  const idx = t.indexOf('z=(e,t)=>{');
  console.log(t.slice(idx + 3300, idx + 4500));
}
run().catch(console.error);
