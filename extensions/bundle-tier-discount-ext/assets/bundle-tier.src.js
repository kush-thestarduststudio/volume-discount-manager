"use strict";
(()=>{
  if (window.__btEngineLoaded) return;
  window.__btEngineLoaded = true;

  const API_URL = "https://volume-discount-manager.onrender.com/api/config";
  const ROOT = window.Shopify?.routes?.root || "/";

  const fmt = (c) => "₹" + ((Number(c) || 0) / 100).toFixed(2);
  const fmtPrice = (c) => {
    const v = Number(c) / 100;
    return v % 1 === 0 ? "₹" + v.toFixed(0) : "₹" + v.toFixed(2);
  };
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  function getRoots() {
    const r = [document];
    try {
      $$("*").forEach((el) => { if (el.shadowRoot && !r.includes(el.shadowRoot)) r.push(el.shadowRoot); });
      $$("iframe").forEach((f) => {
        try { if (f.contentDocument && !r.includes(f.contentDocument)) r.push(f.contentDocument); } catch {}
      });
    } catch {}
    return r;
  }

  function triggerRefresh() {
    ["cart:refresh", "cart:updated", "cart:build"].forEach((n) => {
      const e = new CustomEvent(n, { bubbles: true });
      window.dispatchEvent(e);
      document.dispatchEvent(e);
    });
    try {
      window.Shiprocket?.refreshCart?.();
      window.Fastrr?.cart?.refresh?.();
      window.Fastrr?.refresh?.();
      window.shiprocketCheckout?.refresh?.();
      window.shiprocketSmartCart?.refreshCart?.();
    } catch {}

    const drawer = $("cart-drawer");
    if (drawer?.renderContents) {
      fetch(ROOT + "?sections=cart-drawer,cart-icon-bubble")
        .then((r) => r.json())
        .then((s) => {
          drawer.renderContents({ sections: s });
          drawer.open?.();
        })
        .catch(() => {});
    }
  }

  function syncQty(qty) {
    const inp = ($('form[action*="/cart/add"]') || $(".product-form") || $("product-form"))?.querySelector('input[name="quantity"]');
    if (inp) {
      inp.value = String(qty);
      inp.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function preapply(code) {
    if (!code) return;
    try { fetch(ROOT + "discount/" + encodeURIComponent(code)).catch(() => {}); } catch {}
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
          if (bundleCode) preapply(bundleCode);
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

  // 4. CALCULATE DISCOUNT FROM RULES
  function calcRuleDiscount(cart, rules) {
    if (!cart?.items?.length || !rules?.length) return 0;
    let disc = 0;
    for (const r of rules) {
      if (!r.active) continue;
      const tId = String(r.targetGid || "").replace(/\D/g, "");
      if (r.ruleType === "VOLUME" && r.tiers?.length) {
        const items = cart.items.filter((it) => String(it.product_id) === tId);
        const qty = items.reduce((s, it) => s + it.quantity, 0);
        const t = [...r.tiers].sort((a, b) => b.minQuantity - a.minQuantity).find((x) => qty >= x.minQuantity);
        if (t) {
          const sub = items.reduce((s, it) => s + (it.original_line_price || it.price * it.quantity), 0);
          disc += Math.round(sub * (t.discountPercent / 100));
        }
      } else if (r.ruleType === "FBT" && r.fbtProducts?.length) {
        const cIds = r.fbtProducts.map((p) => String(p.productId || "").replace(/\D/g, ""));
        if (cart.items.some((it) => String(it.product_id) === tId) && cIds.some((id) => cart.items.some((it) => String(it.product_id) === id))) {
          const bPct = Number(r.mainDiscountPercent || 0);
          cart.items.forEach((it) => {
            const pid = String(it.product_id);
            const orig = it.original_line_price || it.price * it.quantity;
            if (pid === tId && bPct > 0) disc += Math.round(orig * (bPct / 100));
            const comp = r.fbtProducts.find((cp) => String(cp.productId).replace(/\D/g, "") === pid);
            if (comp) disc += Math.round(orig * (Number(comp.discountPercent || bPct || 10) / 100));
          });
        }
      }
    }
    return disc;
  }

  // 5. UPDATE ESTIMATED TOTAL PRICE IN DRAWER ONLY
  function applyTotal(str) {
    if (!str) return;
    getRoots().forEach((root) => {
      Array.from(root.querySelectorAll("*"))
        .filter((el) => el.children.length <= 2 && /estimated total/i.test(el.textContent || ""))
        .forEach((lbl) => {
          let cur = lbl.parentElement;
          for (let i = 0; i < 4 && cur && cur !== root; i++, cur = cur.parentElement) {
            const pEls = Array.from(cur.querySelectorAll("*")).filter((el) =>
              el.children.length === 0 &&
              !el.closest("button") &&
              !el.closest("[class*='item'], [class*='product']") &&
              /^₹\s*[\d,]+(\.\d+)?$/.test((el.textContent || "").trim())
            );

            if (pEls.length > 0) {
              const targetEl = pEls[pEls.length - 1];
              if (targetEl.textContent.trim() !== str) targetEl.textContent = str;
              for (let j = 0; j < pEls.length - 1; j++) pEls[j].style.display = "none";
              break;
            }
          }
        });
    });
  }

  let activePriceStr = null;
  let timer = null;

  function setDrawerPrice(pStr) {
    activePriceStr = pStr;
    if (!pStr) return;
    applyTotal(pStr);
    if (timer) clearInterval(timer);
    let ticks = 0;
    timer = setInterval(() => {
      if (activePriceStr) applyTotal(activePriceStr);
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
      const ruleDisc = calcRuleDiscount(cart, rules);
      if (ruleDisc > 0) {
        const ruleFinal = Math.max(0, origTotal - ruleDisc);
        if (ruleFinal < finalTotal) finalTotal = ruleFinal;
      }

      if (finalTotal < origTotal) {
        setDrawerPrice(fmtPrice(finalTotal));
      } else {
        activePriceStr = null;
      }
    } catch {}
  }

  // 6. PDP HYDRATION
  async function hydratePdp() {
    if (!window.location.pathname.includes("/products/")) return;

    $$(".bt-volume-widget").forEach(initVolume);
    $$(".bt-fbt-widget").forEach(initFbt);

    const ssrVol = $(".bt-volume-widget");
    const ssrFbt = $(".bt-fbt-widget");
    if (ssrVol && ssrFbt) return;

    const rules = await getRules();
    if (!rules.length) return;

    const wrap = $(".bt-dual-widget-wrap");
    const pId = wrap?.dataset.productId || window.meta?.product?.id || "";
    if (!pId) return;
    const pIdStr = String(pId);

    if (!ssrVol) {
      const r = rules.find((x) => x.active && x.ruleType === "VOLUME" && x.tiers?.length && (x.targetType === "PRODUCT" ? String(x.targetGid || "").includes(pIdStr) : (x.collectionProductIds || []).map(String).includes(pIdStr)));
      if (r?.tiers?.length) {
        const el = document.createElement("div");
        el.className = "bt-widget-container bt-volume-widget";
        el.dataset.variantId = $('[name="id"]')?.value || "";
        el.innerHTML = '<h3 class="bt-widget-title">Buy More, Save More</h3><div class="bt-tiers-list">' +
          r.tiers.map((t, i) => `<div class="bt-tier-card ${i === 0 ? "is-selected" : ""}" data-min-qty="${t.minQuantity}" data-discount="${t.discountPercent}" data-code="${t.code || ""}"><input type="radio" class="bt-tier-radio" ${i === 0 ? "checked" : ""}><div class="bt-tier-info"><span class="bt-tier-name">Buy ${t.minQuantity} · Save ${t.discountPercent}%</span></div></div>`).join("") +
          '</div><button type="button" class="bt-add-btn">Add To Cart</button><div class="bt-savings-summary"></div>';
        initVolume(el);
        (wrap || $('form[action*="/cart/add"]') || $(".product-form"))?.appendChild(el);
      }
    }
  }

  // 7. OBSERVER & INTERCEPTOR
  let obsTimer = null;
  const observer = new MutationObserver(() => {
    if (!activePriceStr || obsTimer) return;
    obsTimer = setTimeout(() => {
      obsTimer = null;
      if (activePriceStr) applyTotal(activePriceStr);
    }, 120);
  });

  const _fetch = window.fetch;
  window.fetch = function(...args) {
    const res = _fetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      if (/\/cart\/(add|change|update|clear)/.test(url)) {
        res.then(() => setTimeout(syncDrawerPrice, 300)).catch(() => {});
      }
    } catch {}
    return res;
  };

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
