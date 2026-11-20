async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/static/js/main.9447a641f4155db6cd3b.js');
  const t = await r.text();

  const all = [...t.matchAll(/cartItems/g)];
  console.log('cartItems count:', all.length);
  for (const m of all.slice(0, 10)) {
    console.log('at', m.index, ':', t.slice(m.index - 50, m.index + 200));
    console.log('---');
  }
}
run().catch(console.error);
