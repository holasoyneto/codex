// CODEX — Library panel
// "Simplicity is the ultimate sophistication."
//
// One typographic list. 66 books, two typographic dividers, an instant filter
// that vanishes when empty. Click a book — its chapter strip lifts in beneath
// it; click another, the first retracts. No carets, no badges, no nested
// sections. The current book sits highlighted with its current chapter shown
// as "31 / 50" so you always know where you are.

function Library({ activeBookId, activeChapter, onSelectChapter }) {
  const data = window.CODEX_DATA;
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(activeBookId);
  const scrollRef = useRef(null);
  const openRowRef = useRef(null);
  // Track whether the last openId change came from an external activeBookId
  // change (nav arrows etc.) so we only auto-scroll then. User taps should
  // expand in place — no jumping the viewport.
  const externalChange = useRef(true); // first paint counts as external

  // Whenever the active book changes from outside (e.g. nav arrows), keep the
  // open one in sync so the chapter strip follows naturally.
  useEffect(() => {
    externalChange.current = true;
    setOpenId(activeBookId);
  }, [activeBookId]);

  // Scroll the open book into view ONLY when the change came from outside.
  useEffect(() => {
    if (!externalChange.current) return;
    externalChange.current = false;
    if (!openRowRef.current || !scrollRef.current) return;
    const row = openRowRef.current;
    const box = scrollRef.current;
    const rT = row.offsetTop;
    const rB = rT + row.offsetHeight;
    if (rT < box.scrollTop + 8 || rB > box.scrollTop + box.clientHeight - 8) {
      box.scrollTo({ top: rT - 60, behavior: "smooth" });
    }
  }, [openId]);

  const match = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return null;
    return new Set(data.books
      .filter(b => b.name.toLowerCase().includes(needle) || b.id.includes(needle))
      .map(b => b.id));
  }, [q, data.books]);

  const ot = useMemo(() => data.books.filter(b => b.testament === "OT"), [data.books]);
  const nt = useMemo(() => data.books.filter(b => b.testament === "NT"), [data.books]);

  const renderBook = (b) => {
    if (match && !match.has(b.id)) return null;
    const isActive = b.id === activeBookId;
    const isOpen   = b.id === openId;
    return (
      <div key={b.id} className="cx-lib-book" ref={isOpen ? openRowRef : null}>
        <button
          className="cx-lib-row"
          data-active={isActive ? "true" : "false"}
          data-open={isOpen ? "true" : "false"}
          onClick={() => setOpenId(isOpen ? null : b.id)}
        >
          <span className="cx-lib-name">{b.name}</span>
          <span className="cx-lib-meta">
            {isActive ? `${activeChapter} / ${b.chapters}` : b.chapters}
          </span>
        </button>
        {isOpen ? (
          <div className="cx-lib-chs" role="group" aria-label={`${b.name} chapters`}>
            {Array.from({ length: b.chapters }, (_, i) => i + 1).map(ch => (
              <button
                key={ch}
                className="cx-lib-ch"
                data-active={isActive && ch === activeChapter ? "true" : "false"}
                onClick={() => onSelectChapter(b.id, ch)}
                aria-label={`${b.name} chapter ${ch}`}
              >{ch}</button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  const otShown = ot.filter(b => !match || match.has(b.id));
  const ntShown = nt.filter(b => !match || match.has(b.id));
  const total   = (match ? match.size : 66);

  return (
    <div className="cx-lib">
      <div className="cx-lib-search">
        <input
          type="text"
          placeholder={(window.t && window.t("lib.find")) || "Find a book…"}
          value={q}
          onChange={e => setQ(e.target.value)}
          aria-label="Find a book"
          spellCheck={false}
        />
        {q ? (
          <button className="cx-lib-clear" onClick={() => setQ("")} aria-label="Clear">×</button>
        ) : (
          <span className="cx-lib-count">{total}</span>
        )}
      </div>

      <div className="cx-lib-scroll" ref={scrollRef}>
        {otShown.length > 0 ? <h3 className="cx-lib-h">{(window.t && window.t("lib.ot")) || "The Old Testament"}</h3> : null}
        {otShown.map(renderBook)}
        {ntShown.length > 0 ? <h3 className="cx-lib-h">{(window.t && window.t("lib.nt")) || "The New Testament"}</h3> : null}
        {ntShown.map(renderBook)}
        {otShown.length === 0 && ntShown.length === 0 ? (
          <p className="cx-lib-empty">{(window.t && window.t("lib.empty")) || "No book by that name."}</p>
        ) : null}
      </div>
    </div>
  );
}

Object.assign(window, { Library });
