import fs from 'fs';
const content = fs.readFileSync('scratch/smart-cart.min.js', 'utf8');
let idx = content.indexOf('id="sr-buy-now-button"');
if (idx === -1) idx = content.indexOf("id='sr-buy-now-button'");
if (idx === -1) idx = content.indexOf('sr-buy-now-button');
console.log('Found at', idx);
console.log(content.substring(Math.max(0, idx - 600), Math.min(content.length, idx + 400)));
