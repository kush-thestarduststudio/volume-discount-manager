import https from 'https';
import fs from 'fs';

function download(url, filename) {
  https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      fs.writeFileSync(filename, data);
      console.log(`Downloaded ${filename} (${data.length} bytes)`);
    });
  });
}

download('https://cdn.shopify.com/extensions/01a1f26f-6242-7db3-99fc-b340dfbb878f/lb-upsell-471/assets/lb-selleasy.js', 'scratch/lb-selleasy.js');
download('https://cdn.shopify.com/extensions/01a1f26f-6242-7db3-99fc-b340dfbb878f/lb-upsell-471/assets/lb-utils.js', 'scratch/lb-utils.js');
download('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js', 'scratch/fastrr-shopify.js');
