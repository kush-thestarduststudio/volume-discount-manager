async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/static/js/main.9447a641f4155db6cd3b.js');
  const t = await r.text();

  const all = [...t.matchAll(/window\.location\.hash/g)];
  for (const m of all) {
    console.log('window.location.hash at', m.index, ':', t.slice(m.index - 50, m.index + 300));
  }
}
run().catch(console.error);
