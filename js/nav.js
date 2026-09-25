/*
 * nav.js — شريط تنقّل متجاوب + زر تبديل اللغة داخل الهيدر
 * - يضع زر اللغة داخل الهيدر (وليس عائمًا) ويزامنه مع محرّك i18n
 * - على الشاشات الصغيرة: يخفي روابط القائمة ويُظهر أيقونة الثلاث شرطات
 *   التي تفتح قائمة منسدلة بصفحات الموقع
 */
(function () {
  "use strict";

  var GLOBE =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';

  function buildLangButton() {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lang-toggle";
    btn.setAttribute("data-i18n-skip", "");
    btn.setAttribute("aria-label", "Language");
    btn.innerHTML = GLOBE + '<span class="lang-label"></span>';
    function curLang() {
      return (window.I18N && window.I18N.getLang && window.I18N.getLang()) ||
        document.documentElement.getAttribute("lang") || "ar";
    }
    function sync() {
      var toAr = curLang() === "en";
      var lbl = btn.querySelector(".lang-label");
      if (lbl) lbl.textContent = toAr ? "العربية" : "English";
      btn.title = toAr ? "التبديل إلى العربية" : "Switch to English";
    }
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      if (window.I18N && window.I18N.setLang) window.I18N.setLang(curLang() === "en" ? "ar" : "en");
    });
    document.addEventListener("i18n:changed", sync);
    sync();
    return btn;
  }

  function injectCSS() {
    if (document.getElementById("nav-i18n-style")) return;
    var s = document.createElement("style");
    s.id = "nav-i18n-style";
    s.textContent =
      /* زر اللغة داخل الهيدر */
      ".lang-toggle{display:inline-flex;align-items:center;gap:6px;width:auto!important;max-width:none;" +
      "background:#008444;color:#fff!important;border:1.5px solid rgba(255,255,255,.7);border-radius:50px;" +
      "padding:6px 14px!important;margin:0!important;font-family:'Cairo',Tahoma,sans-serif;font-weight:bold;" +
      "font-size:.8rem;line-height:1;cursor:pointer;white-space:nowrap;transition:background .3s,transform .2s;}" +
      ".lang-toggle:hover{background:#00a152;transform:translateY(-1px);}" +
      ".lang-toggle svg{flex:0 0 auto;}" +
      ".lang-toggle .lang-label{color:#fff;}" +
      "header nav ul li.lang-li{display:flex;align-items:center;}" +
      /* أيقونة الهامبرغر: مخفية على الشاشات الكبيرة */
      "header nav ul li.nav-toggle-item{display:none;font-size:1.4rem;line-height:1;padding:4px 6px;}" +
      "header nav ul li.nav-toggle-item i{color:#00c853;cursor:pointer;}" +
      /* القائمة المنسدلة للجوال */
      ".mobile-nav{display:none;position:absolute;top:100%;left:0;right:0;width:100%;box-sizing:border-box;" +
      "background:rgba(0,0,0,.95);border-top:2px solid #008444;box-shadow:0 8px 20px rgba(0,0,0,.4);" +
      "z-index:200;max-height:80vh;overflow-y:auto;}" +
      ".mobile-nav.open{display:block;animation:navDrop .25s ease;}" +
      "@keyframes navDrop{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}" +
      ".mobile-nav ul{list-style:none;margin:0;padding:8px 0;}" +
      ".mobile-nav li{margin:0;}" +
      ".mobile-nav a{display:block;padding:14px 24px;color:#fff;text-decoration:none;font-weight:bold;" +
      "font-size:1rem;border-bottom:1px solid rgba(255,255,255,.08);transition:background .2s;}" +
      ".mobile-nav a:hover{background:rgba(0,132,68,.35);}" +
      /* نقطة الكسر: أظهر الهامبرغر وأخفِ الروابط الأفقية */
      "@media (max-width:768px){" +
      "header nav ul li.nav-link-item{display:none!important;}" +
      "header nav ul li.nav-toggle-item{display:flex!important;align-items:center;}" +
      "header nav ul{gap:10px!important;}" +
      "}" +
      /* الطفو الاحتياطي عند غياب الهيدر (صفحات دون شريط تنقّل) */
      ".lang-toggle.lang-toggle--float{position:fixed;bottom:24px;left:24px;z-index:3000;" +
      "padding:9px 16px!important;font-size:.9rem;box-shadow:2px 2px 12px rgba(0,0,0,.3);}";
    document.head.appendChild(s);
  }

  function setup() {
    injectCSS();
    var header = document.querySelector("header#header, header.site-header");
    var ul = header ? header.querySelector("nav ul") : null;
    var langBtn = buildLangButton();

    if (!header || !ul) {
      langBtn.classList.add("lang-toggle--float");
      document.body.appendChild(langBtn);
      return;
    }

    // تصنيف عناصر القائمة
    var links = [];
    var toggleLi = null;
    Array.prototype.slice.call(ul.children).forEach(function (li) {
      if (li.querySelector && li.querySelector("a")) {
        li.classList.add("nav-link-item");
        links.push(li);
      } else if (li.querySelector && li.querySelector("i.fa-bars, .fa-bars")) {
        li.classList.add("nav-toggle-item");
        toggleLi = li;
      }
    });

    // إن لم توجد أيقونة هامبرغر، أنشئ واحدة
    if (!toggleLi) {
      toggleLi = document.createElement("li");
      toggleLi.className = "nav-toggle-item";
      toggleLi.innerHTML = '<i class="fas fa-bars" aria-hidden="true">\u2630</i>';
      ul.appendChild(toggleLi);
    }

    // أدرج زر اللغة كعنصر قائمة قبل أيقونة الهامبرغر
    var langLi = document.createElement("li");
    langLi.className = "lang-li";
    langLi.appendChild(langBtn);
    ul.insertBefore(langLi, toggleLi);

    // ابنِ القائمة المنسدلة للجوال من الروابط الحالية
    var menu = document.createElement("div");
    menu.className = "mobile-nav";
    var mUl = document.createElement("ul");
    links.forEach(function (li) {
      var a = li.querySelector("a");
      if (!a) return;
      var na = document.createElement("a");
      na.href = a.getAttribute("href");
      if (a.getAttribute("target")) na.setAttribute("target", a.getAttribute("target"));
      na.textContent = a.textContent;
      var mli = document.createElement("li");
      mli.appendChild(na);
      mUl.appendChild(mli);
    });
    menu.appendChild(mUl);
    if (getComputedStyle(header).position === "static") header.style.position = "relative";
    header.appendChild(menu);

    // ربط الأيقونة بفتح/إغلاق القائمة
    toggleLi.style.cursor = "pointer";
    toggleLi.setAttribute("role", "button");
    toggleLi.setAttribute("tabindex", "0");
    toggleLi.setAttribute("aria-label", "القائمة");
    function toggleMenu(e) { if (e) e.stopPropagation(); menu.classList.toggle("open"); }
    toggleLi.addEventListener("click", toggleMenu);
    toggleLi.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleMenu(); }
    });
    mUl.addEventListener("click", function (e) {
      if (e.target && e.target.tagName === "A") menu.classList.remove("open");
    });
    document.addEventListener("click", function (e) {
      if (menu.classList.contains("open") && !menu.contains(e.target) && !toggleLi.contains(e.target)) {
        menu.classList.remove("open");
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup);
  else setup();
})();
