async function checkRender() {
  const r = await fetch('https://volume-discount-manager.onrender.com/api/config');
  console.log('Status:', r.status);
  const t = await r.text();
  console.log('Body:', t);
}
checkRender().catch(console.error);
