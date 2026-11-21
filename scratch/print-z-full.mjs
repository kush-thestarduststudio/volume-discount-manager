import fs from 'fs';
const content = fs.readFileSync('scratch/fastrr-shopify.js', 'utf8');
console.log(content.substring(66973, 66973 + 2500));
