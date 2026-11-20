async function run() {
  const r = await fetch('https://thestarduststudio.com/products/test');
  const html = await r.text();
  const re = /<script[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const src = m[1];
    if (/selleasy|bundle|discount|fastrr|pickrr|shiprocket|bogos/i.test(src)) {
      console.log('Script:', src);
    }
  }
}
run().catch(console.error);
