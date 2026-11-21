import fs from 'fs';
const content = fs.readFileSync('scratch/smart-cart.min.js', 'utf8');
let idx = content.indexOf('id="mini-cart-drawer"');
if (idx === -1) idx = content.indexOf("id='mini-cart-drawer'");
console.log('mini-cart-drawer at', idx);
if (idx !== -1) {
  console.log(content.substring(idx + 1000, idx + 3000));
}
