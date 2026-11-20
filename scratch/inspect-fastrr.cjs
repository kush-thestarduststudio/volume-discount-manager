const https = require('https');

https.get('https://thestarduststudio.com/products/test', (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers.location);
});
