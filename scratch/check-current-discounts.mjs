async function run() {
  const shop = 'stardustt-studio.myshopify.com';
  const res = await fetch(`https://volume-discount-manager.onrender.com/api/sync-discount?shop=${shop}`);
  const data = await res.json();
  console.log('Total discounts in store:', data.allDiscounts?.length);
  const appDiscounts = (data.allDiscounts || []).filter(d => 
    (d.title && (d.title.includes('BUNDLE') || d.title.includes('Bundle') || d.title.includes('Volume') || d.title.includes('TEST'))) ||
    (d.codes && d.codes.some(c => c.includes('BUNDLE') || c.includes('BUY') || c.includes('TEST')))
  );
  console.log('App discounts in Shopify Admin:');
  console.log(JSON.stringify(appDiscounts, null, 2));
}
run().catch(console.error);
