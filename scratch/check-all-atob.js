async function run() {
  const r = await fetch('https://fastrr-boost-ui.pickrr.com/static/js/main.9447a641f4155db6cd3b.js');
  const t = await r.text();

  const allAtob = [...t.matchAll(/window\.atob\(([^)]+)\)/g)];
  console.log('atob count:', allAtob.length);
  for (const m of allAtob.slice(0, 8)) {
    console.log(m[0], 'at', m.index, ':', t.slice(m.index - 50, m.index + 250));
    console.log('---');
  }
}
run().catch(console.error);
