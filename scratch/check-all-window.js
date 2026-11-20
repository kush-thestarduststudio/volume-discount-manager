async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  const allWindow = [...t.matchAll(/window\.([a-zA-Z0-9_$]+)\s*=/g)];
  console.log('Total window assignments:', allWindow.length);
  for (const m of allWindow) {
    console.log('window.' + m[1]);
  }
}
run().catch(console.error);
