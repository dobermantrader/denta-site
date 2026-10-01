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

  // Отправка форм напрямую с сайта (без почтовой программы): POST в FormSubmit,
  // при недоступности сервиса — запасной вариант через письмо.
  // Адрес обработчика форм на РОССИЙСКОМ хостинге, например "https://ваш-домен.ru/send.php" (файл — в папке «для_хостинга»).
  // Пока пусто: форма открывает письмо в почтовой программе пациента, данные никуда за границу не передаются.
  var FORM_ENDPOINT = "";
  function sendForm(form, subject, lines, fields, onDone) {
    var success = form.parentElement.querySelector(".form-success");
    var btn = form.querySelector('button[type="submit"]');
    var btnText = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "Отправляем…"; }
    function showSuccess(viaMail) {
      if (btn) { btn.disabled = false; btn.textContent = btnText; }
      form.reset();
      if (success) {
        if (viaMail && !success.querySelector(".via-mail")) {
          var note = document.createElement("p");
          note.className = "via-mail"; note.style.margin = "0 0 10px";
          note.textContent = FORM_ENDPOINT
            ? "Сервис отправки сейчас недоступен — мы открыли письмо в вашей почтовой программе, нажмите в ней «Отправить»."
            : "Откроется письмо в вашей почтовой программе — нажмите в ней «Отправить». Если почта не настроена, позвоните: +7 (8152) 472-472.";
          var hd = success.querySelector("b"); if (hd) hd.textContent = "Осталось отправить письмо.";
          success.insertBefore(note, success.firstChild);
        }
        success.classList.add("is-visible"); success.setAttribute("tabindex", "-1"); success.focus();
      }
      if (onDone) onDone();
    }
    var payload = { subject: subject, page: location.pathname, _honey: "" };
    fields.forEach(function (f) { payload[f[0]] = f[1]; });
    var fallback = function () {
      window.location.href = "mailto:" + CLINIC_EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.join("\n"));
      showSuccess(true);
    };
    if (!window.fetch || !FORM_ENDPOINT) { fallback(); return; }
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 9000);
    fetch(FORM_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(payload), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { clearTimeout(timer); if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { if (d && (d.success === "true" || d.success === true)) showSuccess(false); else throw new Error("bad"); })
      .catch(function () { clearTimeout(timer); fallback(); });
  }

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
      var date = form.querySelector('[name="date"]');
      var time = form.querySelector('[name="time"]');
      if (date && date.value) {
        var d = date.value.split("-");
        lines.push("Удобный день: " + d[2] + "." + d[1] + "." + d[0]);
      }
      if (time && time.value && time.value !== "Любое") {
        lines.push("Удобное время: " + time.value);
      }
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

      var fields = [["Имя", nameInput.value.trim()], ["Телефон", phoneInput.value.trim()], ["Направление", service ? service.value : "—"]];
      if (date && date.value) fields.push(["Удобный день", date.value.split("-").reverse().join(".")]);
      if (time && time.value) fields.push(["Удобное время", time.value]);
      if (comment && comment.value.trim()) fields.push(["Комментарий", comment.value.trim()]);
      if (utm) UTM_PARAMS.forEach(function (key) { if (utm[key]) fields.push([key, utm[key]]); });
      sendForm(form, "Заявка на приём — сайт «Дента»", lines, fields);
    });
  });

  // Hero slideshow, two levels: quotes rotate inside the active doctor slide
  // (every 4.5 s); after the last quote the next doctor is shown. Autoplay
  // pauses on hover/focus and is disabled under prefers-reduced-motion.
  document.querySelectorAll("[data-slides]").forEach(function (root) {
    var slides = Array.prototype.slice.call(root.querySelectorAll(".hero__slide"));
    var dots = root.querySelector(".hero__dots");
    if (!slides.length) return;
    var QUOTE_MS = 6000, si = 0, qi = 0, timer = null;
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
      var fields = [];
      form.querySelectorAll("input, select, textarea").forEach(function (f) {
        if (!f.name) return;
        if (f.type === "radio" && !f.checked) return;
        if (f.type === "checkbox") { fields.push([f.name, f.checked ? f.value : "нет"]); return; }
        if (f.value.trim()) fields.push([f.name, f.value.trim()]);
      });
      sendForm(form, form.getAttribute("data-subject") || "Сообщение с сайта", lines, fields);
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
    if (comment && doctor) {
      var rest = comment.value.replace(/^К врачу: .*$/gm, "").replace(/^\s+|\s+$/g, "");
      comment.value = "К врачу: " + doctor + (rest ? "\n" + rest : "");
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


// Поле «удобный день»: не раньше сегодня и не дальше 60 дней
document.querySelectorAll('input[type="date"][data-date-min="today"]').forEach(function (inp) {
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var fmt = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  var now = new Date(), max = new Date(now.getTime() + 60 * 86400000);
  inp.min = fmt(now); inp.max = fmt(max);
});


// Рукописная строка под заголовком первого экрана — ровно по ширине блока «Лечим мурманчан / 40 лет»
(function () {
  var h1 = document.querySelector(".hero h1"), em = h1 && h1.querySelector("em"), line = h1 && h1.querySelector(".hero__title-line");
  if (!em || !line) return;
  function fit() {
    em.style.fontSize = "";
    var target = line.getBoundingClientRect().width, w = em.getBoundingClientRect().width;
    if (!target || !w) return;
    var cur = parseFloat(getComputedStyle(em).fontSize);
    em.style.fontSize = (cur * target / w).toFixed(2) + "px";
  }
  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  window.addEventListener("resize", fit);
})();

// Типограф: висящие предлоги, союзы и частицы не остаются в конце строки —
// пробел после них заменяется неразрывным; то же для «число + слово» и перед тире.
(function () {
  var WORDS = "в|во|на|за|к|ко|с|со|у|о|об|от|до|из|по|под|над|при|без|для|про|и|а|но|да|или|не|ни|же|ли|бы|что|как|это|то|мы|вы|он|я|их|её|его";
  var RE_SHORT = new RegExp("(^|[\\s(«„\"])(" + WORDS + ")[ \\t\\n]+(?=\\S)", "gi");
  var RE_NUM = /(\d)[ \t\n]+(?=[а-яёА-ЯЁ₽])/g;
  var RE_DASH = /[ \t\n]+—/g;
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1, NOSCRIPT: 1 };
  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  var nodes = [], n;
  while ((n = walker.nextNode())) { if (!SKIP[n.parentNode.nodeName] && /\S/.test(n.nodeValue)) nodes.push(n); }
  nodes.forEach(function (node) {
    var t = node.nodeValue, r = t;
    r = r.replace(RE_SHORT, "$1$2\u00A0").replace(RE_SHORT, "$1$2\u00A0");
    r = r.replace(RE_NUM, "$1\u00A0").replace(RE_DASH, "\u00A0—");
    if (r !== t) node.nodeValue = r;
  });
})();


// Стрелка в правом нижнем углу: клик — к началу предыдущего блока,
// повторный клик в течение 4 секунд — на самый верх страницы.
(function () {
  var btn = document.createElement("button");
  btn.type = "button"; btn.className = "to-top"; btn.setAttribute("aria-label", "К предыдущему блоку; повторно — наверх");
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  document.body.appendChild(btn);
  var last = 0;
  function blocks() {
    return Array.prototype.slice.call(document.querySelectorAll("main > section, main > .trust-bar")).map(function (s) { return s.getBoundingClientRect().top + window.pageYOffset; });
  }
  btn.addEventListener("click", function () {
    var now = Date.now(), y = window.pageYOffset;
    if (now - last < 4000) { window.scrollTo({ top: 0, behavior: "smooth" }); last = 0; return; }
    last = now;
    var prev = 0, header = (document.querySelector(".site-header") || {}).offsetHeight || 0;
    blocks().forEach(function (t) { if (t - header < y - 24) prev = t - header; });
    window.scrollTo({ top: Math.max(prev, 0), behavior: "smooth" });
  });
  function toggle() { btn.classList.toggle("is-visible", window.pageYOffset > 500); }
  window.addEventListener("scroll", toggle, { passive: true }); toggle();
})();


// Фильтр отзывов по врачам (страница «Отзывы»): ?doctor=pitaleva или кнопки-чипы
(function () {
  var bar = document.querySelector("[data-review-filter]");
  if (!bar) return;
  var cards = [].slice.call(document.querySelectorAll(".review-card--full[data-doctor]"));
  var empty = document.querySelector("[data-review-empty]");
  function apply(key) {
    var shown = 0;
    cards.forEach(function (c) { var ok = key === "all" || c.getAttribute("data-doctor") === key; c.hidden = !ok; if (ok) shown++; });
    [].forEach.call(bar.querySelectorAll("button"), function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-key") === key ? "true" : "false"); });
    if (empty) {
      empty.hidden = shown !== 0;
      if (!shown) {
        var btn = bar.querySelector('button[data-key="' + key + '"]');
        var nm = empty.querySelector("[data-name]"); if (nm && btn) nm.textContent = btn.getAttribute("data-name");
        var a = empty.querySelector("a"); if (a && btn) a.setAttribute("href", "#otzyv?d=" + encodeURIComponent(btn.getAttribute("data-name")));
      }
    }
  }
  bar.addEventListener("click", function (e) { var b = e.target.closest ? e.target.closest("button") : null; if (b) apply(b.getAttribute("data-key")); });
  var m = location.search.match(/[?&]doctor=([\w-]+)/);
  apply(m ? m[1] : "all");
})();

// Предзаполнение врача в форме отзыва: otzyvy.html#otzyv?d=ФИО
(function () {
  function run() {
    var m = location.hash.match(/^#otzyv\?d=(.*)$/);
    var sel = document.getElementById("fbDoctor");
    if (!m || !sel) return;
    var name = decodeURIComponent(m[1]);
    [].forEach.call(sel.options, function (o) { if (o.text.indexOf(name) === 0) sel.value = o.text; });
    var box = document.getElementById("otzyv"); if (box) box.scrollIntoView();
  }
  run(); window.addEventListener("hashchange", run);
})();
