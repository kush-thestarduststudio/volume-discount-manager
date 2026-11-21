async function check() {
  const r = await fetch('https://thestarduststudio.com/products/test?_t=' + Date.now());
  const html = await r.text();
  const re = /bundle-tier|fbt|volume-tier/gi;
  let m;
  const found = [];
  while ((m = re.exec(html)) !== null) {
    found.push({ match: m[0], index: m.index });
  }
  console.log('Matches on PDP:', found);
}
check().catch(console.error);
