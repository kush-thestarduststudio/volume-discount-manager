import fs from 'fs';
const s = fs.readFileSync('scratch/smart-cart.min.js', 'utf8');

const idx = s.indexOf('function zn');
console.log(s.slice(idx, idx + 1500));
