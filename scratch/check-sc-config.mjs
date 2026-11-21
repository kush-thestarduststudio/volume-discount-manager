import fs from 'fs';
async function run() {
  const r = await fetch('https://thestarduststudio.com/products/test');
  const t = await r.text();
  const idx = t.indexOf('window.shiprocketSmartCart =');
  if (idx !== -1) {
    console.log(t.substring(idx, idx + 2500));
  }
}
run().catch(console.error);
