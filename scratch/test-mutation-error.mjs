async function checkMutation() {
  const res = await fetch('https://volume-discount-manager.onrender.com/api/sync-discount?shop=stardustt-studio.myshopify.com&debug=true');
  const d = await res.json();
  console.log('Sync status:', d.ok);
  if (d.updatedStoreDiscounts) {
    console.log('Updated store discounts:', JSON.stringify(d.updatedStoreDiscounts, null, 2));
  }
}
checkMutation().catch(console.error);
