const fetch = globalThis.fetch || require('node-fetch');

async function check() {
  const res = await fetch("https://volume-discount-manager.onrender.com/api/config?shop=stardustt-studio.myshopify.com");
  const data = await res.json();
  console.log("Config OK:", data.ok);
  console.log("Total Rules:", data.rules?.length);
  for (const r of data.rules || []) {
    console.log(`- [${r.ruleType}] "${r.title}" (active: ${r.active}) target: ${r.targetGid}`);
    if (r.tiers) console.log("  Tiers:", JSON.stringify(r.tiers));
    if (r.fbtProducts) console.log("  FBT Products:", JSON.stringify(r.fbtProducts));
  }
}

check().catch(console.error);
