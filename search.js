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

  // ── Semantic (concept) search ─────────────────────────────────────
  // AI-powered. POSTs the query to /api/chat asking for a JSON array of
  // relevant passages. Cached per (query, lang) in localStorage so repeats
  // are instant + work offline.
  function _hashStr(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }
  function _lang() {
    try { return (window.codexLangName && window.codexLangName()) || "English"; }
    catch { return "English"; }
  }
  function _tweaks() {
    try { return JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}") || {}; }
    catch { return {}; }
  }
  function _conceptCacheKey(query, lang) {
    return `codex.search.concept.${_hashStr(query.trim().toLowerCase())}.${lang}`;
  }
  function _readConceptCache(query, lang) {
    try {
      const raw = localStorage.getItem(_conceptCacheKey(query, lang));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.results)) return null;
      return parsed;
    } catch { return null; }
  }
  function _writeConceptCache(query, lang, results) {
    try {
      localStorage.setItem(_conceptCacheKey(query, lang),
        JSON.stringify({ ts: Date.now(), results }));
    } catch {}
  }

  const SEMANTIC_SYSTEM =
    "You are CODEX SEMANTIC SEARCH. The user is asking for Bible passages " +
    "relevant to their concept query. Return ONLY a JSON array (no prose) of " +
    "relevant passages, ranked by relevance. 15 results max. For each: ref " +
    "(book chapter:verse like \"John 3:16\"), passage_text (the verse text in " +
    "KJV unless user implies another translation), relevance (one short " +
    "sentence on why this passage is relevant), score (0.0-1.0). Cast a wide " +
    "net — include both obvious and surprising matches. Span Old + New " +
    "Testament + apocrypha where relevant.";

  function _parseSemanticJSON(text) {
    if (!text) return [];
    // Strip ```json fences if any
    let t = String(text).trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();
    // Try to find the array bounds if there's prose
    const first = t.indexOf("[");
    const last  = t.lastIndexOf("]");
    if (first >= 0 && last > first) t = t.slice(first, last + 1);
    try {
      const arr = JSON.parse(t);
      if (!Array.isArray(arr)) return [];
      return arr.filter(x => x && typeof x.ref === "string").map(x => ({
        ref: x.ref,
        passage_text: typeof x.passage_text === "string" ? x.passage_text : "",
        relevance: typeof x.relevance === "string" ? x.relevance : "",
        score: typeof x.score === "number"
          ? Math.max(0, Math.min(1, x.score))
          : 0.5,
      }));
    } catch { return []; }
  }

  // Parse "John 3:16" / "1 John 3:16" / "Song of Solomon 2:1" → {bookId, chapter, verse}
  function _parseHumanRef(ref) {
    if (!ref || typeof ref !== "string") return null;
    const m = ref.trim().match(/^(.+?)\s+(\d+):(\d+)/);
    if (!m) return null;
    const name = m[1].trim().toLowerCase();
    const chapter = Number(m[2]);
    const verse = Number(m[3]);
    let bookId = null;
    try {
      const books = (window.CODEX_DATA && window.CODEX_DATA.books) || [];
      const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, "");
      const target = norm(name);
      let best = books.find(b => norm(b.name) === target || norm(b.id) === target);
      if (!best) best = books.find(b =>
        norm(b.name).startsWith(target) || target.startsWith(norm(b.name)));
      if (!best && Array.isArray(books)) {
        // aliases like "Ps" → Psalms, "Mt" → Matthew, "1Jn" → 1 John
        best = books.find(b => {
          const aliases = b.aliases || [];
          return aliases.some(a => norm(a) === target);
        });
      }
      if (best) bookId = best.id;
    } catch {}
    return { bookId, bookName: m[1].trim(), chapter, verse };
  }

  async function searchSemantic(query, opts = {}) {
    const q = String(query || "").trim();
    if (!q) return { results: [], fromCache: false };
    const lang = opts.lang || _lang();

    // Cache first
    const cached = _readConceptCache(q, lang);
    if (cached && !opts.force) {
      return { results: cached.results, fromCache: true, ts: cached.ts };
    }

    const tweaks = _tweaks();
    const provider = opts.provider || tweaks.provider || "anthropic";
    const model    = opts.model    || tweaks.model    || null;

    let resp;
    try {
      resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider, model,
          system: SEMANTIC_SYSTEM,
          messages: [{ role: "user", content: q }],
          max_tokens: 2000,
        }),
      });
    } catch (e) {
      const err = new Error("network");
      err.kind = "network";
      throw err;
    }
    let data = null;
    try { data = await resp.json(); } catch {}
    if (!resp.ok) {
      const msg = (data && data.error) || `HTTP ${resp.status}`;
      const err = new Error(msg);
      err.kind = /key|auth|401|403/i.test(String(msg)) ? "auth" : "api";
      throw err;
    }
    const items = _parseSemanticJSON(data && data.text);
    const enriched = items.map(it => {
      const parsed = _parseHumanRef(it.ref);
      return {
        ref: it.ref,
        bookId: parsed?.bookId || null,
        chapter: parsed?.chapter || null,
        verse:   parsed?.verse   || null,
        text: it.passage_text,
        relevance: it.relevance,
        score: it.score,
      };
    });
    _writeConceptCache(q, lang, enriched);
    return { results: enriched, fromCache: false, ts: Date.now() };
  }

  window.CODEX_SEARCH = {
    index, ingestPassage, search, clear, stats, ready,
    searchSemantic,
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

    const MODE_KEY = "codex.search.mode";
    function _readMode() {
      try {
        const v = localStorage.getItem(MODE_KEY);
        return v === "concept" ? "concept" : "text";
      } catch { return "text"; }
    }
    function _writeMode(m) {
      try { localStorage.setItem(MODE_KEY, m); } catch {}
    }

    function SearchBar({ open, onClose, onNavigate }) {
      const [mode, setMode] = useState(_readMode());
      const [q, setQ] = useState("");
      const [results, setResults] = useState([]);          // text results
      const [conceptResults, setConceptResults] = useState([]);
      const [conceptStatus, setConceptStatus] = useState("idle"); // idle|loading|done|error
      const [conceptErr, setConceptErr] = useState(null);
      const [conceptFromCache, setConceptFromCache] = useState(false);
      const [sel, setSel] = useState(0);
      const [stats, setStats] = useState(null);
      const inputRef = useRef(null);
      const listRef = useRef(null);
      const debounceRef = useRef(null);

      useEffect(() => {
        if (!open) return;
        const id = setTimeout(() => inputRef.current?.focus(), 30);
        setStats(window.CODEX_SEARCH?.stats?.() || null);
        return () => clearTimeout(id);
      }, [open]);

      useEffect(() => {
        if (!open) {
          setQ(""); setResults([]); setConceptResults([]);
          setConceptStatus("idle"); setConceptErr(null); setConceptFromCache(false);
          setSel(0);
        }
      }, [open]);

      useEffect(() => { _writeMode(mode); }, [mode]);

      // TEXT mode live search
      useEffect(() => {
        if (mode !== "text") return;
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
      }, [q, mode]);

      // CONCEPT mode — show cached instantly, debounce live AI fetch
      useEffect(() => {
        if (mode !== "concept") return;
        if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
        const query = q.trim();
        if (!query) {
          setConceptResults([]); setConceptStatus("idle");
          setConceptErr(null); setConceptFromCache(false); setSel(0);
          return;
        }
        // Try cache instantly
        let hadCache = false;
        try {
          const cacheRaw = localStorage.getItem(
            "codex.search.concept." +
              ((s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); })(query.toLowerCase()) +
              "." + ((window.codexLangName && window.codexLangName()) || "English")
          );
          if (cacheRaw) {
            const c = JSON.parse(cacheRaw);
            if (c && Array.isArray(c.results) && c.results.length) {
              setConceptResults(c.results);
              setConceptStatus("done");
              setConceptFromCache(true);
              setConceptErr(null);
              setSel(0);
              hadCache = true;
            }
          }
        } catch {}

        debounceRef.current = setTimeout(async () => {
          if (!hadCache) {
            setConceptStatus("loading");
            setConceptErr(null);
          }
          try {
            const { results, fromCache } = await window.CODEX_SEARCH.searchSemantic(query);
            setConceptResults(results || []);
            setConceptStatus("done");
            setConceptFromCache(!!fromCache);
            setSel(0);
          } catch (e) {
            if (!hadCache) {
              setConceptStatus("error");
              setConceptErr(e);
            }
          }
        }, 600);

        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
      }, [q, mode]);

      function pickText(r) {
        if (!r) return;
        const p = r.pretty;
        onNavigate?.(p.bookId, p.chapter, p.verse);
        onClose?.();
      }
      function pickConcept(r) {
        if (!r) return;
        const bookId = r.bookId;
        if (bookId && typeof window.codexJumpToRef === "function") {
          window.codexJumpToRef(bookId, r.chapter, r.verse);
        } else if (typeof onNavigate === "function" && bookId) {
          onNavigate(bookId, r.chapter, r.verse);
        }
        onClose?.();
      }

      function activeList() {
        return mode === "concept" ? conceptResults : results;
      }
      function pickActive(i) {
        const list = activeList();
        const r = list[i];
        if (!r) return;
        if (mode === "concept") pickConcept(r);
        else pickText(r);
      }
      function onKeyDown(e) {
        if (e.key === "Escape") { e.preventDefault(); onClose?.(); return; }
        const list = activeList();
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSel(s => Math.min(list.length - 1, s + 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSel(s => Math.max(0, s - 1));
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (mode === "concept") {
            // Force immediate fetch (cancel debounce)
            if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
            if (conceptStatus === "loading" || !q.trim()) return;
            if (list.length && conceptStatus === "done") {
              pickActive(sel);
            } else {
              // Trigger an immediate semantic fetch
              (async () => {
                setConceptStatus("loading"); setConceptErr(null);
                try {
                  const { results, fromCache } = await window.CODEX_SEARCH.searchSemantic(q.trim());
                  setConceptResults(results || []);
                  setConceptStatus("done");
                  setConceptFromCache(!!fromCache);
                  setSel(0);
                } catch (err) {
                  setConceptStatus("error");
                  setConceptErr(err);
                }
              })();
            }
          } else {
            pickActive(sel);
          }
        }
      }

      useEffect(() => {
        // Scroll selected into view
        const el = listRef.current?.querySelector(`[data-idx="${sel}"]`);
        el?.scrollIntoView?.({ block: "nearest" });
      }, [sel]);

      if (!open) return null;
      const React = window.React;
      const h = React.createElement;

      function renderModeTabs() {
        return h("div", { className: "cx-search-modes", role: "tablist" },
          ["text", "concept"].map(m =>
            h("button", {
              key: m,
              type: "button",
              role: "tab",
              "aria-selected": mode === m,
              className: "cx-search-mode-tab" + (mode === m ? " is-active" : ""),
              onClick: () => { setMode(m); setSel(0); inputRef.current?.focus(); },
            }, m === "text" ? "TEXT" : "CONCEPT")
          )
        );
      }

      function renderDots(score) {
        const filled = Math.max(0, Math.min(5, Math.round((score || 0) * 5)));
        const arr = [];
        for (let i = 0; i < 5; i++) {
          arr.push(h("span", {
            key: i,
            className: "cx-search-dot" + (i < filled ? " is-on" : ""),
          }));
        }
        return h("span", { className: "cx-search-dots", "aria-label": `relevance ${filled}/5` }, ...arr);
      }

      function renderConceptResults() {
        if (conceptStatus === "loading") {
          return h("ul", { className: "cx-search-results cx-search-concept-list", "aria-busy": "true" },
            [0,1,2,3,4].map(i =>
              h("li", { key: i, className: "cx-search-row cx-search-skel" },
                h("div", { className: "cx-search-skel-line cx-search-skel-ref" }),
                h("div", { className: "cx-search-skel-line cx-search-skel-text" }),
                h("div", { className: "cx-search-skel-line cx-search-skel-why" })
              )
            )
          );
        }
        if (conceptStatus === "error") {
          const kind = conceptErr?.kind;
          let msg;
          if (kind === "auth") {
            msg = "Concept search needs an AI key. Add one in Settings → AI Engines. Switch to TEXT for offline keyword search.";
          } else if (kind === "network") {
            msg = "Network error, try again. Switch to TEXT for offline keyword search.";
          } else {
            msg = (conceptErr?.message || "Concept search failed.") + " Switch to TEXT for offline keyword search.";
          }
          return h("div", { className: "cx-search-empty cx-search-concept-err" }, msg);
        }
        if (conceptStatus === "done" && conceptResults.length === 0 && q.trim()) {
          return h("div", { className: "cx-search-empty" }, "No concept matches. Try rephrasing.");
        }
        if (!conceptResults.length) return null;
        return h("ul",
          { className: "cx-search-results cx-search-concept-list", ref: listRef, role: "listbox" },
          conceptResults.map((r, i) =>
            h("li", {
              key: r.ref + "|" + i,
              "data-idx": i,
              className: "cx-search-row cx-search-concept-row" + (i === sel ? " is-sel" : "")
                + (r.bookId ? "" : " is-unjumpable"),
              role: "option",
              "aria-selected": i === sel,
              onMouseEnter: () => setSel(i),
              onClick: () => pickConcept(r),
              title: r.bookId ? "" : "Reference could not be resolved to a book id",
            },
              h("div", { className: "cx-search-concept-head" },
                h("b", { className: "cx-search-concept-ref" }, r.ref),
                renderDots(r.score)
              ),
              r.text
                ? h("div", { className: "cx-search-concept-text" }, r.text)
                : null,
              r.relevance
                ? h("div", { className: "cx-search-concept-why" }, r.relevance)
                : null
            )
          )
        );
      }

      const placeholder = mode === "concept"
        ? "Find passages about… (e.g. 'forgiveness', 'shepherd metaphors', 'words of Jesus on prayer')"
        : "search scripture · \"phrase\" · lov* · @KJV love";

      let footText;
      if (mode === "concept") {
        if (conceptStatus === "loading") footText = "asking the engine…";
        else if (conceptStatus === "done" && conceptFromCache) footText = "concept · cached · offline";
        else if (conceptStatus === "done") footText = `concept · ${conceptResults.length} result${conceptResults.length === 1 ? "" : "s"}`;
        else if (conceptStatus === "error") footText = "concept · error";
        else footText = "concept · powered by AI";
      } else {
        footText = stats
          ? `${stats.verses.toLocaleString()} verses · ${stats.translations} translation${stats.translations === 1 ? "" : "s"} · offline`
          : "indexing…";
      }

      return h("div",
        {
          className: "cx-search-backdrop",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": "Scripture search",
          onClick: () => onClose?.(),
        },
        h("div", { className: "cx-search-modal", onClick: (e) => e.stopPropagation() },
          renderModeTabs(),
          h("div", { className: "cx-search-bar" },
            h("span", { className: "cx-search-prompt" }, mode === "concept" ? "✦" : "›"),
            h("input", {
              ref: inputRef,
              className: "cx-search-input",
              type: "search",
              autoFocus: true,
              spellCheck: false,
              placeholder,
              value: q,
              onChange: (e) => setQ(e.target.value),
              onKeyDown,
              "data-cx-search": "1",
            }),
            h("span", { className: "cx-search-kbd" }, "ESC")
          ),
          mode === "text"
            ? (q.trim() && results.length === 0
                ? h("div", { className: "cx-search-empty" }, "No matches. Try fewer or different words.")
                : results.length
                  ? h("ul", { className: "cx-search-results", ref: listRef, role: "listbox" },
                      results.map((r, i) =>
                        h("li", {
                          key: r.ref + "|" + r.translation,
                          "data-idx": i,
                          className: "cx-search-row" + (i === sel ? " is-sel" : ""),
                          role: "option",
                          "aria-selected": i === sel,
                          onMouseEnter: () => setSel(i),
                          onClick: () => pickText(r),
                        },
                          h("div", { className: "cx-search-ref" },
                            h("span", { className: "cx-search-trans" }, `[${r.translation.toUpperCase()}]`),
                            " ",
                            h("b", null, r.pretty.label)
                          ),
                          h("div", {
                            className: "cx-search-snippet",
                            dangerouslySetInnerHTML: { __html: r.snippet },
                          })
                        )
                      )
                    )
                  : null
              )
            : renderConceptResults(),
          h("div", { className: "cx-search-foot" },
            footText,
            h("span", { className: "cx-search-hint" }, "↑↓ navigate · ↵ open · esc close")
          )
        )
      );
    }

    window.CODEX_SearchBar = SearchBar;
  }
})();
