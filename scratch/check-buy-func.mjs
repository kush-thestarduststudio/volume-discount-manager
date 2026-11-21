import fs from 'fs';
const content = fs.readFileSync('scratch/smart-cart.min.js', 'utf8');
const idx = content.indexOf('handleShiprocketSmartCartBuy');
console.log('handleShiprocketSmartCartBuy at', idx);
console.log(content.substring(idx - 100, idx + 1200));
