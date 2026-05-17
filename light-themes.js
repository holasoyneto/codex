// CODEX — Light-mode theme variants.
//
// 8 day-mode palettes selectable by user: Parchment (default), Vellum,
// Linen, Sandstone, Sage, Solarized, Slate, Rose, Old Book.
// Variant is applied via [data-light-theme] attribute on the .cx-app
// element. The corresponding CSS lives in styles.css.
//
// Persists choice to localStorage so it survives reloads.

(function () {
  "use strict";

  const KEY = "codex.lightTheme.v1";
  const DEFAULT = "parchment"; // matches the bare .cx-app.is-light rule

  const THEMES = [
    { id: "parchment", label: "Parchment", bg: "#ece4d2", fg: "#1a1d28", accent: "#0a6884" },
    { id: "vellum",    label: "Vellum",    bg: "#f4e9cd", fg: "#2a2010", accent: "#8a4f1a" },
    { id: "linen",     label: "Linen",     bg: "#f7f5ee", fg: "#161616", accent: "#1f5fbf" },
    { id: "sandstone", label: "Sandstone", bg: "#efd9b8", fg: "#3a2010", accent: "#8c3a14" },
    { id: "sage",      label: "Sage",      bg: "#e6e8d4", fg: "#1c2418", accent: "#4a6b30" },
    { id: "solarized", label: "Solarized", bg: "#fdf6e3", fg: "#073642", accent: "#268bd2" },
    { id: "slate",     label: "Slate",     bg: "#e2e6ec", fg: "#1a2230", accent: "#2a5a8a" },
    { id: "rose",      label: "Rose",      bg: "#f4e2dc", fg: "#2a1216", accent: "#9c2a4a" },
    { id: "old-book",  label: "Old Book",  bg: "#f1e8d2", fg: "#0a0608", accent: "#6a1a08" },
  ];

  function get() {
    try {
      const v = localStorage.getItem(KEY);
      if (v && THEMES.some(t => t.id === v)) return v;
    } catch {}
    return DEFAULT;
  }

  function apply(name) {
    const id = THEMES.some(t => t.id === name) ? name : DEFAULT;
    // Find the .cx-app root (may not exist before React mount; default to body)
    const root = document.querySelector(".cx-app") || document.body;
    if (id === DEFAULT) {
      root.removeAttribute("data-light-theme");
    } else {
      root.setAttribute("data-light-theme", id);
    }
    // Sync theme-color meta so the iOS notch tint follows the palette
    try {
      const theme = THEMES.find(t => t.id === id);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta && theme) meta.setAttribute("content", theme.bg);
    } catch {}
  }

  function set(name) {
    try { localStorage.setItem(KEY, name); } catch {}
    apply(name);
    try {
      window.dispatchEvent(new CustomEvent("codex:light-theme-change", { detail: { theme: name } }));
    } catch {}
  }

  // Apply on load. The .cx-app element won't exist yet at script-eval time,
  // so re-apply once after React mounts via a one-shot mutation observer.
  apply(get());
  const obs = new MutationObserver(() => {
    if (document.querySelector(".cx-app")) {
      apply(get());
      obs.disconnect();
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  // Public API for the picker UI in tweaks-panel.jsx
  window.CODEX_LIGHT_THEMES = {
    list: () => THEMES.slice(),
    get,
    set,
    DEFAULT,
  };
})();
