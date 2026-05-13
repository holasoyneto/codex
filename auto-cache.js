// CODEX auto-cache — first-install warm-up.
//
// True "install once, works forever" requires more than the SW shell:
// the user's primary translation needs every chapter on disk before
// they ever lose connectivity. This module triggers a background
// downloadAll() for the primary translation the first time the app
// loads, then sets a flag so it never runs again.
//
// Subsequent translations are still on-demand (Settings → Bible →
// Download all), since pre-pulling every translation would be tens of
// MB and not all users want every translation.
//
// Progress is broadcast via window events so the footer can show it:
//   codex:autocache-start  { translation, total }
//   codex:autocache-tick   { translation, done, total }
//   codex:autocache-done   { translation, done, total }
//   codex:autocache-error  { translation, error }
//
// Storage:
//   localStorage["codex.autocache.v1"] = JSON({ done: ["kjv"], at: ts })

(function () {
  const FLAG_LS = "codex.autocache.v1";
  const TWEAKS_LS = "codex.tweaks";  // app.jsx writes settings here
  const DEFAULT_TRANSLATION = "kjv";

  function loadFlag() {
    try { return JSON.parse(localStorage.getItem(FLAG_LS) || "null") || { done: [], at: 0 }; }
    catch { return { done: [], at: 0 }; }
  }
  function saveFlag(f) {
    try { localStorage.setItem(FLAG_LS, JSON.stringify(f)); } catch {}
  }

  function primaryTranslation() {
    try {
      const tw = JSON.parse(localStorage.getItem(TWEAKS_LS) || "null") || {};
      return tw.primaryTranslation || DEFAULT_TRANSLATION;
    } catch { return DEFAULT_TRANSLATION; }
  }

  function emit(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch {}
  }

  async function warmUp() {
    const flag = loadFlag();
    const primary = primaryTranslation();

    // Already pre-cached this translation? Skip.
    if (flag.done.includes(primary)) return;

    // Wait until BIBLE module is ready (bible.js exposes window.BIBLE).
    let tries = 0;
    while ((!window.BIBLE || !window.BIBLE.downloadAll || !window.CODEX_DATA) && tries < 50) {
      await new Promise(r => setTimeout(r, 200));
      tries++;
    }
    if (!window.BIBLE || !window.BIBLE.downloadAll) return;

    // If the user has already navigated extensively and most chapters
    // are present, skip — they're effectively cached already.
    try {
      const stats = window.BIBLE.cacheStats(primary, null);
      if (stats && stats.fully) {
        flag.done.push(primary);
        flag.at = Date.now();
        saveFlag(flag);
        emit("codex:autocache-done", { translation: primary, done: stats.have || 0, total: stats.have || 0 });
        return;
      }
    } catch {}

    const books = window.CODEX_DATA.books;
    const total = books.reduce((n, b) => n + (b.chapters || 0), 0);

    emit("codex:autocache-start", { translation: primary, total });

    let done = 0;
    let lastTickAt = 0;
    const onProgress = (info) => {
      done = (info && (info.done || info.completed)) || (done + 1);
      const now = Date.now();
      // Throttle UI updates to ~5/sec.
      if (now - lastTickAt > 200) {
        lastTickAt = now;
        emit("codex:autocache-tick", { translation: primary, done, total });
      }
    };

    try {
      const ctrl = window.BIBLE.downloadAll(primary, books, onProgress);
      // downloadAll returns a controller — wait on its done promise if
      // exposed, or poll cacheStats as a fallback.
      if (ctrl && typeof ctrl.then === "function") {
        await ctrl;
      } else if (ctrl && ctrl.done && typeof ctrl.done.then === "function") {
        await ctrl.done;
      } else {
        // Fallback poll loop (~3 min worst case).
        for (let i = 0; i < 900; i++) {
          await new Promise(r => setTimeout(r, 200));
          try {
            const s = window.BIBLE.cacheStats(primary, null);
            if (s && s.fully) break;
          } catch {}
        }
      }
      flag.done.push(primary);
      flag.at = Date.now();
      saveFlag(flag);
      emit("codex:autocache-done", { translation: primary, done, total });
    } catch (e) {
      emit("codex:autocache-error", { translation: primary, error: String(e && e.message || e) });
    }
  }

  // Kick off after the page settles so we don't compete with the initial
  // render. Idle callback when supported, fallback to a 4-second timer.
  function schedule() {
    const start = () => { warmUp().catch(() => {}); };
    if ("requestIdleCallback" in window) {
      requestIdleCallback(() => setTimeout(start, 1500), { timeout: 6000 });
    } else {
      setTimeout(start, 4000);
    }
  }

  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule);

  // Expose for manual re-trigger / debugging.
  window.CODEX_AUTOCACHE = {
    state: loadFlag,
    reset() { try { localStorage.removeItem(FLAG_LS); } catch {} },
    runNow() { return warmUp(); },
  };
})();
