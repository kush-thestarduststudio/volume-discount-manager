import https from 'https';

function check() {
  https.get('https://volume-discount-manager.onrender.com/api/config?shop=stardustt-studio.myshopify.com', (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log("Rules count on Render:", json.rules ? json.rules.length : 'none');
        if (json.rules && json.rules.length > 0) {
          console.log("New build active! Rules:", JSON.stringify(json.rules, null, 2));
          process.exit(0);
        }
      } catch (e) {
        console.log("Error parsing:", data);
      }
    });
  }).on('error', console.error);
}

check();
