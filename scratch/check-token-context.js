async function run() {
  const r = await fetch('https://thestarduststudio.com/products/test');
  const html = await r.text();
  const idx = html.indexOf('lbupsellToken');
  if (idx !== -1) {
    console.log(html.slice(Math.max(0, idx - 200), idx + 300));
  }
}
run().catch(console.error);
