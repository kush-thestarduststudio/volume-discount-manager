async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/');
  const t = await r.text();
  console.log('Index HTML:', t);
}
run().catch(console.error);
