// Содержимое сайта из файлов data/*.json (их редактирует администратор в панели admin/).
// Если файлы недоступны, остаётся статическая вёрстка страницы — сайт работает и без этого скрипта.
(function () {
  "use strict";

  var YEAR = new Date().getFullYear();
  var CLINIC_PHOTO = "assets/img/priem.jpg";
  var PRICE_SEED = "01.09.2026";            // дата прейскуранта, записанная в статической вёрстке
  var LICENSE_SEED = "28.08.2024";          // дата выписки из реестра лицензий в статической вёрстке
  var MATCH = { price: "preyskurant", policy: "politika-konfidencialnosti", license: "vypiska-iz-reestra" };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function plural(n, f) {
    var a = n % 10, b = n % 100;
    if (a === 1 && b !== 11) return f[0];
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return f[1];
    return f[2];
  }
  function yearsLabel(y) { var n = YEAR - y; return n + " " + plural(n, ["год", "года", "лет"]); }
  function fmtDate(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ""); return m ? m[3] + "." + m[2] + "." + m[1] : ""; }
  function shortName(full) {
    var p = String(full).split(/\s+/);
    return p[0] + (p[1] ? " " + p[1].charAt(0) + "." : "") + (p[2] ? " " + p[2].charAt(0) + "." : "");
  }
  function byOrder(a, b) { return (a.order || 0) - (b.order || 0); }
  function getJson(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(url + " " + r.status); return r.json(); }).catch(function () { return null; });
  }
  function telHref(v) {
    var d = String(v).replace(/\D/g, "");
    if (d.length === 11 && d.charAt(0) === "8") d = "7" + d.slice(1);
    return "tel:+" + d;
  }

  var BOOK = document.getElementById("zapis") ? "#zapis" : "kontakty.html#zapis";
  var PDF_ICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm7 1.5V8h4.5L13 3.5zM8 13h8v1.5H8V13zm0 3h8v1.5H8V16z"/></svg>';

  // ---------- врачи ----------
  function photoOrAvatar(d, cls, alt) {
    return d.photo
      ? '<img class="' + cls + '" src="' + esc(d.photo) + '" alt="' + esc(alt) + '" loading="lazy">'
      : '<div class="' + (cls === "doctor__photo" ? "" : cls + " ") + 'avatar" aria-hidden="true">' + esc(d.initials || "") + "</div>";
  }

  function teamCard(d, ctx) {
    var since = d.gradYear
      ? '<p class="doctor__since">' + (d.group === "director" ? "Врач-стоматолог, в профессии с " : "В профессии с ") + d.gradYear + " года<br>Стаж — " + yearsLabel(d.gradYear) + "</p>"
      : "";
    var n = ctx.counts[d.id] || 0;
    var tag = n ? '<a class="doctor__tag" href="otzyvy.html?doctor=' + esc(d.id) + '#otzyvy-list">' + n + " " + plural(n, ["отзыв", "отзыва", "отзывов"]) + " о враче →</a>" : "";
    var btn = (d.group === "director" || d.bookable === false)
      ? '<a class="btn btn--outline btn--sm" href="mailto:oao-denta@yandex.ru">Написать директору</a>'
      : '<a class="btn btn--outline btn--sm" href="' + BOOK + '" data-doctor="' + esc(d.name) + '">Записаться к врачу</a>';
    return '<div class="doctor">' + photoOrAvatar(d, "doctor__photo", d.name) +
      '<div class="doctor__body"><h3><a href="vrachi.html#' + esc(d.id) + '">' + esc(d.name) + "</a></h3>" + since +
      '<p class="role">' + esc(d.short || d.role || "") + "</p>" + tag + "</div>" + btn + "</div>";
  }

  function profile(d, ctx) {
    var accr = d.accr || [];
    var lab = (accr.length === 1 && accr[0].indexOf("сертификат") !== 0) ? "Аккредитация" : "Квалификация";
    var facts = [];
    if (d.edu) facts.push(["Образование", esc(d.edu) + (d.gradYear ? ", " + d.gradYear : "")]);
    if (d.gradYear) { facts.push(["В профессии", "с " + d.gradYear + " года"]); facts.push(["Стаж", yearsLabel(d.gradYear)]); }
    if (accr.length) facts.push([lab, esc(accr.join("; "))]);
    (d.extra || []).forEach(function (e) {
      facts.push([esc(e[0]), /телефон/i.test(e[0]) ? '<a href="' + telHref(e[1]) + '">' + esc(e[1]) + "</a>" : esc(e[1])]);
    });
    var dl = '<dl class="profile__facts">' + facts.map(function (f) { return "<div><dt>" + f[0] + "</dt><dd>" + f[1] + "</dd></div>"; }).join("") + "</dl>";
    var does = d.does ? '<p class="profile__does"><b>С чем приходят:</b> ' + esc(d.does) + ".</p>" : "";
    var quotes = (ctx.byDoctor[d.id] || []).slice(0, 2).map(function (r) {
      return '<blockquote class="profile__quote"><p>«' + esc(r.text) + "»</p><cite>" + esc(r.author) + " · отзыв пациента</cite></blockquote>";
    }).join("");
    var n = (ctx.byDoctor[d.id] || []).length;
    var link = n
      ? '<a class="profile__review-link" href="otzyvy.html?doctor=' + esc(d.id) + '#otzyvy-list">Все отзывы о враче (' + n + ") →</a>"
      : '<a class="profile__review-link" href="otzyvy.html#otzyv?d=' + encodeURIComponent(d.name) + '">Отзывов пока нет — оставьте первым</a>';
    var btn = (d.group === "director" || d.bookable === false)
      ? '<a class="btn btn--outline btn--sm" href="mailto:oao-denta@yandex.ru">Написать директору</a>'
      : '<a class="btn btn--primary btn--sm" href="kontakty.html#zapis" data-doctor="' + esc(d.name) + '">Записаться к врачу</a>';
    return '<article class="profile' + (d.group === "director" ? " profile--director" : "") + '" id="' + esc(d.id) + '">' +
      photoOrAvatar(d, "profile__photo", d.name + ", " + String(d.role || "").toLowerCase()) +
      '<div class="profile__body"><h3>' + esc(d.name) + '</h3><p class="role">' + esc(d.role || "") + "</p>" + dl + does + quotes + link + btn + "</div></article>";
  }

  function orthoCard(d, ctx) {
    return teamCard(d, ctx).replace('href="' + BOOK + '"', 'href="kontakty.html#zapis"');
  }

  // ---------- отзывы ----------
  function reviewLabel(isDoc) { return isDoc ? "Отзыв о враче" : "Отзыв о клинике"; }

  function reviewFull(r, docMap) {
    var doc = docMap[r.doctor];
    var src = doc
      ? '<a class="review-src" href="vrachi.html#' + esc(doc.id) + '">о враче: ' + esc(shortName(doc.name)) + " →</a>"
      : '<span class="review-src">о клинике' + (r.source ? " · " + esc(r.source) : "") + "</span>";
    return '<article class="review-card review-card--full" data-doctor="' + (doc ? esc(doc.id) : "clinic") + '"><span class="fear-label">' + reviewLabel(!!doc) +
      '</span><p class="quote">«' + esc(r.text) + '»</p><div class="review-meta"><p class="author">' + esc(r.author) + "</p>" + src + "</div></article>";
  }

  function reviewHome(r, docMap) {
    var doc = docMap[r.doctor];
    return '<div class="review-card"><span class="fear-label">' + reviewLabel(!!doc) + '</span><p class="quote">«' + esc(r.short || r.text) + '»</p><p class="author">' + esc(r.author) +
      (doc ? ' · о враче: <a href="vrachi.html#' + esc(doc.id) + '">' + esc(shortName(doc.name)) + "</a>" : "") + "</p></div>";
  }

  function slideHtml(r, docMap, allDocs, active) {
    var pd = allDocs[r.sliderPhoto];
    var src = (pd && pd.photo) ? pd.photo : CLINIC_PHOTO;
    var name = pd ? pd.name : "Клиника «Дента»";
    var role = pd ? (pd.slideRole || "") : "ул. Коммуны, 20, Мурманск";
    var pos = (pd && pd.photo && pd.photoPos) ? pd.photoPos : "50% 40%";
    return '<figure class="hero__slide' + (active ? " is-active" : "") + '"><img class="hero__photo" src="' + esc(src) + '" alt="' + esc(name) + '" style="object-position:' + esc(pos) + '">' +
      '<figcaption><div class="hero__reviews"><blockquote class="hero__review"><span class="hero__tag">' + reviewLabel(!!docMap[r.doctor]) + '</span><p class="hero__quote">«' + esc(r.short || r.text) +
      "»</p><cite>" + esc(r.author) + "</cite></blockquote></div><b>" + esc(name) + "</b><span>" + esc(role) + "</span></figcaption></figure>";
  }

  // ---------- документы ----------
  function docCard(d) {
    var note = d.note || "";
    if (d.key === "price") note = "действует с " + fmtDate(d.date);
    if (d.key === "license") note = "по состоянию на " + fmtDate(d.date);
    var meta = "PDF" + (d.size ? ", " + (Math.round(d.size / 104857.6) / 10) + " МБ" : "") + (note ? " · " + note : "");
    return '<a class="doc-card" href="' + esc(d.file) + '" target="_blank" rel="noopener">' + PDF_ICO + "<span><b>" + esc(d.title) + "</b><small>" + esc(meta) + "</small></span></a>";
  }

  function replaceText(from, to) {
    if (!from || from === to) return;
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), n, list = [];
    while ((n = w.nextNode())) {
      var p = n.parentNode.nodeName;
      if (p !== "SCRIPT" && p !== "STYLE" && n.nodeValue.indexOf(from) !== -1) list.push(n);
    }
    list.forEach(function (node) { node.nodeValue = node.nodeValue.split(from).join(to); });
  }

  function typo(el) { if (window.__dentaTypo && el) window.__dentaTypo(el); }

  // ---------- сборка ----------
  Promise.all([getJson("data/doctors.json"), getJson("data/reviews.json"), getJson("data/documents.json")]).then(function (res) {
    var doctorsRaw = res[0] && Array.isArray(res[0].doctors) ? res[0].doctors : null;
    var reviewsRaw = res[1] && Array.isArray(res[1].reviews) ? res[1].reviews : null;
    var docsRaw = res[2] && Array.isArray(res[2].docs) ? res[2].docs : null;

    var docs = doctorsRaw ? doctorsRaw.filter(function (d) { return d && d.id && d.visible !== false; }).sort(byOrder) : [];
    var docMap = {}, allDocs = {};
    if (doctorsRaw) { doctorsRaw.forEach(function (d) { allDocs[d.id] = d; }); docs.forEach(function (d) { docMap[d.id] = d; }); }
    var revs = reviewsRaw ? reviewsRaw.filter(function (r) { return r && r.text && r.author; }).sort(byOrder) : [];

    var byDoctor = {}, counts = {};
    revs.forEach(function (r) { if (docMap[r.doctor]) { (byDoctor[r.doctor] = byDoctor[r.doctor] || []).push(r); counts[r.doctor] = (counts[r.doctor] || 0) + 1; } });
    var ctx = { byDoctor: byDoctor, counts: counts };
    var touched = [];

    function put(el, html) { if (el) { el.innerHTML = html; touched.push(el); } }

    if (docs.length) {
      put(document.querySelector("#vrachi .team"), docs.map(function (d) { return teamCard(d, ctx); }).join(""));
      put(document.querySelector(".team--four"), docs.filter(function (d) { return d.group === "ortho"; }).slice(0, 4).map(function (d) { return orthoCard(d, ctx); }).join(""));
      var groups = [["#ortopedy", "ortho"], ["#lechenie", "ther"], ["#rukovodstvo", "director"]];
      groups.forEach(function (g) {
        var box = document.querySelector(g[0] + " .profiles");
        if (!box) return;
        var list = docs.filter(function (d) { return d.group === g[1]; });
        put(box, list.map(function (d) { return profile(d, ctx); }).join(""));
        var em = document.querySelector(g[0] + " h2 em");
        if (em && g[1] !== "director") em.textContent = list.length + " " + plural(list.length, ["врач", "врача", "врачей"]);
      });
      var orthoN = docs.filter(function (d) { return d.group === "ortho"; }).slice(0, 4).length;
      var em2 = document.querySelector("#vrachi-ortopedy h2 em");
      if (em2) em2.textContent = orthoN + " " + plural(orthoN, ["врач", "врача", "врачей"]);

      var sel = document.getElementById("fbDoctor");
      if (sel) {
        put(sel, '<option>Клиника в целом</option>' + docs.map(function (d) { return "<option>" + esc(d.name) + (d.group === "director" ? " (директор, врач-стоматолог)" : "") + "</option>"; }).join(""));
      }
    }

    if (docs.length && revs.length) {
      var featured = revs.filter(function (r) { return r.featured; }).slice(0, 3);
      if (featured.length) put(document.querySelector(".reviews-grid--3"), featured.map(function (r) { return reviewHome(r, docMap); }).join(""));

      var grid = document.querySelector(".reviews-grid--full");
      if (grid) {
        put(grid, revs.map(function (r) { return reviewFull(r, docMap); }).join(""));
        var bar = document.querySelector("[data-review-filter]");
        if (bar) {
          var clinicN = revs.filter(function (r) { return !docMap[r.doctor]; }).length;
          var chips = ['<button type="button" class="chip" data-key="all" data-name="" aria-pressed="false">Все отзывы <span>' + revs.length + "</span></button>",
            '<button type="button" class="chip' + (clinicN ? "" : " is-empty") + '" data-key="clinic" data-name="Клиника в целом" aria-pressed="false">О клинике <span>' + clinicN + "</span></button>"];
          docs.forEach(function (d) {
            var c = counts[d.id] || 0;
            chips.push('<button type="button" class="chip' + (c ? "" : " is-empty") + '" data-key="' + esc(d.id) + '" data-name="' + esc(d.name) + '" aria-pressed="false">' + esc(shortName(d.name)) + " <span>" + c + "</span></button>");
          });
          put(bar, chips.join(""));
        }
      }

      var slides = revs.filter(function (r) { return r.sliderPhoto; });
      var root = document.querySelector("[data-slides]");
      if (root && slides.length) {
        put(root, slides.map(function (r, i) { return slideHtml(r, docMap, allDocs, i === 0); }).join("") + '<div class="hero__dots" role="tablist" aria-label="Переключение слайдов"></div>');
      }
    }

    if (docsRaw && docsRaw.length) {
      var list = docsRaw.filter(function (d) { return d && d.file && d.title; }).sort(byOrder);
      list.forEach(function (d) {
        if (!d.key || !MATCH[d.key]) return;
        [].forEach.call(document.querySelectorAll('a[href*="' + MATCH[d.key] + '"]'), function (a) { a.setAttribute("href", d.file); });
        if (d.key === "price") replaceText(PRICE_SEED, fmtDate(d.date));
        if (d.key === "license") {
          var cell = document.querySelector("[data-doc-date=license]");
          if (cell && fmtDate(d.date) !== LICENSE_SEED) cell.textContent = fmtDate(d.date);
        }
      });
      put(document.querySelector(".docs-grid"), list.map(docCard).join(""));
    }

    touched.forEach(typo);
    var init = window.__dentaInit || {};
    if (init.slider) init.slider();
    if (init.filter) init.filter();
    if (init.prefill) init.prefill();
  });
})();
