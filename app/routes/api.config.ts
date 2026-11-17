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
    "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
  };

  if (!shopParam) {
    return new Response(JSON.stringify({ ok: false, rules: [] }), { headers });
  }

  // Extract clean shop domain (handles full URL, custom domains, or myshopify)
  let cleanShop = shopParam
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase()
    .trim();

  // Handle subdomain matching (e.g. stardustt-studio from stardustt-studio.myshopify.com)
  const shopSubdomain = cleanShop.split(".")[0];

  try {
    const rules = await prisma.bundleRule.findMany({
      where: {
        active: true,
        OR: [
          { shop: { contains: cleanShop } },
          { shop: { contains: shopSubdomain } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    const parsedRules = rules.map((r) => {
      let tiers: any[] = [];
      let fbtProducts: any[] = [];
      let mainDiscountPercent = 0;

      try {
        tiers = JSON.parse(r.tiers || "[]");
      } catch (e) {
        tiers = [];
      }

      try {
        const rawFbt = JSON.parse(r.fbtProducts || "[]");
        if (Array.isArray(rawFbt)) {
          fbtProducts = rawFbt;
        } else if (rawFbt && rawFbt.companions) {
          fbtProducts = rawFbt.companions;
          mainDiscountPercent = Number(rawFbt.mainDiscountPercent || 0);
        }
      } catch (e) {
        fbtProducts = [];
      }

      const isFbt = r.targetType === "PRODUCT" && fbtProducts.length > 0 && tiers.length === 0;

      return {
        id: r.id,
        title: r.title,
        targetType: r.targetType,
        targetGid: r.targetGid,
        ruleType: isFbt ? "FBT" : "VOLUME",
        mainDiscountPercent,
        tiers,
        fbtProducts,
        active: r.active,
      };
    });

    return new Response(
      JSON.stringify({
        ok: true,
        shop: cleanShop,
        rules: parsedRules,
      }),
      { headers }
    );
  } catch (err: any) {
    console.error("[api.config Error]:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: err.message || "Database query failed",
        rules: [],
      }),
      { headers }
    );
  }
};
