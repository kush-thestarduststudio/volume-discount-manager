import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const sessions = await prisma.session.findMany();
  console.log('Sessions in local sqlite:', sessions.length);
  for (const s of sessions) {
    console.log({
      id: s.id,
      shop: s.shop,
      isOnline: s.isOnline,
      expires: s.expires,
      hasToken: !!s.accessToken,
      tokenPrefix: s.accessToken?.slice(0, 10)
    });
  }
  const rules = await prisma.bundleRule.findMany();
  console.log('Rules in local sqlite:', rules.length);
  for (const r of rules) {
    console.log({ id: r.id, title: r.title, shop: r.shop });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
