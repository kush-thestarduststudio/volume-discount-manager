import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}

let prisma: PrismaClient;

if (process.env.NODE_ENV !== "production") {
  if (
    !global.prismaGlobal ||
    !("frequentlyBoughtTogetherCampaign" in global.prismaGlobal)
  ) {
    global.prismaGlobal = createPrismaClient();
  }
  prisma = global.prismaGlobal;
} else {
  prisma = createPrismaClient();
}

export default prisma;
