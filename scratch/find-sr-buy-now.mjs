import fs from 'fs';
const content = fs.readFileSync('scratch/smart-cart.min.js', 'utf8');
let idx = content.indexOf('sr-buy-now-button');
while (idx !== -1) {
  console.log('sr-buy-now-button at', idx);
  console.log(content.substring(Math.max(0, idx - 300), Math.min(content.length, idx + 400)));
  idx = content.indexOf('sr-buy-now-button', idx + 1);
}
