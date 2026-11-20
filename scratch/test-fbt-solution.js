// Add FBT test case to test-full-solution.js
const mockFbtRules = [
  {
    id: "cmwn_fbt_1",
    title: "Bundle for: Test",
    targetType: "PRODUCT",
    targetGid: "gid://shopify/Product/7488883753012",
    ruleType: "FBT",
    mainDiscountPercent: 10,
    fbtProducts: [
      {
        productId: "gid://shopify/Product/7488883759999",
        variantId: "46920435999999",
        title: "5 Mukhi Rudraksha",
        priceCents: 45000,
        discountPercent: 10
      }
    ],
    active: true
  }
];

function transformFbtCart(cart, rules) {
  if (!cart || !Array.isArray(cart.items)) return cart;
  const transformed = JSON.parse(JSON.stringify(cart));
  const fRules = (rules || []).filter(r => r.active && r.ruleType === "FBT" && r.fbtProducts?.length);

  for (const fr of fRules) {
    const tId = String(fr.targetGid || "").replace(/\D/g, "");
    const cIds = fr.fbtProducts.map(p => String(p.productId || "").replace(/\D/g, ""));
    const targetItem = transformed.items.find(it => String(it.product_id) === tId);
    const hasAll = targetItem && cIds.every(id => transformed.items.some(it => String(it.product_id) === id));

    if (hasAll) {
      const isFixed = fr.discountType === "FIXED_AMOUNT";
      const val = Number(isFixed ? fr.discountValue : (fr.mainDiscountPercent || fr.discountValue || 10));

      transformed.items.forEach(item => {
        const pId = String(item.product_id);
        const origUnit = (item.original_price || item.price) / 100;
        let discUnit = origUnit;

        if (pId === tId) {
          const bp = Number(fr.mainDiscountPercent || val || 0);
          discUnit = isFixed ? Math.max(0, origUnit - (val / (1 + cIds.length))) : Math.max(0, origUnit * (1 - bp / 100));
        } else if (cIds.includes(pId)) {
          const cp = fr.fbtProducts.find(p => String(p.productId || "").replace(/\D/g, "") === pId);
          const cpPct = Number(cp?.discountPercent || val || 10);
          discUnit = isFixed ? Math.max(0, origUnit - (val / (1 + cIds.length))) : Math.max(0, origUnit * (1 - cpPct / 100));
        }

        if (discUnit < origUnit) {
          const roundUnit = Number(discUnit.toFixed(2));
          item.properties = item.properties || {};
          item.properties._isYtBundle = "true";
          item.properties._bundleItems = JSON.stringify([{
            variantId: item.variant_id,
            quantity: item.quantity,
            price: roundUnit
          }]);
          item.final_price = Math.round(roundUnit * 100);
          item.final_line_price = item.final_price * item.quantity;
        }
      });
    }
  }
  return transformed;
}

// Test FBT Cart: 1 Test (₹400) + 1 Rudraksha (₹450)
const rawFbtCart = {
  original_total_price: 85000,
  total_price: 85000,
  items: [
    {
      product_id: 7488883753012,
      variant_id: 46920435957812,
      title: "test",
      price: 40000,
      original_price: 40000,
      quantity: 1,
      properties: {}
    },
    {
      product_id: 7488883759999,
      variant_id: 46920435999999,
      title: "5 Mukhi Rudraksha",
      price: 45000,
      original_price: 45000,
      quantity: 1,
      properties: {}
    }
  ]
};

const transformedFbt = transformFbtCart(rawFbtCart, mockFbtRules);
console.log("Transformed FBT items:", transformedFbt.items.map(it => ({ id: it.variant_id, price: it.final_price, props: it.properties })));
const fastrrFbt = transformedFbt.items.map(it => {
  const b = JSON.parse(it.properties._bundleItems);
  return { id: it.variant_id, price: b[0].price, qty: b[0].quantity };
});
const fbtSubtotal = fastrrFbt.reduce((s, it) => s + (it.price * it.qty), 0);
console.log("Fastrr FBT subtotal: ₹" + fbtSubtotal);
console.assert(fbtSubtotal === 765, "FAIL: 400*0.9 (360) + 450*0.9 (405) should be 765");
console.log("✓ PASS: FBT Bundle correctly discounted to ₹765 in Fastrr!");
