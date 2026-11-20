const fs = require("fs");
const text = fs.readFileSync("scratch/fastrr-shopify.js", "utf8");
const idx = text.indexOf("let E={cartAttributes:{");
console.log(text.substring(idx, idx + 2000));
