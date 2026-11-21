import fs from 'fs';
const content = fs.readFileSync('scratch/fastrr-shopify.js', 'utf8');
console.log(content.substring(68500, 68500 + 2000));
