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
  sword:   { kind: "console", icon: "⚔", label: "SWORD — fourfold edge" },
  mirror:  { kind: "console", icon: "⌬", label: "MIRROR — pattern analysis" },
  map:     { kind: "console", icon: "◎", label: "MAP — geo intelligence" },
  art:     { kind: "console", icon: "▦", label: "ART — paintings & illustrations" },
  compare: { kind: "console", icon: "≡", label: "COMPARE — all translations" },
  go:      { kind: "go",      icon: "→", label: "GO — jump the reader" },
  ops:     { kind: "ops",     icon: "❖", label: "OPS — task the kernel" },
};

function omniParseRef(s) {
  const K = window.CODEX_KERNEL;
  return K && K.parseRef ? K.parseRef(s) : null;
}

// ── Universal index — every rail panel, one flat static list. Ids/labels
// mirror panels.jsx builtins + the plugin register calls; icons are the
// rail glyphs. Static by design: the bar must answer even before plugins load.
const PANEL_INDEX = [
  { id: "trans",  label: "TRANSLATIONS", icon: "Α/Ω" },
  { id: "talmud", label: "TALMUD",       icon: "ת" },
  { id: "comm",   label: "COMMENTARY",   icon: "§" },
  { id: "gem",    label: "GEMATRIA",     icon: "Σn" },
  { id: "gnosis", label: "GNOSIS",       icon: "⟁" },
  { id: "disarm", label: "DISARM",       icon: "⚔" },
  { id: "exeg",   label: "EXEGESIS",     icon: "✎" },
  { id: "txan",   label: "TX·ANALYSIS",  icon: "⟷" },
  { id: "plugin:crossrefs-tsk:crossrefs",     label: "CROSS-REFS",   icon: "✝" },
  { id: "plugin:strongs-concordance:strongs", label: "STRONG'S",     icon: "ℋ" },
  { id: "plugin:word-study:word",             label: "WORD",         icon: "Λ" },
  { id: "plugin:bible-dictionary:dictionary", label: "DICT",         icon: "ℵ" },
  { id: "plugin:passage-guide:guide",         label: "GUIDE",        icon: "❖" },
  { id: "plugin:compare:compare",             label: "COMPARE",      icon: "⚖" },
  { id: "plugin:jewish-study:torah",          label: "TORAH",        icon: "ה" },
  { id: "plugin:reading-plans:plans",         label: "PLANS",        icon: "⥁" },
  { id: "plugin:biblical-timeline:timeline",  label: "TIMELINE",     icon: "⏳" },
  { id: "plugin:reels:reels",                 label: "REELS",        icon: "▶" },
  { id: "plugin:vox:vox",                     label: "VOX",          icon: "◉" },
  { id: "plugin:continuity:dossier",          label: "ANALYST DESK", icon: "▦" },
  { id: "plugin:module-marketplace:market",   label: "MARKET",       icon: "⊞" },
  { id: "plugin:sermon-builder:builder",      label: "STUDIES",      icon: "❡" },
  { id: "plugin:ai-quests:quests",            label: "QUESTS",       icon: "⚔" },
];

// Top-level commands ride the same index: consoles the rail doesn't hold.
// Each opens through an existing global/event — no new plumbing invented.
const OMNI_COMMANDS = [
  {
    id: "constellation", icon: "❂", aliases: ["constellation", "canon", "threads"],
    title: "Open the Constellation", sub: "the whole canon as one body — every cross-reference, live",
    action: () => { window.codexOpenConstellation && window.codexOpenConstellation(); },
  },
  {
    id: "oracle", icon: "◬", aliases: ["oracle"],
    title: "Open the Oracle", sub: "AI conversation in the left rail",
    action: () => {
      // open-library raises the left rail; the shortcut bus lands on the tab
      window.dispatchEvent(new CustomEvent("codex:open-library"));
      window.dispatchEvent(new CustomEvent("codex:shortcut", { detail: { action: "toggle-oracle" } }));
    },
  },
  {
    id: "ops", icon: "❖", aliases: ["ops"],
    title: "Open OPS — task the kernel", sub: "mission cockpit, blank slate",
    action: () => { window.codexOpenOps && window.codexOpenOps(""); },
  },
  {
    id: "settings", icon: "⚙", aliases: ["settings", "tweaks"],
    title: "Open Settings", sub: "theme, language, API keys, every tweak",
    action: () => { window.dispatchEvent(new CustomEvent("codex:open-settings", { detail: {} })); },
  },
];

const omniNorm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
// like omniNorm but word-preserving — the "/" palette matches per query word
const omniWords = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// ── Learned usage — codex.cmd.freq.v1 = { [rowId]: { n, last } }.
// Every executed omnibar row records here (hooked once, in exec); the "/"
// palette ranks by n with a gentle recency decay so the user's own habits
// float their commands to the top.
const OMNI_FREQ_KEY = "codex.cmd.freq.v1";
function omniFreqLoad() {
  try { return JSON.parse(localStorage.getItem(OMNI_FREQ_KEY) || "{}") || {}; } catch { return {}; }
}
function omniFreqRecord(id) {
  if (!id) return;
  try {
    const m = omniFreqLoad();
    const e = m[id] || { n: 0, last: 0 };
    e.n += 1; e.last = Date.now();
    m[id] = e;
    localStorage.setItem(OMNI_FREQ_KEY, JSON.stringify(m));
  } catch { /* private mode etc. — learning is a luxury, never a crash */ }
}
function omniFreqScore(map, ids) {
  let s = 0;
  (ids || []).forEach((id) => {
    const e = map[id];
    if (!e || !e.n) return;
    const days = Math.max(0, (Date.now() - (e.last || 0)) / 86400000);
    s += e.n * Math.pow(0.97, days);
  });
  return s;
}

// ── Plain-words descriptions + hidden search keywords for the "/" catalog.
// Users don't know command names: "/talk to ai" must surface the Oracle,
// "/connections" the cross-refs + constellation. Panel descriptions mirror
// panels.jsx PALETTE_DESCRIPTIONS (static by design, same as PANEL_INDEX).
const OMNI_PANEL_DESC = {
  trans: "Translations and side-by-side compare",
  talmud: "Talmudic context and questions",
  comm: "Commentary on the open passage",
  gem: "Gematria and numeric resonance",
  gnosis: "Esoteric / mystical reading layer",
  disarm: "How power twists this verse — and the rebuttals",
  exeg: "Verse-level exegesis",
  txan: "Word-by-word translation analysis",
  "plugin:crossrefs-tsk:crossrefs": "Cross-references for the verse",
  "plugin:strongs-concordance:strongs": "Strong's concordance lookups",
  "plugin:word-study:word": "Deep word studies",
  "plugin:bible-dictionary:dictionary": "Bible dictionary",
  "plugin:passage-guide:guide": "Guided tour of the passage",
  "plugin:compare:compare": "Side-by-side comparison view",
  "plugin:jewish-study:torah": "Torah portions and Jewish lens",
  "plugin:reading-plans:plans": "Reading plans",
  "plugin:biblical-timeline:timeline": "Biblical timeline",
  "plugin:reels:reels": "Short-form scripture reels",
  "plugin:vox:vox": "Voice reading and prayer",
  "plugin:continuity:dossier": "Analyst desk — continuity, mastery, intel log",
  "plugin:module-marketplace:market": "Plugin marketplace",
  "plugin:sermon-builder:builder": "Sermon & study builder",
  "plugin:ai-quests:quests": "Quests and challenges",
};
const OMNI_PANEL_KEYS = {
  trans: "versions languages bibles parallel",
  talmud: "rabbinic jewish judaism sages",
  comm: "explain notes scholars meaning",
  gem: "numbers numerology hebrew letters",
  gnosis: "mystical esoteric hidden secret",
  disarm: "abuse misuse rebuttal apologetics",
  exeg: "interpretation meaning close reading",
  txan: "greek hebrew grammar original language",
  "plugin:crossrefs-tsk:crossrefs": "connections related verses links",
  "plugin:strongs-concordance:strongs": "lexicon concordance greek hebrew",
  "plugin:word-study:word": "etymology vocabulary meaning",
  "plugin:bible-dictionary:dictionary": "definitions encyclopedia lookup",
  "plugin:passage-guide:guide": "tour walkthrough overview",
  "plugin:compare:compare": "differences versions parallel",
  "plugin:jewish-study:torah": "parsha portion hebrew jewish",
  "plugin:reading-plans:plans": "schedule daily devotional habit",
  "plugin:biblical-timeline:timeline": "history chronology dates events",
  "plugin:reels:reels": "video shorts clips watch",
  "plugin:vox:vox": "audio listen speech read aloud",
  "plugin:continuity:dossier": "progress stats history intel",
  "plugin:module-marketplace:market": "plugins addons install extensions",
  "plugin:sermon-builder:builder": "sermon preach write outline",
  "plugin:ai-quests:quests": "games challenges achievements play",
};
const OMNI_VERB_DESC = {
  sword: "fourfold analysis console on any verse",
  mirror: "pattern analysis console on any passage",
  map: "geographic intelligence for any passage",
  art: "paintings and illustrations for any passage",
  compare: "every translation of a verse, side by side",
  go: "jump the reader to any reference",
  ops: "task the kernel with a mission",
};
const OMNI_VERB_KEYS = {
  sword: "analyze deep dive verse",
  mirror: "patterns structure chiasm",
  map: "geography places atlas where",
  art: "images paintings pictures visual",
  compare: "translations versions differences",
  go: "jump navigate goto open reference",
  ops: "mission ai agent research task",
};
const OMNI_CMD_KEYS = {
  constellation: "connections graph network visualize links",
  oracle: "talk to ai chat ask question conversation assistant",
  ops: "mission ai kernel agent task",
  settings: "preferences theme options configure keys",
};

// The FULL command catalog for "/" mode: verbs, every rail panel, top-level
// commands, plus the Loom. Each row carries a plain-words sub + a hidden
// haystack; sorted learned-score desc, then alphabetical. `fill` lets verb
// rows put "<verb> " back into the bar instead of closing (row.stay).
function omniCatalogRows(fill) {
  const freq = omniFreqLoad();
  const out = [];
  const add = (row, keys, scoreIds) => {
    row.hay = omniWords([row.id, row.title, row.sub, keys || ""].join(" "));
    row.score = omniFreqScore(freq, scoreIds || [row.id]);
    out.push(row);
  };
  Object.keys(OMNI_VERBS).forEach((k) => {
    const v = OMNI_VERBS[k];
    add({
      id: "verb-" + k, icon: v.icon, title: v.label,
      sub: `${OMNI_VERB_DESC[k]} — fills "${k} " so you add the reference`,
      stay: true,
      action: () => fill(k + " "),
    }, OMNI_VERB_KEYS[k], ["verb-" + k, "ref-" + k]);
  });
  PANEL_INDEX.forEach((p) => {
    add({
      id: "panel-" + p.id, icon: p.icon, title: `Open ${p.label} panel`,
      sub: OMNI_PANEL_DESC[p.id] || "in the study rail",
      action: () => omniOpenPanel(p.id),
    }, (OMNI_PANEL_KEYS[p.id] || "") + " " + p.label);
  });
  OMNI_COMMANDS.forEach((c) => {
    add({ id: "cmd-" + c.id, icon: c.icon, title: c.title, sub: c.sub, action: c.action },
      (c.aliases || []).join(" ") + " " + (OMNI_CMD_KEYS[c.id] || ""));
  });
  add({
    id: "loom", icon: "⟐", title: "Weave the session — the Loom",
    sub: "your reading trail becomes one cited study",
    action: () => {
      window.codexOpenOps && window.codexOpenOps(
        "Weave my session: call session_trail to see what I have been reading, name the thread that connects it, and build a short cited study that ties it together."
      );
    },
  }, "weave loom summarize session trail synthesize study");
  out.sort((a, b) => (b.score - a.score) || String(a.title).localeCompare(String(b.title)));
  return out;
}

function omniOpenPanel(id) {
  if (window.codexOpenPanel) { window.codexOpenPanel(id); return; }
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
  const strong = [], weak = [];
  if (nq.length < 2) return { strong, weak };
  PANEL_INDEX.forEach((p) => {
    const nl = omniNorm(p.label);
    if (nl.indexOf(nq) === -1) return;
    const row = {
      id: "panel-" + p.id, icon: p.icon, title: `Open ${p.label} panel`,
      sub: "in the study rail",
      action: () => omniOpenPanel(p.id),
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

  useEffect(() => { inputRef.current?.focus(); }, []);

  // ── Understand the query → build rows (debounced; async results race-guarded)
  useEffect(() => {
    const seq = ++seqRef.current;
    const text = q.trim();
    setSel(0);

    if (!text) { setItems([]); setPreview(null); return; }

    // ── "/" — the full command palette, ranked by the user's own habits.
    // Every command in the OS, each with a plain-words description; the
    // filter reads ids, titles, descriptions AND hidden keywords, so
    // "/connect" finds cross-refs + the constellation even if you don't
    // know their names.
    if (text[0] === "/") {
      setPreview(null);
      const fill = (s) => { setQ(s); };
      const all = omniCatalogRows(fill);
      const queryWords = omniWords(text.slice(1)).split(" ").filter(Boolean);
      const filtered = queryWords.length
        ? all.filter((r) => queryWords.every((w) => r.hay.indexOf(w) !== -1))
        : all;
      setItems(filtered.slice(0, 18));
      return;
    }

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
          action: () => { window.codexOpenOps && window.codexOpenOps(rest); },
        });
      } else {
        const p = omniParseRef(rest);
        if (p) {
          const refStr = `${p.bookName} ${p.chapter}:${p.v1 || 1}`;
          rows.push({
            id: "verb-" + vm[1], icon: verb.icon, title: `${verb.label}`,
            sub: refStr,
            action: verb.kind === "go"
              ? () => { window.codexJumpToRef && window.codexJumpToRef(refStr); }
              : () => { window.dispatchEvent(new CustomEvent("codex:os-open", { detail: { kind: vm[1].toLowerCase(), ref: refStr } })); },
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
        action: () => { window.codexJumpToRef && window.codexJumpToRef(refStr); },
      });
      ["sword", "mirror", "map", "art", "compare"].forEach(k => {
        const v = OMNI_VERBS[k];
        rows.push({
          id: "ref-" + k, icon: v.icon, title: v.label, sub: `on ${p.bookName} ${p.chapter}:${p.v1 || 1}`,
          action: () => { window.dispatchEvent(new CustomEvent("codex:os-open", { detail: { kind: k, ref: `${p.bookName} ${p.chapter}:${p.v1 || 1}` } })); },
        });
      });
      finish();
      // the dim glass becomes clear: show the verse BEFORE the jump
      const t = setTimeout(async () => {
        try {
          const data = await window.BIBLE.loadChapter(p.bookId, p.chapter, (window.CODEX_DATA?.tweaks?.primary) || "web");
          if (seqRef.current !== seq) return;
          const vs = (data && data.verses) || data || [];
          const pick = Array.isArray(vs)
            ? vs.filter(v => { const n = v.verse || v.n; return p.v1 ? (n >= p.v1 && n <= (p.v2 || p.v1)) : n <= 3; })
            : [];
          const textOut = pick.map(v => `${v.verse || v.n}. ${String(v.text || "").trim()}`).join("  ");
          setPreview(textOut ? { ref: refStr, text: textOut.slice(0, 420) } : null);
        } catch { if (seqRef.current === seq) setPreview(null); }
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
        },
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
      action: () => { window.codexOpenOps && window.codexOpenOps(text); },
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
              action: () => { window.codexJumpToRef && window.codexJumpToRef(fmt(ref)); },
            };
          });
          finish([...hitRows, ...idx.weak, ...(isQuestion ? [] : [missionRow])]);
        } catch { /* keep whatever rows we had */ }
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
    omniFreqRecord(row.id); // learn the user's habits — "/" ranks by this
    row.action();
    if (row.stay) { inputRef.current?.focus(); return; } // verb rows refill the bar
    onClose();
  };

  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(s + 1, items.length - 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); return; }
    if (e.key === "Enter") { e.preventDefault(); exec(items[sel]); return; }
  };

  return (
    <div className="cx-omni-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cx-omni" role="dialog" aria-modal="true" aria-label="Omnibar — one door to everything">
        <div className="cx-omni-bar">
          <span className="cx-omni-sigil" aria-hidden="true">⌘</span>
          <input
            ref={inputRef}
            className="cx-omni-input"
            placeholder="ref · word · sword John 1:1 · a question for the kernel · weave"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            spellCheck={false}
            aria-label="Omnibar input"
          />
          <kbd className="cx-omni-esc">esc</kbd>
        </div>

        {preview ? (
          <div className="cx-omni-preview">
            <span className="cx-omni-preview-ref">{preview.ref}</span>
            <p>{preview.text}</p>
          </div>
        ) : null}

        {items.length ? (
          <ul className="cx-omni-list" role="listbox">
            {items.map((row, i) => (
              <li
                key={row.id}
                role="option"
                aria-selected={i === sel}
                className={`cx-omni-row ${i === sel ? "is-sel" : ""} ${row.primary ? "is-primary" : ""} ${!row.action ? "is-dead" : ""}`}
                onMouseEnter={() => setSel(i)}
                onMouseDown={(e) => { e.preventDefault(); exec(row); }}
              >
                <i className="cx-omni-row-icon" aria-hidden="true">{row.icon}</i>
                <div className="cx-omni-row-txt">
                  <b>{row.title}</b>
                  {row.sub ? <span>{row.sub}</span> : null}
                </div>
                {i === sel && row.action ? <kbd>↵</kbd> : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="cx-omni-idle">
            <div className="cx-omni-idle-rows" aria-hidden="true">
              <span><i>→</i> John 3:16</span>
              <span><i>⚔</i> sword John 1:1</span>
              <span><i>Α</i> shepherd</span>
              <span><i>❖</i> how do the prophets use fire?</span>
              <span><i>⟐</i> weave</span>
              <span><i>▤</i> plans · timeline · strong's…</span>
              <span><i>/</i> all commands</span>
            </div>
            <p className="cx-omni-epigraph">“For now we see through a glass, darkly; but then face to face.” — 1 Cor 13:12</p>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { Omnibar });
