async function findLoyal() {
  const shop = 'stardustt-studio.myshopify.com';
  // Use Render's token
  const query = `
    query SearchLoyal {
      codeDiscountNodes(first: 10, query: "code:LOYAL") {
        nodes {
          id
          codeDiscount {
            __typename
            ... on DiscountCodeBasic {
              title
              status
              combinesWith {
                orderDiscounts
                productDiscounts
                shippingDiscounts
              }
              codes(first: 5) { nodes { code } }
            }
          }
        }
      }
    }
  `;
  const res = await fetch(`https://volume-discount-manager.onrender.com/api/sync-discount?shop=${shop}&customQuery=${encodeURIComponent(query)}`);
  const d = await res.json();
  console.log('Result:', JSON.stringify(d, null, 2));
}
findLoyal().catch(console.error);
