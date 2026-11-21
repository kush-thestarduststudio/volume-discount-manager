async function run() {
  const token = 'c08d56cae211c47c68cb3cd03b882be8';

  const addRes = await fetch('https://thestarduststudio.com/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [
        { id: 46920435957812, quantity: 1 },
        { id: 67911497547828, quantity: 1 }
      ]
    })
  });
  const cookie = addRes.headers.get('set-cookie');
  const cartRes = await fetch('https://thestarduststudio.com/cart.js', {
    headers: { 'Cookie': cookie }
  });
  const cart = await cartRes.json();
  const cartId = `gid://shopify/Cart/${cart.token}`;
  console.log('Cart Items in cart.js:');
  cart.items.forEach(it => console.log(`  ${it.title} - ₹${it.price / 100} x ${it.quantity} (variant: ${it.variant_id}, product: ${it.product_id})`));

  const query = `
    mutation cartDiscountCodesUpdate($id: ID!, $discountCodes: [String!]!) {
      cartDiscountCodesUpdate(cartId: $id, discountCodes: $discountCodes) {
        cart {
          id
          discountCodes {
            code
            applicable
          }
          lines(first: 10) {
            nodes {
              id
              quantity
              cost {
                totalAmount { amount }
                subtotalAmount { amount }
              }
              discountAllocations {
                discountedAmount { amount }
                ... on CartCodeDiscountAllocation { code }
                ... on CartAutomaticDiscountAllocation { title }
              }
            }
          }
          cost {
            subtotalAmount { amount }
            totalAmount { amount }
          }
        }
        userErrors { field message }
      }
    }
  `;

  // First test with NO discount code (checking automatic discount)
  const sfRes1 = await fetch('https://thestarduststudio.com/api/2024-04/graphql.json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
      'Cookie': cookie
    },
    body: JSON.stringify({
      query,
      variables: { id: cartId, discountCodes: [] }
    })
  });
  const sfData1 = await sfRes1.json();
  console.log('\n--- Storefront Cart (NO code): ---');
  console.log('Cost:', JSON.stringify(sfData1.data?.cartDiscountCodesUpdate?.cart?.cost));
  console.log('Line discounts:');
  sfData1.data?.cartDiscountCodesUpdate?.cart?.lines?.nodes?.forEach(l => {
    console.log('  Line cost:', l.cost, 'allocations:', l.discountAllocations);
  });

  // Second test WITH BUNDLE-TEST-10OFF
  const sfRes2 = await fetch('https://thestarduststudio.com/api/2024-04/graphql.json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
      'Cookie': cookie
    },
    body: JSON.stringify({
      query,
      variables: { id: cartId, discountCodes: ['BUNDLE-TEST-10OFF'] }
    })
  });
  const sfData2 = await sfRes2.json();
  console.log('\n--- Storefront Cart (WITH BUNDLE-TEST-10OFF): ---');
  console.log('Discount codes:', sfData2.data?.cartDiscountCodesUpdate?.cart?.discountCodes);
  console.log('Cost:', JSON.stringify(sfData2.data?.cartDiscountCodesUpdate?.cart?.cost));
  console.log('Line discounts:');
  sfData2.data?.cartDiscountCodesUpdate?.cart?.lines?.nodes?.forEach(l => {
    console.log('  Line cost:', l.cost, 'allocations:', l.discountAllocations);
  });

  // Clean up
  await fetch('https://thestarduststudio.com/cart/clear.js', {
    method: 'POST',
    headers: { 'Cookie': cookie }
  });
}
run().catch(console.error);
