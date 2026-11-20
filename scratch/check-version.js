async function run() {
  const r = await fetch('https://thestarduststudio.com/products/test');
  const t = await r.text();
  const m = t.match(/bundle-tier-discounts-\d+/);
  console.log('Live bundle-tier version tag:', m ? m[0] : 'not found');
}
run();
