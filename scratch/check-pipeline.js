async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  for (const name of ['$e', 'Qe', 'Ye', 'Ke', 'Ve']) {
    const idx = t.indexOf(`${name}=`);
    if (idx !== -1) {
      console.log(`--- ${name} definition ---`);
      console.log(t.slice(idx, idx + 800));
    }
  }
}
run().catch(console.error);
