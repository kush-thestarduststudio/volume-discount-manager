async function testBundleWithFreegift() {
  const token = 'c08d56cae211c47c68cb3cd03b882be8';

  const query = `
    mutation cartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          id
          checkoutUrl
          totalQuantity
          cost {
            subtotalAmount { amount }
            totalAmount { amount }
          }
          lines(first: 10) {
            nodes {
              id
              quantity
              merchandise {
                ... on ProductVariant {
                  id
                  title
                  price { amount }
                  product { title }
                }
              }
              cost {
                subtotalAmount { amount }
                totalAmount { amount }
              }
              discountAllocations {
                discountedAmount { amount }
                discountApplication {
                  __typename
                  ... on AutomaticDiscountApplication {
                    title
                  }
                  ... on DiscountCodeApplication {
                    code
                    applicable
                  }
                }
              }
            }
          }
          discountAllocations {
            discountedAmount { amount }
            discountApplication {
              __typename
              ... on AutomaticDiscountApplication {
                title
              }
              ... on DiscountCodeApplication {
                code
                applicable
              }
            }
          }
        }
        userErrors { field message }
      }
    }
  `;

  const sf = await (await fetch('https://thestarduststudio.com/api/2024-04/graphql.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': token },
    body: JSON.stringify({
      query,
      variables: {
        input: {
          lines: [
            { merchandiseId: 'gid://shopify/ProductVariant/46920435957812', quantity: 1 }, // test (400)
            { merchandiseId: 'gid://shopify/ProductVariant/67911497547828', quantity: 1 }, // 7 chakra (199)
            { merchandiseId: 'gid://shopify/ProductVariant/67707044888628', quantity: 1 }, // 1111
            { merchandiseId: 'gid://shopify/ProductVariant/48139976769588', quantity: 1 }, // 777
          ]
        }
      }
    })
  })).json();

  const cart = sf.data?.cartCreate?.cart;
  console.log('Cart subtotal:', cart?.cost?.subtotalAmount?.amount);
  console.log('Cart total:', cart?.cost?.totalAmount?.amount);
  console.log('\n--- Cart Level Discounts ---:');
  console.log(JSON.stringify(cart?.discountAllocations, null, 2));

  console.log('\n--- Line Item Discounts ---:');
  cart?.lines?.nodes?.forEach(l => {
    console.log(l.merchandise?.product?.title, 'qty:', l.quantity, 'subtotal:', l.cost?.subtotalAmount?.amount, 'total:', l.cost?.totalAmount?.amount);
    if (l.discountAllocations?.length) {
      console.log('  Discounts on this line:', JSON.stringify(l.discountAllocations));
    }
  });
}
testBundleWithFreegift().catch(console.error);
