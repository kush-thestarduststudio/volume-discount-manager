async function run() {
  const r = await fetch('https://smart-cart.shiprocket.com/smart-cart.min.js');
  const t = await r.text();

  const idx = t.indexOf('handleShiprocketSmartCartBuy');
  console.log('Index:', idx);
  console.log(t.slice(idx - 100, idx + 1000));
}
run().catch(console.error);
