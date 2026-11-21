import fs from 'fs';
const content = fs.readFileSync('scratch/fastrr-shopify.js', 'utf8');
let idx = content.indexOf('shiprocketCheckoutBuyCartHandler');
console.log('shiprocketCheckoutBuyCartHandler at', idx);
console.log(content.substring(idx, idx + 1200));
