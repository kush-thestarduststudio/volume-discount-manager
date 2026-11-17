// @ts-check

/**
 * @typedef {Object} DiscountTier
 * @property {number} minQuantity
 * @property {number} discountPercent
 * @property {string} [label]
 */

/**
 * @typedef {Object} FbtProduct
 * @property {string} productId
 * @property {number} discountPercent
 * @property {string} [title]
 */

/**
 * @typedef {Object} BundleRule
 * @property {string} id
 * @property {string} [ruleType]
 * @property {string} targetType - "PRODUCT" | "COLLECTION"
 * @property {string} targetGid
 * @property {number} [mainDiscountPercent]
 * @property {DiscountTier[]} [tiers]
 * @property {FbtProduct[]} [fbtProducts]
 * @property {boolean} active
 */

/**
 * @typedef {Object} FunctionConfig
 * @property {string[]} [collectionIds]
 * @property {BundleRule[]} rules
 */

const EMPTY_RESULT = {
  operations: [],
};

/**
 * Primary function entry point for cart.lines.discounts.generate.run
 * @param {any} input
 * @returns {any}
 */
export function cartLinesDiscountsGenerateRun(input) {
  const metafieldValue =
    input?.discount?.metafield?.value ||
    input?.discountNode?.metafield?.value;

  if (!metafieldValue) {
    return EMPTY_RESULT;
  }

  /** @type {FunctionConfig} */
  let config;
  try {
    config = JSON.parse(metafieldValue);
  } catch {
    return EMPTY_RESULT;
  }

  const rules = (config?.rules || []).filter((r) => r.active !== false);
  if (rules.length === 0) {
    return EMPTY_RESULT;
  }

  const lines = input?.cart?.lines || [];
  if (lines.length === 0) {
    return EMPTY_RESULT;
  }

  /** @type {any[]} */
  const candidates = [];

  // 1. Group cart lines by Product ID
  /** @type {Map<string, any[]>} */
  const productLineMap = new Map();
  for (const line of lines) {
    const prodId = line.merchandise?.product?.id;
    if (prodId) {
      const list = productLineMap.get(prodId) || [];
      list.push(line);
      productLineMap.set(prodId, list);
    }
  }

  const volumeRules = rules.filter(
    (r) => r.tiers && Array.isArray(r.tiers) && r.tiers.length > 0
  );
  const fbtRules = rules.filter(
    (r) => r.fbtProducts && Array.isArray(r.fbtProducts) && r.fbtProducts.length > 0
  );

  // =========================================================================
  // PART 1: VOLUME / TIER DISCOUNTS (EVALUATED PER PRODUCT, BEST DISCOUNT WINS)
  // =========================================================================
  for (const [prodId, prodLines] of productLineMap.entries()) {
    // Exclude companion bundle items so volume discounts and FBT companions never conflict
    const volumeLines = prodLines.filter(
      (l) => l.bundleAttr?.value !== "fbt_companion"
    );
    if (volumeLines.length === 0) continue;

    // Calculate total quantity of this product in cart
    const prodQty = volumeLines.reduce((sum, l) => sum + (l.quantity || 0), 0);
    if (prodQty <= 0) continue;

    // Check if product belongs to any collection configured in active collection rules
    const isInAnyCollection = volumeLines.some(
      (l) => l.merchandise?.product?.inAnyCollection
    );

    // Find all volume rules that match this product (Product-level OR Collection-level)
    const matchingProductRules = volumeRules.filter(
      (r) => r.targetType === "PRODUCT" && r.targetGid === prodId
    );
    const matchingCollectionRules = volumeRules.filter(
      (r) => r.targetType === "COLLECTION" && isInAnyCollection
    );

    const applicableRules = [
      ...matchingProductRules,
      ...matchingCollectionRules,
    ];

    if (applicableRules.length === 0) continue;

    /** @type {DiscountTier | null} */
    let bestTier = null;

    // Evaluate all applicable rules and select the tier giving HIGHEST discount percent
    for (const rule of applicableRules) {
      const sortedTiers = (rule.tiers || [])
        .slice()
        .filter((t) => t.minQuantity > 0 && t.discountPercent > 0)
        .sort((a, b) => a.minQuantity - b.minQuantity);

      let matchedTier = null;
      for (const t of sortedTiers) {
        if (prodQty >= t.minQuantity) {
          matchedTier = t;
        }
      }

      if (matchedTier) {
        if (!bestTier || matchedTier.discountPercent > bestTier.discountPercent) {
          bestTier = matchedTier;
        }
      }
    }

    // Apply winning discount tier to this product's cart lines
    // EXACT QUANTITY ONLY: discount only up to bestTier.minQuantity units! Extra units remain full price!
    if (bestTier && bestTier.discountPercent > 0) {
      const exactTierQty = bestTier.minQuantity;
      const discountVal = String(bestTier.discountPercent.toFixed(1));
      const message =
        bestTier.label || `Buy ${exactTierQty} (${discountVal}% OFF)`;

      let remainingTierUnitsToDiscount = exactTierQty;

      const hasPreSplitLines = volumeLines.some(
        (l) => l.tierSplitAttr?.value === "discounted" || l.tierSplitAttr?.value === "regular"
      );

      if (hasPreSplitLines) {
        // Line-item property split explicitly present (e.g. from volume widget)
        for (const line of volumeLines) {
          if (remainingTierUnitsToDiscount <= 0) break;
          if (line.tierSplitAttr?.value === "discounted") {
            const units = Math.min(line.quantity, remainingTierUnitsToDiscount);
            if (units > 0) {
              remainingTierUnitsToDiscount -= units;
              candidates.push({
                message,
                targets: [
                  {
                    cartLine: {
                      id: line.id,
                      quantity: units,
                    },
                  },
                ],
                value: {
                  percentage: {
                    value: discountVal,
                  },
                },
              });
            }
          }
        }
      } else {
        // Standard cart addition (e.g. quantity selector, collection page add to cart)
        for (const line of volumeLines) {
          if (remainingTierUnitsToDiscount <= 0) break;
          const units = Math.min(line.quantity, remainingTierUnitsToDiscount);
          if (units > 0) {
            remainingTierUnitsToDiscount -= units;
            candidates.push({
              message,
              targets: [
                {
                  cartLine: {
                    id: line.id,
                    quantity: units,
                  },
                },
              ],
              value: {
                percentage: {
                  value: discountVal,
                },
              },
            });
          }
        }
      }
    }
  }

  // =========================================================================
  // PART 2: FREQUENTLY BOUGHT TOGETHER (FBT) BUNDLES (INDEPENDENT DISCOUNTS)
  // =========================================================================
  for (const rule of fbtRules) {
    const triggerLines = productLineMap.get(rule.targetGid) || [];
    if (triggerLines.length === 0) continue;

    /** @type {{ fbtItem: FbtProduct, line: any }[]} */
    const matchedCompanions = [];

    for (const fbtItem of rule.fbtProducts || []) {
      const companionLines = productLineMap.get(fbtItem.productId) || [];
      if (companionLines.length > 0) {
        matchedCompanions.push({ fbtItem, line: companionLines[0] });
      }
    }

    // If at least one bundle companion is in the cart alongside the trigger product:
    if (matchedCompanions.length > 0) {
      // A) Apply discount to main trigger product if configured
      const mainDiscPct = Number(rule.mainDiscountPercent || 0);
      if (mainDiscPct > 0) {
        const mainDiscountVal = String(mainDiscPct.toFixed(1));
        candidates.push({
          message: `Bundle: Main Item (${mainDiscountVal}% OFF)`,
          targets: [
            {
              cartLine: {
                id: triggerLines[0].id,
                quantity: 1,
              },
            },
          ],
          value: {
            percentage: {
              value: mainDiscountVal,
            },
          },
        });
      }

      // B) Apply discount to companion items
      for (const { fbtItem, line } of matchedCompanions) {
        const fbtDiscountVal = String((fbtItem.discountPercent || 10).toFixed(1));
        candidates.push({
          message: `Bundle: ${fbtItem.title || "Companion"} (${fbtDiscountVal}% OFF)`,
          targets: [
            {
              cartLine: {
                id: line.id,
                quantity: 1,
              },
            },
          ],
          value: {
            percentage: {
              value: fbtDiscountVal,
            },
          },
        });
      }
    }
  }

  if (candidates.length === 0) {
    return EMPTY_RESULT;
  }

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates,
          selectionStrategy: "ALL",
        },
      },
    ],
  };
}

export default cartLinesDiscountsGenerateRun;
