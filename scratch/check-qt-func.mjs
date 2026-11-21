import fs from 'fs';
const content = fs.readFileSync('scratch/smart-cart.min.js', 'utf8');
const idx = content.indexOf('function qt(');
console.log('function qt at', idx);
console.log(content.substring(idx, idx + 1500));
