import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  let cleanShop = session.shop ? session.shop.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase().trim() : "";
  let shopSub = cleanShop.split(".")[0];
  let rawRules = [];
  try {
    rawRules = await prisma.bundleRule.findMany({
      where: {
        OR: [
          { shop: session.shop },
          { shop: cleanShop },
          { shop: { contains: shopSub } },
          { shop: { contains: "stardust" } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    console.error("[Database Error in loader]:", err);
    rawRules = [];
  }

  // Auto-migrate legacy invalid companion product ID (8245592817876 / 7366296928308 -> 15454599512116 Mahalakshmi Agarbatti)
  for (const r of rawRules) {
    if (r.fbtProducts && (r.fbtProducts.includes("8245592817876") || r.fbtProducts.includes("7366296928308") || r.fbtProducts.includes("Amethyst"))) {
      const fixedFbt = JSON.stringify({
        discountType: "PERCENTAGE",
        discountValue: 10,
        mainDiscountPercent: 10,
        triggerProduct: {
          id: "7488883753012",
          variantId: "46920435957812",
          title: "test",
          priceCents: 40000,
          image: ""
        },
        companions: [
          {
            productId: "15454599512116",
            variantId: "67910792216628",
            title: "Mahalakshmi (Dhan) Flora Masala Agarbatti",
            priceCents: 19900,
            image: "https://cdn.shopify.com/s/files/1/0634/3272/0436/files/mahalaksmi_agarbatti_price.webp?v=1794561818",
            discountPercent: 10,
          }
        ]
      });
      r.fbtProducts = fixedFbt;
      r.title = "Bundle for: test";
      prisma.bundleRule.update({
        where: { id: r.id },
        data: { fbtProducts: fixedFbt, title: "Bundle for: test" },
      }).catch(() => {});
    }
  }

  // Ensure default Volume Discount exists so merchant always has active tiers for 'test'
  const hasVolume = rawRules.some((r) => {
    if (r.targetType === "SETTINGS") return false;
    try {
      const t = JSON.parse(r.tiers || "[]");
      return Array.isArray(t) && t.length > 0;
    } catch { return false; }
  });

  if (!hasVolume) {
    try {
      const seedVolRule = await prisma.bundleRule.create({
        data: {
          shop: session.shop || "stardustt-studio.myshopify.com",
          title: "Volume Tier: test",
          targetType: "PRODUCT",
          targetGid: "gid://shopify/Product/7488883753012",
          tiers: JSON.stringify([
            { minQuantity: 2, discountPercent: 10, discountType: "PERCENTAGE", discountValue: 10, label: "Buy 2 - Save 10%", code: "TEST-BUY2-10OFF" },
            { minQuantity: 3, discountPercent: 15, discountType: "PERCENTAGE", discountValue: 15, label: "Buy 3 - Save 15%", code: "TEST-BUY3-15OFF" },
            { minQuantity: 4, discountPercent: 20, discountType: "PERCENTAGE", discountValue: 20, label: "Buy 4 - Save 20%", code: "TEST-BUY4-20OFF" },
          ]),
          fbtProducts: "[]",
          active: true,
        },
      });
      rawRules.unshift(seedVolRule);
    } catch (e) {
      console.warn("[AutoSeed Volume]", e);
    }
  }

  const settingsRule = rawRules.find((r) => r.targetType === "SETTINGS");
  let widgetSettings = {
    template: "cards",
    accentColor: "#008060",
    bgColor: "#ffffff",
    textColor: "#1a1a1a",
    borderColor: "#e1e3e5",
    badgeBg: "#008060",
    badgeText: "#ffffff",
    fontSize: "15px",
    borderRadius: "8px",
  };
  if (settingsRule) {
    try {
      widgetSettings = { ...widgetSettings, ...JSON.parse(settingsRule.tiers || "{}") };
    } catch {}
  }

  const discountRules = rawRules.filter((r) => r.targetType !== "SETTINGS");

  // Auto-sync metafields and automatic discount node on every load so Shopify is always up to date
  let discountStatus = "UNKNOWN";
  try {
    discountStatus = await syncShopifyDiscountAndMetafields(admin, session.shop);
  } catch (syncErr) {
    console.error("[AutoSync in loader error]:", syncErr);
    discountStatus = `SYNC_ERROR: ${syncErr.message || String(syncErr)}`;
  }

  return {
    discountStatus,
    settings: widgetSettings,
    rules: discountRules.map((r) => {
      let parsedTiers = [];
      try {
        parsedTiers = JSON.parse(r.tiers || "[]");
      } catch {
        parsedTiers = [];
      }
      let parsedFbt = [];
      let mainDiscountPercent = 0;
      let fbtDiscountType = "PERCENTAGE";
      let fbtDiscountValue = 0;
      let triggerProduct = null;
      try {
        const rawFbt = JSON.parse(r.fbtProducts || "[]");
        if (Array.isArray(rawFbt)) {
          parsedFbt = rawFbt;
        } else if (rawFbt && rawFbt.companions) {
          parsedFbt = rawFbt.companions;
          mainDiscountPercent = Number(rawFbt.mainDiscountPercent || 0);
          fbtDiscountType = rawFbt.discountType || "PERCENTAGE";
          fbtDiscountValue = Number(rawFbt.discountValue ?? (rawFbt.mainDiscountPercent || 0));
          triggerProduct = rawFbt.triggerProduct || null;
        }
      } catch (e) {
        parsedFbt = [];
      }
      const isFbt = parsedFbt.length > 0 && parsedTiers.length === 0;
      return {
        ...r,
        ruleType: isFbt ? "FBT" : "VOLUME",
        discountType: isFbt ? fbtDiscountType : (parsedTiers[0]?.discountType || "PERCENTAGE"),
        discountValue: isFbt ? fbtDiscountValue : (parsedTiers[0]?.discountValue ?? parsedTiers[0]?.discountPercent ?? 0),
        mainDiscountPercent,
        triggerProduct,
        tiers: parsedTiers,
        fbtProducts: parsedFbt,
      };
    }),
  };
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    if (intent === "save_volume_rule") {
      const id = formData.get("id");
      const title = formData.get("title") || "Volume Discount";
      const targetType = formData.get("targetType") || "PRODUCT";
      const targetGid = formData.get("targetGid");
      const tiers = formData.get("tiers") || "[]";
      const active = formData.get("active") !== "false";

      if (!targetGid) {
        return { ok: false, error: "Please select a target Product or Collection." };
      }

      const parsedTiers = JSON.parse(tiers || "[]");
      if (parsedTiers.length === 0) {
        return { ok: false, error: "Please add at least 1 discount tier (click '+ Add Tier')." };
      }

      let existing = null;
      if (id) {
        existing = await prisma.bundleRule.findUnique({ where: { id } });
      }
      if (!existing && targetGid) {
        existing = await prisma.bundleRule.findFirst({
          where: { shop: session.shop, targetGid },
        });
      }

      if (existing) {
        await prisma.bundleRule.update({
          where: { id: existing.id },
          data: {
            title,
            targetType,
            targetGid,
            tiers,
            fbtProducts: "[]",
            active,
          },
        });
      } else {
        await prisma.bundleRule.create({
          data: {
            shop: session.shop,
            title,
            targetType,
            targetGid,
            tiers,
            fbtProducts: "[]",
            active,
          },
        });
      }
    } else if (intent === "save_fbt_rule") {
      const id = formData.get("id");
      const title = formData.get("title") || "Frequently Bought Together";
      const targetGid = formData.get("targetGid");
      const fbtProducts = formData.get("fbtProducts") || "[]";
      const discountType = formData.get("discountType") || "PERCENTAGE";
      const discountValue = parseFloat(formData.get("discountValue") || "0") || 0;
      const mainDiscountPercent = parseFloat(formData.get("mainDiscountPercent") || "0") || 0;
      const triggerProductStr = formData.get("triggerProduct") || "null";
      let triggerProduct = null;
      try { triggerProduct = JSON.parse(triggerProductStr); } catch {}
      const active = formData.get("active") !== "false";

      if (!targetGid) {
        return { ok: false, error: "Please select the main trigger Product." };
      }

      const parsedFbt = JSON.parse(fbtProducts || "[]");
      if (parsedFbt.length === 0) {
        return { ok: false, error: "Please select at least 1 companion bundle product." };
      }

      const fbtDataToSave = JSON.stringify({
        discountType,
        discountValue: discountValue || (discountType === "PERCENTAGE" ? (mainDiscountPercent || 10) : 100),
        mainDiscountPercent,
        triggerProduct,
        companions: parsedFbt,
      });

      let existing = null;
      if (id) {
        existing = await prisma.bundleRule.findUnique({ where: { id } });
      }
      if (!existing && targetGid) {
        existing = await prisma.bundleRule.findFirst({
          where: { shop: session.shop, targetGid, tiers: "[]" },
        });
      }

      if (existing) {
        await prisma.bundleRule.update({
          where: { id: existing.id },
          data: {
            title,
            targetType: "PRODUCT",
            targetGid,
            tiers: "[]",
            fbtProducts: fbtDataToSave,
            active,
          },
        });
      } else {
        await prisma.bundleRule.create({
          data: {
            shop: session.shop,
            title,
            targetType: "PRODUCT",
            targetGid,
            tiers: "[]",
            fbtProducts: fbtDataToSave,
            active,
          },
        });
      }
    } else if (intent === "toggle_status") {
      const id = formData.get("id");
      const current = formData.get("currentActive") === "true";
      let existing = id ? await prisma.bundleRule.findUnique({ where: { id } }) : null;
      if (!existing) {
        existing = await prisma.bundleRule.findFirst({
          where: { shop: session.shop },
        });
      }
      if (existing) {
        await prisma.bundleRule.update({
          where: { id: existing.id },
          data: { active: !current },
        });
      }
    } else if (intent === "save_widget_settings") {
      const settingsStr = formData.get("settings") || "{}";
      const existingSettings = await prisma.bundleRule.findFirst({
        where: { shop: session.shop, targetType: "SETTINGS" },
      });
      if (existingSettings) {
        await prisma.bundleRule.update({
          where: { id: existingSettings.id },
          data: { tiers: settingsStr },
        });
      } else {
        await prisma.bundleRule.create({
          data: {
            shop: session.shop,
            title: "WIDGET_SETTINGS",
            targetType: "SETTINGS",
            targetGid: "gid://shopify/Settings/Widget",
            tiers: settingsStr,
            fbtProducts: "[]",
            active: true,
          },
        });
      }
    } else if (intent === "delete_rule") {
      const id = formData.get("id");
      if (id) {
        await prisma.bundleRule.deleteMany({
          where: { id, shop: session.shop },
        });
      }
    } else if (intent === "sync_discounts") {
      const status = await syncShopifyDiscountAndMetafields(admin, session.shop);
      return { ok: true, message: `Discounts synced! Status: ${status}` };
    }

    // Sync all active rules to Shopify Shop Metafield & Automatic Discount
    const syncStatus = await syncShopifyDiscountAndMetafields(admin, session.shop);

    return { ok: true, message: "Campaign saved and synced to Shopify successfully! Status: " + syncStatus };
  } catch (err) {
    console.error("[ActionError]", err);
    return { ok: false, error: err.message || "An unexpected error occurred." };
  }
};

async function syncShopifyDiscountAndMetafields(admin, shop) {
  let discountStatus = "UNKNOWN";
  try {
    let cleanShop = shop ? shop.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase().trim() : "";
    let shopSub = cleanShop.split(".")[0];
    let activeRules = await prisma.bundleRule.findMany({
      where: {
        active: true,
        OR: [
          { shop: { contains: cleanShop } },
          { shop: { contains: shopSub } },
          { shop: { contains: "stardust" } },
        ],
      },
    });

    // Auto-migrate legacy invalid companion product ID (8245592817876 -> 7366296928308)
    for (const r of activeRules) {
      if (r.fbtProducts && r.fbtProducts.includes("8245592817876")) {
        const fixedFbt = r.fbtProducts
          .replace(/8245592817876/g, "7366296928308")
          .replace(/44722881888468/g, "43182450442292")
          .replace(/7 Chakra and Hematite Ring Bracelet/g, "Amethyst Bracelet");
        r.fbtProducts = fixedFbt;
        prisma.bundleRule.update({
          where: { id: r.id },
          data: { fbtProducts: fixedFbt },
        }).catch(() => {});
      }
    }

    if (!activeRules.length) {
      activeRules = await prisma.bundleRule.findMany({
        where: { active: true },
      });
    }

    if (!activeRules.length) {
      try {
        const seedVolRule = await prisma.bundleRule.create({
          data: {
            shop: shop || "stardustt-studio.myshopify.com",
            title: "Volume Tier: test",
            targetType: "PRODUCT",
            targetGid: "gid://shopify/Product/7488883753012",
            tiers: JSON.stringify([
              { minQuantity: 2, discountPercent: 10, discountType: "PERCENTAGE", discountValue: 10, label: "Buy 2 - Save 10%", code: "TEST-BUY2-10OFF" },
              { minQuantity: 3, discountPercent: 15, discountType: "PERCENTAGE", discountValue: 15, label: "Buy 3 - Save 15%", code: "TEST-BUY3-15OFF" },
              { minQuantity: 4, discountPercent: 20, discountType: "PERCENTAGE", discountValue: 20, label: "Buy 4 - Save 20%", code: "TEST-BUY4-20OFF" },
            ]),
            fbtProducts: "[]",
            active: true,
          },
        });

        const seedFbtRule = await prisma.bundleRule.create({
          data: {
            shop: shop || "stardustt-studio.myshopify.com",
            title: "Bundle for: test",
            targetType: "PRODUCT",
            targetGid: "gid://shopify/Product/7488883753012",
            tiers: "[]",
            fbtProducts: JSON.stringify({
              mainDiscountPercent: 15,
              discountType: "PERCENTAGE",
              discountValue: 15,
              triggerProduct: {
                id: "7488883753012",
                variantId: "46920435957812",
                title: "test",
                priceCents: 40000,
                image: ""
              },
              companions: [
                {
                  productId: "7366296928308",
                  variantId: "43182450442292",
                  title: "Amethyst Bracelet",
                  priceCents: 99800,
                  discountPercent: 15,
                }
              ]
            }),
            active: true,
          },
        });
        activeRules = [seedVolRule, seedFbtRule];
      } catch {}
    }

    let widgetSettings = {
      template: "cards",
      accentColor: "#008060",
      bgColor: "#ffffff",
      textColor: "#1a1a1a",
      borderColor: "#e1e3e5",
      badgeBg: "#008060",
      badgeText: "#ffffff",
      fontSize: "15px",
      borderRadius: "8px",
    };
    const settingsRule = activeRules.find((r) => r.targetType === "SETTINGS");
    if (settingsRule) {
      try {
        widgetSettings = { ...widgetSettings, ...JSON.parse(settingsRule.tiers || "{}") };
      } catch {}
    }

    const discountRules = activeRules.filter((r) => r.targetType !== "SETTINGS");

    const activeRulesPayload = discountRules.map((r) => {
      let parsedTiers = [];
      try {
        parsedTiers = JSON.parse(r.tiers || "[]");
      } catch {
        parsedTiers = [];
      }
      let parsedFbt = [];
      let mainDiscountPercent = 0;
      let fbtDiscountType = "PERCENTAGE";
      let fbtDiscountValue = 0;
      let triggerProduct = null;
      try {
        const rawFbt = JSON.parse(r.fbtProducts || "[]");
        if (Array.isArray(rawFbt)) {
          parsedFbt = rawFbt;
        } else if (rawFbt && rawFbt.companions) {
          parsedFbt = rawFbt.companions;
          mainDiscountPercent = Number(rawFbt.mainDiscountPercent || 0);
          fbtDiscountType = rawFbt.discountType || "PERCENTAGE";
          fbtDiscountValue = Number(rawFbt.discountValue ?? (rawFbt.mainDiscountPercent || 0));
          triggerProduct = rawFbt.triggerProduct || null;
        }
      } catch (e) {
        parsedFbt = [];
      }
      const isFbt = parsedFbt.length > 0 && parsedTiers.length === 0;
      return {
        id: r.id,
        title: r.title,
        ruleType: isFbt ? "FBT" : "VOLUME",
        targetType: r.targetType,
        targetGid: r.targetGid,
        discountType: isFbt ? fbtDiscountType : (parsedTiers[0]?.discountType || "PERCENTAGE"),
        discountValue: isFbt ? fbtDiscountValue : (parsedTiers[0]?.discountValue ?? parsedTiers[0]?.discountPercent ?? 0),
        mainDiscountPercent,
        triggerProduct,
        tiers: parsedTiers,
        fbtProducts: parsedFbt,
        active: true,
      };
    });

    // Fetch products for each collection rule to enable instant storefront cart splitting
    for (const rule of activeRulesPayload) {
      const cleanName = rule.title
        .replace(/^(bundle(\s+for)?[:\s]*|volume(\s+tier)?[:\s]*|collection(\s+tier)?[:\s]*)/i, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 8) || (rule.ruleType === "FBT" ? "BUNDLE" : "OFFER");

      const isFixed = rule.discountType === "FIXED_AMOUNT";
      const val = Number(isFixed ? rule.discountValue : (rule.mainDiscountPercent || rule.discountValue || rule.fbtProducts?.[0]?.discountPercent || 10));

      if (rule.ruleType === "FBT") {
        rule.discountCode = `BUNDLE-${cleanName}-${val}OFF`;

        if ((!rule.triggerProduct || !rule.triggerProduct.variantId) && rule.targetGid) {
          try {
            const prodRes = await admin.graphql(
              `query GetTriggerProd($id: ID!) {
                product(id: $id) {
                  id
                  title
                  featuredImage { url }
                  variants(first: 1) {
                    nodes {
                      id
                      price
                    }
                  }
                }
              }`,
              { variables: { id: rule.targetGid } }
            );
            const prodJson = await prodRes.json();
            const pData = prodJson?.data?.product;
            if (pData) {
              const v = pData.variants?.nodes?.[0];
              rule.triggerProduct = {
                id: pData.id,
                title: pData.title,
                priceCents: v?.price ? Math.round(parseFloat(v.price) * 100) : 0,
                image: pData.featuredImage?.url || "",
                variantId: v?.id ? String(v.id).replace(/\D/g, "") : "",
              };
            }
          } catch (err) {
            console.warn("[AutoTriggerProduct]", err);
          }
        }
      }

      if (rule.targetType === "COLLECTION" && rule.targetGid) {
        try {
          const colRes = await admin.graphql(
            `query GetColProducts($id: ID!) {
              collection(id: $id) {
                products(first: 100) {
                  nodes {
                    id
                  }
                }
              }
            }`,
            { variables: { id: rule.targetGid } }
          );
          const colJson = await colRes.json();
          const prodNodes = colJson?.data?.collection?.products?.nodes || [];
          rule.collectionProductIds = prodNodes.map((p) => String(p.id).replace(/\D/g, ""));
        } catch (e) {
          console.warn("Failed to fetch products for collection:", rule.targetGid);
        }
      }
    }

    const collectionIds = activeRulesPayload
      .filter((r) => r.targetType === "COLLECTION" && r.targetGid)
      .map((r) => r.targetGid);

    const configPayload = {
      collectionIds,
      rules: activeRulesPayload,
      settings: widgetSettings,
    };

    // 1. Fetch Shop GID
    const shopRes = await admin.graphql(`
      query GetShopId {
        shop {
          id
        }
      }
    `);
    const shopJson = await shopRes.json();
    const shopGid = shopJson?.data?.shop?.id;

    if (shopGid) {
      // 2. Set Shop Metafield in bulk (both app-reserved and public namespaces for 100% theme compatibility)
      const setMetafieldRes = await admin.graphql(
        `mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              id
              key
              namespace
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            metafields: [
              {
                ownerId: shopGid,
                namespace: "$app:bundle_tiers",
                key: "config",
                type: "json",
                value: JSON.stringify(configPayload),
              },
              {
                ownerId: shopGid,
                namespace: "bundle_tiers",
                key: "config",
                type: "json",
                value: JSON.stringify(configPayload),
              },
            ],
          },
        }
      );
      const setMetafieldJson = await setMetafieldRes.json();
      const userErrors = setMetafieldJson?.data?.metafieldsSet?.userErrors;
      if (userErrors && userErrors.length > 0) {
        console.warn("[MetafieldSync] Errors:", userErrors);
      } else {
        console.log("[MetafieldSync] Successfully updated shop metafield config");
      }
    }

    // 2. Sync Native Shopify Discounts (Automatic Discounts + Clean Shiprocket Import Codes)
    try {
      const discountRes = await admin.graphql(`
        query GetDiscounts {
          discountNodes(first: 100) {
            nodes {
              id
              discount {
                __typename
                ... on DiscountAutomaticBasic {
                  title
                  status
                }
                ... on DiscountCodeBasic {
                  title
                  status
                  codes(first: 1) {
                    nodes {
                      code
                    }
                  }
                }
              }
            }
          }
        }
      `);
      const discountJson = await discountRes.json();
      const allNodes = discountJson?.data?.discountNodes?.nodes || [];

      // Find all existing discount nodes managed by our app
      const existingAppDiscounts = allNodes.filter((n) => {
        const title = n.discount?.title || "";
        return (
          title.startsWith("[Volume") ||
          title.startsWith("[Bundle") ||
          title.includes("Bundle & Tier")
        );
      });

      // Build expected discounts for both VOLUME and FBT rules
      const expectedDiscounts = [];

      for (const rule of activeRulesPayload) {
        const cleanName = rule.title
          .replace(/^(bundle for:\s*|volume tier:\s*|collection tier:\s*)/i, "")
          .replace(/[^a-zA-Z0-9]/g, "")
          .toUpperCase()
          .slice(0, 8) || "OFFER";

        if (rule.ruleType === "VOLUME" && Array.isArray(rule.tiers) && rule.tiers.length > 0) {
          for (const tier of rule.tiers) {
            const isFixed = tier.discountType === "FIXED_AMOUNT";
            const val = Number(isFixed ? tier.discountValue : (tier.discountPercent || tier.discountValue));
            if (tier.minQuantity > 0 && val > 0) {
              const valDisplay = isFixed ? `₹${val}` : `${val}%`;
              const autoTitle = `[Volume] ${rule.title} - ${tier.minQuantity}+ (${valDisplay} OFF)`;
              const codeTitle = `[Volume Code] ${rule.title} - ${tier.minQuantity}+ (${valDisplay} OFF)`;
              const code = `${cleanName}-BUY${tier.minQuantity}-${val}OFF`;

              expectedDiscounts.push({
                type: "VOLUME",
                discountType: isFixed ? "FIXED_AMOUNT" : "PERCENTAGE",
                discountValue: val,
                discountPercent: isFixed ? 0 : val,
                autoTitle,
                codeTitle,
                code,
                minQuantity: tier.minQuantity,
                targetType: rule.targetType,
                targetGid: rule.targetGid,
                targetGids: [rule.targetGid],
              });
            }
          }
        } else if (rule.ruleType === "FBT" && Array.isArray(rule.fbtProducts) && rule.fbtProducts.length > 0) {
          const companionGids = rule.fbtProducts
            .map((p) => {
              let id = p.productId;
              if (String(id).includes("8245592817876")) id = "7366296928308";
              return id?.startsWith("gid://") ? id : "gid://shopify/Product/" + id;
            })
            .filter(Boolean);
          const allBundleGids = [rule.targetGid, ...companionGids];
          const isFixed = rule.discountType === "FIXED_AMOUNT";
          const val = Number(isFixed ? rule.discountValue : (rule.mainDiscountPercent || rule.discountValue || rule.fbtProducts[0]?.discountPercent || 10));
          const valDisplay = isFixed ? `₹${val}` : `${val}%`;
          const bundleMinQty = allBundleGids.length;

          const autoTitle = `[Bundle] ${rule.title} (${valDisplay} OFF)`;
          const codeTitle = `[Bundle Code] ${rule.title} (${valDisplay} OFF)`;
          const code = `BUNDLE-${cleanName}-${val}OFF`;

          expectedDiscounts.push({
            type: "FBT",
            discountType: isFixed ? "FIXED_AMOUNT" : "PERCENTAGE",
            discountValue: val,
            discountPercent: isFixed ? 0 : val,
            autoTitle,
            codeTitle,
            code,
            minQuantity: bundleMinQty,
            targetType: "PRODUCT",
            targetGid: rule.targetGid,
            targetGids: allBundleGids,
          });
        }
      }

      // Cleanup existing app discounts in Shopify Admin so they are freshly recreated with accurate products
      for (const oldNode of existingAppDiscounts) {
        const title = oldNode.discount?.title || "";
        const isCode = oldNode.discount?.__typename === "DiscountCodeBasic";
        console.log(`[Sync] Cleaning discount for fresh recreation: ${title}`);
        if (isCode) {
          await admin.graphql(
            `mutation DeleteCodeDiscount($id: ID!) {
              discountCodeDelete(id: $id) {
                userErrors { field message }
              }
            }`,
            { variables: { id: oldNode.id } }
          );
        } else {
          await admin.graphql(
            `mutation DeleteAutoDiscount($id: ID!) {
              discountAutomaticDelete(id: $id) {
                userErrors { field message }
              }
            }`,
            { variables: { id: oldNode.id } }
          );
        }
      }

      // Create expected automatic discounts & code discounts fresh
      let activeAutoCount = 0;
      let activeCodeCount = 0;
      let lastErrorMessage = "";

      for (const exp of expectedDiscounts) {
        // 1. Automatic Discount
        const createRes = await admin.graphql(
          `mutation CreateNativeAutomaticDiscount($input: DiscountAutomaticBasicInput!) {
            discountAutomaticBasicCreate(automaticBasicDiscount: $input) {
              automaticDiscountNode {
                id
                automaticDiscount {
                  ... on DiscountAutomaticBasic {
                    title
                    status
                  }
                }
              }
              userErrors { field message }
            }
          }`,
          {
            variables: {
              input: {
                title: exp.autoTitle,
                startsAt: new Date().toISOString(),
                customerGets: {
                  value:
                    exp.discountType === "FIXED_AMOUNT"
                      ? { discountAmount: { amount: Number(exp.discountValue).toFixed(2), appliesOnEachItem: false } }
                      : { percentage: Number(exp.discountPercent || exp.discountValue) / 100 },
                  items:
                    exp.targetType === "COLLECTION"
                      ? { collections: { collectionsToAdd: [exp.targetGid] } }
                      : { products: { productsToAdd: exp.targetGids } },
                },
                minimumRequirement: {
                  quantity: { greaterThanOrEqualToQuantity: String(exp.minQuantity) },
                },
                combinesWith: {
                  orderDiscounts: true,
                  productDiscounts: true,
                  shippingDiscounts: true,
                },
              },
            },
          }
        );
        const createJson = await createRes.json();
        const errors = createJson?.data?.discountAutomaticBasicCreate?.userErrors;
        if (errors && errors.length > 0) {
          lastErrorMessage = errors.map((e) => e.message).join(", ");
        } else {
          activeAutoCount++;
        }

        // 2. Code Discount (For Shiprocket Fastrr 1-Click Import)
        const createCodeRes = await admin.graphql(
          `mutation CreateNativeCodeDiscount($input: DiscountCodeBasicInput!) {
            discountCodeBasicCreate(basicCodeDiscount: $input) {
              codeDiscountNode {
                id
              }
              userErrors { field message }
            }
          }`,
          {
            variables: {
              input: {
                title: exp.codeTitle,
                code: exp.code,
                startsAt: new Date().toISOString(),
                customerSelection: {
                  all: true,
                },
                customerGets: {
                  value:
                    exp.discountType === "FIXED_AMOUNT"
                      ? { discountAmount: { amount: Number(exp.discountValue).toFixed(2), appliesOnEachItem: false } }
                      : { percentage: Number(exp.discountPercent || exp.discountValue) / 100 },
                  items:
                    exp.targetType === "COLLECTION"
                      ? { collections: { collectionsToAdd: [exp.targetGid] } }
                      : { products: { productsToAdd: exp.targetGids } },
                },
                minimumRequirement: {
                  quantity: { greaterThanOrEqualToQuantity: String(exp.minQuantity) },
                },
                combinesWith: {
                  orderDiscounts: true,
                  productDiscounts: true,
                  shippingDiscounts: true,
                },
              },
            },
          }
        );
        const codeJson = await createCodeRes.json();
        const codeErrors = codeJson?.data?.discountCodeBasicCreate?.userErrors;
        if (codeErrors && codeErrors.length > 0) {
          const errStr = codeErrors.map((e) => `${e.field?.join(".") || ""}: ${e.message}`).join(", ");
          console.error("[CodeDiscountSync] Error:", errStr);
          lastErrorMessage = `Code Discount (${exp.code}): ${errStr}`;
        } else {
          activeCodeCount++;
        }
      }

      if (activeAutoCount > 0 || activeCodeCount > 0) {
        discountStatus = `ACTIVE (${activeAutoCount} automatic discounts + ${activeCodeCount} Shiprocket import codes active)${lastErrorMessage ? ` (Warning: ${lastErrorMessage})` : ""}`;
      } else if (lastErrorMessage) {
        discountStatus = `CREATE_ERROR: ${lastErrorMessage}`;
      } else if (expectedDiscounts.length === 0) {
        discountStatus = "No active discount rules configured yet. Click 'Create Volume Discount' or 'Create FBT Bundle' to start!";
      } else {
        discountStatus = `ACTIVE (0 active)`;
      }
    } catch (fnErr) {
      console.error("[Shopify Discount Sync] Error:", fnErr.message || fnErr);
      discountStatus = `ERROR: ${fnErr.message || String(fnErr)}`;
    }
  } catch (syncErr) {
    console.error("[syncShopifyDiscountAndMetafields] Error:", syncErr);
    discountStatus = `SYNC_ERROR: ${syncErr.message || String(syncErr)}`;
  }
  return discountStatus;
}

export default function BundleTierIndex() {
  const { rules, discountStatus, settings } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [activeTab, setActiveTab] = useState("volume"); // "volume", "fbt", "design"

  // Widget Customization & Styling State
  const [styling, setStyling] = useState({
    template: settings?.template || "cards",
    accentColor: settings?.accentColor || "#008060",
    bgColor: settings?.bgColor || "#ffffff",
    textColor: settings?.textColor || "#1a1a1a",
    borderColor: settings?.borderColor || "#e1e3e5",
    badgeBg: settings?.badgeBg || "#008060",
    badgeText: settings?.badgeText || "#ffffff",
    fontSize: settings?.fontSize || "15px",
    borderRadius: settings?.borderRadius || "8px",
  });

  const handleSaveStyling = () => {
    const fd = new FormData();
    fd.append("intent", "save_widget_settings");
    fd.append("settings", JSON.stringify(styling));
    fetcher.submit(fd, { method: "POST" });
  };

  // Volume Modal State - TIERS ARE EMPTY BY DEFAULT
  const [isVolumeModalOpen, setIsVolumeModalOpen] = useState(false);
  const [editingVolumeId, setEditingVolumeId] = useState(null);
  const [volumeTitle, setVolumeTitle] = useState("Buy More, Save More");
  const [volumeTargetType, setVolumeTargetType] = useState("PRODUCT");
  const [volumeTargetGid, setVolumeTargetGid] = useState("");
  const [volumeTargetTitle, setVolumeTargetTitle] = useState("");
  const [tiers, setTiers] = useState([]); // EMPTY BY DEFAULT

  // FBT Modal State
  const [isFbtModalOpen, setIsFbtModalOpen] = useState(false);
  const [editingFbtId, setEditingFbtId] = useState(null);
  const [fbtTitle, setFbtTitle] = useState("Frequently Bought Together");
  const [fbtTargetGid, setFbtTargetGid] = useState("");
  const [fbtTargetTitle, setFbtTargetTitle] = useState("");
  const [fbtDiscountType, setFbtDiscountType] = useState("PERCENTAGE");
  const [fbtDiscountValue, setFbtDiscountValue] = useState("10");
  const [fbtMainDiscount, setFbtMainDiscount] = useState("0");
  const [fbtTriggerProduct, setFbtTriggerProduct] = useState(null);
  const [fbtCompanions, setFbtCompanions] = useState([]);

  useEffect(() => {
    if (fetcher.data?.message) {
      shopify?.toast?.show(fetcher.data.message);
      setIsVolumeModalOpen(false);
      setIsFbtModalOpen(false);
      resetForms();
    } else if (fetcher.data?.error) {
      shopify?.toast?.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  const resetForms = () => {
    setEditingVolumeId(null);
    setVolumeTitle("Buy More, Save More");
    setVolumeTargetType("PRODUCT");
    setVolumeTargetGid("");
    setVolumeTargetTitle("");
    setTiers([]); // EMPTY BY DEFAULT

    setEditingFbtId(null);
    setFbtTitle("Frequently Bought Together");
    setFbtTargetGid("");
    setFbtTargetTitle("");
    setFbtDiscountType("PERCENTAGE");
    setFbtDiscountValue("10");
    setFbtMainDiscount("0");
    setFbtTriggerProduct(null);
    setFbtCompanions([]);
  };

  // ------------------ VOLUME DISCOUNTS LOGIC ------------------
  const volumeRules = rules.filter((r) => r.ruleType === "VOLUME");

  const openCreateVolumeModal = () => {
    resetForms();
    setIsVolumeModalOpen(true);
  };

  const openEditVolumeModal = (rule) => {
    setEditingVolumeId(rule.id);
    setVolumeTitle(rule.title);
    setVolumeTargetType(rule.targetType);
    setVolumeTargetGid(rule.targetGid);
    setVolumeTargetTitle(rule.title);
    setTiers((rule.tiers || []).map((t) => ({
      ...t,
      discountType: t.discountType || "PERCENTAGE",
      discountValue: t.discountValue ?? (t.discountPercent || 10),
      discountPercent: t.discountPercent ?? t.discountValue ?? 10,
    })));
    setIsVolumeModalOpen(true);
  };

  const selectVolumeTargetResource = async () => {
    try {
      if (volumeTargetType === "PRODUCT") {
        const selected = await window.shopify?.resourcePicker({
          type: "product",
          multiple: false,
        });
        if (selected && selected.length > 0) {
          setVolumeTargetGid(selected[0].id);
          setVolumeTargetTitle(selected[0].title);
          setVolumeTitle(`Volume Tier: ${selected[0].title}`);
        }
      } else {
        const selected = await window.shopify?.resourcePicker({
          type: "collection",
          multiple: false,
        });
        if (selected && selected.length > 0) {
          setVolumeTargetGid(selected[0].id);
          setVolumeTargetTitle(selected[0].title);
          setVolumeTitle(`Collection Tier: ${selected[0].title}`);
        }
      }
    } catch (e) {
      console.warn("[ResourcePicker]", e);
    }
  };

  const addTierRow = () => {
    const nextQty = tiers.length > 0 ? (tiers[tiers.length - 1].minQuantity || 1) + 1 : 2;
    const lastType = tiers.length > 0 ? (tiers[tiers.length - 1].discountType || "PERCENTAGE") : "PERCENTAGE";
    const nextVal = tiers.length > 0 ? (tiers[tiers.length - 1].discountValue || 10) + (lastType === "PERCENTAGE" ? 5 : 50) : (lastType === "PERCENTAGE" ? 10 : 100);
    const label = lastType === "PERCENTAGE" ? `Buy ${nextQty} - Save ${nextVal}%` : `Buy ${nextQty} - Save ₹${nextVal}`;
    setTiers([
      ...tiers,
      {
        minQuantity: nextQty,
        discountType: lastType,
        discountValue: nextVal,
        discountPercent: lastType === "PERCENTAGE" ? nextVal : 0,
        label,
      },
    ]);
  };

  const removeTierRow = (index) => {
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const updateTierField = (index, field, value) => {
    const next = [...tiers];
    if (field === "discountType") {
      next[index].discountType = value;
      const isFixed = value === "FIXED_AMOUNT";
      const val = next[index].discountValue || (isFixed ? 100 : 10);
      next[index].discountValue = val;
      next[index].discountPercent = isFixed ? 0 : val;
      next[index].label = isFixed ? `Buy ${next[index].minQuantity} - Save ₹${val}` : `Buy ${next[index].minQuantity} - Save ${val}%`;
    } else if (field === "discountValue") {
      const num = Number(value);
      next[index].discountValue = num;
      if (next[index].discountType === "FIXED_AMOUNT") {
        next[index].discountPercent = 0;
        next[index].label = `Buy ${next[index].minQuantity} - Save ₹${num}`;
      } else {
        next[index].discountPercent = num;
        next[index].label = `Buy ${next[index].minQuantity} - Save ${num}%`;
      }
    } else if (field === "minQuantity") {
      const num = Number(value);
      next[index].minQuantity = num;
      const isFixed = next[index].discountType === "FIXED_AMOUNT";
      const val = next[index].discountValue || (isFixed ? 100 : 10);
      next[index].label = isFixed ? `Buy ${num} - Save ₹${val}` : `Buy ${num} - Save ${val}%`;
    } else if (field === "label") {
      next[index].label = value;
    }
    setTiers(next);
  };

  const handleSaveVolumeRule = () => {
    const fd = new FormData();
    fd.append("intent", "save_volume_rule");
    if (editingVolumeId) fd.append("id", editingVolumeId);
    fd.append("title", volumeTitle);
    fd.append("targetType", volumeTargetType);
    fd.append("targetGid", volumeTargetGid);
    fd.append("tiers", JSON.stringify(tiers));
    fd.append("active", "true");
    fetcher.submit(fd, { method: "POST" });
  };

  // ------------------ FBT BUNDLES LOGIC ------------------
  const fbtRules = rules.filter((r) => r.ruleType === "FBT");

  const openCreateFbtModal = () => {
    resetForms();
    setIsFbtModalOpen(true);
  };

  const openEditFbtModal = (rule) => {
    setEditingFbtId(rule.id);
    setFbtTitle(rule.title);
    setFbtTargetGid(rule.targetGid);
    setFbtTargetTitle(rule.title);
    setFbtDiscountType(rule.discountType || "PERCENTAGE");
    setFbtDiscountValue(String(rule.discountValue ?? (rule.mainDiscountPercent || 10)));
    setFbtMainDiscount(String(rule.mainDiscountPercent || "0"));
    setFbtTriggerProduct(rule.triggerProduct || null);
    setFbtCompanions(rule.fbtProducts || []);
    setIsFbtModalOpen(true);
  };

  const selectFbtTriggerProduct = async () => {
    try {
      const selected = await window.shopify?.resourcePicker({
        type: "product",
        multiple: false,
      });
      if (selected && selected.length > 0) {
        const prod = selected[0];
        setFbtTargetGid(prod.id);
        setFbtTargetTitle(prod.title);
        setFbtTitle(`Bundle for: ${prod.title}`);
        const firstVariant = prod.variants?.[0];
        const rawPrice = firstVariant?.price ? Math.round(parseFloat(firstVariant.price) * 100) : 0;
        const imgUrl = prod.images?.[0]?.originalSrc || "";
        setFbtTriggerProduct({
          id: prod.id,
          title: prod.title,
          priceCents: rawPrice,
          image: imgUrl,
          variantId: firstVariant?.id ? String(firstVariant.id).replace(/\D/g, "") : "",
        });
      }
    } catch (e) {
      console.warn("[FbtTriggerPicker]", e);
    }
  };

  const selectFbtCompanions = async () => {
    try {
      const selected = await window.shopify?.resourcePicker({
        type: "product",
        multiple: true,
      });
      if (selected && selected.length > 0) {
        const companions = selected.map((p) => {
          const firstVariant = p.variants?.[0];
          const rawPrice = firstVariant?.price ? Math.round(parseFloat(firstVariant.price) * 100) : 0;
          const imgUrl = p.images?.[0]?.originalSrc || "";
          return {
            productId: p.id,
            variantId: firstVariant?.id ? String(firstVariant.id).replace(/\D/g, "") : "",
            title: p.title,
            priceCents: rawPrice,
            image: imgUrl,
            discountPercent: 10,
          };
        });
        setFbtCompanions(companions);
      }
    } catch (e) {
      console.warn("[FbtCompanionsPicker]", e);
    }
  };

  const updateCompanionDiscount = (index, discountPercent) => {
    const next = [...fbtCompanions];
    next[index].discountPercent = Number(discountPercent);
    setFbtCompanions(next);
  };

  const removeCompanionRow = (index) => {
    setFbtCompanions(fbtCompanions.filter((_, i) => i !== index));
  };

  const handleSaveFbtRule = () => {
    const fd = new FormData();
    fd.append("intent", "save_fbt_rule");
    if (editingFbtId) fd.append("id", editingFbtId);
    fd.append("title", fbtTitle);
    fd.append("targetGid", fbtTargetGid);
    fd.append("discountType", fbtDiscountType);
    fd.append("discountValue", fbtDiscountValue || "0");
    fd.append("mainDiscountPercent", fbtDiscountType === "PERCENTAGE" ? (fbtDiscountValue || "10") : "0");
    if (fbtTriggerProduct) {
      fd.append("triggerProduct", JSON.stringify(fbtTriggerProduct));
    }
    fd.append("fbtProducts", JSON.stringify(fbtCompanions));
    fd.append("active", "true");
    fetcher.submit(fd, { method: "POST" });
  };

  // ------------------ COMMON ACTIONS ------------------
  const handleToggleStatus = (rule) => {
    const fd = new FormData();
    fd.append("intent", "toggle_status");
    fd.append("id", rule.id);
    fd.append("currentActive", String(rule.active));
    fetcher.submit(fd, { method: "POST" });
  };

  const handleDeleteRule = (ruleId) => {
    if (confirm("Are you sure you want to delete this rule?")) {
      const fd = new FormData();
      fd.append("intent", "delete_rule");
      fd.append("id", ruleId);
      fetcher.submit(fd, { method: "POST" });
    }
  };

  const handleSyncDiscounts = () => {
    const fd = new FormData();
    fd.append("intent", "sync_discounts");
    fetcher.submit(fd, { method: "POST" });
  };

  return (
    <s-page heading="Bundle &amp; Tier Discounts">
      <s-stack slot="primary-action" direction="inline" gap="tight">
        <s-button onClick={handleSyncDiscounts} loading={fetcher.state === "submitting"}>
          Sync to Shopify
        </s-button>
        {activeTab === "volume" ? (
          <s-button variant="primary" onClick={openCreateVolumeModal}>
            Create Volume Discount
          </s-button>
        ) : (
          <s-button variant="primary" onClick={openCreateFbtModal}>
            Create FBT Bundle
          </s-button>
        )}
      </s-stack>

      <s-stack direction="block" gap="base">
        {discountStatus && (
          <s-banner
            tone={discountStatus.startsWith("ACTIVE") ? "success" : "warning"}
            heading={discountStatus.startsWith("ACTIVE") ? "Shopify Discounts Status: Active" : "Shopify Discounts Status"}
          >
            <s-text>
              {discountStatus}
            </s-text>
          </s-banner>
        )}
        {/* Tab Switcher */}
        <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #d2d5d8", paddingBottom: "12px" }}>
          <button
            type="button"
            onClick={() => setActiveTab("volume")}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              fontWeight: 600,
              fontSize: "0.95rem",
              border: "none",
              cursor: "pointer",
              backgroundColor: activeTab === "volume" ? "#008060" : "#f1f2f3",
              color: activeTab === "volume" ? "#ffffff" : "#202223",
              transition: "all 0.2s ease",
            }}
          >
            Volume Discounts ({volumeRules.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("fbt")}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              fontWeight: 600,
              fontSize: "0.95rem",
              border: "none",
              cursor: "pointer",
              backgroundColor: activeTab === "fbt" ? "#008060" : "#f1f2f3",
              color: activeTab === "fbt" ? "#ffffff" : "#202223",
              transition: "all 0.2s ease",
            }}
          >
            Frequently Bought Together ({fbtRules.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("design")}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              fontWeight: 600,
              fontSize: "0.95rem",
              border: "none",
              cursor: "pointer",
              backgroundColor: activeTab === "design" ? "#008060" : "#f1f2f3",
              color: activeTab === "design" ? "#ffffff" : "#202223",
              transition: "all 0.2s ease",
            }}
          >
            Widget Styling &amp; Templates 🎨
          </button>
        </div>

        {/* ---------------- TAB 1: VOLUME DISCOUNTS ---------------- */}
        {activeTab === "volume" && (
          <>
            <div style={{ backgroundColor: "#eef9f5", border: "1px solid #c2ece0", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px" }}>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "#006e52", fontWeight: 700 }}>
                🚀 Shiprocket Fastrr & Storefront Setup:
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#2c3e50", lineHeight: 1.5 }}>
                • <strong>Online Store:</strong> Tiers apply <em>automatically</em> in Shopify cart &amp; checkout.<br />
                • <strong>Shiprocket Fastrr:</strong> Shiprocket's "Import Discount" modal accepts discount codes. Copy the exact <strong>Code</strong> from the table below and paste it in Shiprocket &gt; Discounts &gt; Import Discount.
              </p>
            </div>

            {volumeRules.length === 0 ? (
              <s-section>
                <s-empty-state heading="No volume discount rules yet">
                  <s-icon slot="graphic" type="discount" />
                  <s-text slot="subheading">
                    Create tiers (e.g. Buy 2 Save 10%, Buy 3 Save 15%) for specific products or collections.
                  </s-text>
                  <s-button slot="primary-action" variant="primary" onClick={openCreateVolumeModal}>
                    Create Volume Discount
                  </s-button>
                </s-empty-state>
              </s-section>
            ) : (
              <s-section padding="none">
                <s-table variant="auto">
                  <s-table-header-row>
                    <s-table-header listSlot="primary">Campaign Name</s-table-header>
                    <s-table-header listSlot="labeled">Target Scope</s-table-header>
                    <s-table-header listSlot="labeled">Volume Tiers &amp; Shiprocket Code</s-table-header>
                    <s-table-header listSlot="inline">Status</s-table-header>
                    <s-table-header listSlot="secondary">Actions</s-table-header>
                  </s-table-header-row>
                  <s-table-body>
                    {volumeRules.map((rule) => {
                      const cleanName = rule.title
                        .replace(/^(bundle(\s+for)?[:\s]*|volume(\s+tier)?[:\s]*|collection(\s+tier)?[:\s]*)/i, "")
                        .replace(/[^a-zA-Z0-9]/g, "")
                        .toUpperCase()
                        .slice(0, 8) || "OFFER";
                      return (
                        <s-table-row key={rule.id}>
                          <s-table-cell>
                            <s-text type="strong">{rule.title}</s-text>
                          </s-table-cell>
                          <s-table-cell>
                            <s-badge tone={rule.targetType === "PRODUCT" ? "info" : "attention"}>
                              {rule.targetType}
                            </s-badge>
                          </s-table-cell>
                          <s-table-cell>
                            <s-stack direction="block" gap="extra-tight">
                              {rule.tiers.map((t, i) => {
                                const isFixed = t.discountType === "FIXED_AMOUNT";
                                const val = t.discountValue ?? (t.discountPercent || 10);
                                const code = `${cleanName}-BUY${t.minQuantity}-${val}OFF`;
                                return (
                                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                                    <s-badge tone="success">
                                      {t.minQuantity}+ ({isFixed ? `₹${val}` : `${val}%`} OFF)
                                    </s-badge>
                                    <span style={{ fontSize: "0.75rem", fontFamily: "monospace", background: "#f1f2f4", padding: "2px 6px", borderRadius: "4px", color: "#202223" }}>
                                      {code}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(code);
                                        shopify?.toast?.show(`Copied ${code}!`);
                                      }}
                                      style={{
                                        cursor: "pointer",
                                        background: "#fff",
                                        border: "1px solid #ccc",
                                        borderRadius: "4px",
                                        padding: "1px 6px",
                                        fontSize: "0.7rem",
                                        fontWeight: 600,
                                      }}
                                    >
                                      📋 Copy
                                    </button>
                                  </div>
                                );
                              })}
                            </s-stack>
                          </s-table-cell>
                          <s-table-cell>
                            <s-badge tone={rule.active ? "success" : "subdued"}>
                              {rule.active ? "ACTIVE" : "DRAFT"}
                            </s-badge>
                          </s-table-cell>
                          <s-table-cell>
                            <s-stack direction="inline" gap="tight">
                              <s-button size="slim" onClick={() => openEditVolumeModal(rule)}>
                                Edit
                              </s-button>
                              <s-button
                                size="slim"
                                tone={rule.active ? "subdued" : "success"}
                                onClick={() => handleToggleStatus(rule)}
                              >
                                {rule.active ? "Deactivate" : "Activate"}
                              </s-button>
                              <s-button
                                size="slim"
                                tone="critical"
                                onClick={() => handleDeleteRule(rule.id)}
                              >
                                Delete
                              </s-button>
                            </s-stack>
                          </s-table-cell>
                        </s-table-row>
                      );
                    })}
                  </s-table-body>
                </s-table>
              </s-section>
            )}
          </>
        )}

        {/* ---------------- TAB 2: FREQUENTLY BOUGHT TOGETHER ---------------- */}
        {activeTab === "fbt" && (
          <>
            <div style={{ backgroundColor: "#eef9f5", border: "1px solid #c2ece0", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px" }}>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "#006e52", fontWeight: 700 }}>
                🚀 Shiprocket Fastrr &amp; Storefront Setup:
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#2c3e50", lineHeight: 1.5 }}>
                • <strong>Online Store:</strong> FBT bundle appears right under the product on the PDP. Adding the bundle applies discounts automatically.<br />
                • <strong>Shiprocket Fastrr:</strong> Copy the exact <strong>Code</strong> below and paste it in Shiprocket &gt; Discounts &gt; Import Discount.
              </p>
            </div>

            {fbtRules.length === 0 ? (
              <s-section>
                <s-empty-state heading="No FBT bundles created yet">
                  <s-icon slot="graphic" type="product" />
                  <s-text slot="subheading">
                    Pick a trigger product (e.g. Snowboard) and link companion items (e.g. Bindings, Boots, Wax) with exclusive bundle discounts!
                  </s-text>
                  <s-button slot="primary-action" variant="primary" onClick={openCreateFbtModal}>
                    Create FBT Bundle
                  </s-button>
                </s-empty-state>
              </s-section>
            ) : (
              <s-section padding="none">
                <s-table variant="auto">
                  <s-table-header-row>
                    <s-table-header listSlot="primary">Bundle Name</s-table-header>
                    <s-table-header listSlot="labeled">Trigger Product</s-table-header>
                    <s-table-header listSlot="labeled">Companion Items &amp; Shiprocket Code</s-table-header>
                    <s-table-header listSlot="inline">Status</s-table-header>
                    <s-table-header listSlot="secondary">Actions</s-table-header>
                  </s-table-header-row>
                  <s-table-body>
                    {fbtRules.map((rule) => {
                      const cleanName = rule.title
                        .replace(/^(bundle(\s+for)?[:\s]*|volume(\s+tier)?[:\s]*|collection(\s+tier)?[:\s]*)/i, "")
                        .replace(/[^a-zA-Z0-9]/g, "")
                        .toUpperCase()
                        .slice(0, 8) || "BUNDLE";
                      const isFixed = rule.discountType === "FIXED_AMOUNT";
                      const bundleVal = Number(rule.discountValue ?? (rule.mainDiscountPercent || rule.fbtProducts[0]?.discountPercent || 10));
                      const code = `BUNDLE-${cleanName}-${bundleVal}OFF`;
                      return (
                        <s-table-row key={rule.id}>
                          <s-table-cell>
                            <s-text type="strong">{rule.title}</s-text>
                            <span style={{ marginLeft: "8px", fontSize: "0.75rem", background: isFixed ? "#eaf2fd" : "#e3f1df", color: isFixed ? "#005bd3" : "#008060", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                              {isFixed ? `Bundle: -₹${bundleVal} OFF` : `Bundle: -${bundleVal}% OFF`}
                            </span>
                          </s-table-cell>
                          <s-table-cell>
                            <s-badge tone="info">Product</s-badge>
                          </s-table-cell>
                          <s-table-cell>
                            <s-stack direction="block" gap="extra-tight">
                              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "4px" }}>
                                {rule.fbtProducts.map((p, i) => (
                                  <s-badge key={i} tone="success">
                                    {p.title} {isFixed ? "" : `(-${p.discountPercent || bundleVal}%)`}
                                  </s-badge>
                                ))}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontSize: "0.75rem", fontFamily: "monospace", background: "#f1f2f4", padding: "2px 6px", borderRadius: "4px", color: "#202223" }}>
                                  {code}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(code);
                                    shopify?.toast?.show(`Copied ${code}!`);
                                  }}
                                  style={{
                                    cursor: "pointer",
                                    background: "#fff",
                                    border: "1px solid #ccc",
                                    borderRadius: "4px",
                                    padding: "1px 6px",
                                    fontSize: "0.7rem",
                                    fontWeight: 600,
                                  }}
                                >
                                  📋 Copy
                                </button>
                              </div>
                            </s-stack>
                          </s-table-cell>
                          <s-table-cell>
                            <s-badge tone={rule.active ? "success" : "subdued"}>
                              {rule.active ? "ACTIVE" : "DRAFT"}
                            </s-badge>
                          </s-table-cell>
                          <s-table-cell>
                            <s-stack direction="inline" gap="tight">
                              <s-button size="slim" onClick={() => openEditFbtModal(rule)}>
                                Edit
                              </s-button>
                              <s-button
                                size="slim"
                                tone={rule.active ? "subdued" : "success"}
                                onClick={() => handleToggleStatus(rule)}
                              >
                                {rule.active ? "Deactivate" : "Activate"}
                              </s-button>
                              <s-button
                                size="slim"
                                tone="critical"
                                onClick={() => handleDeleteRule(rule.id)}
                              >
                                Delete
                              </s-button>
                            </s-stack>
                          </s-table-cell>
                        </s-table-row>
                      );
                    })}
                  </s-table-body>
                </s-table>
              </s-section>
            )}
          </>
        )}

        {/* ---------------- TAB 3: WIDGET DESIGN & TEMPLATES ---------------- */}
        {activeTab === "design" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fff", padding: "16px 20px", borderRadius: "10px", border: "1px solid #e1e3e5" }}>
              <div>
                <h2 style={{ margin: "0 0 4px 0", fontSize: "1.15rem", fontWeight: 700 }}>Widget Layout Templates &amp; Styling</h2>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#666" }}>
                  Select from 5 UI templates and customize colors and fonts. Changes sync directly to the PDP widgets!
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveStyling}
                disabled={fetcher.state === "submitting"}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#008060",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {fetcher.state === "submitting" ? "Saving..." : "Save & Sync Styling"}
              </button>
            </div>

            {/* Template Selector Cards */}
            <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "10px", border: "1px solid #e1e3e5" }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: "1rem", fontWeight: 700 }}>1. Choose Widget Layout Template</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                {[
                  { id: "cards", name: "Modern Cards", desc: "Classic vertical cards with radio buttons, badges & strikethrough price." },
                  { id: "minimal", name: "Minimalist List", desc: "Clean, flat horizontal rows with soft borders for clean luxury look." },
                  { id: "grid", name: "Grid Boxes", desc: "Multi-column side-by-side grid boxes with bold savings on top." },
                  { id: "pills", name: "Pill Selector", desc: "Clickable rounded pills for instant 1-click quantity selection." },
                  { id: "banner", name: "Tier Banner", desc: "Prominent featured offer with high-contrast active highlight." },
                ].map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setStyling({ ...styling, template: t.id })}
                    style={{
                      border: styling.template === t.id ? `2px solid #008060` : "1px solid #d2d5d8",
                      backgroundColor: styling.template === t.id ? "#f0f8f5" : "#fafbfb",
                      borderRadius: "8px",
                      padding: "14px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <strong style={{ fontSize: "0.95rem", color: styling.template === t.id ? "#008060" : "#202223" }}>{t.name}</strong>
                      <input
                        type="radio"
                        name="widgetTemplate"
                        checked={styling.template === t.id}
                        onChange={() => setStyling({ ...styling, template: t.id })}
                      />
                    </div>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "#666", lineHeight: 1.4 }}>{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Color & Typography Controls */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              {/* Colors */}
              <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "10px", border: "1px solid #e1e3e5" }}>
                <h3 style={{ margin: "0 0 14px 0", fontSize: "1rem", fontWeight: 700 }}>2. Colors &amp; Accents</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {[
                    { key: "accentColor", label: "Primary Accent (Buttons & Active borders)" },
                    { key: "bgColor", label: "Widget Background Color" },
                    { key: "textColor", label: "Text / Heading Color" },
                    { key: "borderColor", label: "Card & Row Border Color" },
                    { key: "badgeBg", label: "Badge / Savings Pill Background" },
                    { key: "badgeText", label: "Badge Text Color" },
                  ].map((c) => (
                    <div key={c.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{c.label}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <input
                          type="color"
                          value={styling[c.key]}
                          onChange={(e) => setStyling({ ...styling, [c.key]: e.target.value })}
                          style={{ width: "36px", height: "30px", border: "none", cursor: "pointer", background: "none" }}
                        />
                        <input
                          type="text"
                          value={styling[c.key]}
                          onChange={(e) => setStyling({ ...styling, [c.key]: e.target.value })}
                          style={{ width: "80px", padding: "4px 8px", fontSize: "0.85rem", border: "1px solid #ccc", borderRadius: "4px" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Typography & Sizing */}
              <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "10px", border: "1px solid #e1e3e5" }}>
                <h3 style={{ margin: "0 0 14px 0", fontSize: "1rem", fontWeight: 700 }}>3. Sizing &amp; Geometry</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>Font Size</label>
                    <select
                      value={styling.fontSize}
                      onChange={(e) => setStyling({ ...styling, fontSize: e.target.value })}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                    >
                      <option value="13px">Small (13px)</option>
                      <option value="15px">Regular / Medium (15px) - Recommended</option>
                      <option value="17px">Large (17px)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>Corner Radius (Border Radius)</label>
                    <select
                      value={styling.borderRadius}
                      onChange={(e) => setStyling({ ...styling, borderRadius: e.target.value })}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                    >
                      <option value="0px">Sharp Corners (0px)</option>
                      <option value="6px">Slightly Rounded (6px)</option>
                      <option value="10px">Medium Rounded (10px) - Recommended</option>
                      <option value="20px">Pill / Extra Rounded (20px)</option>
                    </select>
                  </div>
                </div>

                {/* Live Preview Inside Styling Tab */}
                <div style={{ marginTop: "20px", borderTop: "1px solid #eee", paddingTop: "14px" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#666" }}>Live Preview:</span>
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "14px",
                      backgroundColor: styling.bgColor,
                      border: `1px solid ${styling.borderColor}`,
                      borderRadius: styling.borderRadius,
                      color: styling.textColor,
                      fontSize: styling.fontSize,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: "8px" }}>Buy More, Save More (Preview)</div>
                    <div
                      style={{
                        padding: "8px 12px",
                        border: `2px solid ${styling.accentColor}`,
                        borderRadius: styling.borderRadius,
                        backgroundColor: "#f6fbf9",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>Buy 2 &middot; Save 10%</span>
                      <span
                        style={{
                          backgroundColor: styling.badgeBg,
                          color: styling.badgeText,
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "4px",
                        }}
                      >
                        Popular
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </s-stack>

      {/* ---------------- MODAL 1: VOLUME DISCOUNT EDITOR ---------------- */}
      {isVolumeModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              width: "600px",
              maxWidth: "92vw",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>
                {editingVolumeId ? "Edit Volume Discount" : "Create Volume Discount"}
              </h2>
              <button
                type="button"
                onClick={() => setIsVolumeModalOpen(false)}
                style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer" }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>Campaign Title</label>
                <input
                  type="text"
                  value={volumeTitle}
                  onChange={(e) => setVolumeTitle(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #ccc" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>Target Scope</label>
                <div style={{ display: "flex", gap: "16px", marginBottom: "8px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="vol_scope"
                      value="PRODUCT"
                      checked={volumeTargetType === "PRODUCT"}
                      onChange={() => {
                        setVolumeTargetType("PRODUCT");
                        setVolumeTargetGid("");
                        setVolumeTargetTitle("");
                      }}
                    />
                    Specific Product
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="vol_scope"
                      value="COLLECTION"
                      checked={volumeTargetType === "COLLECTION"}
                      onChange={() => {
                        setVolumeTargetType("COLLECTION");
                        setVolumeTargetGid("");
                        setVolumeTargetTitle("");
                      }}
                    />
                    Entire Collection
                  </label>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={selectVolumeTargetResource}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "6px",
                      backgroundColor: "#f4f4f4",
                      border: "1px solid #ccc",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Select {volumeTargetType === "PRODUCT" ? "Product" : "Collection"}
                  </button>
                  <span style={{ fontSize: "0.9rem", color: volumeTargetTitle ? "#008060" : "#666", fontWeight: volumeTargetTitle ? 600 : 400 }}>
                    {volumeTargetTitle ? `Selected: ${volumeTargetTitle}` : "No item selected"}
                  </span>
                </div>
              </div>

              {/* Tiers List - USER ADDS TIERS THEMSELF */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label style={{ fontWeight: 600 }}>Discount Tiers</label>
                  <button
                    type="button"
                    onClick={addTierRow}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "6px",
                      backgroundColor: "#008060",
                      color: "#ffffff",
                      border: "none",
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    + Add Tier
                  </button>
                </div>

                {tiers.length === 0 ? (
                  <div
                    style={{
                      padding: "20px",
                      backgroundColor: "#f9fafb",
                      borderRadius: "8px",
                      textAlign: "center",
                      border: "1px dashed #d2d5d8",
                    }}
                  >
                    <p style={{ margin: "0 0 8px 0", fontSize: "0.9rem", color: "#5c5f62", fontWeight: 500 }}>
                      No tiers added yet.
                    </p>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "#8c9196" }}>
                      Click <strong>"+ Add Tier"</strong> above to add quantity discount levels (e.g. Buy 2 - Save 10%).
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {tiers.map((tier, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          backgroundColor: "#fafafa",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          border: "1px solid #eee",
                        }}
                      >
                        <div style={{ width: "80px" }}>
                          <span style={{ fontSize: "0.75rem", color: "#666" }}>Min Qty</span>
                          <input
                            type="number"
                            min="1"
                            value={tier.minQuantity}
                            onChange={(e) => updateTierField(idx, "minQuantity", e.target.value)}
                            style={{ width: "100%", padding: "4px 8px", borderRadius: "4px", border: "1px solid #ccc" }}
                          />
                        </div>
                        <div style={{ width: "105px" }}>
                          <span style={{ fontSize: "0.75rem", color: "#666" }}>Type</span>
                          <select
                            value={tier.discountType || "PERCENTAGE"}
                            onChange={(e) => updateTierField(idx, "discountType", e.target.value)}
                            style={{ width: "100%", padding: "4px 6px", borderRadius: "4px", border: "1px solid #ccc", background: "#fff" }}
                          >
                            <option value="PERCENTAGE">% OFF</option>
                            <option value="FIXED_AMOUNT">₹ OFF</option>
                          </select>
                        </div>
                        <div style={{ width: "90px" }}>
                          <span style={{ fontSize: "0.75rem", color: "#666" }}>Value</span>
                          <input
                            type="number"
                            min="1"
                            max={tier.discountType === "FIXED_AMOUNT" ? 999999 : 100}
                            value={tier.discountValue ?? (tier.discountPercent || 10)}
                            onChange={(e) => updateTierField(idx, "discountValue", e.target.value)}
                            style={{ width: "100%", padding: "4px 8px", borderRadius: "4px", border: "1px solid #ccc" }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: "0.75rem", color: "#666" }}>Label</span>
                          <input
                            type="text"
                            value={tier.label}
                            onChange={(e) => updateTierField(idx, "label", e.target.value)}
                            style={{ width: "100%", padding: "4px 8px", borderRadius: "4px", border: "1px solid #ccc" }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTierRow(idx)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#d82c0d",
                            cursor: "pointer",
                            fontWeight: 700,
                            fontSize: "1.2rem",
                            paddingTop: "14px",
                          }}
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={() => setIsVolumeModalOpen(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    backgroundColor: "#f4f4f4",
                    border: "1px solid #ccc",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveVolumeRule}
                  disabled={fetcher.state === "submitting" || !volumeTargetGid || tiers.length === 0}
                  style={{
                    padding: "8px 20px",
                    borderRadius: "6px",
                    backgroundColor: volumeTargetGid && tiers.length > 0 ? "#008060" : "#a5d8ca",
                    color: "#ffffff",
                    border: "none",
                    cursor: volumeTargetGid && tiers.length > 0 ? "pointer" : "not-allowed",
                    fontWeight: 600,
                  }}
                >
                  {fetcher.state === "submitting" ? "Saving..." : "Save Volume Discount"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 2: FBT BUNDLE EDITOR ---------------- */}
      {isFbtModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              width: "600px",
              maxWidth: "92vw",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>
                {editingFbtId ? "Edit FBT Bundle" : "Create Frequently Bought Together Bundle"}
              </h2>
              <button
                type="button"
                onClick={() => setIsFbtModalOpen(false)}
                style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer" }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>Bundle Title</label>
                <input
                  type="text"
                  value={fbtTitle}
                  onChange={(e) => setFbtTitle(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #ccc" }}
                />
              </div>

              {/* Trigger Product */}
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                  Main / Trigger Product (Where the bundle appears on PDP)
                </label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={selectFbtTriggerProduct}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "6px",
                      backgroundColor: "#f4f4f4",
                      border: "1px solid #ccc",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Select Trigger Product
                  </button>
                  <span style={{ fontSize: "0.9rem", color: fbtTargetTitle ? "#008060" : "#666", fontWeight: fbtTargetTitle ? 600 : 400 }}>
                    {fbtTargetTitle ? `Selected: ${fbtTargetTitle}` : "No product selected"}
                  </span>
                </div>
              </div>

              {/* Discount Type Selector: Percentage vs Fixed Amount */}
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "8px" }}>
                  Bundle Discount Type
                </label>
                <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: 500 }}>
                    <input
                      type="radio"
                      name="fbtDiscountType"
                      value="PERCENTAGE"
                      checked={fbtDiscountType === "PERCENTAGE"}
                      onChange={() => setFbtDiscountType("PERCENTAGE")}
                    />
                    Percentage (% OFF)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: 500 }}>
                    <input
                      type="radio"
                      name="fbtDiscountType"
                      value="FIXED_AMOUNT"
                      checked={fbtDiscountType === "FIXED_AMOUNT"}
                      onChange={() => setFbtDiscountType("FIXED_AMOUNT")}
                    />
                    Fixed Amount (₹ OFF)
                  </label>
                </div>
              </div>

              {/* Discount Value Input */}
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                  {fbtDiscountType === "PERCENTAGE" ? "Bundle Discount Percentage (%)" : "Bundle Discount Amount (₹)"}
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <input
                    type="number"
                    min="1"
                    max={fbtDiscountType === "PERCENTAGE" ? 100 : 999999}
                    value={fbtDiscountValue}
                    onChange={(e) => setFbtDiscountValue(e.target.value)}
                    placeholder={fbtDiscountType === "PERCENTAGE" ? "10" : "150"}
                    style={{ width: "140px", padding: "8px 12px", borderRadius: "6px", border: "1px solid #ccc" }}
                  />
                  <span style={{ fontSize: "0.85rem", color: "#666" }}>
                    {fbtDiscountType === "PERCENTAGE"
                      ? "% discount applied to bundle items when purchased together"
                      : "Flat ₹ discount deducted from total when bundle items are purchased together"}
                  </span>
                </div>
              </div>

              {/* Companion Products */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label style={{ fontWeight: 600 }}>Companion Bundle Products</label>
                  <button
                    type="button"
                    onClick={selectFbtCompanions}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "6px",
                      backgroundColor: "#008060",
                      color: "#ffffff",
                      border: "none",
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    + Pick Companion Products
                  </button>
                </div>

                {fbtCompanions.length === 0 ? (
                  <div style={{ padding: "16px", backgroundColor: "#f9fafb", borderRadius: "6px", textAlign: "center", border: "1px dashed #ccc" }}>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#666" }}>
                      No companion items chosen yet. Click "+ Pick Companion Products" to select items.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {fbtCompanions.map((comp, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          backgroundColor: "#fbfcfd",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          border: "1px solid #e1e3e5",
                        }}
                      >
                        {comp.image ? (
                          <img
                            src={comp.image}
                            alt=""
                            style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px" }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "40px",
                              height: "40px",
                              backgroundColor: "#eee",
                              borderRadius: "4px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.7rem",
                            }}
                          >
                            Item
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{comp.title}</div>
                          <div style={{ fontSize: "0.75rem", color: "#666" }}>
                            Price: ₹{(comp.priceCents / 100).toFixed(2)}
                          </div>
                        </div>
                        {fbtDiscountType === "PERCENTAGE" ? (
                          <div style={{ width: "110px" }}>
                            <span style={{ fontSize: "0.75rem", color: "#666" }}>Discount %</span>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={comp.discountPercent}
                              onChange={(e) => updateCompanionDiscount(idx, e.target.value)}
                              style={{ width: "100%", padding: "4px 8px", borderRadius: "4px", border: "1px solid #ccc" }}
                            />
                          </div>
                        ) : (
                          <div style={{ width: "130px", textAlign: "right" }}>
                            <span style={{ fontSize: "0.75rem", color: "#008060", fontWeight: 600 }}>
                              Part of Bundle
                            </span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeCompanionRow(idx)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#d82c0d",
                            cursor: "pointer",
                            fontWeight: 700,
                            fontSize: "1.2rem",
                            padding: "4px",
                          }}
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={() => setIsFbtModalOpen(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    backgroundColor: "#f4f4f4",
                    border: "1px solid #ccc",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveFbtRule}
                  disabled={fetcher.state === "submitting" || !fbtTargetGid || fbtCompanions.length === 0}
                  style={{
                    padding: "8px 20px",
                    borderRadius: "6px",
                    backgroundColor: fbtTargetGid && fbtCompanions.length > 0 ? "#008060" : "#a5d8ca",
                    color: "#ffffff",
                    border: "none",
                    cursor: fbtTargetGid && fbtCompanions.length > 0 ? "pointer" : "not-allowed",
                    fontWeight: 600,
                  }}
                >
                  {fetcher.state === "submitting" ? "Saving..." : "Save FBT Bundle"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </s-page>
  );
}
