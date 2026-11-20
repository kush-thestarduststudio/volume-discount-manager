const fetch = globalThis.fetch || require('node-fetch');

async function testCart() {
  const cfgRes = await fetch("https://volume-discount-manager.onrender.com/api/config?shop=stardustt-studio.myshopify.com");
  const cfg = await cfgRes.json();
  const rules = cfg.rules;

  // Let's create a simulated cart with test + agarbatti
  const cart = {
    total_price: 59900,
    original_total_price: 59900,
    items: [
      {
        id: 46920435957812,
        variant_id: 46920435957812,
        product_id: 7488883753012,
        title: "test",
        price: 40000,
        original_price: 40000,
        original_line_price: 40000,
        quantity: 1,
        properties: {}
      },
      {
        id: 67910792216628,
        variant_id: 67910792216628,
        product_id: 15454599512116,
        title: "Mahalakshmi (Dhan) Flora Masala Agarbatti",
        price: 19900,
        original_price: 19900,
        original_line_price: 19900,
        quantity: 1,
        properties: {}
      }
    ]
  };

  // Now let's run getActiveDiscount from bundle-tier.src.js
  const cleanCode = (t) =>
    (t || "")
      .replace(/^(bundle(\s+for)?[:\s]*|volume(\s+tier)?[:\s]*|collection(\s+tier)?[:\s]*)/i, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 8) || "OFFER";

  function getActiveDiscount(cart, rules) {
    if (!cart?.items?.length || !rules?.length) return { disc: 0, code: null };
    const candidates = [];

    for (const r of rules) {
      if (!r.active) continue;
      const tId = String(r.targetGid || "").replace(/\D/g, "");

      if (r.ruleType === "VOLUME" && r.tiers?.length) {
        // ...
      } else if (r.ruleType === "FBT" && r.fbtProducts?.length) {
        const cIds = r.fbtProducts.map((p) => String(p.productId || "").replace(/\D/g, ""));
        const targetItem = cart.items.find((it) => String(it.product_id) === tId);
        const hasAllCompanions = cIds.every((id) => cart.items.some((it) => String(it.product_id) === id));

        console.log("FBT Rule:", r.title);
        console.log("  tId:", tId, "targetItem found:", !!targetItem);
        console.log("  cIds:", cIds);
        console.log("  hasAllCompanions:", hasAllCompanions);

        if (targetItem && hasAllCompanions) {
          const companionItems = cIds.map((id) => cart.items.find((it) => String(it.product_id) === id));
          const bundleCount = Math.min(targetItem.quantity, ...companionItems.map((it) => it?.quantity || 1));
          const isFixed = r.discountType === "FIXED_AMOUNT";
          const val = Number(isFixed ? r.discountValue : (r.mainDiscountPercent || r.discountValue || r.fbtProducts[0]?.discountPercent || 10));
          let disc = 0;

          if (isFixed) {
            disc = Math.round(bundleCount * val * 100);
          } else {
            const bp = Number(r.mainDiscountPercent || val || 0);
            const targetUnit = Math.round((targetItem.original_line_price || targetItem.price * targetItem.quantity) / targetItem.quantity);
            if (bp > 0) disc += Math.round(targetUnit * bundleCount * (bp / 100));

            companionItems.forEach((it, idx) => {
              if (!it) return;
              const cp = Number(r.fbtProducts[idx]?.discountPercent || bp || 10);
              const unit = Math.round((it.original_line_price || it.price * it.quantity) / it.quantity);
              disc += Math.round(unit * bundleCount * (cp / 100));
            });
          }
          const code = r.discountCode || `BUNDLE-${cleanCode(r.title)}-${val}OFF`;
          candidates.push({ disc, code, type: "FBT" });
        }
      }
    }

    console.log("Candidates:", candidates);
  }

  getActiveDiscount(cart, rules);
}

testCart().catch(console.error);
