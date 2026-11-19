"use strict";
(()=>{
  if (window.__btEngineLoaded) return;
  window.__btEngineLoaded = true;

  const API_URL = "//volume-discount-manager.onrender.com/api/config";
  const ROOT = window.Shopify?.routes?.root || "/";

  const fmt = (c) => "₹" + ((Number(c) || 0) / 100).toFixed(0);
  const fmtPrice = (c) => {
    const v = Number(c) / 100;
    return v % 1 === 0 ? "₹" + v.toFixed(0) : "₹" + v.toFixed(2);
  };
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  // Access all DOM roots including Shiprocket Smart Cart Shadow DOM
  function getRoots() {
    const roots = [document];
    try {
      const srHost = document.querySelector('[data-app="shiprocket-smart-cart"], #shiprocket-smart-cart, shiprocket-smart-cart');
      if (srHost?.shadowRoot && !roots.includes(srHost.shadowRoot)) {
        roots.push(srHost.shadowRoot);
      }
      document.querySelectorAll("*").forEach((el) => {
        if (el.shadowRoot && !roots.includes(el.shadowRoot)) {
          roots.push(el.shadowRoot);
        }
      });
    } catch {}
    return roots;
  }

  // Open Shiprocket Smart Cart Drawer
  function openShiprocketDrawer() {
    try {
      window.updateMiniCartSection?.();
    } catch {}
    try {
      if (typeof window.slideShiprocketSmartCartInFrame === "function") {
        window.slideShiprocketSmartCartInFrame();
      }
    } catch {}
    try {
      if (typeof window.srShowMiniCartDrawer === "function") {
        window.srShowMiniCartDrawer();
      }
    } catch {}
    try {
      const cartBtn = document.querySelector('a[href="/cart"], .header__icon--cart, .cart-icon, #cart-icon-bubble, [data-open-cart]');
      cartBtn?.click?.();
    } catch {}
    try {
      const srContainer = document.getElementById("shiprocket-mini-cart-container");
      if (srContainer) {
        srContainer.style.display = "block";
        document.body.classList.add("srsc-overflow-hidden");
      }
      const backdrop = document.querySelector(".sr-backdrop, #shiprocket-mini-cart-backdrop");
      if (backdrop) backdrop.style.display = "block";
    } catch {}
    try {
      document.querySelector("cart-drawer")?.open?.();
    } catch {}
  }

  function triggerRefresh() {
    ["cart:refresh", "cart:updated", "shopify:cart:refresh"].forEach((n) => {
      const e = new CustomEvent(n, { bubbles: true });
      window.dispatchEvent(e);
      document.dispatchEvent(e);
    });
    try {
      window.updateMiniCartSection?.();
      window.Shiprocket?.refreshCart?.();
      window.Fastrr?.refresh?.();
      window.Fastrr?.cart?.refresh?.();
    } catch {}
  }

  function syncQty(qty) {
    const inp = ($('form[action*="/cart/add"]') || $(".product-form") || $("product-form"))?.querySelector('input[name="quantity"]');
    inp && (inp.value = String(qty), inp.dispatchEvent(new Event("change", { bubbles: true })));
  }

  // Storefront API Cart Discount Mutation (Selleasy Method)
  // Preserves ALL existing customer discount codes (e.g. LOYAL) and merges with bundle discount!
  let lastMutatedCodeKey = null;
  async function mutateCartDiscountCodes(cart, codes) {
    const token = window.lbupsellToken || "c08d56cae211c47c68cb3cd03b882be8";
    if (!token || !cart?.token) return;

    // Collect ALL existing discount codes present in the cart
    const existingCodes = [];
    if (Array.isArray(cart.discount_codes)) {
      cart.discount_codes.forEach((d) => {
        const c = d?.code || (typeof d === "string" ? d : "");
        if (c) existingCodes.push(c);
      });
    }
    if (Array.isArray(cart.cart_level_discount_applications)) {
      cart.cart_level_discount_applications.forEach((a) => {
        const t = a?.title;
        if (t && !t.startsWith("[Volume") && !t.startsWith("[Bundle") && !t.includes("FREEGIFT")) {
          existingCodes.push(t);
        }
      });
    }

    const merged = Array.from(new Set([...existingCodes, ...(codes || [])])).filter(Boolean);
    const codeKey = merged.slice().sort().join(",");
    if (codeKey === lastMutatedCodeKey) return;

    const cartId = `gid://shopify/Cart/${cart.token}`;
    const query = `
      mutation cartDiscountCodesUpdate($id: ID!, $discountCodes: [String!]!) {
        cartDiscountCodesUpdate(cartId: $id, discountCodes: $discountCodes) {
          cart {
            id
            discountCodes {
              code
              applicable
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    try {
      const res = await fetch(`https://${window.location.hostname}/api/2024-04/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": token,
        },
        body: JSON.stringify({
          query,
          variables: {
            id: cartId,
            discountCodes: merged,
          },
        }),
      });
      const data = await res.json();
      lastMutatedCodeKey = codeKey;
      return data;
    } catch {}
  }

  // 1. ESTIMATED TOTAL STRIKETHROUGH & FINAL PRICE IN SHIPROCKET SHADOW DOM
  let activeFinalCents = 0;
  let activeOrigCents = 0;
  let totalTimer = null;
  const observedRoots = new Set();

  function updateEstimatedTotal(finalCents, origCents) {
    if (!finalCents || !origCents || finalCents >= origCents) return;
    const finalStr = fmtPrice(finalCents);
    const origStr = fmtPrice(origCents);

    const roots = getRoots();
    roots.forEach((root) => {
      // 1. Direct update to Shiprocket Smart Cart designated elements inside this root
      const totalEls = Array.from(root.querySelectorAll(".total-price, [class*='total-price']"));
      const origEls = Array.from(root.querySelectorAll(".summary-original-price, [class*='summary-original-price']"));
      const subTotalEls = Array.from(root.querySelectorAll(".sr-sub-total"));

      totalEls.forEach((el) => {
        if (el.textContent !== finalStr) {
          el.textContent = finalStr;
        }
      });

      origEls.forEach((el) => {
        if (el.textContent !== origStr) {
          el.textContent = origStr;
        }
        if (el.style.display !== "inline-block") el.style.display = "inline-block";
        if (el.style.textDecoration !== "line-through") el.style.textDecoration = "line-through";
        if (el.style.marginRight !== "6px") el.style.marginRight = "6px";
        if (el.style.color !== "#9ca3af") el.style.color = "#9ca3af";
      });

      subTotalEls.forEach((el) => {
        if (el.textContent !== finalStr) {
          el.textContent = finalStr;
        }
      });

      // 2. Generic fallback: check any label with "Estimated Total" inside this root
      Array.from(root.querySelectorAll("*")).forEach((lbl) => {
        if (lbl.children.length <= 1 && /estimated total/i.test(lbl.textContent || "")) {
          const container = lbl.closest(".sr-smart-cart-total, [class*='total'], [class*='buy-section']") || lbl.parentElement;
          if (container) {
            const priceEls = Array.from(container.querySelectorAll("*")).filter(
              (p) => !p.children.length && /^₹\s*[\d,]+(\.\d+)?$/.test((p.textContent || "").trim())
            );
            if (priceEls.length === 1 && !priceEls[0].textContent.includes(finalStr)) {
              priceEls[0].innerHTML = `<s style="color:#9ca3af;font-size:12px;margin-right:6px;text-decoration:line-through;font-weight:400;">${origStr}</s><span>${finalStr}</span>`;
            } else if (priceEls.length >= 2) {
              if (priceEls[0].textContent !== origStr) priceEls[0].textContent = origStr;
              if (priceEls[0].style.display !== "inline-block") priceEls[0].style.display = "inline-block";
              if (priceEls[priceEls.length - 1].textContent !== finalStr) priceEls[priceEls.length - 1].textContent = finalStr;
            }
          }
        }
      });
    });
  }

  let obsTimer = null;
  const observer = new MutationObserver(() => {
    attachObservers();
    if (!activeFinalCents || obsTimer) return;
    obsTimer = setTimeout(() => {
      obsTimer = null;
      if (activeFinalCents && activeOrigCents && activeFinalCents < activeOrigCents) {
        updateEstimatedTotal(activeFinalCents, activeOrigCents);
      }
    }, 60);
  });

  function attachObservers() {
    hookShiprocketBuyCart();
    hookFastrr();
    getRoots().forEach((r) => {
      if (!observedRoots.has(r)) {
        observedRoots.add(r);
        try {
          observer.observe(r, { childList: true, subtree: true, characterData: true });
        } catch {}
        try {
          r.addEventListener("click", () => {
            setTimeout(syncCartDiscount, 300);
            setTimeout(syncCartDiscount, 700);
          }, true);
          r.addEventListener("change", (e) => {
            if (e.target?.matches?.("input[type='number'], input[name='quantity'], [class*='qty']")) {
              setTimeout(syncCartDiscount, 300);
            }
          }, true);
        } catch {}
      }
    });
  }

  function setDrawerEstimatedTotal(finalCents, origCents) {
    activeFinalCents = finalCents;
    activeOrigCents = origCents;
    if (!finalCents || !origCents || finalCents >= origCents) return;

    attachObservers();
    updateEstimatedTotal(finalCents, origCents);

    if (totalTimer) clearInterval(totalTimer);
    totalTimer = setInterval(() => {
      attachObservers();
      if (activeFinalCents && activeOrigCents && activeFinalCents < activeOrigCents) {
        updateEstimatedTotal(activeFinalCents, activeOrigCents);
      }
    }, 250);
  }

  function clearDrawerEstimatedTotal() {
    activeFinalCents = 0;
    activeOrigCents = 0;
    if (totalTimer) clearInterval(totalTimer);
    getRoots().forEach((root) => {
      Array.from(root.querySelectorAll(".summary-original-price")).forEach((el) => {
        el.style.display = "none";
      });
    });
  }

  // 2. VOLUME WIDGET INITIALIZATION
  function initVolume(wrap) {
    if (!wrap || wrap.dataset.btInit) return;
    wrap.dataset.btInit = "1";

    const cards = $$(".bt-tier-card", wrap);
    const btn = $(".bt-add-btn", wrap);
    const summary = $(".bt-savings-summary", wrap);

    let sel = cards.length ? {
      qty: parseInt(cards[0].dataset.minQty, 10) || 1,
      type: cards[0].dataset.discountType || "PERCENTAGE",
      val: parseFloat(cards[0].dataset.discountValue || cards[0].dataset.discount || "0") || 0,
      code: cards[0].dataset.code || "",
    } : null;

    function render() {
      if (!sel) return;
      syncQty(sel.qty);
      const isFixed = sel.type === "FIXED_AMOUNT";
      const off = sel.val ? (isFixed ? ` (₹${sel.val} OFF)` : ` (${sel.val}% OFF)`) : "";
      btn && (btn.textContent = `Add ${sel.qty} to Cart` + off);
      summary && (summary.textContent = sel.val ? `Save ${isFixed ? `₹${sel.val}` : `${sel.val}%`} with this offer!` : "");
    }

    cards.forEach((card) => {
      card.addEventListener("click", () => {
        cards.forEach((c) => c.classList.remove("is-selected"));
        const radio = $(".bt-tier-radio", card);
        if (radio) radio.checked = true;
        card.classList.add("is-selected");
        sel = {
          qty: parseInt(card.dataset.minQty, 10) || 1,
          type: card.dataset.discountType || "PERCENTAGE",
          val: parseFloat(card.dataset.discountValue || card.dataset.discount || "0") || 0,
          code: card.dataset.code || "",
        };
        render();
      });
    });

    if (btn) {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        if (btn.disabled) return;
        const vId = wrap.dataset.variantId || $('[name="id"]')?.value;
        if (!vId) return alert("Please select a variant.");
        const id = parseInt(String(vId).replace(/\D/g, ""), 10);
        const qty = sel ? sel.qty : 1;

        btn.disabled = true;
        btn.textContent = "Adding...";
        try {
          const basePrice = parseInt(wrap.dataset.basePrice || "0", 10) || 40000;
          let props = {};
          if (sel && sel.val > 0) {
            const isFixed = sel.type === "FIXED_AMOUNT";
            const origUnit = basePrice / 100;
            const discountedUnit = isFixed
              ? Math.max(0, origUnit - (sel.val / qty))
              : Math.max(0, origUnit * (1 - sel.val / 100));
            const roundUnit = Number(discountedUnit.toFixed(2));
            props = {
              _isYtBundle: "true",
              _bundleItems: JSON.stringify([{ variantId: id, quantity: qty, price: roundUnit }])
            };
          }

          const res = await fetch(ROOT + "cart/add.js", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: [{ id, quantity: qty, properties: props }] }),
          });
          if (!res.ok) throw new Error();

          btn.textContent = "✓ Added!";
          triggerRefresh();
          openShiprocketDrawer();
          setTimeout(openShiprocketDrawer, 200);
          setTimeout(openShiprocketDrawer, 500);
          setTimeout(syncCartDiscount, 350);
          setTimeout(() => { btn.disabled = false; render(); }, 1500);
        } catch {
          btn.disabled = false;
          render();
        }
      });
    }

    render();
  }

  // 3. FBT WIDGET INITIALIZATION
  function initFbt(wrap) {
    if (!wrap || wrap.dataset.btInit) return;
    wrap.dataset.btInit = "1";

    const basePrice = parseInt(wrap.dataset.basePrice || "0", 10);
    const baseDisc = parseInt(wrap.dataset.baseDiscount || "0", 10);
    const discType = wrap.dataset.discountType || "PERCENTAGE";
    const discVal = parseFloat(wrap.dataset.discountValue || "0") || (discType === "PERCENTAGE" ? (baseDisc || 10) : 100);
    const isFixed = discType === "FIXED_AMOUNT";

    const cbs = $$(".bt-fbt-companion-checkbox", wrap);
    const btn = $(".bt-fbt-add-btn", wrap);
    const priceEl = $(".bt-fbt-bundle-price", wrap);
    const compareEl = $(".bt-fbt-bundle-compare", wrap);
    const noteEl = $(".bt-fbt-savings-note", wrap);
    const thumbs = $$(".bt-fbt-thumb-card", wrap);

    function calc() {
      let orig = basePrice;
      let total = (!isFixed && baseDisc > 0) ? Math.round(basePrice * (100 - baseDisc) / 100) : basePrice;
      let count = 1;

      cbs.forEach((cb) => {
        const pId = cb.dataset.productId;
        const thumb = thumbs.find((t) => t.dataset.fbtCardId === pId);
        if (cb.checked) {
          count++;
          const p = parseInt(cb.dataset.price || "0", 10);
          const d = parseInt(cb.dataset.discount || "0", 10);
          orig += p;
          total += isFixed ? p : Math.round(p * (100 - (d || discVal)) / 100);
          if (thumb) thumb.style.opacity = "1";
        } else if (thumb) {
          thumb.style.opacity = "0.35";
        }
      });

      if (isFixed && discVal > 0 && count > 1) {
        total = Math.max(0, orig - Math.round(discVal * 100));
      } else if (isFixed) {
        total = orig;
      }

      const save = orig - total;
      priceEl && (priceEl.textContent = fmt(total));
      compareEl && (compareEl.textContent = save > 0 ? fmt(orig) : "");
      noteEl && (noteEl.textContent = save > 0 ? `Save ${fmt(save)} with this bundle!` : "");
      btn && (btn.textContent = `Add ${count} Items To Cart`);
    }

    cbs.forEach((cb) => cb.addEventListener("change", calc));

    if (btn) {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        if (btn.disabled) return;
        const baseVId = wrap.dataset.baseVariantId || $('[name="id"]')?.value;
        if (!baseVId) return alert("Please select a variant.");

        const companionCbs = cbs.filter((cb) => cb.checked && cb.dataset.variantId);
        const allItemsCount = 1 + companionCbs.length;

        const baseUnit = basePrice / 100;
        const mainUnit = isFixed
          ? Math.max(0, baseUnit - (discVal / allItemsCount))
          : Math.max(0, baseUnit * (1 - (baseDisc || discVal) / 100));
        const roundMainUnit = Number(mainUnit.toFixed(2));

        const baseId = parseInt(String(baseVId).replace(/\D/g, ""), 10);
        const items = [{
          id: baseId,
          quantity: 1,
          properties: {
            _isYtBundle: "true",
            _bundleItems: JSON.stringify([{ variantId: baseId, quantity: 1, price: roundMainUnit }])
          }
        }];

        companionCbs.forEach((cb) => {
          const cId = parseInt(String(cb.dataset.variantId).replace(/\D/g, ""), 10);
          const cPrice = (parseInt(cb.dataset.price || "0", 10) || 0) / 100;
          const cDisc = parseInt(cb.dataset.discount || "0", 10) || discVal;
          const cUnit = isFixed
            ? Math.max(0, cPrice - (discVal / allItemsCount))
            : Math.max(0, cPrice * (1 - cDisc / 100));
          const roundCUnit = Number(cUnit.toFixed(2));
          items.push({
            id: cId,
            quantity: 1,
            properties: {
              _isYtBundle: "true",
              _bundleItems: JSON.stringify([{ variantId: cId, quantity: 1, price: roundCUnit }])
            }
          });
        });

        btn.disabled = true;
        btn.textContent = "Adding Bundle...";
        try {
          const res = await fetch(ROOT + "cart/add.js", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items }),
          });
          if (!res.ok) throw new Error();

          btn.textContent = "✓ Added Bundle!";
          triggerRefresh();
          openShiprocketDrawer();
          setTimeout(openShiprocketDrawer, 200);
          setTimeout(openShiprocketDrawer, 500);
          setTimeout(syncCartDiscount, 350);
          setTimeout(() => { btn.disabled = false; calc(); }, 1500);
        } catch {
          btn.disabled = false;
          calc();
        }
      });
    }

    calc();
  }

  // 4. FETCH CONFIG & RULES WITH SYNCHRONOUS CACHING
  let configCache = null;
  let syncRulesCache = (() => {
    try {
      if (Array.isArray(window.__btRules) && window.__btRules.length > 0) {
        return window.__btRules;
      }
      const raw = localStorage.getItem("__btRules") || localStorage.getItem("bt_rules_cache");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  })();

  function getRulesSync() {
    if (Array.isArray(window.__btRules) && window.__btRules.length > 0) return window.__btRules;
    if (Array.isArray(configCache?.rules) && configCache.rules.length > 0) return configCache.rules;
    if (Array.isArray(syncRulesCache) && syncRulesCache.length > 0) return syncRulesCache;
    return [];
  }

  async function getConfig() {
    if (configCache) return configCache;
    try {
      const shop = window.Shopify?.shop || window.location.hostname;
      const res = await (await fetch(`${API_URL}?shop=${encodeURIComponent(shop)}`)).json();
      if (res?.ok) {
        configCache = res;
        if (Array.isArray(res.rules)) {
          syncRulesCache = res.rules;
          window.__btRules = res.rules;
          try {
            localStorage.setItem("bt_rules_cache", JSON.stringify(res.rules));
            localStorage.setItem("__btRules", JSON.stringify(res.rules));
          } catch {}
        }
        return res;
      }
    } catch {}
    return { rules: getRulesSync(), settings: window.__btSettings || {} };
  }

  async function getRules() {
    const cfg = await getConfig();
    return Array.isArray(cfg?.rules) && cfg.rules.length > 0 ? cfg.rules : getRulesSync();
  }

  // 5. FIND APPLICABLE DISCOUNT (MAX SAVINGS CONFLICT RESOLUTION)
  const cleanCode = (t) =>
    (t || "")
      .replace(/^(bundle(\s+for)?[:\s]*|volume(\s+tier)?[:\s]*|collection(\s+tier)?[:\s]*)/i, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 8) || "OFFER";

  function getActiveDiscount(cart, rules) {
    if (!cart?.items?.length || !rules?.length) return { disc: 0, code: null };
    const candidates = [];

    for (const r of rules) {
      if (!r.active) continue;
      const tId = String(r.targetGid || "").replace(/\D/g, "");

      if (r.ruleType === "VOLUME" && r.tiers?.length) {
        const items = cart.items.filter((it) =>
          r.targetType === "PRODUCT"
            ? String(it.product_id) === tId
            : (r.collectionProductIds || []).map(String).includes(String(it.product_id))
        );
        const qty = items.reduce((s, it) => s + it.quantity, 0);
        const t = [...r.tiers].sort((a, b) => b.minQuantity - a.minQuantity).find((x) => qty >= x.minQuantity);
        if (t) {
          const sub = items.reduce((s, it) => s + (it.original_line_price || it.price * it.quantity), 0);
          const isFixed = t.discountType === "FIXED_AMOUNT";
          const val = Number(isFixed ? t.discountValue : (t.discountPercent || t.discountValue || 0));
          const disc = isFixed ? Math.round(val * 100) : Math.round(sub * (val / 100));
          const code = t.code || `${cleanCode(r.title)}-BUY${t.minQuantity}-${val}OFF`;
          candidates.push({ disc, code, type: "VOLUME" });
        }
      } else if (r.ruleType === "FBT" && r.fbtProducts?.length) {
        const cIds = r.fbtProducts.map((p) => String(p.productId || "").replace(/\D/g, ""));
        const targetItem = cart.items.find((it) => String(it.product_id) === tId);
        const hasAllCompanions = cIds.every((id) => cart.items.some((it) => String(it.product_id) === id));

        if (targetItem && hasAllCompanions) {
          const companionItems = cIds.map((id) => cart.items.find((it) => String(it.product_id) === id));
          const bundleCount = Math.min(targetItem.quantity, ...companionItems.map((it) => it?.quantity || 1));
          const isFixed = r.discountType === "FIXED_AMOUNT";
          const val = Number(isFixed ? r.discountValue : (r.mainDiscountPercent || r.discountValue || r.fbtProducts[0]?.discountPercent || 10));
          let disc = 0;

          if (isFixed) {
            disc = Math.round(bundleCount * val * 100);
          } else {
            const bp = Number(r.mainDiscountPercent || val || 0);
            const targetUnit = Math.round((targetItem.original_line_price || targetItem.price * targetItem.quantity) / targetItem.quantity);
            if (bp > 0) disc += Math.round(targetUnit * bundleCount * (bp / 100));

            companionItems.forEach((it, idx) => {
              if (!it) return;
              const cp = Number(r.fbtProducts[idx]?.discountPercent || bp || 10);
              const unit = Math.round((it.original_line_price || it.price * it.quantity) / it.quantity);
              disc += Math.round(unit * bundleCount * (cp / 100));
            });
          }
          const code = r.discountCode || `BUNDLE-${cleanCode(r.title)}-${val}OFF`;
          candidates.push({ disc, code, type: "FBT" });
        }
      }
    }

    if (!candidates.length) return { disc: 0, code: null };

    // Max Savings Rule: Highest discount wins!
    candidates.sort((a, b) => b.disc - a.disc);
    return { disc: candidates[0].disc, code: candidates[0].code };
  }

  // IN-MEMORY CART TRANSFORMATION
  // Injects _isYtBundle & _bundleItems with discounted price directly into cart.items
  // so Fastrr's z(e, t) maps `price: discountedUnit` instantly with 0ms race condition!
  function transformCartResponse(cart) {
    if (!cart || !Array.isArray(cart.items)) return cart;
    const rules = getRulesSync();
    if (!rules.length) return cart;

    const vRules = rules.filter(r => r.active && r.ruleType === "VOLUME" && r.tiers?.length);
    const fRules = rules.filter(r => r.active && r.ruleType === "FBT" && r.fbtProducts?.length);

    let totalLineDiscount = 0;

    for (const item of cart.items) {
      const pId = String(item.product_id);
      const vId = item.variant_id;
      const qty = item.quantity;
      const origUnit = (item.original_price || item.price) / 100;
      let bestUnit = origUnit;

      // 1. Volume Rules
      for (const vr of vRules) {
        const tId = String(vr.targetGid || "").replace(/\D/g, "");
        const isMatch = vr.targetType === "PRODUCT"
          ? pId === tId
          : (vr.collectionProductIds || []).map(String).includes(pId);

        if (isMatch) {
          const matchingItems = cart.items.filter(it =>
            vr.targetType === "PRODUCT"
              ? String(it.product_id) === tId
              : (vr.collectionProductIds || []).map(String).includes(String(it.product_id))
          );
          const totalQty = matchingItems.reduce((s, it) => s + it.quantity, 0);
          const tier = [...vr.tiers].sort((a, b) => b.minQuantity - a.minQuantity).find(x => totalQty >= x.minQuantity);
          if (tier) {
            const isFixed = tier.discountType === "FIXED_AMOUNT";
            const val = Number(isFixed ? tier.discountValue : (tier.discountPercent || tier.discountValue || 0));
            if (val > 0) {
              const discUnit = isFixed
                ? Math.max(0, origUnit - (val / totalQty))
                : Math.max(0, origUnit * (1 - val / 100));
              if (discUnit < bestUnit) {
                bestUnit = discUnit;
              }
            }
          }
        }
      }

      // 2. FBT Rules
      for (const fr of fRules) {
        const tId = String(fr.targetGid || "").replace(/\D/g, "");
        const cIds = fr.fbtProducts.map(p => String(p.productId || "").replace(/\D/g, ""));
        const targetItem = cart.items.find(it => String(it.product_id) === tId);
        const hasAll = targetItem && cIds.every(id => cart.items.some(it => String(it.product_id) === id));

        if (hasAll && (pId === tId || cIds.includes(pId))) {
          const isFixed = fr.discountType === "FIXED_AMOUNT";
          const val = Number(isFixed ? fr.discountValue : (fr.mainDiscountPercent || fr.discountValue || 10));
          if (val > 0) {
            let fbtUnit = origUnit;
            if (isFixed) {
              const totalBundleItems = 1 + cIds.length;
              fbtUnit = Math.max(0, origUnit - (val / totalBundleItems));
            } else {
              let pct = val;
              if (pId === tId) {
                pct = Number(fr.mainDiscountPercent || val);
              } else {
                const cp = fr.fbtProducts.find(p => String(p.productId || "").replace(/\D/g, "") === pId);
                pct = Number(cp?.discountPercent || val);
              }
              fbtUnit = Math.max(0, origUnit * (1 - pct / 100));
            }
            if (fbtUnit < bestUnit) {
              bestUnit = fbtUnit;
            }
          }
        }
      }

      item.properties = item.properties || {};

      if (bestUnit < origUnit) {
        const roundUnit = Number(bestUnit.toFixed(2));
        item.properties._isYtBundle = "true";
        item.properties._bundleItems = JSON.stringify([{
          variantId: vId,
          quantity: qty,
          price: roundUnit
        }]);
        item.final_price = Math.round(roundUnit * 100);
        item.final_line_price = item.final_price * qty;
        item.discounted_price = item.final_price;
        totalLineDiscount += (origUnit - roundUnit) * qty * 100;
      } else if (item.properties._isYtBundle === "true") {
        delete item.properties._isYtBundle;
        delete item.properties._bundleItems;
        item.final_price = item.original_price || item.price;
        item.final_line_price = item.original_line_price || (item.price * qty);
      }
    }

    if (totalLineDiscount > 0) {
      const origTotal = cart.original_total_price || cart.items.reduce((s, it) => s + (it.original_line_price || it.price * it.quantity), 0);
      cart.total_price = Math.max(0, origTotal - Math.round(totalLineDiscount));
      cart.total_discount = Math.round(totalLineDiscount);
    }
    return cart;
  }

  // 6. SYNC FASTRR BUNDLE PROPERTIES & CART DISCOUNT (CLUB WITH COUPONS & FREEBIES)
  function hookShiprocketBuyCart() {
    if (typeof window.shiprocketCheckoutBuyCartHandler === "function" && !window.shiprocketCheckoutBuyCartHandler._btHooked) {
      const origHandler = window.shiprocketCheckoutBuyCartHandler;
      const wrapped = async function(...args) {
        try {
          await syncCartDiscount();
        } catch {}
        return origHandler.apply(this, args);
      };
      wrapped._btHooked = true;
      window.shiprocketCheckoutBuyCartHandler = wrapped;
    }
  }

  function hookFastrr() {
    if (window.Fastrr && !window.Fastrr._btHooked) {
      window.Fastrr._btHooked = true;
      ["openCheckout", "buyCart", "checkout"].forEach((fn) => {
        if (typeof window.Fastrr[fn] === "function") {
          const orig = window.Fastrr[fn];
          window.Fastrr[fn] = async function(...args) {
            try { await syncCartDiscount(); } catch {}
            return orig.apply(this, args);
          };
        }
      });
    }
  }

  let isFastrrSyncing = false;
  async function syncFastrrProperties(cart, rules) {
    if (isFastrrSyncing || !cart?.items?.length) return false;
    isFastrrSyncing = true;
    try {
      const vRules = (rules || []).filter((r) => r.active && r.ruleType === "VOLUME" && r.tiers?.length);
      const fRules = (rules || []).filter((r) => r.active && r.ruleType === "FBT" && r.fbtProducts?.length);

      const changes = [];

      for (const item of cart.items) {
        const pId = String(item.product_id);
        const vId = item.variant_id;
        const qty = item.quantity;
        const origUnit = (item.original_price || item.price) / 100;
        let bestDiscUnit = origUnit;

        // 1. Shopify native discount already present in cart
        if (item.final_price && item.final_price < (item.original_price || item.price)) {
          bestDiscUnit = item.final_price / 100;
        }

        // 2. Volume Discount Rules
        for (const vr of vRules) {
          const tId = String(vr.targetGid || "").replace(/\D/g, "");
          const isMatch = vr.targetType === "PRODUCT"
            ? pId === tId
            : (vr.collectionProductIds || []).map(String).includes(pId);

          if (isMatch) {
            const matchingItems = cart.items.filter((it) =>
              vr.targetType === "PRODUCT"
                ? String(it.product_id) === tId
                : (vr.collectionProductIds || []).map(String).includes(String(it.product_id))
            );
            const totalQty = matchingItems.reduce((s, it) => s + it.quantity, 0);
            const tier = [...vr.tiers].sort((a, b) => b.minQuantity - a.minQuantity).find((x) => totalQty >= x.minQuantity);
            if (tier) {
              const isFixed = tier.discountType === "FIXED_AMOUNT";
              const val = Number(isFixed ? tier.discountValue : (tier.discountPercent || tier.discountValue || 0));
              if (val > 0) {
                const discUnit = isFixed
                  ? Math.max(0, origUnit - (val / totalQty))
                  : Math.max(0, origUnit * (1 - val / 100));
                if (discUnit < bestDiscUnit) {
                  bestDiscUnit = discUnit;
                }
              }
            }
          }
        }

        // 3. FBT Discount Rules
        for (const fr of fRules) {
          const tId = String(fr.targetGid || "").replace(/\D/g, "");
          const cIds = fr.fbtProducts.map((p) => String(p.productId || "").replace(/\D/g, ""));
          const targetItem = cart.items.find((it) => String(it.product_id) === tId);
          const hasAll = targetItem && cIds.every((id) => cart.items.some((it) => String(it.product_id) === id));

          if (hasAll && (pId === tId || cIds.includes(pId))) {
            const isFixed = fr.discountType === "FIXED_AMOUNT";
            const val = Number(isFixed ? fr.discountValue : (fr.mainDiscountPercent || fr.discountValue || 10));
            if (val > 0) {
              let fbtUnit = origUnit;
              if (isFixed) {
                const totalBundleItems = 1 + cIds.length;
                fbtUnit = Math.max(0, origUnit - (val / totalBundleItems));
              } else {
                let pct = val;
                if (pId === tId) {
                  pct = Number(fr.mainDiscountPercent || val);
                } else {
                  const cp = fr.fbtProducts.find((p) => String(p.productId || "").replace(/\D/g, "") === pId);
                  pct = Number(cp?.discountPercent || val);
                }
                fbtUnit = Math.max(0, origUnit * (1 - pct / 100));
              }
              if (fbtUnit < bestDiscUnit) {
                bestDiscUnit = fbtUnit;
              }
            }
          }
        }

        const currentProps = item.properties || {};
        const hasYt = currentProps._isYtBundle === "true";
        let currentPrice = null;
        let currentQty = null;
        try {
          const parsed = JSON.parse(currentProps._bundleItems || "[]");
          if (parsed.length) {
            currentPrice = Number(parsed[0].price);
            currentQty = Number(parsed[0].quantity);
          }
        } catch {}

        if (bestDiscUnit < origUnit) {
          const targetPrice = Number(bestDiscUnit.toFixed(2));
          // If properties are missing, price changed, or quantity changed
          if (!hasYt || currentPrice !== targetPrice || currentQty !== qty) {
            changes.push({
              id: item.key,
              quantity: qty,
              properties: {
                ...currentProps,
                _isYtBundle: "true",
                _bundleItems: JSON.stringify([{ variantId: vId, quantity: qty, price: targetPrice }])
              }
            });
          }
        } else if (hasYt) {
          // No discount applies anymore, strip _isYtBundle & _bundleItems
          const cleanProps = { ...currentProps };
          delete cleanProps._isYtBundle;
          delete cleanProps._bundleItems;
          changes.push({
            id: item.key,
            quantity: qty,
            properties: cleanProps
          });
        }
      }

      if (changes.length > 0) {
        for (const ch of changes) {
          await fetch(ROOT + "cart/change.js?_bt=prop_sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ch)
          });
        }
        triggerRefresh();
        return true;
      }
    } catch {} finally {
      isFastrrSyncing = false;
    }
    return false;
  }

  let syncLock = false;
  async function syncCartDiscount() {
    if (syncLock) return;
    syncLock = true;
    try {
      hookShiprocketBuyCart();
      hookFastrr();

      const res = await fetch(ROOT + "cart.js?_bt=" + Date.now());
      if (!res.ok) return;
      let cart = await res.json();

      if (!cart?.items?.length) {
        clearDrawerEstimatedTotal();
        return;
      }

      const rules = await getRules();
      const propsChanged = await syncFastrrProperties(cart, rules);
      if (propsChanged) {
        const uRes = await fetch(ROOT + "cart.js?_bt=" + Date.now());
        if (uRes.ok) cart = await uRes.json();
      }

      let origTotal = cart.original_total_price || cart.total_price;
      let finalTotal = cart.total_price;
      let lineFinal = 0, lineOrig = 0;

      cart.items.forEach((item) => {
        const o = item.original_line_price ?? (item.original_price * item.quantity);
        const f = item.final_line_price ?? (item.final_price ? item.final_price * item.quantity : o);
        lineOrig += o;
        lineFinal += f;
      });

      if (lineOrig > origTotal) origTotal = lineOrig;
      if (lineFinal < finalTotal && lineFinal > 0) finalTotal = lineFinal;

      // Check if rules calculate additional/active savings
      const { disc, code } = getActiveDiscount(cart, rules);

      if (disc > 0) {
        const ruleFinal = Math.max(0, origTotal - disc);
        if (ruleFinal < finalTotal) finalTotal = ruleFinal;
      }

      // Check for Manual Coupons (e.g. LOYAL) from Shopify cart-level discount applications
      let manualCouponAmount = 0;
      if (Array.isArray(cart.cart_level_discount_applications) && cart.cart_level_discount_applications.length > 0) {
        cart.cart_level_discount_applications.forEach((app) => {
          const title = (app.title || "").toUpperCase();
          if (!title.startsWith("FREEGIFT")) {
            const amt = Number(app.total_allocated_amount || 0);
            if (amt > 0) manualCouponAmount += amt;
          }
        });
      }

      // Check for Manual Coupons applied in Shiprocket drawer UI (e.g. "₹40.00 saved with LOYAL")
      getRoots().forEach((root) => {
        // 1. Text search for "saved with" (e.g. "% ₹40.00 saved with LOYAL   Remove")
        const allTextNodes = Array.from(root.querySelectorAll("*")).filter(
          (el) => el.children.length === 0 && (el.textContent || "").includes("saved with")
        );
        allTextNodes.forEach((el) => {
          const txt = (el.textContent || "").trim();
          const m = txt.match(/₹?\s*([\d,]+(\.\d+)?)\s*saved with/i);
          if (m && m[1]) {
            const val = Math.round(parseFloat(m[1].replace(/,/g, "")) * 100);
            if (val > 0 && manualCouponAmount === 0) {
              manualCouponAmount = val;
            }
          }
        });

        // 2. Element by ID in Shiprocket Smart Cart
        const coupAmtEl = root.querySelector("#sr-cart-applied-coupon-amount");
        const coupNameEl = root.querySelector("#sr-cart-applied-coupon-name, #sr-cart-applied-coupon-title");
        const coupName = (coupNameEl?.textContent || "").trim().toUpperCase();

        if (coupAmtEl && !coupName.startsWith("FREEGIFT")) {
          const txt = (coupAmtEl.textContent || "").replace(/[^\d.]/g, "");
          const cVal = Math.round(parseFloat(txt) * 100);
          if (cVal > 0 && manualCouponAmount === 0) {
            manualCouponAmount = cVal;
          }
        }
      });

      // CLUBBING: Deduct manual coupon from the already discounted item total!
      if (manualCouponAmount > 0) {
        finalTotal = Math.max(0, finalTotal - manualCouponAmount);
      }

      // Apply rule discount code to Shopify Cart via Storefront API (Selleasy method)
      // Preserves existing customer discount codes (e.g. LOYAL) and avoids clobbering!
      if (code && disc > 0) {
        await mutateCartDiscountCodes(cart, [code]);
      } else {
        await mutateCartDiscountCodes(cart, []);
      }

      if (finalTotal < origTotal) {
        setDrawerEstimatedTotal(finalTotal, origTotal);
      } else {
        clearDrawerEstimatedTotal();
      }
    } catch {} finally {
      syncLock = false;
    }
  }

  // 7. PDP HYDRATION & DYNAMIC INJECTION
  let pdpInjected = false;
  async function hydratePdp() {
    if (!window.location.pathname.includes("/products/")) return;

    const hasVol = $(".bt-volume-widget");
    const hasFbt = $(".bt-fbt-widget");
    if (hasVol) initVolume(hasVol);
    if (hasFbt) initFbt(hasFbt);

    if ((hasVol && hasFbt) || pdpInjected) return;
    pdpInjected = true;

    try {
      const cfg = await getConfig();
      const rules = cfg.rules || [];
      const st = cfg.settings || {};
      const tpl = st.template || "cards";

      const pRes = await fetch(window.location.pathname.replace(/\/$/, "") + ".js");
      if (!pRes.ok) return;
      const prod = await pRes.json();
      if (!prod?.id) return;

      const pIdStr = String(prod.id);
      const form = $('form[action*="/cart/add"]') || $(".product-form") || $("product-form");
      if (!form) return;

      const styleVars = `--bt-accent:${st.accentColor||"#008060"};--bt-bg:${st.bgColor||"#ffffff"};--bt-text:${st.textColor||"#1a1a1a"};--bt-border:${st.borderColor||"#e1e3e5"};--bt-badge-bg:${st.badgeBg||"#008060"};--bt-badge-text:${st.badgeText||"#ffffff"};--bt-font-size:${st.fontSize||"15px"};--bt-radius:${st.borderRadius||"8px"};`;

      // Auto-inject Volume widget if missing
      if (!hasVol) {
        const vRule = rules.find((r) =>
          r.active &&
          r.ruleType === "VOLUME" &&
          r.tiers?.length &&
          (r.targetType === "PRODUCT"
            ? String(r.targetGid).includes(pIdStr)
            : (r.collectionProductIds || []).map(String).includes(pIdStr))
        );

        if (vRule) {
          const basePrice = prod.price || prod.variants?.[0]?.price || 0;
          const clean = cleanCode(vRule.title);
          let cardsHtml = "";

          vRule.tiers.forEach((t, i) => {
            const minQ = t.minQuantity || 1;
            const isF = t.discountType === "FIXED_AMOUNT";
            const val = Number(isF ? t.discountValue : (t.discountPercent || t.discountValue || 0));
            const origTot = basePrice * minQ;
            const discTot = isF ? Math.max(0, origTot - Math.round(val * 100)) : Math.round(origTot * (100 - val) / 100);
            const perItem = Math.round(discTot / minQ);
            const code = t.code || `${clean}-BUY${minQ}-${val}OFF`;

            cardsHtml += `
              <div class="bt-tier-card ${i === 0 ? "is-selected" : ""}"
                data-min-qty="${minQ}"
                data-discount-type="${t.discountType || "PERCENTAGE"}"
                data-discount-value="${val}"
                data-discount="${isF ? 0 : val}"
                data-code="${code}">
                ${i === 1 && vRule.tiers.length > 2 ? '<span class="bt-tier-badge">Most Popular</span>' : ""}
                <div class="bt-tier-radio-wrap">
                  <input type="radio" name="bt-dyn-vol" class="bt-tier-radio" ${i === 0 ? "checked" : ""}>
                  <div class="bt-tier-info">
                    <span class="bt-tier-name">Buy ${minQ} &middot; Save ${isF ? "₹" + val : val + "%"}</span>
                    <span class="bt-tier-per-item">${fmtPrice(perItem)}/each</span>
                  </div>
                </div>
                <div class="bt-tier-pricing">
                  <span class="bt-tier-price-current">${fmtPrice(discTot)}</span>
                  ${val > 0 ? `<span class="bt-tier-price-compare">${fmtPrice(origTot)}</span>` : ""}
                </div>
              </div>`;
          });

          const volDiv = document.createElement("div");
          volDiv.className = `bt-widget-container bt-volume-widget bt-template-${tpl}`;
          volDiv.setAttribute("style", styleVars);
          volDiv.dataset.variantId = String(prod.variants?.[0]?.id || "");
          volDiv.dataset.productId = pIdStr;
          volDiv.innerHTML = `
            <div class="bt-widget-header">
              <h3 class="bt-widget-title">
                <svg width="20" height="20" viewBox="24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
                Buy More, Save More
              </h3>
              <p class="bt-widget-subtitle">Select a quantity bundle to unlock discounts</p>
            </div>
            <div class="bt-tiers-list">${cardsHtml}</div>
            <div class="bt-action-wrap">
              <button type="button" class="bt-add-btn">Add To Cart</button>
              <div class="bt-savings-summary"></div>
            </div>`;
          form.parentNode.insertBefore(volDiv, form);
          initVolume(volDiv);
        }
      }

      // Auto-inject FBT widget if missing
      if (!hasFbt) {
        const fRule = rules.find((r) =>
          r.active &&
          r.ruleType === "FBT" &&
          r.fbtProducts?.length &&
          (String(r.targetGid).includes(pIdStr) ||
           (r.fbtProducts || []).some((p) => String(p.productId).includes(pIdStr)))
        );

        if (fRule) {
          const isTrigger = String(fRule.targetGid).includes(pIdStr);
          const isF = fRule.discountType === "FIXED_AMOUNT";
          const fVal = Number(fRule.discountValue ?? (fRule.mainDiscountPercent || 10));
          const baseVId = String(prod.variants?.[0]?.id || "");
          const baseP = prod.price || prod.variants?.[0]?.price || 0;
          const clean = cleanCode(fRule.title);
          const code = fRule.discountCode || `BUNDLE-${clean}-${fVal}OFF`;

          let companions = [];
          if (isTrigger) {
            companions = fRule.fbtProducts;
          } else {
            if (fRule.triggerProduct) {
              companions.push({
                productId: fRule.triggerProduct.id,
                variantId: fRule.triggerProduct.variantId,
                title: fRule.triggerProduct.title,
                priceCents: fRule.triggerProduct.priceCents,
                image: fRule.triggerProduct.image,
                discountPercent: fRule.mainDiscountPercent || fVal,
              });
            }
            fRule.fbtProducts.forEach((cp) => {
              if (!String(cp.productId).includes(pIdStr)) companions.push(cp);
            });
          }

          let thumbsHtml = `
            <div class="bt-fbt-thumb-card" data-fbt-card-id="${pIdStr}">
              <div class="bt-fbt-thumb-wrap">
                ${prod.featured_image ? `<img src="${prod.featured_image}" class="bt-fbt-img" width="80" height="80">` : `<div class="bt-fbt-no-img">${prod.title.slice(0, 10)}</div>`}
              </div>
              <span class="bt-fbt-thumb-badge">This Item</span>
            </div>`;

          let listHtml = `
            <div class="bt-fbt-item-row is-base">
              <label class="bt-fbt-checkbox-label">
                <input type="checkbox" checked disabled class="bt-fbt-base-checkbox">
                <span class="bt-fbt-item-name"><strong>This item:</strong> ${prod.title}</span>
                <span class="bt-fbt-item-price">${fmtPrice(baseP)}</span>
              </label>
            </div>`;

          companions.forEach((cp) => {
            const cpId = String(cp.productId || "").replace(/\D/g, "");
            const cpVId = String(cp.variantId || "").replace(/\D/g, "");
            const cpPrice = cp.priceCents || 0;
            const cpDisc = cp.discountPercent || fVal;

            thumbsHtml += `
              <div class="bt-fbt-plus-icon">+</div>
              <div class="bt-fbt-thumb-card" data-fbt-card-id="${cpId}">
                <div class="bt-fbt-thumb-wrap">
                  ${cp.image ? `<img src="${cp.image}" class="bt-fbt-img" width="80" height="80">` : `<div class="bt-fbt-no-img">${(cp.title || "Item").slice(0, 10)}</div>`}
                </div>
                ${!isF && cpDisc > 0 ? `<span class="bt-fbt-thumb-badge">-${cpDisc}%</span>` : ""}
              </div>`;

            listHtml += `
              <div class="bt-fbt-item-row">
                <label class="bt-fbt-checkbox-label">
                  <input type="checkbox" checked class="bt-fbt-companion-checkbox"
                    data-product-id="${cpId}"
                    data-variant-id="${cpVId}"
                    data-price="${cpPrice}"
                    data-discount="${cpDisc}">
                  <span class="bt-fbt-item-name">${cp.title || "Companion Item"}</span>
                  <span class="bt-fbt-item-price">${fmtPrice(cpPrice)}</span>
                </label>
              </div>`;
          });

          const fbtDiv = document.createElement("div");
          fbtDiv.className = `bt-widget-container bt-fbt-widget bt-template-${tpl}`;
          fbtDiv.setAttribute("style", styleVars);
          fbtDiv.dataset.baseVariantId = baseVId;
          fbtDiv.dataset.basePrice = String(baseP);
          fbtDiv.dataset.baseDiscount = String(fRule.mainDiscountPercent || 0);
          fbtDiv.dataset.discountType = fRule.discountType || "PERCENTAGE";
          fbtDiv.dataset.discountValue = String(fVal);
          fbtDiv.dataset.baseTitle = prod.title;
          fbtDiv.dataset.code = code;
          fbtDiv.innerHTML = `
            <div class="bt-widget-header">
              <h3 class="bt-widget-title">
                <svg width="20" height="20" viewBox="24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
                Frequently Bought Together
              </h3>
              <p class="bt-widget-subtitle">Bundle these items together and save</p>
            </div>
            <div class="bt-fbt-gallery">${thumbsHtml}</div>
            <div class="bt-fbt-items-list">${listHtml}</div>
            <div class="bt-fbt-action-wrap">
              <div class="bt-fbt-pricing-summary">
                <span class="bt-fbt-total-label">Total price:</span>
                <span class="bt-fbt-bundle-price"></span>
                <span class="bt-fbt-bundle-compare"></span>
                <span class="bt-fbt-savings-note"></span>
              </div>
              <button type="button" class="bt-fbt-add-btn">Add Items To Cart</button>
            </div>`;
          form.parentNode.insertBefore(fbtDiv, form.nextSibling);
          initFbt(fbtDiv);
        }
      }
    } catch {}
  }

  // 8. INTERCEPT CART CALLS & CHECKOUT HOOKS (SYNCHRONOUS IN-MEMORY INTERCEPTION)
  const _fetch = window.fetch;
  window.fetch = async function(...args) {
    const url = typeof args[0] === "string" ? args[0] : (args[0]?.url || "");
    const isCartReq = /\/cart(\.js|\.json)?(\?|$)/i.test(url) || /\/cart\/(add|change|update)(\.js|\.json)?(\?|$)/i.test(url);
    const isInternal = url.includes("_bt=");

    const res = await _fetch.apply(this, args);

    if (isCartReq && !isInternal && res.ok) {
      try {
        const clone = res.clone();
        const json = await clone.json();
        if (json && Array.isArray(json.items)) {
          transformCartResponse(json);
          setTimeout(syncCartDiscount, 100);
          return new Response(JSON.stringify(json), {
            status: res.status,
            statusText: res.statusText,
            headers: res.headers
          });
        }
      } catch {}
      setTimeout(syncCartDiscount, 200);
    } else if (isCartReq && !isInternal) {
      setTimeout(syncCartDiscount, 250);
    }
    return res;
  };

  const _xhrOpen = XMLHttpRequest.prototype.open;
  const _xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._btUrl = typeof url === "string" ? url : "";
    return _xhrOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function(...args) {
    if (this._btUrl && !this._btUrl.includes("_bt=") &&
        (/\/(cart\.js|cart\.json)(\?|$)/i.test(this._btUrl) || /\/cart\/(add|change|update)(\.js|\.json)?(\?|$)/i.test(this._btUrl))) {
      const self = this;
      let overridden = false;
      const interceptXhr = () => {
        try {
          if (self.readyState === 4 && self.status === 200 && !overridden) {
            overridden = true;
            const data = JSON.parse(self.responseText);
            if (data && Array.isArray(data.items)) {
              transformCartResponse(data);
              const transformedStr = JSON.stringify(data);
              Object.defineProperty(self, "responseText", { get: () => transformedStr, configurable: true });
              Object.defineProperty(self, "response", { get: () => transformedStr, configurable: true });
              setTimeout(syncCartDiscount, 100);
            }
          }
        } catch {}
      };
      this.addEventListener("readystatechange", interceptXhr, true);
      this.addEventListener("load", interceptXhr, true);
    }
    return _xhrSend.apply(this, args);
  };

  window.addEventListener("message", (e) => {
    try {
      const data = e.data;
      if (typeof data === "string" && (data.includes("cart") || data.includes("headless") || data.includes("checkout"))) {
        setTimeout(syncCartDiscount, 300);
      } else if (data && typeof data === "object") {
        const trig = data.trigger || data.action || data.type || "";
        if (/cart|checkout|headless|payment/i.test(trig)) {
          setTimeout(syncCartDiscount, 300);
        }
      }
    } catch {}
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button, a, [role='button']");
    if (!btn) return;
    const txt = (btn.textContent || "").trim().toLowerCase();
    if (txt === "+" || txt === "-" || btn.className?.includes?.("qty") || btn.className?.includes?.("quantity")) {
      setTimeout(syncCartDiscount, 300);
      setTimeout(syncCartDiscount, 700);
    }
  }, true);

  function start() {
    getConfig(); // preload & cache rules
    hookShiprocketBuyCart();
    hookFastrr();
    hydratePdp();
    setTimeout(syncCartDiscount, 300);
    attachObservers();
    setInterval(hookShiprocketBuyCart, 1000);
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
  document.addEventListener("shopify:section:load", start);
  window.addEventListener("cart:refresh", () => setTimeout(syncCartDiscount, 200));
  window.addEventListener("cart:updated", () => setTimeout(syncCartDiscount, 200));
})();
