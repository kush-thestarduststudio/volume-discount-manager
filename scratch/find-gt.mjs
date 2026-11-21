import fs from 'fs';
const content = fs.readFileSync('scratch/smart-cart.min.js', 'utf8');
let idx = content.indexOf('gt=');
if (idx === -1) idx = content.indexOf('function gt(');
if (idx === -1) idx = content.indexOf('gt = (');
if (idx === -1) idx = content.indexOf('const gt=');
console.log('gt definition at', idx);
console.log(content.substring(idx, idx + 1000));
