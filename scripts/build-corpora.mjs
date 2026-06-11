#!/usr/bin/env node
// build-corpora.mjs — bake the original-language corpora into offline bundles.
//
//   WLC    · Westminster Leningrad Codex (Hebrew Tanakh, vowels)
//            source: bolls.life full-translation dump (public domain)
//   SBLGNT · SBL Greek New Testament (Logos/SBL, CC BY 4.0)
//            source: github.com/LogosBible/SBLGNT plain-text files
//
// Output: data/bibles/wlc.json, data/bibles/sblgnt.json in the standard
// bundle shape consumed by bible.js _loadBundleOnce():
//   { translation, version, license, chapters: { "<bookId>.<ch>": [{n,text}] } }
//
// Run: node scripts/build-corpora.mjs

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "bibles");

// bolls.life numeric book ids → CODEX book ids (OT slice; mirrors BOOK_BOLLS in bible.js)
const BOLLS_OT = [
  "gen","exo","lev","num","deu","jos","jdg","rut","1sa","2sa","1ki","2ki",
  "1ch","2ch","ezr","neh","est","job","psa","pro","ecc","sng","isa","jer",
  "lam","ezk","dan","hos","jol","amo","oba","jon","mic","nam","hab","zep",
  "hag","zec","mal",
]; // index 0 = bolls book 1

// SBLGNT file name → CODEX book id
const SBL_FILES = {
  "Matt":"mat","Mark":"mrk","Luke":"luk","John":"jhn","Acts":"act","Rom":"rom",
  "1Cor":"1co","2Cor":"2co","Gal":"gal","Eph":"eph","Phil":"php","Col":"col",
  "1Thess":"1th","2Thess":"2th","1Tim":"1ti","2Tim":"2ti","Titus":"tit",
  "Phlm":"phm","Heb":"heb","Jas":"jas","1Pet":"1pe","2Pet":"2pe","1John":"1jn",
  "2John":"2jn","3John":"3jn","Jude":"jud","Rev":"rev",
};

const clean = (s) => String(s || "")
  .replace(/<[^>]+>/g, " ")          // markup
  .replace(/[⸀⸂⸃⸄⸅⟦⟧]/g, "")          // SBLGNT critical sigla
  .replace(/\s+/g, " ")
  .trim();

async function fetchOk(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r;
}

async function buildWLC() {
  console.log("WLC · downloading bolls.life dump (~17 MB)…");
  const verses = await (await fetchOk("https://bolls.life/static/translations/WLC.json")).json();
  const chapters = {};
  let count = 0;
  for (const v of verses) {
    const bookId = BOLLS_OT[v.book - 1];
    if (!bookId) continue;                      // dump is Tanakh-only, but be safe
    const text = clean(v.text);
    if (!text) continue;
    (chapters[`${bookId}.${v.chapter}`] ||= []).push({ n: v.verse, text });
    count++;
  }
  for (const arr of Object.values(chapters)) arr.sort((a, b) => a.n - b.n);
  const bundle = { translation: "wlc", version: "1.0.0",
    license: "Public Domain · Westminster Leningrad Codex", chapters };
  await writeFile(path.join(OUT, "wlc.json"), JSON.stringify(bundle));
  console.log(`WLC · ${count} verses · ${Object.keys(chapters).length} chapters → data/bibles/wlc.json`);
  return { count, chapters: Object.keys(chapters).length };
}

async function buildSBLGNT() {
  console.log("SBLGNT · downloading 27 books from LogosBible/SBLGNT…");
  const base = "https://raw.githubusercontent.com/LogosBible/SBLGNT/master/data/sblgnt/text";
  const chapters = {};
  let count = 0;
  for (const [file, bookId] of Object.entries(SBL_FILES)) {
    const txt = await (await fetchOk(`${base}/${encodeURIComponent(file)}.txt`)).text();
    for (const line of txt.split("\n")) {
      // "Matt 1:1\tΒίβλος γενέσεως …" — first line is the Greek title, no tab
      const m = line.match(/^\S+\s+(\d+):(\d+)\t(.+)$/);
      if (!m) continue;
      const text = clean(m[3]);
      if (!text) continue;
      (chapters[`${bookId}.${m[1]}`] ||= []).push({ n: Number(m[2]), text });
      count++;
    }
  }
  for (const arr of Object.values(chapters)) arr.sort((a, b) => a.n - b.n);
  const bundle = { translation: "sblgnt", version: "1.0.0",
    license: "SBLGNT © 2010 SBL & Logos Bible Software · CC BY 4.0", chapters };
  await writeFile(path.join(OUT, "sblgnt.json"), JSON.stringify(bundle));
  console.log(`SBLGNT · ${count} verses · ${Object.keys(chapters).length} chapters → data/bibles/sblgnt.json`);
  return { count, chapters: Object.keys(chapters).length };
}

await mkdir(OUT, { recursive: true });
const wlc = await buildWLC();
const sbl = await buildSBLGNT();

// Sanity floors: full Tanakh ≈ 23,213 vv / 929 ch; full GNT ≈ 7,941 vv / 260 ch.
if (wlc.count < 23000 || wlc.chapters < 925) throw new Error("WLC bundle looks incomplete");
if (sbl.count < 7900 || sbl.chapters < 260) throw new Error("SBLGNT bundle looks incomplete");
console.log("✓ corpora bundles complete");
