// GENERATED from omnibar.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
// CODEX — omnibar.jsx · ⌘K — the one door.
//
//   "For now we see through a glass, darkly; but then face to face."
//                                                       — 1 Cor 13:12
//
// The OS had power scattered behind right-clicks, rail tabs and seven
// consoles. The omnibar is the single surface that reaches all of it —
// type, and the bar UNDERSTANDS:
//
//   John 3:16            → live verse PREVIEW inline, ↵ jumps the reader,
//                          one keystroke more opens any console on it
//   sword John 1:1       → the blade falls         (verbs: sword · mirror ·
//   map Exodus 14          map · art · compare · go · ops)
//   shepherd             → live full-text hits stream in as you type
//   how do the prophets… → ❖ becomes a kernel MISSION (OPS)
//   weave                → ⟐ the LOOM: your reading trail → a cited study
//
// Free of charge, free of friction — freeing the people means zero
// learning curve: one input, every depth. The bar never guesses silently:
// every row says exactly what ↵ will do.
//
// Honest plumbing: previews come from BIBLE.loadChapter, hits from
// CODEX_SEARCH — the same engines the reader trusts everywhere else.

const OMNI_VERBS = {
  sword: { kind: "console", icon: "⚔", label: "SWORD — fourfold edge" },
  mirror: { kind: "console", icon: "⌬", label: "MIRROR — pattern analysis" },
  map: { kind: "console", icon: "◎", label: "MAP — geo intelligence" },
  art: { kind: "console", icon: "▦", label: "ART — paintings & illustrations" },
  compare: { kind: "console", icon: "≡", label: "COMPARE — all translations" },
  go: { kind: "go", icon: "→", label: "GO — jump the reader" },
  ops: { kind: "ops", icon: "❖", label: "OPS — task the kernel" }
};

function omniParseRef(s) {
  const K = window.CODEX_KERNEL;
  return K && K.parseRef ? K.parseRef(s) : null;
}

// ── Universal index — every rail panel, one flat static list. Ids/labels
// mirror panels.jsx builtins + the plugin register calls; icons are the
// rail glyphs. Static by design: the bar must answer even before plugins load.
const PANEL_INDEX = [
{ id: "trans", label: "TRANSLATIONS", icon: "Α/Ω" },
{ id: "talmud", label: "TALMUD", icon: "ת" },
{ id: "comm", label: "COMMENTARY", icon: "§" },
{ id: "gem", label: "GEMATRIA", icon: "Σn" },
{ id: "gnosis", label: "GNOSIS", icon: "⟁" },
{ id: "disarm", label: "DISARM", icon: "⚔" },
{ id: "exeg", label: "EXEGESIS", icon: "✎" },
{ id: "txan", label: "TX·ANALYSIS", icon: "⟷" },
{ id: "plugin:crossrefs-tsk:crossrefs", label: "CROSS-REFS", icon: "✝" },
{ id: "plugin:strongs-concordance:strongs", label: "STRONG'S", icon: "ℋ" },
{ id: "plugin:word-study:word", label: "WORD", icon: "Λ" },
{ id: "plugin:bible-dictionary:dictionary", label: "DICT", icon: "ℵ" },
{ id: "plugin:passage-guide:guide", label: "GUIDE", icon: "❖" },
{ id: "plugin:compare:compare", label: "COMPARE", icon: "⚖" },
{ id: "plugin:jewish-study:torah", label: "TORAH", icon: "ה" },
{ id: "plugin:reading-plans:plans", label: "PLANS", icon: "⥁" },
{ id: "plugin:biblical-timeline:timeline", label: "TIMELINE", icon: "⏳" },
{ id: "plugin:reels:reels", label: "REELS", icon: "▶" },
{ id: "plugin:vox:vox", label: "VOX", icon: "◉" },
{ id: "plugin:continuity:dossier", label: "ANALYST DESK", icon: "▦" },
{ id: "plugin:module-marketplace:market", label: "MARKET", icon: "⊞" },
{ id: "plugin:sermon-builder:builder", label: "STUDIES", icon: "❡" },
{ id: "plugin:ai-quests:quests", label: "QUESTS", icon: "⚔" }];


// Top-level commands ride the same index: consoles the rail doesn't hold.
// Each opens through an existing global/event — no new plumbing invented.
const OMNI_COMMANDS = [
{
  id: "constellation", icon: "❂", aliases: ["constellation", "canon", "threads"],
  title: "Open the Constellation", sub: "the whole canon as one body — every cross-reference, live",
  action: () => {window.codexOpenConstellation && window.codexOpenConstellation();}
},
{
  id: "oracle", icon: "◬", aliases: ["oracle"],
  title: "Open the Oracle", sub: "AI conversation in the left rail",
  action: () => {
    // open-library raises the left rail; the shortcut bus lands on the tab
    window.dispatchEvent(new CustomEvent("codex:open-library"));
    window.dispatchEvent(new CustomEvent("codex:shortcut", { detail: { action: "toggle-oracle" } }));
  }
},
{
  id: "ops", icon: "❖", aliases: ["ops"],
  title: "Open OPS — task the kernel", sub: "mission cockpit, blank slate",
  action: () => {window.codexOpenOps && window.codexOpenOps("");}
},
{
  id: "settings", icon: "⚙", aliases: ["settings", "tweaks"],
  title: "Open Settings", sub: "theme, language, API keys, every tweak",
  action: () => {window.dispatchEvent(new CustomEvent("codex:open-settings", { detail: {} }));}
}];


const omniNorm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");

function omniOpenPanel(id) {
  if (window.codexOpenPanel) {window.codexOpenPanel(id);return;}
  if (id.indexOf("plugin:") === 0) {
    // existing door for plugin tabs — app.jsx normalizes + surfaces the rail
    window.dispatchEvent(new CustomEvent("codex:open-panel", { detail: { panelId: id } }));
    return;
  }
  // builtin tabs have no open event yet — say so instead of guessing
  window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: "panel API not available", kind: "err" } }));
}

// Fuzzy-match the query against panel labels + command aliases.
// strong = label starts with the query (ranks above search hits);
// weak   = label merely contains it (ranks below search hits).
function omniIndexRows(text) {
  const nq = omniNorm(text);
  const strong = [],weak = [];
  if (nq.length < 2) return { strong, weak };
  PANEL_INDEX.forEach((p) => {
    const nl = omniNorm(p.label);
    if (nl.indexOf(nq) === -1) return;
    const row = {
      id: "panel-" + p.id, icon: p.icon, title: `Open ${p.label} panel`,
      sub: "in the study rail",
      action: () => omniOpenPanel(p.id)
    };
    (nl.indexOf(nq) === 0 ? strong : weak).push(row);
  });
  OMNI_COMMANDS.forEach((c) => {
    if (!c.aliases.some((a) => omniNorm(a).indexOf(nq) === 0)) return;
    strong.push({ id: "cmd-" + c.id, icon: c.icon, title: c.title, sub: c.sub, action: c.action });
  });
  return { strong, weak };
}

function Omnibar({ onClose }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState(0);
  const [preview, setPreview] = useState(null); // { ref, text } | null
  const inputRef = useRef(null);
  const seqRef = useRef(0);

  useEffect(() => {inputRef.current?.focus();}, []);

  // ── Understand the query → build rows (debounced; async results race-guarded)
  useEffect(() => {
    const seq = ++seqRef.current;
    const text = q.trim();
    setSel(0);

    if (!text) {setItems([]);setPreview(null);return;}

    const rows = [];
    const finish = (extra) => {
      if (seqRef.current !== seq) return;
      setItems([...rows, ...(extra || [])]);
    };

    // 1 — verb form: "<verb> <rest>"
    const vm = text.match(/^(\w+)\s+(.+)$/);
    const verb = vm && OMNI_VERBS[vm[1].toLowerCase()];
    if (verb) {
      const rest = vm[2].trim();
      if (verb.kind === "ops") {
        rows.push({
          id: "verb-ops", icon: "❖", title: `Mission: ${rest}`,
          sub: "the kernel plans, calls the app's tools, writes a cited artifact",
          action: () => {window.codexOpenOps && window.codexOpenOps(rest);}
        });
      } else {
        const p = omniParseRef(rest);
        if (p) {
          const refStr = `${p.bookName} ${p.chapter}:${p.v1 || 1}`;
          rows.push({
            id: "verb-" + vm[1], icon: verb.icon, title: `${verb.label}`,
            sub: refStr,
            action: verb.kind === "go" ?
            () => {window.codexJumpToRef && window.codexJumpToRef(refStr);} :
            () => {window.dispatchEvent(new CustomEvent("codex:os-open", { detail: { kind: vm[1].toLowerCase(), ref: refStr } }));}
          });
        } else {
          rows.push({ id: "verb-bad", icon: verb.icon, title: verb.label, sub: `couldn't read "${rest}" as a reference`, action: null });
        }
      }
      setPreview(null);
      finish();
      return;
    }

    // 2 — bare reference: live preview + the full verb fan
    const p = omniParseRef(text);
    if (p) {
      const refStr = `${p.bookName} ${p.chapter}${p.v1 ? ":" + p.v1 : ""}`;
      rows.push({
        id: "ref-go", icon: "→", title: `Open ${refStr}`, sub: "jump the reader", primary: true,
        action: () => {window.codexJumpToRef && window.codexJumpToRef(refStr);}
      });
      ["sword", "mirror", "map", "art", "compare"].forEach((k) => {
        const v = OMNI_VERBS[k];
        rows.push({
          id: "ref-" + k, icon: v.icon, title: v.label, sub: `on ${p.bookName} ${p.chapter}:${p.v1 || 1}`,
          action: () => {window.dispatchEvent(new CustomEvent("codex:os-open", { detail: { kind: k, ref: `${p.bookName} ${p.chapter}:${p.v1 || 1}` } }));}
        });
      });
      finish();
      // the dim glass becomes clear: show the verse BEFORE the jump
      const t = setTimeout(async () => {
        try {
          const data = await window.BIBLE.loadChapter(p.bookId, p.chapter, window.CODEX_DATA?.tweaks?.primary || "web");
          if (seqRef.current !== seq) return;
          const vs = data && data.verses || data || [];
          const pick = Array.isArray(vs) ?
          vs.filter((v) => {const n = v.verse || v.n;return p.v1 ? n >= p.v1 && n <= (p.v2 || p.v1) : n <= 3;}) :
          [];
          const textOut = pick.map((v) => `${v.verse || v.n}. ${String(v.text || "").trim()}`).join("  ");
          setPreview(textOut ? { ref: refStr, text: textOut.slice(0, 420) } : null);
        } catch {if (seqRef.current === seq) setPreview(null);}
      }, 140);
      return () => clearTimeout(t);
    }

    // 3 — loom / weave
    if (/^(weave|loom)\b/i.test(text)) {
      rows.push({
        id: "loom", icon: "⟐", title: "Weave the session — the Loom",
        sub: "your reading trail becomes one cited study",
        action: () => {
          window.codexOpenOps && window.codexOpenOps(
            "Weave my session: call session_trail to see what I have been reading, name the thread that connects it, and build a short cited study that ties it together."
          );
        }
      });
      setPreview(null);
      finish();
      return;
    }

    // 4 — free text: live search hits + mission escape hatch
    setPreview(null);
    const isQuestion = /\?|^(how|why|what|where|when|who|trace|compare|build|study)\b/i.test(text);
    const missionRow = {
      id: "ops-free", icon: "❖", title: `Mission: ${text}`,
      sub: "task the kernel — plan, gather, write a cited artifact",
      primary: isQuestion,
      action: () => {window.codexOpenOps && window.codexOpenOps(text);}
    };
    if (isQuestion) rows.push(missionRow);
    // universal index: panel/command rows — strong matches sit above hits
    const idx = omniIndexRows(text);
    idx.strong.forEach((r) => rows.push(r));
    finish();
    if (text.length >= 2 && window.CODEX_SEARCH?.search) {
      const t = setTimeout(async () => {
        try {
          const hits = await window.CODEX_SEARCH.search(text, { limit: 6 });
          if (seqRef.current !== seq) return;
          const fmt = (ref) => {
            // dotted keys ("gen.1.15") → canonical ("Genesis 1:15")
            try {
              const X = window.CODEX_CrossRefLookup;
              if (X && X.formatRef && /^[a-z0-9]+\.\d+\.\d+/i.test(ref)) return X.formatRef(ref);
            } catch {}
            return ref;
          };
          const hitRows = (Array.isArray(hits) ? hits : []).slice(0, 6).map((h, i) => {
            const ref = h.ref || h.id || "";
            return {
              id: "hit-" + i, icon: "Α", title: fmt(ref),
              sub: String(h.text || h.snippet || "").trim().slice(0, 110),
              action: () => {window.codexJumpToRef && window.codexJumpToRef(fmt(ref));}
            };
          });
          finish([...hitRows, ...idx.weak, ...(isQuestion ? [] : [missionRow])]);
        } catch {/* keep whatever rows we had */}
      }, 200);
      return () => clearTimeout(t);
    } else if (!isQuestion) {
      finish([...idx.weak, missionRow]);
    } else if (idx.weak.length) {
      finish([...idx.weak]);
    }
  }, [q]);

  const exec = (row) => {
    if (!row || !row.action) return;
    row.action();
    onClose();
  };

  const onKey = (e) => {
    if (e.key === "Escape") {e.preventDefault();onClose();return;}
    if (e.key === "ArrowDown") {e.preventDefault();setSel((s) => Math.min(s + 1, items.length - 1));return;}
    if (e.key === "ArrowUp") {e.preventDefault();setSel((s) => Math.max(s - 1, 0));return;}
    if (e.key === "Enter") {e.preventDefault();exec(items[sel]);return;}
  };

  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-omni-scrim", onMouseDown: (e) => {if (e.target === e.currentTarget) onClose();} }, /*#__PURE__*/
    React.createElement("div", { className: "cx-omni", role: "dialog", "aria-modal": "true", "aria-label": "Omnibar \u2014 one door to everything" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-omni-bar" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-omni-sigil", "aria-hidden": "true" }, "\u2318"), /*#__PURE__*/
    React.createElement("input", {
      ref: inputRef,
      className: "cx-omni-input",
      placeholder: "ref \xB7 word \xB7 sword John 1:1 \xB7 a question for the kernel \xB7 weave",
      value: q,
      onChange: (e) => setQ(e.target.value),
      onKeyDown: onKey,
      spellCheck: false,
      "aria-label": "Omnibar input" }
    ), /*#__PURE__*/
    React.createElement("kbd", { className: "cx-omni-esc" }, "esc")
    ),

    preview ? /*#__PURE__*/
    React.createElement("div", { className: "cx-omni-preview" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-omni-preview-ref" }, preview.ref), /*#__PURE__*/
    React.createElement("p", null, preview.text)
    ) :
    null,

    items.length ? /*#__PURE__*/
    React.createElement("ul", { className: "cx-omni-list", role: "listbox" },
    items.map((row, i) => /*#__PURE__*/
    React.createElement("li", {
      key: row.id,
      role: "option",
      "aria-selected": i === sel,
      className: `cx-omni-row ${i === sel ? "is-sel" : ""} ${row.primary ? "is-primary" : ""} ${!row.action ? "is-dead" : ""}`,
      onMouseEnter: () => setSel(i),
      onMouseDown: (e) => {e.preventDefault();exec(row);} }, /*#__PURE__*/

    React.createElement("i", { className: "cx-omni-row-icon", "aria-hidden": "true" }, row.icon), /*#__PURE__*/
    React.createElement("div", { className: "cx-omni-row-txt" }, /*#__PURE__*/
    React.createElement("b", null, row.title),
    row.sub ? /*#__PURE__*/React.createElement("span", null, row.sub) : null
    ),
    i === sel && row.action ? /*#__PURE__*/React.createElement("kbd", null, "\u21B5") : null
    )
    )
    ) : /*#__PURE__*/

    React.createElement("div", { className: "cx-omni-idle" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-omni-idle-rows", "aria-hidden": "true" }, /*#__PURE__*/
    React.createElement("span", null, /*#__PURE__*/React.createElement("i", null, "\u2192"), " John 3:16"), /*#__PURE__*/
    React.createElement("span", null, /*#__PURE__*/React.createElement("i", null, "\u2694"), " sword John 1:1"), /*#__PURE__*/
    React.createElement("span", null, /*#__PURE__*/React.createElement("i", null, "\u0391"), " shepherd"), /*#__PURE__*/
    React.createElement("span", null, /*#__PURE__*/React.createElement("i", null, "\u2756"), " how do the prophets use fire?"), /*#__PURE__*/
    React.createElement("span", null, /*#__PURE__*/React.createElement("i", null, "\u27D0"), " weave"), /*#__PURE__*/
    React.createElement("span", null, /*#__PURE__*/React.createElement("i", null, "\u25A4"), " plans \xB7 timeline \xB7 strong's\u2026")
    ), /*#__PURE__*/
    React.createElement("p", { className: "cx-omni-epigraph" }, "\u201CFor now we see through a glass, darkly; but then face to face.\u201D \u2014 1 Cor 13:12")
    )

    )
    ));

}

Object.assign(window, { Omnibar });
})();
