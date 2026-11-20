const fs = require("fs");
const text = fs.readFileSync("scratch/fastrr-shopify.js", "utf8");

const terms = ["OfferId", "_EasyBundleId", "_isSimplSoBundle", "_isYtBundle", "_isCornerBundle", "_bundleItems"];
for (const term of terms) {
  let pos = 0;
  console.log(`=== Term: ${term} ===`);
  while ((pos = text.indexOf(term, pos)) !== -1) {
    console.log(`Found at ${pos}:`);
    console.log(text.substring(Math.max(0, pos - 150), Math.min(text.length, pos + 250)));
    pos += term.length;
  }
}
