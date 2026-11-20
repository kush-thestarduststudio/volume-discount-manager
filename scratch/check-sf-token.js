async function run() {
  const r = await fetch('https://thestarduststudio.com/products/test');
  const html = await r.text();
  const re = /lbupsellToken\s*=\s*["']([^"']+)["']/i;
  const m = html.match(re);
  if (m) {
    console.log('Found lbupsellToken:', m[1]);
  } else {
    // Search any storefront token in html
    const re2 = /["']([a-f0-9]{32})["']/g;
    let m2;
    while ((m2 = re2.exec(html)) !== null) {
      console.log('Found potential 32-char hex token:', m2[1]);
    }
  }
}
run().catch(console.error);
