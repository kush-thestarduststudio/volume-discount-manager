const fs = require('fs');
const code = fs.readFileSync('c:\\Users\\Admin\\volume-discount-manager\\scratch\\smart-cart.min.js', 'utf8');

const urls = code.match(/https?:\/\/[^"'\s\)]+/g) || [];
const unique = [...new Set(urls)];
unique.filter(u => u.includes('shiprocket') || u.includes('fastrr') || u.includes('api')).forEach(u => console.log('API URL:', u));
