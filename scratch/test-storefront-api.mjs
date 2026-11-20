import https from 'https';

const token = "c08d56cae211c47c68cb3cd03b882be8";

function postGraphQL(query, variables) {
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

async function testCart() {
  const createQuery = `
    mutation CreateCart($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          id
          cost {
            totalAmount { amount currencyCode }
            subtotalAmount { amount currencyCode }
          }
          discountCodes {
            code
            applicable
          }
        }
        userErrors { field message }
      }
    }
  `;

  // Test 1: cart with LOYAL
  console.log("Testing cart with LOYAL...");
  const cartRes1 = await postGraphQL(createQuery, {
    input: {
      lines: [
        { merchandiseId: "gid://shopify/ProductVariant/46920435957812", quantity: 4 }
      ],
      discountCodes: ["LOYAL"]
    }
  });
  console.log("LOYAL result:", JSON.stringify(cartRes1, null, 2));

  // Test 2: cart with both TEST-BUY4-10OFF and LOYAL
  const cartId = cartRes1.data?.cartCreate?.cart?.id;
  if (cartId) {
    const updateQuery = `
      mutation CartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]!) {
        cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
          cart {
            id
            cost {
              totalAmount { amount currencyCode }
              subtotalAmount { amount currencyCode }
            }
            discountCodes {
              code
              applicable
            }
          }
          userErrors { field message }
        }
      }
    `;

    const updateRes = await postGraphQL(updateQuery, {
      cartId,
      discountCodes: ["TEST-BUY4-10OFF", "LOYAL"]
    });
    console.log("Both codes result:", JSON.stringify(updateRes, null, 2));
  }
}

testCart().catch(console.error);
