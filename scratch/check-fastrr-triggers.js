async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();
  const re = /trigger:\s*["']([^"']+)["']/g;
  let m;
  const triggers = new Set();
  while ((m = re.exec(t)) !== null) {
    triggers.add(m[1]);
  }
  console.log('Found triggers:', Array.from(triggers));
}
run().catch(console.error);
