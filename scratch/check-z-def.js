async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  const idx = t.indexOf('z=(e,t)=>{');
  if (idx !== -1) {
    console.log(t.slice(idx, idx + 3000));
  }
}
run().catch(console.error);
