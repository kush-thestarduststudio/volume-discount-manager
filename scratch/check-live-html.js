async function run() {
  const r = await fetch('https://thestarduststudio.com/products/test');
  const html = await r.text();
  console.log('HTML size:', html.length);
  const m = html.match(/bundle-tier[a-zA-Z0-9._-]*\.js/g);
  console.log('Bundle tier script tags found in HTML:', m);
}
run().catch(console.error);
