async function run() {
  const r = await fetch('https://buyer.fastrr.com');
  const html = await r.text();
  console.log('buyer.fastrr.com html length:', html.length);
  const regex = /src=["']([^"']+\.js[^"']*)["']/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    console.log('Script:', match[1]);
  }
}
run().catch(console.error);
