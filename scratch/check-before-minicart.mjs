import fs from 'fs';
const s = fs.readFileSync('scratch/smart-cart.min.js', 'utf8');

const idx = s.indexOf('miniCartInit=async function');
console.log(s.slice(Math.max(0, idx - 800), idx + 200));
