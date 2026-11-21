import fs from 'fs';
const content = fs.readFileSync('scratch/fastrr-shopify.js', 'utf8');
let idx = content.indexOf('couponCode');
while (idx !== -1) {
  console.log('couponCode at', idx);
  console.log(content.substring(Math.max(0, idx - 150), Math.min(content.length, idx + 250)));
  idx = content.indexOf('couponCode', idx + 1);
}
