async function run() {
  const urls = [
    'https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js',
    'https://fastrr-boost-ui.pickrr.com/assets/js/channels/shiprocketMarketing.js',
    'https://fastrr-boost-ui.pickrr.com/assets/js/channels/shiprocket-login.js',
    'https://fastrr-edd.pickrr.com/index.js'
  ];

  for (const u of urls) {
    const r = await fetch(u);
    const t = await r.text();
    const idx = t.indexOf('saved with');
    if (idx !== -1) {
      console.log('Found in:', u);
      console.log(t.slice(Math.max(0, idx - 150), idx + 200));
    }
  }
}
run().catch(console.error);
