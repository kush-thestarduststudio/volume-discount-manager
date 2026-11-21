async function check() {
  const r = await fetch('https://volume-discount-manager.onrender.com/api/sync-discount?shop=stardustt-studio.myshopify.com');
  const json = await r.json();
  console.log('Keys:', Object.keys(json));
  console.log('JSON:', JSON.stringify(json, null, 2).slice(0, 2000));
}
check().catch(console.error);
