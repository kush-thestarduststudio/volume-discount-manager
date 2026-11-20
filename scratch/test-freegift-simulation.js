async function run() {
  const addRes = await fetch('https://thestarduststudio.com/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [
        { id: 46920435957812, quantity: 8 },
        { id: 48056498421812, quantity: 1, properties: { '_sr_freebie': 'true', '_is_freebie': 'true' } }
      ]
    })
  });
  const cookie = addRes.headers.get('set-cookie');

  let cartRes = await fetch('https://thestarduststudio.com/cart.js', {
    headers: { 'Cookie': cookie || '' }
  });
  let cart = await cartRes.json();
  console.log('=== BEFORE DISCOUNT CODE ===');
  console.log('Total Price:', cart.total_price);
  console.log('Original Total Price:', cart.original_total_price);
  console.log('Cart Level Discounts:', JSON.stringify(cart.cart_level_discount_applications, null, 2));
  console.log('Line Items:', JSON.stringify(cart.items.map(it => ({
    title: it.title,
    qty: it.quantity,
    price: it.price,
    final_price: it.final_price,
    discounts: it.discounts,
    allocations: it.line_level_discount_allocations
  })), null, 2));

  // Now apply FREEGIFT2499 discount code
  const updateRes = await fetch('https://thestarduststudio.com/cart/update.js', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie || ''
    },
    body: JSON.stringify({ discount: 'FREEGIFT2499' })
  });
  cart = await updateRes.json();
  console.log('=== AFTER APPLYING FREEGIFT2499 ===');
  console.log('Total Price:', cart.total_price);
  console.log('Original Total Price:', cart.original_total_price);
  console.log('Cart Level Discounts:', JSON.stringify(cart.cart_level_discount_applications, null, 2));
  console.log('Line Items:', JSON.stringify(cart.items.map(it => ({
    title: it.title,
    qty: it.quantity,
    price: it.price,
    final_price: it.final_price,
    discounts: it.discounts,
    allocations: it.line_level_discount_allocations
  })), null, 2));
}

run().catch(console.error);
