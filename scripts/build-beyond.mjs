#!/usr/bin/env node
// build-beyond.mjs — bakes the 18 "ghost" registry books (deuterocanon /
// pseudepigrapha books no translation source carried) into one offline
// bundle: data/bibles/beyond.json, translation id "beyond".
//
// Every text here is a verified public-domain English translation
// (pre-1929 US publication). Books with NO obtainable PD English text get
// the honest single-verse placeholder and are listed in meta.missing —
// we never fake scripture.
//
// Dependency-free: global fetch + zlib + regex parsing only.
// Usage: node scripts/build-beyond.mjs

import { writeFileSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "bibles", "beyond.json");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

const log = (...a) => console.log("[beyond]", ...a);

// ── fetch helpers ────────────────────────────────────────────────────
async function get(url, { binary = false, charset = "windows-1252" } = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA } });
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (binary) return buf;
      // most of these 1990s-vintage pages are windows-1252, not utf-8
      return new TextDecoder(charset).decode(buf);
    } catch (e) {
      if (attempt === 3) throw e;
      log(`retry ${attempt} after error: ${e.message}`);
      await new Promise((res) => setTimeout(res, 1500 * attempt));
    }
  }
}

// ── text cleanup helpers ─────────────────────────────────────────────
const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "—", ndash: "–", hellip: "…",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
};
// accented-letter entities (Jubilees uses â/ê/û names heavily)
{
  const ACCENTS = { grave: "̀", acute: "́", circ: "̂", tilde: "̃", uml: "̈" };
  for (const base of "aeiouAEIOU") {
    for (const [suffix, mark] of Object.entries(ACCENTS)) {
      ENTITIES[base + suffix] = (base + mark).normalize("NFC");
    }
  }
  ENTITIES.ntilde = "ñ"; ENTITIES.Ntilde = "Ñ"; ENTITIES.ccedil = "ç"; ENTITIES.Ccedil = "Ç";
}
function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (_, name) => ENTITIES[name.toLowerCase()] ?? `&${name};`);
}
function stripTags(s) {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<sup[\s\S]*?<\/sup>/gi, " ") // footnote superscripts
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}
function clean(s) {
  // decode twice — some pages (ECW) double-encode entities (&amp;gt;)
  return decodeEntities(decodeEntities(stripTags(s)))
    .replace(/\[\s*\*?\d+\s*\]/g, " ")   // [1] / [*1] footnote refs
    .replace(/\[p\.\s*\d+\]/gi, " ")      // [p. 121] page markers
    .replace(/\s+/g, " ")
    .trim();
}

// Split plain text into verses by leading numbers, accepting a number only
// when it continues the expected sequence (so digits inside prose never
// split a verse). `slack` allows the source to skip a verse label or two
// (it sometimes merges verses); the skipped label simply doesn't exist.
function splitBySequence(text, { start = 1, slack = 0, pattern = /\((\d+)\)|\b(\d+(?:,\d+)?)\s/g } = {}) {
  const verses = [];
  let expected = start;
  let lastIdx = 0;
  let lastN = null;
  let m;
  pattern.lastIndex = 0;
  while ((m = pattern.exec(text))) {
    const label = m[1] ?? m[2];
    const first = parseInt(label, 10);
    const ok = first === expected || (slack > 0 && first > expected && first <= expected + slack);
    if (!ok) continue;
    if (lastN !== null) {
      const t = text.slice(lastIdx, m.index).trim();
      if (t) verses.push({ n: lastN, text: t });
    }
    lastN = first;
    lastIdx = m.index + m[0].length;
    const parts = label.split(",").map(Number);
    expected = parts[parts.length - 1] + 1;
  }
  if (lastN !== null) {
    const t = text.slice(lastIdx).trim();
    if (t) verses.push({ n: lastN, text: t });
  }
  return verses;
}

const ROMAN = (() => {
  const vals = [[40,"xl"],[10,"x"],[9,"ix"],[5,"v"],[4,"iv"],[1,"i"]];
  return (n) => { let s = ""; for (const [v, sym] of vals) while (n >= v) { s += sym; n -= v; } return s; };
})();
const ROMAN_TO_NUM = {};
for (let i = 1; i <= 60; i++) ROMAN_TO_NUM[ROMAN(i)] = i;

// ── the bundle under construction ────────────────────────────────────
const chapters = {};
const sources = {};
const missing = [];
function put(bookId, ch, verses, where) {
  if (!Array.isArray(verses) || verses.length === 0)
    throw new Error(`${bookId}.${ch} came out empty (${where})`);
  for (const v of verses) {
    if (!v.text || typeof v.text !== "string" || !v.text.trim())
      throw new Error(`${bookId}.${ch}:${v.n} has empty text (${where})`);
    v.text = v.text.trim();
  }
  chapters[`${bookId}.${ch}`] = verses;
}
function fallback(bookId, name, reason) {
  put(bookId, 1, [{ n: 1, text: `[${name}] · No public-domain English translation could be sourced for this book yet. The shelf keeps its place; the text is coming.` }], "fallback");
  missing.push(bookId);
  sources[bookId] = `MISSING — ${reason}`;
  log(`${bookId}: FALLBACK — ${reason}`);
}
function countChapters(bookId) {
  return Object.keys(chapters).filter((k) => k.startsWith(bookId + ".")).length;
}

// ═════════════════════════════════════════════════════════════════════
// esg — Esther (Greek additions) · KJV 1611 "Rest of Esther", served by
// bolls.life as Esther chapters 10–16 of its KJV-with-Apocrypha corpus.
// Conventional numbering keeps the additions at chapters 10–16 (the Greek
// text begins at 10:4); chapters 1–9 belong to the Hebrew Esther, so each
// carries one honest cross-reference verse instead of duplicated text.
// ═════════════════════════════════════════════════════════════════════
async function buildEsg() {
  for (let ch = 1; ch <= 9; ch++) {
    put("esg", ch, [{ n: 1, text: "[Esther — Greek additions] · Chapters 1–9 are the Hebrew Esther; read them in any full translation. The Greek additions occupy chapters 10–16 here, following the King James 1611 “Rest of Esther” numbering, which begins at 10:4." }], "esg pointer");
  }
  for (let ch = 10; ch <= 16; ch++) {
    const arr = JSON.parse(await get(`https://bolls.life/get-text/KJV/17/${ch}/`, { charset: "utf-8" }));
    const verses = arr.map((v) => ({ n: v.verse, text: clean(String(v.text)) }));
    put("esg", ch, verses, "bolls KJV Esther");
  }
  sources.esg = "KJV 1611 Apocrypha, Rest of Esther (chs 10–16) — bolls.life KJV corpus, https://bolls.life/get-text/KJV/17/<ch>/ ; chs 1–9 are Hebrew-Esther cross-reference stubs";
  log("esg: 16 chapters (10–16 real text, 1–9 cross-reference stubs)");
}

// ═════════════════════════════════════════════════════════════════════
// jub — Jubilees, R.H. Charles translation (1902/1913), 50 chapters.
// pseudepigrapha.com serves one page per chapter with <li> verses.
// The unnumbered prologue ("THIS is the history…") is omitted (it sits
// outside Charles's chapter/verse scheme); documented in the source note.
// ═════════════════════════════════════════════════════════════════════
async function buildJub() {
  for (let ch = 1; ch <= 50; ch++) {
    const html = await get(`https://www.pseudepigrapha.com/jubilees/${ch}.htm`);
    // take content after the [Chapter N] heading — skips the editorial
    // summary blockquote (and, on page 1, the prologue blockquote)
    const bodyIdx = html.search(/\[Chapter\s+\d+\]/i);
    if (bodyIdx < 0) throw new Error(`jub ${ch}: no chapter heading`);
    const body = html.slice(bodyIdx).split(/<hr/i)[0];
    const items = [...body.matchAll(/<li>([\s\S]*?)(?=<li>|<\/ol>)/gi)].map((m) => clean(m[1]));
    const verses = items.filter(Boolean).map((text, i) => ({ n: i + 1, text }));
    put("jub", ch, verses, "pseudepigrapha.com jubilees");
  }
  sources.jub = "The Book of Jubilees, tr. R.H. Charles (Apocrypha & Pseudepigrapha of the OT, Oxford 1913) — https://www.pseudepigrapha.com/jubilees/ ; unnumbered prologue omitted";
  log("jub: 50 chapters");
}

// ═════════════════════════════════════════════════════════════════════
// 4ezr — IV Ezra = KJV 1611 "2 Esdras", already shipped in the charles
// bundle (data/bibles/charles.json, book id 2es, 16 chapters). Reuse it.
// ═════════════════════════════════════════════════════════════════════
function build4ezr() {
  const charles = JSON.parse(readFileSync(join(ROOT, "data", "bibles", "charles.json"), "utf-8"));
  let n = 0;
  for (const [key, verses] of Object.entries(charles.chapters)) {
    if (!key.startsWith("2es.")) continue;
    put("4ezr", key.slice(4), verses.map((v) => ({ n: v.n, text: v.text })), "charles.json 2es");
    n++;
  }
  if (n !== 16) throw new Error(`4ezr: expected 16 chapters from charles.json 2es, got ${n}`);
  sources["4ezr"] = "KJV 1611 Apocrypha, 2 Esdras — reused from the app's charles bundle (data/bibles/charles.json, book 2es)";
  log("4ezr: 16 chapters (reused charles bundle 2es)");
}

// ═════════════════════════════════════════════════════════════════════
// 3co — III Corinthians (Paul's reply, vv. 1–40), tr. M.R. James,
// The Apocryphal New Testament (Oxford, 1924) — inside the Acts of Paul.
// ═════════════════════════════════════════════════════════════════════
async function build3co() {
  const html = await get("https://www.earlychristianwritings.com/text/actspaul.html");
  const start = html.indexOf("III.1 Paul, a prisoner of Jesus Christ");
  if (start < 0) throw new Error("3co: anchor not found");
  let section = html.slice(start, html.indexOf("[Laon adds:", start));
  if (section.length < 500) throw new Error("3co: section too short");
  // known transcription typo on the source page: verse 36 printed as "86"
  section = section.replace(/ 86 And whoso receiveth/, " 36 And whoso receiveth");
  const text = clean(section).replace(/^III\.\s*1\s*/, "");
  const verses = [{ n: 1, text: "" }, ...[]];
  const rest = splitBySequence("1 " + text.replace(/^/, ""), { start: 1, slack: 0, pattern: /\b(\d+)\s/g });
  if (rest.length < 35 || rest[rest.length - 1].n !== 40)
    throw new Error(`3co: bad verse parse (${rest.length} verses, last ${rest[rest.length - 1]?.n})`);
  put("3co", 1, rest, "ECW actspaul");
  sources["3co"] = "III Corinthians (Paul's reply, Acts of Paul), tr. M.R. James, The Apocryphal New Testament (Oxford: Clarendon, 1924) — https://www.earlychristianwritings.com/text/actspaul.html";
  log(`3co: 1 chapter, ${rest.length} verses`);
}

// ═════════════════════════════════════════════════════════════════════
// lao — Epistle to the Laodiceans, tr. M.R. James 1924, 20 verses.
// ═════════════════════════════════════════════════════════════════════
async function buildLao() {
  const html = await get("https://www.pseudepigrapha.com/LostBooks/paul2laodiceans.htm");
  const start = html.indexOf("<p>1 Paul, an apostle");
  if (start < 0) throw new Error("lao: anchor not found");
  let text = clean(html.slice(start));
  // stop before M.R. James's closing commentary
  const stop = text.indexOf("It is not easy to imagine");
  if (stop > 0) text = text.slice(0, stop);
  // known transcription typo on the source page: verse 6 printed as "5"
  text = text.replace(/ 5 And now are my bonds/, " 6 And now are my bonds");
  const verses = splitBySequence(text, { start: 1, pattern: /\b(\d+)\s/g });
  if (verses.length < 18) throw new Error(`lao: only ${verses.length} verses`);
  put("lao", 1, verses, "pseudepigrapha.com laodiceans");
  sources.lao = "Epistle to the Laodiceans, tr. M.R. James, The Apocryphal New Testament (Oxford: Clarendon, 1924) — https://www.pseudepigrapha.com/LostBooks/paul2laodiceans.htm";
  log(`lao: 1 chapter, ${verses.length} verses`);
}

// ═════════════════════════════════════════════════════════════════════
// ps2 — Apocryphal Psalms 152–155, tr. William Wright, "Some Apocryphal
// Psalms in Syriac", PSBA 9 (1887) — explicitly public domain at
// tertullian.org. Wright's Syriac Psalm IV=152, V=153, II=154, III=155.
// ═════════════════════════════════════════════════════════════════════
async function buildPs2() {
  const html = await get("https://www.tertullian.org/fathers/wright_syriac_apocryphal_psalms.htm");
  const text = clean(html).replace(/\|\d+/g, " "); // |264 page markers
  const anchors = [
    { ps: 152, ch: 1, marker: "contending with the lion and the wolf which took a sheep" },
    { ps: 153, ch: 2, marker: "returning thanks to God, who had delivered him from the lion" },
    { ps: 154, ch: 3, marker: "Prayer of Hezekiah when enemies surrounded him" },
    { ps: 155, ch: 4, marker: "obtained permission from Cyrus to return home" },
  ];
  // segment: each psalm runs from its title to the next roman-section title
  const allIdx = anchors.map((a) => ({ ...a, idx: text.indexOf(a.marker) }));
  for (const a of allIdx) if (a.idx < 0) throw new Error(`ps2: marker missing for Ps ${a.ps}`);
  const endIdx = text.indexOf("Queens' College, Cambridge");
  for (const a of allIdx) {
    const others = allIdx.map((b) => b.idx).filter((i) => i > a.idx);
    const stop = Math.min(...others, endIdx > a.idx ? endIdx : Infinity);
    const seg = text.slice(a.idx + a.marker.length, stop);
    const verses = splitBySequence(seg, { start: 1, pattern: /\((\d+)\)/g });
    if (verses.length < 5) throw new Error(`ps2: Ps ${a.ps} only ${verses.length} verses`);
    put("ps2", a.ch, verses, "tertullian.org Wright 1887");
  }
  sources.ps2 = "Psalms 152–155, tr. William Wright, 'Some Apocryphal Psalms in Syriac', PSBA 9 (1887), public-domain transcription — https://www.tertullian.org/fathers/wright_syriac_apocryphal_psalms.htm (Syriac IV=152, V=153, II=154, III=155; chapters 1–4 = Pss 152–155)";
  log("ps2: 4 chapters (Pss 152–155, Wright 1887)");
}

// ═════════════════════════════════════════════════════════════════════
// 2ba — II Baruch (Syriac Apocalypse), tr. R.H. Charles (1896/1913),
// 87 chapters incl. the Epistle (78–87). The only structured digital
// edition (Wesley Center/Lyons, mirrored at pseudepigrapha.com) breaks
// off at 85:2, so chapters 85–87 are supplied verbatim from Charles's
// 1896 edition (archive.org OCR, hand-corrected).
// epb — Epistle of Baruch = 2 Baruch 78–86 as one continuous chapter.
// ═════════════════════════════════════════════════════════════════════
const BARUCH_TAIL = {
  85: [
    "Know ye, moreover, that in former times and in the generations of old those our fathers had helpers, righteous men and holy prophets;",
    "Nay, more, we were in our own land, and they helped us when we sinned, and they interceded for us to Him who made us, because they trusted in their works, and the Mighty One heard their prayer and forgave us.",
    "But now the righteous have been gathered, and the prophets have fallen asleep, and we also have gone forth from the land, and Zion hath been taken from us; and we have nothing now save the Mighty One and His Law.",
    "If, therefore, we direct and dispose our hearts, we shall receive everything that we lost, and much better things than we lost by many times.",
    "For what we have lost was subject to corruption, and what we shall receive shall not be corruptible.",
    "Moreover, also, I have written thus to our brethren to Babylon, that to them also I may attest these very things.",
    "And let all those things aforesaid be always before your eyes, because we are still in the spirit and the power of our liberty.",
    "Again, moreover, the Most High also is long-suffering towards us here, and He hath shown to us that which is to be, and hath not concealed from us what shall befall in the end.",
    "Before, therefore, judgement exact its own, and truth that which is its due, let us prepare our soul, that we may enter into possession of, and not be taken possession of, and that we may hope and not be put to shame, and that we may rest with our fathers, and not be tormented with our enemies.",
    "For the youth of the world is past, and the strength of the creation is already exhausted, and the advent of the times is very short, yea, they have passed by; and the pitcher is near to the cistern, and the ship to the port, and the course of the journey to the city, and life to its consummation.",
    "And, again, prepare your souls, so that when ye sail and ascend from the ship ye may have rest, and not be condemned when ye depart.",
    "For lo! when the Most High shall bring to pass all these things, there shall not be there again a place of repentance, nor a limit to the times, nor a duration for the hours, nor a change of ways, nor place for prayer, nor sending of petitions, nor receiving of knowledge, nor giving of love, nor place of repentance for the soul, nor supplication for offences, nor intercession of the fathers, nor prayer of the prophets, nor help of the righteous.",
    "There there is the sentence of corruption, the way of fire, and the path which bringeth to Gehenna.",
    "On this account there is one Law by One, one age and an end for all who are in it.",
    "Then He will preserve those whom He can forgive, and at the same time destroy those who are polluted with sins.",
  ],
  86: [
    "When, therefore, ye receive this my epistle, read it in your congregations with care.",
    "And meditate thereon, above all on the days of your fasts.",
    "And bear me in mind by means of this epistle, as I also bear you in mind in it, and always fare ye well.",
  ],
  87: [
    "And it came to pass when I had ended all the words of this epistle, and had written it sedulously to its close, that I folded it, and sealed it carefully, and bound it to the neck of the eagle, and dismissed and sent it. Here endeth the Book of Baruch, the Son of Neriah.",
  ],
};

async function build2ba() {
  const html = await get("https://www.pseudepigrapha.com/pseudepigrapha/2Baruch.html");
  // cut the TOC (everything before the first in-body chapter header) and
  // the footer (the truncation marker + copyright block)
  const bodyStart = html.search(/<A ID="C1">\s*<FONT Color="red">/i);
  const bodyEnd = html.search(/<FONT Color="fuchsia">finish<\/FONT>/i);
  if (bodyStart < 0) throw new Error("2ba: body start not found");
  const body = html
    .slice(bodyStart, bodyEnd > 0 ? bodyEnd : undefined)
    // in-body section-topic headings ("9-12. First Fast of seven Days…")
    .replace(/<CENTER>\s*<I>[\s\S]*?<\/CENTER>/gi, " ");
  // chapter 32's anchors lack the "C" prefix (ID="32.1") — accept both
  const marker = /<A ID="C?(\d+)(?:\.(\d+))?">/gi;
  const marks = [];
  let m;
  while ((m = marker.exec(body))) marks.push({ ch: +m[1], v: m[2] ? +m[2] : null, start: m.index, end: marker.lastIndex });
  const byCh = new Map();
  for (let i = 0; i < marks.length; i++) {
    const mk = marks[i];
    if (mk.v === null) continue; // chapter header anchor, no text of its own
    const stop = i + 1 < marks.length ? marks[i + 1].start : body.length;
    let seg = body.slice(mk.end, stop);
    seg = seg.replace(/^[\s\S]*?<\/A>/i, " "); // drop the blue verse-number label
    const text = clean(seg);
    if (!text) continue;
    if (!byCh.has(mk.ch)) byCh.set(mk.ch, []);
    byCh.get(mk.ch).push({ n: mk.v, text });
  }
  for (let ch = 1; ch <= 84; ch++) {
    if (!byCh.has(ch)) throw new Error(`2ba: chapter ${ch} missing from source`);
    put("2ba", ch, byCh.get(ch), "pseudepigrapha.com 2Baruch");
  }
  for (const [ch, vv] of Object.entries(BARUCH_TAIL)) {
    put("2ba", ch, vv.map((text, i) => ({ n: i + 1, text })), "Charles 1896 tail");
  }
  sources["2ba"] = "II Baruch, tr. R.H. Charles (Apocrypha & Pseudepigrapha of the OT, Oxford 1913) — chs 1–84: https://www.pseudepigrapha.com/pseudepigrapha/2Baruch.html (Wesley Center digital edition); chs 85–87: Charles, The Apocalypse of Baruch (London 1896) via archive.org OCR, hand-corrected (the digital edition breaks off at 85:2)";
  log("2ba: 87 chapters");

  // epb — the Epistle (2 Bar 78–86) transmitted separately in the Syriac
  // tradition; one continuous chapter, verses renumbered sequentially.
  const epVerses = [];
  for (let ch = 78; ch <= 86; ch++) {
    for (const v of chapters[`2ba.${ch}`]) epVerses.push({ n: epVerses.length + 1, text: v.text });
  }
  put("epb", 1, epVerses, "2ba 78-86");
  sources.epb = "Epistle of Baruch = II Baruch 78–86 (same Charles translation), renumbered as one continuous chapter";
  log(`epb: 1 chapter, ${epVerses.length} verses (= 2 Bar 78–86)`);
}

// ═════════════════════════════════════════════════════════════════════
// 1cl / 2cl — I & II Clement, tr. J.B. Lightfoot (PD), 65 / 20 chapters.
// earlychristianwritings.com marks every verse "1Clem C:V".
// ═════════════════════════════════════════════════════════════════════
async function buildClement(bookId, tag, url, expectChapters) {
  let html = await get(url);
  // cut the site footer/nav so the last verse doesn't swallow it
  const footer = html.search(/Go to the[\s\S]{0,80}Chronological List|Early Christian Writings is copyright/i);
  if (footer > 0) html = html.slice(0, footer);
  const re = new RegExp(`${tag}\\s+(\\d+):(\\d+)([\\s\\S]*?)(?=${tag}\\s+\\d+:\\d+|</body|$)`, "gi");
  const byCh = new Map();
  let m;
  while ((m = re.exec(html))) {
    const ch = +m[1], v = +m[2];
    // drop Lightfoot's stray emendation brackets (openers lost in the
    // ECW transcription, e.g. "sin>")
    const text = clean(m[3]).replace(/\s*[<>]/g, "");
    if (!text) continue;
    if (!byCh.has(ch)) byCh.set(ch, []);
    byCh.get(ch).push({ n: v, text });
  }
  for (let ch = 1; ch <= expectChapters; ch++) {
    if (!byCh.has(ch)) throw new Error(`${bookId}: chapter ${ch} missing`);
    put(bookId, ch, byCh.get(ch), "ECW Lightfoot");
  }
  sources[bookId] = `${tag === "1Clem" ? "I" : "II"} Clement, tr. J.B. Lightfoot (The Apostolic Fathers, 1891) — ${url}`;
  log(`${bookId}: ${expectChapters} chapters`);
}

// ═════════════════════════════════════════════════════════════════════
// 2en — II Enoch (Slavonic, "Secrets of Enoch"), tr. W.R. Morfill (1896),
// 68 chapters. pseudepigrapha.com: <B>Chapter N…</B> headers, blue
// verse-number FONT markers.
// ═════════════════════════════════════════════════════════════════════
async function build2en() {
  let html = await get("https://www.pseudepigrapha.com/pseudepigrapha/enochs2.htm");
  const credits = html.indexOf("Translated from the Slavonic");
  if (credits > 0) html = html.slice(0, credits);
  const chRe = /Chapter\s+(\d+),\s*[IVXL]+/gi;
  const heads = [];
  let m;
  while ((m = chRe.exec(html))) heads.push({ ch: +m[1], start: m.index, end: chRe.lastIndex });
  const seen = new Set();
  for (let i = 0; i < heads.length; i++) {
    const { ch, end } = heads[i];
    if (seen.has(ch)) continue;
    seen.add(ch);
    const stop = i + 1 < heads.length ? heads[i + 1].start : html.length;
    const seg = html.slice(end, stop);
    const vRe = /<FONT Color="#0000FF" Size="-2">(\d+)<\/FONT>/gi;
    const vMarks = [];
    let vm;
    while ((vm = vRe.exec(seg))) vMarks.push({ n: +vm[1], start: vm.index, end: vRe.lastIndex });
    const verses = [];
    for (let j = 0; j < vMarks.length; j++) {
      const vstop = j + 1 < vMarks.length ? vMarks[j + 1].start : seg.length;
      const text = clean(seg.slice(vMarks[j].end, vstop));
      if (text) verses.push({ n: vMarks[j].n, text });
    }
    put("2en", ch, verses, "pseudepigrapha.com enochs2");
  }
  for (let ch = 1; ch <= 68; ch++) if (!chapters[`2en.${ch}`]) throw new Error(`2en: chapter ${ch} missing`);
  sources["2en"] = "II Enoch (The Book of the Secrets of Enoch), tr. W.R. Morfill (Oxford 1896) — https://www.pseudepigrapha.com/pseudepigrapha/enochs2.htm";
  log(`2en: ${countChapters("2en")} chapters`);
}

// ═════════════════════════════════════════════════════════════════════
// jas-pat — Testaments of the Twelve Patriarchs, tr. R.H. Charles (via
// R.H. Platt, The Forgotten Books of Eden, 1926 — PD). One registry
// chapter per testament (12); verses renumbered sequentially inside each
// testament (the FBE chapter-summaries are editorial and are skipped).
// od-sol — Odes of Solomon, tr. J. Rendel Harris (1909/1911), same volume.
// Both ride on the full-text fbe.txt.gz from sacred-texts via Wayback
// (sacred-texts blocks plain fetches).
// ═════════════════════════════════════════════════════════════════════
const FBE_URL = "https://web.archive.org/web/2023id_/https://www.sacred-texts.com/bib/fbe/fbe.txt.gz";
const PATRIARCHS = ["REUBEN","SIMEON","LEVI","JUDAH","ISSACHAR","ZEBULUN","DAN","NAPHTALI","GAD","ASHER","JOSEPH","BENJAMIN"];

function fbeLinesClean(raw) {
  return raw.split(/\r?\n/).map((l) => l
    .replace(/\[\*\d+\]/g, " ")
    .replace(/\[p\.\s*\d+\]/gi, " ")
    .replace(/\s+$/g, ""));
}

async function buildFbeBooks() {
  const gz = await get(FBE_URL, { binary: true });
  const txt = new TextDecoder("windows-1252").decode(gunzipSync(gz));
  const lines = fbeLinesClean(txt);
  const isBoiler = (l) => /The Forgotten Books of Eden, by Rutherford H\. Platt/i.test(l) || /^\s*\[p\.\s*\d+\]\s*$/i.test(l);

  // ── Odes of Solomon ──
  const odeStart = lines.findIndex((l) => /^THE ODES OF SOLOMON\.?\s*$/.test(l.trim()));
  if (odeStart < 0) throw new Error("od-sol: section not found");
  let odeEnd = lines.length;
  for (let i = odeStart + 1; i < lines.length; i++) {
    if (/^THE (LETTER|PSALMS|TESTAMENT|STORY|FOURTH)/.test(lines[i].trim()) && !/SOLOMON/.test(lines[i])) { odeEnd = i; break; }
  }
  const odeLines = lines.slice(odeStart, odeEnd);
  let curOde = 0;
  let odeVerses = [];
  const flushOde = () => {
    if (!curOde) return;
    if (odeVerses.length === 0) {
      // Ode 2 is lost from the manuscript tradition — say so, don't fake it
      odeVerses = [{ n: 1, text: `[Ode ${curOde}] · No part of this Ode has ever been identified; it is lost from the manuscript tradition.` }];
    }
    put("od-sol", curOde, odeVerses, "FBE odes");
  };
  for (const line of odeLines) {
    const t = line.trim();
    const oh = t.match(/^ODE (\d+)\.?\s*$/);
    if (oh) { flushOde(); curOde = +oh[1]; odeVerses = []; continue; }
    if (!curOde || !t || isBoiler(t)) continue;
    const vm = t.match(/^(\d+)\s+(.*)$/);
    if (vm) odeVerses.push({ n: +vm[1], text: vm[2].trim() });
    else if (odeVerses.length) odeVerses[odeVerses.length - 1].text += " " + t; // wrapped line
    // unnumbered lines before verse 1 are Platt's editorial preambles — skip
  }
  flushOde();
  for (let o = 1; o <= 42; o++) if (!chapters[`od-sol.${o}`]) throw new Error(`od-sol: Ode ${o} missing`);
  sources["od-sol"] = "Odes of Solomon, tr. J. Rendel Harris (1909/1911), as printed in R.H. Platt, The Forgotten Books of Eden (1926) — sacred-texts.com/bib/fbe/fbe.txt.gz via web.archive.org (Ode 2 is lost from the manuscript tradition)";
  log("od-sol: 42 chapters (Ode 2 lost — honest stub)");

  // ── Testaments of the Twelve Patriarchs ──
  const testStarts = PATRIARCHS.map((p) => {
    const idx = lines.findIndex((l) => new RegExp(`^\\s*(THE )?TESTAMENT OF ${p}\\.?\\s*$`).test(l));
    if (idx < 0) throw new Error(`jas-pat: TESTAMENT OF ${p} not found`);
    return idx;
  });
  for (let t = 0; t < 12; t++) {
    const from = testStarts[t];
    const to = t + 1 < 12 ? testStarts[t + 1] : lines.findIndex((l, i) => i > from && /^Footnotes\s*$/.test(l.trim()) && i > testStarts[11]);
    const seg = lines.slice(from + 1, to > from ? to : lines.length);
    const verses = [];
    let pendingUnnumbered = 0; // after a CHAP heading: 1st unnumbered para = summary, 2nd = verse 1
    let collecting = false;
    for (const line of seg) {
      const tr = line.trim();
      if (!tr || isBoiler(tr)) { if (collecting) collecting = false; continue; }
      if (/^Footnotes\s*$/.test(tr)) break;
      if (/^\^?\d+:\d+/.test(tr)) continue; // footnote bodies like "^221:1 ..."
      if (/^CHAP\.\s+[IVXL]+\.?\s*$/.test(tr)) { pendingUnnumbered = 2; collecting = false; continue; }
      const vm = tr.match(/^(\d+)\s+(.*)$/);
      if (vm) {
        verses.push({ n: verses.length + 1, text: vm[2].trim() });
        collecting = true;
        pendingUnnumbered = 0;
      } else if (pendingUnnumbered === 2) {
        pendingUnnumbered = 1; // editorial chapter summary — skip
        collecting = false;
      } else if (pendingUnnumbered === 1) {
        verses.push({ n: verses.length + 1, text: tr }); // unnumbered first verse
        pendingUnnumbered = 0;
        collecting = true;
      } else if (collecting && verses.length) {
        verses[verses.length - 1].text += " " + tr; // wrapped continuation
      }
    }
    put("jas-pat", t + 1, verses, `FBE testament ${PATRIARCHS[t]}`);
  }
  sources["jas-pat"] = "Testaments of the Twelve Patriarchs, tr. R.H. Charles, as printed in R.H. Platt, The Forgotten Books of Eden (1926) — sacred-texts.com/bib/fbe/fbe.txt.gz via web.archive.org; one chapter per testament, verses renumbered sequentially";
  log("jas-pat: 12 chapters (one per testament)");
}

// ═════════════════════════════════════════════════════════════════════
// ap-mos — Apocalypse of Moses, tr. L.S.A. Wells in R.H. Charles (1913),
// 43 chapters. Source marks chapters with lowercase roman numerals and
// verses with arabic numbers (sometimes combined "1,2", occasionally a
// label skipped); chapter blocks appear slightly out of order on the
// page, so we anchor on labels, not position.
// ═════════════════════════════════════════════════════════════════════
async function buildApMos() {
  const html = await get("https://www.pseudepigrapha.com/pseudepigrapha/apcmose.htm");
  let text = clean(html.slice(0, html.search(/Scanned and Edited by/i)));
  const start = text.indexOf("i 1 This is the story");
  if (start < 0) throw new Error("ap-mos: start anchor not found");
  text = text.slice(start);
  // tokenize: roman chapter labels followed by a verse number open a chapter
  const tokRe = /\b([ivxl]+)\s+(?=\d)/g;
  const marks = [];
  let m;
  while ((m = tokRe.exec(text))) {
    const n = ROMAN_TO_NUM[m[1]];
    if (n && n >= 1 && n <= 43) marks.push({ ch: n, start: m.index, end: tokRe.lastIndex });
  }
  const byCh = new Map();
  for (let i = 0; i < marks.length; i++) {
    const stop = i + 1 < marks.length ? marks[i + 1].start : text.length;
    const seg = text.slice(marks[i].end, stop);
    if (!byCh.has(marks[i].ch)) byCh.set(marks[i].ch, "");
    byCh.set(marks[i].ch, (byCh.get(marks[i].ch) + " " + seg).trim());
  }
  for (let ch = 1; ch <= 43; ch++) {
    const seg = byCh.get(ch);
    if (!seg) throw new Error(`ap-mos: chapter ${ch} missing`);
    // verse labels are sequential but the source sometimes merges/skips one
    const verses = splitBySequence(seg, { start: 1, slack: 2, pattern: /\b(\d+(?:,\d+)?)\s/g });
    if (!verses.length) {
      put("ap-mos", ch, [{ n: 1, text: seg }], "apcmose unlabelled");
    } else {
      put("ap-mos", ch, verses, "apcmose");
    }
  }
  sources["ap-mos"] = "Apocalypse of Moses (Apocalypsis Mosis), tr. L.S.A. Wells in R.H. Charles, Apocrypha & Pseudepigrapha of the OT (Oxford 1913) — https://www.pseudepigrapha.com/pseudepigrapha/apcmose.htm";
  log("ap-mos: 43 chapters");
}

// ═════════════════════════════════════════════════════════════════════
// main
// ═════════════════════════════════════════════════════════════════════
log("building data/bibles/beyond.json …");

await buildEsg();
await buildJub();
build4ezr();
await build3co();
await buildLao();
await buildPs2();
await build2ba();
await buildClement("1cl", "1Clem", "https://www.earlychristianwritings.com/text/1clement-lightfoot.html", 65);
await buildClement("2cl", "2Clem", "https://www.earlychristianwritings.com/text/2clement-lightfoot.html", 20);
await build2en();
await buildFbeBooks();
await buildApMos();

// No public-domain English translation exists for these — honest stubs.
fallback("1mq", "I Meqabyan", "all known English translations of Meqabyan are modern (2010s+) and under copyright; no pre-1929 English translation exists");
fallback("2mq", "II Meqabyan", "all known English translations of Meqabyan are modern (2010s+) and under copyright; no pre-1929 English translation exists");
fallback("3mq", "III Meqabyan", "all known English translations of Meqabyan are modern (2010s+) and under copyright; no pre-1929 English translation exists");
fallback("3en", "III Enoch", "Odeberg's 1928 translation is public domain, but no clean machine-readable text exists — only page-scan OCR with the critical apparatus interleaved mid-verse; baking that in would corrupt the text");

// ── registry conformance check ───────────────────────────────────────
const EXPECT = {
  esg: 16, jub: 50, "1mq": 36, "2mq": 21, "3mq": 10, "4ezr": 16,
  "3co": 1, lao: 1, ps2: 4, "2ba": 87, epb: 1, "1cl": 65, "2cl": 20,
  "2en": 68, "3en": 48, "jas-pat": 12, "od-sol": 42, "ap-mos": 43,
};
const report = [];
for (const [book, want] of Object.entries(EXPECT)) {
  const got = countChapters(book);
  const note = missing.includes(book)
    ? `placeholder (registry keeps the book's real ${want}-chapter shape)`
    : got === want ? "OK" : `MISMATCH (registry says ${want})`;
  report.push(`${book}: ${got}/${want} ${note}`);
  if (!missing.includes(book) && got !== want)
    throw new Error(`${book}: built ${got} chapters but registry expects ${want}`);
}
log("chapter counts:\n  " + report.join("\n  "));

const bundle = {
  translation: "beyond",
  version: "1.0.0",
  license: "Public Domain compilation (Charles 1913, Lightfoot, Harris, KJV 1611) — see meta.sources",
  meta: { sources, missing },
  chapters,
};
writeFileSync(OUT, JSON.stringify(bundle));
const kb = Math.round(JSON.stringify(bundle).length / 1024);
log(`wrote ${OUT} (${kb} KB, ${Object.keys(chapters).length} chapters, ${missing.length} books missing: ${missing.join(", ") || "none"})`);
