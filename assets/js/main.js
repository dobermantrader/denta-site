(function () {
  "use strict";

  // Mobile navigation toggle
  var header = document.querySelector(".site-header");
  var navToggle = document.querySelector(".nav-toggle");
  if (navToggle && header) {
    navToggle.addEventListener("click", function () {
      var isOpen = header.classList.toggle("nav-open");
      navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
    header.querySelectorAll(".main-nav__links a").forEach(function (link) {
      link.addEventListener("click", function () {
        header.classList.remove("nav-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // "Версия для слабовидящих" — persisted per browser
  var A11Y_KEY = "denta-a11y-mode";
  var a11yButtons = document.querySelectorAll("[data-a11y-toggle]");
  function applyA11y(on) {
    document.documentElement.classList.toggle("a11y-mode", on);
    a11yButtons.forEach(function (btn) {
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.textContent = on ? "Обычная версия" : "Версия для слабовидящих";
    });
  }
  try {
    applyA11y(localStorage.getItem(A11Y_KEY) === "1");
  } catch (e) { /* localStorage unavailable */ }
  a11yButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var on = !document.documentElement.classList.contains("a11y-mode");
      applyA11y(on);
      try { localStorage.setItem(A11Y_KEY, on ? "1" : "0"); } catch (e) {}
    });
  });

  // UTM capture: remembers how the visitor arrived (ad campaign, source)
  // for the length of the browser session, so the booking email below
  // still carries it even if the person lands on one page (e.g. from an
  // ad to uslugi.html) and submits the form from another (kontakty.html).
  var UTM_KEY = "denta-utm";
  var UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  (function captureUtm() {
    var params = new URLSearchParams(window.location.search);
    var found = {};
    var hasAny = false;
    UTM_PARAMS.forEach(function (key) {
      var val = params.get(key);
      if (val) {
        found[key] = val;
        hasAny = true;
      }
    });
    if (hasAny) {
      try { sessionStorage.setItem(UTM_KEY, JSON.stringify(found)); } catch (e) {}
    }
  })();
  function readUtm() {
    try {
      var raw = sessionStorage.getItem(UTM_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // Booking form: validates fields, then opens the visitor's mail client
  // with a pre-filled letter to the clinic (no backend required).
  var CLINIC_EMAIL = "oao-denta@yandex.ru";
  var PHONE_RE = /^[+()\d\s-]{7,20}$/;

  document.querySelectorAll("form[data-booking-form]").forEach(function (form) {
    var nameInput = form.querySelector('[name="name"]');
    var phoneInput = form.querySelector('[name="phone"]');

    function setError(input, on) {
      input.setAttribute("aria-invalid", on ? "true" : "false");
      var err = form.querySelector('[data-error-for="' + input.name + '"]');
      if (err) err.classList.toggle("is-visible", on);
    }

    [nameInput, phoneInput].forEach(function (input) {
      if (!input) return;
      input.addEventListener("input", function () { setError(input, false); });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var ok = true;
      if (nameInput && nameInput.value.trim().length < 2) {
        setError(nameInput, true);
        ok = false;
      }
      if (phoneInput && !PHONE_RE.test(phoneInput.value.trim())) {
        setError(phoneInput, true);
        ok = false;
      }
      if (!ok) return;
      setError(nameInput, false);
      setError(phoneInput, false);

      var service = form.querySelector('[name="service"]');
      var comment = form.querySelector('[name="comment"]');
      var lines = [
        "Заявка на приём с сайта",
        "",
        "Имя: " + nameInput.value.trim(),
        "Телефон: " + phoneInput.value.trim(),
        "Направление: " + (service ? service.value : "—"),
      ];
      if (comment && comment.value.trim()) {
        lines.push("Комментарий: " + comment.value.trim());
      }

      var utm = readUtm();
      if (utm) {
        lines.push("");
        lines.push("Источник (метки перехода):");
        UTM_PARAMS.forEach(function (key) {
          if (utm[key]) lines.push("  " + key + ": " + utm[key]);
        });
      }

      var mailto =
        "mailto:" + CLINIC_EMAIL +
        "?subject=" + encodeURIComponent("Заявка на приём — сайт «Дента»") +
        "&body=" + encodeURIComponent(lines.join("\n"));

      var success = form.parentElement.querySelector(".form-success");
      if (success) {
        success.classList.add("is-visible");
        success.setAttribute("tabindex", "-1");
        success.focus();
      }
      window.location.href = mailto;
    });
  });

  // Hero slideshow, two levels: quotes rotate inside the active doctor slide
  // (every 4.5 s); after the last quote the next doctor is shown. Autoplay
  // pauses on hover/focus and is disabled under prefers-reduced-motion.
  document.querySelectorAll("[data-slides]").forEach(function (root) {
    var slides = Array.prototype.slice.call(root.querySelectorAll(".hero__slide"));
    var dots = root.querySelector(".hero__dots");
    if (!slides.length) return;
    var QUOTE_MS = 4500, si = 0, qi = 0, timer = null;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function quotesOf(slide) { return Array.prototype.slice.call(slide.querySelectorAll(".hero__review")); }
    function paint() {
      slides.forEach(function (s, k) {
        var on = k === si;
        s.classList.toggle("is-active", on);
        quotesOf(s).forEach(function (q, j) { q.classList.toggle("is-active", on && j === qi); });
      });
      if (dots) Array.prototype.forEach.call(dots.children, function (d, k) { d.setAttribute("aria-selected", k === si ? "true" : "false"); });
    }
    function step() {
      var n = quotesOf(slides[si]).length;
      if (qi + 1 < n) { qi += 1; } else { qi = 0; si = (si + 1) % slides.length; }
      paint();
    }
    function goSlide(k) { si = k; qi = 0; paint(); restart(); }
    if (dots) slides.forEach(function (_, k) {
      var b = document.createElement("button");
      b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-label", "Врач " + (k + 1));
      b.addEventListener("click", function () { goSlide(k); });
      dots.appendChild(b);
    });
    function start() { if (!reduce && !timer) timer = setInterval(step, QUOTE_MS); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function restart() { stop(); start(); }
    root.addEventListener("mouseenter", stop); root.addEventListener("mouseleave", start);
    root.addEventListener("focusin", stop); root.addEventListener("focusout", start);
    paint(); start();
  });


  // Generic mail forms (e.g. patient reviews): validates required fields,
  // then opens a pre-filled letter to the clinic. No backend needed.
  document.querySelectorAll("form[data-mail-form]").forEach(function (form) {
    var CLINIC = "oao-denta@yandex.ru";
    function setErr(field, on) {
      field.setAttribute("aria-invalid", on ? "true" : "false");
      var err = field.parentElement.querySelector(".field-error");
      if (err) err.classList.toggle("is-visible", on);
    }
    form.querySelectorAll("[required]").forEach(function (f) {
      f.addEventListener("input", function () { setErr(f, false); });
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      form.querySelectorAll("[required]").forEach(function (f) {
        var min = parseInt(f.getAttribute("data-min") || "1", 10);
        var bad = f.value.trim().length < min;
        setErr(f, bad);
        if (bad) ok = false;
      });
      if (!ok) return;
      var lines = [form.getAttribute("data-subject") || "Сообщение с сайта", ""];
      form.querySelectorAll("input, select, textarea").forEach(function (f) {
        if (!f.name) return;
        if (f.type === "radio" && !f.checked) return;
        if (f.type === "checkbox") { lines.push(f.name + ": " + (f.checked ? f.value : "нет")); return; }
        if (f.value.trim()) lines.push(f.name + ": " + f.value.trim());
      });
      var success = form.parentElement.querySelector(".form-success");
      if (success) { success.classList.add("is-visible"); success.setAttribute("tabindex", "-1"); success.focus(); }
      window.location.href = "mailto:" + CLINIC + "?subject=" + encodeURIComponent(form.getAttribute("data-subject") || "Сообщение с сайта") + "&body=" + encodeURIComponent(lines.join("\n"));
    });
  });


  // Form prefill: CTAs carry data-service / data-doctor. On the same page the
  // form is filled immediately; across pages the choice travels in the hash
  // (#zapis?s=...&d=...) so kontakty.html can pick it up.
  function prefillForm(service, doctor) {
    var sel = document.querySelector('form[data-booking-form] select[name="service"]');
    var comment = document.querySelector('form[data-booking-form] textarea[name="comment"]');
    if (sel && service) {
      Array.prototype.forEach.call(sel.options, function (o) { if (o.text === service) sel.value = o.text; });
    }
    if (comment && doctor && comment.value.indexOf(doctor) === -1) {
      comment.value = ("К врачу: " + doctor + (comment.value ? "\n" + comment.value : ""));
    }
  }
  document.querySelectorAll("a[data-service], a[data-doctor]").forEach(function (a) {
    a.addEventListener("click", function () {
      var s = a.getAttribute("data-service") || "", d = a.getAttribute("data-doctor") || "";
      var href = a.getAttribute("href") || "";
      if (href.indexOf("#") === 0) { prefillForm(s, d); return; }
      var q = [];
      if (s) q.push("s=" + encodeURIComponent(s));
      if (d) q.push("d=" + encodeURIComponent(d));
      if (q.length) a.setAttribute("href", href.split("?")[0] + "?" + q.join("&"));
    });
  });
  (function () {
    var m = location.hash.match(/^#zapis\?(.*)$/);
    if (!m) return;
    var params = {};
    m[1].split("&").forEach(function (kv) { var p = kv.split("="); params[p[0]] = decodeURIComponent(p[1] || ""); });
    prefillForm(params.s, params.d);
    var el = document.getElementById("zapis");
    if (el) el.scrollIntoView();
  })();

})();
