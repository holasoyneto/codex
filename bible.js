// ── CODEX scripture loader ──────────────────────────────────────────────────
// Public-domain translations served by bible-api.com (CORS-enabled, free).
// Every chapter we fetch is cached in localStorage forever so re-reads are
// instant and offline-tolerant. Mirrors all known PD translations available:
//
//   kjv         King James 1611
//   web         World English Bible 2000
//   bbe         Bible in Basic English 1949
//   oeb-cw      Open English Bible (Commonwealth) 2014
//   webbe       World English (British edn) 2000
//   clementine  Vulgata Clementina 1592 (Latin)
//
// API returns: { verses: [{ book_id, book_name, chapter, verse, text }], … }

window.BIBLE = (function () {
  const API = "https://bible-api.com";
  const BOLLS = "https://bolls.life";
  const CACHE_KEY = "codex.bible.cache.v2";

  // bookId → bolls.life numeric book id (1=Genesis … 66=Revelation).
  const BOOK_BOLLS = {
    gen:1, exo:2, lev:3, num:4, deu:5, jos:6, jdg:7, rut:8,
    "1sa":9, "2sa":10, "1ki":11, "2ki":12, "1ch":13, "2ch":14,
    ezr:15, neh:16, est:17, job:18, psa:19, pro:20, ecc:21, sng:22,
    isa:23, jer:24, lam:25, ezk:26, dan:27, hos:28, jol:29, amo:30,
    oba:31, jon:32, mic:33, nam:34, hab:35, zep:36, hag:37, zec:38, mal:39,
    mat:40, mrk:41, luk:42, jhn:43, act:44, rom:45,
    "1co":46, "2co":47, gal:48, eph:49, php:50, col:51,
    "1th":52, "2th":53, "1ti":54, "2ti":55, tit:56, phm:57, heb:58, jas:59,
    "1pe":60, "2pe":61, "1jn":62, "2jn":63, "3jn":64, jud:65, rev:66,
  };

  // Resolve a translation id → { source, apiId } via window.CODEX_DATA.
  function resolveTranslation(t) {
    const reg = (window.CODEX_DATA?.translations || []).find(x => x.id === t);
    if (reg) return { source: reg.source || "bible-api", apiId: reg.apiId || t };
    return { source: "bible-api", apiId: t };
  }

  // Local book id → bible-api book slug.
  const BOOK_API = {
    gen: "genesis", exo: "exodus", lev: "leviticus", num: "numbers", deu: "deuteronomy",
    jos: "joshua", jdg: "judges", rut: "ruth", "1sa": "1 samuel", "2sa": "2 samuel",
    "1ki": "1 kings", "2ki": "2 kings", "1ch": "1 chronicles", "2ch": "2 chronicles",
    ezr: "ezra", neh: "nehemiah", est: "esther", job: "job", psa: "psalms",
    pro: "proverbs", ecc: "ecclesiastes", sng: "song of solomon", isa: "isaiah",
    jer: "jeremiah", lam: "lamentations", ezk: "ezekiel", dan: "daniel",
    hos: "hosea", jol: "joel", amo: "amos", oba: "obadiah", jon: "jonah",
    mic: "micah", nam: "nahum", hab: "habakkuk", zep: "zephaniah", hag: "haggai",
    zec: "zechariah", mal: "malachi",
    mat: "matthew", mrk: "mark", luk: "luke", jhn: "john", act: "acts",
    rom: "romans", "1co": "1 corinthians", "2co": "2 corinthians", gal: "galatians",
    eph: "ephesians", php: "philippians", col: "colossians",
    "1th": "1 thessalonians", "2th": "2 thessalonians",
    "1ti": "1 timothy", "2ti": "2 timothy", tit: "titus", phm: "philemon",
    heb: "hebrews", jas: "james", "1pe": "1 peter", "2pe": "2 peter",
    "1jn": "1 john", "2jn": "2 john", "3jn": "3 john", jud: "jude", rev: "revelation",
  };

  // ─────────────────────────────────────────────────────────────────────
  // STORAGE · Phase A · IndexedDB-backed durable store + sync mem mirror
  // ─────────────────────────────────────────────────────────────────────
  // Keep the same `loadChapter` API as before. _memCache is a sync read
  // mirror so cacheStats() / readOffline() / verifyTranslation() can stay
  // synchronous. IndexedDB is the durable backend (10–100× the localStorage
  // 5MB cap, async transactions, no read-modify-write race).
  //
  // Schema:
  //   DB "codex" v1
  //     store "chapters"  key "bookId.chapter.translation" → {verses, fetchedAt, source, pinned}
  //                       index "translation"
  //     store "meta"      key string → any
  //
  // First run: copy any legacy localStorage["codex.bible.cache.v2"] into
  // IDB transparently, mark migrated, drop the LS key. User loses nothing.
  const DB_NAME = "codex";
  const DB_VERSION = 1;
  const STORE_CHAPTERS = "chapters";
  const STORE_META = "meta";
  const MIGRATED_FLAG = "migrated.from.ls.v2";

  let _db = null;
  let _memCache = {};
  const _dirty = new Set();
  let _flushTimer = null;

  function _openDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error("IndexedDB unavailable"));
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_CHAPTERS)) {
          const s = db.createObjectStore(STORE_CHAPTERS);
          s.createIndex("translation", "translation", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }
  function _idbReq(store, mode, op) {
    return new Promise((resolve, reject) => {
      if (!_db) return reject(new Error("DB not open"));
      const tx = _db.transaction(store, mode);
      const s = tx.objectStore(store);
      const r = op(s);
      if (r && r.onsuccess !== undefined) {
        r.onsuccess = () => resolve(r.result);
        r.onerror   = () => reject(r.error);
      } else {
        tx.oncomplete = () => resolve();
        tx.onerror    = () => reject(tx.error);
      }
    });
  }
  function _metaGet(k) { return _idbReq(STORE_META, "readonly",  s => s.get(k)); }
  function _metaSet(k, v) { return _idbReq(STORE_META, "readwrite", s => s.put(v, k)); }
  function _putBatch(entries) {
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(STORE_CHAPTERS, "readwrite");
      const store = tx.objectStore(STORE_CHAPTERS);
      for (const { key, value } of entries) store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  }

  async function _loadAllToMem() {
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(STORE_CHAPTERS, "readonly");
      const req = tx.objectStore(STORE_CHAPTERS).openCursor();
      req.onsuccess = (e) => {
        const c = e.target.result;
        if (c) {
          // Stored shape: { verses, fetchedAt, source, pinned, translation }.
          // Mem mirror exposes just the verses array (legacy contract).
          _memCache[c.key] = c.value.verses;
          c.continue();
        } else resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function _migrateFromLocalStorage() {
    let legacy;
    try { legacy = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); }
    catch { legacy = {}; }
    const entries = Object.entries(legacy);
    if (entries.length === 0) return 0;
    const now = Date.now();
    const batch = entries.map(([key, verses]) => {
      const parts = key.split(".");
      const translation = parts[parts.length - 1];
      return {
        key,
        value: { verses, fetchedAt: now, source: "legacy-localStorage", pinned: true, translation },
      };
    });
    await _putBatch(batch);
    for (const [key, verses] of entries) _memCache[key] = verses;
    try { localStorage.removeItem(CACHE_KEY); } catch {}   // free the 5MB
    return entries.length;
  }

  // Public init promise — anything async-aware should `await BIBLE.ready`.
  // loadChapter / loadMulti always await this internally so existing
  // sync-flavored call sites need no change.
  const _ready = (async () => {
    try {
      _db = await _openDB();
      await _loadAllToMem();
      const migrated = await _metaGet(MIGRATED_FLAG);
      if (!migrated) {
        const n = await _migrateFromLocalStorage();
        await _metaSet(MIGRATED_FLAG, { at: Date.now(), count: n });
      }
    } catch (e) {
      // IDB unavailable (private mode in some browsers, etc.) — fall back
      // to legacy localStorage so the app still works, just smaller.
      console.warn("BIBLE: IDB unavailable, using localStorage fallback:", e);
      try { _memCache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); }
      catch { _memCache = {}; }
    }
    // Notify listeners (Settings panel re-derives from cache after init).
    try { window.dispatchEvent(new CustomEvent("codex:bible:ready")); } catch {}
  })();

  function _scheduleFlush() {
    if (_flushTimer) return;
    _flushTimer = setTimeout(() => { _flushTimer = null; _flushDirty(); }, 200);
  }
  async function _flushDirty() {
    if (_dirty.size === 0) return;
    const keys = [..._dirty];
    _dirty.clear();
    if (!_db) {
      // Fallback path — write the full mem blob to localStorage with the
      // 4.5MB safety. Kept for browsers that block IDB (rare).
      try {
        const s = JSON.stringify(_memCache);
        if (s.length > 4_500_000) {
          const ks = Object.keys(_memCache);
          ks.slice(0, Math.floor(ks.length / 2)).forEach(k => delete _memCache[k]);
          localStorage.setItem(CACHE_KEY, JSON.stringify(_memCache));
        } else localStorage.setItem(CACHE_KEY, s);
      } catch {}
      return;
    }
    const now = Date.now();
    const batch = keys.map(key => {
      const parts = key.split(".");
      const translation = parts[parts.length - 1];
      return { key, value: { verses: _memCache[key], fetchedAt: now, source: "fetch", pinned: true, translation } };
    });
    try { await _putBatch(batch); } catch (e) { console.warn("IDB flush failed:", e); }
  }

  // Legacy shims so older code paths keep working.
  function ensureCache() { return _memCache; }
  function readCache()  { return _memCache; }
  function writeCache(c) {
    // legacy "replace whole cache" callers — diff against existing and mark dirty.
    for (const k of Object.keys(c)) {
      if (_memCache[k] !== c[k]) { _memCache[k] = c[k]; _dirty.add(k); }
    }
    for (const k of Object.keys(_memCache)) {
      if (!(k in c)) {
        delete _memCache[k];
        if (_db) _idbReq(STORE_CHAPTERS, "readwrite", s => s.delete(k)).catch(()=>{});
      }
    }
    _scheduleFlush();
  }

  // ─────────────────────────────────────────────────────────────────────
  // PHASE B · Source-resolution chain + bundle hook for Phase C
  // ─────────────────────────────────────────────────────────────────────
  // Each translation has an implicit source priority chain:
  //   1. Pre-baked bundle (if t.bundle defined and not yet loaded)
  //   2. Primary source: `source` + `apiId`
  //   3. Mirrors: t.mirrors = [{kind, apiId}, ...] (optional)
  // If the primary fails (rate limit, outage, network), we fall through
  // to mirrors before reporting failure. This is how the offline catalog
  // becomes resilient — bolls.life going down doesn't kill 20 translations.
  function _sourceChain(t) {
    if (!t) return [];
    const chain = [];
    if (t.source && t.apiId) chain.push({ kind: t.source, apiId: t.apiId });
    if (Array.isArray(t.mirrors)) for (const m of t.mirrors) chain.push(m);
    return chain;
  }

  // ── Bundle loader · Phase C foundation ──────────────────────────────
  // First read of a bundle-equipped translation triggers a single fetch
  // of the static JSON file shipped with the app (e.g. /data/bibles/kjv.json).
  // Once parsed, every chapter writes into IDB and the mem mirror in one
  // transaction. Subsequent reads hit the cache instantly. If the file
  // doesn't exist (404) we fall through to the network-source chain.
  // Bundle file format:
  //   { translation: "kjv", version: 1, chapters: { "jhn.1": [verses], ... } }
  const _bundleStatus = new Map();   // translation → "loading" | "loaded" | "failed" | "skip"
  async function _loadBundleOnce(t) {
    if (!t?.bundle) return false;
    const status = _bundleStatus.get(t.id);
    if (status === "loaded" || status === "skip" || status === "failed") return status === "loaded";
    if (status === "loading") {
      // Wait for the in-flight load to finish
      while (_bundleStatus.get(t.id) === "loading") {
        await new Promise(r => setTimeout(r, 50));
      }
      return _bundleStatus.get(t.id) === "loaded";
    }
    _bundleStatus.set(t.id, "loading");
    try {
      const r = await fetch(t.bundle, { cache: "force-cache" });
      if (!r.ok) {
        _bundleStatus.set(t.id, r.status === 404 ? "skip" : "failed");
        return false;
      }
      const data = await r.json();
      if (!data?.chapters || typeof data.chapters !== "object") {
        _bundleStatus.set(t.id, "failed");
        return false;
      }
      // Bulk-write everything into IDB + mem in one transaction.
      const now = Date.now();
      const batch = [];
      for (const [bookCh, verses] of Object.entries(data.chapters)) {
        const key = `${bookCh}.${t.id}`;
        if (!Array.isArray(verses) || verses.length === 0) continue;
        _memCache[key] = verses;
        batch.push({ key, value: { verses, fetchedAt: now, source: "bundle", pinned: true, translation: t.id } });
      }
      if (_db && batch.length) await _putBatch(batch);
      _bundleStatus.set(t.id, "loaded");
      try { window.dispatchEvent(new CustomEvent("codex:bible:bundle-loaded", { detail: { translation: t.id, count: batch.length } })); } catch {}
      return true;
    } catch (e) {
      _bundleStatus.set(t.id, "failed");
      console.warn(`bundle load failed for ${t.id}:`, e);
      return false;
    }
  }

  // Try ONE source. Returns parsed verses on success, throws on failure.
  async function _fetchFromSource(src, bookId, chapter, translation) {
    if (src.kind === "bolls") {
      const bookNum = BOOK_BOLLS[bookId];
      if (!bookNum) throw new Error("Unknown book: " + bookId);
      const url = `${BOLLS}/get-text/${src.apiId}/${bookNum}/${chapter}/`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`bolls ${translation} ${bookId} ${chapter}: ${r.status}`);
      const data = await r.json();
      return (Array.isArray(data) ? data : []).map(v => ({
        n: v.verse,
        text: String(v.text || "")
          .replace(/<[^>]+>/g, "")
          // bolls.life leaks Strong's numbers — sometimes glued to the
          // preceding word ("man444"), sometimes standalone ("man 444 that").
          // Strip both forms. Two-or-more digit standalones are always
          // markup leakage; scripture text never carries inline integers.
          .replace(/(?<=[a-zA-ZéÀ-ſ'])\d+/g, "")
          .replace(/(?:^|\s)\d{2,5}(?=\s|[.,;:!?)—–-]|$)/g, " ")
          .replace(/\s+/g, " ").trim(),
      }));
    }
    if (src.kind === "bible-api") {
      const slug = BOOK_API[bookId];
      if (!slug) throw new Error("Unknown book: " + bookId);
      const isLatin = src.apiId === "clementine";
      const lookup = isLatin ? bookId.toUpperCase() : slug;
      const url = `${API}/${encodeURIComponent(lookup)}+${chapter}?translation=${src.apiId}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`bible-api ${translation} ${lookup} ${chapter}: ${r.status}`);
      const data = await r.json();
      return (data.verses || []).map(v => ({
        n: v.verse,
        text: String(v.text || "").replace(/\s+/g, " ").trim(),
      }));
    }
    if (src.kind === "bundle") {
      // Static-bundle source — fetch a JSON file shipped with the app
      // (or hosted at any same-origin URL). Used for translations whose
      // canon includes books no public CORS API serves (Enoch, Jubilees,
      // Meqabyan, etc.). Layout: { [bookId]: { [chapter]: [{n,text}] } }
      // Per-chapter fallback. _loadBundleOnce already bulk-loads the whole
      // file on first access for translations with `bundle:`, so this path
      // only runs for ad-hoc bundle-only translations without that field.
      const t = (window.CODEX_DATA?.translations || []).find(x => x.id === translation);
      const url = src.bundleUrl || t?.bundle || `data/bibles/${src.apiId}.json`;
      const placeholderVerse = () => ([{
        n: 1,
        text: `[${t?.name || translation}] · Text not yet bundled. The registry knows this translation, but the public-domain payload has not been integrated into the app yet. Switch translations from the right rail to read this chapter.`,
      }]);
      try {
        const r = await fetch(url, { cache: "force-cache" });
        if (!r.ok) {
          if (t?.placeholder) return placeholderVerse();
          throw new Error(`bundle ${translation} ${bookId} ${chapter}: ${r.status}`);
        }
        const data = await r.json();
        const flatKey = `${bookId}.${chapter}`;
        const ch = (data && data.chapters && data.chapters[flatKey])
                || (data && data[bookId] && data[bookId][chapter]);
        if (!Array.isArray(ch)) {
          if (t?.placeholder) return placeholderVerse();
          throw new Error(`bundle ${translation}: ${flatKey} not in bundle`);
        }
        return ch.map(v => ({ n: v.n || v.verse, text: String(v.text || "").replace(/\s+/g, " ").trim() }));
      } catch (e) {
        if (t?.placeholder) return placeholderVerse();
        throw e;
      }
    }
    throw new Error("Unknown source kind: " + src.kind);
  }

  // Re-sanitise verses on every read. Older cache entries (from before
  // the Strong's-number leak was patched) may still contain stray "444"
  // / "G2316" tokens from bolls.life — this scrub applies idempotently
  // so users see clean text the moment they upgrade, without us having
  // to nuke their offline verse cache.
  function _scrubVerses(verses) {
    if (!Array.isArray(verses)) return verses;
    let mutated = false;
    const out = verses.map(v => {
      const orig = String(v.text || "");
      const clean = orig
        .replace(/(?<=[a-zA-ZéÀ-ſ'])\d+/g, "")
        .replace(/(?:^|\s)\d{2,5}(?=\s|[.,;:!?)—–-]|$)/g, " ")
        .replace(/\s+/g, " ").trim();
      if (clean !== orig) mutated = true;
      return mutated ? { ...v, text: clean } : v;
    });
    return mutated ? out : verses;
  }

  async function loadChapter(bookId, chapter, translation) {
    if (_ready) await _ready;
    const key = `${bookId}.${chapter}.${translation}`;
    if (_memCache[key]) {
      const scrubbed = _scrubVerses(_memCache[key]);
      if (scrubbed !== _memCache[key]) {
        _memCache[key] = scrubbed;
        _dirty.add(key); _scheduleFlush();
      }
      return _memCache[key];
    }

    // Phase B/C: try the pre-baked bundle first ONLY when explicitly
    // declared on the translation (`t.bundle` is a string path, or
    // `t.bundle === true` to use the convention path). No bundle field =
    // no probe, so the streaming case (open any translation with internet
    // and read instantly) takes zero extra round-trips.
    const t = (window.CODEX_DATA?.translations || []).find(x => x.id === translation);
    if (t?.bundle && _bundleStatus.get(translation) !== "skip" && _bundleStatus.get(translation) !== "failed") {
      const bundlePath = typeof t.bundle === "string" ? t.bundle : `/data/bibles/${translation}.json`;
      await _loadBundleOnce({ ...t, bundle: bundlePath });
      if (_memCache[key]) return _memCache[key];
    }

    // Try each network source in priority order.
    const chain = _sourceChain(t);
    let lastErr = null;
    for (const src of chain) {
      try {
        const verses = await _fetchFromSource(src, bookId, chapter, translation);
        _memCache[key] = verses;
        _dirty.add(key);
        _scheduleFlush();
        return verses;
      } catch (e) {
        lastErr = e;
        // try next source
      }
    }
    if (chain.length === 0) throw new Error(`No source for translation: ${translation}`);
    throw lastErr || new Error(`All sources failed for ${translation} ${bookId} ${chapter}`);
  }

  // ── Red-letter detection ───────────────────────────────────────────────────
  // Marks Jesus's spoken words in red. Two strategies:
  //   1. Modern translations (smart quotes): track quote pairs across verses,
  //      decide if the opener was attributed to Jesus.
  //   2. KJV-style (no quotes): match "Jesus said,"-type patterns and mark
  //      from after the comma to the end of the speech (next narrative break).

  const RED_LETTER_BOOKS = new Set(["mat", "mrk", "luk", "jhn", "rev"]);

  // ── Red-letter NEGATIVE MASK ──────────────────────────────────────────
  // The cross-translation heuristic has high recall but poor precision —
  // it can't reliably tell Jesus from John the Baptist, Mary, Zacharias,
  // the angel of the Apocalypse, etc. This is a hand-curated list of
  // ranges where Jesus does NOT speak in canonical reading. Any verse the
  // heuristic flags inside one of these ranges is suppressed before the
  // result is persisted/displayed.
  //
  // Sources cross-checked: Cambridge Annotated KJV, NA28 quotation marks,
  // ESV red-letter edition. When a range partially contains Jesus speech
  // (e.g. Rev 1:7-8 — only v8 is Jesus), the mask carves around it.
  const NON_JESUS_RANGES = {
    // Matthew — infancy, baptism narrative, post-resurrection narration
    "mat.1": [[1, 25]],                 // genealogy + Joseph + angel; Jesus not yet speaking
    "mat.2": [[1, 23]],                 // Magi, Herod, angel, prophets — no Jesus speech
    "mat.3": [[1, 12], [16, 17]],       // John the Baptist + Father's voice ("This is my beloved Son")
    // Mark — opening John-the-Baptist + transfiguration voice
    "mrk.1": [[1, 8], [27, 27]],        // JB's preaching + crowd's "What new doctrine"
    "mrk.9": [[7, 7]],                  // Father's voice at Transfiguration
    // Luke — entire infancy (Mary, Elisabeth, Zacharias, Simeon, angel)
    "luk.1": [[1, 80]],                 // Magnificat + Benedictus + Gabriel + Elisabeth
    "luk.2": [[1, 48], [50, 52]],       // Only Lk 2:49 is Jesus ("about my Father's business")
    "luk.3": [[1, 22]],                 // John the Baptist + Father's voice at baptism
    // John — prologue + every John-the-Baptist witness section + theological commentary
    // Jesus speaks only at: 38, 39, 42, 43, 47, 48b, 50, 51.
    // Mask everything else in chapter 1 by carving around those.
    "jhn.1": [[1, 14], [15, 37], [40, 41], [44, 46], [49, 49]],
    "jhn.3": [[27, 36]],                // John the Baptist's final witness + commentary
    "jhn.12": [[28, 30], [37, 50]],     // Father's voice; v44-50 is Johannine commentary
    // Acts — Stephen's vision in 7:55-60 is Stephen, not Jesus. We don't
    // process Acts for red-letter (not in RED_LETTER_BOOKS), so nothing
    // needed here, but listed for clarity.
    // Revelation — John's vision narrative, the elder, angels, four
    // living creatures, the great multitude all speak. Jesus's actual
    // direct speech in Rev is limited to: 1:8, 1:11, 1:17b-3:22 (letters
    // to the seven churches), 16:15, 22:7, 22:12-16, 22:20a.
    "rev.1":  [[1, 7], [9, 10], [12, 16], [20, 20]],
    "rev.4":  [[1, 11]],
    "rev.5":  [[1, 14]],
    "rev.6":  [[1, 17]],
    "rev.7":  [[1, 17]],
    "rev.8":  [[1, 13]],
    "rev.9":  [[1, 21]],
    "rev.10": [[1, 11]],
    "rev.11": [[1, 19]],
    "rev.12": [[1, 17]],
    "rev.13": [[1, 18]],
    "rev.14": [[1, 20]],
    "rev.15": [[1, 8]],
    "rev.17": [[1, 18]],
    "rev.18": [[1, 24]],
    "rev.19": [[1, 21]],
    "rev.20": [[1, 15]],
    "rev.21": [[1, 4], [9, 27]],        // 21:5-8 is "He that sat upon the throne" — God speaking
    "rev.22": [[1, 6], [8, 11], [17, 19], [21, 21]],  // Jesus: 7, 12-16, 20a
  };
  function isVerseInNonJesusMask(bookId, chapter, verseNum) {
    const ranges = NON_JESUS_RANGES[`${bookId}.${chapter}`];
    if (!ranges) return false;
    for (const [a, b] of ranges) if (verseNum >= a && verseNum <= b) return true;
    return false;
  }
  function applyNonJesusMask(set, bookId, chapter) {
    if (!set || !set.size) return set;
    for (const n of Array.from(set)) {
      if (isVerseInNonJesusMask(bookId, chapter, n)) set.delete(n);
    }
    return set;
  }

  // Speaker phrases that indicate Jesus is about to speak. The trailing
  // verb captures things like "said", "saith", "answered", "spake", etc.
  const JESUS_SAID_RE = /\b(?:Jesus|the\s+Lord|the\s+Master|Christ|the\s+Son\s+of\s+Man|Yeshua)\b[^.!?\n]{0,40}\b(?:said|saith|sayeth|answered|answereth|spoke|spake|replied|cried|told|asked|teacheth|crieth|exclaimed|declared|saying|teaching|preaching)\b/i;
  const SAID_JESUS_RE = /\b(?:said|saith|spake|answered)\b[^.!?\n]{0,20}\b(?:Jesus|the\s+Lord|the\s+Master|Christ|the\s+Son\s+of\s+Man)\b/i;
  const HE_SAID_RE   = /\b(?:He|And\s+he|he)\b[^.!?\n]{0,30}\b(?:said|saith|answered|answereth|spake|replied|told|cried|saying|teaching|taught)\b/i;
  // A bare "saying," / "said," at the very tail of the prefix — common when
  // the speech cue is in the verse before the opened quote. Very reliable in
  // Gospel context since narrator interjections rarely end with "saying,".
  const TRAILING_SPEECH_CUE_RE = /\b(?:saying|said|saith|answered|spake|cried|teaching|taught|asked)\s*[,:]?\s*$/i;

  // Curly + straight quote pairs we recognise as speech delimiters.
  const OPENERS = new Set(['"', '“', '‘', "«"]);
  const CLOSERS = new Set(['"', '”', '’', "»"]);
  const PAIR    = { '“':'”', '‘':'’', '"':'"', "«":"»" };

  // Phrases distinctive of Jesus's voice when they open a quote — covers
  // the mid-discourse case (John 14–17, the Bread of Life chapter, the
  // Sermon on the Mount continuation, etc.).
  const JESUS_QUOTE_OPENER_RE = /^(?:Most\s+certainly,?\s+I\s+tell|Truly,?\s+I\s+tell|Truly,?\s+truly,?\s+I\s+tell|Verily,?\s+verily,?\s+I\s+say|Verily\s+I\s+say|Amen,?\s+amen,?\s+I\s+say|I\s+am\s+(?:the|he\b)|I\s+have\s+come|I\s+came\s+(?:not|to)|I\s+tell\s+you|My\s+(?:Father|sheep|peace|kingdom|commandment)|Father,?\s+(?:I|the)|Let\s+not\s+your\s+heart|Peace\s+I\s+leave|If\s+ye\s+(?:love|abide|keep)\s+me|Ye\s+(?:are|have\s+heard|believe)\s+(?:my|in\s+(?:me|God))|Behold,?\s+I\s+come|Whosoever\s+(?:liveth|believeth|drinketh|eateth))\b/i;

  function speakerIsJesus(prefix, lastWasJesus, content, atVerseStart, atChapterStart) {
    // Look at the chunk of text immediately before the opening quote.
    const tail = prefix.slice(-220);
    if (JESUS_SAID_RE.test(tail) || SAID_JESUS_RE.test(tail)) return true;
    // "He said" with no other named speaker close by — in a Gospel/Revelation
    // chapter (the only contexts where this fn runs), unattributed third-
    // person speech overwhelmingly belongs to Jesus.
    if (HE_SAID_RE.test(tail)) return true;
    // Bare trailing speech cue ("…saying,") with no competing speaker named
    // in the prefix → Jesus.
    if (TRAILING_SPEECH_CUE_RE.test(tail)) return true;
    // Or check if the quote content itself begins with a signature Jesus phrase.
    if (content && JESUS_QUOTE_OPENER_RE.test(content.trim())) return true;
    // Chapter opens with an unattributed quote — almost always Jesus continuing
    // a discourse from the previous chapter (true throughout John, Matthew 5-7,
    // the Olivet Discourse, etc.). Narrators do not start chapters with bare
    // unattributed quotes.
    if (atChapterStart && !prefix.trim()) return true;
    return false;
  }

  // For modern translations: walk the joined chapter text, tracking quote
  // depth. When we cross an opener, decide if Jesus is the speaker. Returns
  // a Map<verseNumber, string[]> of literal substrings to highlight.
  function quoteTrackedReds(verses, tId, continuesFromPrev) {
    const result = new Map();
    let inJesus = false;
    let openerChar = null;
    let lastWasJesus = !!continuesFromPrev;
    let isFirstVerse = true;
    // Concatenated tail of the previous verse(s) so a quote that opens at the
    // start of a verse can still see the "saying," cue from the verse before.
    let trailingPrefix = "";

    for (const v of verses) {
      const text = v[tId];
      if (!text) continue;

      const reds = [];
      let segStart = inJesus ? 0 : -1; // start of current Jesus segment in this verse
      let i = 0;
      const verseStart = isFirstVerse;

      while (i < text.length) {
        const c = text[i];

        if (!inJesus && OPENERS.has(c)) {
          // Speaker decision sees both the prior verse's tail (if the quote
          // opens at the very start of this verse) and the in-verse prefix.
          const inVersePrefix = text.slice(0, i);
          const prefix = inVersePrefix.trim() ? inVersePrefix : (trailingPrefix + inVersePrefix);
          const content = text.slice(i + 1, i + 200);
          const atChapterStart = verseStart && !prefix.trim();
          if (speakerIsJesus(prefix, lastWasJesus, content, true, atChapterStart)) {
            inJesus = true;
            openerChar = c;
            segStart = i + 1;
          }
        } else if (inJesus && CLOSERS.has(c)) {
          // Match if it pairs with the opener (or accept any closer for ambiguous straight quotes).
          const pairsWithOpener = (PAIR[openerChar] === c) || (openerChar === '"' && c === '"');
          if (pairsWithOpener) {
            const seg = text.slice(segStart, i).trim();
            if (seg) reds.push(seg);
            inJesus = false;
            openerChar = null;
            segStart = -1;
            lastWasJesus = true;
          }
        }
        i++;
      }

      // If still inside a Jesus quote at end of verse, capture remainder.
      if (inJesus && segStart >= 0) {
        const seg = text.slice(segStart).trim();
        if (seg) reds.push(seg);
        segStart = 0; // next verse continues from start
      }

      // Heuristic: if the verse contains narration like "Jesus spoke this parable"
      // or sentence-ending punctuation in narration, allow lastWasJesus to decay
      // when we see clearly non-Jesus speech (handled implicitly by speaker check).
      if (reds.length) result.set(v.n, reds);
      isFirstVerse = false;
      // Carry the tail of this verse forward so quote-openings that land at the
      // start of the next verse can still see the speech cue.
      trailingPrefix = text.slice(-180);
    }
    return result;
  }

  // KJV-style detection: no quotation marks. Mark from after a Jesus-said
  // attribution comma to the end of the verse, then continue marking whole
  // subsequent verses until we hit a narrative break.
  //
  // Continuation breakers (each indicates Jesus has stopped speaking):
  //   • Verse contains another speech attribution with a non-Jesus subject:
  //     "Then said the Pharisees", "answered the disciples", "Peter said", etc.
  //   • Verse refers to Jesus in third person: "Jesus saw…", "And Jesus…"
  //     (Jesus would not narrate Himself.)
  //   • Verse opens with a clear narrative scene-change: "Then there arose…",
  //     "After these things…", "And there was…", "Now…"
  const JESUS_SAID_INLINE_RE = /\b(?:Jesus|the\s+Lord|the\s+Master|Christ|the\s+Son\s+of\s+Man)\b[^,.!?\n]{0,40}\b(?:said|saith|answered|answereth|spake|replied|cried|saying)\b/i;
  const SAID_JESUS_INLINE_RE = /\b(?:said|saith|spake|answered)\b[^,.!?\n]{0,20}\b(?:Jesus|the\s+Lord|the\s+Master|Christ|the\s+Son\s+of\s+Man)\b/i;
  const OTHER_SPEAKER_RE = /\b(?:said|saith|answered|spake|cried|replied|asked|saying)\b[^.,]{0,30}\b(?:the\s+Pharisees|the\s+disciples|the\s+Jews|the\s+multitude|the\s+people|Peter|John|Pilate|Mary|Martha|Nicodemus|the\s+chief\s+priests|Simon|Thomas|Philip|Judas|the\s+scribes|his\s+disciples|the\s+father|the\s+blind\s+man|the\s+man|the\s+servants|the\s+officers)\b/i;
  const OTHER_SPEAKER_RE_2 = /\b(?:the\s+Pharisees|the\s+disciples|the\s+Jews|the\s+multitude|the\s+people|Peter|Pilate|Mary|Martha|Nicodemus|Simon|Thomas|Philip|Judas|the\s+scribes|his\s+disciples|the\s+chief\s+priests|the\s+blind\s+man|the\s+father|the\s+servants|the\s+officers)\b[^.,]{0,30}\b(?:said|saith|answered|spake|cried|replied|asked|saying)\b/i;
  const JESUS_THIRD_PERSON_RE = /\b(?:And\s+)?Jesus\s+(?:saw|beheld|went|came|departed|stood|sat|wept|rose|walked|entered|cometh|goeth|seeing|knew|knowing|himself|therefore|then|loved|wept|saith\s+unto|said\s+unto)\b/i;
  // Narrative scene-change openers — must be concrete enough that they can't
  // plausibly be inside a parable. "And when" alone is too generic (Jesus
  // says "And when ye pray…"), so we require the named subject too.
  const NARRATIVE_OPENER_RE = /^(?:After\s+these\s+things|Then\s+there|And\s+there|Now\s+there|And\s+it\s+came\s+to\s+pass|There\s+was\s+(?:a|the)|There\s+came\s+(?:a|the)|And\s+(?:when|after)\s+(?:Jesus|he\s+had|they\s+had|the\s+Pharisees|the\s+disciples|the\s+Jews|the\s+multitude)|Now\s+(?:when|after)\s+(?:Jesus|he\s+had|they\s+had|the\s+Pharisees|the\s+disciples|the\s+Jews|the\s+multitude))\b/i;

  function isJesusContinuing(text) {
    // Returns true if Jesus is still the speaker in this verse.
    if (NARRATIVE_OPENER_RE.test(text)) return false;
    if (JESUS_THIRD_PERSON_RE.test(text)) return false;
    if (OTHER_SPEAKER_RE.test(text) || OTHER_SPEAKER_RE_2.test(text)) return false;
    return true;
  }

  // Signature Jesus openers — phrases unique enough to His voice that, when a
  // verse begins with one, we can assume He's speaking even without an
  // in-chapter "Jesus said" attribution (e.g. when discourse continues from
  // the previous chapter, as John 10 continues John 9).
  const JESUS_SIGNATURE_RE = /^(?:Verily,?\s+verily,?\s+I\s+say|Verily\s+I\s+say|Most\s+certainly,?\s+I\s+tell|Truly,?\s+I\s+tell|Truly,?\s+truly,?\s+I\s+tell|Amen,?\s+amen,?\s+I\s+say|I\s+am\s+(?:the|he\b)|Let\s+not\s+your\s+heart|Peace\s+I\s+leave\s+with\s+you|If\s+ye\s+(?:love|abide|keep)\s+me|These\s+things\s+have\s+I\s+spoken\s+unto\s+you|Father,?\s+the\s+hour|Behold,?\s+I\s+come\s+(?:quickly|as))\b/i;

  function commaSplitReds(verses, tId, continuesFromPrev) {
    const result = new Map();
    let inJesus = !!continuesFromPrev;
    // If chapter starts mid-discourse, mark verse 1 too — but only if it
    // looks like teaching content (avoid the rare narrative opener case).
    let pendingContinuation = !!continuesFromPrev;

    for (const v of verses) {
      const text = v[tId];
      if (!text) continue;

      const reds = [];

      // Patterns that open speech, in order of confidence:
      //   1. "Jesus said," / "the Lord answered,"
      //   2. "He said,"/"And he said,"/"And he spake unto them, saying," —
      //      bare third-person speech, attributed to Jesus only when no
      //      competing named speaker appears in the same verse.
      const namedJesus = text.match(/^(.*?\b(?:Jesus|the\s+Lord|the\s+Master|Christ|the\s+Son\s+of\s+Man)\b[^,.!?]*?\b(?:said|saith|answered|spake|replied|cried|saying|teaching|taught)\b[^,]*,)\s*/i)
                     || text.match(/^(.*?\b(?:said|saith|answered|spake)\b[^,]*?\b(?:Jesus|the\s+Lord|the\s+Master|Christ|the\s+Son\s+of\s+Man)\b[^,]*,)\s*/i);
      const bareHe = !namedJesus && text.match(/^((?:Then\s+|And\s+|Now\s+)?(?:he|He)\s+(?:answered\s+and\s+said|spake\s+(?:this\s+parable\s+)?unto\s+them[^,]*?saying|said\s+(?:also\s+|again\s+)?(?:unto\s+them|unto\s+him|unto\s+her)?[^,]*?|saith\s+(?:unto\s+them|unto\s+him|unto\s+her)?[^,]*?|cried\s+[^,]*?|answered[^,]*?|taught\s+them[^,]*?saying)[^,]*,)\s*/i);

      const m = namedJesus || (bareHe && !OTHER_SPEAKER_RE.test(text) && !OTHER_SPEAKER_RE_2.test(text) ? bareHe : null);

      if (m) {
        const after = text.slice(m[0].length).trim();
        if (after) reds.push(after);
        inJesus = true;
        pendingContinuation = false;
      } else if (JESUS_SIGNATURE_RE.test(text.trim())) {
        // Verse opens with Jesus's signature phrase — discourse continuing.
        reds.push(text.trim());
        inJesus = true;
        pendingContinuation = false;
      } else if (pendingContinuation && isJesusContinuing(text)) {
        // Cross-chapter continuation: previous chapter ended with Jesus
        // speaking and this verse doesn't introduce a competing narrator.
        reds.push(text.trim());
        inJesus = true;
        pendingContinuation = false;
      } else if (inJesus) {
        // The prior verse ended with Jesus speaking. But this verse may also
        // contain a NEW narrator setup ("...and said unto them, X") before
        // launching a fresh quote. If we can find that attribution, the
        // narrator owns the prefix and only the trailing clause is red. This
        // prevents marking entire verses ("So when they continued asking
        // him, he lifted up himself, and said unto them, He that is without
        // sin…") where most of the words are NOT Jesus's.
        const midAttr = text.match(/\b(?:said|saith|answered|spake|cried|replied)\s+(?:also\s+|again\s+)?(?:unto\s+(?:them|him|her|me|you|the\s+\w+)(?:\s+\w+){0,3}\s*)?,\s+/i);
        if (midAttr) {
          const prefix = text.slice(0, midAttr.index + midAttr[0].length);
          // CRITICAL: if the attribution names a non-Jesus speaker
          // ("Thomas saith unto him,", "Philip saith unto him,",
          // "the disciples answered, …"), this verse's quote belongs to
          // them — NOT to Jesus. Suppress the red and exit the Jesus run.
          const nonJesusSpeaker = OTHER_SPEAKER_RE.test(prefix) || OTHER_SPEAKER_RE_2.test(prefix);
          const after = text.slice(midAttr.index + midAttr[0].length).trim();
          if (nonJesusSpeaker) {
            inJesus = false;             // a different speaker just took the floor
          } else if (after) {
            reds.push(after);
            inJesus = isJesusContinuing(after);
          } else {
            inJesus = false;
          }
        } else if (isJesusContinuing(text)) {
          reds.push(text.trim());
        } else {
          inJesus = false;
        }
      }
      pendingContinuation = false;

      if (reds.length) result.set(v.n, reds);
    }
    return result;
  }

  // Translations known to use quotation marks for direct speech.
  const QUOTED_TRANSLATIONS = new Set(["web", "webbe", "bbe", "asv", "bsb", "ylt", "darby", "drb", "oeb-cw"]);
  // Translations our heuristic understands well (used to populate the cross-
  // translation Jesus-verses database). KJV is the most reliable source.
  const DETECTION_TRANSLATIONS = ["kjv", "web"];

  // ── Cross-translation Jesus-verses database ────────────────────────────────
  // Map of `${bookId}.${chapter}` → Set<verseNumber>. Built up as the user
  // browses chapters that include a detection-friendly translation, persisted
  // to localStorage so cold loads of a Latin-only translation still get red
  // letter highlighting.
  // v2 — bumped after fixing the Thomas/Philip/disciples false-positive in
  // commaSplitReds. Old v1 entries marked entire chapters red; let them die.
  const RL_DB_KEY = "codex.redletter.verses.v3";
  let RL_DB = (() => {
    try {
      const raw = JSON.parse(localStorage.getItem(RL_DB_KEY) || "{}");
      const out = {};
      for (const k of Object.keys(raw)) out[k] = new Set(raw[k]);
      return out;
    } catch { return {}; }
  })();
  function persistRLDB() {
    try {
      const flat = {};
      for (const k of Object.keys(RL_DB)) flat[k] = Array.from(RL_DB[k]).sort((a,b) => a-b);
      localStorage.setItem(RL_DB_KEY, JSON.stringify(flat));
    } catch {}
  }
  function rlKey(bookId, chapter) { return `${bookId}.${chapter}`; }
  function rlGet(bookId, chapter) {
    // Always re-apply the negative mask on read so stale DB entries from
    // a pre-mask app version self-heal the moment they're touched.
    const set = RL_DB[rlKey(bookId, chapter)];
    return set ? applyNonJesusMask(set, bookId, chapter) : set;
  }
  function rlMerge(bookId, chapter, verseNumbers) {
    const k = rlKey(bookId, chapter);
    const prev = RL_DB[k] || new Set();
    let changed = false;
    for (const n of verseNumbers) {
      if (isVerseInNonJesusMask(bookId, chapter, n)) continue; // hard-suppress
      if (!prev.has(n)) { prev.add(n); changed = true; }
    }
    if (changed) { RL_DB[k] = prev; persistRLDB(); }
  }

  // Cross-chapter speech-state. When chapter N ends mid-discourse, chapter
  // N+1 should open already inside Jesus speech (Sermon on the Mount spans
  // Mat 5–7, Last Supper spans John 13–17, Olivet Discourse spans Mat 24–25,
  // etc.). Stored per (book, chapter) so opening a chapter in any order works
  // once neighbours have been visited at least once.
  const ENDSTATE_KEY = "codex.redletter.endstate.v1";
  let ENDSTATE = (() => { try { return JSON.parse(localStorage.getItem(ENDSTATE_KEY) || "{}"); } catch { return {}; } })();
  function persistEndstate() { try { localStorage.setItem(ENDSTATE_KEY, JSON.stringify(ENDSTATE)); } catch {} }
  function setChapterEndstate(bookId, chapter, endsInJesus) {
    const k = `${bookId}.${chapter}`;
    if (ENDSTATE[k] === endsInJesus) return;
    ENDSTATE[k] = endsInJesus;
    persistEndstate();
  }
  function priorChapterEndedInJesus(bookId, chapter) {
    if (chapter <= 1) return false;
    return !!ENDSTATE[`${bookId}.${chapter - 1}`];
  }

  function annotateRedLetter(verses, bookId, translations, chapter) {
    if (!RED_LETTER_BOOKS.has(bookId)) return;
    const detectedVerses = new Set();
    const continuesFromPrev = priorChapterEndedInJesus(bookId, chapter);
    let endsInJesus = false;

    for (const tId of translations) {
      const reds = QUOTED_TRANSLATIONS.has(tId)
        ? quoteTrackedReds(verses, tId, continuesFromPrev)
        : commaSplitReds(verses, tId, continuesFromPrev);
      if (!reds.size) continue;
      for (const v of verses) {
        const arr = reds.get(v.n);
        if (!arr || !arr.length) continue;
        // Hard-suppress verses inside the curated non-Jesus mask
        // (Magnificat, Benedictus, John the Baptist witness, etc.)
        if (isVerseInNonJesusMask(bookId, chapter, v.n)) continue;
        v.red = v.red || {};
        v.red[tId] = arr;
        detectedVerses.add(v.n);
      }
      // A chapter ends in Jesus speech if the last verse with text was marked.
      const lastVerse = verses[verses.length - 1];
      if (lastVerse && reds.get(lastVerse.n)?.length) endsInJesus = true;
    }
    setChapterEndstate(bookId, chapter, endsInJesus);
    return detectedVerses;
  }

  // After loadMulti, attach `_jesusVerse: true` to every verse known to
  // contain Jesus's words (per the cross-translation DB) so the renderer
  // can paint the whole verse red even for translations without per-string
  // markup (e.g. Latin Vulgata, Geneva, Cherokee).
  function applyJesusVerseFlags(verses, bookId, chapter) {
    const set = rlGet(bookId, chapter);
    if (!set || !set.size) return;
    for (const v of verses) {
      if (isVerseInNonJesusMask(bookId, chapter, v.n)) { v._jesusVerse = false; continue; }
      if (set.has(v.n)) v._jesusVerse = true;
    }
  }

  // Fetch many translations of one chapter in parallel and return a unified
  // verse array: [{ n, kjv, web, bbe, … }, …].
  async function loadMulti(bookId, chapter, translations) {
    const results = await Promise.all(
      translations.map(t =>
        loadChapter(bookId, chapter, t).then(v => [t, v]).catch(e => {
          console.warn("BIBLE load failed", t, e);
          return [t, null];
        })
      )
    );
    const byVerse = new Map();
    let maxN = 0;
    for (const [tId, verses] of results) {
      if (!verses) continue;
      for (const v of verses) {
        if (!byVerse.has(v.n)) byVerse.set(v.n, { n: v.n });
        byVerse.get(v.n)[tId] = v.text;
        if (v.n > maxN) maxN = v.n;
      }
    }
    const out = [];
    for (let n = 1; n <= maxN; n++) if (byVerse.has(n)) out.push(byVerse.get(n));

    const detected = annotateRedLetter(out, bookId, translations, chapter) || new Set();

    // Update the cross-translation database from this chapter's detection.
    if (detected.size && RED_LETTER_BOOKS.has(bookId)) {
      rlMerge(bookId, chapter, detected);
    }

    // If the chapter is a red-letter book but we didn't find any reds via the
    // user's chosen translations (e.g. they're only viewing Latin), fall back
    // to KJV in the background so the DB grows for next time.
    if (RED_LETTER_BOOKS.has(bookId) && !detected.size && !rlGet(bookId, chapter)) {
      const probe = translations.includes("kjv") ? null : "kjv";
      if (probe) {
        try {
          const kjvVerses = await loadChapter(bookId, chapter, probe);
          // Reconstruct a parallel array indexed by verse number for detection.
          const kjvVerseObjs = kjvVerses.map(v => ({ n: v.n, kjv: v.text }));
          const kjvReds = commaSplitReds(kjvVerseObjs, "kjv", priorChapterEndedInJesus(bookId, chapter));
          if (kjvReds.size) {
            rlMerge(bookId, chapter, kjvReds.keys());
          }
        } catch (e) {
          console.warn("BIBLE red-letter probe failed", e);
        }
      }
    }

    applyJesusVerseFlags(out, bookId, chapter);
    return out;
  }

  // ── Offline translation download ────────────────────────────────────
  // Walks every chapter of every book for a given translation, calling
  // loadChapter (which writes to localStorage). Returns a controller with
  // .abort() so the user can stop a long download mid-way. Calls onProgress
  // after every chapter with { done, total, book, chapter, complete?, error? }.
  // Throttled to ~30 req/s per translation so we don't hammer free APIs.
  // Shared worker-pool runner for downloadAll / repairTranslation. Pulls
  // tasks from a queue and runs CONCURRENCY of them in parallel — ~3-4×
  // faster than the old sequential 30ms-throttle loop while staying
  // polite enough not to trip the free APIs' rate limits.
  const DOWNLOAD_CONCURRENCY = 4;
  function runWithPool(tasks, worker, onProgress) {
    let aborted = false;
    let done = 0;
    const total = tasks.length;
    let cursor = 0;
    const workers = Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, total) }, async () => {
      while (!aborted) {
        const idx = cursor++;
        if (idx >= tasks.length) return;
        const task = tasks[idx];
        try {
          await worker(task);
        } catch (e) {
          onProgress?.({ done, total, error: String(e.message || e), book: task.book, chapter: task.chapter });
        }
        done++;
        onProgress?.({ done, total, book: task.book, chapter: task.chapter });
      }
    });
    Promise.all(workers).then(() => {
      if (aborted) onProgress?.({ done, total, aborted: true });
      else         onProgress?.({ done, total, complete: true });
    });
    return { abort: () => { aborted = true; } };
  }

  function downloadAll(translation, books, onProgress) {
    const tasks = [];
    for (const b of books) {
      for (let ch = 1; ch <= b.chapters; ch++) {
        tasks.push({ bookId: b.id, book: b.name, chapter: ch });
      }
    }
    return runWithPool(
      tasks,
      (t) => loadChapter(t.bookId, t.chapter, translation),
      onProgress,
    );
  }

  // Quick lookup: how many chapters of this translation are already in cache?
  function cacheStats(translation, books) {
    const cache = readCache();
    let cached = 0;
    let total  = 0;
    for (const b of books) {
      total += b.chapters;
      for (let ch = 1; ch <= b.chapters; ch++) {
        if (cache[`${b.id}.${ch}.${translation}`]) cached++;
      }
    }
    return { cached, total, fully: cached === total };
  }

  // Verify a translation is coherently cached for offline use:
  // - Reads the cache directly (no network)
  // - Returns counts + a list of the first N missing chapters
  // - Spot-checks that the cached entries are parseable verse arrays
  function verifyTranslation(translation, books) {
    const cache = readCache();
    const missing = [];
    const corrupt = [];
    let cached = 0;
    let total  = 0;
    for (const b of books) {
      for (let ch = 1; ch <= b.chapters; ch++) {
        total++;
        const k = `${b.id}.${ch}.${translation}`;
        const v = cache[k];
        if (!v) {
          // Collect ALL missing so repairTranslation can fetch everything
          // in one go (was capped at 50, leaving the user with a button
          // labelled "REPAIR 1187" that actually only repaired 50 per
          // click — needed many clicks to fully restore a translation).
          missing.push({ bookId: b.id, book: b.name, chapter: ch });
          continue;
        }
        if (!Array.isArray(v) || v.length === 0 || typeof v[0]?.text !== "string") {
          corrupt.push({ bookId: b.id, book: b.name, chapter: ch });
          continue;
        }
        cached++;
      }
    }
    return {
      translation,
      cached, total,
      missing, corrupt,
      ok: missing.length === 0 && corrupt.length === 0,
      summary: missing.length === 0 && corrupt.length === 0
        ? "all chapters present and readable"
        : `${missing.length} missing · ${corrupt.length} corrupt`,
    };
  }

  // Repair a translation: re-fetch every missing or corrupt chapter,
  // honouring the same throttle as downloadAll. Returns a controller +
  // streams progress through onProgress.
  function repairTranslation(translation, books, onProgress) {
    const v = verifyTranslation(translation, books);
    const targets = [...v.missing, ...v.corrupt];
    if (targets.length === 0) {
      onProgress?.({ done: 0, total: 0, complete: true, nothingToDo: true });
      return { abort: () => {} };
    }
    // Pre-clear corrupt entries so the loadChapter fetch path runs.
    if (v.corrupt.length) {
      for (const t of v.corrupt) {
        const k = `${t.bookId}.${t.chapter}.${translation}`;
        delete _memCache[k];
        _dirty.delete(k);
        if (_db) _idbReq(STORE_CHAPTERS, "readwrite", s => s.delete(k)).catch(()=>{});
      }
    }
    let aborted = false;
    let masterDone = 0;
    const masterTotal = targets.length;
    const ctl = { abort: () => { aborted = true; } };
    // ── Pass 1 · concurrent worker pool (fast) ────────────────────────
    const innerCtl = runWithPool(
      targets,
      (t) => loadChapter(t.bookId, t.chapter, translation),
      (p) => {
        if (aborted) return;
        if (!p.complete && !p.aborted) {
          masterDone = p.done;
          onProgress?.({ done: masterDone, total: masterTotal, book: p.book, chapter: p.chapter, error: p.error, phase: "pool" });
          return;
        }
        // Pass 1 finished — kick off Pass 2 sequential retry for
        // anything still missing (concurrency caused some chapters to
        // drop in pass 1). Then Pass 3 is a checksum-style integrity
        // sweep that re-validates every cached chapter.
        (async () => {
          // Allow the debounced flush to drain so verify sees latest state.
          await new Promise(r => setTimeout(r, 250));
          const mid = verifyTranslation(translation, books);
          const stragglers = [...mid.missing, ...mid.corrupt];
          let pass2Done = 0;
          for (const t of stragglers) {
            if (aborted) break;
            // Clear any corrupt cached entry first
            const k = `${t.bookId}.${t.chapter}.${translation}`;
            if (mid.corrupt.find(c => c.bookId === t.bookId && c.chapter === t.chapter)) {
              delete _memCache[k]; _dirty.delete(k);
              if (_db) try { await _idbReq(STORE_CHAPTERS, "readwrite", s => s.delete(k)); } catch {}
            }
            try { await loadChapter(t.bookId, t.chapter, translation); }
            catch (e) {
              onProgress?.({ done: masterDone, total: masterTotal, book: t.book, chapter: t.chapter, error: String(e.message||e), phase: "retry" });
            }
            pass2Done++;
            onProgress?.({ done: masterDone, total: masterTotal, retryDone: pass2Done, retryTotal: stragglers.length, phase: "retry" });
            await new Promise(r => setTimeout(r, 100));   // gentler pacing
          }
          // ── Pass 3 · checksum ─────────────────────────────────────
          // Run verify one more time and report the final integrity status.
          await new Promise(r => setTimeout(r, 250));
          const final = verifyTranslation(translation, books);
          // Tally per-translation totals
          let totalVerses = 0;
          for (const k of Object.keys(_memCache)) {
            if (!k.endsWith(`.${translation}`)) continue;
            const verses = _memCache[k];
            if (Array.isArray(verses)) totalVerses += verses.length;
          }
          onProgress?.({
            done: masterDone, total: masterTotal,
            complete: true,
            checksum: {
              cached: final.cached,
              total: final.total,
              missing: final.missing.length,
              corrupt: final.corrupt.length,
              totalVerses,
              passed: final.missing.length === 0 && final.corrupt.length === 0,
            },
          });
        })();
      },
    );
    ctl.abort = () => { aborted = true; innerCtl.abort(); };
    return ctl;
  }

  function readOffline(bookId, chapter, translation) {
    const cache = ensureCache();
    return cache[`${bookId}.${chapter}.${translation}`] || null;
  }

  // Drop every cached chapter for a translation. Goes through the
  // memCache so subsequent operations see the updated state immediately
  // (the previous direct-localStorage delete left the in-memory cache
  // stale and concurrent download writes resurrected the deleted keys).
  function removeTranslation(translation) {
    let removed = 0;
    for (const k of Object.keys(_memCache)) {
      if (k.endsWith(`.${translation}`)) { delete _memCache[k]; removed++; _dirty.delete(k); }
    }
    if (_db) {
      // Sweep matching keys out of IDB via the index.
      try {
        const tx = _db.transaction(STORE_CHAPTERS, "readwrite");
        const idx = tx.objectStore(STORE_CHAPTERS).index("translation");
        const req = idx.openCursor(IDBKeyRange.only(translation));
        req.onsuccess = (e) => { const c = e.target.result; if (c) { c.delete(); c.continue(); } };
      } catch (e) { console.warn("removeTranslation IDB sweep failed:", e); }
    } else {
      // Fallback: rewrite localStorage blob.
      try {
        const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
        for (const k of Object.keys(raw)) if (k.endsWith(`.${translation}`)) delete raw[k];
        localStorage.setItem(CACHE_KEY, JSON.stringify(raw));
      } catch {}
    }
    return removed;
  }

  // ── Storage diagnostics ──────────────────────────────────────────────
  async function diagnoseStorage() {
    const counts = {};
    let approxBytes = 0;
    for (const [k, v] of Object.entries(_memCache)) {
      const t = k.split(".").pop();
      counts[t] = (counts[t] || 0) + 1;
      // Cheap upper-bound on size: serialized length × 1 byte/char (UTF-16
      // is 2× but text content is mostly ASCII so the bound is generous).
      if (Array.isArray(v)) approxBytes += JSON.stringify(v).length + k.length + 60;
    }
    let quota = null, used = null;
    if (navigator.storage?.estimate) {
      try { const e = await navigator.storage.estimate(); quota = e.quota; used = e.usage; } catch {}
    }
    return {
      backend: _db ? "indexeddb" : "localStorage-fallback",
      chapterCount: Object.keys(_memCache).length,
      countsByTranslation: counts,
      approxBytes,
      approxKB: Math.round(approxBytes / 1024),
      approxMB: +(approxBytes / 1024 / 1024).toFixed(2),
      quotaBytes: quota,
      quotaMB: quota ? +(quota / 1024 / 1024).toFixed(0) : null,
      usedBytes: used,
      usedMB: used ? +(used / 1024 / 1024).toFixed(2) : null,
      availableMB: (quota && used != null) ? +((quota - used) / 1024 / 1024).toFixed(0) : null,
      ready: !!_db,
    };
  }

  // Force re-evaluation of bundle availability — useful when the user
  // installs a new bundle file (or when tests need to retry).
  function resetBundle(translation) {
    if (translation) _bundleStatus.delete(translation);
    else _bundleStatus.clear();
  }

  // ── Check upstream for translation updates ────────────────────────────
  // Compares each locally-cached translation's oldest fetchedAt against
  // the source's reported "updated" timestamp (bolls.life ships one in
  // its language manifest). Returns an array of {id, name, hasUpdate,
  // ourFetchedAt, sourceUpdatedAt, source}.
  //
  // bible-api.com doesn't expose update timestamps so those translations
  // are reported as `hasUpdate: false, source: "no-version"` — repair is
  // still always available manually.
  let _bollsManifestCache = null;
  async function _fetchBollsManifest() {
    if (_bollsManifestCache) return _bollsManifestCache;
    try {
      const r = await fetch("https://bolls.life/static/bolls/app/views/languages.json");
      if (!r.ok) return null;
      const data = await r.json();
      const m = new Map();
      for (const lang of data) {
        for (const t of (lang.translations || [])) {
          if (t.short_name) m.set(t.short_name, { name: t.full_name, updated: t.updated });
        }
      }
      _bollsManifestCache = m;
      return m;
    } catch { return null; }
  }
  async function checkUpdates(translations) {
    if (_ready) await _ready;
    const out = [];
    const bolls = await _fetchBollsManifest();
    for (const t of translations) {
      // Find oldest fetchedAt for any chapter of this translation
      let oldest = null;
      let chCount = 0;
      // Pull from IDB to get accurate fetchedAt (memCache only stores verses)
      if (_db) {
        try {
          await new Promise((resolve, reject) => {
            const tx = _db.transaction(STORE_CHAPTERS, "readonly");
            const idx = tx.objectStore(STORE_CHAPTERS).index("translation");
            const cr = idx.openCursor(IDBKeyRange.only(t.id));
            cr.onsuccess = (e) => {
              const c = e.target.result;
              if (c) {
                chCount++;
                const ts = c.value?.fetchedAt;
                if (ts && (!oldest || ts < oldest)) oldest = ts;
                c.continue();
              } else resolve();
            };
            cr.onerror = () => reject(cr.error);
          });
        } catch {}
      }
      if (chCount === 0) continue;   // not downloaded
      let sourceUpdated = null, hasUpdate = false, source = null;
      if (t.source === "bolls" && bolls && t.apiId && bolls.has(t.apiId)) {
        sourceUpdated = bolls.get(t.apiId).updated;
        source = "bolls";
        hasUpdate = oldest && sourceUpdated && sourceUpdated > oldest;
      } else if (t.source === "bible-api") {
        source = "bible-api";   // no version info available
      } else {
        source = t.source || "unknown";
      }
      out.push({
        id: t.id, name: t.name, source,
        chaptersCached: chCount,
        ourFetchedAt: oldest,
        sourceUpdatedAt: sourceUpdated,
        hasUpdate,
        ageDays: oldest ? Math.floor((Date.now() - oldest) / 86400_000) : null,
      });
    }
    return out;
  }

  // ── Bundle import · accept a {translation, version, chapters} payload
  // and write every chapter into IDB + mem cache. Used by the Settings
  // file-picker so users can drop a bundle without dev tools.
  async function importBundle(input) {
    if (_ready) await _ready;
    let data;
    if (typeof input === "string") {
      try { data = JSON.parse(input); } catch (e) { throw new Error("invalid JSON: " + e.message); }
    } else { data = input; }
    if (!data || typeof data !== "object") throw new Error("bundle must be an object");
    const t = data.translation;
    if (!t || typeof t !== "string") throw new Error("missing translation id");
    if (!data.chapters || typeof data.chapters !== "object") throw new Error("missing chapters object");
    const now = Date.now();
    const batch = [];
    let count = 0;
    for (const [bookCh, verses] of Object.entries(data.chapters)) {
      if (!Array.isArray(verses) || verses.length === 0) continue;
      const key = `${bookCh}.${t}`;
      _memCache[key] = verses;
      batch.push({ key, value: { verses, fetchedAt: now, source: "imported-bundle", pinned: true, translation: t } });
      count++;
    }
    if (_db && batch.length) await _putBatch(batch);
    try { window.dispatchEvent(new CustomEvent("codex:bible:bundle-loaded", { detail: { translation: t, count } })); } catch {}
    return { translation: t, imported: count };
  }

  // ── Bundle export · Phase C admin tool ──────────────────────────────
  // Reads every cached chapter for `translation` from the mem mirror and
  // returns a JSON string in the bundle format the loader expects.
  // Pair with downloadAll first to make the export complete.
  function exportBundle(translation) {
    const chapters = {};
    for (const [k, verses] of Object.entries(_memCache)) {
      if (!k.endsWith(`.${translation}`)) continue;
      const parts = k.split(".");
      // key shape: bookId.chapter.translation → strip trailing translation
      const bookCh = parts.slice(0, -1).join(".");
      chapters[bookCh] = verses;
    }
    return {
      translation,
      version: 1,
      generatedAt: Date.now(),
      chapterCount: Object.keys(chapters).length,
      chapters,
    };
  }

  return {
    loadChapter, loadMulti, BOOK_API, annotateRedLetter, rlGet, rlMerge,
    downloadAll, cacheStats, verifyTranslation, repairTranslation,
    readOffline, removeTranslation,
    ready: _ready,
    storage: { diagnose: diagnoseStorage, resetBundle, exportBundle, importBundle, checkUpdates },
  };
})();
