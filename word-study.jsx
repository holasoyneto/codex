// word-study.jsx
// CODEX — Phase 1.4 Word Study plugin.
//
// Deep-dive on a single Greek/Hebrew/English word: hero header, semantic
// range, frequency-by-book bar chart, first occurrences, AI-fetched related
// words, and a 1-paragraph theology pull. Self-registers via
// window.CODEX_PLUGINS_API; mirrors strongs.jsx style.
//
// Triggered by:
//   • codex:word-study-open  { strongs?, word?, lang? }
//   • codex:strongs-open     { strongs } (focuses the studied word)
//   • free-form search box at the top of the panel
//   • Verse action "Word Study"
//
// AI calls (related-words + theology paragraph) cache per Strong's # for
// 30 days under localStorage. No network use without an AI key configured.
(function () {
  if (typeof window === "undefined") return;
  var React = window.React;
  if (!React) { console.warn("[word-study] React not ready"); return; }
  var useState = React.useState;
  var useEffect = React.useEffect;
  var useMemo = React.useMemo;
  var useRef = React.useRef;

  var LS_LAST = "codex.wordstudy.last";
  var LS_AI_PREFIX = "codex.wordstudy.";   // codex.wordstudy.G25 etc.
  var AI_TTL_MS = 30 * 24 * 60 * 60 * 1000;

  // ── tiny helpers ────────────────────────────────────────────────────
  function lsGet(k, fb) {
    try { var v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); }
    catch (e) { return fb; }
  }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function getTweaks() {
    return (window.CODEX_DATA && window.CODEX_DATA.tweaks) || {};
  }
  function hasAiKey() {
    var t = getTweaks();
    return !!(t.provider || t.model);
  }
  function extractJson(text) {
    if (!text) return null;
    var s = String(text).trim()
      .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
    try { return JSON.parse(s); } catch (e) {}
    var m = s.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
    return null;
  }
  function bookName(bookId) {
    try {
      var bk = (window.CODEX_DATA && window.CODEX_DATA.books || []).find(function (b) { return b.id === bookId; });
      if (bk) return bk.name;
    } catch (e) {}
    return bookId;
  }
  function parseRef(ref) {
    var parts = String(ref || "").split(".");
    var v = parts.pop(), c = parts.pop(), b = parts.join(".");
    return { bookId: b, chapter: Number(c), verse: Number(v) };
  }
  function navigate(bookId, chapter, verse) {
    try {
      var name = bookName(bookId);
      if (typeof window.codexJumpToRef === "function") {
        window.codexJumpToRef(name + " " + chapter + ":" + verse);
        return;
      }
      window.dispatchEvent(new CustomEvent("codex:navigate", {
        detail: { book: name, bookId: bookId, chapter: chapter, verse: verse }
      }));
    } catch (e) {}
  }

  function lookup(strongs) {
    if (!strongs) return null;
    try {
      if (typeof window.CODEX_StrongsLookup === "function") {
        return window.CODEX_StrongsLookup(strongs);
      }
    } catch (e) {}
    return null;
  }

  // Best-guess: split a Strong's "def" string into bullets at semicolons /
  // numeric markers / colons. Falls back to a single bullet.
  function splitSemanticRange(def) {
    if (!def) return [];
    var raw = String(def).trim();
    // Try numbered patterns like "1) X 2) Y 3) Z"
    var nums = raw.split(/\s*\d+\)\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (nums.length >= 2) return nums;
    var parts = raw.split(/\s*;\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (parts.length >= 2) return parts;
    return [raw];
  }

  // ── AI calls (cached) ───────────────────────────────────────────────
  function aiCacheGet(strongs) {
    var c = lsGet(LS_AI_PREFIX + strongs, null);
    if (!c || !c.ts || Date.now() - c.ts > AI_TTL_MS) return null;
    return c.data || null;
  }
  function aiCacheSet(strongs, data) {
    lsSet(LS_AI_PREFIX + strongs, { ts: Date.now(), data: data });
  }

  function chat(system, user, maxTokens) {
    var t = getTweaks();
    return fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: t.provider, model: t.model,
        system: system,
        messages: [{ role: "user", content: user }],
        max_tokens: maxTokens || 700,
      })
    }).then(function (r) { return r.json(); });
  }

  function fetchRelated(strongs, word) {
    var sys = "You are a biblical lexicographer. Return JSON only.";
    var user = 'For the word "' + (word || "") + '" (' + strongs + '), list:\n'
      + '- 3-5 related Greek words with their Strong\'s numbers and brief meanings\n'
      + '- 3-5 Hebrew counterparts with their Strong\'s numbers\n'
      + '- Any conceptual antonyms\n'
      + 'Return JSON only:\n'
      + '{ "related": [{ "word": "...", "strongs": "...", "meaning": "..." }],\n'
      + '  "hebrew_counterparts": [...],\n'
      + '  "antonyms": [...] }';
    return chat(sys, user, 800).then(function (d) {
      if (!d || !d.text) throw new Error((d && d.error) || "No response");
      var j = extractJson(d.text);
      if (!j) throw new Error("Bad JSON");
      return j;
    });
  }
  function fetchTheology(strongs, word, gloss) {
    var sys = "You are a biblical theologian. Write one tight paragraph (110-160 words), plain prose, no headings, no bullets. Scripture-faithful, ecumenical.";
    var user = 'Why does the biblical word "' + (word || "") + '" (' + strongs + (gloss ? ", gloss: " + gloss : "") + ') matter theologically? Trace its weight in the canon in one paragraph.';
    return chat(sys, user, 500).then(function (d) {
      if (!d || !d.text) throw new Error((d && d.error) || "No response");
      return String(d.text).trim();
    });
  }

  // ── Frequency over user library ─────────────────────────────────────
  function frequencyFor(word) {
    if (!word || !window.CODEX_SEARCH || typeof window.CODEX_SEARCH.search !== "function") {
      return Promise.resolve({ total: 0, byBook: [], hits: [] });
    }
    var p;
    try { p = window.CODEX_SEARCH.search(word, { limit: 500 }); }
    catch (e) { return Promise.resolve({ total: 0, byBook: [], hits: [] }); }
    return Promise.resolve(p).then(function (results) {
      var arr = Array.isArray(results) ? results : (results && results.results) || [];
      var counts = {};
      arr.forEach(function (r) {
        var ref = r.ref || r.id || "";
        var parts = ref.split(".");
        if (parts.length >= 3) {
          var bookId = parts.slice(0, -2).join(".");
          counts[bookId] = (counts[bookId] || 0) + 1;
        }
      });
      var byBook = Object.keys(counts).map(function (b) {
        return { bookId: b, name: bookName(b), count: counts[b] };
      }).sort(function (a, b) { return b.count - a.count; });
      return { total: arr.length, byBook: byBook, hits: arr };
    }, function () { return { total: 0, byBook: [], hits: [] }; });
  }

  // ── Panel ───────────────────────────────────────────────────────────
  function WordStudyPanel(props) {
    var last = lsGet(LS_LAST, null) || {};
    var queryState = useState(last.word || last.strongs || "");
    var query = queryState[0]; var setQuery = queryState[1];
    var inputState = useState(last.word || last.strongs || "");
    var inputVal = inputState[0]; var setInputVal = inputState[1];

    var freqState = useState({ total: 0, byBook: [], hits: [], loading: false });
    var freq = freqState[0]; var setFreq = freqState[1];

    var aiState = useState({ related: null, theology: null, loading: false, err: null });
    var ai = aiState[0]; var setAi = aiState[1];

    // Resolve studied word from query — could be a Strong's # or a word.
    var entry = useMemo(function () {
      var q = (query || "").trim();
      if (!q) return null;
      if (/^[HG]\d+$/i.test(q)) {
        var e = lookup(q.toUpperCase());
        if (e) return { strongs: q.toUpperCase(), entry: e, word: e.word, lang: q[0].toUpperCase() === "H" ? "heb" : "grk" };
        return { strongs: q.toUpperCase(), entry: null, word: q.toUpperCase(), lang: q[0].toUpperCase() === "H" ? "heb" : "grk" };
      }
      return { strongs: null, entry: null, word: q, lang: "eng" };
    }, [query]);

    // Persist last-studied
    useEffect(function () {
      if (!query) return;
      lsSet(LS_LAST, { word: entry && entry.word, strongs: entry && entry.strongs });
    }, [query]);

    // Listen for cross-feature triggers
    useEffect(function () {
      function onWordStudy(ev) {
        var d = (ev && ev.detail) || {};
        var next = d.strongs || d.word || "";
        if (next) { setQuery(next); setInputVal(next); }
      }
      function onStrongs(ev) {
        var s = ev && ev.detail && ev.detail.strongs;
        if (s) { setQuery(s); setInputVal(s); }
      }
      window.addEventListener("codex:word-study-open", onWordStudy);
      window.addEventListener("codex:strongs-open", onStrongs);
      return function () {
        window.removeEventListener("codex:word-study-open", onWordStudy);
        window.removeEventListener("codex:strongs-open", onStrongs);
      };
    }, []);

    // Frequency lookup whenever the searched word changes
    useEffect(function () {
      if (!entry || !entry.word) { setFreq({ total: 0, byBook: [], hits: [], loading: false }); return; }
      // For Strong's lookups, use the English gloss/translit; pure English uses itself.
      var probe = entry.entry && entry.entry.gloss
        ? String(entry.entry.gloss).split(/[,;]/)[0].trim()
        : entry.word;
      if (!probe) return;
      setFreq(function (f) { return { total: f.total, byBook: f.byBook, hits: f.hits, loading: true }; });
      frequencyFor(probe).then(function (out) {
        out.loading = false; setFreq(out);
      });
    }, [entry && entry.word, entry && entry.strongs]);

    // AI lookups — only for Strong's-anchored words, cached, only if AI configured
    useEffect(function () {
      setAi({ related: null, theology: null, loading: false, err: null });
      if (!entry || !entry.strongs) return;
      var cached = aiCacheGet(entry.strongs);
      if (cached) { setAi({ related: cached.related, theology: cached.theology, loading: false, err: null }); return; }
      if (!hasAiKey()) return;
      setAi({ related: null, theology: null, loading: true, err: null });
      var w = entry.entry && entry.entry.word || entry.word;
      var g = entry.entry && entry.entry.gloss || "";
      Promise.all([
        fetchRelated(entry.strongs, w).catch(function () { return null; }),
        fetchTheology(entry.strongs, w, g).catch(function () { return null; }),
      ]).then(function (res) {
        var pack = { related: res[0], theology: res[1] };
        if (pack.related || pack.theology) aiCacheSet(entry.strongs, pack);
        setAi({ related: pack.related, theology: pack.theology, loading: false, err: null });
      });
    }, [entry && entry.strongs]);

    function submit(e) {
      if (e && e.preventDefault) e.preventDefault();
      setQuery((inputVal || "").trim());
    }

    var maxBookCount = freq.byBook.reduce(function (m, b) { return Math.max(m, b.count); }, 0);
    var first5 = (freq.hits || []).slice(0, 5);

    // Build hero block
    var entryData = entry && entry.entry;
    var heroWord = (entryData && entryData.word) || (entry && entry.word) || "";
    var translit = entryData && entryData.translit;
    var gloss = entryData && entryData.gloss;
    var langClass = entry && entry.lang === "heb" ? "cx-ws-hero-heb" :
                    entry && entry.lang === "grk" ? "cx-ws-hero-grk" : "cx-ws-hero-eng";

    return React.createElement("div", { className: "cx-ws-panel cx-pane-body" },

      // ── Search box ──────────────────────────────────────────────
      React.createElement("form", { className: "cx-ws-search", onSubmit: submit },
        React.createElement("input", {
          type: "text",
          value: inputVal,
          onChange: function (e) { setInputVal(e.target.value); },
          placeholder: "Word or Strong's # (e.g. love, G25, H157)",
          "aria-label": "Word study search",
          className: "cx-ws-input",
        }),
        React.createElement("button", { type: "submit", className: "cx-ws-go" }, "Study")
      ),

      !query
        ? React.createElement("div", { className: "cx-ws-empty" },
            React.createElement("p", null, "Search a word above, click a Strong's number, or use the verse menu's ", React.createElement("b", null, "Word Study"), " action."),
            React.createElement("p", { className: "cx-muted" }, "Try: ", React.createElement("code", null, "G25"), " (agape), ", React.createElement("code", null, "H157"), " (ahab), or ", React.createElement("i", null, "love"), ".")
          )
        : React.createElement(React.Fragment, null,

          // ── 1. Hero ───────────────────────────────────────────────
          React.createElement("section", { className: "cx-ws-section cx-ws-hero" },
            React.createElement("div", { className: "cx-ws-hero-word " + langClass }, heroWord),
            translit ? React.createElement("div", { className: "cx-ws-hero-translit" }, translit) : null,
            React.createElement("div", { className: "cx-ws-hero-meta" },
              entry && entry.strongs ? React.createElement("code", { className: "cx-ws-strongs" }, entry.strongs) : null,
              gloss ? React.createElement("span", { className: "cx-ws-gloss" }, gloss) : null
            )
          ),

          // ── 2. Semantic range ────────────────────────────────────
          entryData && entryData.def
            ? React.createElement("section", { className: "cx-ws-section" },
                React.createElement("h4", { className: "cx-ws-h" }, "Semantic range"),
                React.createElement("ul", { className: "cx-ws-srange" },
                  splitSemanticRange(entryData.def).map(function (s, i) {
                    return React.createElement("li", { key: i }, s);
                  })
                )
              )
            : null,

          // ── 3. Frequency ─────────────────────────────────────────
          React.createElement("section", { className: "cx-ws-section" },
            React.createElement("h4", { className: "cx-ws-h" }, "Frequency in your library"),
            freq.loading
              ? React.createElement("p", { className: "cx-muted" }, "Counting…")
              : freq.total === 0
                ? React.createElement("p", { className: "cx-muted" },
                    "No occurrences found yet. Open more chapters to seed the search index.")
                : React.createElement(React.Fragment, null,
                    React.createElement("p", { className: "cx-ws-freq-total" },
                      React.createElement("b", null, freq.total),
                      " occurrences across ",
                      React.createElement("b", null, freq.byBook.length),
                      " book", freq.byBook.length === 1 ? "" : "s", "."
                    ),
                    React.createElement("ul", { className: "cx-ws-bars" },
                      freq.byBook.slice(0, 18).map(function (b) {
                        var pct = maxBookCount ? Math.round((b.count / maxBookCount) * 100) : 0;
                        return React.createElement("li", { key: b.bookId, className: "cx-ws-bar-row" },
                          React.createElement("span", { className: "cx-ws-bar-name" }, b.name),
                          React.createElement("span", { className: "cx-ws-bar-track" },
                            React.createElement("span", { className: "cx-ws-bar-fill", style: { width: pct + "%" } })
                          ),
                          React.createElement("span", { className: "cx-ws-bar-count" }, b.count)
                        );
                      })
                    )
                  )
          ),

          // ── 4. First occurrences ─────────────────────────────────
          first5.length
            ? React.createElement("section", { className: "cx-ws-section" },
                React.createElement("h4", { className: "cx-ws-h" }, "First occurrences"),
                React.createElement("ul", { className: "cx-ws-occ" },
                  first5.map(function (h, i) {
                    var p = parseRef(h.ref || "");
                    var label = bookName(p.bookId) + " " + p.chapter + ":" + p.verse;
                    var snippet = h.snippet || h.text || "";
                    return React.createElement("li", { key: i, className: "cx-ws-occ-item",
                      onClick: function () { navigate(p.bookId, p.chapter, p.verse); }
                    },
                      React.createElement("div", { className: "cx-ws-occ-ref" }, label),
                      React.createElement("div", { className: "cx-ws-occ-snip",
                        dangerouslySetInnerHTML: { __html: snippet }
                      })
                    );
                  })
                )
              )
            : null,

          // ── 5. Related / synonyms / antonyms (AI) ───────────────
          entry && entry.strongs
            ? React.createElement("section", { className: "cx-ws-section" },
                React.createElement("h4", { className: "cx-ws-h" }, "Related words"),
                ai.loading
                  ? React.createElement("p", { className: "cx-muted" }, "Asking the lexicographer…")
                  : !ai.related
                    ? React.createElement("p", { className: "cx-muted" },
                        hasAiKey() ? "No related-words data available." : "Configure an AI engine in Settings to enable related-words discovery.")
                    : React.createElement("div", { className: "cx-ws-related" },
                        renderRelGroup("Related", ai.related.related),
                        renderRelGroup("Hebrew counterparts", ai.related.hebrew_counterparts),
                        renderRelGroup("Antonyms", ai.related.antonyms)
                      )
              )
            : null,

          // ── 6. Theology pull ────────────────────────────────────
          entry && entry.strongs && (ai.theology || ai.loading)
            ? React.createElement("section", { className: "cx-ws-section" },
                React.createElement("h4", { className: "cx-ws-h" }, "Why it matters"),
                ai.loading && !ai.theology
                  ? React.createElement("p", { className: "cx-muted" }, "Drafting…")
                  : React.createElement("blockquote", { className: "cx-ws-theology" }, ai.theology)
              )
            : null,

          // ── 7. Citation chain ───────────────────────────────────
          entryData && typeof entryData.usage === "number" && entryData.usage > 50
            ? React.createElement("section", { className: "cx-ws-section" },
                React.createElement("h4", { className: "cx-ws-h" }, "Key passages"),
                React.createElement("p", { className: "cx-muted cx-ws-cite-note" },
                  "Occurs ~", entryData.usage, " times — a high-frequency lemma. See first occurrences above; full citation chain coming with the expanded lexicon.")
              )
            : null
        )
    );
  }

  function renderRelGroup(label, list) {
    if (!list || !list.length) return null;
    return React.createElement("div", { className: "cx-ws-rel-group" },
      React.createElement("div", { className: "cx-ws-rel-label" }, label),
      React.createElement("ul", { className: "cx-ws-rel-list" },
        list.map(function (it, i) {
          var w = it && (it.word || it.term) || "";
          var s = it && it.strongs;
          var m = it && (it.meaning || it.gloss) || "";
          return React.createElement("li", { key: i, className: "cx-ws-rel-item" },
            React.createElement("span", { className: "cx-ws-rel-word",
              onClick: s ? function () {
                window.dispatchEvent(new CustomEvent("codex:word-study-open", { detail: { strongs: s, word: w } }));
              } : undefined,
              style: s ? { cursor: "pointer", textDecoration: "underline dotted" } : undefined,
            }, w),
            s ? React.createElement("code", { className: "cx-ws-rel-strongs" }, s) : null,
            m ? React.createElement("span", { className: "cx-ws-rel-mean" }, "— " + m) : null
          );
        })
      )
    );
  }

  // ── Plugin registration ───────────────────────────────────────────
  function doRegister() {
    if (!window.CODEX_PLUGINS_API || typeof window.CODEX_PLUGINS_API.register !== "function") return false;
    return window.CODEX_PLUGINS_API.register({
      id: "word-study",
      name: "Word Study",
      version: "1.0.0",
      panels: [{
        id: "word",
        label: "WORD",
        glyph: "Λ",
        render: function (ctx) { return React.createElement(WordStudyPanel, ctx || {}); },
      }],
      verseActions: [{
        label: "Word Study",
        icon: "Λ",
        handler: function (ctx) {
          try {
            window.dispatchEvent(new CustomEvent("codex:word-study-open", {
              detail: {
                ref: (ctx && ctx.bookId ? ctx.bookId + "." + ctx.chapter + "." + ctx.verse : ""),
                text: ctx && ctx.text,
              }
            }));
            window.dispatchEvent(new CustomEvent("codex:open-panel", {
              detail: { pluginId: "word-study", panelId: "word", ctx: ctx }
            }));
          } catch (e) {}
        }
      }]
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
