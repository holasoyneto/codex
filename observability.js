// observability.js — Phase 0.1 (additive, never throws, zero runtime behavior
// change for end users).
//
// This is the first EXTERNAL runtime <script> (loaded just before direct-api.js).
// It *augments* the inline 0.0 buffer (window.__CODEX_ERRORS__): it keeps the
// ring buffer capped, mirrors any NEW errors to console.error("[CODEX]", …),
// and — DEV ONLY (localhost or ?debug in the query string) — renders a small
// fixed bottom-right toast listing recent errors. Production users see nothing.
//
// Everything is wrapped/guarded so a failure here can never break boot.
(function () {
  "use strict";
  try {
    var CAP = 200;
    window.__CODEX_ERRORS__ = window.__CODEX_ERRORS__ || [];

    // Dev-only gate. No existing ?debug/localhost convention — we introduce it.
    var DEV = false;
    try {
      var host = (window.location && window.location.hostname) || "";
      var qs = (window.location && window.location.search) || "";
      DEV =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "[::1]" ||
        qs.indexOf("debug") !== -1;
    } catch (_) {
      DEV = false;
    }

    // ── Ring-buffer cap helper ────────────────────────────────────────────
    function clamp() {
      try {
        var a = window.__CODEX_ERRORS__;
        if (a && a.length > CAP) a.splice(0, a.length - CAP);
      } catch (_) {}
    }

    // ── Console mirror (always on, prod + dev) ────────────────────────────
    var mirrored = 0;
    function mirror() {
      try {
        var a = window.__CODEX_ERRORS__;
        if (!a) return;
        for (; mirrored < a.length; mirrored++) {
          var e = a[mirrored];
          if (!e) continue;
          try {
            console.error(
              "[CODEX]",
              (e.type || "error") + ":",
              e.message || "",
              e.src ? "(" + e.src + ")" : ""
            );
          } catch (_) {}
        }
      } catch (_) {}
    }

    // ── Dev toast (dev only) ──────────────────────────────────────────────
    var toastEl = null;
    function ensureToast() {
      if (!DEV) return null;
      try {
        if (toastEl && toastEl.parentNode) return toastEl;
        if (!document.body) return null;
        toastEl = document.createElement("div");
        toastEl.id = "cx-obs-toast";
        var s = toastEl.style;
        s.position = "fixed";
        s.right = "8px";
        s.bottom = "8px";
        s.zIndex = "2147483647";
        s.maxWidth = "min(420px, 90vw)";
        s.maxHeight = "40vh";
        s.overflow = "auto";
        s.padding = "8px 10px";
        s.borderRadius = "8px";
        s.background = "rgba(20,0,0,0.92)";
        s.color = "#ffd7d7";
        s.font = "11px/1.45 ui-monospace, Menlo, Consolas, monospace";
        s.border = "1px solid rgba(255,90,90,0.5)";
        s.boxShadow = "0 4px 20px rgba(0,0,0,0.5)";
        s.pointerEvents = "auto";
        s.whiteSpace = "pre-wrap";
        s.wordBreak = "break-word";
        document.body.appendChild(toastEl);
        return toastEl;
      } catch (_) {
        return null;
      }
    }

    function renderToast() {
      if (!DEV) return;
      try {
        var a = window.__CODEX_ERRORS__ || [];
        if (!a.length) {
          if (toastEl) toastEl.style.display = "none";
          return;
        }
        var el = ensureToast();
        if (!el) return;
        el.style.display = "block";
        // Show the most recent (up to 6) entries, newest last.
        var recent = a.slice(Math.max(0, a.length - 6));
        var lines = [];
        lines.push("[CODEX] " + a.length + " error(s)");
        for (var i = 0; i < recent.length; i++) {
          var e = recent[i] || {};
          var msg = String(e.message || "");
          if (msg.length > 160) msg = msg.slice(0, 157) + "…";
          var src = e.src ? " " + String(e.src) : "";
          lines.push("• " + (e.type || "error") + ": " + msg + src);
        }
        el.textContent = lines.join("\n");
      } catch (_) {}
    }

    // ── Poll for new entries and react (cheap; clears on idle) ─────────────
    var lastLen = -1;
    function tick() {
      try {
        clamp();
        var len = (window.__CODEX_ERRORS__ || []).length;
        if (len !== lastLen) {
          lastLen = len;
          mirror();
          renderToast();
        }
      } catch (_) {}
    }

    // Run once now, then on a light interval. (No MutationObserver on the
    // array — plain polling is simplest and cannot throw.)
    tick();
    try {
      setInterval(tick, 1500);
    } catch (_) {}

    // Also flush immediately after window load (when CDN/boot-contract entries
    // are most likely to have just been pushed).
    try {
      window.addEventListener("load", function () {
        try {
          // Defer one tick so boot-contract's load handler has run.
          setTimeout(tick, 0);
        } catch (_) {
          tick();
        }
      });
    } catch (_) {}
  } catch (_) {
    // Never throw during boot.
  }
})();
