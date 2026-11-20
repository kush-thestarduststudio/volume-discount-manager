const fs = require("fs");
const text = fs.readFileSync("scratch/fastrr-shopify.js", "utf8");
const idx = text.indexOf("window.shiprocketCheckoutBuyProductHandler=");
console.log(text.substring(idx, idx + 1500));
