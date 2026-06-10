// GENERATED from components.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
function _extends() {return _extends = Object.assign ? Object.assign.bind() : function (n) {for (var e = 1; e < arguments.length; e++) {var t = arguments[e];for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);}return n;}, _extends.apply(null, arguments);} // CODEX — components for the sci-fi bible-study terminal.
// Loaded after React + Babel + data.js + tweaks-panel.jsx.

const { useState, useEffect, useMemo, useRef, useCallback } = React;

// Local i18n shortcut — falls back to the key itself.
function tx(k) {return window.t && window.t(k) || k;}

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
    if (h < 5) phase = "night";else
    if (h < 7) phase = "dawn";else
    if (h < 18) phase = "day";else
    if (h < 20) phase = "dusk";else
    phase = "night";

    // 0 at midnight → 1 just before next midnight, for the sky arc.
    const t01 = h / 24;
    // Sun height as % of sky (0 at horizon, 100 at noon) — sin curve 6–18.
    const sunPct = Math.max(0, Math.sin((h - 6) / 12 * Math.PI)) * 100;

    const labels = { night: "NOCT", dawn: "AURO", day: "DIES", dusk: "VESP" };
    return { phase, t01, sunPct, label: labels[phase], hour: h };
  }, [now]);

  const dark = autoTheme ? solar.phase === "night" || solar.phase === "dusk" : manualDark;

  return { now, solar, dark };
}

function pad(n) {return String(n).padStart(2, "0");}

function fmtClock(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function fmtDate(d) {
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Visual primitives
// ─────────────────────────────────────────────────────────────────────────────

function CornerFrame({ children, className = "", label, glow = false }) {
  return (/*#__PURE__*/
    React.createElement("div", { className: `cx-frame ${glow ? "is-glow" : ""} ${className}` }, /*#__PURE__*/
    React.createElement("span", { className: "cx-corner cx-tl" }), /*#__PURE__*/
    React.createElement("span", { className: "cx-corner cx-tr" }), /*#__PURE__*/
    React.createElement("span", { className: "cx-corner cx-bl" }), /*#__PURE__*/
    React.createElement("span", { className: "cx-corner cx-br" }),
    label ? /*#__PURE__*/React.createElement("span", { className: "cx-frame-label" }, label) : null,
    children
    ));

}

function Pill({ children, dim, accent }) {
  return (/*#__PURE__*/
    React.createElement("span", { className: `cx-pill ${dim ? "is-dim" : ""} ${accent ? "is-accent" : ""}` },
    children
    ));

}

function Tick({ children, className = "" }) {
  return /*#__PURE__*/React.createElement("span", { className: `cx-tick ${className}` }, children);
}

// ─────────────────────────────────────────────────────────────────────────────
// Header / status bar
// ─────────────────────────────────────────────────────────────────────────────

function PrimaryDropdown({ primary, onSelectPrimary }) {
  const data = window.CODEX_DATA;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function onDoc(e) {if (ref.current && !ref.current.contains(e.target)) setOpen(false);}
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const cur = data.translations.find((x) => x.id === primary) || data.translations[0];
  return (/*#__PURE__*/
    React.createElement("div", { className: `cx-pdd ${open ? "is-open" : ""}`, ref: ref }, /*#__PURE__*/
    React.createElement("button", { className: "cx-pdd-btn", onClick: () => setOpen((o) => !o) }, /*#__PURE__*/
    React.createElement("span", { className: "cx-pdd-glyph" }, cur.glyph), /*#__PURE__*/
    React.createElement("span", { className: "cx-pdd-name" }, cur.name), /*#__PURE__*/
    React.createElement("span", { className: "cx-pdd-meta" }, cur.year, "\xB7", cur.lang), /*#__PURE__*/
    React.createElement("span", { className: "cx-pdd-caret" }, "\u25BE")
    ),
    open ? /*#__PURE__*/
    React.createElement("div", { className: "cx-pdd-menu" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-pdd-h" }, "PRIMARY \xB7 TRANSLATION"),
    data.translations.map((t) => /*#__PURE__*/
    React.createElement("button", {
      key: t.id,
      className: `cx-pdd-item ${t.id === primary ? "is-on" : ""}`,
      onClick: () => {onSelectPrimary(t.id);setOpen(false);} }, /*#__PURE__*/

    React.createElement("span", { className: "cx-pdd-glyph" }, t.glyph), /*#__PURE__*/
    React.createElement("span", { className: "cx-pdd-item-id" }, /*#__PURE__*/
    React.createElement("b", null, t.name), /*#__PURE__*/
    React.createElement("i", null, t.year, " \xB7 ", t.license, " \xB7 ", t.lang)
    ),
    t.id === primary ? /*#__PURE__*/React.createElement("span", { className: "cx-pdd-check" }, "\u2713") : null
    )
    )
    ) :
    null
    ));

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
    const onKey = (e) => {if (e.key === "Escape") setOpen(false);};
    const t = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    document.addEventListener("keydown", onKey);
    return () => {clearTimeout(t);document.removeEventListener("mousedown", onDown);document.removeEventListener("keydown", onKey);};
  }, [open]);
  return (/*#__PURE__*/
    React.createElement("span", { className: "cx-sq", ref: ref }, /*#__PURE__*/
    React.createElement("button", {
      className: `cx-sq-trigger ${open ? "is-open" : ""}`,
      onClick: () => setOpen((o) => !o),
      title: "Side quests \xB7 gamified study plans",
      "aria-label": "Side quests",
      "aria-expanded": open }, /*#__PURE__*/

    React.createElement("span", { className: "cx-sq-glyph" }, "\u2694"), /*#__PURE__*/
    React.createElement("span", { className: "cx-sq-lbl" }, "QUESTS")
    ),
    open ? ReactDOM.createPortal(/*#__PURE__*/
      React.createElement("div", { className: "cx-sq-menu", role: "dialog", ref: menuRef,
        style: { top: pos.top + "px", left: pos.left + "px" } }, /*#__PURE__*/
      React.createElement("header", { className: "cx-sq-h" }, /*#__PURE__*/
      React.createElement("span", { className: "cx-sq-tag" }, "SIDE \xB7 QUESTS")
      ),
      quests.length === 0 ? /*#__PURE__*/
      React.createElement("div", { className: "cx-sq-empty" }, /*#__PURE__*/
      React.createElement("p", { className: "cx-sq-empty-h" }, "No quests installed yet."), /*#__PURE__*/
      React.createElement("p", { className: "cx-sq-empty-sub" }, "Side quests are guided, gamified study plans \u2014 short tours of a book, a doctrine, a translation comparison. They steer you through the app step-by-step, like a missionary chaplain walking you through scripture."




      ), /*#__PURE__*/
      React.createElement("p", { className: "cx-sq-empty-foot" }, "Bring a quest prompt and I'll install it here."

      )
      ) : /*#__PURE__*/

      React.createElement("ul", { className: "cx-sq-list" },
      quests.map((q) => /*#__PURE__*/
      React.createElement("li", { key: q.id, className: "cx-sq-item" }, /*#__PURE__*/
      React.createElement("button", { className: "cx-sq-card", onClick: () => {setOpen(false);q.run?.();} }, /*#__PURE__*/
      React.createElement("span", { className: "cx-sq-card-glyph" }, q.glyph || "✦"), /*#__PURE__*/
      React.createElement("div", { className: "cx-sq-card-body" }, /*#__PURE__*/
      React.createElement("b", null, q.title),
      q.blurb ? /*#__PURE__*/React.createElement("i", null, q.blurb) : null
      )
      )
      )
      )
      )

      ),
      document.body
    ) : null
    ));

}

function StatusBar({ now, solar, dark, autoTheme, onToggleTheme, onToggleAuto, bookmarkCount, gnosisOn, primary, onSelectPrimary, onToggleLeft, onToggleRight }) {
  return (/*#__PURE__*/
    React.createElement("header", { className: "cx-status" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-status-l" }, /*#__PURE__*/




    React.createElement("div", { className: "cx-logo" }, /*#__PURE__*/
    React.createElement("svg", { viewBox: "0 0 32 32", className: "cx-sigil cx-sigil-std", "aria-hidden": true }, /*#__PURE__*/
    React.createElement("circle", { cx: "16", cy: "16", r: "14", fill: "none", stroke: "currentColor", strokeWidth: "1" }), /*#__PURE__*/
    React.createElement("circle", { cx: "16", cy: "16", r: "9", fill: "none", stroke: "currentColor", strokeWidth: "0.7", opacity: ".7" }), /*#__PURE__*/
    React.createElement("path", { d: "M16 2 L16 30 M2 16 L30 16", stroke: "currentColor", strokeWidth: "0.6", opacity: ".55" }), /*#__PURE__*/
    React.createElement("path", { d: "M16 6 L20 16 L16 26 L12 16 Z", fill: "currentColor", opacity: ".9" }), /*#__PURE__*/
    React.createElement("circle", { cx: "16", cy: "16", r: "1.6", fill: "var(--cx-bg)" })
    ), /*#__PURE__*/


    React.createElement("svg", { viewBox: "0 0 32 32", className: "cx-sigil cx-sigil-drift", "aria-hidden": true }, /*#__PURE__*/
    React.createElement("path", { d: "M16 3 L29 27 L3 27 Z", fill: "none", stroke: "currentColor", strokeWidth: "1.2" }), /*#__PURE__*/
    React.createElement("path", { d: "M16 3 L16 1 M29 27 L31 28.5 M3 27 L1 28.5", stroke: "currentColor", strokeWidth: "0.8", opacity: ".7" }), /*#__PURE__*/
    React.createElement("ellipse", { cx: "16", cy: "20", rx: "7", ry: "4", fill: "none", stroke: "currentColor", strokeWidth: "1" }), /*#__PURE__*/
    React.createElement("circle", { cx: "16", cy: "20", r: "2.2", fill: "currentColor" }), /*#__PURE__*/
    React.createElement("circle", { cx: "16", cy: "20", r: "0.7", fill: "var(--cx-bg)" }), /*#__PURE__*/
    React.createElement("path", { d: "M5 20 L1.5 18 M27 20 L30.5 18 M16 12 L16 8", stroke: "currentColor", strokeWidth: "0.7", opacity: ".55" })
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-logo-txt" }, /*#__PURE__*/
    React.createElement("b", { className: "cx-logo-name" }, /*#__PURE__*/React.createElement("span", { className: "cx-logo-std" }, "CODEX"), /*#__PURE__*/React.createElement("span", { className: "cx-logo-drift" }, "COD\u018EX")), /*#__PURE__*/
    React.createElement("span", { className: "cx-logo-sub" }, /*#__PURE__*/React.createElement("span", { className: "cx-logo-std" }, "NOCTURNE \xB7 v7.6"), /*#__PURE__*/React.createElement("span", { className: "cx-logo-drift" }, "VEILED.GLYPH \xB7 NIHIL OBSTAT"))
    )
    ), /*#__PURE__*/

    React.createElement("div", { className: "cx-status-sep cx-hide-narrow" }), /*#__PURE__*/

    React.createElement(SideQuestsButton, null), /*#__PURE__*/






    React.createElement(Tick, { className: "cx-hide-narrow" }, "BMK\xA0", /*#__PURE__*/React.createElement("b", null, pad(bookmarkCount))),
    (() => {
      const sk = window.CODEX_ENGAGE?.loadStreak?.();
      return sk && sk.current > 0 ? /*#__PURE__*/
      React.createElement("span", { className: "cx-streak-pill", title: `Longest: ${sk.longest} days` }, /*#__PURE__*/
      React.createElement("span", { className: "cx-flame" }, "🔥"),
      sk.current
      ) :
      null;
    })()
    ), /*#__PURE__*/

    React.createElement("div", { className: "cx-status-c cx-hide-narrow" }, /*#__PURE__*/
    React.createElement(SunStrip, { solar: solar })
    ), /*#__PURE__*/

    React.createElement("div", { className: "cx-status-r" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-clock" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-clock-time" }, fmtClock(now)), /*#__PURE__*/
    React.createElement("span", { className: "cx-clock-date" }, fmtDate(now), " \xB7 LOCAL \xB7 ", solar.label)
    ), /*#__PURE__*/




    React.createElement("button", {
      className: `cx-theme-toggle ${autoTheme ? "is-auto" : dark ? "is-dark" : "is-light"}`,
      onClick: () => {
        if (autoTheme) {
          // Auto → Light
          onToggleAuto();
          if (dark) onToggleTheme();
        } else if (dark) {
          // Dark → Auto
          onToggleAuto();
        } else {
          // Light → Dark
          onToggleTheme();
        }
      },
      "aria-label": autoTheme ? `Auto theme (${dark ? "night" : "day"}) — click for light` : dark ? "Night theme — click for auto" : "Day theme — click for dark",
      title: autoTheme ? `Auto · ${dark ? "night" : "day"}` : dark ? "Night" : "Day" }, /*#__PURE__*/

    React.createElement("span", { className: "cx-theme-track" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-theme-thumb" }, /*#__PURE__*/

    React.createElement("svg", { className: "cx-theme-sun", viewBox: "0 0 16 16", width: "12", height: "12", "aria-hidden": "true" }, /*#__PURE__*/
    React.createElement("circle", { cx: "8", cy: "8", r: "3", fill: "currentColor" }), /*#__PURE__*/
    React.createElement("g", { stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" }, /*#__PURE__*/
    React.createElement("line", { x1: "8", y1: "1.5", x2: "8", y2: "3" }), /*#__PURE__*/
    React.createElement("line", { x1: "8", y1: "13", x2: "8", y2: "14.5" }), /*#__PURE__*/
    React.createElement("line", { x1: "1.5", y1: "8", x2: "3", y2: "8" }), /*#__PURE__*/
    React.createElement("line", { x1: "13", y1: "8", x2: "14.5", y2: "8" }), /*#__PURE__*/
    React.createElement("line", { x1: "3.4", y1: "3.4", x2: "4.5", y2: "4.5" }), /*#__PURE__*/
    React.createElement("line", { x1: "11.5", y1: "11.5", x2: "12.6", y2: "12.6" }), /*#__PURE__*/
    React.createElement("line", { x1: "3.4", y1: "12.6", x2: "4.5", y2: "11.5" }), /*#__PURE__*/
    React.createElement("line", { x1: "11.5", y1: "4.5", x2: "12.6", y2: "3.4" })
    )
    ), /*#__PURE__*/

    React.createElement("svg", { className: "cx-theme-moon", viewBox: "0 0 16 16", width: "12", height: "12", "aria-hidden": "true" }, /*#__PURE__*/
    React.createElement("path", { d: "M11 2.5a5.5 5.5 0 1 0 2.5 4.7 4 4 0 0 1-2.5-4.7z", fill: "currentColor" })
    ), /*#__PURE__*/

    React.createElement("span", { className: "cx-theme-auto-badge" }, "A")
    )
    )
    ), /*#__PURE__*/



    React.createElement("button", {
      className: "cx-omni-launch",
      onClick: () => window.codexOpenOmni?.(),
      "aria-label": "Open omnibar",
      title: "Omnibar" },
    "\u2318")
    )
    ));

}

// Solar clock — fluid 24-hour strip that scales from micro phones to
// 5K Studio Displays. The night/dawn/day/dusk bands are baked into a
// single CSS gradient on the bar (one paint, no per-band absolute
// divs). Tick density adapts to container width via a small
// ResizeObserver — 12 ticks on a wide rail, 6 on medium, 3 on tiny.
function SunStrip({ solar }) {
  const wrapRef = useRef(null);
  const [tickHours, setTickHours] = useState([0, 6, 12, 18, 24]);

  // Choose tick density based on the strip's rendered width so the
  // numbers never overlap. ~36px between labels reads comfortably.
  useEffect(() => {
    if (!wrapRef.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width || 0;
      // Number of labels we can fit (each ~22px wide + 14px gap)
      const want = Math.max(3, Math.min(13, Math.floor(w / 38) + 1));
      // Pick a sane subdivision of 24h that gives us ≤ want labels
      const candidates = [1, 2, 3, 4, 6, 8, 12, 24];
      const stepHours = candidates.find((s) => 24 / s + 1 <= want) || 24;
      const out = [];
      for (let h = 0; h <= 24; h += stepHours) out.push(h);
      setTickHours(out);
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const nowPct = solar.t01 * 100;
  // Sun height for the tiny arc above the cursor (0 at horizon → 1 at noon)
  const sunNorm = Math.max(0, Math.min(1, solar.sunPct / 100));
  // Arc y-position (CSS): rises higher as sunNorm increases
  const sunY = 8 - sunNorm * 6;

  return (/*#__PURE__*/
    React.createElement("div", { className: `cx-sun is-${solar.phase}`, ref: wrapRef, title: `${solar.label} · sun ${Math.round(solar.sunPct)}% of zenith` }, /*#__PURE__*/
    React.createElement("div", { className: "cx-sun-bar", "aria-hidden": "true" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-sun-bar-grad" }),
    tickHours.map((h) => /*#__PURE__*/
    React.createElement("span", { key: h, className: "cx-sun-tick", style: { left: `${h / 24 * 100}%` }, "data-h": pad(h) }, pad(h))
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-sun-cursor", style: { left: `${nowPct}%` } }, /*#__PURE__*/
    React.createElement("span", { className: "cx-sun-cursor-dot" }), /*#__PURE__*/
    React.createElement("svg", { className: "cx-sun-cursor-sun", viewBox: "0 0 12 12", width: "12", height: "12", "aria-hidden": "true" }, /*#__PURE__*/
    React.createElement("circle", { cx: "6", cy: sunY, r: "2.2", fill: "currentColor" })
    )
    )
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-sun-meta", "aria-label": `${solar.label} ${Math.round(solar.sunPct)} percent of zenith` }, /*#__PURE__*/
    React.createElement("span", { className: "cx-sun-meta-phase" }, solar.label.toLowerCase()), /*#__PURE__*/
    React.createElement("span", { className: "cx-sun-meta-dot", "aria-hidden": "true" }, "\xB7"), /*#__PURE__*/
    React.createElement("span", { className: "cx-sun-meta-sun" }, Math.round(solar.sunPct), /*#__PURE__*/React.createElement("i", null, "%"))
    )
    ));

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
    return books.filter((b) => b.name.toLowerCase().includes(q) || b.id.includes(q));
  }, [books, query]);

  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-rail-section" }, /*#__PURE__*/
    React.createElement("button", { className: "cx-rail-h cx-rail-h-btn", onClick: () => setOpen((o) => !o) }, /*#__PURE__*/
    React.createElement("span", { className: "cx-caret" }, open ? "▾" : "▸"), /*#__PURE__*/
    React.createElement("span", null, title), /*#__PURE__*/
    React.createElement("i", null, filtered.length)
    ),
    open ? /*#__PURE__*/
    React.createElement("ul", { className: "cx-booklist" },
    filtered.length === 0 ? /*#__PURE__*/React.createElement("li", { className: "cx-booklist-empty" }, "\u2014 no match \u2014") : null,
    filtered.map((b) => {
      const isOpen = openBookId === b.id;
      return (/*#__PURE__*/
        React.createElement("li", { key: b.id, className: `${b.id === activeBookId ? "is-active" : ""} ${isOpen ? "is-open" : ""}` }, /*#__PURE__*/
        React.createElement("button", { className: "cx-book-row", onClick: () => setOpenBookId(isOpen ? null : b.id) }, /*#__PURE__*/
        React.createElement("span", { className: "cx-book-id" }, b.id.toUpperCase()), /*#__PURE__*/
        React.createElement("span", { className: "cx-book-name" }, b.name), /*#__PURE__*/
        React.createElement("span", { className: "cx-book-ch" }, b.chapters), /*#__PURE__*/
        React.createElement("span", { className: "cx-caret cx-book-caret" }, isOpen ? "▾" : "▸")
        ),
        isOpen ? /*#__PURE__*/
        React.createElement("div", { className: "cx-chgrid" },
        Array.from({ length: b.chapters }, (_, i) => i + 1).map((ch) => /*#__PURE__*/
        React.createElement("button", {
          key: ch,
          className: `cx-chcell ${b.id === activeBookId && ch === activeChapter ? "is-active" : ""}`,
          onClick: () => onSelectChapter(b.id, ch) },
        ch)
        )
        ) :
        null
        ));

    })
    ) :
    null
    ));

}

// ─── Mark row · click to open, swatch shows colour, × clears highlight ──────
function MarkRow({ mark, idx, onSelect, onClear, onTogglePin, swatch, aiReason }) {
  const onClick = (e) => {
    if (e.target.closest(".cx-bm-del")) return;
    if (e.target.closest(".cx-bm-pin")) return;
    onSelect(mark);
  };
  // Compact relative timestamp
  const relTs = (() => {
    if (!mark.ts) return "";
    const diff = (Date.now() - mark.ts) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
    const d = new Date(mark.ts);
    return `${pad(d.getMonth() + 1)}·${pad(d.getDate())}`;
  })();
  return (/*#__PURE__*/
    React.createElement("li", { className: `cx-bm-li ${mark.pinned ? "is-pinned" : ""}` }, /*#__PURE__*/
    React.createElement("div", { className: "cx-bm-row", onClick: onClick }, /*#__PURE__*/
    React.createElement("span", {
      className: "cx-bm-swatch",
      style: swatch ? { background: swatch } : null,
      "aria-hidden": true,
      title: mark.color }
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-bm-text" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-bm-ref" }, mark.ref),
    mark.note ? /*#__PURE__*/React.createElement("span", { className: "cx-bm-note" }, mark.note) : null,
    aiReason ? /*#__PURE__*/React.createElement("span", { className: "cx-bm-reason", title: "Why the Oracle ranked this" }, "\u2726 ", aiReason) : null
    ), /*#__PURE__*/
    React.createElement("span", { className: "cx-bm-ts" }, relTs), /*#__PURE__*/
    React.createElement("button", {
      className: `cx-bm-pin ${mark.pinned ? "is-on" : ""}`,
      onClick: (e) => {e.stopPropagation();onTogglePin?.(mark);},
      title: mark.pinned ? "Unpin" : "Pin to top",
      "aria-label": mark.pinned ? "Unpin mark" : "Pin mark",
      "aria-pressed": !!mark.pinned }, /*#__PURE__*/

    React.createElement("svg", { viewBox: "0 0 12 12", width: "11", height: "11", "aria-hidden": true }, /*#__PURE__*/

    React.createElement("g", { transform: "rotate(-30 6 6)" }, /*#__PURE__*/
    React.createElement("ellipse", { cx: "6", cy: "3.5", rx: "2.6", ry: "1.2", fill: mark.pinned ? "currentColor" : "none", stroke: "currentColor", strokeWidth: "0.9" }), /*#__PURE__*/
    React.createElement("line", { x1: "6", y1: "4.6", x2: "6", y2: "9.5", stroke: "currentColor", strokeWidth: "0.9", strokeLinecap: "round" }), /*#__PURE__*/
    React.createElement("line", { x1: "4.5", y1: "9.6", x2: "7.5", y2: "9.6", stroke: "currentColor", strokeWidth: "0.9", strokeLinecap: "round" })
    )
    )
    ), /*#__PURE__*/
    React.createElement("button", {
      className: "cx-bm-del",
      onClick: (e) => {e.stopPropagation();onClear(mark);},
      title: "Remove mark",
      "aria-label": "Remove mark" },
    "\xD7")
    )
    ));

}

function LeftRail({ activeBookId, activeChapter, marks = [], highlightColors, onSelectMark, onClearMark, onTogglePinMark, onMarkCurrent, onSelectChapter, currentRef, oracleProps, isCollapsed, onCollapse }) {
  const data = window.CODEX_DATA;
  const ot = useMemo(() => data.books.filter((b) => b.testament === "OT"), [data.books]);
  const nt = useMemo(() => data.books.filter((b) => b.testament === "NT"), [data.books]);
  const [tab, setTab] = useState("library");
  // ASK ORACLE from the verse menu fires "oracle:prefill". Switch to the
  // Oracle tab automatically so the user sees the prefilled question.
  useEffect(() => {
    const onPrefill = () => setTab("oracle");
    window.addEventListener("oracle:prefill", onPrefill);
    return () => window.removeEventListener("oracle:prefill", onPrefill);
  }, []);
  // Keyboard shortcuts `o` / `b` open the left rail AND announce which tab
  // they meant via codex:shortcut — land on it, don't leave the user on
  // whatever tab was open last.
  useEffect(() => {
    const onShortcut = (e) => {
      const action = e?.detail?.action;
      if (action === "toggle-oracle") setTab("oracle");else
      if (action === "toggle-bookmarks") setTab("marks");
    };
    window.addEventListener("codex:shortcut", onShortcut);
    return () => window.removeEventListener("codex:shortcut", onShortcut);
  }, []);
  const [libQuery, setLibQuery] = useState("");
  const [bmQuery, setBmQuery] = useState("");
  // AI-ranked mark search — fires when the literal substring filter
  // returns < 2 hits AND the query is long enough to be meaningful.
  // null = inactive, "loading" = thinking, [{key,reason}] = ranked.
  const [aiMarkResults, setAiMarkResults] = useState(null);

  const literalMatches = useMemo(() => {
    const q = bmQuery.trim().toLowerCase();
    if (!q) return marks;
    return marks.filter((b) =>
    (b.ref || "").toLowerCase().includes(q) ||
    (b.note || "").toLowerCase().includes(q) ||
    (b.color || "").toLowerCase().includes(q) ||
    (b.text || "").toLowerCase().includes(q)
    );
  }, [marks, bmQuery]);

  // Debounced semantic ranker. Escalates to the AI only when the local
  // substring search is thin (≤1 hit) and the query has substance (≥3 chars).
  // Cached in localStorage by query+marks signature so repeats are instant.
  useEffect(() => {
    const q = bmQuery.trim();
    if (!q || q.length < 3 || !window.MarkSearch || !marks.length) {
      setAiMarkResults(null);
      return;
    }
    if (literalMatches.length >= 2) {
      setAiMarkResults(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      setAiMarkResults("loading");
      const ranked = await window.MarkSearch.rank(q, marks, currentRef);
      if (cancelled) return;
      setAiMarkResults(ranked);
    }, 550);
    return () => {cancelled = true;clearTimeout(handle);};
  }, [bmQuery, marks, literalMatches.length, currentRef]);

  // Final list shown to the user — AI ranking when available + non-empty,
  // otherwise the literal substring matches.
  const aiActive = Array.isArray(aiMarkResults) && aiMarkResults.length > 0;
  const aiLoading = aiMarkResults === "loading";
  const aiReasonByKey = aiActive ?
  Object.fromEntries(aiMarkResults.map((r) => [r.key, r.reason])) :
  {};
  const filteredMarks = useMemo(() => {
    if (aiActive) {
      const byKey = Object.fromEntries(marks.map((m) => [m.key, m]));
      return aiMarkResults.map((r) => byKey[r.key]).filter(Boolean);
    }
    return literalMatches;
  }, [aiActive, aiMarkResults, marks, literalMatches]);

  const TABS = [
  { id: "library", label: tx("tab.library"), glyph: "📖", title: tx("tab.library.title") },
  { id: "oracle", label: tx("tab.oracle"), glyph: "◉", title: tx("tab.oracle.title") },
  { id: "marks", label: tx("tab.marks"), glyph: "✦", title: `${tx("marks")} (${marks.length})` }];


  return (/*#__PURE__*/
    React.createElement("aside", { className: "cx-rail cx-rail-l" },
    window.LeftRailResizer ? /*#__PURE__*/React.createElement(window.LeftRailResizer, null) : null,
    onCollapse ? /*#__PURE__*/
    React.createElement("button", {
      className: "cx-rail-fold cx-rail-fold-l",
      onClick: onCollapse,
      title: "Hide library (click the spine to bring it back)",
      "aria-label": "Collapse left rail" },
    "\u25C0") :
    null, /*#__PURE__*/
    React.createElement("div", { className: "cx-ltabs" },
    TABS.map((t) => /*#__PURE__*/
    React.createElement("button", {
      key: t.id,
      className: `cx-ltab ${tab === t.id ? "is-active" : ""}`,
      onClick: () => setTab(t.id),
      title: t.title }, /*#__PURE__*/

    React.createElement("span", { className: "cx-ltab-glyph" }, t.glyph), /*#__PURE__*/
    React.createElement("span", { className: "cx-ltab-lbl" }, t.label),
    t.id === "marks" && marks.length > 0 ? /*#__PURE__*/
    React.createElement("span", { className: "cx-ltab-badge" }, marks.length) :
    null
    )
    )
    ),

    tab === "library" ? /*#__PURE__*/
    React.createElement(CornerFrame, { label: "LIBRARY", className: "cx-rail-flex" },
    window.Library ? /*#__PURE__*/
    React.createElement(Library, {
      activeBookId: activeBookId,
      activeChapter: activeChapter,
      onSelectChapter: onSelectChapter,
      activeTranslation: oracleProps && oracleProps.primary || "kjv",
      onJumpRef: (ref) => {
        try {window.dispatchEvent(new CustomEvent("codex:jump-ref", { detail: { ref } }));} catch {}
      } }
    ) :
    null
    ) :
    null,

    tab === "oracle" ? /*#__PURE__*/
    React.createElement(CornerFrame, { label: "ORACLE \xB7 NEUTRAL", className: "cx-rail-flex" },
    window.Oracle ? /*#__PURE__*/React.createElement(Oracle, oracleProps) : /*#__PURE__*/React.createElement("div", { style: { padding: 14, color: "var(--cx-fg-dim)" } }, "Oracle loading\u2026")
    ) :
    null,


    tab === "marks" ? /*#__PURE__*/
    React.createElement(CornerFrame, { label: `${tx("marks.tab")} · ${tx("marks")}`, className: "cx-rail-flex" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-bm-head" }, /*#__PURE__*/
    React.createElement("span", null, tx("marks.head"), " \xB7 ", pad(marks.length)), /*#__PURE__*/
    React.createElement("span", { style: { display: "inline-flex", gap: 6 } }, /*#__PURE__*/
    React.createElement("button", {
      className: "cx-mini-btn",
      onClick: async () => {
        if (!marks.length) {
          window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: "No marks to export.", kind: "warn" } }));
          return;
        }
        const lines = marks.map((m) => {
          const colour = m.color ? ` (${m.color})` : "";
          const text = (m.text || "").replace(/\s+/g, " ").trim();
          return `${m.ref || m.key || "?"}${colour} — ${text}`;
        });
        const txt = lines.join("\n");
        const json = JSON.stringify(marks, null, 2);
        const blob = `${txt}\n\n---\n\n${json}`;
        try {
          await navigator.clipboard.writeText(blob);
          window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: `${marks.length} marks copied to clipboard.`, kind: "ok" } }));
        } catch (e) {
          window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: `Copy failed: ${e.message || e}`, kind: "err" } }));
        }
      },
      title: "Export all marks to clipboard (text + JSON)" },
    "\u2913 EXPORT"), /*#__PURE__*/
    React.createElement("button", { className: "cx-mini-btn", onClick: onMarkCurrent, title: tx("marks.add") }, tx("marks.add"))
    )
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-search" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-search-icon" }, "\u2315"), /*#__PURE__*/
    React.createElement("input", {
      placeholder: tx("marks.search"),
      value: bmQuery,
      onChange: (e) => setBmQuery(e.target.value) }
    ),
    aiLoading ? /*#__PURE__*/
    React.createElement("span", { className: "cx-bm-ai-chip is-loading", title: "Semantic search thinking\u2026" }, "\u2726 AI\u2026") :
    aiActive ? /*#__PURE__*/
    React.createElement("span", { className: "cx-bm-ai-chip is-on", title: "Showing semantic matches ranked by the Oracle" }, "\u2726 AI") :
    null,
    bmQuery ? /*#__PURE__*/React.createElement("button", { className: "cx-search-x", onClick: () => setBmQuery("") }, "\xD7") : null
    ),
    aiActive ? /*#__PURE__*/
    React.createElement("div", { className: "cx-bm-ai-note" }, "Semantic ranking \xB7 ",
    aiMarkResults.length, " ", aiMarkResults.length === 1 ? "match" : "matches", " for \"", bmQuery.trim(), "\""
    ) :
    null, /*#__PURE__*/
    React.createElement("ul", { className: "cx-bm-list" },
    aiLoading && filteredMarks.length === 0 ? /*#__PURE__*/
    React.createElement("li", { className: "cx-bm-empty" }, "\u2014 Asking the Oracle for related marks\u2026 \u2014") :
    filteredMarks.length === 0 ? /*#__PURE__*/
    React.createElement("li", { className: "cx-bm-empty" }, "\u2014 ", marks.length === 0 ? tx("marks.empty") : "no match", " \u2014") :
    filteredMarks.map((m, i) => /*#__PURE__*/
    React.createElement(MarkRow, {
      key: m.key,
      mark: m,
      idx: i,
      onSelect: onSelectMark,
      onClear: onClearMark,
      onTogglePin: onTogglePinMark,
      swatch: highlightColors?.[m.color]?.swatch,
      aiReason: aiReasonByKey[m.key] }
    )
    )
    )
    ) :
    null
    ));

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
  return text.
  replace(/\bLORD\b/g, "יהוה").
  replace(/\bGOD\b/g, "אלהים").
  replace(/\bGod\b/g, "אלהים");
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
/יְ?הֹ?וָ?ה[ ֳָֻ֖֯]*/g, // יהוה with optional niqqud / cantillation
/אֱלֹהִים/g,
/אֲדֹנָי/g,
/יהוה/g, // bare consonantal Tetragrammaton (Aleppo)
/אלהים/g, // bare consonantal Elohim
/אדני/g, // bare consonantal Adonai
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
/परमेश्‍?वर/g];

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
const DIVINE_VERB = "(?:said|saith|spake|spoke|answered|commanded|replied|declared|promised|called|cried)";
// Quoted form
const DIVINE_QUOTED = new RegExp(`\\b${DIVINE_ACTOR}\\s+(?:also\\s+|then\\s+|unto[^,"]{1,40},\\s*)?${DIVINE_VERB}\\b[^"'""]{0,40}["'""]([^"'""]{4,400})["'""]`, "g");
const DIVINE_KJV = new RegExp(`\\b${DIVINE_ACTOR}\\s+(?:also\\s+|then\\s+)?${DIVINE_VERB}(?:\\s+unto\\s+[A-Z][a-zA-Z']{1,18})?,\\s+([A-Z][^.;:]{6,400}?)(?=[.;:]|$)`, "g");

// ── Multi-language divine-speech patterns ────────────────────────────────
// Each tuple: { actor, verb } substrings the language uses for "[divine
// name] said". After matching the attribution, we capture either a quoted
// run (",") or the rest of the verse up to a sentence-ending punctuation.
// Quote variants accepted: " " ' ' « » " " ' ' ¿ ¡ ։ ׃
const QUOTE_OPEN = `["'"'«¿¡]`;
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
{ name: "hi", re: /(?:परमेश्‍?वर|यहोवा|प्रभु)\s+(?:ने\s+)?(?:कहा|बोला|पुकारा|घोषित\s+किया|वचन\s+दिया)\s*[,:।]?\s*[“"'"]?([^"'"""।]{6,400}?)(?=["'""”।]|$)/gu }];


function detectDivineQuotes(text) {
  if (!text) return [];
  const seen = new Set();
  const out = [];
  const norm = text.normalize ? text.normalize("NFC") : text;
  for (const re of [DIVINE_QUOTED, DIVINE_KJV]) {
    re.lastIndex = 0;let m;
    while ((m = re.exec(text)) !== null) {
      const q = (m[1] || "").trim();
      if (q.length > 4 && !seen.has(q)) {seen.add(q);out.push(q);}
    }
  }
  for (const { re } of LANG_ATTRIBUTIONS) {
    re.lastIndex = 0;let m;
    while ((m = re.exec(norm)) !== null) {
      const q = (m[1] || "").trim();
      if (q.length > 4 && q.length < 500 && !seen.has(q)) {seen.add(q);out.push(q);}
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
  const normalized = rawText && rawText.normalize ? rawText.normalize("NFC") : rawText;
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
  ...getGoldenWords(text)];

  // Build span list keyed by class. Apply red first (longer/sorted), then
  // divine (skip overlaps with red).
  let parts = [{ t: text, kind: null }];

  const wrap = (quotes, kind, onlyOnPlain) => {
    if (!quotes?.length) return;
    const sorted = [...quotes].sort((a, b) => b.length - a.length);
    const next = [];
    for (const p of parts) {
      if (onlyOnPlain && p.kind) {next.push(p);continue;}
      let leftover = p.t;
      let bookmark = 0;
      const segments = [];
      while (leftover.length) {
        let bestIdx = -1,bestQ = null;
        for (const q of sorted) {
          const i = leftover.indexOf(q);
          if (i !== -1 && (bestIdx === -1 || i < bestIdx)) {bestIdx = i;bestQ = q;}
        }
        if (bestIdx === -1) {segments.push({ t: leftover, kind: p.kind });break;}
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
    return /*#__PURE__*/React.createElement("span", { className: "cx-red" }, text);
  }
  wrap(redQuotes, "red", true);
  wrap(divineQuotes, "divine", true);

  return parts.map((p, i) => {
    if (p.kind === "red") return /*#__PURE__*/React.createElement("span", { key: i, className: "cx-red" }, p.t);
    if (p.kind === "divine") return /*#__PURE__*/React.createElement("span", { key: i, className: "cx-divine" }, p.t);
    return /*#__PURE__*/React.createElement(React.Fragment, { key: i }, p.t);
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
  const cancel = () => {if (timer.current) {clearTimeout(timer.current);timer.current = null;}};
  const move = (e) => {
    if (!startPos.current || !e.touches?.[0]) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - startPos.current.x) > 10 || Math.abs(t.clientY - startPos.current.y) > 10) cancel();
  };
  // Suppress the click that follows a long-press so we don't double-fire.
  const click = (e) => {if (fired.current) {e.preventDefault();e.stopPropagation();fired.current = false;}};
  return {
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: cancel,
    onTouchCancel: cancel,
    onClickCapture: click
  };
}

// Single hairline action in the reserved right gutter — never overlays text.
//   left-click  → toggle highlight in current colour
//   right-click → open full VerseMenu (mark / compare / translate / oracle / copy)
// Restrained at rest, intensifies on hover/focus. The verse itself owns the
// right-click context menu, so this stays as one quiet affordance.
function VerseActions({ onMark, onMenu, isMarked, voxText }) {
  return (/*#__PURE__*/
    React.createElement(React.Fragment, null,
    voxText ? /*#__PURE__*/React.createElement(VerseVoxBtn, { text: voxText }) : null, /*#__PURE__*/
    React.createElement("button", {
      type: "button",
      className: `cx-vmark-btn ${isMarked ? "is-on" : ""}`,
      onClick: onMark,
      onContextMenu: onMenu,
      title: isMarked ? "Click to remove highlight · right-click for menu" : "Click to highlight · right-click for menu",
      "aria-label": isMarked ? "Remove highlight" : "Highlight verse" },
    isMarked ? "★" : "☆")
    ));

}

// Inline TTS button — uses the browser's Web Speech API for one-tap verse
// playback. The full Vox panel still owns voice selection / queueing etc.;
// this is purely a "press to hear THIS verse" affordance that materialises
// on row hover. Reuses the active utterance so a second click stops it.
function VerseVoxBtn({ text }) {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => () => {
    try {window.speechSynthesis?.cancel();} catch {}
  }, []);
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const speak = (e) => {
    e.stopPropagation();
    const synth = window.speechSynthesis;
    if (on) {synth.cancel();setOn(false);return;}
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(String(text || "").trim());
      u.onend = () => setOn(false);
      u.onerror = () => setOn(false);
      synth.speak(u);
      setOn(true);
    } catch {setOn(false);}
  };
  return (/*#__PURE__*/
    React.createElement("button", {
      type: "button",
      className: `cx-vox-inline ${on ? "is-on" : ""}`,
      onClick: speak,
      title: on ? "Stop reading" : "Read aloud",
      "aria-label": on ? "Stop reading verse" : "Read verse aloud" },
    on ? "◼" : "▷"));

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
    try {window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { scriptureFont: next } }, "*");} catch {}
    // Manually flip the body class so the change is instant — App's
    // useEffect will reconcile to the same value when it next renders.
    const app = document.querySelector('.cx-app');
    if (app) {
      app.classList.remove("font-serif", "font-mono");
      app.classList.add(`font-${next}`);
    }
  };
  return (/*#__PURE__*/
    React.createElement("button", {
      type: "button",
      className: `cx-face-toggle is-${face}`,
      onClick: flip,
      title: `Scripture face · ${face} · click to switch`,
      "aria-label": `Scripture face: ${face}` }, /*#__PURE__*/

    React.createElement("span", { className: "cx-face-glyph" }, face === "serif" ? "Aa" : "Aa"), /*#__PURE__*/
    React.createElement("span", { className: "cx-face-lbl" }, face)
    ));

}

// Single-column verse — desktop right-click + mobile long-press both open
// the menu. The hover + button stays for one-tap highlight.
// ── Schizo helpers ──────────────────────────────────────────────────────
// Significant gematria values get a colored glow class. Single source of
// truth so VerseRow + VerseSideRow agree. Kept inline (no new file).
const SCHIZO_SIGNIFICANT = {
  666: "rev", 888: "gold", 358: "cyan", 144: "violet", 153: "blue",
  777: "white", 7: "accent", 12: "accent", 40: "accent", 70: "accent",
  1000: "accent", 1776: "accent"
};
function schizoCompute(text) {
  try {
    const g = window.CODEX_GEMATRIA;
    if (!g || !text) return null;
    const lang = g.detectLang(text);
    const all = g.all(text, lang);
    let primaryVal = 0,primarySys = "";
    if (lang === "hebrew") {primaryVal = all.hechrachi;primarySys = "hechrachi";} else
    if (lang === "greek") {primaryVal = all.isopsephy;primarySys = "isopsephy";} else
    {primaryVal = all.ordinal;primarySys = "ordinal";}
    return { lang, primaryVal, primarySys, all };
  } catch {return null;}
}
function SchizoMargin({ text }) {
  const info = schizoCompute(text);
  if (!info || !info.primaryVal) return null;
  const glow = SCHIZO_SIGNIFICANT[info.primaryVal] || "";
  const tip = Object.entries(info.all).
  filter(([k, v]) => k !== "lang" && typeof v === "number").
  map(([k, v]) => `${k}: ${v}`).join(" · ");
  return (/*#__PURE__*/
    React.createElement("span", { className: `cx-schizo-gem ${glow ? `is-glow is-${glow}` : ""}`, title: tip },
    info.primaryVal
    ));

}

function VerseRow({ v, isHl, isLatin, markColor, text, redLetter, primary, onSelectVerse, onToggleHighlight, onOpenVerseMenu, yhwhMode, passage, schizo }) {
  const longPress = useLongPress((rect) => onOpenVerseMenu?.(v, rect));
  const onCtx = (e) => {e.preventDefault();onOpenVerseMenu?.(v, e.currentTarget.getBoundingClientRect());};
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
  return (/*#__PURE__*/
    React.createElement("p", _extends({
      className: `cx-verse ${isHl ? "is-hl" : ""} ${isLatin ? "is-latin" : ""} ${markColor ? "is-marked" : ""}`,
      "data-mark": markColor || "",
      "data-vn": v.n,
      draggable: true,
      onDragStart: onDragStart,
      onDragEnd: onDragEnd,
      onClick: () => onSelectVerse(v.n),
      onContextMenu: onCtx },
    longPress),

    schizo ? /*#__PURE__*/React.createElement(SchizoMargin, { text: text }) : null, /*#__PURE__*/
    React.createElement("sup", {
      className: "cx-vnum",
      role: "button",
      tabIndex: 0,
      title: "Tap to highlight (long-press for color)",
      "aria-label": `Verse ${v.n}, tap to highlight`,
      onClick: (e) => {e.stopPropagation();onToggleHighlight?.(v.n);},
      onKeyDown: (e) => {if (e.key === "Enter" || e.key === " ") {e.preventDefault();e.stopPropagation();onToggleHighlight?.(v.n);}},
      onContextMenu: (e) => {e.preventDefault();e.stopPropagation();onOpenVerseMenu?.(v, e.currentTarget.closest(".cx-verse").getBoundingClientRect());} },
    v.n), /*#__PURE__*/
    React.createElement("span", { className: "cx-vtext" },
    renderScripture(text, redLetter ? v.red?.[primary] : null, redLetter && v._jesusVerse, yhwhMode)
    ), /*#__PURE__*/
    React.createElement(VerseActions, {
      onMark: (e) => {e.stopPropagation();onToggleHighlight?.(v.n);},
      onMenu: (e) => {e.stopPropagation();onOpenVerseMenu?.(v, e.currentTarget.closest(".cx-verse").getBoundingClientRect());},
      isMarked: !!markColor,
      voxText: text }
    )
    ));

}

// Side-by-side verse — same affordances applied to the row container.
function VerseSideRow({ v, colsMeta, isHl, markColor, redLetter, verseText, onSelectVerse, onToggleHighlight, onOpenVerseMenu, yhwhMode, schizo, passage }) {
  const longPress = useLongPress((rect) => onOpenVerseMenu?.(v, rect));
  const onCtx = (e) => {e.preventDefault();onOpenVerseMenu?.(v, e.currentTarget.getBoundingClientRect());};
  return (/*#__PURE__*/
    React.createElement("div", _extends({
      className: `cx-verse-row ${isHl ? "is-hl" : ""} ${markColor ? "is-marked" : ""}`,
      "data-mark": markColor || "",
      "data-vn": v.n,
      onClick: () => onSelectVerse(v.n),
      onContextMenu: onCtx },
    longPress, {
      style: { gridTemplateColumns: `repeat(${colsMeta.length}, minmax(160px,1fr))` } }),

    schizo && colsMeta[0] ? /*#__PURE__*/React.createElement(SchizoMargin, { text: verseText(v, colsMeta[0].id) }) : null,
    colsMeta.map((t, i) => {
      const text = verseText(v, t.id);
      const isLatin = t.lang === "LA";
      return (/*#__PURE__*/
        React.createElement("p", { key: t.id, className: `cx-verse cx-verse-col ${i === 0 ? "is-primary-col" : ""} ${isLatin ? "is-latin" : ""}` }, /*#__PURE__*/
        React.createElement("sup", {
          className: "cx-vnum",
          role: "button",
          tabIndex: 0,
          title: "Tap to highlight",
          onClick: (e) => {e.stopPropagation();onToggleHighlight?.(v.n);},
          onKeyDown: (e) => {if (e.key === "Enter" || e.key === " ") {e.preventDefault();e.stopPropagation();onToggleHighlight?.(v.n);}} },
        v.n), /*#__PURE__*/
        React.createElement("span", { className: "cx-vtext" },
        renderScripture(text, redLetter ? v.red?.[t.id] : null, redLetter && v._jesusVerse, yhwhMode)
        )
        ));

    }), /*#__PURE__*/
    React.createElement(VerseActions, {
      onMark: (e) => {e.stopPropagation();onToggleHighlight?.(v.n);},
      onMenu: (e) => {e.stopPropagation();onOpenVerseMenu?.(v, e.currentTarget.closest(".cx-verse-row").getBoundingClientRect());},
      isMarked: !!markColor,
      voxText: colsMeta[0] ? verseText(v, colsMeta[0].id) : "" }
    )
    ));

}

// When the gnosis layer is engaged we want passage commentary to actually
// appear *inside* the reader — not just a pill in the header. Distribute the
// existing panelData.gnosis entries as small inline cards between verses, so
// the reader becomes a meditative two-column experience: scripture + gnosis.
function gnosisInsertionPoints(verseCount, gnosisCount) {
  if (!gnosisCount || !verseCount) return new Map();
  const points = new Map(); // verseN → gnosis entry index
  for (let i = 0; i < gnosisCount; i++) {
    const at = Math.max(1, Math.round(verseCount * (i + 1) / (gnosisCount + 1)));
    points.set(at, i);
  }
  return points;
}

function GnosisInline({ entry }) {
  return (/*#__PURE__*/
    React.createElement("aside", { className: "cx-gnosis-inline", "aria-label": "Gnosis reading" }, /*#__PURE__*/
    React.createElement("header", null, /*#__PURE__*/
    React.createElement("span", { className: "cx-gnosis-inline-sigil" }, entry.sigil || "⟁"), /*#__PURE__*/
    React.createElement("span", { className: "cx-gnosis-inline-title" }, entry.title)
    ), /*#__PURE__*/
    React.createElement("p", null, entry.body), /*#__PURE__*/
    React.createElement(NormieToggle, { text: entry.body, scope: "gnosis-inline" })
    ));

}

// "Translate for normies" — rewrites dense esoteric / mystical / scholarly
// text in plain everyday language using the user's current UI language.
// Cached per text+lang so it's a one-time call. Works across every i18n
// language: Spanish, German, French, Portuguese, Latin, Hebrew, Greek,
// Hindi, anything that ships in i18n.js.
const NORMIE_LANG_LABELS = {
  en: "English", es: "Spanish", de: "German", fr: "French", pt: "Portuguese",
  la: "Latin", he: "Hebrew", el: "Greek", hi: "Hindi", it: "Italian",
  ru: "Russian", zh: "Chinese", ja: "Japanese", ko: "Korean", ar: "Arabic"
};
function normieHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = h * 31 + s.charCodeAt(i) | 0;
  return Math.abs(h).toString(36);
}
function currentUiLang() {
  try {
    if (typeof window !== "undefined") {
      if (window.CODEX_LANG) return window.CODEX_LANG;
      const stored = localStorage.getItem("codex.lang");
      if (stored) return stored;
    }
  } catch {}
  return "en";
}
function NormieToggle({ text, scope }) {
  const [open, setOpen] = React.useState(false);
  const [plain, setPlain] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const lang = currentUiLang();
  const langLabel = NORMIE_LANG_LABELS[lang] || lang || "English";
  const cacheKey = `codex.normie.${scope || "gnosis"}.${normieHash(text || "")}.${lang}`;

  React.useEffect(() => {
    if (!open || plain || !text) return;
    let cancelled = false;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {setPlain(cached);return;}
    } catch {}
    setLoading(true);
    setErr(null);
    const tweaks = window.CODEX_DATA && window.CODEX_DATA.tweaks || {};
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: tweaks.provider,
        model: tweaks.model,
        system: `You are a friendly translator who rewrites dense esoteric, mystical, or scholarly Bible commentary into clear, plain everyday language anyone can understand. Use simple, conversational wording. No jargon. Keep it short: 1-3 sentences. Output ONLY the plain version, no preamble, no quotes. Respond in ${langLabel}.`,
        messages: [{ role: "user", content: text }],
        max_tokens: 300
      })
    }).
    then((r) => r.json()).
    then((d) => {
      if (cancelled) return;
      if (d.text) {
        const out = d.text.trim();
        setPlain(out);
        try {localStorage.setItem(cacheKey, out);} catch {}
      } else {
        throw new Error(d.error || "no response");
      }
    }).
    catch((e) => {if (!cancelled) setErr(String(e.message || e));}).
    finally(() => {if (!cancelled) setLoading(false);});
    return () => {cancelled = true;};
  }, [open, text, cacheKey, langLabel]);

  if (!text) return null;
  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-normie" }, /*#__PURE__*/
    React.createElement("button", {
      type: "button",
      className: `cx-normie-btn ${open ? "is-open" : ""}`,
      onClick: () => setOpen(!open),
      title: open ? "Show original" : `Translate for normies (in ${langLabel})` },

    open ? "↺ original" : `🪶 plain version · ${lang}`
    ),
    open ? /*#__PURE__*/
    React.createElement("div", { className: "cx-normie-out" },
    loading ? /*#__PURE__*/React.createElement("em", null, "plain-talking\u2026") :
    err ? /*#__PURE__*/React.createElement("em", { className: "cx-normie-err" }, "\u26A0 ", err) :
    plain ? /*#__PURE__*/React.createElement("p", null, plain) :
    null
    ) :
    null
    ));

}
// Expose so other modules (panels.jsx) can use it without re-import.
if (typeof window !== "undefined") window.CODEX_NormieToggle = NormieToggle;

// Single popover that holds every reader-view toggle: red-letter, YHWH,
// font size, scripture face, side-by-side. Replaces the 5-button strip
// in the reader head with one ⊕ that opens a tidy panel below.
function ReaderViewPopover({
  redLetter, onToggleRedLetter,
  yhwhMode, onToggleYHWH,
  fontScale, onCycleFontSize,
  sideBySide, onToggleSideBySide
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const popRef = useRef(null);
  // The popover is portaled to <body> and viewport-FIXED so it can never be
  // clipped by an overflow:hidden ancestor (the reader frame) — visible no
  // matter the verse or platform. Clamp on-screen + cap height (scrolls).
  useEffect(() => {
    if (!open) {setPos(null);return;}
    const measure = () => {
      const r = ref.current && ref.current.getBoundingClientRect();
      if (!r) return;
      const W = 240,M = 8;
      const left = Math.max(M, Math.min(r.right - W, window.innerWidth - W - M));
      const top = Math.min(r.bottom + 6, window.innerHeight - 120);
      const maxH = Math.max(140, window.innerHeight - top - 12);
      setPos({ top, left, width: W, maxH });
    };
    measure();
    const onDown = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (popRef.current && popRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {if (e.key === "Escape") setOpen(false);};
    const t = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {clearTimeout(t);document.removeEventListener("mousedown", onDown);document.removeEventListener("keydown", onKey);window.removeEventListener("resize", measure);window.removeEventListener("scroll", measure, true);};
  }, [open]);
  // Surface a tiny indicator dot when at least one non-default toggle is on.
  const anyOn = redLetter || yhwhMode || sideBySide || fontScale !== 22;
  return (/*#__PURE__*/
    React.createElement("span", { className: "cx-vp", ref: ref }, /*#__PURE__*/
    React.createElement("button", {
      type: "button",
      className: `cx-vp-trigger ${open ? "is-open" : ""} ${anyOn ? "is-tweaked" : ""}`,
      onClick: () => setOpen((o) => !o),
      title: "View options",
      "aria-label": "View options",
      "aria-expanded": open }, /*#__PURE__*/

    React.createElement("span", { className: "cx-vp-trigger-glyph" }, "Aa"),
    anyOn ? /*#__PURE__*/React.createElement("i", { className: "cx-vp-trigger-dot" }) : null
    ),
    open && pos && window.ReactDOM && window.ReactDOM.createPortal ? window.ReactDOM.createPortal(/*#__PURE__*/
      React.createElement("div", { ref: popRef, className: "cx-vp-pop", role: "dialog", "aria-label": "Reading view options",
        style: { position: 'fixed', top: pos.top + 'px', left: pos.left + 'px', right: 'auto', width: pos.width + 'px', maxHeight: pos.maxH + 'px', overflowY: 'auto' } }, /*#__PURE__*/
      React.createElement("div", { className: "cx-vp-row", style: { minHeight: 44 } }, /*#__PURE__*/
      React.createElement("span", { className: "cx-vp-lbl" }, tx("size")), /*#__PURE__*/
      React.createElement("button", { className: "cx-vp-stepper", onClick: onCycleFontSize, title: "Cycle text size", style: { minHeight: 44 } }, /*#__PURE__*/
      React.createElement("span", { className: "cx-vp-stepper-letter" }, "Aa"), /*#__PURE__*/
      React.createElement("span", { className: "cx-vp-stepper-num" }, fontScale)
      )
      ), /*#__PURE__*/
      React.createElement("div", { className: "cx-vp-row", style: { minHeight: 44 } }, /*#__PURE__*/
      React.createElement("span", { className: "cx-vp-lbl" }, tx("face")), /*#__PURE__*/
      React.createElement(FaceToggle, null)
      ), /*#__PURE__*/
      React.createElement("div", { className: "cx-vp-row", style: { minHeight: 44, cursor: 'pointer' }, onClick: onToggleRedLetter, role: "none" }, /*#__PURE__*/
      React.createElement("span", { className: "cx-vp-lbl" }, tx("red_letter")), /*#__PURE__*/
      React.createElement("button", {
        type: "button",
        className: `cx-vp-toggle ${redLetter ? "is-on" : ""}`,
        onClick: (e) => {e.stopPropagation();onToggleRedLetter && onToggleRedLetter();},
        role: "switch",
        "aria-checked": redLetter,
        "aria-label": "Red letter mode" }, /*#__PURE__*/
      React.createElement("i", null))
      ), /*#__PURE__*/
      React.createElement("div", { className: "cx-vp-row", style: { minHeight: 44, cursor: 'pointer' }, onClick: onToggleYHWH, role: "none" }, /*#__PURE__*/
      React.createElement("span", { className: "cx-vp-lbl", title: "Show the Tetragrammaton in place of LORD" }, "\u05D9\u05D4\u05D5\u05D4"), /*#__PURE__*/
      React.createElement("button", {
        type: "button",
        className: `cx-vp-toggle ${yhwhMode ? "is-on" : ""}`,
        onClick: (e) => {e.stopPropagation();onToggleYHWH && onToggleYHWH();},
        role: "switch",
        "aria-checked": yhwhMode,
        "aria-label": "YHWH mode" }, /*#__PURE__*/
      React.createElement("i", null))
      ), /*#__PURE__*/
      React.createElement("div", { className: "cx-vp-row", style: { minHeight: 44, cursor: 'pointer' }, onClick: onToggleSideBySide, role: "none" }, /*#__PURE__*/
      React.createElement("span", { className: "cx-vp-lbl" }, tx("side_by_side")), /*#__PURE__*/
      React.createElement("button", {
        type: "button",
        className: `cx-vp-toggle ${sideBySide ? "is-on" : ""}`,
        onClick: (e) => {e.stopPropagation();onToggleSideBySide && onToggleSideBySide();},
        role: "switch",
        "aria-checked": sideBySide,
        "aria-label": "Side by side mode" }, /*#__PURE__*/
      React.createElement("i", null))
      )
      ),
      document.body) : null
    ));

}

// ── Quick translation switcher ─────────────────────────────────────
// Repurposes the existing display pills (KJV · EN · 1611) as a single
// clickable affordance that opens an inline language-grouped picker.
// No extra controls in the header — same pill, now interactive.
function QuickTranslationSwitcher({ primary, primaryMeta }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {if (!ref.current?.contains(e.target)) setOpen(false);};
    const onKey = (e) => {if (e.key === "Escape") setOpen(false);};
    const t = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    document.addEventListener("keydown", onKey);
    return () => {clearTimeout(t);document.removeEventListener("mousedown", onDown);document.removeEventListener("keydown", onKey);};
  }, [open]);
  const data = window.CODEX_DATA || {};
  const trans = data.translations || [];
  const grouped = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const filt = needle ?
    trans.filter((t) =>
    t.name.toLowerCase().includes(needle) ||
    (t.id || "").toLowerCase().includes(needle) ||
    (t.lang || "").toLowerCase().includes(needle)) :
    trans;
    const map = new Map();
    filt.forEach((t) => {
      const k = t.lang || "??";
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(t);
    });
    return [...map.entries()];
  }, [trans, filter]);
  const pick = (id) => {
    try {window.dispatchEvent(new CustomEvent("codex:set-primary", { detail: { id } }));} catch {}
    setOpen(false);
    setFilter("");
  };
  return (/*#__PURE__*/
    React.createElement("span", { className: "cx-qts", ref: ref }, /*#__PURE__*/
    React.createElement("button", {
      type: "button",
      className: `cx-qts-trigger ${open ? "is-open" : ""}`,
      onClick: () => setOpen((o) => !o),
      title: "Switch translation",
      "aria-label": "Switch translation",
      "aria-expanded": open }, /*#__PURE__*/

    React.createElement("span", { className: "cx-qts-glyph" }, primaryMeta.glyph), /*#__PURE__*/
    React.createElement("span", { className: "cx-qts-sub" }, primaryMeta.lang, " \xB7 ", primaryMeta.year), /*#__PURE__*/
    React.createElement("span", { className: "cx-qts-caret" }, "\u25BE")
    ),
    open ? /*#__PURE__*/
    React.createElement("div", { className: "cx-qts-pop", role: "dialog", "aria-label": "Pick a translation" }, /*#__PURE__*/
    React.createElement("input", {
      className: "cx-qts-filter",
      placeholder: "Filter\u2026",
      value: filter,
      onChange: (e) => setFilter(e.target.value),
      autoFocus: true,
      spellCheck: false }
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-qts-list" },
    grouped.map(([lang, items]) => /*#__PURE__*/
    React.createElement(React.Fragment, { key: lang }, /*#__PURE__*/
    React.createElement("div", { className: "cx-qts-lang" }, lang),
    items.map((t) => /*#__PURE__*/
    React.createElement("button", {
      key: t.id,
      type: "button",
      className: `cx-qts-row ${t.id === primary ? "is-current" : ""}`,
      onClick: () => pick(t.id) }, /*#__PURE__*/

    React.createElement("span", { className: "cx-qts-row-glyph" }, t.glyph), /*#__PURE__*/
    React.createElement("span", { className: "cx-qts-row-name" }, t.name), /*#__PURE__*/
    React.createElement("span", { className: "cx-qts-row-year" }, t.year)
    )
    )
    )
    ),
    !grouped.length ? /*#__PURE__*/React.createElement("div", { className: "cx-qts-empty" }, "no match") : null
    )
    ) :
    null
    ));

}

// ── Chapter grid popover (used by the pager center "X of Y") ─────────
function ChapterGridPopover({ bookId, totalChapters, currentChapter, anchorRect, onPick, onClose }) {
  const popRef = useRef(null);
  useEffect(() => {
    const onDown = (e) => {if (!popRef.current?.contains(e.target)) onClose();};
    const onKey = (e) => {if (e.key === "Escape") onClose();};
    const t = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    document.addEventListener("keydown", onKey);
    return () => {clearTimeout(t);document.removeEventListener("mousedown", onDown);document.removeEventListener("keydown", onKey);};
  }, [onClose]);
  const style = anchorRect ? {
    position: "fixed",
    left: Math.max(8, Math.min(window.innerWidth - 320, anchorRect.left + anchorRect.width / 2 - 160)),
    bottom: Math.max(8, window.innerHeight - anchorRect.top + 8),
    zIndex: 200
  } : { position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)", zIndex: 200 };
  return (/*#__PURE__*/
    React.createElement("div", { ref: popRef, className: "cx-pager-grid-pop", style: style, role: "dialog", "aria-label": `Chapter grid for ${bookId}` }, /*#__PURE__*/
    React.createElement("div", { className: "cx-pager-grid-h" }, bookId.toUpperCase(), " \xB7 ", totalChapters, " chapters"), /*#__PURE__*/
    React.createElement("div", { className: "cx-pager-grid" },
    Array.from({ length: totalChapters }, (_, i) => i + 1).map((ch) => /*#__PURE__*/
    React.createElement("button", {
      key: ch,
      type: "button",
      className: `cx-pager-grid-ch ${ch === currentChapter ? "is-current" : ""}`,
      onClick: () => {onPick(ch);onClose();} },
    ch)
    )
    )
    ));

}

function Reader({ passage, primary, compareTranslations, sideBySide, gnosisOn, redLetter,
  fontScale, highlightedVerse, onSelectVerse, onToggleSideBySide,
  onToggleRedLetter, onCycleFontSize, onPrevChapter, onNextChapter,
  highlights, highlightColor, onToggleHighlight, onOpenVerseMenu,
  panelData, yhwhMode, onToggleYHWH, schizo }) {
  const bodyRef = useRef(null);
  const [chapterGridAnchor, setChapterGridAnchor] = useState(null);
  // Swipe / horizontal-scroll-to-navigate. Tracks touch + trackpad
  // wheel deltas; left ≥ threshold = next chapter, right = prev. Suppresses
  // when an inner carousel (mobile side-by-side) owns horizontal scrolling.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    let x0 = null,y0 = null,dxAcc = 0,lastWheelAt = 0,dispatched = false;
    const THRESH = 60; // px to trigger
    const Y_LOCKOUT = 50; // vertical movement that aborts horizontal intent
    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];x0 = t.clientX;y0 = t.clientY;dispatched = false;
    };
    const onTouchMove = (e) => {
      if (x0 == null || dispatched) return;
      const t = e.touches[0];
      const dx = t.clientX - x0,dy = t.clientY - y0;
      if (Math.abs(dy) > Y_LOCKOUT && Math.abs(dy) > Math.abs(dx)) {x0 = null;return;}
      if (Math.abs(dx) > THRESH) {
        if (dx < 0) onNextChapter && onNextChapter();else
        onPrevChapter && onPrevChapter();
        dispatched = true;x0 = null;
      }
    };
    const onTouchEnd = () => {x0 = null;y0 = null;dispatched = false;};
    // Trackpad horizontal scroll (deltaX). Coalesce over 220ms so a
    // single firm swipe = one chapter, not seven.
    const onWheel = (e) => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return; // vertical wheel
      const now = Date.now();
      if (now - lastWheelAt > 220) dxAcc = 0;
      lastWheelAt = now;
      dxAcc += e.deltaX;
      if (Math.abs(dxAcc) > 80) {
        if (dxAcc > 0) onNextChapter && onNextChapter();else
        onPrevChapter && onPrevChapter();
        dxAcc = 0;
      }
    };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, [onPrevChapter, onNextChapter]);

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
  const compareCols = sideBySide ?
  [primary, ...compareTranslations.filter((t) => t !== primary)] :
  [primary];
  // Mobile compare carousel — when sideBySide is on AND the viewport is
  // narrow, swap the grid for a horizontal scroll-snap carousel of full-
  // width columns. Desktop side-by-side is untouched.
  const [isNarrow, setIsNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 640px)").matches);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 640px)");
    const onChange = () => setIsNarrow(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);else
    mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);else
      mq.removeListener(onChange);
    };
  }, []);
  const useCarousel = sideBySide && isNarrow && compareCols.length > 1;
  const carouselRef = useRef(null);
  const [carIdx, setCarIdx] = useState(0);
  useEffect(() => {
    if (!useCarousel) return;
    const el = carouselRef.current;
    if (!el) return;
    const onScroll = () => {
      const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      if (i !== carIdx) setCarIdx(i);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [useCarousel, carIdx, compareCols.length]);

  const colsMeta = compareCols.map((id) => data.translations.find((t) => t.id === id)).filter(Boolean);
  const primaryMeta = data.translations.find((t) => t.id === primary) || data.translations[0];
  const bookMeta = data.books.find((b) => b.id === passage.bookId);
  const totalChapters = bookMeta?.chapters || 1;

  const idx = data.books.findIndex((b) => b.id === passage.bookId);
  const prevLabel = passage.chapter > 1 ?
  `${passage.book.toUpperCase()} ${passage.chapter - 1}` :
  idx > 0 ? `${data.books[idx - 1].name.toUpperCase()} ${data.books[idx - 1].chapters}` : "";
  const nextLabel = passage.chapter < totalChapters ?
  `${passage.book.toUpperCase()} ${passage.chapter + 1}` :
  idx < data.books.length - 1 ? `${data.books[idx + 1].name.toUpperCase()} 1` : "";

  // Pick a text out of a verse, falling back gracefully if a translation
  // failed to load for that verse.
  const verseText = (v, tId) => v[tId] || v.kjv || v.web || v.bbe || "";

  // Versification differs across traditions (Vulgate/LXX Psalm 39 is
  // Masoretic Psalm 40, etc.), so the merged verse list can carry verse
  // numbers that simply don't exist in the translation being displayed.
  // Showing them as blank rows reads as a bug — drop them per view. If the
  // filter would empty the list (the displayed translation failed to load
  // entirely), keep the unfiltered list so the rescue chain still paints.
  const versesFor = (tId) => {
    const vis = passage.verses.filter((v) => verseText(v, tId));
    return vis.length ? vis : passage.verses;
  };

  return (/*#__PURE__*/
    React.createElement("main", { className: "cx-reader" }, /*#__PURE__*/
    React.createElement(CornerFrame, { label: `${passage.book.toUpperCase()} · CH ${passage.chapter} · ${
      // Count only verses present in the ACTIVE translation so the badge
      // reflects what the reader actually sees (e.g. Septuagint may have
      // more verses than KJV in some chapters; Vulgate fewer). Fall back
      // to the merged total if the primary somehow didn't load.
      passage.verses.filter((v) => v[primary] != null && v[primary] !== "").length ||
      passage.verses.length || "—"} VV` }, /*#__PURE__*/

    React.createElement("div", { className: "cx-reader-head" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-reader-titles" }, /*#__PURE__*/
    React.createElement("h1", {
      role: "button",
      tabIndex: 0,
      title: "Open the Library",
      onClick: () => {try {window.dispatchEvent(new CustomEvent("codex:open-library"));} catch {}},
      onKeyDown: (e) => {if (e.key === "Enter" || e.key === " ") {e.preventDefault();try {window.dispatchEvent(new CustomEvent("codex:open-library"));} catch {}}} },
    passage.title || `${passage.book} ${passage.chapter}`),
    passage.subtitle ? /*#__PURE__*/React.createElement("p", null, passage.subtitle) : null
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-reader-meta" }, /*#__PURE__*/
    React.createElement(QuickTranslationSwitcher, { primary: primary, primaryMeta: primaryMeta }),
    gnosisOn ? /*#__PURE__*/React.createElement(Pill, { accent: true }, "\u27C1") : null, /*#__PURE__*/
    React.createElement(ReaderViewPopover, {
      redLetter: redLetter, onToggleRedLetter: onToggleRedLetter,
      yhwhMode: yhwhMode, onToggleYHWH: onToggleYHWH,
      fontScale: fontScale, onCycleFontSize: onCycleFontSize,
      sideBySide: sideBySide, onToggleSideBySide: onToggleSideBySide }
    )
    )
    ),

    sideBySide && colsMeta.length > 1 ? /*#__PURE__*/
    React.createElement("div", { className: "cx-cols-head", style: { gridTemplateColumns: `repeat(${colsMeta.length}, minmax(160px,1fr))` } },
    colsMeta.map((t, i) => /*#__PURE__*/
    React.createElement("div", { key: t.id, className: `cx-col-h ${i === 0 ? "is-primary" : ""}` }, /*#__PURE__*/
    React.createElement("span", { className: "cx-col-h-glyph" }, t.glyph), /*#__PURE__*/
    React.createElement("div", null, /*#__PURE__*/
    React.createElement("b", null, t.name), /*#__PURE__*/
    React.createElement("span", null, t.year, " \xB7 ", t.lang)
    )
    )
    )
    ) :
    null, /*#__PURE__*/

    React.createElement("div", {
      ref: (el) => {bodyRef.current = el;if (useCarousel) carouselRef.current = el;else carouselRef.current = null;},
      className: `cx-reader-body ${sideBySide ? "is-cols" : ""} ${useCarousel ? "is-carousel" : ""}`,
      style: { "--cx-fs": `${fontScale}px` } },

    passage.loading ? /*#__PURE__*/
    React.createElement("div", { className: "cx-loading" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-loading-orb" }), /*#__PURE__*/
    React.createElement("span", null, "RETRIEVING \xB7 ", passage.book, " ", passage.chapter, " \xB7 across ", compareCols.length, " translation", compareCols.length === 1 ? "" : "s", "\u2026")
    ) :
    passage.error ? /*#__PURE__*/
    React.createElement("div", { className: "cx-loading is-err" }, /*#__PURE__*/
    React.createElement("span", null, "\u26A0 FETCH FAILED"), /*#__PURE__*/
    React.createElement("code", null, passage.error), /*#__PURE__*/
    React.createElement("span", { style: { opacity: .6, fontSize: 11 } }, "check connection \xB7 cached chapters still readable")
    ) :
    passage.verses.length === 0 ? /*#__PURE__*/
    React.createElement("div", { className: "cx-loading" }, "\u2014 no verses returned \u2014") :
    useCarousel ?
    colsMeta.map((tMeta) => /*#__PURE__*/
    React.createElement("div", { key: `page-${tMeta.id}`, className: "cx-carousel-page" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-col-h", style: { padding: "8px 12px", borderBottom: "1px solid var(--cx-line)" } }, /*#__PURE__*/
    React.createElement("span", { className: "cx-col-h-glyph" }, tMeta.glyph), /*#__PURE__*/
    React.createElement("div", null, /*#__PURE__*/React.createElement("b", null, tMeta.name), " ", /*#__PURE__*/React.createElement("span", { style: { opacity: .6 } }, "\xB7 ", tMeta.year, " \xB7 ", tMeta.lang))
    ),
    versesFor(tMeta.id).map((v) => /*#__PURE__*/
    React.createElement(VerseRow, {
      key: `v${v.n}-${tMeta.id}`,
      v: v,
      isHl: highlightedVerse === v.n,
      isLatin: tMeta.lang === "LA",
      markColor: highlights ? highlights[`${passage.bookId}.${passage.chapter}.${v.n}`]?.color : null,
      text: verseText(v, tMeta.id),
      redLetter: redLetter,
      primary: tMeta.id,
      onSelectVerse: onSelectVerse,
      onToggleHighlight: onToggleHighlight,
      onOpenVerseMenu: onOpenVerseMenu,
      yhwhMode: yhwhMode,
      passage: passage,
      schizo: schizo }
    )
    )
    )
    ) :
    sideBySide && colsMeta.length > 1 ?
    (() => {
      const gnosisEntries = gnosisOn && panelData?.gnosis ? panelData.gnosis : [];
      // Keep a row when ANY visible column has text — empty cells in
      // one column are meaningful in a comparison (numbering gaps).
      const rows = passage.verses.filter((v) => colsMeta.some((t) => verseText(v, t.id)));
      const points = gnosisInsertionPoints(rows.length, gnosisEntries.length);
      return rows.flatMap((v, vi) => {
        const out = [/*#__PURE__*/
        React.createElement(VerseSideRow, {
          key: `v${v.n}`,
          v: v,
          colsMeta: colsMeta,
          isHl: highlightedVerse === v.n,
          markColor: highlights ? highlights[`${passage.bookId}.${passage.chapter}.${v.n}`]?.color : null,
          redLetter: redLetter,
          verseText: verseText,
          onSelectVerse: onSelectVerse,
          onToggleHighlight: onToggleHighlight,
          onOpenVerseMenu: onOpenVerseMenu,
          yhwhMode: yhwhMode,
          passage: passage,
          schizo: schizo }
        )];

        if (points.has(vi + 1)) {
          const idx = points.get(vi + 1);
          out.push(/*#__PURE__*/React.createElement(GnosisInline, { key: `g${idx}`, entry: gnosisEntries[idx] }));
        }
        return out;
      });
    })() :

    (() => {
      const gnosisEntries = gnosisOn && panelData?.gnosis ? panelData.gnosis : [];
      const rows = versesFor(primary);
      const points = gnosisInsertionPoints(rows.length, gnosisEntries.length);
      return rows.flatMap((v, vi) => {
        const out = [/*#__PURE__*/
        React.createElement(VerseRow, {
          key: `v${v.n}`,
          v: v,
          isHl: highlightedVerse === v.n,
          isLatin: primaryMeta.lang === "LA",
          markColor: highlights ? highlights[`${passage.bookId}.${passage.chapter}.${v.n}`]?.color : null,
          text: verseText(v, primary),
          redLetter: redLetter,
          primary: primary,
          onSelectVerse: onSelectVerse,
          onToggleHighlight: onToggleHighlight,
          onOpenVerseMenu: onOpenVerseMenu,
          yhwhMode: yhwhMode,
          passage: passage,
          schizo: schizo }
        )];

        if (points.has(vi + 1)) {
          const idx = points.get(vi + 1);
          out.push(/*#__PURE__*/React.createElement(GnosisInline, { key: `g${idx}`, entry: gnosisEntries[idx] }));
        }
        return out;
      });
    })()

    ),

    useCarousel ? /*#__PURE__*/
    React.createElement("div", { className: "cx-carousel-dots", role: "tablist", "aria-label": "Translation pages" },
    colsMeta.map((tMeta, i) => /*#__PURE__*/
    React.createElement("button", {
      key: tMeta.id,
      type: "button",
      className: `cx-carousel-dot ${i === carIdx ? "is-on" : ""}`,
      "aria-label": `Show ${tMeta.name}`,
      onClick: () => {
        const el = carouselRef.current;
        if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
      } }
    )
    )
    ) :
    null, /*#__PURE__*/

    React.createElement("div", { className: "cx-reader-foot" }, /*#__PURE__*/
    React.createElement("button", { className: "cx-nav-btn", onClick: onPrevChapter, disabled: !prevLabel, title: prevLabel || "Beginning", "aria-label": `Previous: ${prevLabel || "Beginning"}` }, /*#__PURE__*/
    React.createElement("span", { className: "cx-nav-arrow", "aria-hidden": "true" }, "\u2039"), /*#__PURE__*/
    React.createElement("span", { className: "cx-nav-btn-label" }, prevLabel || "")
    ), /*#__PURE__*/
    React.createElement("button", {
      type: "button",
      className: "cx-reader-progress",
      title: "Jump to chapter",
      "aria-label": `Jump to chapter in ${passage.book}`,
      onClick: (e) => setChapterGridAnchor(e.currentTarget.getBoundingClientRect()) }, /*#__PURE__*/

    React.createElement("span", null, passage.chapter, " of ", totalChapters), /*#__PURE__*/
    React.createElement("div", { className: "cx-prog" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-prog-fill", style: { width: `${passage.chapter / totalChapters * 100}%` } })
    )
    ),
    chapterGridAnchor ? /*#__PURE__*/
    React.createElement(ChapterGridPopover, {
      bookId: passage.bookId,
      totalChapters: totalChapters,
      currentChapter: passage.chapter,
      anchorRect: chapterGridAnchor,
      onPick: (ch) => {
        try {window.dispatchEvent(new CustomEvent("codex:jump-ref", { detail: { ref: `${passage.bookId}.${ch}.1` } }));} catch {}
      },
      onClose: () => setChapterGridAnchor(null) }
    ) :
    null, /*#__PURE__*/
    React.createElement("button", { className: "cx-nav-btn", onClick: onNextChapter, disabled: !nextLabel, title: nextLabel || "End", "aria-label": `Next: ${nextLabel || "End"}` }, /*#__PURE__*/
    React.createElement("span", { className: "cx-nav-btn-label" }, nextLabel || ""), /*#__PURE__*/
    React.createElement("span", { className: "cx-nav-arrow", "aria-hidden": "true" }, "\u203A")
    )
    )
    )
    ));

}

Object.assign(window, {
  useState, useEffect, useMemo, useRef, useCallback,
  useSolarClock, fmtClock, fmtDate, pad,
  CornerFrame, Pill, Tick,
  StatusBar, LeftRail, Reader
});
})();
