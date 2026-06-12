// GENERATED from library2.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
// CODEX — library2.jsx · v10 THE SHELVES — the library dismantled and
// rebuilt as its own plugin (sys-library).
//
// The old library was one rail that ALSO carried the oracle and the marks;
// it hid every non-protestant shelf unless the active translation happened
// to declare that canon — which is exactly why apocrypha / Greek additions
// "couldn't be read". The rebuilt shelves:
//
//   · show EVERY canon — OT, NT, Apocrypha, Orthodox, Ethiopian, Armenian,
//     Syriac, Coptic, Pseudepigrapha — all the time.
//   · every book carries a SOURCE LIGHT: ● cyan = the current translation
//     has it · ◐ violet = another corpus in the registry carries it (the
//     reader auto-serves from there) · ○ dim = no known source yet.
//   · click a book → chapter grid in place; click a chapter → the reader
//     jumps (its source-resolution workflow handles the corpus switch).
//   · one search line: book names, references ("john 3:16"), full text.

function lib2SourceLight(book, primary) {
  const all = window.CODEX_DATA && window.CODEX_DATA.translations || [];
  const canonsOf = (t) => new Set(t.canons && t.canons.length ? t.canons : ["protestant"]);
  const covers = (t) => {
    const c = canonsOf(t);
    if (book.testament === "OT") return c.has("protestant") || c.has("ot");
    if (book.testament === "NT") return c.has("protestant") || c.has("nt");
    return c.has(book.canon);
  };
  const cur = all.find((t) => t.id === primary);
  if (cur && covers(cur)) return "own";
  if (all.some(covers)) return "other";
  return "none";
}

const LIB2_SHELVES = [
{ key: "ot", label: () => window.t && window.t("lib.ot") || "The Old Testament", filter: (b) => b.testament === "OT" },
{ key: "nt", label: () => window.t && window.t("lib.nt") || "The New Testament", filter: (b) => b.testament === "NT" },
{ key: "deuterocanon", label: () => "Apocrypha · Deuterocanon", filter: (b) => b.testament === "DC" && b.canon === "deuterocanon" },
{ key: "orthodox", label: () => "Orthodox additions", filter: (b) => b.testament === "DC" && b.canon === "orthodox" },
{ key: "ethiopian", label: () => "Ge'ez · Ethiopian", filter: (b) => b.testament === "DC" && b.canon === "ethiopian" },
{ key: "armenian", label: () => "Armenian additions", filter: (b) => b.testament === "DC" && b.canon === "armenian" },
{ key: "syriac", label: () => "Syriac · Peshitta", filter: (b) => b.testament === "DC" && b.canon === "syriac" },
{ key: "coptic", label: () => "Coptic additions", filter: (b) => b.testament === "DC" && b.canon === "coptic" },
{ key: "pseudepigrapha", label: () => "Pseudepigrapha", filter: (b) => b.testament === "DC" && b.canon === "pseudepigrapha" }];


function LibraryX() {
  const data = window.CODEX_DATA || { books: [], translations: [] };
  const [now, setNow] = useState(() => window.CODEX_NOW || {});
  const [primary, setPrimary] = useState(() =>
  data.tweaks && data.tweaks.primaryTranslation || "web");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(() => (window.CODEX_NOW || {}).bookId || null);
  const [hits, setHits] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    const onNow = (e) => {const n = e.detail || window.CODEX_NOW;if (n && n.bookId) {setNow(n);}};
    const onPrimary = (e) => {const id = e.detail && e.detail.id;if (id) setPrimary(id);};
    window.addEventListener("codex:now", onNow);
    window.addEventListener("codex:primary", onPrimary);
    return () => {
      window.removeEventListener("codex:now", onNow);
      window.removeEventListener("codex:primary", onPrimary);
    };
  }, []);

  // Full-text suggestions (debounced) when the query isn't a book name.
  useEffect(() => {
    let stop = false;
    const text = q.trim();
    if (text.length < 3 || !window.CODEX_SEARCH || !window.CODEX_SEARCH.search) {setHits([]);return;}
    const t = setTimeout(async () => {
      try {
        const res = await window.CODEX_SEARCH.search(text, { translation: primary, limit: 6 });
        if (!stop) setHits(Array.isArray(res) ? res : []);
      } catch {if (!stop) setHits([]);}
    }, 200);
    return () => {stop = true;clearTimeout(t);};
  }, [q, primary]);

  const needle = q.trim().toLowerCase();
  const matches = (b) => !needle ||
  b.name.toLowerCase().includes(needle) ||
  (b.id || "").toLowerCase().includes(needle);

  const goChapter = (b, ch) => {
    // structured jump — DC display names ("I Enoch (Book of Enoch)") would
    // defeat the string parser, so the shelves never go through it.
    if (window.codexGoto) window.codexGoto(b.id, ch, 1);else
    if (window.codexJumpToRef) window.codexJumpToRef(`${b.name} ${ch}`);
  };

  const refMatch = needle.match(/^([1-4]?\s*[a-zé' ]+?)\s+(\d+)(?::(\d+))?$/i);
  let refJump = null;
  if (refMatch) {
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const want = norm(refMatch[1]);
    const b = data.books.find((x) => norm(x.name) === want || norm(x.id) === want || norm(x.name).startsWith(want));
    if (b) refJump = { b, ch: Math.min(parseInt(refMatch[2], 10) || 1, b.chapters), v: refMatch[3] ? parseInt(refMatch[3], 10) : null };
  }

  const renderBook = (b) => {
    const light = lib2SourceLight(b, primary);
    const active = b.id === now.bookId;
    const open = b.id === openId;
    return (/*#__PURE__*/
      React.createElement("div", { key: b.id, className: `cxl-book ${open ? "is-open" : ""}` }, /*#__PURE__*/
      React.createElement("button", {
        className: `cxl-row ${active ? "is-active" : ""}`,
        onClick: () => setOpenId(open ? null : b.id),
        "aria-expanded": open }, /*#__PURE__*/

      React.createElement("span", { className: `cxl-light is-${light}`, "aria-hidden": true,
        title: light === "own" ? `In ${(primary || "").toUpperCase()}` : light === "other" ? "Served from another corpus" : "No known source" }), /*#__PURE__*/
      React.createElement("span", { className: "cxl-name" }, b.name), /*#__PURE__*/
      React.createElement("span", { className: "cxl-meta" }, active ? `${now.chapter} / ${b.chapters}` : b.chapters)
      ),
      open ? /*#__PURE__*/
      React.createElement("div", { className: "cxl-chs", role: "group", "aria-label": `${b.name} chapters` },
      light === "none" ? /*#__PURE__*/
      React.createElement("div", { className: "cxl-nosource" }, "\u25CB no corpus in the registry carries ", b.name, " yet \u2014 install one via the marketplace") :
      null,
      Array.from({ length: b.chapters }, (_, i) => i + 1).map((ch) => /*#__PURE__*/
      React.createElement("button", { key: ch,
        className: `cxl-ch ${active && ch === now.chapter ? "is-active" : ""}`,
        onClick: () => goChapter(b, ch) },
      ch)
      )
      ) :
      null
      ));

  };

  return (/*#__PURE__*/
    React.createElement("div", { className: "cxl" }, /*#__PURE__*/
    React.createElement("div", { className: "cxl-search" }, /*#__PURE__*/
    React.createElement("input", {
      ref: inputRef,
      value: q,
      onChange: (e) => setQ(e.target.value),
      onKeyDown: (e) => {
        if (e.key === "Enter" && refJump) {
          e.preventDefault();
          goChapter(refJump.b, refJump.ch);
          if (refJump.v && window.codexJumpToRef) window.codexJumpToRef(`${refJump.b.name} ${refJump.ch}:${refJump.v}`);
          setQ("");
        }
        if (e.key === "Escape") setQ("");
      },
      placeholder: "Book \xB7 'John 3:16' \xB7 any words\u2026",
      "aria-label": "Search the shelves \u2014 book, reference, or text",
      spellCheck: false }
    ),
    q ? /*#__PURE__*/React.createElement("button", { className: "cxl-clear", onClick: () => setQ(""), "aria-label": "Clear" }, "\xD7") : null
    ),

    refJump ? /*#__PURE__*/
    React.createElement("button", { className: "cxl-jump", onClick: () => {goChapter(refJump.b, refJump.ch);if (refJump.v && window.codexJumpToRef) window.codexJumpToRef(`${refJump.b.name} ${refJump.ch}:${refJump.v}`);setQ("");} }, "\u2726 OPEN ",
    refJump.b.name.toUpperCase(), " ", refJump.ch, refJump.v ? ":" + refJump.v : ""
    ) :
    null,
    hits.length ? /*#__PURE__*/
    React.createElement("div", { className: "cxl-hits", role: "list" },
    hits.map((h, i) => {
      const p = String(h.ref || "").split(".");
      const b = data.books.find((x) => x.id === p[0]);
      if (!b) return null;
      return (/*#__PURE__*/
        React.createElement("button", { key: i, className: "cxl-hit", role: "listitem",
          onClick: () => {if (window.codexJumpToRef) window.codexJumpToRef(`${b.name} ${p[1]}:${p[2]}`);setQ("");} }, /*#__PURE__*/
        React.createElement("b", null, b.name, " ", p[1], ":", p[2]), /*#__PURE__*/
        React.createElement("span", null, String(h.snippet || h.text || "").replace(/<[^>]+>/g, ""))
        ));

    })
    ) :
    null, /*#__PURE__*/

    React.createElement("div", { className: "cxl-scroll" },
    LIB2_SHELVES.map((shelf) => {
      const books = data.books.filter((b) => shelf.filter(b) && matches(b));
      if (!books.length) return null;
      return (/*#__PURE__*/
        React.createElement("section", { key: shelf.key, className: "cxl-shelf" }, /*#__PURE__*/
        React.createElement("h3", { className: "cxl-h" }, shelf.label()),
        books.map(renderBook)
        ));

    })
    ), /*#__PURE__*/
    React.createElement("footer", { className: "cxl-foot", "aria-hidden": true }, "\u25CF in ",
    (primary || "").toUpperCase(), " \xB7 \u25D0 other corpus \xB7 \u25CB no source"
    )
    ));

}

(function registerLibraryPlugin() {
  if (typeof window === "undefined") return;
  const reg = () => {
    if (!window.CODEX_PLUGINS_API) return false;
    return window.CODEX_PLUGINS_API.register({
      id: "sys-library",
      name: "The Shelves",
      version: "10.0.0",
      panels: [{
        id: "library",
        label: "LIBRARY",
        glyph: "☰",
        render() {return React.createElement(LibraryX);}
      }]
    });
  };
  if (!reg()) document.addEventListener("DOMContentLoaded", reg, { once: true });
})();

Object.assign(window, { LibraryX });
})();
