const fs = require('fs');
const content = fs.readFileSync('scratch/smart-cart.min.js', 'utf8');
let pos = 0;
while ((pos = content.indexOf('total-price', pos)) !== -1) {
  console.log('--- total-price at', pos, '---');
  console.log(content.substring(Math.max(0, pos - 150), Math.min(content.length, pos + 150)));
  pos += 15;
}
