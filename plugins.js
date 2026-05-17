// CODEX — Plugin registry & runtime.
//
// Goal: let third parties (and our own future modules) extend CODEX without
// touching core files. A plugin is a plain JS object pushed into
// window.CODEX_PLUGINS or registered via window.CODEX_PLUGINS_API.register().
//
// Plugin shape:
//   {
//     id: "strongs-concordance",      // required, unique
//     name: "Strong's Concordance",   // required
//     version: "1.0.0",               // required
//     panels: [                       // optional — adds tabs to the right rail
//       { id: "strongs", label: "Strong's", glyph: "ℋ", render(ctx) { ... } }
//     ],
//     verseActions: [                 // optional — rows in the verse menu
//       { label: "Strong's Lookup", icon: "ℋ", handler(verseRef) { ... } }
//     ],
//     onNavigate(book, chapter) {},   // optional — chapter-change hook
//     onVerseSelect(ref) {},          // optional — verse-cursor hook
//   }
//
// Events dispatched on window:
//   codex:plugin-registered  { detail: { plugin } }
//   codex:navigate           { detail: { book, chapter } }
//   codex:verse-select       { detail: { ref } }
//
// Plugins are CODE (not data), so loading one is a privileged act — the user
// must opt in (host page includes the script, or a future installer prompts).
// We make a best effort to wrap every hook in try/catch so a single broken
// plugin can never brick the app.

(function () {
  if (typeof window === "undefined") return;

  // The array third-party scripts can push into directly:
  //   <script>window.CODEX_PLUGINS.push({ id: "...", ... })</script>
  // (We'll also wire register() to detect any pre-existing entries on boot.)
  if (!Array.isArray(window.CODEX_PLUGINS)) window.CODEX_PLUGINS = [];

  const registry = new Map();   // id -> plugin (canonical store)

  function isStr(v) { return typeof v === "string" && v.length > 0; }

  function validate(plugin) {
    if (!plugin || typeof plugin !== "object") {
      throw new Error("CODEX plugin: must be an object");
    }
    if (!isStr(plugin.id))      throw new Error("CODEX plugin: missing `id`");
    if (!isStr(plugin.name))    throw new Error("CODEX plugin: missing `name`");
    if (!isStr(plugin.version)) throw new Error("CODEX plugin: missing `version`");
    if (plugin.panels && !Array.isArray(plugin.panels)) {
      throw new Error(`CODEX plugin ${plugin.id}: panels must be an array`);
    }
    if (plugin.verseActions && !Array.isArray(plugin.verseActions)) {
      throw new Error(`CODEX plugin ${plugin.id}: verseActions must be an array`);
    }
    return true;
  }

  function dispatch(eventName, detail) {
    try { window.dispatchEvent(new CustomEvent(eventName, { detail })); }
    catch (e) { console.warn("CODEX plugins: dispatch failed", eventName, e); }
  }

  function register(plugin) {
    try { validate(plugin); }
    catch (e) { console.warn(e.message); return false; }

    if (registry.has(plugin.id)) {
      console.warn(`CODEX plugin: duplicate id "${plugin.id}" — skipping`);
      return false;
    }
    registry.set(plugin.id, plugin);
    // Keep the public array in sync so consumers can iterate either source.
    if (!window.CODEX_PLUGINS.includes(plugin)) window.CODEX_PLUGINS.push(plugin);
    dispatch("codex:plugin-registered", { plugin });
    return true;
  }

  function list() { return Array.from(registry.values()); }

  function getPanels() {
    const out = [];
    for (const p of registry.values()) {
      if (!Array.isArray(p.panels)) continue;
      for (const panel of p.panels) {
        if (!panel || !isStr(panel.id) || typeof panel.render !== "function") continue;
        out.push({
          pluginId: p.id,
          id: panel.id,
          label: panel.label || panel.id,
          glyph: panel.glyph || "◆",
          render: panel.render,
        });
      }
    }
    return out;
  }

  function getVerseActions() {
    const out = [];
    for (const p of registry.values()) {
      if (!Array.isArray(p.verseActions)) continue;
      for (const a of p.verseActions) {
        if (!a || typeof a.handler !== "function" || !isStr(a.label)) continue;
        out.push({
          pluginId: p.id,
          label: a.label,
          icon: a.icon || "◆",
          handler: a.handler,
        });
      }
    }
    return out;
  }

  function safeCall(fn, args, label) {
    try { return fn.apply(null, args); }
    catch (e) { console.warn(`CODEX plugin: ${label} threw`, e); }
  }

  function onNavigate(book, chapter) {
    for (const p of registry.values()) {
      if (typeof p.onNavigate === "function") {
        safeCall(p.onNavigate, [book, chapter], `${p.id}.onNavigate`);
      }
    }
  }

  function onVerseSelect(ref) {
    for (const p of registry.values()) {
      if (typeof p.onVerseSelect === "function") {
        safeCall(p.onVerseSelect, [ref], `${p.id}.onVerseSelect`);
      }
    }
  }

  window.CODEX_PLUGINS_API = {
    register, list, getPanels, getVerseActions,
    dispatch, onNavigate, onVerseSelect,
  };

  // If anything was pushed into CODEX_PLUGINS before the API loaded (or is
  // pushed in by an inline script after this file but before app.jsx boots),
  // adopt those entries on next microtask.
  function adoptPreRegistered() {
    const pending = window.CODEX_PLUGINS.slice();
    for (const p of pending) {
      if (p && p.id && !registry.has(p.id)) register(p);
    }
  }
  // Run once now (in case host pre-populated the array) and again at
  // DOMContentLoaded for late inline scripts.
  adoptPreRegistered();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", adoptPreRegistered, { once: true });
  }
})();

// ──────────────────────────────────────────────────────────────────────────
// EXAMPLE — drop this in a separate <script> tag to register a plugin:
//
//   window.CODEX_PLUGINS_API.register({
//     id: "hello-world",
//     name: "Hello World",
//     version: "0.1.0",
//     panels: [{
//       id: "hello",
//       label: "Hello",
//       glyph: "✦",
//       render({ book, chapter, verse, translation, container }) {
//         // Return a React element, OR mutate `container` directly.
//         container.textContent = `Hello from ${book} ${chapter}:${verse}`;
//       },
//     }],
//     verseActions: [{
//       label: "Log Verse",
//       icon: "▸",
//       handler(ref) { console.log("verse:", ref); },
//     }],
//     onNavigate(book, chapter) { console.log("nav:", book, chapter); },
//     onVerseSelect(ref)        { console.log("select:", ref); },
//   });
//
