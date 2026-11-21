async function check() {
  const r = await fetch('https://thestarduststudio.com/products/test?_t=' + Date.now());
  const html = await r.text();
  console.log('Includes bundle-tier.css:', html.includes('bundle-tier.css'));
  console.log('Includes bundle-tier.js:', html.includes('bundle-tier.js'));
  console.log('Includes __btAutoInject:', html.includes('__btAutoInject'));
  console.log('Includes __btRules:', html.includes('__btRules'));
}
check().catch(console.error);
