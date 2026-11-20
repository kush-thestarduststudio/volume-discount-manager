async function run() {
  const token = 'c08d56cae211c47c68cb3cd03b882be8';
  const query = `
    query {
      shop {
        metafield(namespace: "bundle_tiers", key: "config") {
          value
        }
      }
    }
  `;
  const res = await fetch('https://thestarduststudio.com/api/2024-04/graphql.json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token
    },
    body: JSON.stringify({ query })
  });
  const data = await res.json();
  console.log('Shop metafield bundle_tiers.config:', data.data?.shop?.metafield?.value);
}
run().catch(console.error);
