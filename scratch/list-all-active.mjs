async function check() {
  const r = await fetch('https://volume-discount-manager.onrender.com/api/sync-discount?shop=stardustt-studio.myshopify.com');
  const json = await r.json();
  console.log('All active discount codes:');
  json.allDiscounts.filter(d => d.status === 'ACTIVE').forEach(d => {
    console.log(`- ${d.title} (${d.typename}): codes = ${JSON.stringify(d.codes)} combinesWith = ${JSON.stringify(d.combinesWith)}`);
  });
}
check().catch(console.error);
