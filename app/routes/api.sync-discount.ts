import { type LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shopParam = url.searchParams.get("shop") || "";

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };

  try {
    let session = null;
    if (shopParam) {
      session = await prisma.session.findFirst({
        where: { shop: { contains: shopParam.replace(/^https?:\/\//i, "").split("/")[0] } },
      });
    }
    if (!session) {
      session = await prisma.session.findFirst({
        where: {
          OR: [
            { shop: { contains: "stardust" } },
            { isOnline: false },
          ],
        },
        orderBy: { expires: "desc" },
      });
    }
    if (!session) {
      session = await prisma.session.findFirst();
    }

    if (!session || !session.accessToken) {
      return new Response(
        JSON.stringify({ ok: false, error: "No active session found in database" }),
        { status: 401, headers }
      );
    }

    const shop = session.shop;
    const token = session.accessToken;

    const graphql = async (query: string, variables: any = {}) => {
      const res = await fetch(`https://${shop}/admin/api/2026-04/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({ query, variables }),
      });
      return res.json();
    };

    // 1. Fetch active rules from DB
    let activeRules = await prisma.bundleRule.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
    });

    if (activeRules.length === 0) {
      // Seed default active rule for the store so redeploys/restarts never lose merchant rules
      const seedRule = await prisma.bundleRule.create({
        data: {
          shop: shop || "stardustt-studio.myshopify.com",
          title: "Volume Tier: test",
          targetType: "PRODUCT",
          targetGid: "gid://shopify/Product/7488883753012",
          tiers: JSON.stringify([
            {
              minQuantity: 4,
              discountPercent: 10,
              discountType: "PERCENTAGE",
              discountValue: 10,
              label: "Buy 4+ (10% OFF)",
              code: "TEST-BUY4-10OFF",
            },
          ]),
          fbtProducts: "[]",
          active: true,
        },
      });
      activeRules = [seedRule];
    }

    const activeRulesPayload = activeRules.map((r) => {
      let tiers = [];
      let fbtProducts = [];
      let mainDiscountPercent = 0;
      let fbtDiscountType = "PERCENTAGE";
      let fbtDiscountValue = 0;
      let triggerProduct = null;
      try { tiers = JSON.parse(r.tiers || "[]"); } catch {}
      try {
        const rawFbt = JSON.parse(r.fbtProducts || "[]");
        if (Array.isArray(rawFbt)) {
          fbtProducts = rawFbt;
        } else if (rawFbt?.companions) {
          fbtProducts = rawFbt.companions;
          mainDiscountPercent = Number(rawFbt.mainDiscountPercent || 0);
          fbtDiscountType = rawFbt.discountType || "PERCENTAGE";
          fbtDiscountValue = Number(rawFbt.discountValue ?? (rawFbt.mainDiscountPercent || 0));
          triggerProduct = rawFbt.triggerProduct || null;
        }
      } catch {}
      const isFbt = fbtProducts.length > 0 && tiers.length === 0;
      const cleanName = r.title
        .replace(/^(bundle(\s+for)?[:\s]*|volume(\s+tier)?[:\s]*|collection(\s+tier)?[:\s]*)/i, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 8) || (isFbt ? "BUNDLE" : "OFFER");

      const discType = isFbt ? fbtDiscountType : (tiers[0]?.discountType || "PERCENTAGE");
      const isFixed = discType === "FIXED_AMOUNT";
      const discVal = Number(isFixed ? (isFbt ? fbtDiscountValue : tiers[0]?.discountValue) : (isFbt ? (fbtDiscountValue || mainDiscountPercent || fbtProducts[0]?.discountPercent || 10) : (tiers[0]?.discountValue ?? tiers[0]?.discountPercent ?? 0)));
      const discountCode = isFbt ? `BUNDLE-${cleanName}-${discVal}OFF` : "";

      return {
        id: r.id,
        title: r.title,
        ruleType: isFbt ? "FBT" : "VOLUME",
        targetType: r.targetType,
        targetGid: r.targetGid,
        discountType: discType,
        discountValue: discVal,
        discountCode,
        mainDiscountPercent,
        triggerProduct,
        tiers,
        fbtProducts,
        active: true,
      };
    });

    for (const rule of activeRulesPayload) {
      if (rule.ruleType === "FBT" && (!rule.triggerProduct || !rule.triggerProduct.variantId) && rule.targetGid) {
        try {
          const prodRes = await graphql(
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
            { id: rule.targetGid }
          );
          const pData = prodRes?.data?.product;
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

    const configPayload = {
      collectionIds: activeRulesPayload.filter(r => r.targetType === "COLLECTION").map(r => r.targetGid),
      rules: activeRulesPayload,
    };

    // 2. Update shop metafield
    const shopInfo = await graphql(`query { shop { id } }`);
    const shopGid = shopInfo?.data?.shop?.id;
    let metafieldSetResult = null;
    if (shopGid) {
      metafieldSetResult = await graphql(
        `mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields { id key namespace }
            userErrors { field message }
          }
        }`,
        {
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
        }
      );
    }

    // 3. Fetch existing discount nodes (both automatic and code)
    const discountData = await graphql(`
      query {
        discountNodes(first: 100) {
          nodes {
            id
            discount {
              __typename
              ... on DiscountAutomaticBasic {
                title
                status
                combinesWith {
                  orderDiscounts
                  productDiscounts
                  shippingDiscounts
                }
              }
              ... on DiscountAutomaticBxgy {
                title
                status
                combinesWith {
                  orderDiscounts
                  productDiscounts
                  shippingDiscounts
                }
              }
              ... on DiscountAutomaticApp {
                title
                status
                combinesWith {
                  orderDiscounts
                  productDiscounts
                  shippingDiscounts
                }
              }
              ... on DiscountCodeBasic {
                title
                status
                codes(first: 5) {
                  nodes {
                    code
                  }
                }
                combinesWith {
                  orderDiscounts
                  productDiscounts
                  shippingDiscounts
                }
              }
              ... on DiscountCodeBxgy {
                title
                status
                codes(first: 5) {
                  nodes {
                    code
                  }
                }
                combinesWith {
                  orderDiscounts
                  productDiscounts
                  shippingDiscounts
                }
              }
              ... on DiscountCodeApp {
                title
                status
                codes(first: 5) {
                  nodes {
                    code
                  }
                }
                combinesWith {
                  orderDiscounts
                  productDiscounts
                  shippingDiscounts
                }
              }
            }
          }
        }
      }
    `);

    const allNodes = discountData?.data?.discountNodes?.nodes || [];
    const existingAppDiscounts = allNodes.filter((n: any) => {
      const title = n.discount?.title || "";
      return title.startsWith("[Volume") || title.startsWith("[Bundle") || title.includes("Bundle & Tier");
    });

    // Build expected discounts from active volume and FBT rules
    const expectedDiscounts: any[] = [];
    for (const rule of activeRulesPayload) {
      const cleanName = rule.title
        .replace(/^(bundle(\s+for)?[:\s]*|volume(\s+tier)?[:\s]*|collection(\s+tier)?[:\s]*)/i, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 8) || (rule.ruleType === "FBT" ? "BUNDLE" : "OFFER");

      if (rule.ruleType === "VOLUME" && Array.isArray(rule.tiers) && rule.tiers.length > 0) {
        for (const tier of rule.tiers) {
          const isFixed = tier.discountType === "FIXED_AMOUNT";
          const val = Number(isFixed ? tier.discountValue : (tier.discountPercent || tier.discountValue));
          if (tier.minQuantity > 0 && val > 0) {
            const valDisplay = isFixed ? `₹${val}` : `${val}%`;
            expectedDiscounts.push({
              type: "VOLUME",
              discountType: isFixed ? "FIXED_AMOUNT" : "PERCENTAGE",
              discountValue: val,
              discountPercent: isFixed ? 0 : val,
              autoTitle: `[Volume] ${rule.title} - ${tier.minQuantity}+ (${valDisplay} OFF)`,
              codeTitle: `[Volume Code] ${rule.title} - ${tier.minQuantity}+ (${valDisplay} OFF)`,
              code: `${cleanName}-BUY${tier.minQuantity}-${val}OFF`,
              minQuantity: tier.minQuantity,
              targetType: rule.targetType,
              targetGid: rule.targetGid,
              targetGids: [rule.targetGid],
            });
          }
        }
      } else if (rule.ruleType === "FBT" && Array.isArray(rule.fbtProducts) && rule.fbtProducts.length > 0) {
        const companionGids = rule.fbtProducts
          .map((p: any) => (p.productId?.startsWith("gid://") ? p.productId : "gid://shopify/Product/" + p.productId))
          .filter(Boolean);
        const allBundleGids = [rule.targetGid, ...companionGids];
        const isFixed = rule.discountType === "FIXED_AMOUNT";
        const val = Number(isFixed ? rule.discountValue : (rule.mainDiscountPercent || rule.discountValue || rule.fbtProducts[0]?.discountPercent || 10));
        const valDisplay = isFixed ? `₹${val}` : `${val}%`;

        expectedDiscounts.push({
          type: "FBT",
          discountType: isFixed ? "FIXED_AMOUNT" : "PERCENTAGE",
          discountValue: val,
          discountPercent: isFixed ? 0 : val,
          autoTitle: `[Bundle] ${rule.title} (${valDisplay} OFF)`,
          codeTitle: `[Bundle Code] ${rule.title} (${valDisplay} OFF)`,
          code: `BUNDLE-${cleanName}-${val}OFF`,
          minQuantity: allBundleGids.length,
          targetType: "PRODUCT",
          targetGid: rule.targetGid,
          targetGids: allBundleGids,
        });
      }
    }

    // Delete outdated discounts
    const deleteResults: any[] = [];
    for (const oldNode of existingAppDiscounts) {
      const title = oldNode.discount?.title || "";
      const isCode = oldNode.discount?.__typename === "DiscountCodeBasic";

      const stillNeeded = expectedDiscounts.some((exp) =>
        isCode ? exp.codeTitle === title : exp.autoTitle === title
      );
      if (!stillNeeded) {
        if (isCode) {
          const delRes = await graphql(
            `mutation DeleteCodeDiscount($id: ID!) {
              discountCodeDelete(id: $id) { userErrors { field message } }
            }`,
            { id: oldNode.id }
          );
          deleteResults.push({ id: oldNode.id, title, res: delRes });
        } else {
          const delRes = await graphql(
            `mutation DeleteDiscount($id: ID!) {
              discountAutomaticDelete(id: $id) { userErrors { field message } }
            }`,
            { id: oldNode.id }
          );
          deleteResults.push({ id: oldNode.id, title, res: delRes });
        }
      }
    }

    // Create missing automatic discounts and code discounts
    const createResults: any[] = [];
    for (const exp of expectedDiscounts) {
      // 1. Automatic Discount
      const autoExists = existingAppDiscounts.some(
        (n: any) => n.discount?.title === exp.autoTitle && n.discount?.__typename === "DiscountAutomaticBasic"
      );
      if (!autoExists) {
        const createRes = await graphql(
          `mutation CreateNativeAutomaticDiscount($input: DiscountAutomaticBasicInput!) {
            discountAutomaticBasicCreate(automaticBasicDiscount: $input) {
              automaticDiscountNode { id }
              userErrors { field message }
            }
          }`,
          {
            input: {
              title: exp.autoTitle,
              startsAt: new Date().toISOString(),
              customerGets: {
                value:
                  exp.discountType === "FIXED_AMOUNT"
                    ? { discountAmount: { amount: Number(exp.discountValue).toFixed(2), appliesOnEachItem: false } }
                    : { percentage: Number(exp.discountPercent || exp.discountValue) / 100 },
                items: exp.targetType === "COLLECTION"
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
          }
        );
        createResults.push({ title: exp.autoTitle, result: createRes });
      }

      // 2. Code Discount
      const codeExists = existingAppDiscounts.some((n: any) => {
        if (n.discount?.__typename !== "DiscountCodeBasic") return false;
        if (n.discount?.title === exp.codeTitle) return true;
        const codes = (n.discount?.codes?.nodes || []).map((c: any) => c.code);
        return codes.includes(exp.code);
      });
      if (!codeExists) {
        const createCodeRes = await graphql(
          `mutation CreateNativeCodeDiscount($input: DiscountCodeBasicInput!) {
            discountCodeBasicCreate(basicCodeDiscount: $input) {
              codeDiscountNode { id }
              userErrors { field message }
            }
          }`,
          {
            input: {
              title: exp.codeTitle,
              code: exp.code,
              startsAt: new Date().toISOString(),
              customerSelection: { all: true },
              customerGets: {
                value:
                  exp.discountType === "FIXED_AMOUNT"
                    ? { discountAmount: { amount: Number(exp.discountValue).toFixed(2), appliesOnEachItem: false } }
                    : { percentage: Number(exp.discountPercent || exp.discountValue) / 100 },
                items: exp.targetType === "COLLECTION"
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
          }
        );
        createResults.push({ title: exp.codeTitle, code: exp.code, result: createCodeRes });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        shop,
        planType: "GROW_OR_STANDARD_AUTOMATIC_DISCOUNT",
        allDiscounts: allNodes.map((n: any) => ({
          id: n.id,
          typename: n.discount?.__typename,
          title: n.discount?.title,
          status: n.discount?.status,
          combinesWith: n.discount?.combinesWith,
          codes: n.discount?.codes?.nodes?.map((c: any) => c.code) || [],
        })),
        expectedDiscounts,
        created: createResults,
        deleted: deleteResults,
        metafields: metafieldSetResult,
      }, null, 2),
      { headers }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message || String(err) }),
      { status: 500, headers }
    );
  }
};
