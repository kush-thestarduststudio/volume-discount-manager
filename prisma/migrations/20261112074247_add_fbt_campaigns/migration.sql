-- CreateTable
CREATE TABLE "FrequentlyBoughtTogetherCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "shopifyDiscountId" TEXT,
    "triggerProductIds" TEXT NOT NULL DEFAULT '[]',
    "companionProductIds" TEXT NOT NULL DEFAULT '[]',
    "discountType" TEXT NOT NULL,
    "discountValue" REAL NOT NULL,
    "applyDiscountTo" TEXT NOT NULL DEFAULT 'ALL_BUNDLE_ITEMS',
    "requireAllCompanions" BOOLEAN NOT NULL DEFAULT true,
    "badgeLabel" TEXT,
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
CREATE INDEX "FrequentlyBoughtTogetherCampaign_shop_status_idx" ON "FrequentlyBoughtTogetherCampaign"("shop", "status");
