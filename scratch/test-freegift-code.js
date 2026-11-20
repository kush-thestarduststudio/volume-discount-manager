async function testDiscountCode() {
  // First add 8 items
  const addRes = await fetch('https://thestarduststudio.com/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ id: 46920435957812, quantity: 8 }] })
  });
  const cookie = addRes.headers.get('set-cookie');

  // Try applying FREEGIFT2499 via /cart/update.js
  const updateRes = await fetch('https://thestarduststudio.com/cart/update.js', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie || ''
    },
    body: JSON.stringify({ discount: 'FREEGIFT2499' })
  });
  const updateCart = await updateRes.json();
  console.log('--- After discount: FREEGIFT2499 ---');
  console.log('Cart original_total_price:', updateCart.original_total_price);
  console.log('Cart total_price:', updateCart.total_price);
  console.log('Cart items_subtotal_price:', updateCart.items_subtotal_price);
  console.log('Cart discount_applications:', JSON.stringify(updateCart.cart_level_discount_applications, null, 2));
  console.log('Cart items discounts:', JSON.stringify(updateCart.items.map(it => ({
    title: it.title,
    quantity: it.quantity,
    price: it.price,
    final_price: it.final_price,
    discounts: it.discounts,
    line_level_discount_allocations: it.line_level_discount_allocations
  })), null, 2));
}

testDiscountCode().catch(console.error);
