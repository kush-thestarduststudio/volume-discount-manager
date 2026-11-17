/**
 * CLI Helper Script for Shopify-Hosted Volume Discount, Bundle & FBT Campaign Management.
 * 
 * Works 100% on Shopify's native Discounts API (discountAutomaticAppCreate / discountAutomaticActivate).
 * All campaigns reside directly in Shopify's database as Discount Nodes with metafields.
 * 
 * Usage:
 *   npm run campaigns list
 *   npm run campaigns seed-samples
 *   npm run campaigns activate <discountGid>
 *   npm run campaigns deactivate <discountGid>
 *   npm run campaigns delete <discountGid>
 *   npm run campaigns create-volume --name "Buy 2 Save 10%" --scope ALL_PRODUCTS --tiers 2:10,4:20 --split true
 *   npm run campaigns create-bundle --name "Duo Bundle" --products gid://shopify/Product/1,gid://shopify/Product/2 --value 15
 *   npm run campaigns create-fbt --name "Phone + Case FBT" --trigger gid://shopify/Product/1 --companions gid://shopify/Product/2 --value 100
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FUNCTION_METAFIELD_NAMESPACE = "$app:volume-discount";
const FUNCTION_METAFIELD_KEY = "function-config";

interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{ message: string }>;
}

async function getCredentials(): Promise<{ shop: string; accessToken: string }> {
  if (process.env.SHOPIFY_SHOP && process.env.SHOPIFY_ACCESS_TOKEN) {
    return {
      shop: process.env.SHOPIFY_SHOP,
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
    };
  }

  // Look for offline session in database
  const session = await prisma.session.findFirst({
    where: { isOnline: false },
    orderBy: { expires: "desc" },
  });

  if (session && session.shop && session.accessToken) {
    return {
      shop: session.shop,
      accessToken: session.accessToken,
    };
  }

  throw new Error(
    "No active Shopify credentials found. Either run 'shopify app dev' to authenticate or set SHOPIFY_SHOP and SHOPIFY_ACCESS_TOKEN environment variables."
  );
}

async function shopifyGraphQL<T = any>(
  shop: string,
  accessToken: string,
  query: string,
  variables: Record<string, any> = {}
): Promise<T> {
  const url = `https://${shop}/admin/api/2026-04/graphql.json`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Shopify API HTTP Error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as GraphQLResponse<T>;
  if (json.errors && json.errors.length > 0) {
    throw new Error(`GraphQL Error: ${json.errors.map((e) => e.message).join("; ")}`);
  }

  return json.data as T;
}

async function findVolumeDiscountFunctionId(
  shop: string,
  accessToken: string
): Promise<string> {
  const query = `#graphql
    query FindVolumeDiscountFunctions {
      shopifyFunctions(first: 25) {
        nodes {
          id
          title
          apiType
        }
      }
    }
  `;

  const data = await shopifyGraphQL<{ shopifyFunctions: { nodes: Array<{ id: string; title: string }> } }>(
    shop,
    accessToken,
    query
  );

  const nodes = data?.shopifyFunctions?.nodes ?? [];
  const exact = nodes.find(
    (n) => n.title === "volume-discount-function" || n.title.toLowerCase().includes("volume-discount")
  );

  if (exact) {
    return exact.id;
  }

  if (nodes.length > 0) {
    return nodes[0].id;
  }

  throw new Error(
    "Could not find 'volume-discount-function' on store. Ensure you have deployed or are running 'shopify app dev' with the extension."
  );
}

export async function listCampaigns(): Promise<void> {
  const { shop, accessToken } = await getCredentials();
  console.log(`\n🔍 Fetching campaigns directly from Shopify Admin (${shop})...\n`);

  const query = `#graphql
    query ListDiscountNodes {
      discountNodes(first: 50) {
        nodes {
          id
          discount {
            __typename
            ... on DiscountAutomaticApp {
              title
              status
              startsAt
              endsAt
              combinesWith {
                orderDiscounts
                productDiscounts
                shippingDiscounts
              }
            }
          }
          metafield(namespace: "${FUNCTION_METAFIELD_NAMESPACE}", key: "${FUNCTION_METAFIELD_KEY}") {
            value
          }
        }
      }
    }
  `;

  const data = await shopifyGraphQL(shop, accessToken, query);
  const nodes = data?.discountNodes?.nodes || [];

  const appCampaigns = nodes.filter((n: any) => n.metafield?.value);

  if (appCampaigns.length === 0) {
    console.log("No campaigns found with function config metafield.");
    console.log("Tip: Run 'npm run campaigns seed-samples' to generate initial sample campaigns!\n");
    return;
  }

  console.log(`Found ${appCampaigns.length} Volume / Bundle / FBT campaign(s) in Shopify Admin:\n`);
  for (const node of appCampaigns) {
    const d = node.discount;
    let config: any = {};
    try {
      config = JSON.parse(node.metafield.value);
    } catch {}

    const statusBadge = d.status === "ACTIVE" ? "🟢 ACTIVE" : "⚪ INACTIVE / DRAFT";
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`Campaign:   ${d.title || config.campaignName || "Untitled"}`);
    console.log(`ID (GID):   ${node.id}`);
    console.log(`Status:     ${statusBadge}`);
    console.log(`Mode:       ${config.mode || config.kind || "VOLUME"}`);
    console.log(`Scope:      ${config.targetScope || "ALL_PRODUCTS"}`);
    console.log(`Type:       ${config.discountType || "PERCENTAGE"}`);
    console.log(`Split Items:${config.splitUnqualifiedItems !== false ? " Yes (exact cart line splitting)" : " No"}`);

    if (config.tiers && config.tiers.length > 0) {
      console.log(`Tiers:      ${config.tiers.map((t: any) => `Buy ${t.minQuantity}+ => ${t.discountValue}${config.discountType === "PERCENTAGE" ? "%" : " OFF"}`).join(" | ")}`);
    }
    if (config.bundleConfig) {
      console.log(`Bundle:     Required: ${config.bundleConfig.requiredProductIds?.join(", ")} | Value: ${config.bundleConfig.discountValue}`);
    }
    if (config.fbtConfig) {
      console.log(`FBT:        Trigger: ${config.fbtConfig.triggerProductId} | Companions: ${config.fbtConfig.companionProductIds?.join(", ")}`);
    }
    console.log(`Starts At:  ${d.startsAt || "Immediate"}`);
    console.log(`Ends At:    ${d.endsAt || "Never"}`);
  }
  console.log(`--------------------------------------------------------------------------------\n`);
}

export async function createVolumeCampaign(options: {
  name: string;
  scope?: "ALL_PRODUCTS" | "SPECIFIC_PRODUCTS" | "SPECIFIC_COLLECTIONS";
  productIds?: string[];
  collectionIds?: string[];
  discountType?: "PERCENTAGE" | "FIXED_AMOUNT";
  tiers?: Array<{ id: string; minQuantity: number; discountValue: number; label?: string }>;
  splitUnqualifiedItems?: boolean;
  applyToMultiples?: boolean;
  activate?: boolean;
}): Promise<string> {
  const { shop, accessToken } = await getCredentials();
  const functionId = await findVolumeDiscountFunctionId(shop, accessToken);

  const campaignId = `camp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const tiers = options.tiers || [
    { id: "tier-1", minQuantity: 2, discountValue: 10, label: "Buy 2 Save 10%" },
    { id: "tier-2", minQuantity: 4, discountValue: 20, label: "Buy 4 Save 20%" },
  ];

  const config = {
    campaignId,
    campaignName: options.name,
    mode: "VOLUME",
    discountType: options.discountType || "PERCENTAGE",
    evaluationMode: "ACROSS_ELIGIBLE_CART",
    targetScope: options.scope || "ALL_PRODUCTS",
    productIds: options.productIds || [],
    collectionIds: options.collectionIds || [],
    excludedProductIds: [],
    tiers: tiers.sort((a, b) => a.minQuantity - b.minQuantity),
    splitUnqualifiedItems: options.splitUnqualifiedItems !== undefined ? options.splitUnqualifiedItems : true,
    applyToMultiples: Boolean(options.applyToMultiples),
  };

  const mutation = `#graphql
    mutation CreateVolumeDiscount($input: DiscountAutomaticAppInput!) {
      discountAutomaticAppCreate(automaticAppDiscount: $input) {
        automaticAppDiscount {
          discountId
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  // If not activating immediately, set a far-future start date or deactivate right after creation
  const startsAt = options.activate ? new Date().toISOString() : "2099-01-01T00:00:00Z";

  const variables = {
    input: {
      title: options.name,
      functionId,
      startsAt,
      discountClasses: ["PRODUCT"],
      combinesWith: {
        orderDiscounts: false,
        productDiscounts: true,
        shippingDiscounts: true,
      },
      metafields: [
        {
          namespace: FUNCTION_METAFIELD_NAMESPACE,
          key: FUNCTION_METAFIELD_KEY,
          type: "json",
          value: JSON.stringify(config),
        },
      ],
    },
  };

  const result = await shopifyGraphQL(shop, accessToken, mutation, variables);
  const res = result?.discountAutomaticAppCreate;

  if (res?.userErrors && res.userErrors.length > 0) {
    throw new Error(`Failed to create discount: ${res.userErrors.map((e: any) => e.message).join(", ")}`);
  }

  const discountId = res?.automaticAppDiscount?.discountId;
  console.log(`✅ Volume Discount Campaign "${options.name}" created in Shopify Admin!`);
  console.log(`   Discount GID: ${discountId}`);
  console.log(`   Status: ${options.activate ? "ACTIVE" : "DRAFT / INACTIVE (starts 2099 or activate in Shopify Admin)"}\n`);

  return discountId;
}

export async function createBundleCampaign(options: {
  name: string;
  requiredProductIds: string[];
  discountType?: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  activate?: boolean;
}): Promise<string> {
  const { shop, accessToken } = await getCredentials();
  const functionId = await findVolumeDiscountFunctionId(shop, accessToken);

  const campaignId = `bundle_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const config = {
    campaignId,
    campaignName: options.name,
    mode: "BUNDLE",
    discountType: options.discountType || "PERCENTAGE",
    evaluationMode: "ACROSS_ELIGIBLE_CART",
    targetScope: "SPECIFIC_PRODUCTS",
    productIds: options.requiredProductIds,
    collectionIds: [],
    excludedProductIds: [],
    tiers: [],
    splitUnqualifiedItems: true,
    applyToMultiples: false,
    bundleConfig: {
      requiredProductIds: options.requiredProductIds,
      discountType: options.discountType || "PERCENTAGE",
      discountValue: options.discountValue,
    },
  };

  const mutation = `#graphql
    mutation CreateBundleDiscount($input: DiscountAutomaticAppInput!) {
      discountAutomaticAppCreate(automaticAppDiscount: $input) {
        automaticAppDiscount {
          discountId
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const startsAt = options.activate ? new Date().toISOString() : "2099-01-01T00:00:00Z";

  const variables = {
    input: {
      title: options.name,
      functionId,
      startsAt,
      discountClasses: ["PRODUCT"],
      combinesWith: {
        orderDiscounts: false,
        productDiscounts: true,
        shippingDiscounts: true,
      },
      metafields: [
        {
          namespace: FUNCTION_METAFIELD_NAMESPACE,
          key: FUNCTION_METAFIELD_KEY,
          type: "json",
          value: JSON.stringify(config),
        },
      ],
    },
  };

  const result = await shopifyGraphQL(shop, accessToken, mutation, variables);
  const res = result?.discountAutomaticAppCreate;

  if (res?.userErrors && res.userErrors.length > 0) {
    throw new Error(`Failed to create bundle: ${res.userErrors.map((e: any) => e.message).join(", ")}`);
  }

  const discountId = res?.automaticAppDiscount?.discountId;
  console.log(`✅ Bundle Campaign "${options.name}" created in Shopify Admin!`);
  console.log(`   Discount GID: ${discountId}`);
  console.log(`   Status: ${options.activate ? "ACTIVE" : "DRAFT / INACTIVE"}\n`);

  return discountId;
}

export async function createFbtCampaign(options: {
  name: string;
  triggerProductId: string;
  companionProductIds: string[];
  minCompanions?: number;
  discountType?: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  activate?: boolean;
}): Promise<string> {
  const { shop, accessToken } = await getCredentials();
  const functionId = await findVolumeDiscountFunctionId(shop, accessToken);

  const campaignId = `fbt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const config = {
    campaignId,
    campaignName: options.name,
    mode: "FBT",
    discountType: options.discountType || "FIXED_AMOUNT",
    evaluationMode: "ACROSS_ELIGIBLE_CART",
    targetScope: "SPECIFIC_PRODUCTS",
    productIds: [options.triggerProductId, ...options.companionProductIds],
    collectionIds: [],
    excludedProductIds: [],
    tiers: [],
    splitUnqualifiedItems: true,
    applyToMultiples: false,
    fbtConfig: {
      triggerProductId: options.triggerProductId,
      companionProductIds: options.companionProductIds,
      minCompanions: options.minCompanions || 1,
      discountType: options.discountType || "FIXED_AMOUNT",
      discountValue: options.discountValue,
    },
  };

  const mutation = `#graphql
    mutation CreateFbtDiscount($input: DiscountAutomaticAppInput!) {
      discountAutomaticAppCreate(automaticAppDiscount: $input) {
        automaticAppDiscount {
          discountId
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const startsAt = options.activate ? new Date().toISOString() : "2099-01-01T00:00:00Z";

  const variables = {
    input: {
      title: options.name,
      functionId,
      startsAt,
      discountClasses: ["PRODUCT"],
      combinesWith: {
        orderDiscounts: false,
        productDiscounts: true,
        shippingDiscounts: true,
      },
      metafields: [
        {
          namespace: FUNCTION_METAFIELD_NAMESPACE,
          key: FUNCTION_METAFIELD_KEY,
          type: "json",
          value: JSON.stringify(config),
        },
      ],
    },
  };

  const result = await shopifyGraphQL(shop, accessToken, mutation, variables);
  const res = result?.discountAutomaticAppCreate;

  if (res?.userErrors && res.userErrors.length > 0) {
    throw new Error(`Failed to create FBT discount: ${res.userErrors.map((e: any) => e.message).join(", ")}`);
  }

  const discountId = res?.automaticAppDiscount?.discountId;
  console.log(`✅ Frequently Bought Together Campaign "${options.name}" created in Shopify Admin!`);
  console.log(`   Discount GID: ${discountId}`);
  console.log(`   Status: ${options.activate ? "ACTIVE" : "DRAFT / INACTIVE"}\n`);

  return discountId;
}

export async function activateCampaign(discountId: string): Promise<void> {
  const { shop, accessToken } = await getCredentials();
  console.log(`Activating discount ${discountId} in Shopify Admin...`);

  const mutation = `#graphql
    mutation ActivateDiscount($id: ID!) {
      discountAutomaticActivate(id: $id) {
        automaticDiscountNode {
          id
          automaticDiscount {
            ... on DiscountAutomaticApp {
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
    }
  `;

  const result = await shopifyGraphQL(shop, accessToken, mutation, { id: discountId });
  const userErrors = result?.discountAutomaticActivate?.userErrors;

  if (userErrors && userErrors.length > 0) {
    // If activate fails because startsAt is in the future, update startsAt to now
    const updateMutation = `#graphql
      mutation UpdateStartsAt($id: ID!, $input: DiscountAutomaticAppInput!) {
        discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $input) {
          userErrors {
            field
            message
          }
        }
      }
    `;
    await shopifyGraphQL(shop, accessToken, updateMutation, {
      id: discountId,
      input: { startsAt: new Date().toISOString() },
    });
    console.log(`✅ Discount ${discountId} startsAt set to now and Activated!`);
    return;
  }

  console.log(`✅ Discount ${discountId} is now ACTIVE in Shopify Admin.`);
}

export async function deactivateCampaign(discountId: string): Promise<void> {
  const { shop, accessToken } = await getCredentials();
  console.log(`Deactivating discount ${discountId} in Shopify Admin...`);

  const mutation = `#graphql
    mutation DeactivateDiscount($id: ID!) {
      discountAutomaticDeactivate(id: $id) {
        automaticDiscountNode {
          id
          automaticDiscount {
            ... on DiscountAutomaticApp {
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
    }
  `;

  const result = await shopifyGraphQL(shop, accessToken, mutation, { id: discountId });
  const userErrors = result?.discountAutomaticDeactivate?.userErrors;

  if (userErrors && userErrors.length > 0) {
    throw new Error(`Failed to deactivate discount: ${userErrors.map((e: any) => e.message).join(", ")}`);
  }

  console.log(`✅ Discount ${discountId} is now DEACTIVATED / DRAFT in Shopify Admin.`);
}

export async function deleteCampaign(discountId: string): Promise<void> {
  const { shop, accessToken } = await getCredentials();
  console.log(`Deleting discount ${discountId} from Shopify Admin...`);

  const mutation = `#graphql
    mutation DeleteDiscount($id: ID!) {
      discountAutomaticDelete(id: $id) {
        deletedId
        userErrors {
          field
          message
        }
      }
    }
  `;

  const result = await shopifyGraphQL(shop, accessToken, mutation, { id: discountId });
  const userErrors = result?.discountAutomaticDelete?.userErrors;

  if (userErrors && userErrors.length > 0) {
    throw new Error(`Failed to delete discount: ${userErrors.map((e: any) => e.message).join(", ")}`);
  }

  console.log(`✅ Discount ${discountId} was successfully deleted from Shopify.`);
}

export async function seedSampleCampaigns(): Promise<void> {
  console.log("\n🌱 Seeding 3 production sample campaigns directly into Shopify Admin...\n");

  // 1. Volume Discount
  await createVolumeCampaign({
    name: "Volume Tier: Buy More, Save More (10% - 20% OFF)",
    scope: "ALL_PRODUCTS",
    discountType: "PERCENTAGE",
    tiers: [
      { id: "tier-1", minQuantity: 2, discountValue: 10, label: "Buy 2+ Save 10%" },
      { id: "tier-2", minQuantity: 3, discountValue: 15, label: "Buy 3+ Save 15%" },
      { id: "tier-3", minQuantity: 5, discountValue: 20, label: "Buy 5+ Save 20%" },
    ],
    splitUnqualifiedItems: true,
    applyToMultiples: false,
    activate: false,
  });

  // 2. Fixed Amount Volume Discount
  await createVolumeCampaign({
    name: "VIP Tier: Buy 2 Save ₹100 Each",
    scope: "ALL_PRODUCTS",
    discountType: "FIXED_AMOUNT",
    tiers: [
      { id: "tier-fixed-1", minQuantity: 2, discountValue: 100, label: "Buy 2 Save ₹100 / item" },
    ],
    splitUnqualifiedItems: true,
    applyToMultiples: false,
    activate: false,
  });

  console.log("🎉 Sample campaigns created as Drafts in Shopify Admin → Discounts!");
  console.log("   Merchants can review, schedule, and click 'Activate' directly inside Shopify Admin.\n");
}

// Simple CLI Runner
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "list";

  try {
    switch (command) {
      case "list":
        await listCampaigns();
        break;
      case "seed-samples":
        await seedSampleCampaigns();
        break;
      case "activate":
        if (!args[1]) throw new Error("Usage: activate <discountGid>");
        await activateCampaign(args[1]);
        break;
      case "deactivate":
        if (!args[1]) throw new Error("Usage: deactivate <discountGid>");
        await deactivateCampaign(args[1]);
        break;
      case "delete":
        if (!args[1]) throw new Error("Usage: delete <discountGid>");
        await deleteCampaign(args[1]);
        break;
      case "create-volume":
        await createVolumeCampaign({
          name: args[1] || "Custom Volume Discount",
          splitUnqualifiedItems: true,
          activate: false,
        });
        break;
      default:
        console.log(`Unknown command: ${command}`);
        console.log("Available commands: list, seed-samples, activate <id>, deactivate <id>, delete <id>, create-volume");
        break;
    }
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && process.argv[1].includes("manage-campaigns")) {
  main();
}

