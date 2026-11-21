async function check() {
  const r = await fetch('https://thestarduststudio.com/products/test');
  const t = await r.text();
  const idx = t.indexOf('window.__stardustCustomer');
  console.log('Script around window.__stardustCustomer:');
  console.log(t.substring(idx - 100, idx + 2500));
}
check().catch(console.error);
