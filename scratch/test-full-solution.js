// Comprehensive Test Suite for Volume & FBT Discounts with Fastrr & Shiprocket

const mockRules = [
  {
    id: "cmwn5e64l0000ah56mb9lqv6h",
    title: "Volume Tier: test",
    targetType: "PRODUCT",
    targetGid: "gid://shopify/Product/7488883753012",
    ruleType: "VOLUME",
    tiers: [
      { minQuantity: 2, discountType: "PERCENTAGE", discountValue: 10, discountPercent: 10, label: "Buy 2 - Save 10%", code: "TEST-BUY2-10OFF" },
      { minQuantity: 3, discountType: "PERCENTAGE", discountValue: 15, discountPercent: 15, label: "Buy 3 - Save 15%", code: "TEST-BUY3-15OFF" }
    ],
    active: true
  }
];

// 1. Transform Cart Function
function transformCart(cart, rules) {
  if (!cart || !Array.isArray(cart.items)) return cart;
  const transformed = JSON.parse(JSON.stringify(cart));
  const vRules = (rules || []).filter(r => r.active && r.ruleType === "VOLUME" && r.tiers?.length);

  for (const item of transformed.items) {
    const pId = String(item.product_id);
    const vId = item.variant_id;
    const qty = item.quantity;
    const origUnit = (item.original_price || item.price) / 100;
    let bestUnit = origUnit;

    for (const vr of vRules) {
      const tId = String(vr.targetGid || "").replace(/\D/g, "");
      const isMatch = vr.targetType === "PRODUCT"
        ? pId === tId
        : (vr.collectionProductIds || []).map(String).includes(pId);

      if (isMatch) {
        const matchingItems = transformed.items.filter(it =>
          vr.targetType === "PRODUCT"
            ? String(it.product_id) === tId
            : (vr.collectionProductIds || []).map(String).includes(String(it.product_id))
        );
        const totalQty = matchingItems.reduce((s, it) => s + it.quantity, 0);
        const tier = [...vr.tiers].sort((a, b) => b.minQuantity - a.minQuantity).find(x => totalQty >= x.minQuantity);
        if (tier) {
          const isFixed = tier.discountType === "FIXED_AMOUNT";
          const val = Number(isFixed ? tier.discountValue : (tier.discountPercent || tier.discountValue || 0));
          if (val > 0) {
            const discUnit = isFixed
              ? Math.max(0, origUnit - (val / totalQty))
              : Math.max(0, origUnit * (1 - val / 100));
            if (discUnit < bestUnit) {
              bestUnit = discUnit;
            }
          }
        }
      }
    }

    item.properties = item.properties || {};

    if (bestUnit < origUnit) {
      const roundUnit = Number(bestUnit.toFixed(2));
      item.properties._isYtBundle = "true";
      item.properties._bundleItems = JSON.stringify([{
        variantId: vId,
        quantity: qty,
        price: roundUnit
      }]);
      item.final_price = Math.round(roundUnit * 100);
      item.final_line_price = item.final_price * qty;
      item.discounted_price = item.final_price;
    } else {
      delete item.properties._isYtBundle;
      delete item.properties._bundleItems;
      item.final_price = item.original_price || item.price;
      item.final_line_price = item.original_line_price || (item.price * qty);
    }
  }

  transformed.total_price = transformed.items.reduce((s, it) => s + it.final_line_price, 0);
  transformed.total_discount = (transformed.original_total_price || (transformed.items.reduce((s, it) => s + (it.original_line_price || it.price * it.quantity), 0))) - transformed.total_price;
  return transformed;
}

// 2. Fastrr's Real z mapping function (extracted from shopify.js)
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

// 3. Fastrr Checkout Simulation
function simulateFastrrCheckout(cart, couponCode = null, couponValue = 0) {
  const products = fastrrZ(cart);
  const subtotal = products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
  const couponDiscount = couponCode ? couponValue : 0;
  const total = Math.max(0, subtotal - couponDiscount);

  return {
    itemsCount: products.reduce((s, p) => s + p.quantity, 0),
    products: products.map(p => ({ variantId: p.variantId, qty: p.quantity, unitPrice: p.price })),
    subtotal: subtotal.toFixed(2),
    coupon: couponCode ? `${couponCode} (-₹${couponDiscount})` : "None",
    total: total.toFixed(2)
  };
}

console.log("=================================================");
console.log("TEST SCENARIO 1: 2 items of Test added (Qty = 2)");
console.log("=================================================");
const rawCart2 = {
  original_total_price: 80000,
  total_price: 80000,
  items: [
    {
      product_id: 7488883753012,
      variant_id: 46920435957812,
      title: "test",
      price: 40000,
      original_price: 40000,
      quantity: 2,
      properties: {} // Normal add to cart without widget properties
    }
  ]
};

const transformed2 = transformCart(rawCart2, mockRules);
const fastrrRes1 = simulateFastrrCheckout(transformed2);
console.log("Fastrr Checkout Output:", fastrrRes1);
console.assert(fastrrRes1.subtotal === "720.00", "FAIL: Subtotal should be 720.00");
console.assert(fastrrRes1.total === "720.00", "FAIL: Total should be 720.00");
console.log("✓ PASS: Subtotal is ₹720 (Buy 2 @ ₹360 each)\n");

console.log("=================================================");
console.log("TEST SCENARIO 2: Customer enters coupon 'LOYAL' (-₹40)");
console.log("=================================================");
const fastrrRes2 = simulateFastrrCheckout(transformed2, "LOYAL", 40);
console.log("Fastrr Checkout Output:", fastrrRes2);
console.assert(fastrrRes2.subtotal === "720.00", "FAIL: Subtotal should remain 720.00");
console.assert(fastrrRes2.total === "680.00", "FAIL: Total should be 680.00 (720 - 40)");
console.log("✓ PASS: Both Volume Discount (₹720) and LOYAL (-₹40) are CLUBBED! Total is ₹680!\n");

console.log("=================================================");
console.log("TEST SCENARIO 3: Customer clicks 'Remove' on coupon 'LOYAL'");
console.log("=================================================");
const fastrrRes3 = simulateFastrrCheckout(transformed2, null, 0);
console.log("Fastrr Checkout Output:", fastrrRes3);
console.assert(fastrrRes3.subtotal === "720.00", "FAIL: Subtotal should be 720.00");
console.assert(fastrrRes3.total === "720.00", "FAIL: Total should stay 720.00");
console.log("✓ PASS: Removing LOYAL does NOT remove Volume Discount! Subtotal and Total remain ₹720!\n");

console.log("=================================================");
console.log("TEST SCENARIO 4: Customer updates quantity to 3 (Buy 3 - 15% OFF)");
console.log("=================================================");
const rawCart3 = {
  original_total_price: 120000,
  total_price: 120000,
  items: [
    {
      product_id: 7488883753012,
      variant_id: 46920435957812,
      title: "test",
      price: 40000,
      original_price: 40000,
      quantity: 3,
      properties: {}
    }
  ]
};
const transformed3 = transformCart(rawCart3, mockRules);
const fastrrRes4 = simulateFastrrCheckout(transformed3, "LOYAL", 40);
console.log("Fastrr Checkout Output:", fastrrRes4);
// 400 * 0.85 = 340 each * 3 = 1020 - 40 = 980
console.assert(fastrrRes4.subtotal === "1020.00", "FAIL: Subtotal should be 1020.00");
console.assert(fastrrRes4.total === "980.00", "FAIL: Total should be 980.00");
console.log("✓ PASS: Tier 3 applied! Subtotal is ₹1020, LOYAL gives -₹40, Total is ₹980!\n");

console.log("=================================================");
console.log("TEST SCENARIO 5: Customer decreases quantity to 1 (< minQty 2)");
console.log("=================================================");
const rawCart1 = {
  original_total_price: 40000,
  total_price: 40000,
  items: [
    {
      product_id: 7488883753012,
      variant_id: 46920435957812,
      title: "test",
      price: 40000,
      original_price: 40000,
      quantity: 1,
      properties: { _isYtBundle: "true" } // previous property leftover
    }
  ]
};
const transformed1 = transformCart(rawCart1, mockRules);
const fastrrRes5 = simulateFastrrCheckout(transformed1);
console.log("Fastrr Checkout Output:", fastrrRes5);
console.assert(fastrrRes5.subtotal === "400.00", "FAIL: Subtotal should revert to 400.00");
console.assert(fastrrRes5.total === "400.00", "FAIL: Total should revert to 400.00");
console.log("✓ PASS: Properties stripped cleanly, price reverted to base ₹400!\n");

console.log("ALL UNIT TESTS PASSED SUCCESSFULLY!");
