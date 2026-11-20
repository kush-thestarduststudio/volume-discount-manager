import https from 'https';

const options = {
  hostname: 'thestarduststudio.com',
  path: '/products/test.js',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const prod = JSON.parse(data);
      console.log("Product:", prod.title, "Available:", prod.available);
      prod.variants.forEach(v => {
        console.log("Variant:", v.id, v.title, "Available:", v.available, "Price:", v.price);
      });
    } catch (e) {
      console.log("Error:", data);
    }
  });
});
