import https from 'https';

function fetchUrl(url) {
  const parsed = new URL(url);
  const options = {
    hostname: parsed.hostname,
    path: parsed.pathname + parsed.search,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  };
  https.get(options, (res) => {
    console.log("Status:", res.statusCode, "Location:", res.headers.location);
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      fetchUrl(res.headers.location.startsWith('http') ? res.headers.location : 'https://thestarduststudio.com' + res.headers.location);
      return;
    }
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const scripts = data.match(/<script[^>]*src=["']([^"']+)["'][^>]*>/gi) || [];
      console.log("Total scripts:", scripts.length);
      const filtered = scripts.filter(s => /bundle|sell|discount|fastrr|pickrr|shiprocket|shopify/i.test(s));
      filtered.forEach(s => console.log(s));
    });
  });
}
fetchUrl('https://thestarduststudio.com/products/test');
