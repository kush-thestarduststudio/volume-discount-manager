async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const t = await r.text();

  const idx = t.indexOf('function f(t){');
  if (idx !== -1) {
    console.log(t.slice(idx, idx + 1000));
  } else {
    // search f=
    const idx2 = t.indexOf('f=t=>{');
    if (idx2 !== -1) console.log(t.slice(idx2, idx2 + 1000));
    else {
      const idx3 = t.indexOf('f=function(t){');
      console.log(t.slice(idx3, idx3 + 1000));
    }
  }
}
run().catch(console.error);
