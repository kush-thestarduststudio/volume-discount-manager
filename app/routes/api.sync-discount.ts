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

    // 1. Fetch functions
    const funcData = await graphql(`
      query {
        shopifyFunctions(first: 25) {
          nodes {
            id
            title
            apiType
          }
        }
      }
    `);

    // 2. Fetch existing discount nodes
    const discountData = await graphql(`
      query {
        discountNodes(first: 50) {
          nodes {
            id
            discount {
              __typename
              ... on DiscountAutomaticApp {
                title
                status
                appDiscountType {
                  functionId
                }
              }
            }
          }
        }
      }
    `);

    // 3. Fetch active rules from DB
    const activeRules = await prisma.bundleRule.findMany({
      where: { shop, active: true },
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

    // 4. Update shop metafield
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

    // 5. Create or Update Discount Node
    const existingNode = discountData?.data?.discountNodes?.nodes?.find(
      (n: any) =>
        n.discount?.__typename === "DiscountAutomaticApp" &&
        (n.discount?.title?.includes("Bundle & Tier") || n.discount?.title?.includes("Volume"))
    );

    let mutationResult = null;
    const allFuncs = funcData?.data?.shopifyFunctions?.nodes || [];
    const funcNode = allFuncs.find((n: any) =>
      n.title?.toLowerCase().includes("bundle") ||
      n.title?.toLowerCase().includes("tier") ||
      n.title?.toLowerCase().includes("discount")
    ) || allFuncs[0];

    const REAL_FUNCTION_ID = funcNode?.id || "01a1e800-5a2a-70c1-891a-df5db2048e51";

    if (existingNode) {
      mutationResult = await graphql(
        `mutation UpdateDiscount($id: ID!, $input: DiscountAutomaticAppInput!) {
          discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $input) {
            automaticAppDiscount { discountId title }
            userErrors { field message }
          }
        }`,
        {
          id: existingNode.id,
          input: {
            title: "Bundle & Tier Automatic Discounts",
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
      mutationResult = await graphql(
        `mutation CreateDiscount($input: DiscountAutomaticAppInput!) {
          discountAutomaticAppCreate(automaticAppDiscount: $input) {
            automaticAppDiscount { discountId title }
            userErrors { field message }
          }
        }`,
        {
          input: {
            title: "Bundle & Tier Automatic Discounts",
            functionId: REAL_FUNCTION_ID,
            discountClasses: ["PRODUCT"],
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

    return new Response(
      JSON.stringify({
        ok: true,
        shop,
        realFunctionId: REAL_FUNCTION_ID,
        existingNodeId: existingNode?.id || null,
        mutationResult,
        metafieldSetResult,
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
