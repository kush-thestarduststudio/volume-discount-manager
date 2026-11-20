import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const rules = await p.bundleRule.findMany();
  console.log("Total rules in local DB:", rules.length);
  for (const r of rules) {
    console.log(JSON.stringify({ id: r.id, shop: r.shop, title: r.title, active: r.active, targetType: r.targetType, targetGid: r.targetGid, tiers: r.tiers, fbtProducts: r.fbtProducts }, null, 2));
  }
}
main().finally(() => p.$disconnect());
