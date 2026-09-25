/*
 * hero.js — سلايدر خلفيات الهيرو بمؤثرات انتقال متنوّعة
 * يتناوب مؤثر مختلف عند كل تبديل: تلاشٍ، تكبير للداخل/الخارج (Ken Burns)،
 * انزلاق يمين/يسار، تمويه (blur)، ودوران خفيف.
 */
(function () {
  "use strict";

  var EFFECTS = [
    "hfx-fade",
    "hfx-zoom-in",
    "hfx-slide-left",
    "hfx-blur",
    "hfx-zoom-out",
    "hfx-slide-right",
    "hfx-rotate"
  ];
  var INTERVAL = 6000; // مدة عرض كل صورة
  var SWAP = 1700;     // زمن بقاء الصورة السابقة تحت الجديدة أثناء الانتقال

  function injectCSS() {
    if (document.getElementById("hero-fx-style")) return;
    var css = document.createElement("style");
    css.id = "hero-fx-style";
    css.textContent =
      /* حيّد أي خلفية قديمة على قسم الهيرو حتى تظهر طبقات الصور خلفه */
      ".hero{background-color:transparent!important;background-image:none!important;}" +
      ".hero .hero-bg{position:absolute;inset:0;top:0;left:0;width:100%;height:100%;" +
      "background-size:cover;background-position:center;opacity:0;z-index:-2;padding:0;" +
      "transition:none;will-change:opacity,transform,filter;backface-visibility:hidden;}" +
      ".hero .hero-bg.hf-active{opacity:1;z-index:-1;}" +
      /* التلاشي */
      ".hero .hero-bg.hf-active.hfx-fade{animation:hfFade 1.6s ease both;}" +
      "@keyframes hfFade{from{opacity:0}to{opacity:1}}" +
      /* تكبير للداخل (Ken Burns) */
      ".hero .hero-bg.hf-active.hfx-zoom-in{animation:hfZoomIn 6.2s ease-out both;}" +
      "@keyframes hfZoomIn{0%{opacity:0;transform:scale(1.28)}18%{opacity:1}100%{opacity:1;transform:scale(1.02)}}" +
      /* تكبير للخارج */
      ".hero .hero-bg.hf-active.hfx-zoom-out{animation:hfZoomOut 6.2s ease-out both;}" +
      "@keyframes hfZoomOut{0%{opacity:0;transform:scale(1.02)}18%{opacity:1}100%{opacity:1;transform:scale(1.18)}}" +
      /* انزلاق من اليمين */
      ".hero .hero-bg.hf-active.hfx-slide-left{animation:hfSlideL 1.7s cubic-bezier(.22,.61,.36,1) both;}" +
      "@keyframes hfSlideL{0%{opacity:0;transform:translateX(8%) scale(1.08)}100%{opacity:1;transform:translateX(0) scale(1.06)}}" +
      /* انزلاق من اليسار */
      ".hero .hero-bg.hf-active.hfx-slide-right{animation:hfSlideR 1.7s cubic-bezier(.22,.61,.36,1) both;}" +
      "@keyframes hfSlideR{0%{opacity:0;transform:translateX(-8%) scale(1.08)}100%{opacity:1;transform:translateX(0) scale(1.06)}}" +
      /* تمويه */
      ".hero .hero-bg.hf-active.hfx-blur{animation:hfBlur 1.8s ease both;}" +
      "@keyframes hfBlur{0%{opacity:0;filter:blur(22px);transform:scale(1.1)}100%{opacity:1;filter:blur(0);transform:scale(1.04)}}" +
      /* دوران خفيف */
      ".hero .hero-bg.hf-active.hfx-rotate{animation:hfRotate 1.9s cubic-bezier(.22,.61,.36,1) both;}" +
      "@keyframes hfRotate{0%{opacity:0;transform:scale(1.18) rotate(2.6deg)}100%{opacity:1;transform:scale(1.05) rotate(0)}}" +
      /* تحسين وضوح النص فوق الصور المتغيّرة */
      ".hero .text-group h1{text-shadow:0 2px 14px rgba(0,0,0,.55),0 1px 3px rgba(0,0,0,.6);}" +
      "@media (prefers-reduced-motion: reduce){.hero .hero-bg.hf-active{animation:hfFade .6s ease both!important;}}";
    document.head.appendChild(css);
  }

  function initHero(hero) {
    var slides = Array.prototype.slice.call(hero.querySelectorAll(".hero-bg"));
    // نظّف الكلاس القديم
    slides.forEach(function (s) { s.classList.remove("active"); });
    if (slides.length === 0) return;
    if (slides.length === 1) { slides[0].classList.add("hf-active", "hfx-fade"); return; }

    var cur = 0, fxi = 0;
    slides[0].classList.add("hf-active", "hfx-fade");

    function clearFx(el) { EFFECTS.forEach(function (e) { el.classList.remove(e); }); }

    function next() {
      var prev = slides[cur];
      cur = (cur + 1) % slides.length;
      var el = slides[cur];
      var effect = EFFECTS[fxi % EFFECTS.length];
      fxi++;
      clearFx(el);
      el.classList.remove("hf-active");
      void el.offsetWidth; // إعادة تدفّق لإعادة تشغيل الأنيميشن
      el.classList.add("hf-active", effect);
      setTimeout(function () { prev.classList.remove("hf-active"); clearFx(prev); }, SWAP);
    }

    setInterval(next, INTERVAL);
  }

  function start() {
    injectCSS();
    Array.prototype.forEach.call(document.querySelectorAll(".hero"), initHero);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
