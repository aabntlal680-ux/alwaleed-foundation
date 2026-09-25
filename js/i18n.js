/*
 * i18n.js — محرّك ترجمة عربي/إنجليزي لموقع مؤسسة الوليد الإنسانية
 * - يترجم النصوص المرئية و placeholder و title و alt و aria-label وعنوان التبويب
 * - يحفظ اختيار اللغة في localStorage ويطبّقه على كل الصفحات
 * - يترجم أيضًا المحتوى الذي يُضاف ديناميكيًا (جداول Firebase ورسائل الحالة)
 */
(function () {
  "use strict";
  var DICT = window.I18N_DICT || {};
  var STORAGE = "site_lang";
  var ATTRS = ["placeholder", "title", "aria-label", "alt"];
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1, OPTION: 0 };

  var origText = new WeakMap(); // textNode -> النص العربي الأصلي
  var origAttr = new WeakMap(); // element  -> { attr: القيمة الأصلية }
  var titleAr = null;
  window.__siteLang = "ar";

  function norm(s) { return (s || "").replace(/\s+/g, " ").trim(); }

  function skipParent(node) {
    var p = node.parentNode;
    if (!p) return true;
    if (SKIP_TAGS[p.nodeName]) return true;
    if (p.closest && p.closest("[data-i18n-skip]")) return true;
    return false;
  }

  function tText(node, toEn) {
    if (skipParent(node)) return;
    if (toEn) {
      var base = origText.has(node) ? origText.get(node) : node.nodeValue;
      var k = norm(base);
      if (k && DICT[k] !== undefined) {
        if (!origText.has(node)) origText.set(node, node.nodeValue);
        var m = node.nodeValue.match(/^(\s*)[\s\S]*?(\s*)$/);
        node.nodeValue = (m ? m[1] : "") + DICT[k] + (m ? m[2] : "");
      }
    } else if (origText.has(node)) {
      node.nodeValue = origText.get(node);
    }
  }

  function tAttrs(el, toEn) {
    if (el.closest && el.closest("[data-i18n-skip]")) return;
    var store = origAttr.get(el) || {};
    ATTRS.forEach(function (a) {
      if (toEn) {
        if (!el.hasAttribute(a)) return;
        var cur = (a in store) ? store[a] : el.getAttribute(a);
        var k = norm(cur);
        if (k && DICT[k] !== undefined) {
          if (!(a in store)) { store[a] = el.getAttribute(a); origAttr.set(el, store); }
          el.setAttribute(a, DICT[k]);
        }
      } else if (a in store) {
        el.setAttribute(a, store[a]);
      }
    });
  }

  function walk(root, toEn) {
    if (!root) return;
    if (root.nodeType === 1) {
      var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var n, list = [];
      while ((n = w.nextNode())) list.push(n);
      list.forEach(function (nd) { tText(nd, toEn); });
      if (root.matches && root.matches("[placeholder],[title],[aria-label],[alt]")) tAttrs(root, toEn);
      var els = root.querySelectorAll("[placeholder],[title],[aria-label],[alt]");
      Array.prototype.forEach.call(els, function (el) { tAttrs(el, toEn); });
    } else if (root.nodeType === 3) {
      tText(root, toEn);
    }
  }

  function tTitle(toEn) {
    if (toEn) {
      if (titleAr === null) titleAr = document.title;
      var k = norm(titleAr);
      if (DICT[k] !== undefined) document.title = DICT[k];
    } else if (titleAr !== null) {
      document.title = titleAr;
    }
  }

  function setLang(lang) {
    var toEn = lang === "en";
    document.documentElement.setAttribute("lang", toEn ? "en" : "ar");
    document.documentElement.setAttribute("dir", toEn ? "ltr" : "rtl");
    walk(document.body, toEn);
    tTitle(toEn);
    try { localStorage.setItem(STORAGE, lang); } catch (e) {}
    window.__siteLang = lang;
    updateBtn(lang);
  }

  /* ----- زر تبديل اللغة ----- */
  var btn;
  function updateBtn(lang) {
    if (!btn) return;
    var toAr = lang === "en";
    btn.querySelector(".lang-label").textContent = toAr ? "العربية" : "English";
    btn.setAttribute("title", toAr ? "التبديل إلى العربية" : "Switch to English");
  }
  function injectButton() {
    if (document.querySelector(".lang-toggle")) return;
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lang-toggle";
    btn.setAttribute("data-i18n-skip", "");
    btn.setAttribute("aria-label", "Language");
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>' +
      '<span class="lang-label">English</span>';
    var css = document.createElement("style");
    css.textContent =
      ".lang-toggle{position:fixed;bottom:104px;left:30px;z-index:3000;display:flex;align-items:center;gap:8px;" +
      "background:#0d3b66;color:#fff;border:2px solid rgba(255,255,255,.85);border-radius:50px;" +
      "padding:10px 16px;font-family:'Cairo',Tahoma,sans-serif;font-weight:bold;font-size:.9rem;cursor:pointer;" +
      "box-shadow:2px 2px 12px rgba(0,0,0,.25);transition:transform .3s ease,background .3s ease;line-height:1;}" +
      ".lang-toggle:hover{transform:scale(1.06);background:#12508c;}" +
      ".lang-toggle svg{flex:0 0 auto;}";
    document.head.appendChild(css);
    btn.addEventListener("click", function () {
      setLang(window.__siteLang === "en" ? "ar" : "en");
    });
    document.body.appendChild(btn);
    positionButton();
    window.addEventListener("resize", positionButton);
  }
  // ضع زر اللغة فوق أعلى زر عائم في الجهة اليسرى (واتساب/الأسئلة الشائعة)
  function positionButton() {
    if (!btn) return;
    var floats = document.querySelectorAll(".whatsapp-float,.faq-floating-btn");
    var H = window.innerHeight, highestTop = null;
    Array.prototype.forEach.call(floats, function (el) {
      if (el === btn) return;
      var r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      if (r.left > window.innerWidth / 2) return; // فقط الأزرار على اليسار
      if (highestTop === null || r.top < highestTop) highestTop = r.top;
    });
    if (highestTop !== null) btn.style.bottom = Math.round(H - highestTop + 14) + "px";
  }

  /* ----- مراقبة المحتوى الديناميكي ----- */
  function startObserver() {
    if (!("MutationObserver" in window)) return;
    var mo = new MutationObserver(function (muts) {
      if (window.__siteLang !== "en") return;
      muts.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes, function (node) {
          if (node.nodeType === 1 || node.nodeType === 3) walk(node, true);
        });
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    injectButton();
    var saved = "ar";
    try { saved = localStorage.getItem(STORAGE) || "ar"; } catch (e) {}
    if (saved === "en") setLang("en");
    else { window.__siteLang = "ar"; updateBtn("ar"); }
    startObserver();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.I18N = { setLang: setLang };
})();
