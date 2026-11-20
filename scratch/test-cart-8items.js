async function testCart() {
  const addRes = await fetch('https://thestarduststudio.com/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ id: 46920435957812, quantity: 8 }] })
  });
  const cookie = addRes.headers.get('set-cookie');
  console.log('Added 8 items, set-cookie:', cookie);

  const cartRes = await fetch('https://thestarduststudio.com/cart.js', {
    headers: { 'Cookie': cookie || '' }
  });
  const cart = await cartRes.json();
  console.log('Cart original_total_price:', cart.original_total_price);
  console.log('Cart total_price:', cart.total_price);
  console.log('Cart items_subtotal_price:', cart.items_subtotal_price);
  console.log('Cart discount_applications:', JSON.stringify(cart.cart_level_discount_applications, null, 2));
  console.log('Cart items:', JSON.stringify(cart.items.map(it => ({
    title: it.title,
    quantity: it.quantity,
    price: it.price,
    original_price: it.original_price,
    final_price: it.final_price,
    line_level_discount_allocations: it.line_level_discount_allocations,
    discounts: it.discounts
  })), null, 2));
}

testCart().catch(console.error);
