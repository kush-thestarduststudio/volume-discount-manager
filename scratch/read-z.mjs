import fs from 'fs';
const s = fs.readFileSync('scratch/fastrr-shopify.js', 'utf8');

console.log(s.slice(66972, 66972 + 3000));
