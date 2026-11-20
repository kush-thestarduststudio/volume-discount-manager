import fs from 'fs';

const code = fs.readFileSync('scratch/lb-selleasy.js', 'utf8');

// Search for calls to mutateDiscount
const matches = [...code.matchAll(/mutateDiscount/g)];
console.log("mutateDiscount calls:");
for (const m of matches) {
  console.log("--- Context at", m.index, "---");
  console.log(code.slice(Math.max(0, m.index - 100), m.index + 200));
}

// Search for checkout event handlers or fastrr or shiprocket
const checkoutMatches = [...code.matchAll(/Fastrr|pickrr|shiprocket/gi)];
console.log("\nFastrr/Shiprocket mentions in Selleasy:");
for (const m of checkoutMatches) {
  console.log("--- Context at", m.index, "---");
  console.log(code.slice(Math.max(0, m.index - 50), m.index + 150));
}
