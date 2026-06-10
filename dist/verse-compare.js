// GENERATED from verse-compare.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
// CODEX — verse compare · side-by-side reading of one verse across every
// translation. Reachable from the verse menu (COMPARE) or from the bottom
// toolbar of the modal where the user can add adjacent verses.
//
// All translations are filterable via the dropdown at top. Verses load from
// BIBLE.loadChapter on demand and are cached, so reopening the same compare
// modal is instant — and offline-safe once the chapters are downloaded.

function VerseCompare({ verse, refStr, passage, primary, onClose }) {
  const data = window.CODEX_DATA;
  const allTrans = data.translations;
  const initialIds = useMemo(
    () => Array.from(new Set([primary, ...allTrans.map((t) => t.id)])).slice(0, 12),
    [primary, allTrans]
  );
  const [selectedTrans, setSelectedTrans] = useState(initialIds);
  const [verses, setVerses] = useState([verse?.n || 1]);
  const [chapters, setChapters] = useState({}); // { trId: { 'jhn.1': verses[] } }
  const [pickerOpen, setPickerOpen] = useState(false);

  // Pull each selected translation's chapter on demand
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = { ...chapters };
      for (const tId of selectedTrans) {
        const k = `${passage.bookId}.${passage.chapter}.${tId}`;
        if (next[k]) continue;
        try {
          const v = await window.BIBLE.loadChapter(passage.bookId, passage.chapter, tId);
          if (cancelled) return;
          next[k] = v;
          setChapters({ ...next });
        } catch (e) {
          next[k] = { error: String(e.message || e) };
          setChapters({ ...next });
        }
      }
    })();
    return () => {cancelled = true;};
  }, [selectedTrans, passage.bookId, passage.chapter]);

  // ESC closes
  useEffect(() => {
    const onKey = (e) => {if (e.key === "Escape") onClose();};
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const addAdjacent = (delta) => {
    setVerses((prev) => {
      const all = new Set(prev);
      const base = delta > 0 ? Math.max(...prev) : Math.min(...prev);
      const next = base + delta;
      if (next < 1) return prev;
      all.add(next);
      return [...all].sort((a, b) => a - b);
    });
  };

  const removeVerse = (n) => setVerses((prev) => prev.length > 1 ? prev.filter((x) => x !== n) : prev);
  const toggleTrans = (id) => {
    setSelectedTrans((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const verseText = (tId, n) => {
    const k = `${passage.bookId}.${passage.chapter}.${tId}`;
    const ch = chapters[k];
    if (!ch) return { loading: true };
    if (ch.error) return { error: ch.error };
    const v = ch.find?.((x) => x.n === n);
    return v ? { text: v.text || v[tId] || "" } : { text: "—" };
  };

  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-cmp-backdrop", onClick: onClose, role: "dialog", "aria-label": "Verse comparison" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-cmp", onClick: (e) => e.stopPropagation() }, /*#__PURE__*/
    React.createElement("span", { className: "cx-corner cx-tl" }), /*#__PURE__*/
    React.createElement("span", { className: "cx-corner cx-tr" }), /*#__PURE__*/
    React.createElement("span", { className: "cx-corner cx-bl" }), /*#__PURE__*/
    React.createElement("span", { className: "cx-corner cx-br" }), /*#__PURE__*/

    React.createElement("header", { className: "cx-cmp-h" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-cmp-h-tag" }, "CODEX \xB7 COMPARE"), /*#__PURE__*/
    React.createElement("span", { className: "cx-cmp-h-ref" }, passage.book, " ", passage.chapter, ":", verses.join(",")), /*#__PURE__*/
    React.createElement("button", { className: "cx-cmp-x", onClick: onClose, "aria-label": "Close", title: "Close (ESC)" }, "\xD7")
    ), /*#__PURE__*/

    React.createElement("div", { className: "cx-cmp-toolbar" }, /*#__PURE__*/
    React.createElement("button", { className: "cx-cmp-tool", onClick: () => addAdjacent(-1), title: "Add the previous verse" }, "+ V\u22121"), /*#__PURE__*/
    React.createElement("button", { className: "cx-cmp-tool", onClick: () => addAdjacent(+1), title: "Add the next verse" }, "+ V+1"), /*#__PURE__*/
    React.createElement("span", { className: "cx-cmp-vlist" },
    verses.map((n) => /*#__PURE__*/
    React.createElement("span", { key: n, className: "cx-cmp-vchip" }, "v",
    n,
    verses.length > 1 ? /*#__PURE__*/React.createElement("button", { onClick: () => removeVerse(n), title: "Remove this verse" }, "\xD7") : null
    )
    )
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-cmp-trans-picker" }, /*#__PURE__*/
    React.createElement("button", {
      className: "cx-cmp-tool",
      onClick: () => setPickerOpen((o) => !o),
      title: "Choose which translations to include" },

    selectedTrans.length, " translations \u25BE"
    ),
    pickerOpen ? /*#__PURE__*/
    React.createElement("div", { className: "cx-cmp-trans-menu", onMouseLeave: () => setPickerOpen(false) }, /*#__PURE__*/
    React.createElement("div", { className: "cx-cmp-trans-h" }, "SHOW \xB7 TRANSLATIONS"),
    allTrans.map((t) => /*#__PURE__*/
    React.createElement("label", { key: t.id, className: "cx-cmp-trans-row" }, /*#__PURE__*/
    React.createElement("input", {
      type: "checkbox",
      checked: selectedTrans.includes(t.id),
      onChange: () => toggleTrans(t.id) }
    ), /*#__PURE__*/
    React.createElement("span", { className: "cx-cmp-trans-glyph" }, t.glyph), /*#__PURE__*/
    React.createElement("span", { className: "cx-cmp-trans-name" }, /*#__PURE__*/React.createElement("b", null, t.name), /*#__PURE__*/React.createElement("i", null, t.year, " \xB7 ", t.lang))
    )
    )
    ) :
    null
    )
    ), /*#__PURE__*/

    React.createElement("div", { className: "cx-cmp-body" }, /*#__PURE__*/
    React.createElement("table", { className: "cx-cmp-table" }, /*#__PURE__*/
    React.createElement("thead", null, /*#__PURE__*/
    React.createElement("tr", null, /*#__PURE__*/
    React.createElement("th", { className: "cx-cmp-th-v" }, "V"),
    selectedTrans.map((tId) => {
      const meta = data.translations.find((t) => t.id === tId);
      return (/*#__PURE__*/
        React.createElement("th", { key: tId, className: "cx-cmp-th" }, /*#__PURE__*/
        React.createElement("span", { className: "cx-cmp-th-name" }, meta?.name || tId), /*#__PURE__*/
        React.createElement("span", { className: "cx-cmp-th-meta" }, meta?.year, " \xB7 ", meta?.lang)
        ));

    })
    )
    ), /*#__PURE__*/
    React.createElement("tbody", null,
    verses.map((n) => /*#__PURE__*/
    React.createElement("tr", { key: n }, /*#__PURE__*/
    React.createElement("td", { className: "cx-cmp-td-v" }, n),
    selectedTrans.map((tId) => {
      const r = verseText(tId, n);
      return (/*#__PURE__*/
        React.createElement("td", { key: tId, className: "cx-cmp-td" },
        r.loading ? /*#__PURE__*/React.createElement("span", { className: "cx-cmp-td-l" }, "loading\u2026") :
        r.error ? /*#__PURE__*/React.createElement("span", { className: "cx-cmp-td-e" }, r.error) : /*#__PURE__*/
        React.createElement("span", null, r.text)
        ));

    })
    )
    )
    )
    )
    )
    )
    ));

}

Object.assign(window, { VerseCompare });
})();
