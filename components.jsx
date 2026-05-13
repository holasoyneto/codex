// CODEX — components for the sci-fi bible-study terminal.
// Loaded after React + Babel + data.js + tweaks-panel.jsx.

const { useState, useEffect, useMemo, useRef, useCallback } = React;

// Local i18n shortcut — falls back to the key itself.
function tx(k) { return (window.t && window.t(k)) || k; }

// ─────────────────────────────────────────────────────────────────────────────
// Time + theme synchronisation
// ─────────────────────────────────────────────────────────────────────────────

// Approximate solar position from the user's local time — no API calls.
// Returns { phase: 'night'|'dawn'|'day'|'dusk', t01: 0-1, sunPct: 0-100 (sky), label }
function useSolarClock(autoTheme, manualDark) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const solar = useMemo(() => {
    const h = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
    // Civil bands (rough, location-agnostic).
    let phase = "day";
    if (h < 5) phase = "night";
    else if (h < 7) phase = "dawn";
    else if (h < 18) phase = "day";
    else if (h < 20) phase = "dusk";
    else phase = "night";

    // 0 at midnight → 1 just before next midnight, for the sky arc.
    const t01 = h / 24;
    // Sun height as % of sky (0 at horizon, 100 at noon) — sin curve 6–18.
    const sunPct = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI)) * 100;

    const labels = { night: "NOCT", dawn: "AURO", day: "DIES", dusk: "VESP" };
    return { phase, t01, sunPct, label: labels[phase], hour: h };
  }, [now]);

  const dark = autoTheme ? (solar.phase === "night" || solar.phase === "dusk") : manualDark;

  return { now, solar, dark };
}

function pad(n) { return String(n).padStart(2, "0"); }

function fmtClock(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function fmtDate(d) {
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Visual primitives
// ─────────────────────────────────────────────────────────────────────────────

function CornerFrame({ children, className = "", label, glow = false }) {
  return (
    <div className={`cx-frame ${glow ? "is-glow" : ""} ${className}`}>
      <span className="cx-corner cx-tl" />
      <span className="cx-corner cx-tr" />
      <span className="cx-corner cx-bl" />
      <span className="cx-corner cx-br" />
      {label ? <span className="cx-frame-label">{label}</span> : null}
      {children}
    </div>
  );
}

function Pill({ children, dim, accent }) {
  return (
    <span className={`cx-pill ${dim ? "is-dim" : ""} ${accent ? "is-accent" : ""}`}>
      {children}
    </span>
  );
}

function Tick({ children, className = "" }) {
  return <span className={`cx-tick ${className}`}>{children}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Header / status bar
// ─────────────────────────────────────────────────────────────────────────────

function PrimaryDropdown({ primary, onSelectPrimary }) {
  const data = window.CODEX_DATA;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function onDoc(e){ if(ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const cur = data.translations.find(x => x.id === primary) || data.translations[0];
  return (
    <div className={`cx-pdd ${open?"is-open":""}`} ref={ref}>
      <button className="cx-pdd-btn" onClick={() => setOpen(o => !o)}>
        <span className="cx-pdd-glyph">{cur.glyph}</span>
        <span className="cx-pdd-name">{cur.name}</span>
        <span className="cx-pdd-meta">{cur.year}·{cur.lang}</span>
        <span className="cx-pdd-caret">▾</span>
      </button>
      {open ? (
        <div className="cx-pdd-menu">
          <div className="cx-pdd-h">PRIMARY · TRANSLATION</div>
          {data.translations.map(t => (
            <button
              key={t.id}
              className={`cx-pdd-item ${t.id === primary ? "is-on" : ""}`}
              onClick={() => { onSelectPrimary(t.id); setOpen(false); }}
            >
              <span className="cx-pdd-glyph">{t.glyph}</span>
              <span className="cx-pdd-item-id">
                <b>{t.name}</b>
                <i>{t.year} · {t.license} · {t.lang}</i>
              </span>
              {t.id === primary ? <span className="cx-pdd-check">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Side quests · gamified guided study plans ──────────────────────────
// Empty registry by default — host can push entries via window.CODEX_QUESTS
// or via a registerQuest({id, title, blurb, run}) call. Persisted progress
// lives in localStorage so quests survive reloads.
function SideQuestsButton() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef(null);
  const menuRef = useRef(null);
  // Read live so quests installed at runtime appear on next open.
  const quests = window.CODEX_QUESTS || [];
  // The status bar uses overflow-x: hidden which clips an absolute-
  // positioned dropdown. Solve by portalling the menu to <body> and
  // computing its fixed coords from the trigger button.
  useEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const menuW = Math.min(360, window.innerWidth - 24);
    let left = r.left;
    if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
    setPos({ top: r.bottom + 8, left });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey  = (e) => { if (e.key === "Escape") setOpen(false); };
    const t = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    document.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <span className="cx-sq" ref={ref}>
      <button
        className={`cx-sq-trigger ${open ? "is-open" : ""}`}
        onClick={() => setOpen(o => !o)}
        title="Side quests · gamified study plans"
        aria-label="Side quests"
        aria-expanded={open}
      >
        <span className="cx-sq-glyph">⚔</span>
        <span className="cx-sq-lbl">QUESTS</span>
      </button>
      {open ? ReactDOM.createPortal(
        <div className="cx-sq-menu" role="dialog" ref={menuRef}
             style={{ top: pos.top + "px", left: pos.left + "px" }}>
          <header className="cx-sq-h">
            <span className="cx-sq-tag">SIDE · QUESTS</span>
          </header>
          {quests.length === 0 ? (
            <div className="cx-sq-empty">
              <p className="cx-sq-empty-h">No quests installed yet.</p>
              <p className="cx-sq-empty-sub">
                Side quests are guided, gamified study plans — short tours of
                a book, a doctrine, a translation comparison. They steer you
                through the app step-by-step, like a missionary chaplain
                walking you through scripture.
              </p>
              <p className="cx-sq-empty-foot">
                Bring a quest prompt and I'll install it here.
              </p>
            </div>
          ) : (
            <ul className="cx-sq-list">
              {quests.map(q => (
                <li key={q.id} className="cx-sq-item">
                  <button className="cx-sq-card" onClick={() => { setOpen(false); q.run?.(); }}>
                    <span className="cx-sq-card-glyph">{q.glyph || "✦"}</span>
                    <div className="cx-sq-card-body">
                      <b>{q.title}</b>
                      {q.blurb ? <i>{q.blurb}</i> : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>,
        document.body
      ) : null}
    </span>
  );
}

function StatusBar({ now, solar, dark, autoTheme, onToggleTheme, onToggleAuto, bookmarkCount, gnosisOn, primary, onSelectPrimary, onToggleLeft, onToggleRight }) {
  return (
    <header className="cx-status">
      <div className="cx-status-l">
        <button className="cx-mobile-fab cx-status-fab" onClick={onToggleLeft} aria-label="Library">≣</button>
        <div className="cx-logo">
          <svg viewBox="0 0 32 32" className="cx-sigil cx-sigil-std" aria-hidden>
            <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="0.7" opacity=".7"/>
            <path d="M16 2 L16 30 M2 16 L30 16" stroke="currentColor" strokeWidth="0.6" opacity=".55"/>
            <path d="M16 6 L20 16 L16 26 L12 16 Z" fill="currentColor" opacity=".9"/>
            <circle cx="16" cy="16" r="1.6" fill="var(--cx-bg)"/>
          </svg>
          {/* Drift-mode sigil: equilateral triangle + all-seeing eye, with
              radiant strokes. CSS swaps which one is visible. */}
          <svg viewBox="0 0 32 32" className="cx-sigil cx-sigil-drift" aria-hidden>
            <path d="M16 3 L29 27 L3 27 Z" fill="none" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M16 3 L16 1 M29 27 L31 28.5 M3 27 L1 28.5" stroke="currentColor" strokeWidth="0.8" opacity=".7"/>
            <ellipse cx="16" cy="20" rx="7" ry="4" fill="none" stroke="currentColor" strokeWidth="1"/>
            <circle cx="16" cy="20" r="2.2" fill="currentColor"/>
            <circle cx="16" cy="20" r="0.7" fill="var(--cx-bg)"/>
            <path d="M5 20 L1.5 18 M27 20 L30.5 18 M16 12 L16 8" stroke="currentColor" strokeWidth="0.7" opacity=".55"/>
          </svg>
          <div className="cx-logo-txt">
            <b className="cx-logo-name"><span className="cx-logo-std">CODEX</span><span className="cx-logo-drift">CODƎX</span></b>
            <span className="cx-logo-sub"><span className="cx-logo-std">NEW.WORLD STUDY · v4.12</span><span className="cx-logo-drift">VEILED.GLYPH · NIHIL OBSTAT</span></span>
          </div>
        </div>

        <div className="cx-status-sep cx-hide-narrow" />

        <SideQuestsButton />

        {/* Primary translation dropdown removed from the status bar — the
            same control lives in the right-rail Translations panel where
            it has full context (year, language, compare toggle, offline
            status) and doesn't compete for status-bar real estate. */}

        <Tick className="cx-hide-narrow">BMK&nbsp;<b>{pad(bookmarkCount)}</b></Tick>
      </div>

      <div className="cx-status-c cx-hide-narrow">
        <SunStrip solar={solar} />
      </div>

      <div className="cx-status-r">
        <div className="cx-clock">
          <span className="cx-clock-time">{fmtClock(now)}</span>
          <span className="cx-clock-date">{fmtDate(now)} · LOCAL · {solar.label}</span>
        </div>

        <button
          className={`cx-themebtn ${dark ? "is-dark" : "is-light"} ${autoTheme ? "is-auto" : ""}`}
          onClick={onToggleTheme}
          aria-label={dark ? "Switch to day theme" : "Switch to night theme"}
          title={autoTheme ? `Auto · ${dark ? "night" : "day"}` : (dark ? "Night" : "Day")}
        >
          {/* Subtle crescent ↔ disc — pure SVG, no glow chip, no label */}
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            {dark ? (
              <path d="M11 2.5a5.5 5.5 0 1 0 2.5 4.7 4 4 0 0 1-2.5-4.7z"
                    fill="currentColor" />
            ) : (
              <g>
                <circle cx="8" cy="8" r="3" fill="currentColor" />
                <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                  <line x1="8" y1="1.5" x2="8" y2="3" />
                  <line x1="8" y1="13" x2="8" y2="14.5" />
                  <line x1="1.5" y1="8" x2="3" y2="8" />
                  <line x1="13" y1="8" x2="14.5" y2="8" />
                  <line x1="3.4" y1="3.4" x2="4.5" y2="4.5" />
                  <line x1="11.5" y1="11.5" x2="12.6" y2="12.6" />
                  <line x1="3.4" y1="12.6" x2="4.5" y2="11.5" />
                  <line x1="11.5" y1="4.5" x2="12.6" y2="3.4" />
                </g>
              </g>
            )}
          </svg>
        </button>
        <button
          className={`cx-autobtn ${autoTheme ? "is-on" : ""}`}
          onClick={onToggleAuto}
          title="Auto-sync theme with local sun"
        >
          AUTO
        </button>
      </div>
    </header>
  );
}

function SunStrip({ solar }) {
  // Show a 24h strip with markers for now + day/night bands.
  const nowPct = solar.t01 * 100;
  return (
    <div className="cx-sun">
      <div className="cx-sun-bar">
        <div className="cx-sun-night" style={{ left: 0, width: `${(5/24)*100}%` }} />
        <div className="cx-sun-dawn" style={{ left: `${(5/24)*100}%`, width: `${(2/24)*100}%` }} />
        <div className="cx-sun-day" style={{ left: `${(7/24)*100}%`, width: `${(11/24)*100}%` }} />
        <div className="cx-sun-dusk" style={{ left: `${(18/24)*100}%`, width: `${(2/24)*100}%` }} />
        <div className="cx-sun-night" style={{ left: `${(20/24)*100}%`, width: `${(4/24)*100}%` }} />
        {[0,6,12,18,24].map(h => (
          <span key={h} className="cx-sun-tick" style={{ left: `${(h/24)*100}%` }}>{pad(h)}</span>
        ))}
        <div className="cx-sun-cursor" style={{ left: `${nowPct}%` }}>
          <span className="cx-sun-cursor-dot" />
        </div>
      </div>
      <div className="cx-sun-meta">
        <span>SOL · {Math.round(solar.sunPct)}%</span>
        <span>PHASE · {solar.phase.toUpperCase()}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Left rail · books + bookmarks
// ─────────────────────────────────────────────────────────────────────────────

// ─── Collapsible book section with chapter grid ──────────────────────────────
function BookSection({ title, books, activeBookId, activeChapter, onSelectChapter, query }) {
  const [open, setOpen] = useState(true);
  const [openBookId, setOpenBookId] = useState(activeBookId || null);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return books;
    return books.filter(b => b.name.toLowerCase().includes(q) || b.id.includes(q));
  }, [books, query]);

  return (
    <div className="cx-rail-section">
      <button className="cx-rail-h cx-rail-h-btn" onClick={() => setOpen(o => !o)}>
        <span className="cx-caret">{open ? "▾" : "▸"}</span>
        <span>{title}</span>
        <i>{filtered.length}</i>
      </button>
      {open ? (
        <ul className="cx-booklist">
          {filtered.length === 0 ? <li className="cx-booklist-empty">— no match —</li> : null}
          {filtered.map(b => {
            const isOpen = openBookId === b.id;
            return (
              <li key={b.id} className={`${b.id === activeBookId ? "is-active" : ""} ${isOpen ? "is-open" : ""}`}>
                <button className="cx-book-row" onClick={() => setOpenBookId(isOpen ? null : b.id)}>
                  <span className="cx-book-id">{b.id.toUpperCase()}</span>
                  <span className="cx-book-name">{b.name}</span>
                  <span className="cx-book-ch">{b.chapters}</span>
                  <span className="cx-caret cx-book-caret">{isOpen ? "▾" : "▸"}</span>
                </button>
                {isOpen ? (
                  <div className="cx-chgrid">
                    {Array.from({length: b.chapters}, (_, i) => i + 1).map(ch => (
                      <button
                        key={ch}
                        className={`cx-chcell ${b.id === activeBookId && ch === activeChapter ? "is-active" : ""}`}
                        onClick={() => onSelectChapter(b.id, ch)}
                      >{ch}</button>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

// ─── Mark row · click to open, swatch shows colour, × clears highlight ──────
function MarkRow({ mark, idx, onSelect, onClear, onTogglePin, swatch }) {
  const onClick = (e) => {
    if (e.target.closest(".cx-bm-del")) return;
    if (e.target.closest(".cx-bm-pin")) return;
    onSelect(mark);
  };
  // Compact relative timestamp
  const relTs = (() => {
    if (!mark.ts) return "";
    const diff = (Date.now() - mark.ts) / 1000;
    if (diff < 60)        return "just now";
    if (diff < 3600)      return `${Math.floor(diff/60)}m`;
    if (diff < 86400)     return `${Math.floor(diff/3600)}h`;
    if (diff < 86400*7)   return `${Math.floor(diff/86400)}d`;
    const d = new Date(mark.ts);
    return `${pad(d.getMonth()+1)}·${pad(d.getDate())}`;
  })();
  return (
    <li className={`cx-bm-li ${mark.pinned ? "is-pinned" : ""}`}>
      <div className="cx-bm-row" onClick={onClick}>
        <span
          className="cx-bm-swatch"
          style={swatch ? { background: swatch } : null}
          aria-hidden
          title={mark.color}
        />
        <div className="cx-bm-text">
          <span className="cx-bm-ref">{mark.ref}</span>
          {mark.note ? <span className="cx-bm-note">{mark.note}</span> : null}
        </div>
        <span className="cx-bm-ts">{relTs}</span>
        <button
          className={`cx-bm-pin ${mark.pinned ? "is-on" : ""}`}
          onClick={(e) => { e.stopPropagation(); onTogglePin?.(mark); }}
          title={mark.pinned ? "Unpin" : "Pin to top"}
          aria-label={mark.pinned ? "Unpin mark" : "Pin mark"}
          aria-pressed={!!mark.pinned}
        >
          <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden>
            {/* Tilted thumbtack — head as a small chord, slim shaft, point */}
            <g transform="rotate(-30 6 6)">
              <ellipse cx="6" cy="3.5" rx="2.6" ry="1.2" fill={mark.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="0.9" />
              <line x1="6" y1="4.6" x2="6" y2="9.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
              <line x1="4.5" y1="9.6" x2="7.5" y2="9.6" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
            </g>
          </svg>
        </button>
        <button
          className="cx-bm-del"
          onClick={(e) => { e.stopPropagation(); onClear(mark); }}
          title="Remove mark"
          aria-label="Remove mark"
        >×</button>
      </div>
    </li>
  );
}

function LeftRail({ activeBookId, activeChapter, marks = [], highlightColors, onSelectMark, onClearMark, onTogglePinMark, onMarkCurrent, onSelectChapter, currentRef, oracleProps, isCollapsed, onCollapse }) {
  const data = window.CODEX_DATA;
  const ot = useMemo(() => data.books.filter(b => b.testament === "OT"), [data.books]);
  const nt = useMemo(() => data.books.filter(b => b.testament === "NT"), [data.books]);
  const [tab, setTab] = useState("library");
  // ASK ORACLE from the verse menu fires "oracle:prefill". Switch to the
  // Oracle tab automatically so the user sees the prefilled question.
  useEffect(() => {
    const onPrefill = () => setTab("oracle");
    window.addEventListener("oracle:prefill", onPrefill);
    return () => window.removeEventListener("oracle:prefill", onPrefill);
  }, []);
  const [libQuery, setLibQuery] = useState("");
  const [bmQuery, setBmQuery] = useState("");

  const filteredMarks = useMemo(() => {
    const q = bmQuery.trim().toLowerCase();
    if (!q) return marks;
    return marks.filter(b =>
      (b.ref || "").toLowerCase().includes(q) ||
      (b.note || "").toLowerCase().includes(q) ||
      (b.color || "").toLowerCase().includes(q)
    );
  }, [marks, bmQuery]);

  const TABS = [
    { id: "library", label: tx("tab.library"), glyph: "📖", title: tx("tab.library.title") },
    { id: "oracle",  label: tx("tab.oracle"),  glyph: "◉",  title: tx("tab.oracle.title") },
    { id: "marks",   label: tx("tab.marks"),   glyph: "✦",  title: `${tx("marks")} (${marks.length})` },
  ];

  return (
    <aside className="cx-rail cx-rail-l">
      {window.LeftRailResizer ? <window.LeftRailResizer /> : null}
      {onCollapse ? (
        <button
          className="cx-rail-fold cx-rail-fold-l"
          onClick={onCollapse}
          title="Hide library (click the spine to bring it back)"
          aria-label="Collapse left rail"
        >◀</button>
      ) : null}
      <div className="cx-ltabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`cx-ltab ${tab === t.id ? "is-active" : ""}`}
            onClick={() => setTab(t.id)}
            title={t.title}
          >
            <span className="cx-ltab-glyph">{t.glyph}</span>
            <span className="cx-ltab-lbl">{t.label}</span>
            {t.id === "marks" && marks.length > 0 ? (
              <span className="cx-ltab-badge">{marks.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "library" ? (
        <CornerFrame label="LIBRARY" className="cx-rail-flex">
          {window.Library ? (
            <Library
              activeBookId={activeBookId}
              activeChapter={activeChapter}
              onSelectChapter={onSelectChapter}
            />
          ) : null}
        </CornerFrame>
      ) : null}

      {tab === "oracle" ? (
        <CornerFrame label="ORACLE · NEUTRAL" className="cx-rail-flex">
          {window.Oracle ? <Oracle {...oracleProps} /> : <div style={{padding:14,color:"var(--cx-fg-dim)"}}>Oracle loading…</div>}
        </CornerFrame>
      ) : null}

      {tab === "marks" ? (
        <CornerFrame label={`${tx("marks.tab")} · ${tx("marks")}`} className="cx-rail-flex">
          <div className="cx-bm-head">
            <span>{tx("marks.head")} · {pad(marks.length)}</span>
            <button className="cx-mini-btn" onClick={onMarkCurrent} title={tx("marks.add")}>{tx("marks.add")}</button>
          </div>
          <div className="cx-search">
            <span className="cx-search-icon">⌕</span>
            <input
              placeholder={tx("marks.search")}
              value={bmQuery}
              onChange={e => setBmQuery(e.target.value)}
            />
            {bmQuery ? <button className="cx-search-x" onClick={() => setBmQuery("")}>×</button> : null}
          </div>
          <ul className="cx-bm-list">
            {filteredMarks.length === 0 ? (
              <li className="cx-bm-empty">— {marks.length === 0 ? tx("marks.empty") : "no match"} —</li>
            ) : filteredMarks.map((m, i) => (
              <MarkRow
                key={m.key}
                mark={m}
                idx={i}
                onSelect={onSelectMark}
                onClear={onClearMark}
                onTogglePin={onTogglePinMark}
                swatch={highlightColors?.[m.color]?.swatch}
              />
            ))}
          </ul>
        </CornerFrame>
      ) : null}
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Centre · scripture reader
// ─────────────────────────────────────────────────────────────────────────────

// YHWH substitution — when active, swap English-translation conventions for
// the Hebrew names of God across every translation. Three rules:
//   LORD  (small-caps in print / all-caps in plain text) → יהוה  (Tetragrammaton)
//   GOD   (caps standalone)                              → אלהים (Elohim)
//   God   (mixed case — universally Elohim / Theos)      → אלהים (Elohim)
// We deliberately leave mixed-case "Lord" alone because in the NT it most
// often refers to Jesus / Adonai / generic kyrios, where substitution would
// misrepresent the source. "God" (mixed case) is consistently Elohim/Theos
// across both testaments, so substituting it is safe and makes the toggle
// visibly active on the most-read passages (Gen 1, Jn 1, etc.).
function applyYHWH(text, on) {
  if (!on || !text) return text;
  return text
    .replace(/\bLORD\b/g, "יהוה")
    .replace(/\bGOD\b/g,  "אלהים")
    .replace(/\bGod\b/g,  "אלהים");
}

// ── Golden Word · multi-alphabet divine-name detector ───────────────────
// Wraps the literal Tetragrammaton + Elohim + their cross-language
// equivalents in <span class="cx-divine"> so the golden shimmer fires
// regardless of script — Hebrew, Greek, Latin, Devanagari, the Romance
// translations' all-caps SEÑOR/HERR/SEIGNEUR/DOMINUS, Spanish "Jehová",
// Hindi "यहोवा", Greek "Κύριος", etc. Patterns are ordered longest-first
// so "the LORD God" doesn't get half-matched.
//
// `getGoldenWords` returns the matched substrings to feed into the same
// segment-wrap pass that handles red-letter + divineQuotes — guaranteed
// to compose cleanly with both, never paint over a Jesus quote.
const GOLDEN_WORD_PATTERNS = [
  // ── Hebrew (Tanakh) ──
  /יְ?הֹ?וָ?ה[ ֳָֻ֖֯]*/g,           // יהוה with optional niqqud / cantillation
  /אֱלֹהִים/g,
  /אֲדֹנָי/g,
  /יהוה/g,                             // bare consonantal Tetragrammaton (Aleppo)
  /אלהים/g,                            // bare consonantal Elohim
  /אדני/g,                             // bare consonantal Adonai
  // ── Greek (LXX / NT) — Unicode-aware (`u` flag), surrounded by anything
  // that's not a Letter. Source-code Greek literals are .normalize("NFC")
  // ed at the call site so precomposed/decomposed accents both match.
  /(?<![\p{L}])(?:Κύριος|ΚΥΡΙΟΣ|κύριος|κυρίου)(?![\p{L}])/gu,
  /(?<![\p{L}])(?:Θεός|Θεὸς|θεός|θεὸς|θεοῦ|θεῷ|Θεόν|θεόν|ΘΕΟΣ)(?![\p{L}])/gu,
  // ── English ── all-caps (small-caps YHWH typographic convention) AND
  // capitalised-noun forms (most APIs strip the small-caps so the named
  // entity is what we have to match).
  /\bLORD\b|\bLord\b/g,
  /\bGOD\b|\bGod\b/g,
  /\bYahweh\b|\bYHWH\b|\bJehovah\b/g,
  // ── Spanish (RV all-caps SEÑOR / Jehová / capitalised Dios / Señor) ──
  /\bSEÑOR\b|\bSeñor\b/g,
  /\bDIOS\b|\bDios\b/g,
  /\bJehová\b|\bJehova\b/g,
  // ── French (Segond ÉTERNEL/l'Éternel/SEIGNEUR/Dieu) ──
  /\bÉTERNEL\b|\bÉternel\b/g,
  /\bSEIGNEUR\b|\bSeigneur\b/g,
  /\bDIEU\b|\bDieu\b/g,
  // ── German (Luther/Schlachter HERR/Herr/Gott) ──
  /\bHERR\b|\bHerr\b/g,
  /\bGOTT\b|\bGott\b/g,
  // ── Portuguese (Almeida SENHOR/Senhor/Deus) ──
  /\bSENHOR\b|\bSenhor\b/g,
  /\bDEUS\b|\bDeus\b/g,
  // ── Latin (Vulgate; mixed-case is canonical) ──
  /\bDominus\b|\bDOMINUS\b/g,
  /\bDeus\b|\bDEUS\b/g,
  // ── Hindi (Devanagari) ──
  /यहोवा/g,
  /परमेश्‍?वर/g,
];
function getGoldenWords(text) {
  if (!text) return [];
  // Normalize to NFC so the regex source (e.g. precomposed ό) matches
  // text variants that use combining diacritics — Greek source data
  // notoriously mixes the two.
  const norm = text.normalize ? text.normalize("NFC") : text;
  const out = new Set();
  for (const re of GOLDEN_WORD_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(norm)) !== null) {
      out.add(m[0]);
      if (re.lastIndex === m.index) re.lastIndex++;
    }
  }
  return [...out];
}

// Detect quoted divine speech across any translation. Looks for the common
// English attributions ("God said", "LORD said unto", "thus saith the LORD",
// "spake unto") and captures the quoted run that follows. Returns an array
// of substrings to mark with shimmer. This is applied AFTER red-letter so
// the two layers don't clash on Jesus's words (which already render red).
// Two attribution patterns to capture both modern (quoted) and KJV-style
// (comma + small caps ALL upper / Capitalised) divine-speech rendering.
//
//   modern: God said, "Let there be light"
//   KJV:    God said, Let there be light: and there was light.
//
// In both cases we anchor on the actor + a "speaking" verb, then scan
// forward to the next clause-terminator. For YHWH-substituted text the
// actor may be the literal Hebrew glyphs יהוה or אלהים.
const DIVINE_ACTOR = "(?:(?:and\\s+)?God|the\\s+(?:LORD|Lord|L[Oo][Rr][Dd])|the\\s+Lord\\s+God|Yahweh|Yhwh|Adonai|Elohim|יהוה|אלהים)";
const DIVINE_VERB  = "(?:said|saith|spake|spoke|answered|commanded|replied|declared|promised|called|cried)";
// Quoted form
const DIVINE_QUOTED   = new RegExp(`\\b${DIVINE_ACTOR}\\s+(?:also\\s+|then\\s+|unto[^,"]{1,40},\\s*)?${DIVINE_VERB}\\b[^"'""]{0,40}["'""]([^"'""]{4,400})["'""]`, "g");
const DIVINE_KJV  = new RegExp(`\\b${DIVINE_ACTOR}\\s+(?:also\\s+|then\\s+)?${DIVINE_VERB}(?:\\s+unto\\s+[A-Z][a-zA-Z']{1,18})?,\\s+([A-Z][^.;:]{6,400}?)(?=[.;:]|$)`, "g");

// ── Multi-language divine-speech patterns ────────────────────────────────
// Each tuple: { actor, verb } substrings the language uses for "[divine
// name] said". After matching the attribution, we capture either a quoted
// run (",") or the rest of the verse up to a sentence-ending punctuation.
// Quote variants accepted: " " ' ' « » " " ' ' ¿ ¡ ։ ׃
const QUOTE_OPEN  = `["'"'«¿¡]`;
const QUOTE_CLOSE = `["'"'»?!.]`;
const SENTENCE_END = `[.;:?!·։׃]`;
const LANG_ATTRIBUTIONS = [
  // Spanish
  { name: "es", re: /\b(?:Dios|Jehová|Jehova|el SEÑOR|el Señor|Yahweh)\s+(?:le\s+)?(?:dijo|habló|respondió|preguntó|prometió|llamó|ordenó|declaró|exclamó)\b\s*[:,]?\s*[«"'"]?([^«»"'""]{6,400}?)(?=[«»"'""]|[.;]|$)/g },
  { name: "es-rev", re: /\b(?:dijo|habló|respondió|prometió|ordenó|declaró)\s+(?:Dios|Jehová|el SEÑOR|el Señor)\b\s*[:,]?\s*[«"'"]?([^«»"'""]{6,400}?)(?=[«»"'""]|[.;]|$)/g },
  // French
  { name: "fr", re: /\b(?:Dieu|l'Éternel|L'Éternel|le SEIGNEUR|le Seigneur)\s+(?:lui\s+)?(?:dit|dira|parla|répondit|cria|déclara|promit|ordonna)\b\s*[:,]?\s*[«"'"]?([^«»"'""]{6,400}?)(?=[«»"'""]|[.;]|$)/g },
  // German
  { name: "de", re: /\b(?:Gott|der HERR|der Herr|JAHWE)\s+(?:zu\s+\w+\s+)?(?:sprach|sagte|antwortete|gebot|rief|verhieß|verkündete|sprach\s+zu)\b\s*[:,]?\s*[„"'"]?([^"'""„]{6,400}?)(?=["'""„]|[.;]|$)/g },
  // Portuguese
  { name: "pt", re: /\b(?:Deus|Jeová|o SENHOR|o Senhor)\s+(?:lhe\s+)?(?:disse|falou|respondeu|ordenou|prometeu|declarou|chamou|exclamou)\b\s*[:,]?\s*[«"'"]?([^«»"'""]{6,400}?)(?=[«»"'""]|[.;]|$)/g },
  { name: "pt-rev", re: /\b(?:[Dd]isse|[Ff]alou|[Rr]espondeu|[Oo]rdenou|[Pp]rometeu|[Dd]eclarou)\s+(?:[oO]\s+)?(?:Deus|SENHOR|Senhor|Jeová)\b\s*[:,]?\s*[«"'"]?([^«»"'""]{6,400}?)(?=[«»"'""]|[.;]|$)/g },
  // Latin (Vulgate uses no quote marks; capture run to end of sentence)
  { name: "la", re: /\b(?:[Dd]ixit|[Aa]it|[Ll]ocutus\s+est|[Pp]raecepit|[Vv]ocavit|[Rr]espondit)\s+(?:\w+\s+)?(?:Deus|Dominus|Dominus\s+Deus)\b\s*[:,]?\s*([^.;:]{6,400}?)(?=[.;:]|$)/g },
  { name: "la-rev", re: /\b(?:Deus|Dominus|Dominus\s+Deus)\s+(?:[Dd]ixit|[Aa]it|[Ll]ocutus\s+est|[Pp]raecepit|[Vv]ocavit|[Rr]espondit)\b\s*[:,]?\s*([^.;:]{6,400}?)(?=[.;:]|$)/g },
  // Hebrew (Tanakh narrative; וַיֹּאמֶר אֱלֹהִים …)
  { name: "he", re: /(?:ו?[\u0591-\u05C7]*י[\u0591-\u05C7]*א[\u0591-\u05C7]*מ[\u0591-\u05C7]*ר|ו?[\u0591-\u05C7]*י[\u0591-\u05C7]*ד[\u0591-\u05C7]*ב[\u0591-\u05C7]*ר|ו?[\u0591-\u05C7]*י[\u0591-\u05C7]*ק[\u0591-\u05C7]*ר[\u0591-\u05C7]*א|א[\u0591-\u05C7]*מ[\u0591-\u05C7]*ר)\s+(?:א[\u0591-\u05C7]*ל[\u0591-\u05C7]*ה[\u0591-\u05C7]*י[\u0591-\u05C7]*ם|י[\u0591-\u05C7]*ה[\u0591-\u05C7]*ו[\u0591-\u05C7]*ה|א[\u0591-\u05C7]*ד[\u0591-\u05C7]*נ[\u0591-\u05C7]*י)\s*[,:.]?\s*([^.;:׃]{6,400}?)(?=[.;:׃]|$)/gu },
  // Greek (LXX + NT: εἶπεν ὁ θεός / ὁ Κύριος εἶπεν, with NFC)
  { name: "el", re: /(?<![\p{L}])(?:εἶπεν|εἶπε|ἐλάλησεν|ἐκέλευσεν)\s+(?:ὁ\s+)?(?:Θεός|θεός|Κύριος|κύριος)(?![\p{L}])\s*[,:.]?\s*([^.;:·]{6,400}?)(?=[.;:·]|$)/gu },
  { name: "el-rev", re: /(?<![\p{L}])(?:ὁ\s+)?(?:Θεός|θεός|Κύριος|κύριος)\s+(?:εἶπεν|εἶπε|ἐλάλησεν)(?![\p{L}])\s*[,:.]?\s*([^.;:·]{6,400}?)(?=[.;:·]|$)/gu },
  // Hindi (परमेश्‍वर ने कहा / यहोवा ने कहा)
  { name: "hi", re: /(?:परमेश्‍?वर|यहोवा|प्रभु)\s+(?:ने\s+)?(?:कहा|बोला|पुकारा|घोषित\s+किया|वचन\s+दिया)\s*[,:।]?\s*[“"'"]?([^"'"""।]{6,400}?)(?=["'""”।]|$)/gu },
];

function detectDivineQuotes(text) {
  if (!text) return [];
  const seen = new Set();
  const out = [];
  const norm = text.normalize ? text.normalize("NFC") : text;
  for (const re of [DIVINE_QUOTED, DIVINE_KJV]) {
    re.lastIndex = 0; let m;
    while ((m = re.exec(text)) !== null) {
      const q = (m[1] || "").trim();
      if (q.length > 4 && !seen.has(q)) { seen.add(q); out.push(q); }
    }
  }
  for (const { re } of LANG_ATTRIBUTIONS) {
    re.lastIndex = 0; let m;
    while ((m = re.exec(norm)) !== null) {
      const q = (m[1] || "").trim();
      if (q.length > 4 && q.length < 500 && !seen.has(q)) { seen.add(q); out.push(q); }
      if (re.lastIndex === m.index) re.lastIndex++;
    }
  }
  return out;
}

// Wrap any substrings in `redQuotes` with a <span class="cx-red">. If
// `wholeVerse` is true and no per-string quotes were detected for this
// translation, fall back to painting the entire verse red — used for
// translations that don't use quotation marks (Latin Vulgata, Geneva, etc.)
// when our cross-translation Jesus-verses database tells us this verse
// contains Jesus's words. Divine (Father / God / LORD) quoted speech gets
// a shimmer span — runs in parallel with red so theology stacks visually.
// Final-resort Jesus-quote extractor — used when the cross-translation DB
// flags a verse as containing Jesus's words but the per-translation parser
// (in bible.js) failed to find them in this particular language. Looks for
// the "said/saith/spake … unto …, X" attribution mid-verse and treats the
// trailing capitalised clause as the quote. Stops the whole-verse fallback
// from painting narrator setup red.
function extractJesusQuoteHeuristic(text) {
  const re = /\b(?:said|saith|answered|spake|cried|replied)\s+(?:also\s+|again\s+|then\s+)?(?:unto\s+(?:them|him|her|me|you|the\s+\w+)(?:\s+\w+){0,3}\s*)?,\s+([A-Z][^]{6,}?)$/;
  const m = text.match(re);
  return m && m[1].trim().length > 4 ? [m[1].trim()] : null;
}

function renderScripture(rawText, redQuotes, wholeVerse, yhwhMode) {
  // NFC-normalise so accent forms (decomposed vs precomposed) compose
  // identically across regex match → indexOf wrap → display. Greek LXX
  // and Hebrew with niqqud both depend on this.
  const normalized = (rawText && rawText.normalize) ? rawText.normalize("NFC") : rawText;
  const text = applyYHWH(normalized, yhwhMode);
  // Whole-verse fallback escalation: if the DB knows Jesus speaks but the
  // per-translation parser found nothing, try one more heuristic to extract
  // just the quoted clause. Only paint the WHOLE verse red as a last resort
  // (used by no-quote-mark translations like Latin Vulgate).
  if (wholeVerse && (!redQuotes || !redQuotes.length)) {
    const extracted = extractJesusQuoteHeuristic(text);
    if (extracted) {
      redQuotes = extracted;
      wholeVerse = false;
    }
  }
  // Find divine quotes (full quoted clauses, English-only) AND multi-script
  // divine-name tokens (Tetragrammaton, Theos, Dominus, यहोवा, etc.). Both
  // get the same `cx-divine` golden shimmer treatment.
  const divineQuotes = [
    ...detectDivineQuotes(text),
    ...getGoldenWords(text),
  ];
  // Build span list keyed by class. Apply red first (longer/sorted), then
  // divine (skip overlaps with red).
  let parts = [{ t: text, kind: null }];

  const wrap = (quotes, kind, onlyOnPlain) => {
    if (!quotes?.length) return;
    const sorted = [...quotes].sort((a, b) => b.length - a.length);
    const next = [];
    for (const p of parts) {
      if (onlyOnPlain && p.kind) { next.push(p); continue; }
      let leftover = p.t;
      let bookmark = 0;
      const segments = [];
      while (leftover.length) {
        let bestIdx = -1, bestQ = null;
        for (const q of sorted) {
          const i = leftover.indexOf(q);
          if (i !== -1 && (bestIdx === -1 || i < bestIdx)) { bestIdx = i; bestQ = q; }
        }
        if (bestIdx === -1) { segments.push({ t: leftover, kind: p.kind }); break; }
        if (bestIdx > 0) segments.push({ t: leftover.slice(0, bestIdx), kind: p.kind });
        segments.push({ t: bestQ, kind });
        leftover = leftover.slice(bestIdx + bestQ.length);
        bookmark += bestIdx + bestQ.length;
      }
      next.push(...segments);
    }
    parts = next;
  };

  if (wholeVerse && (!redQuotes || !redQuotes.length)) {
    return <span className="cx-red">{text}</span>;
  }
  wrap(redQuotes, "red", true);
  wrap(divineQuotes, "divine", true);

  return parts.map((p, i) => {
    if (p.kind === "red")    return <span key={i} className="cx-red">{p.t}</span>;
    if (p.kind === "divine") return <span key={i} className="cx-divine">{p.t}</span>;
    return <React.Fragment key={i}>{p.t}</React.Fragment>;
  });
}

// Back-compat alias — old call sites can keep working unchanged.
function renderRedLetter(text, redQuotes, wholeVerse) {
  return renderScripture(text, redQuotes, wholeVerse, false);
}

// Long-press hook for touch devices — fires onLongPress after `ms` ms of
// continuous touch (no movement), cancels on move/release. Pairs with
// onContextMenu so the same element opens the menu on desktop right-click and
// mobile long-press.
function useLongPress(onLongPress, ms = 450) {
  const timer = useRef(null);
  const startPos = useRef(null);
  const fired = useRef(false);
  const start = (e) => {
    fired.current = false;
    const t = e.touches?.[0];
    startPos.current = t ? { x: t.clientX, y: t.clientY } : null;
    const target = e.currentTarget;
    timer.current = setTimeout(() => {
      fired.current = true;
      onLongPress(target.getBoundingClientRect());
    }, ms);
  };
  const cancel = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  const move = (e) => {
    if (!startPos.current || !e.touches?.[0]) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - startPos.current.x) > 10 || Math.abs(t.clientY - startPos.current.y) > 10) cancel();
  };
  // Suppress the click that follows a long-press so we don't double-fire.
  const click = (e) => { if (fired.current) { e.preventDefault(); e.stopPropagation(); fired.current = false; } };
  return {
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: cancel,
    onTouchCancel: cancel,
    onClickCapture: click,
  };
}

// Single hairline action in the reserved right gutter — never overlays text.
//   left-click  → toggle highlight in current colour
//   right-click → open full VerseMenu (mark / compare / translate / oracle / copy)
// Restrained at rest, intensifies on hover/focus. The verse itself owns the
// right-click context menu, so this stays as one quiet affordance.
function VerseActions({ onMark, onMenu, isMarked }) {
  return (
    <button
      type="button"
      className={`cx-vmark-btn ${isMarked ? "is-on" : ""}`}
      onClick={onMark}
      onContextMenu={onMenu}
      title={isMarked ? "Click to remove highlight · right-click for menu" : "Click to highlight · right-click for menu"}
      aria-label={isMarked ? "Remove highlight" : "Highlight verse"}
    >{isMarked ? "★" : "☆"}</button>
  );
}

// Inline scripture-face toggle — sits next to the size pill in the reader
// header. Reads the current face from the body class (set by App via
// `font-${t.scriptureFont}`) and writes back via the tweak persistence
// system, so toggling here updates the same setting users see in Settings.
function FaceToggle() {
  const [face, setFace] = useState(() =>
    (document.querySelector('.cx-app')?.className.match(/font-(serif|mono)/) || [, "serif"])[1]
  );
  useEffect(() => {
    const onTweak = (e) => {
      if (e.detail && typeof e.detail.scriptureFont === "string") setFace(e.detail.scriptureFont);
    };
    window.addEventListener("tweakchange", onTweak);
    return () => window.removeEventListener("tweakchange", onTweak);
  }, []);
  const flip = () => {
    const next = face === "serif" ? "mono" : "serif";
    setFace(next);
    // Tap into the same persistence channel useTweaks uses
    try {
      const raw = JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}");
      raw.scriptureFont = next;
      localStorage.setItem("codex.tweaks.v1", JSON.stringify(raw));
    } catch {}
    window.dispatchEvent(new CustomEvent("tweakchange", { detail: { scriptureFont: next } }));
    try { window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { scriptureFont: next } }, "*"); } catch {}
    // Manually flip the body class so the change is instant — App's
    // useEffect will reconcile to the same value when it next renders.
    const app = document.querySelector('.cx-app');
    if (app) {
      app.classList.remove("font-serif", "font-mono");
      app.classList.add(`font-${next}`);
    }
  };
  return (
    <button
      type="button"
      className={`cx-face-toggle is-${face}`}
      onClick={flip}
      title={`Scripture face · ${face} · click to switch`}
      aria-label={`Scripture face: ${face}`}
    >
      <span className="cx-face-glyph">{face === "serif" ? "Aa" : "Aa"}</span>
      <span className="cx-face-lbl">{face}</span>
    </button>
  );
}

// Single-column verse — desktop right-click + mobile long-press both open
// the menu. The hover + button stays for one-tap highlight.
function VerseRow({ v, isHl, isLatin, markColor, text, redLetter, primary, onSelectVerse, onToggleHighlight, onOpenVerseMenu, yhwhMode, passage }) {
  const longPress = useLongPress((rect) => onOpenVerseMenu?.(v, rect));
  const onCtx = (e) => { e.preventDefault(); onOpenVerseMenu?.(v, e.currentTarget.getBoundingClientRect()); };
  // Drag a verse out into Notes (or any drop target). Carries the ref +
  // text so the receiving surface can compose collages.
  const onDragStart = (e) => {
    const ref = passage ? `${passage.book} ${passage.chapter}:${v.n}` : `Verse ${v.n}`;
    const plain = `"${text}"\n— ${ref}`;
    e.dataTransfer.setData("text/plain", plain);
    e.dataTransfer.setData("application/codex-verse", JSON.stringify({ ref, text, n: v.n }));
    e.dataTransfer.effectAllowed = "copy";
    document.body.classList.add("cx-verse-dragging");
  };
  const onDragEnd = () => document.body.classList.remove("cx-verse-dragging");
  return (
    <p
      className={`cx-verse ${isHl ? "is-hl" : ""} ${isLatin ? "is-latin" : ""} ${markColor ? "is-marked" : ""}`}
      data-mark={markColor || ""}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onSelectVerse(v.n)}
      onContextMenu={onCtx}
      {...longPress}
    >
      <sup className="cx-vnum">{v.n}</sup>
      <span className="cx-vtext">
        {renderScripture(text, redLetter ? v.red?.[primary] : null, redLetter && v._jesusVerse, yhwhMode)}
      </span>
      <VerseActions
        onMark={(e) => { e.stopPropagation(); onToggleHighlight?.(v.n); }}
        onMenu={(e) => { e.stopPropagation(); onOpenVerseMenu?.(v, e.currentTarget.closest(".cx-verse").getBoundingClientRect()); }}
        isMarked={!!markColor}
      />
    </p>
  );
}

// Side-by-side verse — same affordances applied to the row container.
function VerseSideRow({ v, colsMeta, isHl, markColor, redLetter, verseText, onSelectVerse, onToggleHighlight, onOpenVerseMenu, yhwhMode }) {
  const longPress = useLongPress((rect) => onOpenVerseMenu?.(v, rect));
  const onCtx = (e) => { e.preventDefault(); onOpenVerseMenu?.(v, e.currentTarget.getBoundingClientRect()); };
  return (
    <div
      className={`cx-verse-row ${isHl ? "is-hl" : ""} ${markColor ? "is-marked" : ""}`}
      data-mark={markColor || ""}
      onClick={() => onSelectVerse(v.n)}
      onContextMenu={onCtx}
      {...longPress}
      style={{ gridTemplateColumns: `repeat(${colsMeta.length}, minmax(0,1fr))` }}
    >
      {colsMeta.map((t, i) => {
        const text = verseText(v, t.id);
        const isLatin = t.lang === "LA";
        return (
          <p key={t.id} className={`cx-verse cx-verse-col ${i === 0 ? "is-primary-col" : ""} ${isLatin ? "is-latin" : ""}`}>
            <sup className="cx-vnum">{v.n}</sup>
            <span className="cx-vtext">
              {renderScripture(text, redLetter ? v.red?.[t.id] : null, redLetter && v._jesusVerse, yhwhMode)}
            </span>
          </p>
        );
      })}
      <VerseActions
        onMark={(e) => { e.stopPropagation(); onToggleHighlight?.(v.n); }}
        onMenu={(e) => { e.stopPropagation(); onOpenVerseMenu?.(v, e.currentTarget.closest(".cx-verse-row").getBoundingClientRect()); }}
        isMarked={!!markColor}
      />
    </div>
  );
}

// When the gnosis layer is engaged we want passage commentary to actually
// appear *inside* the reader — not just a pill in the header. Distribute the
// existing panelData.gnosis entries as small inline cards between verses, so
// the reader becomes a meditative two-column experience: scripture + gnosis.
function gnosisInsertionPoints(verseCount, gnosisCount) {
  if (!gnosisCount || !verseCount) return new Map();
  const points = new Map();              // verseN → gnosis entry index
  for (let i = 0; i < gnosisCount; i++) {
    const at = Math.max(1, Math.round(verseCount * (i + 1) / (gnosisCount + 1)));
    points.set(at, i);
  }
  return points;
}

function GnosisInline({ entry }) {
  return (
    <aside className="cx-gnosis-inline" aria-label="Gnosis reading">
      <header>
        <span className="cx-gnosis-inline-sigil">{entry.sigil || "⟁"}</span>
        <span className="cx-gnosis-inline-title">{entry.title}</span>
      </header>
      <p>{entry.body}</p>
    </aside>
  );
}

// Single popover that holds every reader-view toggle: red-letter, YHWH,
// font size, scripture face, side-by-side. Replaces the 5-button strip
// in the reader head with one ⊕ that opens a tidy panel below.
function ReaderViewPopover({
  redLetter, onToggleRedLetter,
  yhwhMode, onToggleYHWH,
  fontScale, onCycleFontSize,
  sideBySide, onToggleSideBySide,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    const t = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    document.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  // Surface a tiny indicator dot when at least one non-default toggle is on.
  const anyOn = redLetter || yhwhMode || sideBySide || fontScale !== 22;
  return (
    <span className="cx-vp" ref={ref}>
      <button
        type="button"
        className={`cx-vp-trigger ${open ? "is-open" : ""} ${anyOn ? "is-tweaked" : ""}`}
        onClick={() => setOpen(o => !o)}
        title="View options"
        aria-label="View options"
        aria-expanded={open}
      >
        <span className="cx-vp-trigger-glyph">Aa</span>
        {anyOn ? <i className="cx-vp-trigger-dot" /> : null}
      </button>
      {open ? (
        <div className="cx-vp-pop" role="dialog">
          <div className="cx-vp-row">
            <span className="cx-vp-lbl">Size</span>
            <button className="cx-vp-stepper" onClick={() => { for(let i=0;i<3;i++) onCycleFontSize(); }} title="Cycle text size">
              <span className="cx-vp-stepper-letter">Aa</span>
              <span className="cx-vp-stepper-num">{fontScale}</span>
            </button>
          </div>
          <div className="cx-vp-row">
            <span className="cx-vp-lbl">Face</span>
            <FaceToggle />
          </div>
          <div className="cx-vp-row">
            <span className="cx-vp-lbl">Red letter</span>
            <button
              type="button"
              className={`cx-vp-toggle ${redLetter ? "is-on" : ""}`}
              onClick={onToggleRedLetter}
              role="switch"
              aria-checked={redLetter}
            ><i /></button>
          </div>
          <div className="cx-vp-row">
            <span className="cx-vp-lbl" title="Show the Tetragrammaton in place of LORD">יהוה</span>
            <button
              type="button"
              className={`cx-vp-toggle ${yhwhMode ? "is-on" : ""}`}
              onClick={onToggleYHWH}
              role="switch"
              aria-checked={yhwhMode}
            ><i /></button>
          </div>
          <div className="cx-vp-row">
            <span className="cx-vp-lbl">Side-by-side</span>
            <button
              type="button"
              className={`cx-vp-toggle ${sideBySide ? "is-on" : ""}`}
              onClick={onToggleSideBySide}
              role="switch"
              aria-checked={sideBySide}
            ><i /></button>
          </div>
        </div>
      ) : null}
    </span>
  );
}

function Reader({ passage, primary, compareTranslations, sideBySide, gnosisOn, redLetter,
                  fontScale, highlightedVerse, onSelectVerse, onToggleSideBySide,
                  onToggleRedLetter, onCycleFontSize, onPrevChapter, onNextChapter,
                  highlights, highlightColor, onToggleHighlight, onOpenVerseMenu,
                  panelData, yhwhMode, onToggleYHWH }) {
  const bodyRef = useRef(null);
  // When a chapter finishes loading, scroll the saved cursor into view so a
  // relaunch lands you on the exact verse you were reading. Skip when the
  // cursor is verse 1 — already at the top.
  useEffect(() => {
    if (passage.loading) return;
    if (!highlightedVerse || highlightedVerse <= 1) return;
    const body = bodyRef.current;
    if (!body) return;
    const target = body.querySelector(`.cx-verse.is-hl, .cx-verse-row.is-hl`);
    if (!target) return;
    // Use offsetTop so we don't fight the body's own scroll container with
    // scrollIntoView, which can yank the whole page on iOS.
    const targetTop = target.offsetTop - 24;
    body.scrollTop = Math.max(0, targetTop);
    // eslint-disable-next-line
  }, [passage.loading, passage.bookId, passage.chapter]);
  const data = window.CODEX_DATA;
  const compareCols = sideBySide
    ? [primary, ...compareTranslations.filter(t => t !== primary)]
    : [primary];

  const colsMeta = compareCols.map(id => data.translations.find(t => t.id === id)).filter(Boolean);
  const primaryMeta = data.translations.find(t => t.id === primary) || data.translations[0];
  const bookMeta = data.books.find(b => b.id === passage.bookId);
  const totalChapters = bookMeta?.chapters || 1;

  const idx = data.books.findIndex(b => b.id === passage.bookId);
  const prevLabel = passage.chapter > 1
    ? `${passage.book.toUpperCase()} ${passage.chapter - 1}`
    : (idx > 0 ? `${data.books[idx-1].name.toUpperCase()} ${data.books[idx-1].chapters}` : "");
  const nextLabel = passage.chapter < totalChapters
    ? `${passage.book.toUpperCase()} ${passage.chapter + 1}`
    : (idx < data.books.length - 1 ? `${data.books[idx+1].name.toUpperCase()} 1` : "");

  // Pick a text out of a verse, falling back gracefully if a translation
  // failed to load for that verse.
  const verseText = (v, tId) => v[tId] || v.kjv || v.web || v.bbe || "";

  return (
    <main className="cx-reader">
      <CornerFrame label={`${passage.book.toUpperCase()} · CH ${passage.chapter} · ${passage.verses.length || "—"} VV`}>
        <div className="cx-reader-head">
          <div className="cx-reader-titles">
            <h1>{passage.title || `${passage.book} ${passage.chapter}`}</h1>
            {passage.subtitle ? <p>{passage.subtitle}</p> : null}
          </div>
          <div className="cx-reader-meta">
            <Pill>{primaryMeta.glyph}</Pill>
            <Pill dim>{primaryMeta.lang} · {primaryMeta.year}</Pill>
            {gnosisOn ? <Pill accent>⟁</Pill> : null}
            <ReaderViewPopover
              redLetter={redLetter} onToggleRedLetter={onToggleRedLetter}
              yhwhMode={yhwhMode} onToggleYHWH={onToggleYHWH}
              fontScale={fontScale} onCycleFontSize={onCycleFontSize}
              sideBySide={sideBySide} onToggleSideBySide={onToggleSideBySide}
            />
          </div>
        </div>

        {sideBySide && colsMeta.length > 1 ? (
          <div className="cx-cols-head" style={{ gridTemplateColumns: `repeat(${colsMeta.length}, minmax(0,1fr))` }}>
            {colsMeta.map((t, i) => (
              <div key={t.id} className={`cx-col-h ${i === 0 ? "is-primary" : ""}`}>
                <span className="cx-col-h-glyph">{t.glyph}</span>
                <div>
                  <b>{t.name}</b>
                  <span>{t.year} · {t.lang}</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div ref={bodyRef} className={`cx-reader-body ${sideBySide ? "is-cols" : ""}`} style={{ "--cx-fs": `${fontScale}px` }}>
          {passage.loading ? (
            <div className="cx-loading">
              <span className="cx-loading-orb" />
              <span>RETRIEVING · {passage.book} {passage.chapter} · across {compareCols.length} translation{compareCols.length === 1 ? "" : "s"}…</span>
            </div>
          ) : passage.error ? (
            <div className="cx-loading is-err">
              <span>⚠ FETCH FAILED</span>
              <code>{passage.error}</code>
              <span style={{opacity:.6,fontSize:11}}>check connection · cached chapters still readable</span>
            </div>
          ) : passage.verses.length === 0 ? (
            <div className="cx-loading">— no verses returned —</div>
          ) : sideBySide && colsMeta.length > 1 ? (
            (() => {
              const gnosisEntries = (gnosisOn && panelData?.gnosis) ? panelData.gnosis : [];
              const points = gnosisInsertionPoints(passage.verses.length, gnosisEntries.length);
              return passage.verses.flatMap((v, vi) => {
                const out = [
                  <VerseSideRow
                    key={`v${v.n}`}
                    v={v}
                    colsMeta={colsMeta}
                    isHl={highlightedVerse === v.n}
                    markColor={highlights ? highlights[`${passage.bookId}.${passage.chapter}.${v.n}`]?.color : null}
                    redLetter={redLetter}
                    verseText={verseText}
                    onSelectVerse={onSelectVerse}
                    onToggleHighlight={onToggleHighlight}
                    onOpenVerseMenu={onOpenVerseMenu}
                    yhwhMode={yhwhMode}
                    passage={passage}
                  />,
                ];
                if (points.has(vi + 1)) {
                  const idx = points.get(vi + 1);
                  out.push(<GnosisInline key={`g${idx}`} entry={gnosisEntries[idx]} />);
                }
                return out;
              });
            })()
          ) : (
            (() => {
              const gnosisEntries = (gnosisOn && panelData?.gnosis) ? panelData.gnosis : [];
              const points = gnosisInsertionPoints(passage.verses.length, gnosisEntries.length);
              return passage.verses.flatMap((v, vi) => {
                const out = [
                  <VerseRow
                    key={`v${v.n}`}
                    v={v}
                    isHl={highlightedVerse === v.n}
                    isLatin={primaryMeta.lang === "LA"}
                    markColor={highlights ? highlights[`${passage.bookId}.${passage.chapter}.${v.n}`]?.color : null}
                    text={verseText(v, primary)}
                    redLetter={redLetter}
                    primary={primary}
                    onSelectVerse={onSelectVerse}
                    onToggleHighlight={onToggleHighlight}
                    onOpenVerseMenu={onOpenVerseMenu}
                    yhwhMode={yhwhMode}
                    passage={passage}
                  />,
                ];
                if (points.has(vi + 1)) {
                  const idx = points.get(vi + 1);
                  out.push(<GnosisInline key={`g${idx}`} entry={gnosisEntries[idx]} />);
                }
                return out;
              });
            })()
          )}
        </div>

        <div className="cx-reader-foot">
          <button className="cx-nav-btn" onClick={onPrevChapter} disabled={!prevLabel}>◂ {prevLabel || "—"}</button>
          <div className="cx-reader-progress">
            <span>CH {pad(passage.chapter)} / {pad(totalChapters)}</span>
            <div className="cx-prog">
              <div className="cx-prog-fill" style={{ width: `${(passage.chapter/totalChapters)*100}%` }} />
            </div>
          </div>
          <button className="cx-nav-btn" onClick={onNextChapter} disabled={!nextLabel}>{nextLabel || "—"} ▸</button>
        </div>
      </CornerFrame>
    </main>
  );
}

// ── Keyboard shortcuts help · global modal ──────────────────────────────
// Press `?` (or Shift+/) anywhere outside a text field to open. ESC to close.
// One source of truth for the app's shortcut surface — keep this list short.
const CX_SHORTCUTS = [
  { keys: ["?"],                  label: "Show this help" },
  { keys: ["F"],                  label: "Toggle Oracle fullscreen" },
  { keys: ["⌘", "T"],             label: "New Oracle conversation" },
  { keys: ["⌘", "1-9"],           label: "Switch to conversation 1–9" },
  { keys: ["⌘", "W"],             label: "Close active conversation" },
  { keys: ["Esc"],                label: "Close fullscreen / dialogs" },
  { keys: ["←", "→"],             label: "Previous / next chapter" },
  { keys: ["⌘", "K"],             label: "Focus the Oracle input" },
];
function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      const inField = /^(INPUT|TEXTAREA)$/.test((e.target?.tagName || "")) || e.target?.isContentEditable;
      if (e.key === "Escape" && open) { setOpen(false); return; }
      if (inField) return;
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault(); setOpen(o => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (!open) return null;
  return (
    <div className="cx-help-backdrop" onClick={() => setOpen(false)} role="dialog" aria-label="Keyboard shortcuts">
      <div className="cx-help" onClick={e => e.stopPropagation()}>
        <header className="cx-help-h">
          <span className="cx-help-tag">CODEX · SHORTCUTS</span>
          <button className="cx-help-x" onClick={() => setOpen(false)} aria-label="Close">×</button>
        </header>
        <ul className="cx-help-list">
          {CX_SHORTCUTS.map((s, i) => (
            <li key={i} className="cx-help-row">
              <span className="cx-help-keys">
                {s.keys.map((k, j) => <kbd key={j} className="cx-kbd">{k}</kbd>)}
              </span>
              <span className="cx-help-lbl">{s.label}</span>
            </li>
          ))}
        </ul>
        <footer className="cx-help-foot">press <kbd className="cx-kbd">?</kbd> anytime</footer>
      </div>
    </div>
  );
}

Object.assign(window, {
  useState, useEffect, useMemo, useRef, useCallback,
  useSolarClock, fmtClock, fmtDate, pad,
  CornerFrame, Pill, Tick,
  StatusBar, LeftRail, Reader,
  ShortcutsHelp,
});
