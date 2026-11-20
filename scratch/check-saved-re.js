async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();
  const re = /(Saved|saved|Save)\s*₹?[\d.]+/g;
  let m;
  while ((m = re.exec(t)) !== null) {
    console.log('Match:', m[0], 'around:', t.slice(Math.max(0, m.index - 50), m.index + 100));
  }
}
run().catch(console.error);
