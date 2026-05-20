// CODEX — right-rail panels: Translations · Talmud · Commentary · Gematria · Gnosis
// Panels now consume `panelData` passed from App (either a hand-crafted seed
// for John 1 / Genesis 1, or a Claude-generated JSON object for any other
// passage). Sections are collapsible.

// Tab labels look up at render time via the window.t() helper so language
// switches reach the right rail without a remount.
function railTabs() {
  const t = window.t || ((k) => k);
  const builtIns = [
    { id: "trans",  label: t("panel.translations"), glyph: "Α/Ω" },
    { id: "talmud", label: t("panel.talmud"),       glyph: "ת"   },
    { id: "comm",   label: t("panel.commentary"),   glyph: "§"   },
    { id: "gem",    label: t("panel.gematria"),     glyph: "Σn"  },
    { id: "gnosis", label: t("panel.gnosis"),       glyph: "⟁"   },
    { id: "exeg",   label: t("panel.exegesis"), glyph: "✎" },
    { id: "txan",   label: t("panel.txanalysis"), glyph: "⟷" },
  ];
  // Merge plugin-registered panel tabs. Each plugin panel gets a unique tab
  // id namespaced as `plugin:<pluginId>:<panelId>` to avoid collisions.
  const pluginPanels = (window.CODEX_PLUGINS_API && window.CODEX_PLUGINS_API.getPanels()) || [];
  const pluginTabs = pluginPanels.map(p => ({
    id: `plugin:${p.pluginId}:${p.id}`,
    label: p.label,
    glyph: p.glyph || "◆",
    isPlugin: true,
    plugin: p,
  }));
  return [...builtIns, ...pluginTabs];
}
// Expose so the global keyboard shortcut handler can map "1".."9" to tab ids
// without re-declaring the canonical list.
if (typeof window !== "undefined") window.railTabs = railTabs;

// ── Panel palette ──────────────────────────────────────────────────────
// A command-palette style picker that replaces the old overflow tab-strip.
// Opens via the ⌘ button in the rail header or Cmd/Ctrl+K. Tabs are grouped
// into intent-driven sections (READING, STUDY, REFERENCE, DISCOVER, FORGE)
// and filterable by typing. The rail itself only shows 3 user-pinned tabs
// plus the palette button — much calmer at 280px and beyond.
const PALETTE_SECTIONS = [
  { id: "reading",   label: "READING",   ids: ["trans"] },
  { id: "study",     label: "STUDY",     ids: ["comm", "talmud", "exeg", "txan", "gem", "gnosis"] },
  { id: "reference", label: "REFERENCE", ids: ["plugin:strongs-concordance:strongs", "plugin:crossrefs:crossrefs", "plugin:word-study:word", "plugin:dictionary:dictionary", "plugin:passage-guide:guide"] },
  { id: "discover",  label: "DISCOVER",  ids: ["plugin:reels:reels", "plugin:timeline:timeline", "plugin:jewish-study:torah", "plugin:plans:plans", "plugin:ai-quests:quests", "plugin:builder:builder"] },
  { id: "forge",     label: "FORGE",     ids: ["plugin:babelforge:babel", "plugin:marketplace:market"] },
];
const PALETTE_DESCRIPTIONS = {
  trans: "Translations and side-by-side compare",
  comm: "Commentary on the open passage",
  talmud: "Talmudic context and questions",
  exeg: "Verse-level exegesis",
  txan: "Word-by-word translation analysis",
  gem: "Gematria and numeric resonance",
  gnosis: "Esoteric / mystical reading layer",
  "plugin:strongs-concordance:strongs": "Strong's concordance lookups",
  "plugin:crossrefs:crossrefs": "Cross-references for the verse",
  "plugin:word-study:word": "Deep word studies",
  "plugin:dictionary:dictionary": "Bible dictionary",
  "plugin:passage-guide:guide": "Guided tour of the passage",
  "plugin:reels:reels": "Short-form scripture reels",
  "plugin:timeline:timeline": "Biblical timeline",
  "plugin:jewish-study:torah": "Torah portions and Jewish lens",
  "plugin:plans:plans": "Reading plans",
  "plugin:ai-quests:quests": "Quests and challenges",
  "plugin:builder:builder": "Study workspace builder",
  "plugin:babelforge:babel": "BabelForge translation playground",
  "plugin:marketplace:market": "Plugin marketplace",
};
const DEFAULT_PINNED = ["trans", "comm", "plugin:strongs-concordance:strongs"];
const PINNED_KEY = "codex.rail.pinned";
function loadPinned() {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    if (!raw) return DEFAULT_PINNED.slice();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length) return arr.slice(0, 3);
  } catch {}
  return DEFAULT_PINNED.slice();
}
function savePinned(arr) {
  try { localStorage.setItem(PINNED_KEY, JSON.stringify(arr.slice(0, 3))); } catch {}
}

function PanelPalette({ open, onClose, tabs, currentTab, onPick, pinned, onPin, gnosisOn, onToggleGnosis }) {
  const [q, setQ] = React.useState("");
  const inputRef = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    setQ("");
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", onKey, true);
    return () => { cancelAnimationFrame(id); document.removeEventListener("keydown", onKey, true); };
  }, [open, onClose]);
  if (!open) return null;
  const byId = new Map(tabs.map(t => [t.id, t]));
  const filter = q.trim().toLowerCase();
  const matches = (tb) => !filter
    || tb.label.toLowerCase().includes(filter)
    || (PALETTE_DESCRIPTIONS[tb.id] || "").toLowerCase().includes(filter);
  const pick = (tb) => {
    if (tb.id === "gnosis" && !gnosisOn) onToggleGnosis(true);
    onPick(tb.id);
    onClose();
  };
  const node = (
    <div className="cx-palette-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cx-palette" role="dialog" aria-modal="true" aria-label="Panel library">
        <header className="cx-palette-hd">
          <span className="cx-palette-sigil" aria-hidden="true">⌘</span>
          <input
            ref={inputRef}
            className="cx-palette-input"
            type="text"
            placeholder="Search panels…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="cx-palette-x" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="cx-palette-body">
          {PALETTE_SECTIONS.map(sec => {
            const items = sec.ids.map(id => byId.get(id)).filter(Boolean).filter(matches);
            if (!items.length) return null;
            return (
              <section key={sec.id} className="cx-palette-sect">
                <h4>{sec.label}</h4>
                <div className="cx-palette-grid">
                  {items.map(tb => {
                    const isActive = tb.id === currentTab;
                    const isPinned = pinned.includes(tb.id);
                    return (
                      <button
                        key={tb.id}
                        className={`cx-palette-card ${isActive ? "is-active" : ""} ${isPinned ? "is-pinned" : ""}`}
                        onClick={() => pick(tb)}
                        title={PALETTE_DESCRIPTIONS[tb.id] || tb.label}
                      >
                        <span className="cx-palette-glyph" aria-hidden="true">{tb.glyph}</span>
                        <span className="cx-palette-meta">
                          <span className="cx-palette-lbl">{tb.label}</span>
                          <span className="cx-palette-desc">{PALETTE_DESCRIPTIONS[tb.id] || ""}</span>
                        </span>
                        <span
                          className={`cx-palette-pin ${isPinned ? "is-on" : ""}`}
                          role="button"
                          tabIndex={0}
                          aria-label={isPinned ? "Unpin" : "Pin to rail"}
                          onClick={(e) => { e.stopPropagation(); onPin(tb.id); }}
                        >{isPinned ? "★" : "☆"}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        <footer className="cx-palette-ft">
          <kbd>Esc</kbd> close · <kbd>⌘K</kbd> open · ★ pins to rail
        </footer>
      </div>
    </div>
  );
  return ReactDOM.createPortal(node, document.body);
}

function RightRail({
  tab, onTab, gnosisOn, onToggleGnosis,
  primary, onPrimary, compareSet, onToggleCompare,
  passage, currentVerse,
  panelData, panelStatus, panelMeta, onRegeneratePanels, onClose, onJumpRef,
  isCollapsed, onCollapse,
  pluginVersion, translation,
}) {
  // Recompute on plugin registration so new tabs appear without a remount.
  const tabs = useMemo(() => railTabs(), [pluginVersion]);
  const activePluginTab = tabs.find(x => x.id === tab && x.isPlugin);

  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [pinned, setPinned] = React.useState(loadPinned);
  const togglePin = (id) => {
    setPinned(prev => {
      let next;
      if (prev.includes(id)) next = prev.filter(x => x !== id);
      else next = [...prev, id].slice(-3); // newest stays, max 3
      savePinned(next);
      return next;
    });
  };

  // Global Cmd/Ctrl+K opens the palette. Esc handled inside the palette.
  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        // Don't fight an open text field that already uses ⌘K
        if (e.target && /input|textarea/i.test(e.target.tagName)) return;
        e.preventDefault();
        setPaletteOpen(v => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Resolve pinned ids → live tab objects. Skip any that have been
  // unregistered (e.g. plugin disabled) so we don't render dead chips.
  const byId = new Map(tabs.map(t => [t.id, t]));
  const pinnedTabs = pinned.map(id => byId.get(id)).filter(Boolean);
  // Always include the currently-active tab as a chip if it isn't pinned,
  // so users see what panel they're on without opening the palette.
  if (tab && !pinned.includes(tab) && byId.get(tab)) {
    pinnedTabs.push(byId.get(tab));
  }
  // Mobile-only bottom-sheet drag-to-close. Captures touches in the top
  // 28px of the rail (visual handle area) and translates the sheet down.
  // Past 120px (or velocity > 0.6 px/ms), fire onClose. Desktop ignored.
  const railRef = React.useRef(null);
  React.useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    if (typeof window === "undefined") return;
    const isMobile = () => window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
    let startY = 0, lastY = 0, lastT = 0, startT = 0, dragging = false;
    const onStart = (e) => {
      if (!isMobile()) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      const rect = el.getBoundingClientRect();
      if (t.clientY - rect.top > 28) return;   // only top handle region
      dragging = true;
      startY = lastY = t.clientY;
      startT = lastT = performance.now();
      el.style.transition = "none";
    };
    const onMove = (e) => {
      if (!dragging) return;
      const t = e.touches && e.touches[0]; if (!t) return;
      const dy = Math.max(0, t.clientY - startY);  // clamp upward
      el.style.transform = `translateY(${dy}px)`;
      lastY = t.clientY; lastT = performance.now();
    };
    const onEnd = () => {
      if (!dragging) return;
      dragging = false;
      const dy = Math.max(0, lastY - startY);
      const dt = Math.max(1, lastT - startT);
      const vel = dy / dt;
      el.style.transition = "";
      if (dy > 120 || vel > 0.6) {
        el.style.transform = "";
        try { onClose && onClose(); } catch {}
      } else {
        el.style.transform = "";
      }
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [onClose]);

  return (
    <aside ref={railRef} className="cx-rail cx-rail-r">
      <RightRailResizer />
      <button className="cx-rail-close" onClick={onClose} aria-label="Close panels">×</button>
      {onCollapse ? (
        <button
          className="cx-rail-fold cx-rail-fold-r"
          onClick={onCollapse}
          title="Hide panels (click the spine to bring them back)"
          aria-label="Collapse right rail"
        >▶</button>
      ) : null}
      <div className="cx-tabs is-pinned" role="tablist" aria-label="Panel tabs">
        <button
          type="button"
          className={`cx-palette-btn ${paletteOpen ? "is-on" : ""}`}
          onClick={() => setPaletteOpen(v => !v)}
          title="Open panel library (⌘K)"
          aria-label="Open panel library"
        >
          <span className="cx-palette-btn-glyph">⌘</span>
          <span className="cx-palette-btn-lbl">Library</span>
        </button>
        <div className="cx-tabs-pinned">
          {pinnedTabs.map((tb) => {
            const disabled = tb.id === "gnosis" && !gnosisOn;
            return (
              <button
                key={tb.id}
                role="tab"
                aria-selected={tab === tb.id}
                data-tab-id={tb.id}
                title={tb.label}
                className={`cx-tab ${tab === tb.id ? "is-active" : ""} ${disabled ? "is-locked" : ""} ${tb.isPlugin ? "is-plugin" : ""}`}
                onClick={() => {
                  if (tb.id === "gnosis" && !gnosisOn) onToggleGnosis(true);
                  onTab(tb.id);
                }}
              >
                <span className="cx-tab-glyph" aria-hidden="true">{tb.glyph}</span>
                <span className="cx-tab-lbl">{tb.label}</span>
                {disabled ? <span className="cx-tab-lock">⌬</span> : null}
              </button>
            );
          })}
        </div>
      </div>
      <PanelPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        tabs={tabs}
        currentTab={tab}
        onPick={onTab}
        pinned={pinned}
        onPin={togglePin}
        gnosisOn={gnosisOn}
        onToggleGnosis={onToggleGnosis}
      />

      <div className="cx-tab-body">
        {tab === "trans" && (
          <TranslationsPanel
            primary={primary}
            onPrimary={onPrimary}
            compareSet={compareSet}
            onToggleCompare={onToggleCompare}
            passage={passage}
            currentVerse={currentVerse}
          />
        )}
        {tab === "talmud" && (
          <TalmudPanel panelData={panelData} status={panelStatus} meta={panelMeta} passage={passage}
                       onRegenerate={onRegeneratePanels} />
        )}
        {tab === "comm" && (
          <CommentaryPanel panelData={panelData} status={panelStatus} meta={panelMeta} passage={passage}
                           onRegenerate={onRegeneratePanels} onJumpRef={onJumpRef} />
        )}
        {tab === "gem" && (
          <GematriaPanel panelData={panelData} status={panelStatus} meta={panelMeta} passage={passage}
                         onRegenerate={onRegeneratePanels} />
        )}
        {tab === "gnosis" && (
          <GnosisPanel panelData={panelData} status={panelStatus} meta={panelMeta} passage={passage}
                       gnosisOn={gnosisOn} onToggleGnosis={onToggleGnosis}
                       onRegenerate={onRegeneratePanels} />
        )}
        {tab === "exeg" && (
          <ExegesisPanel passage={passage} currentVerse={currentVerse} />
        )}
        {tab === "txan" && (
          <TranslationAnalysisPanel
            passage={passage}
            currentVerse={currentVerse}
            primary={primary}
            compareSet={compareSet}
            onJumpRef={onJumpRef}
          />
        )}
        {activePluginTab ? (
          <PluginPanelHost
            panel={activePluginTab.plugin}
            book={passage.book}
            bookId={passage.bookId}
            chapter={passage.chapter}
            verse={currentVerse}
            translation={translation || primary}
          />
        ) : null}
      </div>
    </aside>
  );
}

// ── Plugin error boundary ─────────────────────────────────────────────
// Catches throws from inside a plugin's React tree so one broken plugin
// can't take down the whole app. Resets via key when panel switches.
class PluginErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) {
    console.warn("[CODEX plugin error]", err, info);
  }
  render() {
    if (this.state.err) {
      return (
        <div className="cx-plugin-error">
          <b>Plugin crashed</b>
          <pre>{String(this.state.err.message || this.state.err)}</pre>
          <small>This crash was caught and contained — the rest of the app keeps working.</small>
        </div>
      );
    }
    return this.props.children;
  }
}

// DOM-mutation plugin mount — for non-React plugins that paint into a
// raw container. Has a proper unmount that clears the container so the
// plugin can clean up listeners on its end via MutationObserver if it
// cares. React tree never touches this subtree, so there's no
// reconciliation conflict.
function DomPluginMount({ panel, book, bookId, chapter, verse, translation }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    try {
      const r = panel.render({ book, bookId, chapter, verse, translation, container: el });
      if (typeof r === "string") el.textContent = r;
    } catch (e) {
      console.warn(`[CODEX plugin "${panel.pluginId}:${panel.id}" DOM mount threw]`, e);
      el.textContent = `Plugin error: ${e.message || e}`;
    }
    return () => {
      // Cleanup on unmount or before next render — plugin's MutationObserver
      // sees the wipe and can shut down listeners.
      if (el) el.innerHTML = "";
    };
  }, [panel, book, bookId, chapter, verse, translation]);
  return <div ref={ref} className="cx-plugin-mount-dom" />;
}

// Host that mounts a plugin panel.
//
// Two paths:
//   1. React-element plugins (the common case): render() returns a React
//      element. We just render it inside an ErrorBoundary. React owns
//      lifecycle — clean mount/unmount when key changes. No DOM
//      mutation. This is what Reels, Strong's, Cross-refs, etc. use.
//   2. DOM-mutation plugins: render() returns nothing useful and mutates
//      the `container` arg directly. We delegate to DomPluginMount which
//      keeps React out of that subtree entirely.
//
// The previous implementation tried to do both in one effect, calling
// `el.innerHTML = ""` to reset between renders. That wiped React-managed
// DOM out from under the reconciler — switching tabs (e.g. Reels →
// Strong's) crashed the whole app. Fixed by splitting paths and using a
// stable key so React unmounts the prior plugin tree cleanly.
function PluginPanelHost({ panel, book, bookId, chapter, verse, translation }) {
  const ctx = { book, bookId, chapter, verse, translation };
  // Call render synchronously in the render phase. For most plugins
  // this returns a fresh React element. Don't wrap in state — the
  // ErrorBoundary handles failures from inside the returned tree, and
  // synchronous throws are caught here.
  let reactEl = null;
  let renderErr = null;
  try { reactEl = panel.render(ctx); }
  catch (e) { renderErr = e; }

  const isReact = reactEl && (
    React.isValidElement(reactEl) ||
    typeof reactEl === "string" ||
    typeof reactEl === "number"
  );
  // Stable key per plugin tab — switching tabs forces a full unmount of
  // the previous plugin's tree (including useEffect cleanups, intervals,
  // listeners). This is the lifecycle Reels et al. need.
  const panelKey = `${panel.pluginId || "?"}:${panel.id}`;

  return (
    <div className="cx-pane cx-pane-plugin">
      <PaneHead title={panel.label.toUpperCase()} sub={`${book} ${chapter}${verse ? ":" + verse : ""}`} />
      {renderErr ? (
        <div className="cx-plugin-error">
          <b>Plugin failed to render</b>
          <pre>{String(renderErr.message || renderErr)}</pre>
        </div>
      ) : isReact ? (
        <PluginErrorBoundary key={panelKey}>
          <div className="cx-plugin-mount">{reactEl}</div>
        </PluginErrorBoundary>
      ) : (
        <DomPluginMount key={panelKey} panel={panel} book={book} bookId={bookId}
                        chapter={chapter} verse={verse} translation={translation} />
      )}
    </div>
  );
}

// ── Generic collapsible group ───────────────────────────────────────────
function Collapsible({ open: openProp, defaultOpen = true, title, sub, accent, children, count }) {
  const controlled = typeof openProp === "boolean";
  const [openS, setOpenS] = useState(defaultOpen);
  const open = controlled ? openProp : openS;
  return (
    <section className={`cx-coll ${open ? "is-open" : ""}`}>
      <button className="cx-coll-h" onClick={() => !controlled && setOpenS(o => !o)}>
        <span className="cx-coll-arr" aria-hidden>▾</span>
        <span className="cx-coll-title">
          {accent ? <i className="cx-coll-accent" style={{background: accent}} /> : null}
          {title}
        </span>
        {typeof count === "number" ? <span className="cx-coll-count">{pad(count)}</span> : null}
        {sub ? <span className="cx-coll-sub">{sub}</span> : null}
      </button>
      <div className="cx-coll-body">{children}</div>
    </section>
  );
}

// ── Status / placeholder rendering for AI-generated panes ───────────────
function PanelStatus({ status, passage, onRegenerate, kind }) {
  if (status.loading) {
    return (
      <div className="cx-pane-status is-loading">
        <div className="cx-pane-spin"><i/><i/><i/></div>
        <b>DRAFTING {kind.toUpperCase()} · {passage.book} {passage.chapter}</b>
        <span>oracle is composing scholarly companions across traditions…</span>
      </div>
    );
  }
  if (status.error) {
    return (
      <div className="cx-pane-status is-err">
        <b>{(window.t && window.t("panel.offline")) || "ORACLE OFFLINE"}</b>
        <span>{status.error}</span>
        <button className="cx-pane-retry" onClick={onRegenerate}>{(window.t && window.t("panel.retry")) || "↻ RETRY"}</button>
      </div>
    );
  }
  const ref = `${passage.book} ${passage.chapter}`;
  const emptyBody = ((window.t && window.t("panel.empty.body")) || "Generate companion material for {ref}.").replace("{ref}", ref);
  return (
    <div className="cx-pane-status">
      <b>{(window.t && window.t("panel.empty")) || "NO PANEL CACHE"}</b>
      <span>{emptyBody}</span>
      <button className="cx-pane-retry" onClick={onRegenerate}>{(window.t && window.t("panel.draft")) || "✦ DRAFT VIA ORACLE"}</button>
    </div>
  );
}

// ── TRANSLATIONS ────────────────────────────────────────────────────────
// Offline-download state lives at module scope so a download keeps running
// even if the user switches panels. Map of translationId → { done, total,
// controller, complete?, error? }. A re-render is scheduled by setting
// `_dlVer` (a tick counter) on every progress event.
const _dlState = new Map();
const _dlListeners = new Set();
function _dlNotify() { for (const fn of _dlListeners) try { fn(); } catch {} }

// ── Auto-bundle on first read ──────────────────────────────────────────
// When the user picks a translation that has zero cached chapters we
// silently start downloadAll() in the background so the next chapter /
// book is instant. Throttled to one auto-download at a time so we don't
// thrash the upstream API.
const TP_AUTO_BUNDLE_KEY = "codex.tp.autobundle.v1";  // "1" | "0"
const _autoBundleQueue = [];
let   _autoBundleActive = null;  // translation id currently bundling
const _autoBundleTried = new Set();

function _autoBundleEnabled() {
  try {
    const v = localStorage.getItem(TP_AUTO_BUNDLE_KEY);
    return v === null ? true : v === "1";
  } catch { return true; }
}
function _toast(msg, kind = "info") {
  try { window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg, kind } })); } catch {}
}
function _autoBundleDrain() {
  if (_autoBundleActive) return;
  const next = _autoBundleQueue.shift();
  if (!next) return;
  const { t, books } = next;
  // Re-check stats — the user may have already started a manual DL.
  try {
    const s = window.BIBLE.cacheStats(t.id, books);
    if (s && s.fully) { _autoBundleDrain(); return; }
  } catch {}
  const existing = _dlState.get(t.id);
  if (existing && existing.controller && !existing.complete && !existing.aborted) {
    // A manual download is already running for this translation.
    _autoBundleDrain();
    return;
  }
  _autoBundleActive = t.id;
  const total = books.reduce((n, b) => n + (b.chapters || 0), 0);
  _dlState.set(t.id, { done: 0, total, controller: null, auto: true });
  _dlNotify();
  const ctrl = window.BIBLE.downloadAll(t.id, books, (p) => {
    _dlState.set(t.id, { ...p, controller: ctrl, auto: true });
    try {
      window.dispatchEvent(new CustomEvent("codex:autocache-tick", {
        detail: { translation: t.id, done: p.done || 0, total: p.total || total },
      }));
    } catch {}
    _dlNotify();
  });
  _dlState.set(t.id, { done: 0, total, controller: ctrl, auto: true });
  try {
    window.dispatchEvent(new CustomEvent("codex:autocache-start", {
      detail: { translation: t.id, total },
    }));
  } catch {}
  _dlNotify();
  const finish = () => {
    try {
      window.dispatchEvent(new CustomEvent("codex:autocache-done", {
        detail: { translation: t.id, done: total, total },
      }));
    } catch {}
    _autoBundleActive = null;
    _autoBundleDrain();
  };
  if (ctrl && typeof ctrl.then === "function") {
    ctrl.then(finish, finish);
  } else if (ctrl && ctrl.done && typeof ctrl.done.then === "function") {
    ctrl.done.then(finish, finish);
  } else {
    // Poll fallback.
    const poll = () => {
      try {
        const s = window.BIBLE.cacheStats(t.id, books);
        if (s && s.fully) return finish();
        const cur = _dlState.get(t.id);
        if (!cur || cur.aborted || cur.complete) return finish();
      } catch {}
      setTimeout(poll, 800);
    };
    setTimeout(poll, 800);
  }
}
function maybeAutoBundle(t, books) {
  if (!t || !books || !_autoBundleEnabled()) return;
  if (!window.BIBLE || !window.BIBLE.downloadAll || !window.BIBLE.cacheStats) return;
  // Skip user-forged BabelForge bibles (already stored locally) and bundle-source.
  if (t.source === "bundle") return;
  if (_autoBundleTried.has(t.id)) return;
  let stats;
  try { stats = window.BIBLE.cacheStats(t.id, books); } catch { return; }
  if (!stats || stats.cached > 0) {
    _autoBundleTried.add(t.id);
    return;
  }
  _autoBundleTried.add(t.id);
  _autoBundleQueue.push({ t, books });
  _toast(`Bundling ${t.name} for offline use…`, "info");
  _autoBundleDrain();
}
// Expose for app.jsx prefetch + diagnostics.
try {
  window.CODEX_TP = Object.assign(window.CODEX_TP || {}, {
    maybeAutoBundle,
    autoBundleEnabled: _autoBundleEnabled,
    setAutoBundle(on) {
      try { localStorage.setItem(TP_AUTO_BUNDLE_KEY, on ? "1" : "0"); } catch {}
    },
  });
} catch {}

// Display names for the language groupings in the translations panel.
const LANG_NAMES = {
  EN: "English",   ES: "Español",   DE: "Deutsch",   PT: "Português",
  FR: "Français",  LA: "Latina",    HE: "עברית",    EL: "Ἑλληνική",
  HI: "हिन्दी",
};
const DEFAULT_LANG_ORDER = ["EN","ES","FR","DE","PT","LA","HE","EL","HI"];
const TP_LANG_ORDER_KEY     = "codex.tp.lang.order.v1";
const TP_LANG_COLLAPSED_KEY = "codex.tp.lang.collapsed.v1";
const TP_TRANS_ORDER_KEY    = "codex.tp.trans.order.v1";

const tpLoad = (k, fallback) => {
  try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v ?? fallback; }
  catch { return fallback; }
};
const tpSave = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

function TranslationsPanel({ primary, onPrimary, compareSet, onToggleCompare, passage, currentVerse }) {
  const data = window.CODEX_DATA;
  const verse = passage.verses.find(v => v.n === currentVerse) || passage.verses[0];
  const primaryMeta = data.translations.find(t => t.id === primary);
  const primaryText = verse ? (verse[primary] || "—") : "—";
  const [bumpKey, bump] = useState(0);
  const userIds = new Set((window.loadRepos?.() || []).map(r => r.id));
  const [query, setQuery] = useState("");
  const [ctxMenu, setCtxMenu] = useState(null); // { t, x, y }
  const searchRef = useRef(null);

  // Wrap parent callbacks so picking / comparing auto-kicks the bundler.
  const onPrimaryWrap = (id) => {
    const t = data.translations.find(x => x.id === id);
    onPrimary(id);
    if (t) maybeAutoBundle(t, data.books);
  };
  const onToggleCompareWrap = (id) => {
    const wasOn = compareSet.includes(id);
    onToggleCompare(id);
    if (!wasOn) {
      const t = data.translations.find(x => x.id === id);
      if (t) maybeAutoBundle(t, data.books);
    }
  };

  // ── User-defined ordering / collapse state ──
  const [langOrder,   setLangOrder]   = useState(() => tpLoad(TP_LANG_ORDER_KEY, DEFAULT_LANG_ORDER));
  const [collapsed,   setCollapsed]   = useState(() => new Set(tpLoad(TP_LANG_COLLAPSED_KEY, [])));
  const [transOrder,  setTransOrder]  = useState(() => tpLoad(TP_TRANS_ORDER_KEY, {}));
  const [drag, setDrag] = useState(null); // { kind: "lang"|"trans", id, lang? }
  const [dropHint, setDropHint] = useState(null); // `${kind}:${id}`

  const persistLangOrder  = (v) => { setLangOrder(v);  tpSave(TP_LANG_ORDER_KEY, v); };
  const persistCollapsed  = (v) => { setCollapsed(v);  tpSave(TP_LANG_COLLAPSED_KEY, [...v]); };
  const persistTransOrder = (v) => { setTransOrder(v); tpSave(TP_TRANS_ORDER_KEY, v); };

  const toggleLang = (lang) => {
    const next = new Set(collapsed);
    if (next.has(lang)) next.delete(lang); else next.add(lang);
    persistCollapsed(next);
  };

  // Group translations by language, honouring saved order. Unknown langs and
  // newly added translations append in source order so nothing ever vanishes.
  const groups = useMemo(() => {
    const byLang = new Map();
    for (const t of data.translations) {
      const k = t.lang || "??";
      if (!byLang.has(k)) byLang.set(k, []);
      byLang.get(k).push(t);
    }
    const orderedLangs = [
      ...langOrder.filter(l => byLang.has(l)),
      ...[...byLang.keys()].filter(l => !langOrder.includes(l)),
    ];
    return orderedLangs.map(lang => {
      const items = byLang.get(lang);
      const saved = transOrder[lang] || [];
      const ordered = [
        ...saved.map(id => items.find(t => t.id === id)).filter(Boolean),
        ...items.filter(t => !saved.includes(t.id)),
      ];
      return { lang, items: ordered };
    });
  }, [data.translations, langOrder, transOrder, bumpKey]);

  // ── Drag-and-drop handlers ──
  const onDragStart = (kind, id, lang) => (e) => {
    setDrag({ kind, id, lang });
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", id); } catch {}
  };
  const onDragEnd = () => { setDrag(null); setDropHint(null); };
  const onDragOver = (kind, id) => (e) => {
    if (!drag || drag.kind !== kind) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropHint(`${kind}:${id}`);
  };
  const onDropLang = (overLang) => (e) => {
    e.preventDefault();
    if (!drag || drag.kind !== "lang" || drag.id === overLang) return onDragEnd();
    const present = groups.map(g => g.lang);
    const next = present.filter(l => l !== drag.id);
    const idx = next.indexOf(overLang);
    next.splice(idx, 0, drag.id);
    persistLangOrder(next);
    onDragEnd();
  };
  const onDropTrans = (lang, overId) => (e) => {
    e.preventDefault();
    if (!drag || drag.kind !== "trans" || drag.lang !== lang || drag.id === overId) return onDragEnd();
    const group = groups.find(g => g.lang === lang);
    const ids = group.items.map(t => t.id).filter(id => id !== drag.id);
    const idx = ids.indexOf(overId);
    ids.splice(idx, 0, drag.id);
    persistTransOrder({ ...transOrder, [lang]: ids });
    onDragEnd();
  };

  // Subscribe to download tick so progress + completion repaint live.
  useEffect(() => {
    const fn = () => bump(n => n + 1);
    _dlListeners.add(fn);
    return () => _dlListeners.delete(fn);
  }, []);

  // Re-render when a translation is installed/removed (e.g. BabelForge
  // forges a Bible). data.translations is mutated in place so the
  // useMemo above would otherwise miss it.
  useEffect(() => {
    const fn = () => bump(n => n + 1);
    window.addEventListener("codex:translations-changed", fn);
    return () => window.removeEventListener("codex:translations-changed", fn);
  }, []);

  // Per-translation cache stats. Recompute on every bump (download progress
  // tick OR cache mutation) so the offline indicator reflects live state —
  // _dlState.size only changes when a key is first added so it missed the
  // progress + completion deltas, leaving the icon stuck on "save offline"
  // even after the cache was full.
  const stats = useMemo(() => {
    const m = {};
    for (const t of data.translations) {
      m[t.id] = window.BIBLE.cacheStats(t.id, data.books);
    }
    return m;
  }, [data.translations, data.books, bumpKey]);
  // Also re-derive when BIBLE.ready resolves so cached stats appear after
  // the IDB warm-load instead of staying at 0/0 until the user clicks.
  useEffect(() => {
    const onReady = () => bump(n => n + 1);
    window.addEventListener("codex:bible:ready", onReady);
    if (window.BIBLE?.ready) window.BIBLE.ready.then(onReady);
    return () => window.removeEventListener("codex:bible:ready", onReady);
  }, []);

  const startDownload = (t, { silent } = {}) => {
    if (_dlState.get(t.id)?.controller && !_dlState.get(t.id)?.complete) return;
    const total = data.books.reduce((s,b)=>s+b.chapters,0);
    const controller = window.BIBLE.downloadAll(t.id, data.books, (p) => {
      _dlState.set(t.id, { ...p, controller });
      _dlNotify();
    });
    _dlState.set(t.id, { done: 0, total, controller });
    _dlNotify();
    if (!silent) _toast(`Saving ${t.name} offline…`, "info");
  };
  const stopDownload = (t) => {
    const s = _dlState.get(t.id);
    s?.controller?.abort();
    _toast(`Paused ${t.name} download`, "warn");
  };
  const clearOffline = (t, { skipConfirm } = {}) => {
    if (!skipConfirm && !window.confirm(`Remove offline copy of ${t.name}? Active reading will re-fetch as you go.`)) return;
    try {
      if (typeof window.BIBLE.removeTranslation === "function") {
        window.BIBLE.removeTranslation(t.id);
      } else {
        const raw = JSON.parse(localStorage.getItem("codex.bible.cache.v2") || "{}");
        for (const k of Object.keys(raw)) if (k.endsWith(`.${t.id}`)) delete raw[k];
        localStorage.setItem("codex.bible.cache.v2", JSON.stringify(raw));
      }
    } catch {}
    _dlState.delete(t.id);
    _autoBundleTried.delete(t.id);
    _dlNotify();
  };

  // Context menu actions (right-click / long-press).
  const openCtx = (t, ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    setCtxMenu({ t, x: ev.clientX, y: ev.clientY });
  };
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); }, { once: true });
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [ctxMenu]);

  // Forge-from: open BabelForge pre-filled with this translation as source.
  const forgeFrom = (t) => {
    try {
      window.dispatchEvent(new CustomEvent("codex:babelforge-forge-from", { detail: { sourceTr: t.id } }));
    } catch {}
  };

  // Cmd+F focuses the filter (when panel is mounted/focused).
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        if (searchRef.current && document.activeElement !== searchRef.current) {
          e.preventDefault();
          searchRef.current.focus();
          searchRef.current.select?.();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const collapseAll = () => persistCollapsed(new Set(groups.map(g => g.lang)));
  const expandAll   = () => persistCollapsed(new Set());

  // Tap-to-copy + long-press share for the preview blockquote.
  const previewRef = useRef(null);
  const copyPreview = () => {
    if (!verse) return;
    const ref = `${passage.book} ${passage.chapter}:${verse.n}`;
    const text = `${primaryText.trim()} — ${ref} (${primaryMeta?.name || primary})`;
    try {
      navigator.clipboard?.writeText(text);
      _toast(`Copied · ${ref}`, "ok");
    } catch { _toast("Copy failed", "err"); }
  };
  const sharePreview = () => {
    if (!verse || !navigator.share) return copyPreview();
    const ref = `${passage.book} ${passage.chapter}:${verse.n}`;
    navigator.share({ title: ref, text: `${primaryText.trim()} — ${ref}` }).catch(() => {});
  };
  const onPreviewPointerDown = (e) => {
    if (!previewRef.current) return;
    let longPressed = false;
    const timer = setTimeout(() => { longPressed = true; sharePreview(); }, 550);
    const up = () => {
      clearTimeout(timer);
      previewRef.current?.removeEventListener("pointerup", up);
      previewRef.current?.removeEventListener("pointercancel", up);
      previewRef.current?.removeEventListener("pointerleave", up);
      if (!longPressed) copyPreview();
    };
    previewRef.current.addEventListener("pointerup", up);
    previewRef.current.addEventListener("pointercancel", up);
    previewRef.current.addEventListener("pointerleave", up);
  };

  // Filter groups by query (name OR lang OR id).
  const q = query.trim().toLowerCase();
  const filteredGroups = !q ? groups : groups.map(g => {
    const items = g.items.filter(t =>
      (t.name || "").toLowerCase().includes(q) ||
      (t.lang || "").toLowerCase().includes(q) ||
      (t.id   || "").toLowerCase().includes(q) ||
      (t.year || "").toString().includes(q)
    );
    return { ...g, items };
  }).filter(g => g.items.length);

  const removeOne = (t) => {
    if (!userIds.has(t.id)) return;
    if (!window.confirm(`Remove ${t.name} from your library? Cached chapters will be cleared.`)) return;
    window.removeRepo(t.id);
    if (compareSet.includes(t.id)) onToggleCompare(t.id);
    if (primary === t.id) onPrimary("kjv");
    bump(n => n + 1);
  };

  return (
    <div className="cx-pane cx-tp">
      <PaneHead title="TRANSLATIONS" sub={`${passage.book} ${passage.chapter}:${verse?.n ?? "—"}`} />

      {/* Primary verse preview — tap copies, long-press shares */}
      <blockquote
        ref={previewRef}
        className="cx-tp-quote is-tappable"
        onPointerDown={onPreviewPointerDown}
        title="Tap to copy · long-press to share"
        style={{ touchAction: "manipulation", userSelect: "none", cursor: "pointer" }}
      >
        <span className="cx-tp-quote-glyph" style={{ fontSize: "1.15em" }}>{primaryMeta?.glyph}</span>
        <span className="cx-tp-quote-text">{primaryText}</span>
        <span className="cx-tp-quote-vn" style={{ fontFeatureSettings: '"tnum"', opacity: 0.55, marginLeft: 6, fontSize: 11 }}>
          {verse ? `${verse.n}` : ""}
        </span>
      </blockquote>

      {/* Filter + bulk-collapse controls */}
      <div className="cx-tp-toolbar" style={{ display: "flex", gap: 6, alignItems: "center", padding: "4px 8px 6px", fontFamily: "var(--cx-mono)", fontSize: 11 }}>
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter translations · name, lang, id"
          className="cx-tp-filter"
          aria-label="Filter translations"
          style={{
            flex: 1, background: "transparent", color: "var(--cx-fg)",
            border: "1px solid color-mix(in oklab, var(--cx-accent) 22%, transparent)",
            borderRadius: 3, padding: "4px 7px", fontFamily: "inherit", fontSize: 11,
            outline: "none",
          }}
        />
        <button
          type="button"
          className="cx-tp-mini-btn"
          onClick={collapseAll}
          title="Collapse all language groups"
          style={{ background: "transparent", border: "1px solid color-mix(in oklab, var(--cx-fg-dim) 35%, transparent)", color: "var(--cx-fg-dim)", borderRadius: 3, padding: "3px 6px", cursor: "pointer", fontSize: 10, letterSpacing: ".08em" }}
        >⊟</button>
        <button
          type="button"
          className="cx-tp-mini-btn"
          onClick={expandAll}
          title="Expand all language groups"
          style={{ background: "transparent", border: "1px solid color-mix(in oklab, var(--cx-fg-dim) 35%, transparent)", color: "var(--cx-fg-dim)", borderRadius: 3, padding: "3px 6px", cursor: "pointer", fontSize: 10, letterSpacing: ".08em" }}
        >⊞</button>
      </div>

      {/* Language groups · drag headers to reorder languages, drag rows to
          reorder within. Click a header to fold. */}
      <div className="cx-tp-groups">
        {filteredGroups.map(({ lang, items }) => {
          const isFolded = collapsed.has(lang);
          const primaryCount = items.filter(t => t.id === primary).length;
          const compareCount = items.filter(t => compareSet.includes(t.id)).length;
          const isLangDragOver = dropHint === `lang:${lang}` && drag?.kind === "lang";
          return (
            <section
              key={lang}
              className={`cx-tp-group ${isFolded ? "is-folded" : ""} ${isLangDragOver ? "is-drop" : ""}`}
              onDragOver={onDragOver("lang", lang)}
              onDrop={onDropLang(lang)}
              onDragLeave={() => dropHint === `lang:${lang}` && setDropHint(null)}
            >
              <header
                className="cx-tp-group-h"
                draggable
                onDragStart={onDragStart("lang", lang)}
                onDragEnd={onDragEnd}
                onClick={() => toggleLang(lang)}
                title={isFolded ? "Expand · drag to reorder" : "Collapse · drag to reorder"}
              >
                <span className="cx-tp-group-grip" aria-hidden style={{ touchAction: "none" }}>⋮⋮</span>
                <span className="cx-tp-group-tag">{lang}</span>
                <span className="cx-tp-group-name">{LANG_NAMES[lang] || lang}</span>
                <span className="cx-tp-group-meta">
                  {primaryCount ? <i className="cx-tp-group-dot is-p" title="primary" /> : null}
                  {compareCount ? <i className="cx-tp-group-dot is-c" title={`${compareCount} in compare`} /> : null}
                  <span className="cx-tp-group-count">{items.length}</span>
                </span>
                <span className="cx-tp-group-caret" aria-hidden>{isFolded ? "▸" : "▾"}</span>
              </header>
              <div className="cx-tp-group-body">
                <ul className="cx-tp-list">
                  {items.map(t => {
                    const isPrimary = primary === t.id;
                    const isCompare = compareSet.includes(t.id);
                    const isUser = userIds.has(t.id);
                    const isRowDragOver = dropHint === `trans:${t.id}` && drag?.kind === "trans" && drag?.lang === lang;
                    const isDragging = drag?.kind === "trans" && drag?.id === t.id;
                    return (
                      <li
                        key={t.id}
                        className={`cx-tp-row ${isPrimary ? "is-primary" : ""} ${isCompare ? "is-compare" : ""} ${isUser ? "is-user" : ""} ${isRowDragOver ? "is-drop" : ""} ${isDragging ? "is-dragging" : ""}`}
                        draggable
                        onDragStart={onDragStart("trans", t.id, lang)}
                        onDragEnd={onDragEnd}
                        onDragOver={onDragOver("trans", t.id)}
                        onDrop={onDropTrans(lang, t.id)}
                        onContextMenu={(e) => openCtx(t, e)}
                      >
                        <span
                          className="cx-tp-grip"
                          aria-hidden
                          title="Drag to reorder"
                          style={{ touchAction: "none" }}
                        >⋮⋮</span>
                        <button
                          className="cx-tp-pick"
                          onClick={() => onPrimaryWrap(t.id)}
                          title={`Read in ${t.name}`}
                        >
                          <span className="cx-tp-mark" aria-hidden>{isPrimary ? "●" : ""}</span>
                          <span className="cx-tp-name">{t.name}</span>
                          <span className="cx-tp-year">{t.year}</span>
                        </button>
                        <button
                          className={`cx-tp-eye ${isCompare ? "is-on" : ""}`}
                          onClick={() => onToggleCompareWrap(t.id)}
                          title={isCompare ? "Remove from compare" : "Add to compare"}
                          aria-label="Toggle compare"
                          aria-pressed={isCompare}
                        >{isCompare ? "◉" : "○"}</button>
                        <OfflineDot
                          t={t}
                          stats={stats[t.id]}
                          dl={_dlState.get(t.id)}
                          onStart={() => startDownload(t)}
                          onStop={() => stopDownload(t)}
                          onClear={() => clearOffline(t)}
                        />
                        <button
                          className="cx-tp-forge"
                          onClick={(e) => { e.stopPropagation(); forgeFrom(t); }}
                          title={`Forge a custom version from ${t.name} (BabelForge)`}
                          aria-label="Forge custom version"
                          style={{ background: "transparent", border: "1px solid transparent", color: "var(--cx-fg-dim)", borderRadius: 3, padding: "2px 5px", cursor: "pointer", fontSize: 11, marginLeft: 2, opacity: 0.55 }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = "var(--cx-accent)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.55; e.currentTarget.style.color = "var(--cx-fg-dim)"; }}
                        >⌬</button>
                        {isUser ? (
                          <button
                            className="cx-tp-rm"
                            onClick={() => removeOne(t)}
                            title={`Remove ${t.name}`}
                            aria-label="Remove translation"
                          >×</button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          );
        })}
      </div>

      <div className="cx-tp-foot">
        <span>● primary  ·  ◉ compare  ·  ⌬ forge  ·  ⋮⋮ drag</span>
      </div>
      {window.RepoAdd ? (
        <div className="cx-tp-browse" style={{ padding: "6px 8px 10px" }}>
          <details>
            <summary
              style={{
                cursor: "pointer", listStyle: "none",
                fontFamily: "var(--cx-mono)", fontSize: 11, letterSpacing: ".1em",
                color: "var(--cx-accent)", padding: "6px 10px",
                border: "1px dashed color-mix(in oklab, var(--cx-accent) 45%, transparent)",
                borderRadius: 3, textAlign: "center", textTransform: "uppercase",
              }}
            >＋ Browse community translations</summary>
            <RepoAdd onAdded={() => bump(n => n + 1)} />
          </details>
        </div>
      ) : null}
      {ctxMenu ? (
        <ul
          className="cx-tp-ctx"
          role="menu"
          style={{
            position: "fixed", left: Math.min(ctxMenu.x, window.innerWidth - 240), top: Math.min(ctxMenu.y, window.innerHeight - 220),
            zIndex: 9999, minWidth: 220,
            background: "var(--cx-bg, #0a0e12)",
            border: "1px solid color-mix(in oklab, var(--cx-accent) 35%, transparent)",
            borderRadius: 4, padding: 4,
            fontFamily: "var(--cx-mono)", fontSize: 11, listStyle: "none", margin: 0,
            boxShadow: "0 6px 30px rgba(0,0,0,.55)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const t = ctxMenu.t;
            const isPrim = primary === t.id;
            const isCmp = compareSet.includes(t.id);
            const st = stats[t.id];
            const items = [
              { label: "Set as primary", on: () => onPrimaryWrap(t.id), disabled: isPrim },
              { label: isCmp ? "Remove from compare" : "Add to compare", on: () => onToggleCompareWrap(t.id) },
              { label: "Save offline", on: () => startDownload(t), disabled: st?.fully },
              { label: "Forge custom version (BabelForge)", on: () => forgeFrom(t) },
              { label: "Remove offline data", on: () => clearOffline(t), disabled: !st || st.cached === 0 },
            ];
            if (userIds.has(t.id)) items.push({ label: "Remove from library", on: () => removeOne(t), danger: true });
            return items.map((it, i) => (
              <li key={i} role="menuitem">
                <button
                  type="button"
                  disabled={it.disabled}
                  onClick={() => { it.on(); setCtxMenu(null); }}
                  style={{
                    width: "100%", textAlign: "left",
                    background: "transparent", border: "none",
                    color: it.disabled ? "var(--cx-fg-dim)" : (it.danger ? "#ff8291" : "var(--cx-fg)"),
                    padding: "6px 10px", cursor: it.disabled ? "default" : "pointer",
                    opacity: it.disabled ? 0.5 : 1, borderRadius: 3,
                  }}
                  onMouseEnter={(e) => { if (!it.disabled) e.currentTarget.style.background = "color-mix(in oklab, var(--cx-accent) 12%, transparent)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >{it.label}</button>
              </li>
            ));
          })()}
        </ul>
      ) : null}
    </div>
  );
}

// Offline indicator — three states, all elegant:
//   • At rest, untouched: hairline ring icon, low opacity. Hover: "Save offline".
//   • Downloading: SVG progress ring fills clockwise, percent + book name flick
//     subtly underneath. Click to pause.
//   • Fully cached: solid filled ring + tiny "OFFLINE" word in mono.
// Always reserves the same width so rows don't shift between states.
function OfflineDot({ t, stats, dl, onStart, onStop, onClear }) {
  const downloading = dl && !dl.complete && !dl.aborted;
  const fully = stats?.fully && !downloading;
  const ratio = downloading ? (dl.done / dl.total) : (stats ? stats.cached / stats.total : 0);
  // Show "<1%" rather than rounding tiny progress down to 0 — "0%" would
  // wrongly suggest nothing is cached when in fact 2/1189 chapters are.
  const pct   = ratio > 0 && ratio < 0.01 ? "<1%" : `${Math.round(ratio * 100)}%`;

  const onClick = (e) => {
    e.stopPropagation();
    if (downloading) onStop();
    else if (fully)  onClear();
    else             onStart();
  };
  const title = downloading
    ? `Downloading ${t.name} for offline · ${dl.done}/${dl.total} chapters · click to pause`
    : fully
      ? `${t.name} is fully available offline · click to remove`
      : ratio > 0
        ? `${t.name} partially cached (${stats.cached}/${stats.total}) · click to download the rest`
        : `Save ${t.name} for offline reading`;

  // SVG progress ring — circumference = 2πr; offset = c · (1 − ratio)
  const SIZE = 18, R = 7;
  const C = 2 * Math.PI * R;
  const off = C * (1 - ratio);

  const label = fully ? "OFFLINE" : downloading ? pct : (ratio > 0 ? pct : "DL");
  return (
    <button
      className={`cx-tp-offline ${downloading ? "is-dl" : ""} ${fully ? "is-full" : ""} ${ratio > 0 && !fully && !downloading ? "is-partial" : ""}`}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} aria-hidden className="cx-tp-off-svg">
        <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" className="cx-tp-off-track" />
        {ratio > 0 ? (
          <circle
            cx={SIZE/2} cy={SIZE/2} r={R}
            fill={fully ? "currentColor" : "none"}
            className="cx-tp-off-fill"
            strokeDasharray={C}
            strokeDashoffset={off}
            transform={`rotate(-90 ${SIZE/2} ${SIZE/2})`}
          />
        ) : null}
        {fully ? (
          <path d="M5.5 9.5 l2.4 2.4 l5-5.5" fill="none"
                stroke="var(--cx-bg)" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round" />
        ) : !downloading && ratio === 0 ? (
          <path d="M9 5 v6 m-3 -3 l3 3 l3 -3" fill="none"
                stroke="currentColor" strokeWidth="1.2"
                strokeLinecap="round" strokeLinejoin="round" opacity="0.65" />
        ) : null}
      </svg>
      <span className="cx-tp-off-lbl">{label}</span>
    </button>
  );
}

// Save a panel entry (Talmud parallel / Gnosis reading) to the user's
// notes. Same path Oracle uses — so all three "save" gestures (verse menu
// NOTE, Oracle ✎, panel ✎) feed one unified saved-list.
function savePanelEntryToNotes({ kind, ref, heading, body, tag, passage }) {
  const refStr = passage?.book && passage?.chapter
    ? `${passage.book} ${passage.chapter} · ${kind}` : kind;
  const lines = [];
  if (heading) lines.push(heading + (tag ? ` (${tag})` : ""));
  if (ref)     lines.push(`— ${ref}`);
  if (body)    lines.push("", body);
  const text = `[${refStr}] ${lines.join("\n")}`.trim();
  try {
    const list = JSON.parse(localStorage.getItem("codex.notes.v1") || "[]");
    list.unshift({
      id: `n_${Date.now()}`,
      ref: refStr,
      text,
      ts: Date.now(),
      source: kind,
    });
    localStorage.setItem("codex.notes.v1", JSON.stringify(list));
    const tw = JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}");
    if (!tw.notesEnabled) {
      tw.notesEnabled = true;
      localStorage.setItem("codex.tweaks.v1", JSON.stringify(tw));
      window.dispatchEvent(new CustomEvent("tweakchange", { detail: { notesEnabled: true } }));
    }
    localStorage.setItem("codex.notes.visible", "1");
    window.dispatchEvent(new CustomEvent("codex:notes:show", { detail: {} }));
  } catch (e) {
    console.warn("Save panel-entry to notes failed:", e);
  }
}

// Small ✎ button shown inside each Talmud / Gnosis card — saves the entry
// to the user's notes (enables notes feature on first use). Stays subtle:
// hairline border, soft accent, hover-brighten.
function PanelMarkBtn({ onClick }) {
  return (
    <button
      type="button"
      className="cx-panel-mark"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title="Save this reading to your notes"
      aria-label="Save to notes"
    >✎ save</button>
  );
}

// ── LINKIFY ─────────────────────────────────────────────────────────────
// Scans free-text panel bodies (Talmud, Commentary, Gnosis) for Bible
// references and turns each into a clickable span that calls
// window.codexJumpToRef(). Uses the canonical book list from CODEX_DATA so
// "Sanhedrin 98a" (Talmud tractate) doesn't false-match.
const _BIBLE_BOOK_RX = (() => {
  const canonical = (window.CODEX_DATA?.books || []).map(b => b.name);
  // Mirror Roman-numeral books with Arabic-numeral forms (commentary
  // commonly writes "1 Corinthians" not "I Corinthians").
  const roman = { "I":"1", "II":"2", "III":"3" };
  const arabicMirrors = canonical
    .map(n => n.replace(/^(I{1,3})\s+/, (_, r) => (roman[r] || r) + " "))
    .filter(n => !canonical.includes(n));
  // Common short forms used in academic commentary
  const aliases = ["Gen","Ex","Exod","Lev","Num","Deut","Josh","Judg","Ruth",
    "1 Sam","2 Sam","1 Kgs","2 Kgs","1 Chr","2 Chr","Neh","Esth","Ps","Psa","Psalm",
    "Prov","Eccl","Song","Isa","Jer","Lam","Ezek","Dan","Hos","Joel","Amos","Obad",
    "Jonah","Mic","Nah","Hab","Zeph","Hag","Zech","Mal",
    "Matt","Mt","Mk","Lk","Jn","Acts","Rom","1 Cor","2 Cor","Gal","Eph","Phil",
    "Col","1 Thess","2 Thess","1 Tim","2 Tim","Tit","Phlm","Heb","Jas","Jms",
    "1 Pet","2 Pet","1 Jn","2 Jn","3 Jn","Jude","Rev"];
  const all = [...new Set([...canonical, ...arabicMirrors, ...aliases])]
    .sort((a, b) => b.length - a.length)         // longest first → "1 Corinthians" before "Cor"
    .map(s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // Match: book name, space, chapter, optional :verse(-range)
  return new RegExp(`\\b(${all.join("|")})\\s+(\\d+)(?::(\\d+)(?:[-–]\\d+)?)?(?!\\d)`, "g");
})();
function LinkifyRefs({ text }) {
  if (!text || typeof text !== "string") return text || null;
  const out = [];
  let last = 0; let m;
  _BIBLE_BOOK_RX.lastIndex = 0;
  while ((m = _BIBLE_BOOK_RX.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const ref = m[0];
    out.push(
      <a key={`${m.index}-${ref}`} className="cx-pl-ref" href="#"
         onClick={(e) => { e.preventDefault(); window.codexJumpToRef && window.codexJumpToRef(ref); }}
         title={`Open ${ref}`}>
        {ref}
      </a>
    );
    last = m.index + ref.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : text;
}

// ── TALMUD ──────────────────────────────────────────────────────────────
function TalmudPanel({ panelData, status, meta, passage, onRegenerate }) {
  if (!panelData) return <div className="cx-pane"><PaneHead title={(window.t && window.t("panel.talmud.head")) || "TALMUDIC PARALLELS"} sub={`${passage.book} ${passage.chapter}`} /><PanelStatus status={status} passage={passage} onRegenerate={onRegenerate} kind="talmud" /></div>;
  // One-shot expand/collapse for all parallels — defaults to OPEN (per-card
  // toggle still works); the ⊟/⊞ button lets the user collapse/expand the
  // whole list at once when it gets noisy.
  const [allOpen, setAllOpen] = useState(true);
  return (
    <div className="cx-pane">
      <PaneHead title={(window.t && window.t("panel.talmud.head")) || "TALMUDIC PARALLELS"}
        sub={`${passage.book} ${passage.chapter} · ${((window.t && window.t("panel.parallels")) || "{n} parallels").replace("{n}", panelData.talmud.length)}`}
        meta={meta}
        action={
          <span className="cx-pane-actions">
            <button className="cx-pane-toggle"
              onClick={() => setAllOpen(o => !o)}
              title={allOpen ? ((window.t && window.t("panel.collapseAll")) || "Collapse all parallels") : ((window.t && window.t("panel.expandAll")) || "Expand all parallels")}
              aria-label={allOpen ? "Collapse all" : "Expand all"}>
              {allOpen ? "⊟" : "⊞"}
            </button>
            <RegenBtn onClick={onRegenerate} />
          </span>
        } />
      <div className="cx-talmud-list">
        {panelData.talmud.map((t, i) => (
          <Collapsible
            key={`${allOpen}-${i}`}
            defaultOpen={allOpen}
            title={
              <span className="cx-talmud-h-inner">
                <span className="cx-talmud-idx">תלמוד · {pad(i+1)}</span>
                <span className="cx-talmud-heading">{t.heading}</span>
              </span>
            }
            sub={t.ref}
          >
            <article className="cx-talmud-card">
              <p><LinkifyRefs text={t.body} /></p>
              <footer>
                <span className="cx-tag">{t.tag}</span>
                <PanelMarkBtn onClick={() => savePanelEntryToNotes({
                  kind: "Talmud", ref: t.ref, heading: t.heading, body: t.body, tag: t.tag, passage,
                })} />
              </footer>
            </article>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}

// ── COMMENTARY ──────────────────────────────────────────────────────────
function CommentaryPanel({ panelData, status, meta, passage, onRegenerate, onJumpRef }) {
  if (!panelData) return <div className="cx-pane"><PaneHead title={(window.t && window.t("panel.commentary.head")) || "CHRISTIAN COMMENTARY"} sub={`${passage.book} ${passage.chapter}`} /><PanelStatus status={status} passage={passage} onRegenerate={onRegenerate} kind="commentary" /></div>;
  // group by tradition
  const groups = ["Patristic", "Reformation", "Modern", "Devotional"];
  const byGroup = groups.map(g => ({
    group: g,
    items: panelData.commentary.filter(c => (c.from || "").toLowerCase().startsWith(g.toLowerCase())),
  })).filter(g => g.items.length);

  return (
    <div className="cx-pane">
      <PaneHead title={(window.t && window.t("panel.commentary.head")) || "CHRISTIAN COMMENTARY"}
        sub="Patristic · Reformation · Modern · Devotional"
        meta={meta}
        action={<RegenBtn onClick={onRegenerate} />} />
      <div className="cx-comm-list">
        {byGroup.map(({ group, items }) => (
          <Collapsible
            key={group}
            defaultOpen
            title={<span className="cx-comm-grp">{group.toUpperCase()}</span>}
            count={items.length}
          >
            {items.map((c, i) => (
              <article key={i} className="cx-comm-card">
                <span className={`cx-comm-tag is-${group.toLowerCase()}`}>{group}</span>
                <h4>{c.author}</h4>
                <p><LinkifyRefs text={c.body} /></p>
                <footer className="cx-comm-foot">
                  <PanelMarkBtn onClick={() => savePanelEntryToNotes({
                    kind: `Commentary · ${group}`, heading: c.author, body: c.body, passage,
                  })} />
                </footer>
              </article>
            ))}
          </Collapsible>
        ))}
      </div>

      <Collapsible
        defaultOpen={false}
        title={<span className="cx-comm-grp">CROSS-REFERENCES</span>}
        count={panelData.crossRefs.length}
      >
        <ul className="cx-xref">
          {panelData.crossRefs.map((x, i) => (
            <li
              key={i}
              className={onJumpRef ? "is-clickable" : ""}
              onClick={() => onJumpRef && onJumpRef(x.ref)}
              title={onJumpRef ? `Jump to ${x.ref}` : undefined}
              role={onJumpRef ? "button" : undefined}
            >
              <b>{x.ref}</b>
              <span>{x.note}</span>
            </li>
          ))}
        </ul>
      </Collapsible>
    </div>
  );
}

// ── GEMATRIA ────────────────────────────────────────────────────────────
// Letter values — single source of truth for the calculator AND the
// per-character breakdown. Greek (Mispar Hechrachi-equivalent isopsephy)
// + Hebrew standard gematria. Final letter forms collapse to base values
// since manuscripts treat them identically. Pure JS, no network.
const GEMATRIA_GREEK = {α:1,β:2,γ:3,δ:4,ε:5,ζ:7,η:8,θ:9,ι:10,κ:20,λ:30,μ:40,ν:50,ξ:60,ο:70,π:80,ρ:100,σ:200,ς:200,τ:300,υ:400,φ:500,χ:600,ψ:700,ω:800};
const GEMATRIA_HEBREW = {א:1,ב:2,ג:3,ד:4,ה:5,ו:6,ז:7,ח:8,ט:9,י:10,כ:20,ך:20,ל:30,מ:40,ם:40,נ:50,ן:50,ס:60,ע:70,פ:80,ף:80,צ:90,ץ:90,ק:100,ר:200,ש:300,ת:400};

// Strip combining marks (Greek accents, Hebrew niqqud, Hebrew cantillation
// trope marks) so "ό" → "ο", "אֱ" → "א", "אַֽ" → "א", etc. Without this
// "λόγος" sums to 303 (skipping the accented omicron) instead of the
// canonical 373. NFD decomposes precomposed glyphs into base + combining
// marks; \p{M} removes every Mark-class codepoint.
function gemNormalize(ch) {
  return ch.normalize("NFD").replace(/\p{M}/gu, "");
}

function gemValueFor(ch) {
  const norm = gemNormalize(ch).toLowerCase();
  if (!norm) return null;
  if (GEMATRIA_GREEK[norm])  return { v: GEMATRIA_GREEK[norm],  script: "Greek"  };
  if (GEMATRIA_HEBREW[norm]) return { v: GEMATRIA_HEBREW[norm], script: "Hebrew" };
  return null;
}

function GematriaPanel({ panelData, status, meta, passage, onRegenerate }) {
  const [calc, setCalc] = useState("");

  const calc_ = useMemo(() => {
    let sum = 0;
    let scriptHits = { Greek: 0, Hebrew: 0 };
    const breakdown = [];
    for (const ch of calc) {
      const r = gemValueFor(ch);
      if (r) {
        sum += r.v;
        scriptHits[r.script]++;
        breakdown.push({ ch, v: r.v });
      }
    }
    const script = scriptHits.Greek > scriptHits.Hebrew ? "Greek isopsephy"
                 : scriptHits.Hebrew > 0 ? "Mispar Hechrachi"
                 : null;
    // Ordinal: each letter's position in alphabet (rough — same alphabet rank)
    // Useful for some kabbalistic / numerological exercises.
    const ordinalMap = (() => {
      const greek = "αβγδεζηθικλμνξοπρστυφχψω";
      const hebrew = "אבגדהוזחטיכלמנסעפצקרשת";
      const out = {};
      [...greek].forEach((c, i) => { out[c] = i + 1; });
      [...hebrew].forEach((c, i) => { out[c] = i + 1; });
      return out;
    })();
    let ordinal = 0;
    for (const ch of calc) {
      const n = gemNormalize(ch).toLowerCase();
      if (ordinalMap[n]) ordinal += ordinalMap[n];
    }
    // Reduced (digital root)
    const reduce = (n) => {
      while (n > 9) n = String(n).split("").reduce((s, d) => s + +d, 0);
      return n;
    };
    return { sum, script, ordinal, reduced: reduce(sum), breakdown };
  }, [calc]);

  return (
    <div className="cx-pane">
      <PaneHead title={(window.t && window.t("panel.gematria.head")) || "GEMATRIA · ISOPSEPHY"}
        sub={`Numerical resonance · ${passage.book} ${passage.chapter}`}
        meta={meta}
        action={panelData ? <RegenBtn onClick={onRegenerate} /> : null} />

      <Collapsible
        defaultOpen
        title={
          <span>
            ∑ CALCULATOR
            <span className="cx-cache-pill is-cached" style={{ marginLeft: 8 }}>
              ✓ OFFLINE · ON-DEVICE
            </span>
          </span>
        }
        sub={calc_.script ? `${calc_.script} · live` : "paste Greek or Hebrew"}
      >
        <div className="cx-gem-calc">
          <div className="cx-gem-calc-row">
            <input
              value={calc}
              onChange={e => setCalc(e.target.value)}
              placeholder="λόγος / אהבה"
              spellCheck={false}
              dir="auto"
            />
            <div className="cx-gem-calc-out">
              <span>{calc_.sum || "—"}</span>
              <i>SUM</i>
            </div>
          </div>

          {calc_.breakdown.length > 0 ? (
            <>
              <div className="cx-gem-breakdown">
                {calc_.breakdown.map((p, i) => (
                  <span key={i} className="cx-gem-bd-cell">
                    <span className="cx-gem-bd-ch">{p.ch}</span>
                    <span className="cx-gem-bd-v">{p.v}</span>
                  </span>
                ))}
              </div>
              <div className="cx-gem-extra">
                <span><b>{calc_.sum}</b> sum</span>
                <span><b>{calc_.ordinal}</b> ordinal</span>
                <span><b>{calc_.reduced}</b> reduced (digital root)</span>
              </div>
            </>
          ) : null}
        </div>
      </Collapsible>

      {!panelData ? (
        <PanelStatus status={status} passage={passage} onRegenerate={onRegenerate} kind="gematria" />
      ) : (
        <>
          <Collapsible defaultOpen title="LEXICAL VALUES" count={panelData.gematria.length}>
            <GematriaLexicalGrid items={panelData.gematria} />
          </Collapsible>

          <Collapsible defaultOpen title="RESONANCES" count={panelData.gematriaNotes.length}>
            <div className="cx-gem-notes">
              {panelData.gematriaNotes.map((n, i) => (
                <p key={i}>▹ {n}</p>
              ))}
            </div>
          </Collapsible>

          {panelData.gematriaDeep && panelData.gematriaDeep._schema === 2 ? (
            <GematriaDeep deep={panelData.gematriaDeep} passage={passage} />
          ) : null}
        </>
      )}
    </div>
  );
}

// ── Kabbalah mapping loader (one-shot fetch, cached on window) ──────
function useKabbalahMap() {
  const [map, setMap] = useState(() => (typeof window !== "undefined" ? window.__CODEX_KAB__ : null) || null);
  useEffect(() => {
    if (map || typeof window === "undefined") return;
    let alive = true;
    fetch("data/modules/kabbalah-mappings.json")
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (alive && j) { window.__CODEX_KAB__ = j; setMap(j); } })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return map;
}

// Open the Strong's panel for a given original-language word. Uses the
// lexicon's lookup-by-lemma when available; otherwise dispatches the open
// event with whatever the user clicked so Strong's can do its own lookup.
function openStrongsForWord(word) {
  if (!word || typeof window === "undefined") return;
  try {
    const lex = window.CODEX_StrongsLookup;
    if (typeof lex === "function") {
      const hit = lex(word);
      if (hit && hit.id) {
        window.dispatchEvent(new CustomEvent("codex:strongs-open", { detail: { strongs: hit.id } }));
        return;
      }
    }
  } catch {}
  // Fallback: open the Strong's panel with the raw query so the user lands
  // on its search field with the word ready to refine.
  window.dispatchEvent(new CustomEvent("codex:strongs-open", { detail: { query: word, strongs: word } }));
}

// Generic accessible click wrapper — Enter/Space activate, role=button.
function clickableProps(onActivate, label) {
  return {
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    onClick: (e) => { e.stopPropagation(); onActivate(); },
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    },
  };
}

// ── Value-detail modal · all verses summing to N + symbolic meaning ──
function GemValueModal({ value, system, kabMap, onClose, onJump }) {
  const [hits, setHits] = useState(null);
  useEffect(() => {
    let alive = true;
    const IDX = (typeof window !== "undefined") ? window.CODEX_GEMATRIA_INDEX : null;
    (async () => {
      if (!IDX) return setHits([]);
      try { await IDX.ensure(); }
      catch {}
      if (!alive) return;
      const list = IDX.find(value);
      setHits(list || []);
    })();
    return () => { alive = false; };
  }, [value]);

  const concept = kabMap?.value_to_concept?.[String(value)];
  const sefirah = (kabMap?.sefirot || []).find(s => s.value === value);

  // Render via portal-like fixed overlay
  return (
    <div className="cx-gem-modal-wrap" onClick={onClose}>
      <div className="cx-gem-modal" onClick={e => e.stopPropagation()} role="dialog" aria-label={`Value detail ${value}`}>
        <header className="cx-gem-modal-h">
          <span className="cx-gem-modal-val">VALUE <b>{value}</b></span>
          <button className="cx-gem-modal-x" onClick={onClose} aria-label="Close">×</button>
        </header>
        {concept || sefirah ? (
          <section className="cx-gem-modal-meaning">
            {sefirah ? (
              <p><b>{sefirah.translit}</b> <span dir="rtl">{sefirah.name}</span> — {sefirah.meaning}. The {ordinalWord(sefirah.n)} Sefirah.</p>
            ) : null}
            {concept ? <p className="cx-gem-modal-concept"><i>{concept.category}</i> · {concept.concept}</p> : null}
          </section>
        ) : null}
        <section className="cx-gem-modal-hits">
          <h4>IN YOUR LIBRARY {hits ? `(${hits.length})` : "(…)"}</h4>
          {!hits ? <p className="cx-gem-empty">⌬ scanning your cached verses…</p>
            : !hits.length ? <p className="cx-gem-empty">No verses in your library sum to {value}. Read more chapters to grow the index.</p>
            : (
              <ul className="cx-gem-modal-list">
                {hits.slice(0, 20).map((m, i) => (
                  <li key={i} {...clickableProps(() => { onJump(m.ref); onClose(); }, `Open ${m.ref}`)}>
                    <span className="cx-gem-xref">{m.ref}</span>
                    <span className="cx-gem-xword" dir="auto">{m.word}</span>
                    <span className="cx-gem-xnote">— {m.system}</span>
                  </li>
                ))}
                {hits.length > 20 ? <li className="cx-gem-empty">+{hits.length - 20} more</li> : null}
              </ul>
            )}
        </section>
      </div>
    </div>
  );
}
function ordinalWord(n) {
  return ["zeroth","first","second","third","fourth","fifth","sixth","seventh","eighth","ninth","tenth"][n] || `${n}th`;
}

// ── LEXICAL VALUES grid · clickable values + words ───────────────────
function GematriaLexicalGrid({ items }) {
  const kabMap = useKabbalahMap();
  const [modalValue, setModalValue] = useState(null);
  function jump(ref) {
    if (typeof window === "undefined" || !window.codexJumpToRef) return;
    const parts = ref.split(".");
    if (parts.length < 3) return window.codexJumpToRef(ref);
    const books = (window.CODEX_DATA?.books) || [];
    const book = books.find(b => b.id === parts[0]);
    window.codexJumpToRef(`${book?.name || parts[0]} ${parts[1]}:${parts[2]}`);
  }
  return (
    <>
      <div className="cx-gem-grid">
        {items.map((g, i) => (
          <div key={i} className="cx-gem-cell">
            <div className="cx-gem-term cx-gem-clickable"
                 {...clickableProps(() => openStrongsForWord(g.term), `Open Strong's for ${g.term}`)}>{g.term}</div>
            <div className="cx-gem-translit">{g.translit}</div>
            <div className="cx-gem-meaning">{g.meaning}</div>
            <div className="cx-gem-value cx-gem-clickable"
                 {...clickableProps(() => setModalValue(g.value), `Open value ${g.value}`)}
                 title={`See every verse summing to ${g.value}`}>
              <b>{g.value}</b>
              <i>{g.system}</i>
            </div>
          </div>
        ))}
      </div>
      {modalValue ? (
        <GemValueModal value={modalValue} system="" kabMap={kabMap}
                       onClose={() => setModalValue(null)} onJump={jump} />
      ) : null}
    </>
  );
}

// ── GEMATRIA · DEEP / AI CROSS-REFERENCING ───────────────────────────
// Renders the schema-2 panel block: primary word, full system grid (via
// gematria.js), AI cross-matches + library cross-matches (computed
// in-browser from the user's cached verses), notarikon, temurah, rabbinic
// sources, and an AI insight paragraph.
function GematriaDeep({ deep, passage }) {
  const GEM = (typeof window !== "undefined") ? window.CODEX_GEMATRIA : null;
  const IDX = (typeof window !== "undefined") ? window.CODEX_GEMATRIA_INDEX : null;
  const kabMap = useKabbalahMap();
  // Modal state for value-detail popup. null when closed.
  const [modalValue, setModalValue] = useState(null);
  const openValue = (v) => { if (v && Number.isFinite(v)) setModalValue(v); };

  // Compute every system for the primary word — single source of truth
  // for the values grid. Falls back gracefully if gematria.js failed load.
  const values = useMemo(() => {
    if (!GEM || !deep.primary_word) return null;
    try { return GEM.all(deep.primary_word, deep.primary_lang); }
    catch { return null; }
  }, [deep.primary_word, deep.primary_lang]);

  // Pick the canonical "value" for cross-referencing this word.
  const canonicalValue = useMemo(() => {
    if (!values) return null;
    if (values.lang === "hebrew") return values.hechrachi;
    if (values.lang === "greek")  return values.isopsephy;
    return values.ordinal;
  }, [values]);
  const canonicalSystem = values?.lang === "hebrew" ? "hechrachi"
                        : values?.lang === "greek"  ? "isopsephy"
                        : "en_ordinal";

  // Library cross-matches: scan user's cached verses for the same value.
  const [libMatches, setLibMatches] = useState(null);
  const [libBuilding, setLibBuilding] = useState(false);
  const [libTab, setLibTab] = useState("canon"); // "canon" or "library"

  useEffect(() => {
    if (!IDX || !canonicalValue) return;
    let alive = true;
    (async () => {
      setLibBuilding(true);
      try {
        await IDX.ensure();
        if (!alive) return;
        const hits = IDX.find(canonicalValue, { system: canonicalSystem });
        setLibMatches(hits);
      } catch {
        setLibMatches([]);
      } finally {
        if (alive) setLibBuilding(false);
      }
    })();
    return () => { alive = false; };
  }, [canonicalValue, canonicalSystem]);

  // Cross-translation comparison: same word in hebrew + greek + english
  // would require alignment data we don't have here — instead show the
  // primary word's value computed in the primary script, plus english
  // transliteration value as a curiosity.
  const crossLang = useMemo(() => {
    if (!GEM || !deep.primary_word) return null;
    const out = {};
    if (values?.lang === "hebrew") out.HEBREW = values.hechrachi;
    if (values?.lang === "greek")  out.GREEK = values.isopsephy;
    if (deep.primary_translit) {
      try { out.ENGLISH = GEM.english.ordinal(deep.primary_translit); } catch {}
    }
    return Object.keys(out).length ? out : null;
  }, [values, deep.primary_translit]);

  function jump(ref) {
    // ref shape: "bookId.chapter.verse" — translate to display "Book ch:vs"
    if (typeof window === "undefined" || !window.codexJumpToRef) return;
    const parts = ref.split(".");
    if (parts.length < 3) return window.codexJumpToRef(ref);
    const bookId = parts[0];
    const books = (window.CODEX_DATA?.books) || [];
    const book = books.find(b => b.id === bookId);
    const name = book?.name || bookId;
    window.codexJumpToRef(`${name} ${parts[1]}:${parts[2]}`);
  }

  const SYSTEM_HELP = {
    hechrachi: "Mispar Hechrachi — standard absolute value (א=1, י=10, ק=100, ת=400)",
    gadol: "Mispar Gadol — finals lifted (ך=500, ם=600, ן=700, ף=800, ץ=900)",
    sidduri: "Mispar Sidduri — ordinal position (1–22)",
    katan: "Mispar Katan — each letter reduced to a single digit then summed",
    katan_mispari: "Mispar Katan Mispari — sum reduced to a single digit (digital root)",
    boneh: "Mispar Bone'eh — 'building' / cumulative running sum",
    kidmi: "Mispar Kidmi — each letter's triangular value",
    atbash: "Atbash — first↔last letter substitution cipher",
    albam: "Albam — alphabet split in half, halves swapped",
    neelam: "Mispar Ne'elam — value of the spelled-out letter NAME minus the letter itself",
    haakhor: "Mispar Ha'akhor — each letter's value multiplied by its position",
    isopsephy: "Greek isopsephy — α=1 … ω=800 (classical)",
    ordinal: "Greek ordinal — letter position 1..24",
    reduced: "Greek reduced — sum reduced to a single digit",
    reduction: "English reduction — each letter reduced to 1..9",
    reverse: "English reverse — z=1 … a=26",
  };

  return (
    <>
      {/* Primary word callout */}
      {deep.primary_word ? (
        <Collapsible defaultOpen title="PRIMARY WORD · FOCUS">
          <div className="cx-gem-focus">
            <div
              className="cx-gem-focus-word cx-gem-clickable"
              dir="auto"
              {...clickableProps(() => openStrongsForWord(deep.primary_word), `Open Strong's for ${deep.primary_word}`)}
              title="Open Strong's entry"
            >{deep.primary_word}</div>
            <div className="cx-gem-focus-meta">
              {deep.primary_translit ? <span className="cx-gem-focus-tr">{deep.primary_translit}</span> : null}
              {deep.primary_gloss ? <span className="cx-gem-focus-gl">— {deep.primary_gloss}</span> : null}
            </div>
            {canonicalValue ? (
              <div
                className="cx-gem-focus-val cx-gem-clickable"
                {...clickableProps(() => openValue(canonicalValue), `Open value ${canonicalValue}`)}
                title={`See every verse summing to ${canonicalValue}`}
              >
                <b>{canonicalValue}</b>
                <i>{canonicalSystem.toUpperCase()}</i>
              </div>
            ) : null}
            {deep.symbolic_meaning ? <p className="cx-gem-focus-sym">{deep.symbolic_meaning}</p> : null}
          </div>
        </Collapsible>
      ) : null}

      {/* Cross-language strip */}
      {crossLang ? (
        <div className="cx-gem-crosslang">
          {Object.entries(crossLang).map(([k, v]) => (
            <span key={k} className="cx-gem-clickable"
                  {...clickableProps(() => openValue(v), `Open value ${v}`)}>
              <i>{k}</i><b>{v}</b>
            </span>
          ))}
        </div>
      ) : null}

      {/* All-systems grid (computed locally — never wrong) */}
      {values ? (
        <Collapsible title="ALL NUMEROLOGICAL SYSTEMS" sub={`Computed offline · ${values.lang}`}>
          <div className="cx-gem-sys-grid">
            {Object.entries(values).filter(([k]) => k !== "lang").map(([k, v]) => {
              const numericVal = (v && typeof v === "object" && "value" in v) ? v.value : (Number.isFinite(v) ? v : null);
              const display = (v && typeof v === "object" && "value" in v) ? `${v.transformed} · ${v.value}` : String(v);
              const canClick = Number.isFinite(numericVal) && numericVal > 1;
              return (
                <div
                  key={k}
                  className={`cx-gem-sys-row ${canClick ? "cx-gem-clickable" : ""}`}
                  title={SYSTEM_HELP[k] || ""}
                  {...(canClick ? clickableProps(() => openValue(numericVal), `Open value ${numericVal}`) : {})}
                >
                  <span className="cx-gem-sys-k">{k.replace(/_/g, " ")}</span>
                  <span className="cx-gem-sys-v">{display}</span>
                </div>
              );
            })}
          </div>
        </Collapsible>
      ) : null}

      {/* Cross-matches: AI canon + your library */}
      {(deep.cross_matches?.length || libMatches?.length || libBuilding) ? (
        <Collapsible defaultOpen title="CROSS-MATCHES · SAME VALUE" sub={`value: ${canonicalValue ?? "—"}`}>
          <div className="cx-gem-xtabs">
            <button className={`cx-gem-xtab ${libTab === "canon" ? "is-on" : ""}`}
                    onClick={() => setLibTab("canon")}>
              FROM CANON ({deep.cross_matches?.reduce((n, c) => n + (c.matches?.length || 0), 0) || 0})
            </button>
            <button className={`cx-gem-xtab ${libTab === "library" ? "is-on" : ""}`}
                    onClick={() => setLibTab("library")}>
              FROM YOUR LIBRARY ({libBuilding ? "…" : (libMatches?.length || 0)})
            </button>
          </div>
          {libTab === "canon" ? (
            <div className="cx-gem-xlist">
              {(deep.cross_matches || []).map((cm, i) => (
                <div key={i} className="cx-gem-xgroup">
                  <div className="cx-gem-xgh">
                    <b className="cx-gem-clickable"
                       {...clickableProps(() => openValue(Number(cm.value)), `Open value ${cm.value}`)}
                       title={`See every verse summing to ${cm.value}`}>{cm.value}</b>
                    {" "}<i>via {cm.via_system}</i>
                  </div>
                  {(cm.matches || []).map((m, j) => (
                    <div key={j} className="cx-gem-xrow">
                      <span className="cx-gem-xref cx-gem-clickable"
                            {...clickableProps(() => m.ref && jump(m.ref), `Jump to ${m.ref}`)}>{m.ref}</span>
                      {m.word ? (
                        <span className="cx-gem-xword cx-gem-clickable" dir="auto"
                              {...clickableProps(() => openStrongsForWord(m.word), `Open Strong's for ${m.word}`)}>{m.word}</span>
                      ) : null}
                      {m.note ? <span className="cx-gem-xnote">— {m.note}</span> : null}
                    </div>
                  ))}
                </div>
              ))}
              {!(deep.cross_matches || []).length ? <p className="cx-gem-empty">No canonical matches surfaced.</p> : null}
            </div>
          ) : (
            <div className="cx-gem-xlist">
              {libBuilding ? (
                <p className="cx-gem-empty">⌬ Indexing your cached verses…</p>
              ) : (libMatches && libMatches.length) ? (
                libMatches.slice(0, 30).map((m, i) => (
                  <div key={i} className="cx-gem-xrow">
                    <span className="cx-gem-xref cx-gem-clickable"
                          {...clickableProps(() => jump(m.ref), `Jump to ${m.ref}`)}>{m.ref}</span>
                    <span className="cx-gem-xword cx-gem-clickable" dir="auto"
                          {...clickableProps(() => openStrongsForWord(m.word), `Open Strong's for ${m.word}`)}>{m.word}</span>
                    <span className="cx-gem-xnote">— {m.system}</span>
                  </div>
                ))
              ) : (
                <p className="cx-gem-empty">No verses in your library share value {canonicalValue}. Read more chapters to grow the index.</p>
              )}
              {libMatches && libMatches.length > 30 ? (
                <p className="cx-gem-empty">+{libMatches.length - 30} more matches in your library</p>
              ) : null}
            </div>
          )}
        </Collapsible>
      ) : null}

      {deep.notarikon?.length ? (
        <Collapsible title="NOTARIKON · ACRONYM READINGS" count={deep.notarikon.length}>
          {deep.notarikon.map((n, i) => (
            <div key={i} className="cx-gem-card">
              <div className="cx-gem-card-h" dir="auto">{n.phrase}</div>
              <p className="cx-gem-card-b">{n.expansion}</p>
            </div>
          ))}
        </Collapsible>
      ) : null}

      {deep.temurah?.length ? (
        <Collapsible title="TEMURAH · LETTER CIPHERS" count={deep.temurah.length}>
          {deep.temurah.map((t, i) => (
            <div key={i} className="cx-gem-card">
              <div className="cx-gem-card-h"><b>{t.transform}</b> → <span dir="auto">{t.result}</span></div>
              {t.note ? <p className="cx-gem-card-b">{t.note}</p> : null}
            </div>
          ))}
        </Collapsible>
      ) : null}

      {deep.rabbinic_sources?.length ? (
        <Collapsible title="RABBINIC SOURCES" count={deep.rabbinic_sources.length}>
          {deep.rabbinic_sources.map((r, i) => (
            <div key={i} className="cx-gem-card">
              <div className="cx-gem-card-h">{r.name}</div>
              <p className="cx-gem-card-b cx-gem-quote">“{r.quote}”</p>
            </div>
          ))}
        </Collapsible>
      ) : null}

      {deep.ai_insight ? (
        <Collapsible defaultOpen title="AI SYNTHESIS">
          <div className="cx-gem-insight">
            <p>{deep.ai_insight}</p>
          </div>
        </Collapsible>
      ) : null}

      {/* KABBALAH — deeper mystery tier. Renders even with AI-empty kabbalah
          block when we can auto-derive a Sefirah from the computed values. */}
      <GematriaKabbalah deep={deep} values={values} canonicalValue={canonicalValue}
                        passage={passage} kabMap={kabMap} onOpenValue={openValue} />

      {modalValue ? (
        <GemValueModal value={modalValue} system={canonicalSystem} kabMap={kabMap}
                       onClose={() => setModalValue(null)} onJump={jump} />
      ) : null}
    </>
  );
}

// ── KABBALAH SECTION ──────────────────────────────────────────────────
// A hidden compartment that appears below the standard Gematria intelligence.
// Auto-derives Sefirot resonances + value→concept echoes from the same
// gematria values the panel just computed; layers AI-supplied frames on top.
function GematriaKabbalah({ deep, values, canonicalValue, passage, kabMap, onOpenValue }) {
  const [activeSefirah, setActiveSefirah] = useState(null);
  if (!kabMap) return null;

  // Collect every numeric value the panel exposes (canonical + cross-match
  // values), then look up Sefirah and concept matches automatically.
  const numericValues = useMemo(() => {
    const set = new Set();
    if (canonicalValue) set.add(canonicalValue);
    if (values) {
      for (const [k, v] of Object.entries(values)) {
        if (k === "lang") continue;
        if (Number.isFinite(v)) set.add(v);
        else if (v && typeof v === "object" && Number.isFinite(v.value)) set.add(v.value);
      }
    }
    (deep.cross_matches || []).forEach(cm => {
      if (Number.isFinite(Number(cm.value))) set.add(Number(cm.value));
    });
    return set;
  }, [canonicalValue, values, deep.cross_matches]);

  const autoSefirot = useMemo(() => {
    return (kabMap.sefirot || []).filter(s => numericValues.has(s.value));
  }, [kabMap, numericValues]);

  const autoConcepts = useMemo(() => {
    const out = [];
    for (const v of numericValues) {
      const c = kabMap.value_to_concept?.[String(v)];
      if (c) out.push({ value: v, ...c });
    }
    return out;
  }, [kabMap, numericValues]);

  // AI-supplied Sefirot resonances — merge with auto, dedupe by name.
  const aiSefirot = (deep.kabbalah?.sefirot_resonances || [])
    .map(r => {
      const s = (kabMap.sefirot || []).find(x => x.translit?.toLowerCase() === (r.sefirah || "").toLowerCase());
      return s ? { ...s, note: r.note, aiValue: r.value } : null;
    })
    .filter(Boolean);

  const sefirotShown = (() => {
    const seen = new Set();
    const out = [];
    for (const s of [...aiSefirot, ...autoSefirot]) {
      if (seen.has(s.translit)) continue;
      seen.add(s.translit);
      out.push(s);
    }
    return out;
  })();

  const luri = deep.kabbalah?.lurianic_frame && kabMap.concepts?.[deep.kabbalah.lurianic_frame];
  const partzuf = deep.kabbalah?.partzuf && (kabMap.partzufim || []).find(p => p.name === deep.kabbalah.partzuf || p.translit === deep.kabbalah.partzuf);
  const zoharCites = deep.kabbalah?.zohar_citations || [];

  // Nothing to show? Stay quiet rather than render an empty panel.
  if (!sefirotShown.length && !autoConcepts.length && !luri && !partzuf && !zoharCites.length) {
    return null;
  }

  const subParts = [];
  if (sefirotShown.length) subParts.push(`${sefirotShown.length} sefirah`);
  if (autoConcepts.length) subParts.push(`${autoConcepts.length} echo`);
  if (luri) subParts.push("lurianic");
  if (partzuf) subParts.push("partzuf");

  return (
    <section className="cx-gem-kab">
      <Collapsible defaultOpen={false} title={<span className="cx-gem-kab-title">⟁ KABBALAH · HIDDEN COMPARTMENT</span>}
                   sub={subParts.join(" · ")}>
        {sefirotShown.length ? (
          <div className="cx-gem-kab-block">
            <h4>SEFIROT RESONANCE</h4>
            <KabTree sefirot={kabMap.sefirot || []} highlight={sefirotShown.map(s => s.translit)}
                     onPick={(s) => setActiveSefirah(s)} />
            <div className="cx-gem-kab-sefirot">
              {sefirotShown.map(s => (
                <button key={s.translit} className={`cx-gem-kab-card ${activeSefirah?.translit === s.translit ? "is-on" : ""}`}
                        style={{ borderColor: s.color || "var(--cx-accent)" }}
                        onClick={() => setActiveSefirah(s)}>
                  <span className="cx-gem-kab-heb" dir="rtl">{s.name}</span>
                  <span className="cx-gem-kab-tr">{s.translit}</span>
                  <span className="cx-gem-kab-mean">{s.meaning}</span>
                  <span className="cx-gem-kab-val cx-gem-clickable"
                        {...clickableProps(() => onOpenValue(s.value), `Open value ${s.value}`)}>{s.value}</span>
                  {s.note ? <span className="cx-gem-kab-note">— {s.note}</span> : null}
                </button>
              ))}
            </div>
            {activeSefirah ? (
              <div className="cx-gem-kab-detail">
                <p><b>{activeSefirah.translit}</b> · {activeSefirah.meaning}{activeSefirah.world ? ` · ${activeSefirah.world}` : ""}</p>
                {activeSefirah.body ? <p className="cx-gem-kab-detail-body">{activeSefirah.body}</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {autoConcepts.length ? (
          <div className="cx-gem-kab-block">
            <h4>CONCEPT ECHOES</h4>
            <ul className="cx-gem-kab-echoes">
              {autoConcepts.map((c, i) => (
                <li key={i}>
                  <button className="cx-gem-kab-echo-val cx-gem-clickable"
                          {...clickableProps(() => onOpenValue(c.value), `Open value ${c.value}`)}>{c.value}</button>
                  <span className="cx-gem-kab-echo-cat">{c.category}</span>
                  <span className="cx-gem-kab-echo-txt">— {c.concept}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {luri ? (
          <div className="cx-gem-kab-block">
            <h4>LURIANIC FRAME</h4>
            <div className="cx-gem-kab-luri">
              <div className="cx-gem-kab-luri-name">
                <b>{luri.name}</b> <span dir="rtl">{luri.hebrew}</span>
              </div>
              <p>{luri.meaning}</p>
              {deep.kabbalah?.lurianic_note ? <p className="cx-gem-kab-luri-ai">▹ {deep.kabbalah.lurianic_note}</p> : null}
              <span className="cx-gem-kab-src">{luri.source}</span>
            </div>
          </div>
        ) : null}

        {partzuf ? (
          <div className="cx-gem-kab-block">
            <h4>PARTZUF</h4>
            <div className="cx-gem-kab-partzuf">
              <b>{partzuf.name}</b> — <i>{partzuf.translit}</i>
              <span className="cx-gem-kab-src">linked to {partzuf.sefirah} · {partzuf.polarity}</span>
              {deep.kabbalah?.partzuf_note ? <p>▹ {deep.kabbalah.partzuf_note}</p> : null}
            </div>
          </div>
        ) : null}

        {zoharCites.length ? (
          <div className="cx-gem-kab-block">
            <h4>ZOHAR CITATIONS</h4>
            {zoharCites.map((z, i) => (
              <div key={i} className="cx-gem-kab-zohar">
                <div className="cx-gem-kab-zohar-ref">{z.ref}</div>
                <p className="cx-gem-quote">“{z.text}”</p>
              </div>
            ))}
          </div>
        ) : null}
      </Collapsible>
    </section>
  );
}

// Tiny SVG Tree of Life — 10 spheres in the classic arrangement. Highlighted
// sefirot get filled color; rest are hairline rings. No paths between spheres
// (kept minimal to feel like a sigil, not a chart).
function KabTree({ sefirot, highlight = [], onPick }) {
  // Canonical positions on a 100×140 viewBox.
  const POS = {
    Keter:    [50, 8],
    Chokhmah: [80, 24], Binah:    [20, 24],
    Chesed:   [80, 52], Gevurah:  [20, 52],
    Tiferet:  [50, 68],
    Netzach:  [80, 92], Hod:      [20, 92],
    Yesod:    [50, 108],
    Malkhut:  [50, 132],
  };
  const lit = new Set(highlight);
  return (
    <svg className="cx-gem-kab-tree" viewBox="0 0 100 144" aria-label="Tree of Life">
      {sefirot.map(s => {
        const [cx, cy] = POS[s.translit] || [50, 70];
        const on = lit.has(s.translit);
        return (
          <g key={s.translit} onClick={() => onPick(s)} style={{ cursor: "pointer" }}>
            <circle cx={cx} cy={cy} r={on ? 7 : 5}
                    fill={on ? (s.color || "var(--cx-accent)") : "none"}
                    stroke={on ? "var(--cx-fg)" : "var(--cx-fg-dim, #888)"}
                    strokeWidth={on ? 1.2 : 0.8} opacity={on ? 1 : 0.55} />
            <text x={cx} y={cy + 2} fontSize="3.2" textAnchor="middle"
                  fill={on ? "var(--cx-bg)" : "var(--cx-fg-dim, #888)"}>{s.n}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── GNOSIS ──────────────────────────────────────────────────────────────
function GnosisPanel({ panelData, status, meta, passage, gnosisOn, onToggleGnosis, onRegenerate }) {
  return (
    <div className="cx-pane is-gnosis">
      <PaneHead title={(window.t && window.t("panel.gnosis.head")) || "GNOSIS · INTERPRETIVE OVERLAY"}
        sub={`Esoteric readings · ${passage.book} ${passage.chapter}`}
        meta={meta}
        action={panelData ? <RegenBtn onClick={onRegenerate} /> : null} />

      <div className="cx-gnosis-toggle">
        <div>
          <b>OVERLAY {gnosisOn ? "ENGAGED" : "DORMANT"}</b>
          <span>Adds Greek source-text inline, mystic glosses, and pleromic readings.</span>
        </div>
        <button
          className={`cx-gnosis-btn ${gnosisOn ? "is-on" : ""}`}
          onClick={() => onToggleGnosis(!gnosisOn)}
        >
          <span className="cx-gnosis-btn-dot" />
          {gnosisOn ? "DISENGAGE" : "ENGAGE"}
        </button>
      </div>

      {!panelData ? (
        <PanelStatus status={status} passage={passage} onRegenerate={onRegenerate} kind="gnosis" />
      ) : (
        <div className="cx-gnosis-list">
          {panelData.gnosis.map((g, i) => (
            <Collapsible
              key={i}
              defaultOpen={i < 2}
              title={
                <span className="cx-gnosis-h-inner">
                  <span className="cx-gnosis-sigil">{g.sigil}</span>
                  <span className="cx-gnosis-title-txt">{g.title}</span>
                </span>
              }
            >
              <article className="cx-gnosis-card">
                <div className="cx-gnosis-body">
                  <p><LinkifyRefs text={g.body} /></p>
                </div>
                <NormieToggle text={g.body} scope="gnosis-card" />
                <footer className="cx-gnosis-foot">
                  <PanelMarkBtn onClick={() => savePanelEntryToNotes({
                    kind: "Gnosis", heading: g.title, body: g.body, tag: g.sigil, passage,
                  })} />
                </footer>
              </article>
            </Collapsible>
          ))}
        </div>
      )}

      <div className="cx-gnosis-warn">
        ⚠ INTERPRETIVE LAYER — engages mystic + perennial readings alongside the canonical text.
        Disengage to return to orthodox Christian commentary only.
      </div>
    </div>
  );
}

// ── EXEGESIS (Phase 4.2) ────────────────────────────────────────────────
// Deeper-than-Commentary AI exegetical analysis. On-demand fetch with its
// own localStorage cache (separate from the big panel call). Uses the same
// provider/model the user picked in tweaks.
function ExegesisPanel({ passage, currentVerse }) {
  const passageKey = `${passage.bookId}.${passage.chapter}`;
  const passageLabel = `${passage.book} ${passage.chapter}${currentVerse ? ":" + currentVerse : ""}`;
  const [data, setData] = useState(() => window.CODEX_PANELS.getExegesisCached(passageKey));
  const [meta, setMeta] = useState(() => {
    const m = window.CODEX_PANELS.getExegesisMeta(passageKey);
    return m ? { fromCache: true, fetchedAt: m.fetchedAt } : null;
  });
  const [status, setStatus] = useState({ loading: false, error: null });

  // Re-read cache when passage changes.
  useEffect(() => {
    const cached = window.CODEX_PANELS.getExegesisCached(passageKey);
    setData(cached);
    const m = window.CODEX_PANELS.getExegesisMeta(passageKey);
    setMeta(m ? { fromCache: true, fetchedAt: m.fetchedAt } : null);
    setStatus({ loading: false, error: null });
  }, [passageKey]);

  const fetchIt = (force) => {
    const tw = (() => { try { return JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}"); } catch { return {}; } })();
    setStatus({ loading: true, error: null });
    window.CODEX_PANELS.loadExegesis(passageKey, {
      passageLabel: `${passage.book} ${passage.chapter}`,
      provider: tw.provider, model: tw.model, force,
    }).then(d => {
      setData(d);
      setMeta({ fresh: true, fetchedAt: Date.now() });
      setStatus({ loading: false, error: null });
    }).catch(err => {
      setStatus({ loading: false, error: err.message || String(err) });
    });
  };

  const onRegenerate = () => {
    window.CODEX_PANELS.purgeExegesis(passageKey);
    fetchIt(true);
  };

  if (!data) {
    return (
      <div className="cx-pane cx-pane-exeg">
        <PaneHead title="EXEGESIS · DEEP ANALYSIS" sub={passageLabel} />
        <PanelStatus status={status} passage={passage} onRegenerate={() => fetchIt(false)} kind="exegesis" />
      </div>
    );
  }
  return (
    <div className="cx-pane cx-pane-exeg">
      <PaneHead title="EXEGESIS · DEEP ANALYSIS" sub={passageLabel} meta={meta}
        action={<RegenBtn onClick={onRegenerate} />} />
      <div className="cx-exeg-list">
        {data.key_terms && data.key_terms.length ? (
          <Collapsible defaultOpen title="KEY TERMS" count={data.key_terms.length}>
            <div className="cx-exeg-terms">
              {data.key_terms.map((k, i) => (
                <article key={i} className="cx-exeg-term">
                  <header>
                    <span className="cx-exeg-term-en">{k.term}</span>
                    {k.original ? <span className="cx-exeg-term-orig">{k.original}</span> : null}
                    {k.translit ? <span className="cx-exeg-term-tr">{k.translit}</span> : null}
                  </header>
                  {k.lexical_range ? <p><b>Lexical range — </b>{k.lexical_range}</p> : null}
                  {k.translation_choices ? <p><b>Translation choices — </b>{k.translation_choices}</p> : null}
                </article>
              ))}
            </div>
          </Collapsible>
        ) : null}
        {data.literary_structure ? (
          <Collapsible defaultOpen title="LITERARY STRUCTURE">
            <p className="cx-exeg-para">{data.literary_structure}</p>
          </Collapsible>
        ) : null}
        {data.historical_context ? (
          <Collapsible defaultOpen title="HISTORICAL CONTEXT">
            <p className="cx-exeg-para">{data.historical_context}</p>
          </Collapsible>
        ) : null}
        {data.intertextual_echoes && data.intertextual_echoes.length ? (
          <Collapsible defaultOpen title="INTERTEXTUAL ECHOES" count={data.intertextual_echoes.length}>
            <ul className="cx-xref">
              {data.intertextual_echoes.map((e, i) => (
                <li key={i}><b>{e.ref}</b><span>{e.note}</span></li>
              ))}
            </ul>
          </Collapsible>
        ) : null}
        {data.exegetical_options && data.exegetical_options.length ? (
          <Collapsible defaultOpen title="EXEGETICAL OPTIONS" count={data.exegetical_options.length}>
            <div className="cx-exeg-opts">
              {data.exegetical_options.map((o, i) => (
                <article key={i} className="cx-exeg-opt">
                  <h4>{o.view}</h4>
                  {o.scholars ? <span className="cx-exeg-scholars">{o.scholars}</span> : null}
                  <p>{o.argument}</p>
                </article>
              ))}
            </div>
          </Collapsible>
        ) : null}
        {data.preferred_reading ? (
          <Collapsible defaultOpen title="PREFERRED READING">
            <p className="cx-exeg-para is-emph">{data.preferred_reading}</p>
          </Collapsible>
        ) : null}
        {data.theological_implication ? (
          <Collapsible defaultOpen={false} title="THEOLOGICAL IMPLICATION">
            <p className="cx-exeg-para">{data.theological_implication}</p>
          </Collapsible>
        ) : null}
        {data.applicational_pivot ? (
          <Collapsible defaultOpen={false} title="APPLICATIONAL PIVOT">
            <p className="cx-exeg-para">{data.applicational_pivot}</p>
          </Collapsible>
        ) : null}
      </div>
    </div>
  );
}

// ── TRANSLATION ANALYSIS (Phase 4.3) ────────────────────────────────────
// Compares the user's currently-loaded translations for one verse and
// explains where philosophy drives divergence. Only activates when 2+
// translations are loaded (primary + at least one in compareSet).
function TranslationAnalysisPanel({ passage, currentVerse, primary, compareSet, onJumpRef }) {
  const dataAll = window.CODEX_DATA;
  const verse = passage.verses.find(v => v.n === currentVerse) || passage.verses[0];
  const verseN = verse ? verse.n : 1;
  const passageLabel = `${passage.book} ${passage.chapter}:${verseN}`;

  // Build the list of (id, name, year, philosophy, text) from primary + compareSet.
  const transList = useMemo(() => {
    const ids = [primary, ...[...(compareSet || [])].filter(id => id !== primary)];
    return ids.map(id => {
      const meta = dataAll.translations.find(t => t.id === id);
      const txt = verse ? (verse[id] || "") : "";
      return meta && txt ? {
        id, name: meta.name || id, year: meta.year || null,
        philosophy: meta.philosophy || meta.kind || "", text: txt,
      } : null;
    }).filter(Boolean);
  }, [primary, compareSet, verse, dataAll.translations]);

  const enoughTrans = transList.length >= 2;
  const passageKey = `${passage.bookId}.${passage.chapter}.${verseN}`;
  const cacheIds = transList.map(t => t.id);

  const [data, setData] = useState(() => enoughTrans ? window.CODEX_PANELS.getTxAnalysisCached(passageKey, cacheIds) : null);
  const [meta, setMeta] = useState(() => {
    if (!enoughTrans) return null;
    const m = window.CODEX_PANELS.getTxAnalysisMeta(passageKey, cacheIds);
    return m ? { fromCache: true, fetchedAt: m.fetchedAt } : null;
  });
  const [status, setStatus] = useState({ loading: false, error: null });

  // Re-read cache on inputs change.
  useEffect(() => {
    if (!enoughTrans) { setData(null); setMeta(null); return; }
    const cached = window.CODEX_PANELS.getTxAnalysisCached(passageKey, cacheIds);
    setData(cached);
    const m = window.CODEX_PANELS.getTxAnalysisMeta(passageKey, cacheIds);
    setMeta(m ? { fromCache: true, fetchedAt: m.fetchedAt } : null);
    setStatus({ loading: false, error: null });
  }, [passageKey, cacheIds.join("+"), enoughTrans]);

  const fetchIt = (force) => {
    const tw = (() => { try { return JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}"); } catch { return {}; } })();
    setStatus({ loading: true, error: null });
    window.CODEX_PANELS.loadTranslationAnalysis(passageKey, transList, {
      passageLabel, provider: tw.provider, model: tw.model, force,
    }).then(d => {
      setData(d);
      setMeta({ fresh: true, fetchedAt: Date.now() });
      setStatus({ loading: false, error: null });
    }).catch(err => {
      setStatus({ loading: false, error: err.message || String(err) });
    });
  };

  const onRegenerate = () => {
    window.CODEX_PANELS.purgeTxAnalysis(passageKey, cacheIds);
    fetchIt(true);
  };

  if (!enoughTrans) {
    return (
      <div className="cx-pane cx-pane-txan">
        <PaneHead title="TRANSLATION ANALYSIS" sub={passageLabel} />
        <div className="cx-txan-empty">
          <b>NEED 2+ TRANSLATIONS</b>
          <span>Open more translations in the Translations tab first, then return here to compare how each renders this verse.</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="cx-pane cx-pane-txan">
        <PaneHead title="TRANSLATION ANALYSIS" sub={`${passageLabel} · ${transList.length} loaded`} />
        <div className="cx-txan-preview">
          <div className="cx-txan-preview-h">Currently loaded</div>
          <ul>
            {transList.map(t => (
              <li key={t.id}>
                <b>{t.name}</b>
                <span className="cx-txan-prev-text">{t.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <PanelStatus status={status} passage={passage} onRegenerate={() => fetchIt(false)} kind="translation analysis" />
      </div>
    );
  }

  return (
    <div className="cx-pane cx-pane-txan">
      <PaneHead title="TRANSLATION ANALYSIS"
        sub={`${data.verse_ref || passageLabel} · ${data.renderings.length} renderings`}
        meta={meta}
        action={<RegenBtn onClick={onRegenerate} />} />

      <Collapsible defaultOpen title="COMPARISON TABLE" count={data.renderings.length}>
        <div className="cx-txan-table-wrap">
          <table className="cx-txan-table">
            <thead>
              <tr>
                <th>Translation</th>
                <th>Year</th>
                <th>Philosophy</th>
                <th>Text</th>
                <th>Key choice</th>
              </tr>
            </thead>
            <tbody>
              {data.renderings.map((r, i) => (
                <tr key={i}>
                  <td><b>{r.translation}</b></td>
                  <td>{r.year || "—"}</td>
                  <td><span className={`cx-txan-phil is-${(r.philosophy || "").toLowerCase().replace(/[^a-z]/g, "")}`}>{r.philosophy || "—"}</span></td>
                  <td className="cx-txan-text">{r.text}</td>
                  <td className="cx-txan-key">{r.key_choice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Collapsible>

      {data.divergence_points && data.divergence_points.length ? (
        <Collapsible defaultOpen title="DIVERGENCE POINTS" count={data.divergence_points.length}>
          <div className="cx-txan-div-list">
            {data.divergence_points.map((d, i) => (
              <article key={i} className="cx-txan-div">
                <h4>{d.issue}</h4>
                {d.options && d.options.length ? (
                  <ul className="cx-txan-opts">
                    {d.options.map((o, j) => <li key={j}>{o}</li>)}
                  </ul>
                ) : null}
                {d.philosophy_split ? <p className="cx-txan-split"><b>Philosophy — </b>{d.philosophy_split}</p> : null}
              </article>
            ))}
          </div>
        </Collapsible>
      ) : null}

      <Collapsible defaultOpen={false} title="RECOMMENDATIONS">
        <ul className="cx-txan-recs">
          {data.best_for_study ? <li><b>Best for study — </b>{data.best_for_study}</li> : null}
          {data.best_for_devotion ? <li><b>Best for devotion — </b>{data.best_for_devotion}</li> : null}
          {data.best_for_originalist ? <li><b>Closest to source — </b>{data.best_for_originalist}</li> : null}
        </ul>
      </Collapsible>
    </div>
  );
}

function PaneHead({ title, sub, action, meta }) {
  return (
    <div className="cx-pane-head">
      <div>
        <h3>{title}</h3>
        <span>{sub}</span>
        {meta ? <CacheBadge meta={meta} /> : null}
      </div>
      <div className="cx-pane-head-deco">
        {action || (
          <>
            <span className="cx-deco-dot" />
            <span className="cx-deco-dash" />
            <span className="cx-deco-dot" />
          </>
        )}
      </div>
    </div>
  );
}

// Small badge under the pane sub-title showing whether the rendered content
// came from local cache (offline-safe) or was just generated. Format:
//   ▣ SEED          (hand-crafted seed panel, ships with the app)
//   ✓ CACHED · 5d   (read from localStorage, offline-ready, fetched 5 days ago)
//   ✦ JUST FETCHED  (freshly generated by Claude this session)
function CacheBadge({ meta }) {
  if (!meta) return null;
  if (meta.seed) return <span className="cx-cache-pill is-seed">{(window.t && window.t("panel.seed")) || "▣ SEED · BUILT-IN"}</span>;
  if (meta.fromCache) {
    const ago = humanAgo(meta.fetchedAt);
    return <span className="cx-cache-pill is-cached" title={meta.fetchedAt ? `Fetched ${new Date(meta.fetchedAt).toLocaleString()}` : "Cached — fetched date unknown"}>
      ✓ CACHED · OFFLINE{ago ? ` · ${ago}` : ""}
    </span>;
  }
  if (meta.fresh) return <span className="cx-cache-pill is-fresh">✦ JUST FETCHED · NOW CACHED</span>;
  return null;
}

function humanAgo(ts) {
  if (!ts) return "";
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60)        return "just now";
  if (diff < 3600)      return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400)     return `${Math.floor(diff/3600)}h ago`;
  if (diff < 86400*7)   return `${Math.floor(diff/86400)}d ago`;
  const d = new Date(ts);
  return `${d.getFullYear()}·${String(d.getMonth()+1).padStart(2,"0")}·${String(d.getDate()).padStart(2,"0")}`;
}

function RegenBtn({ onClick }) {
  return (
    <button className="cx-regen" onClick={onClick} title="Re-draft via Oracle">
      <span className="cx-regen-dot" />
      {(window.t && window.t("panel.redraft")) || "REDRAFT"}
    </button>
  );
}

// ── Right-rail width resizer · drag the left edge to widen / narrow ─────
function RightRailResizer() {
  useEffect(() => {
    try {
      const saved = parseInt(localStorage.getItem("codex.rrail.width") || "", 10);
      if (saved >= 320 && saved <= 820) {
        document.documentElement.style.setProperty("--cx-rrail-w", saved + "px");
      }
    } catch {}
  }, []);
  const onDown = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const start = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--cx-rrail-w")) || 380;
    document.body.classList.add("cx-resizing");
    const onMove = (m) => {
      const next = Math.max(320, Math.min(820, start + (startX - m.clientX)));
      document.documentElement.style.setProperty("--cx-rrail-w", next + "px");
    };
    const onUp = () => {
      document.body.classList.remove("cx-resizing");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      try {
        const w = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--cx-rrail-w"));
        localStorage.setItem("codex.rrail.width", String(w));
      } catch {}
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };
  return <div className="cx-rail-resize" onMouseDown={onDown} title="Drag to resize" aria-label="Resize panel" />;
}

// ── Left-rail width resizer · drag the right edge to widen / narrow ─────
function LeftRailResizer() {
  useEffect(() => {
    try {
      const saved = parseInt(localStorage.getItem("codex.lrail.width") || "", 10);
      if (saved >= 200 && saved <= 560) {
        document.documentElement.style.setProperty("--cx-lrail-w", saved + "px");
      }
    } catch {}
  }, []);
  const onDown = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const start = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--cx-lrail-w")) || 232;
    document.body.classList.add("cx-resizing");
    const onMove = (m) => {
      const next = Math.max(200, Math.min(560, start + (m.clientX - startX)));
      document.documentElement.style.setProperty("--cx-lrail-w", next + "px");
    };
    const onUp = () => {
      document.body.classList.remove("cx-resizing");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      try {
        const w = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--cx-lrail-w"));
        localStorage.setItem("codex.lrail.width", String(w));
      } catch {}
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };
  return <div className="cx-rail-resize is-left" onMouseDown={onDown} title="Drag to resize" aria-label="Resize panel" />;
}

Object.assign(window, { RightRail, LeftRailResizer });
