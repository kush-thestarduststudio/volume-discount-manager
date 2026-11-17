-- CreateTable
CREATE TABLE "DiscountCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "shopifyDiscountId" TEXT,
    "discountType" TEXT NOT NULL,
    "evaluationMode" TEXT NOT NULL DEFAULT 'ACROSS_ELIGIBLE_CART',
    "targetScope" TEXT NOT NULL,
    "productIds" TEXT NOT NULL DEFAULT '[]',
    "collectionIds" TEXT NOT NULL DEFAULT '[]',
    "excludedProductIds" TEXT NOT NULL DEFAULT '[]',
    "tiers" TEXT NOT NULL,
    "maxDiscountAmount" REAL,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "combinesWithOrder" BOOLEAN NOT NULL DEFAULT false,
    "combinesWithProduct" BOOLEAN NOT NULL DEFAULT false,
    "combinesWithShipping" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "DiscountCampaign_shop_status_idx" ON "DiscountCampaign"("shop", "status");
