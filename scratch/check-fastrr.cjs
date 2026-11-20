const fs = require("fs");
const text = fs.readFileSync("scratch/fastrr-shopify.js", "utf8");
const idx = text.indexOf("_isYtBundle");
console.log(text.substring(idx - 400, idx + 800));
