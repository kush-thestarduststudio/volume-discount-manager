async function run() {
  const r = await fetch('https://thestarduststudio.com/apps/selleasy/v2/config');
  console.log('Selleasy config status:', r.status);
  const text = await r.text();
  console.log('Selleasy config response:', text.slice(0, 500));
}
run().catch(console.error);
