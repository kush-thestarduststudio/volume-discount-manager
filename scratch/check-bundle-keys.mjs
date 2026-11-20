import fs from 'fs';
const s = fs.readFileSync('scratch/fastrr-shopify.js', 'utf8');

const keys = ['_isSimplSoBundle', '_isYtBundle', '_isCornerBundle', '_isEasyBundle', '_isShopifyBundle'];
for (const k of keys) {
  let pos = 0;
  console.log(`\n=== KEY: ${k} ===`);
  while ((pos = s.indexOf(k, pos)) !== -1) {
    console.log(s.slice(Math.max(0, pos - 150), pos + 250));
    pos += k.length;
  }
}
