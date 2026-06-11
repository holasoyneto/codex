// GENERATED from winhost.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
// CODEX — winhost.jsx · v8 MONAD: everything is a window.
//
// There is no difference between CROSS-REFS, PLANS, TIMELINE, STRONG'S and
// the consoles — every plugin panel can float as a real OS window: movable,
// resizable, minimizable, stackable, geometry persisted PER WINDOW, all
// driven by the same wm.js that runs Mirror/Map/Sword/OPS.
//
//   window.codexOpenWindow({ id, title, glyph })   id = "plugin:<p>:<panel>"
//
// Honest scoping: plugin panels are pure (ctx) => element renderers
// (PluginPanelHost), so they mount in a window exactly as they do in the
// rail — bound live to the reader via the codex:now bus. The eight BUILTIN
// panels (commentary, talmud, gematria…) are fed by the rail's data
// pipeline and stay there: codexOpenWindow falls back to the rail+deck for
// those rather than faking a window around missing data.
//
// Open windows persist (codex.windows.v1) and re-open on boot — the user's
// arrangement is theirs. Under os7 desktop, window.codexOpenPanel prefers
// windows for plugin ids; the rail remains the fallback everywhere else.

const WINHOST_KEY = "codex.windows.v1";

function winhostLoad() {
  try {return JSON.parse(localStorage.getItem(WINHOST_KEY) || "[]") || [];} catch {return [];}
}
function winhostSave(list) {
  try {localStorage.setItem(WINHOST_KEY, JSON.stringify(list.slice(0, 12)));} catch {}
}
function winhostDesktop() {
  try {
    return document.body.classList.contains("cx-os7") &&
    window.matchMedia("(min-width: 881px) and (pointer: fine)").matches;
  } catch {return false;}
}

// Resolve a "plugin:<pluginId>:<panelId>" id to the live plugin panel object.
function winhostResolve(id) {
  if (!id || id.indexOf("plugin:") !== 0) return null;
  const parts = id.split(":");
  const api = window.CODEX_PLUGINS_API;
  if (!api || !api.getPanels) return null;
  try {
    return (api.getPanels() || []).find((p) => p.pluginId === parts[1] && p.id === parts.slice(2).join(":")) || null;
  } catch {return null;}
}

// One floating window. The card mirrors the consoles' chrome so wm.js
// treats it identically; data-wm-id keys per-window geometry persistence.
function CodexWin({ win, onClose }) {
  // live passage context — the window follows the reader
  const [now, setNow] = useState(() => window.CODEX_NOW || null);
  useEffect(() => {
    const onNow = (e) => setNow(e.detail || window.CODEX_NOW || null);
    window.addEventListener("codex:now", onNow);
    return () => window.removeEventListener("codex:now", onNow);
  }, []);

  const panel = winhostResolve(win.id);
  const Host = window.PluginPanelHost;

  return (/*#__PURE__*/
    React.createElement("div", {
      className: "cx-win-backdrop",
      "data-wm-id": `win:${win.id}`,
      "data-wm-glyph": win.glyph || "▣" }, /*#__PURE__*/

    React.createElement("div", { className: "cx-win" }, /*#__PURE__*/
    React.createElement("header", { className: "cx-win-h" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-win-h-glyph", "aria-hidden": "true" }, win.glyph || "▣"), /*#__PURE__*/
    React.createElement("span", { className: "cx-win-h-title" }, win.title || win.id),
    now?.ref ? /*#__PURE__*/React.createElement("span", { className: "cx-win-h-ctx" }, now.ref) : null, /*#__PURE__*/
    React.createElement("button", { className: "cx-win-x", onClick: () => onClose(win), "aria-label": `Close ${win.title}`, title: "Close" }, "\xD7")
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-win-body" },
    panel && Host ? /*#__PURE__*/
    React.createElement(Host, {
      panel: panel,
      book: now?.book,
      bookId: now?.bookId,
      chapter: now?.chapter || 1,
      verse: now?.verse || 1,
      translation: now?.translation || window.CODEX_DATA?.tweaks?.primary || "web" }
    ) : /*#__PURE__*/

    React.createElement("div", { className: "cx-win-missing" }, /*#__PURE__*/
    React.createElement("b", null, "PANEL UNAVAILABLE"), /*#__PURE__*/
    React.createElement("p", null, panel ? "host not loaded" : "this panel hasn't registered yet — it opens in the study rail instead")
    )

    )
    )
    ));

}

function WinHostRoot() {
  const [wins, setWins] = useState(() => winhostDesktop() ? winhostLoad() : []);

  useEffect(() => {winhostSave(wins);}, [wins]);

  // public API
  useEffect(() => {
    window.codexOpenWindow = (spec) => {
      if (!spec || !spec.id) return false;
      if (!winhostDesktop()) return false;
      if (!winhostResolve(spec.id)) return false; // only plugin panels float
      setWins((prev) => {
        if (prev.some((w) => w.id === spec.id)) {
          // already open — surface it (wm focus happens on pointer; nudge via display)
          const bd = document.querySelector(`[data-wm-id="win:${spec.id}"]`);
          if (bd) {bd.style.display = "";bd.dispatchEvent(new Event("pointerdown", { bubbles: true }));}
          return prev;
        }
        return [...prev, { id: spec.id, title: spec.title || spec.id.split(":").pop().toUpperCase(), glyph: spec.glyph || "▣" }];
      });
      return true;
    };
    return () => {delete window.codexOpenWindow;};
  }, []);

  // Under the os7 desktop, plugin panels PREFER windows: wrap codexOpenPanel
  // once (the rail version stays the fallback for builtins/mobile/classic).
  useEffect(() => {
    const railOpen = window.codexOpenPanel;
    if (typeof railOpen !== "function") return;
    const wrapped = (id) => {
      if (winhostDesktop() && id && id.indexOf("plugin:") === 0) {
        const glyph = (window.CODEX_PLUGINS_API?.getPanels?.() || []).find(
          (p) => `plugin:${p.pluginId}:${p.id}` === id
        )?.glyph;
        if (window.codexOpenWindow({ id, glyph })) return;
      }
      railOpen(id);
    };
    window.codexOpenPanel = wrapped;
    return () => {if (window.codexOpenPanel === wrapped) window.codexOpenPanel = railOpen;};
  }, []);

  const close = (win) => setWins((prev) => prev.filter((w) => w.id !== win.id));

  return /*#__PURE__*/React.createElement(React.Fragment, null, wins.map((w) => /*#__PURE__*/React.createElement(CodexWin, { key: w.id, win: w, onClose: close })));
}

// Self-mounting — winhost owns its own root so app.jsx stays untouched.
(function mountWinhost() {
  if (typeof document === "undefined") return;
  const go = () => {
    try {
      const el = document.createElement("div");
      el.id = "cx-winhost";
      document.body.appendChild(el);
      const root = ReactDOM.createRoot(el);
      root.render(/*#__PURE__*/React.createElement(WinHostRoot, null));
    } catch (e) {/* never break boot */}
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go, { once: true });else
  go();
})();

Object.assign(window, { WinHostRoot });
})();
