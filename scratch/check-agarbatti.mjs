async function check() {
  const token = 'c08d56cae211c47c68cb3cd03b882be8';
  const query = `
    query {
      products(first: 20, query: "agarbatti") {
        nodes {
          id
          title
          handle
          variants(first: 5) {
            nodes {
              id
              title
              price { amount }
            }
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
  console.log('Agarbatti products:');
  data.data?.products?.nodes?.forEach(p => {
    console.log(`Product: ${p.id} - ${p.title} (handle: ${p.handle})`);
    p.variants?.nodes?.forEach(v => {
      console.log(`  Variant: ${v.id} - ${v.title} - ₹${v.price?.amount}`);
    });
  });
}
check().catch(console.error);
