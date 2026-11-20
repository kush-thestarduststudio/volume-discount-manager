async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();
  
  const idxMe = t.indexOf('Me=');
  if (idxMe !== -1) {
    console.log('--- FOUND Me ---');
    console.log(t.slice(idxMe, idxMe + 1200));
  }

  const idxK = t.indexOf('K=');
  if (idxK !== -1) {
    console.log('--- FOUND K ---');
    console.log(t.slice(idxK, idxK + 1200));
  }
}
run().catch(console.error);
