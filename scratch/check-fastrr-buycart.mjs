import fs from 'fs';
const content = fs.readFileSync('scratch/fastrr-shopify.js', 'utf8');
let idx = content.indexOf('buyCart:');
if (idx === -1) idx = content.indexOf('buyCart =');
if (idx === -1) idx = content.indexOf('buyCart');
console.log('buyCart at', idx);
console.log(content.substring(idx - 50, idx + 800));
