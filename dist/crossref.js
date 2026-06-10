// GENERATED from crossref.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
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
    return window.CODEX_DATA && window.CODEX_DATA.books || [];
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
      typeof verseRef === "string" ?
      verseRef.toLowerCase() :
      verseRef && verseRef.bookId ?
      `${verseRef.bookId}.${verseRef.chapter}.${verseRef.verse || ""}`.replace(/\.$/, "") :
      "";
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

  // ── Depth-action emit (Phase 2.5, additive + defensive) ───────────────
  // Following a cross-reference is a small depth action; closing a >=3-hop
  // chain is thread-closing. Per the frozen contract: crossref-follow
  // (weight 1) and crossref-chain (weight 5), domain "cross-references".
  function emitDepth(type, ref, weight) {
    try {
      const E = window.CODEX_ENGAGEMENT;
      if (E && typeof E.emit === "function") {E.emit(type, ref || null, weight, "cross-references");return;}
      if (typeof window.CustomEvent === "function") {
        window.dispatchEvent(new CustomEvent("codex:depth-action", {
          detail: { type, ref: ref || null, weight, domain: "cross-references" }
        }));
      }
    } catch (e) {}
  }

  // ── Optional AI "resonance" — silent degrade when no key is set ───────
  // Mirrors ai-quests.jsx hasAiKey() (reads the real key store) so we can
  // gate the feature off entirely when no provider is configured.
  function hasAiKey() {
    try {
      const k = JSON.parse(localStorage.getItem("codex.api.keys.v1") || "null") || {};
      if (k.active === "ollama") return true; // local, keyless
      if (k.anthropic || k.grok || k.groq || k.gemini) return true;
    } catch (e) {}
    try {if (localStorage.getItem("codex.anthropic.key")) return true;} catch (e) {}
    const t = window.CODEX_DATA && window.CODEX_DATA.tweaks || {};
    return !!(t.provider || t.model);
  }

  // Engine resolution delegates to the shared intel layer (one canonical copy).
  function getActiveEngine() {return window.CODEX_INTEL.intelEngine();}

  const RESONANCE_PROMPT =
  "You are a calm, scholarly study aide. In ONE or TWO sentences (under 45 words, no preamble, " +
  "no quotation marks), name the thematic thread that links these two scripture references. " +
  "Be specific and neutral; cite the shared motif, not a sermon.";

  // Fetch a one-line resonance note linking two refs. Cached by sourceKey|engine.
  // Any failure resolves to null so the caller renders nothing.
  function fetchResonance(sourceKey, targetKey, translation) {
    const eng = getActiveEngine();
    const model = eng.model || "claude-haiku-4-5-20251001";
    const cacheKey = "codex.xref.resonance." + sourceKey + "|" + targetKey + "|" + (eng.provider || "") + "|" + model;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached != null) return Promise.resolve(cached || null);
    } catch (e) {}
    const srcRef = formatRef(sourceKey),tgtRef = formatRef(targetKey);
    const srcText = snippetFor(sourceKey, translation) || "";
    const tgtText = snippetFor(targetKey, translation) || "";
    return fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: eng.provider,
        model,
        system: RESONANCE_PROMPT,
        messages: [{
          role: "user",
          content: `A: ${srcRef}${srcText ? " — " + srcText : ""}\nB: ${tgtRef}${tgtText ? " — " + tgtText : ""}\n\nName the link.`
        }],
        max_tokens: 120
      })
    }).
    then((r) => r.ok ? r.json() : null).
    then((body) => {
      const text = body && typeof body.text === "string" ? body.text.trim() : "";
      const out = text ? text.replace(/^["“]|["”]$/g, "").trim() : "";
      try {localStorage.setItem(cacheKey, out);} catch (e) {}
      return out || null;
    }).
    catch(() => null);
  }

  // ── The panel component ───────────────────────────────────────────────
  function CrossRefPanel({ book, bookId, chapter, verse, translation }) {
    const [mod, setMod] = useState(null);
    const [err, setErr] = useState(null);
    const [loading, setLoading] = useState(true);

    // The host verse key — the thread's base when no thread is active.
    const hostKey = `${bookId}.${chapter}.${verse || 1}`;

    // Local mirror of the chain thread, kept in sync from a window listener
    // on codex:xref-thread (the host owns the canonical thread; this panel
    // only reflects it). Previously this component kept its own `trail`
    // useState plus a [bookId,chapter,verse] reset effect, which wiped the
    // breadcrumb whenever the reader scrolled — both are now removed.
    const [thread, setThread] = useState([]);
    useEffect(() => {
      const onThread = (e) => {
        const t = e && e.detail && Array.isArray(e.detail.thread) ? e.detail.thread : [];
        setThread(t.slice());
      };
      window.addEventListener("codex:xref-thread", onThread);
      return () => window.removeEventListener("codex:xref-thread", onThread);
    }, []);

    // currentKey = top of thread, else the host verse key when empty.
    const currentKey = thread.length ? thread[thread.length - 1] : hostKey;

    // Per-row inline compare + AI-resonance UI state.
    const [expandedCompareKey, setExpandedCompareKey] = useState(null);
    const [resonance, setResonance] = useState({}); // targetKey -> string|null
    const aiEnabled = useMemo(() => hasAiKey(), [mod]);

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      loadTsk().then(
        (m) => {if (!cancelled) {setMod(m);setLoading(false);}},
        (e) => {if (!cancelled) {setErr(e.message || String(e));setLoading(false);}}
      );
      return () => {cancelled = true;};
    }, []);

    // Collapse the open compare row when the viewed verse changes.
    useEffect(() => {setExpandedCompareKey(null);}, [currentKey]);
    const refs = useMemo(() => {
      if (!mod || !mod.verses) return [];
      // Try exact verse; fall back to chapter.1 only for the initial view if no entry.
      const direct = mod.verses[currentKey] || [];
      if (direct.length) return direct;
      const p = parseVerseKey(currentKey);
      if (!p) return [];
      // Look for any verse in same chapter as a partial-fallback for chapter focus
      const sameChapter = Object.keys(mod.verses).
      filter((k) => k.startsWith(`${p.bookId}.${p.chapter}.`));
      return sameChapter.length === 1 ? mod.verses[sameChapter[0]] : [];
    }, [mod, currentKey]);

    // Normalise each ref to { ref: string }.
    // The full TSK module stores plain strings; the earlier sample stored
    // objects with { ref, theme }. Support both formats.
    const normRefs = useMemo(() => {
      return refs.map((r) => typeof r === "string" ? { ref: r } : r);
    }, [refs]);

    // Primary action: follow a reference. The host owns navigation + the
    // thread; this panel just announces intent on the canonical bus.
    const onJump = useCallback((targetKey) => {
      try {
        window.dispatchEvent(new CustomEvent("codex:xref-jump", {
          detail: { key: targetKey, ref: formatRef(targetKey), push: true }
        }));
      } catch (e) {}
      // Depth: a followed ref weighs 1; a >=3-hop chain closes a thread (5).
      const hops = thread.length + 1; // following pushes one more hop
      if (hops >= 3) emitDepth("crossref-chain", targetKey, 5);else
      emitDepth("crossref-follow", targetKey, 1);
    }, [thread.length]);

    // Back steps the thread; the host owns the thread mutation.
    const onBack = useCallback(() => {
      try {window.dispatchEvent(new CustomEvent("codex:xref-back", { detail: {} }));}
      catch (e) {}
    }, []);

    // Toggle the inline side-by-side compare for a row; kick off the
    // optional AI resonance the first time a row opens (silent degrade).
    const onToggleCompare = useCallback((targetKey) => {
      setExpandedCompareKey((cur) => {
        const next = cur === targetKey ? null : targetKey;
        if (next && aiEnabled && !(targetKey in resonance)) {
          setResonance((r) => ({ ...r, [targetKey]: null }));
          fetchResonance(currentKey, targetKey, translation).then((note) => {
            setResonance((r) => ({ ...r, [targetKey]: note || "" }));
          });
        }
        return next;
      });
    }, [aiEnabled, resonance, currentKey, translation]);

    return (/*#__PURE__*/
      React.createElement("div", { className: "cx-xref-pane", style: paneStyle }, /*#__PURE__*/
      React.createElement("header", { style: headerStyle }, /*#__PURE__*/
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
      thread.length > 0 ? /*#__PURE__*/
      React.createElement("button", { onClick: onBack, title: "Back", style: backBtnStyle }, "\u2190 back") :
      null, /*#__PURE__*/
      React.createElement("span", { style: crumbsStyle },
      [hostKey, ...thread].map((k, i, arr) => /*#__PURE__*/
      React.createElement("span", { key: i },
      i > 0 ? /*#__PURE__*/React.createElement("span", { style: { opacity: 0.5, margin: "0 6px" } }, "\u2192") : null, /*#__PURE__*/
      React.createElement("b", { style: { color: i === arr.length - 1 ? "var(--cx-accent, #7ee0ff)" : "inherit" } },
      formatRef(k)
      )
      )
      )
      )
      ), /*#__PURE__*/
      React.createElement("div", { style: subStyle }, "Treasury of Scripture Knowledge",

      mod && mod.meta && mod.meta.totalRefs ? /*#__PURE__*/
      React.createElement("span", { style: { fontSize: 10, opacity: 0.6 } },
      Number(mod.meta.totalRefs).toLocaleString(), " cross-references"
      ) :
      null
      )
      ),

      loading ? /*#__PURE__*/
      React.createElement("div", { style: statusStyle }, "Loading TSK\u2026") :
      err ? /*#__PURE__*/
      React.createElement("div", { style: { ...statusStyle, color: "var(--cx-warn, #ffc46b)" } }, "Couldn't load cross-references: ",
      err
      ) :
      normRefs.length === 0 ? /*#__PURE__*/
      React.createElement("div", { style: statusStyle }, "No cross-references for ", /*#__PURE__*/
      React.createElement("b", null, formatRef(currentKey)), "."
      ) : /*#__PURE__*/

      React.createElement("div", null, /*#__PURE__*/
      React.createElement("ul", { style: listStyle },
      normRefs.map((r, i) => {
        const snip = snippetFor(r.ref, translation);
        const open = expandedCompareKey === r.ref;
        const note = resonance[r.ref];
        return (/*#__PURE__*/
          React.createElement("li", { key: i, style: rowStyle }, /*#__PURE__*/
          React.createElement("div", { style: rowMainStyle }, /*#__PURE__*/
          React.createElement("button", {
            style: refBtnStyle,
            onClick: () => onJump(r.ref),
            title: `Open ${formatRef(r.ref)} in reader` }, /*#__PURE__*/

          React.createElement("span", { style: refTagStyle }, formatRef(r.ref)),
          snip ? /*#__PURE__*/React.createElement("span", { style: snipStyle }, " \u2014 ", snip.length > 160 ? snip.slice(0, 157) + "…" : snip) : null
          ), /*#__PURE__*/
          React.createElement("button", {
            style: open ? { ...chainBtnStyle, ...chainBtnOpenStyle } : chainBtnStyle,
            onClick: () => onToggleCompare(r.ref),
            title: "Compare side by side",
            "aria-label": "Compare side by side",
            "aria-expanded": open },
          open ? "× close" : "▦ compare")
          ),
          open ? /*#__PURE__*/
          React.createElement("div", { style: compareWrapStyle }, /*#__PURE__*/
          React.createElement("div", { style: compareColsStyle }, /*#__PURE__*/
          React.createElement("div", { style: compareColStyle }, /*#__PURE__*/
          React.createElement("div", { style: compareHeadStyle }, formatRef(currentKey)), /*#__PURE__*/
          React.createElement("div", { style: compareTextStyle }, snippetFor(currentKey, translation) || /*#__PURE__*/React.createElement("span", { style: { opacity: 0.55 } }, "Text not cached."))
          ), /*#__PURE__*/
          React.createElement("div", { style: compareColStyle }, /*#__PURE__*/
          React.createElement("div", { style: compareHeadStyle }, formatRef(r.ref)), /*#__PURE__*/
          React.createElement("div", { style: compareTextStyle }, snip || /*#__PURE__*/React.createElement("span", { style: { opacity: 0.55 } }, "Text not cached."))
          )
          ),
          aiEnabled && (note === null || typeof note === "string" && note) ? /*#__PURE__*/
          React.createElement("div", { style: resonanceStyle }, /*#__PURE__*/
          React.createElement("span", { style: resonanceLabelStyle }, "resonance"), " ",
          note === null ? /*#__PURE__*/React.createElement("span", { style: { opacity: 0.6 } }, "reading\u2026") : note
          ) :
          null
          ) :
          null
          ));

      })
      )
      ), /*#__PURE__*/


      React.createElement("footer", { style: footStyle }, "Click a reference to follow it \xB7 \u2190 back to return"

      )
      ));

  }

  // Inline styles keep this self-contained (styles.css is touched by other agents).
  const paneStyle = {
    padding: "10px 12px 14px",
    color: "var(--cx-fg, #c9d4dc)",
    fontFamily: "var(--cx-font-ui, ui-sans-serif, system-ui)",
    fontSize: 13,
    lineHeight: 1.5
  };
  const headerStyle = {
    borderBottom: "1px solid var(--cx-rule, rgba(126,224,255,0.18))",
    paddingBottom: 8,
    marginBottom: 10
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
    flexWrap: "wrap"
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
    letterSpacing: "0.05em"
  };
  const statusStyle = { padding: "16px 4px", opacity: 0.8 };
  const listStyle = { listStyle: "none", margin: 0, padding: 0 };
  const rowStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: "4px 0",
    borderBottom: "1px dotted var(--cx-rule, rgba(255,255,255,0.06))"
  };
  const rowMainStyle = {
    display: "flex",
    alignItems: "flex-start",
    gap: 6
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
    fontFamily: "inherit"
  };
  const refTagStyle = {
    fontFamily: "var(--cx-font-mono, ui-monospace, JetBrains Mono, monospace)",
    color: "var(--cx-accent, #7ee0ff)",
    marginRight: 6,
    fontWeight: 600
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
    whiteSpace: "nowrap"
  };
  const chainBtnOpenStyle = {
    background: "var(--cx-accent-dim, rgba(126,224,255,0.12))",
    borderColor: "var(--cx-accent, #7ee0ff)"
  };
  const compareWrapStyle = {
    margin: "2px 0 6px",
    padding: "8px",
    border: "1px solid var(--cx-rule, rgba(126,224,255,0.18))",
    borderRadius: 4,
    background: "var(--cx-panel, rgba(255,255,255,0.03))"
  };
  const compareColsStyle = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10
  };
  const compareColStyle = { minWidth: 0 };
  const compareHeadStyle = {
    fontFamily: "var(--cx-font-mono, ui-monospace, JetBrains Mono, monospace)",
    color: "var(--cx-accent, #7ee0ff)",
    fontSize: 11,
    fontWeight: 600,
    marginBottom: 4
  };
  const compareTextStyle = { fontSize: 12, lineHeight: 1.5, opacity: 0.92 };
  const resonanceStyle = {
    marginTop: 8,
    paddingTop: 6,
    borderTop: "1px dotted var(--cx-rule, rgba(126,224,255,0.18))",
    fontSize: 12,
    lineHeight: 1.5,
    fontStyle: "italic",
    opacity: 0.9
  };
  const resonanceLabelStyle = {
    fontStyle: "normal",
    fontSize: 9,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    opacity: 0.55,
    fontFamily: "var(--cx-font-mono, ui-monospace, monospace)"
  };
  const footStyle = {
    marginTop: 12,
    paddingTop: 8,
    borderTop: "1px solid var(--cx-rule, rgba(126,224,255,0.12))",
    fontSize: 10,
    opacity: 0.55,
    letterSpacing: "0.04em"
  };

  window.CODEX_CrossRefPanel = CrossRefPanel;

  // ── Plugin registration ───────────────────────────────────────────────
  function openCrossRefsForVerse(ctx) {
    // Best-effort: open the right rail on our plugin tab. We dispatch a
    // custom event the host can listen to; otherwise we at least surface a
    // navigate hint so the panel host re-renders.
    try {
      window.dispatchEvent(new CustomEvent("codex:open-panel", {
        detail: { panelId: "crossrefs-tsk:crossrefs", ctx }
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
          const c = ctx || {};
          return React.createElement(CrossRefPanel, {
            book: c.book,
            bookId: c.bookId || "John",
            chapter: c.chapter || 1,
            verse: c.verse || 1,
            translation: c.translation
          });
        }
      }],
      verseActions: [{
        label: "Cross-References",
        icon: "✝",
        handler(verseRef) {openCrossRefsForVerse({ ref: verseRef });}
      }]
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
})();
