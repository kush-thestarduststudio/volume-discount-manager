import { type LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";

const FALLBACK_RULES = [
  {
    id: "cmw-stardust-volume-test",
    title: "Volume Tier: test",
    targetType: "PRODUCT",
    targetGid: "gid://shopify/Product/7488883753012",
    ruleType: "VOLUME",
    mainDiscountPercent: 0,
    tiers: [
      { minQuantity: 2, discountPercent: 10, label: "Buy 2 - Save 10%" },
      { minQuantity: 4, discountPercent: 15, label: "Buy 4 - Save 15%" },
    ],
    fbtProducts: [],
    active: true,
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shopParam = url.searchParams.get("shop") || "";

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
  };

  if (!shopParam) {
    return new Response(JSON.stringify({ ok: true, shop: "stardustt-studio.myshopify.com", rules: FALLBACK_RULES }), { headers });
  }

  // Extract clean shop domain (handles full URL, custom domains, or myshopify)
  let cleanShop = shopParam
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase()
    .trim();

  const shopSubdomain = cleanShop.split(".")[0];

  try {
    let rules = await prisma.bundleRule.findMany({
      where: {
        active: true,
        OR: [
          { shop: { contains: cleanShop } },
          { shop: { contains: shopSubdomain } },
          { shop: { contains: "stardust" } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    // If query by shop returns nothing, fetch any active rules
    if (!rules.length) {
      rules = await prisma.bundleRule.findMany({
        where: { active: true },
        orderBy: { createdAt: "desc" },
      });
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
    const settingsRule = rules.find((r) => r.targetType === "SETTINGS");
    if (settingsRule) {
      try {
        widgetSettings = { ...widgetSettings, ...JSON.parse(settingsRule.tiers || "{}") };
      } catch {}
    }

    const discountRules = rules.filter((r) => r.targetType !== "SETTINGS");

    let parsedRules = discountRules.map((r) => {
      let tiers: any[] = [];
      let fbtProducts: any[] = [];
      let mainDiscountPercent = 0;

      try {
        tiers = JSON.parse(r.tiers || "[]");
      } catch (e) {
        tiers = [];
      }

      let fbtDiscountType = "PERCENTAGE";
      let fbtDiscountValue = 0;
      let triggerProduct = null;

      try {
        const rawFbt = JSON.parse(r.fbtProducts || "[]");
        if (Array.isArray(rawFbt)) {
          fbtProducts = rawFbt;
        } else if (rawFbt && rawFbt.companions) {
          fbtProducts = rawFbt.companions;
          mainDiscountPercent = Number(rawFbt.mainDiscountPercent || 0);
          fbtDiscountType = rawFbt.discountType || "PERCENTAGE";
          fbtDiscountValue = Number(rawFbt.discountValue ?? (rawFbt.mainDiscountPercent || 0));
          triggerProduct = rawFbt.triggerProduct || null;
        }
      } catch (e) {
        fbtProducts = [];
      }

      const isFbt = r.targetType === "PRODUCT" && fbtProducts.length > 0 && tiers.length === 0;

      const cleanName = r.title
        .replace(/^(bundle(\s+for)?[:\s]*|volume(\s+tier)?[:\s]*|collection(\s+tier)?[:\s]*)/i, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 8) || (isFbt ? "BUNDLE" : "OFFER");

      const isFixedFbt = fbtDiscountType === "FIXED_AMOUNT";
      const bundleVal = Number(isFixedFbt ? fbtDiscountValue : (fbtDiscountValue || mainDiscountPercent || fbtProducts[0]?.discountPercent || 10));
      const discountCode = isFbt ? `BUNDLE-${cleanName}-${bundleVal}OFF` : "";

      const enhancedTiers = tiers.map((t: any) => {
        const isFixed = t.discountType === "FIXED_AMOUNT";
        const val = Number(isFixed ? t.discountValue : (t.discountPercent || t.discountValue || 10));
        return {
          ...t,
          discountType: isFixed ? "FIXED_AMOUNT" : "PERCENTAGE",
          discountValue: val,
          discountPercent: isFixed ? 0 : val,
          code: `${cleanName}-BUY${t.minQuantity}-${val}OFF`,
        };
      });

      return {
        id: r.id,
        title: r.title,
        targetType: r.targetType,
        targetGid: r.targetGid,
        ruleType: isFbt ? "FBT" : "VOLUME",
        discountType: isFbt ? fbtDiscountType : (enhancedTiers[0]?.discountType || "PERCENTAGE"),
        discountValue: isFbt ? bundleVal : (enhancedTiers[0]?.discountValue || 0),
        mainDiscountPercent,
        triggerProduct,
        discountCode,
        tiers: enhancedTiers,
        fbtProducts,
        active: r.active,
      };
    });

    return new Response(
      JSON.stringify({
        ok: true,
        shop: cleanShop || "stardustt-studio.myshopify.com",
        rules: parsedRules,
        settings: widgetSettings,
      }),
      { headers }
    );
  } catch (err: any) {
    console.error("[api.config Error]:", err);
    return new Response(
      JSON.stringify({
        ok: true,
        shop: cleanShop || "stardustt-studio.myshopify.com",
        rules: FALLBACK_RULES,
      }),
      { headers }
    );
  }
};
