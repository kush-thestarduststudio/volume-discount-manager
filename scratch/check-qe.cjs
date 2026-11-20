const fs = require("fs");
const text = fs.readFileSync("scratch/fastrr-shopify.js", "utf8");
console.log(text.substring(46500, 49000));
