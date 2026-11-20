const fs = require("fs");
const text = fs.readFileSync("scratch/fastrr-shopify.js", "utf8");
const idx = text.indexOf("Ge=");
console.log(text.substring(idx - 50, idx + 1500));
