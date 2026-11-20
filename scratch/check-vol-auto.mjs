async function run() {
  const shop = 'stardustt-studio.myshopify.com';
  const res = await fetch(`https://volume-discount-manager.onrender.com/api/sync-discount?shop=${shop}`);
  const data = await res.json();
  const volAuto = (data.allDiscounts || []).filter(d => d.title && d.title.includes('[Volume]'));
  console.log('Volume automatic discounts:', JSON.stringify(volAuto, null, 2));
}
run().catch(console.error);
