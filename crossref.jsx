// crossref.jsx
// CODEX — Treasury of Scripture Knowledge cross-reference panel (Phase 1.3).
//
// Loads `tsk-sample` module via window.CODEX_MODULES.loadModule and renders
// cross-references for the active verse, grouped by theme, with chain
// navigation (clicking a ref loads ITS cross-refs into the panel and pushes
// a breadcrumb crumb you can step back through).
//
// Exports:
//   window.CODEX_CrossRefPanel   — React component (panel host)
//   window.CODEX_CrossRefLookup  — { getCrossRefs(verseRef), formatRef(...) }
//
// Plugin registration also attaches a verse-menu action ("Cross-References")
// and a right-rail panel tab labeled "CROSS-REFS". Defers to window load if
// the plugin API hasn't booted yet.

(function () {
  if (typeof window === "undefined") return;
  const { useState, useEffect, useMemo, useCallback } = React;

  const MODULE_ID = "tsk-sample";

  // ── Module cache shared across panel mounts ───────────────────────────
  let _modPromise = null;
  function loadTsk() {
    if (_modPromise) return _modPromise;
    if (!window.CODEX_MODULES || typeof window.CODEX_MODULES.loadModule !== "function") {
      return Promise.reject(new Error("CODEX_MODULES not available"));
    }
    _modPromise = window.CODEX_MODULES.loadModule(MODULE_ID).catch((e) => {
      _modPromise = null;
      throw e;
    });
    return _modPromise;
  }

  // ── Book id ↔ display name helpers ────────────────────────────────────
  function booksList() {
    return (window.CODEX_DATA && window.CODEX_DATA.books) || [];
  }
  function bookName(bookId) {
    const b = booksList().find((x) => x.id === bookId);
    return b ? b.name : bookId;
  }

  // Parse "jhn.3.16" → { bookId:"jhn", chapter:3, verse:16 }
  function parseVerseKey(key) {
    if (!key || typeof key !== "string") return null;
    const parts = key.split(".");
    if (parts.length < 2) return null;
    const bookId = parts[0].toLowerCase();
    const chapter = parseInt(parts[1], 10);
    const verse = parts[2] ? parseInt(parts[2], 10) : null;
    if (!bookId || !Number.isFinite(chapter)) return null;
    return { bookId, chapter, verse };
  }

  // Build "Book C:V" display string from key.
  function formatRef(key) {
    const p = parseVerseKey(key);
    if (!p) return key;
    return `${bookName(p.bookId)} ${p.chapter}${p.verse ? ":" + p.verse : ""}`;
  }

  // Lookup helper: synchronous if module already cached in-memory.
  // Returns a Promise<[{ref,theme}]>.
  function getCrossRefs(verseRef) {
    return loadTsk().then((mod) => {
      if (!mod || !mod.verses) return [];
      const key =
        typeof verseRef === "string"
          ? verseRef.toLowerCase()
          : verseRef && verseRef.bookId
            ? `${verseRef.bookId}.${verseRef.chapter}.${verseRef.verse || ""}`.replace(/\.$/, "")
            : "";
      return mod.verses[key] || [];
    });
  }

  window.CODEX_CrossRefLookup = { getCrossRefs, formatRef, parseVerseKey };

  // ── Verse snippet — pull from window.BIBLE cache if available ─────────
  function snippetFor(key, translation) {
    try {
      const p = parseVerseKey(key);
      if (!p || !window.BIBLE || typeof window.BIBLE.getCachedChapter !== "function") return null;
      const tr = translation || "kjv";
      const ch = window.BIBLE.getCachedChapter(p.bookId, p.chapter, tr);
      if (!ch || !Array.isArray(ch.verses)) return null;
      const v = ch.verses.find((x) => x.n === p.verse);
      if (!v) return null;
      const text = v[tr] || v.text || "";
      return text ? String(text).trim() : null;
    } catch {
      return null;
    }
  }

  // ── The panel component ───────────────────────────────────────────────
  function CrossRefPanel({ book, bookId, chapter, verse, translation }) {
    const [mod, setMod] = useState(null);
    const [err, setErr] = useState(null);
    const [loading, setLoading] = useState(true);

    // breadcrumb stack of verseKeys the user has chained through.
    // Top item is the currently-displayed verse.
    const initialKey = `${bookId}.${chapter}.${verse || 1}`;
    const [trail, setTrail] = useState([initialKey]);

    // Reset trail when the host verse genuinely changes (new chapter/verse).
    useEffect(() => {
      setTrail([`${bookId}.${chapter}.${verse || 1}`]);
    }, [bookId, chapter, verse]);

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      loadTsk().then(
        (m) => { if (!cancelled) { setMod(m); setLoading(false); } },
        (e) => { if (!cancelled) { setErr(e.message || String(e)); setLoading(false); } }
      );
      return () => { cancelled = true; };
    }, []);

    const currentKey = trail[trail.length - 1];
    const refs = useMemo(() => {
      if (!mod || !mod.verses) return [];
      // Try exact verse; fall back to chapter.1 only for the initial view if no entry.
      const direct = mod.verses[currentKey] || [];
      if (direct.length) return direct;
      const p = parseVerseKey(currentKey);
      if (!p) return [];
      // Look for any verse in same chapter as a partial-fallback for chapter focus
      const sameChapter = Object.keys(mod.verses)
        .filter((k) => k.startsWith(`${p.bookId}.${p.chapter}.`));
      return sameChapter.length === 1 ? mod.verses[sameChapter[0]] : [];
    }, [mod, currentKey]);

    // Group by theme.
    const grouped = useMemo(() => {
      const buckets = new Map();
      for (const r of refs) {
        const theme = r.theme || "Related";
        if (!buckets.has(theme)) buckets.set(theme, []);
        buckets.get(theme).push(r);
      }
      return [...buckets.entries()].map(([theme, items]) => ({ theme, items }));
    }, [refs]);

    const onJump = useCallback((targetKey, chain) => {
      const display = formatRef(targetKey);
      if (chain) {
        setTrail((t) => [...t, targetKey]);
      }
      // Navigate the reader as well.
      try {
        if (typeof window.codexJumpToRef === "function") {
          window.codexJumpToRef(display);
        } else {
          const p = parseVerseKey(targetKey);
          if (p) {
            window.dispatchEvent(new CustomEvent("codex:navigate", {
              detail: { book: bookName(p.bookId), bookId: p.bookId, chapter: p.chapter, verse: p.verse },
            }));
          }
        }
      } catch (e) { console.warn("crossref: navigate failed", e); }
    }, []);

    const onBack = useCallback(() => {
      setTrail((t) => (t.length > 1 ? t.slice(0, -1) : t));
    }, []);

    return (
      <div className="cx-xref-pane" style={paneStyle}>
        <header style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {trail.length > 1 ? (
              <button onClick={onBack} title="Back" style={backBtnStyle}>← back</button>
            ) : null}
            <span style={crumbsStyle}>
              {trail.map((k, i) => (
                <span key={i}>
                  {i > 0 ? <span style={{ opacity: 0.5, margin: "0 6px" }}>→</span> : null}
                  <b style={{ color: i === trail.length - 1 ? "var(--cx-accent, #7ee0ff)" : "inherit" }}>
                    {formatRef(k)}
                  </b>
                </span>
              ))}
            </span>
          </div>
          <div style={subStyle}>
            Treasury of Scripture Knowledge
            {mod && mod.meta && mod.meta._partial ? (
              <span style={partialPillStyle} title="Only ~50 well-known verses seeded in this build. Full ~340K-entry module coming.">
                SAMPLE · full module coming
              </span>
            ) : null}
          </div>
        </header>

        {loading ? (
          <div style={statusStyle}>Loading TSK…</div>
        ) : err ? (
          <div style={{ ...statusStyle, color: "var(--cx-warn, #ffc46b)" }}>
            Couldn't load cross-references: {err}
          </div>
        ) : refs.length === 0 ? (
          <div style={statusStyle}>
            No cross-references for <b>{formatRef(currentKey)}</b> in this sample module.
            <div style={{ marginTop: 8, opacity: 0.7, fontSize: "0.85em" }}>
              The sample seeds ~50 well-known verses (John 3:16, Gen 1:1, Ps 23:1, Rom 8:28, …).
              Try opening one of those to see chain navigation in action.
            </div>
          </div>
        ) : (
          <div>
            {grouped.map((g) => (
              <section key={g.theme} style={themeBlockStyle}>
                <h4 style={themeHStyle}>{g.theme}</h4>
                <ul style={listStyle}>
                  {g.items.map((r, i) => {
                    const snip = snippetFor(r.ref, translation);
                    return (
                      <li key={i} style={rowStyle}>
                        <button
                          style={refBtnStyle}
                          onClick={() => onJump(r.ref, false)}
                          title={`Open ${formatRef(r.ref)} in reader`}
                        >
                          <span style={refTagStyle}>{formatRef(r.ref)}</span>
                          {snip ? <span style={snipStyle}> — {snip.length > 160 ? snip.slice(0, 157) + "…" : snip}</span> : null}
                        </button>
                        <button
                          style={chainBtnStyle}
                          onClick={() => onJump(r.ref, true)}
                          title="Chain — load this verse's cross-refs"
                          aria-label="Chain into this reference"
                        >⇢ chain</button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        <footer style={footStyle}>
          Tip: click a ref to jump · ⇢ chain to follow its cross-refs without leaving the panel
        </footer>
      </div>
    );
  }

  // Inline styles keep this self-contained (styles.css is touched by other agents).
  const paneStyle = {
    padding: "10px 12px 14px",
    color: "var(--cx-fg, #c9d4dc)",
    fontFamily: "var(--cx-font-ui, ui-sans-serif, system-ui)",
    fontSize: 13,
    lineHeight: 1.5,
  };
  const headerStyle = {
    borderBottom: "1px solid var(--cx-rule, rgba(126,224,255,0.18))",
    paddingBottom: 8,
    marginBottom: 10,
  };
  const subStyle = {
    marginTop: 4,
    fontSize: 11,
    opacity: 0.7,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  };
  const partialPillStyle = {
    fontSize: 10,
    padding: "2px 6px",
    border: "1px solid var(--cx-warn, #ffc46b)",
    color: "var(--cx-warn, #ffc46b)",
    borderRadius: 3,
    letterSpacing: "0.08em",
  };
  const crumbsStyle = { fontSize: 13, lineHeight: 1.4 };
  const backBtnStyle = {
    background: "transparent",
    border: "1px solid var(--cx-rule, rgba(126,224,255,0.25))",
    color: "var(--cx-fg, #c9d4dc)",
    padding: "2px 8px",
    fontSize: 11,
    cursor: "pointer",
    borderRadius: 3,
    letterSpacing: "0.05em",
  };
  const statusStyle = { padding: "16px 4px", opacity: 0.8 };
  const themeBlockStyle = { marginBottom: 14 };
  const themeHStyle = {
    margin: "0 0 6px",
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    opacity: 0.75,
    fontWeight: 600,
  };
  const listStyle = { listStyle: "none", margin: 0, padding: 0 };
  const rowStyle = {
    display: "flex",
    alignItems: "flex-start",
    gap: 6,
    padding: "4px 0",
    borderBottom: "1px dotted var(--cx-rule, rgba(255,255,255,0.06))",
  };
  const refBtnStyle = {
    flex: 1,
    textAlign: "left",
    background: "transparent",
    border: 0,
    color: "var(--cx-fg, #c9d4dc)",
    padding: "2px 0",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
  };
  const refTagStyle = {
    fontFamily: "var(--cx-font-mono, ui-monospace, JetBrains Mono, monospace)",
    color: "var(--cx-accent, #7ee0ff)",
    marginRight: 6,
    fontWeight: 600,
  };
  const snipStyle = { opacity: 0.85, fontStyle: "italic" };
  const chainBtnStyle = {
    background: "transparent",
    border: "1px solid var(--cx-rule, rgba(126,224,255,0.25))",
    color: "var(--cx-accent, #7ee0ff)",
    fontSize: 10,
    padding: "1px 6px",
    cursor: "pointer",
    borderRadius: 3,
    letterSpacing: "0.05em",
    whiteSpace: "nowrap",
  };
  const footStyle = {
    marginTop: 12,
    paddingTop: 8,
    borderTop: "1px solid var(--cx-rule, rgba(126,224,255,0.12))",
    fontSize: 10,
    opacity: 0.55,
    letterSpacing: "0.04em",
  };

  window.CODEX_CrossRefPanel = CrossRefPanel;

  // ── Plugin registration ───────────────────────────────────────────────
  function openCrossRefsForVerse(ctx) {
    // Best-effort: open the right rail on our plugin tab. We dispatch a
    // custom event the host can listen to; otherwise we at least surface a
    // navigate hint so the panel host re-renders.
    try {
      window.dispatchEvent(new CustomEvent("codex:open-panel", {
        detail: { panelId: "crossrefs-tsk:crossrefs", ctx },
      }));
    } catch {}
  }

  function doRegister() {
    if (!window.CODEX_PLUGINS_API || typeof window.CODEX_PLUGINS_API.register !== "function") return false;
    return window.CODEX_PLUGINS_API.register({
      id: "crossrefs-tsk",
      name: "TSK Cross-References",
      version: "1.0.0",
      panels: [{
        id: "crossrefs",
        label: "CROSS-REFS",
        glyph: "✝",
        render(ctx) {
          return React.createElement(CrossRefPanel, {
            book: ctx.book,
            bookId: ctx.bookId,
            chapter: ctx.chapter,
            verse: ctx.verse,
            translation: ctx.translation,
          });
        },
      }],
      verseActions: [{
        label: "Cross-References",
        icon: "✝",
        handler(verseRef) { openCrossRefsForVerse({ ref: verseRef }); },
      }],
    });
  }

  if (!doRegister()) {
    // Defer to window load if the plugin API isn't ready yet.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", doRegister, { once: true });
    } else {
      window.addEventListener("load", doRegister, { once: true });
    }
  }
})();
