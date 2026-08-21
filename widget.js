/*!
 * Klimarisiko-widget — embeddable municipality climate-risk card
 * Klimamonitor.no
 *
 * ============================================================================
 * PROTOTYPE — THINGS THAT ARE NOT YET CONFIRMED, SEARCH FOR "ANTAKELSE":
 *
 * 1. HOW THE WIDGET LEARNS WHICH MUNICIPALITY TO SHOW.
 *    Placeholder for now: a `?kommune=` URL query parameter (name or 4-digit
 *    SSB-number). Swap this out once the partner team confirms their hook
 *    (see detectKommune()).
 *
 * 2. THE SCORING/RANKING FORMULA — now the REAL formula, not a guess.
 *    I read klimamonitor's own open-source dashboard code
 *    (github.com/tiltobias/klimarisk, frontend/src/hooks/useDataStore.ts +
 *    hooks/statistics.ts + components/details/DetailedStats.tsx) and ported
 *    its exact calculation here — see computeAll() below for the full
 *    method: per-metric average per category (per kommune, per year) →
 *    global min–max normalisation per category across ALL THREE YEARS
 *    combined → total = sum of the four (invert-aware) category scores →
 *    rank via descending comparison WITHIN the selected year → level
 *    (1–5, for the bar gauge) via the same min–max domain split the
 *    dashboard itself uses for its map colouring, also invert-aware.
 *    This is verified against the dashboard's own formula line-by-line —
 *    not a guess anymore. The one thing I could NOT fully verify is
 *    whether it reproduces your "Sogndal" reference graphic's exact bar
 *    counts (see point 3) — most likely that graphic was rendered from an
 *    earlier monthly data snapshot than the one this widget fetches live
 *    today, which would explain small differences without the methodology
 *    itself being wrong.
 *
 * 3. THE 5-BAR "LEVEL" GAUGE.
 *    Colours sampled exactly from your reference screenshot. Bucket
 *    boundaries now come from the dashboard's real min–max domain logic
 *    (see point 2) rather than a guessed equal-20-point split — though for
 *    the 4 categories this happens to work out to the same thing, since
 *    the normalisation always stretches each category's scores to exactly
 *    span 0–100. I could not find the exact code that generated the
 *    "Sogndal" share-graphic itself (it isn't in the dashboard repo), so
 *    if that graphic is produced some other way, small differences versus
 *    this widget are still possible. Worth asking your team where that
 *    specific graphic is generated, if pixel-perfect parity matters.
 *
 * 4. THE LOGO — no longer a guess: embeds the two real logo files you sent
 *    (LOGO_FOR_DARK_BG / LOGO_FOR_LIGHT_BG below), used automatically
 *    depending on `data-theme`.
 * ============================================================================
 */
(function () {
  "use strict";

  // ---- Configuration -------------------------------------------------------

  var DATA_MODEL_URL =
    "https://tiltobias.github.io/klimarisk-data/kommune_data_model.json";
  var DATA_URL = "https://tiltobias.github.io/klimarisk-data/kommune_data.json";
  // The dashboard itself defaults to the LAST year in the data model (today
  // that's 2100 — projected, not current). For an external widget showing
  // "how much climate risk does this municipality face", the 2025 reference
  // period reads more naturally as a default — override with data-year.
  var DEFAULT_YEAR = "2025";
  var DASHBOARD_URL = "https://klimamonitor.no/klimarisiko";

  var CATEGORY_ORDER = ["f", "e", "s", "r"];
  var CAT_LABEL_FALLBACK = { f: "Fare", e: "Eksponering", s: "Sårbarhet", r: "Respons" };

  // ---- Brand palette --------------------------------------------------------
  // Dark-bg colours sampled directly from your "Sogndal" reference image;
  // confirmed against the real logo files (same teal, same cyan). Light-bg
  // colours are a proposed inversion — flag anything you'd rather change.

  var LOGO_FOR_DARK_BG = "data:image/png;base64,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R0rGumOunety9/N+WmcUyuyksDcxf+/emDflEb+7pNdz9b2pEOf+SXVkkgqzV3X006pyH4h1v5fL02V+WjHfbg2OZXJiLLWcS7+SS2skBHpDvF9mWpjZrVSmzhlNV9eiT0pxc+yzhCX47mQCMCP3XpT7ci0XcRZwGMFXpzdwgxKOpoRV2y1KXst8arOZLTGzhxp0uziEECMeKmcxFuubCWQC7WCFze71+vBIVM0bwsz+TFhdzuLArQHsCmSe7e8SZnDD42yuYWLdycNHugILh/buTYjzD+mxnA4M68xYzOznVIIZHCzpc7XyN0oq+mZPZgTwABXnw65S1y4jTNOzp9ioaLTsNsysTdJnCQ6UfYC7yw6jaJC/Ujnu7KFiopk9LGkI4csKsAtBaL5E+TFpeebkrq8hRnko5HksV9cs6nMFQd3LL8S05eq4rqpEhVEE2xcE5845hMCLWdnUuZtFbgD+SPqoO8zsUUm7EQ74GEiIHPIGYZy3mdkrJfX+MdePZ0vq/omCyrkZ1aaR+3Pla82+byQI1WT/C+3NkrQ7sA/BebTRsfwp15dnEunHUTmEN3Xa+wcfST+N081RXdzOxxQ2nP6+OCV2HMdpGEkbKOyTS+7kb3JbIyWVeTI7juM0hprrHe44juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4juM4Ti3+D1axtnW92XypAAAAAElFTkSuQmCC";
  var LOGO_FOR_LIGHT_BG = "data:image/png;base64,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";

  var THEMES = {
    dark: {
      bg: "#124D56",
      text: "#FFFFFF",
      label: "#D1D1D1",
      segmentOn: "#5FBCD3",
      segmentOff: "#156082",
      rankMuted: "rgba(255,255,255,.62)",
      link: "#5FBCD3",
      divider: "rgba(255,255,255,.18)",
      footerBorder: "rgba(255,255,255,.15)",
      cardBorder: "none",
      shadow: "0 1px 3px rgba(0,0,0,0.18)",
      stateColor: "rgba(255,255,255,.75)",
      logo: LOGO_FOR_DARK_BG,
    },
    light: {
      bg: "#FFFFFF",
      text: "#124D56",
      label: "#5B6A66",
      segmentOn: "#2E93B0",
      segmentOff: "#DCE8EA",
      rankMuted: "rgba(18,77,86,.6)",
      link: "#0F5C53",
      divider: "rgba(18,77,86,.15)",
      footerBorder: "rgba(18,77,86,.12)",
      cardBorder: "1px solid #E2E8E6",
      shadow: "0 1px 3px rgba(15,40,35,0.08)",
      stateColor: "rgba(18,77,86,.65)",
      logo: LOGO_FOR_LIGHT_BG,
    },
  };

  // ---- Municipality detection ------------------------------------------------
  // ANTAKELSE (assumption, placeholder until confirmed by the partner team):
  // reads a `?kommune=` query parameter containing either the 4-digit SSB
  // kommunenummer (e.g. "3207") or the municipality name. Also honours a
  // `data-kommune` attribute on the widget container, and a
  // `window.KLIMARISIKO_KOMMUNE` global, so the integration can be swapped
  // later without touching this function's callers.
  function detectKommune(container) {
    if (container && container.getAttribute("data-kommune")) {
      return container.getAttribute("data-kommune");
    }
    if (window.KLIMARISIKO_KOMMUNE) {
      return String(window.KLIMARISIKO_KOMMUNE);
    }
    try {
      var params = new URLSearchParams(window.location.search);
      var q = params.get("kommune");
      if (q) return q;
    } catch (e) {
      /* URLSearchParams unsupported — ignore */
    }
    return null;
  }

  function normalizeStr(str) {
    return String(str).toLowerCase().replace(/-/g, " ").trim();
  }

  function findKommuneId(query, results) {
    if (!query) return null;
    var q = String(query).trim();
    if (/^\d{4}$/.test(q) && results[q]) return q;
    var qn = normalizeStr(q);
    for (var id in results) {
      if (normalizeStr(results[id].name) === qn) return id;
    }
    return null;
  }

  // ---- Score computation ------------------------------------------------
  // Ported from klimamonitor's own dashboard source — see file header
  // point 2 for exactly which files this mirrors.

  function computeAll(model, data) {
    var elements = model.elements;
    var invert = {};
    var metricsByCat = {};
    elements.forEach(function (element) {
      invert[element.key] = !!element.invert;
      metricsByCat[element.key] = element.metrics.map(function (m) {
        return { key: m.key, invert: !!m.invert };
      });
    });

    var years = Object.keys(data.years);

    function rawAvg(entry, cat) {
      var metrics = metricsByCat[cat];
      var n = entry.klimarisk_indicator_number && entry.klimarisk_indicator_number[cat];
      if (!n) return null;
      var sum = 0;
      for (var i = 0; i < metrics.length; i++) {
        var v = entry[metrics[i].key];
        if (typeof v !== "number") continue;
        sum += metrics[i].invert ? 100 - v : v;
      }
      return sum / n;
    }

    // raw[year][kommuneId][cat] — per-category average, before normalisation
    var raw = {};
    years.forEach(function (year) {
      raw[year] = {};
      var byKommune = data.years[year].byKommune;
      Object.keys(byKommune).forEach(function (id) {
        var entry = byKommune[id];
        var cats = {};
        CATEGORY_ORDER.forEach(function (cat) {
          cats[cat] = rawAvg(entry, cat);
        });
        raw[year][id] = cats;
      });
    });

    // Global (cross-year) min/max per category — matches calculateElementValue()
    var catMin = {};
    var catMax = {};
    CATEGORY_ORDER.forEach(function (cat) {
      var min = Infinity;
      var max = -Infinity;
      years.forEach(function (year) {
        Object.keys(raw[year]).forEach(function (id) {
          var v = raw[year][id][cat];
          if (v === null) return;
          if (v < min) min = v;
          if (v > max) max = v;
        });
      });
      catMin[cat] = min;
      catMax[cat] = max;
    });

    // Normalised 0–100 category score, per year per kommune
    var norm = {};
    years.forEach(function (year) {
      norm[year] = {};
      Object.keys(raw[year]).forEach(function (id) {
        var cats = {};
        CATEGORY_ORDER.forEach(function (cat) {
          var v = raw[year][id][cat];
          var mn = catMin[cat];
          var mx = catMax[cat];
          cats[cat] = v === null || mx <= mn ? null : ((v - mn) / (mx - mn)) * 100;
        });
        norm[year][id] = cats;
      });
    });

    // Total risk = sum of the four (invert-aware) category scores
    var total = {};
    years.forEach(function (year) {
      total[year] = {};
      Object.keys(norm[year]).forEach(function (id) {
        var cats = norm[year][id];
        var sum = 0;
        var any = false;
        CATEGORY_ORDER.forEach(function (cat) {
          var v = cats[cat];
          if (v === null) return;
          any = true;
          sum += invert[cat] ? 100 - v : v;
        });
        total[year][id] = any ? sum : null;
      });
    });

    // Global (cross-year) min/max of total — matches getDistributionDomain()
    var totMin = Infinity;
    var totMax = -Infinity;
    years.forEach(function (year) {
      Object.keys(total[year]).forEach(function (id) {
        var v = total[year][id];
        if (v === null) return;
        if (v < totMin) totMin = v;
        if (v > totMax) totMax = v;
      });
    });

    function levelOf(v, mn, mx, inv) {
      if (v === null || v === undefined) return null;
      if (mx <= mn) return 1;
      var idx = Math.floor(((v - mn) / (mx - mn)) * 5);
      if (idx > 4) idx = 4;
      if (idx < 0) idx = 0;
      if (inv) idx = 4 - idx;
      return idx + 1;
    }

    // rank 1 = highest risk. `inv`: lower value = worse (used for elements
    // flagged invert, e.g. Respons, where low = little response capacity).
    function rankWithin(ids, getter, inv) {
      var sorted = ids.slice().sort(function (a, b) {
        var va = getter(a);
        var vb = getter(b);
        var na = va === null || va === undefined;
        var nb = vb === null || vb === undefined;
        if (na && nb) return 0;
        if (na) return 1;
        if (nb) return -1;
        return inv ? va - vb : vb - va;
      });
      var ranks = {};
      sorted.forEach(function (id, i) {
        ranks[id] = i + 1;
      });
      return ranks;
    }

    var byYear = {};
    years.forEach(function (year) {
      var ids = Object.keys(data.years[year].byKommune);
      var results = {};
      ids.forEach(function (id) {
        results[id] = {
          id: id,
          name: data.years[year].byKommune[id].klimarisk_name,
          cats: norm[year][id],
          total: total[year][id],
        };
      });

      var totalRanks = rankWithin(
        ids,
        function (id) {
          return total[year][id];
        },
        false
      );
      var totalLevels = {};
      ids.forEach(function (id) {
        totalLevels[id] = levelOf(total[year][id], totMin, totMax, false);
      });

      var catRanks = {};
      var catLevels = {};
      CATEGORY_ORDER.forEach(function (cat) {
        catRanks[cat] = rankWithin(
          ids,
          function (id) {
            return norm[year][id][cat];
          },
          invert[cat]
        );
        catLevels[cat] = {};
        ids.forEach(function (id) {
          catLevels[cat][id] = levelOf(norm[year][id][cat], 0, 100, invert[cat]);
        });
      });

      byYear[year] = {
        results: results,
        totalRanks: totalRanks,
        totalLevels: totalLevels,
        catRanks: catRanks,
        catLevels: catLevels,
        n: ids.length,
      };
    });

    return byYear; // { "2025": {...}, "2050": {...}, "2100": {...} }
  }

  // ---- Data loading (cached across multiple widgets on one page) -----------

  var _dataPromise = null;
  function loadData() {
    if (_dataPromise) return _dataPromise;
    _dataPromise = Promise.all([
      fetch(DATA_MODEL_URL).then(function (r) {
        if (!r.ok) throw new Error("Klarte ikke hente datamodell (" + r.status + ")");
        return r.json();
      }),
      fetch(DATA_URL).then(function (r) {
        if (!r.ok) throw new Error("Klarte ikke hente kommunedata (" + r.status + ")");
        return r.json();
      }),
    ]).then(function (arr) {
      return { model: arr[0], data: arr[1] };
    });
    return _dataPromise;
  }

  var _allComputed = null;
  function getComputedAll() {
    if (_allComputed) return Promise.resolve(_allComputed);
    return loadData().then(function (d) {
      _allComputed = computeAll(d.model, d.data);
      return _allComputed;
    });
  }

  function getComputed(year) {
    return getComputedAll().then(function (byYear) {
      return byYear[year] || byYear[Object.keys(byYear)[0]];
    });
  }

  // ---- Rendering --------------------------------------------------------

  function buildStyle(t, layout) {
    var isList = layout === "list";
    return [
      ":host, .kr-card * { box-sizing: border-box; }",
      ".kr-card {",
      "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;",
      "  width: " + (isList ? "220px" : "340px") + ";",
      "  border-radius: 14px;",
      "  border: " + t.cardBorder + ";",
      "  background: " + t.bg + ";",
      "  color: " + t.text + ";",
      "  padding: 18px 18px 14px;",
      "  box-shadow: " + t.shadow + ";",
      "}",
      ".kr-header { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:16px; }",
      ".kr-kommune { font-size: " + (isList ? "18px" : "21px") + "; font-weight: 800; line-height:1.15; }",
      ".kr-logo { height: 36px; flex: none; margin-top: 2px; margin-bottom:16px;}",
      ".kr-logo img { height: 36px; width: auto; display:block; margin-bottom:16px;}",

      // grid layout (5 columns, vertical bar gauges)
      ".kr-gauges { display:flex; gap:9px; }",
      ".kr-gauge-col { display:flex; flex-direction:column; align-items:center; width:52px; }",
      ".kr-gauge-col.kr-total { width:58px; position:relative; margin-right:5px; padding-right:9px; }",
      ".kr-gauge-col.kr-total::after { content:''; position:absolute; right:0; top:0; bottom:16px; width:1px; background:" + t.divider + "; }",
      ".kr-gauge-label { font-size:10px; color:" + t.label + "; text-align:center; line-height:1.15; min-height:24px; display:flex; align-items:flex-end; justify-content:center; margin-bottom:7px; font-weight:600; }",
      ".kr-total .kr-gauge-label { color:" + t.text + "; font-weight:800; font-size:10.5px; }",
      ".kr-gauge { display:flex; flex-direction:column; gap:2px; }",
      ".kr-seg { width:38px; height:7px; border-radius:2px; background:" + t.segmentOff + "; }",
      ".kr-seg.on { background:" + t.segmentOn + "; }",
      ".kr-total .kr-seg { width:44px; height:8px; }",
      ".kr-gauge-rank { margin-top:7px; font-size:10px; color:" + t.rankMuted + "; font-weight:600; white-space:nowrap; }",
      ".kr-total .kr-gauge-rank { color:" + t.text + "; font-size:11px; font-weight:800; }",

      // list layout (stacked rows, horizontal bar gauges)
      ".kr-list { display:flex; flex-direction:column; gap:9px; }",
      ".kr-row { display:flex; align-items:center; gap:8px; }",
      ".kr-row.kr-total { padding-bottom:9px; margin-bottom:2px; border-bottom:1px solid " + t.divider + "; }",
      ".kr-row-label { font-size:11.5px; color:" + t.label + "; font-weight:600; width:70px; flex:none; }",
      ".kr-row.kr-total .kr-row-label { color:" + t.text + "; font-weight:800; font-size:12.5px; }",
      ".kr-row-gauge { display:flex; gap:2px; flex:1; }",
      ".kr-row-gauge .kr-seg { width:100%; height:8px; }",
      ".kr-row.kr-total .kr-row-gauge .kr-seg { height:9px; }",
      ".kr-row-rank { font-size:10.5px; color:" + t.rankMuted + "; font-weight:700; width:44px; flex:none; text-align:right; white-space:nowrap; }",
      ".kr-row.kr-total .kr-row-rank { color:" + t.text + "; font-size:11.5px; }",

      ".kr-footer { margin-top:16px; padding-top:10px; border-top:1px solid " + t.footerBorder + "; text-align:right; }",
      ".kr-link { font-size:11px; color:" + t.link + "; text-decoration:none; font-weight:700; }",
      ".kr-link:hover { text-decoration:underline; }",
      ".kr-state { font-size:12.5px; color:" + t.stateColor + "; padding: 14px 2px; }",
    ].join("\n");
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function renderLoading(root) {
    root.innerHTML = "";
    var card = el("div", "kr-card");
    card.appendChild(el("div", "kr-state", "Laster klimarisiko …"));
    root.appendChild(card);
  }

  function renderError(root, message) {
    root.innerHTML = "";
    var card = el("div", "kr-card");
    card.appendChild(el("div", "kr-state", message));
    root.appendChild(card);
  }

  function segments(level) {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < 5; i++) {
      // i=0 is the "first" segment; the last `level` segments light up
      // (bottom-up in the grid layout, left-to-right in the list layout).
      var filled = level !== null && i >= 5 - level;
      frag.appendChild(el("div", "kr-seg" + (filled ? " on" : "")));
    }
    return frag;
  }

  function rankLabel(level, rank, n) {
    return level === null ? "–" : "Nr. " + rank;
  }

  function gaugeColumn(label, level, rank, n, isTotal) {
    var col = el("div", "kr-gauge-col" + (isTotal ? " kr-total" : ""));
    col.appendChild(el("div", "kr-gauge-label", label));
    var gauge = el("div", "kr-gauge");
    gauge.appendChild(segments(level));
    col.appendChild(gauge);
    var rankEl = el("div", "kr-gauge-rank", rankLabel(level, rank, n));
    if (level !== null) rankEl.title = "Nr. " + rank + " av " + n + " kommunar (høgst risiko = nr. 1)";
    col.appendChild(rankEl);
    return col;
  }

  function gaugeRow(label, level, rank, n, isTotal) {
    var row = el("div", "kr-row" + (isTotal ? " kr-total" : ""));
    row.appendChild(el("div", "kr-row-label", label));
    var gauge = el("div", "kr-row-gauge");
    gauge.appendChild(segments(level));
    row.appendChild(gauge);
    var rankEl = el("div", "kr-row-rank", rankLabel(level, rank, n));
    if (level !== null) rankEl.title = "Nr. " + rank + " av " + n + " kommunar (høgst risiko = nr. 1)";
    row.appendChild(rankEl);
    return row;
  }

  function renderWidget(root, opts, computed, kommuneId) {
    var r = computed.results[kommuneId];
    var n = computed.n;
    var theme = THEMES[opts.theme] || THEMES.dark;
    var isList = opts.layout === "list";

    root.innerHTML = "";
    var card = el("div", "kr-card");

    var header = el("div", "kr-header");
    header.appendChild(el("div", "kr-kommune", r.name));
    var logoWrap = el("div", "kr-logo");
    var logoImg = el("img");
    logoImg.src = opts.logo || theme.logo;
    logoImg.alt = "Norsk Klimamonitor";
    logoWrap.appendChild(logoImg);
    header.appendChild(logoWrap);
    card.appendChild(header);

    if (isList) {
      var list = el("div", "kr-list");
      list.appendChild(gaugeRow("Total", computed.totalLevels[kommuneId], computed.totalRanks[kommuneId], n, true));
      CATEGORY_ORDER.forEach(function (cat) {
        var label = (opts.catLabels && opts.catLabels[cat]) || CAT_LABEL_FALLBACK[cat];
        list.appendChild(gaugeRow(label, computed.catLevels[cat][kommuneId], computed.catRanks[cat][kommuneId], n, false));
      });
      card.appendChild(list);
    } else {
      var gauges = el("div", "kr-gauges");
      gauges.appendChild(gaugeColumn("Total", computed.totalLevels[kommuneId], computed.totalRanks[kommuneId], n, true));
      CATEGORY_ORDER.forEach(function (cat) {
        var label = (opts.catLabels && opts.catLabels[cat]) || CAT_LABEL_FALLBACK[cat];
        gauges.appendChild(gaugeColumn(label, computed.catLevels[cat][kommuneId], computed.catRanks[cat][kommuneId], n, false));
      });
      card.appendChild(gauges);
    }

    var footer = el("div", "kr-footer");
    var link = el("a", "kr-link", "Se full rapport →");
    link.href = DASHBOARD_URL;
    link.target = "_blank";
    link.rel = "noopener";
    footer.appendChild(link);
    card.appendChild(footer);

    root.appendChild(card);
  }

  // ---- Public init / mount --------------------------------------------------

  function mount(container) {
    var year = container.getAttribute("data-year") || DEFAULT_YEAR;
    var themeName = container.getAttribute("data-theme") === "light" ? "light" : "dark";
    var layout = container.getAttribute("data-layout") === "list" ? "list" : "grid";

    var root = container.attachShadow
      ? container.attachShadow({ mode: "open" })
      : container;

    var styleEl = document.createElement("style");
    styleEl.textContent = buildStyle(THEMES[themeName], layout);
    root.appendChild(styleEl);

    var mountPoint = document.createElement("div");
    root.appendChild(mountPoint);

    renderLoading(mountPoint);

    var kommuneQuery = detectKommune(container);
    if (!kommuneQuery) {
      renderError(
        mountPoint,
        "Fant ikke kommune å vise (mangler ?kommune=... i URL-en eller data-kommune på widget-elementet)."
      );
      return;
    }

    getComputed(year)
      .then(function (computed) {
        var kommuneId = findKommuneId(kommuneQuery, computed.results);
        if (!kommuneId) {
          renderError(mountPoint, 'Fant ingen kommune som matcher "' + kommuneQuery + '".');
          return;
        }
        renderWidget(mountPoint, { theme: themeName, layout: layout }, computed, kommuneId);
      })
      .catch(function (err) {
        renderError(mountPoint, "Klarte ikke laste klimarisiko-data.");
        if (window.console) console.error("[klimarisiko-widget]", err);
      });
  }

  function init() {
    var containers = document.querySelectorAll("[data-klimarisiko-widget]");
    containers.forEach ? containers.forEach(mount) : Array.prototype.forEach.call(containers, mount);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Exposed for the future confirmed integration hook, and for testing.
  window.klimarisikoWidget = {
    mount: mount,
    _computeAll: computeAll,
  };
})();
