const fs = require("fs");
const c = fs.readFileSync("scratch/fastrr-current.js", "utf8");
let idx = 0;
while ((idx = c.indexOf('"CART_INITIATE_REQUEST"', idx)) !== -1) {
  console.log("Match at", idx);
  console.log(c.slice(Math.max(0, idx - 100), Math.min(c.length, idx + 400)));
  idx += 20;
}
