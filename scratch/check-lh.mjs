async function run() {
  const r = await fetch('https://cdn.shopify.com/extensions/01a1f8b7-ba56-7c97-b680-f8d946a4d7c2/shiprocket-smart-cart-262/assets/liquid-handlers.min.js');
  const t = await r.text();
  console.log('liquid-handlers.min.js length:', t.length);
  console.log(t.slice(0, 1000));
}
run().catch(console.error);
