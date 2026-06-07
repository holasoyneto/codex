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

    function assertAll() {
      var ok = true;
      try {
        var globals = (CODEX_BOOT_CONTRACT && CODEX_BOOT_CONTRACT.globals) || [];
        for (var i = 0; i < globals.length; i++) {
          var g = globals[i];
          if (!g || !g.name) continue;
          var val;
          try {
            val = window[g.name];
          } catch (_) {
            val = undefined;
          }
          if (typeof val === "undefined" || val === null) {
            ok = false;
            fail(g.name, "missing");
            continue;
          }
          var good = false;
          try {
            good = !!(g.shape && g.shape(val));
          } catch (_) {
            good = false;
          }
          if (!good) {
            ok = false;
            fail(g.name, "malformed");
          }
        }
      } catch (_) {
        // If the assertion machinery itself fails, do not mark ready, but
        // never throw.
        ok = false;
      }

      try {
        window.__CODEX_READY__ = !!ok;
      } catch (_) {}

      if (!ok) {
        try {
          // Production: just log. observability.js mirrors __CODEX_ERRORS__ too.
          console.error("[CODEX] boot-contract: one or more globals missing/malformed");
        } catch (_) {}
      }
      return ok;
    }

    // MUST run on 'load' — the .jsx phase is async, so phase:'jsx' globals
    // (e.g. codexJumpToRef) do not exist before the load event fires.
    try {
      if (document.readyState === "complete") {
        // 'load' already fired (unlikely this early, but be safe).
        setTimeout(assertAll, 0);
      } else {
        window.addEventListener("load", function () {
          try {
            assertAll();
          } catch (_) {}
        });
      }
    } catch (_) {}
  } catch (_) {
    // Never throw during boot.
  }
})();
