import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const sessions = await prisma.session.findMany();
  console.log('Sessions count:', sessions.length);
  sessions.forEach(s => {
    console.log('Shop:', s.shop, 'AccessToken prefix:', s.accessToken?.slice(0, 10));
  });
}
run().catch(console.error).finally(() => prisma.$disconnect());
