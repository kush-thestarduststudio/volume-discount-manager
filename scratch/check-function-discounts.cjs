const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const session = await prisma.session.findFirst({
    where: { shop: { contains: 'stardust' } }
  });
  if (!session) {
    console.log('No session found in local db, checking all sessions');
    const all = await prisma.session.findMany();
    console.log('All sessions in local db:', all.map(s => s.shop));
    return;
  }
}
run().catch(console.error);
