import fs from 'fs';
const content = fs.readFileSync('scratch/fastrr-shopify.js', 'utf8');
let m = content.match(/seller_id[=:]\s*['"]?(\w+)/i);
console.log('fastrr-shopify seller_id:', m ? m[1] : null);

// Let's check stardust HTML or sellerConfig
const files = fs.readdirSync('scratch');
for (const f of files) {
  if (f.includes('seller') || f.includes('stardust')) {
    console.log('Found seller/stardust file:', f);
  }
}
