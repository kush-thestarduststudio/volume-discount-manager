const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const sessions = await p.session.findMany();
  console.log('Sessions count:', sessions.length);
  sessions.forEach(s => console.log('Session shop:', s.shop, 'token prefix:', s.accessToken?.slice(0, 10)));
  
  const rules = await p.bundleRule.findMany();
  console.log('Rules count:', rules.length);
  rules.forEach(r => console.log('Rule:', r.id, r.title, r.targetType, r.active));
}

main().catch(console.error).finally(() => p.$disconnect());
