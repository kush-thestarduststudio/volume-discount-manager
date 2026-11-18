import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  let rawRules = [];
  try {
    rawRules = await prisma.bundleRule.findMany({
      where: { shop: session.shop },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    console.error("[Database Error in loader]:", err);
    rawRules = [];
  }

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
    rules: rawRules.map((r) => {
      let parsedTiers = [];
      try {
        parsedTiers = JSON.parse(r.tiers || "[]");
      } catch {
        parsedTiers = [];
      }
      let parsedFbt = [];
      let mainDiscountPercent = 0;
      try {
        const rawFbt = JSON.parse(r.fbtProducts || "[]");
        if (Array.isArray(rawFbt)) {
          parsedFbt = rawFbt;
        } else if (rawFbt && rawFbt.companions) {
          parsedFbt = rawFbt.companions;
          mainDiscountPercent = Number(rawFbt.mainDiscountPercent || 0);
        }
      } catch (e) {
        parsedFbt = [];
      }
      const isFbt = parsedFbt.length > 0 && parsedTiers.length === 0;
      return {
        ...r,
        ruleType: isFbt ? "FBT" : "VOLUME",
        mainDiscountPercent,
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
      const mainDiscountPercent = parseFloat(formData.get("mainDiscountPercent") || "0") || 0;
      const active = formData.get("active") !== "false";

      if (!targetGid) {
        return { ok: false, error: "Please select the main trigger Product." };
      }

      const parsedFbt = JSON.parse(fbtProducts || "[]");
      if (parsedFbt.length === 0) {
        return { ok: false, error: "Please select at least 1 companion bundle product." };
      }

      const fbtDataToSave = JSON.stringify({
        mainDiscountPercent,
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
    const activeRules = await prisma.bundleRule.findMany({
      where: { shop, active: true },
    });

    const activeRulesPayload = activeRules.map((r) => {
      let parsedTiers = [];
      try {
        parsedTiers = JSON.parse(r.tiers || "[]");
      } catch {
        parsedTiers = [];
      }
      let parsedFbt = [];
      let mainDiscountPercent = 0;
      try {
        const rawFbt = JSON.parse(r.fbtProducts || "[]");
        if (Array.isArray(rawFbt)) {
          parsedFbt = rawFbt;
        } else if (rawFbt && rawFbt.companions) {
          parsedFbt = rawFbt.companions;
          mainDiscountPercent = Number(rawFbt.mainDiscountPercent || 0);
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
            if (tier.minQuantity > 0 && tier.discountPercent > 0) {
              const autoTitle = `[Volume] ${rule.title} - ${tier.minQuantity}+ (${tier.discountPercent}% OFF)`;
              const codeTitle = `[Volume Code] ${rule.title} - ${tier.minQuantity}+ (${tier.discountPercent}% OFF)`;
              const code = `${cleanName}-BUY${tier.minQuantity}-${tier.discountPercent}OFF`;

              expectedDiscounts.push({
                type: "VOLUME",
                autoTitle,
                codeTitle,
                code,
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
            .map((p) => (p.productId?.startsWith("gid://") ? p.productId : "gid://shopify/Product/" + p.productId))
            .filter(Boolean);
          const allBundleGids = [rule.targetGid, ...companionGids];
          const bundleDiscountPct =
            Number(rule.mainDiscountPercent) > 0
              ? Number(rule.mainDiscountPercent)
              : Number(rule.fbtProducts[0]?.discountPercent) || 10;
          const bundleMinQty = allBundleGids.length;

          const autoTitle = `[Bundle] ${rule.title} (${bundleDiscountPct}% OFF)`;
          const codeTitle = `[Bundle Code] ${rule.title} (${bundleDiscountPct}% OFF)`;
          const code = `BUNDLE-${cleanName}-${bundleDiscountPct}OFF`;

          expectedDiscounts.push({
            type: "FBT",
            autoTitle,
            codeTitle,
            code,
            minQuantity: bundleMinQty,
            discountPercent: bundleDiscountPct,
            targetType: "PRODUCT",
            targetGid: rule.targetGid,
            targetGids: allBundleGids,
          });
        }
      }

      // Cleanup outdated discounts in Shopify Admin
      for (const oldNode of existingAppDiscounts) {
        const title = oldNode.discount?.title || "";
        const isCode = oldNode.discount?.__typename === "DiscountCodeBasic";

        const isNeeded = expectedDiscounts.some((exp) =>
          isCode ? exp.codeTitle === title : exp.autoTitle === title
        );

        if (!isNeeded) {
          console.log(`[Sync] Removing outdated discount: ${title}`);
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
      }

      // Create expected automatic discounts & code discounts if missing
      let activeAutoCount = 0;
      let activeCodeCount = 0;
      let lastErrorMessage = "";

      for (const exp of expectedDiscounts) {
        // 1. Automatic Discount
        const autoExists = existingAppDiscounts.some(
          (n) => n.discount?.__typename === "DiscountAutomaticBasic" && n.discount?.title === exp.autoTitle
        );

        if (autoExists) {
          activeAutoCount++;
        } else {
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
                    value: { percentage: Number(exp.discountPercent) / 100 },
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
        }

        // 2. Code Discount (For Shiprocket Fastrr 1-Click Import)
        const codeExists = existingAppDiscounts.some((n) => {
          if (n.discount?.__typename !== "DiscountCodeBasic") return false;
          if (n.discount?.title === exp.codeTitle) return true;
          const codes = (n.discount?.codes?.nodes || []).map((c) => c.code);
          return codes.includes(exp.code);
        });

        if (codeExists) {
          activeCodeCount++;
        } else {
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
                    value: { percentage: Number(exp.discountPercent) / 100 },
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
      }

      if (lastErrorMessage) {
        discountStatus = `CREATE_ERROR: ${lastErrorMessage}`;
      } else if (expectedDiscounts.length === 0) {
        discountStatus = "No active discount rules configured yet. Click 'Create Volume Discount' or 'Create FBT Bundle' to start!";
      } else {
        discountStatus = `ACTIVE (${activeAutoCount} automatic discounts + ${activeCodeCount} Shiprocket import codes active)`;
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
  const { rules, discountStatus } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [activeTab, setActiveTab] = useState("volume"); // "volume" or "fbt"

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
  const [fbtMainDiscount, setFbtMainDiscount] = useState("0");
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
    setFbtMainDiscount("0");
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
    setTiers(rule.tiers || []);
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
    const nextPct = tiers.length > 0 ? (tiers[tiers.length - 1].discountPercent || 0) + 5 : 10;
    setTiers([
      ...tiers,
      { minQuantity: nextQty, discountPercent: nextPct, label: `Buy ${nextQty} - Save ${nextPct}%` },
    ]);
  };

  const removeTierRow = (index) => {
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const updateTierField = (index, field, value) => {
    const next = [...tiers];
    next[index][field] = field === "label" ? value : Number(value);
    if (field === "minQuantity" || field === "discountPercent") {
      next[index].label = `Buy ${next[index].minQuantity} - Save ${next[index].discountPercent}%`;
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
    setFbtMainDiscount(String(rule.mainDiscountPercent || "0"));
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
        setFbtTargetGid(selected[0].id);
        setFbtTargetTitle(selected[0].title);
        setFbtTitle(`Bundle for: ${selected[0].title}`);
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
    fd.append("mainDiscountPercent", fbtMainDiscount || "0");
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
                        .replace(/^(bundle for:\s*|volume tier:\s*|collection tier:\s*)/i, "")
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
                                const code = `${cleanName}-BUY${t.minQuantity}-${t.discountPercent}OFF`;
                                return (
                                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                                    <s-badge tone="success">
                                      {t.minQuantity}+ ({t.discountPercent}%)
                                    </s-badge>
                                    <span style={{ fontSize: "0.75rem", fontFamily: "monospace", background: "#f1f2f4", padding: "2px 6px", borderRadius: "4px", color: "#202223" }}>
                                      Code: {code}
                                    </span>
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
                        .replace(/^(bundle for:\s*|volume tier:\s*|collection tier:\s*)/i, "")
                        .replace(/[^a-zA-Z0-9]/g, "")
                        .toUpperCase()
                        .slice(0, 8) || "BUNDLE";
                      const bundlePct = Number(rule.mainDiscountPercent) > 0 ? Number(rule.mainDiscountPercent) : Number(rule.fbtProducts[0]?.discountPercent) || 10;
                      const code = `BUNDLE-${cleanName}-${bundlePct}OFF`;
                      return (
                        <s-table-row key={rule.id}>
                          <s-table-cell>
                            <s-text type="strong">{rule.title}</s-text>
                            {rule.mainDiscountPercent > 0 && (
                              <span style={{ marginLeft: "8px", fontSize: "0.75rem", background: "#e3f1df", color: "#008060", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                                Main: -{rule.mainDiscountPercent}%
                              </span>
                            )}
                          </s-table-cell>
                          <s-table-cell>
                            <s-badge tone="info">Product</s-badge>
                          </s-table-cell>
                          <s-table-cell>
                            <s-stack direction="block" gap="extra-tight">
                              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "4px" }}>
                                {rule.fbtProducts.map((p, i) => (
                                  <s-badge key={i} tone="success">
                                    {p.title} (-{p.discountPercent}%)
                                  </s-badge>
                                ))}
                              </div>
                              <span style={{ fontSize: "0.75rem", fontFamily: "monospace", background: "#f1f2f4", padding: "2px 6px", borderRadius: "4px", color: "#202223" }}>
                                Shiprocket Code: {code}
                              </span>
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
                        <div style={{ width: "90px" }}>
                          <span style={{ fontSize: "0.75rem", color: "#666" }}>Min Qty</span>
                          <input
                            type="number"
                            min="1"
                            value={tier.minQuantity}
                            onChange={(e) => updateTierField(idx, "minQuantity", e.target.value)}
                            style={{ width: "100%", padding: "4px 8px", borderRadius: "4px", border: "1px solid #ccc" }}
                          />
                        </div>
                        <div style={{ width: "90px" }}>
                          <span style={{ fontSize: "0.75rem", color: "#666" }}>Discount %</span>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={tier.discountPercent}
                            onChange={(e) => updateTierField(idx, "discountPercent", e.target.value)}
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

              {/* Main / Trigger Product Discount % */}
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                  Main Product Discount % (Optional)
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={fbtMainDiscount}
                    onChange={(e) => setFbtMainDiscount(e.target.value)}
                    placeholder="0"
                    style={{ width: "120px", padding: "8px 12px", borderRadius: "6px", border: "1px solid #ccc" }}
                  />
                  <span style={{ fontSize: "0.85rem", color: "#666" }}>
                    % discount applied to the main trigger product in this bundle (0 = full price)
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
                            Price: ${(comp.priceCents / 100).toFixed(2)}
                          </div>
                        </div>
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
