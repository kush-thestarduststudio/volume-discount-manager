const fs = require("fs");
const text = fs.readFileSync("scratch/fastrr-shopify.js", "utf8");
const idx = text.indexOf("const f=e=>{try{var t;const o=JSON.parse");
console.log(text.substring(idx + 1800, idx + 3500));
