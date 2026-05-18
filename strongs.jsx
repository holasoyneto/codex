// strongs.jsx
// CODEX — Strong's Concordance plugin (Phase 1.1).
//
// What it does:
//   • Loads two starter lexicon modules (Hebrew + Greek) and a sample
//     KJV ↔ Strong's word alignment via window.CODEX_MODULES.
//   • Exposes three globals other code can use:
//       window.CODEX_StrongsPanel     — React panel for the right rail.
//       window.CODEX_StrongsRenderer  — { renderInterlinear(verseRef, text) }.
//       window.CODEX_StrongsLookup    — lookup(strongsNumber) -> entry|null.
//   • Registers itself with window.CODEX_PLUGINS_API so the panel host picks
//     it up automatically. Adds a "Strong's Lookup" verse action too.
//
// Constraints honored:
//   • Pure additive — no edits to app.jsx / components.jsx / panels.jsx.
//   • Babel-standalone friendly (single closure, no imports).
//   • Defers plugin registration if the API isn't ready yet.

(function () {
  if (typeof window === "undefined") return;
  var React = window.React;
  if (!React) {
    console.warn("[strongs] React not loaded yet; skipping");
    return;
  }
  var useState = React.useState;
  var useEffect = React.useEffect;
  var useMemo = React.useMemo;
  var useCallback = React.useCallback;

  // ── Module loading cache ───────────────────────────────────────────────
  var _modPromises = {};
  function loadMod(id) {
    if (_modPromises[id]) return _modPromises[id];
    if (!window.CODEX_MODULES || typeof window.CODEX_MODULES.loadModule !== "function") {
      _modPromises[id] = Promise.reject(new Error("CODEX_MODULES unavailable"));
      return _modPromises[id];
    }
    _modPromises[id] = window.CODEX_MODULES.loadModule(id).catch(function (e) {
      console.warn("[strongs] failed to load " + id, e);
      // clear so a later retry can try again
      delete _modPromises[id];
      throw e;
    });
    return _modPromises[id];
  }

  // Synchronous accessor — populated after loads resolve. Keeps lookup()
  // available as a plain function for other features.
  var _lex = { hebrew: null, greek: null, alignment: null };

  function ensureLoaded() {
    return Promise.all([
      loadMod("strongs-hebrew").then(function (m) { _lex.hebrew = m; return m; }, function () { return null; }),
      loadMod("strongs-greek").then(function (m) { _lex.greek = m; return m; }, function () { return null; }),
      loadMod("alignment-kjv-sample").then(function (m) { _lex.alignment = m; return m; }, function () { return null; }),
    ]);
  }

  // Kick a load on first script eval so cross-feature lookups warm fast.
  ensureLoaded();

  // ── Pure lookup ────────────────────────────────────────────────────────
  function lookup(strongsNumber) {
    if (!strongsNumber || typeof strongsNumber !== "string") return null;
    var key = strongsNumber.trim().toUpperCase();
    if (!/^[HG]\d+$/.test(key)) return null;
    var src = key[0] === "H" ? _lex.hebrew : _lex.greek;
    if (!src || !src.entries) return null;
    return src.entries[key] || null;
  }

  // ── Verse-ref helpers ──────────────────────────────────────────────────
  // We accept refs in two shapes:
  //   "john.3.16"  (already canonical)
  //   { book, chapter, verse }
  function canonRef(refOrParts, chapter, verse) {
    if (typeof refOrParts === "string") {
      return refOrParts.toLowerCase().trim();
    }
    if (refOrParts && typeof refOrParts === "object") {
      var b = (refOrParts.bookId || refOrParts.book || "").toString().toLowerCase().trim();
      var c = refOrParts.chapter, v = refOrParts.verse;
      // normalize spaces ("1 john" -> "1-john" -> "1john")
      b = b.replace(/\s+/g, "");
      return b + "." + c + "." + v;
    }
    if (typeof chapter === "number" && typeof verse === "number") {
      var bk = (refOrParts || "").toString().toLowerCase().trim().replace(/\s+/g, "");
      return bk + "." + chapter + "." + verse;
    }
    return null;
  }

  function alignmentFor(ref) {
    if (!_lex.alignment || !_lex.alignment.verses) return null;
    if (!ref) return null;
    return _lex.alignment.verses[ref] || null;
  }

  // ── React: interlinear renderer ────────────────────────────────────────
  // If we have alignment data, render each token with the Strong's number
  // tucked beneath. Otherwise gracefully fall back to plain text.
  function renderInterlinear(verseRef, englishText) {
    var ref = canonRef(verseRef);
    var tokens = alignmentFor(ref);
    if (!tokens || !tokens.length) {
      return React.createElement("span", { className: "cx-interlinear-fallback" }, englishText || "");
    }
    var children = tokens.map(function (tok, i) {
      if (!tok.strongs) {
        return React.createElement("span", { key: i, className: "cx-interlinear-plain" }, tok.en + " ");
      }
      return React.createElement(
        "span",
        {
          key: i,
          className: "cx-interlinear-word",
          "data-strongs": tok.strongs,
          title: tok.lemma ? tok.strongs + " · " + tok.lemma : tok.strongs,
          onClick: function () { openLookup(tok.strongs); },
          style: { cursor: "pointer", borderBottom: "1px dotted currentColor", marginRight: "0.15em" },
        },
        React.createElement("span", { className: "cx-il-en" }, tok.en),
        React.createElement(
          "sub",
          { className: "cx-il-strongs", style: { opacity: 0.6, fontSize: "0.7em", marginLeft: "0.1em" } },
          tok.strongs
        )
      );
    });
    return React.createElement("span", { className: "cx-interlinear" }, children);
  }

  // Allow other features (or our own panel) to focus a Strong's number.
  function openLookup(strongsNumber) {
    try {
      window.dispatchEvent(new CustomEvent("codex:strongs-open", { detail: { strongs: strongsNumber } }));
    } catch (e) { /* no-op */ }
  }

  // ── React: the Panel ───────────────────────────────────────────────────
  function StrongsPanel(props) {
    var book = props.book || props.bookId || "";
    var chapter = props.chapter;
    var verse = props.verse;
    var ref = canonRef({ book: book, bookId: props.bookId, chapter: chapter, verse: verse });

    var loadingState = useState(!_lex.hebrew || !_lex.greek || !_lex.alignment);
    var loading = loadingState[0]; var setLoading = loadingState[1];
    var errState = useState(null);
    var err = errState[0]; var setErr = errState[1];
    var queryState = useState("");
    var query = queryState[0]; var setQuery = queryState[1];
    var focusedState = useState(null);
    var focused = focusedState[0]; var setFocused = focusedState[1];

    useEffect(function () {
      if (!loading) return;
      ensureLoaded().then(function () { setLoading(false); }, function (e) {
        setErr(e && e.message || String(e)); setLoading(false);
      });
    }, []);

    // Listen for external "open this Strong's number" requests.
    useEffect(function () {
      function onOpen(ev) {
        var s = ev && ev.detail && ev.detail.strongs;
        if (s) { setQuery(s); setFocused(s); }
      }
      window.addEventListener("codex:strongs-open", onOpen);
      return function () { window.removeEventListener("codex:strongs-open", onOpen); };
    }, []);

    // Reset focused entry when the verse changes.
    useEffect(function () { setFocused(null); }, [ref]);

    var tokens = useMemo(function () { return alignmentFor(ref) || []; }, [ref, loading]);
    var strongsInVerse = useMemo(function () {
      var seen = {}; var out = [];
      tokens.forEach(function (t) {
        if (t.strongs && !seen[t.strongs]) { seen[t.strongs] = 1; out.push(t); }
      });
      return out;
    }, [tokens]);

    var queryHit = useMemo(function () {
      var q = (query || "").trim().toUpperCase();
      if (!q) return null;
      // Normalize: allow "h1" / "h 1" / "1722" (default to G if numeric)
      var key = q.replace(/\s+/g, "");
      if (/^\d+$/.test(key)) {
        // ambiguous — try Hebrew first if number <= 8674
        var n = parseInt(key, 10);
        if (n > 0 && n <= 8674) {
          var hh = lookup("H" + n); if (hh) return { key: "H" + n, entry: hh };
        }
        var gg = lookup("G" + n); if (gg) return { key: "G" + n, entry: gg };
        return { key: q, entry: null };
      }
      var ent = lookup(key);
      return { key: key, entry: ent };
    }, [query, loading]);

    var activeKey = focused || (queryHit && queryHit.entry ? queryHit.key : null);
    var activeEntry = activeKey ? lookup(activeKey) : null;

    var partialNote = useMemo(function () {
      var partial = [];
      if (_lex.hebrew && _lex.hebrew.meta && _lex.hebrew.meta._partial) partial.push("Hebrew");
      if (_lex.greek && _lex.greek.meta && _lex.greek.meta._partial) partial.push("Greek");
      if (!partial.length) return null;
      return partial.join(" & ") + " lexicon is partial (starter set of ~500 entries — full lexicon coming).";
    }, [loading]);

    if (loading) {
      return React.createElement("div", { className: "cx-strongs-panel cx-pane-body" },
        React.createElement("p", { className: "cx-muted" }, "Loading Strong's lexicons…")
      );
    }

    if (err) {
      return React.createElement("div", { className: "cx-strongs-panel cx-pane-body" },
        React.createElement("p", { className: "cx-error" }, "Couldn't load Strong's data: " + err)
      );
    }

    return React.createElement("div", { className: "cx-strongs-panel cx-pane-body", style: { padding: "0.5rem 0.75rem" } },

      // ── Lookup search box ─────────────────────────────────────────
      React.createElement("div", { className: "cx-strongs-search", style: { marginBottom: "0.75rem" } },
        React.createElement("input", {
          type: "text",
          value: query,
          onChange: function (e) { setQuery(e.target.value); setFocused(null); },
          placeholder: "Strong's # (e.g. G2316 or H430)",
          "aria-label": "Strong's number lookup",
          style: { width: "100%", padding: "0.35rem 0.5rem", fontFamily: "inherit", fontSize: "0.9em",
                   background: "transparent", border: "1px solid var(--cx-border, #444)",
                   color: "inherit", borderRadius: "3px" },
        }),
        query && queryHit && !queryHit.entry
          ? React.createElement("p", { className: "cx-muted", style: { fontSize: "0.8em", marginTop: "0.35em" } },
              "No entry for " + queryHit.key + " in the starter lexicon.")
          : null
      ),

      // ── Words in current verse ───────────────────────────────────
      React.createElement("h4", { className: "cx-strongs-h", style: { margin: "0.25rem 0 0.4rem", fontSize: "0.85em", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.7 } },
        verse ? ("Words in " + book + " " + chapter + ":" + verse) : ("Words in " + book + " " + chapter)
      ),

      strongsInVerse.length
        ? React.createElement("ul", { className: "cx-strongs-wordlist", style: { listStyle: "none", padding: 0, margin: "0 0 1rem" } },
            strongsInVerse.map(function (t) {
              var entry = lookup(t.strongs);
              return React.createElement("li", {
                key: t.strongs,
                onClick: function () { setFocused(t.strongs); setQuery(t.strongs); },
                style: { padding: "0.3rem 0.4rem", cursor: "pointer", borderBottom: "1px solid var(--cx-border-soft, rgba(128,128,128,0.18))", display: "flex", justifyContent: "space-between", gap: "0.5rem" },
              },
                React.createElement("span", null,
                  React.createElement("b", null, t.en.replace(/^[\s,;.:]+|[\s,;.:]+$/g, "")),
                  entry ? React.createElement("span", { className: "cx-muted", style: { marginLeft: "0.4em", opacity: 0.7 } },
                    "· " + entry.translit + (entry.gloss ? " — " + entry.gloss : "")) : null
                ),
                React.createElement("code", { style: { opacity: 0.7, fontSize: "0.85em" } }, t.strongs)
              );
            })
          )
        : React.createElement("p", { className: "cx-muted", style: { fontSize: "0.85em", marginBottom: "1rem" } },
            "No alignment data for this verse yet. Sample coverage: Genesis 1, Psalm 23, John 1, John 3, Romans 8. Use the search above to look up any Strong's number."),

      // ── Focused entry detail ─────────────────────────────────────
      activeEntry
        ? React.createElement("div", { className: "cx-strongs-entry", style: { padding: "0.6rem", border: "1px solid var(--cx-border, #444)", borderRadius: "4px", background: "var(--cx-bg-soft, rgba(128,128,128,0.06))" } },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.4em" } },
              React.createElement("strong", { style: { fontSize: "1.4em" } }, activeEntry.word),
              React.createElement("code", { style: { opacity: 0.7 } }, activeKey)
            ),
            React.createElement("div", { style: { fontSize: "0.9em", marginBottom: "0.4em" } },
              React.createElement("i", null, activeEntry.translit),
              activeEntry.pron ? React.createElement("span", { className: "cx-muted", style: { marginLeft: "0.5em", opacity: 0.7 } }, "/" + activeEntry.pron + "/") : null,
              activeEntry.pos ? React.createElement("span", { className: "cx-muted", style: { marginLeft: "0.5em", opacity: 0.7 } }, "· " + activeEntry.pos) : null
            ),
            React.createElement("div", { style: { fontSize: "1em", marginBottom: "0.5em" } },
              React.createElement("b", null, activeEntry.gloss)
            ),
            React.createElement("p", { style: { fontSize: "0.9em", lineHeight: 1.45, margin: "0 0 0.5em" } }, activeEntry.def),
            typeof activeEntry.usage === "number"
              ? React.createElement("p", { className: "cx-muted", style: { fontSize: "0.8em", opacity: 0.7, margin: 0 } },
                  "Occurs ~" + activeEntry.usage + " times in scripture.")
              : null
          )
        : query && queryHit && queryHit.entry === null
          ? null
          : !focused && !strongsInVerse.length
            ? null
            : React.createElement("p", { className: "cx-muted", style: { fontSize: "0.85em", opacity: 0.7 } },
                "Tap a word above to see its Strong's entry."),

      // ── Partial-data note ────────────────────────────────────────
      partialNote
        ? React.createElement("p", { className: "cx-muted", style: { fontSize: "0.75em", marginTop: "1rem", opacity: 0.6, fontStyle: "italic" } }, partialNote)
        : null
    );
  }

  // ── Verse-action handler ───────────────────────────────────────────────
  function openStrongsForVerse(ctx) {
    // Best-effort: dispatch an event app shell could listen for to open the
    // panel; also log so we leave a breadcrumb in the console.
    try {
      window.dispatchEvent(new CustomEvent("codex:open-panel", {
        detail: { pluginId: "strongs-concordance", panelId: "strongs", ctx: ctx },
      }));
    } catch (e) { /* no-op */ }
    console.log("[strongs] verse action invoked", ctx);
  }

  // ── Expose globals ─────────────────────────────────────────────────────
  window.CODEX_StrongsLookup = lookup;
  window.CODEX_StrongsRenderer = { renderInterlinear: renderInterlinear, lookup: lookup };
  window.CODEX_StrongsPanel = StrongsPanel;

  // ── Plugin registration ────────────────────────────────────────────────
  function doRegister() {
    if (!window.CODEX_PLUGINS_API || typeof window.CODEX_PLUGINS_API.register !== "function") return false;
    return window.CODEX_PLUGINS_API.register({
      id: "strongs-concordance",
      name: "Strong's Concordance",
      version: "1.0.0",
      panels: [{
        id: "strongs",
        label: "STRONG'S",
        glyph: "ℋ",
        render: function (ctx) { return React.createElement(StrongsPanel, ctx || {}); },
      }],
      verseActions: [{
        label: "Strong's Lookup",
        icon: "ℋ",
        handler: function (ctx) { openStrongsForVerse(ctx); },
      }],
    });
  }

  if (!doRegister()) {
    // Defer until load — plugins.js may evaluate after us in script order.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", doRegister, { once: true });
    } else {
      window.addEventListener("load", doRegister, { once: true });
    }
  }
})();
