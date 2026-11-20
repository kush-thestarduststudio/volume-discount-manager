const https = require('https');

https.get('https://thestarduststudio.com/products/test', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const scripts = data.match(/<script[^>]*src=["']([^"']+)["'][^>]*>/gi) || [];
    const relevant = scripts.filter(s => /bundle|sell|discount|fastrr|pickrr|shiprocket/i.test(s));
    console.log("Relevant scripts found:", relevant);
  });
}).on('error', err => console.error(err));
