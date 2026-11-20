import fs from 'fs';
const s = fs.readFileSync('scratch/lb-selleasy.js', 'utf8');

const idx = s.indexOf('validateCodes:');
if (idx !== -1) {
  console.log(s.slice(idx - 100, idx + 1200));
}
