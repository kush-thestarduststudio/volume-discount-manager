import fs from 'fs';

const code = fs.readFileSync('scratch/smart-cart.min.js', 'utf8');
const matches = [...code.matchAll(/coupon/gi)];
console.log("Total coupon matches in smart cart:", matches.length);
for (const m of matches.slice(0, 15)) {
  console.log("--- Context at", m.index, "---");
  console.log(code.slice(Math.max(0, m.index - 50), m.index + 150));
}
