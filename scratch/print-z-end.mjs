import fs from 'fs';
const content = fs.readFileSync('scratch/fastrr-shopify.js', 'utf8');
console.log(content.substring(69500, 69500 + 2000));
