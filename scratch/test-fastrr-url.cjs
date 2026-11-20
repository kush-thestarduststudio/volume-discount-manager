// Test script to inspect Fastrr checkout payload and behavior
const fetch = globalThis.fetch || require('node-fetch');

const productsWithBundle = [
  {
    variantId: 43182450442292, // test variant
    quantity: 1,
    price: 360, // discounted bundle price!
    customAttributes: {
      _isYtBundle: "true",
      _bundleItems: JSON.stringify([{ variantId: 43182450442292, quantity: 1, price: 360 }])
    }
  },
  {
    productId: 7277864485044, // 5 Mukhi Rudraksha
    variantId: 42129037230260,
    title: "5 Mukhi Rudraksha (Big)",
    price: 500,
    quantity: 1,
    item_meta_data: { properties: {} },
    customAttributes: {}
  }
];

const b64 = Buffer.from(encodeURIComponent(JSON.stringify(productsWithBundle))).toString('base64');
const checkoutUrl = `https://fastrr-boost-ui.pickrr.com/?seller=stardustt-studio.myshopify.com&platform=SHOPIFY&type=cart#cart=${b64}`;

console.log("Generated Fastrr Checkout URL with _isYtBundle:");
console.log(checkoutUrl);
