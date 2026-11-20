const fs = require("fs");
const text = fs.readFileSync("scratch/fastrr-shopify.js", "utf8");
let pos = 0;
while ((pos = text.indexOf("fallbackUrl:", pos)) !== -1) {
  console.log("fallbackUrl at " + pos + ":");
  console.log(text.substring(pos - 100, pos + 300));
  pos += 12;
}
