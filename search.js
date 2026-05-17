// CODEX full-text search · Phase 1.2
// ────────────────────────────────────────────────────────────────────
// Pure browser JS. Reads cached verses from the `codex`/chapters IDB
// store (written by bible.js) and from any `passage` objects the app
// chooses to ingest. Persists its own doc list to a separate IDB
// (`codex-search`/`docs`) so subsequent reloads skip the cold scan.
//
// Public surface — window.CODEX_SEARCH:
//   index(translation, refsObject)   → ingest a map of "bookId.chapter" → verses[]
//   ingestPassage(passage)           → ingest from app passage object (multi-translation)
//   search(query, opts)              → [{ ref, translation, snippet, score }]
//   clear()                          → wipe in-mem + persisted docs
//   stats()                          → { translations, verses, indexedAt, built }
//   ready                            → Promise that resolves after lazy init

(function () {
  if (window.CODEX_SEARCH) return;

  const DB_NAME  = "codex-search";
  const STORE    = "docs";
  const META_KEY = "__meta__";

  // ── In-memory state ───────────────────────────────────────────────
  const docs = [];                // { id, ref, translation, text, tokensLower }
  const byKey = new Map();        // dedup key "translation|ref" → docId
  const inverted = new Map();     // token → Set<docId>
  let built = false;              // inverted index built?
  let indexedAt = 0;
  let _db = null;
  let _seeded = false;            // did we read the codex chapters store yet?

  // ── IDB helpers (self-contained) ──────────────────────────────────
  function _openSelfDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error("no idb"));
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror   = () => reject(r.error);
    });
  }
  function _idb(store, mode, op) {
    return new Promise((resolve, reject) => {
      if (!_db) return reject(new Error("db closed"));
      const tx = _db.transaction(store, mode);
      const s = tx.objectStore(store);
      const r = op(s);
      if (r && "onsuccess" in r) {
        r.onsuccess = () => resolve(r.result);
        r.onerror   = () => reject(r.error);
      } else {
        tx.oncomplete = () => resolve();
        tx.onerror    = () => reject(tx.error);
      }
    });
  }

  // ── Read from the codex (bible.js) IDB to seed docs ───────────────
  function _readCodexChapters() {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open("codex");
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("chapters")) { db.close(); return resolve([]); }
          const out = [];
          const tx = db.transaction("chapters", "readonly");
          const cur = tx.objectStore("chapters").openCursor();
          cur.onsuccess = (e) => {
            const c = e.target.result;
            if (c) {
              // key = "bookId.chapter.translation"; value = {verses, translation, ...}
              const key = c.key;
              const v = c.value;
              const parts = String(key).split(".");
              const translation = parts.pop();
              const chapter = parts.pop();
              const bookId = parts.join(".");
              const verses = (v && v.verses) || [];
              out.push({ bookId, chapter: Number(chapter), translation, verses });
              c.continue();
            } else { db.close(); resolve(out); }
          };
          cur.onerror = () => { db.close(); resolve(out); };
        };
        req.onerror = () => resolve([]);
      } catch { resolve([]); }
    });
  }

  // ── Tokenization ──────────────────────────────────────────────────
  // Lowercase, strip non-alphanum (keep apostrophes inside words), split on ws.
  function tokenize(s) {
    if (!s) return [];
    return String(s)
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/[^\p{L}\p{N}'\s*]/gu, " ")
      .split(/\s+/)
      .filter(Boolean);
  }

  // ── Doc add / index build ─────────────────────────────────────────
  function _addDoc(ref, translation, text) {
    if (!text || typeof text !== "string") return;
    const dedup = translation + "|" + ref;
    if (byKey.has(dedup)) return;
    const id = docs.length;
    const tokensLower = tokenize(text);
    docs.push({ id, ref, translation, text, tokensLower });
    byKey.set(dedup, id);
    if (built) {
      for (const tk of tokensLower) {
        let s = inverted.get(tk);
        if (!s) { s = new Set(); inverted.set(tk, s); }
        s.add(id);
      }
    }
  }

  function _buildInverted() {
    inverted.clear();
    for (const d of docs) {
      for (const tk of d.tokensLower) {
        let s = inverted.get(tk);
        if (!s) { s = new Set(); inverted.set(tk, s); }
        s.add(d.id);
      }
    }
    built = true;
    indexedAt = Date.now();
  }

  // ── Persistence ───────────────────────────────────────────────────
  let _persistTimer = null;
  function _schedulePersist() {
    if (_persistTimer) return;
    _persistTimer = setTimeout(() => { _persistTimer = null; _persist(); }, 800);
  }
  async function _persist() {
    if (!_db) return;
    try {
      await _idb(STORE, "readwrite", s => {
        s.clear();
        for (const d of docs) {
          // Persist minimal — re-tokenize on rebuild.
          s.put({ ref: d.ref, translation: d.translation, text: d.text }, d.id);
        }
        s.put({ indexedAt, count: docs.length, v: 1 }, META_KEY);
        return null;
      });
    } catch {}
  }
  async function _loadPersisted() {
    if (!_db) return false;
    try {
      const all = await new Promise((resolve, reject) => {
        const tx = _db.transaction(STORE, "readonly");
        const store = tx.objectStore(STORE);
        const out = [];
        const cur = store.openCursor();
        cur.onsuccess = (e) => {
          const c = e.target.result;
          if (c) {
            if (c.key !== META_KEY) out.push(c.value);
            c.continue();
          } else resolve(out);
        };
        cur.onerror = () => reject(cur.error);
      });
      if (!all.length) return false;
      for (const d of all) _addDoc(d.ref, d.translation, d.text);
      return true;
    } catch { return false; }
  }

  // ── Public ingest ─────────────────────────────────────────────────
  function index(translation, refsObject) {
    if (!translation || !refsObject) return;
    let added = 0;
    for (const [bookCh, verses] of Object.entries(refsObject)) {
      if (!Array.isArray(verses)) continue;
      for (const v of verses) {
        if (!v || v.text == null) continue;
        const ref = `${bookCh}.${v.n}`;
        const before = docs.length;
        _addDoc(ref, translation, String(v.text));
        if (docs.length > before) added++;
      }
    }
    if (added) _schedulePersist();
    return added;
  }

  function ingestPassage(passage) {
    if (!passage || !passage.bookId || !passage.verses) return 0;
    const bookCh = `${passage.bookId}.${passage.chapter}`;
    let added = 0;
    for (const v of passage.verses) {
      if (!v || v.n == null) continue;
      const ref = `${bookCh}.${v.n}`;
      // A verse object from loadMulti has { n, [translationId]: text, ... }
      for (const [k, val] of Object.entries(v)) {
        if (k === "n" || k === "red" || k === "_jesusVerse" || k === "text") continue;
        if (typeof val !== "string") continue;
        const before = docs.length;
        _addDoc(ref, k, val);
        if (docs.length > before) added++;
      }
      // Fallback to v.text + a default translation tag if no per-translation keys.
      if (typeof v.text === "string") {
        const before = docs.length;
        _addDoc(ref, passage.primary || "default", v.text);
        if (docs.length > before) added++;
      }
    }
    if (added) _schedulePersist();
    return added;
  }

  // ── Lazy seed from codex IDB on first search() ────────────────────
  async function _seedIfNeeded() {
    if (_seeded) return;
    _seeded = true;
    const chapters = await _readCodexChapters();
    for (const ch of chapters) {
      for (const v of ch.verses) {
        if (!v || v.text == null) continue;
        const ref = `${ch.bookId}.${ch.chapter}.${v.n}`;
        _addDoc(ref, ch.translation, String(v.text));
      }
    }
    if (chapters.length) _schedulePersist();
  }

  // ── Query parsing ─────────────────────────────────────────────────
  // Supports: plain words, "phrase", trailing * wildcard, @TRANS filter.
  function _parseQuery(q) {
    const out = { tokens: [], wildcards: [], phrases: [], translation: null };
    if (!q) return out;
    let rest = String(q).trim();
    // @TRANS prefix
    const trMatch = rest.match(/(^|\s)@([A-Za-z0-9_-]+)/);
    if (trMatch) {
      out.translation = trMatch[2].toLowerCase();
      rest = (rest.slice(0, trMatch.index) + rest.slice(trMatch.index + trMatch[0].length)).trim();
    }
    // Extract quoted phrases
    rest = rest.replace(/"([^"]+)"/g, (_, p) => {
      out.phrases.push(p.toLowerCase().trim());
      return " ";
    });
    for (const tk of tokenize(rest)) {
      if (tk.endsWith("*") && tk.length > 1) out.wildcards.push(tk.slice(0, -1));
      else out.tokens.push(tk);
    }
    return out;
  }

  function _matchWildcard(prefix) {
    const set = new Set();
    for (const tk of inverted.keys()) {
      if (tk.startsWith(prefix)) {
        for (const id of inverted.get(tk)) set.add(id);
      }
    }
    return set;
  }

  // ── bookId pretty-print for ref label ─────────────────────────────
  function _prettyRef(ref) {
    // ref shape: "bookId.chapter.verse"
    const parts = ref.split(".");
    const verse = parts.pop();
    const chapter = parts.pop();
    const bookId = parts.join(".");
    let bookName = bookId;
    try {
      const book = (window.CODEX_DATA?.books || []).find(b => b.id === bookId);
      if (book) bookName = book.name;
    } catch {}
    return { bookName, bookId, chapter: Number(chapter), verse: Number(verse), label: `${bookName} ${chapter}:${verse}` };
  }

  // ── Snippet with <mark> highlight ─────────────────────────────────
  function _escapeHTML(s) {
    return s.replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
    }[c]));
  }
  function _snippet(text, hits) {
    if (!text) return "";
    const WINDOW = 80;
    let lowered = text.toLowerCase();
    // pick first hit position
    let pos = -1;
    for (const h of hits) {
      const p = lowered.indexOf(h);
      if (p >= 0 && (pos < 0 || p < pos)) pos = p;
    }
    if (pos < 0) {
      const head = text.slice(0, WINDOW);
      return _escapeHTML(head) + (text.length > WINDOW ? "…" : "");
    }
    const start = Math.max(0, pos - 30);
    const end = Math.min(text.length, pos + WINDOW);
    let snippet = text.slice(start, end);
    let safeOut = "";
    let cursor = 0;
    const lowSnip = snippet.toLowerCase();
    // Build sorted match ranges within snippet
    const ranges = [];
    for (const h of hits) {
      if (!h) continue;
      let from = 0;
      while (true) {
        const idx = lowSnip.indexOf(h, from);
        if (idx < 0) break;
        ranges.push([idx, idx + h.length]);
        from = idx + h.length;
      }
    }
    ranges.sort((a, b) => a[0] - b[0]);
    // Merge overlaps
    const merged = [];
    for (const r of ranges) {
      if (merged.length && r[0] <= merged[merged.length - 1][1]) {
        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], r[1]);
      } else merged.push(r.slice());
    }
    for (const [a, b] of merged) {
      safeOut += _escapeHTML(snippet.slice(cursor, a));
      safeOut += "<mark>" + _escapeHTML(snippet.slice(a, b)) + "</mark>";
      cursor = b;
    }
    safeOut += _escapeHTML(snippet.slice(cursor));
    return (start > 0 ? "…" : "") + safeOut + (end < text.length ? "…" : "");
  }

  // ── Recent-translation weight: read app primary if available ──────
  function _recentTranslations() {
    try {
      const primary = localStorage.getItem("codex.primary");
      return primary ? new Set([primary.replace(/^"|"$/g, "")]) : new Set();
    } catch { return new Set(); }
  }

  // ── search ────────────────────────────────────────────────────────
  async function search(query, opts = {}) {
    if (!_seeded) await _seedIfNeeded();
    if (!built) _buildInverted();
    const q = _parseQuery(query);
    const allTokens = [...q.tokens];
    const hits = [...q.tokens, ...q.wildcards, ...q.phrases];
    if (!allTokens.length && !q.wildcards.length && !q.phrases.length) return [];

    // Candidate doc set: intersection of all required tokens; fallback to union.
    let candidates = null;
    function intersect(set) {
      if (candidates === null) { candidates = new Set(set); return; }
      const next = new Set();
      for (const id of candidates) if (set.has(id)) next.add(id);
      candidates = next;
    }
    for (const tk of q.tokens) {
      const set = inverted.get(tk) || new Set();
      intersect(set);
    }
    for (const w of q.wildcards) intersect(_matchWildcard(w));
    // Phrases require post-filter (we filter below); also intersect on the
    // first token of each phrase for quick prune.
    for (const p of q.phrases) {
      const firstTk = tokenize(p)[0];
      if (firstTk) intersect(inverted.get(firstTk) || new Set());
    }
    if (!candidates) candidates = new Set();

    // Fallback: if intersection empty, look for ANY token (some-match).
    let mode = "all";
    if (candidates.size === 0 && (q.tokens.length + q.wildcards.length) > 1) {
      mode = "some";
      candidates = new Set();
      for (const tk of q.tokens) for (const id of (inverted.get(tk) || [])) candidates.add(id);
      for (const w of q.wildcards) for (const id of _matchWildcard(w)) candidates.add(id);
    }

    const recent = _recentTranslations();
    const results = [];
    for (const id of candidates) {
      const d = docs[id];
      if (q.translation && d.translation.toLowerCase() !== q.translation) continue;
      const lower = d.text.toLowerCase();
      // Phrase filter
      let phraseScore = 0;
      let phraseFail = false;
      for (const p of q.phrases) {
        if (lower.indexOf(p) < 0) { phraseFail = true; break; }
        phraseScore += 4;
      }
      if (phraseFail) continue;

      // Score
      let score = (mode === "all" ? 10 : 4);
      for (const tk of q.tokens) {
        if (lower.indexOf(tk) >= 0) score += 1;
      }
      for (const w of q.wildcards) {
        if (lower.indexOf(w) >= 0) score += 0.5;
      }
      score += phraseScore;
      // Contiguity: if all tokens appear in order close together, bonus.
      if (q.tokens.length > 1) {
        const joined = q.tokens.join(" ");
        if (lower.indexOf(joined) >= 0) score += 5;
      }
      if (recent.has(d.translation)) score += 2;

      results.push({
        ref: d.ref,
        translation: d.translation,
        snippet: _snippet(d.text, hits),
        score,
        text: d.text,
        pretty: _prettyRef(d.ref),
      });
    }
    results.sort((a, b) => b.score - a.score || a.ref.localeCompare(b.ref));
    const limit = opts.limit || 20;
    return results.slice(0, limit);
  }

  function clear() {
    docs.length = 0;
    byKey.clear();
    inverted.clear();
    built = false;
    indexedAt = 0;
    _seeded = false;
    if (_db) _idb(STORE, "readwrite", s => s.clear()).catch(() => {});
  }

  function stats() {
    const trans = new Set();
    for (const d of docs) trans.add(d.translation);
    return {
      translations: trans.size,
      translationList: [...trans],
      verses: docs.length,
      indexedAt,
      built,
    };
  }

  // ── Init: open self DB, load persisted docs (if any) ──────────────
  const ready = (async () => {
    try {
      _db = await _openSelfDB();
      const had = await _loadPersisted();
      if (had) _seeded = true;     // skip codex re-scan; we have docs already
    } catch {}
  })();

  window.CODEX_SEARCH = {
    index, ingestPassage, search, clear, stats, ready,
  };
})();

// ────────────────────────────────────────────────────────────────────
// SearchBar React component — exposed as window.CODEX_SearchBar so
// app.jsx can render it without owning all the search internals.
// ────────────────────────────────────────────────────────────────────
(function () {
  if (typeof window === "undefined" || !window.React) {
    // React not ready yet — defer registration until DOMContentLoaded
    document.addEventListener("DOMContentLoaded", function once() {
      if (window.React && !window.CODEX_SearchBar) _register();
    });
    return;
  }
  _register();

  function _register() {
    const { useState, useEffect, useRef } = window.React;

    function SearchBar({ open, onClose, onNavigate }) {
      const [q, setQ] = useState("");
      const [results, setResults] = useState([]);
      const [sel, setSel] = useState(0);
      const [stats, setStats] = useState(null);
      const inputRef = useRef(null);
      const listRef = useRef(null);

      useEffect(() => {
        if (!open) return;
        // Focus input on open
        const id = setTimeout(() => inputRef.current?.focus(), 30);
        setStats(window.CODEX_SEARCH?.stats?.() || null);
        return () => clearTimeout(id);
      }, [open]);

      useEffect(() => {
        if (!open) { setQ(""); setResults([]); setSel(0); }
      }, [open]);

      useEffect(() => {
        let cancelled = false;
        if (!q.trim()) { setResults([]); setSel(0); return; }
        (async () => {
          try {
            const r = await window.CODEX_SEARCH.search(q, { limit: 20 });
            if (!cancelled) {
              setResults(r);
              setSel(0);
              setStats(window.CODEX_SEARCH.stats());
            }
          } catch (e) {
            if (!cancelled) setResults([]);
          }
        })();
        return () => { cancelled = true; };
      }, [q]);

      function pick(r) {
        if (!r) return;
        const p = r.pretty;
        onNavigate?.(p.bookId, p.chapter, p.verse);
        onClose?.();
      }

      function onKeyDown(e) {
        if (e.key === "Escape") { e.preventDefault(); onClose?.(); return; }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSel(s => Math.min(results.length - 1, s + 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSel(s => Math.max(0, s - 1));
        } else if (e.key === "Enter") {
          e.preventDefault();
          pick(results[sel]);
        }
      }

      useEffect(() => {
        // Scroll selected into view
        const el = listRef.current?.querySelector(`[data-idx="${sel}"]`);
        el?.scrollIntoView?.({ block: "nearest" });
      }, [sel]);

      if (!open) return null;
      const React = window.React;
      return React.createElement(
        "div",
        {
          className: "cx-search-backdrop",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": "Full-text scripture search",
          onClick: () => onClose?.(),
        },
        React.createElement(
          "div",
          { className: "cx-search-modal", onClick: (e) => e.stopPropagation() },
          React.createElement(
            "div",
            { className: "cx-search-bar" },
            React.createElement("span", { className: "cx-search-prompt" }, "›"),
            React.createElement("input", {
              ref: inputRef,
              className: "cx-search-input",
              type: "search",
              autoFocus: true,
              spellCheck: false,
              placeholder: "search scripture · \"phrase\" · lov* · @KJV love",
              value: q,
              onChange: (e) => setQ(e.target.value),
              onKeyDown,
              "data-cx-search": "1",
            }),
            React.createElement("span", { className: "cx-search-kbd" }, "ESC")
          ),
          q.trim() && results.length === 0
            ? React.createElement("div", { className: "cx-search-empty" },
                "No matches. Try fewer or different words.")
            : null,
          results.length
            ? React.createElement(
                "ul",
                { className: "cx-search-results", ref: listRef, role: "listbox" },
                results.map((r, i) =>
                  React.createElement(
                    "li",
                    {
                      key: r.ref + "|" + r.translation,
                      "data-idx": i,
                      className: "cx-search-row" + (i === sel ? " is-sel" : ""),
                      role: "option",
                      "aria-selected": i === sel,
                      onMouseEnter: () => setSel(i),
                      onClick: () => pick(r),
                    },
                    React.createElement(
                      "div",
                      { className: "cx-search-ref" },
                      React.createElement("span", { className: "cx-search-trans" }, `[${r.translation.toUpperCase()}]`),
                      " ",
                      React.createElement("b", null, r.pretty.label)
                    ),
                    React.createElement("div", {
                      className: "cx-search-snippet",
                      dangerouslySetInnerHTML: { __html: r.snippet },
                    })
                  )
                )
              )
            : null,
          React.createElement(
            "div",
            { className: "cx-search-foot" },
            stats
              ? `${stats.verses.toLocaleString()} verses · ${stats.translations} translation${stats.translations === 1 ? "" : "s"} · offline`
              : "indexing…",
            React.createElement("span", { className: "cx-search-hint" },
              "↑↓ navigate · ↵ open · esc close")
          )
        )
      );
    }

    window.CODEX_SearchBar = SearchBar;
  }
})();
