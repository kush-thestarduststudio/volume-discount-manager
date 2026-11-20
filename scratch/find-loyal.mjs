async function run() {
  const shop = 'stardustt-studio.myshopify.com';
  const res = await fetch(`https://volume-discount-manager.onrender.com/api/sync-discount?shop=${shop}`);
  const data = await res.json();
  const loyal = (data.allDiscounts || []).filter(d => {
    return (d.title && d.title.includes('LOYAL')) || (d.codes && d.codes.includes('LOYAL'));
  });
  console.log('LOYAL discounts:', JSON.stringify(loyal, null, 2));
}
run().catch(console.error);
