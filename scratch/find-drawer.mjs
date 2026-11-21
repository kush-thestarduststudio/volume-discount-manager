import fs from 'fs';
const content = fs.readFileSync('scratch/smart-cart.min.js', 'utf8');
let pos = 0;
while ((pos = content.indexOf('sr-cart-order-summary-drawer', pos)) !== -1) {
  console.log('--- sr-cart-order-summary-drawer at', pos, '---');
  console.log(content.substring(Math.max(0, pos - 200), Math.min(content.length, pos + 400)));
  pos += 30;
}
