import https from 'https';

const sfToken = "c08d56cae211c47c68cb3cd03b882be8";

function postGraphQL(query, variables) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query, variables });
    const req = https.request({
      hostname: 'thestarduststudio.com',
      path: '/api/2024-01/graphql.json',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': sfToken,
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

async function simulate() {
  console.log("--- SIMULATION: Customer adds 4 of test ---");
  const createRes = await postGraphQL(`
    mutation CreateCart($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          id
          totalQuantity
          cost {
            totalAmount { amount currencyCode }
            subtotalAmount { amount currencyCode }
          }
        }
        userErrors { field message }
      }
    }
  `, {
    input: {
      lines: [{ merchandiseId: "gid://shopify/ProductVariant/46920435957812", quantity: 4 }]
    }
  });

  const cart = createRes.data?.cartCreate?.cart;
  console.log("Cart created:", cart.id, "Lines: 4, Subtotal:", cart.cost.subtotalAmount.amount);

  console.log("\n--- SIMULATION: syncCartDiscount applies TEST-BUY4-10OFF ---");
  const updateRes = await postGraphQL(`
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
  `, {
    cartId: cart.id,
    discountCodes: ["TEST-BUY4-10OFF"]
  });

  console.log("Applied TEST-BUY4-10OFF:", JSON.stringify(updateRes.data?.cartDiscountCodesUpdate, null, 2));

  console.log("\n--- SIMULATION: Customer changes quantity to 3 items ---");
  const clearRes = await postGraphQL(`
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
  `, {
    cartId: cart.id,
    discountCodes: []
  });

  console.log("Removed discount for qty 3:", JSON.stringify(clearRes.data?.cartDiscountCodesUpdate, null, 2));
}

simulate().catch(console.error);
