async function run() {
  const r = await fetch('https://thestarduststudio.com/products/test?v=' + Date.now());
  const html = await r.text();
  const re = /https:\/\/[^"'\s]+bundle-tier\.js[^"'\s]*/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    console.log('Live script URL:', m[0]);
    const jsRes = await fetch(m[0]);
    const jsText = await jsRes.text();
    console.log('Script size:', jsText.length);
    console.log('Contains cartDiscountCodesUpdate:', jsText.includes('cartDiscountCodesUpdate'));
    console.log('Contains mutateCartDiscountCodes:', jsText.includes('mutateCartDiscountCodes'));
  }
}
run().catch(console.error);
