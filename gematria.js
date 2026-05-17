// CODEX — Gematria compute library + cross-reference index.
//
// Pure functions for every major Hebrew/Greek/English numerological system.
// No React, no DOM. Exposes:
//   window.CODEX_GEMATRIA — pure compute functions
//   window.CODEX_GEMATRIA_INDEX — async index over cached verses
//
// All Hebrew/Greek input is normalized (NFD + strip combining marks) so
// "λόγος" → 373 and pointed Hebrew "אַ֫הֲבָ֖ה" → 13.
//
// References for the systems implemented are in data/help/articles.json
// under the "gematria-deep" help article — read that for the math.

(function () {
  // ── normalization ────────────────────────────────────────────────────
  function strip(s) {
    return (s || "").normalize("NFD").replace(/\p{M}/gu, "");
  }
  function lower(s) { return strip(s).toLowerCase(); }

  // ── alphabets / tables ───────────────────────────────────────────────
  // Hebrew base values (Mispar Hechrachi). Finals collapse to base by default;
  // finals500 lifts them (כ=500..ץ=900) — useful when explicitly requested.
  const HEBREW_BASE = {
    א:1, ב:2, ג:3, ד:4, ה:5, ו:6, ז:7, ח:8, ט:9,
    י:10, כ:20, ל:30, מ:40, נ:50, ס:60, ע:70, פ:80, צ:90,
    ק:100, ר:200, ש:300, ת:400,
    // finals collapse by default
    ך:20, ם:40, ן:50, ף:80, ץ:90,
  };
  const HEBREW_FINALS500 = { ך:500, ם:600, ן:700, ף:800, ץ:900 };
  const HEBREW_ORDER = "אבגדהוזחטיכלמנסעפצקרשת";
  const HEBREW_ORDINAL = (() => {
    const o = {};
    [...HEBREW_ORDER].forEach((c, i) => { o[c] = i + 1; });
    // finals = same ordinal as their base form
    o["ך"] = o["כ"]; o["ם"] = o["מ"]; o["ן"] = o["נ"]; o["ף"] = o["פ"]; o["ץ"] = o["צ"];
    return o;
  })();
  // Spelled-out letter NAMES (used by Mispar Neelam — "hidden" = name minus first letter)
  const HEBREW_NAMES = {
    א: "אלף", ב: "בית", ג: "גימל", ד: "דלת", ה: "הא",
    ו: "וו", ז: "זין", ח: "חית", ט: "טית", י: "יוד",
    כ: "כף", ל: "למד", מ: "מם", נ: "נון", ס: "סמך",
    ע: "עין", פ: "פא", צ: "צדי", ק: "קוף", ר: "ריש",
    ש: "שין", ת: "תיו",
  };

  // Greek isopsephy (classical 27-letter set; stigma/koppa/sampi for 6/90/900)
  const GREEK_BASE = {
    α:1, β:2, γ:3, δ:4, ε:5, ϛ:6, ζ:7, η:8, θ:9,
    ι:10, κ:20, λ:30, μ:40, ν:50, ξ:60, ο:70, π:80, ϟ:90,
    ρ:100, σ:200, ς:200, τ:300, υ:400, φ:500, χ:600, ψ:700, ω:800, ϡ:900,
  };
  const GREEK_ORDER = "αβγδεζηθικλμνξοπρστυφχψω"; // ordinal 1..24
  const GREEK_ORDINAL = (() => {
    const o = {};
    [...GREEK_ORDER].forEach((c, i) => { o[c] = i + 1; });
    o["ς"] = o["σ"];
    return o;
  })();

  // ── helpers ──────────────────────────────────────────────────────────
  function isHebrew(s) { return /[֐-׿]/.test(s); }
  function isGreek(s)  { return /[Ͱ-Ͽἀ-῿]/.test(s); }
  function detectLang(s) {
    if (!s) return "english";
    if (isHebrew(s)) return "hebrew";
    if (isGreek(s)) return "greek";
    return "english";
  }
  function reduceToDigit(n) {
    n = Math.abs(n | 0);
    while (n > 9) n = String(n).split("").reduce((s, d) => s + +d, 0);
    return n;
  }
  function triangular(n) { return (n * (n + 1)) / 2; }

  // ── HEBREW SYSTEMS ───────────────────────────────────────────────────
  function _hebSum(s, table) {
    let n = 0;
    for (const ch of lower(s)) if (table[ch]) n += table[ch];
    return n;
  }
  function mispar_hechrachi(s) { return _hebSum(s, HEBREW_BASE); }
  function mispar_gadol(s)     { return _hebSum(s, { ...HEBREW_BASE, ...HEBREW_FINALS500 }); }
  function mispar_sidduri(s)   { return _hebSum(s, HEBREW_ORDINAL); }
  function mispar_katan(s) {
    // each letter reduced to single digit, then summed
    let n = 0;
    for (const ch of lower(s)) {
      const v = HEBREW_BASE[ch];
      if (v) n += reduceToDigit(v);
    }
    return n;
  }
  function mispar_katan_mispari(s) {
    // sum then reduce to single digit
    return reduceToDigit(mispar_hechrachi(s));
  }
  function mispar_boneh(s) {
    // "building" — cumulative sum: a + (a+b) + (a+b+c) ...
    let running = 0, total = 0;
    for (const ch of lower(s)) {
      const v = HEBREW_BASE[ch];
      if (v) { running += v; total += running; }
    }
    return total;
  }
  // Triangular value of each letter ("Mispar Kidmi" sometimes called)
  function mispar_kidmi(s) {
    let n = 0;
    for (const ch of lower(s)) {
      const v = HEBREW_BASE[ch];
      if (v) {
        // sum 1..v but only over alphabet values — common defn is triangular(v)
        n += triangular(v);
      }
    }
    return n;
  }
  // Atbash: א↔ת, ב↔ש, ... swap from each end of the 22-letter alphabet
  function atbash(s) {
    const ABC = HEBREW_ORDER;
    let out = "";
    for (const ch of lower(s)) {
      const i = ABC.indexOf(ch);
      if (i >= 0) out += ABC[ABC.length - 1 - i];
      else if (HEBREW_NAMES[ch] === undefined && /[֐-׿]/.test(ch)) {
        // finals: map to base then swap
        const base = ch === "ך" ? "כ" : ch === "ם" ? "מ" : ch === "ן" ? "נ" : ch === "ף" ? "פ" : ch === "ץ" ? "צ" : "";
        if (base) { const j = ABC.indexOf(base); if (j >= 0) out += ABC[ABC.length - 1 - j]; }
      }
    }
    return { transformed: out, value: mispar_hechrachi(out) };
  }
  // Albam: split alphabet in half, swap halves (א↔ל, ב↔מ, ...)
  function albam(s) {
    const ABC = HEBREW_ORDER, H = 11;
    let out = "";
    for (const ch of lower(s)) {
      const i = ABC.indexOf(ch);
      if (i >= 0) out += ABC[(i + H) % 22];
    }
    return { transformed: out, value: mispar_hechrachi(out) };
  }
  // Mispar Ne'elam ("hidden") — value of the spelled-out name MINUS the letter itself
  function mispar_neelam(s) {
    let n = 0;
    for (const ch of lower(s)) {
      const name = HEBREW_NAMES[ch];
      if (!name) continue;
      n += mispar_hechrachi(name) - (HEBREW_BASE[ch] || 0);
    }
    return n;
  }
  // Mispar Ha'akhor ("back") — first letter = 22*1, last = 22*22 in one variant.
  // Common defn: letter at position i (1..n) contributes value(letter) * i
  function mispar_haakhor(s) {
    let n = 0, i = 1;
    for (const ch of lower(s)) {
      const v = HEBREW_BASE[ch];
      if (v) { n += v * i; i++; }
    }
    return n;
  }

  // ── GREEK SYSTEMS ────────────────────────────────────────────────────
  function isopsephy_standard(s) {
    let n = 0;
    for (const ch of lower(s)) if (GREEK_BASE[ch]) n += GREEK_BASE[ch];
    return n;
  }
  function isopsephy_ordinal(s) {
    let n = 0;
    for (const ch of lower(s)) if (GREEK_ORDINAL[ch]) n += GREEK_ORDINAL[ch];
    return n;
  }
  function isopsephy_reduced(s) { return reduceToDigit(isopsephy_standard(s)); }

  // ── ENGLISH SYSTEMS ──────────────────────────────────────────────────
  function english_ordinal(s) {
    let n = 0;
    for (const ch of (s || "").toLowerCase()) {
      const c = ch.charCodeAt(0);
      if (c >= 97 && c <= 122) n += c - 96;
    }
    return n;
  }
  function english_reduction(s) {
    let n = 0;
    for (const ch of (s || "").toLowerCase()) {
      const c = ch.charCodeAt(0);
      if (c >= 97 && c <= 122) {
        const ord = c - 96;
        n += ((ord - 1) % 9) + 1;
      }
    }
    return n;
  }
  function english_reverse(s) {
    let n = 0;
    for (const ch of (s || "").toLowerCase()) {
      const c = ch.charCodeAt(0);
      if (c >= 97 && c <= 122) n += 27 - (c - 96);
    }
    return n;
  }

  // ── BUNDLE: compute all applicable systems ───────────────────────────
  function all(text, lang) {
    const L = lang || detectLang(text);
    if (L === "hebrew") {
      return {
        lang: "hebrew",
        hechrachi: mispar_hechrachi(text),
        gadol: mispar_gadol(text),
        sidduri: mispar_sidduri(text),
        katan: mispar_katan(text),
        katan_mispari: mispar_katan_mispari(text),
        boneh: mispar_boneh(text),
        kidmi: mispar_kidmi(text),
        atbash: atbash(text),
        albam: albam(text),
        neelam: mispar_neelam(text),
        haakhor: mispar_haakhor(text),
      };
    }
    if (L === "greek") {
      return {
        lang: "greek",
        isopsephy: isopsephy_standard(text),
        ordinal: isopsephy_ordinal(text),
        reduced: isopsephy_reduced(text),
      };
    }
    return {
      lang: "english",
      ordinal: english_ordinal(text),
      reduction: english_reduction(text),
      reverse: english_reverse(text),
    };
  }

  window.CODEX_GEMATRIA = {
    detectLang, strip,
    hebrew: {
      hechrachi: mispar_hechrachi, gadol: mispar_gadol, sidduri: mispar_sidduri,
      katan: mispar_katan, katan_mispari: mispar_katan_mispari,
      boneh: mispar_boneh, kidmi: mispar_kidmi,
      atbash, albam, neelam: mispar_neelam, haakhor: mispar_haakhor,
    },
    greek:   { isopsephy: isopsephy_standard, ordinal: isopsephy_ordinal, reduced: isopsephy_reduced },
    english: { ordinal: english_ordinal, reduction: english_reduction, reverse: english_reverse },
    all,
  };

  // ════════════════════════════════════════════════════════════════════
  // CROSS-REFERENCE INDEX over the user's cached verses
  // ════════════════════════════════════════════════════════════════════
  // Strategy: scan localStorage["codex.bible.cache.v2"] (fallback) AND
  // BIBLE._memCache (preferred — reaches IDB-loaded verses). For each
  // verse, compute a "word-level" value list and group by primary system
  // (hechrachi for Hebrew, isopsephy for Greek, ordinal for English).
  // Persist {value: [{ref, word, system}]} to localStorage so subsequent
  // panel opens are instant. Re-index when bible:bundle-loaded fires.

  const INDEX_KEY = "codex.gematria.index.v1";
  const MAX_PER_VALUE = 50;
  let _index = null;
  let _building = false;
  let _builtAt = 0;

  function loadIndexFromStorage() {
    try {
      const raw = localStorage.getItem(INDEX_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed._v === 1) {
        _builtAt = parsed.builtAt || 0;
        return parsed.index || {};
      }
    } catch {}
    return null;
  }
  function saveIndex() {
    try {
      const payload = { _v: 1, builtAt: Date.now(), index: _index };
      localStorage.setItem(INDEX_KEY, JSON.stringify(payload));
      _builtAt = payload.builtAt;
    } catch (e) { /* over-quota — silently drop */ }
  }

  // tokens: words split on whitespace / punctuation. Keeps Hebrew + Greek
  // intact (those scripts have their own punctuation).
  function tokenize(verseText) {
    return (verseText || "")
      .replace(/[֑-ֽֿׁ-ׇ׳״]/g, "")  // hebrew niqqud/cantillation/punct
      .split(/[\s.,;:!?·"׳״״«»()\[\]{}‐-—]+/)
      .filter(w => w && w.length >= 2);
  }

  function pushMatch(value, system, ref, word) {
    if (!value || value < 2) return;   // skip 0/1 noise
    const bucket = _index[value] || (_index[value] = []);
    if (bucket.length >= MAX_PER_VALUE) return;
    // dedupe: same ref+word+system
    for (const m of bucket) if (m.ref === ref && m.word === word && m.system === system) return;
    bucket.push({ ref, word, system });
  }

  function refForVerse(bookId, chapter, verseNum) {
    return `${bookId}.${chapter}.${verseNum}`;
  }

  // Yield to the event loop every N verses so the UI doesn't freeze
  function yieldTick() { return new Promise(r => setTimeout(r, 0)); }

  // Read the chapters store directly from bible.js's IndexedDB. Mirrors
  // the schema in bible.js: DB "codex", object store "chapters", value
  // shape { verses: string[], fetchedAt, source, translation }.
  function readChaptersFromIDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return resolve({});
      let req;
      try { req = indexedDB.open("codex"); }
      catch (e) { return resolve({}); }
      req.onerror = () => resolve({});
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("chapters")) { db.close(); return resolve({}); }
        const out = {};
        try {
          const tx = db.transaction("chapters", "readonly");
          const cur = tx.objectStore("chapters").openCursor();
          cur.onsuccess = (e) => {
            const c = e.target.result;
            if (c) {
              const v = c.value;
              if (v && Array.isArray(v.verses)) out[c.key] = v.verses;
              c.continue();
            } else { db.close(); resolve(out); }
          };
          cur.onerror = () => { db.close(); resolve(out); };
        } catch { db.close(); resolve({}); }
      };
    });
  }

  async function build(opts = {}) {
    if (_building) return _index;
    _building = true;
    if (!_index) _index = {};

    // Snapshot the BIBLE mem cache. Keys are `bookId.chapter.translation`,
    // values are arrays of verse strings (1-indexed by position).
    let cache = {};
    try {
      if (window.BIBLE && window.BIBLE.ready) await window.BIBLE.ready;
    } catch {}
    // Primary: read directly from the same IndexedDB store bible.js uses
    // ("codex" / "chapters"). Each record's value is { verses, ... }.
    try {
      cache = await readChaptersFromIDB();
    } catch {}
    // Fallbacks: anything bible.js exposed, then legacy localStorage blob.
    if (!cache || !Object.keys(cache).length) {
      try { cache = (window.BIBLE && window.BIBLE._memCache) || {}; } catch {}
    }
    if (!cache || !Object.keys(cache).length) {
      try {
        const raw = localStorage.getItem("codex.bible.cache.v2");
        if (raw) cache = JSON.parse(raw);
      } catch { cache = {}; }
    }
    cache = cache || {};

    let processed = 0;
    for (const key of Object.keys(cache)) {
      const parts = key.split(".");
      if (parts.length < 3) continue;
      const bookId = parts[0], chapter = parts[1];
      const verses = cache[key];
      if (!Array.isArray(verses)) continue;
      for (let i = 0; i < verses.length; i++) {
        const text = typeof verses[i] === "string" ? verses[i] : (verses[i]?.text || "");
        const ref = refForVerse(bookId, chapter, i + 1);
        const tokens = tokenize(text);
        for (const tok of tokens) {
          const lang = detectLang(tok);
          if (lang === "hebrew") {
            const v = mispar_hechrachi(tok);
            if (v) pushMatch(v, "hechrachi", ref, tok);
          } else if (lang === "greek") {
            const v = isopsephy_standard(tok);
            if (v) pushMatch(v, "isopsephy", ref, tok);
          } else {
            // English: only index reasonably substantive words (avoid 'the', 'a' noise)
            if (tok.length < 4) continue;
            const v = english_ordinal(tok);
            if (v) pushMatch(v, "en_ordinal", ref, tok);
          }
        }
        processed++;
        if (processed % 1000 === 0) await yieldTick();
      }
    }
    saveIndex();
    _building = false;
    try { window.dispatchEvent(new CustomEvent("codex:gematria:indexed", { detail: { values: Object.keys(_index).length, builtAt: _builtAt } })); } catch {}
    return _index;
  }

  function find(value, opts = {}) {
    if (!_index) return [];
    const arr = _index[value] || [];
    const sys = opts.system;
    return sys ? arr.filter(m => m.system === sys) : arr.slice();
  }

  function stats() {
    if (!_index) return { values: 0, matches: 0, builtAt: 0 };
    let total = 0;
    for (const k of Object.keys(_index)) total += _index[k].length;
    return { values: Object.keys(_index).length, matches: total, builtAt: _builtAt };
  }

  function reset() {
    _index = {};
    try { localStorage.removeItem(INDEX_KEY); } catch {}
    _builtAt = 0;
  }

  // Bootstrap: load persisted index if present so first open is instant.
  _index = loadIndexFromStorage() || null;

  // Re-index opportunistically when new content lands
  try {
    window.addEventListener("codex:bible:bundle-loaded", () => {
      // throttled rebuild
      if (Date.now() - _builtAt > 60_000) build().catch(() => {});
    });
  } catch {}

  window.CODEX_GEMATRIA_INDEX = {
    build, find, stats, reset,
    ensure: async () => { if (!_index || stats().values === 0) await build(); return _index; },
  };
})();
