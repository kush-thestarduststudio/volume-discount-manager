import fs from 'fs';

// Let's simulate Qe(Ye(e)) from fastrr-shopify.js!
const content = fs.readFileSync('scratch/fastrr-shopify.js', 'utf8');

// Let's extract checkoutBuyer
const mBuyer = content.match(/checkoutBuyer="([^"]+)"/);
console.log('checkoutBuyer:', mBuyer ? mBuyer[1] : 'not found');

// Let's find what parameters are passed in widgetUrl
const idxQe = content.indexOf('Qe=');
console.log('Qe at', idxQe);
console.log(content.substring(idxQe, idxQe + 500));
