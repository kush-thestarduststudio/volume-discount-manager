import fs from 'fs';

const html = fs.readFileSync('scratch/test-all-scripts.mjs', 'utf8'); // wait, let's fetch page and search for lbupsellToken
import https from 'https';

const options = {
  hostname: 'thestarduststudio.com',
  path: '/products/test',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const matches = data.match(/lbupsellToken|StorefrontAccessToken|storefrontToken|accessToken/gi);
    console.log("Token matches:", matches);
    const tokenRegex = /["']([a-f0-9]{32})["']/g;
    let m;
    while (m = tokenRegex.exec(data)) {
      console.log("32-char hex token:", m[1]);
    }
    // Search around lbupsell
    const idx = data.indexOf('lbupsell');
    if (idx !== -1) {
      console.log("Found lbupsell in HTML:", data.slice(Math.max(0, idx - 100), idx + 300));
    }
  });
});
