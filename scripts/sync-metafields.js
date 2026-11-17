// @ts-check
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const session = await prisma.session.findFirst();
  if (!session || !session.accessToken) {
    console.error("No valid session found in database.");
    return;
  }

  const shop = session.shop;
  const token = session.accessToken;

  console.log(`Syncing rules to shop: ${shop}...`);

  const rawRules = await prisma.bundleRule.findMany({
    where: { shop, active: true },
    orderBy: { createdAt: "desc" },
  });

  const activeRulesPayload = rawRules.map((r) => {
    let parsedTiers = [];
    let parsedFbt = [];
    let mainDiscountPercent = 0;
    try {
      parsedTiers = JSON.parse(r.tiers || "[]");
    } catch {
      parsedTiers = [];
    }
    try {
      const rawFbt = JSON.parse(r.fbtProducts || "[]");
      if (Array.isArray(rawFbt)) {
        parsedFbt = rawFbt;
      } else if (rawFbt && rawFbt.companions) {
        parsedFbt = rawFbt.companions;
        mainDiscountPercent = Number(rawFbt.mainDiscountPercent || 0);
      }
    } catch {
      parsedFbt = [];
    }
    const isFbt = parsedFbt.length > 0 && parsedTiers.length === 0;
    return {
      id: r.id,
      title: r.title,
      ruleType: isFbt ? "FBT" : "VOLUME",
      targetType: r.targetType,
      targetGid: r.targetGid,
      mainDiscountPercent,
      tiers: parsedTiers,
      fbtProducts: parsedFbt,
      active: true,
    };
  });

  // Fetch products for each collection rule to enable instant storefront cart splitting
  for (const rule of activeRulesPayload) {
    if (rule.targetType === "COLLECTION" && rule.targetGid) {
      try {
        const colRes = await graphql(`
          query GetColProducts($id: ID!) {
            collection(id: $id) {
              products(first: 100) {
                nodes {
                  id
                }
              }
            }
          }
        `, { id: rule.targetGid });
        const prodNodes = colRes?.data?.collection?.products?.nodes || [];
        rule.collectionProductIds = prodNodes.map(p => String(p.id).replace(/\D/g, ''));
        console.log(`Collection ${rule.targetGid} has products:`, rule.collectionProductIds);
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
  };

  console.log("Config payload collectionIds:", collectionIds);
  console.log("Active rules count:", activeRulesPayload.length);

  async function graphql(query, variables = {}) {
    const res = await fetch(`https://${shop}/admin/api/2025-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
    });
    return res.json();
  }

  // 1. Fetch Shop ID
  const shopData = await graphql(`
    query {
      shop {
        id
      }
    }
  `);
  const shopGid = shopData?.data?.shop?.id;
  if (!shopGid) {
    console.error("Failed to get shop ID:", shopData);
    return;
  }

  // 2. Set Shop Metafields
  const metaRes = await graphql(
    `
      mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
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
      }
    `,
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
  console.log("Shop metafields set result:", JSON.stringify(metaRes?.data?.metafieldsSet));

  // 3. Find and update Automatic Discount Node
  const discountData = await graphql(`
    query {
      discountNodes(first: 25) {
        nodes {
          id
          discount {
            __typename
            ... on DiscountAutomaticApp {
              title
              status
            }
          }
        }
      }
    }
  `);

  const existingNode = discountData?.data?.discountNodes?.nodes?.find(
    (n) =>
      n.discount?.__typename === "DiscountAutomaticApp" &&
      (n.discount?.title?.includes("Bundle & Tier") ||
        n.discount?.title?.includes("Volume"))
  );

  if (existingNode) {
    console.log(`Found discount node: ${existingNode.id}. Updating metafield...`);
    const updateRes = await graphql(
      `
        mutation UpdateAppDiscount(
          $id: ID!
          $automaticAppDiscount: DiscountAutomaticAppInput!
        ) {
          discountAutomaticAppUpdate(
            id: $id
            automaticAppDiscount: $automaticAppDiscount
          ) {
            automaticAppDiscount {
              discountId
              title
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      {
        id: existingNode.id,
        automaticAppDiscount: {
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
    console.log("Discount node update result:", JSON.stringify(updateRes));
  } else {
    console.log("No existing discount node found. Let's create one if function is registered.");
  }

  console.log("Sync complete!");
}

run()
  .catch((err) => console.error("Error:", err))
  .finally(() => prisma.$disconnect());
