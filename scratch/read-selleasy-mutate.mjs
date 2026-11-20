import fs from 'fs';
const s = fs.readFileSync('scratch/lb-selleasy.js', 'utf8');

const idx = s.indexOf('mutateDiscount:');
console.log(s.slice(idx - 600, idx + 800));
