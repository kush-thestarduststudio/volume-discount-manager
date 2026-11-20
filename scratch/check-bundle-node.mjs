async function run() {
  const shop = 'stardustt-studio.myshopify.com';
  // Let's use our api/sync-discount or inspect the discount definition
  const res = await fetch(`https://volume-discount-manager.onrender.com/api/sync-discount?shop=${shop}`);
  const data = await res.json();
  const bundle = (data.allDiscounts || []).find(d => d.title && d.title.includes('[Bundle] Bundle for: test'));
  console.log('Bundle discount definition:', JSON.stringify(bundle, null, 2));
}
run().catch(console.error);
