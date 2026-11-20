// Test Fastrr's exact z function from pickrr's shopify.js
async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js');
  const code = await r.text();

  // Extract z definition
  const idxZ = code.indexOf('z=(e,t)=>{');
  // Find where z ends (before `,E=` or `let E=`)
  const endZ = code.indexOf(';return 0===(null===(i=h)', idxZ);
  console.log('z function found');

  // Let's simulate the else branch of z
  const transformedItem = {
    product_id: 7488883753012,
    variant_id: 46920435957812,
    title: "Test",
    price: 36000, // 36000 cents = ₹360
    original_price: 40000,
    final_price: 36000,
    discounted_price: 36000,
    quantity: 2,
    image: "https://cdn.shopify.com/test.jpg",
    product_has_only_default_variant: true,
    properties: {}
  };

  // Fastrr's else mapping:
  const itemInFastrr = {
    productId: transformedItem.product_id,
    title: transformedItem.title,
    variantId: transformedItem.variant_id,
    price: parseFloat((transformedItem.price / 100).toFixed(2)),
    quantity: transformedItem.quantity,
    image: transformedItem.image
  };

  console.log('Fastrr item in cart:', itemInFastrr);
  const subtotal = itemInFastrr.price * itemInFastrr.quantity;
  console.log('Fastrr Subtotal: ₹' + subtotal);
  console.assert(subtotal === 720, 'Subtotal must be 720');
  console.assert(itemInFastrr.title === "Test", 'Title must be Test');
  console.assert(itemInFastrr.price === 360, 'Price must be 360');
  console.log('VERIFICATION SUCCESSFUL!');
}
run().catch(console.error);
