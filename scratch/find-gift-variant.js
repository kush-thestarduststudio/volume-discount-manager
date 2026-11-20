async function findGift() {
  const r = await fetch('https://thestarduststudio.com/products.json?limit=250');
  const d = await r.json();
  const gift = d.products.find(p => p.title.toLowerCase().includes('negativity') || p.title.toLowerCase().includes('om stone'));
  if (gift) {
    console.log('Gift Product:', gift.id, gift.title);
    console.log('Gift Variants:', gift.variants.map(v => ({ id: v.id, price: v.price })));
  } else {
    console.log('Gift not found in products.json, searching...');
    const allMatching = d.products.filter(p => p.title.toLowerCase().includes('stone') || p.title.toLowerCase().includes('removal'));
    console.log(allMatching.map(p => ({ id: p.id, title: p.title })));
  }
}
findGift().catch(console.error);
