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
  return (
    <aside className="cx-rail cx-rail-r">
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
      <div className="cx-tabs">
        {tabs.map(t => {
          const disabled = t.id === "gnosis" && !gnosisOn;
          return (
            <button
              key={t.id}
              className={`cx-tab ${tab === t.id ? "is-active" : ""} ${disabled ? "is-locked" : ""}`}
              onClick={() => {
                if (t.id === "gnosis" && !gnosisOn) onToggleGnosis(true);
                onTab(t.id);
              }}
            >
              <span className="cx-tab-glyph">{t.glyph}</span>
              <span className="cx-tab-lbl">{t.label}</span>
              {disabled ? <span className="cx-tab-lock">⌬</span> : null}
            </button>
          );
        })}
      </div>

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

// Host that lets a plugin render either a React element (returned from
// render()) OR mutate the container DOM directly (for non-React plugins).
// The container is cleared and re-invoked whenever the relevant ctx changes.
function PluginPanelHost({ panel, book, bookId, chapter, verse, translation }) {
  const containerRef = useRef(null);
  const [reactNode, setReactNode] = useState(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Reset between renders — plugins that mutate DOM expect a fresh node.
    el.innerHTML = "";
    setReactNode(null);
    try {
      const result = panel.render({
        book, bookId, chapter, verse, translation, container: el,
      });
      // React element returned? Render it into our state slot.
      if (result && (React.isValidElement(result) || typeof result === "string" || typeof result === "number")) {
        setReactNode(result);
      }
    } catch (e) {
      console.warn(`CODEX plugin panel "${panel.pluginId}:${panel.id}" threw:`, e);
      el.textContent = `Plugin error: ${e.message || e}`;
    }
  }, [panel, book, bookId, chapter, verse, translation]);

  return (
    <div className="cx-pane cx-pane-plugin">
      <PaneHead title={panel.label.toUpperCase()} sub={`${book} ${chapter}${verse ? ":" + verse : ""}`} />
      <div ref={containerRef} className="cx-plugin-mount">
        {reactNode}
      </div>
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
  }, [data.translations, langOrder, transOrder]);

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

  const startDownload = (t) => {
    if (_dlState.get(t.id)?.controller && !_dlState.get(t.id)?.complete) return;
    if (!window.confirm(`Download all of ${t.name} for offline reading?\nThis will fetch ~${data.books.reduce((s,b)=>s+b.chapters,0)} chapters and may take a few minutes.`)) return;
    const controller = window.BIBLE.downloadAll(t.id, data.books, (p) => {
      _dlState.set(t.id, { ...p, controller });
      _dlNotify();
    });
    _dlState.set(t.id, { done: 0, total: data.books.reduce((s,b)=>s+b.chapters,0), controller });
    _dlNotify();
  };
  const stopDownload = (t) => {
    const s = _dlState.get(t.id);
    s?.controller?.abort();
  };
  const clearOffline = (t) => {
    if (!window.confirm(`Remove offline copy of ${t.name}? Active reading will re-fetch as you go.`)) return;
    try {
      const raw = JSON.parse(localStorage.getItem("codex.bible.cache.v2") || "{}");
      for (const k of Object.keys(raw)) {
        if (k.endsWith(`.${t.id}`)) delete raw[k];
      }
      localStorage.setItem("codex.bible.cache.v2", JSON.stringify(raw));
    } catch {}
    _dlState.delete(t.id);
    _dlNotify();
  };

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

      {/* Primary verse preview — quietly anchors the picker to the current verse */}
      <blockquote className="cx-tp-quote">
        <span className="cx-tp-quote-glyph">{primaryMeta?.glyph}</span>
        <span className="cx-tp-quote-text">{primaryText}</span>
      </blockquote>

      {/* Language groups · drag headers to reorder languages, drag rows to
          reorder within. Click a header to fold. */}
      <div className="cx-tp-groups">
        {groups.map(({ lang, items }) => {
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
                <span className="cx-tp-group-grip" aria-hidden>⋮⋮</span>
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
                      >
                        <span className="cx-tp-grip" aria-hidden title="Drag to reorder">⋮⋮</span>
                        <button
                          className="cx-tp-pick"
                          onClick={() => onPrimary(t.id)}
                          title={`Read in ${t.name}`}
                        >
                          <span className="cx-tp-mark" aria-hidden>{isPrimary ? "●" : ""}</span>
                          <span className="cx-tp-name">{t.name}</span>
                          <span className="cx-tp-year">{t.year}</span>
                        </button>
                        <button
                          className={`cx-tp-eye ${isCompare ? "is-on" : ""}`}
                          onClick={() => onToggleCompare(t.id)}
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
        <span>● primary  ·  ◉ compare  ·  ⋮⋮ drag to reorder</span>
      </div>
      {window.RepoAdd ? <RepoAdd onAdded={() => bump(n => n + 1)} /> : null}
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
            <div className="cx-gem-grid">
              {panelData.gematria.map((g, i) => (
                <div key={i} className="cx-gem-cell">
                  <div className="cx-gem-term">{g.term}</div>
                  <div className="cx-gem-translit">{g.translit}</div>
                  <div className="cx-gem-meaning">{g.meaning}</div>
                  <div className="cx-gem-value">
                    <b>{g.value}</b>
                    <i>{g.system}</i>
                  </div>
                </div>
              ))}
            </div>
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
