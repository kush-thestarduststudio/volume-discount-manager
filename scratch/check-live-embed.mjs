async function check() {
  const r = await fetch('https://thestarduststudio.com/products/test?_t=' + Date.now());
  const html = await r.text();
  console.log('Includes bundle-tier:', html.includes('bundle-tier'));
  console.log('Includes bt-fbt:', html.includes('bt-fbt'));
  console.log('Includes bt-widget:', html.includes('bt-widget'));
  console.log('Includes Frequently Bought Together:', html.includes('Frequently Bought Together'));
}
check().catch(console.error);
