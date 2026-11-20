const fetch = globalThis.fetch || require('node-fetch');

async function sync() {
  const res = await fetch("https://volume-discount-manager.onrender.com/api/sync-discount?shop=stardustt-studio.myshopify.com");
  const data = await res.json();
  console.log("Sync Response:", JSON.stringify(data, null, 2));
}

sync().catch(console.error);
