// scripts/fetch_enoch.mjs
// Pulls R.H. Charles 1913 translation of 1 Enoch from Wikisource and emits
//   data/bibles/eth-en.json  (format: { [bookId]: { [chapter]: [{n,text}] } })
// Public domain. Run with: node scripts/fetch_enoch.mjs
//
// We deliberately keep the parser tolerant: Wikisource pages vary in
// formatting (some verses are poetic with line breaks, some have nested
// brackets for editorial insertions). The cleanup pipeline strips wiki
// templates, link syntax, headings, footnote refs, and editorial brackets
// while preserving the verse text itself.

import fs from "node:fs/promises";
import path from "node:path";

const API = "https://en.wikisource.org/w/api.php";
const CHAPTERS = 108;
const SLEEP_MS = 120;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchWikitext(ch) {
  const page = `The_Book_of_Enoch_(Charles)/Chapter_${String(ch).padStart(2, "0")}`;
  const u = `${API}?action=parse&format=json&prop=wikitext&page=${encodeURIComponent(page)}`;
  const r = await fetch(u, { headers: { "User-Agent": "codex-bible-study/1 (https://github.com/holasoyneto/codex)" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ch ${ch}`);
  const j = await r.json();
  if (j.error) throw new Error(`API error ch ${ch}: ${j.error.info}`);
  return j.parse?.wikitext?.["*"] || "";
}

// Strip wiki/template syntax. Order matters.
function clean(txt) {
  // Drop {{header ... }} templates and other curly templates.
  txt = txt.replace(/\{\{[^{}]*?\}\}/gs, "");
  // Repeat for nested templates (cheap pass).
  for (let i = 0; i < 3; i++) txt = txt.replace(/\{\{[^{}]*?\}\}/gs, "");
  // Section headers === ... === / == ... ==
  txt = txt.replace(/^=+\s*.*?\s*=+\s*$/gm, "");
  // "CHAPTER I." style header lines (in body, not verse text)
  txt = txt.replace(/^\s*CHAPTER\s+[IVXLC0-9]+\.?\s*$/gmi, "");
  // Wiki links: [[Target|Label]] -> Label,  [[Target]] -> Target
  txt = txt.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1");
  // External links: [url label] -> label
  txt = txt.replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, "$1");
  txt = txt.replace(/\[https?:\/\/\S+\]/g, "");
  // <ref>...</ref> and <ref ... />
  txt = txt.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");
  txt = txt.replace(/<ref[^/]*\/>/gi, "");
  // HTML tags
  txt = txt.replace(/<[^>]+>/g, "");
  // Editorial half-brackets ⌈ ⌉ ⌈⌈ ⌉⌉ (Charles' restoration markers) - keep text inside
  txt = txt.replace(/[⌈⌉]/g, "");
  // Bold/italic wikitext
  txt = txt.replace(/'''([^']+)'''/g, "$1").replace(/''([^']+)''/g, "$1");
  // Normalize whitespace
  return txt;
}

// Split cleaned text into verses by leading "N. " markers.
function parseVerses(txt) {
  // First, collapse stray newlines inside a verse into spaces, BUT preserve
  // double-newline (which separates poetic stanzas — also fine to collapse
  // for our flat verse model).
  const flat = txt.replace(/\s+/g, " ").trim();
  // Walk verse markers "1.", "2.", ..., possibly mid-sentence.
  // A safe pattern: digits + period + space, preceded by start or whitespace,
  // and followed by an uppercase letter / opening word. Charles' verses can
  // be 1-200+ in some chapters but typically <30.
  const re = /(?:^|\s)(\d{1,3})\.\s+(?=[A-Z“‘(\[])/g;
  const marks = [];
  let m;
  while ((m = re.exec(flat)) !== null) {
    marks.push({ n: parseInt(m[1], 10), start: m.index + (m[0].length - m[1].length - 2) });
  }
  if (!marks.length) return [];
  // Keep only the first run of strictly-increasing markers starting at 1
  // (filters spurious "5." inside dates or quotes).
  const verses = [];
  let expected = 1;
  for (let i = 0; i < marks.length; i++) {
    if (marks[i].n !== expected) continue;
    const next = marks.slice(i + 1).find(x => x.n === expected + 1);
    const end = next ? next.start : flat.length;
    const headLen = String(expected).length + 2; // "N. "
    const text = flat.slice(marks[i].start + headLen, end).trim()
      .replace(/\s+/g, " ")
      .replace(/^[—–-]\s*/, "")
      .replace(/\s+([,.;:!?])/g, "$1");
    if (text) verses.push({ n: expected, text });
    expected++;
  }
  return verses;
}

async function main() {
  // Flat format consumed by both _loadBundleOnce (which iterates
  // data.chapters[bookId.ch]) and our per-source bundle kind.
  const out = { translation: "eth-en", version: 1, chapters: {} };
  let totalVerses = 0;
  let emptyChapters = [];
  for (let ch = 1; ch <= CHAPTERS; ch++) {
    try {
      const wikitext = await fetchWikitext(ch);
      const cleaned = clean(wikitext);
      const verses = parseVerses(cleaned);
      const key = `1en.${ch}`;
      if (verses.length === 0) {
        emptyChapters.push(ch);
        out.chapters[key] = [{ n: 1, text: "(verse data unavailable — see Wikisource: The Book of Enoch (Charles) Chapter " + ch + ")" }];
      } else {
        out.chapters[key] = verses;
        totalVerses += verses.length;
      }
      process.stdout.write(`ch ${ch}: ${verses.length} verses\n`);
    } catch (e) {
      process.stdout.write(`ch ${ch}: ERROR ${e.message}\n`);
      out.chapters[`1en.${ch}`] = [{ n: 1, text: "(fetch failed — retry later)" }];
      emptyChapters.push(ch);
    }
    await sleep(SLEEP_MS);
  }
  const outPath = path.resolve("data/bibles/eth-en.json");
  await fs.writeFile(outPath, JSON.stringify(out));
  console.log(`\nWrote ${outPath}`);
  console.log(`Chapters: ${CHAPTERS}  Total verses: ${totalVerses}  Empty chapters: ${emptyChapters.length}`);
  if (emptyChapters.length) console.log(`Empty: ${emptyChapters.join(", ")}`);
}

main().catch(e => { console.error(e); process.exit(1); });
