import fs from 'fs';
async function run() {
  const r = await fetch('https://cdn.shopify.com/extensions/01a1f8b7-ba56-7c97-b680-f8d946a4d7c2/shiprocket-smart-cart-262/assets/liquid-handlers.min.js');
  const t = await r.text();
  fs.writeFileSync('scratch/liquid-handlers.min.js', t);
  const m = t.match(/seller[a-zA-Z0-9_]*\s*[:=]\s*["']([^"']+)["']/gi);
  console.log('seller matches in liquid-handlers:', m);
  const idx = t.indexOf('seller');
  if (idx !== -1) {
    console.log(t.substring(idx - 50, idx + 200));
  }
}
run().catch(console.error);
