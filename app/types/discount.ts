export type CampaignMode = "VOLUME" | "BUNDLE" | "FBT";

export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

export type TargetScope =
  | "ALL_PRODUCTS"
  | "SPECIFIC_PRODUCTS"
  | "SPECIFIC_COLLECTIONS";

export type QuantityEvaluationMode =
  | "ACROSS_ELIGIBLE_CART"
  | "PER_PRODUCT"
  | "PER_VARIANT";

export type CampaignStatus = "DRAFT" | "ACTIVE";

export type FbtApplyDiscountTo = "ALL_BUNDLE_ITEMS" | "COMPANIONS_ONLY";

export interface DiscountTier {
  id: string;
  minQuantity: number;
  discountValue: number;
  label?: string;
}

export interface BundleConfig {
  requiredProductIds: string[];
  discountType: DiscountType;
  discountValue: number;
}

export interface FbtConfig {
  triggerProductId: string;
  companionProductIds: string[];
  minCompanions: number;
  discountType: DiscountType;
  discountValue: number;
}

export interface ResourceSummary {
  id: string;
  title: string;
  handle?: string;
  imageUrl?: string | null;
}

export interface VolumeDiscountFunctionConfig {
  campaignId: string;
  campaignName: string;
  mode: CampaignMode;
  discountType: DiscountType;
  evaluationMode: QuantityEvaluationMode;
  targetScope: TargetScope;
  productIds: string[];
  collectionIds: string[];
  excludedProductIds: string[];
  tiers: DiscountTier[];
  splitUnqualifiedItems: boolean;
  applyToMultiples: boolean;
  maxDiscountAmount?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  bundleConfig?: BundleConfig;
  fbtConfig?: FbtConfig;
  applyToExactTierQuantity?: boolean;
  kind?: "VOLUME" | "BUNDLE" | "FBT";
}

export interface FbtFunctionConfig {
  kind: "FBT";
  campaignId: string;
  campaignName: string;
  triggerProductIds: string[];
  companionProductIds: string[];
  discountType: DiscountType;
  discountValue: number;
  applyDiscountTo: FbtApplyDiscountTo;
  requireAllCompanions: boolean;
  badgeLabel?: string | null;
  maxDiscountAmount: number | null;
  startsAt: string | null;
  endsAt: string | null;
}

export interface DiscountCampaignDTO {
  id: string;
  shop: string;
  name: string;
  status: CampaignStatus;
  shopifyDiscountId: string | null;
  discountType: DiscountType;
  evaluationMode: QuantityEvaluationMode;
  applyToExactTierQuantity: boolean;
  targetScope: TargetScope;
  productIds: string[];
  collectionIds: string[];
  excludedProductIds: string[];
  tiers: DiscountTier[];
  maxDiscountAmount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  combinesWithOrder: boolean;
  combinesWithProduct: boolean;
  combinesWithShipping: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignFormValues {
  name: string;
  discountType: DiscountType;
  evaluationMode: QuantityEvaluationMode;
  applyToExactTierQuantity: boolean;
  targetScope: TargetScope;
  productIds: string[];
  collectionIds: string[];
  excludedProductIds: string[];
  tiers: DiscountTier[];
  maxDiscountAmount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  combinesWithOrder: boolean;
  combinesWithProduct: boolean;
  combinesWithShipping: boolean;
  priority: number;
}

export interface FbtCampaignDTO {
  id: string;
  shop: string;
  name: string;
  status: CampaignStatus;
  shopifyDiscountId: string | null;
  triggerProductIds: string[];
  companionProductIds: string[];
  discountType: DiscountType;
  discountValue: number;
  applyDiscountTo: FbtApplyDiscountTo;
  requireAllCompanions: boolean;
  badgeLabel: string | null;
  maxDiscountAmount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  combinesWithOrder: boolean;
  combinesWithProduct: boolean;
  combinesWithShipping: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface FbtFormValues {
  name: string;
  triggerProductIds: string[];
  companionProductIds: string[];
  discountType: DiscountType;
  discountValue: number;
  applyDiscountTo: FbtApplyDiscountTo;
  requireAllCompanions: boolean;
  badgeLabel: string | null;
  maxDiscountAmount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  combinesWithOrder: boolean;
  combinesWithProduct: boolean;
  combinesWithShipping: boolean;
  priority: number;
}

export interface StorefrontVariantInfo {
  id: string;
  numericId: string;
  title: string;
  price: number;
  compareAtPrice: number | null;
  availableForSale: boolean;
}

export interface StorefrontProductInfo {
  id: string;
  numericId: string;
  title: string;
  handle: string;
  url: string;
  imageUrl: string | null;
  variants: StorefrontVariantInfo[];
}

export interface StorefrontVolumeOffer {
  id: string;
  name: string;
  discountType: DiscountType;
  evaluationMode: QuantityEvaluationMode;
  applyToExactTierQuantity: boolean;
  tiers: DiscountTier[];
  maxDiscountAmount: number | null;
  startsAt: string | null;
  endsAt: string | null;
}

export interface StorefrontFbtOffer {
  id: string;
  name: string;
  discountType: DiscountType;
  discountValue: number;
  applyDiscountTo: FbtApplyDiscountTo;
  requireAllCompanions: boolean;
  badgeLabel: string | null;
  maxDiscountAmount: number | null;
  triggerProducts: StorefrontProductInfo[];
  companionProducts: StorefrontProductInfo[];
  startsAt: string | null;
  endsAt: string | null;
}

export interface StorefrontOffersResponse {
  volumeDiscounts: StorefrontVolumeOffer[];
  frequentlyBoughtTogether: StorefrontFbtOffer[];
}
