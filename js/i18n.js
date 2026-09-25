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
    try { document.dispatchEvent(new CustomEvent("i18n:changed", { detail: { lang: lang } })); } catch (e) {}
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
    var saved = "ar";
    try { saved = localStorage.getItem(STORAGE) || "ar"; } catch (e) {}
    if (saved === "en") setLang("en");
    else { window.__siteLang = "ar"; }
    startObserver();
    // أبلغ الأزرار (nav.js) بالحالة الابتدائية
    try { document.dispatchEvent(new CustomEvent("i18n:changed", { detail: { lang: window.__siteLang } })); } catch (e) {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.I18N = { setLang: setLang, getLang: function () { return window.__siteLang; } };
})();
