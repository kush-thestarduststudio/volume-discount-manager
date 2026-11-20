import https from 'https';

const token = "c08d56cae211c47c68cb3cd03b882be8";

function postGraphQL(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query, variables });
    const req = https.request({
      hostname: 'thestarduststudio.com',
      path: '/api/2024-01/graphql.json',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': token,
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function listProducts() {
  const query = `
    query {
      products(first: 10) {
        nodes {
          id
          title
          handle
          variants(first: 1) {
            nodes {
              id
              price { amount currencyCode }
            }
          }
        }
      }
    }
  `;
  const res = await postGraphQL(query);
  console.log("Products on store:", JSON.stringify(res.data?.products?.nodes, null, 2));
}

listProducts().catch(console.error);
