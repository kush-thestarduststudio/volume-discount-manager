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

    // Auto-migrate legacy invalid companion product ID (8245592817876 / 7366296928308 -> 15454599512116)
    for (const r of activeRules) {
      let changed = false;
      let fixedTargetGid = r.targetGid;
      if (r.targetGid && (r.targetGid.includes("8245592817876") || r.targetGid.includes("7366296928308"))) {
        fixedTargetGid = "gid://shopify/Product/15454599512116";
        r.targetGid = fixedTargetGid;
        changed = true;
      }
      let fixedFbt = r.fbtProducts;
      if (r.fbtProducts && (r.fbtProducts.includes("8245592817876") || r.fbtProducts.includes("7366296928308"))) {
        fixedFbt = r.fbtProducts
          .replace(/8245592817876|7366296928308/g, "15454599512116")
          .replace(/44722881888468|43182450442292/g, "67910792216628")
          .replace(/7 Chakra and Hematite Ring Bracelet|Amethyst Bracelet/g, "Mahalakshmi (Dhan) Flora Masala Agarbatti");
        r.fbtProducts = fixedFbt;
        changed = true;
      }
      if (changed) {
        prisma.bundleRule.update({
          where: { id: r.id },
          data: { targetGid: fixedTargetGid, fbtProducts: fixedFbt },
        }).catch(() => {});
      }
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
          .map((p: any) => {
            let id = p.productId;
            if (String(id).includes("8245592817876") || String(id).includes("7366296928308")) id = "15454599512116";
            return id?.startsWith("gid://") ? id : "gid://shopify/Product/" + id;
          })
          .filter(Boolean);
        let safeTargetGid = rule.targetGid;
        if (String(safeTargetGid).includes("8245592817876") || String(safeTargetGid).includes("7366296928308")) {
          safeTargetGid = "gid://shopify/Product/15454599512116";
        }
        const allBundleGids = [safeTargetGid, ...companionGids];
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
          targetGid: safeTargetGid,
          targetGids: allBundleGids,
        });
      }
    }

    // Clean up existing app discounts for fresh recreation with latest products & tiers
    const deleteResults: any[] = [];
    for (const oldNode of existingAppDiscounts) {
      const title = oldNode.discount?.title || "";
      const isCode = oldNode.discount?.__typename === "DiscountCodeBasic";
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

    // Create expected automatic discounts and code discounts fresh
    const createResults: any[] = [];
    for (const exp of expectedDiscounts) {
      // 1. Automatic Discount
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

      // 2. Code Discount
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

    // 3. Ensure Shopify Function Automatic App Discount is synced with combinesWith
    let appDiscountResult: any = null;
    try {
      const funcRes = await graphql(`
        query FindShopifyFunctions {
          shopifyFunctions(first: 25) {
            nodes {
              id
              title
              apiType
            }
          }
        }
      `);
      const funcNodes = funcRes?.data?.shopifyFunctions?.nodes || [];
      const targetFunc = funcNodes.find(
        (n: any) => n.title?.includes("bundle-tier") || n.title?.includes("volume-discount")
      ) || funcNodes[0];

      if (targetFunc?.id) {
        const functionId = targetFunc.id;
        const existingAppDiscount = allNodes.find(
          (n: any) => n.discount?.__typename === "DiscountAutomaticApp" &&
                 (n.discount?.title?.includes("Volume & FBT") || n.discount?.title?.includes("Bundle & Tier"))
        );

        if (existingAppDiscount) {
          appDiscountResult = await graphql(
            `mutation UpdateCombinedVolumeDiscount($id: ID!, $discount: DiscountAutomaticAppInput!) {
              discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $discount) {
                automaticAppDiscount {
                  discountId
                  combinesWith {
                    orderDiscounts
                    productDiscounts
                    shippingDiscounts
                  }
                }
                userErrors { field message }
              }
            }`,
            {
              id: existingAppDiscount.id,
              discount: {
                title: "Volume & FBT Bundle Discount",
                combinesWith: {
                  orderDiscounts: true,
                  productDiscounts: true,
                  shippingDiscounts: true,
                },
                metafields: [
                  {
                    namespace: "$app:bundle_tiers",
                    key: "config",
                    type: "json",
                    value: JSON.stringify(configPayload),
                  },
                ],
              },
            }
          );
        } else {
          appDiscountResult = await graphql(
            `mutation CreateCombinedVolumeDiscount($discount: DiscountAutomaticAppInput!) {
              discountAutomaticAppCreate(automaticAppDiscount: $discount) {
                automaticAppDiscount {
                  discountId
                  combinesWith {
                    orderDiscounts
                    productDiscounts
                    shippingDiscounts
                  }
                }
                userErrors { field message }
              }
            }`,
            {
              discount: {
                title: "Volume & FBT Bundle Discount",
                functionId,
                startsAt: new Date().toISOString(),
                combinesWith: {
                  orderDiscounts: true,
                  productDiscounts: true,
                  shippingDiscounts: true,
                },
                metafields: [
                  {
                    namespace: "$app:bundle_tiers",
                    key: "config",
                    type: "json",
                    value: JSON.stringify(configPayload),
                  },
                ],
              },
            }
          );
        }
      }
    } catch (funcErr) {
      console.warn("[AppDiscountSync] Warning:", funcErr);
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
