// dictionary.jsx
// CODEX — Bible Dictionary panel (Phase 2.4).
//
// Loads `easton-sample` module via window.CODEX_MODULES.loadModule and renders
// a browseable, searchable Bible dictionary. Self-registers as a plugin with
// a right-rail panel tab (DICT / ℵ) and a verse-menu action ("Look up in
// Dictionary"). Auto-surfaces dictionary picks for the current chapter by
// scanning loaded verse text for proper-noun matches against entry titles.
//
// Inline-styled to avoid clashes; the small set of named classes added by
// the styles.css append are progressive enhancement.

(function () {
  if (typeof window === "undefined") return;
  const { useState, useEffect, useMemo, useCallback, useRef } = React;

  const MODULE_ID = "easton-sample";

  // ── Module cache ──────────────────────────────────────────────────────
  let _modPromise = null;
  function loadDict() {
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

  // ── Helpers ───────────────────────────────────────────────────────────
  function booksList() {
    return (window.CODEX_DATA && window.CODEX_DATA.books) || [];
  }
  function bookName(bookId) {
    const b = booksList().find((x) => x.id === bookId);
    return b ? b.name : bookId;
  }
  function parseRefKey(key) {
    if (!key || typeof key !== "string") return null;
    const parts = key.split(".");
    if (parts.length < 2) return null;
    return {
      bookId: parts[0].toLowerCase(),
      chapter: parseInt(parts[1], 10),
      verse: parts[2] ? parseInt(parts[2], 10) : null,
    };
  }
  function formatRef(key) {
    const p = parseRefKey(key);
    if (!p) return key;
    return `${bookName(p.bookId)} ${p.chapter}${p.verse ? ":" + p.verse : ""}`;
  }
  function navigateToRef(refKey) {
    const display = formatRef(refKey);
    try {
      if (typeof window.codexJumpToRef === "function") {
        window.codexJumpToRef(display);
      } else {
        const p = parseRefKey(refKey);
        if (p) {
          window.dispatchEvent(new CustomEvent("codex:navigate", {
            detail: { book: bookName(p.bookId), bookId: p.bookId, chapter: p.chapter, verse: p.verse },
          }));
        }
      }
    } catch (e) { /* ignore */ }
  }

  function kindLabel(kind) {
    return (kind || "ENTRY").toUpperCase();
  }
  function kindColor(kind) {
    switch ((kind || "").toLowerCase()) {
      case "person":  return "#7ee0ff";
      case "place":   return "#ffc46b";
      case "concept": return "#c8a8ff";
      case "people":  return "#9be39c";
      default:        return "#c9d4dc";
    }
  }

  function entryMatchesQuery(key, entry, q) {
    if (!q) return 0;
    const ql = q.toLowerCase();
    const title = (entry.title || key).toLowerCase();
    if (title === ql) return 1000;
    if (title.startsWith(ql)) return 500 + (50 - Math.min(50, title.length));
    if (title.includes(ql)) return 200;
    if ((entry.related || []).some((r) => r.toLowerCase().includes(ql))) return 80;
    if ((entry.body || "").toLowerCase().includes(ql)) return 20;
    return 0;
  }

  // Build a proper-noun set from a chapter's verses, intersect with entry titles.
  function dictPicksForChapter(mod, bookId, chapter, translation) {
    try {
      if (!mod || !window.BIBLE || typeof window.BIBLE.getCachedChapter !== "function") return [];
      const tr = translation || "kjv";
      const ch = window.BIBLE.getCachedChapter(bookId, chapter, tr);
      if (!ch || !Array.isArray(ch.verses)) return [];
      const titleIndex = new Map();
      for (const [key, ent] of Object.entries(mod.entries || {})) {
        titleIndex.set((ent.title || key).toLowerCase(), key);
      }
      const hits = new Map(); // key -> count
      for (const v of ch.verses) {
        const text = v[tr] || v.text || "";
        if (!text) continue;
        // Pull capitalized tokens (proper nouns); ignore sentence-start ambiguity by
        // only counting tokens 3+ chars long.
        const tokens = String(text).match(/\b[A-Z][a-z]{2,}\b/g) || [];
        for (const t of tokens) {
          const key = titleIndex.get(t.toLowerCase());
          if (key) hits.set(key, (hits.get(key) || 0) + 1);
        }
      }
      return [...hits.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([k]) => k);
    } catch {
      return [];
    }
  }

  // ── Panel ─────────────────────────────────────────────────────────────
  function DictionaryPanel(ctx) {
    const { bookId, chapter, translation } = ctx || {};
    const [mod, setMod] = useState(null);
    const [err, setErr] = useState(null);
    const [loading, setLoading] = useState(true);

    const [query, setQuery] = useState("");
    const [letter, setLetter] = useState(null);
    // Navigation trail of entry keys; top of stack = currently displayed entry.
    const [trail, setTrail] = useState([]);
    const searchRef = useRef(null);

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      loadDict().then(
        (m) => { if (!cancelled) { setMod(m); setLoading(false); } },
        (e) => { if (!cancelled) { setErr(e.message || String(e)); setLoading(false); } }
      );
      return () => { cancelled = true; };
    }, []);

    // Listen for verse-menu "Look up in Dictionary" event to auto-search.
    useEffect(() => {
      function onDictOpen(ev) {
        const t = ev && ev.detail && (ev.detail.text || "");
        if (!t) return;
        // Find the first capitalized word and use as query.
        const tok = String(t).match(/\b[A-Z][a-z]{2,}\b/);
        if (tok) {
          setQuery(tok[0]);
          setTrail([]);
          setLetter(null);
          if (searchRef.current) searchRef.current.focus();
        }
      }
      window.addEventListener("codex:dict-open", onDictOpen);
      return () => window.removeEventListener("codex:dict-open", onDictOpen);
    }, []);

    const entries = mod && mod.entries ? mod.entries : {};
    const allKeys = useMemo(() => Object.keys(entries).sort((a, b) => {
      return (entries[a].title || a).localeCompare(entries[b].title || b);
    }), [entries]);

    const letters = useMemo(() => {
      const s = new Set();
      for (const k of allKeys) {
        const t = (entries[k].title || k);
        s.add(t.charAt(0).toUpperCase());
      }
      return [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].filter((l) => s.has(l));
    }, [allKeys, entries]);

    const searchResults = useMemo(() => {
      if (!query.trim()) return [];
      const scored = [];
      for (const k of allKeys) {
        const s = entryMatchesQuery(k, entries[k], query.trim());
        if (s > 0) scored.push([k, s]);
      }
      scored.sort((a, b) => b[1] - a[1]);
      return scored.slice(0, 5).map((x) => x[0]);
    }, [query, allKeys, entries]);

    const letterEntries = useMemo(() => {
      if (!letter) return [];
      return allKeys.filter((k) => (entries[k].title || k).charAt(0).toUpperCase() === letter);
    }, [letter, allKeys, entries]);

    const picks = useMemo(() => {
      if (!mod || !bookId || !chapter) return [];
      return dictPicksForChapter(mod, bookId, chapter, translation);
    }, [mod, bookId, chapter, translation]);

    const currentKey = trail.length ? trail[trail.length - 1] : null;
    const currentEntry = currentKey ? entries[currentKey] : null;

    const openEntry = useCallback((key) => {
      if (!key || !entries[key]) return;
      setTrail((t) => (t[t.length - 1] === key ? t : [...t, key]));
    }, [entries]);

    const onBack = useCallback(() => {
      setTrail((t) => (t.length > 1 ? t.slice(0, -1) : []));
    }, []);
    const onClearEntry = useCallback(() => setTrail([]), []);

    if (loading) return <div style={paneStyle}><div style={statusStyle}>Loading dictionary…</div></div>;
    if (err)    return <div style={paneStyle}><div style={{ ...statusStyle, color: "var(--cx-warn, #ffc46b)" }}>Couldn't load dictionary: {err}</div></div>;

    return (
      <div className="cx-dict-pane" style={paneStyle}>
        <header style={headerStyle}>
          <div style={titleRowStyle}>
            <span style={{ fontSize: 20, marginRight: 6 }}>ℵ</span>
            <b style={{ fontFamily: "var(--cx-font-serif, 'Cormorant Garamond', serif)", fontSize: 18 }}>
              Bible Dictionary
            </b>
            {mod && mod.meta && mod.meta._partial ? (
              <span style={partialPillStyle} title="Sample of ~200 entries from Easton's ~4000.">
                SAMPLE · {allKeys.length} of ~4000
              </span>
            ) : null}
          </div>
          <div style={{ marginTop: 6 }}>
            <input
              ref={searchRef}
              type="search"
              value={query}
              placeholder="Search Abraham, covenant, Bethlehem…"
              onChange={(e) => { setQuery(e.target.value); setLetter(null); }}
              style={searchStyle}
              aria-label="Search the dictionary"
            />
          </div>
          <div style={letterBarStyle}>
            {[..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((L) => {
              const enabled = letters.includes(L);
              const active = letter === L;
              return (
                <button
                  key={L}
                  onClick={() => { if (enabled) { setLetter(L === letter ? null : L); setQuery(""); setTrail([]); } }}
                  disabled={!enabled}
                  style={{
                    ...letterBtnStyle,
                    color: active ? "var(--cx-accent, #7ee0ff)" : (enabled ? "var(--cx-fg, #c9d4dc)" : "rgba(255,255,255,0.15)"),
                    borderColor: active ? "var(--cx-accent, #7ee0ff)" : "transparent",
                    cursor: enabled ? "pointer" : "default",
                  }}
                  title={enabled ? `Entries beginning with ${L}` : `No entries for ${L} in this sample`}
                >{L}</button>
              );
            })}
          </div>
        </header>

        {/* Chapter picks strip */}
        {!currentEntry && !query.trim() && !letter && picks.length > 0 ? (
          <section style={picksStripStyle}>
            <div style={picksHStyle}>Dictionary picks for this chapter</div>
            <div style={picksRowStyle}>
              {picks.map((k) => (
                <button key={k} onClick={() => openEntry(k)} style={pickCardStyle} title={`Open ${entries[k].title}`}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{entries[k].title}</div>
                  <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2, letterSpacing: "0.08em", color: kindColor(entries[k].kind) }}>
                    {kindLabel(entries[k].kind)}
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* Search results */}
        {!currentEntry && query.trim() ? (
          <section style={{ marginBottom: 10 }}>
            <div style={sectionHStyle}>Results</div>
            {searchResults.length === 0 ? (
              <div style={{ ...statusStyle, paddingTop: 8 }}>
                No matches for <b>"{query}"</b> in the sample.
                <div style={{ marginTop: 8 }}>
                  <a
                    href={`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query + " bible")}`}
                    target="_blank" rel="noopener noreferrer" style={wikiLinkStyle}
                  >Search Wikipedia for "{query}" →</a>
                </div>
              </div>
            ) : (
              <ul style={listStyle}>
                {searchResults.map((k) => (
                  <li key={k} style={resultRowStyle}>
                    <button style={resultBtnStyle} onClick={() => openEntry(k)}>
                      <b>{entries[k].title}</b>
                      <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7, color: kindColor(entries[k].kind), letterSpacing: "0.08em" }}>
                        {kindLabel(entries[k].kind)}
                      </span>
                      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                        {(entries[k].body || "").slice(0, 110)}…
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {/* Letter browse */}
        {!currentEntry && letter ? (
          <section>
            <div style={sectionHStyle}>{letter}</div>
            <ul style={listStyle}>
              {letterEntries.map((k) => (
                <li key={k} style={resultRowStyle}>
                  <button style={resultBtnStyle} onClick={() => openEntry(k)}>
                    <b>{entries[k].title}</b>
                    <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7, color: kindColor(entries[k].kind), letterSpacing: "0.08em" }}>
                      {kindLabel(entries[k].kind)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Empty browse state */}
        {!currentEntry && !query.trim() && !letter && picks.length === 0 ? (
          <div style={{ ...statusStyle, opacity: 0.75 }}>
            Search above, tap a letter, or open a verse and use <i>Look up in Dictionary</i>.
          </div>
        ) : null}

        {/* Entry view */}
        {currentEntry ? (
          <article style={entryStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              {trail.length > 1 ? (
                <button onClick={onBack} style={backBtnStyle} title="Back to previous entry">← back</button>
              ) : null}
              <button onClick={onClearEntry} style={backBtnStyle} title="Close entry">× close</button>
            </div>
            <h2 style={entryTitleStyle}>{currentEntry.title}</h2>
            <div style={{ ...kindBadgeStyle, color: kindColor(currentEntry.kind), borderColor: kindColor(currentEntry.kind) }}>
              {kindLabel(currentEntry.kind)}
            </div>
            <div className="cx-dict-body" style={entryBodyStyle}>
              {renderBody(currentEntry.body)}
            </div>
            {Array.isArray(currentEntry.refs) && currentEntry.refs.length ? (
              <div style={{ marginTop: 12 }}>
                <div style={sectionHStyle}>Scripture</div>
                <div style={chipRowStyle}>
                  {currentEntry.refs.map((r) => (
                    <button key={r} style={refChipStyle} onClick={() => navigateToRef(r)} title={`Open ${formatRef(r)}`}>
                      {formatRef(r)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {Array.isArray(currentEntry.related) && currentEntry.related.length ? (
              <div style={{ marginTop: 12 }}>
                <div style={sectionHStyle}>Related entries</div>
                <div style={chipRowStyle}>
                  {currentEntry.related.map((r) => {
                    const present = !!entries[r];
                    return (
                      <button
                        key={r}
                        style={{ ...relChipStyle, opacity: present ? 1 : 0.4, cursor: present ? "pointer" : "default" }}
                        onClick={() => { if (present) openEntry(r); }}
                        title={present ? `Open ${entries[r].title}` : "Not in this sample"}
                        disabled={!present}
                      >
                        {present ? entries[r].title : r}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </article>
        ) : null}

        <footer style={footStyle}>
          Easton's Bible Dictionary (1893, public domain) — sample of {allKeys.length}.
        </footer>
      </div>
    );
  }

  // Render dictionary body. Italicize scripture-reference-looking citations
  // (e.g. "Gen. 12:1") and pull-quote any sentence that contains one,
  // matching the Easton-as-pull-quote aesthetic.
  function renderBody(body) {
    if (!body) return null;
    const text = String(body);
    // Split into sentences (rough).
    const parts = text.split(/(?<=[.!?])\s+(?=[A-Z(])/);
    return parts.map((s, i) => {
      // Detect quoted scripture (text enclosed in 'single quotes')
      const m = s.match(/'([^']{8,})'\s*\(([^)]*\d[^)]*)\)/);
      if (m) {
        const before = s.slice(0, m.index);
        const quote = m[1];
        const cite = m[2];
        const after = s.slice(m.index + m[0].length);
        return (
          <React.Fragment key={i}>
            {before}
            <blockquote style={pullQuoteStyle}>
              "{quote}" <span style={pullCiteStyle}>— {cite}</span>
            </blockquote>
            {after && <span>{after} </span>}
          </React.Fragment>
        );
      }
      return <span key={i}>{s} </span>;
    });
  }

  // ── Styles (inline so no CSS dependency) ──────────────────────────────
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
  const titleRowStyle = { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" };
  const partialPillStyle = {
    marginLeft: 8,
    fontSize: 10,
    padding: "2px 6px",
    border: "1px solid var(--cx-warn, #ffc46b)",
    color: "var(--cx-warn, #ffc46b)",
    borderRadius: 3,
    letterSpacing: "0.08em",
  };
  const searchStyle = {
    width: "100%",
    background: "var(--cx-bg-2, rgba(255,255,255,0.04))",
    color: "var(--cx-fg, #c9d4dc)",
    border: "1px solid var(--cx-rule, rgba(126,224,255,0.25))",
    padding: "6px 8px",
    fontSize: 13,
    fontFamily: "inherit",
    borderRadius: 3,
    outline: "none",
  };
  const letterBarStyle = {
    display: "flex",
    flexWrap: "wrap",
    gap: 2,
    marginTop: 8,
    fontFamily: "var(--cx-font-mono, ui-monospace, JetBrains Mono, monospace)",
  };
  const letterBtnStyle = {
    background: "transparent",
    border: "1px solid transparent",
    padding: "1px 5px",
    fontSize: 11,
    fontFamily: "inherit",
    borderRadius: 2,
    minWidth: 18,
  };
  const sectionHStyle = {
    fontSize: 10,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    opacity: 0.7,
    margin: "0 0 4px",
    fontWeight: 600,
  };
  const statusStyle = { padding: "16px 4px", opacity: 0.8 };
  const listStyle = { listStyle: "none", margin: 0, padding: 0 };
  const resultRowStyle = {
    padding: "4px 0",
    borderBottom: "1px dotted var(--cx-rule, rgba(255,255,255,0.06))",
  };
  const resultBtnStyle = {
    width: "100%",
    textAlign: "left",
    background: "transparent",
    border: 0,
    color: "var(--cx-fg, #c9d4dc)",
    padding: "4px 2px",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
  };
  const wikiLinkStyle = {
    color: "var(--cx-accent, #7ee0ff)",
    textDecoration: "underline",
    fontSize: 12,
  };
  const picksStripStyle = {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottom: "1px dashed var(--cx-rule, rgba(126,224,255,0.18))",
  };
  const picksHStyle = {
    ...sectionHStyle,
    marginBottom: 6,
  };
  const picksRowStyle = { display: "flex", gap: 6, flexWrap: "wrap" };
  const pickCardStyle = {
    background: "var(--cx-bg-2, rgba(126,224,255,0.06))",
    border: "1px solid var(--cx-rule, rgba(126,224,255,0.25))",
    color: "var(--cx-fg, #c9d4dc)",
    padding: "6px 9px",
    cursor: "pointer",
    borderRadius: 3,
    fontFamily: "inherit",
    textAlign: "left",
    minWidth: 90,
  };
  const entryStyle = { marginTop: 4 };
  const entryTitleStyle = {
    fontFamily: "var(--cx-font-serif, 'Cormorant Garamond', 'Cardo', serif)",
    fontSize: 26,
    fontWeight: 600,
    margin: "4px 0 4px",
    lineHeight: 1.15,
  };
  const kindBadgeStyle = {
    display: "inline-block",
    fontSize: 10,
    letterSpacing: "0.14em",
    padding: "1px 6px",
    border: "1px solid",
    borderRadius: 2,
    marginBottom: 10,
  };
  const entryBodyStyle = {
    fontFamily: "var(--cx-font-serif, 'Cormorant Garamond', 'Cardo', serif)",
    fontSize: 15,
    lineHeight: 1.6,
    color: "var(--cx-fg, #c9d4dc)",
  };
  const pullQuoteStyle = {
    margin: "10px 0 10px 8px",
    paddingLeft: 12,
    borderLeft: "3px solid var(--cx-accent, #7ee0ff)",
    fontStyle: "italic",
    color: "var(--cx-fg, #c9d4dc)",
  };
  const pullCiteStyle = {
    fontStyle: "normal",
    fontSize: "0.85em",
    opacity: 0.7,
    fontFamily: "var(--cx-font-mono, ui-monospace, monospace)",
  };
  const chipRowStyle = { display: "flex", flexWrap: "wrap", gap: 4 };
  const refChipStyle = {
    background: "transparent",
    border: "1px solid var(--cx-rule, rgba(126,224,255,0.3))",
    color: "var(--cx-accent, #7ee0ff)",
    padding: "2px 7px",
    fontSize: 11,
    fontFamily: "var(--cx-font-mono, ui-monospace, JetBrains Mono, monospace)",
    cursor: "pointer",
    borderRadius: 2,
  };
  const relChipStyle = {
    background: "transparent",
    border: "1px solid var(--cx-rule, rgba(200,168,255,0.4))",
    color: "#c8a8ff",
    padding: "2px 7px",
    fontSize: 11,
    fontFamily: "inherit",
    borderRadius: 2,
  };
  const backBtnStyle = {
    background: "transparent",
    border: "1px solid var(--cx-rule, rgba(126,224,255,0.25))",
    color: "var(--cx-fg, #c9d4dc)",
    padding: "1px 7px",
    fontSize: 11,
    cursor: "pointer",
    borderRadius: 3,
    fontFamily: "inherit",
  };
  const footStyle = {
    marginTop: 14,
    paddingTop: 8,
    borderTop: "1px solid var(--cx-rule, rgba(126,224,255,0.12))",
    fontSize: 10,
    opacity: 0.55,
    letterSpacing: "0.04em",
  };

  window.CODEX_DictionaryPanel = DictionaryPanel;

  // ── Plugin registration ───────────────────────────────────────────────
  function doRegister() {
    if (!window.CODEX_PLUGINS_API || typeof window.CODEX_PLUGINS_API.register !== "function") return false;
    return window.CODEX_PLUGINS_API.register({
      id: "bible-dictionary",
      name: "Bible Dictionary",
      version: "1.0.0",
      panels: [{
        id: "dictionary",
        label: "DICT",
        glyph: "ℵ",
        render(ctx) {
          const c = ctx || {};
          return React.createElement(DictionaryPanel, {
            book: c.book,
            bookId: c.bookId,
            chapter: c.chapter,
            verse: c.verse,
            translation: c.translation,
          });
        },
      }],
      verseActions: [{
        label: "Look up in Dictionary",
        icon: "ℵ",
        handler(verseRef) {
          // verseRef may be a string or an object — pass along verbatim plus text if present.
          try {
            const detail = (verseRef && typeof verseRef === "object")
              ? { ref: verseRef.ref || verseRef, text: verseRef.text || "" }
              : { ref: verseRef, text: "" };
            window.dispatchEvent(new CustomEvent("codex:dict-open", { detail }));
            window.dispatchEvent(new CustomEvent("codex:open-panel", {
              detail: { panelId: "bible-dictionary:dictionary", ctx: detail },
            }));
          } catch (e) { /* ignore */ }
        },
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
