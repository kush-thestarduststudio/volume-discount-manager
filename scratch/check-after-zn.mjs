import fs from 'fs';
const s = fs.readFileSync('scratch/smart-cart.min.js', 'utf8');

const idx = s.indexOf('s=await zn(e,t,n,i);');
console.log(s.slice(idx, idx + 1500));
