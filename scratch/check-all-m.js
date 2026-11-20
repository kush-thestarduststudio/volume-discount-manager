async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  // Search entire file for m = ( or m = function
  const allM = [...t.matchAll(/(?:var|let|const|,)\s*m\s*=\s*(?:\([^)]*\)|function|\w+)\s*=>/g)];
  for (const m of allM) {
    console.log('m at', m.index, ':', t.slice(m.index, m.index + 100));
  }
}
run().catch(console.error);
