async function run() {
  const shop = 'stardustt-studio.myshopify.com';
  console.log('Fetching sync-discount from Render...');
  const res = await fetch(`https://volume-discount-manager.onrender.com/api/sync-discount?shop=${shop}`);
  const data = await res.json();
  if (data.allDiscounts) {
    console.log(`Found ${data.allDiscounts.length} total discounts on store:`);
    console.log(JSON.stringify(data.allDiscounts, null, 2));
  } else {
    console.log('Deploy might still be in progress, response keys:', Object.keys(data));
  }
}
run().catch(console.error);
