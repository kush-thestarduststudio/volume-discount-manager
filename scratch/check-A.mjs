import fs from 'fs';

const code = fs.readFileSync('scratch/smart-cart.min.js', 'utf8');
const idx = 29567;
console.log(code.slice(idx - 200, idx + 400));
