async function run() {
  const token = 'c08d56cae211c47c68cb3cd03b882be8';

  // 1. Add test + Mahalakshmi Agarbatti to cart
  const addRes = await fetch('https://thestarduststudio.com/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [
        { id: 46920435957812, quantity: 1 }, // test
        { id: 67910792216628, quantity: 1 }  // Mahalakshmi Agarbatti
      ]
    })
  });
  const cookie = addRes.headers.get('set-cookie');
  console.log('Add status:', addRes.status);

  // 2. Query /cart.js
  const cartRes = await fetch('https://thestarduststudio.com/cart.js', {
    headers: { 'Cookie': cookie }
  });
  const cart = await cartRes.json();
  console.log('Cart items count:', cart.items?.length);
  console.log('Cart items:', cart.items?.map(i => ({ id: i.id, title: i.title, price: i.price, discounted_price: i.discounted_price, line_level_discount_allocations: i.line_level_discount_allocations })));
  console.log('Cart original total:', cart.original_total_price);
  console.log('Cart total price:', cart.total_price);
  console.log('Cart level discount applications:', cart.cart_level_discount_applications);

  // 3. What about Storefront API cart query?
  const cartId = `gid://shopify/Cart/${cart.token}`;
  const sfRes = await fetch('https://thestarduststudio.com/api/2024-04/graphql.json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
      'Cookie': cookie
    },
    body: JSON.stringify({
      query: `query getCart($id: ID!) {
        cart(id: $id) {
          id
          lines(first: 10) {
            nodes {
              id
              quantity
              merchandise {
                ... on ProductVariant {
                  id
                  title
                  product { title }
                }
              }
              cost {
                totalAmount { amount }
                subtotalAmount { amount }
              }
              discountAllocations {
                discountedAmount { amount }
                ... on CartAutomaticDiscountAllocation { title }
                ... on CartCodeDiscountAllocation { code }
              }
            }
          }
          discountAllocations {
            discountedAmount { amount }
            ... on CartAutomaticDiscountAllocation { title }
            ... on CartCodeDiscountAllocation { code }
          }
          cost {
            subtotalAmount { amount }
            totalAmount { amount }
          }
        }
      }`,
      variables: { id: cartId }
    })
  });
  const sfData = await sfRes.json();
  console.log('\nStorefront API cart:');
  console.log(JSON.stringify(sfData.data?.cart, null, 2));

  // Clean up
  await fetch('https://thestarduststudio.com/cart/clear.js', {
    method: 'POST',
    headers: { 'Cookie': cookie }
  });
}
run().catch(console.error);
