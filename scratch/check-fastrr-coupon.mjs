import fs from 'fs';

const code = fs.readFileSync('scratch/fastrr-shopify.js', 'utf8');
const matches = [...code.matchAll(/coupon/gi)];
console.log("Total coupon matches:", matches.length);
for (const m of matches) {
  console.log("--- Context at", m.index, "---");
  console.log(code.slice(Math.max(0, m.index - 50), m.index + 120));
}
