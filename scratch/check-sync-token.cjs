const fs = require("fs");
const text = fs.readFileSync("scratch/fastrr-shopify.js", "utf8");
const idx = text.indexOf("sync-shopify-cart-token-with-checkout");
console.log(text.substring(idx - 200, idx + 1000));
