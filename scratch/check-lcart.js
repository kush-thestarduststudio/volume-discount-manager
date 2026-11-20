async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  const idx = t.indexOf('l=async');
  if (idx !== -1) {
    console.log('l=async:', t.slice(idx, idx + 400));
  } else {
    const idx2 = t.indexOf('l=(e,t');
    console.log('l=(e,t:', t.slice(idx2, idx2 + 400));
  }
}
run().catch(console.error);
