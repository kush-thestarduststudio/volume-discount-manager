async function run() {
  const addRes = await fetch('https://thestarduststudio.com/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ id: 46920435957812, quantity: 3 }] })
  });
  const cookie = addRes.headers.get('set-cookie');
  const cartRes = await fetch('https://thestarduststudio.com/cart.js', {
    headers: { 'Cookie': cookie }
  });
  const cart = await cartRes.json();
  console.log('Cart items count:', cart.items.length);
  console.log('Cart items properties:', cart.items.map(it => it.properties));
  console.log('Cart total_price:', cart.total_price);
  console.log('Cart original_total_price:', cart.original_total_price);

  await fetch('https://thestarduststudio.com/cart/clear.js', { method: 'POST', headers: { 'Cookie': cookie } });
}
run().catch(console.error);
