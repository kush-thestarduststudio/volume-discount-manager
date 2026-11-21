import { type LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shopParam = url.searchParams.get("shop") || "";

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=15, stale-while-revalidate=60",
  };

  if (!shopParam) {
    return new Response(JSON.stringify({ ok: true, rules: [] }), { headers });
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

    // Auto-migrate legacy companion product ID (8245592817876 / 7366296928308 -> 15454599512116 Mahalakshmi Agarbatti)
    for (const r of rules) {
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

    // If query by shop returns nothing, fetch any active rules
    if (!rules.length) {
      rules = await prisma.bundleRule.findMany({
        where: { active: true },
        orderBy: { createdAt: "desc" },
      });
    }

    if (!rules.length && (cleanShop.includes("stardust") || shopSubdomain.includes("stardust") || cleanShop === "")) {
      const defaultFbt = {
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
            productId: "15455228297268",
            variantId: "67911497547828",
            title: "7 Chakra Ashtaganda Agarbatti",
            priceCents: 19900,
            image: "https://cdn.shopify.com/s/files/1/0634/3272/0436/files/7_chakra_ashtagandha.webp?v=1794561818",
            discountPercent: 10,
          }
        ]
      };

      const seedRule = {
        id: "seed-fbt-test",
        shop: cleanShop || "stardustt-studio.myshopify.com",
        title: "Bundle for: test",
        targetType: "PRODUCT",
        targetGid: "gid://shopify/Product/7488883753012",
        tiers: "[]",
        fbtProducts: JSON.stringify(defaultFbt),
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      rules = [seedRule as any];

      prisma.bundleRule.create({
        data: {
          id: "seed-fbt-test-" + Date.now(),
          shop: cleanShop || "stardustt-studio.myshopify.com",
          title: "Bundle for: test",
          targetType: "PRODUCT",
          targetGid: "gid://shopify/Product/7488883753012",
          tiers: "[]",
          fbtProducts: JSON.stringify(defaultFbt),
          active: true,
        }
      }).catch(() => {});
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

      // ONLY use the exact tiers created in the database without any artificial injection
      const mappedTiers = tiers.map((t: any) => {
        const minQ = Number(t.minQuantity || 1);
        const isFixed = t.discountType === "FIXED_AMOUNT";
        const val = Number(isFixed ? t.discountValue : (t.discountPercent || t.discountValue || 0));
        return {
          ...t,
          minQuantity: minQ,
          discountType: isFixed ? "FIXED_AMOUNT" : "PERCENTAGE",
          discountValue: val,
          discountPercent: isFixed ? 0 : val,
          label: t.label || `Buy ${minQ} - Save ${isFixed ? `₹${val}` : `${val}%`}`,
          code: `${cleanName}-BUY${minQ}-${val}OFF`,
        };
      });

      return {
        id: r.id,
        title: r.title,
        targetType: r.targetType,
        targetGid: r.targetGid,
        ruleType: isFbt ? "FBT" : "VOLUME",
        discountType: isFbt ? fbtDiscountType : (mappedTiers[0]?.discountType || "PERCENTAGE"),
        discountValue: isFbt ? bundleVal : (mappedTiers[0]?.discountValue || 0),
        mainDiscountPercent,
        triggerProduct,
        discountCode,
        tiers: mappedTiers,
        fbtProducts,
        active: r.active,
      };
    });

    return new Response(
      JSON.stringify({
        ok: true,
        shop: cleanShop,
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
        shop: cleanShop,
        rules: [],
      }),
      { headers }
    );
  }
};
