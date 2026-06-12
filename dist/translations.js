// GENERATED from translations.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
// CODEX — translations.jsx · v11 THE TONGUES INSTRUMENT — translations
// rebuilt from zero under EXOGRAMMAR law.
//
//   · THE CURRENT WORD — the active verse in the primary translation as a
//     serene serif block, fronted by the primary's solid identity block.
//     One glance answers "what am I reading".
//   · LANGUAGE LANES — translations grouped in horizontal lanes by tongue.
//     Each translation is a CARD (glyph · year · license dot), not a text
//     row. ONE TAP = it becomes primary. The active card is solid; the
//     rest are glass.
//   · COMPARE AS A GESTURE — ⊕ on a card's corner (desktop) or long-press
//     (touch) toggles it into the compare set; compare cards share an
//     accent edge and their renderings stack beneath the primary above.
//   · OFFLINE TRUTH ALWAYS VISIBLE — every card carries its state dot
//     permanently: ● bundled/cached · ◐ partly cached · ○ network. The
//     dot IS the control (click: download / pause / clear). State machine
//     lives in panels.jsx, reached honestly via window.CODEX_TRANS_STATE
//     (cross-IIFE law — bare identifiers do not cross dist files).
//
// Contract: same props as the old TranslationsPanel —
//   { primary, onPrimary, compareSet, onToggleCompare, passage, currentVerse }
// Used as the body of the TRANS desk window (app.jsx) AND the trans tab in
// the mobile drawer (panels.jsx). Engines stay in bible.js / panels.jsx;
// this file is a thin projection (law 5).

const TX_LANG_NAMES = {
  EN: "English", ES: "Español", DE: "Deutsch", PT: "Português",
  FR: "Français", LA: "Latina", HE: "עברית", EL: "Ἑλληνική",
  HI: "हिन्दी"
};
const TX_LANG_ORDER = ["EN", "ES", "FR", "DE", "PT", "LA", "HE", "EL", "HI"];

function txToast(msg, kind = "info") {
  try {window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg, kind } }));} catch {}
}

// Offline truth for one translation: "full" | "part" | "net" (+ live dl).
function txOfflineState(t, stats, dl) {
  const downloading = dl && !dl.complete && !dl.aborted;
  if (downloading) return { kind: "part", downloading: true, ratio: dl.total ? dl.done / dl.total : 0 };
  if (t.source === "bundle" || stats?.fully) return { kind: "full", downloading: false, ratio: 1 };
  const ratio = stats && stats.total ? stats.cached / stats.total : 0;
  if (ratio > 0) return { kind: "part", downloading: false, ratio };
  return { kind: "net", downloading: false, ratio: 0 };
}

const TX_DOT = { full: "●", part: "◐", net: "○" };

// One translation card. The card is the control: tap = primary,
// ⊕ corner / long-press = compare, the state dot = offline.
function TxCard({ t, isPrimary, isCompare, isUser, stats, dl, onPick, onCompare, onDot, onRemove }) {
  const off = txOfflineState(t, stats, dl);
  const longRef = React.useRef(false);
  const timerRef = React.useRef(0);
  const pct = Math.round(off.ratio * 100);

  const dotTitle = off.downloading ?
  `Downloading · ${pct}% · click to pause` :
  off.kind === "full" ?
  `${t.name} lives on this device · click to remove offline copy` :
  off.kind === "part" ?
  `${t.name} partly cached (${pct}%) · click to download the rest` :
  `${t.name} reads from the network · click to save offline`;

  // Long-press (touch land) = compare gesture; a plain tap stays primary.
  const onPointerDown = (e) => {
    if (e.pointerType === "mouse") return;
    longRef.current = false;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {longRef.current = true;onCompare();}, 550);
  };
  const onPointerEnd = () => clearTimeout(timerRef.current);
  const onClick = () => {
    if (longRef.current) {longRef.current = false;return;}
    onPick();
  };

  return (/*#__PURE__*/
    React.createElement("div", {
      className: `cx-tx-card ${isPrimary ? "is-primary" : ""} ${isCompare ? "is-compare" : ""} ${t.placeholder ? "is-ghost" : ""}`,
      "data-tx-id": t.id }, /*#__PURE__*/

    React.createElement("button", {
      type: "button",
      className: "cx-tx-card-pick",
      onClick: onClick,
      onPointerDown: onPointerDown,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onPointerLeave: onPointerEnd,
      "aria-pressed": isPrimary,
      disabled: !!t.placeholder,
      title: t.placeholder ?
      `${t.name} — not yet available (registry placeholder)` :
      isPrimary ? `${t.name} — you are reading this` : `Read in ${t.name}` }, /*#__PURE__*/

    React.createElement("span", { className: "cx-tx-card-glyph", "aria-hidden": "true" }, t.glyph || t.id.toUpperCase()), /*#__PURE__*/
    React.createElement("span", { className: "cx-tx-card-name" }, t.name), /*#__PURE__*/
    React.createElement("span", { className: "cx-tx-card-meta" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-tx-card-year" }, t.year || "—"),
    t.license ? /*#__PURE__*/React.createElement("i", { className: "cx-tx-lic", title: t.license, "aria-hidden": "true" }) : null
    )
    ), /*#__PURE__*/
    React.createElement("button", {
      type: "button",
      className: `cx-tx-dot is-${off.kind} ${off.downloading ? "is-dl" : ""}`,
      onClick: (e) => {e.stopPropagation();onDot(off);},
      title: dotTitle,
      "aria-label": dotTitle },

    TX_DOT[off.kind],
    off.downloading ? /*#__PURE__*/React.createElement("span", { className: "cx-tx-dot-pct" }, pct, "%") : null
    ), /*#__PURE__*/
    React.createElement("button", {
      type: "button",
      className: "cx-tx-card-cmp",
      onClick: (e) => {e.stopPropagation();onCompare();},
      "aria-pressed": isCompare,
      title: isCompare ? `Remove ${t.name} from compare` : `Compare ${t.name} beneath the primary`,
      "aria-label": isCompare ? `Remove ${t.name} from compare` : `Add ${t.name} to compare` },
    isCompare ? "⊖" : "⊕"),
    isUser ? /*#__PURE__*/
    React.createElement("button", {
      type: "button",
      className: "cx-tx-card-rm",
      onClick: (e) => {e.stopPropagation();onRemove();},
      title: `Remove ${t.name} from your library`,
      "aria-label": `Remove ${t.name} from your library` },
    "\xD7") :
    null
    ));

}

function CodexTranslationsX({ primary, onPrimary, compareSet, onToggleCompare, passage, currentVerse }) {
  const data = window.CODEX_DATA;
  const TS = window.CODEX_TRANS_STATE || null;
  const [bumpKey, bump] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const filterRef = React.useRef(null);

  const verse = passage.verses.find((v) => v.n === currentVerse) || passage.verses[0];
  const primaryMeta = data.translations.find((t) => t.id === primary);
  const primaryText = verse ? verse[primary] || "—" : "—";
  const refStr = `${passage.book} ${passage.chapter}:${verse?.n ?? "—"}`;
  const userIds = new Set((window.loadRepos?.() || []).map((r) => r.id));

  // Live repaint: download ticks, install/removal, IDB warm-load.
  React.useEffect(() => {
    const fn = () => bump((n) => n + 1);
    const unsub = TS ? TS.subscribe(fn) : null;
    window.addEventListener("codex:translations-changed", fn);
    window.addEventListener("codex:bible:ready", fn);
    if (window.BIBLE?.ready) window.BIBLE.ready.then(fn);
    return () => {
      if (unsub) unsub();
      window.removeEventListener("codex:translations-changed", fn);
      window.removeEventListener("codex:bible:ready", fn);
    };
  }, []);

  // Cache stats per translation — re-derived on every bump so dots are true.
  const stats = React.useMemo(() => {
    const m = {};
    if (!window.BIBLE?.cacheStats) return m;
    for (const t of data.translations) {
      try {m[t.id] = window.BIBLE.cacheStats(t.id, data.books);} catch {}
    }
    return m;
  }, [data.translations, data.books, bumpKey]);

  // Lanes: group by language, EN-first canonical order, then any others.
  const lanes = React.useMemo(() => {
    const byLang = new Map();
    for (const t of data.translations) {
      const k = t.lang || "??";
      if (!byLang.has(k)) byLang.set(k, []);
      byLang.get(k).push(t);
    }
    const order = [
    ...TX_LANG_ORDER.filter((l) => byLang.has(l)),
    ...[...byLang.keys()].filter((l) => !TX_LANG_ORDER.includes(l))];

    return order.map((lang) => ({ lang, items: byLang.get(lang) }));
  }, [data.translations, bumpKey]);

  // Filter — name / lang / id / year, lanes without matches vanish.
  const q = query.trim().toLowerCase();
  const shown = !q ? lanes : lanes.map((g) => ({
    ...g,
    items: g.items.filter((t) =>
    (t.name || "").toLowerCase().includes(q) ||
    (t.lang || "").toLowerCase().includes(q) ||
    (t.id || "").toLowerCase().includes(q) ||
    (t.year || "").toString().includes(q) ||
    (TX_LANG_NAMES[t.lang] || "").toLowerCase().includes(q)
    )
  })).filter((g) => g.items.length);

  const pick = (t) => {
    if (t.placeholder) return;
    onPrimary(t.id);
    if (TS?.maybeAutoBundle) TS.maybeAutoBundle(t, data.books);
  };
  const toggleCompare = (t) => {
    const wasOn = compareSet.includes(t.id);
    onToggleCompare(t.id);
    if (!wasOn && TS?.maybeAutoBundle) TS.maybeAutoBundle(t, data.books);
  };
  const dotAct = (t, off) => {
    if (!TS) return;
    if (off.downloading) TS.stop(t);else
    if (off.kind === "full" && t.source !== "bundle") TS.clear(t);else
    if (off.kind !== "full") TS.start(t);
  };
  const removeOne = (t) => {
    if (!userIds.has(t.id)) return;
    if (!window.confirm(`Remove ${t.name} from your library? Cached chapters will be cleared.`)) return;
    window.removeRepo?.(t.id);
    if (compareSet.includes(t.id)) onToggleCompare(t.id);
    if (primary === t.id) onPrimary("kjv");
    bump((n) => n + 1);
  };

  // Keyboard: ←/→ walk the cards of a lane (cards are real buttons, so
  // Tab + Enter already work; arrows make a lane feel like one instrument).
  const onLaneKey = (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const track = e.currentTarget;
    const picks = [...track.querySelectorAll(".cx-tx-card-pick:not([disabled])")];
    const i = picks.indexOf(document.activeElement);
    if (i === -1) return;
    e.preventDefault();
    const next = picks[i + (e.key === "ArrowRight" ? 1 : -1)];
    if (next) {next.focus();next.scrollIntoView({ block: "nearest", inline: "nearest" });}
  };

  // Compare renderings (primary excluded) for the verse preview stack.
  const compareRows = compareSet.
  filter((id) => id !== primary).
  map((id) => ({ id, meta: data.translations.find((t) => t.id === id) })).
  filter((r) => r.meta);

  const copyPrimary = () => {
    if (!verse) return;
    try {
      navigator.clipboard?.writeText(`${String(primaryText).trim()} — ${refStr} (${primaryMeta?.name || primary})`);
      txToast(`Copied · ${refStr}`, "ok");
    } catch {txToast("Copy failed", "err");}
  };

  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-pane cx-tx", role: "region", "aria-label": "Translations" }, /*#__PURE__*/

    React.createElement("section", { className: "cx-tx-current" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-tx-identity", title: `${primaryMeta?.name || primary} · ${primaryMeta?.year || ""} · ${primaryMeta?.license || ""}` }, /*#__PURE__*/
    React.createElement("b", { className: "cx-tx-id-glyph" }, primaryMeta?.glyph || (primary || "?").toUpperCase()), /*#__PURE__*/
    React.createElement("span", { className: "cx-tx-id-name" }, primaryMeta?.name || primary), /*#__PURE__*/
    React.createElement("span", { className: "cx-tx-id-year" }, primaryMeta?.year || "")
    ), /*#__PURE__*/
    React.createElement("blockquote", {
      className: "cx-tx-verse",
      onClick: copyPrimary,
      title: "Tap to copy" }, /*#__PURE__*/

    React.createElement("span", { className: "cx-tx-verse-text" }, primaryText), /*#__PURE__*/
    React.createElement("cite", { className: "cx-tx-verse-ref" }, refStr)
    ),
    compareRows.length ? /*#__PURE__*/
    React.createElement("div", { className: "cx-tx-compare", "aria-label": "Compare renderings" },
    compareRows.map(({ id, meta }) => /*#__PURE__*/
    React.createElement("div", { key: id, className: "cx-tx-cmp-row" }, /*#__PURE__*/
    React.createElement("b", { className: "cx-tx-cmp-tag", title: meta.name }, meta.glyph || id.toUpperCase()), /*#__PURE__*/
    React.createElement("span", { className: "cx-tx-cmp-text" }, verse ? verse[id] || "—" : "—")
    )
    )
    ) :
    null
    ), /*#__PURE__*/


    React.createElement("div", { className: "cx-tx-bar" }, /*#__PURE__*/
    React.createElement("input", {
      ref: filterRef,
      type: "search",
      className: "cx-tx-filter",
      value: query,
      onChange: (e) => setQuery(e.target.value),
      placeholder: "Filter \xB7 name, lang, id, year",
      "aria-label": "Filter translations" }
    ), /*#__PURE__*/
    React.createElement("span", { className: "cx-tx-legend", "aria-hidden": "true" }, "\u25CF offline \xB7 \u25D0 partial \xB7 \u25CB network")
    ), /*#__PURE__*/


    React.createElement("div", { className: "cx-tx-lanes" },
    shown.map(({ lang, items }) => /*#__PURE__*/
    React.createElement("section", { key: lang, className: "cx-tx-lane", "data-lang": lang }, /*#__PURE__*/
    React.createElement("header", { className: "cx-tx-lane-h" }, /*#__PURE__*/
    React.createElement("b", { className: "cx-tx-lane-tag" }, lang), /*#__PURE__*/
    React.createElement("span", { className: "cx-tx-lane-name" }, TX_LANG_NAMES[lang] || lang), /*#__PURE__*/
    React.createElement("span", { className: "cx-tx-lane-count" }, items.length)
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-tx-lane-track", role: "listbox", "aria-label": `${TX_LANG_NAMES[lang] || lang} translations`, onKeyDown: onLaneKey },
    items.map((t) => /*#__PURE__*/
    React.createElement(TxCard, {
      key: t.id,
      t: t,
      isPrimary: primary === t.id,
      isCompare: compareSet.includes(t.id),
      isUser: userIds.has(t.id),
      stats: stats[t.id],
      dl: TS ? TS.get(t.id) : null,
      onPick: () => pick(t),
      onCompare: () => toggleCompare(t),
      onDot: (off) => dotAct(t, off),
      onRemove: () => removeOne(t) }
    )
    )
    )
    )
    ),
    !shown.length ? /*#__PURE__*/React.createElement("div", { className: "cx-tx-none" }, "no translation matches \u201C", query, "\u201D") : null
    ),

    window.RepoAdd ? /*#__PURE__*/
    React.createElement("details", { className: "cx-tx-browse" }, /*#__PURE__*/
    React.createElement("summary", null, "\uFF0B Browse community translations"),
    React.createElement(window.RepoAdd, { onAdded: () => bump((n) => n + 1) })
    ) :
    null
    ));

}

Object.assign(window, { CodexTranslationsX });
})();
