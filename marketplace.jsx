// marketplace.jsx
// CODEX — Module Marketplace (Phase 3.1).
//
// Self-registering plugin that adds a MARKET tab (glyph ⌬) to the right rail.
// Surfaces:
//   1. Installed modules (live from window.CODEX_MODULES.listModules)
//   2. Featured curated modules (from data/module-index.json)
//   3. Browse by category (filter chips)
//   4. Add by URL — fetch + validate + install via loadModuleFromUrl
//   5. Add by file — drag-drop / picker → reads JSON → installs
//   6. Module detail view — full metadata + raw JSON preview
//
// All styling is inline; the small named-class set in styles.css is purely
// progressive enhancement.

(function () {
  if (typeof window === "undefined") return;
  const { useState, useEffect, useMemo, useCallback, useRef } = React;

  const INDEX_URL = "data/module-index.json";

  const CATEGORIES = [
    { id: "all",          label: "All" },
    { id: "lexicons",     label: "Lexicons" },
    { id: "cross-refs",   label: "Cross-Refs" },
    { id: "commentaries", label: "Commentaries" },
    { id: "plans",        label: "Reading Plans" },
    { id: "dictionaries", label: "Dictionaries" },
    { id: "maps",         label: "Maps" },
    { id: "timelines",    label: "Timelines" },
    { id: "languages",    label: "Language Packs" },
    { id: "devotionals",  label: "Devotionals" },
  ];

  // ─── helpers ──────────────────────────────────────────────────────────
  function fmtSize(kb) {
    if (!kb && kb !== 0) return "—";
    if (kb < 1024) return kb + " KB";
    return (kb / 1024).toFixed(1) + " MB";
  }
  function fmtDate(ts) {
    if (!ts) return "—";
    try { return new Date(ts).toLocaleDateString(); } catch { return "—"; }
  }
  function typeBadge(t) { return (t || "module").toUpperCase().replace("-", " "); }

  let _indexPromise = null;
  function loadIndex() {
    if (_indexPromise) return _indexPromise;
    _indexPromise = fetch(INDEX_URL, { credentials: "same-origin" })
      .then(r => { if (!r.ok) throw new Error("index fetch " + r.status); return r.json(); })
      .catch(e => { _indexPromise = null; throw e; });
    return _indexPromise;
  }

  // ─── styles (inline) ──────────────────────────────────────────────────
  const S = {
    root: {
      padding: 14,
      color: "var(--cx-fg, #e8f6ff)",
      fontFamily: "var(--cx-font-sans, 'Inter Tight', system-ui, sans-serif)",
      fontSize: 13,
      lineHeight: 1.5,
    },
    h1: {
      margin: "0 0 4px 0",
      fontFamily: "var(--cx-font-mono, 'JetBrains Mono', monospace)",
      fontSize: 12,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: "var(--cx-accent, #7ee0ff)",
    },
    h2: {
      margin: "20px 0 8px 0",
      fontFamily: "var(--cx-font-mono, 'JetBrains Mono', monospace)",
      fontSize: 11,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      color: "var(--cx-accent, #7ee0ff)",
      opacity: 0.85,
    },
    blurb: { opacity: 0.7, margin: "0 0 12px 0" },
    rule: {
      height: 1,
      background: "linear-gradient(to right, transparent, var(--cx-rule, rgba(126,224,255,0.18)), transparent)",
      margin: "12px 0",
    },
    chipRow: { display: "flex", flexWrap: "wrap", gap: 6, margin: "0 0 12px 0" },
    chip: (active) => ({
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 10.5,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      cursor: "pointer",
      border: "1px solid " + (active
        ? "var(--cx-accent, #7ee0ff)"
        : "var(--cx-rule, rgba(126,224,255,0.18))"),
      background: active
        ? "color-mix(in oklab, var(--cx-accent, #7ee0ff) 18%, transparent)"
        : "transparent",
      color: active ? "var(--cx-accent, #7ee0ff)" : "inherit",
    }),
    grid2: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
      gap: 10,
    },
    card: {
      border: "1px solid var(--cx-rule, rgba(126,224,255,0.16))",
      borderRadius: 8,
      padding: 12,
      background: "color-mix(in oklab, var(--cx-accent, #7ee0ff) 4%, transparent)",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      cursor: "pointer",
      transition: "border-color 120ms ease, transform 120ms ease",
    },
    row: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 12px",
      border: "1px solid var(--cx-rule, rgba(126,224,255,0.12))",
      borderRadius: 6,
      marginBottom: 6,
      fontSize: 12.5,
    },
    badge: (kind) => ({
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 4,
      fontSize: 9.5,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      fontFamily: "var(--cx-font-mono, 'JetBrains Mono', monospace)",
      color: kind === "soon" ? "var(--cx-accent-2, #ffc46b)" : "var(--cx-accent, #7ee0ff)",
      background: kind === "soon"
        ? "color-mix(in oklab, var(--cx-accent-2, #ffc46b) 15%, transparent)"
        : "color-mix(in oklab, var(--cx-accent, #7ee0ff) 14%, transparent)",
      border: "1px solid " + (kind === "soon"
        ? "color-mix(in oklab, var(--cx-accent-2, #ffc46b) 45%, transparent)"
        : "color-mix(in oklab, var(--cx-accent, #7ee0ff) 40%, transparent)"),
    }),
    pill: {
      background: "var(--cx-accent, #7ee0ff)",
      color: "#001218",
      border: "none",
      borderRadius: 999,
      padding: "6px 14px",
      fontSize: 11,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      fontFamily: "var(--cx-font-mono, 'JetBrains Mono', monospace)",
      fontWeight: 600,
      cursor: "pointer",
    },
    pillGhost: {
      background: "transparent",
      color: "var(--cx-accent, #7ee0ff)",
      border: "1px solid var(--cx-accent, #7ee0ff)",
      borderRadius: 999,
      padding: "6px 14px",
      fontSize: 11,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      fontFamily: "var(--cx-font-mono, 'JetBrains Mono', monospace)",
      cursor: "pointer",
    },
    pillDanger: {
      background: "transparent",
      color: "var(--cx-accent-warn, #ff7a7a)",
      border: "1px solid color-mix(in oklab, var(--cx-accent-warn, #ff7a7a) 50%, transparent)",
      borderRadius: 999,
      padding: "4px 10px",
      fontSize: 10.5,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      fontFamily: "var(--cx-font-mono, 'JetBrains Mono', monospace)",
      cursor: "pointer",
    },
    name: {
      fontFamily: "var(--cx-font-serif, 'Cormorant Garamond', serif)",
      fontSize: 18,
      lineHeight: 1.15,
      margin: 0,
    },
    desc: {
      fontFamily: "var(--cx-font-serif, 'Cormorant Garamond', serif)",
      fontSize: 14,
      lineHeight: 1.4,
      margin: 0,
      opacity: 0.85,
    },
    meta: { fontSize: 10.5, opacity: 0.65, letterSpacing: "0.04em" },
    input: {
      width: "100%",
      padding: "8px 10px",
      background: "transparent",
      border: "1px solid var(--cx-rule, rgba(126,224,255,0.2))",
      borderRadius: 6,
      color: "inherit",
      fontFamily: "inherit",
      fontSize: 12,
      boxSizing: "border-box",
    },
    drop: (hot) => ({
      marginTop: 8,
      padding: "18px 14px",
      border: "1px dashed " + (hot
        ? "var(--cx-accent, #7ee0ff)"
        : "var(--cx-rule, rgba(126,224,255,0.25))"),
      borderRadius: 8,
      textAlign: "center",
      opacity: hot ? 1 : 0.85,
      fontSize: 12,
      cursor: "pointer",
      background: hot
        ? "color-mix(in oklab, var(--cx-accent, #7ee0ff) 8%, transparent)"
        : "transparent",
    }),
    detailPre: {
      maxHeight: 240,
      overflow: "auto",
      fontFamily: "var(--cx-font-mono, 'JetBrains Mono', monospace)",
      fontSize: 11,
      padding: 10,
      background: "color-mix(in oklab, var(--cx-accent, #7ee0ff) 3%, transparent)",
      border: "1px solid var(--cx-rule, rgba(126,224,255,0.12))",
      borderRadius: 6,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    },
    backBtn: {
      background: "transparent",
      color: "var(--cx-accent, #7ee0ff)",
      border: "none",
      cursor: "pointer",
      fontFamily: "var(--cx-font-mono, 'JetBrains Mono', monospace)",
      fontSize: 11,
      letterSpacing: "0.1em",
      padding: 0,
      marginBottom: 8,
    },
    msg: (kind) => ({
      marginTop: 8,
      padding: "8px 10px",
      borderRadius: 6,
      fontSize: 11.5,
      border: "1px solid " + (kind === "err"
        ? "color-mix(in oklab, var(--cx-accent-warn, #ff7a7a) 50%, transparent)"
        : "color-mix(in oklab, var(--cx-accent, #7ee0ff) 40%, transparent)"),
      background: kind === "err"
        ? "color-mix(in oklab, var(--cx-accent-warn, #ff7a7a) 10%, transparent)"
        : "color-mix(in oklab, var(--cx-accent, #7ee0ff) 8%, transparent)",
      color: kind === "err" ? "var(--cx-accent-warn, #ff7a7a)" : "inherit",
    }),
  };

  // ─── sub-components ───────────────────────────────────────────────────
  function CategoryFromIndex(m) {
    if (m.category) return m.category;
    switch ((m.type || "").toLowerCase()) {
      case "lexicon": case "concordance": return "lexicons";
      case "cross-reference": return "cross-refs";
      case "commentary": return "commentaries";
      case "reading-plan": return "plans";
      case "dictionary": return "dictionaries";
      case "map-overlay": return "maps";
      case "timeline": return "timelines";
      default: return "other";
    }
  }

  function ModuleCard({ mod, installed, onOpen, onInstall, busy }) {
    const soon = !!mod._status && mod._status === "coming-soon";
    return (
      React.createElement("div", {
        style: S.card,
        className: "cx-mkt-card",
        onClick: () => onOpen(mod),
      },
        React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
          React.createElement("span", { style: S.badge(soon ? "soon" : "ok") },
            soon ? "Coming Soon" : typeBadge(mod.type)),
          !soon && React.createElement("span", { style: { ...S.badge("ok"), opacity: 0.6 } },
            typeBadge(mod.type))
        ),
        React.createElement("h3", { style: S.name }, mod.name),
        React.createElement("p", { style: S.desc },
          (mod.description || "").slice(0, 140) + ((mod.description || "").length > 140 ? "…" : "")),
        React.createElement("div", { style: S.meta },
          (mod.author || "—") + " · " + (mod.license || "—") + " · " + fmtSize(mod.size_kb)),
        React.createElement("div", { style: { display: "flex", gap: 6, marginTop: 4 } },
          installed
            ? React.createElement("span", { style: { ...S.meta, color: "var(--cx-accent, #7ee0ff)" } },
                "✓ Installed")
            : React.createElement("button", {
                style: soon ? { ...S.pill, opacity: 0.4, cursor: "not-allowed" } : S.pill,
                disabled: soon || busy,
                onClick: (e) => { e.stopPropagation(); if (!soon) onInstall(mod); },
              }, busy ? "Installing…" : (soon ? "Coming Soon" : "Install"))
        )
      )
    );
  }

  // ─── main panel ───────────────────────────────────────────────────────
  function MarketplacePanel() {
    const [installed, setInstalled] = useState([]);
    const [index, setIndex] = useState(null);
    const [err, setErr] = useState(null);
    const [cat, setCat] = useState("all");
    const [url, setUrl] = useState("");
    const [expectedId, setExpectedId] = useState("");
    const [urlMsg, setUrlMsg] = useState(null);
    const [fileMsg, setFileMsg] = useState(null);
    const [busy, setBusy] = useState({});
    const [detail, setDetail] = useState(null);
    const [dragHot, setDragHot] = useState(false);
    const filePickRef = useRef(null);

    const refresh = useCallback(() => {
      if (!window.CODEX_MODULES) { setInstalled([]); return; }
      window.CODEX_MODULES.listModules()
        .then(setInstalled)
        .catch(() => setInstalled([]));
    }, []);

    useEffect(() => {
      refresh();
      loadIndex().then(setIndex).catch((e) => setErr(String(e && e.message || e)));
    }, [refresh]);

    const installedIds = useMemo(
      () => new Set(installed.map((m) => m.id)), [installed]);

    const indexMods = (index && index.modules) || [];
    const featured = useMemo(
      () => indexMods.filter((m) => m.featured), [indexMods]);
    const visible = useMemo(() => {
      if (cat === "all") return indexMods;
      return indexMods.filter((m) => CategoryFromIndex(m) === cat);
    }, [indexMods, cat]);

    function installFromIndex(mod) {
      if (!mod || !mod.url) return;
      setBusy((b) => ({ ...b, [mod.id]: true }));
      window.CODEX_MODULES.loadModuleFromUrl(mod.url, mod.id).then(() => {
        setBusy((b) => { const n = { ...b }; delete n[mod.id]; return n; });
        refresh();
      }).catch((e) => {
        setBusy((b) => { const n = { ...b }; delete n[mod.id]; return n; });
        setErr("Install failed: " + (e && e.message || e));
      });
    }

    function remove(id) {
      if (!window.CODEX_MODULES) return;
      window.CODEX_MODULES.removeModule(id).then(refresh).catch(() => {});
    }

    function installByUrl() {
      setUrlMsg(null);
      const u = url.trim();
      const id = expectedId.trim();
      if (!u) { setUrlMsg({ kind: "err", text: "Enter a URL first." }); return; }
      if (!id) { setUrlMsg({ kind: "err", text: "Enter the expected module id." }); return; }
      try { new URL(u); } catch { setUrlMsg({ kind: "err", text: "That URL doesn't look valid." }); return; }
      setUrlMsg({ kind: "ok", text: "Fetching + installing…" });
      window.CODEX_MODULES.loadModuleFromUrl(u, id).then(() => {
        setUrlMsg({ kind: "ok", text: "Installed " + id + "." });
        setUrl(""); setExpectedId("");
        refresh();
      }).catch((e) => {
        setUrlMsg({ kind: "err", text: "Install failed: " + (e && e.message || e) });
      });
    }

    async function installFromFile(file) {
      setFileMsg(null);
      if (!file) return;
      try {
        const text = await file.text();
        const mod = JSON.parse(text);
        if (!mod || !mod.meta || !mod.meta.id || !mod.meta.type || !mod.meta.version) {
          throw new Error("missing meta envelope (need id/type/version)");
        }
        // Put directly via IndexedDB by reusing loadModuleFromUrl through a
        // blob URL — keeps validation in one place.
        const blob = new Blob([text], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        try {
          await window.CODEX_MODULES.loadModuleFromUrl(url, mod.meta.id);
        } finally {
          URL.revokeObjectURL(url);
        }
        setFileMsg({ kind: "ok", text: "Installed " + mod.meta.id + "." });
        refresh();
      } catch (e) {
        setFileMsg({ kind: "err", text: "File install failed: " + (e && e.message || e) });
      }
    }

    function onDrop(e) {
      e.preventDefault(); setDragHot(false);
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) installFromFile(f);
    }

    // ─── detail view ───────────────────────────────────────────────────
    if (detail) {
      const isInstalled = installedIds.has(detail.id);
      const soon = detail._status === "coming-soon";
      return React.createElement("div", { style: S.root, className: "cx-mkt-pane" },
        React.createElement("button", { style: S.backBtn, onClick: () => setDetail(null) },
          "‹ BACK TO MARKETPLACE"),
        React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 } },
          React.createElement("span", { style: S.badge(soon ? "soon" : "ok") },
            soon ? "Coming Soon" : typeBadge(detail.type))
        ),
        React.createElement("h2", { style: { ...S.name, fontSize: 26, margin: "4px 0 8px 0" } },
          detail.name),
        React.createElement("div", { style: S.meta },
          (detail.author || "—") + " · v" + (detail.version || "1.0.0") + " · " +
          (detail.license || "—") + " · " + fmtSize(detail.size_kb)),
        React.createElement("p", { style: { ...S.desc, marginTop: 12 } }, detail.description),
        detail.url && React.createElement("div", { style: { ...S.meta, marginTop: 6 } },
          "Source: ",
          React.createElement("a", {
            href: detail.url, target: "_blank", rel: "noopener noreferrer",
            style: { color: "var(--cx-accent, #7ee0ff)" },
          }, detail.url)
        ),
        React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 14 } },
          isInstalled
            ? React.createElement("button", {
                style: S.pillDanger,
                onClick: () => { remove(detail.id); setDetail(null); },
              }, "Remove")
            : React.createElement("button", {
                style: soon ? { ...S.pill, opacity: 0.4, cursor: "not-allowed" } : S.pill,
                disabled: soon || busy[detail.id],
                onClick: () => installFromIndex(detail),
              }, busy[detail.id] ? "Installing…" : (soon ? "Coming Soon" : "Install"))
        ),
        React.createElement("details", { style: { marginTop: 18 } },
          React.createElement("summary", {
            style: { cursor: "pointer", fontSize: 11, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "var(--cx-accent, #7ee0ff)" },
          }, "Raw JSON"),
          React.createElement("pre", { style: { ...S.detailPre, marginTop: 8 } },
            JSON.stringify(detail, null, 2))
        )
      );
    }

    // ─── main render ───────────────────────────────────────────────────
    return React.createElement("div", { style: S.root, className: "cx-mkt-pane" },
      React.createElement("h1", { style: S.h1 }, "⌬ Module Marketplace"),
      React.createElement("p", { style: S.blurb },
        "Discover, install, and manage CODEX study modules — lexicons, cross-refs, commentaries, reading plans, and more."),

      err && React.createElement("div", { style: S.msg("err") }, err),

      // Installed
      React.createElement("h2", { style: S.h2 },
        "Installed (" + installed.length + ")"),
      installed.length === 0
        ? React.createElement("div", { style: { ...S.meta, opacity: 0.7 } },
            "Nothing installed yet. Browse below or add by URL.")
        : installed.map((m) =>
            React.createElement("div", { key: m.id, style: S.row, className: "cx-mkt-row" },
              React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                React.createElement("div", { style: { display: "flex", gap: 6, alignItems: "center" } },
                  React.createElement("span", { style: S.badge("ok") }, typeBadge(m.type)),
                  React.createElement("strong", null, m.name || m.id)
                ),
                React.createElement("div", { style: S.meta },
                  "v" + m.version + " · installed " + fmtDate(m.installedAt))
              ),
              React.createElement("button", {
                style: S.pillDanger,
                onClick: () => remove(m.id),
              }, "Remove")
            )
          ),

      React.createElement("div", { style: S.rule }),

      // Featured
      featured.length > 0 && React.createElement(React.Fragment, null,
        React.createElement("h2", { style: S.h2 }, "Featured"),
        React.createElement("div", { style: S.grid2 },
          featured.map((m) =>
            React.createElement(ModuleCard, {
              key: m.id, mod: m,
              installed: installedIds.has(m.id),
              onOpen: setDetail,
              onInstall: installFromIndex,
              busy: !!busy[m.id],
            })
          )
        )
      ),

      // Browse
      React.createElement("h2", { style: S.h2 }, "Browse by category"),
      React.createElement("div", { style: S.chipRow },
        CATEGORIES.map((c) =>
          React.createElement("span", {
            key: c.id,
            style: S.chip(cat === c.id),
            onClick: () => setCat(c.id),
          }, c.label)
        )
      ),
      visible.length === 0
        ? React.createElement("div", { style: { ...S.meta, opacity: 0.7 } },
            "No modules in this category yet.")
        : React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 0 } },
            visible.map((m) =>
              React.createElement("div", { key: m.id, style: S.row, className: "cx-mkt-row",
                onClick: () => setDetail(m) },
                React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                  React.createElement("div", { style: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" } },
                    React.createElement("span", { style: S.badge(m._status === "coming-soon" ? "soon" : "ok") },
                      m._status === "coming-soon" ? "Soon" : typeBadge(m.type)),
                    React.createElement("strong", null, m.name)
                  ),
                  React.createElement("div", { style: S.meta },
                    (m.author || "—") + " · " + fmtSize(m.size_kb) + " · " + (m.license || "—"))
                ),
                installedIds.has(m.id)
                  ? React.createElement("span", { style: { ...S.meta, color: "var(--cx-accent, #7ee0ff)" } }, "✓")
                  : React.createElement("button", {
                      style: m._status === "coming-soon"
                        ? { ...S.pillGhost, opacity: 0.4, cursor: "not-allowed" }
                        : S.pillGhost,
                      disabled: m._status === "coming-soon" || busy[m.id],
                      onClick: (e) => { e.stopPropagation(); if (m._status !== "coming-soon") installFromIndex(m); },
                    }, busy[m.id] ? "…" : (m._status === "coming-soon" ? "Soon" : "Install"))
              )
            )
          ),

      React.createElement("div", { style: S.rule }),

      // Add by URL
      React.createElement("h2", { style: S.h2 }, "Add by URL"),
      React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
        React.createElement("input", {
          style: S.input, type: "url", placeholder: "https://example.com/my-module.json",
          value: url, onChange: (e) => setUrl(e.target.value),
        }),
        React.createElement("input", {
          style: S.input, type: "text", placeholder: "expected module id (e.g. my-lexicon)",
          value: expectedId, onChange: (e) => setExpectedId(e.target.value),
        }),
        React.createElement("button", { style: S.pill, onClick: installByUrl }, "Install")
      ),
      urlMsg && React.createElement("div", { style: S.msg(urlMsg.kind) }, urlMsg.text),

      // Add by file
      React.createElement("h2", { style: S.h2 }, "Add by file"),
      React.createElement("div", {
        style: S.drop(dragHot),
        onClick: () => filePickRef.current && filePickRef.current.click(),
        onDragOver: (e) => { e.preventDefault(); setDragHot(true); },
        onDragLeave: () => setDragHot(false),
        onDrop: onDrop,
      },
        dragHot ? "Drop to install" : "Drop a .json module here, or click to pick"
      ),
      React.createElement("input", {
        ref: filePickRef, type: "file", accept: "application/json,.json",
        style: { display: "none" },
        onChange: (e) => {
          const f = e.target.files && e.target.files[0];
          if (f) installFromFile(f);
          e.target.value = "";
        },
      }),
      fileMsg && React.createElement("div", { style: S.msg(fileMsg.kind) }, fileMsg.text),

      React.createElement("div", { style: { ...S.meta, marginTop: 20, opacity: 0.55 } },
        index && index.updated ? "Curated index updated " + index.updated : null)
    );
  }

  window.CODEX_MarketplacePanel = MarketplacePanel;

  // ─── Plugin registration ─────────────────────────────────────────────
  function doRegister() {
    if (!window.CODEX_PLUGINS_API || typeof window.CODEX_PLUGINS_API.register !== "function") {
      window.addEventListener("load", doRegister, { once: true });
      return false;
    }
    try {
      return window.CODEX_PLUGINS_API.register({
        id: "module-marketplace",
        name: "Module Marketplace",
        version: "1.0.0",
        panels: [{
          id: "market",
          label: "MARKET",
          glyph: "⊞",
          icon: "⊞",
          render: () => React.createElement(MarketplacePanel, null),
        }],
      });
    } catch (e) {
      console.warn("[marketplace] plugin registration failed:", e);
      return false;
    }
  }
  doRegister();
})();
