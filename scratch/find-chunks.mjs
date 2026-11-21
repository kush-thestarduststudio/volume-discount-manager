import fs from 'fs';
const text = fs.readFileSync('scratch/fastrr-current.js', 'utf8');

const m = text.match(/{\s*416:\s*"([^"]+)",\s*422:\s*"([^"]+)",\s*428:\s*"([^"]+)"/);
if (m) {
  console.log('Found chunks mapping:', m[0]);
} else {
  // Let's search around l.u =
  const idx = text.indexOf('.u=');
  if (idx !== -1) {
    console.log(text.substring(idx - 50, idx + 300));
  }
}
