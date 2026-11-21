async function check() {
  const r = await fetch('https://thestarduststudio.com/products/test?_t=' + Date.now());
  const html = await r.text();
  console.log('HTML length:', html.length);
  const scripts = [];
  const re = /<script[^>]+src=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1].includes('extension') || m[1].includes('tier') || m[1].includes('bundle') || m[1].includes('volume')) {
      scripts.push(m[1]);
    }
  }
  console.log('Matching script tags:', scripts);
}
check().catch(console.error);
