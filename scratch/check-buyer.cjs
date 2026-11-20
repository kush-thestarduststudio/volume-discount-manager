const fs = require("fs");
const text = fs.readFileSync("scratch/fastrr-shopify.js", "utf8");
let pos = 0;
while ((pos = text.indexOf("checkoutBuyer", pos)) !== -1) {
  console.log("checkoutBuyer at " + pos + ":");
  console.log(text.substring(pos - 100, pos + 300));
  pos += 13;
}
