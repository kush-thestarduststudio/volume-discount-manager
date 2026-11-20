const fetch = globalThis.fetch || require('node-fetch');

async function main() {
  const res = await fetch("https://fastrr-boost-ui.pickrr.com/");
  const html = await res.text();
  console.log(html.substring(0, 2000));
}

main().catch(console.error);
