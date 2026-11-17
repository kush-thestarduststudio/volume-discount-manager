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

    // 3. Fetch existing automatic discount nodes
    const discountData = await graphql(`
      query {
        discountNodes(first: 50) {
          nodes {
            id
            discount {
              __typename
              ... on DiscountAutomaticBasic {
                title
                status
              }
              ... on DiscountAutomaticApp {
                title
                status
              }
            }
          }
        }
      }
    `);

    const allNodes = discountData?.data?.discountNodes?.nodes || [];
    const existingAppDiscounts = allNodes.filter(
      (n: any) =>
        (n.discount?.__typename === "DiscountAutomaticBasic" || n.discount?.__typename === "DiscountAutomaticApp") &&
        (n.discount?.title?.startsWith("[Volume]") || n.discount?.title?.includes("Bundle & Tier"))
    );

    // Build expected discounts from currently active volume rules
    const expectedDiscounts: any[] = [];
    for (const rule of activeRulesPayload) {
      if (rule.ruleType === "VOLUME" && Array.isArray(rule.tiers) && rule.tiers.length > 0) {
        for (const tier of rule.tiers) {
          if (tier.minQuantity > 0 && tier.discountPercent > 0) {
            expectedDiscounts.push({
              title: `[Volume] ${rule.title} - ${tier.minQuantity}+ (${tier.discountPercent}% OFF)`,
              minQuantity: tier.minQuantity,
              discountPercent: tier.discountPercent,
              targetType: rule.targetType,
              targetGid: rule.targetGid,
            });
          }
        }
      }
    }

    // Delete outdated discounts
    const deleteResults: any[] = [];
    for (const oldNode of existingAppDiscounts) {
      const stillNeeded = expectedDiscounts.some(
        (exp) => exp.title === oldNode.discount?.title && oldNode.discount?.__typename === "DiscountAutomaticBasic"
      );
      if (!stillNeeded) {
        const delRes = await graphql(
          `mutation DeleteDiscount($id: ID!) {
            discountAutomaticDelete(id: $id) {
              userErrors { field message }
            }
          }`,
          { id: oldNode.id }
        );
        deleteResults.push({ id: oldNode.id, title: oldNode.discount?.title, res: delRes });
      }
    }

    // Create missing native automatic discounts
    const createResults: any[] = [];
    for (const exp of expectedDiscounts) {
      const alreadyExists = existingAppDiscounts.some(
        (n: any) => n.discount?.title === exp.title && n.discount?.__typename === "DiscountAutomaticBasic"
      );
      if (!alreadyExists) {
        const createRes = await graphql(
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
              userErrors {
                field
                message
              }
            }
          }`,
          {
            input: {
              title: exp.title,
              startsAt: new Date().toISOString(),
              customerGets: {
                value: {
                  percentage: Number(exp.discountPercent) / 100,
                },
                items: exp.targetType === "COLLECTION"
                  ? { collections: { collectionsToAdd: [exp.targetGid] } }
                  : { products: { productsToAdd: [exp.targetGid] } },
              },
              minimumRequirement: {
                quantity: {
                  greaterThanOrEqualToQuantity: String(exp.minQuantity),
                },
              },
              combinesWith: {
                orderDiscounts: true,
                productDiscounts: false,
                shippingDiscounts: true,
              },
            },
          }
        );
        createResults.push({ title: exp.title, result: createRes });
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
