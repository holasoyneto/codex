// passage-guide.jsx
// CODEX — Passage Guide (Phase 2.3). The "Logos Passage Guide killer":
// a single-page synthesis for the current chapter that fuses every CODEX
// module (AI outline + themes + TSK cross-refs + Strong's word studies +
// gematria numerology + historical context + reels-style related reading)
// into one beautiful printed-study-sheet experience.
//
// Self-contained plugin. Registers a right-rail panel labeled "GUIDE".
// Defers to window load if the plugin API isn't ready yet.
//
// AI: one fetch per chapter, cached at codex.passage-guide.{book}.{chapter}.
// Cross-refs / word studies / numerology come synchronously from already-
// loaded modules — zero extra API cost.

(function () {
  if (typeof window === "undefined") return;
  const { useState, useEffect, useMemo, useRef, useCallback } = React;

  // ── Cache helpers ────────────────────────────────────────────────────
  const CACHE_PREFIX = "codex.passage-guide.";
  function cacheKey(bookId, chapter) {
    const lang = (window.CODEX_LANG || "en");
    const suffix = lang === "en" ? "" : "." + lang;
    return `${CACHE_PREFIX}${bookId}.${chapter}${suffix}`;
  }
  function getCached(bookId, chapter) {
    try {
      const raw = localStorage.getItem(cacheKey(bookId, chapter));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed._v === 1 && parsed.data) return parsed.data;
      return null;
    } catch { return null; }
  }
  function putCached(bookId, chapter, data) {
    try {
      localStorage.setItem(cacheKey(bookId, chapter),
        JSON.stringify({ _v: 1, data, fetchedAt: Date.now() }));
    } catch {}
  }

  // ── Tolerant JSON extraction (mirrors panels-gen smartRepair/extractJSON) ─
  function smartRepair(s) {
    let inString = false, escape = false;
    const stk = [];
    let lastSafe = 0, safeStack = [];
    const mark = (idx) => { lastSafe = idx; safeStack = stk.slice(); };
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (escape) { escape = false; continue; }
      if (inString) {
        if (c === "\\") { escape = true; continue; }
        if (c === "\"") { inString = false; mark(i + 1); }
        continue;
      }
      if (c === "\"") { inString = true; continue; }
      if (c === "{") stk.push("}");
      else if (c === "[") stk.push("]");
      else if (c === "}" || c === "]") { stk.pop(); mark(i + 1); }
      else if (c === ",") mark(i);
      else if (/[\d.eE+-]/.test(c)) mark(i + 1);
      else if (/[a-zA-Z]/.test(c)) mark(i + 1);
    }
    let head = s.slice(0, lastSafe).replace(/[,\s]+$/, "");
    head = head.replace(/,?\s*"[^"]*"\s*:\s*$/, "");
    return head + safeStack.reverse().join("");
  }
  function extractJSON(text) {
    if (!text) throw new Error("empty response");
    let s = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const i = s.indexOf("{");
    const j = s.lastIndexOf("}");
    if (i === -1) throw new Error("no json object found");
    let candidate = j > i ? s.slice(i, j + 1) : s.slice(i);
    try { return JSON.parse(candidate); } catch (_) {}
    try { return JSON.parse(smartRepair(s.slice(i))); }
    catch (e) {
      try { return JSON.parse(smartRepair(candidate)); }
      catch (e2) { throw new Error("could not repair JSON: " + e2.message); }
    }
  }
  function validate(obj) {
    if (!obj || typeof obj !== "object") throw new Error("not an object");
    obj._schema = 1;
    obj.overview = obj.overview || "";
    obj.outline  = Array.isArray(obj.outline) ? obj.outline.slice(0, 8) : [];
    obj.themes   = Array.isArray(obj.themes) ? obj.themes.slice(0, 8) : [];
    obj.key_words = Array.isArray(obj.key_words) ? obj.key_words.slice(0, 8) : [];
    obj.historical_context = obj.historical_context || "";
    obj.synthesis = obj.synthesis || "";
    obj.outline = obj.outline.filter(s => s && (s.title || s.summary));
    obj.themes  = obj.themes.filter(t => t && t.name);
    obj.key_words = obj.key_words.filter(w => w && w.word);
    return obj;
  }

  // ── Prompt ───────────────────────────────────────────────────────────
  const PROMPT_SYSTEM = `You are the CODEX PASSAGE GUIDE drafter. For one Bible chapter, produce a compact JSON object that fuses outline, themes, key word studies, historical context, and a one-paragraph synthesis. Scholarly, multi-tradition, never proselytising.

OUTPUT FORMAT — RETURN ONLY a single JSON object, no prose, no fences:

{
  "_schema": 1,
  "overview": "ONE sentence — under 25 words — capturing the chapter's heart.",
  "outline": [   // 4-6 entries that partition the chapter sequentially
    { "title": "4-7 word section title", "range": "1-11", "summary": "30-50 words of what happens in this section" }
  ],
  "themes": [   // 4-6 entries
    { "name": "1-3 word theme (e.g. 'No condemnation')", "verse_anchor": <int — the single verse most representative> }
  ],
  "key_words": [   // exactly 5 — the most significant original-language words
    { "word": "english gloss", "original": "Hebrew/Greek native script", "translit": "english transliteration", "verse_anchor": <int>, "strongs": "G3056 or H1234" }
  ],
  "historical_context": "2-3 sentences of historical-cultural setting that illuminate the chapter.",
  "synthesis": "ONE beautiful paragraph (60-100 words) that weaves outline + themes + words + context into a single arc — what this chapter is really doing."
}

Rules:
- All verse_anchor values must be real verses in the chapter.
- Strong's numbers: real ones from your training (G#### for Greek NT, H#### for Hebrew OT). If genuinely unsure, omit the field.
- Calm scholarly tone. No exclamations. No emoji.
- Return ONLY the JSON. Stay compact.`;

  const inflight = new Map();
  async function fetchGuide(bookId, chapter, bookName, opts = {}) {
    const key = cacheKey(bookId, chapter);
    const cached = !opts.force && getCached(bookId, chapter);
    if (cached) return cached;
    if (inflight.has(key)) return inflight.get(key);

    const langName = (window.codexLangName && window.codexLangName()) || "English";
    const langDirective = langName === "English"
      ? ""
      : `\n\nLANGUAGE: All human-readable STRING values (overview, titles, summaries, theme names, glosses, historical_context, synthesis) MUST be written in ${langName}. Keep native-script terms (Hebrew/Greek) and their transliterations as-is. Keep Strong's IDs in English.`;

    const userMsg = `Draft the CODEX Passage Guide for: ${bookName} ${chapter}.
Return ONLY the JSON object as specified.${langDirective}`;

    const p = (async () => {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: PROMPT_SYSTEM + langDirective,
          messages: [{ role: "user", content: userMsg }],
          max_tokens: 2200,
          provider: opts.provider,
          model: opts.model,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `passage-guide HTTP ${r.status}`);
      const parsed = validate(extractJSON(data.text || ""));
      parsed._provider = data.provider || opts.provider || "anthropic";
      parsed._model = data.model || opts.model || null;
      putCached(bookId, chapter, parsed);
      return parsed;
    })().finally(() => { inflight.delete(key); });

    inflight.set(key, p);
    return p;
  }

  // ── Kabbalah mapping loader (cached on window) ───────────────────────
  function useKabbalahMap() {
    const [m, setM] = useState(() => (typeof window !== "undefined" ? window.__CODEX_KAB__ : null) || null);
    useEffect(() => {
      if (m) return;
      let alive = true;
      fetch("data/modules/kabbalah-mappings.json")
        .then(r => r.ok ? r.json() : null)
        .then(j => { if (alive && j) { window.__CODEX_KAB__ = j; setM(j); } })
        .catch(() => {});
      return () => { alive = false; };
    }, [m]);
    return m;
  }

  // ── Helpers ──────────────────────────────────────────────────────────
  function navigateTo(bookId, bookName, chapter, verse) {
    try {
      if (typeof window.codexJumpToRef === "function") {
        window.codexJumpToRef(`${bookName || bookId} ${chapter}${verse ? ":" + verse : ""}`);
        return;
      }
      window.dispatchEvent(new CustomEvent("codex:navigate", {
        detail: { book: bookName || bookId, bookId, chapter, verse: verse || undefined },
      }));
    } catch {}
  }
  function openStrongs(strongsId) {
    if (!strongsId) return;
    try {
      window.dispatchEvent(new CustomEvent("codex:strongs-open", { detail: { strongs: strongsId } }));
      window.dispatchEvent(new CustomEvent("codex:open-panel", {
        detail: { pluginId: "strongs-concordance", panelId: "strongs", ctx: { strongs: strongsId } },
      }));
    } catch {}
  }
  function openMap(bookId, bookName, chapter) {
    try {
      window.dispatchEvent(new CustomEvent("codex:open-map", {
        detail: { bookId, book: bookName, chapter },
      }));
      window.dispatchEvent(new CustomEvent("codex:open-panel", {
        detail: { pluginId: "verse-map", panelId: "map", ctx: { bookId, book: bookName, chapter } },
      }));
    } catch {}
  }

  // Parse a TSK ref-string like "jhn.3.16" → { bookId, chapter, verse }
  function parseRefKey(key) {
    if (typeof key !== "string") return null;
    const parts = key.split(".");
    if (parts.length < 2) return null;
    const bookId = parts[0].toLowerCase();
    const chapter = parseInt(parts[1], 10);
    const verse = parts[2] ? parseInt(parts[2], 10) : null;
    if (!bookId || !Number.isFinite(chapter)) return null;
    return { bookId, chapter, verse };
  }

  // ── Hook: gather cross-refs for the WHOLE chapter ────────────────────
  function useChapterCrossRefs(bookId, chapter) {
    const [refs, setRefs] = useState([]);
    useEffect(() => {
      let alive = true;
      const lookup = window.CODEX_CrossRefLookup;
      if (!lookup || typeof lookup.getCrossRefs !== "function") return;
      // Sample verses 1..30 (TSK sample is sparse — we just grab whatever exists)
      const verses = Array.from({ length: 30 }, (_, i) => i + 1);
      Promise.all(verses.map(v =>
        lookup.getCrossRefs(`${bookId}.${chapter}.${v}`)
          .then(arr => (arr || []).map(x => ({ ...x, from: v })))
          .catch(() => [])
      )).then(buckets => {
        if (!alive) return;
        const flat = [].concat.apply([], buckets);
        // Dedupe by ref string
        const seen = new Set();
        const out = [];
        for (const r of flat) {
          if (!r || !r.ref) continue;
          if (seen.has(r.ref)) continue;
          seen.add(r.ref);
          out.push(r);
          if (out.length >= 10) break;
        }
        setRefs(out);
      });
      return () => { alive = false; };
    }, [bookId, chapter]);
    return refs;
  }

  // ── Hook: scan the chapter's gematria for significant values ─────────
  function useNumerologySnapshot(bookId, chapter, kabMap) {
    const [hits, setHits] = useState([]);
    useEffect(() => {
      if (!kabMap || !kabMap.value_to_concept) { setHits([]); return; }
      const idx = window.CODEX_GEMATRIA_INDEX;
      if (!idx) { setHits([]); return; }
      let alive = true;
      const significant = Object.keys(kabMap.value_to_concept)
        .map(n => parseInt(n, 10)).filter(Number.isFinite);
      (async () => {
        try { if (typeof idx.ensure === "function") await idx.ensure(); } catch {}
        if (!alive) return;
        const out = [];
        const seenValues = new Set();
        for (const value of significant) {
          if (out.length >= 3) break;
          if (seenValues.has(value)) continue;
          let matches = [];
          try { matches = idx.find(value) || []; } catch {}
          const inChapter = matches.filter(m => {
            const p = parseRefKey(m.ref);
            return p && p.bookId === bookId && p.chapter === chapter;
          });
          if (inChapter.length) {
            seenValues.add(value);
            out.push({
              value,
              concept: kabMap.value_to_concept[String(value)],
              match: inChapter[0],
            });
          }
        }
        if (alive) setHits(out);
      })();
      return () => { alive = false; };
    }, [bookId, chapter, kabMap]);
    return hits;
  }

  // ── Related reading: pull from reels-curated by book ────────────────
  function useRelatedReading(bookId, chapter) {
    const [related, setRelated] = useState([]);
    useEffect(() => {
      let alive = true;
      const finish = (arr) => { if (alive) setRelated(arr.slice(0, 3)); };
      // Try reels-curated module via CODEX_MODULES, then fall back to direct fetch
      (async () => {
        let mod = null;
        try {
          if (window.CODEX_MODULES && window.CODEX_MODULES.loadModule) {
            mod = await window.CODEX_MODULES.loadModule("reels-curated");
          }
        } catch {}
        if (!mod) {
          try {
            const r = await fetch("data/modules/reels-curated.json");
            if (r.ok) mod = await r.json();
          } catch {}
        }
        if (!mod) return finish([]);
        const cards = mod.cards || mod.entries || [];
        if (!Array.isArray(cards)) return finish([]);
        // Prefer cards anchored on a different chapter of the same book,
        // then anything in the same book, then anything at all.
        const sameBookOther = cards.filter(c =>
          c && (c.bookId === bookId || (typeof c.ref === "string" && c.ref.toLowerCase().startsWith(bookId + ".")))
          && c.chapter !== chapter);
        const others = cards.filter(c => c && !sameBookOther.includes(c));
        finish([...sameBookOther, ...others]);
      })();
      return () => { alive = false; };
    }, [bookId, chapter]);
    return related;
  }

  // ── Section primitives ───────────────────────────────────────────────
  function Skeleton({ lines = 3 }) {
    return React.createElement("div", { className: "cx-pg-skeleton" },
      Array.from({ length: lines }, (_, i) =>
        React.createElement("div", { key: i, className: "cx-pg-skel-line", style: { width: (60 + ((i * 17) % 35)) + "%" } })
      )
    );
  }

  function Section({ id, title, kind, defaultOpen = true, children }) {
    const [open, setOpen] = useState(defaultOpen);
    return React.createElement("section", { className: "cx-pg-section", id },
      React.createElement("header", {
        className: "cx-pg-sec-head", onClick: () => setOpen(o => !o),
        role: "button", tabIndex: 0,
        "aria-expanded": open,
        onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(o => !o); } },
      },
        React.createElement("span", { className: "cx-pg-sec-kind" }, kind),
        React.createElement("h3", { className: "cx-pg-sec-title" }, title),
        React.createElement("span", { className: "cx-pg-sec-chev", "aria-hidden": true }, open ? "−" : "+")
      ),
      open ? React.createElement("div", { className: "cx-pg-sec-body" }, children) : null
    );
  }

  // ── Main component ───────────────────────────────────────────────────
  function PassageGuide(ctx) {
    const { book, bookId, chapter, translation } = ctx || {};
    const kabMap = useKabbalahMap();
    const [guide, setGuide] = useState(() => bookId ? getCached(bookId, chapter) : null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const reqIdRef = useRef(0);

    // Fetch / load guide whenever chapter changes
    useEffect(() => {
      if (!bookId || !chapter) return;
      const cached = getCached(bookId, chapter);
      if (cached) { setGuide(cached); setLoading(false); setError(""); return; }
      setGuide(null); setError("");
      setLoading(true);
      const my = ++reqIdRef.current;
      fetchGuide(bookId, chapter, book || bookId)
        .then(data => { if (my === reqIdRef.current) { setGuide(data); setLoading(false); } })
        .catch(err => {
          if (my !== reqIdRef.current) return;
          setError(err.message || String(err));
          setLoading(false);
        });
    }, [bookId, chapter, book]);

    const verseCount = useMemo(() => {
      try {
        const ch = window.BIBLE && window.BIBLE.getCachedChapter
          ? window.BIBLE.getCachedChapter(bookId, chapter, translation || "kjv")
          : null;
        if (ch && Array.isArray(ch.verses)) return ch.verses.length;
      } catch {}
      return null;
    }, [bookId, chapter, translation, guide]);

    const crossRefs = useChapterCrossRefs(bookId, chapter);
    const numerology = useNumerologySnapshot(bookId, chapter, kabMap);
    const related = useRelatedReading(bookId, chapter);

    const hasStrongs = !!window.CODEX_StrongsLookup;

    const regenerate = useCallback(() => {
      if (!bookId || !chapter) return;
      try { localStorage.removeItem(cacheKey(bookId, chapter)); } catch {}
      setGuide(null); setError(""); setLoading(true);
      const my = ++reqIdRef.current;
      fetchGuide(bookId, chapter, book || bookId, { force: true })
        .then(data => { if (my === reqIdRef.current) { setGuide(data); setLoading(false); } })
        .catch(err => {
          if (my !== reqIdRef.current) return;
          setError(err.message || String(err));
          setLoading(false);
        });
    }, [bookId, chapter, book]);

    if (!bookId || !chapter) {
      return React.createElement("div", { className: "cx-pg-empty" }, "Open a chapter to see its Passage Guide.");
    }

    // ── Hero ───────────────────────────────────────────────────────────
    const hero = React.createElement("header", { className: "cx-pg-hero" },
      React.createElement("div", { className: "cx-pg-hero-meta" },
        React.createElement("span", { className: "cx-pg-hero-cat" }, "❖ PASSAGE GUIDE"),
        React.createElement("span", { className: "cx-pg-hero-dot" }, "·"),
        React.createElement("span", null, `${book || bookId} ${chapter}`),
        verseCount ? [
          React.createElement("span", { key: "d", className: "cx-pg-hero-dot" }, "·"),
          React.createElement("span", { key: "v" }, `${verseCount} verses`),
        ] : null
      ),
      React.createElement("h2", { className: "cx-pg-hero-title" }, `${book || bookId} ${chapter}`),
      guide && guide.overview
        ? React.createElement("p", { className: "cx-pg-hero-overview" }, guide.overview)
        : (loading ? React.createElement(Skeleton, { lines: 2 }) : null),
      React.createElement("div", { className: "cx-pg-hero-rule" }),
      React.createElement("div", { className: "cx-pg-hero-actions" },
        React.createElement("button", {
          className: "cx-pg-btn", onClick: regenerate,
          disabled: loading,
          title: loading ? "Generating…" : "Regenerate Passage Guide",
        }, loading ? "Generating…" : (guide ? "↻ Regenerate" : "Generate")),
        guide && guide._provider
          ? React.createElement("span", { className: "cx-pg-prov" }, `via ${guide._provider}`)
          : null
      )
    );

    // ── Outline ────────────────────────────────────────────────────────
    const outlineSection = React.createElement(Section, { id: "outline", kind: "I", title: "Outline" },
      loading && !guide ? React.createElement(Skeleton, { lines: 4 }) :
      guide && guide.outline && guide.outline.length
        ? React.createElement("ol", { className: "cx-pg-outline" },
            guide.outline.map((s, i) => {
              const firstV = (() => {
                const m = String(s.range || "").match(/^(\d+)/);
                return m ? parseInt(m[1], 10) : null;
              })();
              return React.createElement("li", {
                key: i, className: "cx-pg-outline-item",
                onClick: () => firstV && navigateTo(bookId, book, chapter, firstV),
                role: firstV ? "button" : undefined, tabIndex: firstV ? 0 : undefined,
              },
                React.createElement("div", { className: "cx-pg-outline-head" },
                  React.createElement("span", { className: "cx-pg-outline-title" }, s.title || `Section ${i + 1}`),
                  s.range ? React.createElement("span", { className: "cx-pg-outline-range" }, `v${s.range}`) : null
                ),
                s.summary ? React.createElement("p", { className: "cx-pg-outline-sum" }, s.summary) : null
              );
            })
          )
        : React.createElement("p", { className: "cx-pg-muted" }, "No outline yet.")
    );

    // ── Themes ─────────────────────────────────────────────────────────
    const themesSection = React.createElement(Section, { id: "themes", kind: "II", title: "Key Themes" },
      loading && !guide ? React.createElement(Skeleton, { lines: 2 }) :
      guide && guide.themes && guide.themes.length
        ? React.createElement("div", { className: "cx-pg-themes" },
            guide.themes.map((t, i) =>
              React.createElement("button", {
                key: i, className: "cx-pg-theme",
                onClick: () => t.verse_anchor && navigateTo(bookId, book, chapter, t.verse_anchor),
                title: t.verse_anchor ? `Jump to verse ${t.verse_anchor}` : "",
              },
                React.createElement("span", { className: "cx-pg-theme-name" }, t.name),
                t.verse_anchor ? React.createElement("span", { className: "cx-pg-theme-anchor" }, `v${t.verse_anchor}`) : null
              )
            )
          )
        : React.createElement("p", { className: "cx-pg-muted" }, "No themes yet.")
    );

    // ── Cross-references ───────────────────────────────────────────────
    const xrefFmt = (window.CODEX_CrossRefLookup && window.CODEX_CrossRefLookup.formatRef) || (k => k);
    const xrefSection = React.createElement(Section, { id: "xrefs", kind: "III", title: "Top Cross-References" },
      crossRefs.length
        ? (() => {
            // Group by theme when present
            const byTheme = new Map();
            for (const r of crossRefs) {
              const k = r.theme || "Parallels";
              if (!byTheme.has(k)) byTheme.set(k, []);
              byTheme.get(k).push(r);
            }
            return React.createElement("div", { className: "cx-pg-xrefs" },
              Array.from(byTheme.entries()).map(([theme, arr], i) =>
                React.createElement("div", { key: i, className: "cx-pg-xref-group" },
                  React.createElement("div", { className: "cx-pg-xref-theme" }, theme),
                  React.createElement("ul", { className: "cx-pg-xref-list" },
                    arr.map((r, j) => {
                      const p = parseRefKey(r.ref);
                      return React.createElement("li", { key: j },
                        React.createElement("button", {
                          className: "cx-pg-xref-btn",
                          onClick: () => p && navigateTo(p.bookId, null, p.chapter, p.verse),
                          title: "Navigate",
                        }, xrefFmt(r.ref)),
                        r.from ? React.createElement("span", { className: "cx-pg-xref-from" }, `from v${r.from}`) : null
                      );
                    })
                  )
                )
              )
            );
          })()
        : React.createElement("p", { className: "cx-pg-muted" },
            window.CODEX_CrossRefLookup
              ? "No TSK entries for this chapter in the sample set."
              : "Cross-reference module not loaded.")
    );

    // ── Word studies ───────────────────────────────────────────────────
    const wordsSection = React.createElement(Section, { id: "words", kind: "IV", title: "Word Studies" },
      loading && !guide ? React.createElement(Skeleton, { lines: 3 }) :
      guide && guide.key_words && guide.key_words.length
        ? React.createElement("ul", { className: "cx-pg-words" },
            guide.key_words.map((w, i) => {
              const entry = (hasStrongs && w.strongs) ? window.CODEX_StrongsLookup(w.strongs) : null;
              const clickable = !!(hasStrongs && w.strongs);
              return React.createElement("li", { key: i, className: "cx-pg-word" },
                React.createElement("div", { className: "cx-pg-word-head" },
                  w.original ? React.createElement("span", { className: "cx-pg-word-orig", lang: "he" }, w.original) : null,
                  React.createElement("span", { className: "cx-pg-word-translit" }, w.translit || ""),
                  w.strongs ? React.createElement("button", {
                    className: "cx-pg-word-strongs",
                    disabled: !clickable,
                    onClick: () => openStrongs(w.strongs),
                    title: clickable ? "Open Strong's entry" : "Strong's lexicon not loaded",
                  }, w.strongs) : null,
                  w.verse_anchor ? React.createElement("button", {
                    className: "cx-pg-word-anchor",
                    onClick: () => navigateTo(bookId, book, chapter, w.verse_anchor),
                    title: "Jump to verse",
                  }, `v${w.verse_anchor}`) : null
                ),
                React.createElement("div", { className: "cx-pg-word-gloss" },
                  React.createElement("b", null, w.word || ""),
                  entry && entry.gloss ? React.createElement("span", { className: "cx-pg-word-lex" }, " — " + entry.gloss) :
                  entry && entry.definition ? React.createElement("span", { className: "cx-pg-word-lex" }, " — " + entry.definition) :
                  null
                )
              );
            })
          )
        : React.createElement("p", { className: "cx-pg-muted" }, "No words yet.")
    );

    // ── Numerology ────────────────────────────────────────────────────
    const numerologySection = numerology.length
      ? React.createElement(Section, { id: "numerology", kind: "V", title: "Numerology Snapshot", defaultOpen: true },
          React.createElement("ul", { className: "cx-pg-num" },
            numerology.map((n, i) => {
              const p = parseRefKey(n.match.ref);
              return React.createElement("li", { key: i, className: "cx-pg-num-row" },
                React.createElement("div", { className: "cx-pg-num-val" }, n.value),
                React.createElement("div", { className: "cx-pg-num-body" },
                  React.createElement("div", { className: "cx-pg-num-concept" }, n.concept && n.concept.concept ? n.concept.concept : "—"),
                  React.createElement("div", { className: "cx-pg-num-cite" },
                    React.createElement("button", {
                      className: "cx-pg-link",
                      onClick: () => p && navigateTo(p.bookId, book, p.chapter, p.verse),
                    }, `${book || bookId} ${p ? p.chapter + ":" + (p.verse || "?") : ""}`),
                    n.match.word ? React.createElement("span", { className: "cx-pg-num-word", lang: "he" }, ` — ${n.match.word}`) : null,
                    n.match.system ? React.createElement("span", { className: "cx-pg-num-sys" }, ` (${n.match.system})`) : null
                  )
                )
              );
            })
          )
        )
      : null;

    // ── Historical context ────────────────────────────────────────────
    const historySection = React.createElement(Section, { id: "history", kind: "VI", title: "Historical Context" },
      loading && !guide ? React.createElement(Skeleton, { lines: 2 }) :
      guide && guide.historical_context
        ? React.createElement("p", { className: "cx-pg-prose" }, guide.historical_context)
        : React.createElement("p", { className: "cx-pg-muted" }, "—")
    );

    // ── Geography link ────────────────────────────────────────────────
    const geographySection = React.createElement(Section, { id: "geo", kind: "VII", title: "Geography" },
      React.createElement("p", { className: "cx-pg-prose" },
        "Named places in this chapter can be explored on the map. ",
        React.createElement("button", {
          className: "cx-pg-link",
          onClick: () => openMap(bookId, book, chapter),
        }, "Open verse-map →")
      )
    );

    // ── Synthesis ─────────────────────────────────────────────────────
    const synthesisSection = React.createElement(Section, { id: "synthesis", kind: "VIII", title: "Synthesis" },
      loading && !guide ? React.createElement(Skeleton, { lines: 4 }) :
      guide && guide.synthesis
        ? React.createElement("p", { className: "cx-pg-prose cx-pg-synth" }, guide.synthesis)
        : React.createElement("p", { className: "cx-pg-muted" }, "—")
    );

    // ── Related reading ───────────────────────────────────────────────
    const relatedSection = related.length
      ? React.createElement(Section, { id: "related", kind: "IX", title: "Related Reading" },
          React.createElement("div", { className: "cx-pg-related" },
            related.map((c, i) => {
              const ref = c.ref || `${c.bookId || ""}.${c.chapter || ""}`;
              const p = typeof ref === "string" ? parseRefKey(ref) : null;
              const label = c.title || (p ? `${p.bookId} ${p.chapter}${p.verse ? ":" + p.verse : ""}` : ref);
              return React.createElement("button", {
                key: i, className: "cx-pg-related-card",
                onClick: () => p && navigateTo(p.bookId, null, p.chapter, p.verse),
              },
                React.createElement("div", { className: "cx-pg-related-label" }, label),
                c.summary || c.note
                  ? React.createElement("div", { className: "cx-pg-related-sum" }, c.summary || c.note)
                  : null
              );
            })
          )
        )
      : null;

    return React.createElement("div", { className: "cx-pg" },
      hero,
      error ? React.createElement("div", { className: "cx-pg-error" }, "Could not generate guide: " + error) : null,
      outlineSection,
      themesSection,
      xrefSection,
      wordsSection,
      numerologySection,
      historySection,
      geographySection,
      synthesisSection,
      relatedSection,
      React.createElement("footer", { className: "cx-pg-foot" },
        "CODEX Passage Guide · cached locally · regenerate to refresh"
      )
    );
  }

  window.CODEX_PassageGuide = PassageGuide;

  // ── Plugin registration ──────────────────────────────────────────────
  function doRegister() {
    if (!window.CODEX_PLUGINS_API || typeof window.CODEX_PLUGINS_API.register !== "function") return false;
    return window.CODEX_PLUGINS_API.register({
      id: "passage-guide",
      name: "Passage Guide",
      version: "1.0.0",
      panels: [{
        id: "guide",
        label: "GUIDE",
        glyph: "❖",
        render(ctx) { return React.createElement(PassageGuide, ctx); },
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
