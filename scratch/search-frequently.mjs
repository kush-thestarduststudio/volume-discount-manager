async function check() {
  const r = await fetch('https://thestarduststudio.com/products/test?_t=' + Date.now());
  const html = await r.text();
  console.log('Includes Frequently:', html.includes('Frequently'));
  console.log('Includes Bought:', html.includes('Bought'));
  console.log('Includes 7 Chakra:', html.includes('7 Chakra'));
  console.log('Includes Ashtaganda:', html.includes('Ashtaganda'));
}
check().catch(console.error);
