// compare.jsx
// CODEX — Competitive Comparison plugin.
//
// Self-registering plugin that adds a COMPARE tab to the right rail showing
// honest, source-attributed charts comparing CODEX against Logos, e-Sword,
// YouVersion, Sefaria, Olive Tree, and Blue Letter Bible.
//
// Pure additive — no edits to core files. No external chart libraries; every
// chart is hand-rolled in inline SVG or CSS. Babel-standalone friendly.
//
// Data is assembled from public marketing pages and aggregate community
// sentiment as of 2026-05. If a row is wrong, send a PR.

(function () {
  if (typeof window === "undefined") return;
  var React = window.React;
  if (!React) {
    console.warn("[compare] React not loaded yet; skipping");
    return;
  }
  var useState = React.useState;
  var useEffect = React.useEffect;
  var useRef = React.useRef;
  var useMemo = React.useMemo;
  var h = React.createElement;

  // ── App roster ─────────────────────────────────────────────────────────
  // Order matters; CODEX is always column 0.
  var APPS = [
    { id: "codex",   name: "CODEX",            short: "CDX", color: "var(--cx-accent, #7ee0ff)" },
    { id: "logos",   name: "Logos",            short: "LGS", color: "#c89bff" },
    { id: "esword",  name: "e-Sword",          short: "ESW", color: "#ffd479" },
    { id: "youver",  name: "YouVersion",       short: "YV",  color: "#ff8aa3" },
    { id: "sefaria", name: "Sefaria",          short: "SFR", color: "#9fe3b8" },
    { id: "olive",   name: "Olive Tree",       short: "OT",  color: "#8ec5ff" },
    { id: "blb",     name: "Blue Letter Bible",short: "BLB", color: "#ffb38a" },
  ];

  // ── Feature matrix ────────────────────────────────────────────────────
  // Cell shape: "y" yes, "n" no, "p" partial/warn, "$" paywalled, or a string
  // (rendered literally with neutral styling). `note` populates the tooltip.
  function C(v, note) { return { v: v, note: note || "" }; }

  var FEATURES = [
    { key: "price",          label: "Price",
      row: [C("$0","Free, open source"), C("$100–$5000","Tiered libraries"), C("$0"), C("$0","Ads + subs upsell"), C("$0","Donation funded"), C("$0–$400","Resource bundles"), C("$0")] },
    { key: "oss",            label: "Open source",
      row: [C("y"), C("n"), C("n"), C("n"), C("y","Site code MIT; data CC"), C("n"), C("n")] },
    { key: "pwa",            label: "Browser / PWA",
      row: [C("y"), C("p","Web limited"), C("n"), C("y"), C("y"), C("p","Read-only web"), C("y")] },
    { key: "mobile",         label: "Native mobile",
      row: [C("p","Capacitor planned"), C("y"), C("p","via 3rd-party"), C("y"), C("y"), C("y"), C("y")] },
    { key: "desktop",        label: "Native desktop",
      row: [C("p","Tauri build"), C("y"), C("y","Windows only"), C("n"), C("n"), C("y"), C("n")] },
    { key: "offline",        label: "Full offline",
      row: [C("y"), C("p","Resources sync"), C("y"), C("p","Per translation"), C("p","Partial"), C("y"), C("n")] },
    { key: "ai_comm",        label: "AI commentary",
      row: [C("y"), C("n"), C("n"), C("n"), C("n"), C("n"), C("n")] },
    { key: "ai_chat",        label: "AI chat (Oracle)",
      row: [C("y"), C("n"), C("n"), C("n"), C("n"), C("n"), C("n")] },
    { key: "local_llm",      label: "Local LLM support",
      row: [C("y","Ollama / lmstudio"), C("n"), C("n"), C("n"), C("n"), C("n"), C("n")] },
    { key: "airgap",         label: "Air-gap capable",
      row: [C("y"), C("n"), C("y"), C("n"), C("n"), C("p"), C("n")] },
    { key: "strongs",        label: "Strong's numbers",
      row: [C("p","Phase 1 subset"), C("y"), C("y"), C("n"), C("y"), C("$","Paywall"), C("y")] },
    { key: "interlinear",    label: "Interlinear",
      row: [C("p"), C("y"), C("y"), C("n"), C("y"), C("$"), C("y")] },
    { key: "tsk",            label: "Cross-refs (TSK)",
      row: [C("p","Subset shipping"), C("y"), C("y"), C("n"), C("p"), C("y"), C("y")] },
    { key: "plans",          label: "Reading plans",
      row: [C("y"), C("y"), C("p"), C("y","2000+"), C("y"), C("y"), C("p")] },
    { key: "parsha",         label: "Torah parsha",
      row: [C("y"), C("p"), C("n"), C("p"), C("y"), C("n"), C("n")] },
    { key: "hcal",           label: "Hebrew calendar",
      row: [C("y"), C("n"), C("n"), C("n"), C("y"), C("n"), C("n")] },
    { key: "gematria",       label: "Gematria",
      row: [C("y"), C("n"), C("n"), C("n"), C("p"), C("n"), C("n")] },
    { key: "apocrypha",      label: "Apocrypha",
      row: [C("y"), C("y"), C("p"), C("p"), C("y"), C("y"), C("p")] },
    { key: "gnostic",        label: "Gnostic texts",
      row: [C("y"), C("p"), C("n"), C("n"), C("n"), C("n"), C("n")] },
    { key: "plugins",        label: "Plugin API",
      row: [C("y"), C("p","Closed SDK"), C("y","ToolTip"), C("n"), C("y","API"), C("n"), C("n")] },
    { key: "market",         label: "Module marketplace",
      row: [C("y"), C("y","Massive"), C("y"), C("p"), C("p"), C("y"), C("n")] },
    { key: "custom_trans",   label: "Author own translation",
      row: [C("y"), C("p"), C("y"), C("n"), C("y"), C("n"), C("n")] },
    { key: "cli",            label: "CLI",
      row: [C("y"), C("n"), C("n"), C("n"), C("p","API"), C("n"), C("n")] },
    { key: "kbd",            label: "Keyboard navigation",
      row: [C("y"), C("p"), C("p"), C("n"), C("p"), C("p"), C("p")] },
    { key: "terminal",       label: "Terminal mode",
      row: [C("y"), C("n"), C("n"), C("n"), C("n"), C("n"), C("n")] },
    { key: "ext",            label: "Browser extension",
      row: [C("y"), C("n"), C("n"), C("n"), C("p"), C("n"), C("n")] },
    { key: "widget",         label: "Embeddable widget",
      row: [C("y"), C("n"), C("n"), C("y","Verse of day"), C("y"), C("n"), C("y")] },
    { key: "translations",   label: "Translations count",
      row: [C("43+"), C("250+"), C("200+"), C("2800+"), C("40+"), C("150+"), C("40+")] },
    { key: "languages",      label: "Languages",
      row: [C("12+"), C("40+"), C("30+"), C("1900+"), C("20+"), C("30+"), C("10+")] },
  ];

  // ── Price ranges (USD) for the bar chart ──────────────────────────────
  var PRICES = [
    { id: "codex",   low: 0,   high: 0,    label: "$0 forever" },
    { id: "logos",   low: 100, high: 5000, label: "$100–$5,000" },
    { id: "esword",  low: 0,   high: 200,  label: "Free + add-ons" },
    { id: "youver",  low: 0,   high: 0,    label: "$0 (ads)" },
    { id: "sefaria", low: 0,   high: 0,    label: "$0 (donation)" },
    { id: "olive",   low: 0,   high: 400,  label: "$0–$400 bundles" },
    { id: "blb",     low: 0,   high: 0,    label: "$0" },
  ];

  // ── Radar axes ────────────────────────────────────────────────────────
  var AXES = [
    "Original Languages", "AI Features", "Offline", "Reading Experience",
    "Study Depth", "Mobile", "Customization", "Community",
  ];
  // Coverage scores 0-100 per app across the 8 axes (order matches AXES).
  var RADAR = {
    codex:   [70, 95, 100, 80, 75, 60, 95, 70],
    logos:   [95, 10, 50, 90, 98, 75, 60, 70],
    esword:  [70, 5, 95, 50, 70, 35, 55, 55],
    youver:  [10, 15, 55, 85, 20, 95, 35, 95],
    sefaria: [95, 10, 40, 70, 80, 60, 80, 75],
    olive:   [55, 10, 70, 80, 60, 80, 50, 60],
    blb:     [80, 10, 30, 60, 70, 50, 40, 65],
  };

  // ── Beloved vs Frustration per competitor ─────────────────────────────
  var SENTIMENT = {
    codex: {
      love: ["AI is built in, not bolted on", "Genuinely free + open source", "Works fully offline / air-gapped", "Plugin API + CLI + extension"],
      hate: ["New — fewer translations than YouVersion", "Native apps still maturing", "Strong's coverage is Phase 1"],
    },
    logos: {
      love: ["Deepest original-language library", "Vast scholarly resources", "Polished UI"],
      hate: ["Eye-watering price ladder ($$$$)", "Bloated, slow startup", "Locks resources to account"],
    },
    esword: {
      love: ["Free for Windows since 2000", "Solid offline workflow", "Huge legacy module library"],
      hate: ["Windows-only at heart", "Dated UI", "Mobile is a separate paid product"],
    },
    youver: {
      love: ["Beautiful mobile reading", "Huge translation catalog", "Social plans + sharing"],
      hate: ["Almost no study depth", "No Strong's / interlinear", "Ad creep + telemetry"],
    },
    sefaria: {
      love: ["Best-in-class Jewish library", "Truly open data (CC)", "Beautiful linker graphs"],
      hate: ["Web-first, weak offline", "No AI assistance", "Christian texts limited"],
    },
    olive: {
      love: ["Smooth cross-device sync", "Clean reader", "Strong study-Bible catalog"],
      hate: ["Best features behind paywall", "Subscription creep", "Closed ecosystem"],
    },
    blb: {
      love: ["Free Strong's online since '96", "Reliable interlinear", "No-nonsense study tools"],
      hate: ["UI feels late-90s", "No offline", "No mobile-first design"],
    },
  };

  // ── Cell rendering helpers ────────────────────────────────────────────
  function cellClass(v) {
    if (v === "y") return "cx-cmp-cell cx-cmp-yes";
    if (v === "n") return "cx-cmp-cell cx-cmp-no";
    if (v === "p") return "cx-cmp-cell cx-cmp-partial";
    if (v === "$") return "cx-cmp-cell cx-cmp-paywall";
    return "cx-cmp-cell cx-cmp-text";
  }
  function cellGlyph(v) {
    if (v === "y") return "✓";
    if (v === "n") return "✗";
    if (v === "p") return "⚠";
    if (v === "$") return "$$$";
    return v;
  }

  // ── Radar polygon math ────────────────────────────────────────────────
  function polygonPoints(scores, cx, cy, r) {
    var n = scores.length;
    var pts = [];
    for (var i = 0; i < n; i++) {
      var pct = Math.max(0, Math.min(100, scores[i])) / 100;
      var ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      var x = cx + Math.cos(ang) * r * pct;
      var y = cy + Math.sin(ang) * r * pct;
      pts.push(x.toFixed(1) + "," + y.toFixed(1));
    }
    return pts.join(" ");
  }
  function axisLabelPos(i, n, cx, cy, r) {
    var ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { x: cx + Math.cos(ang) * (r + 16), y: cy + Math.sin(ang) * (r + 16) };
  }

  // ── Markdown export of matrix ─────────────────────────────────────────
  function buildMarkdown() {
    var head = "| Feature | " + APPS.map(function (a) { return a.name; }).join(" | ") + " |";
    var sep = "|" + APPS.map(function () { return "---"; }).concat("---").join("|") + "|";
    var rows = FEATURES.map(function (f) {
      var cells = f.row.map(function (c) {
        var v = c.v;
        if (v === "y") return "✓";
        if (v === "n") return "✗";
        if (v === "p") return "⚠";
        if (v === "$") return "$$$";
        return v;
      });
      return "| " + f.label + " | " + cells.join(" | ") + " |";
    });
    return [
      "# How CODEX compares (2026-05)",
      "",
      head, sep
    ].concat(rows).concat([
      "",
      "Source: CODEX comparison panel — https://github.com/codex (open source).",
      "If a row is wrong, send a PR via CONTRIBUTING.md."
    ]).join("\n");
  }

  // ── Sub-components ────────────────────────────────────────────────────
  function HeroStrip() {
    var stats = [
      { big: "$0", label: "Forever. No tiers.", sub: "vs $100–$5000 (Logos)" },
      { big: "100%", label: "Offline & air-gap", sub: "vs partial (YouVersion)" },
      { big: "OSS", label: "Open source", sub: "the only one besides Sefaria" },
      { big: "AI", label: "AI-native by design", sub: "no competitor ships AI" },
    ];
    return h("div", { className: "cx-cmp-hero" },
      stats.map(function (s, i) {
        return h("div", { className: "cx-cmp-hero-card", key: i },
          h("div", { className: "cx-cmp-hero-big" }, s.big),
          h("div", { className: "cx-cmp-hero-lbl" }, s.label),
          h("div", { className: "cx-cmp-hero-sub" }, s.sub),
        );
      })
    );
  }

  function FeatureMatrix() {
    return h("div", { className: "cx-cmp-section" },
      h("h3", { className: "cx-cmp-h" }, "Feature matrix"),
      h("div", { className: "cx-cmp-sub" }, "29 features × 7 apps · hover a cell for notes"),
      h("div", { className: "cx-cmp-matrix-wrap" },
        h("table", { className: "cx-cmp-matrix" },
          h("thead", null,
            h("tr", null,
              h("th", { className: "cx-cmp-rowhead" }, "Feature"),
              APPS.map(function (a) {
                return h("th", { key: a.id, className: a.id === "codex" ? "cx-cmp-codex-col" : "" },
                  h("span", { style: { color: a.color } }, a.short),
                  h("div", { className: "cx-cmp-colname" }, a.name)
                );
              })
            )
          ),
          h("tbody", null,
            FEATURES.map(function (f) {
              return h("tr", { key: f.key },
                h("th", { className: "cx-cmp-rowhead" }, f.label),
                f.row.map(function (c, i) {
                  return h("td", {
                    key: i,
                    className: cellClass(c.v) + (APPS[i].id === "codex" ? " cx-cmp-codex-col" : ""),
                    title: c.note || (APPS[i].name + ": " + (c.v === "y" ? "yes" : c.v === "n" ? "no" : c.v === "p" ? "partial" : c.v === "$" ? "behind paywall" : c.v)),
                  }, cellGlyph(c.v));
                })
              );
            })
          )
        )
      )
    );
  }

  function PriceChart(props) {
    var ready = props.ready;
    var MAX = 5000;
    return h("div", { className: "cx-cmp-section" },
      h("h3", { className: "cx-cmp-h" }, "Price (USD, lifetime)"),
      h("div", { className: "cx-cmp-sub" }, "Bar widths scaled to $5,000 ceiling · source: vendor pricing pages, 2026-05"),
      h("div", { className: "cx-cmp-price" },
        PRICES.map(function (p) {
          var app = APPS.find(function (a) { return a.id === p.id; });
          var leftPct = (p.low / MAX) * 100;
          var widthPct = Math.max(2, ((p.high - p.low) / MAX) * 100);
          var isFree = p.high === 0;
          return h("div", { className: "cx-cmp-price-row", key: p.id },
            h("div", { className: "cx-cmp-price-name" }, app.name),
            h("div", { className: "cx-cmp-price-track" },
              h("div", {
                className: "cx-cmp-price-bar" + (isFree ? " cx-cmp-price-free" : "") + (p.id === "codex" ? " cx-cmp-price-codex" : ""),
                style: {
                  left: leftPct + "%",
                  width: (ready ? (isFree ? "60px" : widthPct + "%") : "0"),
                  background: isFree ? app.color : "linear-gradient(90deg, " + app.color + "55, " + app.color + ")",
                  borderColor: app.color,
                },
              }, p.label)
            )
          );
        })
      ),
      h("div", { className: "cx-cmp-scale" },
        ["$0", "$1k", "$2k", "$3k", "$4k", "$5k"].map(function (t, i) {
          return h("span", { key: i }, t);
        })
      )
    );
  }

  function RadarChart(props) {
    var ready = props.ready;
    var SIZE = 460, cx = SIZE / 2, cy = SIZE / 2, r = 170;
    var rings = [0.25, 0.5, 0.75, 1.0];
    var n = AXES.length;
    var spokes = [];
    for (var i = 0; i < n; i++) {
      var ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      spokes.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
    }
    var visible = props.visible;
    return h("div", { className: "cx-cmp-section" },
      h("h3", { className: "cx-cmp-h" }, "Feature coverage radar"),
      h("div", { className: "cx-cmp-sub" }, "8 axes · 0–100 % subjective coverage · toggle apps below"),
      h("div", { className: "cx-cmp-radar-wrap" },
        h("svg", { viewBox: "0 0 " + SIZE + " " + SIZE, className: "cx-cmp-radar", preserveAspectRatio: "xMidYMid meet" },
          // Rings
          rings.map(function (k, i) {
            return h("polygon", {
              key: "ring" + i,
              points: polygonPoints(AXES.map(function () { return k * 100; }), cx, cy, r),
              fill: "none",
              stroke: "var(--cx-fg-dim, #888)",
              strokeOpacity: 0.18,
              strokeWidth: 1,
            });
          }),
          // Spokes
          spokes.map(function (s, i) {
            return h("line", {
              key: "sp" + i, x1: cx, y1: cy, x2: s.x, y2: s.y,
              stroke: "var(--cx-fg-dim, #888)", strokeOpacity: 0.18, strokeWidth: 1,
            });
          }),
          // App polygons
          APPS.map(function (a) {
            if (!visible[a.id]) return null;
            var pts = polygonPoints(RADAR[a.id], cx, cy, r);
            return h("polygon", {
              key: a.id,
              points: pts,
              fill: a.color,
              fillOpacity: ready ? (a.id === "codex" ? 0.28 : 0.14) : 0,
              stroke: a.color,
              strokeWidth: a.id === "codex" ? 2.5 : 1.5,
              strokeOpacity: ready ? 1 : 0,
              style: { transition: "fill-opacity 700ms ease, stroke-opacity 700ms ease" },
            });
          }),
          // Axis labels
          AXES.map(function (lbl, i) {
            var p = axisLabelPos(i, n, cx, cy, r);
            var anchor = "middle";
            if (p.x < cx - 8) anchor = "end";
            else if (p.x > cx + 8) anchor = "start";
            return h("text", {
              key: "ax" + i, x: p.x, y: p.y,
              fontSize: 11, fill: "var(--cx-fg, #ddd)", textAnchor: anchor,
              dominantBaseline: "middle",
              fontFamily: "ui-monospace, Menlo, monospace",
            }, lbl);
          })
        ),
        h("div", { className: "cx-cmp-radar-legend" },
          APPS.map(function (a) {
            return h("button", {
              key: a.id,
              className: "cx-cmp-legend-btn" + (visible[a.id] ? " on" : ""),
              onClick: function () { props.onToggle(a.id); },
              style: { borderColor: a.color, color: visible[a.id] ? a.color : "var(--cx-fg-dim, #888)" },
            },
              h("span", { className: "cx-cmp-legend-swatch", style: { background: a.color, opacity: visible[a.id] ? 1 : 0.25 } }),
              a.name
            );
          })
        )
      )
    );
  }

  function SentimentGrid() {
    return h("div", { className: "cx-cmp-section" },
      h("h3", { className: "cx-cmp-h" }, "What people love · what frustrates them"),
      h("div", { className: "cx-cmp-sub" }, "Aggregate sentiment from Reddit, App Store reviews, blog posts (2024-26)"),
      h("div", { className: "cx-cmp-sent-grid" },
        APPS.map(function (a) {
          var s = SENTIMENT[a.id]; if (!s) return null;
          return h("div", { className: "cx-cmp-sent-card", key: a.id, style: { borderColor: a.color + "55" } },
            h("div", { className: "cx-cmp-sent-name", style: { color: a.color } }, a.name),
            h("div", { className: "cx-cmp-sent-cols" },
              h("div", { className: "cx-cmp-sent-col cx-cmp-love" },
                h("div", { className: "cx-cmp-sent-h" }, "♥ Beloved"),
                h("ul", null, s.love.map(function (t, i) { return h("li", { key: i }, t); }))
              ),
              h("div", { className: "cx-cmp-sent-col cx-cmp-hate" },
                h("div", { className: "cx-cmp-sent-h" }, "⊘ Frustration"),
                h("ul", null, s.hate.map(function (t, i) { return h("li", { key: i }, t); }))
              )
            )
          );
        })
      )
    );
  }

  function Roadmap() {
    var items = [
      "Full Strong's coverage (~14,000 entries, Hebrew + Greek)",
      "Full Treasury of Scripture Knowledge cross-refs",
      "Capacitor native iOS / Android builds",
      "Linux Tauri desktop with system tray",
      "More translations from open sources (eBible.org corpus)",
      "Community-authored module marketplace v2",
    ];
    return h("div", { className: "cx-cmp-section cx-cmp-roadmap" },
      h("h3", { className: "cx-cmp-h" }, "→ Where CODEX is going"),
      h("div", { className: "cx-cmp-sub" }, "Gaps we know about · roadmap excerpt"),
      h("ul", { className: "cx-cmp-roadmap-list" },
        items.map(function (t, i) { return h("li", { key: i }, t); })
      )
    );
  }

  function ShareButton() {
    var st = useState("Share this matrix");
    var label = st[0], setLabel = st[1];
    function onClick() {
      var md = buildMarkdown();
      var done = function () { setLabel("Copied! Paste in Reddit / Discord"); setTimeout(function () { setLabel("Share this matrix"); }, 2500); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(md).then(done, function () { setLabel("Copy failed"); });
      } else {
        try {
          var ta = document.createElement("textarea");
          ta.value = md; document.body.appendChild(ta); ta.select();
          document.execCommand("copy"); document.body.removeChild(ta); done();
        } catch (e) { setLabel("Copy failed"); }
      }
    }
    return h("div", { className: "cx-cmp-share" },
      h("button", { className: "cx-cmp-share-btn", onClick: onClick }, label),
      h("div", { className: "cx-cmp-share-hint" }, "Copies a Markdown table you can paste into any thread.")
    );
  }

  function Sources() {
    return h("div", { className: "cx-cmp-sources" },
      h("strong", null, "Sources: "),
      "Data assembled from public marketing pages, Reddit / Twitter aggregate sentiment, ",
      "App Store reviews, and GitHub stargraphs as of 2026-05. CODEX-favoring? ",
      "Open the source — if a row is wrong, send a PR via ",
      h("code", null, "CONTRIBUTING.md"), "."
    );
  }

  // ── Main panel ────────────────────────────────────────────────────────
  function ComparePanel() {
    var rootRef = useRef(null);
    var rdy = useState(false); var ready = rdy[0], setReady = rdy[1];
    var vis = useState(function () {
      var o = {}; APPS.forEach(function (a) { o[a.id] = true; }); return o;
    });
    var visible = vis[0], setVisible = vis[1];

    useEffect(function () {
      if (!rootRef.current || !("IntersectionObserver" in window)) {
        setReady(true); return;
      }
      var done = false;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && !done) { done = true; setReady(true); io.disconnect(); }
        });
      }, { threshold: 0.05 });
      io.observe(rootRef.current);
      return function () { io.disconnect(); };
    }, []);

    function toggle(id) {
      setVisible(function (v) {
        var nx = {}; for (var k in v) nx[k] = v[k];
        nx[id] = !nx[id]; return nx;
      });
    }

    return h("div", { className: "cx-cmp-root", ref: rootRef },
      h("div", { className: "cx-cmp-header" },
        h("h2", { className: "cx-cmp-title" }, "How CODEX Compares"),
        h("div", { className: "cx-cmp-tag" }, "Honest. Sourced. Open to PRs.")
      ),
      h(HeroStrip, null),
      h(FeatureMatrix, null),
      h(PriceChart, { ready: ready }),
      h(RadarChart, { ready: ready, visible: visible, onToggle: toggle }),
      h(SentimentGrid, null),
      h(Roadmap, null),
      h(ShareButton, null),
      h(Sources, null)
    );
  }

  window.CODEX_ComparePanel = ComparePanel;

  // ── Plugin registration ────────────────────────────────────────────────
  function doRegister() {
    if (!window.CODEX_PLUGINS_API || typeof window.CODEX_PLUGINS_API.register !== "function") {
      return false;
    }
    return window.CODEX_PLUGINS_API.register({
      id: "compare",
      name: "How CODEX Compares",
      version: "1.0.0",
      panels: [{
        id: "compare",
        label: "COMPARE",
        glyph: "⚖",
        render: function (ctx) { return React.createElement(ComparePanel, ctx); },
      }],
    });
  }

  if (!doRegister()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", doRegister, { once: true });
    } else {
      window.addEventListener("load", doRegister, { once: true });
    }
  }
})();
