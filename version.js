// CODEX version — THE single source of truth ("FRESH" pipeline).
//
// ⚠️ BOUND TO sw.js: the SW cannot importScripts this file without adding a
// network/cache dependency to its own parse, so sw.js mirrors `sw` below in
// its `const VERSION` line. WHEN YOU BUMP `sw` HERE, BUMP sw.js VERSION TOO
// (one grep: `const VERSION =`). Everything else (header badge, what's-new
// flash, update toast) reads this file directly — never hardcode versions
// anywhere else.
//
// Classic script: `self` works in both window and worker scopes.
self.CODEX_VERSION = {
  v: "12.0",     // user-facing app version
  sw: "v269",    // service-worker cache generation — MIRRORED in sw.js line ~21
  notes: [
    "THE WHOLE DESKTOP IS YOURS: every window now drags flush to any edge — the bug that pinned the galaxy is gone; spread your study across the entire screen",
    "⊞ ARRANGE: one tap lays your open windows side-by-side, in thirds, or quad — and you can NAME and save study setups to recall later",
    "EVERY WINDOW: − to minimize, ⧉ to pop out onto another monitor; the dock has clear line icons now, live previews on right-click, and you can drag to reorder",
  ],
};

// ── WHAT'S NEW flash (window scope only; plain DOM, no React) ─────────
// On boot, if the stored last-seen version differs from CODEX_VERSION.v,
// show a small dismissible glass card (bottom-right) with the notes.
// Dismissing stores the version so the card appears once per update.
if (typeof window !== "undefined" && typeof document !== "undefined") {
  (function () {
    var KEY = "codex.lastver";
    var cur = self.CODEX_VERSION.v;
    var last = null;
    try { last = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
    if (last === cur) return;
    if (last === null) {
      // First-ever visit: nothing to delta against — just record and skip.
      try { localStorage.setItem(KEY, cur); } catch (e) {}
      return;
    }

    function dismiss(card) {
      try { localStorage.setItem(KEY, cur); } catch (e) {}
      card.classList.add("cx-fresh-out");
      setTimeout(function () { if (card.parentNode) card.parentNode.removeChild(card); }, 350);
    }

    function show() {
      if (document.getElementById("cx-whatsnew")) return;
      var card = document.createElement("div");
      card.id = "cx-whatsnew";
      card.setAttribute("role", "status");
      var ul = self.CODEX_VERSION.notes.slice(0, 4).map(function (n) {
        return "<li>" + n + "</li>";
      }).join("");
      card.innerHTML =
        '<div class="cx-whatsnew-head"><span class="cx-whatsnew-title">✦ WHAT’S NEW · v' + cur + "</span>" +
        '<button class="cx-whatsnew-x" type="button" aria-label="Dismiss">×</button></div>' +
        '<ul class="cx-whatsnew-list">' + ul + "</ul>";
      card.querySelector(".cx-whatsnew-x").addEventListener("click", function () { dismiss(card); });
      document.body.appendChild(card);
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { setTimeout(show, 1200); });
    } else {
      setTimeout(show, 1200);
    }
  })();
}

// ── SELF-UPDATE pill (window scope; plain DOM) ────────────────────────
// The end of the double-reload ritual. The SW already skipWaiting()s on
// install and claims clients — so when a new version lands, the PAGE is
// what's stale, not the worker. We watch for that moment and offer one
// tap: controllerchange (a new SW took over this page) or a waiting
// worker (belt & braces: we post SKIP_WAITING) → show the pill → tap →
// reload once → current. A 30-min reg.update() poll while visible means
// long-lived tabs hear about updates without a navigation.
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  (function () {
    var shown = false;
    var booted = false;
    setTimeout(function () { booted = true; }, 4000); // ignore the initial claim on first install

    function pill() {
      if (shown || document.getElementById("cx-fresh")) return;
      shown = true;
      var el = document.createElement("button");
      el.id = "cx-fresh";
      el.type = "button";
      el.setAttribute("role", "status");
      el.innerHTML = "✦ CODEX updated — <b>tap to refresh</b>";
      el.addEventListener("click", function () {
        el.disabled = true;
        el.innerHTML = "✦ refreshing…";
        location.reload();
      });
      document.body.appendChild(el);
    }

    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (booted) pill();
    });

    function watch(reg) {
      if (!reg) return;
      if (reg.waiting) { try { reg.waiting.postMessage({ type: "SKIP_WAITING" }); } catch (e) {} }
      reg.addEventListener("updatefound", function () {
        var w = reg.installing;
        if (!w) return;
        w.addEventListener("statechange", function () {
          if (w.state === "installed" && navigator.serviceWorker.controller) pill();
        });
      });
      // long-lived tabs: ask for updates every 30 min while visible
      setInterval(function () {
        if (document.visibilityState === "visible") { try { reg.update(); } catch (e) {} }
      }, 30 * 60 * 1000);
    }

    if (document.readyState === "complete") {
      navigator.serviceWorker.getRegistration().then(watch).catch(function () {});
    } else {
      window.addEventListener("load", function () {
        setTimeout(function () {
          navigator.serviceWorker.getRegistration().then(watch).catch(function () {});
        }, 800);
      });
    }
  })();
}
