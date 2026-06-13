// wm.js — CODEX window manager. Turns the depth-surface consoles (Mirror,
// Map, Art, Compare, Help) from centered modals into real workspace windows:
// drag by the header, resize from any edge or corner, snap to half-screen at
// the left/right edges, maximize at the top edge (or double-click the
// header), focus-to-front, and per-console geometry that persists across
// sessions. Multiple consoles can be open and interleaved at once — the
// backdrop no longer blocks the app behind a window.
//
// Design constraints:
//   · Zero deps, zero build. Attaches to the EXISTING React-rendered DOM via
//     MutationObserver; never fights React (only touches inline styles and
//     appends WM-owned nodes, which reconciliation leaves alone).
//   · Desktop only — (min-width: 881px) and (pointer: fine). Phones keep the
//     full-screen console layout untouched.
//   · Butter: geometry is applied inside requestAnimationFrame; transitions
//     are disabled while dragging and enabled only for snaps.
//   · Closing stays the console's own job (its × button / ESC). The WM never
//     owns lifecycle, only geometry.
(function () {
  "use strict";
  if (window.__CXWM) return;
  window.__CXWM = true;

  var MQ = null;
  try { MQ = window.matchMedia("(min-width: 881px) and (pointer: fine)"); } catch (_) {}
  function active() { return !!(MQ && MQ.matches); }

  // Console registry — backdrop holds the stacking layer, card is the window,
  // head is the drag handle. min is [w, h].
  var SPECS = [
    { id: "mirror", backdrop: "cx-mirror-backdrop", card: ".cx-mirror", head: ".cx-mirror-h", min: [600, 420] },
    { id: "map",    backdrop: "cx-map-backdrop",    card: ".cx-map",    head: ".cx-map-h",    min: [600, 440] },
    { id: "art",    backdrop: "cx-art-backdrop",    card: ".cx-art",    head: ".cx-art-h",    min: [500, 380] },
    { id: "cmp",    backdrop: "cx-cmp-backdrop",    card: ".cx-cmp",    head: ".cx-cmp-h",    min: [500, 340] },
    { id: "sword",  backdrop: "cx-sword-backdrop",  card: ".cx-sword",  head: ".cx-sword-h",  min: [640, 460] },
    { id: "ops",    backdrop: "cx-ops-backdrop",    card: ".cx-ops",    head: ".cx-ops-h",    min: [720, 480] },
    { id: "const",  backdrop: "cx-const-backdrop",  card: ".cx-const",  head: ".cx-const-h",  min: [720, 600] },
    // v8 MONAD — the generic window class (winhost.jsx): any plugin panel
    // floats here; instance identity rides data-wm-id on the backdrop.
    { id: "win",    backdrop: "cx-win-backdrop",    card: ".cx-win",    head: ".cx-win-h",    min: [380, 320] }
  ];

  // ── Dock — the running-windows strip. Renders only while ≥1 window is
  // open (no idle ambient chrome — ambient surfaces must be closable, and
  // the cleanest closable is one that isn't there). Click: focus; click the
  // focused window's chip: minimize; click a minimized chip: restore.
  var DOCK_GLYPH = { mirror: "⌬", map: "◎", art: "▦", cmp: "≡", sword: "⚔", ops: "❖", const: "❂" };

  // ── v11.5 LINE ICONS — every dock chip wears a tiny inline-SVG line glyph
  // instead of a cryptic Unicode rune. Stroke = currentColor so themes +
  // hover + is-focus light them for free; 18×18 viewBox, 1.6 stroke, round
  // caps — one elegant visual language that reads at a glance WITHOUT a
  // tutorial. Tokens only (no fills, no color literals). Keyed by chip id;
  // ids without an icon fall back to their text glyph.
  function svg(paths) {
    return '<svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" ' +
      'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }
  var DOCK_ICON = {
    // reader — an open book
    reader:  svg('<path d="M9 4.5C7.5 3.5 5 3.3 3 4v9.5c2-.7 4.5-.5 6 .5"/><path d="M9 4.5c1.5-1 4-1.2 6-.5v9.5c-2-.7-4.5-.5-6 .5z"/>'),
    // library — stacked book spines
    library: svg('<rect x="3" y="3" width="3.2" height="12" rx="0.6"/><rect x="7.4" y="3" width="3.2" height="12" rx="0.6"/><path d="M12.2 4.2l2.9.8-2.4 11-2.9-.8"/>'),
    // oracle — eye / lens
    oracle:  svg('<path d="M1.8 9S4.5 4 9 4s7.2 5 7.2 5-2.7 5-7.2 5S1.8 9 1.8 9z"/><circle cx="9" cy="9" r="2.1"/>'),
    // marks — bookmark
    marks:   svg('<path d="M5 3h8v12l-4-2.8L5 15z"/>'),
    // translations — two speech glyphs / A↔文
    trans:   svg('<path d="M3 5h6"/><path d="M6 5v2.5c0 2.5-1.4 4-3 4.7"/><path d="M5 9.5c.8 1.4 2.2 2.3 4 2.8"/><path d="M10.5 15l2.8-7 2.7 7"/><path d="M11.4 13h3.8"/>'),
    talmud:  svg('<path d="M9 4v11"/><path d="M9 5.2C7.8 4.3 5.6 4.1 4 4.6v9.2c1.6-.5 3.8-.3 5 .6"/><path d="M9 5.2c1.2-.9 3.4-1.1 5-.6v9.2c-1.6-.5-3.8-.3-5 .6"/>'),
    comm:    svg('<path d="M3 4.5h12v7.5H8.5L5 15v-3H3z"/><path d="M6 7.5h6"/><path d="M6 9.6h4"/>'),
    gem:     svg('<path d="M5.5 3h7l3 4-6.5 8L2.5 7z"/><path d="M2.5 7h13"/><path d="M6.5 3 9 15l2.5-12"/>'),
    gnosis:  svg('<circle cx="9" cy="9" r="6"/><path d="M9 3v12"/><path d="M9 9l4.2 4.2"/><path d="M9 9 4.8 13.2"/>'),
    disarm:  svg('<path d="M5 13.5 13 5.5"/><path d="M11.5 4 14 6.5"/><path d="M3.5 11.5 6 14"/><path d="M5 13.5l-1.6 1.6"/><path d="M13 5.5 14.6 3.9"/>'),
    exeg:    svg('<path d="M11.5 3.5 14.5 6.5 6 15H3v-3z"/><path d="M10 5 13 8"/>'),
    txan:    svg('<path d="M3 9h12"/><path d="M5.5 6.5 3 9l2.5 2.5"/><path d="M12.5 6.5 15 9l-2.5 2.5"/>'),
    omni:    svg('<circle cx="8" cy="8" r="4.5"/><path d="M11.5 11.5 15 15"/>'),
    canon:   svg('<circle cx="9" cy="9" r="1.4"/><circle cx="3.5" cy="5" r="1"/><circle cx="14.5" cy="5.5" r="1"/><circle cx="5" cy="14" r="1"/><circle cx="13.5" cy="13" r="1"/><path d="M8 8 4.3 5.4M10 8.2 13.7 6M8.2 10.2 5.6 13.2M10 10.1 12.8 12.3"/>'),
    sword:   svg('<path d="M13.5 3.5 7 10l1.5 1.5L15 5z"/><path d="M7 10l-3.5.5L4 14l.5.5L8 14 9.5 12.5"/><path d="M3.5 14.5 6 12"/>'),
    displays: svg('<rect x="2.5" y="3.5" width="9" height="7" rx="1"/><rect x="9" y="8" width="6.5" height="5" rx="1"/><path d="M6 12.5h3"/>'),
    arrange: svg('<rect x="3" y="3" width="5" height="5" rx="0.8"/><rect x="10" y="3" width="5" height="5" rx="0.8"/><rect x="3" y="10" width="5" height="5" rx="0.8"/><rect x="10" y="10" width="5" height="5" rx="0.8"/>'),
    edit:    svg('<path d="M3 9h12"/><circle cx="6.5" cy="9" r="1.6" fill="currentColor" stroke="none"/><path d="M3 5h12"/><circle cx="11" cy="5" r="1.6" fill="currentColor" stroke="none"/><path d="M3 13h12"/><circle cx="8.5" cy="13" r="1.6" fill="currentColor" stroke="none"/>'),
    continue: svg('<path d="M9 3a6 6 0 1 0 6 6"/><path d="M15 3v3.5h-3.5"/>'),
    // window-header controls
    min:     svg('<path d="M4 13h10"/>'),
    popout:  svg('<path d="M7 4H4v10h10v-3"/><path d="M10 4h4v4"/><path d="M8.5 9.5 14 4"/>'),
    close:   svg('<path d="M5 5l8 8"/><path d="M13 5l-8 8"/>')
  };
  function chipGlyphHTML(id, fallbackGlyph) {
    return DOCK_ICON[id] || ('<span class="cx-wm-glyph-txt">' + (fallbackGlyph || "▣") + "</span>");
  }
  var dockEl = null;
  var dockWins = []; // [{ key, id, backdrop, card, front }]

  // ── Dock v2 (OS·7 NOCTURNE) — while body.cx-os7 is on, the dock doubles
  // as the LAUNCHER: always rendered on desktop, fixed launch chips first,
  // a hairline divider, then the running-window chips. With os7 off the
  // dock keeps the original behavior exactly (windows-only, no launchers).
  function os7on() {
    return !!(document.body && document.body.classList.contains("cx-os7"));
  }
  var DOCK_LAUNCH = [
    { glyph: "⌘", label: "OMNI", title: "Omnibar (⌘K)", run: function () {
      if (typeof window.codexOpenOmni === "function") window.codexOpenOmni();
    } },
    { glyph: "❖", label: "OPS", title: "Open OPS console", run: function () {
      if (typeof window.codexOpenOps === "function") window.codexOpenOps("");
    } },
    { glyph: "❂", label: "CANON", title: "Open canon constellation", run: function () {
      if (typeof window.codexOpenConstellation === "function") window.codexOpenConstellation();
    } },
    { glyph: "◬", label: "ORACLE", title: "Open library · Oracle", run: function () {
      try {
        window.dispatchEvent(new CustomEvent("codex:open-library"));
        window.dispatchEvent(new CustomEvent("codex:shortcut", { detail: { action: "toggle-oracle" } }));
      } catch (_) {}
    } }
  ];

  // ── Dock v3 (OS·7 ACTION) — the launcher row becomes an ACTION BAR bound
  // to the current verse. app.jsx keeps window.CODEX_NOW fresh and fires
  // 'codex:now'; the chips act on that ref via the existing 'codex:os-open'
  // app listener. OPS/ORACLE/CANON retire from the dock (⌘K owns them —
  // lazy users need fewer, stronger buttons). os7-off keeps the original
  // windows-only dock exactly. DOCK_LAUNCH stays defined (never rendered
  // when os7 is off; kept for API stability).
  function dockNow() {
    try {
      var n = window.CODEX_NOW;
      return (n && n.ref) ? n : null;
    } catch (_) { return null; }
  }
  function dockTrailRef() {
    try {
      var t = JSON.parse(localStorage.getItem("codex.trail") || "[]");
      var last = t.length ? t[t.length - 1] : null;
      return (last && last.ref) ? String(last.ref) : null;
    } catch (_) { return null; }
  }
  var DOCK_VERBS = [
    { glyph: "⚔", label: "SWORD",  name: "Sword",  kind: "sword" },
    { glyph: "⌬", label: "MIRROR", name: "Mirror", kind: "mirror" },
    { glyph: "◎", label: "MAP",    name: "Map",    kind: "map" }
  ];
  // glyph may be an id (looked up in DOCK_ICON) or a raw glyph string; if it
  // names an icon we render the SVG, else the literal glyph. `iconId` lets a
  // caller force a specific icon while keeping a different fallback glyph.
  function dockChip(cls, glyph, label, title, run, iconId) {
    var chip = document.createElement("button");
    chip.className = cls;
    var gid = iconId || glyph;
    chip.innerHTML = '<i>' + chipGlyphHTML(gid, glyph) + '</i><span>' + label + '</span>';
    chip.title = title;                       // native tooltip (delayed)
    chip.setAttribute("data-tip", title);     // instant tooltip (CSS)
    chip.setAttribute("aria-label", title);
    chip.addEventListener("click", function () { try { run(chip); } catch (_) {} });
    return chip;
  }
  function dockSep() {
    var div = document.createElement("span");
    div.className = "cx-wm-dock-sep";
    div.setAttribute("aria-hidden", "true");
    div.style.cssText = "align-self:stretch;width:1px;margin:4px 4px;background:currentColor;opacity:.18;";
    return div;
  }

  // ── Dock v4 (v10 REBIRTH) — the dock is CUSTOMIZABLE. ─────────────────
  // A registry of launchable chips; the user's pinned set persists in
  // codex.dock.v2. ONE law is not negotiable: the READER is the main
  // plugin, so its chip is always first — it cannot be unpinned or moved.
  function deskOpen(k) {
    var d = window.codexDesk;
    if (d && d.on && d.on()) { d.open(k); return true; }
    return false;
  }
  function verbRun(kind) {
    var n = dockNow();
    var r = (n && n.ref) || dockTrailRef();
    if (!r) return;
    try { window.dispatchEvent(new CustomEvent("codex:os-open", { detail: { kind: kind, ref: r } })); } catch (_) {}
  }
  // v11 — the study deck chip is dead; the eight builtin panels register
  // as their own launchable chips (each opens its own window via
  // window.codexOpenPanel → codexDeskPanels). Pinnable through ✎.
  function panelRun(id) {
    return function () {
      if (typeof window.codexOpenPanel === "function") window.codexOpenPanel(id);
    };
  }
  var DOCK_REG = [
    { id: "reader",   glyph: "✦", label: "READER",  title: "The Reader — the main plugin", locked: true,
      run: function () { deskOpen("reader"); } },
    { id: "library",  glyph: "☰", label: "LIB",     title: "The Shelves — every canon (O was oracle; this is books)",
      run: function () { if (!deskOpen("library")) try { window.dispatchEvent(new CustomEvent("codex:open-library")); } catch (_) {} } },
    { id: "oracle",   glyph: "◬", label: "ORACLE",  title: "The Oracle — AI companion bound to the reader (O)",
      run: function () { deskOpen("oracle"); } },
    { id: "marks",    glyph: "⌖", label: "MARKS",   title: "The Marks — your trail through the text (B)",
      run: function () { deskOpen("marks"); } },
    { id: "trans",    glyph: "Α/Ω", label: "TRANS", title: "Translations — its own window (T)", run: panelRun("trans") },
    { id: "talmud",   glyph: "ת", label: "TALMUD",  title: "Talmud — its own window",           run: panelRun("talmud") },
    { id: "comm",     glyph: "§", label: "COMM",    title: "Commentary — its own window",       run: panelRun("comm") },
    { id: "gem",      glyph: "Σn", label: "GEM",    title: "Gematria — its own window",         run: panelRun("gem") },
    { id: "gnosis",   glyph: "⟁", label: "GNOSIS",  title: "Gnosis — its own window",           run: panelRun("gnosis") },
    { id: "disarm",   glyph: "⚔", label: "DISARM",  title: "Disarm — its own window",           run: panelRun("disarm") },
    { id: "exeg",     glyph: "✎", label: "EXEG",    title: "Exegesis — its own window",         run: panelRun("exeg") },
    { id: "txan",     glyph: "⟷", label: "WORDS",   title: "Word analysis — its own window",    run: panelRun("txan") },
    { id: "omni",     glyph: "⌘", label: "OMNI",    title: "Omnibar (⌘K)",
      run: function () { if (typeof window.codexOpenOmni === "function") window.codexOpenOmni(); } },
    { id: "canon",    glyph: "❂", label: "GALAXY",  title: "The canon as one galaxy",
      run: function () { if (typeof window.codexOpenConstellation === "function") window.codexOpenConstellation(); } },
    { id: "sword",    glyph: "⚔", label: "SWORD",   title: "Sword — cleave the current verse",
      run: function () { verbRun("sword"); } },
    { id: "mirror",   glyph: "⌬", label: "MIRROR",  title: "Mirror — the current verse across translations",
      run: function () { verbRun("mirror"); } },
    { id: "map",      glyph: "◎", label: "MAP",     title: "Map — where the current verse happens",
      run: function () { verbRun("map"); } },
    { id: "displays", glyph: "⧉", label: "DISPLAYS", title: "Throw a surface onto another monitor",
      run: function (anchor) { dockDisplaysMenu(anchor); } }
  ];
  var DOCK_PIN_KEY = "codex.dock.v2";
  // v11 default pins gain TRANS (the deck's STUDY chip is gone; saved pins
  // containing "study" are filtered out by dockPins since the id left the
  // registry).
  var DOCK_DEFAULT = ["reader", "library", "oracle", "marks", "trans", "omni", "displays"];
  function dockPins() {
    var pins = null;
    try { pins = JSON.parse(localStorage.getItem(DOCK_PIN_KEY) || "null"); } catch (_) {}
    if (!Array.isArray(pins) || !pins.length) pins = DOCK_DEFAULT.slice();
    // the law: reader first, always.
    pins = pins.filter(function (id, i) { return id !== "reader" && pins.indexOf(id) === i && DOCK_REG.some(function (c) { return c.id === id; }); });
    pins.unshift("reader");
    return pins;
  }
  function dockSavePins(pins) {
    try { localStorage.setItem(DOCK_PIN_KEY, JSON.stringify(pins)); } catch (_) {}
    dockRender();
  }

  // Small WM-owned popovers (editor + displays). Plain DOM — never React.
  var dockPop = null;
  function dockPopClose() { if (dockPop) { dockPop.remove(); dockPop = null; } }
  function dockPopOpen() {
    dockPopClose();
    dockPop = document.createElement("div");
    dockPop.className = "cx-wm-dockpop";
    document.body.appendChild(dockPop);
    setTimeout(function () {
      var away = function (e) {
        if (dockPop && !dockPop.contains(e.target)) { dockPopClose(); document.removeEventListener("pointerdown", away, true); }
      };
      document.addEventListener("pointerdown", away, true);
    }, 0);
    return dockPop;
  }
  function dockDisplaysMenu() {
    var pop = dockPopOpen();
    var h = document.createElement("b");
    h.textContent = "⧉ SECOND DISPLAY — open as its own window, drag to any monitor";
    pop.appendChild(h);
    var D = window.codexDisplays;
    (D ? D.surfaces : []).forEach(function (s) {
      var b = document.createElement("button");
      b.textContent = s.toUpperCase();
      b.addEventListener("click", function () { D.open(s); dockPopClose(); });
      pop.appendChild(b);
    });
    var note = document.createElement("span");
    note.textContent = "every window shares one reading cursor";
    pop.appendChild(note);
  }
  function dockEditMenu() {
    var pop = dockPopOpen();
    var h = document.createElement("b");
    h.textContent = "✎ DOCK — pick your chips · the reader is law";
    pop.appendChild(h);
    var pins = dockPins();
    DOCK_REG.forEach(function (c) {
      var row = document.createElement("label");
      row.className = "cx-wm-dockpop-row";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = pins.indexOf(c.id) >= 0;
      cb.disabled = !!c.locked;
      cb.addEventListener("change", function () {
        var cur = dockPins().filter(function (id) { return id !== c.id; });
        if (cb.checked) cur.push(c.id);
        dockSavePins(cur);
      });
      var t = document.createElement("span");
      t.textContent = c.glyph + " " + c.label + (c.locked ? " · FIRST, ALWAYS" : "");
      row.appendChild(cb); row.appendChild(t);
      pop.appendChild(row);
    });
    var reset = document.createElement("button");
    reset.textContent = "RESET TO DEFAULT";
    reset.addEventListener("click", function () { dockSavePins(DOCK_DEFAULT.slice()); dockPopClose(); });
    pop.appendChild(reset);
  }

  // ── DRAG-TO-REORDER dock chips ───────────────────────────────────────
  // Grab a launcher chip and drag it left/right; the pinned order persists
  // in codex.dock.v2 (the SAME key dockPins reads). The reader is law: it
  // never moves and nothing crosses in front of it. A plain pointer-driven
  // reorder — no HTML5 DnD (it fights the WM's pointer world) — that swaps
  // order as the dragged chip passes a neighbor's midpoint.
  function makeChipReorderable(chip, id) {
    if (id === "reader") return; // law: first, always, immovable
    chip.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      var startX = e.clientX, moved = false, raf = 0;
      var sibs, selfRect;
      function begin() {
        chip.classList.add("cx-wm-chip-dragging");
        sibs = [].slice.call(chip.parentNode.querySelectorAll(".cx-wm-dock-act[data-dock-id]"))
          .filter(function (s) { return s.getAttribute("data-dock-id") !== "reader"; });
        selfRect = chip.getBoundingClientRect();
      }
      function move(ev) {
        var dx = ev.clientX - startX;
        if (!moved && Math.abs(dx) < 5) return;
        if (!moved) { moved = true; begin(); }
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = 0;
          chip.style.transform = "translateX(" + dx + "px)";
          chip.style.zIndex = "5";
        });
      }
      function up(ev) {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        chip.classList.remove("cx-wm-chip-dragging");
        chip.style.transform = "";
        chip.style.zIndex = "";
        if (!moved) return;
        // where did we land? compute target index among reorderable sibs.
        var cx = ev.clientX;
        var order = dockPins(); // [reader, ...rest]
        var rest = order.filter(function (x) { return x !== "reader"; });
        var from = rest.indexOf(id);
        if (from < 0) return;
        // build current on-screen x-centers of reorderable chips (sans self)
        var targets = sibs.filter(function (s) { return s !== chip; }).map(function (s) {
          var r = s.getBoundingClientRect();
          return { id: s.getAttribute("data-dock-id"), mid: r.left + r.width / 2 };
        });
        var to = targets.length;
        for (var i = 0; i < targets.length; i++) { if (cx < targets[i].mid) { to = i; break; } }
        rest.splice(from, 1);
        // clamp to (the index already accounts for removal when to>from)
        rest.splice(Math.min(to, rest.length), 0, id);
        dockSavePins(["reader"].concat(rest));
      }
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  }

  // ── ⊞ ARRANGE — layouts + SAVED STUDY SETUPS ─────────────────────────
  // Operates over the OPEN, non-minimized WM windows (front-to-back order
  // from the dock registry). Each layout writes geometry through the same
  // saveGeo path every window already trusts, with a 220ms ease (snap when
  // reduced-motion). Saved setups capture the open window ids + geometry to
  // codex.layouts.v1 (≤6) and recall by opening any missing windows first.
  var LAYOUTS_KEY = "codex.layouts.v1";
  function liveWindows() {
    // visible, connected, non-minimized; ordered by z (front last).
    return dockWins
      .filter(function (w) { return w.backdrop.isConnected && w.backdrop.style.display !== "none"; })
      .sort(function (a, b) {
        return (parseInt(a.backdrop.style.zIndex || "0", 10)) - (parseInt(b.backdrop.style.zIndex || "0", 10));
      });
  }
  function animateGeo(card, g) {
    var reduce = false;
    try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_) {}
    if (!reduce) {
      card.classList.add("cx-wm-snapping");
      setTimeout(function () { card.classList.remove("cx-wm-snapping"); }, 240);
    }
    card.style.left = g.x + "px"; card.style.top = g.y + "px";
    card.style.width = g.w + "px"; card.style.height = g.h + "px";
  }
  function placeWindow(w, g) {
    var clamped = clampGeo({ x: g.x, y: g.y, w: g.w, h: g.h }, w.min || [320, 240]);
    animateGeo(w.card, clamped);
    if (w.setGeo) w.setGeo(clamped); else saveGeo(w.id, clamped);
  }
  function computeLayout(kind, n) {
    var P = PAD, GAP = 8;
    var vw = window.innerWidth, vh = window.innerHeight;
    var H = vh - P * 2;
    var rects = [];
    function col(i, cols) {
      var cw = Math.floor((vw - P * 2 - GAP * (cols - 1)) / cols);
      return { x: P + i * (cw + GAP), y: P, w: cw, h: H };
    }
    if (kind === "halves" || (kind === "auto" && n === 2)) {
      for (var i = 0; i < n; i++) rects.push(col(i % 2, 2));
      // for n>2 in halves, alternate; but halves intended for 2.
      rects = []; for (var a = 0; a < n; a++) rects.push(col(a < Math.ceil(n / 2) ? 0 : 1, 2));
    } else if (kind === "thirds") {
      for (var t = 0; t < n; t++) rects.push(col(t % 3, 3));
    } else if (kind === "quad") {
      var cw = Math.floor((vw - P * 2 - GAP) / 2);
      var ch = Math.floor((vh - P * 2 - GAP) / 2);
      var slots = [[P, P], [P + cw + GAP, P], [P, P + ch + GAP], [P + cw + GAP, P + ch + GAP]];
      for (var q = 0; q < n; q++) { var s = slots[q % 4]; rects.push({ x: s[0], y: s[1], w: cw, h: ch }); }
    } else if (kind === "reader") {
      // reader centered, others flank. center column ~50%, side columns split.
      var side = Math.max(0, n - 1);
      var cwC = Math.floor(vw * (side ? 0.48 : 0.7));
      var cx = Math.floor((vw - cwC) / 2);
      rects.push({ x: cx, y: P, w: cwC, h: H, __center: true });
      if (side) {
        var sw = Math.floor((cx - P - GAP));
        var leftN = Math.ceil(side / 2), rightN = side - leftN;
        var li = 0, ri = 0;
        for (var k = 0; k < side; k++) {
          if (k % 2 === 0 && li < leftN) {
            var lh = Math.floor((H - GAP * (leftN - 1)) / leftN);
            rects.push({ x: P, y: P + li * (lh + GAP), w: sw, h: lh }); li++;
          } else {
            var rh = Math.floor((H - GAP * (Math.max(1, rightN) - 1)) / Math.max(1, rightN));
            rects.push({ x: vw - P - sw, y: P + ri * (rh + GAP), w: sw, h: rh }); ri++;
          }
        }
      }
    } else { // single / fallback: maximize the front one
      rects.push({ x: P, y: P, w: vw - P * 2, h: H });
    }
    return rects;
  }
  function applyLayout(kind) {
    var wins = liveWindows();
    if (!wins.length) return;
    if (kind === "reader") {
      // put the reader (or front) in the center slot.
      var readerIdx = wins.findIndex(function (w) { return w.id === "win:sys:reader"; });
      if (readerIdx > 0) { var rw = wins.splice(readerIdx, 1)[0]; wins.unshift(rw); }
    }
    var rects = computeLayout(kind, wins.length);
    wins.forEach(function (w, i) { placeWindow(w, rects[Math.min(i, rects.length - 1)]); });
    pokeLayout();
  }

  function loadLayouts() {
    try { var a = JSON.parse(localStorage.getItem(LAYOUTS_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (_) { return []; }
  }
  function saveLayouts(a) { try { localStorage.setItem(LAYOUTS_KEY, JSON.stringify(a.slice(0, 6))); } catch (_) {} }
  function captureSetup(name) {
    var wins = liveWindows();
    var snap = wins.map(function (w) {
      var r = w.card.getBoundingClientRect();
      return { id: w.id, glyph: w.glyph, geo: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } };
    });
    var all = loadLayouts().filter(function (s) { return s.name !== name; });
    all.unshift({ name: name, ts: Date.now(), wins: snap });
    saveLayouts(all);
  }
  // Open a window by its WM id, routing through the right door, then resolve
  // once its card mounts (or after a timeout).
  function openWid(wid) {
    try {
      if (wid === "win:sys:reader" || wid === "win:sys:library" || wid === "win:sys:oracle" || wid === "win:sys:marks") {
        var k = wid.split(":")[2];
        if (window.codexDesk && window.codexDesk.open) window.codexDesk.open(k);
      } else if (/^win:builtin:/.test(wid)) {
        if (window.codexOpenPanel) window.codexOpenPanel(wid.replace("win:builtin:", ""));
      } else if (wid === "const") {
        if (window.codexOpenConstellation) window.codexOpenConstellation();
      } else if (/^win:plugin:/.test(wid)) {
        // plugin windows: ask app.jsx to reopen via codexOpenWindow if possible
        if (window.codexOpenWindow) window.codexOpenWindow({ id: wid.replace(/^win:/, "") });
      }
    } catch (_) {}
  }
  function recallSetup(name) {
    var setup = loadLayouts().filter(function (s) { return s.name === name; })[0];
    if (!setup) return;
    // open any missing windows first
    var have = {};
    liveWindows().forEach(function (w) { have[w.id] = true; });
    setup.wins.forEach(function (s) { if (!have[s.id]) openWid(s.id); });
    // apply geometry once windows have mounted (retry a few times).
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      var idx = {};
      dockWins.forEach(function (w) { if (w.backdrop.isConnected) idx[w.id] = w; });
      var allHere = setup.wins.every(function (s) { return idx[s.id]; });
      if (allHere || tries > 16) {
        clearInterval(t);
        setup.wins.forEach(function (s) {
          var w = idx[s.id];
          if (w) { if (w.backdrop.style.display === "none") w.backdrop.style.display = "";
            placeWindow(w, s.geo); }
        });
        pokeLayout();
      }
    }, 120);
  }

  function arrangeMenu(anchor) {
    var pop = dockPopOpen();
    pop.classList.add("cx-wm-arrangepop");
    var h = document.createElement("b");
    h.textContent = "⊞ ARRANGE — tile the open windows";
    pop.appendChild(h);
    var grid = document.createElement("div");
    grid.className = "cx-wm-arrange-grid";
    [
      { k: "halves", label: "Side by side", icon: '<rect x="2" y="3" width="6" height="12" rx="1"/><rect x="10" y="3" width="6" height="12" rx="1"/>' },
      { k: "thirds", label: "Thirds", icon: '<rect x="1.5" y="3" width="4.5" height="12" rx="1"/><rect x="6.75" y="3" width="4.5" height="12" rx="1"/><rect x="12" y="3" width="4.5" height="12" rx="1"/>' },
      { k: "quad", label: "Quad 2×2", icon: '<rect x="2" y="3" width="6" height="5.5" rx="1"/><rect x="10" y="3" width="6" height="5.5" rx="1"/><rect x="2" y="9.5" width="6" height="5.5" rx="1"/><rect x="10" y="9.5" width="6" height="5.5" rx="1"/>' },
      { k: "reader", label: "Reader-centered", icon: '<rect x="6" y="3" width="6" height="12" rx="1"/><rect x="1.5" y="4.5" width="3" height="9" rx="0.8"/><rect x="13.5" y="4.5" width="3" height="9" rx="0.8"/>' },
      { k: "single", label: "Maximize front", icon: '<rect x="2.5" y="3.5" width="13" height="11" rx="1.2"/>' }
    ].forEach(function (L) {
      var b = document.createElement("button");
      b.className = "cx-wm-arrange-opt";
      b.innerHTML = '<span class="cx-wm-arrange-ico">' + svg(L.icon) + '</span><span>' + L.label + '</span>';
      b.title = L.label;
      b.addEventListener("click", function () { applyLayout(L.k); dockPopClose(); });
      grid.appendChild(b);
    });
    pop.appendChild(grid);

    // ── Saved study setups ──
    var sh = document.createElement("b");
    sh.textContent = "SAVED STUDY SETUPS";
    sh.style.marginTop = "4px";
    pop.appendChild(sh);
    var layouts = loadLayouts();
    if (!layouts.length) {
      var none = document.createElement("span");
      none.textContent = "none yet — arrange your windows, then save below";
      pop.appendChild(none);
    }
    layouts.forEach(function (s) {
      var row = document.createElement("div");
      row.className = "cx-wm-setup-row";
      var open = document.createElement("button");
      open.className = "cx-wm-setup-open";
      open.innerHTML = '<i>' + chipGlyphHTML("arrange") + '</i><span>' + s.name + '</span><em>' + s.wins.length + ' win</em>';
      open.title = "Recall " + s.name;
      open.addEventListener("click", function () { recallSetup(s.name); dockPopClose(); });
      var del = document.createElement("button");
      del.className = "cx-wm-setup-del";
      del.innerHTML = chipGlyphHTML("close");
      del.title = "Delete " + s.name;
      del.addEventListener("click", function (e) {
        e.stopPropagation();
        saveLayouts(loadLayouts().filter(function (x) { return x.name !== s.name; }));
        row.remove();
      });
      row.appendChild(open); row.appendChild(del);
      pop.appendChild(row);
    });
    if (layouts.length < 6) {
      var save = document.createElement("button");
      save.className = "cx-wm-setup-save";
      save.innerHTML = '<i>+</i><span>Save current arrangement</span>';
      save.addEventListener("click", function () {
        var name = prompt("Name this study setup:", "Setup " + (loadLayouts().length + 1));
        if (name && name.trim()) { captureSetup(name.trim().slice(0, 24)); arrangeMenu(anchor); }
      });
      pop.appendChild(save);
    }
  }
  // Public arrange API — the omnibar / keyboard can drive it too.
  window.codexArrange = { layout: applyLayout, save: captureSetup, recall: recallSetup, list: loadLayouts };

  function dockActionChips(el) {
    var now = dockNow();
    var trailRef = dockTrailRef();
    var ACT = "cx-wm-dock-chip cx-wm-dock-launch cx-wm-dock-act";
    var ds = (window.codexDesk && window.codexDesk.on && window.codexDesk.on()) ? window.codexDesk.state() : null;
    var openPanels = (window.codexDeskPanels && window.codexDeskPanels.on && window.codexDeskPanels.on())
      ? window.codexDeskPanels.list() : [];
    var BUILTIN_CHIPS = ["trans", "talmud", "comm", "gem", "gnosis", "disarm", "exeg", "txan"];
    dockPins().forEach(function (id) {
      var c = null;
      for (var i = 0; i < DOCK_REG.length; i++) if (DOCK_REG[i].id === id) c = DOCK_REG[i];
      if (!c) return;
      var cls = ACT + (c.id === "reader" ? " cx-wm-dock-reader" : "");
      if (ds && (c.id === "reader" || c.id === "library" || c.id === "oracle" || c.id === "marks") && ds[c.id]) {
        cls += " is-open"; // already on the desk — chip shows it lit
      }
      if (BUILTIN_CHIPS.indexOf(c.id) >= 0 && openPanels.indexOf(c.id) >= 0) {
        cls += " is-open"; // that panel's window is on the desk
      }
      var ref = (now && now.ref) || trailRef;
      var title = c.title + (ref && (c.id === "sword" || c.id === "mirror" || c.id === "map") ? " — " + ref : "");
      var chip = dockChip(cls, c.glyph, c.label, title, function () { c.run(chip); }, c.id);
      chip.setAttribute("data-dock-id", c.id);
      makeChipReorderable(chip, c.id);
      el.appendChild(chip);
    });
    if (trailRef) {
      el.appendChild(dockChip(ACT + " cx-wm-dock-continue", "⟳", "CONTINUE", "Continue — " + trailRef, function () {
        var r = dockTrailRef();
        if (r && typeof window.codexJumpToRef === "function") {
          try { window.codexJumpToRef(r); } catch (_) {}
        }
      }, "continue"));
    }
    // ⊞ ARRANGE — one-tap layouts + saved study setups over the open windows.
    el.appendChild(dockChip(ACT + " cx-wm-dock-arrange", "⊞", "", "Arrange the open windows — layouts & saved setups",
      function (anchor) { arrangeMenu(anchor); }, "arrange"));
    // the customizer — the dock is the user's
    el.appendChild(dockChip(ACT + " cx-wm-dock-edit", "✎", "", "Customize the dock", function () { dockEditMenu(); }, "edit"));
  }

  // First-ever desk boot: the chips breathe once — a single ~2s glow sweep.
  // A wink, not a tutorial. Persisted so it happens exactly once per profile;
  // reduced-motion users get nothing (the keyframe is disabled in CSS).
  var WINK_KEY = "codex.dock.winked.v1";
  function maybeWink(el) {
    try {
      if (localStorage.getItem(WINK_KEY)) return;
      localStorage.setItem(WINK_KEY, "1");
    } catch (_) { return; }
    setTimeout(function () {
      if (!el.isConnected) return;
      el.classList.add("cx-wm-wink");
      setTimeout(function () { el.classList.remove("cx-wm-wink"); }, 2600);
    }, 700);
  }

  function dockRender() {
    dockWins = dockWins.filter(function (w) { return w.backdrop.isConnected; });
    var launcher = os7on() && active();
    if (!dockWins.length && !launcher) { if (dockEl) { dockEl.remove(); dockEl = null; } return; }
    if (!dockEl || !dockEl.isConnected) {
      dockEl = document.createElement("div");
      dockEl.className = "cx-wm-dock";
      dockEl.setAttribute("role", "toolbar");
      dockEl.setAttribute("aria-label", "Open windows");
      document.body.appendChild(dockEl);
      maybeWink(dockEl);
    }
    dockEl.textContent = "";
    if (launcher) {
      dockActionChips(dockEl);
      if (dockWins.length) dockEl.appendChild(dockSep());
    }
    dockWins.forEach(function (w) {
      var chip = document.createElement("button");
      var minimized = w.backdrop.style.display === "none";
      var focused = w.card.classList.contains("cx-wm-focus");
      chip.className = "cx-wm-dock-chip cx-wm-dock-running" + (minimized ? " is-min" : "") + (focused && !minimized ? " is-focus" : "");
      var label = String(w.label || w.id).toUpperCase().slice(0, 12);
      var iconId = w.iconId || w.id;
      chip.innerHTML = '<i>' + chipGlyphHTML(iconId, w.glyph || DOCK_GLYPH[w.id] || "▣") + '</i><span>' + label + '</span>';
      var tip = minimized ? "Restore " + label : (focused ? "Minimize " + label : "Focus " + label);
      chip.title = tip;
      chip.setAttribute("data-tip", tip);
      chip.setAttribute("aria-label", tip);
      chip.addEventListener("click", function () {
        if (w.backdrop.style.display === "none") {
          w.backdrop.style.display = "";
          w.front();
        } else if (w.card.classList.contains("cx-wm-focus")) {
          w.backdrop.style.display = "none";
        } else {
          w.front();
        }
        dockRender();
      });
      // right-click / long-press → LIVE PREVIEW CARD of the actual window.
      chip.addEventListener("contextmenu", function (e) { e.preventDefault(); previewCard(chip, w); });
      attachLongPress(chip, function () { previewCard(chip, w); });
      dockEl.appendChild(chip);
    });
  }

  // ── LIVE PREVIEW CARD ────────────────────────────────────────────────
  // Right-click / long-press a running-window chip → a hovering card with
  // the window's title, its bound ref/context, a scaled CSS-transform
  // SNAPSHOT of the real window node, and actions (focus · minimize ·
  // close · pop-out). The snapshot is a clone of the live card scaled to
  // fit — cheap, honest, no canvas rasterization.
  var previewEl = null;
  function previewClose() { if (previewEl) { previewEl.remove(); previewEl = null; } }
  function previewCard(anchor, w) {
    previewClose();
    var card = w.card;
    var ctx = (card.querySelector(".cx-win-h-ctx") || {}).textContent || "";
    var title = String(w.label || w.id);
    var box = document.createElement("div");
    box.className = "cx-wm-prevcard";
    var head = document.createElement("div");
    head.className = "cx-wm-prevcard-h";
    head.innerHTML = '<b>' + title.toUpperCase() + '</b>' + (ctx ? '<span>' + ctx + '</span>' : "");
    box.appendChild(head);
    // scaled snapshot
    var stage = document.createElement("div");
    stage.className = "cx-wm-prevcard-stage";
    var r = card.getBoundingClientRect();
    var SW = 230;
    var scale = Math.min(SW / Math.max(1, r.width), 1);
    var shotH = Math.min(160, Math.max(80, Math.round(r.height * scale)));
    stage.style.height = shotH + "px";
    var clone = card.cloneNode(true);
    // strip WM-owned chrome that would look odd in a thumbnail
    [].forEach.call(clone.querySelectorAll(".cx-wm-rs, .cx-wm-ctl"), function (n) { n.remove(); });
    clone.style.cssText = "position:absolute;left:0;top:0;margin:0;transform:scale(" + scale + ");transform-origin:top left;width:" + Math.round(r.width) + "px;height:" + Math.round(r.height) + "px;pointer-events:none;box-shadow:none;border-radius:0;";
    clone.classList.remove("cx-wm-focus");
    stage.appendChild(clone);
    box.appendChild(stage);
    // actions
    var acts = document.createElement("div");
    acts.className = "cx-wm-prevcard-acts";
    function act(label, iconId, fn) {
      var b = document.createElement("button");
      b.innerHTML = '<i>' + chipGlyphHTML(iconId) + '</i><span>' + label + '</span>';
      b.title = label; b.setAttribute("aria-label", label);
      b.addEventListener("click", function () { try { fn(); } catch (_) {} previewClose(); });
      return b;
    }
    acts.appendChild(act("Focus", "oracle", function () { w.backdrop.style.display = ""; w.front(); dockRender(); }));
    acts.appendChild(act("Min", "min", function () { w.backdrop.style.display = "none"; dockRender(); }));
    var surf = window.codexDisplays && window.codexDisplays.surfaceForWid && window.codexDisplays.surfaceForWid(w.id);
    if (surf) acts.appendChild(act("Pop-out", "popout", function () { window.codexDisplays.open(surf); }));
    acts.appendChild(act("Close", "close", function () { wmCloseWindow(w); }));
    box.appendChild(acts);
    document.body.appendChild(box);
    // position above the chip, clamped to viewport
    var ab = anchor.getBoundingClientRect();
    var bw = box.getBoundingClientRect();
    var x = Math.round(ab.left + ab.width / 2 - bw.width / 2);
    x = Math.max(8, Math.min(x, window.innerWidth - bw.width - 8));
    var y = Math.round(ab.top - bw.height - 10);
    if (y < 8) y = Math.round(ab.bottom + 10);
    box.style.left = x + "px";
    box.style.top = y + "px";
    setTimeout(function () {
      var away = function (e) {
        if (previewEl && !previewEl.contains(e.target) && e.target !== anchor) { previewClose(); document.removeEventListener("pointerdown", away, true); }
      };
      document.addEventListener("pointerdown", away, true);
    }, 0);
    previewEl = box;
  }

  // Long-press helper (touch / pen) — fires fn after 480ms of a still press.
  function attachLongPress(el, fn) {
    var t = 0, sx = 0, sy = 0;
    el.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse") return; // mouse uses contextmenu
      sx = e.clientX; sy = e.clientY;
      t = setTimeout(fn, 480);
    });
    var cancel = function (e) {
      if (e && e.clientX !== undefined && (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 8)) { clearTimeout(t); }
      else if (!e) clearTimeout(t);
    };
    el.addEventListener("pointermove", cancel);
    el.addEventListener("pointerup", function () { clearTimeout(t); });
    el.addEventListener("pointercancel", function () { clearTimeout(t); });
  }

  // Close a running window through its OWN close affordance (the WM never
  // owns lifecycle) — click the console/window's × so React unmounts it.
  function wmCloseWindow(w) {
    var x = w.card.querySelector(".cx-win-x, .cx-mirror-x, .cx-map-x, .cx-art-x, .cx-cmp-x, .cx-sword-x, .cx-ops-x, .cx-const-x, [data-cx-close]");
    if (x) { x.click(); return; }
    // last resort: hide the backdrop (keeps the contract: never unmount).
    w.backdrop.style.display = "none";
    dockRender();
  }

  var zTop = 9500;          // shared z ladder across all WM windows
  var SNAP = 14;            // px from a viewport edge that arms snapping
  var PAD = 8;              // viewport padding for clamps
  var preview = null;       // shared snap-preview element
  var resizeTimer = 0;

  function geoKey(id) { return "cx-wm-geo:" + id; }
  function loadGeo(id) {
    try { return JSON.parse(localStorage.getItem(geoKey(id)) || "null"); } catch (_) { return null; }
  }
  function saveGeo(id, g) {
    try { localStorage.setItem(geoKey(id), JSON.stringify(g)); } catch (_) {}
  }

  function clampGeo(g, min) {
    var vw = window.innerWidth, vh = window.innerHeight;
    g.w = Math.max(min[0], Math.min(g.w, vw - PAD * 2));
    g.h = Math.max(min[1], Math.min(g.h, vh - PAD * 2));
    g.x = Math.max(PAD - g.w + 120, Math.min(g.x, vw - 120)); // keep ≥120px of header reachable
    g.y = Math.max(PAD, Math.min(g.y, vh - 48));
    return g;
  }

  // Leaflet + the mirror cascade canvas both relayout on window resize; fire
  // one (debounced) after geometry changes so content tracks the frame.
  function pokeLayout() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      try { window.dispatchEvent(new Event("resize")); } catch (_) {}
    }, 120);
  }

  function ensurePreview() {
    if (preview && preview.isConnected) return preview;
    preview = document.createElement("div");
    preview.className = "cx-wm-preview";
    preview.style.display = "none";
    document.body.appendChild(preview);
    return preview;
  }
  function showPreview(x, y, w, h) {
    var p = ensurePreview();
    p.style.display = "block";
    p.style.left = x + "px"; p.style.top = y + "px";
    p.style.width = w + "px"; p.style.height = h + "px";
  }
  function hidePreview() { if (preview) preview.style.display = "none"; }

  function snapZone(cx, cy) {
    var vw = window.innerWidth, vh = window.innerHeight;
    if (cy <= SNAP) return { kind: "max",   x: PAD, y: PAD, w: vw - PAD * 2, h: vh - PAD * 2 };
    if (cx <= SNAP) return { kind: "left",  x: PAD, y: PAD, w: Math.floor(vw / 2) - PAD - 4, h: vh - PAD * 2 };
    if (cx >= vw - SNAP) {
      var w = Math.floor(vw / 2) - PAD - 4;
      return { kind: "right", x: vw - PAD - w, y: PAD, w: w, h: vh - PAD * 2 };
    }
    return null;
  }

  function enhance(backdrop, spec) {
    if (backdrop.__cxwm || !active()) return;
    var card = backdrop.querySelector(spec.card);
    if (!card) return;
    backdrop.__cxwm = true;

    var head = card.querySelector(spec.head);
    // v8 MONAD: generic windows carry their instance identity on the
    // backdrop (data-wm-id) so each persists its own geometry + dock chip;
    // classic consoles fall through to the spec id unchanged.
    var wid = backdrop.getAttribute("data-wm-id") || spec.id;
    var wglyph = backdrop.getAttribute("data-wm-glyph") || DOCK_GLYPH[spec.id] || "▣";
    var state = { id: wid, min: spec.min, maximized: false, restore: null };

    // Measure the natural (CSS-centered) rect BEFORE window-mode classes
    // change the card's positioning — this is the first-open geometry.
    var rect = card.getBoundingClientRect();

    backdrop.classList.add("cx-wm-backdrop");
    card.classList.add("cx-wm-win");
    if (head) {
      head.classList.add("cx-wm-head");
      if (!head.title) head.title = "Drag to move · double-click to maximize · drag to a screen edge to snap";
    }

    // ── v11.5 HEADER CONTROLS — inject a minimize · arrange · pop-out
    // cluster into EVERY window header (consoles get it too, since this runs
    // in enhance() not in any one component's JSX). Idempotent. The cluster
    // sits just before the card's own × so close stays where users expect.
    // Buttons are <button> with the right="button" guard the drag handler
    // already honors, so pressing them never starts a drag.
    if (head && !head.querySelector(".cx-wm-ctl")) {
      var ctl = document.createElement("div");
      ctl.className = "cx-wm-ctl";
      ctl.setAttribute("aria-hidden", "false");
      function ctlBtn(cls, iconId, tip, fn) {
        var b = document.createElement("button");
        b.className = "cx-wm-ctl-btn " + cls;
        b.type = "button";
        b.innerHTML = chipGlyphHTML(iconId);
        b.title = tip; b.setAttribute("aria-label", tip); b.setAttribute("data-tip", tip);
        b.addEventListener("click", function (e) { e.stopPropagation(); try { fn(); } catch (_) {} });
        // never let the head's drag detector see these as drag starts
        b.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
        return b;
      }
      ctl.appendChild(ctlBtn("cx-wm-ctl-arrange", "arrange", "Arrange windows", function () { arrangeMenu(ctl); }));
      var surf = window.codexDisplays && window.codexDisplays.surfaceForWid && window.codexDisplays.surfaceForWid(wid);
      if (surf) ctl.appendChild(ctlBtn("cx-wm-ctl-pop", "popout", "Pop out to another monitor", function () {
        if (window.codexDisplays) window.codexDisplays.open(surf);
      }));
      ctl.appendChild(ctlBtn("cx-wm-ctl-min", "min", "Minimize — restore from the dock", function () {
        backdrop.style.display = "none";
        dockRender();
      }));
      // Find the card's own close button and slot the cluster just before it
      // so order reads: …arrange pop-out minimize × .
      var closeBtn = head.querySelector(".cx-win-x, .cx-mirror-x, .cx-map-x, .cx-art-x, .cx-cmp-x, .cx-sword-x, .cx-ops-x, .cx-const-x");
      if (closeBtn && closeBtn.parentNode === head) head.insertBefore(ctl, closeBtn);
      else head.appendChild(ctl);
    }

    function apply(g) {
      card.style.left = g.x + "px";
      card.style.top = g.y + "px";
      card.style.width = g.w + "px";
      card.style.height = g.h + "px";
      state.geo = g;
    }

    function front() {
      zTop += 1;
      backdrop.style.zIndex = String(zTop);
      var all = document.querySelectorAll(".cx-wm-win.cx-wm-focus");
      for (var i = 0; i < all.length; i++) all[i].classList.remove("cx-wm-focus");
      card.classList.add("cx-wm-focus");
    }

    // ── Initial geometry: saved → clamped; else derive from the card's
    //    natural (CSS-centered) rect so the first open looks identical.
    var saved = loadGeo(wid);
    var geo = saved
      ? clampGeo({ x: saved.x, y: saved.y, w: saved.w, h: saved.h }, spec.min)
      : clampGeo({ x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) }, spec.min);
    apply(geo);
    front();

    card.addEventListener("pointerdown", front, true);

    // ── Drag ───────────────────────────────────────────────────────────────
    var drag = null, raf = 0;
    function onDragMove(e) {
      if (!drag) return;
      drag.cx = e.clientX; drag.cy = e.clientY;
      // A click is not a drag — require real movement before geometry moves.
      // (Otherwise a double-click's down/up cycle corrupts maximize state.)
      if (!drag.moved && Math.abs(drag.cx - drag.px) + Math.abs(drag.cy - drag.py) < 4) return;
      drag.moved = true;
      if (!raf) raf = requestAnimationFrame(function () {
        raf = 0;
        if (!drag) return;
        var g = clampGeo({ x: drag.gx + drag.cx - drag.px, y: drag.gy + drag.cy - drag.py, w: state.geo.w, h: state.geo.h }, state.min);
        apply(g);
        var z = snapZone(drag.cx, drag.cy);
        if (z) showPreview(z.x, z.y, z.w, z.h); else hidePreview();
      });
    }
    function onDragEnd(e) {
      if (!drag) return;
      var moved = drag.moved;
      card.classList.remove("cx-wm-dragging");
      hidePreview();
      if (!moved) {
        drag = null;
        window.removeEventListener("pointermove", onDragMove);
        window.removeEventListener("pointerup", onDragEnd);
        return;
      }
      var z = snapZone(e.clientX, e.clientY);
      if (z) {
        state.restore = { x: state.geo.x, y: state.geo.y, w: state.geo.w, h: state.geo.h };
        state.maximized = (z.kind === "max");
        card.classList.add("cx-wm-snapping");
        apply({ x: z.x, y: z.y, w: z.w, h: z.h });
        setTimeout(function () { card.classList.remove("cx-wm-snapping"); }, 220);
      } else {
        state.maximized = false;
      }
      saveGeo(wid, state.geo);
      pokeLayout();
      drag = null;
      window.removeEventListener("pointermove", onDragMove);
      window.removeEventListener("pointerup", onDragEnd);
    }
    var lastDown = 0, lastDownX = 0, lastDownY = 0;
    if (head) {
      head.addEventListener("pointerdown", function (e) {
        if (e.button !== 0) return;
        if (e.target.closest("button, a, input, select, textarea, [role='button']")) return;
        // Manual double-press detection — robust regardless of whether the
        // browser synthesizes a dblclick from this pointer sequence.
        var now = Date.now();
        if (now - lastDown < 400 && Math.abs(e.clientX - lastDownX) < 6 && Math.abs(e.clientY - lastDownY) < 6) {
          lastDown = 0;
          toggleMax();
          return;
        }
        lastDown = now; lastDownX = e.clientX; lastDownY = e.clientY;
        // No preventDefault here — cancelling pointerdown would suppress the
        // compatibility mouse events and kill dblclick-to-maximize. The head
        // already has user-select:none / touch-action:none in CSS.
        drag = { px: e.clientX, py: e.clientY, gx: state.geo.x, gy: state.geo.y, cx: e.clientX, cy: e.clientY };
        card.classList.add("cx-wm-dragging");
        front();
        window.addEventListener("pointermove", onDragMove);
        window.addEventListener("pointerup", onDragEnd);
      });
    }

    function toggleMax() {
      card.classList.add("cx-wm-snapping");
      if (state.maximized && state.restore) {
        apply(clampGeo(state.restore, state.min));
        state.maximized = false;
      } else {
        state.restore = { x: state.geo.x, y: state.geo.y, w: state.geo.w, h: state.geo.h };
        apply({ x: PAD, y: PAD, w: window.innerWidth - PAD * 2, h: window.innerHeight - PAD * 2 });
        state.maximized = true;
      }
      setTimeout(function () { card.classList.remove("cx-wm-snapping"); }, 220);
      saveGeo(wid, state.geo);
      pokeLayout();
    }

    // ── Resize — 8 handles ────────────────────────────────────────────────
    var DIRS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
    DIRS.forEach(function (dir) {
      var h = document.createElement("div");
      h.className = "cx-wm-rs cx-wm-rs-" + dir;
      h.setAttribute("aria-hidden", "true");
      card.appendChild(h);
      var rs = null, rraf = 0;
      function onMove(e) {
        if (!rs) return;
        rs.cx = e.clientX; rs.cy = e.clientY;
        if (!rraf) rraf = requestAnimationFrame(function () {
          rraf = 0;
          if (!rs) return;
          var dx = rs.cx - rs.px, dy = rs.cy - rs.py;
          var g = { x: rs.g.x, y: rs.g.y, w: rs.g.w, h: rs.g.h };
          if (dir.indexOf("e") >= 0) g.w = rs.g.w + dx;
          if (dir.indexOf("s") >= 0) g.h = rs.g.h + dy;
          if (dir.indexOf("w") >= 0) { g.w = rs.g.w - dx; g.x = rs.g.x + dx; }
          if (dir.indexOf("n") >= 0) { g.h = rs.g.h - dy; g.y = rs.g.y + dy; }
          if (g.w < state.min[0]) { if (dir.indexOf("w") >= 0) g.x -= (state.min[0] - g.w); g.w = state.min[0]; }
          if (g.h < state.min[1]) { if (dir.indexOf("n") >= 0) g.y -= (state.min[1] - g.h); g.h = state.min[1]; }
          apply(clampGeo(g, state.min));
        });
      }
      function onUp() {
        if (!rs) return;
        rs = null;
        card.classList.remove("cx-wm-resizing");
        state.maximized = false;
        saveGeo(wid, state.geo);
        pokeLayout();
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      }
      h.addEventListener("pointerdown", function (e) {
        if (e.button !== 0) return;
        rs = { px: e.clientX, py: e.clientY, g: { x: state.geo.x, y: state.geo.y, w: state.geo.w, h: state.geo.h }, cx: e.clientX, cy: e.clientY };
        card.classList.add("cx-wm-resizing");
        front();
        e.preventDefault();
        e.stopPropagation();
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      });
    });

    // ── Keep windows on-screen when the viewport shrinks ─────────────────
    var onWinResize = function () {
      if (!card.isConnected) { window.removeEventListener("resize", onWinResize); return; }
      if (state.maximized) {
        apply({ x: PAD, y: PAD, w: window.innerWidth - PAD * 2, h: window.innerHeight - PAD * 2 });
      } else {
        apply(clampGeo(state.geo, state.min));
      }
    };
    window.addEventListener("resize", onWinResize);
    // Resolve a line-icon id for this window so the dock chip + preview wear
    // the same elegant glyph language: console → spec.id; desk window →
    // sys:<k>; builtin panel → its id; else fall back to the unicode glyph.
    var iconId = spec.id;
    var bm = /^win:sys:(\w+)$/.exec(wid); if (bm) iconId = bm[1];
    var pm = /^win:builtin:(\w+)$/.exec(wid); if (pm) iconId = pm[1];
    // setGeo lets the arrange engine drive geometry through the window's own
    // state (so a later drag/resize/maximize starts from the right place).
    var setGeo = function (g) { state.geo = { x: g.x, y: g.y, w: g.w, h: g.h }; state.maximized = false; saveGeo(wid, state.geo); };
    // Register with the dock; chips re-render on focus so the active chip
    // tracks the focused window.
    var dockEntry = { key: wid + ":" + Date.now(), id: wid, glyph: wglyph, iconId: iconId, min: spec.min, setGeo: setGeo, backdrop: backdrop, card: card, front: front,
      label: (backdrop.querySelector(".cx-win-h-title") || {}).textContent || wid.replace(/^win:plugin:[^:]+:/, "") };
    dockWins.push(dockEntry);
    card.addEventListener("pointerdown", function () { dockRender(); }, true);
    dockRender();

    backdrop.__cxwmCleanup = function () {
      window.removeEventListener("resize", onWinResize);
      saveGeo(wid, state.geo);
      dockWins = dockWins.filter(function (w) { return w !== dockEntry; });
      dockRender();
    };
  }

  function scan(root) {
    if (!active()) return;
    for (var i = 0; i < SPECS.length; i++) {
      var spec = SPECS[i];
      var nodes = (root.classList && root.classList.contains(spec.backdrop))
        ? [root]
        : (root.querySelectorAll ? root.querySelectorAll("." + spec.backdrop) : []);
      for (var j = 0; j < nodes.length; j++) enhance(nodes[j], spec);
    }
  }

  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      for (var j = 0; j < m.addedNodes.length; j++) {
        var n = m.addedNodes[j];
        if (n.nodeType === 1) scan(n);
      }
      for (var k = 0; k < m.removedNodes.length; k++) {
        var r = m.removedNodes[k];
        if (r.nodeType === 1 && r.__cxwmCleanup) r.__cxwmCleanup();
      }
    }
  });

  // OS·7 mode flips (shell.js) re-render the dock so launchers appear/retire.
  window.addEventListener("codex:os7", function () { dockRender(); });
  // Desk window opens/closes (app.jsx codexDesk) re-render the LIB/READER
  // chips so their active state tracks the desk.
  window.addEventListener("codex:desk", function () { dockRender(); });
  // v11 — builtin panel windows open/close (app.jsx codexDeskPanels)
  // re-render their chips' lit state the same way.
  window.addEventListener("codex:desk-panels", function () { dockRender(); });

  // Verse cursor moves (app.jsx 'codex:now') re-render the action chips so
  // titles track the current ref and CONTINUE appears after boot without a
  // reload. Debounced — J/K scrubbing fires this on every landed verse.
  var dockNowTimer = 0;
  window.addEventListener("codex:now", function () {
    if (!os7on()) return;
    clearTimeout(dockNowTimer);
    dockNowTimer = setTimeout(function () { try { dockRender(); } catch (_) {} }, 250);
  });

  function boot() {
    try {
      mo.observe(document.body, { childList: true, subtree: true });
      scan(document.body);
      dockRender();
    } catch (_) {}
  }
  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
