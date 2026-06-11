// shell.js — the NOCTURNE shell boot. Classic script, loaded right before
// wm.js. Owns two things:
//   1. body.cx-os7 — ALWAYS ON since v9.2 SHED. The desk is the app; the
//      classic mode, its localStorage flag ("codex.os7") and the
//      window.codexOS7() toggle are gone. The class name stays (hundreds
//      of scoped CSS rules ride on it).
//   2. The wallpaper: a #cx-wall starfield canvas prepended to <body>.
//      ~240 accent-tinted stars in three parallax depth bands, drifting
//      extremely slowly. DPR-aware, resize-safe, fully paused while the tab
//      is hidden, and a single static frame under prefers-reduced-motion.
(function () {
  "use strict";
  if (window.__CXSHELL) return;
  window.__CXSHELL = true;

  var STAR_COUNT = 240;
  var DRIFT = 0.0016; // normalized viewport-widths per second for the nearest band — a full crossing takes ~10 min

  var canvas = null, ctx = null, stars = null;
  var raf = 0, lastT = 0, running = false;
  var tint = { r: 126, g: 224, b: 255 }; // fallback ≈ --cx-accent #7ee0ff

  var mqReduce = null;
  try { mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)"); } catch (_) {}
  function reduced() { return !!(mqReduce && mqReduce.matches); }

  // ── Mode flag — permanently on (v9.2 SHED) ──────────────────────────────
  function isOn() { return true; }

  function applyClass() {
    if (!document.body) return;
    document.body.classList.add("cx-os7");
    syncWall();
  }

  // ── Starfield wallpaper ─────────────────────────────────────────────────
  function readTint() {
    try {
      var v = getComputedStyle(document.body).getPropertyValue("--cx-accent").trim();
      var m = v.match(/^#([0-9a-f]{6})$/i);
      if (m) {
        tint = {
          r: parseInt(m[1].slice(0, 2), 16),
          g: parseInt(m[1].slice(2, 4), 16),
          b: parseInt(m[1].slice(4, 6), 16)
        };
        return;
      }
      m = v.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
      if (m) tint = { r: +m[1], g: +m[2], b: +m[3] };
    } catch (_) {}
  }

  function makeStars() {
    stars = [];
    for (var i = 0; i < STAR_COUNT; i++) {
      var z = Math.random(); // 0 = far, 1 = near
      stars.push({
        x: Math.random(),            // normalized coords — survive resizes
        y: Math.random(),
        z: z,
        r: 0.4 + z * 1.1,            // CSS-px radius before DPR scale
        a: 0.18 + z * 0.5 + Math.random() * 0.12,
        tw: Math.random() * Math.PI * 2,  // twinkle phase
        ts: 0.15 + Math.random() * 0.35   // twinkle speed (rad/s)
      });
    }
  }

  function ensureCanvas() {
    if (canvas && canvas.isConnected) return true;
    if (!document.body) return false;
    canvas = document.getElementById("cx-wall");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "cx-wall";
      canvas.setAttribute("aria-hidden", "true");
      canvas.style.cssText =
        "position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;display:none;";
      document.body.insertBefore(canvas, document.body.firstChild);
    }
    ctx = canvas.getContext("2d");
    return !!ctx;
  }

  function sizeCanvas() {
    if (!canvas) return;
    var dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
    var w = window.innerWidth, h = window.innerHeight;
    var pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    canvas.__dpr = dpr;
  }

  function draw(t) {
    if (!ctx || !stars) return;
    var dpr = canvas.__dpr || 1;
    var w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var twinkle = reduced() ? 1 : (0.78 + 0.22 * Math.sin(s.tw + t * s.ts));
      var a = Math.min(1, s.a * twinkle);
      // Mix the accent into white by depth — near stars whiter, far stars more tinted.
      var mix = 0.35 + (1 - s.z) * 0.45;
      var r = Math.round(255 + (tint.r - 255) * mix);
      var g = Math.round(255 + (tint.g - 255) * mix);
      var b = Math.round(255 + (tint.b - 255) * mix);
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r * dpr, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + a.toFixed(3) + ")";
      ctx.fill();
    }
  }

  function step(now) {
    raf = 0;
    if (!running) return;
    var t = now / 1000;
    var dt = lastT ? Math.min(0.25, t - lastT) : 0;
    lastT = t;
    // Parallax drift — extremely slow, depth-weighted; wrap at the edges.
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var v = DRIFT * (0.2 + s.z * 0.8);
      s.x += v * dt;
      s.y += v * 0.22 * dt;
      if (s.x > 1.002) s.x -= 1.004;
      if (s.y > 1.002) s.y -= 1.004;
    }
    draw(t);
    raf = requestAnimationFrame(step);
  }

  function startWall() {
    if (!ensureCanvas()) return;
    readTint();
    if (!stars) makeStars();
    sizeCanvas();
    canvas.style.display = "";
    if (reduced()) {
      // Static wallpaper: one frame, no loop.
      running = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      draw(0);
      return;
    }
    if (running) return;
    running = true;
    lastT = 0;
    if (!raf) raf = requestAnimationFrame(step);
  }

  function stopWall(hide) {
    running = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    lastT = 0;
    if (hide && canvas) canvas.style.display = "none";
  }

  // The single gate: wall runs only when os7 is on, the tab is visible, and
  // motion is allowed (otherwise a static frame stays painted).
  function syncWall() {
    var on = !!(document.body && document.body.classList.contains("cx-os7"));
    if (!on) { stopWall(true); return; }
    if (document.hidden) { stopWall(false); return; }
    startWall();
  }

  document.addEventListener("visibilitychange", syncWall);
  window.addEventListener("resize", function () {
    if (canvas && canvas.style.display !== "none") {
      sizeCanvas();
      if (!running) draw(0); // keep the static (reduced-motion/hidden) frame crisp
    }
  });
  if (mqReduce) {
    var onMotionPref = function () { syncWall(); };
    if (mqReduce.addEventListener) mqReduce.addEventListener("change", onMotionPref);
    else if (mqReduce.addListener) mqReduce.addListener(onMotionPref);
  }
  // Theme swaps change --cx-accent; refresh the tint lazily on theme events.
  window.addEventListener("codex:theme", function () { readTint(); });

  function boot() { applyClass(); }
  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
