/* =========================================================
   Paper Stats Explainer — paper-stats.qmd
   Зүүн тал: PubMed / Scopus / Web of Science-ээс нийтлэл хайна.
   Баруун тал: сонгосон нийтлэлийн статистик арга зүйг энгийн
   монгол хэлээр тайлбарлана.

   Хэрэглээ:
     <div class="ps-app"
          data-glossary="glossary/terms.yml"
          data-api=""></div>

   data-api  — _backend/worker.js-ийг байршуулсан хаяг
               (жишээ нь https://paper-stats.xxx.workers.dev).
               Хоосон бол: PubMed хайлт + бэлэн тайлбарын сан.
               Заасан бол: AI тайлбар, Web of Science, Scopus
               (серверт түлхүүр нь тохируулагдсан хэмжээгээр) асна.

   Арга таних толь: assets/js/paper-stats-dict.js
   ========================================================= */

(function () {
  "use strict";

  var D = window.PS_DICT;
  var EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";
  var TOOL = "team-of-biostatistics";
  var PAGE = 10;

  /* ======================================================
     1. Жижиг туслах функцууд
     ====================================================== */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function qs(o) {
    return Object.keys(o).filter(function (k) { return o[k] !== "" && o[k] != null; })
      .map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(o[k]); }).join("&");
  }

  /* Бичвэрийг хайлтад бэлдэх: бүх төрлийн зураас → "-", тусгай зай → " " */
  function norm(s) {
    return String(s || "")
      .replace(/­/g, "")
      .replace(/[‐-―−]/g, "-")
      .replace(/[  -   ]/g, " ")
      .replace(/[‘’ʼ]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/·(?=\d)/g, ".")
      .replace(/[ \t\r\f\v]+/g, " ")
      .replace(/ ?\n ?/g, "\n");
  }

  /* PubMed-ийн гарчигт орсон HTML тэмдэглэгээг цэвэрлэх */
  function clean(s) {
    s = String(s || "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    return s.replace(/<\/?[a-zA-Z][^>]*>/g, "").replace(/\s+/g, " ").trim();
  }

  function fmtNum(n) { return Number(n).toLocaleString("en-US"); }

  function trimNum(x) { return String(Math.round(x * 100) / 100); }

  /* ======================================================
     2. Бичвэрээс статистик арга таних (DOM шаардахгүй)
     ====================================================== */

  function snippet(text, idx, len) {
    var s = Math.max(text.lastIndexOf(". ", idx - 1), text.lastIndexOf("\n", idx - 1));
    s = s < 0 ? 0 : s + (text.charAt(s) === "." ? 2 : 1);
    var e1 = text.indexOf(". ", idx + len), e2 = text.indexOf("\n", idx + len);
    var e = Math.min(e1 < 0 ? text.length : e1 + 1, e2 < 0 ? text.length : e2);
    var pre = "", post = "";
    if (idx - s > 130) { s = text.indexOf(" ", idx - 130) + 1; pre = "… "; }
    if (e - (idx + len) > 150) { e = text.lastIndexOf(" ", idx + len + 150); post = " …"; }
    return pre + esc(text.slice(s, idx)) + "<mark>" + esc(text.slice(idx, idx + len)) + "</mark>" + esc(text.slice(idx + len, e)) + post;
  }

  function blank(text, i, n) {
    return text.slice(0, i) + new Array(n + 1).join(" ") + text.slice(i + n);
  }

  /* segs: [{k, label, text}] — эхнийх нь хамгийн найдвартай эх сурвалж */
  function detect(segs) {
    var found = {}, order = [];
    segs.forEach(function (seg) {
      if (!seg.text) return;
      var work = seg.text;
      D.methods.forEach(function (m) {
        if (m.need && !m.need.some(function (id) { return found[id]; })) return;
        m.re.forEach(function (re) {
          var g = new RegExp(re.source, re.flags.indexOf("g") > -1 ? re.flags : re.flags + "g"), x;
          while ((x = g.exec(work))) {
            if (!x[0].length) { g.lastIndex++; continue; }
            if (!found[m.id]) {
              found[m.id] = { m: m, seg: seg.k, segLabel: seg.label, hits: 0, ev: snippet(seg.text, x.index, x[0].length) };
              order.push(m.id);
            }
            found[m.id].hits++;
            work = blank(work, x.index, x[0].length);
          }
        });
      });
    });

    /* Тойм / мета-анализад бусад загварын нэр нь багтаасан судалгаануудыг хэлдэг */
    if (found["meta-analysis"] || found["systematic-review"]) {
      order = order.filter(function (id) {
        var m = found[id].m;
        return !(m.cat === "design" && id !== "meta-analysis" && id !== "systematic-review");
      });
    }
    /* Толь дахь дарааллаар эрэмбэлэх */
    var rank = {};
    D.methods.forEach(function (m, i) { rank[m.id] = i; });
    order.sort(function (a, b) { return rank[a] - rank[b]; });
    return order.map(function (id) { return found[id]; });
  }

  function detectSoftware(text) {
    return D.software.filter(function (s) { return s[1].test(text); }).map(function (s) { return s[0]; });
  }

  /* ---- Тоон үр дүн: OR / HR / RR / PR / IRR + 95% CI + p ---- */

  var EST = [
    ["OR", "odds ratios?"], ["HR", "hazard ratios?"], ["RR", "relative risks?|risk ratios?"],
    ["PR", "prevalence ratios?"], ["IRR", "incidence rate ratios?|rate ratios?"]
  ];
  var EST_NUM = "(\\d{1,3}(?:\\.\\d{1,3})?)(?![\\d%]|\\.\\d)";
  var EST_SEP = "(?: ?[\\[(] ?[A-Za-z]{2,4} ?[\\])])?(?: for [^.;:()\\d]{3,60}?)? ?(?:[=:,]|of|was|were|is)? ?[(\\[]? ?";
  var EST_CI = /^ ?[)\]]? ?[,;]? ?[(\[]? ?(?:9[059] ?% ?)?(?:(?:CI|CrI|confidence interval|credible interval)s?(?: ?[\[(] ?CI ?[\])])?)? ?[:=,]? ?[(\[]? ?(\d{1,3}(?:\.\d{1,3})?) ?(?:-|to|,|;) ?(\d{1,3}(?:\.\d{1,3})?)/i;

  function extractEstimates(text) {
    var out = [], seen = {};
    EST.forEach(function (p) {
      [new RegExp("\\b(?:adjusted |crude |pooled |unadjusted )?(?:" + p[1] + ")" + EST_SEP + EST_NUM, "gi"),
       new RegExp("\\b[ac]?" + p[0] + "s?\\b" + EST_SEP + EST_NUM, "g")].forEach(function (re) {
        var x;
        while ((x = re.exec(text))) {
          var v = parseFloat(x[1]);
          if (!(v > 0) || v > 200) continue;
          var end = x.index + x[0].length;
          var stop = text.indexOf(". ", end); if (stop < 0 || stop > end + 150) stop = end + 150;
          var tail = text.slice(end, stop);
          var o = { kind: p[0], v: v, vRaw: x[1], idx: x.index, len: x[0].length };
          var c = EST_CI.exec(tail);
          if (c && /CI|CrI|interval|%|[(\[]/.test(c[0])) {
            var lo = parseFloat(c[1]), hi = parseFloat(c[2]);
            if (lo < hi && lo <= v && v <= hi) { o.lo = lo; o.hi = hi; o.loRaw = c[1]; o.hiRaw = c[2]; o.len += c[0].length; }
          }
          var pv = /\bp ?(?:-? ?values?)? ?([<>=≤]) ?(0?\.\d+)/i.exec(tail);
          if (pv) { o.pOp = pv[1] === "≤" ? "≤" : pv[1]; o.p = parseFloat(pv[2]); o.pRaw = pv[2]; }
          var key = [o.kind, o.v, o.lo, o.hi].join("|");
          if (seen[key]) continue;
          seen[key] = 1;
          o.ev = snippet(text, o.idx, o.len);
          out.push(o);
        }
      });
    });
    out.sort(function (a, b) { return a.idx - b.idx; });
    return out.slice(0, 6);
  }

  var EST_WORD = {
    OR: "үр дагавар тохиолдох боломж (odds)", HR: "үйл явдал тохиолдох эрсдэл",
    RR: "эрсдэл", PR: "тархалт", IRR: "шинэ тохиолдлын түвшин"
  };

  function interpret(o) {
    var w = EST_WORD[o.kind], s;
    if (o.v === 1) s = "Харьцуулж буй хоёр бүлгийн " + w + " ижил байна.";
    else if (o.v >= 2) s = "Харьцуулж буй бүлэгт " + w + " жишиг бүлгийнхээс ойролцоогоор <b>" + trimNum(o.v) + " дахин их</b> байна.";
    else if (o.v > 1) s = "Харьцуулж буй бүлэгт " + w + " жишиг бүлгийнхээс ойролцоогоор <b>" + Math.round((o.v - 1) * 100) + "%-иар их</b> байна.";
    else s = "Харьцуулж буй бүлэгт " + w + " жишиг бүлгийнхээс ойролцоогоор <b>" + Math.round((1 - o.v) * 100) + "%-иар бага</b> байна.";
    if (o.lo != null) {
      s += " Жинхэнэ утга нь " + o.loRaw + "-ээс " + o.hiRaw + " хооронд байх магадлал өндөр.";
      s += (o.lo > 1 || o.hi < 1)
        ? " Энэ муж 1-ийг (ялгаагүй гэсэн утга) агуулаагүй тул ялгааг санамсаргүй тохиолдол гэж үзэхэд хэцүү."
        : " Энэ муж 1-ийг (ялгаагүй гэсэн утга) агуулж байгаа тул «ялгаа байна» гэж баттай хэлэхэд нотолгоо хангалтгүй.";
    }
    if (o.p != null) {
      var small = (o.pOp === "<" || o.pOp === "≤" || o.pOp === "=") && o.p <= 0.05;
      if (o.pOp === "=" && o.p === 0.05) small = false;
      s += " p " + o.pOp + " " + esc(o.pRaw) + (small ? " нь түгээмэл хэрэглэдэг 0.05 гэсэн босгоос бага." : " нь түгээмэл хэрэглэдэг 0.05 гэсэн босгоос бага биш.");
    }
    return s;
  }

  var MAIN_CATS = { meta: 1, surv: 2, model: 3, diag: 4, test: 5 };
  var OBSERVATIONAL = { cohort: 1, "case-control": 1, "cross-sectional": 1, ecological: 1, "case-series": 1 };

  /* paper: {title, abstract:[{label,text}], pubtypes:[], methodsText, statsText, bodyText, fullText:boolean} */
  function analyse(paper) {
    var abs = (paper.abstract || []).map(function (a) { return (a.label ? a.label + ": " : "") + a.text; }).join("\n");
    var segs = [
      { k: "stats", label: "статистик шинжилгээний хэсгээс", text: norm(paper.statsText) },
      { k: "methods", label: "арга зүйн хэсгээс", text: norm(paper.methodsText) },
      { k: "body", label: "бүтэн эхээс", text: norm(paper.bodyText) },
      { k: "abstract", label: "хураангуйгаас", text: norm((paper.title || "") + ".\n" + abs) },
      { k: "pubtype", label: "PubMed-ийн ангиллаас", text: norm((paper.pubtypes || []).join(". ")) }
    ];
    var hits = detect(segs);
    var all = segs.map(function (s) { return s.text; }).join("\n");
    var design = hits.filter(function (h) { return h.m.cat === "design"; })[0] || null;
    /* Товч дүгнэлтэд загварчлалын аргуудыг энгийн тестээс түрүүлж нэрлэнэ */
    var main = hits.filter(function (h) { return MAIN_CATS[h.m.cat]; })
      .sort(function (x, y) { return MAIN_CATS[x.m.cat] - MAIN_CATS[y.m.cat]; });
    var has = {};
    hits.forEach(function (h) { has[h.m.id] = h; });
    var estimates = extractEstimates(norm(abs));
    var alpha = /\bp ?(?:-? ?values?)? ?(?:of )?(?:<|\u2264|less than) ?(0?\.\d+) (?:was|were|is) (?:considered|regarded|deemed|taken|defined|determined|set)/i.exec(all) ||
      /significan\w* (?:level )?(?:was |were )?(?:set|defined|accepted|considered) (?:at|as) (?:a |an )?(?:two-sided )?(?:p|alpha|\u03B1) ?(?:-? ?values?)? ?(?:of |level of )?(?:<|=|\u2264)? ?(0?\.\d+)/i.exec(all) ||
      /significance level ?(?:=|of|was|at) ?(0?\.\d+)/i.exec(all);

    /* --- Анхаарах зүйлс --- */
    var cautions = [];
    if (!paper.fullText) {
      cautions.push(paper.abstract && paper.abstract.length
        ? "Энэ тайлбар зөвхөн нийтлэлийн хураангуйд үндэслэсэн. Хураангуйд бүх аргыг бичдэггүй тул нийтлэлд ашигласан зарим арга энд харагдахгүй байж болно."
        : "Энэ нийтлэлийн хураангуй олдсонгүй. Тайлбар зөвхөн гарчиг болон PubMed-ийн ангилалд үндэслэсэн.");
    }
    if (design && OBSERVATIONAL[design.m.id]) {
      cautions.push("Энэ бол ажиглалтын судалгаа. Хоёр зүйлийн хооронд холбоо олдсон нь нэг нь нөгөөгөө үүсгэсэн гэсэн үг биш: тооцоонд ороогүй өөр хүчин зүйл нөлөөлсөн байж болно.");
    }
    if (has["p-value"] && !has.ci && !has["effect-size"] && !estimates.length) {
      cautions.push("Бичвэрт p-утга дурдагдсан боловч нөлөөний хэмжээ, итгэх интервал харагдахгүй байна. P-утга бага байх нь нөлөө том, чухал гэсэн үг биш тул бодит ялгааны хэмжээг нийтлэлээс заавал хараарай.");
    }
    if (paper.fullText && paper.statsText && has.subgroup && !has["multiple-comparisons"]) {
      cautions.push("Дэд бүлгийн шинжилгээ хийсэн боловч статистик шинжилгээний хэсэгт олон дахин харьцуулалтын залруулга дурдагдаагүй байна. Харьцуулалт олон байх тусам санамсаргүй «ач холбогдолтой» үр дүн гарах магадлал өсдөг.");
    }
    return {
      hits: hits, design: design, main: main, has: has,
      software: detectSoftware(all), estimates: estimates,
      alpha: alpha ? alpha[1] : null, cautions: cautions.slice(0, 4)
    };
  }

  /* Тест бичихэд (Node) ашиглана */
  window.PS_CORE = { norm: norm, detect: detect, analyse: analyse, extractEstimates: extractEstimates, interpret: interpret, parsePmc: parsePmc, mdToHtml: mdToHtml };

  /* ======================================================
     3. Эх сурвалжууд
     ====================================================== */

  var ncbiQueue = Promise.resolve(), ncbiLast = 0;

  /* NCBI: түлхүүргүй үед секундэд 3 хүсэлт — дараалалд оруулж зайтай илгээнэ */
  function ncbi(path, params, retried) {
    params.tool = TOOL;
    var run = ncbiQueue.then(function () {
      var wait = Math.max(0, 380 - (Date.now() - ncbiLast));
      return new Promise(function (r) { setTimeout(r, wait); });
    }).then(function () {
      ncbiLast = Date.now();
      return fetch(EUTILS + path + "?" + qs(params));
    });
    ncbiQueue = run.catch(function () {});
    return run.then(function (r) {
      if (r.status === 429 && !retried) {
        return new Promise(function (ok) { setTimeout(ok, 1200); }).then(function () { return ncbi(path, params, true); });
      }
      if (!r.ok) throw new Error("PubMed сервер " + r.status + " алдаа буцаалаа.");
      return r;
    });
  }

  var PM_TYPES = {
    rct: '"Randomized Controlled Trial"[pt]', meta: '"Meta-Analysis"[pt]',
    sr: '"Systematic Review"[pt]', obs: '"Observational Study"[pt]', ct: '"Clinical Trial"[pt]'
  };

  /* Хайлтын талбарт буулгасан PMID / DOI / PubMed холбоосыг таних */
  function parseId(q) {
    q = q.trim();
    var m;
    if ((m = /pubmed\.ncbi\.nlm\.nih\.gov\/(\d{1,9})/i.exec(q))) return { pmid: m[1] };
    if ((m = /^pmid:?\s*(\d{1,9})$/i.exec(q)) || (m = /^(\d{5,9})$/.exec(q))) return { pmid: m[1] };
    var d = q.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
    if (/^10\.\d{4,9}\/\S+$/.test(d)) return { doi: d.replace(/[.,;]+$/, "") };
    return null;
  }

  function fromSummary(d) {
    var ids = {};
    (d.articleids || []).forEach(function (a) { if (!ids[a.idtype]) ids[a.idtype] = a.value; });
    var au = (d.authors || []).map(function (a) { return a.name; });
    return {
      key: "pmid:" + d.uid, src: "pubmed", pmid: String(d.uid), doi: ids.doi || "", pmcid: ids.pmc || "",
      title: clean(d.title).replace(/\.$/, ""), journal: d.fulljournalname || d.source || "", jabbr: d.source || "",
      year: (/\d{4}/.exec(d.pubdate || d.sortpubdate || "") || [""])[0],
      authors: au, pubtypes: d.pubtype || [], issn: d.issn || "", essn: d.essn || "",
      url: "https://pubmed.ncbi.nlm.nih.gov/" + d.uid + "/"
    };
  }

  async function pubmedSummaries(ids) {
    if (!ids.length) return [];
    var j = await (await ncbi("esummary.fcgi", { db: "pubmed", retmode: "json", id: ids.join(",") })).json();
    return ids.map(function (id) { return j.result && j.result[id]; })
      .filter(function (d) { return d && !d.error; }).map(fromSummary);
  }

  async function searchPubmed(q, f, start) {
    var id = parseId(q), term;
    if (id && id.pmid) term = id.pmid + "[uid]";
    else if (id && id.doi) term = '"' + id.doi + '"[doi]';
    else {
      term = "(" + q + ")";
      if (PM_TYPES[f.type]) term += " AND " + PM_TYPES[f.type];
      if (f.full) term += " AND pubmed pmc[sb]";
    }
    var p = { db: "pubmed", retmode: "json", retmax: PAGE, retstart: start, term: term, sort: f.sort === "date" ? "pub_date" : "relevance" };
    if (!id && f.from) { p.datetype = "pdat"; p.mindate = f.from; p.maxdate = new Date().getFullYear() + 1; }
    var j = await (await ncbi("esearch.fcgi", p)).json();
    var r = j.esearchresult || {};
    if (r.ERROR) throw new Error("PubMed: " + r.ERROR);
    var items = await pubmedSummaries(r.idlist || []);
    var res = { total: parseInt(r.count, 10) || 0, items: items };
    if (!res.total && id && id.doi) {
      var oa = await openAlex(id.doi);
      if (oa) { res.total = 1; res.items = [oa]; }
    }
    return res;
  }

  /* --- Scopus (Elsevier API) --- */

  function scopusKey() {
    try { return localStorage.getItem("ps-scopus-key") || ""; } catch (e) { return ""; }
  }

  async function searchScopus(q, f, start) {
    var id = parseId(q), query;
    if (id && id.doi) query = "DOI(" + id.doi + ")";
    else if (id && id.pmid) query = "PMID(" + id.pmid + ")";
    else {
      query = "TITLE-ABS-KEY(" + q + ")";
      if (f.from) query += " AND PUBYEAR > " + (parseInt(f.from, 10) - 1);
    }
    var params = { query: query, count: PAGE, start: start, sort: f.sort === "date" ? "-coverDate" : "relevancy" };
    var r;
    if (cfg.scopus) r = await fetch(API + "/scopus?" + qs(params));
    else r = await fetch("https://api.elsevier.com/content/search/scopus?" + qs(params), { headers: { "X-ELS-APIKey": scopusKey(), Accept: "application/json" } });
    if (r.status === 401 || r.status === 403) throw new Error("Scopus түлхүүр буруу эсвэл энэ сүлжээнээс Scopus-ын эрх нээгдээгүй байна (" + r.status + ").");
    if (r.status === 429) throw new Error("Scopus-ын хүсэлтийн хязгаарт хүрлээ. Хэсэг хугацааны дараа дахин оролдоно уу.");
    if (!r.ok) throw new Error("Scopus сервер " + r.status + " алдаа буцаалаа.");
    var sr = (await r.json())["search-results"] || {};
    var items = (sr.entry || []).filter(function (e) { return !e.error; }).map(function (e) {
      var link = (e.link || []).filter(function (l) { return l["@ref"] === "scopus"; })[0];
      return {
        key: "scopus:" + (e.eid || e["dc:identifier"]), src: "scopus", pmid: e["pubmed-id"] || "", doi: e["prism:doi"] || "", pmcid: "",
        title: clean(e["dc:title"]), journal: e["prism:publicationName"] || "", jabbr: e["prism:publicationName"] || "",
        year: (e["prism:coverDate"] || "").slice(0, 4), authors: e["dc:creator"] ? [e["dc:creator"]] : [], etal: true,
        pubtypes: e.subtypeDescription ? [e.subtypeDescription] : [], issn: e["prism:issn"] || "", essn: e["prism:eIssn"] || "",
        cited: e["citedby-count"], url: link ? link["@href"] : ""
      };
    });
    return { total: parseInt(sr["opensearch:totalResults"], 10) || 0, items: items };
  }

  /* --- Web of Science (Starter API, зөвхөн серверээр дамжина) --- */

  async function searchWos(q, f, start) {
    var id = parseId(q), query;
    if (id && id.doi) query = 'DO=("' + id.doi + '")';
    else if (id && id.pmid) query = "PMID=(" + id.pmid + ")";
    else {
      query = "TS=(" + q + ")";
      if (f.from) query += " AND PY=(" + f.from + "-" + (new Date().getFullYear() + 1) + ")";
    }
    var r = await fetch(API + "/wos?" + qs({ q: query, limit: PAGE, page: Math.floor(start / PAGE) + 1, sortField: f.sort === "date" ? "PY+D" : "RS+D" }));
    if (r.status === 429) throw new Error("Web of Science-ийн өдрийн хүсэлтийн хязгаарт хүрлээ.");
    if (!r.ok) throw new Error("Web of Science сервер " + r.status + " алдаа буцаалаа.");
    var j = await r.json();
    var items = (j.hits || []).map(function (h) {
      var s = h.source || {}, idn = h.identifiers || {}, cit = (h.citations || [])[0];
      return {
        key: "wos:" + h.uid, src: "wos", pmid: idn.pmid || "", doi: idn.doi || "", pmcid: "",
        title: clean(h.title), journal: s.sourceTitle || "", jabbr: s.sourceTitle || "", year: s.publishYear ? String(s.publishYear) : "",
        authors: ((h.names || {}).authors || []).map(function (a) { return a.displayName; }),
        pubtypes: h.types || [], issn: idn.issn || "", essn: idn.eissn || "",
        cited: cit ? cit.count : null, url: (h.links || {}).record || ""
      };
    });
    return { total: (j.metadata || {}).total || 0, items: items };
  }

  /* --- OpenAlex: PubMed-д байхгүй нийтлэлийн хураангуйг DOI-оор авах --- */

  async function openAlex(doi) {
    try {
      var r = await fetch("https://api.openalex.org/works/doi:" + encodeURIComponent(doi).replace(/%2F/g, "/") +
        "?select=title,publication_year,abstract_inverted_index,primary_location,authorships,type,ids");
      if (!r.ok) return null;
      var w = await r.json(), words = [], inv = w.abstract_inverted_index || {};
      Object.keys(inv).forEach(function (k) { inv[k].forEach(function (pos) { words[pos] = k; }); });
      var src = (w.primary_location || {}).source || {};
      var pmid = ((w.ids || {}).pmid || "").replace(/\D/g, "");
      return {
        key: "doi:" + doi, src: "doi", pmid: pmid, doi: doi, pmcid: "",
        title: clean(w.title), journal: src.display_name || "", jabbr: src.display_name || "",
        year: w.publication_year ? String(w.publication_year) : "",
        authors: (w.authorships || []).map(function (a) { return (a.author || {}).display_name; }).filter(Boolean),
        pubtypes: w.type ? [w.type] : [], issn: src.issn_l || "", essn: "",
        url: "https://doi.org/" + doi, oaAbstract: words.join(" ").trim()
      };
    } catch (e) { return null; }
  }

  /* --- PubMed-ийн бүртгэл (хураангуй) --- */

  function parsePubmed(xml) {
    var d = new DOMParser().parseFromString(xml, "text/xml");
    var art = d.querySelector("PubmedArticle");
    if (!art) return null;
    var out = { abstract: [], pubtypes: [], pmcid: "", doi: "" };
    art.querySelectorAll("Abstract > AbstractText").forEach(function (n) {
      var t = n.textContent.replace(/\s+/g, " ").trim();
      if (t) out.abstract.push({ label: n.getAttribute("Label") || "", text: t });
    });
    art.querySelectorAll("PublicationTypeList > PublicationType").forEach(function (n) { out.pubtypes.push(n.textContent); });
    art.querySelectorAll("PubmedData > ArticleIdList > ArticleId").forEach(function (n) {
      var t = n.getAttribute("IdType");
      if (t === "pmc") out.pmcid = n.textContent.trim();
      if (t === "doi") out.doi = n.textContent.trim();
    });
    return out;
  }

  /* --- PMC бүтэн эх: арга зүй ба статистик шинжилгээний хэсгийг ялгах --- */

  var RE_STATS = /statistic|data anal|analytic|\banalys[ie]s\b|sample size|power calc/i;
  var RE_METHODS = /method|material|patients|participants|subjects|study design|study population|experimental|procedure/i;
  var RE_NOT = /result|discussion|conclusion|introduction|background|findings|limitation/i;

  function parsePmc(xml) {
    var d = new DOMParser().parseFromString(xml, "text/xml");
    var body = d.querySelector("article > body") || d.querySelector("body");
    if (!body || d.querySelector("parsererror")) return null;

    function title(sec) {
      for (var i = 0; i < sec.children.length; i++) if (sec.children[i].tagName === "title") return sec.children[i].textContent.replace(/\s+/g, " ").trim();
      return "";
    }
    function paras(node) {
      return Array.prototype.slice.call(node.querySelectorAll("p")).filter(function (p) {
        var a = p.parentElement;
        while (a && a !== node) { if (/^(table-wrap|fig|caption|boxed-text|supplementary-material|ref-list)$/.test(a.tagName)) return false; a = a.parentElement; }
        return true;
      });
    }
    function text(ps) { return ps.map(function (p) { return p.textContent.replace(/\s+/g, " ").trim(); }).filter(Boolean).join("\n"); }

    var top = Array.prototype.filter.call(body.children, function (c) { return c.tagName === "sec"; });
    var methodSecs = top.filter(function (s) {
      var ty = s.getAttribute("sec-type") || "", ti = title(s);
      if (/result|discussion|conclusion|intro/i.test(ty)) return false;
      return /method|material|subjects/i.test(ty) || (RE_METHODS.test(ti) && !RE_NOT.test(ti));
    });
    var mParas = [];
    methodSecs.forEach(function (s) { mParas = mParas.concat(paras(s)); });

    var statSecs = Array.prototype.filter.call(body.querySelectorAll("sec"), function (s) {
      var ti = title(s);
      if (!RE_STATS.test(ti) || RE_NOT.test(ti)) return false;
      /* Үр дүн / хэлэлцүүлэг дотор байгаа «analysis» гарчигтай хэсгийг авахгүй */
      var a = s.parentElement, inMethods = methodSecs.indexOf(s) > -1;
      while (a && a !== body) {
        if (methodSecs.indexOf(a) > -1) inMethods = true;
        if (a.tagName === "sec" && RE_NOT.test(title(a) + " " + (a.getAttribute("sec-type") || ""))) return false;
        a = a.parentElement;
      }
      return inMethods || /statistic/i.test(ti);
    });
    var sParas = [];
    statSecs.forEach(function (s) { paras(s).forEach(function (p) { if (sParas.indexOf(p) < 0) sParas.push(p); }); });

    var out = { statsText: text(sParas), methodsText: text(mParas.filter(function (p) { return sParas.indexOf(p) < 0; })), bodyText: "" };
    if (!out.statsText && !out.methodsText) {
      /* Хэсгийн гарчиггүй нийтлэл: статистикийн тухай өгүүлсэн догол мөрүүдийг л авна */
      out.bodyText = text(paras(body).filter(function (p) {
        return /statistic|regression|\bt-? ?test|ANOVA|chi-? ?square|confidence interval|SPSS|Stata|\bSAS\b|R software|GraphPad|Kaplan|log-? ?rank|Mann-? ?Whitney/i.test(p.textContent);
      })).slice(0, 20000);
    }
    return (out.statsText || out.methodsText || out.bodyText) ? out : null;
  }

  /* Сонгосон нийтлэлийн бичвэрийг цуглуулах */
  async function loadPaper(item) {
    var p = {};
    Object.keys(item).forEach(function (k) { p[k] = item[k]; });
    p.abstract = []; p.statsText = ""; p.methodsText = ""; p.bodyText = ""; p.fullText = false;

    if (!p.pmid && p.doi) {
      try {
        var j = await (await ncbi("esearch.fcgi", { db: "pubmed", retmode: "json", retmax: 1, term: '"' + p.doi + '"[doi]' })).json();
        var ids = (j.esearchresult || {}).idlist || [];
        if (ids.length === 1) p.pmid = ids[0];
      } catch (e) { /* PubMed-д байхгүй бол OpenAlex руу */ }
    }

    if (p.pmid) {
      var rec = parsePubmed(await (await ncbi("efetch.fcgi", { db: "pubmed", retmode: "xml", id: p.pmid })).text());
      if (rec) {
        p.abstract = rec.abstract;
        if (rec.pubtypes.length) p.pubtypes = rec.pubtypes;
        p.pmcid = p.pmcid || rec.pmcid; p.doi = p.doi || rec.doi;
      }
      p.pubmedUrl = "https://pubmed.ncbi.nlm.nih.gov/" + p.pmid + "/";
    }

    if (p.pmcid) {
      try {
        var full = parsePmc(await (await ncbi("efetch.fcgi", { db: "pmc", retmode: "xml", id: p.pmcid.replace(/^PMC/i, "") })).text());
        if (full) { p.statsText = full.statsText; p.methodsText = full.methodsText; p.bodyText = full.bodyText; p.fullText = true; }
      } catch (e) { /* бүтэн эх авч чадаагүй бол хураангуйгаар үргэлжлүүлнэ */ }
    }

    if (!p.abstract.length && p.doi) {
      var oa = item.oaAbstract != null ? item : await openAlex(p.doi);
      if (oa && oa.oaAbstract) p.abstract = [{ label: "", text: oa.oaAbstract }];
    }
    return p;
  }

  /* ======================================================
     4. Дэлгэц
     ====================================================== */

  var root, API, cfg = { ai: false, wos: false, scopus: false }, glossary = null;
  var state = { src: "pubmed", q: "", start: 0, total: 0, items: [], sel: null, busy: false, f: { type: "", full: false, from: "", sort: "rel" } };
  var token = 0, chat = [];
  var el = {};

  var SRC = {
    pubmed: { name: "PubMed", icon: "bi-heart-pulse" },
    scopus: { name: "Scopus", icon: "bi-journal-bookmark" },
    wos: { name: "Web of Science", icon: "bi-globe2" }
  };
  var TYPE_LABEL = {
    "Randomized Controlled Trial": "RCT", "Meta-Analysis": "Мета-анализ", "Systematic Review": "Системчилсэн тойм",
    "Review": "Тойм", "Observational Study": "Ажиглалтын", "Clinical Trial": "Клиник туршилт", "Case Reports": "Тохиолдол"
  };
  var EXAMPLES = ["hypertension Mongolia", "vitamin D supplementation randomized trial", "hepatitis B liver cancer cohort", "air pollution children pneumonia"];

  function srcReady(k) {
    if (k === "pubmed") return true;
    if (k === "scopus") return cfg.scopus || !!scopusKey();
    return cfg.wos;
  }

  function build() {
    root.innerHTML =
      '<div class="ps-grid">' +
        '<section class="ps-left" aria-label="Нийтлэл хайх">' +
          '<div class="ps-tabs" role="tablist" aria-label="Эх сурвалж">' +
            Object.keys(SRC).map(function (k) {
              return '<button type="button" role="tab" data-src="' + k + '"><i class="bi ' + SRC[k].icon + '"></i> ' + SRC[k].name + '<i class="bi bi-lock-fill ps-lock" title="Тохиргоо шаардлагатай"></i></button>';
            }).join("") +
          "</div>" +
          '<form class="ps-form" role="search">' +
            '<label class="ps-q"><i class="bi bi-search" aria-hidden="true"></i>' +
              '<input type="search" name="q" autocomplete="off" placeholder="Түлхүүр үг, DOI, PMID" aria-label="Нийтлэл хайх"></label>' +
            '<button type="submit" class="btn btn-primary">Хайх</button>' +
            '<div class="ps-filters">' +
              '<select name="type" aria-label="Нийтлэлийн төрөл"><option value="">Бүх төрөл</option><option value="rct">RCT</option><option value="ct">Клиник туршилт</option><option value="obs">Ажиглалтын судалгаа</option><option value="meta">Мета-анализ</option><option value="sr">Системчилсэн тойм</option></select>' +
              '<select name="from" aria-label="Хэвлэгдсэн он"><option value="">Бүх он</option></select>' +
              '<select name="sort" aria-label="Эрэмбэлэх"><option value="rel">Хамаарлаар</option><option value="date">Шинэ нь эхэнд</option></select>' +
              '<label class="ps-check"><input type="checkbox" name="full"> Бүтэн эх нь нээлттэй</label>' +
            "</div>" +
          "</form>" +
          '<div class="ps-setup" hidden></div>' +
          '<p class="ps-status" aria-live="polite"></p>' +
          '<ol class="ps-list"></ol>' +
          '<button type="button" class="ps-more btn btn-outline-secondary btn-sm" hidden>Дараагийн ' + PAGE + "-ыг харуулах</button>" +
        "</section>" +
        '<section class="ps-right" aria-label="Статистик арга зүйн тайлбар" aria-live="polite"></section>' +
      "</div>";

    el.tabs = root.querySelectorAll(".ps-tabs button");
    el.form = root.querySelector(".ps-form");
    el.q = el.form.elements.q;
    el.setup = root.querySelector(".ps-setup");
    el.status = root.querySelector(".ps-status");
    el.list = root.querySelector(".ps-list");
    el.more = root.querySelector(".ps-more");
    el.right = root.querySelector(".ps-right");

    var y = new Date().getFullYear();
    [[y - 4, "Сүүлийн 5 жил"], [y - 9, "Сүүлийн 10 жил"], [2000, "2000 оноос хойш"]].forEach(function (o) {
      el.form.elements.from.insertAdjacentHTML("beforeend", '<option value="' + o[0] + '">' + o[1] + "</option>");
    });

    el.tabs.forEach(function (b) { b.addEventListener("click", function () { setSrc(b.dataset.src); }); });
    el.form.addEventListener("submit", function (e) { e.preventDefault(); search(true); });
    ["type", "from", "sort", "full"].forEach(function (n) {
      el.form.elements[n].addEventListener("change", function () { if (state.q) search(true); });
    });
    el.more.addEventListener("click", function () { search(false); });
    el.list.addEventListener("click", function (e) {
      var b = e.target.closest(".ps-item");
      if (b) select(state.items[+b.dataset.i], true);
    });
    el.right.addEventListener("click", function (e) {
      var ex = e.target.closest("[data-example]");
      if (ex) { el.q.value = ex.dataset.example; setSrc("pubmed"); search(true); }
      if (e.target.closest(".ps-back")) root.querySelector(".ps-left").scrollIntoView({ behavior: "smooth" });
    });
    el.right.addEventListener("submit", function (e) {
      if (e.target.classList.contains("ps-chat-form")) { e.preventDefault(); ask(e.target); }
    });

    setSrc("pubmed");
    welcome();
  }

  function setSrc(k) {
    state.src = k;
    el.tabs.forEach(function (b) {
      var on = b.dataset.src === k;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.classList.toggle("is-locked", !srcReady(b.dataset.src));
    });
    var pm = k === "pubmed";
    el.form.elements.type.hidden = !pm;
    el.form.elements.full.closest("label").hidden = !pm;
    renderSetup();
    state.items = []; state.total = 0; state.start = 0;
    el.list.innerHTML = ""; el.more.hidden = true; el.status.textContent = "";
    if (srcReady(k) && el.q.value.trim()) search(true);
  }

  /* Scopus / WoS тохируулагдаагүй үед зааварчилгаа */
  function renderSetup() {
    var k = state.src;
    el.setup.hidden = srcReady(k);
    el.form.querySelector('button[type="submit"]').disabled = !srcReady(k);
    if (srcReady(k)) { el.setup.innerHTML = ""; return; }
    if (k === "scopus") {
      el.setup.innerHTML =
        '<p><b>Scopus-оос хайхад Elsevier-ийн API түлхүүр хэрэгтэй.</b> Байгууллага тань Scopus-ын эрхтэй бол <a href="https://dev.elsevier.com/" target="_blank" rel="noopener">dev.elsevier.com</a>-оос түлхүүр авч, доор оруулна. Түлхүүр зөвхөн энэ хөтөч дээр хадгалагдана.</p>' +
        '<form class="ps-key"><input type="password" name="key" autocomplete="off" placeholder="Elsevier API түлхүүр" aria-label="Elsevier API түлхүүр"><button type="submit" class="btn btn-sm btn-primary">Хадгалах</button></form>' +
        '<p class="ps-hint">Түлхүүргүй бол Scopus-оос олсон нийтлэлийнхээ <b>DOI</b>-г PubMed таб дээр буулгаад тайлбарыг нь авч болно.</p>';
      el.setup.querySelector(".ps-key").addEventListener("submit", function (e) {
        e.preventDefault();
        var v = e.target.elements.key.value.trim();
        if (!v) return;
        try { localStorage.setItem("ps-scopus-key", v); } catch (err) { /* хувийн горимд хадгалагдахгүй */ }
        setSrc("scopus");
      });
    } else {
      el.setup.innerHTML =
        "<p><b>Web of Science-ийн хайлт одоогоор идэвхжээгүй байна.</b> Clarivate-ийн API нь вэб хуудаснаас шууд дуудагдахыг зөвшөөрдөггүй тул багийн тохируулсан серверээр дамжиж ажиллана.</p>" +
        '<p class="ps-hint">Одоохондоо Web of Science-ээс олсон нийтлэлийнхээ <b>DOI</b>-г PubMed таб дээр буулгаад тайлбарыг нь авч болно.</p>';
    }
  }

  function welcome() {
    el.right.innerHTML =
      '<div class="ps-empty">' +
        '<div class="ps-empty-icon"><i class="bi bi-file-earmark-text"></i><i class="bi bi-arrow-right"></i><i class="bi bi-chat-square-text"></i></div>' +
        "<h2>Нийтлэлээ сонгоно уу</h2>" +
        "<p>Зүүн талд нийтлэл хайж олоод дарахад түүнд ашигласан статистик аргуудыг энд энгийн үгээр тайлбарлана.</p>" +
        '<p class="ps-examples"><span>Жишээ хайлт:</span> ' + EXAMPLES.map(function (x) {
          return '<button type="button" data-example="' + esc(x) + '">' + esc(x) + "</button>";
        }).join("") + "</p>" +
      "</div>";
  }

  async function search(fresh) {
    var q = el.q.value.trim();
    if (!q || state.busy || !srcReady(state.src)) return;
    var f = { type: el.form.elements.type.value, from: el.form.elements.from.value, sort: el.form.elements.sort.value, full: el.form.elements.full.checked };
    var start = fresh ? 0 : state.start + PAGE;
    state.busy = true; state.q = q; state.f = f;
    el.status.innerHTML = '<span class="ps-spin"></span> ' + SRC[state.src].name + "-ээс хайж байна…";
    el.more.hidden = true;
    if (fresh) el.list.innerHTML = "";
    var src = state.src;
    try {
      var res = await (src === "pubmed" ? searchPubmed : src === "scopus" ? searchScopus : searchWos)(q, f, start);
      if (src !== state.src) return;
      state.items = fresh ? res.items : state.items.concat(res.items);
      state.total = res.total; state.start = start;
      renderList();
      if (fresh && res.items.length === 1 && parseId(q)) select(res.items[0], false);
    } catch (e) {
      el.status.innerHTML = '<span class="ps-err"><i class="bi bi-exclamation-triangle"></i> ' + esc(e && e.message && !/Failed to fetch|NetworkError|Load failed/i.test(e.message) ? e.message : "Сервертэй холбогдож чадсангүй. Интернэт холболтоо шалгаад дахин оролдоно уу.") + "</span>";
    } finally {
      state.busy = false;
    }
  }

  function authorLine(it) {
    var a = it.authors || [];
    if (!a.length) return "";
    return a.length > 3 || it.etal ? a.slice(0, 3).join(", ") + " нар" : a.join(", ");
  }

  function renderList() {
    if (!state.items.length) {
      el.status.textContent = "Илэрц олдсонгүй. Өөр түлхүүр үгээр (англиар) хайгаад үзээрэй.";
      el.list.innerHTML = "";
      return;
    }
    el.status.textContent = SRC[state.src].name + ": " + fmtNum(state.total) + " илэрцээс " + state.items.length + "-ыг харуулж байна";
    el.list.innerHTML = state.items.map(function (it, i) {
      var tags = "";
      if (it.pmcid) tags += '<span class="ps-tag ps-tag-full"><i class="bi bi-unlock"></i> Бүтэн эх</span>';
      (it.pubtypes || []).forEach(function (t) { if (TYPE_LABEL[t]) tags += '<span class="ps-tag">' + TYPE_LABEL[t] + "</span>"; });
      if (it.cited != null && it.cited !== "") tags += '<span class="ps-tag">Иш татагдсан: ' + esc(it.cited) + "</span>";
      return '<li><button type="button" class="ps-item' + (state.sel && state.sel.key === it.key ? " is-active" : "") + '" data-i="' + i + '">' +
        '<span class="ps-item-title">' + esc(it.title || "(гарчиггүй)") + "</span>" +
        '<span class="ps-item-meta"><em>' + esc(it.jabbr || it.journal) + "</em>" + (it.year ? " · " + esc(it.year) : "") + (authorLine(it) ? " · " + esc(authorLine(it)) : "") + "</span>" +
        (tags ? '<span class="ps-item-tags">' + tags + "</span>" : "") +
        "</button></li>";
    }).join("");
    el.more.hidden = state.items.length >= state.total || state.items.length >= 100;
  }

  /* ---------- Сэтгүүлийн индекс ---------- */

  /* Scopus: Elsevier-ийн Serial Title API нь ISSN-ээр сэтгүүлийн үндсэн мэдээллийг
     түлхүүргүй буцаадаг (200 = Scopus-ын эх сурвалжийн жагсаалтад бий, 404 = алга).
     Хамрах он, CiteScore нь түлхүүр шаарддаг тул Scopus дахь хуудас руу нь холбоно.
     Web of Science: Clarivate (Master Journal List) хөтчөөс шууд дуудагдахыг зөвшөөрдөггүй
     тул серверээр дамжихаас нааш хуудсанд хариу гаргах боломжгүй, холбоос хэвээр үлдэнэ. */
  var idxCache = {};

  function fmtIssn(s) {
    s = String(s || "").toUpperCase().replace(/[^0-9X]/g, "");
    return /^\d{7}[\dX]$/.test(s) ? s.slice(0, 4) + "-" + s.slice(4) : "";
  }

  async function scopusSource(issns) {
    for (var i = 0; i < issns.length; i++) {
      var r = await fetch("https://api.elsevier.com/content/serial/title/issn/" + issns[i], { headers: { Accept: "application/json" } });
      if (r.status === 404) continue;
      if (!r.ok) throw new Error("Scopus " + r.status);
      var e = (((await r.json())["serial-metadata-response"] || {}).entry || [])[0];
      if (!e || !e["dc:title"]) throw new Error("Scopus: танигдаагүй хариу");
      var link = (e.link || []).filter(function (l) { return l["@ref"] === "scopus-source"; })[0];
      var url = link && /^https:\/\/www\.scopus\.com\//.test(link["@href"] || "") ? link["@href"] : "";
      return { found: true, title: e["dc:title"], url: url };
    }
    return { found: false };
  }

  function idxBody(issns, st) {
    var ext = ' target="_blank" rel="noopener"', sc;
    if (!st) sc = '<span class="ps-idx-v"><span class="ps-spin"></span>шалгаж байна…</span>';
    else if (st.error) {
      sc = '<span class="ps-idx-v">одоогоор шалгаж чадсангүй</span> · ' +
        '<a href="https://www.scimagojr.com/journalsearch.php?q=' + issns[0].replace("-", "") + '"' + ext + ">SJR-ээс харах</a>";
    } else if (st.found) {
      sc = '<span class="ps-idx-v is-yes" title="' + esc(st.title) + '"><i class="bi bi-check-circle-fill"></i> бүртгэлтэй</span>' +
        (st.url ? ' · <a href="' + esc(st.url) + '"' + ext + ">Хамрах он, CiteScore</a>" : "");
    } else {
      sc = '<span class="ps-idx-v is-no" title="ISSN ' + issns.join(", ") + '"><i class="bi bi-x-circle"></i> жагсаалтаас олдсонгүй</span>';
    }
    return '<span class="ps-idx-t">Сэтгүүлийн индекс</span>' +
      '<span class="ps-idx-row"><b>Scopus:</b> ' + sc + "</span>" +
      '<span class="ps-idx-row"><b>Web of Science:</b> <a href="https://mjl.clarivate.com/search-results?issn=' + issns[0] + '"' + ext + ">Master Journal List-ээс шалгах</a></span>";
  }

  /* Нэг нийтлэлийн толгой хэд хэдэн удаа зурагддаг тул хариуг ISSN-ээр нь хадгалж,
     ирэхэд нь дэлгэц дээр байгаа бүх хайрцгийг шинэчилнэ. */
  function journalIndex(p) {
    var issns = [fmtIssn(p.issn), fmtIssn(p.essn)].filter(function (s, i, a) { return s && a.indexOf(s) === i; });
    if (!issns.length) return "";
    var key = issns.join("_"), c = idxCache[key];
    if (c && c.st && c.st.error && Date.now() - c.at > 30000) c = null; /* алдаа гарсан бол хэсэг хугацааны дараа дахин оролдоно */
    if (!c) {
      c = idxCache[key] = { st: null, at: 0 };
      scopusSource(issns).then(function (st) { return st; }, function () { return { error: true }; }).then(function (st) {
        c.st = st; c.at = Date.now();
        root.querySelectorAll('.ps-idx[data-k="' + key + '"]').forEach(function (n) { n.innerHTML = idxBody(issns, st); });
      });
    }
    return '<div class="ps-idx" data-k="' + key + '" aria-live="polite">' + idxBody(issns, c.st) + "</div>";
  }

  /* ---------- Баруун тал: тайлбар ---------- */

  function paperHead(p) {
    var links = [];
    if (p.pmid) links.push('<a href="https://pubmed.ncbi.nlm.nih.gov/' + esc(p.pmid) + '/" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i> PubMed</a>');
    if (p.pmcid) links.push('<a href="https://pmc.ncbi.nlm.nih.gov/articles/' + esc(p.pmcid) + '/" target="_blank" rel="noopener"><i class="bi bi-unlock"></i> Бүтэн эх (PMC)</a>');
    if (p.doi) links.push('<a href="https://doi.org/' + esc(p.doi) + '" target="_blank" rel="noopener"><i class="bi bi-link-45deg"></i> DOI</a>');
    if (p.src === "scopus" && p.url) links.push('<a href="' + esc(p.url) + '" target="_blank" rel="noopener">Scopus</a>');
    if (p.src === "wos" && p.url) links.push('<a href="' + esc(p.url) + '" target="_blank" rel="noopener">Web of Science</a>');
    return '<header class="ps-head">' +
      '<button type="button" class="ps-back"><i class="bi bi-arrow-left"></i> Жагсаалт руу</button>' +
      "<h2>" + esc(p.title) + "</h2>" +
      '<p class="ps-head-meta"><em>' + esc(p.journal) + "</em>" + (p.year ? " · " + esc(p.year) : "") + (authorLine(p) ? " · " + esc(authorLine(p)) : "") + "</p>" +
      '<p class="ps-head-links">' + links.join("") + "</p>" +
      journalIndex(p) +
      "</header>";
  }

  function methodCard(h, base) {
    var m = h.m, links = [];
    if (m.page) links.push('<a href="' + base + "methods/" + m.page + '.html">Аргын хуудас</a>');
    if (m.g && (!glossary || glossary.byId[m.g])) links.push('<a href="' + base + "glossary.html#" + m.g + '">Толь</a>');
    return '<article class="ps-m">' +
      "<h4>" + esc(m.mn) + ' <span lang="en">' + esc(m.en) + "</span></h4>" +
      "<p>" + esc(m.plain) + "</p>" +
      '<details><summary>Нийтлэлд хаана дурдсан бэ?</summary><blockquote lang="en">' + h.ev + "<cite>— " + esc(h.segLabel) + "</cite></blockquote></details>" +
      (links.length ? '<p class="ps-m-links">' + links.join(" · ") + "</p>" : "") +
      "</article>";
  }

  function renderExplain(p, a) {
    var base = root.getAttribute("data-base") || "";
    var h = paperHead(p);

    /* AI тайлбар (сервер тохируулагдсан үед) */
    if (cfg.ai) {
      h += '<section class="ps-ai"><h3><i class="bi bi-stars"></i> Энгийн тайлбар <span class="ps-pill">AI</span></h3>' +
        '<div class="ps-ai-body"><p class="ps-wait"><span class="ps-spin"></span> AI тайлбар бэлтгэж байна…</p></div>' +
        '<div class="ps-chat" hidden><div class="ps-chat-log"></div>' +
        '<form class="ps-chat-form"><input type="text" name="msg" maxlength="400" autocomplete="off" placeholder="Энэ нийтлэлийн статистикийн талаар асуух…" aria-label="Нийтлэлийн талаар асуух"><button type="submit" class="btn btn-primary btn-sm"><i class="bi bi-send"></i></button></form></div>' +
        "</section>";
    }

    /* Товч дүгнэлт */
    var sum = [];
    if (a.design) sum.push("Энэ нийтлэл нь <b>" + esc(a.design.m.mn.toLowerCase()) + "</b> юм. " + esc(a.design.m.plain));
    if (a.main.length) {
      sum.push("Гол шинжилгээний аргууд: " + a.main.slice(0, 4).map(function (x) { return "<b>" + esc(x.m.mn) + "</b>"; }).join(", ") +
        (a.main.length > 4 ? " болон өөр " + (a.main.length - 4) + " арга." : "."));
    }
    if (a.alpha) sum.push("Судлаачид p &lt; " + esc(a.alpha) + " байвал ялгааг статистикийн хувьд ач холбогдолтой гэж үзсэн.");
    if (a.software.length) sum.push("Тооцооллыг " + a.software.map(esc).join(", ") + " програмаар хийсэн.");
    if (!a.hits.length) sum.push("Энэ нийтлэлийн бичвэрээс статистик арга танигдсангүй. Тойм, тохиолдлын тайлан, эсвэл хураангуйд арга зүйгээ бичээгүй нийтлэл байж магадгүй.");

    h += '<section class="ps-sum"><h3><i class="bi bi-lightbulb"></i> ' + (cfg.ai ? "Товчхондоо" : "Энгийн тайлбар") + "</h3>" +
      sum.map(function (s) { return "<p>" + s + "</p>"; }).join("") +
      '<p class="ps-cover"><i class="bi ' + (p.fullText ? "bi-file-earmark-check" : "bi-file-earmark-minus") + '"></i> ' +
      (p.fullText ? "Нийтлэлийн бүтэн эхийн арга зүйн хэсэг болон хураангуйг уншиж тайлбарлав."
        : p.pmcid ? "Зөвхөн хураангуйг уншиж тайлбарлав (хэвлэгч нь бүтэн эхийг программаар уншихыг зөвшөөрөөгүй)."
        : "Зөвхөн хураангуйг уншиж тайлбарлав (бүтэн эх нь нээлттэй санд байхгүй).") + "</p></section>";

    /* Гол тоонууд */
    if (a.estimates.length) {
      h += '<section class="ps-sec"><h3><i class="bi bi-calculator"></i> Гол тоонуудыг хэрхэн унших вэ</h3>' +
        a.estimates.map(function (o) {
          return '<article class="ps-est"><p class="ps-est-n"><b>' + o.kind + " = " + esc(o.vRaw) + "</b>" +
            (o.lo != null ? " <span>95% CI " + esc(o.loRaw) + "–" + esc(o.hiRaw) + "</span>" : "") +
            (o.p != null ? " <span>p " + o.pOp + " " + esc(o.pRaw) + "</span>" : "") + "</p>" +
            "<p>" + interpret(o) + "</p>" +
            '<blockquote lang="en">' + o.ev + "</blockquote></article>";
        }).join("") +
        '<p class="ps-note">Аль бүлгийг алинтай харьцуулсныг дээрх ишлэлээс харна уу.</p></section>';
    }

    /* Аргууд бүлгээр */
    Object.keys(D.cats).forEach(function (c) {
      var hs = a.hits.filter(function (x) { return x.m.cat === c; });
      if (!hs.length) return;
      h += '<section class="ps-sec ps-cat-' + c + '"><h3><i class="bi ' + D.cats[c].icon + '"></i> ' + D.cats[c].mn + " <span>" + hs.length + "</span></h3>" +
        '<div class="ps-ms">' + hs.map(function (x) { return methodCard(x, base); }).join("") + "</div></section>";
    });

    if (a.cautions.length) {
      h += '<section class="ps-sec ps-caution"><h3><i class="bi bi-exclamation-triangle"></i> Уншихдаа анхаарах зүйл</h3><ul>' +
        a.cautions.map(function (c) { return "<li>" + c + "</li>"; }).join("") + "</ul></section>";
    }

    if (p.abstract.length) {
      h += '<details class="ps-abs"><summary>Нийтлэлийн хураангуй (англи)</summary><div lang="en">' +
        p.abstract.map(function (s) { return "<p>" + (s.label ? "<b>" + esc(s.label) + ":</b> " : "") + esc(s.text) + "</p>"; }).join("") +
        "</div></details>";
    }

    h += '<p class="ps-disclaimer">Энэ тайлбарыг программ нийтлэлийн бичвэрээс автоматаар гаргасан тул дутуу, алдаатай байж болно. Эмчилгээ, оношилгооны шийдвэр гаргахад ашиглахгүй, эх нийтлэлтэй нь тулгаж уншаарай.</p>';

    el.right.innerHTML = h;
  }

  async function select(item, scroll) {
    var my = ++token;
    state.sel = item; chat = [];
    el.list.querySelectorAll(".ps-item").forEach(function (b) { b.classList.toggle("is-active", state.items[+b.dataset.i] === item); });
    el.right.innerHTML = paperHead(item) + '<p class="ps-wait"><span class="ps-spin"></span> Нийтлэлийн бичвэрийг уншиж байна…</p>';
    if (scroll && window.matchMedia("(max-width: 991px)").matches) el.right.scrollIntoView({ behavior: "smooth" });
    try {
      var p = await loadPaper(item);
      if (my !== token) return;
      var a = analyse(p);
      state.paper = p; state.analysis = a;
      renderExplain(p, a);
      try { history.replaceState(null, "", "#" + (p.pmid ? "pmid=" + p.pmid : "doi=" + encodeURIComponent(p.doi || ""))); } catch (e) { /* noop */ }
      if (cfg.ai) aiExplain(my);
    } catch (e) {
      if (my !== token) return;
      el.right.innerHTML = paperHead(item) + '<p class="ps-err"><i class="bi bi-exclamation-triangle"></i> Нийтлэлийн бичвэрийг авч чадсангүй. Дахин оролдоно уу.</p>';
    }
  }

  /* ---------- AI (сервер) ---------- */

  function aiPayload() {
    var p = state.paper, a = state.analysis;
    var abs = p.abstract.map(function (s) { return (s.label ? s.label + ": " : "") + s.text; }).join("\n");
    return {
      id: p.pmid ? "pmid:" + p.pmid : "doi:" + p.doi,
      title: p.title, journal: p.journal, year: p.year,
      design: a.design ? a.design.m.en : "",
      methods: a.hits.map(function (h) { return { en: h.m.en, mn: h.m.mn }; }).slice(0, 40),
      abstract: abs.slice(0, 6000),
      stats: (p.statsText || p.methodsText || p.bodyText || "").slice(0, 8000)
    };
  }

  /* AI-ийн хариуг аюулгүйгээр HTML болгох: ## гарчиг, - жагсаалт, **тод** */
  function mdToHtml(t) {
    var out = [], list = false;
    String(t || "").split(/\r?\n/).forEach(function (line) {
      var s = esc(line.trim()).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
      var li = /^[-*•]\s+(.*)$/.exec(s), hd = /^#{1,4}\s+(.*)$/.exec(s);
      if (li) { if (!list) { out.push("<ul>"); list = true; } out.push("<li>" + li[1] + "</li>"); return; }
      if (list) { out.push("</ul>"); list = false; }
      if (hd) out.push("<h4>" + hd[1] + "</h4>");
      else if (s) out.push("<p>" + s + "</p>");
    });
    if (list) out.push("</ul>");
    return out.join("");
  }

  async function aiCall(body) {
    var r = await fetch(API + "/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || !j.text) throw new Error(j.error || "AI сервер " + r.status + " алдаа буцаалаа.");
    return j.text;
  }

  async function aiExplain(my) {
    var box = el.right.querySelector(".ps-ai-body");
    try {
      var text = await aiCall(aiPayload());
      if (my !== token) return;
      box.innerHTML = mdToHtml(text);
      chat = [{ role: "assistant", content: text }];
      el.right.querySelector(".ps-chat").hidden = false;
    } catch (e) {
      if (my !== token) return;
      box.innerHTML = '<p class="ps-err"><i class="bi bi-exclamation-triangle"></i> AI тайлбар авч чадсангүй. Доорх бэлэн тайлбарыг уншина уу.</p>';
    }
  }

  async function ask(form) {
    var input = form.elements.msg, q = input.value.trim(), my = token;
    if (!q || form.dataset.busy) return;
    var log = el.right.querySelector(".ps-chat-log");
    form.dataset.busy = "1"; input.value = "";
    log.insertAdjacentHTML("beforeend", '<div class="ps-msg ps-msg-user">' + esc(q) + '</div><div class="ps-msg ps-msg-ai"><span class="ps-spin"></span></div>');
    var bubble = log.lastElementChild;
    bubble.scrollIntoView({ behavior: "smooth", block: "nearest" });
    var body = aiPayload();
    body.messages = chat.slice(-6).concat([{ role: "user", content: q }]);
    try {
      var text = await aiCall(body);
      if (my !== token) return;
      chat.push({ role: "user", content: q }, { role: "assistant", content: text });
      bubble.innerHTML = mdToHtml(text);
    } catch (e) {
      if (my === token) bubble.innerHTML = '<span class="ps-err">Хариу авч чадсангүй. Дахин асууна уу.</span>';
    } finally {
      delete form.dataset.busy;
    }
  }

  /* ---------- Эхлүүлэх ---------- */

  function loadGlossary(src) {
    if (!src || !window.jsyaml) return Promise.resolve(null);
    return fetch(src).then(function (r) { return r.ok ? r.text() : ""; }).then(function (t) {
      var byId = {};
      (window.jsyaml.load(t) || []).forEach(function (x) { byId[x.id] = x; });
      return { byId: byId };
    }).catch(function () { return null; });
  }

  function loadConfig() {
    if (!API) return Promise.resolve();
    return fetch(API + "/config").then(function (r) { return r.ok ? r.json() : {}; }).then(function (c) {
      cfg.ai = !!c.ai; cfg.wos = !!c.wos; cfg.scopus = !!c.scopus;
    }).catch(function () {});
  }

  function boot() {
    root = document.querySelector(".ps-app");
    if (!root || !D) return;
    API = (root.getAttribute("data-api") || "").trim().replace(/\/+$/, "");
    Promise.all([loadGlossary(root.getAttribute("data-glossary")), loadConfig()]).then(function (r) {
      glossary = r[0];
      build();
      var m = /^#(pmid|doi)=(.+)$/.exec(location.hash);
      if (m) { el.q.value = (m[1] === "pmid" ? "PMID:" : "") + decodeURIComponent(m[2]); search(true); }
    });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})();
