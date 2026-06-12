// CODEX — marks-plugin.jsx · v10 THE MARKS — pulled out of the library and
// rebuilt as its own plugin (sys-marks).
//
// A mark IS a highlight (one schema: codex.highlights.v1, pins in
// codex.marks.pinned.v1 — both untouched). The rebuilt surface:
//   · pinned marks float to the top under a ⌖ PINNED divider
//   · each mark: color bar · ref · first words · age — click jumps
//   · ⌖ pin/unpin and × forget, inline (one gesture deep)
//   · live: every change re-broadcasts codex:marks-changed so the reader
//     tints rows and the app reloads its copy without a reboot.

const MARKS_KEY = "codex.highlights.v1";
const MARKS_PINS_KEY = "codex.marks.pinned.v1";
const MARKS_HUES = {
  amber: "#ffd479", rose: "#ff8291", mint: "#5bd0b0",
  violet: "#b88cff", cyan: "#7ee0ff", gold: "#ffd479",
};

function marksLoad() {
  try { return JSON.parse(localStorage.getItem(MARKS_KEY) || "{}"); } catch { return {}; }
}
function marksPins() {
  try { return new Set(JSON.parse(localStorage.getItem(MARKS_PINS_KEY) || "[]")); } catch { return new Set(); }
}
function marksSave(map) {
  try { localStorage.setItem(MARKS_KEY, JSON.stringify(map)); } catch {}
  try { window.dispatchEvent(new CustomEvent("codex:marks-changed")); } catch {}
}
function marksSavePins(set) {
  try { localStorage.setItem(MARKS_PINS_KEY, JSON.stringify([...set])); } catch {}
  try { window.dispatchEvent(new CustomEvent("codex:marks-changed")); } catch {}
}
function marksAgo(ts) {
  if (!ts) return "";
  const d = (Date.now() - ts) / 1000;
  if (d < 3600) return `${Math.max(1, Math.floor(d / 60))}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  if (d < 86400 * 30) return `${Math.floor(d / 86400)}d`;
  return new Date(ts).toLocaleDateString();
}

function MarksX() {
  const [map, setMap] = useState(marksLoad);
  const [pins, setPins] = useState(marksPins);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const reload = () => { setMap(marksLoad()); setPins(marksPins()); };
    window.addEventListener("codex:marks-changed", reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("codex:marks-changed", reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const books = (window.CODEX_DATA && window.CODEX_DATA.books) || [];
  const labelOf = (key) => {
    const [bookId, ch, v] = key.split(".");
    const b = books.find(x => x.id === bookId);
    return `${(b && b.name) || bookId} ${ch}:${v}`;
  };

  const rows = Object.entries(map)
    .map(([key, m]) => ({ key, label: labelOf(key), ...m, pinned: pins.has(key) }))
    .filter(r => !filter || r.label.toLowerCase().includes(filter.toLowerCase()) || (r.note || "").toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => (b.pinned - a.pinned) || ((b.ts || 0) - (a.ts || 0)));
  const pinnedRows = rows.filter(r => r.pinned);
  const restRows = rows.filter(r => !r.pinned);

  const jump = (r) => { if (window.codexJumpToRef) window.codexJumpToRef(r.label); };
  const togglePin = (r) => {
    const next = new Set(pins);
    if (next.has(r.key)) next.delete(r.key); else next.add(r.key);
    setPins(next); marksSavePins(next);
  };
  const forget = (r) => {
    const next = { ...map }; delete next[r.key];
    setMap(next); marksSave(next);
    if (pins.has(r.key)) { const np = new Set(pins); np.delete(r.key); setPins(np); marksSavePins(np); }
  };

  const renderRow = (r) => (
    <div key={r.key} className="cxm-row" role="listitem">
      <span className="cxm-bar" style={{ background: MARKS_HUES[r.color] || MARKS_HUES.amber }} aria-hidden />
      <button className="cxm-go" onClick={() => jump(r)} title={`Read ${r.label}`}>
        <b>{r.label}</b>
        {r.note ? <span>{r.note}</span> : null}
      </button>
      <span className="cxm-age">{marksAgo(r.ts)}</span>
      <button className={`cxm-pin ${r.pinned ? "is-on" : ""}`} onClick={() => togglePin(r)}
        aria-pressed={r.pinned} title={r.pinned ? "Unpin" : "Pin to the top"}>⌖</button>
      <button className="cxm-x" onClick={() => forget(r)} aria-label={`Forget ${r.label}`} title="Forget this mark">×</button>
    </div>
  );

  return (
    <div className="cxm">
      <div className="cxm-head">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Filter ${rows.length} mark${rows.length === 1 ? "" : "s"}…`}
          aria-label="Filter marks"
          spellCheck={false}
        />
        <button
          className="cxm-add"
          title="Mark the current verse"
          onClick={() => {
            const n = window.CODEX_NOW;
            if (!n || !n.bookId) return;
            const key = `${n.bookId}.${n.chapter}.${n.verse || 1}`;
            const next = { ...marksLoad() };
            if (next[key]) delete next[key];
            else next[key] = { color: (window.CODEX_DATA?.tweaks?.highlightColor) || "amber", ts: Date.now(), note: "" };
            setMap(next); marksSave(next);
          }}
        >✦ MARK {window.CODEX_NOW && window.CODEX_NOW.ref ? window.CODEX_NOW.ref : "HERE"}</button>
      </div>
      <div className="cxm-scroll" role="list" aria-label="Your marks">
        {pinnedRows.length ? <h3 className="cxm-h">⌖ PINNED</h3> : null}
        {pinnedRows.map(renderRow)}
        {pinnedRows.length && restRows.length ? <h3 className="cxm-h">EVERYTHING</h3> : null}
        {restRows.map(renderRow)}
        {!rows.length ? (
          <div className="cxm-empty">
            <span aria-hidden>✦</span>
            <p>No marks yet. Tap a verse number in the reader, or ✦ MARK above — your trail through the text starts here.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

(function registerMarksPlugin() {
  if (typeof window === "undefined") return;
  const reg = () => {
    if (!window.CODEX_PLUGINS_API) return false;
    return window.CODEX_PLUGINS_API.register({
      id: "sys-marks",
      name: "The Marks",
      version: "10.0.0",
      panels: [{
        id: "marks",
        label: "MARKS",
        glyph: "⌖",
        render() { return React.createElement(MarksX); },
      }],
    });
  };
  if (!reg()) document.addEventListener("DOMContentLoaded", reg, { once: true });
})();

Object.assign(window, { MarksX });
