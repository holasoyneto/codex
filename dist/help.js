// GENERATED from help.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
// help.jsx
// CODEX Help Wiki — searchable, AI-augmented, multilingual documentation.
//
// Lives inside the Settings/Tweaks panel. Driven by data/help/articles.json
// so non-engineers can ship doc updates with a release. Modes:
//
//   1. Browse — category cards + accordion, all articles listed.
//   2. Predictive search — substring/tag/title match as you type (top 5)
//      with snippet preview and matched-term highlighting.
//   3. Ask Oracle — submit free-form question, POST to /api/chat with the
//      whole help corpus stuffed into the user turn.
//   4. Translate ▾ — in the article view, on-demand AI translation into any
//      of the languages registered in i18n.js.
//
// Visual layer: serif hero titles, drop-caps, numbered sections, pull-quote
// blockquotes, copy-to-clipboard code blocks, scroll-progress bar, related
// articles, prev/next navigation. See styles.css "Help Wiki — Beauty Pass".

(function () {
  const { useState, useEffect, useMemo, useRef, useCallback } = React;

  // ── Supported translation targets ─────────────────────────────────────
  function getSupportedLangs() {
    const fallback = [
    { code: "es", label: "Español" },
    { code: "de", label: "Deutsch" },
    { code: "pt", label: "Português" },
    { code: "fr", label: "Français" },
    { code: "la", label: "Latina" },
    { code: "he", label: "עברית" },
    { code: "el", label: "Ἑλληνική" },
    { code: "hi", label: "हिन्दी" }];

    const src = typeof window !== "undefined" && Array.isArray(window.CODEX_LANGS) ?
    window.CODEX_LANGS : null;
    if (!src) return fallback;
    return src.
    filter((l) => l && l.id && l.id !== "en").
    map((l) => ({ code: l.id, label: l.label || l.id }));
  }
  const SUPPORTED_LANGS = getSupportedLangs();

  const LANG_NAME = {
    es: "Spanish", de: "German", pt: "Portuguese", fr: "French",
    la: "Latin", he: "Hebrew", el: "Greek", hi: "Hindi"
  };

  // Category metadata — icon + 1-line description. Falls back gracefully
  // if articles.json adds a category we don't yet have art for.
  const CATEGORY_META = {
    "Basics": { icon: "🜨", blurb: "Get oriented. The shortest path to reading scripture in CODEX." },
    "Reading": { icon: "📜", blurb: "Typography, themes, translations, side-by-side, theater mode." },
    "Study Tools": { icon: "⌖", blurb: "Verse menu, maps, art, mirrors, marks, notes, cross-refs, quests." },
    "AI Features": { icon: "✦", blurb: "Oracle, panels, reels — AI as a humble study companion." },
    "Power User": { icon: "⌘", blurb: "Offline, shortcuts, sync, custom repos, terminal CLI." },
    "Audience-Specific": { icon: "◊", blurb: "Setups tuned for Jewish readers, academics, and more." },
    "About": { icon: "ℵ", blurb: "Vision, privacy, troubleshooting. The story behind CODEX." },
    "Developer": { icon: "⚙", blurb: "Plugins, data modules, the extension surface." }
  };
  const catMeta = (c) => CATEGORY_META[c] || { icon: "✧", blurb: "" };

  function currentUiLang() {
    try {
      if (typeof window !== "undefined" && window.CODEX_LANG) return window.CODEX_LANG;
      const ls = localStorage.getItem("codex.lang");
      if (ls) return ls;
    } catch {}
    return "en";
  }

  const TR_KEY = (id, lang) => `codex.help.tr.${id}.${lang}`;
  const TR_TITLE_KEY = (id, lang) => `codex.help.tr.${id}.${lang}.title`;

  function readTrCache(id, lang) {
    try {
      const body = localStorage.getItem(TR_KEY(id, lang));
      const title = localStorage.getItem(TR_TITLE_KEY(id, lang));
      if (body) return { body, title: title || null };
    } catch {}
    return null;
  }
  function writeTrCache(id, lang, body, title) {
    try {
      localStorage.setItem(TR_KEY(id, lang), body);
      if (title) localStorage.setItem(TR_TITLE_KEY(id, lang), title);
    } catch {}
  }
  function cachedLangsFor(id) {
    const out = [];
    for (const l of SUPPORTED_LANGS) {
      try {
        if (localStorage.getItem(TR_KEY(id, l.code))) out.push(l.code);
      } catch {}
    }
    return out;
  }

  // ── Markdown renderer ──────────────────────────────────────────────────
  // Adds: blockquotes (rendered as pull quotes), fenced code blocks with a
  // copy button, auto-numbered <h2> sections via CSS counters.
  function escapeHtml(s) {
    return String(s).
    replace(/&/g, "&amp;").
    replace(/</g, "&lt;").
    replace(/>/g, "&gt;").
    replace(/"/g, "&quot;").
    replace(/'/g, "&#39;");
  }

  function inlineMd(s) {
    const codes = [];
    s = s.replace(/`([^`]+)`/g, (_, c) => {
      codes.push(c);
      return ` C${codes.length - 1} `;
    });
    s = escapeHtml(s);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_, t, u) => {
      // Block javascript: and data: URIs — prevent XSS via markdown links
      const lc = u.toLowerCase().replace(/[\s\x00-\x1f]/g, "");
      if (/^(javascript|data|vbscript):/i.test(lc)) return t;
      return `<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">${t}</a>`;
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    s = s.replace(/ C(\d+) /g, (_, i) => `<code>${escapeHtml(codes[+i])}</code>`);
    return s;
  }

  function renderMarkdown(md) {
    const lines = String(md || "").split(/\r?\n/);
    const out = [];
    let para = [];
    let list = null;
    let quote = null;
    let fence = null; // { lang, lines: [] }

    const flushPara = () => {
      if (para.length) {
        out.push(`<p>${inlineMd(para.join(" "))}</p>`);
        para = [];
      }
    };
    const flushList = () => {
      if (list) {
        out.push(`<${list.tag}>${list.items.map((i) => `<li>${inlineMd(i)}</li>`).join("")}</${list.tag}>`);
        list = null;
      }
    };
    const flushQuote = () => {
      if (quote) {
        out.push(`<blockquote class="cx-help-quote">${inlineMd(quote.join(" "))}</blockquote>`);
        quote = null;
      }
    };

    for (const raw of lines) {
      const line = raw.trimEnd();

      // Fenced code block
      const fmatch = line.match(/^```(\w*)\s*$/);
      if (fmatch) {
        if (fence) {
          const code = fence.lines.join("\n");
          out.push(
            `<div class="cx-help-code"><button class="cx-help-code-copy" data-copy="${escapeHtml(code)}" aria-label="Copy code">⎘ copy</button><pre><code>${escapeHtml(code)}</code></pre></div>`
          );
          fence = null;
        } else {
          flushPara();flushList();flushQuote();
          fence = { lang: fmatch[1] || "", lines: [] };
        }
        continue;
      }
      if (fence) {fence.lines.push(raw);continue;}

      if (!line.trim()) {flushPara();flushList();flushQuote();continue;}
      let m;
      if (m = line.match(/^>\s?(.*)$/)) {
        flushPara();flushList();
        if (!quote) quote = [];
        quote.push(m[1]);
        continue;
      } else {flushQuote();}

      if (m = line.match(/^#{3}\s+(.*)$/)) {flushPara();flushList();out.push(`<h3>${inlineMd(m[1])}</h3>`);continue;}
      if (m = line.match(/^##\s+(.*)$/)) {flushPara();flushList();out.push(`<h2>${inlineMd(m[1])}</h2>`);continue;}
      if (m = line.match(/^#\s+(.*)$/)) {flushPara();flushList();out.push(`<h1>${inlineMd(m[1])}</h1>`);continue;}
      if (m = line.match(/^\s*[-*]\s+(.*)$/)) {
        flushPara();
        if (!list || list.tag !== "ul") {flushList();list = { tag: "ul", items: [] };}
        list.items.push(m[1]);continue;
      }
      if (m = line.match(/^\s*\d+\.\s+(.*)$/)) {
        flushPara();
        if (!list || list.tag !== "ol") {flushList();list = { tag: "ol", items: [] };}
        list.items.push(m[1]);continue;
      }
      para.push(line.trim());
    }
    flushPara();flushList();flushQuote();
    if (fence) {
      const code = fence.lines.join("\n");
      out.push(`<div class="cx-help-code"><button class="cx-help-code-copy" data-copy="${escapeHtml(code)}" aria-label="Copy code">⎘ copy</button><pre><code>${escapeHtml(code)}</code></pre></div>`);
    }
    return out.join("\n");
  }

  // Snippet around the first occurrence of a query, with the match wrapped
  // in a styled span so we can underline it (no garish <mark>).
  function makeSnippet(body, q, max = 140) {
    const text = String(body || "").replace(/[#*`>\-]+/g, " ").replace(/\s+/g, " ").trim();
    if (!q) return text.slice(0, max) + (text.length > max ? "…" : "");
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return text.slice(0, max) + (text.length > max ? "…" : "");
    const start = Math.max(0, i - 40);
    const end = Math.min(text.length, i + q.length + 80);
    const pre = (start > 0 ? "…" : "") + text.slice(start, i);
    const hit = text.slice(i, i + q.length);
    const post = text.slice(i + q.length, end) + (end < text.length ? "…" : "");
    return `${escapeHtml(pre)}<span class="cx-help-hl">${escapeHtml(hit)}</span>${escapeHtml(post)}`;
  }

  // ── Fuzzy ranking ──────────────────────────────────────────────────────
  function scoreArticle(art, q) {
    if (!q) return 0;
    const Q = q.toLowerCase();
    const title = (art.title || "").toLowerCase();
    const tags = (art.tags || []).join(" ").toLowerCase();
    let body = (art.body || "").toLowerCase();
    for (const l of SUPPORTED_LANGS) {
      const c = readTrCache(art.id, l.code);
      if (c) {
        body += " " + (c.body || "").toLowerCase();
        if (c.title) body += " " + c.title.toLowerCase();
      }
    }
    let s = 0;
    const ti = title.indexOf(Q);
    if (ti === 0) s += 1000;else
    if (ti > 0) s += 600 - Math.min(ti, 200);
    const gi = tags.indexOf(Q);
    if (gi >= 0) s += 300 - Math.min(gi, 100);
    const bi = body.indexOf(Q);
    if (bi >= 0) s += 80 - Math.min(bi / 20, 60);
    if (new RegExp(`\\b${Q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(title)) s += 200;
    return s;
  }

  // ── Translation request ────────────────────────────────────────────────
  async function translateArticle(article, langCode) {
    const langName = LANG_NAME[langCode] || langCode;
    const system =
    `You are a precise translator. Translate the user's markdown content to ${langName}. ` +
    `PRESERVE all markdown formatting exactly (headings, bold, italic, links, code, lists). ` +
    `Translate prose only. Do not add commentary. Output only the translated markdown.`;
    const titleSystem =
    `You are a precise translator. Translate the user's short title to ${langName}. ` +
    `Output only the translated title text, no quotes, no commentary.`;

    const post = (sys, content, max) => fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        system: sys,
        messages: [{ role: "user", content }],
        max_tokens: max
      })
    }).then(async (r) => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      return (data.text || "").trim();
    });

    const [body, title] = await Promise.all([
    post(system, article.body, 2000),
    post(titleSystem, article.title, 120)]
    );
    return { body, title };
  }

  // ── Skeleton shimmer used during fetch + AI translation ───────────────
  function Skeleton({ rows = 5 }) {
    const out = [];
    for (let i = 0; i < rows; i++) {
      const w = 60 + i * 17 % 35;
      out.push(/*#__PURE__*/React.createElement("div", { key: i, className: "cx-help-skel-line", style: { width: `${w}%` } }));
    }
    return /*#__PURE__*/React.createElement("div", { className: "cx-help-skel", "aria-hidden": "true" }, out);
  }

  // ── Main component ─────────────────────────────────────────────────────
  function HelpWiki() {
    const [articles, setArticles] = useState(null);
    const [error, setError] = useState(null);
    const [query, setQuery] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    const [oracleAnswer, setOracleAnswer] = useState(null);
    const [openCategories, setOpenCategories] = useState({});
    const [browseMode, setBrowseMode] = useState("cards"); // cards | list
    const [scrollPct, setScrollPct] = useState(0);
    const searchRef = useRef(null);
    const articleScrollRef = useRef(null);
    const articleBodyRef = useRef(null);

    const [currentLang, setCurrentLang] = useState(null);
    const [tr, setTr] = useState(null);
    const [trMenuOpen, setTrMenuOpen] = useState(false);
    const autoTriedRef = useRef({});

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const r = await fetch("data/help/articles.json", { cache: "default" });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const j = await r.json();
          if (!cancelled) {
            setArticles(j);
            const open = {};
            for (const c of j.categories || []) open[c] = true;
            setOpenCategories(open);
          }
        } catch (e) {
          if (!cancelled) setError(e.message || String(e));
        }
      })();
      return () => {cancelled = true;};
    }, []);

    useEffect(() => {
      const t = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }, []);

    const all = articles?.articles || [];
    const byId = useMemo(() => {
      const m = new Map();
      for (const a of all) m.set(a.id, a);
      return m;
    }, [all]);

    const predictive = useMemo(() => {
      const q = query.trim();
      if (!q || q.length < 2) return [];
      return all.
      map((a) => ({ a, s: scoreArticle(a, q) })).
      filter((x) => x.s > 0).
      sort((x, y) => y.s - x.s).
      slice(0, 5).
      map((x) => x.a);
    }, [query, all]);

    const askOracle = useCallback(async () => {
      const q = query.trim();
      if (!q || !articles) return;
      setOracleAnswer({ loading: true });
      const corpus = (articles.articles || []).map((a) => ({
        id: a.id, title: a.title, category: a.category, tags: a.tags, body: a.body
      }));
      const system = "You are the CODEX Help assistant. Answer the user's question ONLY using the help corpus provided. If the answer isn't in the corpus, say so plainly and suggest the closest related article by title. Keep answers concise (2–6 short paragraphs or a short list). Use markdown (headings, bold, lists, code spans). When you reference an article, cite it as **Article Title** in bold. Do not invent features.";
      try {
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            system,
            messages: [{
              role: "user",
              content: `Question: ${q}\n\n--- CODEX HELP CORPUS (JSON) ---\n${JSON.stringify(corpus)}`
            }],
            max_tokens: 800
          })
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
        setOracleAnswer({ loading: false, text: (data.text || "").trim() || "(Oracle returned an empty answer.)" });
      } catch (e) {
        setOracleAnswer({ loading: false, error: e.message || String(e) });
      }
    }, [query, articles]);

    const onSearchKey = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (predictive[0]) {
          // Enter always opens the top match if there is one — faster, less surprising.
          setSelectedId(predictive[0].id);
        } else if (query.trim()) {
          askOracle();
        }
      } else if (e.key === "Escape" && selectedId) {
        e.preventDefault();
        setSelectedId(null);
      }
    };

    useEffect(() => {
      setCurrentLang(null);
      setTr(null);
      setTrMenuOpen(false);
      setScrollPct(0);
      // Scroll the article container to top when navigating.
      if (articleScrollRef.current) articleScrollRef.current.scrollTop = 0;
    }, [selectedId]);

    const doTranslate = useCallback(async (article, langCode) => {
      if (!article || !langCode) return;
      setCurrentLang(langCode);
      const cached = readTrCache(article.id, langCode);
      if (cached) {
        setTr({ loading: false, body: cached.body, title: cached.title });
        return;
      }
      setTr({ loading: true });
      try {
        const { body, title } = await translateArticle(article, langCode);
        writeTrCache(article.id, langCode, body, title);
        setTr({ loading: false, body, title });
      } catch (e) {
        setTr({ loading: false, error: e.message || String(e) });
      }
    }, []);

    const selected = selectedId ? byId.get(selectedId) : null;
    useEffect(() => {
      if (!selected) return;
      if (autoTriedRef.current[selected.id]) return;
      const ui = currentUiLang();
      if (!ui || ui === "en") return;
      if (!SUPPORTED_LANGS.some((l) => l.code === ui)) return;
      autoTriedRef.current[selected.id] = true;
      doTranslate(selected, ui);
    }, [selected, doTranslate]);

    // Article scroll progress.
    useEffect(() => {
      const el = articleScrollRef.current;
      if (!el || !selected) return;
      const onScroll = () => {
        const max = el.scrollHeight - el.clientHeight;
        const pct = max > 0 ? Math.min(100, Math.max(0, el.scrollTop / max * 100)) : 0;
        setScrollPct(pct);
      };
      onScroll();
      el.addEventListener("scroll", onScroll, { passive: true });
      return () => el.removeEventListener("scroll", onScroll);
    }, [selected, tr]);

    // Wire up copy-to-clipboard on code blocks after each render.
    useEffect(() => {
      const root = articleBodyRef.current;
      if (!root) return;
      const onClick = (e) => {
        const btn = e.target.closest(".cx-help-code-copy");
        if (!btn) return;
        const txt = btn.getAttribute("data-copy") || "";
        try {
          navigator.clipboard?.writeText(txt);
          const old = btn.textContent;
          btn.textContent = "✓ copied";
          btn.classList.add("is-ok");
          setTimeout(() => {btn.textContent = old;btn.classList.remove("is-ok");}, 1400);
        } catch {}
      };
      root.addEventListener("click", onClick);
      return () => root.removeEventListener("click", onClick);
    }, [selected, tr]);

    // Prev/next within category.
    const categoryPeers = useMemo(() => {
      if (!selected) return { prev: null, next: null };
      const peers = all.filter((a) => a.category === selected.category);
      const idx = peers.findIndex((a) => a.id === selected.id);
      return {
        prev: idx > 0 ? peers[idx - 1] : null,
        next: idx >= 0 && idx < peers.length - 1 ? peers[idx + 1] : null
      };
    }, [selected, all]);

    // Related: same category, ≥1 shared tag, score by overlap.
    const related = useMemo(() => {
      if (!selected) return [];
      const myTags = new Set(selected.tags || []);
      return all.
      filter((a) => a.id !== selected.id && a.category === selected.category).
      map((a) => {
        let overlap = 0;
        for (const t of a.tags || []) if (myTags.has(t)) overlap++;
        return { a, overlap };
      }).
      filter((x) => x.overlap >= 1).
      sort((x, y) => y.overlap - x.overlap).
      slice(0, 4).
      map((x) => x.a);
    }, [selected, all]);

    // ── Renders ──────────────────────────────────────────────────────────
    if (error) {
      return (/*#__PURE__*/
        React.createElement("div", { className: "cx-help" }, /*#__PURE__*/
        React.createElement("div", { className: "cx-help-error" }, "Could not load help articles: ", error)
        ));

    }
    if (!articles) {
      return (/*#__PURE__*/
        React.createElement("div", { className: "cx-help" }, /*#__PURE__*/
        React.createElement("div", { className: "cx-help-head" }, /*#__PURE__*/
        React.createElement("div", { className: "cx-help-title" }, "HELP & DOCS"), /*#__PURE__*/
        React.createElement("div", { className: "cx-help-sub" }, "Loading manual\u2026")
        ), /*#__PURE__*/
        React.createElement(Skeleton, { rows: 8 })
        ));

    }

    // ── Selected article view ─────────────────────────────────────────────
    if (selected) {
      const showingTranslated = currentLang && tr && !tr.loading && !tr.error && tr.body;
      const displayTitle = showingTranslated && tr.title ? tr.title : selected.title;
      const displayBody = showingTranslated ? tr.body : selected.body;
      const activeLangLabel = currentLang ?
      SUPPORTED_LANGS.find((l) => l.code === currentLang)?.label || currentLang :
      null;
      const lastUpdated = selected.lastUpdated || articles.updated;
      const icon = catMeta(selected.category).icon;

      return (/*#__PURE__*/
        React.createElement("div", { className: "cx-help cx-help-reading" }, /*#__PURE__*/

        React.createElement("div", { className: "cx-help-progress", "aria-hidden": "true" }, /*#__PURE__*/
        React.createElement("div", { className: "cx-help-progress-bar", style: { width: `${scrollPct}%` } })
        ), /*#__PURE__*/

        React.createElement("div", { className: "cx-help-bar" }, /*#__PURE__*/
        React.createElement("button", { className: "cx-help-back", onClick: () => setSelectedId(null), "aria-label": "Back to help index" }, "\u2190 BACK"

        ), /*#__PURE__*/
        React.createElement("div", { className: "cx-help-nav-pair", "aria-label": "Walk through category" }, /*#__PURE__*/
        React.createElement("button", {
          className: "cx-help-nav-btn",
          disabled: !categoryPeers.prev,
          onClick: () => categoryPeers.prev && setSelectedId(categoryPeers.prev.id),
          title: categoryPeers.prev ? `Previous: ${categoryPeers.prev.title}` : "No previous" },
        "\u2190 prev"), /*#__PURE__*/
        React.createElement("span", { className: "cx-help-nav-sep" }, "\xB7"), /*#__PURE__*/
        React.createElement("button", {
          className: "cx-help-nav-btn",
          disabled: !categoryPeers.next,
          onClick: () => categoryPeers.next && setSelectedId(categoryPeers.next.id),
          title: categoryPeers.next ? `Next: ${categoryPeers.next.title}` : "No next" },
        "next \u2192")
        ), /*#__PURE__*/
        React.createElement("div", { className: "cx-help-trans-wrap" }, /*#__PURE__*/
        React.createElement("button", {
          className: "cx-help-trans-toggle",
          onClick: () => setTrMenuOpen((o) => !o),
          "aria-haspopup": "listbox",
          "aria-expanded": trMenuOpen,
          title: "Translate this article" },

        currentLang ?
        `🌐 ${activeLangLabel} ▾` :
        "🌐 Translate ▾"
        ),
        trMenuOpen && /*#__PURE__*/
        React.createElement("ul", { className: "cx-help-trans-menu", role: "listbox" }, /*#__PURE__*/
        React.createElement("li", null, /*#__PURE__*/
        React.createElement("button", {
          className: "cx-help-trans-item",
          onClick: () => {
            setCurrentLang(null);
            setTr(null);
            setTrMenuOpen(false);
          } },
        "English (original)"

        )
        ),
        SUPPORTED_LANGS.map((l) => {
          const cached = !!readTrCache(selected.id, l.code);
          return (/*#__PURE__*/
            React.createElement("li", { key: l.code }, /*#__PURE__*/
            React.createElement("button", {
              className: `cx-help-trans-item ${currentLang === l.code ? "is-active" : ""}`,
              onClick: () => {
                setTrMenuOpen(false);
                doTranslate(selected, l.code);
              } }, /*#__PURE__*/

            React.createElement("span", null, l.label),
            cached && /*#__PURE__*/React.createElement("span", { className: "cx-help-trans-cached", title: "Cached locally" }, "\u25CF")
            )
            ));

        })
        )

        )
        ),

        currentLang && /*#__PURE__*/
        React.createElement("div", { className: "cx-help-trans-badge" },
        tr && tr.loading ? null :
        tr && tr.error ? /*#__PURE__*/
        React.createElement("span", { className: "cx-help-trans-err" }, "Translation failed \u2014 ",
        tr.error, ".", " ", /*#__PURE__*/
        React.createElement("button", { className: "cx-help-trans-link", onClick: () => doTranslate(selected, currentLang) }, "retry")
        ) : /*#__PURE__*/

        React.createElement("span", null, "\uD83C\uDF10 Translated by AI \xB7",
        " ", /*#__PURE__*/
        React.createElement("button", {
          className: "cx-help-trans-link",
          onClick: () => {setCurrentLang(null);setTr(null);} },
        "view original")
        )


        ), /*#__PURE__*/


        React.createElement("div", { className: "cx-help-scroll", ref: articleScrollRef }, /*#__PURE__*/

        React.createElement("header", { className: "cx-help-hero" }, /*#__PURE__*/
        React.createElement("div", { className: "cx-help-hero-meta" }, /*#__PURE__*/
        React.createElement("span", { className: "cx-help-hero-cat" }, /*#__PURE__*/
        React.createElement("span", { className: "cx-help-hero-icon", "aria-hidden": "true" }, icon),
        selected.category
        ), /*#__PURE__*/
        React.createElement("span", { className: "cx-help-hero-dot" }, "\xB7"), /*#__PURE__*/
        React.createElement("span", { className: "cx-help-hero-date" }, "Updated ", lastUpdated)
        ), /*#__PURE__*/
        React.createElement("h1", { className: "cx-help-hero-title" }, displayTitle), /*#__PURE__*/
        React.createElement("div", { className: "cx-help-hero-rule", "aria-hidden": "true" })
        ),

        tr && tr.loading ? /*#__PURE__*/
        React.createElement("div", { className: "cx-help-trans-loading" }, /*#__PURE__*/
        React.createElement(Skeleton, { rows: 6 }), /*#__PURE__*/
        React.createElement("div", { className: "cx-help-trans-loading-label" }, "Translating\u2026")
        ) : /*#__PURE__*/

        React.createElement("article", {
          className: "cx-help-article cx-help-article-pretty",
          ref: articleBodyRef,
          dangerouslySetInnerHTML: { __html: renderMarkdown(displayBody) } }
        ),


        selected.tags?.length > 0 && /*#__PURE__*/
        React.createElement("div", { className: "cx-help-tags" },
        selected.tags.map((t) => /*#__PURE__*/React.createElement("span", { key: t, className: "cx-help-tag" }, "#", t))
        ),


        related.length > 0 && /*#__PURE__*/
        React.createElement("div", { className: "cx-help-related" }, /*#__PURE__*/
        React.createElement("div", { className: "cx-help-related-head" }, "RELATED IN ", selected.category.toUpperCase()), /*#__PURE__*/
        React.createElement("div", { className: "cx-help-related-grid" },
        related.map((r) => /*#__PURE__*/
        React.createElement("button", { key: r.id, className: "cx-help-related-card", onClick: () => setSelectedId(r.id) }, /*#__PURE__*/
        React.createElement("div", { className: "cx-help-related-title" }, r.title), /*#__PURE__*/
        React.createElement("div", { className: "cx-help-related-tags" }, (r.tags || []).slice(0, 3).join(" · "))
        )
        )
        )
        ), /*#__PURE__*/


        React.createElement("div", { className: "cx-help-foot-nav" },
        categoryPeers.prev && /*#__PURE__*/
        React.createElement("button", { className: "cx-help-foot-nav-btn is-prev", onClick: () => setSelectedId(categoryPeers.prev.id) }, /*#__PURE__*/
        React.createElement("span", { className: "cx-help-foot-nav-dir" }, "\u2190 previous"), /*#__PURE__*/
        React.createElement("span", { className: "cx-help-foot-nav-title" }, categoryPeers.prev.title)
        ),

        categoryPeers.next && /*#__PURE__*/
        React.createElement("button", { className: "cx-help-foot-nav-btn is-next", onClick: () => setSelectedId(categoryPeers.next.id) }, /*#__PURE__*/
        React.createElement("span", { className: "cx-help-foot-nav-dir" }, "next \u2192"), /*#__PURE__*/
        React.createElement("span", { className: "cx-help-foot-nav-title" }, categoryPeers.next.title)
        )

        )
        )
        ));

    }

    // ── Index view ─────────────────────────────────────────────────────────
    const byCategory = {};
    for (const c of articles.categories || []) byCategory[c] = [];
    for (const a of all) {
      if (!byCategory[a.category]) byCategory[a.category] = [];
      byCategory[a.category].push(a);
    }

    const showCards = !query.trim() && browseMode === "cards";

    return (/*#__PURE__*/
      React.createElement("div", { className: "cx-help" }, /*#__PURE__*/
      React.createElement("div", { className: "cx-help-head cx-help-head-pretty" }, /*#__PURE__*/
      React.createElement("div", { className: "cx-help-eyebrow" }, "CODEX MANUAL \xB7 v", articles.version, " \xB7 ", articles.updated), /*#__PURE__*/
      React.createElement("div", { className: "cx-help-title-pretty" }, "Help & Reference"), /*#__PURE__*/
      React.createElement("div", { className: "cx-help-sub" }, "A small library of articles \u2014 searchable, askable, translatable.")
      ), /*#__PURE__*/

      React.createElement("div", { className: "cx-help-search-wrap cx-help-search-wrap-pretty" }, /*#__PURE__*/
      React.createElement("span", { className: "cx-help-search-icon", "aria-hidden": "true" }, "\u2315"), /*#__PURE__*/
      React.createElement("input", {
        ref: searchRef,
        className: "cx-help-search",
        type: "text",
        placeholder: "Search articles, or ask a question\u2026",
        value: query,
        onChange: (e) => {setQuery(e.target.value);setOracleAnswer(null);},
        onKeyDown: onSearchKey,
        spellCheck: false }
      ), /*#__PURE__*/
      React.createElement("button", {
        className: "cx-help-ask cx-help-ask-pretty",
        onClick: askOracle,
        disabled: !query.trim() || oracleAnswer && oracleAnswer.loading,
        title: "Ask Oracle to answer using the help corpus" },

      oracleAnswer && oracleAnswer.loading ? "ASKING…" : "✦ ASK ORACLE"
      )
      ),

      predictive.length > 0 && /*#__PURE__*/
      React.createElement("ul", { className: "cx-help-predict cx-help-predict-pretty", role: "listbox", "aria-label": "Matching articles" },
      predictive.map((a, i) => /*#__PURE__*/
      React.createElement("li", { key: a.id }, /*#__PURE__*/
      React.createElement("button", { className: "cx-help-predict-row cx-help-predict-row-pretty", onClick: () => setSelectedId(a.id) }, /*#__PURE__*/
      React.createElement("div", { className: "cx-help-predict-main" }, /*#__PURE__*/
      React.createElement("span", { className: "cx-help-predict-title" }, a.title), /*#__PURE__*/
      React.createElement("span", { className: "cx-help-badge cx-help-badge-sm" }, a.category)
      ), /*#__PURE__*/
      React.createElement("div", {
        className: "cx-help-predict-snippet",
        dangerouslySetInnerHTML: { __html: makeSnippet(a.body, query.trim()) } }
      ), /*#__PURE__*/
      React.createElement("div", { className: "cx-help-predict-hint" }, i === 0 ? "press ↵" : "")
      )
      )
      )
      ),


      oracleAnswer && oracleAnswer.loading && /*#__PURE__*/
      React.createElement("div", { className: "cx-help-oracle" }, /*#__PURE__*/
      React.createElement("div", { className: "cx-help-oracle-head" }, /*#__PURE__*/
      React.createElement("span", { className: "cx-help-badge cx-help-badge-accent" }, "ORACLE")
      ), /*#__PURE__*/
      React.createElement(Skeleton, { rows: 4 })
      ),

      oracleAnswer && !oracleAnswer.loading && (oracleAnswer.text || oracleAnswer.error) && /*#__PURE__*/
      React.createElement("div", { className: `cx-help-oracle ${oracleAnswer.error ? "is-error" : ""}` }, /*#__PURE__*/
      React.createElement("div", { className: "cx-help-oracle-head" }, /*#__PURE__*/
      React.createElement("span", { className: "cx-help-badge cx-help-badge-accent" }, "ORACLE"), /*#__PURE__*/
      React.createElement("button", { className: "cx-help-oracle-x", onClick: () => setOracleAnswer(null), "aria-label": "Dismiss Oracle answer" }, "\u2715")
      ),
      oracleAnswer.error ? /*#__PURE__*/
      React.createElement("div", { className: "cx-help-oracle-body" }, "Sorry \u2014 ", oracleAnswer.error) : /*#__PURE__*/
      React.createElement("div", { className: "cx-help-oracle-body",
        dangerouslySetInnerHTML: { __html: renderMarkdown(oracleAnswer.text) } })
      ),


      !query.trim() && /*#__PURE__*/
      React.createElement("div", { className: "cx-help-mode-toggle", role: "tablist", "aria-label": "Browse mode" }, /*#__PURE__*/
      React.createElement("button", {
        role: "tab",
        "aria-selected": browseMode === "cards",
        className: `cx-help-mode-btn ${browseMode === "cards" ? "is-active" : ""}`,
        onClick: () => setBrowseMode("cards") },
      "\u25A6 Categories"), /*#__PURE__*/
      React.createElement("button", {
        role: "tab",
        "aria-selected": browseMode === "list",
        className: `cx-help-mode-btn ${browseMode === "list" ? "is-active" : ""}`,
        onClick: () => setBrowseMode("list") },
      "\u2630 All articles")
      ),


      showCards ? /*#__PURE__*/
      React.createElement("div", { className: "cx-help-catgrid" },
      (articles.categories || []).map((cat) => {
        const list = byCategory[cat] || [];
        if (!list.length) return null;
        const meta = catMeta(cat);
        return (/*#__PURE__*/
          React.createElement("button", {
            key: cat,
            className: "cx-help-catcard",
            onClick: () => {setBrowseMode("list");setOpenCategories((s) => ({ ...Object.fromEntries(Object.keys(s).map((k) => [k, false])), [cat]: true }));} }, /*#__PURE__*/

          React.createElement("div", { className: "cx-help-catcard-icon", "aria-hidden": "true" }, meta.icon), /*#__PURE__*/
          React.createElement("div", { className: "cx-help-catcard-name" }, cat), /*#__PURE__*/
          React.createElement("div", { className: "cx-help-catcard-blurb" }, meta.blurb), /*#__PURE__*/
          React.createElement("div", { className: "cx-help-catcard-count" }, list.length, " ", list.length === 1 ? "article" : "articles", " \u2192")
          ));

      })
      ) : /*#__PURE__*/

      React.createElement("div", { className: "cx-help-browse" },
      (articles.categories || []).map((cat) => {
        const list = byCategory[cat] || [];
        if (!list.length) return null;
        const open = openCategories[cat];
        const meta = catMeta(cat);
        return (/*#__PURE__*/
          React.createElement("section", { key: cat, className: "cx-help-cat" }, /*#__PURE__*/
          React.createElement("button", {
            className: "cx-help-cat-head cx-help-cat-head-pretty",
            onClick: () => setOpenCategories((s) => ({ ...s, [cat]: !s[cat] })),
            "aria-expanded": open }, /*#__PURE__*/

          React.createElement("span", { className: "cx-help-cat-caret" }, open ? "▾" : "▸"), /*#__PURE__*/
          React.createElement("span", { className: "cx-help-cat-icon", "aria-hidden": "true" }, meta.icon), /*#__PURE__*/
          React.createElement("span", { className: "cx-help-cat-name" }, cat), /*#__PURE__*/
          React.createElement("span", { className: "cx-help-cat-count" }, list.length)
          ),
          open && /*#__PURE__*/
          React.createElement("ul", { className: "cx-help-cat-list" },
          list.map((a) => {
            const cached = cachedLangsFor(a.id);
            return (/*#__PURE__*/
              React.createElement("li", { key: a.id }, /*#__PURE__*/
              React.createElement("button", { className: "cx-help-row cx-help-row-pretty", onClick: () => setSelectedId(a.id) }, /*#__PURE__*/
              React.createElement("span", { className: "cx-help-row-title" }, a.title),
              cached.length > 0 && /*#__PURE__*/
              React.createElement("span", { className: "cx-help-row-langs", title: `Translated to: ${cached.join(", ")}` }, "\uD83C\uDF10 ",
              cached.length
              ),

              a.tags?.length > 0 && /*#__PURE__*/
              React.createElement("span", { className: "cx-help-row-tags" }, a.tags.slice(0, 3).join(" · "))

              )
              ));

          })
          )

          ));

      })
      ), /*#__PURE__*/


      React.createElement("div", { className: "cx-help-foot" }, "Press ", /*#__PURE__*/
      React.createElement("kbd", null, "\u21B5"), " to open the top match \xB7 ", /*#__PURE__*/React.createElement("kbd", null, "Esc"), " to back out \xB7 click ", /*#__PURE__*/React.createElement("kbd", null, "\u2726 ASK ORACLE"), " for free-form questions"
      )
      ));

  }

  window.CODEX_HelpWiki = HelpWiki;
})();
})();
