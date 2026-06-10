// GENERATED from notes.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
// CODEX — floating study notes widget.
//
// A draggable, hidable, persistent notes pad. Designed for scholars who
// keep margin notes while reading: pin to the current verse, jot a thought,
// hide when distracting, drag wherever doesn't block scripture.
//
// State lives entirely in localStorage so notes survive every reload, ride
// the codex.* export with the rest of the user's data, and never leak to
// any server.
//
// Public API:
//   <Notes passage={passage} currentVerse={n} onJumpTo={fn} />
//   passage   : { bookId, chapter, book, ... } from App
//   currentVerse : current cursor verse number (for the pin-to-verse action)
//   onJumpTo  : ({ref}) => void   — used to navigate when clicking a saved note

const NOTES_KEY = "codex.notes.v1"; // array of saved notes
const NOTES_DRAFT = "codex.notes.draft"; // unsaved textarea content
const NOTES_POS = "codex.notes.pos"; // { right, bottom }
const NOTES_VIS = "codex.notes.visible"; // "1" | "0"
const NOTES_LIST_OP = "codex.notes.listOpen"; // "1" | "0"

function loadNotes() {
  try {return JSON.parse(localStorage.getItem(NOTES_KEY) || "[]");} catch {return [];}
}
function saveNotes(arr) {
  try {localStorage.setItem(NOTES_KEY, JSON.stringify(arr));} catch {}
}

// ── Resize grip · top-left corner of the notes panel
// Notes is anchored bottom-right; grip drags to resize width + height.
// Persists to codex.notes.size for next session.
function NotesResizeGrip({ wrapRef }) {
  const onDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = wrapRef.current;
    if (!el) return;
    const startRect = el.getBoundingClientRect();
    const startX = e.clientX,startY = e.clientY;
    document.body.classList.add("cx-resizing");
    const onMove = (m) => {
      // Top-left grip moves cursor up/left → grow. Compute deltas accordingly.
      const dx = startX - m.clientX; // dragging left grows the panel right→left
      const dy = startY - m.clientY; // dragging up grows upward
      const nextW = Math.max(240, Math.min(window.innerWidth - 32, startRect.width + dx));
      const nextH = Math.max(160, Math.min(window.innerHeight - 32, startRect.height + dy));
      el.style.width = nextW + "px";
      el.style.height = nextH + "px";
    };
    const onUp = () => {
      document.body.classList.remove("cx-resizing");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      try {
        const r = el.getBoundingClientRect();
        localStorage.setItem("codex.notes.size", JSON.stringify({ w: Math.round(r.width), h: Math.round(r.height) }));
      } catch {}
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };
  // Restore persisted size once on mount.
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("codex.notes.size") || "null");
      if (s && wrapRef.current) {
        if (s.w) wrapRef.current.style.width = s.w + "px";
        if (s.h) wrapRef.current.style.height = s.h + "px";
      }
    } catch {}
  }, []);
  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-notes-grip", onMouseDown: onDown, title: "Drag to resize", "aria-label": "Resize notes" }));

}

function Notes({ passage, currentVerse, onJumpTo, onDisable }) {
  const ntx = (k) => window.t && window.t(k) || k;
  const [visible, setVisible] = useState(() => {
    try {return (localStorage.getItem(NOTES_VIS) ?? "1") !== "0";} catch {return true;}
  });
  const [draft, setDraft] = useState(() => {
    try {return localStorage.getItem(NOTES_DRAFT) || "";} catch {return "";}
  });
  const [notes, setNotes] = useState(loadNotes);
  const [listOpen, setListOpen] = useState(() => {
    try {return localStorage.getItem(NOTES_LIST_OP) === "1";} catch {return false;}
  });
  // Transient substring filter — not persisted.
  const [filter, setFilter] = useState("");

  const wrapRef = useRef(null);
  const dragRef = useRef({ dragging: false });
  const offsetRef = useRef(null);
  const taRef = useRef(null);
  const [fmtOpen, setFmtOpen] = useState(false);

  // ── Format helpers ──────────────────────────────────────────────────
  // Wrap or insert markdown around the textarea selection. Restores
  // selection after so the user can keep typing.
  const wrapSelection = (before, after = before, placeholder = "") => {
    const ta = taRef.current;if (!ta) return;
    const start = ta.selectionStart,end = ta.selectionEnd;
    const sel = draft.slice(start, end) || placeholder;
    const next = draft.slice(0, start) + before + sel + after + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + sel.length);
    });
  };
  const linePrefix = (prefix) => {
    const ta = taRef.current;if (!ta) return;
    const start = ta.selectionStart;
    // find start of line
    const lineStart = draft.lastIndexOf("\n", start - 1) + 1;
    const next = draft.slice(0, lineStart) + prefix + draft.slice(lineStart);
    setDraft(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  };
  const fmt = {
    bold: () => wrapSelection("**", "**", "bold"),
    italic: () => wrapSelection("*", "*", "italic"),
    code: () => wrapSelection("`", "`", "code"),
    quote: () => linePrefix("> "),
    h1: () => linePrefix("# "),
    h2: () => linePrefix("## "),
    bullet: () => linePrefix("- "),
    num: () => linePrefix("1. ")
  };

  // ── Export helpers ──────────────────────────────────────────────────
  const exportAs = (mime, ext) => {
    const blob = new Blob([draft], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    a.download = `codex-notes-${stamp}.${ext}`;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const copyAll = async () => {
    try {await navigator.clipboard.writeText(draft);} catch {}
  };

  // Position the widget. Persist as { right, bottom } so it sticks to the
  // bottom-right corner even when the viewport rotates / resizes.
  useEffect(() => {
    if (!visible) return;
    if (offsetRef.current) return;
    try {
      const raw = localStorage.getItem(NOTES_POS);
      const p = raw ? JSON.parse(raw) : null;
      // Default: dock under the right rail so notes feels like an extension
      // of the panels rather than a roaming widget. Right = 16, bottom = 40
      // sits the panel just above the footer at the right edge.
      offsetRef.current = p && typeof p.right === "number" && typeof p.bottom === "number" ?
      p : { right: 16, bottom: 40 };
    } catch {offsetRef.current = { right: 16, bottom: 40 };}
    applyPosition();
  }, [visible]);

  function applyPosition() {
    const el = wrapRef.current;
    if (!el || !offsetRef.current) return;
    const o = offsetRef.current;
    // Clamp to viewport so a stale persisted position doesn't push off-screen
    const w = el.offsetWidth || 280;
    const h = el.offsetHeight || 260;
    const pad = 8;
    const maxRight = Math.max(pad, window.innerWidth - w - pad);
    const maxBottom = Math.max(pad, window.innerHeight - h - pad);
    o.right = Math.min(maxRight, Math.max(pad, o.right));
    o.bottom = Math.min(maxBottom, Math.max(pad, o.bottom));
    el.style.right = o.right + "px";
    el.style.bottom = o.bottom + "px";
  }

  // ── Drag (mouse + touch via pointer events) ───────────────────────────
  const onDragStart = (e) => {
    if (e.target.closest("textarea, button, input, .cx-note-content")) return;
    const el = wrapRef.current;
    if (!el) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    const startOff = { ...offsetRef.current };
    dragRef.current.dragging = true;
    document.body.classList.add("cx-note-dragging");
    const move = (m) => {
      offsetRef.current = {
        right: startOff.right - (m.clientX - start.x),
        bottom: startOff.bottom - (m.clientY - start.y)
      };
      applyPosition();
    };
    const up = () => {
      dragRef.current.dragging = false;
      document.body.classList.remove("cx-note-dragging");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      try {localStorage.setItem(NOTES_POS, JSON.stringify(offsetRef.current));} catch {}
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ── Persistence ───────────────────────────────────────────────────────
  useEffect(() => {try {localStorage.setItem(NOTES_DRAFT, draft);} catch {}}, [draft]);
  useEffect(() => {try {localStorage.setItem(NOTES_VIS, visible ? "1" : "0");} catch {}}, [visible]);
  useEffect(() => {try {localStorage.setItem(NOTES_LIST_OP, listOpen ? "1" : "0");} catch {}}, [listOpen]);

  // Listen for "open + pin" from outside (the verse menu's NOTE item).
  // Detail: { ref?: string }. If ref provided, prefix the draft with it
  // so the user is ready to type with the cited verse already attached.
  useEffect(() => {
    const onShow = (e) => {
      setVisible(true);
      const ref = e?.detail?.ref;
      if (ref) {
        setDraft((d) => {
          const prefix = `[${ref}] `;
          return d.startsWith(prefix) ? d : prefix + d;
        });
      }
    };
    window.addEventListener("codex:notes:show", onShow);
    return () => window.removeEventListener("codex:notes:show", onShow);
  }, []);

  // The `n` shortcut (app.jsx) flips codex.notes.visible in localStorage and
  // dispatches this event. Same-tab localStorage writes don't fire `storage`,
  // so without this listener the shortcut was a silent no-op.
  useEffect(() => {
    const onToggle = () => {
      try {setVisible(localStorage.getItem(NOTES_VIS) !== "0");}
      catch {setVisible((v) => !v);}
    };
    window.addEventListener("codex:notes:toggle", onToggle);
    return () => window.removeEventListener("codex:notes:toggle", onToggle);
  }, []);

  // Refresh from localStorage when imports happen
  useEffect(() => {
    const onStorage = (e) => {if (e.key === NOTES_KEY) setNotes(loadNotes());};
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────
  const currentRef = passage?.book && passage?.chapter ?
  `${passage.book} ${passage.chapter}:${currentVerse}` : "";

  const saveDraft = () => {
    const text = draft.trim();
    if (!text) return;
    const note = {
      id: `n_${Date.now()}`,
      text,
      ref: currentRef,
      ts: Date.now()
    };
    const next = [note, ...notes];
    setNotes(next);
    saveNotes(next);
    if (window.CODEX_ENGAGE) window.CODEX_ENGAGE.trackNote();
    setDraft("");
    setListOpen(true);
  };

  const pinRef = () => {
    if (!currentRef) return;
    setDraft((d) => {
      const prefix = `[${currentRef}] `;
      // Avoid double-prefix
      if (d.startsWith(prefix)) return d;
      return prefix + d;
    });
  };

  const deleteNote = (id) => {
    const next = notes.filter((n) => n.id !== id);
    setNotes(next);
    saveNotes(next);
  };

  const jumpNote = (n) => {
    if (!n.ref || !onJumpTo) return;
    onJumpTo({ ref: n.ref });
  };

  const formatTs = (ts) => {
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getMonth() + 1)}·${pad(d.getDate())}`;
  };

  // No floating handle when hidden. Notes are explicitly summoned via the
  // verse menu "NOTE" item (or the settings toggle) — there's no permanent
  // ✎ icon cluttering the screen any more.
  if (!visible) return null;

  return ReactDOM.createPortal(/*#__PURE__*/
    React.createElement("aside", { ref: wrapRef, className: "cx-notes", role: "complementary", "aria-label": "Study notes" }, /*#__PURE__*/
    React.createElement("header", { className: "cx-notes-h", onPointerDown: onDragStart }, /*#__PURE__*/
    React.createElement("span", { className: "cx-notes-h-tag" }, "\u270E ", ntx("notes.title") || "NOTES"), /*#__PURE__*/
    React.createElement("span", { className: "cx-notes-h-ref" }, currentRef), /*#__PURE__*/
    React.createElement("button", {
      className: "cx-notes-h-min",
      onClick: () => {
        // Hide the widget AND turn the feature off entirely. No floating
        // handle remains. To bring it back: verse menu → NOTE, or
        // Settings → Reading → Enable study notes.
        setVisible(false);
        onDisable?.();
      },
      "aria-label": "Close notes",
      title: "Close (re-open via verse menu \u2192 NOTE, or in Settings)" },
    "\xD7")
    ), /*#__PURE__*/

    React.createElement(NotesResizeGrip, { wrapRef: wrapRef }), /*#__PURE__*/

    React.createElement("div", { className: "cx-notes-body" }, /*#__PURE__*/
    React.createElement("textarea", {
      ref: taRef,
      className: "cx-notes-textarea",
      value: draft,
      onChange: (e) => setDraft(e.target.value),
      placeholder: ntx("notes.placeholder") || "jot a thought… or drag a verse here",
      rows: 4,
      onDragOver: (e) => {
        // Accept drops from the reader (verse drag-out).
        if ([...e.dataTransfer.types].includes("application/codex-verse") || [...e.dataTransfer.types].includes("text/plain")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          e.currentTarget.classList.add("is-drop");
        }
      },
      onDragLeave: (e) => e.currentTarget.classList.remove("is-drop"),
      onDrop: (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove("is-drop");
        const ta = e.currentTarget;
        const verseRaw = e.dataTransfer.getData("application/codex-verse");
        let block;
        if (verseRaw) {
          try {
            const v = JSON.parse(verseRaw);
            block = `> ${v.text}\n— ${v.ref}`;
          } catch {block = e.dataTransfer.getData("text/plain");}
        } else {
          block = e.dataTransfer.getData("text/plain");
        }
        if (!block) return;
        const sep = draft.trim() ? "\n\n" : "";
        const next = draft + sep + block;
        setDraft(next);
        // Restore cursor at the end so the user keeps composing.
        requestAnimationFrame(() => {
          ta.focus();
          ta.setSelectionRange(next.length, next.length);
        });
      } }
    ), /*#__PURE__*/

    React.createElement("div", { className: "cx-notes-actions" }, /*#__PURE__*/
    React.createElement("button", {
      className: "cx-notes-btn cx-notes-pin",
      onClick: pinRef,
      disabled: !currentRef,
      title: ntx("notes.pin.tip") || "Prefix with the current verse reference" },
    "\u27E6 ", currentRef || "—"), /*#__PURE__*/
    React.createElement("span", { className: "cx-notes-fmt-wrap" }, /*#__PURE__*/
    React.createElement("button", {
      className: `cx-notes-btn cx-notes-fmt-trigger ${fmtOpen ? "is-open" : ""}`,
      onClick: () => setFmtOpen((o) => !o),
      title: "Format & export",
      "aria-label": "Format and export",
      "aria-expanded": fmtOpen },
    "\u22EF"),
    fmtOpen ? /*#__PURE__*/
    React.createElement("div", { className: "cx-notes-fmt-pop", role: "dialog", onMouseLeave: () => setFmtOpen(false) }, /*#__PURE__*/
    React.createElement("div", { className: "cx-notes-fmt-row" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-notes-fmt-lbl" }, "FORMAT")
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-notes-fmt-grid" }, /*#__PURE__*/
    React.createElement("button", { className: "cx-notes-fmt-btn", onClick: fmt.bold, title: "Bold (**)" }, /*#__PURE__*/React.createElement("b", null, "B")), /*#__PURE__*/
    React.createElement("button", { className: "cx-notes-fmt-btn", onClick: fmt.italic, title: "Italic (*)" }, /*#__PURE__*/React.createElement("i", null, "I")), /*#__PURE__*/
    React.createElement("button", { className: "cx-notes-fmt-btn", onClick: fmt.code, title: "Code" }, "</>"), /*#__PURE__*/
    React.createElement("button", { className: "cx-notes-fmt-btn", onClick: fmt.h1, title: "Heading 1" }, "H1"), /*#__PURE__*/
    React.createElement("button", { className: "cx-notes-fmt-btn", onClick: fmt.h2, title: "Heading 2" }, "H2"), /*#__PURE__*/
    React.createElement("button", { className: "cx-notes-fmt-btn", onClick: fmt.quote, title: "Blockquote" }, "\u275D"), /*#__PURE__*/
    React.createElement("button", { className: "cx-notes-fmt-btn", onClick: fmt.bullet, title: "Bullet list" }, "\u2022"), /*#__PURE__*/
    React.createElement("button", { className: "cx-notes-fmt-btn", onClick: fmt.num, title: "Numbered" }, "1.")
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-notes-fmt-row" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-notes-fmt-lbl" }, "EXPORT")
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-notes-fmt-export" }, /*#__PURE__*/
    React.createElement("button", { className: "cx-notes-fmt-btn", onClick: () => {copyAll();setFmtOpen(false);} }, "COPY"), /*#__PURE__*/
    React.createElement("button", { className: "cx-notes-fmt-btn", onClick: () => {exportAs("text/markdown", "md");setFmtOpen(false);} }, ".md"), /*#__PURE__*/
    React.createElement("button", { className: "cx-notes-fmt-btn", onClick: () => {exportAs("text/plain", "txt");setFmtOpen(false);} }, ".txt")
    )
    ) :
    null
    ), /*#__PURE__*/
    React.createElement("button", {
      className: "cx-notes-btn cx-notes-save",
      onClick: saveDraft,
      disabled: !draft.trim() },
    ntx("notes.save") || "SAVE")
    ), /*#__PURE__*/

    React.createElement("button", {
      className: "cx-notes-listtoggle",
      onClick: () => setListOpen((o) => !o) }, /*#__PURE__*/

    React.createElement("span", { className: "cx-notes-listtoggle-arr" }, listOpen ? "▾" : "▸"), /*#__PURE__*/
    React.createElement("span", null, ntx("notes.saved") || "saved", " \xB7 ", notes.length)
    ),

    listOpen ? /*#__PURE__*/
    React.createElement(React.Fragment, null,
    notes.length > 0 ? /*#__PURE__*/
    React.createElement("div", { className: "cx-notes-filter" }, /*#__PURE__*/
    React.createElement("input", {
      type: "text",
      value: filter,
      onChange: (e) => setFilter(e.target.value),
      placeholder: ntx("notes.filter") || "filter notes…",
      "aria-label": "Filter notes",
      spellCheck: false }
    ),
    filter ? /*#__PURE__*/React.createElement("button", { className: "cx-search-x", onClick: () => setFilter(""), "aria-label": "Clear" }, "\xD7") : null
    ) :
    null, /*#__PURE__*/
    React.createElement("ul", { className: "cx-notes-list" },
    notes.length === 0 ? /*#__PURE__*/
    React.createElement("li", { className: "cx-notes-empty" }, ntx("notes.empty") || "— no notes yet —") :
    (() => {
      const q = filter.trim().toLowerCase();
      const filtered = q ? notes.filter((n) => (n.text || "").toLowerCase().includes(q) || (n.ref || "").toLowerCase().includes(q)) : notes;
      if (filtered.length === 0) {
        return /*#__PURE__*/React.createElement("li", { className: "cx-notes-empty" }, "\u2014 no match \u2014");
      }
      return filtered.map((n) => /*#__PURE__*/
      React.createElement("li", { key: n.id, className: "cx-notes-item" }, /*#__PURE__*/
      React.createElement("div", { className: "cx-notes-item-h" }, /*#__PURE__*/
      React.createElement("button", {
        className: "cx-notes-item-ref",
        onClick: () => jumpNote(n),
        disabled: !n.ref,
        title: n.ref ? `Jump to ${n.ref}` : "" },
      n.ref || "—"), /*#__PURE__*/
      React.createElement("span", { className: "cx-notes-item-ts" }, formatTs(n.ts)), /*#__PURE__*/
      React.createElement("button", {
        className: "cx-notes-item-del",
        onClick: () => deleteNote(n.id),
        "aria-label": "Delete note",
        title: "Delete" },
      "\xD7")
      ), /*#__PURE__*/
      React.createElement("p", { className: "cx-notes-item-body" }, n.text)
      )
      );
    })()
    )
    ) :
    null
    )
    ),
    document.body
  );
}

Object.assign(window, { Notes });
})();
