import fs from 'fs';
const content = fs.readFileSync('scratch/smart-cart.min.js', 'utf8');
let pos = 0;
while ((pos = content.indexOf('total', pos)) !== -1) {
  const slice = content.substring(Math.max(0, pos - 50), Math.min(content.length, pos + 100));
  if (slice.includes('class=') || slice.includes('order-total') || slice.includes('sr-cart-total') || slice.includes('Estimated')) {
    console.log('--- total at', pos, '---');
    console.log(slice);
  }
  pos += 10;
}
