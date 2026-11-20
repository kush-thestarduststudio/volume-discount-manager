import fs from 'fs';

const code = fs.readFileSync('scratch/smart-cart.min.js', 'utf8');

// Find all occurrences of fastrrCouponCode in smart-cart
const matches = [...code.matchAll(/fastrrCouponCode/g)];
console.log("fastrrCouponCode in smart-cart:");
for (const m of matches) {
  console.log("--- Context at", m.index, "---");
  console.log(code.slice(Math.max(0, m.index - 50), m.index + 120));
}
