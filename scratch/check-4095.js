async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();
  console.log(t.slice(4080, 4300));
}
run().catch(console.error);
