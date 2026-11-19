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

  // Open Shiprocket Smart Cart Drawer natively
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
    getRoots().forEach((r) => {
      if (!observedRoots.has(r)) {
        observedRoots.add(r);
        try {
          observer.observe(r, { childList: true, subtree: true, characterData: true });
        } catch {}
        try {
          r.addEventListener("click", (e) => {
            const target = e.target;
            const isAction = target?.closest?.("[class*='qty'], [class*='quantity'], [class*='delete'], [class*='remove'], [class*='coupon'], button, a");
            if (isAction) {
              setTimeout(syncCartDiscount, 150);
              setTimeout(syncCartDiscount, 600);
            }
          }, true);
          r.addEventListener("change", (e) => {
            if (e.target?.matches?.("input[type='number'], input[name='quantity'], [class*='qty']")) {
              setTimeout(syncCartDiscount, 150);
              setTimeout(syncCartDiscount, 600);
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

  // 2. DISCOVER CUSTOMER COUPONS (PRESERVES LOYAL, WELCOME, ETC. ACROSS CRUD)
  function getCustomerCoupons(cart, activeAppCode) {
    const customerCoupons = new Set();
    const appUpper = (activeAppCode || "").toUpperCase();

    // 1. From cart_level_discount_applications
    if (Array.isArray(cart?.cart_level_discount_applications)) {
      cart.cart_level_discount_applications.forEach((app) => {
        const title = (app.title || "").trim();
        if (!title) return;
        const upper = title.toUpperCase();
        if (
          upper !== appUpper &&
          !upper.startsWith("[VOLUME") &&
          !upper.startsWith("[BUNDLE") &&
          !upper.startsWith("TEST-BUY") &&
          !upper.startsWith("BUNDLE-")
        ) {
          customerCoupons.add(title);
        }
      });
    }

    // 2. From Shiprocket Smart Cart UI / Shadow DOM
    getRoots().forEach((root) => {
      const nameEl = root.querySelector("#sr-cart-applied-coupon-name, #sr-cart-applied-coupon-title");
      const name = (nameEl?.textContent || "").trim();
      if (name) {
        const upper = name.toUpperCase();
        if (
          upper !== appUpper &&
          !upper.startsWith("[VOLUME") &&
          !upper.startsWith("[BUNDLE") &&
          !upper.startsWith("TEST-BUY") &&
          !upper.startsWith("BUNDLE-")
        ) {
          customerCoupons.add(name);
        }
      }

      const textNodes = Array.from(root.querySelectorAll("*")).filter(
        (el) => el.children.length === 0 && (el.textContent || "").includes("saved with")
      );
      textNodes.forEach((el) => {
        const m = (el.textContent || "").match(/saved with\s+([A-Za-z0-9_-]+)/i);
        if (m && m[1]) {
          const code = m[1].trim();
          const upper = code.toUpperCase();
          if (
            upper !== appUpper &&
            !upper.startsWith("[VOLUME") &&
            !upper.startsWith("[BUNDLE") &&
            !upper.startsWith("TEST-BUY") &&
            !upper.startsWith("BUNDLE-")
          ) {
            customerCoupons.add(code);
          }
        }
      });
    });

    // 3. From persistent cookies
    try {
      const cookies = document.cookie.split(";");
      cookies.forEach((c) => {
        const [k, v] = c.trim().split("=");
        if (k === "fastrrCouponCode" || k === "discount_code") {
          const decoded = decodeURIComponent(v || "").trim();
          const upper = decoded.toUpperCase();
          if (
            decoded &&
            upper !== appUpper &&
            !upper.startsWith("[VOLUME") &&
            !upper.startsWith("[BUNDLE") &&
            !upper.startsWith("TEST-BUY") &&
            !upper.startsWith("BUNDLE-")
          ) {
            customerCoupons.add(decoded);
          }
        }
      });
    } catch {}

    return Array.from(customerCoupons);
  }

  // 3. APPLY DISCOUNT DIRECTLY TO SHOPIFY CART API (STOREFRONT API + /discount/ + COOKIES)
  let lastMutatedCodeKey = null;
  async function mutateCartDiscountCodes(cart, codes) {
    if (!cart?.token) return;

    const targetCodes = (codes || []).filter(Boolean);
    const codeKey = `${cart.token}:${targetCodes.slice().sort().join(",")}`;
    if (codeKey === lastMutatedCodeKey) return;

    const token =
      window.__btStorefrontToken ||
      configCache?.storefrontToken ||
      window.Shopify?.Storefront?.accessToken ||
      window.lbupsellToken ||
      "c08d56cae211c47c68cb3cd03b882be8";

    const rawCartId = cart.id || cart.token || "";
    const cartId = rawCartId.startsWith("gid://shopify/Cart/")
      ? rawCartId
      : `gid://shopify/Cart/${rawCartId}`;

    // A. Apply via Storefront API mutation (supports multiple combined codes e.g. [appCode, LOYAL])
    if (token) {
      const query = `
        mutation cartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]!) {
          cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
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
        await fetch(`${ROOT}api/2024-04/graphql.json`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Storefront-Access-Token": token,
          },
          body: JSON.stringify({
            query,
            variables: {
              cartId,
              discountCodes: targetCodes,
            },
          }),
        });
      } catch {}
    }

    // B. Also sync to native Shopify /discount/ URL and cookies
    const primaryCode = targetCodes[0] || "";
    if (primaryCode) {
      try {
        fetch(`${ROOT}discount/${encodeURIComponent(primaryCode)}`, { method: "GET", credentials: "same-origin" }).catch(() => {});
        document.cookie = `discount_code=${encodeURIComponent(primaryCode)}; path=/; max-age=86400`;
        document.cookie = `fastrrCouponCode=${encodeURIComponent(primaryCode)}; path=/; max-age=86400`;
      } catch {}
    } else if (lastMutatedCodeKey && targetCodes.length === 0) {
      try {
        fetch(`${ROOT}discount/CLEAR`, { method: "GET", credentials: "same-origin" }).catch(() => {});
        document.cookie = "discount_code=; path=/; max-age=0";
        document.cookie = "fastrrCouponCode=; path=/; max-age=0";
      } catch {}
    }

    lastMutatedCodeKey = codeKey;
  }

  // 4. VOLUME WIDGET INITIALIZATION
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
          const res = await fetch(ROOT + "cart/add.js", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: [{ id, quantity: qty }] }),
          });
          if (!res.ok) throw new Error();

          btn.textContent = "✓ Added!";
          triggerRefresh();
          openShiprocketDrawer();
          setTimeout(openShiprocketDrawer, 200);
          setTimeout(openShiprocketDrawer, 500);
          setTimeout(syncCartDiscount, 100);
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

  // 5. FBT WIDGET INITIALIZATION
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
        const baseId = parseInt(String(baseVId).replace(/\D/g, ""), 10);
        const items = [{ id: baseId, quantity: 1 }];

        companionCbs.forEach((cb) => {
          const cId = parseInt(String(cb.dataset.variantId).replace(/\D/g, ""), 10);
          items.push({ id: cId, quantity: 1 });
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
          setTimeout(syncCartDiscount, 100);
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

  // 6. FETCH CONFIG & RULES (STRICTLY FROM DATABASE / NO SYNTHETIC FALLBACKS)
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
    if (configCache && Array.isArray(configCache.rules)) return configCache;
    try {
      const shop = window.Shopify?.shop || window.location.hostname;
      const res = await (await fetch(`${API_URL}?shop=${encodeURIComponent(shop)}`)).json();
      if (res?.ok && Array.isArray(res.rules)) {
        configCache = res;
        syncRulesCache = res.rules;
        window.__btRules = res.rules;
        try {
          localStorage.setItem("bt_rules_cache", JSON.stringify(res.rules));
          localStorage.setItem("__btRules", JSON.stringify(res.rules));
        } catch {}
        return res;
      }
    } catch {}
    return { rules: getRulesSync(), settings: window.__btSettings || {} };
  }

  async function getRules() {
    const cfg = await getConfig();
    return Array.isArray(cfg?.rules) ? cfg.rules : getRulesSync();
  }

  // 7. FIND APPLICABLE DISCOUNT (EVALUATED FOR CURRENT CART)
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
    candidates.sort((a, b) => b.disc - a.disc);
    return { disc: candidates[0].disc, code: candidates[0].code };
  }

  // 8. SYNC CART DISCOUNT DISPLAY & APPLY TO CART API ACROSS CRUD OPERATIONS
  let syncLock = false;
  async function syncCartDiscount() {
    if (syncLock) return;
    syncLock = true;
    try {
      const res = await fetch(ROOT + "cart.js?_bt=" + Date.now());
      if (!res.ok) return;
      const cart = await res.json();

      if (!cart?.items?.length) {
        clearDrawerEstimatedTotal();
        await mutateCartDiscountCodes(cart, []);
        return;
      }

      const rules = await getRules();
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

      // 1. Calculate active app discount
      const { disc, code: activeCode } = getActiveDiscount(cart, rules);
      if (disc > 0) {
        const ruleFinal = Math.max(0, origTotal - disc);
        if (ruleFinal < finalTotal) finalTotal = ruleFinal;
      }

      // 2. Discover and preserve customer coupons (e.g. LOYAL)
      const customerCoupons = getCustomerCoupons(cart, activeCode);

      // 3. Build target codes for Cart API
      const targetCodes = (activeCode && disc > 0)
        ? Array.from(new Set([activeCode, ...customerCoupons]))
        : customerCoupons;

      // 4. APPLY DIRECTLY INTO CART API (Storefront API + /discount/ + cookies)
      await mutateCartDiscountCodes(cart, targetCodes);

      // 5. Deduct manual coupons for estimated total display
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

      getRoots().forEach((root) => {
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

      if (manualCouponAmount > 0) {
        finalTotal = Math.max(0, finalTotal - manualCouponAmount);
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

  // 9. PDP HYDRATION & DYNAMIC INJECTION (RENDER ONLY CONFIGURED TIERS)
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

      if (!hasVol) {
        const vRule = rules.find((r) =>
          r.active &&
          r.ruleType === "VOLUME" &&
          r.tiers?.length &&
          (r.targetType === "PRODUCT"
            ? String(r.targetGid).includes(pIdStr)
            : (r.collectionProductIds || []).map(String).includes(pIdStr))
        );

        if (vRule && Array.isArray(vRule.tiers) && vRule.tiers.length > 0) {
          const basePrice = prod.price || prod.variants?.[0]?.price || 0;
          const clean = cleanCode(vRule.title);
          let cardsHtml = "";

          const sortedTiers = [...vRule.tiers].sort((a, b) => Number(a.minQuantity || 1) - Number(b.minQuantity || 1));

          sortedTiers.forEach((t, i) => {
            const minQ = Number(t.minQuantity || 1);
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
                ${i === 1 && sortedTiers.length > 2 ? '<span class="bt-tier-badge">Most Popular</span>' : ""}
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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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

  // 10. PASS-THROUGH CART CALLS (ZERO TAMPERING / INSTANT REFRESH ON CRUD)
  const _fetch = window.fetch;
  window.fetch = function(...args) {
    const res = _fetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : (args[0]?.url || "");
      if (/\/cart(\.js|\/(add|change|update|clear))/i.test(url) && !url.includes("_bt=")) {
        res.then(() => {
          setTimeout(syncCartDiscount, 150);
          setTimeout(syncCartDiscount, 600);
        }).catch(() => {});
      }
    } catch {}
    return res;
  };

  const _xhrOpen = XMLHttpRequest.prototype.open;
  const _xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._btUrl = typeof url === "string" ? url : "";
    return _xhrOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function(...args) {
    if (this._btUrl && /\/cart(\.js|\/(add|change|update|clear))/i.test(this._btUrl) && !this._btUrl.includes("_bt=")) {
      this.addEventListener("load", () => {
        setTimeout(syncCartDiscount, 150);
        setTimeout(syncCartDiscount, 600);
      });
    }
    return _xhrSend.apply(this, args);
  };

  window.addEventListener("message", (e) => {
    try {
      const data = e.data;
      if (typeof data === "string" && (data.includes("cart") || data.includes("coupon") || data.includes("discount") || data.includes("headless") || data.includes("checkout"))) {
        setTimeout(syncCartDiscount, 250);
      } else if (data && typeof data === "object") {
        const trig = data.trigger || data.action || data.type || "";
        if (/cart|coupon|discount|checkout|headless|payment/i.test(trig)) {
          setTimeout(syncCartDiscount, 250);
        }
      }
    } catch {}
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button, a, [role='button']");
    if (!btn) return;
    const txt = (btn.textContent || "").trim().toLowerCase();
    if (txt === "+" || txt === "-" || btn.className?.includes?.("qty") || btn.className?.includes?.("quantity")) {
      setTimeout(syncCartDiscount, 250);
      setTimeout(syncCartDiscount, 650);
    }
  }, true);

  function start() {
    getConfig();
    hydratePdp();
    setTimeout(syncCartDiscount, 300);
    attachObservers();
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
  document.addEventListener("shopify:section:load", start);
  window.addEventListener("cart:refresh", () => setTimeout(syncCartDiscount, 200));
  window.addEventListener("cart:updated", () => setTimeout(syncCartDiscount, 200));
})();
