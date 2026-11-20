async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();
  const idx = t.indexOf('for(let t of e.items){');
  console.log(t.slice(idx - 1000, idx));
}
run().catch(console.error);
