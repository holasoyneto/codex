// help.jsx
// CODEX Help Wiki — searchable, AI-augmented, multilingual documentation.
//
// Lives inside the Settings/Tweaks panel. Driven by data/help/articles.json
// so non-engineers can ship doc updates with a release. Modes:
//
//   1. Browse — category accordion, all articles listed.
//   2. Predictive search — substring/tag/title match as you type (top 5).
//      Also searches any cached translations so non-English users can find
//      articles in their own tongue.
//   3. Ask Oracle — submit free-form question, POST to /api/chat with the
//      whole help corpus stuffed into the user turn.
//   4. Translate ▾ — in the article view, on-demand AI translation into any
//      of the languages registered in i18n.js (es/de/pt/fr/la/he/el/hi).
//      Results cache in localStorage so revisits are instant + offline.
//
// Exports window.CODEX_HelpWiki for tweaks-panel.jsx to mount.
// Styles live in styles.css under .cx-help-* (translation UI under
// .cx-help-trans-*).

(function () {
  const { useState, useEffect, useMemo, useRef, useCallback } = React;

  // ── Supported translation targets ─────────────────────────────────────
  // Pulled from i18n.js's LANGS, minus English (the source language).
  // Falls back to a hard-coded list if window.CODEX_LANGS isn't ready yet.
  function getSupportedLangs() {
    const fallback = [
      { code: "es", label: "Español" },
      { code: "de", label: "Deutsch" },
      { code: "pt", label: "Português" },
      { code: "fr", label: "Français" },
      { code: "la", label: "Latina" },
      { code: "he", label: "עברית" },
      { code: "el", label: "Ἑλληνική" },
      { code: "hi", label: "हिन्दी" },
    ];
    const src = (typeof window !== "undefined" && Array.isArray(window.CODEX_LANGS))
      ? window.CODEX_LANGS : null;
    if (!src) return fallback;
    return src
      .filter(l => l && l.id && l.id !== "en")
      .map(l => ({ code: l.id, label: l.label || l.id }));
  }
  const SUPPORTED_LANGS = getSupportedLangs();

  // Map of code -> full language name we pass to Claude.
  const LANG_NAME = {
    es: "Spanish", de: "German", pt: "Portuguese", fr: "French",
    la: "Latin",   he: "Hebrew", el: "Greek",      hi: "Hindi",
  };

  // Read the user's currently selected UI language.
  function currentUiLang() {
    try {
      if (typeof window !== "undefined" && window.CODEX_LANG) return window.CODEX_LANG;
      const ls = localStorage.getItem("codex.lang");
      if (ls) return ls;
    } catch {}
    return "en";
  }

  // localStorage cache keys for AI translations.
  const TR_KEY       = (id, lang) => `codex.help.tr.${id}.${lang}`;
  const TR_TITLE_KEY = (id, lang) => `codex.help.tr.${id}.${lang}.title`;

  function readTrCache(id, lang) {
    try {
      const body  = localStorage.getItem(TR_KEY(id, lang));
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
  // Return list of language codes that have a cached translation for this id.
  function cachedLangsFor(id) {
    const out = [];
    for (const l of SUPPORTED_LANGS) {
      try {
        if (localStorage.getItem(TR_KEY(id, l.code))) out.push(l.code);
      } catch {}
    }
    return out;
  }

  // ── Tiny markdown renderer ─────────────────────────────────────────────
  // Handles: # / ##, **bold**, *italic*, `code`, [text](url),
  //          - bullet lists, 1. ordered lists, blank-line paragraphs.
  // Escapes HTML first so article bodies can't smuggle <script>.
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function inlineMd(s) {
    const codes = [];
    s = s.replace(/`([^`]+)`/g, (_, c) => {
      codes.push(c);
      return ` C${codes.length - 1} `;
    });
    s = escapeHtml(s);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
      (_, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);
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

    const flushPara = () => {
      if (para.length) {
        out.push(`<p>${inlineMd(para.join(" "))}</p>`);
        para = [];
      }
    };
    const flushList = () => {
      if (list) {
        out.push(`<${list.tag}>${list.items.map(i => `<li>${inlineMd(i)}</li>`).join("")}</${list.tag}>`);
        list = null;
      }
    };

    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim()) { flushPara(); flushList(); continue; }
      let m;
      if ((m = line.match(/^#{3}\s+(.*)$/))) { flushPara(); flushList(); out.push(`<h3>${inlineMd(m[1])}</h3>`); continue; }
      if ((m = line.match(/^##\s+(.*)$/)))   { flushPara(); flushList(); out.push(`<h2>${inlineMd(m[1])}</h2>`); continue; }
      if ((m = line.match(/^#\s+(.*)$/)))    { flushPara(); flushList(); out.push(`<h1>${inlineMd(m[1])}</h1>`); continue; }
      if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
        flushPara();
        if (!list || list.tag !== "ul") { flushList(); list = { tag: "ul", items: [] }; }
        list.items.push(m[1]); continue;
      }
      if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) {
        flushPara();
        if (!list || list.tag !== "ol") { flushList(); list = { tag: "ol", items: [] }; }
        list.items.push(m[1]); continue;
      }
      para.push(line.trim());
    }
    flushPara(); flushList();
    return out.join("\n");
  }

  // ── Fuzzy ranking ──────────────────────────────────────────────────────
  // Title hits outrank tag hits, which outrank body hits. Within a class,
  // earlier-in-string wins. Also folds in any cached translations of the
  // article so search works in the user's UI language.
  function scoreArticle(art, q) {
    if (!q) return 0;
    const Q = q.toLowerCase();
    const title = (art.title || "").toLowerCase();
    const tags  = (art.tags || []).join(" ").toLowerCase();
    let body  = (art.body || "").toLowerCase();
    // Fold cached translations into the searchable body so non-English
    // users can find articles by terms in their own language.
    for (const l of SUPPORTED_LANGS) {
      const c = readTrCache(art.id, l.code);
      if (c) {
        body += " " + (c.body || "").toLowerCase();
        if (c.title) body += " " + c.title.toLowerCase();
      }
    }
    let s = 0;
    const ti = title.indexOf(Q);
    if (ti === 0) s += 1000;
    else if (ti > 0) s += 600 - Math.min(ti, 200);
    const gi = tags.indexOf(Q);
    if (gi >= 0) s += 300 - Math.min(gi, 100);
    const bi = body.indexOf(Q);
    if (bi >= 0) s += 80 - Math.min(bi / 20, 60);
    if (new RegExp(`\\b${Q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(title)) s += 200;
    return s;
  }

  // ── Translation request ────────────────────────────────────────────────
  // Hits /api/chat for body + title. Returns { body, title } or throws.
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
        max_tokens: max,
      }),
    }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      return (data.text || "").trim();
    });

    const [body, title] = await Promise.all([
      post(system, article.body, 2000),
      post(titleSystem, article.title, 120),
    ]);
    return { body, title };
  }

  // ── Main component ─────────────────────────────────────────────────────
  function HelpWiki() {
    const [articles, setArticles] = useState(null);
    const [error, setError] = useState(null);
    const [query, setQuery] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    const [oracleAnswer, setOracleAnswer] = useState(null);
    const [openCategories, setOpenCategories] = useState({});
    const searchRef = useRef(null);

    // Translation state — keyed to the selected article.
    // currentLang: null = original; otherwise the lang code being viewed.
    // tr: { loading?:bool, body?:string, title?:string, error?:string }
    const [currentLang, setCurrentLang] = useState(null);
    const [tr, setTr] = useState(null);
    const [trMenuOpen, setTrMenuOpen] = useState(false);
    const autoTriedRef = useRef({}); // articleId -> true once we've auto-tried

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
            for (const c of (j.categories || [])) open[c] = true;
            setOpenCategories(open);
          }
        } catch (e) {
          if (!cancelled) setError(e.message || String(e));
        }
      })();
      return () => { cancelled = true; };
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
      return all
        .map(a => ({ a, s: scoreArticle(a, q) }))
        .filter(x => x.s > 0)
        .sort((x, y) => y.s - x.s)
        .slice(0, 5)
        .map(x => x.a);
    }, [query, all]);

    const askOracle = useCallback(async () => {
      const q = query.trim();
      if (!q || !articles) return;
      setOracleAnswer({ loading: true });
      const corpus = (articles.articles || []).map(a => ({
        id: a.id, title: a.title, category: a.category, tags: a.tags, body: a.body,
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
              content: `Question: ${q}\n\n--- CODEX HELP CORPUS (JSON) ---\n${JSON.stringify(corpus)}`,
            }],
            max_tokens: 800,
          }),
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
        if (predictive[0] && predictive[0].title.toLowerCase() === query.trim().toLowerCase()) {
          setSelectedId(predictive[0].id);
        } else {
          askOracle();
        }
      } else if (e.key === "Escape" && selectedId) {
        e.preventDefault();
        setSelectedId(null);
      }
    };

    // Reset translation state when the selected article changes.
    useEffect(() => {
      setCurrentLang(null);
      setTr(null);
      setTrMenuOpen(false);
    }, [selectedId]);

    // Trigger a translation (from cache if possible, else network).
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

    // Auto-translate on first article open if the UI lang isn't English.
    const selected = selectedId ? byId.get(selectedId) : null;
    useEffect(() => {
      if (!selected) return;
      if (autoTriedRef.current[selected.id]) return;
      const ui = currentUiLang();
      if (!ui || ui === "en") return;
      if (!SUPPORTED_LANGS.some(l => l.code === ui)) return;
      autoTriedRef.current[selected.id] = true;
      doTranslate(selected, ui);
    }, [selected, doTranslate]);

    // ── Renders ──────────────────────────────────────────────────────────
    if (error) {
      return (
        <div className="cx-help">
          <div className="cx-help-error">Could not load help articles: {error}</div>
        </div>
      );
    }
    if (!articles) {
      return <div className="cx-help"><div className="cx-help-loading">Loading help…</div></div>;
    }

    // Selected article view
    if (selected) {
      const showingTranslated = currentLang && tr && !tr.loading && !tr.error && tr.body;
      const displayTitle = showingTranslated && tr.title ? tr.title : selected.title;
      const displayBody  = showingTranslated ? tr.body : selected.body;
      const activeLangLabel = currentLang
        ? (SUPPORTED_LANGS.find(l => l.code === currentLang)?.label || currentLang)
        : null;

      return (
        <div className="cx-help">
          <div className="cx-help-bar">
            <button className="cx-help-back" onClick={() => setSelectedId(null)} aria-label="Back to help index">
              ← BACK
            </button>
            <span className="cx-help-crumb">
              <span className="cx-help-badge">{selected.category}</span>
            </span>
            <div className="cx-help-trans-wrap">
              <button
                className="cx-help-trans-toggle"
                onClick={() => setTrMenuOpen(o => !o)}
                aria-haspopup="listbox"
                aria-expanded={trMenuOpen}
                title="Translate this article"
              >
                {currentLang
                  ? `🌐 ${activeLangLabel} ▾`
                  : "🌐 Translate ▾"}
              </button>
              {trMenuOpen && (
                <ul className="cx-help-trans-menu" role="listbox">
                  <li>
                    <button
                      className="cx-help-trans-item"
                      onClick={() => {
                        setCurrentLang(null);
                        setTr(null);
                        setTrMenuOpen(false);
                      }}
                    >
                      English (original)
                    </button>
                  </li>
                  {SUPPORTED_LANGS.map(l => {
                    const cached = !!readTrCache(selected.id, l.code);
                    return (
                      <li key={l.code}>
                        <button
                          className={`cx-help-trans-item ${currentLang === l.code ? "is-active" : ""}`}
                          onClick={() => {
                            setTrMenuOpen(false);
                            doTranslate(selected, l.code);
                          }}
                        >
                          <span>{l.label}</span>
                          {cached && <span className="cx-help-trans-cached" title="Cached locally">●</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {currentLang && (
            <div className="cx-help-trans-badge">
              {tr && tr.loading ? null : (
                tr && tr.error ? (
                  <span className="cx-help-trans-err">
                    Translation failed — {tr.error}.{" "}
                    <button className="cx-help-trans-link" onClick={() => doTranslate(selected, currentLang)}>retry</button>
                  </span>
                ) : (
                  <span>
                    🌐 Translated by AI ·{" "}
                    <button
                      className="cx-help-trans-link"
                      onClick={() => { setCurrentLang(null); setTr(null); }}
                    >view original</button>
                  </span>
                )
              )}
            </div>
          )}

          {tr && tr.loading ? (
            <div className="cx-help-trans-loading">
              <div className="cx-help-trans-spinner" aria-hidden="true" />
              <div>Translating…</div>
            </div>
          ) : (
            <article
              className="cx-help-article"
              dangerouslySetInnerHTML={{
                __html:
                  (showingTranslated
                    ? `<h1>${escapeHtml(displayTitle)}</h1>\n`
                    : "") + renderMarkdown(displayBody),
              }}
            />
          )}

          {selected.tags?.length > 0 && (
            <div className="cx-help-tags">
              {selected.tags.map(t => <span key={t} className="cx-help-tag">#{t}</span>)}
            </div>
          )}
        </div>
      );
    }

    // Index view
    const byCategory = {};
    for (const c of (articles.categories || [])) byCategory[c] = [];
    for (const a of all) {
      if (!byCategory[a.category]) byCategory[a.category] = [];
      byCategory[a.category].push(a);
    }

    return (
      <div className="cx-help">
        <div className="cx-help-head">
          <div className="cx-help-title">HELP &amp; DOCS</div>
          <div className="cx-help-sub">CODEX manual · v{articles.version} · updated {articles.updated}</div>
        </div>

        <div className="cx-help-search-wrap">
          <input
            ref={searchRef}
            className="cx-help-search"
            type="text"
            placeholder="Search help, or ask a question…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOracleAnswer(null); }}
            onKeyDown={onSearchKey}
            spellCheck={false}
          />
          <button
            className="cx-help-ask"
            onClick={askOracle}
            disabled={!query.trim() || (oracleAnswer && oracleAnswer.loading)}
            title="Ask Oracle to answer using the help corpus"
          >
            {oracleAnswer && oracleAnswer.loading ? "ASKING…" : "ASK ORACLE"}
          </button>
        </div>

        {predictive.length > 0 && (
          <ul className="cx-help-predict" role="listbox" aria-label="Matching articles">
            {predictive.map(a => (
              <li key={a.id}>
                <button className="cx-help-predict-row" onClick={() => setSelectedId(a.id)}>
                  <span className="cx-help-badge cx-help-badge-sm">{a.category}</span>
                  <span className="cx-help-predict-title">{a.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {oracleAnswer && !oracleAnswer.loading && (oracleAnswer.text || oracleAnswer.error) && (
          <div className={`cx-help-oracle ${oracleAnswer.error ? "is-error" : ""}`}>
            <div className="cx-help-oracle-head">
              <span className="cx-help-badge cx-help-badge-accent">ORACLE</span>
              <button className="cx-help-oracle-x" onClick={() => setOracleAnswer(null)} aria-label="Dismiss Oracle answer">✕</button>
            </div>
            {oracleAnswer.error
              ? <div className="cx-help-oracle-body">Sorry — {oracleAnswer.error}</div>
              : <div className="cx-help-oracle-body"
                     dangerouslySetInnerHTML={{ __html: renderMarkdown(oracleAnswer.text) }} />}
          </div>
        )}

        <div className="cx-help-browse">
          {(articles.categories || []).map(cat => {
            const list = byCategory[cat] || [];
            if (!list.length) return null;
            const open = openCategories[cat];
            return (
              <section key={cat} className="cx-help-cat">
                <button
                  className="cx-help-cat-head"
                  onClick={() => setOpenCategories(s => ({ ...s, [cat]: !s[cat] }))}
                  aria-expanded={open}
                >
                  <span className="cx-help-cat-caret">{open ? "▾" : "▸"}</span>
                  <span className="cx-help-cat-name">{cat}</span>
                  <span className="cx-help-cat-count">{list.length}</span>
                </button>
                {open && (
                  <ul className="cx-help-cat-list">
                    {list.map(a => {
                      const cached = cachedLangsFor(a.id);
                      return (
                        <li key={a.id}>
                          <button className="cx-help-row" onClick={() => setSelectedId(a.id)}>
                            <span className="cx-help-row-title">{a.title}</span>
                            {cached.length > 0 && (
                              <span className="cx-help-row-langs" title={`Translated to: ${cached.join(", ")}`}>
                                🌐 {cached.length} {cached.length === 1 ? "language" : "languages"} available
                              </span>
                            )}
                            {a.tags?.length > 0 && (
                              <span className="cx-help-row-tags">{a.tags.slice(0, 3).join(" · ")}</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

        <div className="cx-help-foot">
          Press <kbd>Enter</kbd> to ask Oracle · <kbd>Esc</kbd> to back out of an article
        </div>
      </div>
    );
  }

  window.CODEX_HelpWiki = HelpWiki;
})();
