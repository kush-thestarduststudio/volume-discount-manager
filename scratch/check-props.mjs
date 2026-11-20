import fs from 'fs';
const s = fs.readFileSync('scratch/fastrr-shopify.js', 'utf8');

const regex = /properties[^\w]{1,10}([a-zA-Z0-9_]+)/g;
let m;
const props = new Set();
while ((m = regex.exec(s)) !== null) {
  props.add(m[1]);
}
console.log('Properties checked in fastrr-shopify.js:', Array.from(props));
