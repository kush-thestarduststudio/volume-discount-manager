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
    const activeRules = await prisma.bundleRule.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
    });

    const activeRulesPayload = activeRules.map((r) => {
      let tiers = [];
      let fbtProducts = [];
      let mainDiscountPercent = 0;
      try { tiers = JSON.parse(r.tiers || "[]"); } catch {}
      try {
        const rawFbt = JSON.parse(r.fbtProducts || "[]");
        if (Array.isArray(rawFbt)) fbtProducts = rawFbt;
        else if (rawFbt?.companions) {
          fbtProducts = rawFbt.companions;
          mainDiscountPercent = Number(rawFbt.mainDiscountPercent || 0);
        }
      } catch {}
      return {
        id: r.id,
        title: r.title,
        ruleType: fbtProducts.length > 0 && tiers.length === 0 ? "FBT" : "VOLUME",
        targetType: r.targetType,
        targetGid: r.targetGid,
        mainDiscountPercent,
        tiers,
        fbtProducts,
        active: true,
      };
    });

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
              }
              ... on DiscountCodeBasic {
                title
                status
                codes(first: 5) {
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

    const allNodes = discountData?.data?.discountNodes?.nodes || [];
    const existingAppDiscounts = allNodes.filter((n: any) => {
      const title = n.discount?.title || "";
      return title.startsWith("[Volume") || title.startsWith("[Bundle") || title.includes("Bundle & Tier");
    });

    // Build expected discounts from active volume and FBT rules
    const expectedDiscounts: any[] = [];
    for (const rule of activeRulesPayload) {
      const cleanName = rule.title
        .replace(/^(bundle for:\s*|volume tier:\s*|collection tier:\s*)/i, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 8) || "OFFER";

      if (rule.ruleType === "VOLUME" && Array.isArray(rule.tiers) && rule.tiers.length > 0) {
        for (const tier of rule.tiers) {
          if (tier.minQuantity > 0 && tier.discountPercent > 0) {
            expectedDiscounts.push({
              type: "VOLUME",
              autoTitle: `[Volume] ${rule.title} - ${tier.minQuantity}+ (${tier.discountPercent}% OFF)`,
              codeTitle: `[Volume Code] ${rule.title} - ${tier.minQuantity}+ (${tier.discountPercent}% OFF)`,
              code: `${cleanName}-BUY${tier.minQuantity}-${tier.discountPercent}OFF`,
              minQuantity: tier.minQuantity,
              discountPercent: tier.discountPercent,
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
        const bundleDiscountPct =
          Number(rule.mainDiscountPercent) > 0
            ? Number(rule.mainDiscountPercent)
            : Number(rule.fbtProducts[0]?.discountPercent) || 10;

        expectedDiscounts.push({
          type: "FBT",
          autoTitle: `[Bundle] ${rule.title} (${bundleDiscountPct}% OFF)`,
          codeTitle: `[Bundle Code] ${rule.title} (${bundleDiscountPct}% OFF)`,
          code: `BUNDLE-${cleanName}-${bundleDiscountPct}OFF`,
          minQuantity: allBundleGids.length,
          discountPercent: bundleDiscountPct,
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
                value: { percentage: Number(exp.discountPercent) / 100 },
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
                value: { percentage: Number(exp.discountPercent) / 100 },
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
