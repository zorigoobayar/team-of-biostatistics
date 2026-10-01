/* =========================================================
   Нэр томьёоны толь — glossary/terms.yml-ээс уншиж харуулна.

   Хэрэглээ:
   1) Бүрэн толь (хайлт, сэдвийн шүүлтүүртэй):
      <div class="glossary-app" data-src="glossary/terms.yml"></div>

   2) Сонгосон нэр томьёо (аргын хуудсанд):
      <div class="glossary-embed"
           data-src="../glossary/terms.yml"
           data-glossary-url="../glossary.html"
           data-terms="t-test,p-value,confidence-interval"></div>
   ========================================================= */

(function () {
  "use strict";

  var TOPICS = {
    descriptive: "Тодорхойлох статистик",
    probability: "Магадлал ба тархалт",
    inference: "Статистик дүгнэлт",
    tests: "Статистик тестүүд",
    design: "Судалгааны дизайн",
    epi: "Эпидемиологийн хэмжүүр",
    bias: "Хазайлт ба confounding",
    regression: "Регресс ба загварчлал",
    survival: "Амьдрах чадвар",
    diagnostic: "Оношлогооны тест",
    trials: "Клиник туршилт",
    meta: "Мета-анализ"
  };

  var cache = {};

  function load(src) {
    if (!cache[src]) {
      cache[src] = fetch(src, { cache: "no-cache" })
        .then(function (r) {
          if (!r.ok) throw new Error(r.status + " " + src);
          return r.text();
        })
        .then(function (txt) {
          var data = window.jsyaml.load(txt) || [];
          var byId = {};
          data.forEach(function (t) { byId[t.id] = t; });
          return { list: data, byId: byId };
        });
    }
    return cache[src];
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFKD")
      .replace(/[̀-ͯ]/g, "");
  }

  function haystack(t) {
    return norm([t.en, t.mn, (t.alt || []).join(" "), t.def, t.id].join(" "));
  }

  /* ---------- One term card ---------- */

  function card(t, db, opts) {
    var linkBase = opts.linkBase || "";
    var topics = (t.topics || []).map(function (k) {
      return '<span class="gl-topic gl-topic-' + esc(k) + '">' + esc(TOPICS[k] || k) + "</span>";
    }).join("");

    var alt = t.alt && t.alt.length
      ? '<p class="gl-alt">Өөрөөр: ' + t.alt.map(esc).join(", ") + "</p>" : "";

    var more = "";
    if (t.example) more += '<div class="gl-row"><span class="gl-label"><i class="bi bi-hospital"></i> Жишээ</span><p>' + esc(t.example) + "</p></div>";
    if (t.pitfall) more += '<div class="gl-row gl-pitfall"><span class="gl-label"><i class="bi bi-exclamation-triangle"></i> Анхаар</span><p>' + esc(t.pitfall) + "</p></div>";
    if (t.r) more += '<div class="gl-row"><span class="gl-label"><i class="bi bi-code-slash"></i> R</span><pre><code>' + esc(t.r) + "</code></pre></div>";
    if (t.related && t.related.length) {
      var rel = t.related.filter(function (id) { return db.byId[id]; }).map(function (id) {
        return '<a href="' + linkBase + "#" + esc(id) + '" data-gl-jump="' + esc(id) + '">' + esc(db.byId[id].mn) + "</a>";
      }).join("");
      if (rel) more += '<div class="gl-row"><span class="gl-label"><i class="bi bi-diagram-3"></i> Холбоотой</span><p class="gl-related">' + rel + "</p></div>";
    }

    return (
      '<article class="gl-card" id="' + esc(t.id) + '">' +
        '<header class="gl-head">' +
          '<h3 class="gl-mn">' + esc(t.mn) + "</h3>" +
          '<p class="gl-en" lang="en">' + esc(t.en) + "</p>" +
        "</header>" +
        alt +
        '<p class="gl-def">' + esc(t.def) + "</p>" +
        (more ? '<details class="gl-more"' + (opts.open ? " open" : "") + '><summary>Жишээ, анхаарах зүйл</summary>' + more + "</details>" : "") +
        '<footer class="gl-topics">' + topics + "</footer>" +
      "</article>"
    );
  }

  function flash(id) {
    var el = document.getElementById(id);
    if (!el) return false;
    var d = el.querySelector("details");
    if (d) d.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("gl-flash");
    void el.offsetWidth;
    el.classList.add("gl-flash");
    return true;
  }

  /* ---------- Full A–Z app ---------- */

  function initApp(root) {
    var src = root.getAttribute("data-src");
    root.innerHTML = '<p class="gl-loading">Нэр томьёог ачаалж байна…</p>';

    load(src).then(function (db) {
      var state = { q: "", topic: "all", sort: "mn" };

      var chips = ['<button type="button" class="gl-chip is-active" data-topic="all">Бүгд <span>' + db.list.length + "</span></button>"];
      Object.keys(TOPICS).forEach(function (k) {
        var n = db.list.filter(function (t) { return (t.topics || []).indexOf(k) > -1; }).length;
        if (n) chips.push('<button type="button" class="gl-chip" data-topic="' + k + '">' + esc(TOPICS[k]) + " <span>" + n + "</span></button>");
      });

      root.innerHTML =
        '<div class="gl-toolbar">' +
          '<label class="gl-search"><i class="bi bi-search"></i>' +
            '<input type="search" placeholder="Хайх: p-утга, odds ratio, итгэх интервал…" aria-label="Нэр томьёо хайх"></label>' +
          '<div class="gl-sort" role="group" aria-label="Эрэмбэлэх">' +
            '<button type="button" class="is-active" data-sort="mn">Монгол А–Я</button>' +
            '<button type="button" data-sort="en">English A–Z</button>' +
          "</div>" +
        "</div>" +
        '<div class="gl-chips" role="group" aria-label="Сэдвээр шүүх">' + chips.join("") + "</div>" +
        '<p class="gl-count" aria-live="polite"></p>' +
        '<div class="gl-list"></div>';

      var input = root.querySelector("input");
      var list = root.querySelector(".gl-list");
      var count = root.querySelector(".gl-count");

      function render() {
        var q = norm(state.q.trim());
        var items = db.list.filter(function (t) {
          if (state.topic !== "all" && (t.topics || []).indexOf(state.topic) < 0) return false;
          return !q || haystack(t).indexOf(q) > -1;
        });
        var key = state.sort;
        // Монгол эрэмбэд кирилл үсгээр эхэлсэн нэрсийг эхэнд, латинаар эхэлснийг төгсгөлд
        var CYR = /^[\u0400-\u04FF]/;
        function bucket(t) { return key === "mn" && !CYR.test(String(t.mn)) ? 1 : 0; }
        items.sort(function (a, b) {
          return (bucket(a) - bucket(b)) ||
            String(a[key]).localeCompare(String(b[key]), key === "mn" ? "mn" : "en");
        });

        var html = "", last = "";
        items.forEach(function (t) {
          var letter = bucket(t) ? "A–Z" : String(t[key]).charAt(0).toUpperCase();
          if (letter !== last) { html += '<h2 class="gl-letter">' + esc(letter) + "</h2>"; last = letter; }
          html += card(t, db, { linkBase: "" });
        });
        list.innerHTML = html || '<p class="gl-empty">Тохирох нэр томьёо олдсонгүй. Өөр үгээр хайгаад үзээрэй.</p>';
        count.textContent = items.length + " нэр томьёо";
      }

      input.addEventListener("input", function () { state.q = input.value; render(); });
      root.querySelectorAll(".gl-chip").forEach(function (b) {
        b.addEventListener("click", function () {
          root.querySelectorAll(".gl-chip").forEach(function (x) { x.classList.remove("is-active"); });
          b.classList.add("is-active");
          state.topic = b.getAttribute("data-topic");
          render();
        });
      });
      root.querySelectorAll(".gl-sort button").forEach(function (b) {
        b.addEventListener("click", function () {
          root.querySelectorAll(".gl-sort button").forEach(function (x) { x.classList.remove("is-active"); });
          b.classList.add("is-active");
          state.sort = b.getAttribute("data-sort");
          render();
        });
      });

      // Холбоотой нэр томьёо руу үсрэх: шүүлтүүрийг цэвэрлээд гэрэлтүүлнэ
      root.addEventListener("click", function (e) {
        var a = e.target.closest("[data-gl-jump]");
        if (!a) return;
        e.preventDefault();
        var id = a.getAttribute("data-gl-jump");
        if (!document.getElementById(id)) {
          state.q = ""; input.value = ""; state.topic = "all";
          root.querySelectorAll(".gl-chip").forEach(function (x) { x.classList.toggle("is-active", x.getAttribute("data-topic") === "all"); });
          render();
        }
        history.replaceState(null, "", "#" + id);
        flash(id);
      });

      render();
      if (location.hash) setTimeout(function () { flash(decodeURIComponent(location.hash.slice(1))); }, 50);
    }).catch(function (err) {
      root.innerHTML = '<p class="gl-empty">Нэр томьёог ачаалж чадсангүй (' + esc(err.message) + ").</p>";
    });
  }

  /* ---------- Embedded subset (method pages) ---------- */

  function initEmbed(root) {
    var src = root.getAttribute("data-src");
    var ids = (root.getAttribute("data-terms") || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    var full = root.getAttribute("data-glossary-url") || "glossary.html";

    load(src).then(function (db) {
      var html = ids.map(function (id) {
        var t = db.byId[id];
        return t ? card(t, db, { linkBase: full }) : "";
      }).join("");
      root.innerHTML = '<div class="gl-list gl-embed-list">' + html + "</div>" +
        '<p class="gl-embed-more"><a href="' + esc(full) + '"><i class="bi bi-journal-text"></i> Бүх нэр томьёог толиос харах →</a></p>';

      // Энэ хуудсанд байгаа нэр томьёо руу хуудсан дотроо үсэрнэ, үгүй бол толь руу
      root.addEventListener("click", function (e) {
        var a = e.target.closest("[data-gl-jump]");
        if (!a) return;
        var id = a.getAttribute("data-gl-jump");
        if (root.querySelector('[id="' + id + '"]')) { e.preventDefault(); flash(id); }
      });
    }).catch(function (err) {
      root.innerHTML = '<p class="gl-empty">Нэр томьёог ачаалж чадсангүй (' + esc(err.message) + ").</p>";
    });
  }

  function boot() {
    if (!window.jsyaml) { console.error("js-yaml ачаалагдаагүй байна"); return; }
    document.querySelectorAll(".glossary-app").forEach(initApp);
    document.querySelectorAll(".glossary-embed").forEach(initEmbed);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
