import fs from 'fs';

const code = fs.readFileSync('scratch/smart-cart.min.js', 'utf8');
const match = code.match(/A\s*=\s*\{|const A\s*=|let A\s*=/);
if (match) {
  console.log(code.slice(match.index, match.index + 500));
} else {
  // Let's search around line 2052 where A?.remove("fastrrCouponCode") occurred
  console.log("Around 2052:\n", code.slice(1900, 2400));
}
