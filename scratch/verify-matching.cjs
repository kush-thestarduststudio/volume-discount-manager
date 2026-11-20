const cart = {
  total_price: 59900,
  original_total_price: 59900,
  items: [
    {
      key: "46920435957812:abc",
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
      key: "67910792216628:def",
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

const rules = [
  {
    id: "fbt-1",
    title: "Bundle for: test",
    ruleType: "FBT",
    active: true,
    targetGid: "gid://shopify/Product/7488883753012",
    discountType: "PERCENTAGE",
    discountValue: 10,
    mainDiscountPercent: 10,
    triggerProduct: {
      id: "7488883753012",
      variantId: "46920435957812"
    },
    fbtProducts: [
      {
        productId: "15454599512116",
        variantId: "67910792216628",
        title: "Mahalakshmi (Dhan) Flora Masala Agarbatti",
        priceCents: 19900,
        discountPercent: 10
      }
    ]
  }
];

const targetItemPrices = new Map();

for (const r of rules) {
  if (!r.active || r.ruleType !== "FBT" || !r.fbtProducts?.length) continue;
  const tId = String(r.targetGid || "").replace(/\D/g, "");
  const targetItem = cart.items.find((it) =>
    String(it.product_id) === tId ||
    (r.triggerProduct?.variantId && String(it.variant_id) === String(r.triggerProduct.variantId).replace(/\D/g, ""))
  );
  const hasAllCompanions = r.fbtProducts.every((p) => {
    const cpId = String(p.productId || "").replace(/\D/g, "");
    const cpVId = String(p.variantId || "").replace(/\D/g, "");
    return cart.items.some((it) =>
      (cpId && String(it.product_id) === cpId) ||
      (cpVId && String(it.variant_id) === cpVId)
    );
  });

  console.log("targetItem found:", !!targetItem);
  console.log("hasAllCompanions:", hasAllCompanions);

  if (targetItem && hasAllCompanions) {
    const isFixed = r.discountType === "FIXED_AMOUNT";
    const val = Number(isFixed ? r.discountValue : (r.mainDiscountPercent || r.discountValue || r.fbtProducts[0]?.discountPercent || 10));
    const bp = Number(r.mainDiscountPercent || val || 0);
    const tUnitCents = Math.round((targetItem.original_line_price || targetItem.price * targetItem.quantity) / targetItem.quantity);
    const tPriceRupees = isFixed
      ? Math.max(0, Math.round(tUnitCents - val * 100) / 100)
      : Math.round(tUnitCents * (100 - bp) / 100) / 100;
    targetItemPrices.set(targetItem.key, tPriceRupees);

    r.fbtProducts.forEach((p, idx) => {
      const cpId = String(p.productId || "").replace(/\D/g, "");
      const cpVId = String(p.variantId || "").replace(/\D/g, "");
      const compItem = cart.items.find((it) =>
        (cpId && String(it.product_id) === cpId) ||
        (cpVId && String(it.variant_id) === cpVId)
      );
      if (compItem) {
        const cp = Number(p.discountPercent || bp || 10);
        const cUnitCents = Math.round((compItem.original_line_price || compItem.price * compItem.quantity) / compItem.quantity);
        const cPriceRupees = isFixed
          ? Math.round(cUnitCents / 100)
          : Math.round(cUnitCents * (100 - cp) / 100) / 100;
        targetItemPrices.set(compItem.key, cPriceRupees);
      }
    });
  }
}

console.log("targetItemPrices:", Array.from(targetItemPrices.entries()));
