async function check() {
  const r = await fetch('https://thestarduststudio.com/products/test');
  const t = await r.text();
  const idx = t.indexOf('window.__stardustCustomer');
  console.log(t.substring(idx + 4900, idx + 8000));
}
check().catch(console.error);
