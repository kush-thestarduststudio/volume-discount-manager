import fs from 'fs';
const s = fs.readFileSync('scratch/fastrr-shopify.js', 'utf8');

// Find all functions or variables named z
let pos = 0;
while (true) {
  const m = s.slice(pos).match(/(?:function\s+z\b|[,;]z\s*=\s*(?:function|\([^)]*\)\s*=>))/);
  if (!m) break;
  const found = pos + m.index;
  console.log('Found z at', found, ':', s.slice(found, found + 400));
  pos = found + m[0].length;
}
