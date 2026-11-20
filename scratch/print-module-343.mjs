import fs from 'fs';

const code = fs.readFileSync('scratch/lb-selleasy.js', 'utf8');
const start = 5512;
// Find where 343 ends (start of next module, usually number followed by '(')
const nextModule = code.indexOf(',410(', start);
console.log(code.slice(start, nextModule > 0 ? nextModule : start + 6000));
