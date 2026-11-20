async function run() {
  const r = await fetch('https://thestarduststudio.com/products/test');
  const html = await r.text();
  const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]);
  console.log('Scripts:', scripts.filter(s => s.includes('shiprocket') || s.includes('fastrr') || s.includes('cart') || s.includes('bundle')));
}
run().catch(console.error);
