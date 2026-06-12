// CODEX — mobile.jsx · v12 THE PALM — the phone shell, rebuilt from zero.
//
// On a phone the app is THE WORD plus exactly one piece of chrome: the ORB.
// No status bar, no footer, no drawers, no rails. Same soul as the desk
// (starfield, glass, the trace, instruments), phone-native body:
//
//   BOOT      — the reader (the SAME sys-reader plugin) edge to edge over
//               the starfield. A near-invisible TRACE (time · ◐) top-right.
//   THE ORB   — one floating glass orb, bottom edge, thumb-draggable to the
//               left/center/right thirds (codex.mobile.orb.v1). It pulses
//               while anything loads; a gold arc burns while the reading
//               streak is alive. TAP → the PALM. LONG-PRESS → focus (even
//               the trace dies; only the Word and the orb remain).
//   THE PALM  — the one door. A glass bottom sheet with three zones:
//               GRIP (⌘ omnibar · ☰ shelves · ◬ oracle · ✦ marks · ❂ galaxy
//               + the user's hottest panel chip, learned from
//               codex.cmd.freq.v1), VERBS (⚔ ⌬ ◎ bound to the current verse
//               via codex:os-open + ⟳ CONTINUE), PANELS (the 8 builtin
//               chips + every plugin panel — each opens as a full-screen
//               SHEET hosting the same component the desk windows host).
//   SHEETS    — one SheetHost, stack of at most 2. Swipe down the header to
//               dismiss, swipe in from the left edge (or ‹) to go back,
//               Esc works for phones with keyboards. Navigation closes
//               everything — the palm is a door, not a place.
//
// Law 5: this file is a projection. Every action routes through the same
// engines the desk uses: codexOpenOmni, codexOpenConstellation,
// codexOpenPanel, codex:os-open, codexJumpToRef, CODEX_NOW.

/* eslint-disable no-undef */

const MOB_ORB_KEY = "codex.mobile.orb.v1";
const MOB_FREQ_KEY = "codex.cmd.freq.v1"; // shared with the omnibar's learner

// ── Learned usage — same store + shape the omnibar writes ({n, last}). ──
function mobFreqLoad() {
  try { return JSON.parse(localStorage.getItem(MOB_FREQ_KEY) || "{}") || {}; }
  catch { return {}; }
}
function mobFreqRecord(id) {
  if (!id) return;
  try {
    const m = mobFreqLoad();
    const e = m[id] || { n: 0, last: 0 };
    e.n += 1; e.last = Date.now();
    m[id] = e;
    localStorage.setItem(MOB_FREQ_KEY, JSON.stringify(m));
  } catch { /* private mode — learning is a luxury, never a crash */ }
}
function mobFreqScore(e) {
  if (!e || !e.n) return 0;
  const days = Math.max(0, (Date.now() - (e.last || 0)) / 86400000);
  return e.n * Math.pow(0.97, days);
}

// ── Streak — alive means lastDate is today or yesterday (engagement.js
// counts local days the same way). ───────────────────────────────────────
function mobIso(d) {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}
function mobStreak() {
  try {
    const sk = window.CODEX_ENGAGE && window.CODEX_ENGAGE.loadStreak && window.CODEX_ENGAGE.loadStreak();
    if (!sk || !sk.current || !sk.lastDate) return 0;
    const today = new Date();
    const yest = new Date(Date.now() - 86400000);
    return (sk.lastDate === mobIso(today) || sk.lastDate === mobIso(yest)) ? sk.current : 0;
  } catch { return 0; }
}

function mobTrailRef() {
  try {
    const t = JSON.parse(localStorage.getItem("codex.trail") || "[]");
    const last = t.length ? t[t.length - 1] : null;
    return (last && last.ref) ? String(last.ref) : null;
  } catch { return null; }
}

function mobOrbPos() {
  try {
    const p = localStorage.getItem(MOB_ORB_KEY);
    return (p === "left" || p === "right") ? p : "center";
  } catch { return "center"; }
}

// Resolve "plugin:<pid>:<panel>" against the live registry.
function mobResolvePanel(id) {
  if (!id || id.indexOf("plugin:") !== 0) return null;
  const parts = id.split(":");
  const api = window.CODEX_PLUGINS_API;
  if (!api || !api.getPanels) return null;
  try {
    return (api.getPanels() || []).find(p => p.pluginId === parts[1] && p.id === parts.slice(2).join(":")) || null;
  } catch { return null; }
}

// ── THE TRACE — time · ◐, top-right, nearly transparent (tap to wake). ──
function MobileTrace({ dark, onToggleTheme }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return (
    <div className="cx-mtrace" role="toolbar" aria-label="System">
      <span className="cx-mtrace-time">{hh}:{mm}</span>
      <button
        className="cx-mtrace-btn"
        onClick={onToggleTheme}
        aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      >{dark ? "◐" : "◑"}</button>
    </div>
  );
}

// ── THE ORB — the one piece of chrome. ──────────────────────────────────
function MobileOrb({ busy, streak, pos, onPos, onTap, onLongPress, hidden }) {
  const ref = useRef(null);
  const st = useRef(null); // { x0, y0, t0, moved, long, timer }

  const clearTimer = () => {
    if (st.current && st.current.timer) { clearTimeout(st.current.timer); st.current.timer = 0; }
  };

  const onDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const s = { x0: e.clientX, y0: e.clientY, t0: Date.now(), moved: false, long: false, timer: 0 };
    st.current = s;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    s.timer = setTimeout(() => {
      if (st.current === s && !s.moved) { s.long = true; onLongPress(); }
    }, 550);
  };
  const onMove = (e) => {
    const s = st.current;
    if (!s || s.long) return;
    const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
    if (!s.moved && Math.abs(dx) + Math.abs(dy) > 10) { s.moved = true; clearTimer(); }
    if (s.moved && ref.current) {
      // ride the bottom edge — horizontal only
      const w = window.innerWidth;
      const x = Math.max(36, Math.min(w - 36, e.clientX));
      ref.current.style.left = x + "px";
      ref.current.style.right = "auto";
      ref.current.style.transform = "translateX(-50%)";
    }
  };
  const onUp = (e) => {
    const s = st.current;
    st.current = null;
    clearTimer();
    if (!s) return;
    if (s.long) return;            // long-press already fired
    if (s.moved) {
      const w = window.innerWidth || 1;
      const third = e.clientX < w / 3 ? "left" : e.clientX > (2 * w) / 3 ? "right" : "center";
      if (ref.current) { ref.current.style.left = ""; ref.current.style.right = ""; ref.current.style.transform = ""; }
      onPos(third);
      return;
    }
    onTap();
  };
  const onCancel = () => { st.current = null; clearTimer(); if (ref.current) { ref.current.style.left = ""; ref.current.style.right = ""; ref.current.style.transform = ""; } };

  // streak arc: up to 30 days fills the ring
  const arc = streak > 0 ? Math.max(10, Math.min(1, streak / 30) * 151) : 0;
  return (
    <button
      ref={ref}
      className={`cx-orb is-${pos} ${busy ? "is-busy" : ""} ${hidden ? "is-tucked" : ""}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onCancel}
      onTouchEnd={(e) => {
        // The orb acts on pointerup. Kill the browser's synthesized click —
        // it would land on whatever the palm just rendered under the thumb.
        if (e.cancelable) e.preventDefault();
      }}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="CODEX — open the palm (hold for focus)"
      title="The palm — every tool (hold: focus)"
    >
      <svg className="cx-orb-ring" viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r="24" className="cx-orb-track" />
        {arc > 0 ? (
          <circle cx="28" cy="28" r="24" className="cx-orb-streak"
            strokeDasharray={`${arc} ${Math.max(0, 151 - arc)}`}
            transform="rotate(-90 28 28)" />
        ) : null}
      </svg>
      <span className="cx-orb-core" aria-hidden="true">✦</span>
    </button>
  );
}

// ── Shared sheet drag mechanics ──────────────────────────────────────────
// Header drag → translate down → past 110px (or a flick) dismisses.
function mobSheetDrag(el, headEl, onDismiss) {
  if (!el || !headEl) return () => {};
  let y0 = 0, last = 0, t0 = 0, lastT = 0, on = false;
  const start = (e) => {
    const t = e.touches && e.touches[0];
    if (!t) return;
    on = true; y0 = last = t.clientY; t0 = lastT = performance.now();
    el.style.transition = "none";
  };
  const move = (e) => {
    if (!on) return;
    const t = e.touches && e.touches[0]; if (!t) return;
    const dy = Math.max(0, t.clientY - y0);
    el.style.transform = `translateY(${dy}px)`;
    last = t.clientY; lastT = performance.now();
  };
  const end = () => {
    if (!on) return;
    on = false;
    const dy = Math.max(0, last - y0);
    const vel = dy / Math.max(1, lastT - t0);
    el.style.transition = "";
    el.style.transform = "";
    if (dy > 110 || vel > 0.55) { try { onDismiss(); } catch {} }
  };
  headEl.addEventListener("touchstart", start, { passive: true });
  headEl.addEventListener("touchmove", move, { passive: true });
  headEl.addEventListener("touchend", end);
  headEl.addEventListener("touchcancel", end);
  return () => {
    headEl.removeEventListener("touchstart", start);
    headEl.removeEventListener("touchmove", move);
    headEl.removeEventListener("touchend", end);
    headEl.removeEventListener("touchcancel", end);
  };
}

// Left-edge swipe-back on a full-screen sheet body.
function mobEdgeBack(el, onBack) {
  if (!el) return () => {};
  let x0 = null, y0 = 0, fired = false;
  const start = (e) => {
    const t = e.touches && e.touches[0];
    if (!t) return;
    x0 = t.clientX <= 28 ? t.clientX : null;
    y0 = t ? t.clientY : 0;
    fired = false;
  };
  const move = (e) => {
    if (x0 == null || fired) return;
    const t = e.touches && e.touches[0]; if (!t) return;
    const dx = t.clientX - x0, dy = Math.abs(t.clientY - y0);
    if (dx > 70 && dx > dy * 1.4) { fired = true; try { onBack(); } catch {} }
  };
  const end = () => { x0 = null; fired = false; };
  el.addEventListener("touchstart", start, { passive: true });
  el.addEventListener("touchmove", move, { passive: true });
  el.addEventListener("touchend", end, { passive: true });
  return () => {
    el.removeEventListener("touchstart", start);
    el.removeEventListener("touchmove", move);
    el.removeEventListener("touchend", end);
  };
}

// ── One full-screen sheet. ───────────────────────────────────────────────
function MobileSheet({ sheet, isTop, canBack, onClose, onBack, children }) {
  const ref = useRef(null);
  const headRef = useRef(null);
  useEffect(() => mobSheetDrag(ref.current, headRef.current, onClose), [onClose]);
  useEffect(() => mobEdgeBack(ref.current, canBack ? onBack : onClose), [canBack, onBack, onClose]);
  return (
    <section
      ref={ref}
      className={`cx-sheet ${isTop ? "is-top" : "is-under"}`}
      role="dialog"
      aria-modal="true"
      aria-label={sheet.title}
      data-sheet={sheet.key}
    >
      <header className="cx-sheet-h" ref={headRef}>
        <span className="cx-sheet-grab" aria-hidden="true" />
        <div className="cx-sheet-row">
          <button className="cx-sheet-back" onClick={canBack ? onBack : onClose}
            aria-label={canBack ? "Back" : "Close"} title={canBack ? "Back" : "Close"}>‹</button>
          <span className="cx-sheet-glyph" aria-hidden="true">{sheet.glyph}</span>
          <b className="cx-sheet-title">{sheet.title}</b>
          <button className="cx-sheet-x" onClick={onClose} aria-label={`Close ${sheet.title}`} title="Close">×</button>
        </div>
      </header>
      <div className="cx-sheet-body">{children}</div>
    </section>
  );
}

// Plugin sheet body — same PluginPanelHost the desk windows mount, bound
// live to the reading cursor.
function MobilePluginBody({ panelId }) {
  const [now, setNow] = useState(() => window.CODEX_NOW || null);
  useEffect(() => {
    const onNow = (e) => setNow(e.detail || window.CODEX_NOW || null);
    window.addEventListener("codex:now", onNow);
    return () => window.removeEventListener("codex:now", onNow);
  }, []);
  const panel = mobResolvePanel(panelId);
  const Host = window.PluginPanelHost;
  if (!panel || !Host) {
    return (
      <div className="cx-sheet-missing">
        <b>PANEL UNAVAILABLE</b>
        <p>{panel ? "host not loaded" : "this panel hasn't registered yet"}</p>
      </div>
    );
  }
  return (
    <Host
      panel={panel}
      book={now && now.book}
      bookId={now && now.bookId}
      chapter={(now && now.chapter) || 1}
      verse={(now && now.verse) || 1}
      translation={(now && now.translation) || (window.CODEX_DATA && window.CODEX_DATA.tweaks && window.CODEX_DATA.tweaks.primaryTranslation) || "web"}
    />
  );
}

// ── THE PALM — the one door. ─────────────────────────────────────────────
const MOB_GRIP = [
  { id: "omni",    glyph: "⌘", label: "OMNI",    run: () => { if (window.codexOpenOmni) window.codexOpenOmni(); } },
  { id: "library", glyph: "☰", label: "SHELVES", open: "library" },
  { id: "oracle",  glyph: "◬", label: "ORACLE",  open: "oracle" },
  { id: "marks",   glyph: "✦", label: "MARKS",   open: "marks" },
  { id: "galaxy",  glyph: "❂", label: "GALAXY",  run: () => { if (window.codexOpenConstellation) window.codexOpenConstellation(); } },
];
const MOB_VERBS = [
  { kind: "sword",  glyph: "⚔", label: "SWORD" },
  { kind: "mirror", glyph: "⌬", label: "MIRROR" },
  { kind: "map",    glyph: "◎", label: "MAP" },
];

function MobilePalm({ onClose, onOpenSheet, builtinWin }) {
  const ref = useRef(null);
  const headRef = useRef(null);
  useEffect(() => mobSheetDrag(ref.current, headRef.current, onClose), [onClose]);

  const now = window.CODEX_NOW;
  const ref0 = (now && now.ref) || mobTrailRef();
  const trail = mobTrailRef();

  // panel registry — 8 builtins + every plugin panel (Dock v4's list).
  const builtinIds = Object.keys(builtinWin || {});
  let pluginPanels = [];
  try {
    pluginPanels = ((window.CODEX_PLUGINS_API && window.CODEX_PLUGINS_API.getPanels()) || [])
      .filter(p => !/^sys-/.test(p.pluginId)) // reader/shelves/oracle/marks live in the GRIP
      .map(p => ({ id: `plugin:${p.pluginId}:${p.id}`, glyph: p.glyph || "◆", label: String(p.label || p.id).toUpperCase() }));
  } catch {}

  // the hottest learned panel floats to the GRIP's right slot
  const freq = mobFreqLoad();
  const candidates = [
    ...builtinIds.map(id => ({ id, glyph: builtinWin[id].glyph, label: builtinWin[id].title.split(" ")[0] })),
    ...pluginPanels,
  ];
  let hot = null, hotScore = 0;
  for (const c of candidates) {
    const s = mobFreqScore(freq[c.id]);
    if (s > hotScore) { hot = c; hotScore = s; }
  }

  const openPanel = (id) => {
    mobFreqRecord(id);
    onClose();
    if (window.codexOpenPanel) window.codexOpenPanel(id);
  };
  const verb = (kind) => {
    if (!ref0) return;
    onClose();
    try { window.dispatchEvent(new CustomEvent("codex:os-open", { detail: { kind, ref: ref0 } })); } catch {}
  };

  return (
    <>
      <div className="cx-palm-scrim" onClick={onClose} aria-hidden="true" />
      <section className="cx-palm" role="dialog" aria-modal="true" aria-label="The palm" ref={ref}>
        <header className="cx-palm-head" ref={headRef}>
          <span className="cx-sheet-grab" aria-hidden="true" />
          {ref0 ? <span className="cx-palm-now">{ref0}</span> : <span className="cx-palm-now is-dim">THE PALM</span>}
        </header>

        <div className="cx-palm-grip" role="group" aria-label="Launchers">
          {MOB_GRIP.map(g => (
            <button key={g.id} className="cx-palm-launch" onClick={() => {
              onClose();
              if (g.open) onOpenSheet(g.open);
              else if (g.run) g.run();
            }} aria-label={g.label} title={g.label}>
              <i aria-hidden="true">{g.glyph}</i><span>{g.label}</span>
            </button>
          ))}
          {hot ? (
            <button className="cx-palm-launch is-hot" onClick={() => openPanel(hot.id)}
              aria-label={`${hot.label} — your most-used panel`} title={`${hot.label} — your most-used panel`}>
              <i aria-hidden="true">{hot.glyph}</i><span>{hot.label}</span>
            </button>
          ) : null}
        </div>

        <div className="cx-palm-verbs" role="group" aria-label="Verse actions">
          {MOB_VERBS.map(v => (
            <button key={v.kind} className="cx-palm-verb" disabled={!ref0}
              onClick={() => verb(v.kind)}
              title={ref0 ? `${v.label} — ${ref0}` : `${v.label} — open a verse first`}>
              <i aria-hidden="true">{v.glyph}</i><span>{v.label}</span>
            </button>
          ))}
          {trail ? (
            <button className="cx-palm-verb is-continue" onClick={() => {
              onClose();
              if (window.codexJumpToRef) { try { window.codexJumpToRef(trail); } catch {} }
            }} title={`Continue — ${trail}`}>
              <i aria-hidden="true">⟳</i><span>CONTINUE</span>
            </button>
          ) : null}
        </div>

        <div className="cx-palm-panels" role="group" aria-label="Panels">
          {builtinIds.map(id => (
            <button key={id} className="cx-palm-chip" onClick={() => openPanel(id)} title={builtinWin[id].title}>
              <i aria-hidden="true">{builtinWin[id].glyph}</i><span>{builtinWin[id].title}</span>
            </button>
          ))}
          {pluginPanels.map(p => (
            <button key={p.id} className="cx-palm-chip is-plugin" onClick={() => openPanel(p.id)} title={p.label}>
              <i aria-hidden="true">{p.glyph}</i><span>{p.label}</span>
            </button>
          ))}
          <button className="cx-palm-chip is-sys" data-tweaks-trigger
            onClick={() => { onClose(); try { window.postMessage({ type: "__activate_edit_mode" }, "*"); } catch {} }}
            title="Settings">
            <i aria-hidden="true">⚙</i><span>SETTINGS</span>
          </button>
        </div>
      </section>
    </>
  );
}

// ── Pull-down-from-top on the Word = the omnibar. Only fires when the
// reader's scroller is already at the very top, the pull is long and
// decidedly vertical, and no sheet/palm sits above the Word. ─────────────
function mobPullToOmni(wrapEl, isFree) {
  if (!wrapEl) return () => {};
  let y0 = 0, x0 = 0, armed = false, fired = false;
  const scroller = () => wrapEl.querySelector(".cxr-scroll");
  const start = (e) => {
    const t = e.touches && e.touches[0];
    if (!t || (e.touches && e.touches.length > 1)) { armed = false; return; }
    const sc = scroller();
    armed = !!(sc && sc.scrollTop <= 0 && isFree());
    fired = false;
    y0 = t.clientY; x0 = t.clientX;
  };
  const move = (e) => {
    if (!armed || fired) return;
    const t = e.touches && e.touches[0]; if (!t) return;
    const dy = t.clientY - y0, dx = Math.abs(t.clientX - x0);
    if (dy < -8) { armed = false; return; } // scrolling down — not a pull
    if (dy > 96 && dy > dx * 2) {
      fired = true; armed = false;
      try { if (window.codexOpenOmni) window.codexOpenOmni(); } catch {}
    }
  };
  const end = () => { armed = false; fired = false; };
  wrapEl.addEventListener("touchstart", start, { passive: true });
  wrapEl.addEventListener("touchmove", move, { passive: true });
  wrapEl.addEventListener("touchend", end, { passive: true });
  wrapEl.addEventListener("touchcancel", end, { passive: true });
  return () => {
    wrapEl.removeEventListener("touchstart", start);
    wrapEl.removeEventListener("touchmove", move);
    wrapEl.removeEventListener("touchend", end);
    wrapEl.removeEventListener("touchcancel", end);
  };
}

// ── THE SHELL ────────────────────────────────────────────────────────────
function CodexMobileShell({ builtinWin, builtinBody, busy, dark, onToggleTheme }) {
  const [sheets, setSheets] = useState([]);   // [{ key, kind, id, title, glyph }]
  const [palm, setPalm] = useState(false);
  const [focus, setFocus] = useState(false);
  const [orbPos, setOrbPos] = useState(mobOrbPos);
  const [streak, setStreak] = useState(mobStreak);
  const readerWrapRef = useRef(null);
  const freeRef = useRef(true); // no palm, no sheets → gestures own the Word

  const BW = builtinWin || {};

  // normalize an open request to a sheet descriptor
  const sheetFor = useCallback((spec) => {
    const s = String(spec || "");
    if (s === "library") return { kind: "library", title: "SHELVES", glyph: "☰" };
    if (s === "oracle")  return { kind: "oracle",  title: "ORACLE",  glyph: "◬" };
    if (s === "marks")   return { kind: "marks",   title: "MARKS",   glyph: "✦" };
    if (s.indexOf("builtin:") === 0) {
      const id = s.slice(8);
      if (!BW[id]) return null;
      return { kind: "builtin", id, title: BW[id].title, glyph: BW[id].glyph };
    }
    if (s.indexOf("plugin:") === 0) {
      const p = mobResolvePanel(s);
      return { kind: "plugin", id: s, title: String((p && p.label) || s.split(":").pop()).toUpperCase(), glyph: (p && p.glyph) || "◆" };
    }
    return null;
  }, [BW]);

  const openSheet = useCallback((spec) => {
    const d = sheetFor(spec);
    if (!d) return false;
    setPalm(false);
    setSheets(prev => {
      const key = d.kind + ":" + (d.id || "");
      const without = prev.filter(x => x.key !== key);
      const next = [...without, { ...d, key }];
      // max 2 deep — sheet over sheet swaps the first out
      return next.length > 2 ? next.slice(next.length - 2) : next;
    });
    return true;
  }, [sheetFor]);

  const closeTop = useCallback(() => setSheets(prev => prev.slice(0, -1)), []);
  const closeKey = useCallback((key) => setSheets(prev => prev.filter(s => s.key !== key)), []);
  const closeAll = useCallback(() => { setSheets([]); setPalm(false); }, []);

  // public router — app.jsx and the engines drive sheets through this
  useEffect(() => {
    window.codexMobile = {
      on: () => true,
      open: (spec) => (spec === "palm" ? (setPalm(true), true) : openSheet(spec)),
      closeAll,
      focus: (v) => setFocus(f => (v === undefined ? !f : !!v)),
      state: () => ({ sheets: sheets.map(s => s.key), palm, focus, orb: orbPos }),
    };
    return () => { delete window.codexMobile; };
  }, [openSheet, closeAll, sheets, palm, focus, orbPos]);

  // navigation closes the door — the palm remembers nothing open
  useEffect(() => {
    const onNav = () => { setSheets([]); setPalm(false); setStreak(mobStreak()); };
    window.addEventListener("codex:navigate", onNav);
    return () => window.removeEventListener("codex:navigate", onNav);
  }, []);

  // Esc — close palm, then the top sheet, then focus mode
  useEffect(() => {
    const onEsc = () => {
      if (palm) { setPalm(false); return; }
      if (sheets.length) { closeTop(); return; }
      if (focus) setFocus(false);
    };
    window.addEventListener("codex:escape", onEsc);
    return () => window.removeEventListener("codex:escape", onEsc);
  }, [palm, sheets.length, focus, closeTop]);

  // focus mode mirrors the desk's body class so instruments can react
  useEffect(() => {
    document.body.classList.toggle("cx-mfocus", !!focus);
    return () => document.body.classList.remove("cx-mfocus");
  }, [focus]);

  // pull-down-from-top on the Word = the omnibar
  freeRef.current = !palm && sheets.length === 0;
  useEffect(() => mobPullToOmni(readerWrapRef.current, () => freeRef.current), []);

  const setPos = useCallback((p) => {
    setOrbPos(p);
    try { localStorage.setItem(MOB_ORB_KEY, p); } catch {}
  }, []);

  const bodyFor = (s) => {
    if (s.kind === "library") return window.LibraryX ? React.createElement(window.LibraryX) : null;
    if (s.kind === "oracle")  return window.OracleX ? React.createElement(window.OracleX) : null;
    if (s.kind === "marks")   return window.MarksX ? React.createElement(window.MarksX) : null;
    if (s.kind === "builtin") return builtinBody ? builtinBody(s.id) : null;
    if (s.kind === "plugin")  return <MobilePluginBody panelId={s.id} />;
    return null;
  };

  return (
    <div className={`cx-mob ${focus ? "is-focus" : ""}`}>
      <div className="cx-mob-reader" ref={readerWrapRef}>
        {window.CodexReaderX
          ? React.createElement(window.CodexReaderX, { surface: "mobile" })
          : <div className="cxr-status is-err"><b>READER PLUGIN MISSING</b><code>dist/reader.js failed to load</code></div>}
      </div>

      {!focus ? <MobileTrace dark={dark} onToggleTheme={onToggleTheme} /> : null}

      {sheets.map((s, i) => (
        <MobileSheet
          key={s.key}
          sheet={s}
          isTop={i === sheets.length - 1}
          canBack={sheets.length > 1 && i === sheets.length - 1}
          onClose={() => closeKey(s.key)}
          onBack={closeTop}
        >{bodyFor(s)}</MobileSheet>
      ))}

      {palm ? (
        <MobilePalm
          onClose={() => setPalm(false)}
          onOpenSheet={openSheet}
          builtinWin={BW}
        />
      ) : null}

      <MobileOrb
        busy={!!busy}
        streak={streak}
        pos={orbPos}
        onPos={setPos}
        onTap={() => setPalm(p => !p)}
        onLongPress={() => setFocus(f => !f)}
        hidden={palm}
      />
    </div>
  );
}

Object.assign(window, { CodexMobileShell });
