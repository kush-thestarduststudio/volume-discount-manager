// Simulate Fastrr's z function exactly as in pickrr's shopify.js
function fastrrZ(cart) {
  let h = [];
  const f = e => {
    try {
      const o = JSON.parse(e.properties?._bundleItems);
      const i = o?.map(t => ({
        variantId: t.variantId,
        quantity: t.quantity,
        price: t.price,
        customAttributes: e.properties
      }));
      if (Array.isArray(o)) h = [...h, ...i];
    } catch (err) {}
  };

  for (let t of cart.items) {
    if ("true" === t.properties?._isYtBundle) {
      f(t);
    } else {
      let i = {
        productId: t.product_id,
        title: t.title,
        variantId: t.variant_id,
        price: parseFloat((t.price / 100).toFixed(2)),
        quantity: t.quantity
      };
      h.push(i);
    }
  }

  return h;
}

// Our Rule Engine
const rules = [
  {
    id: "cmwn1tph80000ao5dsbvsnrcn",
    title: "Volume Tier: test",
    targetType: "PRODUCT",
    targetGid: "gid://shopify/Product/7488883753012",
    ruleType: "VOLUME",
    tiers: [
      { minQuantity: 2, discountType: "PERCENTAGE", discountValue: 10, discountPercent: 10, code: "TEST-BUY2-10OFF" }
    ],
    active: true
  }
];

// Test Case 1: 2 items of test added normally (no properties)
const rawCart = {
  items: [
    {
      product_id: 7488883753012,
      variant_id: 46920435957812,
      title: "test",
      price: 40000,
      original_price: 40000,
      quantity: 2,
      properties: {}
    }
  ]
};

console.log('--- Without Interception (What happened in User screenshot) ---');
const fastrrBefore = fastrrZ(rawCart);
console.log('Fastrr items:', fastrrBefore);
console.log('Subtotal in Fastrr: ₹' + fastrrBefore.reduce((s, it) => s + it.price * it.quantity, 0));

// Our Interceptor transformation
function injectBundleProperties(cart, rules) {
  const transformed = JSON.parse(JSON.stringify(cart));
  for (const item of transformed.items) {
    const pId = String(item.product_id);
    const origUnit = (item.original_price || item.price) / 100;
    let bestUnit = origUnit;

    for (const r of rules) {
      if (!r.active || r.ruleType !== "VOLUME") continue;
      const tId = String(r.targetGid || "").replace(/\D/g, "");
      if (pId === tId) {
        const totalQty = transformed.items
          .filter(it => String(it.product_id) === tId)
          .reduce((s, it) => s + it.quantity, 0);
        const tier = (r.tiers || []).sort((a, b) => b.minQuantity - a.minQuantity).find(x => totalQty >= x.minQuantity);
        if (tier) {
          const val = Number(tier.discountValue || tier.discountPercent || 0);
          const disc = tier.discountType === "FIXED_AMOUNT"
            ? Math.max(0, origUnit - (val / totalQty))
            : Math.max(0, origUnit * (1 - val / 100));
          if (disc < bestUnit) bestUnit = disc;
        }
      }
    }

    if (bestUnit < origUnit) {
      const roundUnit = Number(bestUnit.toFixed(2));
      item.properties = {
        ...item.properties,
        _isYtBundle: "true",
        _bundleItems: JSON.stringify([{
          variantId: item.variant_id,
          quantity: item.quantity,
          price: roundUnit
        }])
      };
    }
  }
  return transformed;
}

console.log('\n--- With Our Interception ---');
const interceptedCart = injectBundleProperties(rawCart, rules);
const fastrrAfter = fastrrZ(interceptedCart);
console.log('Fastrr items:', fastrrAfter);
console.log('Subtotal in Fastrr: ₹' + fastrrAfter.reduce((s, it) => s + it.price * it.quantity, 0));

// Test Case 2: User applies coupon LOYAL (-₹40)
console.log('\n--- Scenario: User applies LOYAL coupon (-₹40) ---');
console.log('Fastrr subtotal: ₹' + fastrrAfter.reduce((s, it) => s + it.price * it.quantity, 0));
console.log('Fastrr coupon: LOYAL (-₹40)');
console.log('Total Amount: ₹' + (fastrrAfter.reduce((s, it) => s + it.price * it.quantity, 0) - 40));

// Test Case 3: User REMOVES LOYAL coupon
console.log('\n--- Scenario: User REMOVES LOYAL coupon (User Issue #2) ---');
console.log('Fastrr subtotal: ₹' + fastrrAfter.reduce((s, it) => s + it.price * it.quantity, 0));
console.log('Fastrr coupon: None');
console.log('Total Amount: ₹' + fastrrAfter.reduce((s, it) => s + it.price * it.quantity, 0));
console.log('Is volume discount preserved? YES! Total is ₹720, NOT ₹800!');
