// GENERATED from reader.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
// CODEX — reader.jsx · v10 THE READER, rebuilt from zero.
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

// ── THE READER ──────────────────────────────────────────────────────────
function CodexReaderX({ surface } = {}) {
  const data = window.CODEX_DATA || { books: [], translations: [] };
  // Position: follow the app's cursor (window.CODEX_NOW + codex:now bus).
  const [now, setNow] = useState(() => {
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
  window.CODEX_DATA && window.CODEX_DATA.tweaks && window.CODEX_DATA.tweaks.primaryTranslation || "web");
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

  // Bus: the app cursor moves → the reader follows. Primary changes ride
  // the codex:primary event (dispatched by app.jsx setPrimaryAndPersist).
  useEffect(() => {
    const onNow = (e) => {const n = e.detail || window.CODEX_NOW;if (n && n.bookId) setNow(n);};
    const onPrimary = (e) => {const id = e.detail && e.detail.id;if (id) setPrimary(id);};
    const onMarks = () => setMarks(readerHighlights());
    window.addEventListener("codex:now", onNow);
    window.addEventListener("codex:primary", onPrimary);
    window.addEventListener("codex:marks-changed", onMarks);
    window.addEventListener("storage", onMarks);
    return () => {
      window.removeEventListener("codex:now", onNow);
      window.removeEventListener("codex:primary", onPrimary);
      window.removeEventListener("codex:marks-changed", onMarks);
      window.removeEventListener("storage", onMarks);
    };
  }, []);

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

  const book = data.books.find((b) => b.id === now.bookId);
  const bookName = book && book.name || now.book || now.bookId;
  const chapters = book && book.chapters || 1;

  const go = (bookId, ch, v) => {
    const b = data.books.find((x) => x.id === bookId);
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
    if (window.codexSelectVerse) window.codexSelectVerse(n);else
    go(now.bookId, now.chapter, n);
  };
  const openMenu = (n, el) => {
    selectVerse(n);
    if (window.codexOpenVerseMenu && el) window.codexOpenVerseMenu(n, el.getBoundingClientRect());
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

  return (/*#__PURE__*/
    React.createElement("div", { className: `cxr ${surface ? "is-" + surface : ""}`, style: { "--cxr-fs": fs + "px" } }, /*#__PURE__*/

    React.createElement("header", { className: "cxr-bar" }, /*#__PURE__*/
    React.createElement("button", { className: "cxr-nav", onClick: prev, "aria-label": "Previous chapter", title: "Previous chapter (H)" }, "\u2039"), /*#__PURE__*/
    React.createElement("button", {
      className: "cxr-loc",
      onClick: () => {try {window.dispatchEvent(new CustomEvent("codex:open-library"));} catch {}if (window.codexDesk) window.codexDesk.open("library");},
      title: "Open the library" }, /*#__PURE__*/

    React.createElement("b", null, bookName), /*#__PURE__*/
    React.createElement("i", null, now.chapter, /*#__PURE__*/React.createElement("small", null, "/", chapters))
    ), /*#__PURE__*/
    React.createElement("button", { className: "cxr-nav", onClick: next, "aria-label": "Next chapter", title: "Next chapter (L)" }, "\u203A"), /*#__PURE__*/
    React.createElement("span", { className: "cxr-bar-gap" }), /*#__PURE__*/
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

    React.createElement("div", { className: "cxr-verses", style: { fontSize: "var(--cxr-fs)" } },
    verses.map((v) => {
      const text = v[tr] || "";
      const isRed = redOn && (v._jesusVerse || v.red && v.red[tr]);
      const mk = marks[`${now.bookId}.${now.chapter}.${v.n}`];
      const isCur = v.n === (now.verse || 0);
      return (/*#__PURE__*/
        React.createElement("div", {
          key: v.n,
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
        React.createElement("span", { className: "cxr-text" }, text)
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

// ── Registration: the MAIN plugin ───────────────────────────────────────
(function registerReaderPlugin() {
  if (typeof window === "undefined") return;
  const reg = () => {
    if (!window.CODEX_PLUGINS_API) return false;
    return window.CODEX_PLUGINS_API.register({
      id: "sys-reader",
      name: "The Reader",
      version: "10.0.0",
      panels: [{
        id: "reader",
        label: "READER",
        glyph: "✦",
        render() {return React.createElement(CodexReaderX, { surface: "window" });}
      }]
    });
  };
  if (!reg()) document.addEventListener("DOMContentLoaded", reg, { once: true });
})();

Object.assign(window, { CodexReaderX });
})();
