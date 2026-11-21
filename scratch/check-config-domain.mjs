async function check() {
  const r = await fetch('https://volume-discount-manager.onrender.com/api/config?shop=thestarduststudio.com');
  const json = await r.json();
  console.log('For thestarduststudio.com: rules count:', json.rules?.length);
  console.log('Rules:', JSON.stringify(json.rules, null, 2));
}
check().catch(console.error);
