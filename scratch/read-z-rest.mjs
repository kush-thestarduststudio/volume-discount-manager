import fs from 'fs';
const s = fs.readFileSync('scratch/fastrr-shopify.js', 'utf8');

console.log(s.slice(69972, 69972 + 2500));
