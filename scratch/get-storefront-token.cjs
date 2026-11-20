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

  // 1. Query existing storefront access tokens
  const listRes = await fetch(`https://${session.shop}/admin/api/2024-04/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': session.accessToken
    },
    body: JSON.stringify({
      query: `query {
        storefrontAccessTokens(first: 10) {
          nodes {
            id
            title
            accessToken
          }
        }
      }`
    })
  });
  const listData = await listRes.json();
  console.log('Existing storefront tokens:', JSON.stringify(listData, null, 2));

  // If none or create new one:
  const tokens = listData.data?.storefrontAccessTokens?.nodes || [];
  if (tokens.length > 0) {
    console.log('Using token:', tokens[0].accessToken);
  } else {
    const createRes = await fetch(`https://${session.shop}/admin/api/2024-04/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': session.accessToken
      },
      body: JSON.stringify({
        query: `mutation storefrontAccessTokenCreate($input: StorefrontAccessTokenInput!) {
          storefrontAccessTokenCreate(input: $input) {
            storefrontAccessToken {
              accessToken
            }
            userErrors {
              field
              message
            }
          }
        }`,
        variables: {
          input: {
            title: "Bundle & Tier Discounts Storefront Token"
          }
        }
      })
    });
    const createData = await createRes.json();
    console.log('Created token:', JSON.stringify(createData, null, 2));
  }
}

run().catch(console.error);
