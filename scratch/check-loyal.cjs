const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const session = await prisma.session.findFirst({
    where: { shop: { contains: 'stardust' } }
  });
  if (!session) {
    console.log('No session');
    return;
  }
  // Search discount code LOYAL
  const res = await fetch(`https://${session.shop}/admin/api/2024-04/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': session.accessToken
    },
    body: JSON.stringify({
      query: `query {
        codeDiscountNodeByCode(code: "LOYAL") {
          id
          codeDiscount {
            __typename
            ... on DiscountCodeBasic {
              title
              combinesWith {
                orderDiscounts
                productDiscounts
                shippingDiscounts
              }
            }
          }
        }
      }`
    })
  });
  const data = await res.json();
  console.log('LOYAL discount search:', JSON.stringify(data, null, 2));
}
run().catch(console.error);
