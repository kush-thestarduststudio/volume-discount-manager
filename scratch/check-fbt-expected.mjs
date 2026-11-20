async function run() {
  const shop = 'stardustt-studio.myshopify.com';
  // Check the sync endpoint to see what expectedDiscounts had for FBT
  const res = await fetch(`https://volume-discount-manager.onrender.com/api/sync-discount?shop=${shop}`);
  const data = await res.json();
  const fbtExp = (data.expectedDiscounts || []).find(d => d.type === 'FBT');
  console.log('FBT expected discount:', JSON.stringify(fbtExp, null, 2));
}
run().catch(console.error);
