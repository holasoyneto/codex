// GENERATED from repo-add.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
// CODEX — add custom Bible repositories at runtime.
// User can register a new translation by name + provider + apiId. The repo is
// persisted in localStorage and merged into CODEX_DATA.translations on every
// boot. Chapter texts then ride the normal bible.js cache.

const REPOS_KEY = "codex.repos.v1";

function loadRepos() {
  try {return JSON.parse(localStorage.getItem(REPOS_KEY) || "[]");}
  catch {return [];}
}
function saveRepos(list) {
  try {localStorage.setItem(REPOS_KEY, JSON.stringify(list));} catch {}
}

// Remove a user-added repo by id. Drops it from CODEX_DATA.translations,
// from the persisted store, and purges any cached chapters so the slot is
// fully recoverable. Returns true if anything was removed.
function removeRepo(id) {
  const data = window.CODEX_DATA;
  if (!data) return false;
  const stored = loadRepos();
  const next = stored.filter((r) => r.id !== id);
  if (next.length === stored.length) return false; // not user-added
  saveRepos(next);
  data.translations = data.translations.filter((t) => t.id !== id);
  try {window.dispatchEvent(new CustomEvent("codex:translations-changed", { detail: { id } }));} catch {}
  // Purge cache entries for this translation.
  try {
    const cache = JSON.parse(localStorage.getItem("codex.bible.cache.v2") || "{}");
    let dirty = false;
    for (const k of Object.keys(cache)) {
      if (k.endsWith("." + id)) {delete cache[k];dirty = true;}
    }
    if (dirty) localStorage.setItem("codex.bible.cache.v2", JSON.stringify(cache));
  } catch {}
  return true;
}

// Merge stored repos into the global translations array exactly once on boot.
(function bootstrapRepos() {
  const stored = loadRepos();
  if (!stored.length) return;
  const data = window.CODEX_DATA;
  if (!data) return;
  const have = new Set(data.translations.map((t) => t.id));
  for (const r of stored) if (!have.has(r.id)) {
    data.translations.push(r);
    try {window.dispatchEvent(new CustomEvent("codex:translations-changed", { detail: { id: r.id } }));} catch {}
  }
})();

// Known providers · catalog of common ids the search auto-completes against.
const PROVIDER_CATALOG = {
  bolls: [
  { id: "nasb", name: "New American Standard", year: "2020", apiId: "NASB" },
  { id: "niv", name: "New International", year: "1984", apiId: "NIV" },
  { id: "nkjv", name: "New King James", year: "1982", apiId: "NKJV" },
  { id: "esv", name: "English Standard", year: "2001", apiId: "ESV" },
  { id: "nlt", name: "New Living", year: "2015", apiId: "NLT" },
  { id: "csb", name: "Christian Standard", year: "2017", apiId: "CSB" },
  { id: "amp", name: "Amplified", year: "2015", apiId: "AMP" },
  { id: "msg", name: "The Message", year: "2002", apiId: "MSG" },
  { id: "net", name: "NET", year: "2017", apiId: "NET" },
  { id: "lsv", name: "Literal Standard", year: "2020", apiId: "LSV" },
  { id: "rv", name: "Revised", year: "1885", apiId: "RV1885" },
  { id: "web2", name: "WEB (Bolls)", year: "2000", apiId: "WEB" },
  { id: "lxx", name: "Septuagint (Greek)", year: "3rd c. BC", apiId: "LXX", lang: "GR" },
  { id: "tr", name: "Textus Receptus", year: "1550", apiId: "TR", lang: "GR" },
  { id: "wlc", name: "Westminster Leningrad", year: "2008", apiId: "WLC", lang: "HE" }],

  "bible-api": [
  { id: "bbe", name: "Basic English", year: "1949", apiId: "bbe" },
  { id: "webbe", name: "WEB · British", year: "2000", apiId: "webbe" },
  { id: "oeb-cw", name: "Open English (CW)", year: "2014", apiId: "oeb-cw" },
  { id: "cherokee", name: "Cherokee NT", year: "1860", apiId: "cherokee", lang: "CHR" },
  { id: "almeida", name: "João Ferreira Almeida", year: "1819", apiId: "almeida", lang: "PT" }]

};

function RepoAdd({ onAdded }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [provider, setProvider] = useState("bolls");
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");

  const existing = new Set((window.CODEX_DATA?.translations || []).map((t) => t.id));
  const catalog = PROVIDER_CATALOG[provider] || [];
  const needle = q.trim().toLowerCase();
  const results = catalog.filter((c) =>
  !existing.has(c.id) && (
  !needle ||
  c.id.includes(needle) ||
  c.name.toLowerCase().includes(needle) ||
  (c.apiId || "").toLowerCase().includes(needle))
  );

  const add = async (entry) => {
    setBusy(entry.id);setErr("");
    const repo = {
      id: entry.id,
      name: entry.name,
      year: entry.year || "—",
      license: "User-added",
      glyph: (entry.apiId || entry.id).toUpperCase().slice(0, 5),
      lang: entry.lang || "EN",
      source: provider,
      apiId: entry.apiId || entry.id
    };
    // Verify it loads — Genesis 1 is the canonical probe.
    try {
      await window.BIBLE.loadChapter("gen", 1, repo.id === repo.apiId ? repo.id : repo.id);
      // bible.js looks up source/apiId via CODEX_DATA, so register first then probe.
    } catch {}
    // Register in-memory + persisted.
    const data = window.CODEX_DATA;
    if (!data.translations.find((t) => t.id === repo.id)) {
      data.translations.push(repo);
      try {window.dispatchEvent(new CustomEvent("codex:translations-changed", { detail: { id: repo.id } }));} catch {}
    }
    const stored = loadRepos();
    if (!stored.find((r) => r.id === repo.id)) {stored.push(repo);saveRepos(stored);}
    // Probe again to actually warm the cache now that registration is complete.
    try {
      await window.BIBLE.loadChapter("gen", 1, repo.id);
    } catch (e) {
      setErr(`Couldn’t reach ${repo.name}: ${e.message || e}`);
    }
    setBusy(null);
    onAdded?.(repo);
  };

  return (/*#__PURE__*/
    React.createElement("div", { className: `cx-repo ${open ? "is-open" : ""}` }, /*#__PURE__*/
    React.createElement("button", { className: "cx-repo-toggle", onClick: () => setOpen((o) => !o) },
    open ? "× close" : "+ add a corpus"
    ),
    open ? /*#__PURE__*/
    React.createElement("div", { className: "cx-repo-panel" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-repo-providers" },
    Object.keys(PROVIDER_CATALOG).map((p) => /*#__PURE__*/
    React.createElement("button", { key: p,
      className: `cx-repo-prov ${provider === p ? "is-on" : ""}`,
      onClick: () => setProvider(p) },
    p
    )
    )
    ), /*#__PURE__*/
    React.createElement("input", {
      className: "cx-repo-input",
      placeholder: "Search \xB7 niv, septuagint, msg\u2026",
      value: q,
      onChange: (e) => setQ(e.target.value),
      spellCheck: false,
      autoFocus: true }
    ), /*#__PURE__*/
    React.createElement("ul", { className: "cx-repo-results" },
    results.length === 0 ? /*#__PURE__*/
    React.createElement("li", { className: "cx-repo-empty" }, "\u2014 ", existing.size > 9 ? "all known repos already added" : "no match in catalog", " \u2014") :
    results.slice(0, 12).map((r) => /*#__PURE__*/
    React.createElement("li", { key: r.id, className: "cx-repo-result" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-repo-r-name" }, /*#__PURE__*/
    React.createElement("b", null, r.name), /*#__PURE__*/
    React.createElement("i", null, r.year, " \xB7 ", r.apiId, r.lang && r.lang !== "EN" ? " · " + r.lang : "")
    ), /*#__PURE__*/
    React.createElement("button", {
      className: "cx-repo-add",
      onClick: () => add(r),
      disabled: busy === r.id },
    busy === r.id ? "…" : "+ add")
    )
    )
    ),
    err ? /*#__PURE__*/React.createElement("p", { className: "cx-repo-err" }, err) : null, /*#__PURE__*/
    React.createElement("p", { className: "cx-repo-hint" }, "Repos cache locally \u2014 every chapter you read is kept for offline study."

    )
    ) :
    null
    ));

}

Object.assign(window, { RepoAdd, loadRepos: loadRepos, saveRepos, removeRepo });
})();
