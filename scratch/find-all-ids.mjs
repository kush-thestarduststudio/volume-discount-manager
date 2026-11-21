import fs from 'fs';
const content = fs.readFileSync('scratch/smart-cart.min.js', 'utf8');
const ids = new Set();
const regex = /id=["']([^"']+)["']/g;
let m;
while ((m = regex.exec(content)) !== null) {
  ids.add(m[1]);
}
console.log('All IDs in smart-cart.min.js:', Array.from(ids));
