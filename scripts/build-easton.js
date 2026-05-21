#!/usr/bin/env node
/**
 * Build full Easton's Bible Dictionary module from neuu-org/bible-dictionary-dataset
 * Source: https://github.com/neuu-org/bible-dictionary-dataset (public domain)
 * Outputs: data/modules/easton-sample.json in CODEX module format
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE = 'https://raw.githubusercontent.com/neuu-org/bible-dictionary-dataset/main/data/01_parsed';
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('').filter(l => l !== 'x'); // no x.json in repo
const OUT = path.join(__dirname, '..', 'data', 'modules', 'easton-sample.json');

// Book name → CODEX ID mapping
const BOOK_MAP = {
  'genesis': 'gen', 'exodus': 'exo', 'leviticus': 'lev', 'numbers': 'num',
  'deuteronomy': 'deu', 'joshua': 'jos', 'judges': 'jdg', 'ruth': 'rut',
  '1 samuel': '1sa', '2 samuel': '2sa', '1 kings': '1ki', '2 kings': '2ki',
  '1 chronicles': '1ch', '2 chronicles': '2ch', 'ezra': 'ezr', 'nehemiah': 'neh',
  'esther': 'est', 'job': 'job', 'psalms': 'psa', 'psalm': 'psa',
  'proverbs': 'pro', 'ecclesiastes': 'ecc', 'song of solomon': 'sng',
  'isaiah': 'isa', 'jeremiah': 'jer', 'lamentations': 'lam',
  'ezekiel': 'ezk', 'daniel': 'dan', 'hosea': 'hos', 'joel': 'jol',
  'amos': 'amo', 'obadiah': 'oba', 'jonah': 'jon', 'micah': 'mic',
  'nahum': 'nam', 'habakkuk': 'hab', 'zephaniah': 'zep', 'haggai': 'hag',
  'zechariah': 'zec', 'malachi': 'mal',
  'matthew': 'mat', 'mark': 'mrk', 'luke': 'luk', 'john': 'jhn',
  'acts': 'act', 'romans': 'rom', '1 corinthians': '1co', '2 corinthians': '2co',
  'galatians': 'gal', 'ephesians': 'eph', 'philippians': 'php', 'colossians': 'col',
  '1 thessalonians': '1th', '2 thessalonians': '2th', '1 timothy': '1ti', '2 timothy': '2ti',
  'titus': 'tit', 'philemon': 'phm', 'hebrews': 'heb', 'james': 'jas',
  '1 peter': '1pe', '2 peter': '2pe', '1 john': '1jn', '2 john': '2jn',
  '3 john': '3jn', 'jude': 'jud', 'revelation': 'rev',
  // Abbreviation fallbacks
  'gen': 'gen', 'ex': 'exo', 'exod': 'exo', 'lev': 'lev', 'num': 'num', 'deut': 'deu',
  'josh': 'jos', 'judg': 'jdg', '1 sam': '1sa', '2 sam': '2sa',
  '1 kin': '1ki', '2 kin': '2ki', '1 kgs': '1ki', '2 kgs': '2ki',
  '1 chr': '1ch', '2 chr': '2ch', '1 chron': '1ch', '2 chron': '2ch',
  'neh': 'neh', 'esth': 'est', 'prov': 'pro', 'eccl': 'ecc', 'eccles': 'ecc',
  'song': 'sng', 'cant': 'sng', 'isa': 'isa', 'jer': 'jer', 'lam': 'lam',
  'ezek': 'ezk', 'dan': 'dan', 'hos': 'hos', 'joel': 'jol', 'amos': 'amo',
  'obad': 'oba', 'jonah': 'jon', 'mic': 'mic', 'nah': 'nam', 'hab': 'hab',
  'zeph': 'zep', 'hag': 'hag', 'zech': 'zec', 'mal': 'mal',
  'matt': 'mat', 'mk': 'mrk', 'lk': 'luk', 'jn': 'jhn', 'jno': 'jhn',
  'rom': 'rom', '1 cor': '1co', '2 cor': '2co', 'gal': 'gal', 'eph': 'eph',
  'phil': 'php', 'col': 'col', '1 thess': '1th', '2 thess': '2th',
  '1 tim': '1ti', '2 tim': '2ti', 'tit': 'tit', 'philem': 'phm',
  'heb': 'heb', 'jas': 'jas', '1 pet': '1pe', '2 pet': '2pe',
  '1 jn': '1jn', '2 jn': '2jn', '3 jn': '3jn', 'rev': 'rev',
  // More abbreviations from old texts
  'ge': 'gen', 'le': 'lev', 'nu': 'num', 'de': 'deu', 'jos': 'jos',
  'jud': 'jdg', 'ru': 'rut', 'sa': '1sa', 'ki': '1ki', 'ch': '1ch',
  'ne': 'neh', 'es': 'est', 'ps': 'psa', 'pr': 'pro', 'ec': 'ecc',
  'so': 'sng', 'is': 'isa', 'je': 'jer', 'la': 'lam', 'eze': 'ezk',
  'da': 'dan', 'ho': 'hos', 'joe': 'jol', 'am': 'amo', 'ob': 'oba',
  'na': 'nam', 'zep': 'zep', 'mt': 'mat', 'mr': 'mrk', 'lu': 'luk',
  'ac': 'act', 'ro': 'rom', 'ga': 'gal', 'phili': 'php', 'ti': 'tit',
  'phile': 'phm', 'jude': 'jud', 're': 'rev',
};

function convertRef(refStr) {
  // Convert "Exodus 16:13" or "Ex. 16:13" → "exo.16.13"
  if (!refStr) return null;
  const cleaned = refStr.trim().replace(/\./g, '').replace(/\s+/g, ' ');
  // Match "BookName Chapter:Verse" or "BookName Chapter:Verse-Verse"
  const m = cleaned.match(/^(.+?)\s+(\d+):(\d+(?:\s*[-–]\s*\d+)?)$/);
  if (!m) {
    // Try just "BookName Chapter" (whole chapter ref)
    const m2 = cleaned.match(/^(.+?)\s+(\d+)$/);
    if (m2) {
      const bookName = m2[1].toLowerCase().replace(/\.$/, '').trim();
      const bookId = BOOK_MAP[bookName];
      if (bookId) return `${bookId}.${m2[2]}`;
    }
    return null;
  }
  const bookName = m[1].toLowerCase().replace(/\.$/, '').trim();
  const chapter = m[2];
  const verse = m[3].replace(/\s/g, '');
  const bookId = BOOK_MAP[bookName];
  if (!bookId) return null;
  return `${bookId}.${chapter}.${verse}`;
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'CODEX-builder/1.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetch(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log('Fetching Easton + Smith dictionary data from neuu-org/bible-dictionary-dataset...\n');

  const entries = {};
  let totalEntries = 0;
  let totalRefs = 0;
  let eastonCount = 0;
  let smithCount = 0;

  for (const letter of LETTERS) {
    const url = `${BASE}/${letter}.json`;
    process.stdout.write(`  ${letter.toUpperCase()} ... `);
    try {
      const raw = await fetch(url);
      const data = JSON.parse(raw);
      const keys = Object.keys(data);
      process.stdout.write(`${keys.length} entries\n`);

      for (const key of keys) {
        const entry = data[key];
        const slug = entry.slug || key.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        // Get Easton definition first, fall back to Smith
        const easDef = entry.definitions?.find(d => d.source === 'EAS');
        const smiDef = entry.definitions?.find(d => d.source === 'SMI');

        if (!easDef && !smiDef) continue;

        // Primary body text — Easton if available, else Smith
        let body = '';
        let source = '';
        if (easDef) {
          body = easDef.text;
          source = 'easton';
          eastonCount++;
        }
        if (smiDef) {
          if (!body) {
            body = smiDef.text;
            source = 'smith';
          }
          smithCount++;
        }

        // Convert scripture refs to CODEX format
        const refs = [];
        if (entry.scripture_refs) {
          for (const sr of entry.scripture_refs) {
            const converted = convertRef(sr.reference);
            if (converted) refs.push(converted);
          }
        }
        totalRefs += refs.length;

        // Build the entry
        const codexEntry = { title: entry.name || key };

        // Trim body to reasonable length (some Smith entries are very long)
        if (body.length > 2000) body = body.substring(0, 1997) + '...';
        codexEntry.body = body;

        // Add Smith's as supplementary if Easton is primary
        if (easDef && smiDef && smiDef.text.length > 20) {
          let smithBody = smiDef.text;
          if (smithBody.length > 1000) smithBody = smithBody.substring(0, 997) + '...';
          codexEntry.smith = smithBody;
        }

        if (refs.length > 0) codexEntry.refs = refs;
        codexEntry.source = source;

        entries[slug] = codexEntry;
        totalEntries++;
      }
    } catch (err) {
      process.stdout.write(`FAILED: ${err.message}\n`);
    }
  }

  const module = {
    meta: {
      id: 'easton',
      type: 'dictionary',
      version: '1.0.0',
      lang: 'en',
      name: "Easton's Bible Dictionary + Smith's Bible Dictionary",
      source: 'M.G. Easton (1893) + William Smith (1863) · public domain · via neuu-org/bible-dictionary-dataset',
      entries: totalEntries,
      refs: totalRefs,
    },
    entries,
  };

  const json = JSON.stringify(module);
  fs.writeFileSync(OUT, json);
  const sizeKB = Math.round(json.length / 1024);

  console.log(`\nDone!`);
  console.log(`  Entries: ${totalEntries} (${eastonCount} Easton, ${smithCount} Smith)`);
  console.log(`  Refs:    ${totalRefs}`);
  console.log(`  Size:    ${sizeKB} KB`);
  console.log(`  Output:  ${OUT}`);
}

main().catch(err => { console.error(err); process.exit(1); });
