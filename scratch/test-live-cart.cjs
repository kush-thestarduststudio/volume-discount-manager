const fetch = globalThis.fetch || require('node-fetch');

async function testStorefrontCart() {
  // 1. Add test + Mahalakshmi Agarbatti to a test cart session
  const addRes = await fetch("https://thestarduststudio.com/cart/add.js", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [
        {
          id: 46920435957812, // test variant
          quantity: 1,
          properties: {
            _isYtBundle: "true",
            _bundleItems: JSON.stringify([{
              productId: 7488883753012,
              variantId: 46920435957812,
              title: "test",
              quantity: 1,
              price: 360
            }])
          }
        },
        {
          id: 67910792216628, // Mahalakshmi Agarbatti variant
          quantity: 1,
          properties: {
            _isYtBundle: "true",
            _bundleItems: JSON.stringify([{
              productId: 15454599512116,
              variantId: 67910792216628,
              title: "Mahalakshmi (Dhan) Flora Masala Agarbatti",
              quantity: 1,
              price: 179.1
            }])
          }
        }
      ]
    })
  });

  const cookie = addRes.headers.get("set-cookie");
  console.log("Add response status:", addRes.status);

  // 2. Fetch cart.js
  const cartRes = await fetch("https://thestarduststudio.com/cart.js", {
    headers: { Cookie: cookie }
  });
  const cart = await cartRes.json();
  console.log("Cart items count:", cart.items?.length);
  for (const it of cart.items || []) {
    console.log(`- ${it.title} (x${it.quantity}) price: ₹${it.price/100}`);
    console.log(`  properties:`, it.properties);
  }

  // 3. Generate Fastrr checkout products simulation
  const fastrrProducts = [];
  for (const t of cart.items) {
    if ("true" === t.properties?._isYtBundle) {
      const parsed = JSON.parse(t.properties._bundleItems);
      parsed.forEach(p => {
        fastrrProducts.push({
          variantId: p.variantId,
          quantity: p.quantity,
          price: p.price,
          customAttributes: t.properties
        });
      });
    } else {
      fastrrProducts.push({
        variantId: t.variant_id,
        quantity: t.quantity,
        price: parseFloat((t.price / 100).toFixed(2))
      });
    }
  }

  console.log("\nFastrr Checkout Products array:");
  console.log(JSON.stringify(fastrrProducts, null, 2));

  const totalFastrrPrice = fastrrProducts.reduce((s, p) => s + (p.price * p.quantity), 0);
  console.log(`\nFastrr Checkout Calculated Total: ₹${totalFastrrPrice} (Original: ₹599.00)`);

  // Clean up test cart
  await fetch("https://thestarduststudio.com/cart/clear.js", {
    method: "POST",
    headers: { Cookie: cookie }
  });
  console.log("Test cart cleaned up successfully.");
}

testStorefrontCart().catch(console.error);
