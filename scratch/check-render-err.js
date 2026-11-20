async function run() {
  const shop = 'stardustt-studio.myshopify.com';
  const res = await fetch(`https://volume-discount-manager.onrender.com/api/sync-discount?shop=${shop}`);
  const data = await res.json();
  console.log('Response:', JSON.stringify(data, null, 2));
}
run().catch(console.error);
