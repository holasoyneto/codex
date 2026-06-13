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
  // v9 FACE TO FACE — the desk
  {
    id: "focus", icon: "⛶", aliases: ["focus", "zen", "theater", "read"],
    title: "Focus — just the Word", sub: "hide every window but the reader · Esc restores",
    action: () => {
      if (window.codexDesk && window.codexDesk.on()) window.codexDesk.focus();
      else window.dispatchEvent(new KeyboardEvent("keydown", { key: "f" }));
    },
  },
  {
    id: "library", icon: "☰", aliases: ["library", "books", "lib"],
    title: "Open the Library window", sub: "books, chapters, marks, Oracle — place it anywhere",
    action: () => {
      if (window.codexDesk && window.codexDesk.on()) window.codexDesk.open("library");
      else window.dispatchEvent(new CustomEvent("codex:open-library"));
    },
  },
  {
    // v11 — the study deck is dead; "study/panels" now opens the
    // translations window (each panel is its own window — see PANEL_INDEX
    // rows for the rest).
    id: "study", icon: "Α/Ω", aliases: ["study", "panels", "translations"],
    title: "Open the Translations window", sub: "every panel is its own window now — type a panel name for the rest",
    action: () => {
      if (window.codexOpenPanel) window.codexOpenPanel("trans");
    },
  },
  // v11.4 GUIDE MODE — the two doors a lost user reaches for first.
  {
    id: "help", icon: "✶", aliases: ["help", "wiki", "guide", "docs", "manual", "tutorial"],
    title: "Help — how everything works", sub: "the built-in wiki, plain words",
    action: () => { window.dispatchEvent(new CustomEvent("codex:open-settings", { detail: { section: "help" } })); },
  },
  {
    id: "theme", icon: "◐", aliases: ["dark", "light", "theme", "night", "day"],
    title: "Toggle dark / light", sub: "flip the lights",
    action: () => {
      // the ◐ trace button is the canonical toggle; settings → appearance
      // is the honest fallback when the trace isn't mounted (mobile).
      const b = document.querySelector('.cx-trace-btn[aria-label*="theme" i]');
      if (b) b.click();
      else window.dispatchEvent(new CustomEvent("codex:open-settings", { detail: { section: "appearance" } }));
    },
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
  constellation: "connections graph network visualize links galaxy stars map of the canon",
  oracle: "talk to ai chat ask question conversation assistant",
  ops: "mission ai kernel agent task",
  settings: "preferences theme options configure keys",
  focus: "distraction free fullscreen reading mode hide everything zen",
  library: "window books navigation left rail bookmarks oracle",
  study: "window panels translations languages compare",
  help: "lost confused learn start how works what is this manual instructions",
  theme: "dark mode light night day lights appearance switch toggle",
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

// ── v11.4 GUIDE MODE — the bar itself is the guide. ─────────────────────
// Three promises to the lost: the empty bar TEACHES (living examples that
// really run), the input FORGIVES (typos + natural phrases resolve), and
// no keystroke ever ends in nothing (kernel / search / Oracle fallbacks).

// Self-injected styles — idempotent <style id>; styles.css is owned by a
// parallel build right now (same pattern as constellation.jsx).
function omniInjectGuideCss() {
  if (document.getElementById("cx-omni-guide-css")) return;
  const el = document.createElement("style");
  el.id = "cx-omni-guide-css";
  el.textContent = `
    .cx-omni-firstline { font-family: var(--cx-serif, Georgia, serif); font-style: italic;
      font-size: 14.5px; line-height: 1.4; color: var(--cx-fg, #e8e4da); opacity: .92;
      padding: 12px 18px 2px; }
    .cx-omni-guide-cap { font-family: var(--cx-mono, ui-monospace, monospace); font-size: 9px;
      letter-spacing: .16em; text-transform: uppercase; color: var(--cx-fg-dim, #8a8578);
      padding: 10px 18px 0; }
    .cx-omni-row.is-guide .cx-omni-row-txt b { font-family: var(--cx-mono, ui-monospace, monospace);
      font-weight: 600; letter-spacing: .01em; }
    .cx-omni-row.is-guide .cx-omni-row-icon { opacity: .75; }
  `;
  document.head.appendChild(el);
}

// Words that carry intent but not meaning — dropped before loose matching
// so "turn on dark mode" hunts the haystacks with just "dark mode".
const OMNI_STOP = new Set([
  "the", "a", "an", "to", "of", "in", "on", "at", "go", "open", "show",
  "me", "my", "i", "turn", "please", "want", "see", "view", "get", "take",
  "and", "is", "it", "up", "with",
]);

// Generous catalog match: every meaningful query word must appear SOMEWHERE
// in a row's haystack (substring, any order). "open the map" → the MAP verb;
// "turn on dark mode" → the theme toggle. Words under 3 chars are noise.
function omniLooseRows(text, catalog) {
  const words = omniWords(text).split(" ").filter(w => w.length >= 3 && !OMNI_STOP.has(w));
  if (!words.length) return [];
  return catalog.filter(r => words.every(w => r.hay.indexOf(w) !== -1)).slice(0, 5);
}

// Damerau-Levenshtein, early-exit when a row exceeds `max`.
function omniEditDist(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length, n = b.length;
  const d = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, d[i - 2][j - 2] + cost); // transposition — 'Jhon'
      }
      d[i][j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
  }
  return d[m][n];
}

// Matchable spellings for one book: full name, roman→arabic prefix
// ("II Samuel" → "2samuel"), the bare name, and the canonical id. Ids carry
// a half-point penalty: the user typed a WORD, so 'Jhon' must prefer the
// name John (transposition, 1) over Jonah's id 'jon' (deletion, 1 + 0.5).
function omniBookKeys(b) {
  const out = new Map(); // key → penalty
  const add = (s, pen) => {
    const k = String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (k && (!out.has(k) || out.get(k) > pen)) out.set(k, pen);
  };
  add(b.name, 0);
  const m = String(b.name).toLowerCase().match(/^(i{1,3})\s+(.+)$/);
  if (m) { add(m[1].length + " " + m[2], 0); add(m[2], 0); }
  add(b.id, 0.5);
  return [...out.entries()]; // [key, penalty]
}

// FORGIVING REF — when the kernel's parser shrugs, read the human intent:
//   'Jhon 3 16'    → John 3:16   (typo + space-for-colon)
//   'psalm s23'    → Psalms 23   (stray space)
//   'go to psalms' → Psalms 1    (natural phrase, book only)
// Returns { bookId, bookName, chapter, v1, refStr, dist } or null.
function omniFuzzyRef(text) {
  const books = (window.CODEX_DATA && window.CODEX_DATA.books) || [];
  if (!books.length) return null;
  const s = String(text || "").trim().toLowerCase()
    .replace(/^(go to|goto|go|open|read|show me|show|take me to|to)\s+/, "")
    .replace(/[?!.]+$/, "").trim();
  if (s.length < 3 || s[0] === "/") return null;
  const m = s.match(/^([1-3]?\s*[a-z][a-z\s.'’]*?)[\s.,]*(\d{1,3})(?:\s*[:.,;\s-]\s*(\d{1,3}))?$/);
  const bookTok = m ? m[1] : s;
  const qKey = bookTok.replace(/[^a-z0-9]+/g, "");
  if (qKey.length < 3) return null;
  let best = null, bestD = 3;
  for (let i = 0; i < books.length; i++) {
    const keys = omniBookKeys(books[i]);
    for (let k = 0; k < keys.length; k++) {
      const [key, pen] = keys[k];
      const d = ((qKey.length >= 3 && key.indexOf(qKey) === 0)
        ? 0 : omniEditDist(qKey, key, 2)) + pen;
      if (d < bestD) { bestD = d; best = books[i]; if (!d) break; }
    }
    if (best && bestD === 0) break; // canon order wins ties
  }
  if (!best) return null;
  // honesty thresholds — short tokens earn less tolerance; a book-only
  // guess (no chapter digits) must be near-certain or it's just noise.
  const okWithCh = bestD === 0 || (bestD <= 1 && qKey.length >= 4) || (bestD <= 2 && qKey.length >= 6);
  const okBookOnly = bestD === 0 || (bestD <= 1 && qKey.length >= 4);
  if (m ? !okWithCh : !okBookOnly) return null;
  const chapter = m ? Math.max(1, Math.min(best.chapters || 1, parseInt(m[2], 10) || 1)) : 1;
  const v1 = m && m[3] ? parseInt(m[3], 10) : null;
  return {
    bookId: best.id, bookName: best.name, chapter, v1, dist: bestD,
    refStr: `${best.name} ${chapter}${v1 ? ":" + v1 : ""}`,
  };
}

// EMPTY-STATE TEACHES — living examples that EXECUTE on click, rotated from
// the user's least-used capabilities (codex.cmd.freq.v1, inverse). A fresh
// install sees the five canonical doors in this order.
function omniGuideRows(fill) {
  const pool = [
    {
      id: "guide-ref", icon: "→", title: "John 3:16",
      sub: "read a verse — type any reference and the reader goes there",
      ids: ["guide-ref", "ref-go"],
      action: () => { window.codexJumpToRef && window.codexJumpToRef("John 3:16"); },
    },
    {
      id: "guide-sword", icon: "⚔", title: "sword John 1:1",
      sub: "the deep dive — four readings of one verse, side by side",
      ids: ["guide-sword", "ref-sword", "verb-sword"],
      action: () => { window.dispatchEvent(new CustomEvent("codex:os-open", { detail: { kind: "sword", ref: "John 1:1" } })); },
    },
    {
      id: "guide-ops", icon: "❖", title: "what do the prophets say about hope?",
      sub: "ask the kernel — it plans, reads, and writes a cited answer",
      ids: ["guide-ops", "ops-free", "verb-ops"],
      action: () => { window.codexOpenOps && window.codexOpenOps("what do the prophets say about hope?"); },
    },
    {
      id: "guide-galaxy", icon: "❂", title: "galaxy",
      sub: "see the whole canon — every cross-reference as one sky of stars",
      ids: ["guide-galaxy", "cmd-constellation"],
      action: () => { window.codexOpenConstellation && window.codexOpenConstellation(); },
    },
    {
      id: "guide-help", icon: "✶", title: "help",
      sub: "how everything works — the built-in guide, plain words",
      ids: ["guide-help", "cmd-help"],
      action: () => { window.dispatchEvent(new CustomEvent("codex:open-settings", { detail: { section: "help" } })); },
    },
    {
      id: "guide-search", icon: "Α", title: "shepherd",
      sub: "search the whole text — hits stream in as you type", stay: true,
      ids: ["guide-search"],
      action: () => { fill("shepherd"); },
    },
    {
      id: "guide-oracle", icon: "◬", title: "oracle",
      sub: "talk with the AI about whatever you're reading",
      ids: ["guide-oracle", "cmd-oracle"],
      action: () => {
        window.dispatchEvent(new CustomEvent("codex:open-library"));
        window.dispatchEvent(new CustomEvent("codex:shortcut", { detail: { action: "toggle-oracle" } }));
      },
    },
    {
      id: "guide-loom", icon: "⟐", title: "weave",
      sub: "the Loom — your reading trail becomes one cited study",
      ids: ["guide-loom", "loom"],
      action: () => {
        window.codexOpenOps && window.codexOpenOps(
          "Weave my session: call session_trail to see what I have been reading, name the thread that connects it, and build a short cited study that ties it together."
        );
      },
    },
  ];
  const freq = omniFreqLoad();
  return pool
    .map((g, i) => ({ ...g, guide: true, _ord: i, _score: omniFreqScore(freq, g.ids) }))
    .sort((a, b) => (a._score - b._score) || (a._ord - b._ord))
    .slice(0, 5);
}

// NEVER A DEAD END — when nothing matches, these three always do.
function omniFallbackRows(text) {
  return [
    {
      id: "fb-kernel", icon: "❖", title: `ask the kernel: “${text}”`,
      sub: "a mission — it plans, gathers, and writes a cited answer",
      action: () => { window.codexOpenOps && window.codexOpenOps(text); },
    },
    {
      id: "fb-search", icon: "🔍", title: `search the text for “${text}”`,
      sub: "full-text search across the whole canon", stay: true,
      action: null, // bound inside the component — needs setItems
    },
    {
      id: "fb-oracle", icon: "✦", title: "ask the Oracle",
      sub: "open the AI conversation and ask in your own words",
      action: () => {
        window.dispatchEvent(new CustomEvent("codex:open-library"));
        window.dispatchEvent(new CustomEvent("codex:shortcut", { detail: { action: "toggle-oracle" } }));
      },
    },
  ];
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

function Omnibar({ onClose, seed }) {
  // `seed` — optional initial query (the verse menu's '⌘ more…' passes its
  // ref, e.g. "John 1:14 ") so the bar opens already aimed at the verse.
  const [q, setQ] = useState(() => seed || "");
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState(0);
  const [preview, setPreview] = useState(null); // { ref, text } | null
  const inputRef = useRef(null);
  const seqRef = useRef(0);
  // first-ever open → one serif line of welcome; dies after first execution
  const [firstRun] = useState(() => {
    try { return !localStorage.getItem("codex.omni.guided.v1"); } catch { return false; }
  });
  // the "/" catalog is also the loose-match haystack — build once per open
  // (freq only changes on exec), so the hot path stays free of JSON parses
  const catalogRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); omniInjectGuideCss(); }, []);

  // bind the inline-search fallback — needs setItems, so it lives here.
  // Replaces the list with real hits (or an honest "0 hits" + kernel row);
  // the bar stays open: a fallback may never itself dead-end.
  const bindFallbacks = (rows, text) => rows.map((r) => {
    if (r.id !== "fb-search") return r;
    return {
      ...r,
      action: async () => {
        try {
          const hits = window.CODEX_SEARCH?.search ? await window.CODEX_SEARCH.search(text, { limit: 12 }) : [];
          const hitRows = (Array.isArray(hits) ? hits : []).map((h, i) => ({
            id: "fbhit-" + i, icon: "Α", title: String(h.ref || h.id || ""),
            sub: String(h.text || h.snippet || "").trim().slice(0, 110),
            action: () => { window.codexJumpToRef && window.codexJumpToRef(String(h.ref || h.id || "")); },
          }));
          setItems(hitRows.length ? hitRows : [{
            id: "fb-none", icon: "❖", title: `no hits for “${text}” — ask the kernel instead`,
            sub: "it searches deeper: themes, paraphrases, connections",
            action: () => { window.codexOpenOps && window.codexOpenOps(text); },
          }]);
          setSel(0);
        } catch {}
      },
    };
  });

  // ── Understand the query → build rows (debounced; async results race-guarded)
  useEffect(() => {
    const seq = ++seqRef.current;
    const text = q.trim();
    setSel(0);

    const fill = (s) => { setQ(s); };
    const catalog = () => catalogRef.current || (catalogRef.current = omniCatalogRows(fill));

    // ── EMPTY BAR TEACHES — living examples, least-used capabilities first.
    if (!text) { setItems(omniGuideRows(fill)); setPreview(null); return; }

    // ── "/" — the full command palette, ranked by the user's own habits.
    // Every command in the OS, each with a plain-words description; the
    // filter reads ids, titles, descriptions AND hidden keywords, so
    // "/connect" finds cross-refs + the constellation even if you don't
    // know their names.
    if (text[0] === "/") {
      setPreview(null);
      const all = catalog();
      const queryWords = omniWords(text.slice(1)).split(" ").filter(Boolean);
      const filtered = queryWords.length
        ? all.filter((r) => queryWords.every((w) => r.hay.indexOf(w) !== -1))
        : all;
      // never an empty list — even a catalog miss offers the three doors
      setItems(filtered.length ? filtered.slice(0, 18) : bindFallbacks(omniFallbackRows(text.slice(1).trim() || text), text.slice(1).trim() || text));
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
        // exact parse first; then the forgiving parser — "sword Jhon 1:1"
        // and "go to psalms" still land where the user meant.
        const p = omniParseRef(rest);
        const fz = p ? null : omniFuzzyRef(rest);
        const hit = p || fz;
        if (hit) {
          const refStr = `${hit.bookName} ${hit.chapter}:${hit.v1 || 1}`;
          rows.push({
            id: "verb-" + vm[1], icon: verb.icon, title: `${verb.label}`,
            sub: fz && fz.dist > 0 ? `did you mean ${refStr}?` : refStr,
            action: verb.kind === "go"
              ? () => { window.codexJumpToRef && window.codexJumpToRef(refStr); }
              : () => { window.dispatchEvent(new CustomEvent("codex:os-open", { detail: { kind: vm[1].toLowerCase(), ref: refStr } })); },
          });
        } else {
          rows.push({ id: "verb-bad", icon: verb.icon, title: verb.label, sub: `couldn't read "${rest}" as a reference`, action: null });
          rows.push(...bindFallbacks(omniFallbackRows(text), text));
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

    // 4 — free text: forgiving ref, generous commands, live search hits,
    // mission escape hatch — and NEVER an empty list at the end of it.
    setPreview(null);
    const isQuestion = /\?|^(how|why|what|where|when|who|trace|compare|build|study)\b/i.test(text);
    // 4a — the forgiving parser: typos + natural phrases become a ref row
    const fz = omniFuzzyRef(text);
    if (fz) {
      rows.push({
        id: "fuzzy-go", icon: "→", primary: !isQuestion,
        title: fz.dist > 0 ? `Did you mean ${fz.refStr}?` : `Open ${fz.refStr}`,
        sub: "jump the reader",
        action: () => { window.codexJumpToRef && window.codexJumpToRef(fz.refStr); },
      });
    }
    const missionRow = {
      id: "ops-free", icon: "❖", title: `Mission: ${text}`,
      sub: "task the kernel — plan, gather, write a cited artifact",
      primary: isQuestion,
      action: () => { window.codexOpenOps && window.codexOpenOps(text); },
    };
    if (isQuestion) rows.push(missionRow);
    // universal index (name prefixes) + loose haystack matches ("open the
    // map", "turn on dark mode") — strong matches sit above search hits
    const idx = omniIndexRows(text);
    const seen = new Set(rows.map(r => r.id));
    // loose rows capped at 2 here — generous, but search hits stay near the top
    [...idx.strong, ...omniLooseRows(text, catalog()).slice(0, 2)].forEach((r) => {
      if (seen.has(r.id)) return;
      seen.add(r.id);
      rows.push(r);
    });
    const matchedAny = !!fz || rows.some(r => r.id !== "ops-free");
    // assemble the tail: hits + weak index rows, then either the mission
    // escape hatch (something matched) or the three fallback doors (nothing did)
    const assemble = (hitRows) => {
      const tail = [...(hitRows || []), ...idx.weak.filter(r => !seen.has(r.id))];
      if (matchedAny || tail.length) {
        finish([...tail, ...(isQuestion ? [] : [missionRow])]);
      } else {
        const fb = bindFallbacks(omniFallbackRows(text), text)
          .filter(r => !(isQuestion && r.id === "fb-kernel")); // mission row already is the kernel door
        finish(fb);
      }
    };
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
          assemble(hitRows);
        } catch { assemble([]); /* search failed — fallbacks still answer */ }
      }, 200);
      return () => clearTimeout(t);
    } else {
      assemble([]);
    }
  }, [q]);

  const exec = (row) => {
    if (!row || !row.action) return;
    omniFreqRecord(row.id); // learn the user's habits — "/" ranks by this
    try { localStorage.setItem("codex.omni.guided.v1", "1"); } catch {} // first-run line dies forever
    catalogRef.current = null; // freq changed — next catalog build re-ranks
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
          <>
            {!q.trim() && items[0] && items[0].guide ? (
              <>
                {firstRun ? (
                  <div className="cx-omni-firstline">type anything — a verse, a question, a word</div>
                ) : null}
                <div className="cx-omni-guide-cap" aria-hidden="true">try one — every row really runs</div>
              </>
            ) : null}
          <ul className="cx-omni-list" role="listbox">
            {items.map((row, i) => (
              <li
                key={row.id}
                role="option"
                aria-selected={i === sel}
                className={`cx-omni-row ${i === sel ? "is-sel" : ""} ${row.primary ? "is-primary" : ""} ${!row.action ? "is-dead" : ""} ${row.guide ? "is-guide" : ""}`}
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
          </>
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
