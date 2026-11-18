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

  function getRoots() {
    const r = [document];
    try {
      $$("*").forEach((el) => el.shadowRoot && !r.includes(el.shadowRoot) && r.push(el.shadowRoot));
      $$("iframe").forEach((f) => { try { f.contentDocument && !r.includes(f.contentDocument) && r.push(f.contentDocument); } catch {} });
    } catch {}
    return r;
  }

  function triggerRefresh() {
    ["cart:refresh", "cart:updated"].forEach((n) => {
      const e = new CustomEvent(n, { bubbles: true });
      window.dispatchEvent(e);
      document.dispatchEvent(e);
    });
    try {
      window.Shiprocket?.refreshCart?.();
      window.Fastrr?.refresh?.();
      window.Fastrr?.cart?.refresh?.();
    } catch {}
    const d = $("cart-drawer");
    d?.renderContents && fetch(ROOT + "?sections=cart-drawer,cart-icon-bubble").then((r) => r.json()).then((s) => { d.renderContents({ sections: s }); d.open?.(); }).catch(() => {});
  }

  function syncQty(qty) {
    const inp = ($('form[action*="/cart/add"]') || $(".product-form") || $("product-form"))?.querySelector('input[name="quantity"]');
    inp && (inp.value = String(qty), inp.dispatchEvent(new Event("change", { bubbles: true })));
  }

  let lastAppliedCode = null;
  function preapply(code) {
    if (code === lastAppliedCode) return;
    lastAppliedCode = code;
    try {
      if (code) {
        fetch(ROOT + "discount/" + encodeURIComponent(code)).catch(() => {});
        document.cookie = "discount_code=" + encodeURIComponent(code) + "; path=/; max-age=86400";
      } else {
        document.cookie = "discount_code=; path=/; max-age=0";
      }
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
        if (sel.code) preapply(sel.code);
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
          if (sel?.code) preapply(sel.code);
          const res = await fetch(ROOT + "cart/add.js", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: [{ id, quantity: qty }] }),
          });
          if (!res.ok) throw new Error();
          btn.textContent = "✓ Added!";
          triggerRefresh();
          setTimeout(syncDrawerPrice, 400);
          setTimeout(() => { btn.disabled = false; render(); }, 1500);
        } catch {
          btn.disabled = false;
          render();
        }
      });
    }

    if (sel?.code) preapply(sel.code);
    render();
  }

  // 2. FBT WIDGET
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
          if (bundleCode && items.length > 1) preapply(bundleCode);
          const res = await fetch(ROOT + "cart/add.js", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items }),
          });
          if (!res.ok) throw new Error();
          btn.textContent = "✓ Added Bundle!";
          triggerRefresh();
          setTimeout(syncDrawerPrice, 400);
          setTimeout(() => { btn.disabled = false; calc(); }, 1500);
        } catch {
          btn.disabled = false;
          calc();
        }
      });
    }

    calc();
  }

  // 3. FETCH CONFIG & RULES
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

  // 4. FIND APPLICABLE DISCOUNT & CODE
  const cleanCode = (t) => t.replace(/^(volume tier:\s*|collection tier:\s*|bundle for:\s*)/i, "").replace(/\W/g, "").toUpperCase().slice(0, 8) || "OFFER";

  function getActiveDiscount(cart, rules) {
    if (!cart?.items?.length || !rules?.length) return { disc: 0, code: null };
    let disc = 0, code = null;

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
          const val = Number(isFixed ? t.discountValue : (t.discountPercent || t.discountValue));
          disc += isFixed ? Math.round(val * 100) : Math.round(sub * (val / 100));
          if (!code) code = t.code || `${cleanCode(r.title)}-BUY${t.minQuantity}-${val}OFF`;
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

          if (isFixed) {
            disc += Math.round(bundleCount * val * 100);
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
          if (!code) code = r.discountCode || `BUNDLE-${cleanCode(r.title)}-${val}OFF`;
        }
      }
    }
    return { disc, code };
  }

  // 5. UPDATE ESTIMATED TOTAL WITH STRIKETHROUGH IN DRAWER
  function applyTotal(str, origStr) {
    if (!str) return;
    getRoots().forEach((root) => {
      Array.from(root.querySelectorAll("*"))
        .filter((el) => el.children.length <= 2 && /estimated total/i.test(el.textContent || ""))
        .forEach((lbl) => {
          let cur = lbl.parentElement;
          for (let i = 0; i < 4 && cur && cur !== root; i++, cur = cur.parentElement) {
            const pEls = Array.from(cur.querySelectorAll("*")).filter((el) =>
              !el.children.length &&
              !el.closest("button") &&
              !el.closest("[class*='item'], [class*='product']") &&
              /^₹\s*[\d,]+(\.\d+)?$/.test((el.textContent || "").trim())
            );

            if (pEls.length) {
              if (origStr && origStr !== str) {
                if (pEls.length >= 2) {
                  pEls[0].textContent = origStr;
                  pEls[0].style.cssText = "text-decoration:line-through;color:#888;margin-right:6px;";
                  pEls[pEls.length - 1].textContent = str;
                  pEls[pEls.length - 1].style.display = "";
                } else {
                  pEls[0].innerHTML = `<s style="color:#888;font-weight:400;margin-right:6px;">${origStr}</s><span>${str}</span>`;
                }
              } else {
                pEls[pEls.length - 1].textContent = str;
              }
              break;
            }
          }
        });
    });
  }

  let activePriceStr = null, activeOrigStr = null, timer = null;

  function setDrawerPrice(pStr, origStr) {
    activePriceStr = pStr;
    activeOrigStr = origStr;
    if (!pStr) return;
    applyTotal(pStr, origStr);
    if (timer) clearInterval(timer);
    let ticks = 0;
    timer = setInterval(() => {
      if (activePriceStr) applyTotal(activePriceStr, activeOrigStr);
      ticks++;
      if (ticks > 25) clearInterval(timer);
    }, 200);
  }

  async function syncDrawerPrice() {
    try {
      const res = await fetch(ROOT + "cart.js?_bt=" + Date.now());
      if (!res.ok) return;
      const cart = await res.json();
      if (!cart?.items?.length) {
        activePriceStr = null;
        activeOrigStr = null;
        lastAppliedCode = null;
        return;
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

      const rules = await getRules();
      const { disc, code } = getActiveDiscount(cart, rules);
      if (disc > 0) {
        const ruleFinal = Math.max(0, origTotal - disc);
        if (ruleFinal < finalTotal) finalTotal = ruleFinal;
      }

      if (code) {
        window.__btActiveCode = code;
        preapply(code);
      } else {
        window.__btActiveCode = null;
        preapply(null);
      }

      if (finalTotal < origTotal) {
        setDrawerPrice(fmtPrice(finalTotal), fmtPrice(origTotal));
      } else {
        activePriceStr = null;
        activeOrigStr = null;
        if (timer) clearInterval(timer);
        applyTotal(fmtPrice(origTotal), null);
      }
    } catch {}
  }

  // 6. PDP HYDRATION
  async function hydratePdp() {
    if (!window.location.pathname.includes("/products/")) return;
    $$(".bt-volume-widget").forEach(initVolume);
    $$(".bt-fbt-widget").forEach(initFbt);
  }

  // 7. OBSERVER & INTERCEPTOR
  let obsTimer = null;
  const observer = new MutationObserver(() => {
    if (!activePriceStr || obsTimer) return;
    obsTimer = setTimeout(() => {
      obsTimer = null;
      if (activePriceStr) applyTotal(activePriceStr, activeOrigStr);
    }, 120);
  });

  const _fetch = window.fetch;
  window.fetch = function(...args) {
    const res = _fetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      if (/\/cart\/(add|change|update|clear)/.test(url) && !url.includes("_bt=")) {
        res.then(() => setTimeout(syncDrawerPrice, 350)).catch(() => {});
      }
    } catch {}
    return res;
  };

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button, a, [role='button']");
    if (!btn) return;
    const txt = (btn.textContent || "").trim().toLowerCase();
    if (txt.includes("buy now") || txt.includes("checkout")) {
      if (window.__btActiveCode) preapply(window.__btActiveCode);
    } else if (txt === "+" || txt === "-" || btn.className?.includes?.("qty") || btn.className?.includes?.("quantity")) {
      setTimeout(syncDrawerPrice, 400);
    }
  }, true);

  function start() {
    hydratePdp();
    setTimeout(syncDrawerPrice, 600);
    try { observer.observe(document.body, { childList: true, subtree: true }); } catch {}
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
  document.addEventListener("shopify:section:load", start);
  window.addEventListener("cart:refresh", () => setTimeout(syncDrawerPrice, 200));
  window.addEventListener("cart:updated", () => setTimeout(syncDrawerPrice, 200));
})();
