// boot-contract.js — Phase 0.2 (additive, never throws, zero runtime behavior
// change for end users).
//
// Second EXTERNAL runtime <script> (right after observability.js, before
// direct-api.js). Defines a manifest of the most critical globals with shape
// predicates and a phase tag:
//   phase:'js'  → must exist after the synchronous .js parse phase
//   phase:'jsx' → only exists after the ASYNC .jsx (babel) phase, i.e. after
//                 createRoot, which is why this contract is asserted on the
//                 window 'load' event (not DOMContentLoaded).
//
// On 'load' it asserts each global, pushes a precise
//   '[boot-contract] missing/malformed: <name>'
// entry into window.__CODEX_ERRORS__ for every failure, and sets
//   window.__CODEX_READY__ = true   ONLY if all checks pass.
// It NEVER throws; in production it just logs.
//
// Shape predicates below were verified by reading the defining files
// (do NOT change them without re-verifying the source):
//   BIBLE.loadChapter            → bible.js:1024 returned object
//   CODEX_DATA.books             → data.js:6 literal Array
//   CODEX_PLUGINS_API.register   → plugins.js:138
//   CODEX_PANELS.load + cacheKey → panels-gen.js:694
//   CODEX_SEARCH.search          → search.js:622  (NOTE: real fn is `search`,
//                                  not `query` — predicate matches the real
//                                  shape per FOUNDATION's "verify, don't guess".)
//   codexJumpToRef               → app.jsx:2308 (set in a useEffect → phase jsx)
(function () {
  "use strict";
  try {
    window.__CODEX_ERRORS__ = window.__CODEX_ERRORS__ || [];

    function isFn(f) {
      return typeof f === "function";
    }

    var CODEX_BOOT_CONTRACT = {
      baselineSha: null, // filled in once the Phase-0 BASE commit exists
      globals: [
        {
          name: "BIBLE",
          phase: "js",
          shape: function (b) {
            return !!b && isFn(b.loadChapter);
          }
        },
        {
          name: "CODEX_DATA",
          phase: "js",
          shape: function (d) {
            return !!d && Array.isArray(d.books) && d.books.length > 0;
          }
        },
        {
          name: "CODEX_PLUGINS_API",
          phase: "js",
          shape: function (a) {
            return !!a && isFn(a.register);
          }
        },
        {
          name: "CODEX_PANELS",
          phase: "js",
          shape: function (p) {
            return !!p && isFn(p.load) && isFn(p.cacheKey);
          }
        },
        {
          name: "CODEX_SEARCH",
          phase: "js",
          // Real exposed API is `search` (search.js:622), not `query`.
          shape: function (s) {
            return !!s && isFn(s.search);
          }
        },
        {
          name: "codexJumpToRef",
          phase: "jsx",
          shape: function (f) {
            return isFn(f);
          }
        }
      ],
      events: [
        // The 45 verified codex:* event names + payload notes land here in
        // Phase 3 (events.js). Intentionally empty for Phase 0.
      ]
    };

    // Expose for the smoke harness / debugging.
    try {
      window.CODEX_BOOT_CONTRACT = CODEX_BOOT_CONTRACT;
    } catch (_) {}

    function fail(name, why) {
      try {
        window.__CODEX_ERRORS__.push({
          when: Date.now(),
          type: "boot-contract",
          message: "[boot-contract] " + why + ": " + name,
          src: ""
        });
      } catch (_) {}
    }

    // One non-logging pass → returns the list of missing/malformed globals.
    function checkOnce() {
      var missing = [];
      var globals = (CODEX_BOOT_CONTRACT && CODEX_BOOT_CONTRACT.globals) || [];
      for (var i = 0; i < globals.length; i++) {
        var g = globals[i];
        if (!g || !g.name) continue;
        var val;
        try { val = window[g.name]; } catch (_) { val = undefined; }
        if (typeof val === "undefined" || val === null) { missing.push({ name: g.name, why: "missing" }); continue; }
        var good = false;
        try { good = !!(g.shape && g.shape(val)); } catch (_) { good = false; }
        if (!good) missing.push({ name: g.name, why: "malformed" });
      }
      return missing;
    }

    // phase:'jsx' globals appear only after the async .jsx phase — and some
    // (e.g. codexJumpToRef, set in a React useEffect) appear AFTER the 'load'
    // event, once effects have committed. A single check on 'load' would log a
    // false "missing" and never set __CODEX_READY__. So poll for a bounded
    // window; only treat globals still absent past the deadline as real
    // failures. ~8s comfortably covers cold-start transpile + first effects.
    var DEADLINE_MS = 8000, INTERVAL_MS = 150;
    function runWithRetry(startedAt) {
      var missing;
      try { missing = checkOnce(); } catch (_) { missing = [{ name: "(checker)", why: "threw" }]; }
      if (!missing.length) {
        try { window.__CODEX_READY__ = true; } catch (_) {}
        return;
      }
      if (Date.now() - startedAt < DEADLINE_MS) {
        try { setTimeout(function () { runWithRetry(startedAt); }, INTERVAL_MS); } catch (_) {}
        return;
      }
      // Deadline exceeded → genuine failure: log each still-missing global once.
      for (var i = 0; i < missing.length; i++) fail(missing[i].name, missing[i].why);
      try { window.__CODEX_READY__ = false; } catch (_) {}
      try { console.error("[CODEX] boot-contract: globals missing/malformed after " + DEADLINE_MS + "ms"); } catch (_) {}
    }

    function start() { runWithRetry(Date.now()); }

    // Asserted starting at 'load' (the .jsx phase is async), then polled until
    // the effect-set jsx globals land or the deadline passes.
    try {
      if (document.readyState === "complete") {
        setTimeout(start, 0);
      } else {
        window.addEventListener("load", function () { try { start(); } catch (_) {} });
      }
    } catch (_) {}
  } catch (_) {
    // Never throw during boot.
  }
})();
