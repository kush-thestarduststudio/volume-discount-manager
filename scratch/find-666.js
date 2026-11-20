async function find666() {
  let page = 1;
  while (page <= 5) {
    const r = await fetch(`https://thestarduststudio.com/products.json?limit=250&page=${page}`);
    const d = await r.json();
    if (!d.products || !d.products.length) break;
    for (const p of d.products) {
      for (const v of p.variants) {
        if (v.price === '666.00' || p.title.toLowerCase().includes('om stone')) {
          console.log('Match:', p.id, p.title, v.id, v.price);
        }
      }
    }
    page++;
  }
}
find666().catch(console.error);
