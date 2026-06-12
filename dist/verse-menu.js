// GENERATED from verse-menu.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
// CODEX — verse menu · v11.3, remade from zero. MINIMAL BY LAW.
// In the name of Jesus Christ, may this serve the careful reading of His word.
//
// The omnibar is the point of origin now; this float is only the few
// gestures a reader wants AT the verse, nothing else:
//
//   ref header            — where you are
//   ⚔ ⌬ ◎  verb row       — sword / mirror / map via codex:os-open
//   ✦ MARK                — toggle the highlight
//   ⊕ COMPARE             — the verse across translations
//   ⌘ more…               — opens the omnibar pre-seeded with the ref
//
// Everything the old menu carried (oracle, art, ops, notes, translate,
// color grid, plugin rows) lives on in the omnibar and the panels.
// Keyboard: Esc closes · ↑/↓ walk the rows · Enter activates.
//
// Cross-IIFE law: the menu drives the app through window.* and events only
// (codex:os-open · codexOpenOmni · the onToggleHighlight prop from app.jsx).

const { useLayoutEffect } = React;
const vmt = (k, fb) => {const s = window.t && window.t(k);return s && s !== k ? s : fb || k;};

// Self-injected CSS — the float inherits the legacy .cx-vm shell from
// styles.css; these rules carry only what the minimal remake adds.
const CX_VM_CSS = `
.cx-vm.cx-vm-min { min-width: 218px; max-width: 260px; }
.cx-vm-verbs { display: flex; gap: 4px; padding: 6px 8px 4px; }
.cx-vm-verb {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
  background: none; border: 1px solid color-mix(in oklab, currentColor 14%, transparent);
  border-radius: 8px; color: inherit; cursor: pointer; padding: 7px 2px 5px;
  font: inherit;
}
.cx-vm-verb i { font-style: normal; font-size: 15px; line-height: 1; }
.cx-vm-verb span { font-size: 8.5px; letter-spacing: 0.12em; opacity: 0.55; }
.cx-vm-verb:hover, .cx-vm-verb:focus-visible {
  border-color: var(--cx-accent, #7ee0ff);
  color: var(--cx-accent, #7ee0ff);
  outline: none;
}
.cx-vm-min .cx-vm-row { gap: 9px; }
.cx-vm-min .cx-vm-row .cx-vm-sub { margin-left: auto; }
`;
(function injectVmCss() {
  try {
    if (typeof document === "undefined" || document.getElementById("cx-vm-min-style")) return;
    const s = document.createElement("style");
    s.id = "cx-vm-min-style";
    s.textContent = CX_VM_CSS;
    document.head.appendChild(s);
  } catch {}
})();

function VerseMenu({
  anchor, // DOMRect of the clicked verse
  verse, // verse object {n, kjv, web, ...}
  passage, // {book, bookId, chapter}
  primary,
  currentHighlight, // string | null — current colour for this verse
  highlightColor,
  onClose,
  onToggleHighlight
}) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, side: "right" });

  // Position the menu next to the verse, flipping if it would overflow.
  useLayoutEffect(() => {
    if (!anchor) return;
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth || 230;
    const h = el.offsetHeight || 190;
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
  }, [anchor]);

  // A11y — restore focus to the opener on close.
  const triggerRef = useRef(null);
  if (triggerRef.current === null) {
    try {triggerRef.current = document.activeElement;} catch (_) {triggerRef.current = false;}
  }
  const close = () => {
    try {
      const el = triggerRef.current;
      if (el && el !== false && typeof el.focus === "function" && document.contains(el)) el.focus();
    } catch (_) {}
    onClose();
  };

  // Focus the first row on open; Esc closes; ↑/↓ walk every actionable
  // control (verb buttons + rows) in document order.
  useEffect(() => {
    try {
      const first = ref.current && ref.current.querySelector(".cx-vm-verb, .cx-vm-row");
      if (first) first.focus();
    } catch (_) {}
    // eslint-disable-next-line
  }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {e.preventDefault();close();return;}
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const root = ref.current;
      if (!root) return;
      e.preventDefault();
      const items = Array.prototype.slice.call(root.querySelectorAll(".cx-vm-verb, .cx-vm-row"));
      if (!items.length) return;
      const i = items.indexOf(document.activeElement);
      const next = e.key === "ArrowDown" ?
      items[Math.min(items.length - 1, i + 1)] || items[0] :
      items[Math.max(0, i - 1)] || items[items.length - 1];
      try {next.focus();} catch (_) {}
    };
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) close();
    };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
    };
    // eslint-disable-next-line
  }, [onClose]);

  const ref$ = `${passage.book} ${passage.chapter}:${verse?.n ?? "?"}`;
  const depthRef = `${passage.book}.${passage.chapter}.${verse?.n ?? ""}`;
  const emitDepth = (type, weight) => {
    try {
      window.dispatchEvent(new CustomEvent("codex:depth-action", { detail: { type, ref: depthRef, weight } }));
    } catch (_) {}
  };
  const osOpen = (kind, depthType) => {
    if (depthType) emitDepth(depthType, 2);
    try {window.dispatchEvent(new CustomEvent("codex:os-open", { detail: { kind, ref: ref$ } }));} catch (_) {}
    close();
  };

  const VERBS = [
  { kind: "sword", glyph: "⚔", label: "SWORD", title: "Sword — fourfold edge · pardes × quadriga", depth: "sword-cleave" },
  { kind: "mirror", glyph: "⌬", label: "MIRROR", title: vmt("vm.mirror", "Mirror — the verse across every translation"), depth: null },
  { kind: "map", glyph: "◎", label: "MAP", title: vmt("vm.map", "Map — place · era · timeline"), depth: "map-place-study" }];


  return (/*#__PURE__*/
    React.createElement("div", { ref: ref, className: `cx-vm cx-vm-min cx-vm-${pos.side}`,
      style: { top: pos.top + "px", left: pos.left + "px" },
      role: "menu", "aria-label": `Verse menu — ${ref$}`,
      onClick: (e) => e.stopPropagation() }, /*#__PURE__*/
    React.createElement("div", { className: "cx-vm-head" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-ref" }, ref$), /*#__PURE__*/
    React.createElement("button", { className: "cx-vm-x", onClick: close, "aria-label": "Close" }, "\xD7")
    ), /*#__PURE__*/

    React.createElement("div", { className: "cx-vm-body" }, /*#__PURE__*/

    React.createElement("div", { className: "cx-vm-verbs", role: "group", "aria-label": "Depth verbs" },
    VERBS.map((v) => /*#__PURE__*/
    React.createElement("button", { key: v.kind, className: "cx-vm-verb", role: "menuitem",
      title: v.title, onClick: () => osOpen(v.kind, v.depth) }, /*#__PURE__*/
    React.createElement("i", { "aria-hidden": true }, v.glyph), /*#__PURE__*/React.createElement("span", null, v.label)
    )
    )
    ), /*#__PURE__*/

    React.createElement("button", { className: `cx-vm-row ${currentHighlight ? "is-on" : ""}`, role: "menuitem",
      onClick: () => {onToggleHighlight && onToggleHighlight();close();} }, /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-icon" }, currentHighlight ? "✓" : "✦"), /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-lbl" }, currentHighlight ? vmt("vm.unmark", "UNMARK") : vmt("vm.mark", "MARK")), /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-sub" }, currentHighlight ? currentHighlight : highlightColor || "amber")
    ), /*#__PURE__*/

    React.createElement("button", { className: "cx-vm-row", role: "menuitem", onClick: () => osOpen("compare") }, /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-icon" }, "\u2295"), /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-lbl" }, vmt("vm.compare", "COMPARE")), /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-sub" }, "all translations")
    ), /*#__PURE__*/

    React.createElement("button", { className: "cx-vm-row", role: "menuitem",
      onClick: () => {close();if (window.codexOpenOmni) window.codexOpenOmni(`${ref$} `);} }, /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-icon" }, "\u2318"), /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-lbl" }, "more\u2026"), /*#__PURE__*/
    React.createElement("span", { className: "cx-vm-sub" }, "everything, via the omnibar")
    )
    )
    ));

}

Object.assign(window, { VerseMenu });
})();
