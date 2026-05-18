/* CODEX scripture reference parser — pure JS, no deps.
 * Works both as ES module (popup/newtab) and as a global (content script).
 *
 * Usage:
 *   const refs = CODEX_REF_PARSER.parse("see John 3:16-18 and 1 Cor 13:4-7");
 *   // → [{ rawText, book, chapter, verse, range, normalized }]
 */
(function (root) {
  'use strict';

  // Canonical book list — 66 OT+NT + common deuterocanonicals.
  // Each entry: [canonicalName, normalizedSlug, [aliases...]]
  const BOOKS = [
    // ── Old Testament ──
    ['Genesis', 'genesis', ['gen', 'gn', 'ge']],
    ['Exodus', 'exodus', ['ex', 'exo', 'exod']],
    ['Leviticus', 'leviticus', ['lev', 'lv', 'le']],
    ['Numbers', 'numbers', ['num', 'nu', 'nm', 'nb']],
    ['Deuteronomy', 'deuteronomy', ['deut', 'dt', 'de']],
    ['Joshua', 'joshua', ['josh', 'jos', 'jsh']],
    ['Judges', 'judges', ['judg', 'jdg', 'jg', 'jdgs']],
    ['Ruth', 'ruth', ['rth', 'ru']],
    ['1 Samuel', '1samuel', ['1 sam', '1sam', '1sa', '1s', 'i sam', '1samuel']],
    ['2 Samuel', '2samuel', ['2 sam', '2sam', '2sa', '2s', 'ii sam', '2samuel']],
    ['1 Kings', '1kings', ['1 kgs', '1kgs', '1ki', '1k', 'i kgs', '1kings']],
    ['2 Kings', '2kings', ['2 kgs', '2kgs', '2ki', '2k', 'ii kgs', '2kings']],
    ['1 Chronicles', '1chronicles', ['1 chr', '1chr', '1ch', 'i chr', '1chronicles']],
    ['2 Chronicles', '2chronicles', ['2 chr', '2chr', '2ch', 'ii chr', '2chronicles']],
    ['Ezra', 'ezra', ['ezr', 'ez']],
    ['Nehemiah', 'nehemiah', ['neh', 'ne']],
    ['Esther', 'esther', ['est', 'esth', 'es']],
    ['Job', 'job', ['jb']],
    ['Psalms', 'psalms', ['ps', 'psa', 'psalm', 'pss', 'pslm']],
    ['Proverbs', 'proverbs', ['prov', 'pr', 'prv', 'pro']],
    ['Ecclesiastes', 'ecclesiastes', ['eccl', 'ec', 'ecc', 'qoh']],
    ['Song of Solomon', 'songofsolomon', ['song', 'sos', 'so', 'cant', 'canticles', 'song of songs']],
    ['Isaiah', 'isaiah', ['isa', 'is']],
    ['Jeremiah', 'jeremiah', ['jer', 'je', 'jr']],
    ['Lamentations', 'lamentations', ['lam', 'la']],
    ['Ezekiel', 'ezekiel', ['ezek', 'eze', 'ezk']],
    ['Daniel', 'daniel', ['dan', 'da', 'dn']],
    ['Hosea', 'hosea', ['hos', 'ho']],
    ['Joel', 'joel', ['jl']],
    ['Amos', 'amos', ['am']],
    ['Obadiah', 'obadiah', ['obad', 'ob']],
    ['Jonah', 'jonah', ['jon', 'jnh']],
    ['Micah', 'micah', ['mic', 'mc']],
    ['Nahum', 'nahum', ['nah', 'na']],
    ['Habakkuk', 'habakkuk', ['hab', 'hb']],
    ['Zephaniah', 'zephaniah', ['zeph', 'zep', 'zp']],
    ['Haggai', 'haggai', ['hag', 'hg']],
    ['Zechariah', 'zechariah', ['zech', 'zec', 'zc']],
    ['Malachi', 'malachi', ['mal', 'ml']],

    // ── New Testament ──
    ['Matthew', 'matthew', ['matt', 'mt']],
    ['Mark', 'mark', ['mk', 'mrk', 'mar']],
    ['Luke', 'luke', ['lk', 'luk']],
    ['John', 'john', ['jn', 'jhn', 'joh']],
    ['Acts', 'acts', ['ac', 'act']],
    ['Romans', 'romans', ['rom', 'ro', 'rm']],
    ['1 Corinthians', '1corinthians', ['1 cor', '1cor', '1co', 'i cor']],
    ['2 Corinthians', '2corinthians', ['2 cor', '2cor', '2co', 'ii cor']],
    ['Galatians', 'galatians', ['gal', 'ga']],
    ['Ephesians', 'ephesians', ['eph', 'ephes']],
    ['Philippians', 'philippians', ['phil', 'php', 'pp']],
    ['Colossians', 'colossians', ['col', 'co']],
    ['1 Thessalonians', '1thessalonians', ['1 thess', '1thess', '1th', '1 thes', 'i thess']],
    ['2 Thessalonians', '2thessalonians', ['2 thess', '2thess', '2th', '2 thes', 'ii thess']],
    ['1 Timothy', '1timothy', ['1 tim', '1tim', '1ti', 'i tim']],
    ['2 Timothy', '2timothy', ['2 tim', '2tim', '2ti', 'ii tim']],
    ['Titus', 'titus', ['tit', 'ti']],
    ['Philemon', 'philemon', ['phlm', 'phm', 'pm']],
    ['Hebrews', 'hebrews', ['heb']],
    ['James', 'james', ['jas', 'jm']],
    ['1 Peter', '1peter', ['1 pet', '1pet', '1pe', '1pt', 'i pet']],
    ['2 Peter', '2peter', ['2 pet', '2pet', '2pe', '2pt', 'ii pet']],
    ['1 John', '1john', ['1 jn', '1jn', '1jo', 'i jn']],
    ['2 John', '2john', ['2 jn', '2jn', '2jo', 'ii jn']],
    ['3 John', '3john', ['3 jn', '3jn', '3jo', 'iii jn']],
    ['Jude', 'jude', ['jud', 'jd']],
    ['Revelation', 'revelation', ['rev', 're', 'apocalypse', 'apoc']],

    // ── Deuterocanonical ──
    ['Tobit', 'tobit', ['tob', 'tb']],
    ['Judith', 'judith', ['jdt', 'jth']],
    ['Wisdom', 'wisdom', ['wis', 'ws', 'wisd']],
    ['Sirach', 'sirach', ['sir', 'ecclus', 'ecclesiasticus']],
    ['Baruch', 'baruch', ['bar', 'br']],
    ['1 Maccabees', '1maccabees', ['1 macc', '1macc', '1ma', 'i macc']],
    ['2 Maccabees', '2maccabees', ['2 macc', '2macc', '2ma', 'ii macc']]
  ];

  // Build lookup: alias (lowercased, spaces collapsed) → { name, slug }
  const ALIAS_MAP = new Map();
  for (const [name, slug, aliases] of BOOKS) {
    const variants = new Set([name.toLowerCase(), slug, ...aliases.map(a => a.toLowerCase())]);
    for (const v of variants) {
      ALIAS_MAP.set(v.replace(/\s+/g, ' ').trim(), { name, slug });
      ALIAS_MAP.set(v.replace(/\s+/g, ''), { name, slug });
    }
  }

  // Sorted by length desc so longer book names match first ("1 John" before "John").
  const BOOK_PATTERN = Array.from(new Set(
    BOOKS.flatMap(([name, , aliases]) => [name, ...aliases])
  ))
    .sort((a, b) => b.length - a.length)
    .map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  // Match: [optional 1/2/3/I/II/III] BookName Chapter[:Verse[-EndVerse]][, Chapter:Verse]*
  // Example matches: "John 3:16", "1 Cor 13:4-7", "Ps 23", "Gen 1:1, 1:5, 2:3"
  const REF_RE = new RegExp(
    '\\b((?:[1-3]\\s*|i{1,3}\\s+)?(?:' + BOOK_PATTERN + '))\\.?\\s+' +
    '(\\d{1,3})' +
    '(?:\\s*:\\s*(\\d{1,3})(?:\\s*[\\-\\u2013]\\s*(\\d{1,3}))?)?' +
    '((?:\\s*,\\s*\\d{1,3}(?:\\s*:\\s*\\d{1,3})?(?:\\s*[\\-\\u2013]\\s*\\d{1,3})?)*)',
    'gi'
  );

  function lookupBook(raw) {
    if (!raw) return null;
    let key = raw.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
    // Convert leading roman numerals → digits
    key = key.replace(/^iii\s+/, '3 ').replace(/^ii\s+/, '2 ').replace(/^i\s+/, '1 ');
    return ALIAS_MAP.get(key) || ALIAS_MAP.get(key.replace(/\s+/g, '')) || null;
  }

  function parse(text) {
    if (!text || typeof text !== 'string') return [];
    const results = [];
    let m;
    REF_RE.lastIndex = 0;
    while ((m = REF_RE.exec(text)) !== null) {
      const [rawText, bookRaw, chapStr, verseStr, endVerseStr, tail] = m;
      const book = lookupBook(bookRaw);
      if (!book) continue;
      const chapter = parseInt(chapStr, 10);
      const verse = verseStr ? parseInt(verseStr, 10) : null;
      const endVerse = endVerseStr ? parseInt(endVerseStr, 10) : null;
      const range = verse && endVerse ? `${verse}-${endVerse}` : (verse ? `${verse}` : null);
      const normalized = verse
        ? `${book.slug}.${chapter}.${verse}` + (endVerse ? `-${endVerse}` : '')
        : `${book.slug}.${chapter}`;
      results.push({
        rawText: rawText.trim(),
        book: book.name,
        chapter,
        verse,
        endVerse,
        range,
        normalized,
        tail: (tail || '').trim() || null
      });
    }
    return results;
  }

  function firstRef(text) {
    const refs = parse(text);
    return refs.length ? refs[0] : null;
  }

  function codexUrl(ref) {
    if (!ref) return 'https://codex.app/';
    const n = typeof ref === 'string' ? ref : ref.normalized;
    return 'https://codex.app/?ref=' + encodeURIComponent(n);
  }

  function bibleApiUrl(ref) {
    if (!ref) return null;
    // bible-api.com accepts "john+3:16" or "john+3:16-18"
    const n = typeof ref === 'string' ? ref : ref.normalized;
    const parts = n.split('.');
    const book = parts[0];
    const chap = parts[1];
    const rest = parts[2] || '';
    const slug = rest ? `${book}+${chap}:${rest}` : `${book}+${chap}`;
    return `https://bible-api.com/${slug}`;
  }

  const API = { parse, firstRef, codexUrl, bibleApiUrl, BOOKS };

  // Expose as global (content script)
  if (typeof window !== 'undefined') window.CODEX_REF_PARSER = API;
  // Expose for service worker (importScripts)
  if (typeof self !== 'undefined') self.CODEX_REF_PARSER = API;
  // CommonJS-ish export for tests
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);

// ES-module re-export (popup/newtab can `import RefParser from './ref-parser.js'`)
// Browsers ignore this in classic-script context (content script, service worker).
try { /* eslint-disable */
  // eslint-disable-next-line
} catch (e) {}
