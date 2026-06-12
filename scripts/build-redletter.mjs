#!/usr/bin/env node
// build-redletter.mjs — regenerate data/red-letter.json from a REAL
// red-letter edition instead of a hand-curated guess.
//
// Source: World English Bible USFX (public domain, eBible.org via
// github.com/seven1m/open-bibles). The WEB text carries explicit
// <wj>…</wj> ("words of Jesus") markup placed by its editors — the same
// markers print shops use to ink red-letter editions. We extract, for
// every NT book, the set of verses that contain any <wj> span.
//
// This replaces the previous hand-typed dataset, which carried narrative
// verses marked red (e.g. Mark 1:18 "And straightway they forsook their
// nets…") — exactly the failure the curation was supposed to prevent.
//
// Output shape (unchanged — bible.js reads it as-is):
//   { "_doc": "...", "<bookId>.<chapter>": "3,15-17,21", ... }
// Empty chapters of covered books are written as "" so the renderer can
// distinguish "no Jesus speech" from "chapter not covered".
//
// Run: node scripts/build-redletter.mjs            (fetches the source)
//      node scripts/build-redletter.mjs <usfx.xml> (uses a local copy)

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_URL = "https://raw.githubusercontent.com/seven1m/open-bibles/master/eng-web.usfx.xml";

// USFM/USFX book code → CODEX book id (NT only — wj is an NT phenomenon).
const NT = {
  MAT: "mat", MRK: "mrk", LUK: "luk", JHN: "jhn", ACT: "act", ROM: "rom",
  "1CO": "1co", "2CO": "2co", GAL: "gal", EPH: "eph", PHP: "php", COL: "col",
  "1TH": "1th", "2TH": "2th", "1TI": "1ti", "2TI": "2ti", TIT: "tit",
  PHM: "phm", HEB: "heb", JAS: "jas", "1PE": "1pe", "2PE": "2pe",
  "1JN": "1jn", "2JN": "2jn", "3JN": "3jn", JUD: "jud", REV: "rev",
};

async function loadSource() {
  const local = process.argv[2];
  if (local) return readFileSync(local, "utf8");
  process.stderr.write(`[redletter] fetching ${SRC_URL}\n`);
  const r = await fetch(SRC_URL);
  if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
  return await r.text();
}

// Compress a sorted verse list to "1,4-7,12" range notation.
function toRanges(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    out.push(j > i ? `${s[i]}-${s[j]}` : `${s[i]}`);
    i = j;
  }
  return out.join(",");
}

const xml = await loadSource();
const out = {
  _doc: "Red-letter dataset GENERATED from the World English Bible's <wj> (words-of-Jesus) markup — eBible.org / open-bibles eng-web.usfx.xml, public domain. Verse numbers per chapter where the WEB editors mark Jesus speaking. Ranges 'a-b' inclusive, ',' separated; empty string = no Jesus speech in that chapter. Regenerate: node scripts/build-redletter.mjs. Do not hand-edit — fix the generator instead.",
  _source: "WEB <wj> markers (red-letter edition markup)",
  _generated: new Date().toISOString().slice(0, 10),
};

// Token walk per book: <c id>, <v id>, <ve/>, <wj>, </wj>, <f …>…</f>.
// wj may stay open across verse boundaries; footnote content is ignored.
const TOKEN = /<c\s+id="(\d+)"\s*\/?>|<v\s+id="(\d+)"[^>]*\/?>|<ve\s*\/>|<wj>|<\/wj>|<f\b[^>]*>|<\/f>/g;
let books = 0, marked = 0;
for (const [code, bookId] of Object.entries(NT)) {
  const start = xml.indexOf(`<book id="${code}"`);
  if (start < 0) continue;
  const end = xml.indexOf("</book>", start);
  const body = xml.slice(start, end < 0 ? undefined : end);
  books++;

  let chapter = 0, verse = 0, wj = 0, foot = 0;
  const perChapter = new Map(); // chapter -> Set(verse)
  const mark = () => {
    if (!chapter || !verse) return;
    if (!perChapter.has(chapter)) perChapter.set(chapter, new Set());
    perChapter.get(chapter).add(verse);
  };
  TOKEN.lastIndex = 0;
  let m;
  while ((m = TOKEN.exec(body))) {
    const t = m[0];
    if (m[1]) { chapter = +m[1]; verse = 0; if (!perChapter.has(chapter)) perChapter.set(chapter, new Set()); }
    else if (m[2]) { verse = +m[2]; if (wj > 0 && !foot) mark(); } // wj still open from previous verse
    else if (t === "<ve/>") { verse = 0; }
    else if (t === "<wj>") { wj++; if (!foot) mark(); }
    else if (t === "</wj>") { wj = Math.max(0, wj - 1); }
    else if (t.startsWith("<f")) { foot++; }
    else if (t === "</f>") { foot = Math.max(0, foot - 1); }
  }
  for (const [ch, set] of [...perChapter.entries()].sort((a, b) => a[0] - b[0])) {
    out[`${bookId}.${ch}`] = set.size ? toRanges(set) : "";
    marked += set.size;
  }
}

const dest = path.join(ROOT, "data", "red-letter.json");
writeFileSync(dest, JSON.stringify(out, null, 0).replace(/","/g, '",\n"') + "\n");
process.stderr.write(`[redletter] ${books} books · ${marked} red verses → ${path.relative(ROOT, dest)}\n`);
