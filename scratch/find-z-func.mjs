import fs from 'fs';
const content = fs.readFileSync('scratch/fastrr-shopify.js', 'utf8');
let idx = content.indexOf('z=');
while (idx !== -1) {
  const slice = content.substring(idx - 30, idx + 300);
  if (slice.includes('function') || slice.includes('=>') || slice.includes('cart') || slice.includes('pass')) {
    console.log('z at', idx);
    console.log(slice);
  }
  idx = content.indexOf('z=', idx + 1);
}
