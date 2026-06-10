// GENERATED from verse-menu.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
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
const vmt = (k) => window.t && window.t(k) || k;

function VerseMenu({
  anchor, // DOMRect of the clicked verse
  verse, // verse object {n, kjv, web, ...}
  passage, // {book, chapter, ...}
  primary,
  translations,
  sideBySide,
  gnosisOn,
  highlightColor,
  highlightColors, // { amber: { name, swatch }, ... }
  currentHighlight, // string | null — current colour for this verse
  onClose,
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
  onOpenSword,
  onOpenOps,
  pluginVersion
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

  // A11y — remember the element that had focus when the menu opened so we can
  // restore it on close (Esc / outside-click). Captured once at mount.
  const triggerRef = useRef(null);
  if (triggerRef.current === null) {
    try {triggerRef.current = document.activeElement;} catch (_) {triggerRef.current = false;}
  }
  const restoreFocus = () => {
    try {
      const el = triggerRef.current;
      if (el && el !== false && typeof el.focus === "function" && document.contains(el)) {
        el.focus();
      }
    } catch (_) {/* never throw from focus restore */}
  };

  // On open, move focus into the menu (first focusable row).
  useEffect(() => {
    try {
      const root = ref.current;
      if (!root) return;
      const first = root.querySelector(".cx-vm-row, .cx-vm-back, button");
      if (first && typeof first.focus === "function") first.focus();
    } catch (_) {/* defensive: focusing must never throw */}
  }, []);

  // Close on outside click or Escape; trap Tab within the menu; restore focus.
  useEffect(() => {
    const close = () => {restoreFocus();onClose();};
    const onKey = (e) => {
      if (e.key === "Escape") {close();return;}
      if (e.key !== "Tab") return;
      try {
        const root = ref.current;
        if (!root) return;
        const items = Array.prototype.slice.call(
          root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        ).filter((n) => !n.disabled && n.offsetParent !== null);
        if (!items.length) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === firstEl || !root.contains(active)) {e.preventDefault();lastEl.focus();}
        } else {
          if (active === lastEl || !root.contains(active)) {e.preventDefault();firstEl.focus();}
        }
      } catch (_) {/* trap is best-effort; never throw */}
    };
    const onDown = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) close();
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

  const verseText = verse ? verse[primary] || verse.kjv || verse.web || "" : "";
  const ref$ = `${passage.book} ${passage.chapter}:${verse?.n ?? "?"}`;

  // CODEX Phase 2.5 — depth-action emitter (additive, defensive).
  // At the moment the user invokes a depth surface from this menu, dispatch the
  // engagement bus event so the (optional) CODEX_ENGAGEMENT engine can record a
  // qualifying depth event. Guarded so nothing breaks if the engine is absent /
  // in Lite mode. ref shape per frozen contract: "book.chapter.verse".
  const depthRef = `${passage.book}.${passage.chapter}.${verse?.n ?? ""}`;
  const emitDepth = (type, weight) => {
    try {
      window.dispatchEvent(new CustomEvent("codex:depth-action", {
        detail: { type, ref: depthRef, weight }
      }));
    } catch (_) {/* never throw from a UI handler */}
  };

  const copy = async () => {
    const payload = `“${verseText}” — ${ref$}`;
    const toast = (msg, kind = "ok") => {
      try {window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg, kind } }));} catch {}
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
      }}
    try {
      await navigator.clipboard.writeText(payload);
      toast("Copied to clipboard.");
    } catch (e) {
      toast(`Copy failed: ${e.message || e}`, "err");
    }
    onClose();
  };

  return (/*#__PURE__*/
    React.createElement("div", { ref: ref, className: `cx-vm cx-vm-${pos.side}`,
      style: { top: pos.top + "px", left: pos.left + "px" },
      role: "menu", onClick: (e) => e.stopPropagation() }, /*#__PURE__*/
    React.createElement("div", { className: "cx-vm-head" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-ref" }, ref$), /*#__PURE__*/
    React.createElement("button", { className: "cx-vm-x", onClick: onClose, "aria-label": "Close" }, "\xD7")
    ),

    view === "root" ? /*#__PURE__*/
    React.createElement("div", { className: "cx-vm-body" }, /*#__PURE__*/


    React.createElement("div", { className: "cx-vm-strip", role: "group", "aria-label": "Quick actions" }, /*#__PURE__*/
    React.createElement("button", {
      className: `cx-vm-strip-btn ${currentHighlight ? "is-on" : ""}`,
      role: "menuitem",
      onClick: () => {onToggleHighlight?.();onClose();},
      title: currentHighlight ? `${vmt("vm.unmark")} — clear ${currentHighlight}` : `${vmt("vm.mark")} — highlight in ${highlightColor || "amber"}`,
      "aria-label": currentHighlight ? vmt("vm.unmark") : vmt("vm.mark") }, /*#__PURE__*/

    React.createElement("span", { className: "cx-vm-icon", style: currentHighlight && highlightColors?.[currentHighlight] ? { color: highlightColors[currentHighlight].swatch } : null },
    currentHighlight ? "✓" : "✦"
    )
    ),

    highlightColors ? /*#__PURE__*/
    React.createElement("button", {
      className: "cx-vm-strip-btn",
      role: "menuitem",
      onClick: () => setView("highlight"),
      title: `${vmt("vm.choose.color")} — 5 hues`,
      "aria-label": vmt("vm.choose.color") }, /*#__PURE__*/

    React.createElement("span", { className: "cx-vm-icon" }, "\u25D0")
    ) :
    null, /*#__PURE__*/

    React.createElement("button", {
      className: "cx-vm-strip-btn",
      role: "menuitem",
      onClick: () => setView("translate"),
      title: `${vmt("vm.translate")} — switch primary corpus`,
      "aria-label": vmt("vm.translate") }, /*#__PURE__*/

    React.createElement("span", { className: "cx-vm-icon" }, "\u2194")
    ), /*#__PURE__*/

    React.createElement("button", {
      className: "cx-vm-strip-btn",
      role: "menuitem",
      onClick: copy,
      title: `${vmt("vm.copy")} — verse + reference`,
      "aria-label": vmt("vm.copy") }, /*#__PURE__*/

    React.createElement("span", { className: "cx-vm-icon" }, "\u2398")
    )
    ), /*#__PURE__*/

    React.createElement("button", { className: "cx-vm-row", role: "menuitem", onClick: () => {onAskOracle(verse, ref$, verseText);onClose();} }, /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-icon" }, "\u25C9"), /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-lbl" }, vmt("vm.ask.oracle")), /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-sub" }, "load into the chatbot")
    ), /*#__PURE__*/

    React.createElement("button", { className: `cx-vm-row ${gnosisOn ? "is-on" : ""}`,
      role: "menuitem",
      onClick: () => {if (!gnosisOn) emitDepth("gnosis-read", 2);onToggleGnosis(!gnosisOn);onClose();} }, /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-icon" }, "\u27C1"), /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-lbl" }, vmt("vm.gnosis")), /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-sub" }, gnosisOn ? "disengage overlay" : "engage overlay")
    ), /*#__PURE__*/

    React.createElement("div", { className: "cx-vm-group", "aria-hidden": "true" }, "DEPTH CONSOLES"), /*#__PURE__*/

    React.createElement("button", { className: "cx-vm-row", role: "menuitem", onClick: () => {emitDepth("map-place-study", 2);onOpenMap?.(verse, ref$, verseText);onClose();} }, /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-icon" }, "\u25CE"), /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-lbl" }, vmt("vm.map")), /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-sub" }, "place \xB7 era \xB7 timeline")
    ), /*#__PURE__*/

    React.createElement("button", { className: "cx-vm-row", role: "menuitem", onClick: () => {onOpenArt?.(verse, ref$, verseText);onClose();} }, /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-icon" }, "\u25A6"), /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-lbl" }, vmt("vm.art")), /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-sub" }, "paintings \xB7 illustrations")
    ), /*#__PURE__*/

    React.createElement("button", { className: "cx-vm-row", role: "menuitem", onClick: () => {onOpenCompare?.(verse, ref$);onClose();} }, /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-icon" }, "\u2261"), /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-lbl" }, vmt("vm.compare")), /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-sub" }, "across all translations")
    ), /*#__PURE__*/

    React.createElement("button", { className: "cx-vm-row", role: "menuitem", onClick: () => {onOpenMirror?.(verse, ref$, verseText);onClose();} }, /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-icon" }, "\u232C"), /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-lbl" }, vmt("vm.mirror")), /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-sub" }, vmt("vm.mirror.sub"))
    ), /*#__PURE__*/

    React.createElement("button", { className: "cx-vm-row", role: "menuitem", onClick: () => {onOpenSword?.(verse, ref$, verseText);onClose();} }, /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-icon" }, "\u2694"), /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-lbl" }, "SWORD"), /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-sub" }, "fourfold edge \xB7 pardes \xD7 quadriga")
    ), /*#__PURE__*/

    React.createElement("button", { className: "cx-vm-row", role: "menuitem", onClick: () => {onOpenOps?.(verse, ref$, verseText);onClose();} }, /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-icon" }, "\u25CE"), /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-lbl" }, "OPS"), /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-sub" }, "task the kernel \xB7 build a study")
    ), /*#__PURE__*/

    React.createElement("div", { className: "cx-vm-group", "aria-hidden": "true" }, "STUDY TOOLS"), /*#__PURE__*/

    React.createElement("button", { className: "cx-vm-row", role: "menuitem", onClick: () => {emitDepth("note-written", 2);onOpenNote?.(verse, ref$);onClose();} }, /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-icon" }, "\u270E"), /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-lbl" }, vmt("vm.note")), /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-sub" }, vmt("vm.note.sub"))
    ),


    (window.CODEX_PLUGINS_API ? window.CODEX_PLUGINS_API.getVerseActions() : []).map((a, i) => {
      const verseRef = {
        book: passage.book, bookId: passage.bookId,
        chapter: passage.chapter, verse: verse?.n,
        text: verseText, translation: primary
      };
      return (/*#__PURE__*/
        React.createElement("button", {
          key: `plugin-${a.pluginId}-${i}`,
          className: "cx-vm-row is-plugin",
          role: "menuitem",
          onClick: () => {
            try {a.handler(verseRef);}
            catch (e) {console.warn(`CODEX plugin "${a.pluginId}" verseAction threw:`, e);}
            onClose();
          } }, /*#__PURE__*/

        React.createElement("span", { className: "cx-vm-icon" }, a.icon), /*#__PURE__*/
        React.createElement("span", { className: "cx-vm-lbl" }, a.label), /*#__PURE__*/
        React.createElement("span", { className: "cx-vm-sub" }, a.pluginId)
        ));

    })
    ) :
    view === "highlight" ? /*#__PURE__*/
    React.createElement("div", { className: "cx-vm-body cx-vm-hl" }, /*#__PURE__*/
    React.createElement("button", { className: "cx-vm-back", onClick: () => setView("root") }, "\u25C2 back"), /*#__PURE__*/
    React.createElement("div", { className: "cx-vm-hl-grid" },
    Object.entries(highlightColors || {}).map(([key, c]) => /*#__PURE__*/
    React.createElement("button", {
      key: key,
      className: `cx-vm-hl-swatch ${currentHighlight === key ? "is-on" : ""}`,
      role: "menuitem",
      style: { background: c.swatch },
      onClick: () => {onToggleHighlight?.(key);onClose();},
      title: c.name,
      "aria-label": `Highlight in ${c.name}` },
    currentHighlight === key ? "✓" : "")
    ),
    currentHighlight ? /*#__PURE__*/
    React.createElement("button", {
      className: "cx-vm-hl-clear",
      role: "menuitem",
      onClick: () => {onClearHighlight?.();onClose();},
      title: "Remove highlight" },
    "\xD7") :
    null
    )
    ) : /*#__PURE__*/

    React.createElement("div", { className: "cx-vm-body cx-vm-translate" }, /*#__PURE__*/
    React.createElement("button", { className: "cx-vm-back", onClick: () => setView("root") }, "\u25C2 back"),
    translations.map((t) => {
      const isActive = primary === t.id;
      const text = verse?.[t.id];
      return (/*#__PURE__*/
        React.createElement("button", {
          key: t.id,
          className: `cx-vm-tr ${isActive ? "is-active" : ""}`,
          role: "menuitem",
          onClick: () => {onSetPrimary(t.id);onClose();},
          disabled: !text,
          title: text || "not loaded" }, /*#__PURE__*/

        React.createElement("span", { className: "cx-vm-tr-glyph" }, t.glyph), /*#__PURE__*/
        React.createElement("span", { className: "cx-vm-tr-name" }, /*#__PURE__*/
        React.createElement("b", null, t.name), /*#__PURE__*/
        React.createElement("i", null, t.year, " \xB7 ", t.lang)
        ),
        isActive ? /*#__PURE__*/React.createElement("span", { className: "cx-vm-tr-on" }, "PRIMARY") : null
        ));

    })
    )

    ));

}

Object.assign(window, { VerseMenu });
})();
