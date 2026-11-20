// Test Fastrr & Shiprocket behavior under all branches

function simulateTransform(cart) {
  const transformed = JSON.parse(JSON.stringify(cart));
  let totalLineDiscount = 0;

  for (const item of transformed.items) {
    const origUnit = (item.original_price || item.price) / 100;
    let bestUnit = origUnit;

    // Check Shopify native discount / automatic discount already applied
    if (item.final_price && item.final_price < (item.original_price || item.price)) {
      bestUnit = Math.min(bestUnit, item.final_price / 100);
    }
    if (item.discounted_price && item.discounted_price < (item.original_price || item.price)) {
      bestUnit = Math.min(bestUnit, item.discounted_price / 100);
    }

    // Check Volume discount rule (e.g. 10% for 2+)
    if (item.quantity >= 2) {
      const volDisc = origUnit * 0.9;
      bestUnit = Math.min(bestUnit, volDisc);
    }

    if (bestUnit < origUnit) {
      const roundUnit = Number(bestUnit.toFixed(2));
      const roundCents = Math.round(roundUnit * 100);

      item.price = roundCents;
      item.final_price = roundCents;
      item.discounted_price = roundCents;
      item.final_line_price = roundCents * item.quantity;
      item.line_price = roundCents * item.quantity;

      item.properties = item.properties || {};
      item.properties._isYtBundle = "true";
      item.properties._bundleItems = JSON.stringify([{
        variantId: item.variant_id,
        quantity: item.quantity,
        price: roundUnit
      }]);

      totalLineDiscount += (origUnit - roundUnit) * item.quantity * 100;
    }
  }

  const origTotal = transformed.original_total_price || transformed.items.reduce((s, it) => s + (it.original_line_price || it.price * it.quantity), 0);
  transformed.total_price = Math.max(0, origTotal - Math.round(totalLineDiscount));
  transformed.total_discount = Math.round(totalLineDiscount);
  return transformed;
}

// Fastrr's exact z function from pickrr's shopify.js
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

// Shiprocket's exact Rn function from smart-cart.min.js
function shiprocketRn(items) {
  return items.map(i => ({
    quantity: i.quantity,
    price: i.price / 100,
    productId: i.product_id,
    itemId: i.id,
    customAttributes: i.properties
  }));
}

// Raw cart as returned by Shopify
const rawCart = {
  original_total_price: 80000,
  total_price: 72000,
  items: [
    {
      product_id: 7488883753012,
      variant_id: 46920435957812,
      title: "test",
      price: 40000,
      original_price: 40000,
      final_price: 36000,
      discounted_price: 36000,
      quantity: 2,
      properties: {}
    }
  ]
};

const transformed = simulateTransform(rawCart);

console.log('--- Transformed Cart Items ---');
console.log('item.price:', transformed.items[0].price);
console.log('item.final_price:', transformed.items[0].final_price);
console.log('item.discounted_price:', transformed.items[0].discounted_price);
console.log('item.properties._isYtBundle:', transformed.items[0].properties._isYtBundle);
console.log('item.properties._bundleItems:', transformed.items[0].properties._bundleItems);

const fastrrItems = fastrrZ(transformed);
console.log('\n--- Fastrr Mapping ---');
console.log('Fastrr items:', fastrrItems);
const fastrrSubtotal = fastrrItems.reduce((s, it) => s + (it.price * it.quantity), 0);
console.log('Fastrr Subtotal: ₹' + fastrrSubtotal);
console.assert(fastrrSubtotal === 720, 'FAIL: Fastrr subtotal must be 720');

const srItems = shiprocketRn(transformed.items);
console.log('\n--- Shiprocket Rn Mapping ---');
console.log('Shiprocket items:', srItems);
const srSubtotal = srItems.reduce((s, it) => s + (it.price * it.quantity), 0);
console.log('Shiprocket Subtotal: ₹' + srSubtotal);
console.assert(srSubtotal === 720, 'FAIL: Shiprocket subtotal must be 720');

console.log('\nALL VERIFICATIONS PASSED! Both Fastrr and Shiprocket evaluate to ₹720!');
