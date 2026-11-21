import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const rules = await prisma.bundleRule.findMany();
  console.log('Local rules count:', rules.length);
  rules.forEach(r => {
    console.log('Rule:', r.id, r.title, 'active:', r.active, 'targetType:', r.targetType, 'shop:', r.shop);
    console.log('  fbtProducts:', r.fbtProducts);
  });
}
run().catch(console.error).finally(() => prisma.$disconnect());
