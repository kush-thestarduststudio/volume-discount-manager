async function test() {
  const token = 'c08d56cae211c47c68cb3cd03b882be8';

  // 1. Add 2 test products to cart
  const addRes = await fetch('https://thestarduststudio.com/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ id: 46920435957812, quantity: 2 }] })
  });
  const cookie = addRes.headers.get('set-cookie');
  const cartRes = await fetch('https://thestarduststudio.com/cart.js', {
    headers: { 'Cookie': cookie }
  });
  const cart = await cartRes.json();
  console.log('Cart token:', cart.token);

  const cartId = `gid://shopify/Cart/${cart.token}`;

  // 2. Call Storefront API mutation cartDiscountCodesUpdate
  const query = `
    mutation cartDiscountCodesUpdate($id: ID!, $discountCodes: [String!]!) {
      cartDiscountCodesUpdate(cartId: $id, discountCodes: $discountCodes) {
        cart {
          id
          discountCodes {
            code
            applicable
          }
          cost {
            totalAmount {
              amount
              currencyCode
            }
            subtotalAmount {
              amount
              currencyCode
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const sfRes = await fetch('https://thestarduststudio.com/api/2024-04/graphql.json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
      'Cookie': cookie
    },
    body: JSON.stringify({
      query,
      variables: {
        id: cartId,
        discountCodes: ['TEST-BUY2-10OFF']
      }
    })
  });

  const sfData = await sfRes.json();
  console.log('Storefront API response:', JSON.stringify(sfData, null, 2));

  // 3. Fetch /cart.js to see if discount is reflected in Shopify standard cart!
  const cartRes2 = await fetch('https://thestarduststudio.com/cart.js', {
    headers: { 'Cookie': cookie }
  });
  const cart2 = await cartRes2.json();
  console.log('\n/cart.js original total:', cart2.original_total_price);
  console.log('/cart.js total price:', cart2.total_price);
  console.log('/cart.js total discount:', cart2.total_discount);
  console.log('/cart.js items final prices:', cart2.items.map(it => ({ id: it.id, orig: it.original_price, final: it.final_price })));
  console.log('/cart.js discount codes:', cart2.cart_level_discount_applications);

  // 4. Clean up
  await fetch('https://thestarduststudio.com/cart/clear.js', {
    method: 'POST',
    headers: { 'Cookie': cookie }
  });
  console.log('Cart cleared.');
}
test().catch(console.error);
