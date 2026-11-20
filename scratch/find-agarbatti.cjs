const fetch = globalThis.fetch || require('node-fetch');

async function test() {
  let page = 1;
  let all = [];
  while (page <= 5) {
    const res = await fetch(`https://thestarduststudio.com/products.json?limit=250&page=${page}`);
    const data = await res.json();
    if (!data.products?.length) break;
    all.push(...data.products);
    page++;
  }
  console.log("Total products fetched:", all.length);
  const m = all.filter(p => p.title.toLowerCase().includes("mahalakshmi") || p.title.toLowerCase().includes("agarbatti") || String(p.id) === "15454599512116");
  console.log("Matches:", m.map(p => ({ id: p.id, title: p.title, handle: p.handle, variantId: p.variants?.[0]?.id })));
}

test().catch(console.error);
