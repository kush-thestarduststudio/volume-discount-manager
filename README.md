# Volume Discount Manager (100% Shopify-Hosted / Zero Hosting Cost)

A production-ready Shopify App for **Volume Discounts ("Buy More, Save More")**, **Product Bundles**, and **Frequently Bought Together (FBT)** built specifically for Shopify Grow and Plus plans with **zero external server requirements and zero hosting costs**.

---

## 🌟 Architecture & Safety Highlights

### 1. 100% Shopify-Hosted (Zero Hosting Cost)
- **Shopify Discount Function (`extensions/volume-discount-function`)**: Runs on Shopify's global WebAssembly infrastructure in <5ms at cart and checkout. No external webhooks or pricing servers needed.
- **Shopify Theme App Extension (`extensions/bundle-fbt-widget`)**: Hosted directly on Shopify's global CDN. Injects Volume Tier tables and Frequently Bought Together widgets into the storefront via Theme Editor App Blocks without modifying theme Liquid template files.
- **Shopify Admin Native Discount Management**: Campaigns are stored as native Shopify `DiscountAutomaticApp` objects with `$app:volume-discount` metafields. Merchants can view, edit schedules, activate, or deactivate campaigns directly in **Shopify Admin → Discounts**, even when the local dev server is offline!

### 2. Exact Cart Line Splitting (Shiprocket Cart Drawer Compatibility)
- Built with exact cart line splitting via `{ cartLine: { id: line.id, quantity: targetQuantity } }` in `productDiscountsAdd`.
- When `splitUnqualifiedItems: true` (default) and a customer adds `3` units of a product eligible for `Buy 2 = 10% OFF`:
  - The function applies the discount **only to `quantity: 2`**.
  - Shopify's cart engine and `/cart.js` automatically split the line item into **two distinct rows**:
    - **Row 1**: `quantity: 2` with the 10% discount applied.
    - **Row 2**: `quantity: 1` at full regular price with no discount.
  - Emits line-level discount allocations (`line_level_discount_allocations`) perfectly formatted for **Shiprocket Cart Drawer** and theme sliding cart drawers.

---

## 📁 Project Structure

```
volume-discount-manager/
├── extensions/
│   ├── volume-discount-function/    # Shopify Discount Function (WebAssembly / Rust/Javy)
│   │   ├── shopify.extension.toml   # Function config (target: cart.lines.discounts.generate.run)
│   │   ├── schema.graphql           # Full 2026-04 Discount Function GraphQL schema
│   │   ├── src/
│   │   │   ├── cart_lines_discounts_generate_run.graphql  # Input query with collectionIds injection
│   │   │   ├── cart_lines_discounts_generate_run.ts       # Unified Volume/Bundle/FBT discount engine
│   │   │   ├── cart_lines_discounts_generate_run.test.ts  # Vitest unit test suite (4 passing tests)
│   │   │   ├── api.ts                                     # Codegen GraphQL types
│   │   │   ├── types.ts                                   # Shared strict TypeScript types
│   │   │   └── index.ts                                   # Function runner entrypoint
│   │   └── dist/
│   │       └── function.wasm        # Compiled WebAssembly binary
│   │
│   ├── bundle-fbt-widget/           # Theme App Extension (Shopify CDN Hosted)
│   │   ├── shopify.extension.toml   # Theme extension definition
│   │   ├── blocks/
│   │   │   ├── volume-tiers-table.liquid         # Volume discount table PDP block
│   │   │   └── frequently-bought-together.liquid # FBT bundle widget PDP block
│   │   └── assets/
│   │       ├── volume-tiers.css / .js            # Quantity syncing & tier highlighting
│   │       └── fbt-widget.css / .js              # Live bundle calculation & /cart/add.js dispatch
│   │
│   └── volume-discount-home/        # Shopify Admin Home UI Extension
│
├── scripts/
│   └── manage-campaigns.ts          # CLI helper for Shopify Admin GraphQL Discounts API
├── app/
│   ├── types/discount.ts            # Strict TypeScript types for campaigns & storefront
│   ├── services/                    # Validation & Shopify Admin discount services
│   └── routes/                      # React Router Polaris management UI
├── shopify.app.toml                 # App configuration & write scopes
└── package.json
```

---

## 🧪 Unit Tests & Function Build

Run the test suite and build the WebAssembly function:

```bash
# Run all unit tests for the discount engine
pnpm --filter volume-discount-function test

# Build the function to WebAssembly (dist/function.wasm)
pnpm shopify app function build --path extensions/volume-discount-function

# Typecheck the entire project
pnpm typecheck
pnpm --filter volume-discount-function exec tsc --noEmit
```

### Verified Test Suite:
1. **Exact Cart Line Splitting (`splitUnqualifiedItems: true`)**:
   - Buy 2 = 10% OFF with cart line quantity = 3.
   - Asserts `{ cartLine: { id: "gid://shopify/CartLine/1", quantity: 2 } }`.
2. **Collection-Scoped Percentage Tiers**:
   - Buy 2 = 5%, Buy 3 = 10%, Buy 5 = 20%.
   - Correctly matches Tier 2 when 4 collection items are in cart.
3. **Product-Scoped Fixed Amount Tiers**:
   - Buy 2 = ₹100 OFF per item on specific product.
4. **Bundle & FBT Discount Triggers**:
   - Duo product bundle triggers discount only on complete sets (`Math.min(qtyA, qtyB)`).
   - Frequently Bought Together pair triggers discount on trigger product + companion product.

---

## 🚀 Testing on `the-stardust-development.myshopify.com`

### Step 1: Start Local App Dev Preview
```bash
shopify app dev
```
- Open the dev preview link in your browser (`admin.shopify.com/store/the-stardust-development/apps/...`).

### Step 2: Seed Sample Campaigns
In a new terminal window:
```bash
node --experimental-strip-types scripts/manage-campaigns.ts seed-samples
```
This generates 2 sample campaigns directly in Shopify Admin as **Draft / Inactive** discounts:
- `Volume Tier: Buy More, Save More (10% - 20% OFF)`
- `VIP Tier: Buy 2 Save ₹100 Each`

### Step 3: View & Activate Campaigns
1. Go to **Shopify Admin → Discounts** (`https://admin.shopify.com/store/the-stardust-development/discounts`).
2. You will see the newly created automatic discounts powered by `volume-discount-function`.
3. Click on any discount to inspect its configuration and click **Activate Discount**.

You can also list or activate them directly from CLI:
```bash
node --experimental-strip-types scripts/manage-campaigns.ts list
node --experimental-strip-types scripts/manage-campaigns.ts activate <discountGid>
```

### Step 4: Add Theme App Blocks in Theme Editor
1. Go to **Shopify Admin → Online Store → Themes → Customize** (for Dawn or your active store theme).
2. Navigate to the **Default Product** template.
3. In the product information section, click **Add Block** and select:
   - **Volume Discount Table** (`bundle-fbt-widget`)
   - **Frequently Bought Together** (`bundle-fbt-widget`)
4. Position them below the variant selector / price and click **Save**.

### Step 5: Test in Storefront & Shiprocket Cart Drawer
1. Open any product on the storefront.
2. Select quantity `3` and click **Add to Cart**.
3. Open the **Shiprocket Cart Drawer**:
   - Notice the line is automatically split into **Row 1 (Qty 2 with discount)** and **Row 2 (Qty 1 at full price)**!
   - Line-level discount allocations are cleanly displayed.

---

## 🚢 Production Deployment (Zero Hosting Cost)

When ready to deploy your extensions permanently to Shopify's CDN and WebAssembly engine:

```bash
shopify app deploy
```

Shopify CLI will:
1. Compile `volume-discount-function` into `function.wasm`.
2. Bundle `bundle-fbt-widget` Theme App Extension.
3. Upload both extensions directly to Shopify's global infrastructure.

Once deployed, **zero external hosting servers or databases are needed** — all campaigns, discount logic, and theme blocks run 100% on Shopify!
