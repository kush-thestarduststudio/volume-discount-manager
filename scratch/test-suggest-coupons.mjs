async function testSuggestCoupons() {
  const sellerId = "447878725633"; // Or let's find the sellerId from smart-cart
  // Let's test calling suggest-coupons/cart
  const endpoints = [
    'https://edge.pickrr.com/promotion/api/ve1/promotion-service/cart/suggest-coupons/cart',
    'https://edge-service-dev.pickrr.com/promotion/api/ve1/promotion-service/cart/suggest-coupons/cart'
  ];

  for (const ep of endpoints) {
    try {
      const payload1 = {
        sellerId: "stardust-studio",
        platform: "SHOPIFY",
        subTotal: 599,
        items: [
          { qty: 1, price: 400, subTotal: 400, productId: 7488883753012, variantId: 46920435957812, customAttributes: {} },
          { qty: 1, price: 199, subTotal: 199, productId: 15455228297268, variantId: 67911497547828, customAttributes: {} }
        ]
      };
      const r = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload1)
      });
      console.log(ep, 'status:', r.status);
      const text = await r.text();
      console.log('Response:', text.slice(0, 300));
    } catch (e) {
      console.log(ep, 'error:', e.message);
    }
  }
}
testSuggestCoupons().catch(console.error);
