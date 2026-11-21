import fs from 'fs';
const content = fs.readFileSync('scratch/fastrr-shopify.js', 'utf8');
let idx = content.indexOf('shiprocketCheckoutBuyCartHandler=');
if (idx === -1) idx = content.indexOf('function shiprocketCheckoutBuyCartHandler');
if (idx === -1) idx = content.indexOf('shiprocketCheckoutBuyCartHandler =');
console.log('definition at', idx);
console.log(content.substring(idx - 50, idx + 800));
