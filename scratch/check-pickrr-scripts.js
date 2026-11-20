async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/');
  const html = await r.text();
  console.log('fastrr-boost-ui html length:', html.length);
  const regex = /src=["']([^"']+\.js[^"']*)["']/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    console.log('Script:', match[1]);
  }
}
run().catch(console.error);
