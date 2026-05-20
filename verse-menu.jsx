// CODEX — verse context menu
// In the name of Jesus Christ, may this serve the careful reading of His word.
//
// Floating menu that anchors next to the clicked verse. Actions:
//   ✦ MARK       — add this verse to bookmarks
//   Α/Ω COMPARE  — engage side-by-side compare, focus this verse
//   ↔  TRANSLATE — quick primary-translation switch
//   ◉ ASK ORACLE — prefill Oracle in the left rail with this verse
//   ⎘ COPY       — copy verse text to clipboard
//   ⟁ GNOSIS     — engage gnosis overlay on this verse

const { useLayoutEffect } = React;
const vmt = (k) => (window.t && window.t(k)) || k;

function VerseMenu({
  anchor,           // DOMRect of the clicked verse
  verse,            // verse object {n, kjv, web, ...}
  passage,          // {book, chapter, ...}
  primary,
  translations,
  sideBySide,
  gnosisOn,
  highlightColor,
  highlightColors,  // { amber: { name, swatch }, ... }
  currentHighlight, // string | null — current colour for this verse
  onClose,
  onMark,
  onCompare,
  onSetPrimary,
  onAskOracle,
  onToggleGnosis,
  onToggleHighlight,
  onClearHighlight,
  onOpenMap,
  onOpenArt,
  onOpenCompare,
  onOpenNote,
  onOpenMirror,
  pluginVersion,
}) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, side: "right" });
  const [view, setView] = useState("root"); // root | translate | highlight

  // Position the menu next to the verse, flipping if it would overflow.
  useLayoutEffect(() => {
    if (!anchor) return;
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth || 240;
    const h = el.offsetHeight || 200;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    let left = anchor.right + 10;
    let side = "right";
    if (left + w + margin > vw) {
      left = anchor.left - w - 10;
      side = "left";
      if (left < margin) {
        left = Math.max(margin, Math.min(vw - w - margin, anchor.left));
        side = "below";
      }
    }
    let top = anchor.top;
    if (side === "below") top = anchor.bottom + 8;
    if (top + h + margin > vh) top = Math.max(margin, vh - h - margin);
    if (top < margin) top = margin;
    setPos({ top, left, side });
  }, [anchor, view]);

  // Close on outside click or Escape.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    const onDown = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("keydown", onKey);
    // Defer so the click that opened the menu doesn't immediately close it.
    const t = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  const verseText = verse ? (verse[primary] || verse.kjv || verse.web || "") : "";
  const ref$ = `${passage.book} ${passage.chapter}:${verse?.n ?? "?"}`;

  const copy = async () => {
    const payload = `“${verseText}” — ${ref$}`;
    const toast = (msg, kind = "ok") => {
      try { window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg, kind } })); } catch {}
    };
    // Prefer Web Share API when available (mobile + supported desktop).
    // Fall back to clipboard on any error / dismissal that returns rejection.
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: ref$, text: payload });
        toast("Shared.");
        onClose();
        return;
      } catch (_) {
        // AbortError when user cancels — fall through to clipboard silently.
      }
    }
    try {
      await navigator.clipboard.writeText(payload);
      toast("Copied to clipboard.");
    } catch (e) {
      toast(`Copy failed: ${e.message || e}`, "err");
    }
    onClose();
  };

  return (
    <div ref={ref} className={`cx-vm cx-vm-${pos.side}`}
         style={{ top: pos.top + "px", left: pos.left + "px" }}
         role="menu" onClick={(e) => e.stopPropagation()}>
      <div className="cx-vm-head">
        <span className="cx-vm-ref">{ref$}</span>
        <button className="cx-vm-x" onClick={onClose} aria-label="Close">×</button>
      </div>

      {view === "root" ? (
        <div className="cx-vm-body">
          <button
            className={`cx-vm-row ${currentHighlight ? "is-on" : ""}`}
            onClick={() => { onToggleHighlight?.(); onClose(); }}
          >
            <span className="cx-vm-icon" style={currentHighlight && highlightColors?.[currentHighlight] ? { color: highlightColors[currentHighlight].swatch } : null}>
              {currentHighlight ? "✓" : "✦"}
            </span>
            <span className="cx-vm-lbl">{currentHighlight ? vmt("vm.unmark") : vmt("vm.mark")}</span>
            <span className="cx-vm-sub">
              {currentHighlight ? `clear ${currentHighlight}` : `highlight in ${highlightColor || "amber"}`}
            </span>
          </button>

          {highlightColors ? (
            <button className="cx-vm-row" onClick={() => setView("highlight")}>
              <span className="cx-vm-icon">◐</span>
              <span className="cx-vm-lbl">{vmt("vm.choose.color")}</span>
              <span className="cx-vm-sub">5 hues ▸</span>
            </button>
          ) : null}

          <button className="cx-vm-row" onClick={() => { onCompare(verse.n); onClose(); }}>
            <span className="cx-vm-icon">Α/Ω</span>
            <span className="cx-vm-lbl">{sideBySide ? vmt("vm.compare.focus") : vmt("vm.compare")}</span>
            <span className="cx-vm-sub">{sideBySide ? "focus this verse" : "engage side-by-side"}</span>
          </button>

          <button className="cx-vm-row" onClick={() => setView("translate")}>
            <span className="cx-vm-icon">↔</span>
            <span className="cx-vm-lbl">{vmt("vm.translate")}</span>
            <span className="cx-vm-sub">switch primary corpus ▸</span>
          </button>

          <button className="cx-vm-row" onClick={() => { onAskOracle(verse, ref$, verseText); onClose(); }}>
            <span className="cx-vm-icon">◉</span>
            <span className="cx-vm-lbl">{vmt("vm.ask.oracle")}</span>
            <span className="cx-vm-sub">load into the chatbot</span>
          </button>

          <button className="cx-vm-row" onClick={copy}>
            <span className="cx-vm-icon">⎘</span>
            <span className="cx-vm-lbl">{vmt("vm.copy")}</span>
            <span className="cx-vm-sub">verse + reference</span>
          </button>

          <button className={`cx-vm-row ${gnosisOn ? "is-on" : ""}`}
                  onClick={() => { onToggleGnosis(!gnosisOn); onClose(); }}>
            <span className="cx-vm-icon">⟁</span>
            <span className="cx-vm-lbl">{vmt("vm.gnosis")}</span>
            <span className="cx-vm-sub">{gnosisOn ? "disengage overlay" : "engage overlay"}</span>
          </button>

          <button className="cx-vm-row" onClick={() => { onOpenMap?.(verse, ref$, verseText); onClose(); }}>
            <span className="cx-vm-icon">◎</span>
            <span className="cx-vm-lbl">{vmt("vm.map")}</span>
            <span className="cx-vm-sub">place · era · timeline</span>
          </button>

          <button className="cx-vm-row" onClick={() => { onOpenArt?.(verse, ref$, verseText); onClose(); }}>
            <span className="cx-vm-icon">▦</span>
            <span className="cx-vm-lbl">{vmt("vm.art")}</span>
            <span className="cx-vm-sub">paintings · illustrations</span>
          </button>

          <button className="cx-vm-row" onClick={() => { onOpenCompare?.(verse, ref$); onClose(); }}>
            <span className="cx-vm-icon">≡</span>
            <span className="cx-vm-lbl">{vmt("vm.compare")}</span>
            <span className="cx-vm-sub">across all translations</span>
          </button>

          <button className="cx-vm-row" onClick={() => { onOpenMirror?.(verse, ref$, verseText); onClose(); }}>
            <span className="cx-vm-icon">⌬</span>
            <span className="cx-vm-lbl">{vmt("vm.mirror")}</span>
            <span className="cx-vm-sub">{vmt("vm.mirror.sub")}</span>
          </button>

          <button className="cx-vm-row" onClick={() => { onOpenNote?.(verse, ref$); onClose(); }}>
            <span className="cx-vm-icon">✎</span>
            <span className="cx-vm-lbl">{vmt("vm.note")}</span>
            <span className="cx-vm-sub">{vmt("vm.note.sub")}</span>
          </button>

          {/* Plugin-registered verse actions — appended after built-ins. */}
          {(window.CODEX_PLUGINS_API ? window.CODEX_PLUGINS_API.getVerseActions() : []).map((a, i) => {
            const verseRef = {
              book: passage.book, bookId: passage.bookId,
              chapter: passage.chapter, verse: verse?.n,
              text: verseText, translation: primary,
            };
            return (
              <button
                key={`plugin-${a.pluginId}-${i}`}
                className="cx-vm-row is-plugin"
                onClick={() => {
                  try { a.handler(verseRef); }
                  catch (e) { console.warn(`CODEX plugin "${a.pluginId}" verseAction threw:`, e); }
                  onClose();
                }}
              >
                <span className="cx-vm-icon">{a.icon}</span>
                <span className="cx-vm-lbl">{a.label}</span>
                <span className="cx-vm-sub">{a.pluginId}</span>
              </button>
            );
          })}
        </div>
      ) : view === "highlight" ? (
        <div className="cx-vm-body cx-vm-hl">
          <button className="cx-vm-back" onClick={() => setView("root")}>◂ back</button>
          <div className="cx-vm-hl-grid">
            {Object.entries(highlightColors || {}).map(([key, c]) => (
              <button
                key={key}
                className={`cx-vm-hl-swatch ${currentHighlight === key ? "is-on" : ""}`}
                style={{ background: c.swatch }}
                onClick={() => { onToggleHighlight?.(key); onClose(); }}
                title={c.name}
                aria-label={`Highlight in ${c.name}`}
              >{currentHighlight === key ? "✓" : ""}</button>
            ))}
            {currentHighlight ? (
              <button
                className="cx-vm-hl-clear"
                onClick={() => { onClearHighlight?.(); onClose(); }}
                title="Remove highlight"
              >×</button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="cx-vm-body cx-vm-translate">
          <button className="cx-vm-back" onClick={() => setView("root")}>◂ back</button>
          {translations.map(t => {
            const isActive = primary === t.id;
            const text = verse?.[t.id];
            return (
              <button
                key={t.id}
                className={`cx-vm-tr ${isActive ? "is-active" : ""}`}
                onClick={() => { onSetPrimary(t.id); onClose(); }}
                disabled={!text}
                title={text || "not loaded"}
              >
                <span className="cx-vm-tr-glyph">{t.glyph}</span>
                <span className="cx-vm-tr-name">
                  <b>{t.name}</b>
                  <i>{t.year} · {t.lang}</i>
                </span>
                {isActive ? <span className="cx-vm-tr-on">PRIMARY</span> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { VerseMenu });
