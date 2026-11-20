async function run() {
  const shop = 'stardustt-studio.myshopify.com';
  console.log('--- Fetching live config from Render ---');
  try {
    const res = await fetch(`https://volume-discount-manager.onrender.com/api/config?shop=${shop}`);
    const data = await res.json();
    console.log('Config rules count:', data.rules?.length);
    console.log(JSON.stringify(data.rules, null, 2));
  } catch (e) {
    console.error('Config fetch error:', e);
  }

  console.log('\n--- Fetching live sync-discount from Render ---');
  try {
    const res2 = await fetch(`https://volume-discount-manager.onrender.com/api/sync-discount?shop=${shop}`);
    const data2 = await res2.json();
    console.log('Sync discount response:', JSON.stringify(data2, null, 2));
  } catch (e) {
    console.error('Sync discount error:', e);
  }
}
run();
