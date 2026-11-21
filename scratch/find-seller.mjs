async function check() {
  const r = await fetch('https://thestarduststudio.com/products/test');
  const t = await r.text();
  const sellerMatch = t.match(/seller[a-zA-Z0-9_]*\s*[:=]\s*["']([^"']+)["']/i);
  console.log('sellerMatch:', sellerMatch ? sellerMatch[0] : 'not found');

  // Also check smart-cart initialization on the page
  const idx = t.indexOf('miniCartInit');
  console.log('miniCartInit in HTML at:', idx);
  if (idx !== -1) {
    console.log(t.substring(idx - 100, idx + 400));
  }

  // Look for shiprocket in scripts
  const scripts = [...t.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const s of scripts) {
    if (s[1].includes('smart-cart') || s[1].includes('fastrr') || s[1].includes('pickrr')) {
      console.log('Found script tag:');
      console.log(s[1].slice(0, 500));
    }
  }
}
check().catch(console.error);
