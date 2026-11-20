import https from 'https';
import fs from 'fs';

https.get('https://cdn.shopify.com/extensions/01a1aadd-5e78-72cd-8295-3e65bff7f8e1/shiprocket-smart-cart-259/assets/smart-cart.min.js', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    fs.writeFileSync('scratch/smart-cart.min.js', data);
    console.log(`Downloaded smart-cart.min.js (${data.length} bytes)`);
  });
});
