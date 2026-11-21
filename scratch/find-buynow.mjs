import fs from 'fs';
const content = fs.readFileSync('scratch/smart-cart.min.js', 'utf8');
let pos = 0;
while ((pos = content.indexOf('buyNowButtonUIConfig', pos)) !== -1) {
  console.log('--- buyNowButtonUIConfig at', pos, '---');
  console.log(content.substring(Math.max(0, pos - 200), Math.min(content.length, pos + 800)));
  pos += 25;
}
