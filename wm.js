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
//   · Desktop only — (min-width: 900px) and (pointer: fine). Phones keep the
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
  try { MQ = window.matchMedia("(min-width: 900px) and (pointer: fine)"); } catch (_) {}
  function active() { return !!(MQ && MQ.matches); }

  // Console registry — backdrop holds the stacking layer, card is the window,
  // head is the drag handle. min is [w, h].
  var SPECS = [
    { id: "mirror", backdrop: "cx-mirror-backdrop", card: ".cx-mirror", head: ".cx-mirror-h", min: [600, 420] },
    { id: "map",    backdrop: "cx-map-backdrop",    card: ".cx-map",    head: ".cx-map-h",    min: [600, 440] },
    { id: "art",    backdrop: "cx-art-backdrop",    card: ".cx-art",    head: ".cx-art-h",    min: [500, 380] },
    { id: "cmp",    backdrop: "cx-cmp-backdrop",    card: ".cx-cmp",    head: ".cx-cmp-h",    min: [500, 340] },
    { id: "sword",  backdrop: "cx-sword-backdrop",  card: ".cx-sword",  head: ".cx-sword-h",  min: [640, 460] }
  ];

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
    var state = { id: spec.id, min: spec.min, maximized: false, restore: null };

    // Measure the natural (CSS-centered) rect BEFORE window-mode classes
    // change the card's positioning — this is the first-open geometry.
    var rect = card.getBoundingClientRect();

    backdrop.classList.add("cx-wm-backdrop");
    card.classList.add("cx-wm-win");
    if (head) {
      head.classList.add("cx-wm-head");
      if (!head.title) head.title = "Drag to move · double-click to maximize · drag to a screen edge to snap";
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
    var saved = loadGeo(spec.id);
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
      saveGeo(spec.id, state.geo);
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
      saveGeo(spec.id, state.geo);
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
        saveGeo(spec.id, state.geo);
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
    backdrop.__cxwmCleanup = function () {
      window.removeEventListener("resize", onWinResize);
      saveGeo(spec.id, state.geo);
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

  function boot() {
    try {
      mo.observe(document.body, { childList: true, subtree: true });
      scan(document.body);
    } catch (_) {}
  }
  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
