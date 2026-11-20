async function run() {
  const r = await fetch('https://thestarduststudio.com/products/test.js');
  const p = await r.json();
  console.log('Product ID:', p.id);
  console.log('GID:', 'gid://shopify/Product/' + p.id);
  console.log('Variants:', p.variants.map(v => ({ id: v.id, price: v.price })));
}
run().catch(console.error);
