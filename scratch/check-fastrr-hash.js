async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/static/js/main.9447a641f4155db6cd3b.js');
  const t = await r.text();

  const idx = t.indexOf('window.location.hash');
  console.log('window.location.hash at:', idx);
  if (idx !== -1) {
    console.log(t.slice(idx - 100, idx + 600));
  }

  // Also search for "cart="
  const matches = [...t.matchAll(/#cart=|cart=/g)];
  for (const m of matches.slice(0, 5)) {
    console.log('match at', m.index, ':', t.slice(m.index - 50, m.index + 200));
  }
}
run().catch(console.error);
