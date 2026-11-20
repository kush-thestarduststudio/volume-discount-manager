const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const session = await prisma.session.findFirst({
    where: { shop: { contains: 'stardust' } }
  });
  if (!session) {
    console.log('No session found');
    return;
  }
  console.log('Using shop:', session.shop);

  const res = await fetch(`https://${session.shop}/admin/api/2026-04/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': session.accessToken
    },
    body: JSON.stringify({
      query: `query {
        discountNodes(first: 50) {
          nodes {
            id
            discount {
              __typename
              ... on DiscountAutomaticBasic {
                title
                status
                combinesWith {
                  orderDiscounts
                  productDiscounts
                  shippingDiscounts
                }
              }
              ... on DiscountAutomaticBxgy {
                title
                status
                combinesWith {
                  orderDiscounts
                  productDiscounts
                  shippingDiscounts
                }
              }
              ... on DiscountAutomaticApp {
                title
                status
                combinesWith {
                  orderDiscounts
                  productDiscounts
                  shippingDiscounts
                }
              }
              ... on DiscountCodeBasic {
                title
                status
                codes(first: 5) {
                  nodes { code }
                }
                combinesWith {
                  orderDiscounts
                  productDiscounts
                  shippingDiscounts
                }
              }
              ... on DiscountCodeBxgy {
                title
                status
                codes(first: 5) {
                  nodes { code }
                }
                combinesWith {
                  orderDiscounts
                  productDiscounts
                  shippingDiscounts
                }
              }
              ... on DiscountCodeApp {
                title
                status
                codes(first: 5) {
                  nodes { code }
                }
                combinesWith {
                  orderDiscounts
                  productDiscounts
                  shippingDiscounts
                }
              }
            }
          }
        }
      }`
    })
  });

  const json = await res.json();
  console.log(JSON.stringify(json.data?.discountNodes?.nodes, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
