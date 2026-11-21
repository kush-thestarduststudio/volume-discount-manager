async function check() {
  const r = await fetch('https://thestarduststudio.com/products/test?_t=' + Date.now());
  const html = await r.text();
  console.log('--- around 715770 ---');
  console.log(html.slice(715600, 716000));
  console.log('--- around 1067911 ---');
  console.log(html.slice(1067800, 1068200));
}
check().catch(console.error);
