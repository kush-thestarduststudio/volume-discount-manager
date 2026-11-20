async function run() {
  const urls = [
    'https://volume-discount-manager.onrender.com/api/config',
    'https://volume-discount-manager.onrender.com/api/config?shop=stardustt-studio.myshopify.com',
    'https://volume-discount-manager.onrender.com/api/config?shop=thestarduststudio.com',
    'https://volume-discount-manager.onrender.com/api/config?shop=the-stardust-development.myshopify.com'
  ];

  for (const u of urls) {
    const res = await fetch(u);
    const data = await res.json();
    console.log(u);
    console.log('  ok:', data.ok, 'rules:', data.rules?.length);
    if (data.rules?.length) {
      console.log('  rule 0:', data.rules[0]?.title, data.rules[0]?.tiers);
    }
  }
}
run().catch(console.error);
