import fs from 'fs';
const s = fs.readFileSync('scratch/smart-cart.min.js', 'utf8');

const idx = s.indexOf('CheckoutEvents.buyCart');
if (idx !== -1) {
  console.log('Around CheckoutEvents.buyCart:');
  console.log(s.slice(Math.max(0, idx - 500), idx + 1000));
}

const idx2 = s.indexOf('fastrrCouponCode');
if (idx2 !== -1) {
  console.log('\nAround fastrrCouponCode:');
  console.log(s.slice(Math.max(0, idx2 - 300), idx2 + 500));
}
