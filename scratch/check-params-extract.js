async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/static/js/main.9447a641f4155db6cd3b.js');
  const t = await r.text();
  console.log(t.slice(751500, 752600));
}
run().catch(console.error);
