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
    // Find any occurrences of bt-tier-card or bt-volume-widget
    const match = data.match(/<div[^>]*class=["'][^"']*bt-volume-widget[^"']*["'][^>]*>[\s\S]*?<\/div>\s*<\/div>/i);
    if (match) {
      console.log("Found bt-volume-widget in HTML:\n", match[0].slice(0, 2000));
    } else {
      console.log("No bt-volume-widget found in raw HTML. Searching for any 'Buy 2' or 'bt-' or 'bundle-tier':");
      const btMatches = data.match(/[^<]*Buy 2[^<]*/gi);
      console.log("Buy 2 matches:", btMatches);
      const scriptMatches = data.match(/<script[^>]*bundle-tier[^>]*>[\s\S]*?<\/script>/gi);
      console.log("bundle-tier scripts:", scriptMatches);
      const metafieldMatches = data.match(/window\.__btRules\s*=\s*[\s\S]*?;/gi);
      console.log("__btRules in HTML:", metafieldMatches);
    }
  });
});
