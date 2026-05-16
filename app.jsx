// CODEX — main app

const { useState, useEffect, useMemo, useRef, useCallback } = React;

// ── Language picker · 4-col grid of glyph pills, matches CODEX aesthetic.
function LangPicker({ value, onChange }) {
  const langs = window.CODEX_LANGS || [{ id: "en", label: "English", glyph: "EN" }];
  return (
    <div className="cx-langs">
      {langs.map(l => (
        <button
          key={l.id}
          className={`cx-lang ${value === l.id ? "is-on" : ""}`}
          onClick={() => onChange(l.id)}
          title={l.label}
          aria-pressed={value === l.id}
        >
          <span className="cx-lang-glyph">{l.glyph}</span>
          <span className="cx-lang-name">{l.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── API keys section · Anthropic + Grok, with a segmented selector for
// which provider drives the Oracle. Anthropic key is synced to the
// existing /api/key server endpoint (preserving current behavior);
// Grok is stored locally for now since the backend doesn't route it yet.
const API_KEYS_STORE = "codex.api.keys.v1";
function loadApiKeys() {
  try { return { active: "anthropic", anthropic: "", grok: "", ...JSON.parse(localStorage.getItem(API_KEYS_STORE) || "null") }; }
  catch { return { active: "anthropic", anthropic: "", grok: "" }; }
}
function saveApiKeys(v) { try { localStorage.setItem(API_KEYS_STORE, JSON.stringify(v)); } catch {} }

function ApiKeysSection() {
  const [keys, setKeys] = useState(loadApiKeys);
  const [showA, setShowA] = useState(false);
  const [showG, setShowG] = useState(false);
  const [busyA, setBusyA] = useState(false);
  const [busyG, setBusyG] = useState(false);
  const [statusA, setStatusA] = useState("");
  const [statusG, setStatusG] = useState("");
  // Persist on every keystroke so the direct-API shim always sees the
  // latest values; Apply re-broadcasts so any open Oracle re-probes.
  const update = (patch) => {
    const next = { ...keys, ...patch };
    setKeys(next);
    saveApiKeys(next);
    // Notify direct-api shim + any listeners so engine swaps take effect
    // without a reload.
    try { window.CODEX_DIRECT && window.CODEX_DIRECT.notifyEngineChange(); } catch {}
  };

  // Try to push the Anthropic key to /api/key (only succeeds when the
  // Node server is up). On static hosting the shim still has the key in
  // localStorage, so we treat a failed POST as "applied locally".
  const applyAnthropic = async () => {
    const key = (keys.anthropic || "").trim();
    if (!key.startsWith("sk-")) { setStatusA("Key must start with sk-"); return; }
    setBusyA(true); setStatusA("");
    try {
      const r = await fetch("/api/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (r.ok) { setStatusA("✓ applied"); }
      else { setStatusA("✓ saved locally"); }
    } catch (e) {
      // No server — that's fine in direct mode, key is already in LS.
      setStatusA("✓ saved locally");
    } finally {
      setBusyA(false);
      try { window.CODEX_DIRECT && window.CODEX_DIRECT.notifyEngineChange(); } catch {}
    }
  };

  // Grok lives entirely in localStorage (no server endpoint). Apply just
  // validates the prefix and pings the engine-change listeners.
  const applyGrok = () => {
    const key = (keys.grok || "").trim();
    if (!key.startsWith("xai-")) { setStatusG("Key must start with xai-"); return; }
    setBusyG(true); setStatusG("");
    // localStorage write already happened in update(); re-notify and done.
    try { window.CODEX_DIRECT && window.CODEX_DIRECT.notifyEngineChange(); } catch {}
    setStatusG("✓ applied");
    setBusyG(false);
  };

  return (
    <div className="cx-api">
      <div className="cx-api-seg" role="tablist" aria-label="Active engine">
        <button
          role="tab"
          aria-selected={keys.active === "anthropic"}
          className={`cx-api-seg-btn ${keys.active === "anthropic" ? "is-on" : ""}`}
          onClick={() => update({ active: "anthropic" })}
          disabled={!keys.anthropic}
          title={keys.anthropic ? "Use Claude as the Oracle engine" : "Add your Anthropic key first"}
        >
          <span className="cx-api-seg-glyph">◉</span>
          <span><b>Anthropic</b><i>Claude{keys.active === "anthropic" ? " · active" : ""}</i></span>
        </button>
        <button
          role="tab"
          aria-selected={keys.active === "grok"}
          className={`cx-api-seg-btn ${keys.active === "grok" ? "is-on" : ""}`}
          onClick={() => update({ active: "grok" })}
          disabled={!keys.grok}
          title={keys.grok ? "Use Grok as the Oracle engine" : "Add your Grok key first"}
        >
          <span className="cx-api-seg-glyph">⌬</span>
          <span><b>Grok</b><i>xAI{keys.active === "grok" ? " · active" : ""}</i></span>
        </button>
      </div>

      <div className="cx-api-field">
        <label className="cx-api-lbl">
          <span>Anthropic API key</span>
          {statusA ? <em className={`cx-api-status ${statusA.startsWith("✓") ? "is-ok" : "is-err"}`}>{statusA}</em> : null}
        </label>
        <div className="cx-api-row">
          <input
            className="cx-api-input"
            type={showA ? "text" : "password"}
            value={keys.anthropic}
            placeholder="sk-ant-..."
            onChange={(e) => update({ anthropic: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") applyAnthropic(); }}
            spellCheck={false}
            autoComplete="off"
          />
          <button className="cx-api-eye" onClick={() => setShowA(s => !s)} title={showA ? "Hide" : "Show"}>{showA ? "◐" : "◌"}</button>
          <button className="cx-api-save" onClick={applyAnthropic} disabled={busyA || !keys.anthropic}>
            {busyA ? "···" : "APPLY"}
          </button>
        </div>
      </div>

      <div className="cx-api-field">
        <label className="cx-api-lbl">
          <span>Grok API key</span>
          {statusG ? <em className={`cx-api-status ${statusG.startsWith("✓") ? "is-ok" : "is-err"}`}>{statusG}</em> : null}
        </label>
        <div className="cx-api-row">
          <input
            className="cx-api-input"
            type={showG ? "text" : "password"}
            value={keys.grok}
            placeholder="xai-..."
            onChange={(e) => update({ grok: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") applyGrok(); }}
            spellCheck={false}
            autoComplete="off"
          />
          <button className="cx-api-eye" onClick={() => setShowG(s => !s)} title={showG ? "Hide" : "Show"}>{showG ? "◐" : "◌"}</button>
          <button className="cx-api-save" onClick={applyGrok} disabled={busyG || !keys.grok}>
            {busyG ? "···" : "APPLY"}
          </button>
        </div>
        <p className="cx-api-hint">Both keys stay in your browser. Switch engines via the toggle above — takes effect on the next Oracle reply.</p>
      </div>
    </div>
  );
}

// ── AutoCacheTick — pill that surfaces auto-cache progress in the footer.
// Hidden when idle / done. Listens to the events fired by auto-cache.js.
function AutoCacheTick() {
  const [state, setState] = useState({ phase: "idle", done: 0, total: 0, pct: 0 });
  useEffect(() => {
    const onStart = (e) => setState({ phase: "running", done: 0, total: e.detail.total || 0, pct: 0 });
    const onTick  = (e) => {
      const d = e.detail || {};
      const total = d.total || 0;
      const done = d.done || 0;
      const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
      setState({ phase: "running", done, total, pct });
    };
    const onDone  = () => {
      setState({ phase: "done", done: 0, total: 0, pct: 100 });
      // Briefly flash "✓ INSTALLED" then hide.
      setTimeout(() => setState((s) => ({ ...s, phase: "hidden" })), 4000);
    };
    const onErr   = () => setState({ phase: "hidden", done: 0, total: 0, pct: 0 });
    window.addEventListener("codex:autocache-start", onStart);
    window.addEventListener("codex:autocache-tick",  onTick);
    window.addEventListener("codex:autocache-done",  onDone);
    window.addEventListener("codex:autocache-error", onErr);
    return () => {
      window.removeEventListener("codex:autocache-start", onStart);
      window.removeEventListener("codex:autocache-tick",  onTick);
      window.removeEventListener("codex:autocache-done",  onDone);
      window.removeEventListener("codex:autocache-error", onErr);
    };
  }, []);
  if (state.phase === "idle" || state.phase === "hidden") return null;
  if (state.phase === "done") {
    return <Tick className="cx-hide-mobile cx-autocache is-done">✓ INSTALLED</Tick>;
  }
  return (
    <Tick className="cx-hide-mobile cx-autocache" title={`Caching scripture: ${state.done} / ${state.total} chapters`}>
      INSTALL&nbsp;<b>{state.pct}%</b>
    </Tick>
  );
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "autoTheme": true,
  "manualDark": true,
  "primaryTranslation": "kjv",
  "fontScale": 22,
  "scanlines": true,
  "accent": "cyan",
  "scriptureFont": "serif",
  "redLetter": true,
  "sideBySide": false,
  "highlightColor": "amber",
  "distractionFree": false,
  "yhwhMode": false,
  "lang": "en",
  "caffeinate": false,
  "notesEnabled": false,
  "oracleFontScale": 14,
  "hermeneuticDriftCompensation": false,
  "bootIntro": true
}/*EDITMODE-END*/;

const HIGHLIGHT_COLORS = {
  amber:  { name: "Amber",  swatch: "#ffc46b" },
  cyan:   { name: "Cyan",   swatch: "#7ee0ff" },
  violet: { name: "Violet", swatch: "#c7a9ff" },
  green:  { name: "Green",  swatch: "#8de8a8" },
  rose:   { name: "Rose",   swatch: "#ff8291" },
};

const ACCENT_MAP = {
  cyan:   { dark: "#7ee0ff", light: "#0a6884", glow: "rgba(126,224,255,.4)" },
  amber:  { dark: "#ffc46b", light: "#7a4a05", glow: "rgba(255,196,107,.4)" },
  green:  { dark: "#8de8a8", light: "#0b5c2a", glow: "rgba(141,232,168,.4)" },
  violet: { dark: "#c7a9ff", light: "#4a2da8", glow: "rgba(199,169,255,.4)" },
};

// "John 1:14" → { bookId, chapter, verse }
function parseRef(ref, books) {
  if (!ref) return null;
  const m = ref.trim().match(/^([\dIVX]+\s*)?([A-Za-zé\u00C0-\u017F]+(?:\s+(?:of\s+)?[A-Za-z]+)?)\s+(\d+)(?::(\d+))?/);
  if (!m) return null;
  const prefix = (m[1] || "").trim().replace(/\s+/g, "");
  const word = m[2];
  const ch = parseInt(m[3], 10);
  const v = m[4] ? parseInt(m[4], 10) : 1;
  const wantName = (prefix ? prefix + " " : "") + word;
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const wantNorm = norm(wantName);
  const wantWordNorm = norm(word);
  const book = books.find(b => norm(b.name) === wantNorm || norm(b.name).startsWith(wantNorm))
            || books.find(b => norm(b.name).includes(wantWordNorm));
  if (!book) return null;
  return { bookId: book.id, chapter: Math.min(ch, book.chapters), verse: v };
}

// Local i18n helper — terse so JSX stays readable. Falls back to the key
// itself if the global i18n module hasn't loaded (defensive).
function tt(k) { return (window.t && window.t(k)) || k; }

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  // Push the persisted language into the global i18n module so window.t()
  // returns the right strings on first paint and after every change. Also
  // updates <html lang> + dir for RTL (Hebrew) and font selection.
  useEffect(() => {
    if (window.applyCodexLang) window.applyCodexLang(t.lang || "en");
  }, [t.lang]);
  // Drift-mode label overlay — when on, t() resolves alt tags first.
  useEffect(() => {
    if (window.applyCodexDrift) window.applyCodexDrift(!!t.hermeneuticDriftCompensation);
  }, [t.hermeneuticDriftCompensation]);
  const { now, solar, dark } = useSolarClock(t.autoTheme, t.manualDark);
  const data = window.CODEX_DATA;

  const [tab, setTab] = useState("trans");
  const [primary, setPrimary] = useState(t.primaryTranslation);
  const [compareSet, setCompareSet] = useState(() => {
    try {
      const raw = localStorage.getItem("codex.compareSet");
      if (raw) return JSON.parse(raw);
    } catch {}
    return ["web", "clementine"];
  });
  const [sideBySide, setSideBySide] = useState(!!t.sideBySide);
  const [redLetter, setRedLetter] = useState(!!t.redLetter);
  const [gnosisOn, setGnosisOn] = useState(false);
  const [currentVerse, _setCurrentVerse] = useState(() => {
    try {
      const raw = localStorage.getItem("codex.passageLoc");
      if (raw) return JSON.parse(raw).verse || 1;
    } catch {}
    return 1;
  });
  // Persist every cursor change so reopening the tab restores the exact verse.
  const setCurrentVerse = useCallback((n) => {
    _setCurrentVerse(n);
    setPassageLoc(p => ({ ...p, verse: n }));
  }, []);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [panelData, setPanelData] = useState(null);
  const [panelStatus, setPanelStatus] = useState({ loading: false, error: null });
  // Meta about the current chapter's panels — surfaces to the user as a
  // "CACHED · Nd ago" badge so they can SEE that revisits never re-pull.
  const [panelMeta, setPanelMeta] = useState({ fromCache: false, fetchedAt: 0 });

  // ── dynamic passage state ─────────────────────────────────────────────
  // passageLoc now persists the verse cursor too so a relaunch lands you
  // exactly where you left off — same chapter, same scroll target.
  const [passageLoc, setPassageLoc] = useState(() => {
    try {
      const raw = localStorage.getItem("codex.passageLoc");
      if (raw) {
        const parsed = JSON.parse(raw);
        return { verse: 1, ...parsed };
      }
    } catch {}
    return { ...data.defaultPassage, verse: 1 };
  });
  const [passage, setPassage] = useState({
    bookId: passageLoc.bookId,
    chapter: passageLoc.chapter,
    book: data.books.find(b => b.id === passageLoc.bookId)?.name || "?",
    title: "",
    subtitle: "",
    verses: [],
    loading: true,
    error: null,
  });

  const loadPanelData = useCallback(async (bookId, chapter, bookName) => {
    const seed = data.seedPanels[`${bookId}.${chapter}`];
    if (seed) {
      setPanelData(seed);
      setPanelStatus({ loading: false, error: null });
      setPanelMeta({ fromCache: true, fetchedAt: 0, seed: true });
      return;
    }
    const cached = window.CODEX_PANELS.getCached(bookId, chapter);
    if (cached) {
      const meta = window.CODEX_PANELS.getCachedMeta(bookId, chapter);
      setPanelData(cached);
      setPanelStatus({ loading: false, error: null });
      setPanelMeta({ fromCache: true, fetchedAt: meta?.fetchedAt || 0 });
      return;
    }
    setPanelData(null);
    setPanelStatus({ loading: true, error: null });
    setPanelMeta({ fromCache: false, fetchedAt: 0 });
    try {
      const generated = await window.CODEX_PANELS.load(bookId, chapter, bookName);
      setPanelData(generated);
      setPanelStatus({ loading: false, error: null });
      setPanelMeta({ fromCache: false, fetchedAt: Date.now(), fresh: true });
    } catch (e) {
      setPanelStatus({ loading: false, error: String(e.message || e) });
    }
  }, []);

  const regeneratePanels = useCallback(async () => {
    window.CODEX_PANELS.purge(passage.bookId, passage.chapter);
    setPanelData(null);
    setPanelStatus({ loading: true, error: null });
    setPanelMeta({ fromCache: false, fetchedAt: 0 });
    try {
      const generated = await window.CODEX_PANELS.load(passage.bookId, passage.chapter, passage.book, { force: true });
      setPanelData(generated);
      setPanelStatus({ loading: false, error: null });
      setPanelMeta({ fromCache: false, fetchedAt: Date.now(), fresh: true });
    } catch (e) {
      setPanelStatus({ loading: false, error: String(e.message || e) });
    }
  }, [passage.bookId, passage.chapter, passage.book]);

  const loadPassage = useCallback(async (bookId, chapter, verse = 1) => {
    const book = data.books.find(b => b.id === bookId);
    if (!book) return;
    const chap = Math.max(1, Math.min(chapter, book.chapters));
    setPassageLoc({ bookId, chapter: chap, verse });
    _setCurrentVerse(verse);
    setPassage(p => ({
      ...p,
      bookId, chapter: chap, book: book.name,
      verses: [], loading: true, error: null,
    }));
    loadPanelData(bookId, chap, book.name);
    try {
      const trs = Array.from(new Set([primary, ...compareSet]));
      const verses = await window.BIBLE.loadMulti(bookId, chap, trs);
      const seed = data.seedPanels[`${bookId}.${chap}`];
      const cachedPanel = window.CODEX_PANELS.getCached(bookId, chap);
      const panel = seed || cachedPanel;
      setPassage({
        bookId, chapter: chap, book: book.name,
        title: panel?.title || `${book.name} ${chap}`,
        subtitle: panel?.subtitle || "",
        verses, loading: false, error: null,
      });
    } catch (e) {
      setPassage(p => ({ ...p, loading: false, error: String(e.message || e) }));
    }
  }, [primary, compareSet, loadPanelData]);

  // When the UI language changes, AI panels need to re-render in the
  // new language. cacheKey is language-suffixed so getCached() returns
  // null for the new lang (or the previously-cached translation if it
  // exists). Re-invoking loadPanelData picks up that lookup.
  useEffect(() => {
    const onLang = () => {
      if (passage.bookId && passage.chapter) {
        loadPanelData(passage.bookId, passage.chapter, passage.book);
      }
    };
    window.addEventListener("codex:lang", onLang);
    return () => window.removeEventListener("codex:lang", onLang);
  }, [passage.bookId, passage.chapter, passage.book, loadPanelData]);

  // Update passage title once panels finish generating, so the header reflects the AI title.
  useEffect(() => {
    if (panelData && (!passage.title || passage.title === `${passage.book} ${passage.chapter}`)) {
      setPassage(p => ({ ...p, title: panelData.title || p.title, subtitle: panelData.subtitle || p.subtitle }));
    }
    // eslint-disable-next-line
  }, [panelData]);

  // Initial load + reload when translation set changes (so all panes have data).
  // Pass the persisted verse so the cursor lands where the user left off.
  useEffect(() => {
    loadPassage(passageLoc.bookId, passageLoc.chapter, passageLoc.verse || currentVerse || 1);
    // eslint-disable-next-line
  }, [primary, JSON.stringify(compareSet)]);

  useEffect(() => { try { localStorage.setItem("codex.passageLoc", JSON.stringify(passageLoc)); } catch {} }, [passageLoc]);

  // Personal-bible MARKS — unified concept: a mark IS a highlight. One list,
  // one schema, one mental model.
  //   { "jhn.1.14": { color: "amber", ts: 1715500000000, note: "And the Word…" } }
  // Persists in localStorage. Old string-only entries auto-migrate on load.
  const [highlights, setHighlights] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("codex.highlights.v1") || "{}");
      const migrated = {};
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v === "string") migrated[k] = { color: v, ts: Date.now(), note: "" };
        else migrated[k] = v;
      }
      return migrated;
    } catch { return {}; }
  });
  useEffect(() => { try { localStorage.setItem("codex.highlights.v1", JSON.stringify(highlights)); } catch {} }, [highlights]);

  const toggleHighlight = useCallback((bookId, chapter, n, color, verseText) => {
    const key = `${bookId}.${chapter}.${n}`;
    const c = color || t.highlightColor || "amber";
    setHighlights(h => {
      const next = { ...h };
      const cur = next[key];
      if (cur && cur.color === c) {
        delete next[key];                         // same colour → toggle off
      } else {
        next[key] = {
          color: c,
          ts: Date.now(),
          note: cur?.note || (verseText
            ? verseText.replace(/\s+/g, " ").trim().split(" ").slice(0, 7).join(" ") + "…"
            : ""),
        };
      }
      return next;
    });
  }, [t.highlightColor]);

  const clearHighlight = useCallback((bookId, chapter, n) => {
    const key = `${bookId}.${chapter}.${n}`;
    setHighlights(h => { const next = { ...h }; delete next[key]; return next; });
  }, []);

  // Pinned-marks set, persisted separately from the highlight cache so we
  // don't have to migrate the existing schema.
  const PINS_KEY = "codex.marks.pinned.v1";
  const [pinnedSet, setPinnedSet] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(PINS_KEY) || "[]")); }
    catch { return new Set(); }
  });
  const togglePinMark = useCallback((mark) => {
    setPinnedSet(prev => {
      const next = new Set(prev);
      if (next.has(mark.key)) next.delete(mark.key); else next.add(mark.key);
      try { localStorage.setItem(PINS_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  // Derived: marks list for the MARKS tab — pinned bubble to the top
  // (newest-pinned-first), then unpinned newest-first.
  const marks = useMemo(() => {
    return Object.entries(highlights)
      .map(([key, v]) => {
        const [bookId, ch, n] = key.split(".");
        const book = data.books.find(b => b.id === bookId);
        return {
          key,
          bookId,
          chapter: parseInt(ch, 10),
          verse: parseInt(n, 10),
          color: v.color || "amber",
          ts: v.ts || 0,
          note: v.note || "",
          ref: book ? `${book.name} ${ch}:${n}` : `${bookId} ${ch}:${n}`,
          pinned: pinnedSet.has(key),
        };
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.ts - a.ts;
      });
  }, [highlights, data.books, pinnedSet]);

  // Floating verse menu state — opened from Reader (right-click / ⋯ button).
  const [verseMenu, setVerseMenu] = useState(null); // { verse, anchor }
  const openVerseMenu = useCallback((v, anchor) => setVerseMenu({ verse: v, anchor }), []);
  const closeVerseMenu = useCallback(() => setVerseMenu(null), []);

  // Verse-map modal state — opened from VerseMenu (MAP item).
  const [verseMap, setVerseMap] = useState(null); // { verse, refStr, text }
  const openVerseMap = useCallback((v, refStr, text) => setVerseMap({ verse: v, refStr, text }), []);
  const closeVerseMap = useCallback(() => setVerseMap(null), []);

  // Art + Compare modals — same pattern as map.
  const [verseArt, setVerseArt] = useState(null);
  const openVerseArt = useCallback((v, refStr, text) => setVerseArt({ verse: v, refStr, text }), []);
  const closeVerseArt = useCallback(() => setVerseArt(null), []);

  const [verseCompare, setVerseCompare] = useState(null);
  const openVerseCompare = useCallback((v, refStr) => setVerseCompare({ verse: v, refStr }), []);
  const closeVerseCompare = useCallback(() => setVerseCompare(null), []);

  const [verseMirror, setVerseMirror] = useState(null);
  const openVerseMirror = useCallback((v, refStr, text) => setVerseMirror({ verse: v, refStr, text }), []);
  const closeVerseMirror = useCallback(() => setVerseMirror(null), []);

  // ── PWA install — capture the browser's deferred install prompt so the
  // settings button can fire the native dialog with one tap. Falls back to
  // platform-specific guidance on iOS (where no event is fired). The whole
  // app shell + Bible cache + settings then live offline forever.
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(() =>
    window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true
  );
  const isIOS = useMemo(() => /iPhone|iPad|iPod/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent), []);
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setInstallPrompt(e); };
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  const triggerInstall = useCallback(async () => {
    if (installed) return;
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setInstallPrompt(null);
      return;
    }
    if (isIOS) {
      window.alert("To install CODEX on iPhone or iPad:\n\n1. Tap the Share button (the square with an upward arrow)\n2. Scroll down and tap “Add to Home Screen”\n3. Tap Add\n\nCODEX will appear on your home screen and run full-screen, fully offline.");
      return;
    }
    window.alert("Your browser hasn't offered an install prompt yet — try refreshing once or twice. CODEX is fully installable in Chrome, Edge, Brave, Arc, Safari (iOS), and Samsung Internet.");
  }, [installed, installPrompt, isIOS]);

  // ── Export / import — open-format snapshot of every codex.* localStorage
  // key plus a small header. Lets users migrate marks, oracle history, cached
  // chapters, panels, settings to another browser, device, or compatible app.
  // No proprietary fields — everything is plain JSON the user can inspect.
  const exportAll = useCallback(() => {
    const dataMap = {};
    let marksCount = 0, panelsCount = 0, biblesCount = 0;
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith("codex.")) continue;
      const raw = localStorage.getItem(k);
      try { dataMap[k] = JSON.parse(raw); }
      catch { dataMap[k] = raw; }
      if (k === "codex.highlights.v1" && dataMap[k] && typeof dataMap[k] === "object") marksCount = Object.keys(dataMap[k]).length;
      if (k.startsWith("codex.panels.v1.")) panelsCount++;
      if (k.startsWith("codex.bible.")) biblesCount++;
    }
    const payload = {
      format: "codex.export",
      version: 1,
      app: "CODEX Bible Study",
      exportedAt: new Date().toISOString(),
      summary: { marks: marksCount, panels: panelsCount, bibleCacheBuckets: biblesCount, keys: Object.keys(dataMap).length },
      data: dataMap,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href     = url;
    a.download = `codex-export-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, []);

  const importPick = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const text = await f.text();
        const obj  = JSON.parse(text);
        if (obj.format !== "codex.export" || !obj.data || typeof obj.data !== "object") {
          window.alert("This isn't a CODEX export file (missing format/data).");
          return;
        }
        const incoming = Object.keys(obj.data).filter(k => k.startsWith("codex."));
        if (!incoming.length) { window.alert("Export contains no codex.* data."); return; }
        const summary = obj.summary
          ? `Marks: ${obj.summary.marks ?? "?"}\nPanels: ${obj.summary.panels ?? "?"}\nKeys: ${obj.summary.keys ?? incoming.length}`
          : `Keys: ${incoming.length}`;
        if (!window.confirm(`Import will REPLACE all current CODEX data:\n\n${summary}\n\nFrom: ${obj.exportedAt || "(unknown date)"}\n\nContinue?`)) return;
        for (const k of Object.keys(localStorage)) {
          if (k.startsWith("codex.")) localStorage.removeItem(k);
        }
        for (const k of incoming) {
          const v = obj.data[k];
          localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
        }
        window.location.reload();
      } catch (e) {
        window.alert("Import failed: " + (e.message || e));
      }
    };
    input.click();
  }, []);

  // Distraction-free: hide both rails on desktop. Toggle with the ⊟ button or ESC twice.
  const [distractionFree, setDistractionFree] = useState(!!t.distractionFree);
  useEffect(() => { setDistractionFree(!!t.distractionFree); }, [t.distractionFree]);
  const toggleDistractionFree = useCallback(() => {
    const v = !distractionFree;
    setDistractionFree(v);
    setTweak("distractionFree", v);
  }, [distractionFree]);

  // Per-rail fold state — desktop only. Persists so the layout reopens the
  // way you left it. Mobile rails still slide via leftOpen / rightOpen.
  const [leftCollapsed, setLeftCollapsed] = useState(() => {
    try { return localStorage.getItem("codex.ui.leftCollapsed") === "1"; } catch { return false; }
  });
  const [rightCollapsed, setRightCollapsed] = useState(() => {
    try { return localStorage.getItem("codex.ui.rightCollapsed") === "1"; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem("codex.ui.leftCollapsed", leftCollapsed ? "1" : "0"); } catch {} }, [leftCollapsed]);
  useEffect(() => { try { localStorage.setItem("codex.ui.rightCollapsed", rightCollapsed ? "1" : "0"); } catch {} }, [rightCollapsed]);

  // ── Caffeinate · Screen Wake Lock ──────────────────────────────────
  // Holds a Screen Wake Lock so phone/tablet/laptop screens stay awake
  // while reading. Released the moment the user toggles it off, switches
  // tabs (auto-released by browser), or the app is hidden — re-acquired on
  // visibility return so a glance away doesn't permanently lose the lock.
  const wakeLockRef = useRef(null);
  const acquireLock = useCallback(async () => {
    if (!("wakeLock" in navigator) || wakeLockRef.current) return;
    try {
      const lock = await navigator.wakeLock.request("screen");
      lock.addEventListener("release", () => { wakeLockRef.current = null; });
      wakeLockRef.current = lock;
    } catch (e) { /* user gesture missing or browser unsupported — ignore */ }
  }, []);
  const releaseLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release(); } catch {}
      wakeLockRef.current = null;
    }
  }, []);
  useEffect(() => {
    if (t.caffeinate) acquireLock(); else releaseLock();
    return () => { releaseLock(); };
    // eslint-disable-next-line
  }, [t.caffeinate]);
  // Re-acquire on tab return (browsers auto-release on visibilitychange)
  useEffect(() => {
    const onVis = () => {
      if (t.caffeinate && document.visibilityState === "visible") acquireLock();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line
  }, [t.caffeinate]);

  // Theater mode: YouTube-style focus. Hides rails AND status/footer chrome,
  // centers the reader. ESC exits. Press F or click the focus button to enter.
  // Not persisted — it's a per-session reading state, not a setting.
  const [theater, setTheater] = useState(false);
  const toggleTheater = useCallback(() => setTheater(t => !t), []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && theater) setTheater(false);
      else if (e.key === "f" && !e.metaKey && !e.ctrlKey && !e.altKey
               && !["INPUT","TEXTAREA"].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        setTheater(v => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [theater]);

  useEffect(() => { setPrimary(t.primaryTranslation); }, [t.primaryTranslation]);
  useEffect(() => { setSideBySide(!!t.sideBySide); }, [t.sideBySide]);
  useEffect(() => { setRedLetter(!!t.redLetter); }, [t.redLetter]);
  useEffect(() => { try { localStorage.setItem("codex.compareSet", JSON.stringify(compareSet)); } catch {} }, [compareSet]);

  const onToggleCompare = useCallback((id) => {
    setCompareSet(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const jumpToRef = useCallback((refStr) => {
    const loc = parseRef(refStr, data.books);
    if (loc) loadPassage(loc.bookId, loc.chapter, loc.verse);
    setLeftOpen(false);
  }, [data.books, loadPassage]);

  // Expose jumpToRef globally so external modules (side quests etc.)
  // can pivot the reader to a passage by reference string.
  useEffect(() => { window.codexJumpToRef = jumpToRef; }, [jumpToRef]);

  const onSelectMark = useCallback((m) => {
    loadPassage(m.bookId, m.chapter, m.verse);
    setLeftOpen(false);
  }, [loadPassage]);

  const onClearMark = useCallback((m) => {
    clearHighlight(m.bookId, m.chapter, m.verse);
  }, [clearHighlight]);

  const onMarkCurrent = useCallback(() => {
    const v = passage.verses.find(x => x.n === currentVerse) || passage.verses[0];
    if (!v) return;
    const text = v[primary] || v.kjv || v.web || Object.values(v).find(x => typeof x === "string") || "";
    toggleHighlight(passage.bookId, passage.chapter, v.n, null, text);
  }, [passage, currentVerse, primary, toggleHighlight]);

  const setPrimaryAndPersist = (id) => {
    setPrimary(id);
    setTweak("primaryTranslation", id);
  };

  const accent = ACCENT_MAP[t.accent] || ACCENT_MAP.cyan;
  // Drift mode hijacks the accent for the matrix-green Easter-egg theme.
  const driftAccent = { dark: "#39ff7a", light: "#0c5a30", glow: "rgba(57, 255, 122, 0.45)" };
  const useAccent = t.hermeneuticDriftCompensation ? driftAccent : accent;
  const themeStyle = {
    "--cx-accent": dark ? useAccent.dark : useAccent.light,
    "--cx-accent-glow": useAccent.glow,
    "--cx-oracle-fs": `${t.oracleFontScale || 14}px`,
  };

  return (
    <div
      className={`cx-app ${dark ? "is-dark" : "is-light"} ${t.scanlines ? "has-scan" : ""} font-${t.scriptureFont} ${leftOpen ? "left-open" : ""} ${rightOpen ? "right-open" : ""} ${distractionFree ? "is-distraction-free" : ""} ${theater ? "is-theater" : ""} ${leftCollapsed ? "is-l-collapsed" : ""} ${rightCollapsed ? "is-r-collapsed" : ""} ${t.hermeneuticDriftCompensation ? "is-drift" : ""}`}
      style={themeStyle}
    >
      <div
        className="cx-rail-scrim"
        onClick={() => { setLeftOpen(false); setRightOpen(false); }}
        aria-hidden
      />
      <StatusBar
        now={now} solar={solar} dark={dark}
        autoTheme={t.autoTheme}
        onToggleTheme={() => {
          if (t.autoTheme) setTweak("autoTheme", false);
          setTweak("manualDark", !dark);
        }}
        onToggleAuto={() => setTweak("autoTheme", !t.autoTheme)}
        bookmarkCount={marks.length}
        gnosisOn={gnosisOn}
        onToggleLeft={() => setLeftOpen(o => !o)}
        onToggleRight={() => setRightOpen(o => !o)}
        primary={primary}
        onSelectPrimary={setPrimaryAndPersist}
      />

      <div className="cx-grid">
        {leftCollapsed ? (
          <button
            className="cx-rail-spine cx-rail-spine-l"
            onClick={() => setLeftCollapsed(false)}
            title="Show library + oracle + marks"
            aria-label="Expand left rail"
          >
            <span className="cx-rail-spine-glyph">≣</span>
            <span className="cx-rail-spine-arr">▶</span>
          </button>
        ) : null}

        <LeftRail
          isCollapsed={leftCollapsed}
          onCollapse={() => setLeftCollapsed(true)}
          activeBookId={passage.bookId}
          activeChapter={passage.chapter}
          marks={marks}
          highlightColors={HIGHLIGHT_COLORS}
          onSelectMark={onSelectMark}
          onClearMark={onClearMark}
          onTogglePinMark={togglePinMark}
          onMarkCurrent={onMarkCurrent}
          onSelectChapter={(bookId, ch) => { loadPassage(bookId, ch, 1); setLeftOpen(false); }}
          currentRef={`${passage.book} ${passage.chapter}:${currentVerse}`}
          onClose={() => setLeftOpen(false)}
          oracleProps={{
            passage, currentVerse, primary, gnosisOn,
            driftMode: !!t.hermeneuticDriftCompensation,
            onAddBookmark: ({ ref }) => jumpToRef(ref),  // legacy hook → just jump
            onJumpTo: ({ ref }) => jumpToRef(ref),
          }}
        />

        <Reader
          passage={passage}
          primary={primary}
          compareTranslations={compareSet}
          sideBySide={sideBySide}
          onToggleSideBySide={() => { const v = !sideBySide; setSideBySide(v); setTweak("sideBySide", v); }}
          gnosisOn={gnosisOn}
          redLetter={redLetter}
          onToggleRedLetter={() => { const v = !redLetter; setRedLetter(v); setTweak("redLetter", v); }}
          fontScale={t.fontScale}
          onCycleFontSize={() => {
            const sizes = [16, 19, 22, 26, 30];
            const idx = sizes.indexOf(t.fontScale);
            const next = sizes[(idx + 1) % sizes.length] || 22;
            setTweak("fontScale", next);
          }}
          highlightedVerse={currentVerse}
          onSelectVerse={(n) => setCurrentVerse(n)}
          onSelectPrimary={setPrimaryAndPersist}
          yhwhMode={!!t.yhwhMode}
          onToggleYHWH={() => setTweak("yhwhMode", !t.yhwhMode)}
          highlights={highlights}
          highlightColor={t.highlightColor}
          onToggleHighlight={(n, color) => {
            const v = passage.verses.find(x => x.n === n);
            const text = v ? (v[primary] || v.kjv || v.web || "") : "";
            toggleHighlight(passage.bookId, passage.chapter, n, color, text);
          }}
          onOpenVerseMenu={openVerseMenu}
          panelData={panelData}
          onPrevChapter={() => {
            const book = data.books.find(b => b.id === passage.bookId);
            if (passage.chapter > 1) loadPassage(passage.bookId, passage.chapter - 1, 1);
            else {
              const idx = data.books.findIndex(b => b.id === passage.bookId);
              if (idx > 0) loadPassage(data.books[idx-1].id, data.books[idx-1].chapters, 1);
            }
          }}
          onNextChapter={() => {
            const book = data.books.find(b => b.id === passage.bookId);
            if (passage.chapter < book.chapters) loadPassage(passage.bookId, passage.chapter + 1, 1);
            else {
              const idx = data.books.findIndex(b => b.id === passage.bookId);
              if (idx < data.books.length - 1) loadPassage(data.books[idx+1].id, 1, 1);
            }
          }}
        />

        <RightRail
          isCollapsed={rightCollapsed}
          onCollapse={() => setRightCollapsed(true)}
          tab={tab}
          onTab={setTab}
          gnosisOn={gnosisOn}
          onToggleGnosis={setGnosisOn}
          primary={primary}
          onPrimary={setPrimaryAndPersist}
          compareSet={compareSet}
          onToggleCompare={onToggleCompare}
          passage={passage}
          currentVerse={currentVerse}
          panelData={panelData}
          panelStatus={panelStatus}
          panelMeta={panelMeta}
          onRegeneratePanels={regeneratePanels}
          onClose={() => setRightOpen(false)}
          onJumpRef={jumpToRef}
        />

        {rightCollapsed ? (
          <button
            className="cx-rail-spine cx-rail-spine-r"
            onClick={() => setRightCollapsed(false)}
            title="Show translations + panels"
            aria-label="Expand right rail"
          >
            <span className="cx-rail-spine-arr">◀</span>
            <span className="cx-rail-spine-glyph">⋮</span>
          </button>
        ) : null}
      </div>

      <FooterBar
        currentVerse={currentVerse}
        passage={passage}
        gnosisOn={gnosisOn}
        onToggleGnosis={setGnosisOn}
        compareCount={compareSet.length}
        onOpenLeft={() => setLeftOpen(true)}
        onOpenRight={() => setRightOpen(true)}
        distractionFree={distractionFree}
        onToggleDistractionFree={toggleDistractionFree}
        theater={theater}
        onToggleTheater={toggleTheater}
        leftCollapsed={leftCollapsed}
        onToggleLeftCollapsed={() => {
          setLeftOpen(false);          // close any mobile slide-out too
          setLeftCollapsed(v => !v);
        }}
        rightCollapsed={rightCollapsed}
        onToggleRightCollapsed={() => {
          setRightOpen(false);
          setRightCollapsed(v => !v);
        }}
      />

      {theater ? (
        <button className="cx-theater-exit" onClick={() => setTheater(false)} title="Exit focus (ESC)">
          ◐ EXIT FOCUS · ESC
        </button>
      ) : null}

      {verseMenu && window.VerseMenu ? (
        <VerseMenu
          anchor={verseMenu.anchor}
          verse={verseMenu.verse}
          passage={passage}
          primary={primary}
          translations={data.translations}
          sideBySide={sideBySide}
          gnosisOn={gnosisOn}
          highlightColor={t.highlightColor}
          highlightColors={HIGHLIGHT_COLORS}
          currentHighlight={highlights[`${passage.bookId}.${passage.chapter}.${verseMenu.verse?.n}`]?.color || null}
          onClose={closeVerseMenu}
          onCompare={(n) => {
            setCurrentVerse(n);
            if (!sideBySide) { setSideBySide(true); setTweak("sideBySide", true); }
          }}
          onSetPrimary={setPrimaryAndPersist}
          onAskOracle={(verse, refStr, text) => {
            setLeftOpen(true);
            window.dispatchEvent(new CustomEvent("oracle:prefill", { detail: { ref: refStr, text } }));
          }}
          onToggleGnosis={setGnosisOn}
          onToggleHighlight={(color) => {
            const v = verseMenu.verse;
            const text = v ? (v[primary] || v.kjv || v.web || "") : "";
            toggleHighlight(passage.bookId, passage.chapter, v.n, color, text);
          }}
          onClearHighlight={() => clearHighlight(passage.bookId, passage.chapter, verseMenu.verse.n)}
          onOpenMap={openVerseMap}
          onOpenArt={openVerseArt}
          onOpenCompare={openVerseCompare}
          onOpenMirror={openVerseMirror}
          onOpenNote={(v, refStr) => {
            // Pre-seed the draft in localStorage BEFORE the widget mounts so
            // its initial state already has the verse pinned. Bulletproof
            // against race conditions between enabling notes + the open
            // event reaching a not-yet-mounted listener.
            try {
              const cur = localStorage.getItem("codex.notes.draft") || "";
              const prefix = `[${refStr}] `;
              if (!cur.startsWith(prefix)) {
                localStorage.setItem("codex.notes.draft", prefix + cur);
              }
              localStorage.setItem("codex.notes.visible", "1");
            } catch {}
            if (!t.notesEnabled) setTweak("notesEnabled", true);
            // Also dispatch the event so already-mounted widgets pick up
            // the new ref immediately (without overwriting drafts).
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent("codex:notes:show", { detail: { ref: refStr } }));
            }, 60);
          }}
        />
      ) : null}

      {verseMap && window.VerseMap ? (
        <VerseMap
          verse={verseMap.verse}
          refStr={verseMap.refStr}
          verseText={verseMap.text}
          passage={passage}
          primary={primary}
          onClose={closeVerseMap}
        />
      ) : null}

      {verseArt && window.VerseArt ? (
        <VerseArt
          verse={verseArt.verse}
          refStr={verseArt.refStr}
          verseText={verseArt.text}
          passage={passage}
          primary={primary}
          onClose={closeVerseArt}
        />
      ) : null}

      {window.Notes && t.notesEnabled ? (
        <Notes
          passage={passage}
          currentVerse={currentVerse}
          onJumpTo={({ ref }) => jumpToRef(ref)}
          onDisable={() => setTweak("notesEnabled", false)}
        />
      ) : null}

      {verseCompare && window.VerseCompare ? (
        <VerseCompare
          verse={verseCompare.verse}
          refStr={verseCompare.refStr}
          passage={passage}
          primary={primary}
          onClose={closeVerseCompare}
        />
      ) : null}

      {verseMirror && window.VerseMirror ? (
        <VerseMirror
          verse={verseMirror.verse}
          refStr={verseMirror.refStr}
          verseText={verseMirror.text}
          passage={passage}
          primary={primary}
          onClose={closeVerseMirror}
          onJumpRef={jumpToRef}
        />
      ) : null}

      <ShortcutsHelp />

      {/* Settings panel — only controls that are NOT already reachable as
          prominent first-class buttons. Removed redundancies:
            · Manual dies/noct → DIES/NOCT button at top right
            · Auto-sync → AUTO button at top right
            · Primary translation → status-bar dropdown + Translations panel
            · Red-letter → RED-LETTER button in reader head
            · Side-by-side → SINGLE/SIDE × SIDE button in reader head
            · Body size → Aa cycle button in reader head
            · Distraction-free → ⊟ button in footer
            · Gnosis overlay → GNOSIS DORMANT/ENGAGED master ring in footer
       */}
      <TweaksPanel title={tt("settings")}>
        <TweakSection label={tt("language")} />
        <LangPicker value={t.lang || "en"} onChange={(v) => setTweak("lang", v)} />

        <TweakSection label="AI Engines" />
        <ApiKeysSection />

        <TweakSection label={tt("install")} />
        <button
          className={`cx-install-btn ${installed ? "is-installed" : ""}`}
          onClick={triggerInstall}
          disabled={installed}
          title={installed
            ? "CODEX is installed and runs fully offline."
            : isIOS
              ? "Tap to see iPhone / iPad install steps."
              : "Install CODEX as a real app — works offline, lives on your dock."}
        >
          {installed
            ? <><span className="cx-install-glyph">✓</span><span><b>{(window.t?.("installed")) || "INSTALLED"}</b><i>{(window.t?.("installed.sub")) || "running as a standalone app · offline-ready"}</i></span></>
            : <><span className="cx-install-glyph">⤓</span><span><b>{(window.t?.("install.codex")) || "INSTALL CODEX"}</b><i>{isIOS ? ((window.t?.("install.ios.sub")) || "tap for iPhone / iPad steps") : ((window.t?.("install.sub")) || "one tap · offline · home-screen icon")}</i></span></>}
        </button>

        <TweakSection label={(window.t?.("look")) || "Look"} />
        <TweakColor label={tt("look.accent")}
          value={ACCENT_MAP[t.accent].dark}
          options={Object.values(ACCENT_MAP).map(a => a.dark)}
          onChange={(v) => {
            const key = Object.keys(ACCENT_MAP).find(k => ACCENT_MAP[k].dark === v) || "cyan";
            setTweak("accent", key);
          }} />
        <TweakToggle label={tt("look.scanlines")} value={t.scanlines}
          onChange={(v) => setTweak("scanlines", v)} />
        {/* Scripture face moved to the reader-head View popover (Aa). */}

        <TweakSection label={tt("marks")} />
        <TweakColor label={tt("marks.color")}
          value={HIGHLIGHT_COLORS[t.highlightColor]?.swatch || HIGHLIGHT_COLORS.amber.swatch}
          options={Object.values(HIGHLIGHT_COLORS).map(c => c.swatch)}
          onChange={(v) => {
            const key = Object.keys(HIGHLIGHT_COLORS).find(k => HIGHLIGHT_COLORS[k].swatch === v) || "amber";
            setTweak("highlightColor", key);
          }} />
        <button
          className="cx-mini-btn"
          style={{ marginTop: 6 }}
          onClick={() => {
            if (marks.length === 0) return;
            const msg = (tt("marks.clear.confirm") || "Clear all {n} marks?").replace("{n}", marks.length);
            if (window.confirm(msg)) setHighlights({});
          }}
        >{tt("marks.clear")} ({marks.length})</button>

        <TweakSection label={tt("reading")} />
        <TweakToggle label={tt("reading.caffeinate")} value={!!t.caffeinate}
          onChange={(v) => setTweak("caffeinate", v)} />
        <TweakToggle label={tt("reading.notes")} value={!!t.notesEnabled}
          onChange={(v) => setTweak("notesEnabled", v)} />
        <TweakSlider label={tt("reading.oracle.fs")} value={t.oracleFontScale || 14}
          min={11} max={20} unit="px"
          onChange={(v) => setTweak("oracleFontScale", v)} />
        {!("wakeLock" in navigator) ? (
          <p className="cx-export-hint" style={{ marginTop: -2 }}>
            {tt("reading.caffeinate.unsupported")}
          </p>
        ) : null}

        <TweakSection label={tt("data.portable")} />
        <div className="cx-export-row">
          <button className="cx-mini-btn" onClick={exportAll} title="Download every mark, cached chapter, panel, and setting as one JSON file">
            {tt("data.export")}
          </button>
          <button className="cx-mini-btn" onClick={importPick} title="Restore from a CODEX export file">
            {tt("data.import")}
          </button>
        </div>
        <p className="cx-export-hint">{tt("data.hint")}</p>

        <TweakSection label={tt("cache")} />
        <OfflineStatus bookLookup={data.books} />
        <CachedPanelsBrowser onJump={jumpToRef} bookLookup={data.books} />
        <button
          className="cx-mini-btn"
          onClick={async () => {
            if (!window.confirm("Clear all cached chapters and panels? Your marks and settings stay.")) return;
            for (const k of Object.keys(localStorage)) {
              if (/^codex\.(bible|panels|redletter)\./i.test(k)) localStorage.removeItem(k);
            }
            if (window.caches) {
              for (const n of await caches.keys()) await caches.delete(n);
            }
            window.location.reload();
          }}
        >{tt("cache.clear")}</button>

        <TweakSection label="Offline · Bibles" />
        <OfflineBiblesPanel bookLookup={data.books} />

        {/* Innocuous label, max-camouflage. Flips Oracle into conspiracy
            mode for users who go looking. Stored as a tweak so it persists. */}
        <TweakSection label="Advanced inference" />
        <TweakToggle
          label="Hermeneutic drift compensation"
          value={!!t.hermeneuticDriftCompensation}
          onChange={(v) => setTweak("hermeneuticDriftCompensation", v)}
        />
        <p className="cx-export-hint" style={{ marginTop: -2, opacity: 0.55 }}>
          Cross-corpus inferential broadening. Experimental.
        </p>

        <TweakSection label="First impression" />
        <TweakToggle
          label="Boot intro sequence"
          value={!!t.bootIntro}
          onChange={(v) => {
            setTweak("bootIntro", v);
            try { localStorage.setItem("codex.bootIntro", v ? "1" : "0"); } catch {}
          }}
        />
        <p className="cx-export-hint" style={{ marginTop: -2, opacity: 0.55 }}>
          Terminal-style cold boot on launch. Off = jump straight to scripture.
        </p>

        {/* Reset to factory defaults · scoped to user preferences + API
            keys. Leaves cached scripture, panels, marks, and saved
            conversations alone (those have their own clear actions
            above). Asks twice because it's irreversible. */}
        <TweakSection label="Danger zone" />
        <button
          className="cx-mini-btn cx-reset-btn"
          onClick={() => {
            if (!window.confirm("Reset all settings to factory defaults?\n\nThis clears: theme, accent, font size, language, API keys, drift mode, and every UI tweak.\n\nKeeps: your marks, notes, cached scripture, panels, conversations.")) return;
            try {
              localStorage.removeItem("codex.tweaks.v1");
              localStorage.removeItem("codex.api.keys.v1");
              localStorage.removeItem("codex.lrail.width");
              localStorage.removeItem("codex.rrail.width");
              localStorage.removeItem("codex.tp.lang.order.v1");
              localStorage.removeItem("codex.tp.lang.collapsed.v1");
              localStorage.removeItem("codex.tp.trans.order.v1");
              localStorage.removeItem("codex.oracle.quickHidden");
            } catch {}
            window.location.reload();
          }}
          title="Wipe every preference and reload — leaves your marks, notes, and cached scripture untouched."
        >↺ RESET FACTORY SETTINGS</button>
        <p className="cx-export-hint" style={{ marginTop: -2 }}>
          Wipes settings + API keys only. Your marks, notes, and cached
          scripture survive. (Use the cache button above for those.)
        </p>
      </TweaksPanel>
    </div>
  );
}

// Offline-status indicator — top-of-cache section. Tells the user at a
// glance whether the app can survive without network: SW installed +
// scripture chapters cached + panels cached. Critical reassurance for
// readers using CODEX in places where connectivity is dangerous or rare.
// ── Offline-bibles catalog · per-translation status, verify, repair ────
// Lists every translation that has at least one chapter cached. For each,
// shows the cached/total counts and offers "Test" (cache-only sanity scan
// + tries to read a sample chapter without network) and "Repair" (re-fetch
// missing or corrupt chapters).
function OfflineBiblesPanel({ bookLookup }) {
  const [bumpKey, bump] = useState(0);
  const [busy, setBusy] = useState(null);   // translation id currently testing/repairing
  const [results, setResults] = useState({});
  const [diag, setDiag] = useState(null);
  const data = window.CODEX_DATA;
  const bumpNow = () => bump(n => n + 1);

  // BIBLE.ready resolves after IDB warm-load + LS migration. Bump so the
  // memoised translations list re-derives with cached counts now visible.
  useEffect(() => {
    const onReady = () => { bumpNow(); refreshDiag(); };
    window.addEventListener("codex:bible:ready", onReady);
    if (window.BIBLE?.ready) window.BIBLE.ready.then(onReady);
    return () => window.removeEventListener("codex:bible:ready", onReady);
  }, []);
  const refreshDiag = async () => {
    if (!window.BIBLE?.storage?.diagnose) return;
    try { setDiag(await window.BIBLE.storage.diagnose()); } catch {}
  };
  useEffect(() => { refreshDiag(); }, [bumpKey]);

  // Translations with any cache at all. Re-derived on every bump so
  // remove/repair actually shrink the list immediately.
  const translations = useMemo(() => {
    if (!window.BIBLE?.cacheStats) return [];
    return data.translations
      .map(t => ({ t, stats: window.BIBLE.cacheStats(t.id, bookLookup) }))
      .filter(({ stats }) => stats.cached > 0);
  }, [data.translations, bookLookup, bumpKey]);

  const test = async (t) => {
    setBusy(t.id);
    setResults(r => ({ ...r, [t.id]: { phase: "scanning…" } }));
    const v = window.BIBLE.verifyTranslation(t.id, bookLookup);
    // Thorough offline-read smoke test: pick UP TO 5 random cached
    // chapters, simulate offline by stubbing fetch, ensure each loads
    // cleanly. After Phase A the source of truth is IDB (mirrored to
    // _memCache), not localStorage — so we sweep the bookLookup for any
    // cached entry rather than reading the stale legacy LS blob.
    const keys = [];
    for (const b of bookLookup) {
      for (let ch = 1; ch <= b.chapters; ch++) {
        if (window.BIBLE.readOffline(b.id, ch, t.id)) keys.push(`${b.id}.${ch}.${t.id}`);
      }
    }
    const picks = [];
    for (let i = 0; i < Math.min(5, keys.length); i++) {
      const idx = Math.floor(Math.random() * keys.length);
      picks.push(keys.splice(idx, 1)[0]);
    }
    const samples = [];
    const origFetch = window.fetch;
    window.fetch = () => Promise.reject(new Error("__OFFLINE_TEST__"));
    try {
      for (const k of picks) {
        const [bookId, ch] = k.split(".");
        try {
          const verses = await window.BIBLE.loadChapter(bookId, parseInt(ch, 10), t.id);
          const ok = Array.isArray(verses) && verses.length > 0
            && typeof verses[0]?.text === "string" && verses[0].text.length > 4;
          samples.push({ ref: `${bookId} ${ch}`, ok, count: verses?.length || 0 });
        } catch (e) {
          samples.push({ ref: `${bookId} ${ch}`, ok: false, err: String(e.message || e).slice(0, 40) });
        }
      }
    } finally {
      window.fetch = origFetch;
    }
    const allOk = samples.length > 0 && samples.every(s => s.ok);
    const smoke = {
      ok: allOk,
      sample: samples.length === 0
        ? "no chapters to test"
        : `${samples.filter(s => s.ok).length}/${samples.length} chapters read offline · ${samples.map(s => `${s.ref}${s.ok ? "✓" : "✗"}`).join(" ")}`,
    };
    setResults(r => ({ ...r, [t.id]: { ...v, smoke } }));
    setBusy(null);
  };

  const repair = (t) => {
    setBusy(t.id);
    setResults(r => ({ ...r, [t.id]: { ...(r[t.id] || {}), phase: `repairing 0…` } }));
    window.BIBLE.repairTranslation(t.id, bookLookup, (p) => {
      if (p.complete) {
        const cs = p.checksum;
        const phase = p.nothingToDo
          ? "nothing to repair"
          : cs?.passed
            ? `✓ checksum OK · ${cs.cached}/${cs.total} chapters · ${cs.totalVerses} verses`
            : `repair done · ${cs?.cached || "?"}/${cs?.total || "?"} cached · ${cs?.missing || 0} unrecoverable · ${cs?.corrupt || 0} corrupt`;
        setResults(r => ({ ...r, [t.id]: { ...(cs || {}), smoke: r[t.id]?.smoke, phase } }));
        setBusy(null);
        bumpNow();
        return;
      }
      if (p.aborted) { setBusy(null); bumpNow(); return; }
      // Update progress string depending on phase
      const msg = p.phase === "retry"
        ? `retrying stragglers ${p.retryDone || 0}/${p.retryTotal || 0}` + (p.error ? ` (failed ${p.book} ${p.chapter})` : "")
        : `repairing ${p.done}/${p.total}` + (p.error ? ` (skipped ${p.book} ${p.chapter})` : "");
      setResults(r => ({ ...r, [t.id]: { ...(r[t.id] || {}), phase: msg } }));
      if ((p.done || 0) % 25 === 0) bumpNow();
    });
  };

  const exportBundleFile = (t) => {
    const bundle = window.BIBLE.storage.exportBundle(t.id);
    const blob = new Blob([JSON.stringify(bundle)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t.id}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setResults(r => ({ ...r, [t.id]: { ...(r[t.id] || {}), phase: `exported ${bundle.chapterCount} chapters as ${t.id}.json — drop into /data/bibles/ to ship` } }));
  };

  const remove = (t) => {
    if (!window.confirm(`Remove the offline copy of ${t.name}? Chapters re-fetch as you read.`)) return;
    // Go through BIBLE.removeTranslation so the in-memory cache stays
    // consistent (direct localStorage writes were leaving _memCache stale).
    const removed = window.BIBLE.removeTranslation(t.id);
    setResults(r => { const x = { ...r }; delete x[t.id]; return x; });
    bumpNow();
    return removed;
  };

  if (translations.length === 0) {
    return (
      <p className="cx-export-hint" style={{ opacity: 0.6 }}>
        No bibles downloaded yet. Use the offline icon next to a translation
        in the Translations panel to save it for offline reading.
      </p>
    );
  }

  // ── Mass operations: TEST ALL / REPAIR ALL / CHECK UPDATES ───────────
  const [massBusy, setMassBusy] = useState(null);
  const [massStatus, setMassStatus] = useState("");
  const [updates, setUpdates] = useState(null);   // null | array of update entries
  const [updateChoices, setUpdateChoices] = useState({});

  const testAll = async () => {
    setMassBusy("test");
    let pass = 0, fail = 0;
    // Snapshot the list since cache mutations during the loop could
    // change `translations`. Read smoke result directly from the local
    // smoke variable rather than React state (closure was stale).
    const list = translations.slice();
    for (const { t } of list) {
      setMassStatus(`testing ${t.name}… (${pass + fail + 1}/${list.length})`);
      // Replicate test()'s smoke logic inline so we can read the result
      // synchronously without waiting for a React re-render.
      const v = window.BIBLE.verifyTranslation(t.id, bookLookup);
      const cache = JSON.parse(localStorage.getItem("codex.bible.cache.v2") || "{}");
      const allKeys = [];
      for (const b of bookLookup) for (let ch = 1; ch <= b.chapters; ch++)
        if (window.BIBLE.readOffline(b.id, ch, t.id)) allKeys.push({b: b.id, c: ch});
      const picks = []; const pool = allKeys.slice();
      for (let i = 0; i < Math.min(5, pool.length); i++) {
        const idx = Math.floor(Math.random() * pool.length);
        picks.push(pool.splice(idx, 1)[0]);
      }
      const samples = [];
      const orig = window.fetch;
      window.fetch = () => Promise.reject(new Error("__OFFLINE_TEST__"));
      try {
        for (const k of picks) {
          try {
            const verses = await window.BIBLE.loadChapter(k.b, k.c, t.id);
            const ok = Array.isArray(verses) && verses.length > 0 && typeof verses[0]?.text === "string" && verses[0].text.length > 4;
            samples.push({ ref: `${k.b} ${k.c}`, ok });
          } catch (e) {
            samples.push({ ref: `${k.b} ${k.c}`, ok: false });
          }
        }
      } finally { window.fetch = orig; }
      const allOk = samples.length > 0 && samples.every(s => s.ok);
      const smoke = { ok: allOk, sample: samples.length === 0 ? "no chapters to test" : `${samples.filter(s => s.ok).length}/${samples.length} read offline` };
      setResults(r => ({ ...r, [t.id]: { ...v, smoke } }));
      if (allOk) pass++; else fail++;
    }
    setMassStatus(`✓ TEST ALL complete · ${pass} ok · ${fail} with issues`);
    setMassBusy(null);
  };

  const repairAll = async () => {
    if (!window.confirm(`Repair every cached translation (${translations.length})? This may take many minutes.`)) return;
    setMassBusy("repair");
    let i = 0;
    for (const { t } of translations) {
      i++;
      setMassStatus(`repairing ${t.name} · ${i}/${translations.length}`);
      await new Promise(resolve => {
        window.BIBLE.repairTranslation(t.id, bookLookup, (p) => {
          if (p.complete || p.aborted) {
            const cs = p.checksum;
            setResults(r => ({ ...r, [t.id]: { ...(cs || {}), phase: cs?.passed ? `✓ ${cs.cached}/${cs.total} · ${cs.totalVerses} verses` : `done · ${cs?.cached}/${cs?.total}` } }));
            resolve();
          }
        });
      });
      bumpNow();
    }
    setMassStatus(`✓ REPAIR ALL complete`);
    setMassBusy(null);
  };

  const checkUpdates = async () => {
    setMassBusy("check");
    setMassStatus("checking…");
    try {
      const list = await window.BIBLE.storage.checkUpdates(window.CODEX_DATA.translations);
      setUpdates(list);
      const initial = {};
      for (const u of list) initial[u.id] = u.hasUpdate;   // pre-check the ones with updates
      setUpdateChoices(initial);
      const have = list.filter(u => u.hasUpdate).length;
      setMassStatus(have ? `${have} update${have>1?"s":""} available` : "all up-to-date");
    } catch (e) {
      setMassStatus("check failed: " + (e.message || e));
    }
    setMassBusy(null);
  };

  const applyUpdates = async () => {
    const targets = updates.filter(u => updateChoices[u.id]);
    if (!targets.length) return;
    setMassBusy("update");
    let i = 0;
    for (const u of targets) {
      i++;
      setMassStatus(`updating ${u.name} · ${i}/${targets.length}`);
      // Force re-fetch by removing then loading via repair (which fetches all missing)
      window.BIBLE.removeTranslation(u.id);
      await new Promise(r => setTimeout(r, 100));
      const t = window.CODEX_DATA.translations.find(x => x.id === u.id);
      await new Promise(resolve => {
        window.BIBLE.repairTranslation(u.id, bookLookup, (p) => { if (p.complete || p.aborted) resolve(); });
      });
    }
    setMassStatus(`✓ updated ${targets.length} translation${targets.length>1?"s":""}`);
    setUpdates(null);
    setMassBusy(null);
    bumpNow();
  };

  const onImportBundleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const r = await window.BIBLE.storage.importBundle(text);
      window.alert(`Imported ${r.imported} chapters of ${r.translation}.`);
      bumpNow();
      refreshDiag();
    } catch (err) {
      window.alert("Import failed: " + (err.message || err));
    }
    // reset input so the same file can be re-selected
    e.target.value = "";
  };

  return (
    <div className="cx-ob">
      {/* Mass-action toolbar */}
      <div className="cx-ob-toolbar">
        <button className="cx-mini-btn" disabled={!!massBusy || translations.length===0} onClick={checkUpdates}>
          {massBusy === "check" ? "…" : "↻ CHECK UPDATES"}
        </button>
        <button className="cx-mini-btn" disabled={!!massBusy || translations.length===0} onClick={testAll}>
          {massBusy === "test" ? "…" : "✓ TEST ALL"}
        </button>
        <button className="cx-mini-btn" disabled={!!massBusy || translations.length===0} onClick={repairAll}>
          {massBusy === "repair" ? "…" : "↺ REPAIR ALL"}
        </button>
      </div>
      {massStatus ? <p className="cx-ob-mass-status">{massStatus}</p> : null}

      {/* Updates modal — inline list with checkboxes */}
      {updates ? (
        <div className="cx-ob-updates">
          <header className="cx-ob-updates-h">
            <span>{updates.filter(u=>u.hasUpdate).length} update(s) available · pick which to apply</span>
            <button className="cx-mini-btn" onClick={() => setUpdates(null)}>✕</button>
          </header>
          <ul className="cx-ob-updates-list">
            {updates.length === 0 ? (
              <li className="cx-ob-empty">No cached translations to check.</li>
            ) : updates.map(u => {
              const ourDate = u.ourFetchedAt ? new Date(u.ourFetchedAt).toISOString().slice(0,10) : "—";
              const srcDate = u.sourceUpdatedAt ? new Date(u.sourceUpdatedAt).toISOString().slice(0,10) : "—";
              return (
                <li key={u.id} className={`cx-ob-update-row ${u.hasUpdate ? "is-stale" : ""}`}>
                  <label>
                    <input type="checkbox" checked={!!updateChoices[u.id]} disabled={!u.hasUpdate}
                           onChange={e => setUpdateChoices(c => ({ ...c, [u.id]: e.target.checked }))} />
                    <span className="cx-ob-update-name">{u.name}</span>
                    <span className="cx-ob-update-meta">
                      {u.hasUpdate
                        ? <em>↑ source {srcDate} · ours {ourDate} ({u.ageDays}d old)</em>
                        : u.source === "bible-api" ? <em>no version info from source</em> : <em>up-to-date · {ourDate}</em>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="cx-ob-updates-actions">
            <button className="cx-mini-btn" disabled={!!massBusy || !Object.values(updateChoices).some(Boolean)} onClick={applyUpdates}>
              {massBusy === "update" ? "UPDATING…" : `↓ APPLY ${Object.values(updateChoices).filter(Boolean).length}`}
            </button>
          </div>
        </div>
      ) : null}

      <div className="cx-ob-import">
        <label className="cx-mini-btn" title="Import a JSON bundle file (output of the BUNDLE button on any cached translation, or a hand-crafted bundle).">
          ⤒ IMPORT BUNDLE
          <input type="file" accept=".json,application/json" onChange={onImportBundleFile} style={{ display: "none" }} />
        </label>
        <span className="cx-export-hint" style={{ fontSize: 9.5, opacity: 0.55 }}>
          A bundle is a single .json file written by the BUNDLE button below — drop one in to import every chapter into the local cache instantly.
        </span>
      </div>
      {diag ? (
        <div className="cx-ob-diag" title={`Backend: ${diag.backend}`}>
          <span className="cx-ob-diag-l">
            <i className={`cx-ob-diag-dot ${diag.backend === "indexeddb" ? "is-ok" : "is-warn"}`} />
            {diag.backend === "indexeddb" ? "INDEXEDDB" : "FALLBACK · LOCAL"}
          </span>
          <span className="cx-ob-diag-r">
            {diag.chapterCount} chapters · {diag.approxMB} MB
            {diag.quotaMB ? ` / ${diag.quotaMB} MB quota` : ""}
          </span>
        </div>
      ) : null}
      {translations.map(({ t, stats }) => {
        const r = results[t.id];
        return (
          <div key={t.id} className={`cx-ob-row ${stats.fully ? "is-full" : "is-partial"}`}>
            <div className="cx-ob-head">
              <span className="cx-ob-glyph">{t.glyph}</span>
              <span className="cx-ob-name">{t.name}</span>
              <span className="cx-ob-count">{stats.cached}/{stats.total}{stats.fully ? " ✓" : ""}</span>
            </div>
            {r ? (
              <div className={`cx-ob-status ${r.ok ? "is-ok" : "is-warn"}`}>
                {r.phase ? <em>{r.phase}</em> : null}
                {r.summary ? <span>{r.summary}</span> : null}
                {r.smoke ? (
                  <small className={r.smoke.ok ? "is-ok" : "is-warn"}>
                    {r.smoke.ok ? "✓ offline read OK · " : "✗ offline read failed · "}
                    {r.smoke.sample}
                  </small>
                ) : null}
              </div>
            ) : null}
            <div className="cx-ob-actions">
              <button className="cx-mini-btn" disabled={busy === t.id} onClick={() => test(t)}>
                {busy === t.id && results[t.id]?.phase?.startsWith("scanning") ? "…" : "TEST"}
              </button>
              {(r && !r.ok && r.missing && (r.missing.length + (r.corrupt?.length || 0)) > 0) || !stats.fully ? (
                <button className="cx-mini-btn" disabled={busy === t.id} onClick={() => repair(t)}>
                  {busy === t.id ? "REPAIRING…" : `REPAIR ${stats.total - stats.cached || (r?.missing?.length || 0)}`}
                </button>
              ) : null}
              <button
                className="cx-mini-btn"
                disabled={busy === t.id || stats.cached === 0}
                onClick={() => exportBundleFile(t)}
                title="Download a pre-baked bundle of every cached chapter for this translation. Save the file at /data/bibles/<id>.json so the app loads it instantly on next install."
              >⤓ BUNDLE</button>
              <button className="cx-mini-btn cx-ob-rm" disabled={busy === t.id} onClick={() => remove(t)}>REMOVE</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OfflineStatus({ bookLookup }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 5000);
    return () => clearInterval(id);
  }, []);
  // tick is intentionally referenced so the lint-passing minified build
  // doesn't strip the interval — the data we read is mostly synchronous,
  // we just want to refresh the snapshot every few seconds.
  void tick;
  const swReady = !!navigator.serviceWorker?.controller;
  const bibleCache = (() => {
    try { return JSON.parse(localStorage.getItem("codex.bible.cache.v2") || "{}"); }
    catch { return {}; }
  })();
  const bibleCount = Object.keys(bibleCache).length;
  // Per-translation tally
  const transTally = {};
  for (const k of Object.keys(bibleCache)) {
    const tId = k.split(".").pop();
    transTally[tId] = (transTally[tId] || 0) + 1;
  }
  const fullyCached = window.BIBLE?.cacheStats
    ? window.CODEX_DATA.translations.filter(t => window.BIBLE.cacheStats(t.id, bookLookup).fully)
    : [];
  const panelChapters = (window.CODEX_PANELS?.cacheStats?.() || []).length;
  // Storage used (approx — sum of all codex.* keys)
  const usedBytes = Object.keys(localStorage)
    .filter(k => k.startsWith("codex."))
    .reduce((s, k) => s + (localStorage.getItem(k)?.length || 0), 0);
  const fmt = (b) => b < 1024 ? `${b}B` : b < 1024*1024 ? `${(b/1024).toFixed(0)}KB` : `${(b/1024/1024).toFixed(1)}MB`;

  return (
    <div className="cx-offline-status">
      <div className={`cx-offline-row ${swReady ? "is-ok" : "is-warn"}`}>
        <span className="cx-offline-dot" />
        <span className="cx-offline-lbl">SERVICE WORKER</span>
        <span className="cx-offline-val">{swReady ? "active · app shell offline" : "installing…"}</span>
      </div>
      <div className={`cx-offline-row ${bibleCount > 0 ? "is-ok" : "is-dim"}`}>
        <span className="cx-offline-dot" />
        <span className="cx-offline-lbl">BIBLE CHAPTERS</span>
        <span className="cx-offline-val">{bibleCount} cached across {Object.keys(transTally).length} translations</span>
      </div>
      {fullyCached.length > 0 ? (
        <div className="cx-offline-row is-ok">
          <span className="cx-offline-dot" />
          <span className="cx-offline-lbl">FULLY OFFLINE</span>
          <span className="cx-offline-val">{fullyCached.map(t => t.name).join(", ")}</span>
        </div>
      ) : null}
      <div className={`cx-offline-row ${panelChapters > 0 ? "is-ok" : "is-dim"}`}>
        <span className="cx-offline-dot" />
        <span className="cx-offline-lbl">PANELS (TALMUD / GNOSIS / …)</span>
        <span className="cx-offline-val">{panelChapters} chapter{panelChapters === 1 ? "" : "s"} cached</span>
      </div>
      <div className="cx-offline-row is-dim">
        <span className="cx-offline-dot" />
        <span className="cx-offline-lbl">STORAGE</span>
        <span className="cx-offline-val">{fmt(usedBytes)} used</span>
      </div>
    </div>
  );
}

// Cache browser — lists every chapter's panels (Talmud / Commentary /
// Gematria / Gnosis / Cross-refs) that's been generated and stored offline.
// Click any row to jump straight there. Confirms to the user that nothing
// is being re-pulled: chapters they've visited are listed here forever.
function CachedPanelsBrowser({ onJump, bookLookup }) {
  const [tick, setTick] = useState(0);
  const stats = useMemo(() => {
    if (!window.CODEX_PANELS?.cacheStats) return [];
    return window.CODEX_PANELS.cacheStats();
  }, [tick]);
  const totalBytes = stats.reduce((s, r) => s + r.bytes, 0);
  const fmtSize = (b) => b < 1024 ? `${b}B` : b < 1024*1024 ? `${(b/1024).toFixed(1)}KB` : `${(b/1024/1024).toFixed(2)}MB`;
  const human = (ts) => {
    if (!ts) return "—";
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff/60)}m`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h`;
    if (diff < 86400*7) return `${Math.floor(diff/86400)}d`;
    const d = new Date(ts);
    return `${d.getFullYear()}·${String(d.getMonth()+1).padStart(2,"0")}·${String(d.getDate()).padStart(2,"0")}`;
  };
  const label = (ref) => {
    const [bookId, chapter] = ref.split(".");
    const book = bookLookup.find(b => b.id === bookId);
    return book ? `${book.name} ${chapter}` : `${bookId} ${chapter}`;
  };
  if (stats.length === 0) {
    return (
      <p className="cx-export-hint" style={{ marginTop: 6 }}>
        No panels cached yet. Visit any chapter and Talmud / Commentary / Gematria /
        Gnosis content for that passage will be saved here for offline reading.
      </p>
    );
  }
  return (
    <div className="cx-cache-browser">
      <div className="cx-cache-browser-h">
        <span>{stats.length} chapters cached · {fmtSize(totalBytes)}</span>
      </div>
      <ul>
        {stats.slice(0, 50).map(r => (
          <li key={r.ref}>
            <button
              className="cx-cache-row"
              onClick={() => onJump(label(r.ref))}
              title={`Open ${label(r.ref)} · cached ${r.fetchedAt ? new Date(r.fetchedAt).toLocaleString() : "unknown"}`}
            >
              <span className="cx-cache-row-ref">{label(r.ref)}</span>
              <span className="cx-cache-row-meta">{human(r.fetchedAt)} · {fmtSize(r.bytes)}</span>
            </button>
          </li>
        ))}
      </ul>
      {stats.length > 50 ? (
        <p className="cx-export-hint" style={{ marginTop: 4 }}>
          + {stats.length - 50} more (oldest hidden).
        </p>
      ) : null}
    </div>
  );
}

function FooterBar({ currentVerse, passage, gnosisOn, onToggleGnosis, compareCount, onOpenLeft, onOpenRight, distractionFree, onToggleDistractionFree, theater, onToggleTheater, leftCollapsed, onToggleLeftCollapsed, rightCollapsed, onToggleRightCollapsed }) {
  return (
    <footer className="cx-footer">
      <div className="cx-footer-l">
        <div className="cx-footer-cluster">
          {/* Mobile-only library FAB. Per-rail collapse toggles (◧ ◨) and
              theater-mode (◐) removed: the rails have spine-clicks for the
              same purpose, and Oracle has its own ⛶ fullscreen. Down to
              two clean controls: "calm" (distraction-free) + Settings. */}
          <button className="cx-mobile-fab" onClick={onOpenLeft} aria-label="Library">≣</button>
          <button
            className={`cx-df-toggle ${distractionFree ? "is-on" : ""}`}
            onClick={onToggleDistractionFree}
            title={distractionFree ? "Show panels" : "Calm mode (hide both rails)"}
            aria-pressed={distractionFree}
          >{distractionFree ? "⊞" : "⊟"}</button>
          <button
            className="cx-df-toggle"
            onClick={() => window.postMessage({ type: "__activate_edit_mode" }, "*")}
            title="Settings"
            aria-label="Settings"
            data-tweaks-trigger
          >⚙</button>
        </div>
        {/* Compare-count tick: only renders when there's actually something
            to compare. Kills a permanently-zero pill in the default state. */}
        {compareCount > 0 ? (
          <Tick className="cx-hide-mobile">{tt("footer.compare")}&nbsp;<b>{pad(compareCount)}</b></Tick>
        ) : null}
        <Tick className="cx-hide-mobile">{tt("footer.cache")}&nbsp;<b>{tt("footer.cache.value")}</b></Tick>
        <AutoCacheTick />
      </div>
      <div className="cx-footer-c">
        <button
          className={`cx-gnosis-master ${gnosisOn ? "is-on" : ""}`}
          onClick={() => onToggleGnosis(!gnosisOn)}
        >
          <span className="cx-gnosis-master-ring" />
          <span className="cx-gnosis-master-lbl">
            ⟁ {gnosisOn ? tt("footer.gnosis.engaged") : tt("footer.gnosis.dormant")}
          </span>
        </button>
      </div>
      <div className="cx-footer-r">
        {/* Dropped: faux LATENCY + faux NODE pills. They never reflected real
            state and ate ~140px of footer real-estate. */}
        <button className="cx-mobile-fab" onClick={onOpenRight} aria-label="Panels">⋮</button>
      </div>
    </footer>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
