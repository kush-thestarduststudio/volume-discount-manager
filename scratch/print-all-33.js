async function run() {
  const res = await fetch(`https://volume-discount-manager.onrender.com/api/sync-discount?shop=stardustt-studio.myshopify.com`);
  const data = await res.json();
  const list = data.allDiscounts || [];
  console.log(`Total discounts: ${list.length}`);
  list.forEach((d, i) => {
    console.log(`${i+1}. [${d.typename}] Title: "${d.title}" Status: ${d.status} Codes: ${JSON.stringify(d.codes)} CombinesWith: ${JSON.stringify(d.combinesWith)}`);
  });
}
run().catch(console.error);
