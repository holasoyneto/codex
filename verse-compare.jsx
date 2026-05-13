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
    () => Array.from(new Set([primary, ...allTrans.map(t => t.id)])).slice(0, 12),
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
    return () => { cancelled = true; };
  }, [selectedTrans, passage.bookId, passage.chapter]);

  // ESC closes
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const addAdjacent = (delta) => {
    setVerses(prev => {
      const all = new Set(prev);
      const base = delta > 0 ? Math.max(...prev) : Math.min(...prev);
      const next = base + delta;
      if (next < 1) return prev;
      all.add(next);
      return [...all].sort((a, b) => a - b);
    });
  };

  const removeVerse = (n) => setVerses(prev => prev.length > 1 ? prev.filter(x => x !== n) : prev);
  const toggleTrans = (id) => {
    setSelectedTrans(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const verseText = (tId, n) => {
    const k = `${passage.bookId}.${passage.chapter}.${tId}`;
    const ch = chapters[k];
    if (!ch) return { loading: true };
    if (ch.error) return { error: ch.error };
    const v = ch.find?.(x => x.n === n);
    return v ? { text: v.text || v[tId] || "" } : { text: "—" };
  };

  return (
    <div className="cx-cmp-backdrop" onClick={onClose} role="dialog" aria-label="Verse comparison">
      <div className="cx-cmp" onClick={e => e.stopPropagation()}>
        <span className="cx-corner cx-tl" />
        <span className="cx-corner cx-tr" />
        <span className="cx-corner cx-bl" />
        <span className="cx-corner cx-br" />

        <header className="cx-cmp-h">
          <span className="cx-cmp-h-tag">CODEX · COMPARE</span>
          <span className="cx-cmp-h-ref">{passage.book} {passage.chapter}:{verses.join(",")}</span>
          <button className="cx-cmp-x" onClick={onClose} aria-label="Close" title="Close (ESC)">×</button>
        </header>

        <div className="cx-cmp-toolbar">
          <button className="cx-cmp-tool" onClick={() => addAdjacent(-1)} title="Add the previous verse">+ V−1</button>
          <button className="cx-cmp-tool" onClick={() => addAdjacent(+1)} title="Add the next verse">+ V+1</button>
          <span className="cx-cmp-vlist">
            {verses.map(n => (
              <span key={n} className="cx-cmp-vchip">
                v{n}
                {verses.length > 1 ? <button onClick={() => removeVerse(n)} title="Remove this verse">×</button> : null}
              </span>
            ))}
          </span>
          <div className="cx-cmp-trans-picker">
            <button
              className="cx-cmp-tool"
              onClick={() => setPickerOpen(o => !o)}
              title="Choose which translations to include"
            >
              {selectedTrans.length} translations ▾
            </button>
            {pickerOpen ? (
              <div className="cx-cmp-trans-menu" onMouseLeave={() => setPickerOpen(false)}>
                <div className="cx-cmp-trans-h">SHOW · TRANSLATIONS</div>
                {allTrans.map(t => (
                  <label key={t.id} className="cx-cmp-trans-row">
                    <input
                      type="checkbox"
                      checked={selectedTrans.includes(t.id)}
                      onChange={() => toggleTrans(t.id)}
                    />
                    <span className="cx-cmp-trans-glyph">{t.glyph}</span>
                    <span className="cx-cmp-trans-name"><b>{t.name}</b><i>{t.year} · {t.lang}</i></span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="cx-cmp-body">
          <table className="cx-cmp-table">
            <thead>
              <tr>
                <th className="cx-cmp-th-v">V</th>
                {selectedTrans.map(tId => {
                  const meta = data.translations.find(t => t.id === tId);
                  return (
                    <th key={tId} className="cx-cmp-th">
                      <span className="cx-cmp-th-name">{meta?.name || tId}</span>
                      <span className="cx-cmp-th-meta">{meta?.year} · {meta?.lang}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {verses.map(n => (
                <tr key={n}>
                  <td className="cx-cmp-td-v">{n}</td>
                  {selectedTrans.map(tId => {
                    const r = verseText(tId, n);
                    return (
                      <td key={tId} className="cx-cmp-td">
                        {r.loading ? <span className="cx-cmp-td-l">loading…</span>
                          : r.error ? <span className="cx-cmp-td-e">{r.error}</span>
                          : <span>{r.text}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { VerseCompare });
