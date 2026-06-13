// CODEX — displays.js · v10 MANY SCREENS, ONE CURSOR — multi-display
// support for intense studying.
//
// Any surface of CODEX can be thrown onto another monitor as its own
// browser window, and every window shares ONE reading cursor:
//
//   window.codexDisplays.open("reader" | "library" | "oracle" |
//                             "marks" | "galaxy")
//     → opens   index.html?surface=<s>&follow=1   as a popup the user
//       drags to the second display.
//
//   ?surface=<s>   boots the app focused on that surface (the desk opens
//                  only the matching window; galaxy opens the console).
//   &follow=1      marks the window a FOLLOWER.
//
// Sync: a BroadcastChannel ("codex-displays"). The window where you
// navigate posts its cursor; every other window with a different cursor
// jumps to match. Ref-equality guards kill echo loops. Zero servers, zero
// accounts — it's the browser's own bus.

(function () {
  "use strict";
  if (typeof window === "undefined" || window.__CXDISPLAYS) return;
  window.__CXDISPLAYS = true;

  var params = new URLSearchParams(window.location.search);
  var SURFACE = params.get("surface");
  var FOLLOW = params.get("follow") === "1" || !!SURFACE;

  // Each builtin panel that lives in its own window (panels.jsx /
  // codexDeskPanels) gets a satellite surface too — ?surface=trans opens a
  // window with only the TRANSLATIONS instrument on the second monitor, and
  // so on. The surface key is just the panel id; open() routes through
  // codexOpenPanel once the app is ready.
  function panelSurface(id, label) {
    return { label: label, open: function () { if (window.codexOpenPanel) window.codexOpenPanel(id); } };
  }
  var SURFACES = {
    reader:  { label: "Reader",  open: function () { var d = window.codexDesk; if (d) { d.open("reader"); } } },
    library: { label: "Library", open: function () { var d = window.codexDesk; if (d) { d.open("library"); } } },
    oracle:  { label: "Oracle",  open: function () { var d = window.codexDesk; if (d) { d.open("oracle"); } } },
    marks:   { label: "Marks",   open: function () { var d = window.codexDesk; if (d) { d.open("marks"); } } },
    galaxy:  { label: "Galaxy",  open: function () { if (window.codexOpenConstellation) window.codexOpenConstellation(); } },
    // v11.5 — every builtin panel can ride its own monitor.
    trans:   panelSurface("trans",  "Translations"),
    talmud:  panelSurface("talmud", "Talmud"),
    comm:    panelSurface("comm",   "Commentary"),
    gem:     panelSurface("gem",    "Gematria"),
    gnosis:  panelSurface("gnosis", "Gnosis"),
    disarm:  panelSurface("disarm", "Disarm"),
    exeg:    panelSurface("exeg",   "Exegesis"),
    txan:    panelSurface("txan",   "Words"),
  };

  // wm.js asks "which surface (if any) can pop this window id onto another
  // monitor?" — it owns the header ⧉ button, this owns the surface routing.
  // Map the WM's window ids (data-wm-id / console spec id) → surface key.
  function surfaceForWid(wid) {
    if (!wid) return null;
    var map = {
      "win:sys:reader": "reader", "win:sys:library": "library",
      "win:sys:oracle": "oracle", "win:sys:marks": "marks",
      "const": "galaxy",
    };
    if (map[wid]) return map[wid];
    // builtin panels: win:builtin:<id> → that panel's surface.
    var m = /^win:builtin:(.+)$/.exec(wid);
    if (m && SURFACES[m[1]]) return m[1];
    return null;
  }

  // ── The shared cursor bus ────────────────────────────────────────────
  var chan = null;
  try { chan = new BroadcastChannel("codex-displays"); } catch (_) {}
  var applying = false;

  function currentRef() {
    var n = window.CODEX_NOW;
    return n && n.ref ? String(n.ref) : null;
  }

  window.addEventListener("codex:now", function () {
    if (!chan || applying) return;
    var ref = currentRef();
    if (ref) { try { chan.postMessage({ kind: "now", ref: ref }); } catch (_) {} }
  });

  if (chan) chan.onmessage = function (e) {
    var msg = e && e.data;
    if (!msg || msg.kind !== "now" || !msg.ref) return;
    if (msg.ref === currentRef()) return;            // echo guard
    if (typeof window.codexJumpToRef !== "function") return;
    applying = true;
    try { window.codexJumpToRef(msg.ref); } catch (_) {}
    // release after the resulting codex:now has fired
    setTimeout(function () { applying = false; }, 150);
  };

  // ── Boot a ?surface= window into its single-surface arrangement ──────
  function bootSurface() {
    if (!SURFACE || !SURFACES[SURFACE]) return;
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      var ready = window.__CODEX_READY__ === true;
      if (!ready && tries < 120) return;
      clearInterval(t);
      if (!ready) return;
      try {
        document.body.classList.add("cx-display-" + SURFACE);
        var d = window.codexDesk;
        if (d && d.on && d.on()) {
          // a satellite shows ONLY its surface (reader satellites keep just the reader)
          if (SURFACE !== "reader" && d.state().reader && SURFACE !== "galaxy") {
            // keep the reader on study satellites? No — one surface, one screen.
            d.close && d.close("reader");
          }
          ["library", "oracle", "marks"].forEach(function (k) {
            if (k !== SURFACE && d.state()[k] && d.close) d.close(k);
          });
        }
        SURFACES[SURFACE].open();
        try { document.title = "CODEX · " + SURFACES[SURFACE].label.toUpperCase(); } catch (_) {}
      } catch (_) {}
    }, 250);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootSurface, { once: true });
  else bootSurface();

  // ── Public API ───────────────────────────────────────────────────────
  window.codexDisplays = {
    surfaces: Object.keys(SURFACES),
    surfaceForWid: surfaceForWid,
    isFollower: function () { return FOLLOW; },
    surface: function () { return SURFACE; },
    open: function (s) {
      if (!SURFACES[s]) return false;
      var url = window.location.pathname + "?surface=" + encodeURIComponent(s) + "&follow=1";
      var w = Math.min(1280, (window.screen && window.screen.availWidth) || 1280);
      var h = Math.min(900, (window.screen && window.screen.availHeight) || 900);
      try {
        window.open(url, "codex-display-" + s, "popup=yes,width=" + w + ",height=" + h);
        return true;
      } catch (_) { return false; }
    },
  };
})();
