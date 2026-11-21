async function check() {
  const token = 'c08d56cae211c47c68cb3cd03b882be8';
  const query = `
    query {
      node(id: "gid://shopify/ProductVariant/67910792216628") {
        ... on ProductVariant {
          id
          title
          product {
            id
            title
          }
        }
      }
    }
  `;
  const res = await fetch('https://thestarduststudio.com/api/2024-04/graphql.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': token },
    body: JSON.stringify({ query })
  });
  const data = await res.json();
  console.log('Variant 67910792216628:', JSON.stringify(data, null, 2));
}
check().catch(console.error);
