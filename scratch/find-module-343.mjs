import fs from 'fs';

const code = fs.readFileSync('scratch/lb-selleasy.js', 'utf8');
const match = code.match(/343\s*:\s*function|343\s*\([a-zA-Z0-9_,\s]+\)\s*\{/);
if (match) {
  const idx = match.index;
  console.log("Found at index", idx);
  console.log(code.slice(idx, idx + 2000));
} else {
  // Let's find any occurrences of 343:
  const matches = [...code.matchAll(/343/g)];
  console.log("343 occurrences:", matches.map(m => m.index));
  for (const m of matches) {
    console.log("--- Context at", m.index, "---");
    console.log(code.slice(Math.max(0, m.index - 50), m.index + 200));
  }
}
