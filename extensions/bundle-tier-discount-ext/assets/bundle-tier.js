"use strict";(()=>{if(window.__btEngineLoaded)return;window.__btEngineLoaded=!0;const Q="//volume-discount-manager.onrender.com/api/config",S=window.Shopify?.routes?.root||"/",_=t=>"\u20B9"+((Number(t)||0)/100).toFixed(0),P=t=>{const e=Number(t)/100;return e%1===0?"\u20B9"+e.toFixed(0):"\u20B9"+e.toFixed(2)},m=(t,e=document)=>e.querySelector(t),M=(t,e=document)=>Array.from(e.querySelectorAll(t));function A(){["cart:refresh","cart:updated"].forEach(e=>{const s=new CustomEvent(e,{bubbles:!0});window.dispatchEvent(s),document.dispatchEvent(s)});try{window.Shiprocket?.refreshCart?.(),window.Fastrr?.refresh?.(),window.Fastrr?.cart?.refresh?.()}catch{}const t=m("cart-drawer");t?.renderContents&&fetch(S+"?sections=cart-drawer,cart-icon-bubble").then(e=>e.json()).then(e=>{t.renderContents({sections:e}),t.open?.()}).catch(()=>{})}function X(t){const e=(m('form[action*="/cart/add"]')||m(".product-form")||m("product-form"))?.querySelector('input[name="quantity"]');e&&(e.value=String(t),e.dispatchEvent(new Event("change",{bubbles:!0})))}let $=null,N=!1;async function x(t){if(!(t===$||N)){N=!0,$=t;try{if(await fetch(S+"cart/update.js",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({discount:t||""})}),t){fetch(S+"discount/"+encodeURIComponent(t)).catch(()=>{}),document.cookie="discount_code="+encodeURIComponent(t)+"; path=/; max-age=86400",document.cookie="fastrrCouponCode="+encodeURIComponent(t)+"; path=/; max-age=86400";try{localStorage.setItem("fastrrCouponCode",t)}catch{}try{sessionStorage.setItem("fastrrCouponCode",t)}catch{}try{localStorage.setItem("discount_code",t)}catch{}try{window.Fastrr?.applyCoupon?.(t),window.Fastrr?.cart?.applyCoupon?.(t),window.Shiprocket?.applyCoupon?.(t)}catch{}}else{document.cookie="discount_code=; path=/; max-age=0",document.cookie="fastrrCouponCode=; path=/; max-age=0";try{localStorage.removeItem("fastrrCouponCode")}catch{}try{sessionStorage.removeItem("fastrrCouponCode")}catch{}try{localStorage.removeItem("discount_code")}catch{}}A()}catch(e){console.error("[BundleTier] Error updating cart discount:",e)}finally{N=!1}}}function R(t){if(!t||t.dataset.btInit)return;t.dataset.btInit="1";const e=M(".bt-tier-card",t),s=m(".bt-add-btn",t),o=m(".bt-savings-summary",t);let a=e.length?{qty:parseInt(e[0].dataset.minQty,10)||1,type:e[0].dataset.discountType||"PERCENTAGE",val:parseFloat(e[0].dataset.discountValue||e[0].dataset.discount||"0")||0,code:e[0].dataset.code||""}:null;function h(){if(!a)return;X(a.qty);const d=a.type==="FIXED_AMOUNT",n=a.val?d?` (\u20B9${a.val} OFF)`:` (${a.val}% OFF)`:"";s&&(s.textContent=`Add ${a.qty} to Cart`+n),o&&(o.textContent=a.val?`Save ${d?`\u20B9${a.val}`:`${a.val}%`} with this offer!`:"")}e.forEach(d=>{d.addEventListener("click",()=>{e.forEach(i=>i.classList.remove("is-selected"));const n=m(".bt-tier-radio",d);n&&(n.checked=!0),d.classList.add("is-selected"),a={qty:parseInt(d.dataset.minQty,10)||1,type:d.dataset.discountType||"PERCENTAGE",val:parseFloat(d.dataset.discountValue||d.dataset.discount||"0")||0,code:d.dataset.code||""},h()})}),s&&s.addEventListener("click",async d=>{if(d.preventDefault(),s.disabled)return;const n=t.dataset.variantId||m('[name="id"]')?.value;if(!n)return alert("Please select a variant.");const i=parseInt(String(n).replace(/\D/g,""),10),b=a?a.qty:1;s.disabled=!0,s.textContent="Adding...";try{if(!(await fetch(S+"cart/add.js",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:[{id:i,quantity:b}]})})).ok)throw new Error;a?.code&&await x(a.code),s.textContent="\u2713 Added!",A(),setTimeout(()=>{s.disabled=!1,h()},1500)}catch{s.disabled=!1,h()}}),h()}function U(t){if(!t||t.dataset.btInit)return;t.dataset.btInit="1";const e=parseInt(t.dataset.basePrice||"0",10),s=parseInt(t.dataset.baseDiscount||"0",10),o=t.dataset.discountType||"PERCENTAGE",a=parseFloat(t.dataset.discountValue||"0")||(o==="PERCENTAGE"?s||10:100),h=o==="FIXED_AMOUNT",d=M(".bt-fbt-companion-checkbox",t),n=m(".bt-fbt-add-btn",t),i=m(".bt-fbt-bundle-price",t),b=m(".bt-fbt-bundle-compare",t),C=m(".bt-fbt-savings-note",t),c=M(".bt-fbt-thumb-card",t);function r(){let f=e,l=!h&&s>0?Math.round(e*(100-s)/100):e,p=1;d.forEach(v=>{const E=v.dataset.productId,y=c.find(g=>g.dataset.fbtCardId===E);if(v.checked){p++;const g=parseInt(v.dataset.price||"0",10),T=parseInt(v.dataset.discount||"0",10);f+=g,l+=h?g:Math.round(g*(100-(T||a))/100),y&&(y.style.opacity="1")}else y&&(y.style.opacity="0.35")}),h&&a>0&&p>1?l=Math.max(0,f-Math.round(a*100)):h&&(l=f);const u=f-l;i&&(i.textContent=_(l)),b&&(b.textContent=u>0?_(f):""),C&&(C.textContent=u>0?`Save ${_(u)} with this bundle!`:""),n&&(n.textContent=`Add ${p} Items To Cart`)}d.forEach(f=>f.addEventListener("change",r)),n&&n.addEventListener("click",async f=>{if(f.preventDefault(),n.disabled)return;const l=t.dataset.baseVariantId||m('[name="id"]')?.value;if(!l)return alert("Please select a variant.");const p=[{id:parseInt(String(l).replace(/\D/g,""),10),quantity:1}];d.forEach(u=>{u.checked&&u.dataset.variantId&&p.push({id:parseInt(String(u.dataset.variantId).replace(/\D/g,""),10),quantity:1})}),n.disabled=!0,n.textContent="Adding Bundle...";try{if(!(await fetch(S+"cart/add.js",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:p})})).ok)throw new Error;const v=t.dataset.code;v&&p.length>1&&await x(v),n.textContent="\u2713 Added Bundle!",A(),setTimeout(()=>{n.disabled=!1,r()},1500)}catch{n.disabled=!1,r()}}),r()}let q=null;async function B(){if(q)return q;try{const t=window.Shopify?.shop||window.location.hostname,e=await(await fetch(`${Q}?shop=${encodeURIComponent(t)}`)).json();if(e?.ok)return q=e,e}catch{}return{rules:window.__btRules||[],settings:window.__btSettings||{}}}async function H(){const t=await B();return Array.isArray(t?.rules)?t.rules:[]}const k=t=>(t||"").replace(/^(bundle(\s+for)?[:\s]*|volume(\s+tier)?[:\s]*|collection(\s+tier)?[:\s]*)/i,"").replace(/[^a-zA-Z0-9]/g,"").toUpperCase().slice(0,8)||"OFFER";function z(t,e){if(!t?.items?.length||!e?.length)return{disc:0,code:null};const s=[];for(const o of e){if(!o.active)continue;const a=String(o.targetGid||"").replace(/\D/g,"");if(o.ruleType==="VOLUME"&&o.tiers?.length){const h=t.items.filter(i=>o.targetType==="PRODUCT"?String(i.product_id)===a:(o.collectionProductIds||[]).map(String).includes(String(i.product_id))),d=h.reduce((i,b)=>i+b.quantity,0),n=[...o.tiers].sort((i,b)=>b.minQuantity-i.minQuantity).find(i=>d>=i.minQuantity);if(n){const i=h.reduce((f,l)=>f+(l.original_line_price||l.price*l.quantity),0),b=n.discountType==="FIXED_AMOUNT",C=Number(b?n.discountValue:n.discountPercent||n.discountValue||0),c=Math.round(b?C*100:i*(C/100)),r=n.code||`${k(o.title)}-BUY${n.minQuantity}-${C}OFF`;s.push({disc:c,code:r,type:"VOLUME"})}}else if(o.ruleType==="FBT"&&o.fbtProducts?.length){const h=o.fbtProducts.map(i=>String(i.productId||"").replace(/\D/g,"")),d=t.items.find(i=>String(i.product_id)===a),n=h.every(i=>t.items.some(b=>String(b.product_id)===i));if(d&&n){const i=h.map(l=>t.items.find(p=>String(p.product_id)===l)),b=Math.min(d.quantity,...i.map(l=>l?.quantity||1)),C=o.discountType==="FIXED_AMOUNT",c=Number(C?o.discountValue:o.mainDiscountPercent||o.discountValue||o.fbtProducts[0]?.discountPercent||10);let r=0;if(C)r=Math.round(b*c*100);else{const l=Number(o.mainDiscountPercent||c||0),p=Math.round((d.original_line_price||d.price*d.quantity)/d.quantity);l>0&&(r+=Math.round(p*b*(l/100))),i.forEach((u,v)=>{if(!u)return;const E=Number(o.fbtProducts[v]?.discountPercent||l||10),y=Math.round((u.original_line_price||u.price*u.quantity)/u.quantity);r+=Math.round(y*b*(E/100))})}const f=o.discountCode||`BUNDLE-${k(o.title)}-${c}OFF`;s.push({disc:r,code:f,type:"FBT"})}}}return s.length?(s.sort((o,a)=>a.disc-o.disc),{disc:s[0].disc,code:s[0].code}):{disc:0,code:null}}let O=!1;async function F(){if(!O){O=!0;try{const t=await fetch(S+"cart.js?_bt="+Date.now());if(!t.ok)return;const e=await t.json();if(!e?.items?.length){$&&await x("");return}const s=await H(),{disc:o,code:a}=z(e,s);a&&o>0?a!==$&&await x(a):$&&await x("")}catch{}finally{O=!1}}}let j=!1;async function J(){if(!window.location.pathname.includes("/products/"))return;const t=m(".bt-volume-widget"),e=m(".bt-fbt-widget");if(t&&R(t),e&&U(e),!(t&&e||j)){j=!0;try{const s=await B(),o=s.rules||[],a=s.settings||{},h=a.template||"cards",d=await fetch(window.location.pathname.replace(/\/$/,"")+".js");if(!d.ok)return;const n=await d.json();if(!n?.id)return;const i=String(n.id),b=m('form[action*="/cart/add"]')||m(".product-form")||m("product-form");if(!b)return;const C=`--bt-accent:${a.accentColor||"#008060"};--bt-bg:${a.bgColor||"#ffffff"};--bt-text:${a.textColor||"#1a1a1a"};--bt-border:${a.borderColor||"#e1e3e5"};--bt-badge-bg:${a.badgeBg||"#008060"};--bt-badge-text:${a.badgeText||"#ffffff"};--bt-font-size:${a.fontSize||"15px"};--bt-radius:${a.borderRadius||"8px"};`;if(!t){const c=o.find(r=>r.active&&r.ruleType==="VOLUME"&&r.tiers?.length&&(r.targetType==="PRODUCT"?String(r.targetGid).includes(i):(r.collectionProductIds||[]).map(String).includes(i)));if(c){const r=n.price||n.variants?.[0]?.price||0,f=k(c.title);let l="";c.tiers.forEach((u,v)=>{const E=u.minQuantity||1,y=u.discountType==="FIXED_AMOUNT",g=Number(y?u.discountValue:u.discountPercent||u.discountValue||0),T=r*E,w=y?Math.max(0,T-Math.round(g*100)):Math.round(T*(100-g)/100),I=Math.round(w/E),D=u.code||`${f}-BUY${E}-${g}OFF`;l+=`
              <div class="bt-tier-card ${v===0?"is-selected":""}"
                data-min-qty="${E}"
                data-discount-type="${u.discountType||"PERCENTAGE"}"
                data-discount-value="${g}"
                data-discount="${y?0:g}"
                data-code="${D}">
                ${v===1&&c.tiers.length>2?'<span class="bt-tier-badge">Most Popular</span>':""}
                <div class="bt-tier-radio-wrap">
                  <input type="radio" name="bt-dyn-vol" class="bt-tier-radio" ${v===0?"checked":""}>
                  <div class="bt-tier-info">
                    <span class="bt-tier-name">Buy ${E} &middot; Save ${y?"\u20B9"+g:g+"%"}</span>
                    <span class="bt-tier-per-item">${P(I)}/each</span>
                  </div>
                </div>
                <div class="bt-tier-pricing">
                  <span class="bt-tier-price-current">${P(w)}</span>
                  ${g>0?`<span class="bt-tier-price-compare">${P(T)}</span>`:""}
                </div>
              </div>`});const p=document.createElement("div");p.className=`bt-widget-container bt-volume-widget bt-template-${h}`,p.setAttribute("style",C),p.dataset.variantId=String(n.variants?.[0]?.id||""),p.dataset.productId=i,p.innerHTML=`
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
            <div class="bt-tiers-list">${l}</div>
            <div class="bt-action-wrap">
              <button type="button" class="bt-add-btn">Add To Cart</button>
              <div class="bt-savings-summary"></div>
            </div>`,b.parentNode.insertBefore(p,b),R(p)}}if(!e){const c=o.find(r=>r.active&&r.ruleType==="FBT"&&r.fbtProducts?.length&&(String(r.targetGid).includes(i)||(r.fbtProducts||[]).some(f=>String(f.productId).includes(i))));if(c){const r=String(c.targetGid).includes(i),f=c.discountType==="FIXED_AMOUNT",l=Number(c.discountValue??(c.mainDiscountPercent||10)),p=String(n.variants?.[0]?.id||""),u=n.price||n.variants?.[0]?.price||0,v=k(c.title),E=c.discountCode||`BUNDLE-${v}-${l}OFF`;let y=[];r?y=c.fbtProducts:(c.triggerProduct&&y.push({productId:c.triggerProduct.id,variantId:c.triggerProduct.variantId,title:c.triggerProduct.title,priceCents:c.triggerProduct.priceCents,image:c.triggerProduct.image,discountPercent:c.mainDiscountPercent||l}),c.fbtProducts.forEach(I=>{String(I.productId).includes(i)||y.push(I)}));let g=`
            <div class="bt-fbt-thumb-card" data-fbt-card-id="${i}">
              <div class="bt-fbt-thumb-wrap">
                ${n.featured_image?`<img src="${n.featured_image}" class="bt-fbt-img" width="80" height="80">`:`<div class="bt-fbt-no-img">${n.title.slice(0,10)}</div>`}
              </div>
              <span class="bt-fbt-thumb-badge">This Item</span>
            </div>`,T=`
            <div class="bt-fbt-item-row is-base">
              <label class="bt-fbt-checkbox-label">
                <input type="checkbox" checked disabled class="bt-fbt-base-checkbox">
                <span class="bt-fbt-item-name"><strong>This item:</strong> ${n.title}</span>
                <span class="bt-fbt-item-price">${P(u)}</span>
              </label>
            </div>`;y.forEach(I=>{const D=String(I.productId||"").replace(/\D/g,""),Z=String(I.variantId||"").replace(/\D/g,""),G=I.priceCents||0,L=I.discountPercent||l;g+=`
              <div class="bt-fbt-plus-icon">+</div>
              <div class="bt-fbt-thumb-card" data-fbt-card-id="${D}">
                <div class="bt-fbt-thumb-wrap">
                  ${I.image?`<img src="${I.image}" class="bt-fbt-img" width="80" height="80">`:`<div class="bt-fbt-no-img">${(I.title||"Item").slice(0,10)}</div>`}
                </div>
                ${!f&&L>0?`<span class="bt-fbt-thumb-badge">-${L}%</span>`:""}
              </div>`,T+=`
              <div class="bt-fbt-item-row">
                <label class="bt-fbt-checkbox-label">
                  <input type="checkbox" checked class="bt-fbt-companion-checkbox"
                    data-product-id="${D}"
                    data-variant-id="${Z}"
                    data-price="${G}"
                    data-discount="${L}">
                  <span class="bt-fbt-item-name">${I.title||"Companion Item"}</span>
                  <span class="bt-fbt-item-price">${P(G)}</span>
                </label>
              </div>`});const w=document.createElement("div");w.className=`bt-widget-container bt-fbt-widget bt-template-${h}`,w.setAttribute("style",C),w.dataset.baseVariantId=p,w.dataset.basePrice=String(u),w.dataset.baseDiscount=String(c.mainDiscountPercent||0),w.dataset.discountType=c.discountType||"PERCENTAGE",w.dataset.discountValue=String(l),w.dataset.baseTitle=n.title,w.dataset.code=E,w.innerHTML=`
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
            <div class="bt-fbt-gallery">${g}</div>
            <div class="bt-fbt-items-list">${T}</div>
            <div class="bt-fbt-action-wrap">
              <div class="bt-fbt-pricing-summary">
                <span class="bt-fbt-total-label">Total price:</span>
                <span class="bt-fbt-bundle-price"></span>
                <span class="bt-fbt-bundle-compare"></span>
                <span class="bt-fbt-savings-note"></span>
              </div>
              <button type="button" class="bt-fbt-add-btn">Add Items To Cart</button>
            </div>`,b.parentNode.insertBefore(w,b.nextSibling),U(w)}}}catch{}}}const Y=window.fetch;window.fetch=function(...t){const e=Y.apply(this,t);try{const s=typeof t[0]=="string"?t[0]:t[0]?.url||"";/\/cart\/(add|change|update|clear)/.test(s)&&!s.includes("_bt=")&&!s.includes("update.js")&&e.then(()=>setTimeout(F,300)).catch(()=>{})}catch{}return e},document.addEventListener("click",t=>{const e=t.target.closest("button, a, [role='button']");if(!e)return;const s=(e.textContent||"").trim().toLowerCase();if(s.includes("buy now")||s.includes("checkout")){if($){fetch(S+"discount/"+encodeURIComponent($)).catch(()=>{}),document.cookie="discount_code="+encodeURIComponent($)+"; path=/; max-age=86400",document.cookie="fastrrCouponCode="+encodeURIComponent($)+"; path=/; max-age=86400";try{window.Fastrr?.applyCoupon?.($),window.Fastrr?.cart?.applyCoupon?.($),window.Shiprocket?.applyCoupon?.($)}catch{}}}else(s==="+"||s==="-"||e.className?.includes?.("qty")||e.className?.includes?.("quantity"))&&setTimeout(F,400)},!0);function V(){J(),setTimeout(F,500)}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",V):V(),document.addEventListener("shopify:section:load",V),window.addEventListener("cart:refresh",()=>setTimeout(F,200)),window.addEventListener("cart:updated",()=>setTimeout(F,200))})();
