// Test how Fastrr z function processes items with _isYtBundle
const testItem = {
  product_id: 7488883753012,
  variant_id: 46920435957812,
  title: "test",
  price: 40000,
  quantity: 8,
  properties: {
    _isYtBundle: "true",
    _bundleItems: JSON.stringify([
      {
        variantId: 46920435957812,
        quantity: 8,
        price: 350.00
      }
    ])
  }
};

const f = e => {
  let h = [];
  try {
    const o = JSON.parse(e.properties?._bundleItems);
    const i = o?.map(t => ({
      variantId: t.variantId,
      quantity: t.quantity,
      price: t.price,
      customAttributes: e.properties
    }));
    if (Array.isArray(o)) h = [...h, ...i];
  } catch(err) {
    console.error(err);
  }
  return h;
};

console.log('Result of Fastrr f(testItem):', f(testItem));
