"use strict";
(()=>{
  if (window.__btEngineLoaded) return;
  window.__btEngineLoaded = true;

  const API_URL = "https://volume-discount-manager.onrender.com/api/config";
  const ROOT = window.Shopify?.routes?.root || "/";

  const fmt = (cents) => "₹" + ((Number(cents) || 0) / 100).toFixed(2);
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  // Trigger standard storefront cart refresh so drawers update naturally without modifying their DOM
  function triggerRefresh() {
    ["cart:refresh", "cart:updated", "cart:build"].forEach((name) => {
      const evt = new CustomEvent(name, { bubbles: true });
      window.dispatchEvent(evt);
      document.dispatchEvent(evt);
    });
    try {
      window.Shiprocket?.refreshCart?.();
      window.Fastrr?.cart?.refresh?.();
      window.Fastrr?.refresh?.();
      window.shiprocketCheckout?.refresh?.();
      window.shiprocketSmartCart?.refreshCart?.();
    } catch {}

    const drawer = $("cart-drawer");
    if (drawer && typeof drawer.renderContents === "function") {
      fetch(ROOT + "?sections=cart-drawer,cart-icon-bubble")
        .then((r) => r.json())
        .then((sections) => {
          drawer.renderContents({ sections });
          drawer.open?.();
        })
        .catch(() => {});
    }
  }

  function syncQty(qty) {
    const input = ($('form[action*="/cart/add"]') || $(".product-form") || $("product-form"))?.querySelector('input[name="quantity"]');
    if (input) {
      input.value = String(qty);
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  // Pre-apply discount to session (just like Selleasy) so checkout picks it up automatically
  function preapplyDiscount(code) {
    if (!code) return;
    try {
      fetch(ROOT + "discount/" + encodeURIComponent(code)).catch(() => {});
    } catch {}
  }

  // 1. VOLUME WIDGET
  function initVolume(wrap) {
    if (!wrap || wrap.dataset.btInit) return;
    wrap.dataset.btInit = "1";

    const cards = $$(".bt-tier-card", wrap);
    const btn = $(".bt-add-btn", wrap);
    const summary = $(".bt-savings-summary", wrap);

    let sel = cards.length ? {
      qty: parseInt(cards[0].dataset.minQty, 10) || 1,
      disc: parseInt(cards[0].dataset.discount, 10) || 0,
      code: cards[0].dataset.code || "",
    } : null;

    function render() {
      if (!sel) return;
      syncQty(sel.qty);
      if (btn) btn.textContent = `Add ${sel.qty} to Cart` + (sel.disc ? ` (${sel.disc}% OFF)` : "");
      if (summary) summary.textContent = sel.disc ? `Save ${sel.disc}% with this bundle!` : "";
    }

    cards.forEach((card) => {
      card.addEventListener("click", () => {
        cards.forEach((c) => c.classList.remove("is-selected"));
        const radio = $(".bt-tier-radio", card);
        if (radio) radio.checked = true;
        card.classList.add("is-selected");
        sel = {
          qty: parseInt(card.dataset.minQty, 10) || 1,
          disc: parseInt(card.dataset.discount, 10) || 0,
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
          if (sel?.code) preapplyDiscount(sel.code);
          const res = await fetch(ROOT + "cart/add.js", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: [{ id, quantity: qty }] }),
          });
          if (!res.ok) throw new Error();
          btn.textContent = "✓ Added!";
          triggerRefresh();
          setTimeout(() => { btn.disabled = false; render(); }, 1500);
        } catch {
          btn.disabled = false;
          render();
        }
      });
    }

    render();
  }

  // 2. FBT WIDGET
  function initFbt(wrap) {
    if (!wrap || wrap.dataset.btInit) return;
    wrap.dataset.btInit = "1";

    const basePrice = parseInt(wrap.dataset.basePrice || "0", 10);
    const baseDisc = parseInt(wrap.dataset.baseDiscount || "0", 10);
    const cbs = $$(".bt-fbt-companion-checkbox", wrap);
    const btn = $(".bt-fbt-add-btn", wrap);
    const priceEl = $(".bt-fbt-bundle-price", wrap);
    const compareEl = $(".bt-fbt-bundle-compare", wrap);
    const noteEl = $(".bt-fbt-savings-note", wrap);
    const thumbs = $$(".bt-fbt-thumb-card", wrap);

    function calc() {
      let orig = basePrice;
      let total = baseDisc > 0 ? Math.round(basePrice * (100 - baseDisc) / 100) : basePrice;
      let count = 1;

      cbs.forEach((cb) => {
        const pId = cb.dataset.productId;
        const thumb = thumbs.find((t) => t.dataset.fbtCardId === pId);
        if (cb.checked) {
          count++;
          const p = parseInt(cb.dataset.price || "0", 10);
          const d = parseInt(cb.dataset.discount || "0", 10);
          orig += p;
          total += Math.round(p * (100 - d) / 100);
          if (thumb) thumb.style.opacity = "1";
        } else if (thumb) {
          thumb.style.opacity = "0.35";
        }
      });

      const save = orig - total;
      if (priceEl) priceEl.textContent = fmt(total);
      if (compareEl) compareEl.textContent = save > 0 ? fmt(orig) : "";
      if (noteEl) noteEl.textContent = save > 0 ? `Save ${fmt(save)} with this bundle!` : "";
      if (btn) btn.textContent = `Add ${count} Items To Cart`;
    }

    cbs.forEach((cb) => cb.addEventListener("change", calc));

    if (btn) {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        if (btn.disabled) return;
        const baseVId = wrap.dataset.baseVariantId || $('[name="id"]')?.value;
        if (!baseVId) return alert("Please select a variant.");

        const items = [{ id: parseInt(String(baseVId).replace(/\D/g, ""), 10), quantity: 1 }];
        cbs.forEach((cb) => {
          if (cb.checked && cb.dataset.variantId) {
            items.push({ id: parseInt(String(cb.dataset.variantId).replace(/\D/g, ""), 10), quantity: 1 });
          }
        });

        btn.disabled = true;
        btn.textContent = "Adding Bundle...";
        try {
          const bundleCode = wrap.dataset.code;
          if (bundleCode) preapplyDiscount(bundleCode);
          const res = await fetch(ROOT + "cart/add.js", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items }),
          });
          if (!res.ok) throw new Error();
          btn.textContent = "✓ Added Bundle!";
          triggerRefresh();
          setTimeout(() => { btn.disabled = false; calc(); }, 1500);
        } catch {
          btn.disabled = false;
          calc();
        }
      });
    }

    calc();
  }

  // 3. FETCH CONFIG
  let rulesCache = null;
  async function getRules() {
    if (rulesCache) return rulesCache;
    try {
      const shop = window.Shopify?.shop || window.location.hostname;
      const res = await (await fetch(`${API_URL}?shop=${encodeURIComponent(shop)}`)).json();
      if (res?.ok && Array.isArray(res.rules)) return (rulesCache = res.rules);
    } catch {}
    return [];
  }

  // 4. PDP HYDRATION
  async function hydratePdp() {
    if (!window.location.pathname.includes("/products/")) return;

    const ssrVol = $(".bt-volume-widget");
    if (ssrVol && ssrVol.children.length) initVolume(ssrVol);

    const ssrFbt = $(".bt-fbt-widget");
    if (ssrFbt && ssrFbt.children.length) initFbt(ssrFbt);

    if (ssrVol && ssrFbt) return;

    const rules = await getRules();
    if (!rules.length) return;

    const wrap = $(".bt-dual-widget-wrap");
    const pId = wrap?.dataset.productId || window.meta?.product?.id || "";
    const vId = wrap?.dataset.variantId || $('[name="id"]')?.value || "";
    const price = parseInt(wrap?.dataset.price || "40000", 10) || 40000;
    if (!pId) return;
    const pIdStr = String(pId);

    // Dynamic Volume Injection
    if (!ssrVol) {
      const r = rules.find((x) => {
        if (!x.active || x.ruleType !== "VOLUME" || !x.tiers?.length) return false;
        return x.targetType === "PRODUCT" ? String(x.targetGid || "").includes(pIdStr) : (x.collectionProductIds || []).map(String).includes(pIdStr);
      });
      if (r && r.tiers?.length) {
        const sorted = r.tiers.filter((t) => t.minQuantity && t.discountPercent).sort((a, b) => a.minQuantity - b.minQuantity);
        if (sorted.length) {
          let h = "";
          sorted.forEach((t, i) => {
            const q = t.minQuantity || 1, d = t.discountPercent || 0, orig = price * q, disc = Math.round(orig * (100 - d) / 100);
            h += `<div class="bt-tier-card ${i === 0 ? "is-selected" : ""}" data-min-qty="${q}" data-discount="${d}" data-code="${t.code || ""}">
              <input type="radio" class="bt-tier-radio" ${i === 0 ? "checked" : ""}>
              <div class="bt-tier-info"><span class="bt-tier-name">Buy ${q} &middot; Save ${d}%</span><span class="bt-tier-per-item">${fmt(Math.round(disc / q))}/each</span></div>
              <div class="bt-tier-pricing"><span class="bt-tier-price-current">${fmt(disc)}</span><span class="bt-tier-price-compare">${fmt(orig)}</span></div>
            </div>`;
          });
          const el = document.createElement("div");
          el.className = "bt-widget-container bt-volume-widget";
          el.dataset.variantId = String(vId);
          el.dataset.productId = pIdStr;
          el.innerHTML = `<h3 class="bt-widget-title">Buy More, Save More</h3><div class="bt-tiers-list">${h}</div><button type="button" class="bt-add-btn">Add To Cart</button><div class="bt-savings-summary"></div>`;
          initVolume(el);
          if (wrap) wrap.appendChild(el);
          else {
            const form = $('form[action*="/cart/add"]') || $(".product-form") || $("product-form");
            const btn = form?.querySelector('button[type="submit"]') || form?.querySelector('[name="add"]');
            btn?.parentNode ? btn.parentNode.insertBefore(el, btn) : form?.appendChild(el);
          }
        }
      }
    }

    // Dynamic FBT Injection
    if (!ssrFbt) {
      const fbt = rules.find((x) => x.active && x.ruleType === "FBT" && x.fbtProducts?.length && String(x.targetGid || "").includes(pIdStr));
      if (fbt && fbt.fbtProducts?.length) {
        const bDisc = Number(fbt.mainDiscountPercent || 0);
        let gHtml = `<div class="bt-fbt-thumb-card is-base"><span class="bt-fbt-thumb-label">This item</span>${bDisc > 0 ? `<span class="bt-fbt-thumb-badge">-${bDisc}%</span>` : ""}</div>`;
        let lHtml = `<label class="bt-fbt-row is-base"><input type="checkbox" checked disabled class="bt-fbt-checkbox"><span class="bt-fbt-check-label"><strong>This item:</strong> Selected Item</span><span class="bt-fbt-row-price">${fmt(bDisc > 0 ? Math.round(price * (100 - bDisc) / 100) : price)}</span></label>`;

        fbt.fbtProducts.forEach((item) => {
          const cp = item.priceCents || 0, cd = item.discountPercent || 10, cdp = Math.round(cp * (100 - cd) / 100);
          gHtml += `<div class="bt-fbt-plus-icon">+</div><div class="bt-fbt-thumb-card" data-fbt-card-id="${item.productId}">${item.image ? `<img src="${item.image}" class="bt-fbt-img" width="80" height="80"/>` : `<div class="bt-fbt-no-img">${(item.title || "").slice(0, 8)}</div>`}<span class="bt-fbt-thumb-badge">-${cd}%</span></div>`;
          lHtml += `<label class="bt-fbt-row"><input type="checkbox" checked class="bt-fbt-checkbox bt-fbt-companion-checkbox" data-product-id="${item.productId}" data-variant-id="${item.variantId}" data-price="${cp}" data-discount="${cd}"/><span class="bt-fbt-check-label">${item.title} <span class="bt-fbt-save-pill">Save ${cd}%</span></span><span class="bt-fbt-row-price">${fmt(cdp)}</span></label>`;
        });

        const el = document.createElement("div");
        el.className = "bt-widget-container bt-fbt-widget";
        el.dataset.baseVariantId = String(vId);
        el.dataset.basePrice = String(price);
        el.dataset.baseDiscount = String(bDisc);
        el.dataset.code = fbt.discountCode || "";
        el.innerHTML = `<div class="bt-widget-header"><h3 class="bt-widget-title">Frequently Bought Together</h3><p class="bt-widget-subtitle">Bundle these items together and save</p></div><div class="bt-fbt-gallery">${gHtml}</div><div class="bt-fbt-list">${lHtml}</div><div class="bt-fbt-summary-wrap"><div class="bt-fbt-total-box"><div class="bt-fbt-total-label">Bundle Price:</div><div class="bt-fbt-pricing"><span class="bt-fbt-bundle-price"></span><span class="bt-fbt-bundle-compare"></span></div></div><button type="button" class="bt-fbt-add-btn">Add Bundle To Cart</button><div class="bt-fbt-savings-note"></div></div>`;
        initFbt(el);
        if (wrap) wrap.appendChild(el);
        else {
          const form = $('form[action*="/cart/add"]') || $(".product-form") || $("product-form");
          form?.appendChild(el);
        }
      }
    }
  }

  function start() {
    hydratePdp();
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
  document.addEventListener("shopify:section:load", start);
})();
