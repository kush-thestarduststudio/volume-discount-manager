const fetch = globalThis.fetch || require('node-fetch');

async function testShops() {
  const shops = [
    "stardustt-studio.myshopify.com",
    "thestarduststudio.com",
    "stardustt-studio",
    ""
  ];
  for (const s of shops) {
    const res = await fetch(`https://volume-discount-manager.onrender.com/api/config?shop=${s}`);
    const data = await res.json();
    console.log(`=== Query shop: "${s}" ===`);
    console.log("Returned rules:", data.rules?.length);
    for (const r of data.rules || []) {
      console.log(`  Rule: ${r.title} | fbtProducts:`, r.fbtProducts?.map(p => p.title || p.productId));
    }
  }
}

testShops().catch(console.error);
