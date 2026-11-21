import fs from 'fs';
const content = fs.readFileSync('scratch/fastrr-shopify.js', 'utf8');
let idx = content.indexOf('Ze=');
if (idx === -1) idx = content.indexOf('function Ze(');
if (idx === -1) idx = content.indexOf('const Ze=');
console.log('Ze at', idx);
console.log(content.substring(idx - 50, idx + 1000));
