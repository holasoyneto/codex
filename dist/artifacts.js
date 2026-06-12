// GENERATED from artifacts.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
// CODEX — artifacts.jsx · THE ARTIFACTS ENGINE (window.CODEX_ARTIFACTS)
//
// One renderer for every AI surface (Oracle, OPS, future consoles). Model
// text goes in; REAL DOM comes out:
//
//   · markdown-ish rich text — headings, lists, quotes, tables, bold/italic/
//     code, [j]…[/j] red-letter, [d]…[/d] divine shimmer — parsed by hand
//     and built as React elements. Raw model HTML is NEVER injected: no
//     innerHTML, no script/style/iframe, no event attributes. The model can
//     only ever produce text nodes and the typed directives below. This is
//     the hard security line.
//   · every detected scripture reference becomes a live chip → codexGoto /
//     codexJumpToRef (the universal law: clicking a verse opens the reader
//     on that verse), with a lazy hover/focus preview of the verse text.
//   · fenced DIRECTIVE blocks the model can emit (grammar via directiveDoc(),
//     taught to the model in every system prompt that renders through here):
//       ```codex:buttons   [{label, action:{kind:"goto"|"panel"|"console"|"setting", …}}]
//       ```codex:chart     {type:"bar"|"line"|"radial", title?, data:[{label,value}]}
//       ```codex:flow      {nodes:[{id,label,ref?}], edges:[{from,to,label?}]}
//       ```codex:verse-grid ["John 1:1", …]
//     Charts/flows are hand-rolled SVG — zero deps, theme tokens only,
//     honest value labels (no decorative data). Buttons route through the
//     app's own public doors (codexJumpToRef, codexDeskPanels, codex:os-open,
//     the codex.tweaks.v1 settings store).
//   · the AI-BUSY bus — window.CODEX_AI_BUSY {begin(label)→id, end(id)} —
//     dispatching codex:ai-busy {active, labels} and rendering one small
//     pulsing orb fixed bottom-right above the dock while any call is live.
//
// All CSS is self-injected (idempotent <style id> pattern). Keyboard
// reachable (everything interactive is a real <button>), ≥4.5:1 contrast on
// theme tokens, reduced-motion safe.

const { useState, useEffect, useMemo, useRef } = React;

// ── Self-injected CSS ─────────────────────────────────────────────────────
function artEnsureCss() {
  if (typeof document === "undefined" || document.getElementById("cx-artifacts-css")) return;
  const el = document.createElement("style");
  el.id = "cx-artifacts-css";
  el.textContent = `
    .cx-art { font-size: inherit; line-height: 1.55; color: var(--cx-fg, #c9d4dc); overflow-wrap: break-word; }
    .cx-art p { margin: 0 0 8px; }
    .cx-art p:last-child { margin-bottom: 0; }
    .cx-art .cx-art-h { font-family: var(--cx-mono, ui-monospace, Menlo, monospace); letter-spacing: 0.08em;
      color: var(--cx-accent, #7ee0ff); margin: 10px 0 6px; font-weight: 600; }
    .cx-art .cx-art-h.is-1 { font-size: 1.15em; } .cx-art .cx-art-h.is-2 { font-size: 1.06em; }
    .cx-art .cx-art-h.is-3, .cx-art .cx-art-h.is-4 { font-size: 0.96em; opacity: 0.92; }
    .cx-art ul, .cx-art ol { margin: 0 0 8px; padding-left: 20px; }
    .cx-art li { margin: 2px 0; }
    .cx-art blockquote { margin: 6px 0 8px; padding: 4px 10px; border-left: 2px solid var(--cx-accent, #7ee0ff);
      opacity: 0.92; font-style: italic; }
    .cx-art hr { border: none; border-top: 1px solid var(--cx-line, rgba(126,224,255,0.18)); margin: 10px 0; }
    .cx-art code.cx-art-code-i { font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 0.88em;
      background: var(--cx-bg-2, rgba(126,224,255,0.08)); border: 1px solid var(--cx-line, rgba(126,224,255,0.16));
      border-radius: 3px; padding: 0 4px; }
    .cx-art pre.cx-art-code { font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 0.85em;
      background: var(--cx-bg-2, rgba(8,12,18,0.6)); border: 1px solid var(--cx-line, rgba(126,224,255,0.16));
      border-radius: 4px; padding: 8px 10px; overflow-x: auto; margin: 6px 0 8px; white-space: pre-wrap; }
    .cx-art .cx-red { color: var(--cx-red, #ff8291); }
    .cx-art .cx-divine { color: var(--cx-accent, #7ee0ff); text-shadow: 0 0 8px rgba(126,224,255,0.35); }
    /* table */
    .cx-art table.cx-art-table { border-collapse: collapse; margin: 6px 0 10px; width: 100%; font-size: 0.92em; }
    .cx-art table.cx-art-table th { font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 0.82em;
      letter-spacing: 0.08em; text-align: left; color: var(--cx-accent, #7ee0ff);
      border-bottom: 1px solid var(--cx-accent, #7ee0ff); padding: 4px 8px 4px 0; }
    .cx-art table.cx-art-table td { padding: 4px 8px 4px 0; border-bottom: 1px solid var(--cx-line, rgba(126,224,255,0.12)); vertical-align: top; }
    /* scripture ref chip */
    .cx-art-ref { display: inline; font: inherit; color: var(--cx-accent, #7ee0ff); background: none; border: none;
      border-bottom: 1px dotted var(--cx-accent, #7ee0ff); padding: 0; margin: 0; cursor: pointer; }
    .cx-art-ref:hover, .cx-art-ref:focus-visible { background: rgba(126,224,255,0.12); outline: none; }
    .cx-art-ref:focus-visible { box-shadow: 0 0 0 2px rgba(126,224,255,0.5); border-radius: 2px; }
    .cx-art-ref-pop { position: fixed; z-index: 100001; width: 280px; max-height: 150px; overflow: hidden;
      background: var(--cx-bg, #0a0f16); border: 1px solid var(--cx-accent, #7ee0ff); border-radius: 5px;
      padding: 8px 10px; box-shadow: 0 8px 28px rgba(0,0,0,0.55); display: block; }
    .cx-art-ref-pop-h { display: block; font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 9.5px;
      letter-spacing: 0.1em; color: var(--cx-accent, #7ee0ff); margin-bottom: 4px; }
    .cx-art-ref-pop-b { display: block; font-family: var(--cx-serif, Georgia, serif); font-size: 12.5px;
      line-height: 1.5; color: var(--cx-fg, #c9d4dc); }
    .cx-art-ref-pop-b sup { font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 8.5px;
      color: var(--cx-accent, #7ee0ff); margin-right: 3px; }
    /* directive: buttons */
    .cx-art-buttons { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
    .cx-art-btn { font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 10px; letter-spacing: 0.08em;
      color: var(--cx-accent, #7ee0ff); background: rgba(126,224,255,0.06); border: 1px solid var(--cx-accent, #7ee0ff);
      border-radius: 4px; padding: 5px 10px; cursor: pointer; }
    .cx-art-btn:hover, .cx-art-btn:focus-visible { background: rgba(126,224,255,0.18); outline: none; }
    .cx-art-btn:focus-visible { box-shadow: 0 0 0 2px rgba(126,224,255,0.5); }
    /* directive: charts + flow */
    .cx-art-chart, .cx-art-flow { margin: 8px 0 10px; border: 1px solid var(--cx-line, rgba(126,224,255,0.16));
      border-radius: 5px; padding: 8px; background: var(--cx-bg-2, rgba(8,12,18,0.4)); overflow-x: auto; }
    .cx-art-chart-title { font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 9.5px;
      letter-spacing: 0.12em; color: var(--cx-fg-dim, #8a98a8); margin: 0 0 6px; text-transform: uppercase; }
    .cx-art-chart svg, .cx-art-flow svg { display: block; max-width: 100%; height: auto; }
    .cx-art-chart text, .cx-art-flow text { font-family: var(--cx-mono, ui-monospace, Menlo, monospace); }
    /* directive: verse grid */
    .cx-art-vgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; margin: 8px 0 10px; }
    .cx-art-vcard { text-align: left; background: var(--cx-bg-2, rgba(8,12,18,0.45)); color: inherit;
      border: 1px solid var(--cx-line, rgba(126,224,255,0.18)); border-radius: 5px; padding: 8px 10px; cursor: pointer; }
    .cx-art-vcard:hover, .cx-art-vcard:focus-visible { border-color: var(--cx-accent, #7ee0ff); outline: none; }
    .cx-art-vcard:focus-visible { box-shadow: 0 0 0 2px rgba(126,224,255,0.5); }
    .cx-art-vcard-ref { display: block; font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 9px;
      letter-spacing: 0.12em; color: var(--cx-accent, #7ee0ff); margin-bottom: 4px; }
    .cx-art-vcard-txt { display: block; font-family: var(--cx-serif, Georgia, serif); font-size: 12.5px;
      line-height: 1.55; color: var(--cx-fg, #c9d4dc); }
    .cx-art-vcard-txt.is-dim { opacity: 0.6; font-style: italic; }
    /* unparsable directive — honest, never silent */
    .cx-art-broken { font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 9.5px;
      color: var(--cx-fg-dim, #8a98a8); border: 1px dashed var(--cx-line, rgba(126,224,255,0.25));
      border-radius: 4px; padding: 6px 8px; margin: 6px 0; }
    /* ── AI-busy orb ── */
    #cx-ai-orb { position: fixed; right: 18px; bottom: 78px; z-index: 100000;
      display: flex; align-items: center; flex-direction: row-reverse; gap: 8px; }
    #cx-ai-orb .cx-ai-orb-core { width: 14px; height: 14px; border-radius: 50%; flex: none;
      background: radial-gradient(circle, var(--cx-accent, #7ee0ff) 0%, rgba(126,224,255,0.4) 55%, transparent 78%);
      box-shadow: 0 0 14px 3px rgba(126,224,255,0.35);
      animation: cx-ai-orb-pulse 1.5s ease-in-out infinite; }
    #cx-ai-orb .cx-ai-orb-lbl { opacity: 0; pointer-events: none; transition: opacity 0.18s ease;
      font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 9.5px; letter-spacing: 0.12em;
      color: var(--cx-fg, #c9d4dc); background: var(--cx-bg, rgba(6,10,16,0.95));
      border: 1px solid var(--cx-line, rgba(126,224,255,0.3)); border-radius: 4px; padding: 3px 8px; white-space: nowrap; }
    #cx-ai-orb:hover .cx-ai-orb-lbl, #cx-ai-orb:focus .cx-ai-orb-lbl, #cx-ai-orb:focus-within .cx-ai-orb-lbl { opacity: 1; }
    @keyframes cx-ai-orb-pulse { 0%,100% { transform: scale(0.72); opacity: 0.55; } 50% { transform: scale(1.18); opacity: 1; } }
    @media (prefers-reduced-motion: reduce) {
      #cx-ai-orb .cx-ai-orb-core { animation: none; opacity: 0.95; }
    }
  `;
  document.head.appendChild(el);
}

// ── Scripture-reference detection ─────────────────────────────────────────
// Ported from the old oracle.jsx splitOnRefs: full book names from
// CODEX_DATA.books + a hand-curated abbreviation table, longest-first regex.
const ART_SHORT_BOOKS = {
  "Gn": "gen", "Gen": "gen", "Ge": "gen", "Ex": "exo", "Exo": "exo", "Lv": "lev", "Lev": "lev",
  "Nu": "num", "Num": "num", "Nm": "num", "Dt": "deu", "Deu": "deu", "Deut": "deu",
  "Jos": "jos", "Josh": "jos", "Jdg": "jdg", "Judg": "jdg", "Ru": "rut", "Ruth": "rut",
  "1Sa": "1sa", "1 Sam": "1sa", "1Sam": "1sa", "I Sam": "1sa", "I Samuel": "1sa",
  "2Sa": "2sa", "2 Sam": "2sa", "2Sam": "2sa", "II Sam": "2sa", "II Samuel": "2sa",
  "1Ki": "1ki", "1 Kings": "1ki", "1Kgs": "1ki", "I Kings": "1ki",
  "2Ki": "2ki", "2 Kings": "2ki", "2Kgs": "2ki", "II Kings": "2ki",
  "1Ch": "1ch", "1 Chr": "1ch", "1Chr": "1ch", "I Chronicles": "1ch",
  "2Ch": "2ch", "2 Chr": "2ch", "2Chr": "2ch", "II Chronicles": "2ch",
  "Ezr": "ezr", "Ezra": "ezr", "Neh": "neh", "Ne": "neh", "Est": "est", "Esth": "est",
  "Jb": "job", "Job": "job", "Ps": "psa", "Psa": "psa", "Pss": "psa", "Psalm": "psa", "Psalms": "psa",
  "Pr": "pro", "Prov": "pro", "Prv": "pro", "Ec": "ecc", "Eccl": "ecc", "Qoh": "ecc",
  "Sg": "sng", "Song": "sng", "SoS": "sng", "Cant": "sng", "Is": "isa", "Isa": "isa",
  "Jr": "jer", "Jer": "jer", "Lm": "lam", "Lam": "lam", "Ez": "ezk", "Ezek": "ezk",
  "Dn": "dan", "Dan": "dan", "Hos": "hos", "Ho": "hos", "Jl": "jol", "Joel": "jol",
  "Am": "amo", "Amos": "amo", "Ob": "oba", "Obad": "oba", "Jon": "jon", "Jonah": "jon",
  "Mi": "mic", "Mic": "mic", "Na": "nam", "Nah": "nam", "Nahum": "nam", "Hab": "hab",
  "Zeph": "zep", "Zep": "zep", "Hag": "hag", "Zech": "zec", "Zec": "zec", "Mal": "mal",
  "Mt": "mat", "Mat": "mat", "Matt": "mat", "Mk": "mrk", "Mar": "mrk", "Mark": "mrk",
  "Lk": "luk", "Lu": "luk", "Luke": "luk", "Jn": "jhn", "Jno": "jhn", "John": "jhn",
  "Ac": "act", "Acts": "act", "Ro": "rom", "Rom": "rom", "Rms": "rom",
  "1Co": "1co", "1 Cor": "1co", "1Cor": "1co", "I Cor": "1co", "I Corinthians": "1co",
  "2Co": "2co", "2 Cor": "2co", "2Cor": "2co", "II Cor": "2co", "II Corinthians": "2co",
  "Gal": "gal", "Ga": "gal", "Eph": "eph", "Ep": "eph", "Phil": "php", "Php": "php", "Phl": "php",
  "Col": "col", "1Th": "1th", "1 Thess": "1th", "1Thess": "1th", "I Thess": "1th",
  "2Th": "2th", "2 Thess": "2th", "2Thess": "2th", "II Thess": "2th",
  "1Ti": "1ti", "1 Tim": "1ti", "1Tim": "1ti", "I Tim": "1ti",
  "2Ti": "2ti", "2 Tim": "2ti", "2Tim": "2ti", "II Tim": "2ti",
  "Tit": "tit", "Titus": "tit", "Phm": "phm", "Philm": "phm",
  "Heb": "heb", "Jas": "jas", "Jms": "jas", "James": "jas",
  "1Pe": "1pe", "1 Pet": "1pe", "1Pet": "1pe", "I Peter": "1pe",
  "2Pe": "2pe", "2 Pet": "2pe", "2Pet": "2pe", "II Peter": "2pe",
  "1Jn": "1jn", "1 John": "1jn", "I John": "1jn",
  "2Jn": "2jn", "2 John": "2jn", "II John": "2jn",
  "3Jn": "3jn", "3 John": "3jn", "III John": "3jn",
  "Jud": "jud", "Jude": "jud", "Rev": "rev", "Rv": "rev", "Apoc": "rev"
};

let _artRefRe = null,_artRefMap = null,_artRefBookCount = -1;
function artRefIndex() {
  const books = window.CODEX_DATA && window.CODEX_DATA.books || [];
  if (_artRefRe && books.length === _artRefBookCount) return { re: _artRefRe, map: _artRefMap };
  const map = new Map();
  for (const b of books) {
    map.set(b.name.toLowerCase(), b.id);
    const m = b.name.match(/^([1-3])\s+(.+)$/);
    if (m) {
      map.set((m[1] + " " + m[2]).toLowerCase(), b.id);
      map.set(("i".repeat(+m[1]) + " " + m[2]).toLowerCase(), b.id);
    }
  }
  for (const [k, v] of Object.entries(ART_SHORT_BOOKS)) {
    if (!map.has(k.toLowerCase())) map.set(k.toLowerCase(), v);
  }
  const keys = [...map.keys()].sort((a, b) => b.length - a.length);
  const escaped = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  _artRefRe = new RegExp(
    "\\b(" + escaped.join("|") + ")\\.?\\s+(\\d{1,3})(?::(\\d{1,3})(?:[\\u2013-](\\d{1,3}))?)?\\b",
    "gi"
  );
  _artRefMap = map;
  _artRefBookCount = books.length;
  return { re: _artRefRe, map: _artRefMap };
}

// → [{type:"text",text} | {type:"ref",text,ref:{bookId,chapter,verse,endVerse,label}}]
function artSplitOnRefs(text) {
  const s = String(text == null ? "" : text);
  const { re, map } = artRefIndex();
  if (!map.size) return [{ type: "text", text: s }];
  const out = [];
  let last = 0,m;
  re.lastIndex = 0;
  while ((m = re.exec(s)) !== null) {
    const bookId = map.get(m[1].toLowerCase());
    if (!bookId) continue;
    if (m.index > last) out.push({ type: "text", text: s.slice(last, m.index) });
    out.push({
      type: "ref", text: m[0],
      ref: {
        bookId,
        chapter: parseInt(m[2], 10),
        verse: m[3] ? parseInt(m[3], 10) : null,
        endVerse: m[4] ? parseInt(m[4], 10) : null,
        label: m[0]
      }
    });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ type: "text", text: s.slice(last) });
  return out;
}

function artPrimaryTranslation() {
  try {
    const n = window.CODEX_NOW;
    if (n && n.translation) return n.translation;
  } catch {}
  try {
    const t = JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}");
    if (t.primaryTranslation) return t.primaryTranslation;
  } catch {}
  return "kjv";
}

// The universal law: every verse click opens the reader on that verse.
function artJump(refData) {
  try {
    if (refData && refData.bookId && typeof window.codexGoto === "function") {
      window.codexGoto(refData.bookId, refData.chapter || 1, refData.verse || 1);
      return;
    }
    if (typeof window.codexJumpToRef === "function") {
      window.codexJumpToRef(String(refData && refData.label || refData || ""));
    }
  } catch {}
}

// ── Scripture chip with lazy hover/focus preview ──────────────────────────
function ArtRef({ refData }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null); // null | [{n,text}] | "err"
  const hostRef = useRef(null);
  const timers = useRef({});
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !hostRef.current) return;
    const r = hostRef.current.getBoundingClientRect();
    const popW = 280,popH = 150,pad = 8;
    let left = Math.min(window.innerWidth - popW - pad, Math.max(pad, r.left + r.width / 2 - popW / 2));
    let top = r.bottom + 6;
    if (top + popH > window.innerHeight - pad) top = Math.max(pad, r.top - popH - 6);
    setPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open || preview) return;
    let dead = false;
    (async () => {
      try {
        const { bookId, chapter, verse, endVerse } = refData;
        const trans = artPrimaryTranslation();
        const data = await window.BIBLE.loadChapter(bookId, chapter, trans);
        const verses = data && data.verses || data || [];
        let lines = [];
        if (verse == null) {
          lines = verses.slice(0, 3).map((v) => ({ n: v.n || v.verse, text: v.text || v[trans] || "" }));
        } else {
          const end = Math.min(endVerse || verse, verse + 3);
          for (let n = verse; n <= end; n++) {
            const v = verses.find((x) => (x.n || x.verse) === n);
            if (v) lines.push({ n, text: v.text || v[trans] || "" });
          }
        }
        if (!dead) setPreview(lines.length ? lines : "err");
      } catch {if (!dead) setPreview("err");}
    })();
    return () => {dead = true;};
  }, [open, preview, refData]);

  const show = () => {clearTimeout(timers.current.close);timers.current.open = setTimeout(() => setOpen(true), 220);};
  const hide = () => {clearTimeout(timers.current.open);timers.current.close = setTimeout(() => setOpen(false), 160);};
  useEffect(() => () => {clearTimeout(timers.current.open);clearTimeout(timers.current.close);}, []);

  return (/*#__PURE__*/
    React.createElement("button", {
      type: "button",
      ref: hostRef,
      className: "cx-art-ref",
      onMouseEnter: show,
      onMouseLeave: hide,
      onFocus: show,
      onBlur: hide,
      onClick: () => artJump(refData),
      title: `Open the reader at ${refData.label}` },

    refData.label,
    open ? ReactDOM.createPortal(/*#__PURE__*/
      React.createElement("span", { className: "cx-art-ref-pop", role: "tooltip",
        onMouseEnter: () => clearTimeout(timers.current.close),
        onMouseLeave: hide,
        style: { top: pos.top + "px", left: pos.left + "px" } }, /*#__PURE__*/
      React.createElement("span", { className: "cx-art-ref-pop-h" }, refData.label), /*#__PURE__*/
      React.createElement("span", { className: "cx-art-ref-pop-b" },
      preview === null ? "loading…" :
      preview === "err" ? "(no preview)" :
      preview.map((v) => /*#__PURE__*/React.createElement("span", { key: v.n }, /*#__PURE__*/React.createElement("sup", null, v.n), v.text, " "))
      )
      ),
      document.body
    ) : null
    ));

}

// ── Inline rendering — [j]/[d] tags, refs, bold/italic/code ───────────────
function artInlineMd(text, out, nextKey) {
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*\s][^*]*[^*\s]|[^*\s])\*)/g;
  let last = 0,m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(/*#__PURE__*/React.createElement(React.Fragment, { key: nextKey() }, text.slice(last, m.index)));
    if (m[2] != null) out.push(/*#__PURE__*/React.createElement("strong", { key: nextKey() }, m[2]));else
    if (m[3] != null) out.push(/*#__PURE__*/React.createElement("code", { key: nextKey(), className: "cx-art-code-i" }, m[3]));else
    if (m[4] != null) out.push(/*#__PURE__*/React.createElement("em", { key: nextKey() }, m[4]));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(/*#__PURE__*/React.createElement(React.Fragment, { key: nextKey() }, text.slice(last)));
}

function artRenderInline(text) {
  if (!text) return null;
  const tagRe = /\[(j|d)\]([\s\S]*?)\[\/\1\]/g;
  const blocks = [];
  let last = 0,m;
  while ((m = tagRe.exec(text)) !== null) {
    if (m.index > last) blocks.push({ kind: null, text: text.slice(last, m.index) });
    blocks.push({ kind: m[1] === "j" ? "red" : "divine", text: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) blocks.push({ kind: null, text: text.slice(last) });
  const out = [];
  let key = 0;
  const nextKey = () => "i" + key++;
  for (const b of blocks) {
    if (b.kind) {
      out.push(/*#__PURE__*/React.createElement("span", { key: nextKey(), className: b.kind === "red" ? "cx-red" : "cx-divine" }, b.text));
      continue;
    }
    for (const seg of artSplitOnRefs(b.text)) {
      if (seg.type === "ref") out.push(/*#__PURE__*/React.createElement(ArtRef, { key: nextKey(), refData: seg.ref }));else
      artInlineMd(seg.text, out, nextKey);
    }
  }
  return out;
}

// ── Block parsing — fences, headings, lists, quotes, tables, paragraphs ───
function artParseBlocks(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let para = null,list = null;
  const flush = () => {
    if (list) {blocks.push(list);list = null;}
    if (para) {blocks.push({ type: "p", text: para.join(" ") });para = null;}
  };
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.replace(/\s+$/, "");
    let m;
    if (m = line.match(/^```([\w:-]*)\s*$/)) {
      flush();
      const lang = (m[1] || "").toLowerCase();
      const buf = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {buf.push(lines[i]);i++;}
      i++; // closing fence (or EOF)
      blocks.push({ type: "fence", lang, code: buf.join("\n") });
      continue;
    }
    if (!line.trim()) {flush();i++;continue;}
    if (m = line.match(/^(#{1,4})\s+(.*)$/)) {flush();blocks.push({ type: "h", level: m[1].length, text: m[2] });i++;continue;}
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {flush();blocks.push({ type: "hr" });i++;continue;}
    if (/^\s*>\s?/.test(line)) {flush();blocks.push({ type: "quote", text: line.replace(/^\s*>\s?/, "") });i++;continue;}
    // table: a |…| line whose NEXT line is the |---|---| separator
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && /-/.test(lines[i + 1])) {
      flush();
      const splitRow = (s) => s.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      const head = splitRow(line);
      const rows = [];
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {rows.push(splitRow(lines[i]));i++;}
      blocks.push({ type: "table", head, rows });
      continue;
    }
    if (m = line.match(/^\s*(?:[*\-•]|\d+[.)])\s+(.*)$/)) {
      if (para) {blocks.push({ type: "p", text: para.join(" ") });para = null;}
      const ordered = /^\s*\d+[.)]/.test(line);
      if (!list || list.ordered !== ordered) {if (list) blocks.push(list);list = { type: "list", ordered, items: [] };}
      list.items.push(m[1]);
      i++;continue;
    }
    if (list) {blocks.push(list);list = null;}
    para = para || [];
    para.push(line);
    i++;
  }
  flush();
  return blocks;
}

function artParseJSON(s) {
  const t = String(s || "").trim();
  try {return JSON.parse(t);} catch {}
  try {
    if (window.CODEX_INTEL && window.CODEX_INTEL.intelParseJSON) return window.CODEX_INTEL.intelParseJSON(t);
  } catch {}
  return undefined;
}

// ── Action routing — buttons + anything else that wants the app's doors ───
function artSetTweak(key, value) {
  let stored = {};
  try {stored = JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}") || {};} catch {}
  const prev = stored[key];
  stored[key] = value;
  try {localStorage.setItem("codex.tweaks.v1", JSON.stringify(stored));} catch {}
  const edits = {};edits[key] = value;
  try {window.parent.postMessage({ type: "__edit_mode_set_keys", edits }, "*");} catch {}
  try {window.dispatchEvent(new CustomEvent("tweakchange", { detail: edits }));} catch {}
  try {
    window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: `⚙ set ${key} ${JSON.stringify(value)}`, kind: "ok" } }));
  } catch {}
  return prev;
}

const ART_DESK_IDS = ["reader", "library", "oracle", "marks"];
function artOpenPanel(id) {
  const pid = String(id || "").trim();
  if (!pid) return false;
  try {
    if (ART_DESK_IDS.includes(pid) && window.codexDesk && window.codexDesk.on && window.codexDesk.on()) {
      window.codexDesk.open(pid);return true;
    }
    if (window.codexDeskPanels && window.codexDeskPanels.open) {window.codexDeskPanels.open(pid);return true;}
    window.dispatchEvent(new CustomEvent("codex:open-builtin-tab", { detail: { tabId: pid } }));
    return true;
  } catch {return false;}
}

function artRunAction(action) {
  if (!action || typeof action !== "object") return;
  const kind = String(action.kind || "").toLowerCase();
  try {
    if (kind === "goto") {
      if (action.ref) {if (window.codexJumpToRef) window.codexJumpToRef(String(action.ref));} else
      if (action.book && window.CODEX_KERNEL && window.CODEX_KERNEL.parseRef) {
        const p = window.CODEX_KERNEL.parseRef(`${action.book} ${action.chapter || 1}:${action.verse || 1}`);
        if (p && window.codexGoto) window.codexGoto(p.bookId, p.chapter, p.v1 || 1);
      }
      return;
    }
    if (kind === "panel") {artOpenPanel(action.id);return;}
    if (kind === "console") {
      const c = String(action.console || action.id || "").toLowerCase();
      const ref = String(action.ref || window.CODEX_NOW && window.CODEX_NOW.ref || "");
      if (c && ref) window.dispatchEvent(new CustomEvent("codex:os-open", { detail: { kind: c, ref } }));
      return;
    }
    if (kind === "setting") {
      if (action.key !== undefined) artSetTweak(String(action.key), action.value);
      return;
    }
  } catch {}
}

// ── Directive components ──────────────────────────────────────────────────
function ArtBroken({ tag, code }) {
  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-art-broken", role: "note" }, /*#__PURE__*/
    React.createElement("b", null, "UNRENDERED ", tag), " \u2014 payload was not valid JSON", /*#__PURE__*/
    React.createElement("pre", { className: "cx-art-code" }, String(code || "").slice(0, 400))
    ));

}

function ArtButtons({ code }) {
  const items = artParseJSON(code);
  if (!Array.isArray(items)) return /*#__PURE__*/React.createElement(ArtBroken, { tag: "codex:buttons", code: code });
  const good = items.filter((b) => b && typeof b.label === "string" && b.action && typeof b.action === "object").slice(0, 8);
  if (!good.length) return /*#__PURE__*/React.createElement(ArtBroken, { tag: "codex:buttons", code: code });
  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-art-buttons", role: "group", "aria-label": "Suggested actions" },
    good.map((b, i) => /*#__PURE__*/
    React.createElement("button", { key: i, type: "button", className: "cx-art-btn",
      onClick: () => artRunAction(b.action),
      title: `${b.action.kind || "action"}${b.action.ref ? " · " + b.action.ref : ""}${b.action.id ? " · " + b.action.id : ""}${b.action.key ? ` · ${b.action.key}=${JSON.stringify(b.action.value)}` : ""}` },
    b.label
    )
    )
    ));

}

const ART_ACCENT = "var(--cx-accent, #7ee0ff)";
const ART_FG = "var(--cx-fg, #c9d4dc)";
const ART_DIM = "var(--cx-fg-dim, #8a98a8)";
const ART_HUES = ["#7ee0ff", "#c7a9ff", "#8de8a8", "#ffc46b", "#ff8291", "#6bc6ff", "#e8d68d"];

function artNum(v) {const n = Number(v);return Number.isFinite(n) ? n : 0;}
function artFmt(v) {
  const n = artNum(v);
  return Math.abs(n) >= 1000 ? String(Math.round(n)) : String(Math.round(n * 100) / 100);
}

function ArtChart({ code }) {
  const spec = artParseJSON(code);
  const data = spec && Array.isArray(spec.data) ?
  spec.data.filter((d) => d && d.label !== undefined && d.value !== undefined).slice(0, 16) :
  null;
  if (!data || !data.length) return /*#__PURE__*/React.createElement(ArtBroken, { tag: "codex:chart", code: code });
  const type = String(spec.type || "bar").toLowerCase();
  const title = typeof spec.title === "string" ? spec.title : "";
  const max = Math.max(...data.map((d) => Math.abs(artNum(d.value))), 1);

  let svg = null;
  if (type === "line") {
    const W = 360,H = 150,padL = 16,padR = 38,padT = 16,padB = 26;
    const iw = W - padL - padR,ih = H - padT - padB;
    const pts = data.map((d, i) => ({
      x: padL + (data.length === 1 ? iw / 2 : i / (data.length - 1) * iw),
      y: padT + ih - artNum(d.value) / max * ih,
      d
    }));
    svg = /*#__PURE__*/
    React.createElement("svg", { viewBox: `0 0 ${W} ${H}`, width: W, role: "img", "aria-label": `Line chart${title ? ": " + title : ""}` }, /*#__PURE__*/
    React.createElement("line", { x1: padL, y1: padT + ih, x2: W - padR, y2: padT + ih, stroke: ART_DIM, strokeWidth: "0.6", opacity: "0.6" }), /*#__PURE__*/
    React.createElement("polyline", { fill: "none", stroke: ART_ACCENT, strokeWidth: "1.6",
      points: pts.map((p) => `${p.x},${p.y}`).join(" ") }),
    pts.map((p, i) => /*#__PURE__*/
    React.createElement("g", { key: i }, /*#__PURE__*/
    React.createElement("circle", { cx: p.x, cy: p.y, r: "2.6", fill: ART_ACCENT }), /*#__PURE__*/
    React.createElement("text", { x: p.x, y: p.y - 6, fontSize: "8.5", fill: ART_FG, textAnchor: "middle" }, artFmt(p.d.value)), /*#__PURE__*/
    React.createElement("text", { x: p.x, y: H - 8, fontSize: "8", fill: ART_DIM, textAnchor: "middle" }, String(p.d.label).slice(0, 9))
    )
    )
    );

  } else if (type === "radial") {
    const W = 360,H = Math.max(150, data.length * 18 + 40),cx = 86,cy = H / 2;
    const R = Math.min(64, H / 2 - 12),r0 = 26;
    const total = data.reduce((s, d) => s + Math.abs(artNum(d.value)), 0) || 1;
    let a = -Math.PI / 2;
    const segs = data.map((d, i) => {
      const frac = Math.abs(artNum(d.value)) / total;
      const a0 = a,a1 = a + frac * Math.PI * 2 - 0.015;
      a += frac * Math.PI * 2;
      const px = (ang, rad) => [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad];
      const [x0, y0] = px(a0, R),[x1, y1] = px(a1, R),[x2, y2] = px(a1, r0),[x3, y3] = px(a0, r0);
      const large = a1 - a0 > Math.PI ? 1 : 0;
      return {
        d: `M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 0 ${x3},${y3} Z`,
        hue: ART_HUES[i % ART_HUES.length], item: d
      };
    });
    svg = /*#__PURE__*/
    React.createElement("svg", { viewBox: `0 0 ${W} ${H}`, width: W, role: "img", "aria-label": `Radial chart${title ? ": " + title : ""}` },
    segs.map((s, i) => /*#__PURE__*/React.createElement("path", { key: i, d: s.d, fill: s.hue, opacity: "0.85" })),
    segs.map((s, i) => /*#__PURE__*/
    React.createElement("g", { key: "l" + i }, /*#__PURE__*/
    React.createElement("rect", { x: 176, y: 14 + i * 18, width: "8", height: "8", fill: s.hue }), /*#__PURE__*/
    React.createElement("text", { x: 190, y: 22 + i * 18, fontSize: "9", fill: ART_FG },
    String(s.item.label).slice(0, 18), " \xB7 ", artFmt(s.item.value)
    )
    )
    )
    );

  } else {
    // bar (default)
    const rowH = 22,W = 360,padT = 6;
    const H = data.length * rowH + padT + 6;
    const labelW = 104,barMax = W - labelW - 50;
    svg = /*#__PURE__*/
    React.createElement("svg", { viewBox: `0 0 ${W} ${H}`, width: W, role: "img", "aria-label": `Bar chart${title ? ": " + title : ""}` },
    data.map((d, i) => {
      const w = Math.max(1.5, Math.abs(artNum(d.value)) / max * barMax);
      const y = padT + i * rowH;
      return (/*#__PURE__*/
        React.createElement("g", { key: i }, /*#__PURE__*/
        React.createElement("text", { x: labelW - 6, y: y + 14, fontSize: "9", fill: ART_FG, textAnchor: "end" }, String(d.label).slice(0, 16)), /*#__PURE__*/
        React.createElement("rect", { x: labelW, y: y + 5, width: w, height: 12, fill: ART_HUES[i % ART_HUES.length], opacity: "0.85", rx: "1.5" }), /*#__PURE__*/
        React.createElement("text", { x: labelW + w + 5, y: y + 14, fontSize: "9", fill: ART_FG }, artFmt(d.value))
        ));

    })
    );

  }
  return (/*#__PURE__*/
    React.createElement("figure", { className: "cx-art-chart" },
    title ? /*#__PURE__*/React.createElement("figcaption", { className: "cx-art-chart-title" }, title) : null,
    svg
    ));

}

function ArtFlow({ code }) {
  const spec = artParseJSON(code);
  const nodes = spec && Array.isArray(spec.nodes) ?
  spec.nodes.filter((n) => n && n.id !== undefined).slice(0, 16).map((n) => ({ id: String(n.id), label: String(n.label || n.id), ref: n.ref })) :
  null;
  if (!nodes || !nodes.length) return /*#__PURE__*/React.createElement(ArtBroken, { tag: "codex:flow", code: code });
  const ids = new Set(nodes.map((n) => n.id));
  const edges = (Array.isArray(spec.edges) ? spec.edges : []).
  filter((e) => e && ids.has(String(e.from)) && ids.has(String(e.to)) && String(e.from) !== String(e.to)).
  slice(0, 24).
  map((e) => ({ from: String(e.from), to: String(e.to), label: e.label ? String(e.label) : "" }));

  // layered layout: layer(n) = longest path from any source (cycle-safe).
  const layer = {};
  nodes.forEach((n) => {layer[n.id] = 0;});
  for (let pass = 0; pass < nodes.length; pass++) {
    let moved = false;
    for (const e of edges) {
      if (layer[e.to] < layer[e.from] + 1 && layer[e.from] + 1 < nodes.length) {
        layer[e.to] = layer[e.from] + 1;moved = true;
      }
    }
    if (!moved) break;
  }
  const cols = {};
  nodes.forEach((n) => {(cols[layer[n.id]] = cols[layer[n.id]] || []).push(n);});
  const NW = 132,NH = 36,GX = 64,GY = 22;
  const nLayers = Object.keys(cols).length;
  const maxRows = Math.max(...Object.values(cols).map((c) => c.length));
  const W = nLayers * NW + (nLayers - 1) * GX + 24;
  const H = maxRows * NH + (maxRows - 1) * GY + 24;
  const posOf = {};
  Object.keys(cols).sort((a, b) => a - b).forEach((L) => {
    const col = cols[L];
    const colH = col.length * NH + (col.length - 1) * GY;
    col.forEach((n, i) => {
      posOf[n.id] = { x: 12 + L * (NW + GX), y: (H - colH) / 2 + i * (NH + GY) };
    });
  });

  return (/*#__PURE__*/
    React.createElement("figure", { className: "cx-art-flow" }, /*#__PURE__*/
    React.createElement("svg", { viewBox: `0 0 ${W} ${H}`, width: Math.min(W, 560), role: "img",
      "aria-label": `Flow diagram: ${nodes.map((n) => n.label).join(" → ")}` }, /*#__PURE__*/
    React.createElement("defs", null, /*#__PURE__*/
    React.createElement("marker", { id: "cx-art-arrow", viewBox: "0 0 8 8", refX: "7", refY: "4", markerWidth: "6", markerHeight: "6", orient: "auto" }, /*#__PURE__*/
    React.createElement("path", { d: "M0,0 L8,4 L0,8 Z", fill: ART_ACCENT })
    )
    ),
    edges.map((e, i) => {
      const a = posOf[e.from],b = posOf[e.to];
      const x0 = a.x + NW,y0 = a.y + NH / 2,x1 = b.x,y1 = b.y + NH / 2;
      const mx = (x0 + x1) / 2;
      const back = x1 <= x0; // same-layer / backward edge: bow around
      const d = back ?
      `M${a.x + NW / 2},${a.y + NH} C${a.x + NW / 2},${a.y + NH + 26} ${b.x + NW / 2},${b.y - 26} ${b.x + NW / 2},${b.y}` :
      `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
      return (/*#__PURE__*/
        React.createElement("g", { key: "e" + i }, /*#__PURE__*/
        React.createElement("path", { d: d, fill: "none", stroke: ART_ACCENT, strokeWidth: "1.1", opacity: "0.75", markerEnd: "url(#cx-art-arrow)" }),
        e.label ? /*#__PURE__*/
        React.createElement("text", { x: back ? (a.x + b.x + NW) / 2 : mx, y: back ? (a.y + NH + b.y) / 2 + 3 : (y0 + y1) / 2 - 4,
          fontSize: "7.5", fill: ART_DIM, textAnchor: "middle" }, e.label.slice(0, 22)) :
        null
        ));

    }),
    nodes.map((n) => {
      const p = posOf[n.id];
      const clickable = !!n.ref;
      return (/*#__PURE__*/
        React.createElement("g", { key: n.id,
          onClick: clickable ? () => {if (window.codexJumpToRef) window.codexJumpToRef(String(n.ref));} : undefined,
          style: clickable ? { cursor: "pointer" } : undefined,
          tabIndex: clickable ? 0 : undefined,
          role: clickable ? "button" : undefined,
          "aria-label": clickable ? `Open the reader at ${n.ref}` : undefined,
          onKeyDown: clickable ? (e) => {if (e.key === "Enter" || e.key === " ") {e.preventDefault();if (window.codexJumpToRef) window.codexJumpToRef(String(n.ref));}} : undefined }, /*#__PURE__*/
        React.createElement("rect", { x: p.x, y: p.y, width: NW, height: NH, rx: "5",
          fill: "rgba(126,224,255,0.07)", stroke: clickable ? ART_ACCENT : "rgba(126,224,255,0.4)", strokeWidth: "1" }), /*#__PURE__*/
        React.createElement("text", { x: p.x + NW / 2, y: p.y + NH / 2 + 3, fontSize: "9", fill: ART_FG, textAnchor: "middle" },
        n.label.slice(0, 20)
        )
        ));

    })
    )
    ));

}

function ArtVerseCard({ refStr }) {
  const [state, setState] = useState({ lines: null, err: false });
  const parsed = useMemo(() => {
    try {if (window.CODEX_KERNEL && window.CODEX_KERNEL.parseRef) return window.CODEX_KERNEL.parseRef(refStr);} catch {}
    const segs = artSplitOnRefs(refStr);
    const r = segs.find((s) => s.type === "ref");
    return r ? { bookId: r.ref.bookId, bookName: r.ref.label, chapter: r.ref.chapter, v1: r.ref.verse, v2: r.ref.endVerse } : null;
  }, [refStr]);

  useEffect(() => {
    if (!parsed) {setState({ lines: null, err: true });return;}
    let dead = false;
    (async () => {
      try {
        const trans = artPrimaryTranslation();
        const data = await window.BIBLE.loadChapter(parsed.bookId, parsed.chapter, trans);
        const verses = data && data.verses || data || [];
        const v1 = parsed.v1 || 1;
        const v2 = Math.min(parsed.v2 || v1, v1 + 3);
        const lines = [];
        for (let n = v1; n <= v2; n++) {
          const v = verses.find((x) => (x.n || x.verse) === n);
          if (v) lines.push({ n, text: String(v.text || v[trans] || "").trim() });
        }
        if (!dead) setState({ lines, err: !lines.length });
      } catch {if (!dead) setState({ lines: null, err: true });}
    })();
    return () => {dead = true;};
  }, [refStr]);

  const jump = () => {
    if (parsed && window.codexGoto) window.codexGoto(parsed.bookId, parsed.chapter, parsed.v1 || 1);else
    if (window.codexJumpToRef) window.codexJumpToRef(refStr);
  };

  return (/*#__PURE__*/
    React.createElement("button", { type: "button", className: "cx-art-vcard", onClick: jump, title: `Open the reader at ${refStr}` }, /*#__PURE__*/
    React.createElement("span", { className: "cx-art-vcard-ref" }, refStr),
    state.err ? /*#__PURE__*/React.createElement("span", { className: "cx-art-vcard-txt is-dim" }, "(text unavailable here \u2014 tap to open the reader)") :
    state.lines === null ? /*#__PURE__*/React.createElement("span", { className: "cx-art-vcard-txt is-dim" }, "loading\u2026") : /*#__PURE__*/
    React.createElement("span", { className: "cx-art-vcard-txt" }, state.lines.map((l) => /*#__PURE__*/React.createElement("span", { key: l.n }, /*#__PURE__*/React.createElement("sup", { style: { opacity: 0.6 } }, l.n), " ", l.text, " ")))
    ));

}

function ArtVerseGrid({ code }) {
  const refs = artParseJSON(code);
  const good = Array.isArray(refs) ? refs.filter((r) => typeof r === "string" && r.trim()).slice(0, 12) : null;
  if (!good || !good.length) return /*#__PURE__*/React.createElement(ArtBroken, { tag: "codex:verse-grid", code: code });
  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-art-vgrid" },
    good.map((r, i) => /*#__PURE__*/React.createElement(ArtVerseCard, { key: r + i, refStr: r.trim() }))
    ));

}

function artRenderFence(b, key) {
  const lang = b.lang || "";
  if (lang === "codex:buttons") return /*#__PURE__*/React.createElement(ArtButtons, { key: key, code: b.code });
  if (lang === "codex:chart") return /*#__PURE__*/React.createElement(ArtChart, { key: key, code: b.code });
  if (lang === "codex:flow") return /*#__PURE__*/React.createElement(ArtFlow, { key: key, code: b.code });
  if (lang === "codex:verse-grid" || lang === "codex:verses") return /*#__PURE__*/React.createElement(ArtVerseGrid, { key: key, code: b.code });
  if (lang.startsWith("codex:")) return /*#__PURE__*/React.createElement(ArtBroken, { key: key, tag: lang, code: b.code });
  return /*#__PURE__*/React.createElement("pre", { key: key, className: "cx-art-code" }, b.code);
}

// ── The renderer ──────────────────────────────────────────────────────────
function ArtifactsRich({ text }) {
  useEffect(() => {artEnsureCss();}, []);
  const blocks = useMemo(() => artParseBlocks(text), [text]);
  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-art" },
    blocks.map((b, i) => {
      if (b.type === "fence") return artRenderFence(b, i);
      if (b.type === "h") return /*#__PURE__*/React.createElement("div", { key: i, role: "heading", "aria-level": Math.min(b.level + 2, 6), className: `cx-art-h is-${Math.min(b.level, 4)}` }, artRenderInline(b.text));
      if (b.type === "hr") return /*#__PURE__*/React.createElement("hr", { key: i });
      if (b.type === "quote") return /*#__PURE__*/React.createElement("blockquote", { key: i }, artRenderInline(b.text));
      if (b.type === "list") {
        const Tag = b.ordered ? "ol" : "ul";
        return /*#__PURE__*/React.createElement(Tag, { key: i }, b.items.map((it, j) => /*#__PURE__*/React.createElement("li", { key: j }, artRenderInline(it))));
      }
      if (b.type === "table") {
        return (/*#__PURE__*/
          React.createElement("table", { key: i, className: "cx-art-table" }, /*#__PURE__*/
          React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, b.head.map((h, j) => /*#__PURE__*/React.createElement("th", { key: j }, artRenderInline(h))))), /*#__PURE__*/
          React.createElement("tbody", null, b.rows.map((r, j) => /*#__PURE__*/React.createElement("tr", { key: j }, r.map((c, k) => /*#__PURE__*/React.createElement("td", { key: k }, artRenderInline(c))))))
          ));

      }
      return /*#__PURE__*/React.createElement("p", { key: i }, artRenderInline(b.text));
    })
    ));

}

// ── The grammar — single source of truth, embedded in every system prompt ─
function artDirectiveDoc() {
  return [
  "RICH OUTPUT — your replies render through the CODEX artifacts engine:",
  "· Markdown works: ## headings · **bold** · *italic* · `code` · - lists · > quotes · | tables | (with a |---| separator row) · --- rules.",
  "· Scripture references written PLAINLY (Book Chapter:Verse, e.g. John 1:1, Genesis 1:26-27) become live clickable chips that open the reader — never wrap a reference in brackets, code ticks, or [j]/[d] tags.",
  "· [j]exact Jesus quote[/j] renders red-letter; [d]exact God-the-Father quote[/d] renders with shimmer. Verbatim quotes only.",
  "· You may emit FENCED DIRECTIVE BLOCKS. Each becomes a real interactive element. The fence tag must be exact; the body must be VALID JSON; at most 2 directives per reply, and only when they genuinely serve the answer:",
  "```codex:buttons",
  '[{"label":"Read John 1","action":{"kind":"goto","ref":"John 1:1"}},',
  ' {"label":"Open gematria","action":{"kind":"panel","id":"gem"}},',
  ' {"label":"Map this verse","action":{"kind":"console","console":"map","ref":"John 1:1"}},',
  ' {"label":"Reader font 22","action":{"kind":"setting","key":"fontScale","value":22}}]',
  "```",
  'action kinds → "goto" {ref} · "panel" {id: one of trans|talmud|comm|gem|gnosis|disarm|exeg|txan|library|oracle|marks} · "console" {console: map|mirror|sword|art|compare, ref} · "setting" {key, value} (settings keys include fontScale, scriptureFont, accent, redLetter, sideBySide, distractionFree, primaryTranslation).',
  "```codex:chart",
  '{"type":"bar","title":"Logos occurrences","data":[{"label":"John","value":4},{"label":"1 John","value":1}]}',
  "```",
  'chart types → "bar" | "line" | "radial". Values must be REAL numbers you computed or sourced (tool results, counts you actually made) — NEVER decorative or invented data.',
  "```codex:flow",
  '{"nodes":[{"id":"a","label":"Word with God","ref":"John 1:1"},{"id":"b","label":"Word made flesh","ref":"John 1:14"}],"edges":[{"from":"a","to":"b","label":"becomes"}]}',
  "```",
  "```codex:verse-grid",
  '["John 1:1","Genesis 1:1","Colossians 1:16"]',
  "```",
  "verse-grid renders live scripture cards (use for parallel passages; 2-6 refs)."].
  join("\n");
}

// ── AI-BUSY bus + the orb ─────────────────────────────────────────────────
(function installBusyBus() {
  if (typeof window === "undefined" || window.CODEX_AI_BUSY) return;
  let seq = 0;
  const active = new Map(); // id → label

  function orbRender() {
    let orb = document.getElementById("cx-ai-orb");
    if (!active.size) {if (orb) orb.remove();return;}
    artEnsureCss();
    const labels = [...new Set(active.values())].join(" · ");
    if (!orb) {
      orb = document.createElement("div");
      orb.id = "cx-ai-orb";
      orb.setAttribute("role", "status");
      orb.setAttribute("aria-live", "polite");
      orb.tabIndex = 0;
      const lbl = document.createElement("span");
      lbl.className = "cx-ai-orb-lbl";
      const core = document.createElement("span");
      core.className = "cx-ai-orb-core";
      core.setAttribute("aria-hidden", "true");
      orb.appendChild(lbl);
      orb.appendChild(core);
      (document.body || document.documentElement).appendChild(orb);
    }
    const lblEl = orb.querySelector(".cx-ai-orb-lbl");
    if (lblEl) lblEl.textContent = labels; // textContent only — never HTML
    orb.setAttribute("aria-label", "AI processing: " + labels);
    orb.title = labels;
  }

  function fire() {
    try {
      window.dispatchEvent(new CustomEvent("codex:ai-busy", {
        detail: { active: active.size > 0, labels: [...active.values()] }
      }));
    } catch {}
    try {orbRender();} catch {}
  }

  window.CODEX_AI_BUSY = {
    begin(label) {const id = ++seq;active.set(id, String(label || "AI"));fire();return id;},
    end(id) {if (active.delete(id)) fire();},
    active() {return active.size > 0;}
  };
})();

// ── Public surface ────────────────────────────────────────────────────────
window.CODEX_ARTIFACTS = {
  Rich: ArtifactsRich,
  render(text) {return React.createElement(ArtifactsRich, { text: String(text == null ? "" : text) });},
  splitOnRefs: artSplitOnRefs,
  runAction: artRunAction,
  openPanel: artOpenPanel,
  setTweak: artSetTweak,
  jump: artJump,
  directiveDoc: artDirectiveDoc,
  ensureCss: artEnsureCss,
  parseBlocks: artParseBlocks // exposed for tests
};
Object.assign(window, { ArtifactsRich });
})();
