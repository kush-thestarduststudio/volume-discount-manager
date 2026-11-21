async function check() {
  const r = await fetch('https://volume-discount-manager.onrender.com/api/sync-discount?shop=stardustt-studio.myshopify.com');
  const json = await r.json();
  const loyal = json.allDiscounts.filter(d => (d.title || '').includes('LOYAL') || (d.codes || []).some(c => c.includes('LOYAL')));
  console.log('Loyal discounts in allDiscounts:', JSON.stringify(loyal, null, 2));
}
check().catch(console.error);
