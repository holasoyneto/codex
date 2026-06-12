
// tweaks-panel.jsx — THE SETTINGS (v12 remake).
//
// One calm, searchable surface. A single search field filters every control
// live; settings sit in quiet sections:
//
//   APPEARANCE · SCRIPTURE · THE NAME · AI & KEYS · READING · INSTRUMENTS ·
//   SYSTEM · DANGER (isolated at the foot)
//
// Contracts kept intact (nothing upstream changes):
//   · useTweaks(defaults) → [values, setTweak]   (codex.tweaks.v1 store)
//   · setTweak persists, posts __edit_mode_set_keys, dispatches 'tweakchange'
//   · NEW: every useTweaks instance ALSO subscribes to 'tweakchange', so a
//     write from any surface (this panel, kernel.settings_set, the reader's
//     Aa pill) reaches every other instance — the panel and the app can no
//     longer drift apart.
//   · host protocol: __activate_edit_mode / __deactivate_edit_mode /
//     __edit_mode_available / __edit_mode_dismissed
//   · app-wide open intent: window event "codex:open-settings"
//     (detail.section routes to a group, "help" opens the Help wiki)
//   · window exports: same names as before (TweaksPanel, TweakToggle, …)
//
// Machine-checkable feature inventory (smoke-settings.mjs verifies it):
//   · window.CODEX_SETTINGS_INDEX      — [{key, label, kind, group}] for every
//     live setting. Rebuilt lazily, so tweak keys registered later by other
//     modules (window.CODEX_TWEAK_DEFAULTS grows when any useTweaks mounts)
//     are surfaced automatically as generic controls in the right group.
//   · window.CODEX_SETTINGS_DEPRECATED — keys that once existed and were
//     retired on purpose (never silently dropped).
//
// ─────────────────────────────────────────────────────────────────────────────

const CODEX_TWEAKS_KEY = 'codex.tweaks.v1';

// ── tiny store helpers (shared by useTweaks + the panel's own controls) ──────
function __cxTweaksRead() {
  try { return JSON.parse(localStorage.getItem(CODEX_TWEAKS_KEY)) || {}; }
  catch (e) { return {}; }
}
function __cxTweaksWrite(edits) {
  const next = { ...__cxTweaksRead(), ...edits };
  try { localStorage.setItem(CODEX_TWEAKS_KEY, JSON.stringify(next)); } catch (e) { /* quota */ }
  try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*'); } catch (e) {}
  try { window.dispatchEvent(new CustomEvent('tweakchange', { detail: edits })); } catch (e) {}
  return next;
}

// ── DEPRECATED keys — retired on purpose, listed so nothing is silently
// dropped. The settings index check treats these as "accounted for". ─────────
const CODEX_SETTINGS_DEPRECATED = [
  // The old self-injected "Continuity" group wrote its own parallel quartet;
  // the app's canonical keys are continuityEnabled/continuityThreshold/
  // notifyCadence (migrated below on first load).
  'engageEnabled', 'engageDailyThreshold', 'engageNotifyCadence', 'engageReduceMotion',
  // yhwhMode — the clunky v1 golden-Name implementation, ripped out in the
  // v11.3 reader-soul rebuild; divineGold/divineHebrew are its successors.
  'yhwhMode',
  // OS·7 "Nocturne" stopped being optional in v9.2 SHED — the desk IS the
  // app; the classic layout and the codex.os7 flag are gone.
  'os7',
  // The omelette deck thumbnail rail (deck-stage.railVisible) — the deck
  // surface no longer exists anywhere in CODEX.
  'railVisible',
  // Theater-era key (distraction-free absorbed it; the tweak is distractionFree).
  'theaterMode',
];
window.CODEX_SETTINGS_DEPRECATED = CODEX_SETTINGS_DEPRECATED;

// One-time migration: users who flipped the old engage* controls keep their
// choices under the canonical continuity keys.
(function __cxMigrateEngage() {
  try {
    const s = __cxTweaksRead();
    const edits = {};
    if ('engageEnabled' in s && !('continuityEnabled' in s)) edits.continuityEnabled = !!s.engageEnabled;
    if ('engageDailyThreshold' in s && !('continuityThreshold' in s)) edits.continuityThreshold = s.engageDailyThreshold;
    if ('engageNotifyCadence' in s && !('notifyCadence' in s)) {
      edits.notifyCadence = s.engageNotifyCadence === 'off' ? 'off'
        : s.engageNotifyCadence === 'all' ? 'all' : 'subtle';
    }
    if (Object.keys(edits).length) {
      const next = { ...s, ...edits };
      localStorage.setItem(CODEX_TWEAKS_KEY, JSON.stringify(next));
    }
  } catch (e) { /* never throw at module load */ }
})();

// ── THE REGISTRY — every setting CODEX knows about. ─────────────────────────
// owner: 'self'  — this panel renders the control
//        'child' — the host (app.jsx) passes the control in as a child;
//                  we route it into the right group and index it here
//        'external' — lives on another surface; we point at it honestly
const SETTINGS_GROUPS = ['APPEARANCE', 'SCRIPTURE', 'THE NAME', 'AI & KEYS', 'READING', 'INSTRUMENTS', 'SYSTEM', 'DANGER'];

const SETTINGS_REGISTRY = [
  // APPEARANCE
  { key: 'autoTheme',  label: 'Theme · follow the sun', kind: 'segment', group: 'APPEARANCE', owner: 'self',
    kw: 'theme dark light night day auto solar mode appearance lights' },
  { key: 'manualDark', label: 'Theme · day / night',    kind: 'segment', group: 'APPEARANCE', owner: 'self',
    kw: 'theme dark light night day manual appearance' },
  { key: 'accent',     label: 'Accent color',           kind: 'color',   group: 'APPEARANCE', owner: 'child',
    kw: 'accent color cyan amber green violet glow' },
  { key: 'lightTheme', label: 'Day-mode palette',       kind: 'swatch',  group: 'APPEARANCE', owner: 'child',
    kw: 'palette parchment vellum linen sandstone sage solarized slate rose old book day light' },
  { key: 'scanlines',  label: 'Scanlines',              kind: 'toggle',  group: 'APPEARANCE', owner: 'child',
    kw: 'scanlines crt texture grain' },
  { key: 'schizo',     label: 'Schizo Mode',            kind: 'toggle',  group: 'APPEARANCE', owner: 'child',
    kw: 'schizo easter egg glitch' },
  // SCRIPTURE
  { key: 'primaryTranslation', label: 'Primary translation', kind: 'select', group: 'SCRIPTURE', owner: 'self',
    kw: 'translation bible version kjv web primary text' },
  { key: 'fontScale',     label: 'Scripture size',  kind: 'slider',  group: 'SCRIPTURE', owner: 'self',
    kw: 'font size text scale scripture aa bigger smaller type reader' },
  { key: 'scriptureFont', label: 'Scripture face',  kind: 'segment', group: 'SCRIPTURE', owner: 'self',
    kw: 'font face serif mono typeface family' },
  { key: 'redLetter',     label: 'Red-letter words', kind: 'toggle', group: 'SCRIPTURE', owner: 'self',
    kw: 'red letter words of jesus christ crimson' },
  { key: 'sideBySide',    label: 'Side-by-side translations', kind: 'toggle', group: 'SCRIPTURE', owner: 'self',
    kw: 'side by side parallel two translations columns compare' },
  // THE NAME (yhwhMode retired with the v11.3 golden-Name rebuild —
  // divineGold/divineHebrew are its clean successors; see DEPRECATED set)
  { key: 'divineGold', label: 'The Name in covenant gold', kind: 'toggle', group: 'THE NAME', owner: 'self',
    kw: 'divine gold golden name yhwh tetragrammaton yahweh jehovah lord restore sacred covenant color reader' },
  { key: 'divineHebrew', label: 'Tetragrammaton in Hebrew (יהוה)', kind: 'toggle', group: 'THE NAME', owner: 'self',
    kw: 'divine hebrew tetragrammaton yhwh script name reader' },
  // AI & KEYS
  { key: 'apiKeys',  label: 'API keys (Anthropic · Grok · Groq · Gemini · Ollama)', kind: 'keys', group: 'AI & KEYS', owner: 'child',
    kw: 'api key keys secret token anthropic claude grok xai groq gemini google ollama local engine' },
  { key: 'provider', label: 'Oracle engine',  kind: 'segment', group: 'AI & KEYS', owner: 'child',
    kw: 'provider engine anthropic claude xai grok groq gemini google ollama local ai' },
  { key: 'model',    label: 'Oracle model',   kind: 'select',  group: 'AI & KEYS', owner: 'child',
    kw: 'model haiku sonnet opus llama deepseek ai' },
  { key: 'hermeneuticDriftCompensation', label: 'Hermeneutic drift compensation', kind: 'toggle', group: 'AI & KEYS', owner: 'child',
    kw: 'drift hermeneutic advanced inference experimental' },
  // READING
  { key: 'distractionFree', label: 'Distraction-free reading', kind: 'toggle', group: 'READING', owner: 'self',
    kw: 'distraction free focus zen hide chrome quiet theater' },
  { key: 'caffeinate',   label: 'Keep screen awake', kind: 'toggle', group: 'READING', owner: 'child',
    kw: 'caffeinate keep screen awake wake lock sleep' },
  { key: 'notesEnabled', label: 'Margin notes',      kind: 'toggle', group: 'READING', owner: 'child',
    kw: 'notes margin notebook write' },
  { key: 'oracleFontScale', label: 'Oracle font size', kind: 'slider', group: 'READING', owner: 'child',
    kw: 'oracle font size chat text scale' },
  { key: 'highlightColor', label: 'Default mark color', kind: 'color', group: 'READING', owner: 'child',
    kw: 'highlight color marks amber cyan violet green rose default' },
  { key: 'autoBundle', label: 'Auto-bundle translations', kind: 'toggle', group: 'READING', owner: 'child',
    kw: 'auto bundle download translations offline as i read' },
  { key: 'overlayGnosis', label: 'Reader overlay · Gnosis', kind: 'toggle', group: 'READING', owner: 'self',
    kw: 'overlay gnosis reader margin esoteric glyph' },
  { key: 'overlayTalmud', label: 'Reader overlay · Talmud', kind: 'toggle', group: 'READING', owner: 'self',
    kw: 'overlay talmud reader margin rabbinic glyph' },
  { key: 'overlayCommentary', label: 'Reader overlay · Commentary', kind: 'toggle', group: 'READING', owner: 'self',
    kw: 'overlay commentary reader margin voices glyph' },
  // INSTRUMENTS
  { key: 'continuityEnabled',   label: 'Continuity layer',      kind: 'toggle', group: 'INSTRUMENTS', owner: 'self',
    kw: 'continuity streak engagement mastery analyst quests' },
  { key: 'continuityThreshold', label: 'Depth actions per day', kind: 'slider', group: 'INSTRUMENTS', owner: 'self',
    kw: 'continuity threshold depth actions per day' },
  { key: 'notifyCadence',       label: 'Announcements',         kind: 'segment', group: 'INSTRUMENTS', owner: 'self',
    kw: 'announcements milestones toasts cadence notifications quiet' },
  { key: 'gnosis', label: 'Gnosis overlay', kind: 'external', group: 'INSTRUMENTS', owner: 'external',
    kw: 'gnosis overlay esoteric ring engaged dormant' },
  { key: 'modules', label: 'Module marketplace', kind: 'action', group: 'INSTRUMENTS', owner: 'child',
    kw: 'modules marketplace plugins install browse' },
  // SYSTEM
  { key: 'lang',     label: 'Language',         kind: 'select', group: 'SYSTEM', owner: 'child',
    kw: 'language english español deutsch français idioma langue sprache' },
  { key: 'install',  label: 'Install CODEX',    kind: 'action', group: 'SYSTEM', owner: 'child',
    kw: 'install pwa app offline home screen standalone' },
  { key: 'sync',     label: 'Cross-device sync', kind: 'panel', group: 'SYSTEM', owner: 'child',
    kw: 'sync cross device qr transfer' },
  { key: 'dataPortable', label: 'Export / import everything', kind: 'action', group: 'SYSTEM', owner: 'child',
    kw: 'export import backup restore json portable data' },
  { key: 'cache',    label: 'Cache & offline status', kind: 'panel', group: 'SYSTEM', owner: 'child',
    kw: 'cache offline chapters panels clear storage status' },
  { key: 'offlineBibles', label: 'Offline Bibles', kind: 'panel', group: 'SYSTEM', owner: 'child',
    kw: 'offline bibles download bundles translations' },
  { key: 'bootIntro', label: 'Boot intro sequence', kind: 'toggle', group: 'SYSTEM', owner: 'child',
    kw: 'boot intro animation startup terminal first impression' },
  { key: 'keyboard', label: 'Keyboard shortcuts', kind: 'action', group: 'SYSTEM', owner: 'child',
    kw: 'keyboard shortcuts keys reference arrows' },
  { key: 'tour', label: 'Welcome tour', kind: 'action', group: 'SYSTEM', owner: 'self',
    kw: 'tour welcome replay onboarding first run' },
  // DANGER
  { key: 'personalization', label: 'Clear personalization', kind: 'action', group: 'DANGER', owner: 'self',
    kw: 'personalization profile taste reels oracle context clear privacy' },
  { key: 'factoryReset', label: 'Factory reset (settings only)', kind: 'action', group: 'DANGER', owner: 'child',
    kw: 'reset factory defaults wipe settings danger' },
];

// Route an unknown (newly registered) tweak key to a group by its name.
function __cxGroupForKey(k) {
  const s = String(k);
  if (/yhwh|golden|tetragram|sacred|name/i.test(s)) return 'THE NAME';
  if (/overlay|font|letter|verse|scripture|translat|interlinear|margin/i.test(s)) return 'SCRIPTURE';
  if (/theme|accent|scanline|glow|light|dark|palette/i.test(s)) return 'APPEARANCE';
  if (/oracle|provider|model|api|drift|engine/i.test(s)) return 'AI & KEYS';
  if (/note|mark|highlight|caffeinate|read|distraction/i.test(s)) return 'READING';
  if (/continuity|quest|engage|gnosis|reel|cadence/i.test(s)) return 'INSTRUMENTS';
  return 'SYSTEM';
}
function __cxHumanize(k) {
  return String(k)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_.-]+/g, ' ')
    .replace(/^./, c => c.toUpperCase());
}
function __cxInferKind(v) {
  if (typeof v === 'boolean') return 'toggle';
  if (typeof v === 'number') return 'number';
  return 'text';
}

// Keys in CODEX_TWEAK_DEFAULTS / the stored blob that the registry doesn't
// know and that weren't deliberately retired → auto-surfaced.
function __cxUnknownTweaks() {
  const known = new Set(SETTINGS_REGISTRY.map(r => r.key));
  const dep = new Set(CODEX_SETTINGS_DEPRECATED);
  const defaults = (typeof window !== 'undefined' && window.CODEX_TWEAK_DEFAULTS) || {};
  const stored = __cxTweaksRead();
  const out = [];
  const seen = new Set();
  for (const k of [...Object.keys(defaults), ...Object.keys(stored)]) {
    if (known.has(k) || dep.has(k) || seen.has(k)) continue;
    seen.add(k);
    const v = (k in defaults) ? defaults[k] : stored[k];
    out.push({
      key: k, label: __cxHumanize(k), kind: __cxInferKind(v),
      group: __cxGroupForKey(k), owner: 'auto', kw: __cxHumanize(k).toLowerCase(), value: v,
    });
  }
  return out;
}

function __cxRefreshSettingsIndex() {
  const idx = SETTINGS_REGISTRY.concat(__cxUnknownTweaks())
    .map(r => ({ key: r.key, label: r.label, kind: r.kind, group: r.group }));
  window.CODEX_SETTINGS_INDEX = idx;
  return idx;
}
__cxRefreshSettingsIndex();

// ── useTweaks ────────────────────────────────────────────────────────────────
// Single source of truth for tweak values. Persists to codex.tweaks.v1 and
// now also LISTENS on 'tweakchange', so every instance converges. Defaults
// are registered on window.CODEX_TWEAK_DEFAULTS so the settings index can
// surface tweaks it has never heard of.
function useTweaks(defaults) {
  React.useMemo(() => {
    try {
      window.CODEX_TWEAK_DEFAULTS = Object.assign({}, window.CODEX_TWEAK_DEFAULTS, defaults);
      __cxRefreshSettingsIndex();
    } catch (e) { /* defensive */ }
    return null;
  }, []);

  const [values, setValues] = React.useState(() => {
    try {
      const raw = localStorage.getItem(CODEX_TWEAKS_KEY);
      if (raw) return { ...defaults, ...JSON.parse(raw) };
    } catch (e) { /* fall through */ }
    return defaults;
  });

  // Accepts setTweak('key', value) or setTweak({ key: value, ... }).
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null
      ? keyOrEdits : { [keyOrEdits]: val };
    setValues((prev) => {
      const next = { ...prev, ...edits };
      try { localStorage.setItem(CODEX_TWEAKS_KEY, JSON.stringify(next)); } catch (e) { /* quota */ }
      return next;
    });
    try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*'); } catch (e) {}
    window.dispatchEvent(new CustomEvent('tweakchange', { detail: edits }));
  }, []);

  // Converge on writes from ANY other surface (panel, kernel, reader pills).
  React.useEffect(() => {
    const onChange = (e) => {
      const edits = e && e.detail;
      if (!edits || typeof edits !== 'object') return;
      setValues((prev) => {
        let changed = false;
        for (const k in edits) { if (prev[k] !== edits[k]) { changed = true; break; } }
        return changed ? { ...prev, ...edits } : prev;
      });
    };
    window.addEventListener('tweakchange', onChange);
    return () => window.removeEventListener('tweakchange', onChange);
  }, []);

  return [values, setTweak];
}

// ── Panel CSS — self-injected, tokens only. ────────────────────────────────
const __TWEAKS_STYLE = `
  /* ── shell ───────────────────────────────────────────────────────────── */
  .twkx-scrim{position:fixed;inset:0;z-index:2147483645;
    background:color-mix(in oklab, var(--cx-bg, #06080e) 62%, transparent);
    -webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);
    animation:twkx-in 160ms ease}
  .twkx-panel{position:fixed;z-index:2147483646;top:50%;left:50%;
    transform:translate(-50%,-50%);
    width:clamp(680px,72vw,1240px);height:clamp(540px,84dvh,1100px);
    max-width:96vw;max-height:94dvh;
    display:flex;flex-direction:column;overflow:hidden;
    background:var(--cx-bg,#06080e);color:var(--cx-fg,#c9d6e6);
    border:1px solid color-mix(in oklab, var(--cx-accent,#7ee0ff) 30%, transparent);
    border-radius:10px;
    box-shadow:0 32px 80px -20px rgba(0,0,0,.6),
      0 0 0 1px color-mix(in oklab, var(--cx-accent,#7ee0ff) 12%, transparent);
    font:12px/1.45 var(--cx-mono, ui-monospace, monospace);
    animation:twkx-pop 200ms cubic-bezier(.3,.7,.4,1)}
  @keyframes twkx-in{from{opacity:0}to{opacity:1}}
  @keyframes twkx-pop{from{opacity:0;transform:translate(-50%,-49%) scale(.99)}to{opacity:1;transform:translate(-50%,-50%)}}
  @media (prefers-reduced-motion: reduce){
    .twkx-scrim,.twkx-panel{animation:none}
    .twkx-panel *{transition:none !important;animation:none !important;scroll-behavior:auto !important}
  }

  .twkx-head{display:flex;align-items:center;gap:14px;flex:0 0 auto;
    padding:10px 10px 10px 18px;
    border-bottom:1px solid color-mix(in oklab, var(--cx-fg-dim,#8295ae) 22%, transparent);
    background:color-mix(in oklab, var(--cx-accent,#7ee0ff) 5%, var(--cx-bg,#06080e))}
  .twkx-title{font-weight:700;font-size:11px;letter-spacing:.24em;text-transform:uppercase;
    color:var(--cx-fg,#c9d6e6);white-space:nowrap}
  .twkx-title::before{content:"⚙ ";color:var(--cx-accent,#7ee0ff)}
  .twkx-mode{display:flex;gap:2px;padding:2px;border-radius:6px;
    background:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 10%, transparent)}
  .twkx-mode button{appearance:none;border:0;background:transparent;color:var(--cx-fg-dim,#8295ae);
    font:inherit;font-size:10.5px;font-weight:600;letter-spacing:.14em;
    min-height:32px;min-width:44px;padding:0 14px;border-radius:5px;cursor:pointer}
  .twkx-mode button[aria-selected="true"]{background:var(--cx-accent,#7ee0ff);color:var(--cx-bg,#06080e)}
  .twkx-mode button:focus-visible{outline:2px solid var(--cx-accent,#7ee0ff);outline-offset:1px}
  .twkx-spacer{flex:1}
  .twkx-x{appearance:none;border:0;background:transparent;color:var(--cx-fg-dim,#8295ae);
    min-width:44px;min-height:44px;border-radius:6px;cursor:pointer;font-size:16px;line-height:1;
    display:inline-flex;align-items:center;justify-content:center}
  .twkx-x:hover{background:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 14%, transparent);color:var(--cx-fg,#c9d6e6)}
  .twkx-x:focus-visible{outline:2px solid var(--cx-accent,#7ee0ff);outline-offset:1px}

  .twkx-shell{display:grid;grid-template-columns:172px 1fr;flex:1;min-height:0}
  /* ── nav rail (desktop) ─────────────────────────────────────────────── */
  .twkx-nav{display:flex;flex-direction:column;gap:2px;padding:14px 8px;
    border-right:1px solid color-mix(in oklab, var(--cx-fg-dim,#8295ae) 18%, transparent);
    background:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 4%, transparent);
    overflow-y:auto;min-height:0}
  .twkx-nav button{appearance:none;border:0;background:transparent;color:var(--cx-fg-dim,#8295ae);
    font:inherit;font-size:10px;font-weight:600;letter-spacing:.16em;text-align:left;
    min-height:44px;padding:0 12px;border-radius:6px;cursor:pointer;white-space:nowrap}
  .twkx-nav button:hover{background:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 10%, transparent);color:var(--cx-fg,#c9d6e6)}
  .twkx-nav button.is-on{color:var(--cx-accent,#7ee0ff);
    background:color-mix(in oklab, var(--cx-accent,#7ee0ff) 10%, transparent)}
  .twkx-nav button.is-empty{display:none}
  .twkx-nav button:focus-visible{outline:2px solid var(--cx-accent,#7ee0ff);outline-offset:1px}
  .twkx-nav button.is-danger{color:color-mix(in oklab, #ff8291 80%, var(--cx-fg-dim,#8295ae))}

  /* ── body ───────────────────────────────────────────────────────────── */
  .twkx-main{display:flex;flex-direction:column;min-height:0;min-width:0}
  .twkx-search{flex:0 0 auto;display:flex;align-items:center;gap:8px;
    padding:12px 18px 10px;
    border-bottom:1px solid color-mix(in oklab, var(--cx-fg-dim,#8295ae) 14%, transparent)}
  .twkx-search input{flex:1;min-width:0;height:36px;padding:0 12px;
    border-radius:7px;font:inherit;font-size:12px;letter-spacing:.04em;outline:none;
    color:var(--cx-fg,#c9d6e6);
    background:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 7%, transparent);
    border:1px solid color-mix(in oklab, var(--cx-fg-dim,#8295ae) 26%, transparent)}
  .twkx-search input:focus{border-color:var(--cx-accent,#7ee0ff);
    box-shadow:0 0 0 1px color-mix(in oklab, var(--cx-accent,#7ee0ff) 30%, transparent)}
  .twkx-search input::placeholder{color:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 80%, transparent)}
  .twkx-count{flex:0 0 auto;font-size:10px;color:var(--cx-fg-dim,#8295ae);letter-spacing:.08em;
    min-width:70px;text-align:right}
  .twkx-body{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;
    padding:6px 18px 26px;scroll-behavior:smooth;
    scrollbar-width:thin;scrollbar-color:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 30%, transparent) transparent}
  .twkx-body::-webkit-scrollbar{width:8px}
  .twkx-body::-webkit-scrollbar-thumb{background:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 25%, transparent);border-radius:4px}
  .twkx-help-body{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;padding:14px 18px}
  .twkx-help-body .cx-help{height:100%}

  .twkx-group{padding:18px 0 4px}
  .twkx-group[data-hidden="1"]{display:none}
  .twkx-group-h{font-size:10px;font-weight:700;letter-spacing:.26em;text-transform:uppercase;
    color:var(--cx-accent,#7ee0ff);padding:0 0 4px;
    border-bottom:1px solid color-mix(in oklab, var(--cx-fg-dim,#8295ae) 20%, transparent);
    margin-bottom:10px}
  .twkx-group[data-group="DANGER"] .twkx-group-h{color:#ff8291;border-bottom-color:color-mix(in oklab, #ff8291 35%, transparent)}
  .twkx-group[data-group="DANGER"]{margin-top:18px;padding-top:14px}

  .twkx-item{padding:5px 0}
  .twkx-item.twkx-hide{display:none}
  .twkx-sub{font-size:9.5px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;
    color:var(--cx-fg-dim,#8295ae);padding:12px 0 4px;opacity:.85}
  .twkx-sub.twkx-hide{display:none}
  .twkx-hint{font-size:10.5px;color:var(--cx-fg-dim,#8295ae);line-height:1.5;margin:2px 0 0}
  .twkx-note{font-size:10.5px;color:var(--cx-fg-dim,#8295ae);line-height:1.5}
  .twkx-empty{padding:40px 12px;text-align:center;color:var(--cx-fg-dim,#8295ae);
    font-size:11px;letter-spacing:.08em}

  /* ── controls (kept structurally compatible with the app's children) ── */
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px;
    min-height:44px;cursor:pointer}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;gap:8px;
    color:var(--cx-fg,#c9d6e6);font-size:11px;letter-spacing:.05em}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:var(--cx-fg-dim,#8295ae);font-variant-numeric:tabular-nums}
  .twk-sect{font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;
    color:var(--cx-fg-dim,#8295ae);padding:10px 0 0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:32px;padding:0 10px;
    border:1px solid color-mix(in oklab, var(--cx-fg-dim,#8295ae) 26%, transparent);
    border-radius:6px;font:inherit;font-size:11px;outline:none;
    background:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 7%, transparent);
    color:var(--cx-fg,#c9d6e6)}
  .twk-field:focus{border-color:var(--cx-accent,#7ee0ff)}
  select.twk-field{padding-right:24px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='%238295ae' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:14px 0;
    border-radius:999px;background:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 25%, transparent);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:26px;height:26px;border-radius:50%;background:var(--cx-accent,#7ee0ff);
    border:2px solid var(--cx-bg,#06080e);box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:pointer}
  .twk-slider::-moz-range-thumb{width:24px;height:24px;border-radius:50%;
    background:var(--cx-accent,#7ee0ff);border:2px solid var(--cx-bg,#06080e);cursor:pointer}
  .twk-slider:focus-visible{outline:2px solid var(--cx-accent,#7ee0ff);outline-offset:4px}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:6px;
    background:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 9%, transparent);
    border:1px solid color-mix(in oklab, var(--cx-fg-dim,#8295ae) 18%, transparent);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:4px;
    background:var(--cx-accent,#7ee0ff);
    transition:left .14s cubic-bezier(.3,.7,.4,1),width .14s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:var(--cx-fg-dim,#8295ae);font:inherit;font-size:10.5px;font-weight:600;
    letter-spacing:.08em;min-height:38px;border-radius:4px;cursor:pointer;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}
  .twk-seg button[aria-checked="true"]{color:var(--cx-bg,#06080e);font-weight:700}
  .twk-seg button:focus-visible{outline:2px solid var(--cx-accent,#7ee0ff);outline-offset:1px}

  .twk-toggle{position:relative;flex:0 0 auto;width:42px;height:24px;border:0;border-radius:999px;
    background:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 30%, transparent);
    transition:background .14s ease;cursor:pointer;padding:0;box-sizing:border-box}
  .twk-toggle[data-on="1"]{background:var(--cx-accent,#7ee0ff)}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;
    background:var(--cx-bg,#06080e);box-shadow:0 1px 2px rgba(0,0,0,.4);
    transition:transform .16s cubic-bezier(.3,.7,.4,1)}
  .twk-toggle[data-on="1"] i{transform:translateX(18px)}
  .twk-toggle:focus-visible{outline:2px solid var(--cx-accent,#7ee0ff);outline-offset:2px}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:32px;padding:0 0 0 10px;
    border:1px solid color-mix(in oklab, var(--cx-fg-dim,#8295ae) 26%, transparent);border-radius:6px;
    background:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 7%, transparent)}
  .twk-num-lbl{font-weight:500;color:var(--cx-fg-dim,#8295ae);cursor:ew-resize;user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:var(--cx-fg-dim,#8295ae)}

  .twk-btn{appearance:none;min-height:44px;padding:0 14px;border:1px solid color-mix(in oklab, var(--cx-accent,#7ee0ff) 40%, transparent);
    border-radius:6px;background:color-mix(in oklab, var(--cx-accent,#7ee0ff) 12%, transparent);
    color:var(--cx-fg,#c9d6e6);font:inherit;font-size:11px;font-weight:600;letter-spacing:.08em;cursor:pointer}
  .twk-btn:hover{background:color-mix(in oklab, var(--cx-accent,#7ee0ff) 22%, transparent)}
  .twk-btn.secondary{background:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 8%, transparent);
    border-color:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 26%, transparent)}
  .twk-btn:focus-visible{outline:2px solid var(--cx-accent,#7ee0ff);outline-offset:1px}
  .cx-mini-btn{min-height:44px}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:24px;
    border:1px solid color-mix(in oklab, var(--cx-fg-dim,#8295ae) 26%, transparent);border-radius:6px;padding:0;cursor:pointer;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:44px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:pointer;
    box-shadow:0 0 0 1px color-mix(in oklab, var(--cx-fg-dim,#8295ae) 28%, transparent);
    transition:transform .12s,box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 2px var(--cx-accent,#7ee0ff)}
  .twk-chip:focus-visible{outline:2px solid var(--cx-accent,#7ee0ff);outline-offset:2px}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;display:flex;flex-direction:column}
  .twk-chip>span>i{flex:1}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}

  /* key field with reveal-eye + test (AIModelSection) */
  .twkx-keyrow{display:flex;gap:6px;align-items:stretch}
  .twkx-keyrow input{flex:1;min-width:0}
  .twkx-eye{appearance:none;border:1px solid color-mix(in oklab, var(--cx-fg-dim,#8295ae) 26%, transparent);
    border-radius:6px;background:transparent;color:var(--cx-fg-dim,#8295ae);min-width:44px;min-height:32px;
    cursor:pointer;font-size:13px}
  .twkx-eye:hover{color:var(--cx-fg,#c9d6e6)}

  /* ── mobile sheet (≤700px) ──────────────────────────────────────────── */
  @media (max-width: 700px){
    .twkx-panel{top:0;left:0;transform:none;width:100vw;height:100dvh;max-width:100vw;max-height:100dvh;
      border-radius:0;border:0;
      padding-bottom:env(safe-area-inset-bottom,0)}
    @keyframes twkx-pop{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
    .twkx-shell{grid-template-columns:1fr;grid-template-rows:auto 1fr}
    .twkx-nav{flex-direction:row;overflow-x:auto;overflow-y:hidden;padding:6px 8px;gap:4px;
      border-right:0;border-bottom:1px solid color-mix(in oklab, var(--cx-fg-dim,#8295ae) 18%, transparent);
      scrollbar-width:none}
    .twkx-nav::-webkit-scrollbar{display:none}
    .twkx-nav button{flex:0 0 auto;font-size:9.5px;padding:0 10px}
    .twkx-head{padding:8px 6px 8px 14px}
    .twkx-title{letter-spacing:.16em}
    .twkx-body{padding:4px 14px calc(env(safe-area-inset-bottom,16px) + 20px)}
    .twkx-search{padding:10px 14px 8px}
    .twkx-count{display:none}
  }
`;

// ── Layout helpers (exported names kept) ────────────────────────────────────
function TweakSection({ label, children }) {
  return (
    <>
      <div className="twk-sect">{label}</div>
      {children}
    </>
  );
}

function TweakRow({ label, value, children, inline = false }) {
  return (
    <div className={inline ? 'twk-row twk-row-h' : 'twk-row'}>
      <div className="twk-lbl">
        <span>{label}</span>
        {value != null && <span className="twk-val">{value}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Controls (exported names kept; markup compatible with app children) ─────
function TweakSlider({ label, value, min = 0, max = 100, step = 1, unit = '', onChange }) {
  return (
    <TweakRow label={label} value={`${value}${unit}`}>
      <input type="range" className="twk-slider" min={min} max={max} step={step}
             value={value} aria-label={label}
             onChange={(e) => onChange(Number(e.target.value))} />
    </TweakRow>
  );
}

function TweakToggle({ label, value, onChange }) {
  return (
    <div className="twk-row twk-row-h" onClick={() => onChange(!value)}>
      <div className="twk-lbl"><span>{label}</span></div>
      <button type="button" className="twk-toggle" data-on={value ? '1' : '0'}
              role="switch" aria-checked={!!value} aria-label={label}
              onClick={(e) => { e.stopPropagation(); onChange(!value); }}><i /></button>
    </div>
  );
}

function TweakRadio({ label, value, options, onChange }) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  const valueRef = React.useRef(value);
  valueRef.current = value;

  const labelLen = (o) => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({ 2: 16, 3: 11, 4: 8 }[options.length] ?? 0);
  if (!fitsAsSegments) {
    const resolve = (s) => {
      const m = options.find((o) => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return <TweakSelect label={label} value={value} options={options}
                        onChange={(s) => onChange(resolve(s))} />;
  }
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  const idx = Math.max(0, opts.findIndex((o) => o.value === value));
  const n = opts.length;

  const segAt = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor(((clientX - r.left - 2) / inner) * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };

  const onPointerDown = (e) => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = (ev) => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <TweakRow label={label}>
      <div ref={trackRef} role="radiogroup" aria-label={label} onPointerDown={onPointerDown}
           className={dragging ? 'twk-seg dragging' : 'twk-seg'}>
        <div className="twk-seg-thumb"
             style={{ left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
                      width: `calc((100% - 4px) / ${n})` }} />
        {opts.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value}
                  onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </TweakRow>
  );
}

function TweakSelect({ label, value, options, onChange }) {
  return (
    <TweakRow label={label}>
      <select className="twk-field" value={value} aria-label={label}
              onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </TweakRow>
  );
}

function TweakText({ label, value, placeholder, onChange }) {
  return (
    <TweakRow label={label}>
      <input className="twk-field" type="text" value={value} placeholder={placeholder}
             aria-label={label} onChange={(e) => onChange(e.target.value)} />
    </TweakRow>
  );
}

function TweakNumber({ label, value, min, max, step = 1, unit = '', onChange }) {
  const clamp = (n) => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({ x: 0, val: 0 });
  const onScrubStart = (e) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, val: value };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = (ev) => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div className="twk-num">
      <span className="twk-num-lbl" onPointerDown={onScrubStart}>{label}</span>
      <input type="number" value={value} min={min} max={max} step={step} aria-label={label}
             onChange={(e) => onChange(clamp(Number(e.target.value)))} />
      {unit && <span className="twk-num-unit">{unit}</span>}
    </div>
  );
}

function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}

const __TwkCheck = ({ light }) => (
  <svg viewBox="0 0 14 14" aria-hidden="true">
    <path d="M3 7.2 5.8 10 11 4.2" fill="none" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"
          stroke={light ? 'rgba(0,0,0,.78)' : '#fff'} />
  </svg>
);

function TweakColor({ label, value, options, onChange }) {
  if (!options || !options.length) {
    return (
      <div className="twk-row twk-row-h">
        <div className="twk-lbl"><span>{label}</span></div>
        <input type="color" className="twk-swatch" value={value} aria-label={label}
               onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  const key = (o) => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return (
    <TweakRow label={label}>
      <div className="twk-chips" role="radiogroup" aria-label={label}>
        {options.map((o, i) => {
          const colors = Array.isArray(o) ? o : [o];
          const [hero, ...rest] = colors;
          const sup = rest.slice(0, 4);
          const on = key(o) === cur;
          return (
            <button key={i} type="button" className="twk-chip" role="radio"
                    aria-checked={on} data-on={on ? '1' : '0'}
                    aria-label={colors.join(', ')} title={colors.join(' · ')}
                    style={{ background: hero }}
                    onClick={() => onChange(o)}>
              {sup.length > 0 && (
                <span>
                  {sup.map((c, j) => <i key={j} style={{ background: c }} />)}
                </span>
              )}
              {on && <__TwkCheck light={__twkIsLight(hero)} />}
            </button>
          );
        })}
      </div>
    </TweakRow>
  );
}

function TweakButton({ label, onClick, secondary = false }) {
  return (
    <button type="button" className={secondary ? 'twk-btn secondary' : 'twk-btn'}
            onClick={onClick}>{label}</button>
  );
}

// ── TweakPersonalization — clears the learned taste profile + Oracle context.
function TweakPersonalization() {
  const [done, setDone] = React.useState(false);
  const onClear = () => {
    if (!window.confirm('Clear the learned taste profile and the Oracle conversation context?\n\nMarks, notes, and cached scripture are untouched.')) return;
    try { window.CODEX_ENGAGE && window.CODEX_ENGAGE.clearProfile && window.CODEX_ENGAGE.clearProfile(); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('codex:oracle-reset')); } catch (e) {}
    try {
      window.dispatchEvent(new CustomEvent('codex:toast',
        { detail: { msg: 'Personalization cleared', kind: 'ok' } }));
    } catch (e) {}
    setDone(true);
  };
  return (
    <div className="twk-row">
      <p className="twkx-hint">
        CODEX learns from your likes, Oracle questions, and highlights to tailor Reels.
      </p>
      <TweakButton label="Clear profile & Oracle context" secondary onClick={onClear} />
      {done && <span className="twk-val">Personalization cleared</span>}
    </div>
  );
}

// ── AIModelSection — provider + model + key + honest TEST. ──────────────────
function AIModelSection({ provider, model, availableProviders, onChange }) {
  const [keyInput, setKeyInput] = React.useState('');
  const [showKey, setShowKey]   = React.useState(false);
  const [keyBusy, setKeyBusy]   = React.useState(false);
  const [keyMsg, setKeyMsg]     = React.useState('');
  const [testMsg, setTestMsg]   = React.useState('');
  const [testBusy, setTestBusy] = React.useState(false);

  const PROVIDERS = [
    { id: 'anthropic', label: 'Anthropic', sub: 'Claude' },
    { id: 'xai',       label: 'xAI',       sub: 'Grok'   },
    { id: 'groq',      label: 'Groq',      sub: 'free'   },
    { id: 'gemini',    label: 'Gemini',    sub: 'Google' },
    { id: 'ollama',    label: 'Local',     sub: 'Ollama' },
  ];

  const reg = availableProviders || {};
  const curReg = reg[provider] || { available: false, models: [] };
  const catalogKey = provider === 'xai' ? 'grok' : provider;
  const catalog = (typeof window !== 'undefined' && window.CODEX_MODELS && window.CODEX_MODELS[catalogKey]) || [];
  const models = (curReg.models && curReg.models.length) ? curReg.models : catalog;
  const needsKey = (provider === 'anthropic' || provider === 'xai' || provider === 'groq' || provider === 'gemini') && !curReg.available;

  const pickProvider = (p) => {
    const r = reg[p];
    const ck = p === 'xai' ? 'grok' : p;
    const cat = (typeof window !== 'undefined' && window.CODEX_MODELS && window.CODEX_MODELS[ck]) || [];
    const first = (r && r.models && r.models[0] && r.models[0].id) || (cat[0] && cat[0].id) || '';
    onChange({ provider: p, model: first });
  };

  const tooltipFor = (p) => {
    const r = reg[p];
    if (r && r.available) return `Use ${p}`;
    if (p === 'ollama')   return 'Local: no Ollama detected (start the daemon)';
    if (p === 'xai')      return 'xAI: no key configured';
    if (p === 'groq')     return 'Groq: no key configured — get a free key at console.groq.com';
    if (p === 'gemini')   return 'Gemini: no key configured — get a free key at aistudio.google.com/apikey';
    if (p === 'anthropic') return 'Anthropic: no key configured';
    return '';
  };

  const submitKey = async () => {
    const key = keyInput.trim();
    if (!key) return;
    setKeyBusy(true); setKeyMsg('');
    try {
      const r = await fetch('/api/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, provider }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setKeyMsg('✓ saved');
      setKeyInput('');
      try { window.dispatchEvent(new CustomEvent('codex:engine-change')); } catch (e) {}
    } catch (e) {
      setKeyMsg(String(e.message || e));
    } finally {
      setKeyBusy(false);
    }
  };

  // Honest ping: round-trip time + token count on success, the real error
  // (truncated) on failure. Works through /api/chat in server mode and the
  // direct-api fetch shim on static hosting.
  const runTest = async () => {
    setTestBusy(true); setTestMsg('');
    const t0 = performance.now();
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider, model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      const ms = Math.round(performance.now() - t0);
      const u  = d.usage || {};
      const toks = (u.input_tokens || 0) + (u.output_tokens || 0);
      setTestMsg(`✓ ${ms}ms${toks ? ` · ${toks} tok` : ''}`);
    } catch (e) {
      setTestMsg('✗ ' + String(e.message || e).slice(0, 80));
    } finally {
      setTestBusy(false);
    }
  };

  return (
    <div className="cx-tp-provider">
      <div className="cx-tp-provider-seg" role="radiogroup" aria-label="AI provider">
        {PROVIDERS.map(p => {
          const r = reg[p.id] || { available: false };
          const on  = provider === p.id;
          const off = !r.available;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              className={`cx-tp-provider-btn ${on ? 'is-on' : ''} ${off ? 'is-off' : ''}`}
              title={tooltipFor(p.id)}
              onClick={() => pickProvider(p.id)}
            >
              <b>{p.label}</b>
              <i>{p.sub}{off ? ' · off' : ''}</i>
            </button>
          );
        })}
      </div>

      <div className="cx-tp-model-row">
        <label className="cx-tp-model-lbl">Model</label>
        <select
          className="cx-tp-model-sel"
          value={model || ''}
          onChange={(e) => onChange({ provider, model: e.target.value })}
          disabled={!models.length}
        >
          {!models.length && <option value="">— none available —</option>}
          {models.map(m => (
            <option key={m.id} value={m.id}>
              {m.label}{m.tier ? `  · ${m.tier}` : ''}
            </option>
          ))}
        </select>
      </div>

      {needsKey && (
        <div className="cx-tp-key">
          <label className="cx-tp-key-lbl">
            {provider === 'xai'  ? 'xAI API key (xai-…)'
             : provider === 'groq' ? 'Groq API key (gsk_…)'
             : provider === 'gemini' ? 'Gemini API key (AIza… / aistudio.google.com)'
             : 'Anthropic API key (sk-ant-…)'}
            {keyMsg ? <em className={`cx-tp-key-msg ${keyMsg.startsWith('✓') ? 'is-ok' : 'is-err'}`}>{keyMsg}</em> : null}
          </label>
          <div className="cx-tp-key-row twkx-keyrow">
            <input
              className="cx-tp-key-input"
              type={showKey ? 'text' : 'password'}
              value={keyInput}
              placeholder={provider === 'xai' ? 'xai-…' : provider === 'groq' ? 'gsk_…' : provider === 'gemini' ? 'AIza…' : 'sk-ant-…'}
              onChange={(e) => setKeyInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className="twkx-eye" onClick={() => setShowKey(s => !s)}
                    aria-label={showKey ? 'Hide key' : 'Reveal key'}
                    title={showKey ? 'Hide key' : 'Reveal key'}>{showKey ? '◐' : '◌'}</button>
            <button
              className="cx-tp-key-btn"
              onClick={submitKey}
              disabled={keyBusy || !keyInput.trim()}
            >{keyBusy ? '…' : 'Save'}</button>
          </div>
        </div>
      )}

      <div className="cx-tp-test-row">
        <button
          className="cx-tp-test-btn"
          onClick={runTest}
          disabled={testBusy || !model || needsKey}
          title="Send a tiny ping to verify connectivity — reports real latency or the real error"
        >{testBusy ? 'Testing…' : 'Test'}</button>
        {testMsg ? (
          <span className={`cx-tp-test-msg ${testMsg.startsWith('✓') ? 'is-ok' : 'is-err'}`}>{testMsg}</span>
        ) : null}
      </div>
    </div>
  );
}

// ── LightThemePicker — 9 day-mode palettes as swatches. ─────────────────────
function LightThemePicker() {
  const [current, setCurrent] = React.useState(
    (window.CODEX_LIGHT_THEMES && window.CODEX_LIGHT_THEMES.get()) || 'parchment'
  );
  React.useEffect(() => {
    const onChange = (e) => setCurrent(e.detail?.theme || current);
    window.addEventListener('codex:light-theme-change', onChange);
    return () => window.removeEventListener('codex:light-theme-change', onChange);
  }, [current]);
  if (!window.CODEX_LIGHT_THEMES) return null;
  const themes = window.CODEX_LIGHT_THEMES.list();
  return (
    <div className="cx-tp-theme-grid">
      {themes.map(t => {
        const isActive = current === t.id;
        return (
          <button
            key={t.id}
            type="button"
            className={`cx-tp-theme-swatch ${isActive ? 'is-active' : ''}`}
            onClick={() => window.CODEX_LIGHT_THEMES.set(t.id)}
            title={`Day mode: ${t.label}`}
            aria-label={`Day mode theme: ${t.label}${isActive ? ' (active)' : ''}`}
            aria-pressed={isActive}
          >
            <div
              className="cx-tp-theme-swatch-preview"
              style={{ background: t.bg, color: t.fg }}
            >Aa</div>
            <span
              className="cx-tp-theme-swatch-accent"
              style={{ background: t.accent }}
              aria-hidden="true"
            />
            <span className="cx-tp-theme-swatch-name">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── TweakOS7 — RETIRED. The OS·7 desk stopped being optional in v9.2; the
// codex.os7 flag and window.codexOS7() are gone. Kept as an inert export so
// any straggling composition renders nothing instead of crashing.
function TweakOS7() { return null; }

// ── TweakSchizoToggle — easter egg, gated by eligibility upstream. ──────────
function TweakSchizoToggle({ eligible, value, onChange }) {
  if (!eligible) return null;
  return (
    <div className="cx-schizo-toggle">
      <TweakToggle label="Schizo Mode" value={!!value} onChange={onChange} />
    </div>
  );
}

// ── TweakContinuity — drives the CANONICAL continuity keys the app consumes
// (continuityEnabled / continuityThreshold / notifyCadence). The old engage*
// quartet is deprecated (migrated at module load). ──────────────────────────
function TweakContinuity() {
  const tt = (k, fb) => { try { return (window.t && window.t(k)) || fb; } catch (e) { return fb; } };
  const read = () => ({
    continuityEnabled: true, continuityThreshold: 1, notifyCadence: 'subtle',
    ...((typeof window !== 'undefined' && window.CODEX_TWEAK_DEFAULTS) || {}),
    ...__cxTweaksRead(),
  });
  const [v, setV] = React.useState(read);
  React.useEffect(() => {
    const onChange = (e) => {
      const d = (e && e.detail) || {};
      if ('continuityEnabled' in d || 'continuityThreshold' in d || 'notifyCadence' in d) setV(read());
    };
    window.addEventListener('tweakchange', onChange);
    return () => window.removeEventListener('tweakchange', onChange);
  }, []);
  const set = (key, value) => {
    __cxTweaksWrite({ [key]: value });
    setV(prev => ({ ...prev, [key]: value }));
    if (key === 'continuityThreshold') {
      try {
        if (window.CODEX_ENGAGEMENT && window.CODEX_ENGAGEMENT.setConfig) {
          window.CODEX_ENGAGEMENT.setConfig({ dailyThreshold: value });
        }
      } catch (e) { /* never throw from settings */ }
    }
  };
  return (
    <>
      <TweakToggle
        label={tt('cx.tweak.enable', 'Continuity layer')}
        value={v.continuityEnabled !== false}
        onChange={(val) => set('continuityEnabled', val)} />
      {v.continuityEnabled !== false && (
        <>
          <TweakSlider
            label={tt('cx.tweak.threshold', 'Depth actions per day')}
            value={Number(v.continuityThreshold) || 1}
            min={1} max={5} step={1}
            onChange={(val) => set('continuityThreshold', val)} />
          <TweakRadio
            label={tt('cx.tweak.cadence', 'Announcements')}
            value={v.notifyCadence || 'subtle'}
            options={[
              { value: 'off',    label: tt('cx.tweak.cadence.off', 'Off') },
              { value: 'subtle', label: tt('cx.tweak.cadence.milestones', 'Subtle') },
              { value: 'all',    label: tt('cx.tweak.cadence.all', 'All') },
            ]}
            onChange={(val) => set('notifyCadence', val)} />
        </>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// THE PANEL — calm, searchable, grouped.
// ─────────────────────────────────────────────────────────────────────────────

// Section-label → group routing for host-provided children. Covers the
// canonical English labels plus the i18n variants app.jsx may emit.
function __cxGroupForSection(label) {
  const FIXED = {
    'AI Engines': 'AI & KEYS', 'AI Model': 'AI & KEYS', 'Advanced inference': 'AI & KEYS',
    'Modules': 'INSTRUMENTS', 'Continuity': 'INSTRUMENTS',
    'Danger zone': 'DANGER',
    'First impression': 'SYSTEM', 'Keyboard': 'SYSTEM', 'Install': 'SYSTEM',
    'Cross-device sync': 'SYSTEM', 'Shell': 'SYSTEM', 'Personalization': 'DANGER',
    'Deck': 'SYSTEM',
  };
  if (FIXED[label] != null) return FIXED[label];
  const lc = String(label || '').toLowerCase();
  if (/look|apari|aparê|erschein|apparen|aspect|glamour|מראה|रूप/.test(lc)) return 'APPEARANCE';
  if (/marks|marcas|marques|markier|notae/.test(lc)) return 'READING';
  if (/reading|lectura|leitur|lectur|lesen/.test(lc)) return 'READING';
  if (/ai|engine|drift|infer|motor/.test(lc)) return 'AI & KEYS';
  if (/sync|sincron|cache|caché|offline|export|import|bibles|biblias|portab|dados|daten|données|data/.test(lc)) return 'SYSTEM';
  if (/danger|peligro|gefahr|zone/.test(lc)) return 'DANGER';
  if (/language|idioma|langue|sprache|install|instalar|installation|module|keyboard|teclado|tastatur|clavier/.test(lc)) return 'SYSTEM';
  if (/continuity|continuidad|engage/.test(lc)) return 'INSTRUMENTS';
  return 'SYSTEM';
}

// Search keywords injected per child section so plain words hit ('api key',
// 'dark', 'font' …) even when the rendered text says something else.
const __CX_SECTION_KW = {
  'AI Engines': 'api key keys secret token anthropic claude grok xai groq gemini google ollama local engine active',
  'AI Model': 'ai model provider engine anthropic claude grok groq gemini ollama test ping',
  'Advanced inference': 'drift hermeneutic experimental easter',
  'Look': 'appearance accent color scanlines palette day light dark theme',
  'Marks': 'marks highlight color clear amber cyan violet green rose',
  'Reading': 'reading caffeinate awake notes oracle font size bundle translations',
  'Cross-device sync': 'sync cross device transfer qr',
  'Install': 'install pwa offline app home screen',
  'Cache': 'cache offline chapters panels clear storage',
  'Offline · Bibles': 'offline bibles download bundle',
  'Data · portable': 'export import backup restore json data portable',
  'First impression': 'boot intro animation startup',
  'Keyboard': 'keyboard shortcuts keys arrows',
  'Danger zone': 'reset factory defaults wipe danger',
  'Modules': 'modules marketplace plugins',
  'Language': 'language english idioma langue sprache',
};

// Wrapper for every filterable row.
function TwkItem({ kw, passive, children }) {
  return (
    <div className="twkx-item" data-kw={kw || ''} data-passive={passive ? '1' : '0'}>
      {children}
    </div>
  );
}

// Generic control for tweak keys this panel has never heard of (registered
// by other modules via useTweaks defaults, or already sitting in the store).
function AutoTweakRow({ entry }) {
  const [v, setV] = React.useState(() => {
    const s = __cxTweaksRead();
    if (entry.key in s) return s[entry.key];
    const d = (window.CODEX_TWEAK_DEFAULTS || {});
    return (entry.key in d) ? d[entry.key] : entry.value;
  });
  React.useEffect(() => {
    const onChange = (e) => {
      const d = (e && e.detail) || {};
      if (entry.key in d) setV(d[entry.key]);
    };
    window.addEventListener('tweakchange', onChange);
    return () => window.removeEventListener('tweakchange', onChange);
  }, [entry.key]);
  const write = (val) => { setV(val); __cxTweaksWrite({ [entry.key]: val }); };
  if (typeof v === 'boolean') {
    return <TweakToggle label={entry.label} value={v} onChange={write} />;
  }
  if (typeof v === 'number') {
    return <TweakNumber label={entry.label} value={v} onChange={(n) => write(n)} />;
  }
  if (typeof v === 'string') {
    return <TweakText label={entry.label} value={v} onChange={write} />;
  }
  return (
    <TweakRow label={entry.label} value={String(v)}>
      <p className="twkx-hint">registered tweak · no editor for this shape yet</p>
    </TweakRow>
  );
}

// ── The panel's own (self-rendered) controls ────────────────────────────────
function __cxApplyFontPreview(v) {
  try { if (window.CODEX_DATA && window.CODEX_DATA.tweaks) window.CODEX_DATA.tweaks.fontScale = v; } catch (e) {}
  try {
    document.querySelectorAll('.cxr').forEach(el => el.style.setProperty('--cxr-fs', v + 'px'));
  } catch (e) {}
  try { window.dispatchEvent(new CustomEvent('codex:fontscale', { detail: { fontScale: v } })); } catch (e) {}
}

function SelfControls({ group, t, setTweak }) {
  const themeVal = t.autoTheme ? 'auto' : (t.manualDark ? 'night' : 'day');
  const setTheme = (v) => {
    if (v === 'auto') setTweak({ autoTheme: true });
    else setTweak({ autoTheme: false, manualDark: v === 'night' });
  };
  const translations = (window.CODEX_DATA && window.CODEX_DATA.translations) || [];

  if (group === 'APPEARANCE') {
    return (
      <TwkItem kw="theme dark light night day auto solar lights appearance mode">
        <TweakRadio label="Theme" value={themeVal}
          options={[
            { value: 'auto',  label: '☉ AUTO' },
            { value: 'day',   label: 'DAY' },
            { value: 'night', label: 'NIGHT' },
          ]}
          onChange={setTheme} />
        <p className="twkx-hint">Auto follows the sun at your hour — day pages, night glass.</p>
      </TwkItem>
    );
  }

  if (group === 'SCRIPTURE') {
    return (
      <>
        <TwkItem kw="font size text scale scripture aa bigger smaller reader type">
          <TweakSlider label="Scripture size" value={Number(t.fontScale) || 22}
            min={16} max={30} step={1} unit="px"
            onChange={(v) => { setTweak('fontScale', v); __cxApplyFontPreview(v); }} />
          <p className="twkx-hint">Live — the reader behind repaints as you slide.</p>
        </TwkItem>
        <TwkItem kw="font face serif mono typeface family scripture">
          <TweakRadio label="Scripture face" value={t.scriptureFont || 'serif'}
            options={[{ value: 'serif', label: 'SERIF' }, { value: 'mono', label: 'MONO' }]}
            onChange={(v) => {
              setTweak('scriptureFont', v);
              try {
                const app = document.querySelector('.cx-app');
                if (app) { app.classList.remove('font-serif', 'font-mono'); app.classList.add('font-' + v); }
              } catch (e) {}
            }} />
        </TwkItem>
        {translations.length > 0 && (
          <TwkItem kw="translation bible version primary kjv web text">
            <TweakSelect label="Primary translation" value={t.primaryTranslation || 'kjv'}
              options={translations.map(x => ({ value: x.id, label: x.name || x.id }))}
              onChange={(id) => {
                setTweak('primaryTranslation', id);
                try { window.dispatchEvent(new CustomEvent('codex:primary', { detail: { id } })); } catch (e) {}
              }} />
          </TwkItem>
        )}
        <TwkItem kw="red letter words of jesus christ crimson">
          <TweakToggle label="Red-letter words of Jesus" value={t.redLetter !== false}
            onChange={(v) => setTweak('redLetter', v)} />
        </TwkItem>
        <TwkItem kw="side by side parallel two translations columns compare">
          <TweakToggle label="Side-by-side translations" value={!!t.sideBySide}
            onChange={(v) => setTweak('sideBySide', v)} />
        </TwkItem>
      </>
    );
  }

  if (group === 'THE NAME') {
    return (
      <>
        <TwkItem kw="divine gold golden name covenant color reader yhwh tetragrammaton yahweh jehovah lord restore sacred">
          <TweakToggle label="The Name in covenant gold" value={t.divineGold !== false}
            onChange={(v) => setTweak('divineGold', v)} />
        </TwkItem>
        <TwkItem kw="divine hebrew tetragrammaton script reader yhwh">
          <TweakToggle label="Tetragrammaton in Hebrew (יהוה)" value={!!t.divineHebrew}
            onChange={(v) => setTweak('divineHebrew', v)} />
          <p className="twkx-hint">The reader renders the Name in its own script where the Hebrew carries it.</p>
        </TwkItem>
      </>
    );
  }

  if (group === 'READING') {
    return (
      <>
        <TwkItem kw="distraction free focus zen hide chrome quiet theater">
          <TweakToggle label="Distraction-free reading" value={!!t.distractionFree}
            onChange={(v) => setTweak('distractionFree', v)} />
          <p className="twkx-hint">Only the Word on screen. Also: the ⊟ button in the footer, or F to focus.</p>
        </TwkItem>
        <TwkItem kw="overlay gnosis reader margin esoteric glyph">
          <TweakToggle label="Reader overlay · Gnosis" value={!!t.overlayGnosis}
            onChange={(v) => setTweak('overlayGnosis', v)} />
        </TwkItem>
        <TwkItem kw="overlay talmud reader margin rabbinic glyph">
          <TweakToggle label="Reader overlay · Talmud" value={!!t.overlayTalmud}
            onChange={(v) => setTweak('overlayTalmud', v)} />
        </TwkItem>
        <TwkItem kw="overlay commentary reader margin voices glyph">
          <TweakToggle label="Reader overlay · Commentary" value={!!t.overlayCommentary}
            onChange={(v) => setTweak('overlayCommentary', v)} />
          <p className="twkx-hint">Overlays paint quiet glyphs in the reader's margin — also togglable from the reader itself.</p>
        </TwkItem>
      </>
    );
  }

  if (group === 'INSTRUMENTS') {
    return (
      <>
        <TwkItem kw="continuity streak engagement mastery analyst depth announcements cadence">
          <TweakContinuity />
        </TwkItem>
        <TwkItem kw="gnosis overlay esoteric ring engaged dormant" passive>
          <div className="twkx-note">
            ⟁ <b>Gnosis overlay</b> — lives on the master ring in the desk footer
            (DORMANT / ENGAGED). One tap there; it never hides in a menu.
          </div>
        </TwkItem>
      </>
    );
  }

  if (group === 'SYSTEM') {
    return (
      <TwkItem kw="tour welcome replay onboarding first run">
        <TweakButton label="↻ Replay the welcome tour" secondary
          onClick={() => {
            try { window.dispatchEvent(new CustomEvent('codex:open-tour')); } catch (e) {}
            try { window.dispatchEvent(new CustomEvent('codex:close-settings')); } catch (e) {}
          }} />
      </TwkItem>
    );
  }

  if (group === 'DANGER') {
    return (
      <TwkItem kw="personalization profile taste reels oracle context clear privacy">
        <TweakPersonalization />
      </TwkItem>
    );
  }

  return null;
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
function TweaksPanel({ title = 'Settings', noDeckControls = false, children }) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState('settings'); // settings | help
  const [query, setQuery] = React.useState('');
  const [matchCount, setMatchCount] = React.useState(null);
  const panelRef = React.useRef(null);
  const bodyRef = React.useRef(null);
  const searchRef = React.useRef(null);
  const [activeGroup, setActiveGroup] = React.useState(SETTINGS_GROUPS[0]);
  const [, forceTick] = React.useState(0);

  // The panel's own store hook (synced with the app's instance via
  // 'tweakchange'); defaults come from whatever the host registered.
  const [t, setTweak] = useTweaks(window.CODEX_TWEAK_DEFAULTS || {});

  // ── host protocol ──────────────────────────────────────────────────
  React.useEffect(() => {
    const onMsg = (e) => {
      const ty = e?.data?.type;
      if (ty === '__activate_edit_mode') setOpen(true);
      else if (ty === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const dismiss = React.useCallback(() => {
    setOpen(false);
    window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
  }, []);

  // App-wide open intent (welcome tour, Oracle [[do:open-settings]], omnibar).
  React.useEffect(() => {
    const scrollToGroup = (g) => {
      setTimeout(() => {
        try {
          const el = bodyRef.current && bodyRef.current.querySelector(`[data-group="${g}"]`);
          if (el) el.scrollIntoView({ block: 'start' });
        } catch (e) {}
      }, 60);
    };
    const onOpen = (e) => {
      setOpen(true);
      __cxRefreshSettingsIndex();
      const sect = String(e?.detail?.section || '').toLowerCase();
      if (!sect) { setMode('settings'); return; }
      if (/help|wiki|doc/.test(sect)) { setMode('help'); return; }
      setMode('settings');
      if (/api|ai|model|engine|infer|key/.test(sect)) scrollToGroup('AI & KEYS');
      else if (/name|yhwh/.test(sect)) scrollToGroup('THE NAME');
      else if (/scripture|font|translat/.test(sect)) scrollToGroup('SCRIPTURE');
      else if (/look|theme|appear/.test(sect)) scrollToGroup('APPEARANCE');
      else if (/read|mark|note/.test(sect)) scrollToGroup('READING');
      else if (/sync|cache|offline|data|export|import|install|lang|system/.test(sect)) scrollToGroup('SYSTEM');
    };
    const onClose = () => dismiss();
    window.addEventListener('codex:open-settings', onOpen);
    window.addEventListener('codex:close-settings', onClose);
    return () => {
      window.removeEventListener('codex:open-settings', onOpen);
      window.removeEventListener('codex:close-settings', onClose);
    };
  }, [dismiss]);

  // Escape + outside click.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      const panel = panelRef.current;
      if (!panel) return;
      if (panel.contains(e.target)) return;
      if (e.target.closest && e.target.closest('[data-tweaks-trigger]')) return;
      dismiss();
    };
    const onKey = (e) => { if (e.key === 'Escape') dismiss(); };
    const timer = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, dismiss]);

  // On open: refresh the index (new tweak keys may have registered since),
  // focus the search, reset the query.
  React.useEffect(() => {
    if (!open) return;
    __cxRefreshSettingsIndex();
    forceTick(n => n + 1);
    setQuery('');
    const timer = setTimeout(() => { try { searchRef.current && searchRef.current.focus(); } catch (e) {} }, 80);
    return () => clearTimeout(timer);
  }, [open, mode]);

  // ── live filter — plain words over label text + keyword aliases ─────
  React.useEffect(() => {
    if (!open || mode !== 'settings') return;
    const body = bodyRef.current;
    if (!body) return;
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const items = Array.from(body.querySelectorAll('.twkx-item'));
    if (!words.length) {
      items.forEach(el => el.classList.remove('twkx-hide'));
      body.querySelectorAll('.twkx-sub').forEach(el => el.classList.remove('twkx-hide'));
      body.querySelectorAll('.twkx-group').forEach(el => el.removeAttribute('data-hidden'));
      setMatchCount(null);
      return;
    }
    const matches = (el) => {
      const hay = ((el.textContent || '') + ' ' + (el.getAttribute('data-kw') || '')).toLowerCase();
      return words.every(w => hay.includes(w));
    };
    const vis = new Map();
    items.forEach(el => vis.set(el, matches(el)));
    // Passive rows (hints, pointers) ride along with a visible neighbor.
    items.forEach((el, i) => {
      if (el.getAttribute('data-passive') !== '1' || vis.get(el)) return;
      const prev = items[i - 1], next = items[i + 1];
      if ((prev && vis.get(prev)) || (next && vis.get(next))) vis.set(el, true);
    });
    let shown = 0;
    items.forEach(el => {
      const on = !!vis.get(el);
      el.classList.toggle('twkx-hide', !on);
      if (on && el.getAttribute('data-passive') !== '1') shown++;
    });
    // Sub-headers show iff any visible item before the next sub-header.
    body.querySelectorAll('.twkx-group').forEach(g => {
      const kids = Array.from(g.children);
      kids.forEach((k, i) => {
        if (!k.classList.contains('twkx-sub')) return;
        let any = false;
        for (let j = i + 1; j < kids.length; j++) {
          if (kids[j].classList.contains('twkx-sub')) break;
          if (kids[j].classList.contains('twkx-item') && !kids[j].classList.contains('twkx-hide')) { any = true; break; }
        }
        k.classList.toggle('twkx-hide', !any);
      });
      const anyItem = g.querySelector('.twkx-item:not(.twkx-hide)');
      if (anyItem) g.removeAttribute('data-hidden'); else g.setAttribute('data-hidden', '1');
    });
    setMatchCount(shown);
  }, [query, open, mode]);

  // Scroll-spy for the nav rail.
  React.useEffect(() => {
    if (!open || mode !== 'settings') return;
    const body = bodyRef.current;
    if (!body) return;
    const onScroll = () => {
      const groups = Array.from(body.querySelectorAll('.twkx-group'));
      let cur = groups[0];
      for (const g of groups) {
        if (g.getAttribute('data-hidden') === '1') continue;
        if (g.offsetTop - body.scrollTop <= 90) cur = g;
      }
      if (cur) setActiveGroup(cur.getAttribute('data-group'));
    };
    onScroll();
    body.addEventListener('scroll', onScroll, { passive: true });
    return () => body.removeEventListener('scroll', onScroll);
  }, [open, mode]);

  if (!open) return null;

  // ── partition host children into groups, preserving section labels ──
  const childArr = React.Children.toArray(children);
  const clusters = []; // { label, group, kw, items: [] }
  let cur = null;
  for (const node of childArr) {
    if (node && node.type === TweakSection) {
      const label = node.props.label;
      cur = { label, group: __cxGroupForSection(label), kw: __CX_SECTION_KW[label] || '', items: [] };
      clusters.push(cur);
      continue;
    }
    if (!cur) { cur = { label: '', group: 'SYSTEM', kw: '', items: [] }; clusters.push(cur); }
    cur.items.push(node);
  }
  const clustersByGroup = {};
  for (const g of SETTINGS_GROUPS) clustersByGroup[g] = [];
  for (const c of clusters) (clustersByGroup[c.group] || clustersByGroup.SYSTEM).push(c);

  // Auto-surfaced unknown tweaks per group.
  const unknown = __cxUnknownTweaks();
  const unknownByGroup = {};
  for (const u of unknown) (unknownByGroup[u.group] = unknownByGroup[u.group] || []).push(u);

  const isPassiveNode = (node) =>
    typeof node === 'object' && node && typeof node.type === 'string' && (node.type === 'p' || node.type === 'div');

  const groupHasContent = (g) =>
    true; // every group always has at least its self controls or a header; empty ones hide via search only

  const switchMode = (m) => { setMode(m); };

  const jumpTo = (g) => {
    setMode('settings');
    setTimeout(() => {
      try {
        const el = bodyRef.current && bodyRef.current.querySelector(`[data-group="${g}"]`);
        if (el && bodyRef.current) bodyRef.current.scrollTo({ top: el.offsetTop - 8 });
      } catch (e) {}
    }, 30);
  };

  const HelpWiki = window.CODEX_HelpWiki;

  return (
    <>
      <style>{__TWEAKS_STYLE}</style>
      <div className="twkx-scrim" data-noncommentable="" onMouseDown={dismiss} />
      <div ref={panelRef} className="twkx-panel" data-noncommentable=""
           role="dialog" aria-modal="true" aria-label={title}>
        <div className="twkx-head">
          <span className="twkx-title">{title}</span>
          <div className="twkx-mode" role="tablist" aria-label="Settings or help">
            <button role="tab" aria-selected={mode === 'settings'} onClick={() => switchMode('settings')}>SETTINGS</button>
            <button role="tab" aria-selected={mode === 'help'} onClick={() => switchMode('help')}>HELP</button>
          </div>
          <span className="twkx-spacer" />
          <button className="twkx-x" aria-label="Close settings" onClick={dismiss}>✕</button>
        </div>

        {mode === 'help' ? (
          <div className="twkx-help-body">
            {HelpWiki ? <HelpWiki /> : (
              <div className="twkx-empty">Help wiki loading…</div>
            )}
          </div>
        ) : (
          <div className="twkx-shell">
            <nav className="twkx-nav" aria-label="Setting groups">
              {SETTINGS_GROUPS.map(g => (
                <button key={g}
                        className={(activeGroup === g ? 'is-on ' : '') + (g === 'DANGER' ? 'is-danger' : '')}
                        onClick={() => jumpTo(g)}>
                  {g}
                </button>
              ))}
            </nav>
            <div className="twkx-main">
              <div className="twkx-search">
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="search settings — try 'dark', 'font', 'api key'…"
                  aria-label="Search settings"
                  spellCheck={false}
                />
                <span className="twkx-count" aria-live="polite">
                  {matchCount == null ? '' : matchCount === 0 ? 'no matches' : `${matchCount} match${matchCount === 1 ? '' : 'es'}`}
                </span>
              </div>
              <div className="twkx-body" ref={bodyRef} role="region" aria-label="Settings">
                {SETTINGS_GROUPS.map(g => (
                  <section key={g} className="twkx-group" data-group={g}>
                    <h2 className="twkx-group-h">{g}</h2>
                    <SelfControls group={g} t={t} setTweak={setTweak} />
                    {(clustersByGroup[g] || []).map((c, ci) => (
                      <React.Fragment key={`${g}-${ci}`}>
                        {c.label ? <div className="twkx-sub">{c.label}</div> : null}
                        {c.items.map((node, ni) => (
                          <TwkItem key={ni} kw={`${c.label} ${c.kw}`} passive={isPassiveNode(node)}>
                            {node}
                          </TwkItem>
                        ))}
                      </React.Fragment>
                    ))}
                    {(unknownByGroup[g] || []).map(u => (
                      <TwkItem key={u.key} kw={`${u.kw} ${u.key} tweak`}>
                        <AutoTweakRow entry={u} />
                      </TwkItem>
                    ))}
                  </section>
                ))}
                {matchCount === 0 && (
                  <div className="twkx-empty">nothing matches “{query}” — try ‘theme’, ‘font’, ‘key’, ‘offline’…</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

Object.assign(window, {
  useTweaks, TweaksPanel, TweakSection, TweakRow,
  TweakSlider, TweakToggle, TweakRadio, TweakSelect,
  TweakText, TweakNumber, TweakColor, TweakButton,
  TweakPersonalization,
  TweakSchizoToggle, TweakContinuity, TweakOS7,
  AIModelSection, LightThemePicker,
});
