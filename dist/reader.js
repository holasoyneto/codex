// GENERATED from reader.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
// CODEX — reader.jsx · v10 THE READER, rebuilt from zero. v11.3 THE SOUL:
// AI chapter titles return, in-reader overlays (gnosis ⟁ / talmud ת /
// commentary §), the golden Name, and secondary (pinned) readers.
//
// The reader is no longer a tangle inside app.jsx — it is a PLUGIN
// (sys-reader), the MAIN plugin: first chip on the dock, body of the desk's
// reader window, center column on mobile, and a floating MONAD window
// anywhere else. One component, every surface.
//
// Law 5 (the interface dies; the code lives forever): this file is a thin
// projection over the immortal engines —
//   window.BIBLE         loadMulti / annotateRedLetter (truth-based red letters)
//   window.CODEX_DATA    books (full 143-book shelf incl. apocrypha), translations
//   window.CODEX_PANELS  the chapter-companion pipeline (titles · glosses)
//   window.CODEX_DIVINE  the divine-name engine (defined here, pure data)
//   window.codexJumpToRef / codexSelectVerse / codexOpenVerseMenu (app services)
//
// What it fixes:
//   · RED LETTERS — painted ONLY from data/red-letter.json, which is now
//     generated from the WEB's <wj> markup (a real red-letter edition).
//     No heuristics; narrative verses can never paint red again.
//   · UNREADABLE TEXTS — the source-resolution workflow: when the current
//     translation doesn't carry the requested book (apocrypha, Greek
//     additions, pseudepigrapha…), the reader walks the translation
//     registry for one whose canon DOES, loads from it, and says so in a
//     visible "SERVED FROM" chip. Nothing silently 404s.
//
// Interop contracts kept so every existing instrument still works:
//   rows carry .cx-verse-row + data-vn  → J/K nav, Enter→verse menu,
//   jump-flash, the wm dock's CODEX_NOW readout, smoke contracts.

/* eslint-disable no-undef */

// ── Source resolution — the "open anything" workflow ────────────────────
// Returns an ordered list of translation ids likely to carry `book`,
// current primary first. DC books prefer translations whose declared
// canons include the book's canon; OT/NT books prefer protestant/ot/nt.
function readerSourceChain(book, primary) {
  const all = window.CODEX_DATA && window.CODEX_DATA.translations || [];
  const canonsOf = (t) => new Set(t.canons && t.canons.length ? t.canons : ["protestant"]);
  const covers = (t) => {
    const c = canonsOf(t);
    if (!book) return c.has("protestant");
    if (book.testament === "OT") return c.has("protestant") || c.has("ot");
    if (book.testament === "NT") return c.has("protestant") || c.has("nt");
    return c.has(book.canon); // DC — needs an explicit canon match
  };
  const chain = [];
  const cur = all.find((t) => t.id === primary);
  if (cur && covers(cur)) chain.push(primary);
  for (const t of all) {
    if (t.id === primary) continue;
    if (covers(t)) chain.push(t.id);
  }
  // Last resort: current primary anyway (its network chain may surprise us).
  if (!chain.length) chain.push(primary);
  return chain;
}

// Per-book resolved source, remembered for the session so chapter flips
// inside 1 Enoch don't re-walk the registry every time.
const _readerSourceMemo = {};

async function readerLoad(bookId, chapter, primary) {
  const B = window.BIBLE;
  const books = window.CODEX_DATA && window.CODEX_DATA.books || [];
  const book = books.find((b) => b.id === bookId);
  const chain = _readerSourceMemo[bookId] ?
  [_readerSourceMemo[bookId], ...readerSourceChain(book, primary).filter((t) => t !== _readerSourceMemo[bookId])] :
  readerSourceChain(book, primary);
  let lastErr = null;
  for (const tr of chain) {
    try {
      const verses = await B.loadMulti(bookId, chapter, [tr]);
      if (verses && verses.length) {
        _readerSourceMemo[bookId] = tr;
        return { verses, translation: tr, fallback: tr !== primary };
      }
    } catch (e) {lastErr = e;}
  }
  throw lastErr || new Error(`No source carries ${bookId} ${chapter}`);
}

// Highlight palette — mirrors app.jsx HIGHLIGHT_COLORS swatches without
// importing across the IIFE boundary (colors are data, not logic).
const READER_HL = {
  amber: "#ffd479", rose: "#ff8291", mint: "#5bd0b0",
  violet: "#b88cff", cyan: "#7ee0ff", gold: "#ffd479"
};

function readerHighlights() {
  try {return JSON.parse(localStorage.getItem("codex.highlights.v1") || "{}");}
  catch {return {};}
}

const READER_FONTS = [16, 19, 22, 26, 30];

// ── Tweaks IO — the same codex.tweaks.v1 store + 'tweakchange' event the
// Settings panel uses (cross-IIFE law: storage + window events only).
// New keys owned by the reader (the settings remake agent surfaces them):
//   overlayGnosis · overlayTalmud · overlayCommentary   (bool, default false)
//   divineGold    (bool, default true)  — the Name in covenant gold
//   divineHebrew  (bool, default false) — Tetragrammaton renders as יהוה
const CXR_TWEAKS_KEY = "codex.tweaks.v1";
function cxrTweaks() {
  try {return JSON.parse(localStorage.getItem(CXR_TWEAKS_KEY) || "{}") || {};}
  catch {return {};}
}
function cxrSetTweak(key, val) {
  try {
    const raw = cxrTweaks();
    raw[key] = val;
    localStorage.setItem(CXR_TWEAKS_KEY, JSON.stringify(raw));
  } catch {}
  try {window.dispatchEvent(new CustomEvent("tweakchange", { detail: { [key]: val } }));} catch {}
}

// ═════════════════════════════════════════════════════════════════════════
// THE GOLDEN NAME — divine-name engine. Pure data in, segments out; no DOM
// (law 5). Conservative by design: only forms that are *names of God* in
// the registry's translation conventions ever match. "gods", "godly",
// lowercase "lord of the manor" can never gild.
//
//   kind "tetra" — stands for the Tetragrammaton in this translation's
//                  convention (LORD/GOD small-caps, Jehovah, l'Éternel,
//                  SEÑOR, HERR, SENHOR, יהוה…). May render as יהוה when
//                  the user opts into divineHebrew.
//   kind "name"  — God/Elohim/Theos/Dios/Dieu… — gold, never substituted
//                  (these are NOT the Tetragrammaton).
// ═════════════════════════════════════════════════════════════════════════
const CXR_DIVINE_RULES = [
// English — the small-caps print convention survives APIs as ALL-CAPS.
{ kind: "tetra", re: /\b(?:LORD|GOD|JEHOVAH)(?:['’]S)?\b/g },
{ kind: "tetra", re: /\b(?:Jehovah|Yahweh|YHWH)(?:['’]s)?\b/g },
// English "God" — Elohim/Theos. Case-sensitive + \b: never "gods"/"godly".
{ kind: "name", re: /\bGod(?:['’]s)?\b/g },
// Hebrew — the Tetragrammaton itself (with or without niqqud/cantillation),
// then Elohim / Adonai (pointed + consonantal).
{ kind: "tetra", re: /יְ?הֹ?וָ?ה|יהוה/g },
{ kind: "name", re: /אֱלֹהִים|אלהים|אֲדֹנָי|אדני/g },
// Greek (LXX/NT) — Theos forms only. Κύριος is left alone: in the NT it
// routinely names Jesus / a human master — gilding it would overclaim.
{ kind: "name", re: /(?<!\p{L})(?:Θεός|Θεὸς|Θεοῦ|Θεῷ|Θεόν|ΘΕΟΣ|θεός|θεὸς|θεοῦ|θεῷ|θεόν)(?!\p{L})/gu },
// Spanish — Reina-Valera prints Jehová for YHWH; all-caps SEÑOR likewise.
{ kind: "tetra", re: /(?<!\p{L})(?:SEÑOR|Jehová|Jehova)(?!\p{L})/gu },
{ kind: "name", re: /\bDios\b/g },
// French — Segond's l'Éternel IS the Tetragrammaton.
{ kind: "tetra", re: /(?<!\p{L})(?:ÉTERNEL|Éternel)(?!\p{L})/gu },
{ kind: "name", re: /\bDieu\b/g },
// German — Luther/Elberfelder all-caps HERR = YHWH. Mixed-case "Herr" is
// left alone (can be a human lord). Gott is the Name.
{ kind: "tetra", re: /\bHERRN?\b/g },
{ kind: "name", re: /\bGott(?:es)?\b/g },
// Portuguese — Almeida all-caps SENHOR = YHWH.
{ kind: "tetra", re: /\bSENHOR\b/g },
{ kind: "name", re: /\bDeus\b/g },
// Latin — the Vulgate never distinguishes YHWH: gold only, no swap.
{ kind: "name", re: /\bD(?:ominus|omini|omino|ominum|omine|eus|ei|eo|eum)\b/g },
// Hindi — यहोवा is the BSI rendering of YHWH; परमेश्वर is the Name.
{ kind: "tetra", re: /यहोवा/g },
{ kind: "name", re: /परमेश्‍?वर/g }];


// segment(text) → [{ t, kind: null|"tetra"|"name" }]. NFC-normalised so
// composed/decomposed accents (Greek, Hebrew niqqud) match identically.
function cxrDivineSegment(text) {
  if (!text) return [{ t: text || "", kind: null }];
  const s = text.normalize ? text.normalize("NFC") : text;
  const hits = [];
  for (const rule of CXR_DIVINE_RULES) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(s)) !== null) {
      if (m[0]) hits.push({ start: m.index, end: m.index + m[0].length, kind: rule.kind });
      if (rule.re.lastIndex === m.index) rule.re.lastIndex++;
    }
  }
  if (!hits.length) return [{ t: s, kind: null }];
  // Resolve overlaps: earliest first; on tie, longest; tetra beats name.
  hits.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start) || (a.kind === "tetra" ? -1 : 1));
  const picked = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.start < cursor) continue;
    picked.push(h);
    cursor = h.end;
  }
  const out = [];
  let i = 0;
  for (const h of picked) {
    if (h.start > i) out.push({ t: s.slice(i, h.start), kind: null });
    out.push({ t: s.slice(h.start, h.end), kind: h.kind });
    i = h.end;
  }
  if (i < s.length) out.push({ t: s.slice(i), kind: null });
  return out;
}

// The immortal engine handle — callable without any DOM.
window.CODEX_DIVINE = { segment: cxrDivineSegment, rules: CXR_DIVINE_RULES };

// Scripture text with the golden Name. gold = {on, hebrew}.
function CxrText({ text, gold }) {
  if (!gold || !gold.on && !gold.hebrew || !text) {
    return /*#__PURE__*/React.createElement("span", { className: "cxr-text" }, text);
  }
  const segs = cxrDivineSegment(text);
  if (segs.length === 1 && !segs[0].kind) return /*#__PURE__*/React.createElement("span", { className: "cxr-text" }, segs[0].t);
  return (/*#__PURE__*/
    React.createElement("span", { className: "cxr-text" },
    segs.map((s, i) => {
      if (!s.kind) return /*#__PURE__*/React.createElement(React.Fragment, { key: i }, s.t);
      if (s.kind === "tetra" && gold.hebrew) {
        return (/*#__PURE__*/
          React.createElement("span", { key: i, className: "cxr-name cxr-name-yhwh", dir: "rtl", lang: "he",
            title: `יהוה — the Name · rendered for “${s.t}”` }, "\u05D9\u05D4\u05D5\u05D4"));

      }
      return /*#__PURE__*/React.createElement("span", { key: i, className: "cxr-name", title: "The Name" }, s.t);
    })
    ));

}

// ── Overlay glosses — gnosis ⟁ / talmud ת / commentary § ────────────────
// Entries from panelData rarely carry verse anchors explicitly, but their
// prose often does ("v. 14 —", "(v. 9)", "1:11"). Conservative extraction:
// a verse hint must exist within the chapter's verse range; "ch:v" form
// must name THIS chapter. Anything unanchored becomes a chapter-level
// margin presence under the title.
function cxrGlossAnchor(entry, chapter, maxVerse) {
  const hay = [entry.ref, entry.heading, entry.title, entry.body].
  filter(Boolean).join(" · ");
  let m = hay.match(/\bvv?\.?\s*(\d{1,3})\b/i); // v. 14 / vv. 12–13
  if (m) {const n = +m[1];if (n >= 1 && n <= maxVerse) return n;}
  m = hay.match(/\b(\d{1,3}):(\d{1,3})\b/); // 1:11
  if (m && +m[1] === +chapter) {const n = +m[2];if (n >= 1 && n <= maxVerse) return n;}
  return null;
}

const CXR_OVERLAYS = [
{ k: "gnosis", glyph: "⟁", label: "GNOSIS", tweak: "overlayGnosis",
  hint: "Gnosis overlay — esoteric readings whisper beside the verses they touch" },
{ k: "talmud", glyph: "ת", label: "TALMUD", tweak: "overlayTalmud",
  hint: "Talmud overlay — rabbinic parallels beside the text" },
{ k: "comm", glyph: "§", label: "COMMENTARY", tweak: "overlayCommentary",
  hint: "Commentary overlay — patristic to modern voices beside the text" }];


// One whisper. Collapsed: glyph + a single dimmed line. Tap: unfolds the
// full text in place. Scripture stays serene — this never shouts.
function CxrGloss({ g, open, onToggle }) {
  const e = g.e;
  const glyph = g.ov === "gnosis" ? e.sigil || "⟁" : g.ov === "talmud" ? "ת" : "§";
  const head = e.title || e.heading || e.author || e.ref || "…";
  const meta = g.ov === "talmud" ? e.ref || "" : g.ov === "comm" ? e.from || "" : "";
  return (/*#__PURE__*/
    React.createElement("div", {
      className: `cxr-gloss is-${g.ov} ${open ? "is-open" : ""}`,
      role: "button", tabIndex: 0,
      "aria-expanded": open,
      title: open ? "Fold" : "Unfold",
      onClick: (ev) => {ev.stopPropagation();onToggle();},
      onKeyDown: (ev) => {if (ev.key === "Enter" || ev.key === " ") {ev.preventDefault();ev.stopPropagation();onToggle();}} }, /*#__PURE__*/

    React.createElement("div", { className: "cxr-gloss-h" }, /*#__PURE__*/
    React.createElement("i", { "aria-hidden": true }, glyph), /*#__PURE__*/
    React.createElement("b", null, head),
    meta ? /*#__PURE__*/React.createElement("em", null, meta) : null
    ),
    open ? /*#__PURE__*/
    React.createElement("div", { className: "cxr-gloss-body" },
    e.body || "",
    e.tag ? /*#__PURE__*/React.createElement("span", { className: "cxr-gloss-tag" }, e.tag) : null
    ) :
    null
    ));

}

// ── Self-injected CSS (idempotent <style id>) ───────────────────────────
const CXR_SOUL_CSS = `
/* ── chapter title — the AI page title returns (serif, serene) ── */
.cxr-title { padding: 26px 12px 14px; text-align: center; }
.cxr-title-main {
  margin: 0; font-weight: 500; font-size: 1.35em; line-height: 1.25;
  font-family: "Cormorant Garamond", Georgia, "Times New Roman", serif;
  letter-spacing: 0.02em; color: var(--cx-fg, inherit);
}
.cxr-title-sub {
  margin: 6px 0 0; min-height: 1.2em; font-size: 0.62em;
  letter-spacing: 0.16em; text-transform: uppercase; opacity: 0.5;
}
.cxr-title.is-arrived .cxr-title-main { animation: cxr-title-in 1.4s ease-out both; }
@keyframes cxr-title-in {
  0%   { opacity: 0; filter: brightness(1.8) blur(1px); letter-spacing: 0.07em; }
  60%  { opacity: 1; filter: brightness(1.25) blur(0); }
  100% { opacity: 1; filter: none; letter-spacing: 0.02em; }
}
@media (prefers-reduced-motion: reduce) {
  .cxr-title.is-arrived .cxr-title-main { animation: cxr-title-fade .5s ease both; }
}
@keyframes cxr-title-fade { from { opacity: 0; } to { opacity: 1; } }

/* ── the golden Name — covenant gold, barely-there glow ── */
.cxr-name {
  color: #ffd479;
  text-shadow: 0 0 12px rgba(255, 212, 121, 0.28);
}
.cx-app.is-light .cxr-name {
  color: #8a6116;
  text-shadow: 0 0 8px rgba(212, 168, 95, 0.30);
}
.cxr-name-yhwh {
  font-family: "SBL Hebrew", "Ezra SIL", "Times New Roman", serif;
  unicode-bidi: isolate; font-style: normal; padding: 0 0.06em;
}
.cxr-v.is-red .cxr-name { text-shadow: 0 0 10px rgba(255, 212, 121, 0.35); }

/* ── overlay chips in the bar ── */
.cxr-ovs { display: inline-flex; align-items: center; gap: 4px; }
.cxr-chip-ov { min-width: 26px; padding: 2px 7px; opacity: 0.55; }
.cxr-chip-ov.is-on { opacity: 1; }
.cxr-chip-ov.is-gnosis.is-on { color: #b88cff; border-color: #b88cff55; text-shadow: 0 0 8px #b88cff44; }
.cxr-chip-ov.is-talmud.is-on { color: #ffd479; border-color: #ffd47955; text-shadow: 0 0 8px #ffd47944; }
.cxr-chip-ov.is-comm.is-on   { color: #7ee0ff; border-color: #7ee0ff55; text-shadow: 0 0 8px #7ee0ff44; }

/* ── the glosses — whispers, never shouts ── */
.cxr-gloss {
  margin: 2px 6px 12px 44px; padding: 5px 10px 5px 12px;
  border-left: 2px solid; border-radius: 0 6px 6px 0;
  font-size: 0.76em; line-height: 1.5; opacity: 0.72; cursor: pointer;
  background: color-mix(in oklab, currentColor 3%, transparent);
  transition: opacity 0.25s ease;
}
.cxr-gloss:hover, .cxr-gloss:focus-visible { opacity: 1; outline: none; }
.cxr-gloss.is-open { opacity: 0.95; }
.cxr-gloss.is-gnosis { border-color: #b88cff; color: color-mix(in oklab, #b88cff 55%, var(--cx-fg, #ccc)); }
.cxr-gloss.is-talmud { border-color: #ffd479; color: color-mix(in oklab, #ffd479 55%, var(--cx-fg, #ccc)); }
.cxr-gloss.is-comm   { border-color: #7ee0ff; color: color-mix(in oklab, #7ee0ff 55%, var(--cx-fg, #ccc)); }
.cxr-gloss-h { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.cxr-gloss-h i { flex: none; font-style: normal; opacity: 0.9; }
.cxr-gloss-h b { font-weight: 500; font-family: Georgia, serif; letter-spacing: 0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cxr-gloss-h em { flex: none; margin-left: auto; font-style: normal; font-size: 0.85em;
  letter-spacing: 0.08em; opacity: 0.6; }
.cxr-gloss-body {
  margin-top: 6px; font-family: Georgia, serif; font-size: 1.04em;
  color: var(--cx-fg, inherit); opacity: 0.92; white-space: pre-line;
}
.cxr-gloss-tag { display: block; margin-top: 5px; font-family: ui-monospace, monospace;
  font-size: 0.82em; letter-spacing: 0.06em; opacity: 0.6; }
.cxr-glosses-ch { margin: 0 6px 6px; }
.cxr-glosses-ch .cxr-gloss { margin-left: 12px; }

/* ── tiny inline orb while a layer generates ── */
.cxr-orb {
  display: inline-block; width: 7px; height: 7px; border-radius: 50%;
  background: currentColor; opacity: 0.6; flex: none;
  animation: cxr-orb 1.4s ease-in-out infinite;
}
@keyframes cxr-orb { 0%, 100% { transform: scale(0.7); opacity: 0.35; } 50% { transform: scale(1); opacity: 0.8; } }
@media (prefers-reduced-motion: reduce) { .cxr-orb { animation: none; } }
.cxr-gloss-wait {
  display: flex; align-items: center; gap: 8px; margin: 0 6px 10px 44px;
  font-size: 0.72em; letter-spacing: 0.1em; opacity: 0.55;
}

/* ── ⧉ secondary-reader spawner (reader window header) ── */
.cxr-spawn { position: relative; display: inline-flex; }
.cxr-spawn-btn {
  background: none; border: 0; color: inherit; opacity: 0.55; cursor: pointer;
  font-size: 13px; padding: 2px 6px; line-height: 1;
}
.cxr-spawn-btn:hover { opacity: 1; }
.cxr-spawn-pop {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 60;
  min-width: 240px; padding: 6px;
  background: var(--cx-bg2, #10151c); border: 1px solid var(--cx-line, #2a3442);
  border-radius: 8px; box-shadow: 0 12px 32px rgba(0,0,0,0.45);
  display: flex; flex-direction: column; gap: 2px;
}
.cx-app.is-light .cxr-spawn-pop { background: #faf6ec; border-color: #d8cfba; }
.cxr-spawn-pop button {
  display: flex; flex-direction: column; align-items: flex-start; gap: 1px;
  background: none; border: 0; color: inherit; cursor: pointer;
  padding: 7px 9px; border-radius: 6px; text-align: left; font: inherit;
}
.cxr-spawn-pop button:hover { background: color-mix(in oklab, currentColor 8%, transparent); }
.cxr-spawn-pop button b { font-size: 11px; letter-spacing: 0.08em; }
.cxr-spawn-pop button span { font-size: 10px; opacity: 0.6; }
`;

function cxrInjectSoulCss() {
  try {
    if (typeof document === "undefined" || document.getElementById("cxr-soul-style")) return;
    const s = document.createElement("style");
    s.id = "cxr-soul-style";
    s.textContent = CXR_SOUL_CSS;
    document.head.appendChild(s);
  } catch {}
}
cxrInjectSoulCss();

// ── ⧉ spawn a second reader — used in the reader window header (app.jsx
// renders this through DeskWin headerExtra) and mirrored by the dock chip's
// context menu in wm.js. Cross-IIFE law: drives window.codexNewReader and
// window.codexDisplays only.
function CxrSpawn() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {if (ref.current && !ref.current.contains(e.target)) setOpen(false);};
    const onKey = (e) => {if (e.key === "Escape") setOpen(false);};
    const t = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    document.addEventListener("keydown", onKey);
    return () => {clearTimeout(t);document.removeEventListener("mousedown", onDown);document.removeEventListener("keydown", onKey);};
  }, [open]);
  return (/*#__PURE__*/
    React.createElement("span", { className: "cxr-spawn", ref: ref }, /*#__PURE__*/
    React.createElement("button", {
      className: "cxr-spawn-btn",
      onClick: () => setOpen((o) => !o),
      "aria-haspopup": "menu", "aria-expanded": open,
      "aria-label": "Open another reader",
      title: "\u29C9 open another reader" },
    "\u29C9"),
    open ? /*#__PURE__*/
    React.createElement("span", { className: "cxr-spawn-pop", role: "menu" }, /*#__PURE__*/
    React.createElement("button", { role: "menuitem", onClick: () => {setOpen(false);if (window.codexNewReader) window.codexNewReader();} }, /*#__PURE__*/
    React.createElement("b", null, "\u29C9 NEW READER WINDOW"), /*#__PURE__*/
    React.createElement("span", null, "pinned to its own cursor \u2014 study two places at once")
    ), /*#__PURE__*/
    React.createElement("button", { role: "menuitem", onClick: () => {
        setOpen(false);
        // ?surface=reader&ref=… — the satellite boots straight onto the
        // current page (reader.jsx handles the ref param at boot), then
        // follows the shared cursor like every display satellite.
        // Built here (not displays.js — read-only) to carry the ref.
        const n = window.CODEX_NOW;
        const ref = n && n.ref ? n.ref : n && n.book ? `${n.book} ${n.chapter}` : "";
        const url = window.location.pathname + "?surface=reader&follow=1" + (
        ref ? "&ref=" + encodeURIComponent(ref) : "");
        try {
          const w = Math.min(1280, window.screen && window.screen.availWidth || 1280);
          const h = Math.min(900, window.screen && window.screen.availHeight || 900);
          window.open(url, "codex-display-reader", "popup=yes,width=" + w + ",height=" + h);
        } catch (_) {if (window.codexDisplays) window.codexDisplays.open("reader");}
      } }, /*#__PURE__*/
    React.createElement("b", null, "\u29C9 READER IN A BROWSER TAB"), /*#__PURE__*/
    React.createElement("span", null, "second monitor satellite \u2014 follows the shared cursor")
    )
    ) :
    null
    ));

}

// ── THE READER ──────────────────────────────────────────────────────────
// Props: surface · independent (pinned cursor — does NOT follow codex:now)
//        · initialNow {bookId, book, chapter, verse} · onNowChange(now)
function CodexReaderX({ surface, independent, initialNow, onNowChange } = {}) {
  const data = window.CODEX_DATA || { books: [], translations: [] };
  // Position: follow the app's cursor (window.CODEX_NOW + codex:now bus) —
  // unless this reader is INDEPENDENT (a pinned secondary reader).
  const [now, setNow] = useState(() => {
    // A provided seed wins the first paint: pinned readers (independent)
    // keep it forever; MONAD windows (ctx) start there then follow the bus.
    if (initialNow && initialNow.bookId) {
      const b = data.books.find((x) => x.id === initialNow.bookId);
      return { bookId: initialNow.bookId, book: b && b.name || initialNow.book || initialNow.bookId, chapter: initialNow.chapter || 1, verse: initialNow.verse || 1 };
    }
    const n = window.CODEX_NOW;
    if (n && n.bookId) return n;
    try {
      const loc = JSON.parse(localStorage.getItem("codex.passageLoc") || "null");
      if (loc && loc.bookId) {
        const b = data.books.find((x) => x.id === loc.bookId);
        return { bookId: loc.bookId, book: b ? b.name : loc.bookId, chapter: loc.chapter || 1, verse: loc.verse || 1 };
      }
    } catch {}
    return { bookId: "jhn", book: "John", chapter: 1, verse: 1 };
  });
  const [primary, setPrimary] = useState(() =>
  cxrTweaks().primaryTranslation ||
  window.CODEX_DATA && window.CODEX_DATA.tweaks && window.CODEX_DATA.tweaks.primaryTranslation ||
  "web");
  const [state, setState] = useState({ verses: null, translation: primary, fallback: false, loading: true, err: null });
  const [redOn, setRedOn] = useState(() => {
    const t = window.CODEX_DATA && window.CODEX_DATA.tweaks;
    return t ? t.redLetter !== false : true;
  });
  const [fs, setFs] = useState(() =>
  window.CODEX_DATA && window.CODEX_DATA.tweaks && window.CODEX_DATA.tweaks.fontScale || 19);
  const [marks, setMarks] = useState(readerHighlights);
  const scrollRef = useRef(null);
  const loadSeq = useRef(0);

  // ── v11.3 SOUL state: overlays, the golden Name, panel companion. ─────
  const [ov, setOv] = useState(() => {
    const tw = cxrTweaks();
    return { gnosis: !!tw.overlayGnosis, talmud: !!tw.overlayTalmud, comm: !!tw.overlayCommentary };
  });
  const [gold, setGold] = useState(() => {
    const tw = cxrTweaks();
    return { on: tw.divineGold !== false, hebrew: !!tw.divineHebrew };
  });
  // { data, late (arrived after the text — shimmer), loading }
  const [panelS, setPanelS] = useState({ data: null, late: false, loading: false });
  const [openGloss, setOpenGloss] = useState({});
  const wantOv = ov.gnosis || ov.talmud || ov.comm;

  // Settings panel (or any agent) flips the same tweak keys → stay in sync.
  useEffect(() => {
    const onTweak = (e) => {
      const d = e && e.detail || {};
      if ("overlayGnosis" in d || "overlayTalmud" in d || "overlayCommentary" in d) {
        const tw = cxrTweaks();
        setOv({ gnosis: !!tw.overlayGnosis, talmud: !!tw.overlayTalmud, comm: !!tw.overlayCommentary });
      }
      if ("divineGold" in d || "divineHebrew" in d) {
        const tw = cxrTweaks();
        setGold({ on: tw.divineGold !== false, hebrew: !!tw.divineHebrew });
      }
    };
    window.addEventListener("tweakchange", onTweak);
    return () => window.removeEventListener("tweakchange", onTweak);
  }, []);

  const toggleOv = (k) => {
    const def = CXR_OVERLAYS.find((o) => o.k === k);
    const next = !ov[k];
    setOv((o) => ({ ...o, [k]: next }));
    if (def) cxrSetTweak(def.tweak, next);
    if (next) {
      try {
        window.dispatchEvent(new CustomEvent("codex:depth-action", {
          detail: { type: `${k}-read`, ref: `${now.bookId}.${now.chapter}.${now.verse || 1}`, weight: 2 }
        }));
      } catch {}
    }
  };

  // Bus: the app cursor moves → the reader follows (main reader only).
  // Primary changes ride the codex:primary event for every reader.
  useEffect(() => {
    const onNow = (e) => {const n = e.detail || window.CODEX_NOW;if (n && n.bookId) setNow(n);};
    const onPrimary = (e) => {const id = e.detail && e.detail.id;if (id) setPrimary(id);};
    const onMarks = () => setMarks(readerHighlights());
    if (!independent) window.addEventListener("codex:now", onNow);
    window.addEventListener("codex:primary", onPrimary);
    window.addEventListener("codex:marks-changed", onMarks);
    window.addEventListener("storage", onMarks);
    return () => {
      if (!independent) window.removeEventListener("codex:now", onNow);
      window.removeEventListener("codex:primary", onPrimary);
      window.removeEventListener("codex:marks-changed", onMarks);
      window.removeEventListener("storage", onMarks);
    };
  }, [independent]);

  // Independent readers report their pinned cursor up (window title, persistence).
  useEffect(() => {
    if (independent && typeof onNowChange === "function") {
      try {onNowChange(now);} catch {}
    }
    // eslint-disable-next-line
  }, [independent, now.bookId, now.chapter, now.verse]);

  // Load the chapter whenever position/translation changes.
  useEffect(() => {
    let dead = false;
    const seq = ++loadSeq.current;
    setState((s) => ({ ...s, loading: true, err: null }));
    readerLoad(now.bookId, now.chapter, primary).
    then((r) => {
      if (dead || seq !== loadSeq.current) return;
      setState({ verses: r.verses, translation: r.translation, fallback: r.fallback, loading: false, err: null });
    }).
    catch((e) => {
      if (dead || seq !== loadSeq.current) return;
      setState({ verses: null, translation: primary, fallback: false, loading: false, err: String(e.message || e) });
    });
    return () => {dead = true;};
  }, [now.bookId, now.chapter, primary]);

  const book = data.books.find((b) => b.id === now.bookId);
  const bookName = book && book.name || now.book || now.bookId;
  const chapters = book && book.chapters || 1;

  // ── Panel companion: AI title + overlay glosses. Seeds and the
  // localStorage cache render instantly; otherwise we listen on the
  // CODEX_PANELS bus (the app pipeline generates for the main cursor) and —
  // when an overlay is ENGAGED for an un-companioned chapter (secondary
  // readers, cold caches) — trigger the existing pipeline ourselves.
  useEffect(() => {
    let dead = false;
    const P = window.CODEX_PANELS;
    const seed = window.CODEX_DATA && window.CODEX_DATA.seedPanels ?
    window.CODEX_DATA.seedPanels[`${now.bookId}.${now.chapter}`] : null;
    const cached = seed || (P && P.getCached ? P.getCached(now.bookId, now.chapter) : null);
    setPanelS({ data: cached || null, late: false, loading: false });
    setOpenGloss({});
    let unsub = null;
    if (P && P.subscribe) {
      unsub = P.subscribe((ev) => {
        if (dead || !ev || ev.bookId !== now.bookId || +ev.chapter !== +now.chapter) return;
        if (ev.type === "start") setPanelS((s) => ({ ...s, loading: true }));else
        if (ev.type === "done") setPanelS({ data: ev.data, late: true, loading: false });else
        if (ev.type === "error") setPanelS((s) => ({ ...s, loading: false }));
      });
    }
    if (!cached && wantOv && P && P.load) {
      const tw = cxrTweaks();
      setPanelS((s) => ({ ...s, loading: true }));
      P.load(now.bookId, now.chapter, bookName, { provider: tw.provider, model: tw.model }).
      then((d) => {if (!dead) setPanelS({ data: d, late: true, loading: false });}).
      catch(() => {if (!dead) setPanelS((s) => ({ ...s, loading: false }));});
    }
    return () => {dead = true;if (unsub) unsub();};
    // eslint-disable-next-line
  }, [now.bookId, now.chapter, wantOv]);

  // ── SCROLL-TO-TOP ON PAGE TURN (all form factors) — the human eye goes
  // to the first verse when the chapter changes; the machine must follow.
  // Two stages: an instant reset the moment the location flips (so the old
  // position never flashes under the loading placeholder), then a settle
  // to 0 once the new verses have mounted (smooth if the panel was already
  // mounted and tall; reduced-motion gets the instant jump).
  const locKey = `${now.bookId}:${now.chapter}`;
  const prevLocRef = useRef(locKey);
  const needTopRef = useRef(false);
  useEffect(() => {
    if (prevLocRef.current === locKey) return;
    prevLocRef.current = locKey;
    needTopRef.current = true;
    const el = scrollRef.current;
    if (el) el.scrollTop = 0; // no flash of the old position
  }, [locKey]);
  useEffect(() => {
    if (!needTopRef.current || state.loading) return;
    needTopRef.current = false;
    const el = scrollRef.current;
    if (!el || el.scrollTop === 0) return;
    let reduced = false;
    try {reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;} catch {}
    try {el.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });}
    catch {el.scrollTop = 0;}
  }, [state.loading, state.verses]);

  // ── Touch: horizontal swipe on the scripture = chapter turn (the reader
  // keeps this gesture on every surface; vertical scroll always wins). ──
  const swipeNav = useRef({ prev: () => {}, next: () => {} });
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let x0 = 0,y0 = 0,t0 = 0,live = false;
    const start = (e) => {
      const t = e.touches && e.touches[0];
      if (!t || e.touches && e.touches.length > 1) {live = false;return;}
      live = true;x0 = t.clientX;y0 = t.clientY;t0 = Date.now();
    };
    const end = (e) => {
      if (!live) return;
      live = false;
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - x0,dy = t.clientY - y0,dt = Date.now() - t0;
      if (dt > 600) return;
      if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
      if (dx < 0) swipeNav.current.next();else swipeNav.current.prev();
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchend", end, { passive: true });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchend", end);
    };
  }, []);

  const go = (bookId, ch, v) => {
    const b = data.books.find((x) => x.id === bookId);
    if (independent) {
      setNow({ bookId, book: b && b.name || bookId, chapter: ch, verse: v || 1 });
      return;
    }
    if (window.codexGoto) window.codexGoto(bookId, ch, v || 1);else
    if (window.codexJumpToRef) window.codexJumpToRef(`${b && b.name || bookId} ${ch}${v ? ":" + v : ""}`);else
    setNow({ bookId, book: b && b.name || bookId, chapter: ch, verse: v || 1 });
  };
  const prev = () => {
    if (now.chapter > 1) return go(now.bookId, now.chapter - 1);
    const i = data.books.findIndex((b) => b.id === now.bookId);
    if (i > 0) go(data.books[i - 1].id, data.books[i - 1].chapters);
  };
  const next = () => {
    if (now.chapter < chapters) return go(now.bookId, now.chapter + 1);
    const i = data.books.findIndex((b) => b.id === now.bookId);
    if (i >= 0 && i < data.books.length - 1) go(data.books[i + 1].id, 1);
  };
  // feed the touch-swipe effect (stable ref, fresh closures)
  swipeNav.current = { prev, next };

  const selectVerse = (n) => {
    if (independent) {setNow((cur) => ({ ...cur, verse: n }));return;}
    if (window.codexSelectVerse) window.codexSelectVerse(n);else
    go(now.bookId, now.chapter, n);
  };
  const openMenu = (n, el) => {
    selectVerse(n);
    if (!window.codexOpenVerseMenu || !el) return;
    const rect = el.getBoundingClientRect();
    if (independent) {
      // pinned readers carry their own location into the menu
      const v = (state.verses || []).find((x) => x.n === n);
      if (v) window.codexOpenVerseMenu(n, rect, { bookId: now.bookId, book: bookName, chapter: now.chapter, v });
      return;
    }
    window.codexOpenVerseMenu(n, rect);
  };
  // Double-tap (or double-click) a verse opens its menu without breaking
  // single-tap select — the first tap selects, a quick second tap opens.
  const lastTapRef = useRef({ n: 0, t: 0 });
  const tapVerse = (n, el) => {
    const tNow = Date.now();
    const last = lastTapRef.current;
    if (last.n === n && tNow - last.t < 350) {
      lastTapRef.current = { n: 0, t: 0 };
      openMenu(n, el);
      return;
    }
    lastTapRef.current = { n, t: tNow };
    selectVerse(n);
  };

  const cycleFont = () => {
    const i = READER_FONTS.indexOf(fs);
    const v = READER_FONTS[(i + 1) % READER_FONTS.length] || 19;
    setFs(v);
    try {if (window.CODEX_DATA && window.CODEX_DATA.tweaks) window.CODEX_DATA.tweaks.fontScale = v;} catch {}
  };
  const toggleRed = () => setRedOn((v) => !v);

  const tr = state.translation;
  const trMeta = (data.translations || []).find((t) => t.id === tr);
  const verses = state.verses || [];

  // ── Distribute engaged-overlay glosses: verse-anchored where the data
  // names a verse, chapter-level margin presence otherwise. ──
  const glossMap = useMemo(() => {
    const map = { ch: [] };
    const p = panelS.data;
    if (!p || !wantOv) return map;
    const maxV = verses.length ? verses[verses.length - 1].n : 999;
    const add = (list, ovKey) => {
      (list || []).forEach((e, i) => {
        if (!e || !e.body && !e.heading && !e.title) return;
        const g = { ov: ovKey, e, key: `${ovKey}.${i}` };
        const n = cxrGlossAnchor(e, now.chapter, maxV);
        if (n) {(map[n] = map[n] || []).push(g);} else {map.ch.push(g);}
      });
    };
    if (ov.gnosis) add(p.gnosis, "gnosis");
    if (ov.talmud) add(p.talmud, "talmud");
    if (ov.comm) add(p.commentary, "comm");
    return map;
  }, [panelS.data, ov.gnosis, ov.talmud, ov.comm, verses, now.chapter, wantOv]);

  const toggleGloss = (key) => setOpenGloss((o) => ({ ...o, [key]: !o[key] }));
  const renderGlosses = (list) => (list || []).map((g) => /*#__PURE__*/
  React.createElement(CxrGloss, { key: g.key, g: g, open: !!openGloss[g.key], onToggle: () => toggleGloss(g.key) })
  );

  const titleTxt = panelS.data && panelS.data.title || `${bookName} ${now.chapter}`;
  const subTxt = panelS.data && panelS.data.subtitle || "";

  return (/*#__PURE__*/
    React.createElement("div", { className: `cxr ${surface ? "is-" + surface : ""} ${independent ? "is-pinned" : ""}`, style: { "--cxr-fs": fs + "px" } }, /*#__PURE__*/

    React.createElement("header", { className: "cxr-bar" }, /*#__PURE__*/
    React.createElement("button", { className: "cxr-nav", onClick: prev, "aria-label": "Previous chapter", title: "Previous chapter (H)" }, "\u2039"), /*#__PURE__*/
    React.createElement("button", {
      className: "cxr-loc",
      onClick: independent ? undefined : () => {try {window.dispatchEvent(new CustomEvent("codex:open-library"));} catch {}if (window.codexDesk) window.codexDesk.open("library");},
      title: independent ? "Pinned reader — its own cursor · navigate with ‹ ›" : "Open the library" }, /*#__PURE__*/

    React.createElement("b", null, bookName), /*#__PURE__*/
    React.createElement("i", null, now.chapter, /*#__PURE__*/React.createElement("small", null, "/", chapters))
    ), /*#__PURE__*/
    React.createElement("button", { className: "cxr-nav", onClick: next, "aria-label": "Next chapter", title: "Next chapter (L)" }, "\u203A"), /*#__PURE__*/
    React.createElement("span", { className: "cxr-bar-gap" }), /*#__PURE__*/
    React.createElement("span", { className: "cxr-ovs", role: "group", "aria-label": "Reading overlays" },
    CXR_OVERLAYS.map((o) => /*#__PURE__*/
    React.createElement("button", {
      key: o.k,
      className: `cxr-chip cxr-chip-ov is-${o.k} ${ov[o.k] ? "is-on" : ""}`,
      "data-ov": o.k,
      onClick: () => toggleOv(o.k),
      "aria-pressed": ov[o.k],
      title: `${o.hint} — ${ov[o.k] ? "engaged · click to rest" : "click to engage"}` },
    o.glyph)
    ),
    wantOv && panelS.loading ? /*#__PURE__*/React.createElement("span", { className: "cxr-orb", title: "the layer is being drafted\u2026" }) : null
    ), /*#__PURE__*/
    React.createElement("button", {
      className: `cxr-chip cxr-chip-red ${redOn ? "is-on" : ""}`,
      onClick: toggleRed,
      "aria-pressed": redOn,
      title: redOn ? "Words of Jesus painted red (from the WEB red-letter markup) — click to mute" : "Red letters muted — click to paint the words of Jesus" }, /*#__PURE__*/
    React.createElement("i", { "aria-hidden": true }), /*#__PURE__*/React.createElement("span", null, window.t && window.t("reader.redletter") || "RED-LETTER")), /*#__PURE__*/
    React.createElement("button", { className: "cxr-chip", onClick: cycleFont, title: `Scripture size · ${fs}px` }, "Aa"), /*#__PURE__*/
    React.createElement("button", {
      className: "cxr-chip cxr-chip-tr",
      onClick: () => {try {if (window.codexOpenPanel) window.codexOpenPanel("trans");else window.dispatchEvent(new CustomEvent("codex:open-builtin-tab", { detail: { tabId: "trans" } }));} catch {}},
      title: trMeta ? `${trMeta.name} (${trMeta.year || ""}) — click for translations` : "Translations" },
    (tr || "").toUpperCase())
    ),


    state.fallback && !state.loading ? /*#__PURE__*/
    React.createElement("div", { className: "cxr-served", role: "note" }, "\u21C4 ",
    bookName, " is not in ", (primary || "").toUpperCase(), " \u2014 served from", " ", /*#__PURE__*/
    React.createElement("b", null, trMeta ? trMeta.name : tr.toUpperCase()), /*#__PURE__*/
    React.createElement("button", { className: "cxr-served-keep", onClick: () => {if (window.codexSetPrimary) window.codexSetPrimary(tr);},
      title: "Make this the primary translation" }, "KEEP")
    ) :
    null, /*#__PURE__*/


    React.createElement("div", { className: "cxr-scroll", ref: scrollRef },
    state.loading ? /*#__PURE__*/
    React.createElement("div", { className: "cxr-status" }, /*#__PURE__*/React.createElement("span", { className: "cxr-pulse", "aria-hidden": true }), "FETCHING ", bookName.toUpperCase(), " ", now.chapter, "\u2026") :
    state.err ? /*#__PURE__*/
    React.createElement("div", { className: "cxr-status is-err" }, /*#__PURE__*/
    React.createElement("b", null, "THE PAGE IS DARK"), /*#__PURE__*/
    React.createElement("code", null, state.err), /*#__PURE__*/
    React.createElement("button", { onClick: () => go(now.bookId, now.chapter) }, "\u21BB RETRY")
    ) : /*#__PURE__*/

    React.createElement("div", { className: "cxr-verses", style: { fontSize: "var(--cxr-fs)" } }, /*#__PURE__*/


    React.createElement("header", { className: `cxr-title ${panelS.late && panelS.data && panelS.data.title ? "is-arrived" : ""}` }, /*#__PURE__*/
    React.createElement("h1", { className: "cxr-title-main" }, titleTxt), /*#__PURE__*/
    React.createElement("p", { className: "cxr-title-sub" }, subTxt || " ")
    ),
    glossMap.ch.length ? /*#__PURE__*/
    React.createElement("div", { className: "cxr-glosses-ch" }, renderGlosses(glossMap.ch)) :
    null,
    wantOv && panelS.loading && !panelS.data ? /*#__PURE__*/
    React.createElement("div", { className: "cxr-gloss-wait" }, /*#__PURE__*/React.createElement("span", { className: "cxr-orb", "aria-hidden": true }), "THE LAYER IS BEING DRAFTED\u2026") :
    null,
    verses.map((v) => {
      const text = v[tr] || "";
      const isRed = redOn && (v._jesusVerse || v.red && v.red[tr]);
      const mk = marks[`${now.bookId}.${now.chapter}.${v.n}`];
      const isCur = v.n === (now.verse || 0);
      const glosses = glossMap[v.n];
      return (/*#__PURE__*/
        React.createElement(React.Fragment, { key: v.n }, /*#__PURE__*/
        React.createElement("div", {
          "data-vn": v.n,
          tabIndex: 0,
          className: `cx-verse-row cxr-v ${isCur ? "is-hl" : ""} ${isRed ? "is-red" : ""} ${mk ? "has-mark" : ""}`,
          style: mk ? { "--cxr-mark": READER_HL[mk.color] || READER_HL.amber } : undefined,
          onClick: (e) => tapVerse(v.n, e.currentTarget),
          onContextMenu: (e) => {e.preventDefault();openMenu(v.n, e.currentTarget);} }, /*#__PURE__*/

        React.createElement("button", {
          className: "cxr-vn",
          onClick: (e) => {e.stopPropagation();openMenu(v.n, e.currentTarget);},
          "aria-label": `Verse ${v.n} — open verse menu`,
          title: "Verse menu" },
        v.n), /*#__PURE__*/
        React.createElement(CxrText, { text: text, gold: gold })
        ),
        glosses ? renderGlosses(glosses) : null
        ));

    }),
    !verses.length ? /*#__PURE__*/
    React.createElement("div", { className: "cxr-status" }, "NO VERSES \u2014 this chapter came back empty from every source.") :
    null, /*#__PURE__*/
    React.createElement("footer", { className: "cxr-end", "aria-hidden": true }, "\u2726 ",
    bookName, " ", now.chapter, " \xB7 ", verses.length, " vv \xB7 ", (tr || "").toUpperCase(),
    trMeta && trMeta.license ? ` · ${trMeta.license}` : ""
    )
    )

    )
    ));

}

// ── ?surface=reader&ref=… — the browser-tab secondary reader ────────────
// displays.js (read-only law) boots ?surface=reader into a reader-only
// satellite; the reader itself honours the extra &ref= so '⧉ READER IN A
// BROWSER TAB' opens straight onto the page it was spawned from. One jump
// at boot; afterwards the satellite follows the shared display cursor.
(function readerBootRef() {
  if (typeof window === "undefined") return;
  let params;
  try {params = new URLSearchParams(window.location.search);} catch {return;}
  if (params.get("surface") !== "reader") return;
  const ref = params.get("ref");
  if (!ref) return;
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.__CODEX_READY__ === true && typeof window.codexJumpToRef === "function") {
      clearInterval(t);
      try {window.codexJumpToRef(ref);} catch {}
    } else if (tries > 120) {
      clearInterval(t);
    }
  }, 250);
})();

// ── Registration: the MAIN plugin ───────────────────────────────────────
(function registerReaderPlugin() {
  if (typeof window === "undefined") return;
  const reg = () => {
    if (!window.CODEX_PLUGINS_API) return false;
    return window.CODEX_PLUGINS_API.register({
      id: "sys-reader",
      name: "The Reader",
      version: "11.3.0",
      panels: [{
        id: "reader",
        label: "READER",
        glyph: "✦",
        // MONAD windows pass a live ctx — honoured as the seed; the window
        // still follows the shared cursor (pinned readers go through
        // window.codexNewReader → app.jsx DeskWin instead).
        render(ctx) {
          return React.createElement(CodexReaderX, { surface: "window", initialNow: ctx && ctx.bookId ? ctx : undefined });
        }
      }]
    });
  };
  if (!reg()) document.addEventListener("DOMContentLoaded", reg, { once: true });
})();

Object.assign(window, { CodexReaderX, CxrSpawn });
})();
