import fs from 'fs';

const code = fs.readFileSync('scratch/smart-cart.min.js', 'utf8');

// Search for "Buy Now" or checkout button click handler in smart-cart
const matches = [...code.matchAll(/buy\s*now|checkout/gi)];
console.log("Total checkout matches:", matches.length);

// Search for Fastrr checkout invocation:
const fastrrMatches = [...code.matchAll(/shiprocketCheckout|fastrr|initiateCheckout|openCheckout/gi)];
console.log("Fastrr checkout matches:", fastrrMatches.length);
for (const m of fastrrMatches.slice(0, 10)) {
  console.log("--- Context at", m.index, "---");
  console.log(code.slice(Math.max(0, m.index - 50), m.index + 150));
}
