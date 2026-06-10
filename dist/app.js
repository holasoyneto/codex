// GENERATED from app.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
// CODEX — main app

const { useState, useEffect, useMemo, useRef, useCallback } = React;

// ── Language picker · 4-col grid of glyph pills, matches CODEX aesthetic.
function LangPicker({ value, onChange }) {
  const langs = window.CODEX_LANGS || [{ id: "en", label: "English", glyph: "EN" }];
  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-langs" },
    langs.map((l) => /*#__PURE__*/
    React.createElement("button", {
      key: l.id,
      className: `cx-lang ${value === l.id ? "is-on" : ""}`,
      onClick: () => onChange(l.id),
      title: l.label,
      "aria-pressed": value === l.id }, /*#__PURE__*/

    React.createElement("span", { className: "cx-lang-glyph" }, l.glyph), /*#__PURE__*/
    React.createElement("span", { className: "cx-lang-name" }, l.label)
    )
    )
    ));

}

// ── API keys section · Anthropic + Grok, with a segmented selector for
// which provider drives the Oracle. Anthropic key is synced to the
// existing /api/key server endpoint (preserving current behavior);
// Grok is stored locally for now since the backend doesn't route it yet.
const API_KEYS_STORE = "codex.api.keys.v1";
// IDB-backed write-through so API keys survive iOS Safari ITP eviction
// and localStorage QuotaExceededError silent failures (which strand users
// who entered a key but lost it across reloads because the scripture cache
// had filled local storage). IDB writes are async — kicked off in the
// background; localStorage stays the synchronous source of truth for
// reads (direct-api.js depends on it). On boot we hydrate from IDB if
// localStorage is empty.
const _KEYS_IDB_NAME = "codex-keys";
const _KEYS_IDB_STORE = "kv";
let _keysIdb = null;
function _openKeysIdb() {
  if (_keysIdb) return Promise.resolve(_keysIdb);
  if (!("indexedDB" in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(_KEYS_IDB_NAME, 1);
      req.onupgradeneeded = () => {req.result.createObjectStore(_KEYS_IDB_STORE);};
      req.onsuccess = () => {_keysIdb = req.result;resolve(_keysIdb);};
      req.onerror = () => resolve(null);
    } catch {resolve(null);}
  });
}
async function _idbGetKeys() {
  const db = await _openKeysIdb();if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(_KEYS_IDB_STORE, "readonly");
      const r = tx.objectStore(_KEYS_IDB_STORE).get("api");
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => resolve(null);
    } catch {resolve(null);}
  });
}
async function _idbSetKeys(v) {
  const db = await _openKeysIdb();if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(_KEYS_IDB_STORE, "readwrite");
      tx.objectStore(_KEYS_IDB_STORE).put(v, "api");
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {resolve(false);}
  });
}
// Hydrate localStorage from IDB on cold start if LS is empty (e.g. iOS
// ITP cleared it but IDB survived). Best-effort; fires once.
(function hydrateKeysFromIdb() {
  try {
    const ls = localStorage.getItem(API_KEYS_STORE);
    if (ls) return; // LS already has keys
    _idbGetKeys().then((v) => {
      if (!v || typeof v !== "object") return;
      try {
        if (!localStorage.getItem(API_KEYS_STORE)) {
          localStorage.setItem(API_KEYS_STORE, JSON.stringify(v));
          // Tell anything listening (settings panel, direct-api shim).
          window.dispatchEvent(new CustomEvent("codex:keys:restored", { detail: v }));
        }
      } catch {}
    });
  } catch {}
})();
function loadApiKeys() {
  let v = { active: "anthropic", anthropic: "", grok: "", groq: "", gemini: "" };
  try {v = { ...v, ...JSON.parse(localStorage.getItem(API_KEYS_STORE) || "null") };} catch {}
  v.anthropic = String(v.anthropic || "").trim();
  v.grok = String(v.grok || "").trim();
  v.groq = String(v.groq || "").trim();
  v.gemini = String(v.gemini || "").trim();
  const VALID = new Set(["anthropic", "grok", "groq", "gemini", "ollama"]);
  const has = (a) => a === "ollama" ? true :
  a === "groq" ? !!v.groq :
  a === "grok" ? !!v.grok :
  a === "gemini" ? !!v.gemini :
  !!v.anthropic;
  if (!VALID.has(v.active) || v.active !== "ollama" && !has(v.active)) {
    if (v.anthropic) v.active = "anthropic";else
    if (v.grok) v.active = "grok";else
    if (v.groq) v.active = "groq";else
    if (v.gemini) v.active = "gemini";else
    v.active = "anthropic";
  }
  return v;
}
// Returns { ok, where } so callers can surface real persistence failures
// to the user instead of silently swallowing QuotaExceededError.
function saveApiKeys(v) {
  let lsOk = false;
  try {localStorage.setItem(API_KEYS_STORE, JSON.stringify(v));lsOk = true;} catch {}
  // Always mirror to IDB in the background. If LS failed (quota / ITP),
  // IDB is the only thing keeping the key for the next session — and
  // hydrateKeysFromIdb on the next boot will copy it back into LS once
  // there's room.
  _idbSetKeys(v).catch(() => {});
  return { ok: lsOk, where: lsOk ? "localStorage+idb" : "idb-only" };
}

// Ollama settings live outside the keys blob (no secret material).
const OLLAMA_URL_LS = "codex.ollama.url.v1";
const OLLAMA_MODEL_LS = "codex.ollama.model.v1";
const OLLAMA_DEFAULT_URL = "http://localhost:11434";

function ApiKeysSection() {
  const [keys, setKeys] = useState(loadApiKeys);
  const [showA, setShowA] = useState(false);
  const [showG, setShowG] = useState(false);
  const [showQ, setShowQ] = useState(false);
  const [showM, setShowM] = useState(false);
  const [busyA, setBusyA] = useState(false);
  const [busyG, setBusyG] = useState(false);
  const [busyQ, setBusyQ] = useState(false);
  const [busyM, setBusyM] = useState(false);
  const [statusA, setStatusA] = useState("");
  const [statusG, setStatusG] = useState("");
  const [statusQ, setStatusQ] = useState("");
  const [statusM, setStatusM] = useState("");
  // Ollama state
  const [ollamaUrl, setOllamaUrl] = useState(() => {
    try {return localStorage.getItem(OLLAMA_URL_LS) || OLLAMA_DEFAULT_URL;} catch {return OLLAMA_DEFAULT_URL;}
  });
  const [ollamaModel, setOllamaModel] = useState(() => {
    try {return localStorage.getItem(OLLAMA_MODEL_LS) || "";} catch {return "";}
  });
  const [ollamaProbe, setOllamaProbe] = useState({ status: "idle", models: [], err: "" });
  // Persist on every keystroke so the direct-API shim always sees the
  // latest values; Apply re-broadcasts so any open Oracle re-probes.
  const update = (patch) => {
    // Trim on the way in so a pasted key with stray whitespace doesn't
    // silently fail at Anthropic with "invalid x-api-key" on next load.
    const cleaned = { ...patch };
    if (typeof cleaned.anthropic === "string") cleaned.anthropic = cleaned.anthropic.trim();
    if (typeof cleaned.grok === "string") cleaned.grok = cleaned.grok.trim();
    if (typeof cleaned.groq === "string") cleaned.groq = cleaned.groq.trim();
    if (typeof cleaned.gemini === "string") cleaned.gemini = cleaned.gemini.trim();
    const next = { ...keys, ...cleaned };
    // Auto-detect active provider from the key prefix. Gemini keys vary
    // (usually AIza but not always), so we don't auto-flip on gemini —
    // user clicks the tab if they want it active.
    if (patch.active === undefined) {
      if (cleaned.groq && cleaned.groq.startsWith("gsk_")) next.active = "groq";else
      if (cleaned.anthropic && cleaned.anthropic.startsWith("sk-")) next.active = "anthropic";else
      if (cleaned.grok && cleaned.grok.startsWith("xai-")) next.active = "grok";else
      if (cleaned.gemini && cleaned.gemini.startsWith("AIza")) next.active = "gemini";
      // Re-balance if the currently-active side just got emptied.
      if (next.active === "anthropic" && !next.anthropic) {
        if (next.groq) next.active = "groq";else if (next.grok) next.active = "grok";else if (next.gemini) next.active = "gemini";
      }
      if (next.active === "grok" && !next.grok) {
        if (next.groq) next.active = "groq";else if (next.anthropic) next.active = "anthropic";else if (next.gemini) next.active = "gemini";
      }
      if (next.active === "groq" && !next.groq) {
        if (next.anthropic) next.active = "anthropic";else if (next.grok) next.active = "grok";else if (next.gemini) next.active = "gemini";
      }
      if (next.active === "gemini" && !next.gemini) {
        if (next.anthropic) next.active = "anthropic";else if (next.groq) next.active = "groq";else if (next.grok) next.active = "grok";
      }
    }
    setKeys(next);
    const r = saveApiKeys(next);
    // Surface persistence failures (LS quota / iOS ITP) — silent failure
    // here is why users reported "app doesn't remember my key".
    if (patch.anthropic !== undefined) {
      setStatusA(r.ok ? "" : "⚠ saved to IDB only (localStorage full)");
    }
    if (patch.grok !== undefined) {
      setStatusG(r.ok ? "" : "⚠ saved to IDB only (localStorage full)");
    }
    if (patch.groq !== undefined) {
      setStatusQ(r.ok ? "" : "⚠ saved to IDB only (localStorage full)");
    }
    if (patch.gemini !== undefined) {
      setStatusM(r.ok ? "" : "⚠ saved to IDB only (localStorage full)");
    }
    try {window.CODEX_DIRECT && window.CODEX_DIRECT.notifyEngineChange();} catch {}
  };

  // If IDB hydration completes after this component first mounted (rare
  // but possible on slow IDB opens), pull the restored keys into state.
  useEffect(() => {
    const onRestore = (e) => {
      const v = e?.detail;
      if (!v || typeof v !== "object") return;
      // Only adopt if our state has no key yet (don't clobber).
      setKeys((cur) => cur.anthropic || cur.grok || cur.groq || cur.gemini ? cur : { ...cur, ...v });
    };
    window.addEventListener("codex:keys:restored", onRestore);
    return () => window.removeEventListener("codex:keys:restored", onRestore);
  }, []);

  // Try to push the Anthropic key to /api/key (only succeeds when the
  // Node server is up). On static hosting the shim still has the key in
  // localStorage, so we treat a failed POST as "applied locally".
  const applyAnthropic = async () => {
    const key = (keys.anthropic || "").trim();
    if (!key.startsWith("sk-")) {setStatusA("Key must start with sk-");return;}
    setBusyA(true);setStatusA("");
    try {
      const r = await fetch("/api/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key })
      });
      if (r.ok) {setStatusA("✓ applied");} else
      {setStatusA("✓ saved locally");}
    } catch (e) {
      // No server — that's fine in direct mode, key is already in LS.
      setStatusA("✓ saved locally");
    } finally {
      setBusyA(false);
      try {window.CODEX_DIRECT && window.CODEX_DIRECT.notifyEngineChange();} catch {}
    }
  };

  // Grok lives entirely in localStorage (no server endpoint). Apply just
  // validates the prefix and pings the engine-change listeners.
  const applyGrok = async () => {
    const key = (keys.grok || "").trim();
    if (!key.startsWith("xai-")) {setStatusG("Key must start with xai-");return;}
    setBusyG(true);setStatusG("");
    // Push to /api/key so the Node server (when running) also remembers it
    // and persists to .env. In direct mode the shim accepts xai- keys and
    // sets active=grok; in static-host mode the network call no-ops cleanly.
    try {
      const r = await fetch("/api/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, provider: "xai" })
      });
      setStatusG(r.ok ? "✓ applied" : "✓ saved locally");
    } catch {
      setStatusG("✓ saved locally");
    } finally {
      try {window.CODEX_DIRECT && window.CODEX_DIRECT.notifyEngineChange();} catch {}
      setBusyG(false);
    }
  };

  // Groq (groq.com — free fast inference, distinct from xAI's Grok).
  const applyGroq = async () => {
    const key = (keys.groq || "").trim();
    if (!key.startsWith("gsk_")) {setStatusQ("Key must start with gsk_");return;}
    setBusyQ(true);setStatusQ("");
    try {
      const r = await fetch("/api/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, provider: "groq" })
      });
      setStatusQ(r.ok ? "✓ applied" : "✓ saved locally");
    } catch {
      setStatusQ("✓ saved locally");
    } finally {
      try {window.CODEX_DIRECT && window.CODEX_DIRECT.notifyEngineChange();} catch {}
      setBusyQ(false);
    }
  };

  // Gemini (aistudio.google.com — free, 1M tokens/day). Validate length
  // since Gemini keys don't share a single fixed prefix (usually AIza but
  // GCP-issued keys can vary). Length check at 30+ chars catches typos
  // without falsely rejecting valid keys.
  const applyGemini = async () => {
    const key = (keys.gemini || "").trim();
    if (key.length < 30) {setStatusM("Key looks too short (need ≥30 chars)");return;}
    setBusyM(true);setStatusM("");
    try {
      const r = await fetch("/api/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, provider: "gemini" })
      });
      setStatusM(r.ok ? "✓ applied" : "✓ saved locally");
    } catch {
      setStatusM("✓ saved locally");
    } finally {
      try {window.CODEX_DIRECT && window.CODEX_DIRECT.notifyEngineChange();} catch {}
      setBusyM(false);
    }
  };

  // Ollama: probe ${url}/api/tags to confirm the daemon is running and to
  // populate the model dropdown. Cached briefly; UI calls on tab open + on
  // explicit "Detect" button click.
  const probeOllama = useCallback(async (url) => {
    const u = (url || ollamaUrl || OLLAMA_DEFAULT_URL).replace(/\/+$/, "");
    setOllamaProbe({ status: "probing", models: [], err: "" });
    try {
      const r = await fetch(u + "/api/tags");
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();
      const models = (d.models || []).map((m) => ({ id: m.name, label: m.name }));
      setOllamaProbe({ status: "ok", models, err: "" });
      if (!ollamaModel && models[0]) {
        setOllamaModel(models[0].id);
        try {localStorage.setItem(OLLAMA_MODEL_LS, models[0].id);} catch {}
      }
    } catch (e) {
      setOllamaProbe({ status: "down", models: [], err: String(e.message || e) });
    }
  }, [ollamaUrl, ollamaModel]);
  // Auto-probe once on mount.
  useEffect(() => {probeOllama(ollamaUrl); /* eslint-disable-line */}, []);

  const updateOllamaUrl = (v) => {
    setOllamaUrl(v);
    try {localStorage.setItem(OLLAMA_URL_LS, v);} catch {}
  };
  const updateOllamaModel = (v) => {
    setOllamaModel(v);
    try {localStorage.setItem(OLLAMA_MODEL_LS, v);} catch {}
  };
  const activateOllama = () => {
    update({ active: "ollama" });
  };

  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-api" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-api-seg", role: "tablist", "aria-label": "Active engine" }, /*#__PURE__*/
    React.createElement("button", {
      role: "tab",
      "aria-selected": keys.active === "anthropic",
      className: `cx-api-seg-btn ${keys.active === "anthropic" ? "is-on" : ""}`,
      onClick: () => update({ active: "anthropic" }),
      disabled: !keys.anthropic,
      title: keys.anthropic ? "Use Claude as the Oracle engine" : "Add your Anthropic key first" }, /*#__PURE__*/

    React.createElement("span", { className: "cx-api-seg-glyph" }, "\u25C9"), /*#__PURE__*/
    React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, "Anthropic"), /*#__PURE__*/React.createElement("i", null, "Claude", keys.active === "anthropic" ? " · active" : ""))
    ), /*#__PURE__*/
    React.createElement("button", {
      role: "tab",
      "aria-selected": keys.active === "grok",
      className: `cx-api-seg-btn ${keys.active === "grok" ? "is-on" : ""}`,
      onClick: () => update({ active: "grok" }),
      disabled: !keys.grok,
      title: keys.grok ? "Use Grok as the Oracle engine" : "Add your Grok key first" }, /*#__PURE__*/

    React.createElement("span", { className: "cx-api-seg-glyph" }, "\u232C"), /*#__PURE__*/
    React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, "Grok"), /*#__PURE__*/React.createElement("i", null, "xAI", keys.active === "grok" ? " · active" : ""))
    ), /*#__PURE__*/
    React.createElement("button", {
      role: "tab",
      "aria-selected": keys.active === "groq",
      className: `cx-api-seg-btn ${keys.active === "groq" ? "is-on" : ""}`,
      onClick: () => update({ active: "groq" }),
      disabled: !keys.groq,
      title: keys.groq ? "Use Groq (free fast inference) as the Oracle engine" : "Add your Groq key first" }, /*#__PURE__*/

    React.createElement("span", { className: "cx-api-seg-glyph" }, "\u26A1"), /*#__PURE__*/
    React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, "Groq"), /*#__PURE__*/React.createElement("i", null, "free", keys.active === "groq" ? " · active" : ""))
    ), /*#__PURE__*/
    React.createElement("button", {
      role: "tab",
      "aria-selected": keys.active === "gemini",
      className: `cx-api-seg-btn ${keys.active === "gemini" ? "is-on" : ""}`,
      onClick: () => update({ active: "gemini" }),
      disabled: !keys.gemini,
      title: keys.gemini ? "Use Google Gemini as the Oracle engine" : "Add your Gemini key first" }, /*#__PURE__*/

    React.createElement("span", { className: "cx-api-seg-glyph" }, "\u2726"), /*#__PURE__*/
    React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, "Gemini"), /*#__PURE__*/React.createElement("i", null, "Google", keys.active === "gemini" ? " · active" : ""))
    ), /*#__PURE__*/
    React.createElement("button", {
      role: "tab",
      "aria-selected": keys.active === "ollama",
      className: `cx-api-seg-btn ${keys.active === "ollama" ? "is-on" : ""}`,
      onClick: () => update({ active: "ollama" }),
      disabled: ollamaProbe.status !== "ok",
      title: ollamaProbe.status === "ok" ? "Use your local Ollama daemon" : "Start Ollama locally to enable" }, /*#__PURE__*/

    React.createElement("span", { className: "cx-api-seg-glyph" }, "\u25A3"), /*#__PURE__*/
    React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, "Ollama"), /*#__PURE__*/React.createElement("i", null, "local", keys.active === "ollama" ? " · active" : ""))
    )
    ), /*#__PURE__*/

    React.createElement("div", { className: "cx-api-field" }, /*#__PURE__*/
    React.createElement("label", { className: "cx-api-lbl" }, /*#__PURE__*/
    React.createElement("span", null, "Anthropic API key"),
    statusA ? /*#__PURE__*/React.createElement("em", { className: `cx-api-status ${statusA.startsWith("✓") ? "is-ok" : "is-err"}` }, statusA) : null
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-api-row" }, /*#__PURE__*/
    React.createElement("input", {
      className: "cx-api-input",
      type: showA ? "text" : "password",
      value: keys.anthropic,
      placeholder: "sk-ant-...",
      onChange: (e) => update({ anthropic: e.target.value }),
      onKeyDown: (e) => {if (e.key === "Enter") applyAnthropic();},
      spellCheck: false,
      autoComplete: "off" }
    ), /*#__PURE__*/
    React.createElement("button", { className: "cx-api-eye", onClick: () => setShowA((s) => !s), title: showA ? "Hide" : "Show" }, showA ? "◐" : "◌"), /*#__PURE__*/
    React.createElement("button", { className: "cx-api-save", onClick: applyAnthropic, disabled: busyA || !keys.anthropic },
    busyA ? "···" : "APPLY"
    )
    )
    ), /*#__PURE__*/

    React.createElement("div", { className: "cx-api-field" }, /*#__PURE__*/
    React.createElement("label", { className: "cx-api-lbl" }, /*#__PURE__*/
    React.createElement("span", null, "Grok API key"),
    statusG ? /*#__PURE__*/React.createElement("em", { className: `cx-api-status ${statusG.startsWith("✓") ? "is-ok" : "is-err"}` }, statusG) : null
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-api-row" }, /*#__PURE__*/
    React.createElement("input", {
      className: "cx-api-input",
      type: showG ? "text" : "password",
      value: keys.grok,
      placeholder: "xai-...",
      onChange: (e) => update({ grok: e.target.value }),
      onKeyDown: (e) => {if (e.key === "Enter") applyGrok();},
      spellCheck: false,
      autoComplete: "off" }
    ), /*#__PURE__*/
    React.createElement("button", { className: "cx-api-eye", onClick: () => setShowG((s) => !s), title: showG ? "Hide" : "Show" }, showG ? "◐" : "◌"), /*#__PURE__*/
    React.createElement("button", { className: "cx-api-save", onClick: applyGrok, disabled: busyG || !keys.grok },
    busyG ? "···" : "APPLY"
    )
    ), /*#__PURE__*/
    React.createElement("p", { className: "cx-api-hint" }, "All keys stay in your browser. Switch engines via the toggle above \u2014 takes effect on the next Oracle reply.")
    ), /*#__PURE__*/

    React.createElement("div", { className: "cx-api-field" }, /*#__PURE__*/
    React.createElement("label", { className: "cx-api-lbl" }, /*#__PURE__*/
    React.createElement("span", null, "Groq API key ", /*#__PURE__*/React.createElement("em", { style: { opacity: 0.65 } }, "\xB7 free, fast (groq.com)")),
    statusQ ? /*#__PURE__*/React.createElement("em", { className: `cx-api-status ${statusQ.startsWith("✓") ? "is-ok" : "is-err"}` }, statusQ) : null
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-api-row" }, /*#__PURE__*/
    React.createElement("input", {
      className: "cx-api-input",
      type: showQ ? "text" : "password",
      value: keys.groq,
      placeholder: "gsk_...",
      onChange: (e) => update({ groq: e.target.value }),
      onKeyDown: (e) => {if (e.key === "Enter") applyGroq();},
      spellCheck: false,
      autoComplete: "off" }
    ), /*#__PURE__*/
    React.createElement("button", { className: "cx-api-eye", onClick: () => setShowQ((s) => !s), title: showQ ? "Hide" : "Show" }, showQ ? "◐" : "◌"), /*#__PURE__*/
    React.createElement("button", { className: "cx-api-save", onClick: applyGroq, disabled: busyQ || !keys.groq },
    busyQ ? "···" : "APPLY"
    )
    ), /*#__PURE__*/
    React.createElement("p", { className: "cx-api-hint" }, "Get a free key at ", /*#__PURE__*/React.createElement("code", null, "console.groq.com"), ". Runs Llama 3.3 70B + DeepSeek R1 on LPU silicon.")
    ), /*#__PURE__*/

    React.createElement("div", { className: "cx-api-field" }, /*#__PURE__*/
    React.createElement("label", { className: "cx-api-lbl" }, /*#__PURE__*/
    React.createElement("span", null, "Gemini API key ", /*#__PURE__*/React.createElement("em", { style: { opacity: 0.65 } }, "\xB7 free \xB7 Google AI Studio \xB7 1M tokens/day")),
    statusM ? /*#__PURE__*/React.createElement("em", { className: `cx-api-status ${statusM.startsWith("✓") ? "is-ok" : "is-err"}` }, statusM) : null
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-api-row" }, /*#__PURE__*/
    React.createElement("input", {
      className: "cx-api-input",
      type: showM ? "text" : "password",
      value: keys.gemini,
      placeholder: "AIza... (or any long alphanumeric Gemini key)",
      onChange: (e) => update({ gemini: e.target.value }),
      onKeyDown: (e) => {if (e.key === "Enter") applyGemini();},
      spellCheck: false,
      autoComplete: "off" }
    ), /*#__PURE__*/
    React.createElement("button", { className: "cx-api-eye", onClick: () => setShowM((s) => !s), title: showM ? "Hide" : "Show" }, showM ? "◐" : "◌"), /*#__PURE__*/
    React.createElement("button", { className: "cx-api-save", onClick: applyGemini, disabled: busyM || !keys.gemini },
    busyM ? "···" : "APPLY"
    )
    ), /*#__PURE__*/
    React.createElement("p", { className: "cx-api-hint" }, "Get a free key at ", /*#__PURE__*/React.createElement("code", null, "aistudio.google.com/apikey"), ". Generous free tier \u2014 1M tokens/day, ~15 req/min. Multimodal-ready.")
    ), /*#__PURE__*/

    React.createElement("div", { className: "cx-api-field" }, /*#__PURE__*/
    React.createElement("label", { className: "cx-api-lbl" }, /*#__PURE__*/
    React.createElement("span", null, "Ollama (local, no key) ", /*#__PURE__*/React.createElement("em", { style: { opacity: 0.65 } }, "\xB7 runs on your machine")),
    ollamaProbe.status === "ok" && /*#__PURE__*/
    React.createElement("em", { className: "cx-api-status is-ok" }, "\u2713 ", ollamaProbe.models.length, " model", ollamaProbe.models.length === 1 ? "" : "s", " detected"),

    ollamaProbe.status === "down" && /*#__PURE__*/
    React.createElement("em", { className: "cx-api-status is-err" }, "\u26A0 not detected \u2014 install at ollama.com"),

    ollamaProbe.status === "probing" && /*#__PURE__*/React.createElement("em", { className: "cx-api-status" }, "\u2026probing")
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-api-row" }, /*#__PURE__*/
    React.createElement("input", {
      className: "cx-api-input",
      type: "text",
      value: ollamaUrl,
      placeholder: OLLAMA_DEFAULT_URL,
      onChange: (e) => updateOllamaUrl(e.target.value),
      onKeyDown: (e) => {if (e.key === "Enter") probeOllama(ollamaUrl);},
      spellCheck: false,
      autoComplete: "off" }
    ), /*#__PURE__*/
    React.createElement("button", { className: "cx-api-save", onClick: () => probeOllama(ollamaUrl), title: "Probe ${url}/api/tags" }, "DETECT"

    )
    ),
    ollamaProbe.status === "ok" && /*#__PURE__*/
    React.createElement("div", { className: "cx-api-row", style: { marginTop: 6 } }, /*#__PURE__*/
    React.createElement("select", {
      className: "cx-api-input",
      value: ollamaModel,
      onChange: (e) => updateOllamaModel(e.target.value) },

    ollamaProbe.models.map((m) => /*#__PURE__*/
    React.createElement("option", { key: m.id, value: m.id }, m.label)
    )
    ), /*#__PURE__*/
    React.createElement("button", { className: "cx-api-save", onClick: activateOllama, disabled: keys.active === "ollama" },
    keys.active === "ollama" ? "ACTIVE" : "USE"
    )
    ), /*#__PURE__*/

    React.createElement("p", { className: "cx-api-hint" }, "Browser \u2192 ", /*#__PURE__*/React.createElement("code", null, ollamaUrl), " works when Ollama runs on the same machine as your browser. For LAN access, start Ollama with ", /*#__PURE__*/React.createElement("code", null, "OLLAMA_HOST=0.0.0.0"), ".")
    )
    ));

}

// Tiny QR-code component — uses the public api.qrserver.com PNG endpoint
// so we don't ship a 50KB JS QR lib. The data param is URL-encoded.
// Falls back to a plain link if the image fails to load.
function SyncQR({ data, size = 180 }) {
  const [errored, setErrored] = useState(false);
  const enc = encodeURIComponent(data);
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=2&data=${enc}`;
  if (errored) {
    return /*#__PURE__*/React.createElement("div", { className: "cx-sync-qr-fallback" }, /*#__PURE__*/React.createElement("a", { href: data, target: "_blank", rel: "noopener noreferrer" }, data));
  }
  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-sync-qr" }, /*#__PURE__*/
    React.createElement("img", { src: src, alt: "QR code", width: size, height: size, onError: () => setErrored(true) }), /*#__PURE__*/
    React.createElement("a", { className: "cx-sync-qr-link", href: data, target: "_blank", rel: "noopener noreferrer" }, data.length > 48 ? data.slice(0, 48) + "…" : data)
    ));

}

// ── SyncSection — personal-link sync, default = GitHub Gist ──
// One PAT-paste step: app creates a private gist owned by the user, uses
// it as a sync target. The "personal link" is the gist URL — bookmarkable,
// emailable to yourself, copy-pastable to other devices. Same PAT on the
// other device → app finds the gist and joins the sync.
// Popup tutorial modal for the sync feature. Triggered by the "?" button.
function SyncHelpModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {if (e.key === "Escape") onClose();};
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-syncmod-scrim", onMouseDown: onClose }, /*#__PURE__*/
    React.createElement("div", { className: "cx-syncmod", onMouseDown: (e) => e.stopPropagation(), role: "dialog", "aria-modal": "true", "aria-label": "Cross-device sync tutorial" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-syncmod-hd" }, /*#__PURE__*/
    React.createElement("b", null, "How Cross-device sync works"), /*#__PURE__*/
    React.createElement("button", { className: "cx-syncmod-x", onClick: onClose, "aria-label": "Close" }, "\u2715")
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-syncmod-body" }, /*#__PURE__*/
    React.createElement("section", null, /*#__PURE__*/
    React.createElement("h4", null, "What this does"), /*#__PURE__*/
    React.createElement("p", null, "Every device you use opens the same CODEX \u2014 your marks, notes, settings, cached scripture, and Oracle history follow you. Mark a verse on your phone, see it on your laptop within ~60s."



    )
    ), /*#__PURE__*/

    React.createElement("section", null, /*#__PURE__*/
    React.createElement("h4", null, "What stays on each device (never syncs)"), /*#__PURE__*/
    React.createElement("ul", null, /*#__PURE__*/
    React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "API keys"), " \u2014 each device keeps its own. Security."), /*#__PURE__*/
    React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "Boot intro toggle"), " \u2014 per-device preference."), /*#__PURE__*/
    React.createElement("li", null, "Session-only state like the open tab.")
    )
    ), /*#__PURE__*/

    React.createElement("section", null, /*#__PURE__*/
    React.createElement("h4", null, "Where your data lives"), /*#__PURE__*/
    React.createElement("p", null, "In a ", /*#__PURE__*/
    React.createElement("b", null, "private GitHub Gist owned by you"), ". CODEX creates one file (", /*#__PURE__*/
    React.createElement("code", null, "codex-sync.json"), ") the first time you connect. Only requests signed with your token can read it \u2014 GitHub's servers enforce that. I never see your data, your token, or your gist."



    )
    ), /*#__PURE__*/

    React.createElement("section", null, /*#__PURE__*/
    React.createElement("h4", null, "Setup, first device"), /*#__PURE__*/
    React.createElement("ol", null, /*#__PURE__*/
    React.createElement("li", null, "Click ", /*#__PURE__*/React.createElement("b", null, "Open GitHub token page"), " in the Sync section. GitHub opens with the right permission (", /*#__PURE__*/
    React.createElement("code", null, "gist"), ") pre-checked."
    ), /*#__PURE__*/
    React.createElement("li", null, "Scroll down \u2192 ", /*#__PURE__*/React.createElement("b", null, "Generate token"), "."), /*#__PURE__*/
    React.createElement("li", null, "Copy the ", /*#__PURE__*/React.createElement("code", null, "ghp_\u2026"), " string."), /*#__PURE__*/
    React.createElement("li", null, "Paste it back in CODEX \u2192 ", /*#__PURE__*/React.createElement("b", null, "Connect & create personal gist"), ".")
    )
    ), /*#__PURE__*/

    React.createElement("section", null, /*#__PURE__*/
    React.createElement("h4", null, "Adding more devices"), /*#__PURE__*/
    React.createElement("ol", null, /*#__PURE__*/
    React.createElement("li", null, "Once connected, expand ", /*#__PURE__*/React.createElement("b", null, "\"Add another device \u2192\""), "."), /*#__PURE__*/
    React.createElement("li", null, "Scan the QR code with the new device's camera \u2014 it opens CODEX."), /*#__PURE__*/
    React.createElement("li", null, "In Settings on the new device, paste the SAME GitHub token."), /*#__PURE__*/
    React.createElement("li", null, "App finds your existing gist and joins the sync.")
    ), /*#__PURE__*/
    React.createElement("p", { className: "cx-syncmod-aside" }, "The QR contains ", /*#__PURE__*/
    React.createElement("b", null, "only the app URL"), ", never your token. Re-pasting on the new device is the safe way to authorise it (URLs leak through history, screenshots, screen shares \u2014 tokens shouldn't)."



    )
    ), /*#__PURE__*/

    React.createElement("section", null, /*#__PURE__*/
    React.createElement("h4", null, "Sync rhythm"), /*#__PURE__*/
    React.createElement("ul", null, /*#__PURE__*/
    React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "Push:"), " 1.5s after any local change (when auto-sync is on)."), /*#__PURE__*/
    React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "Pull:"), " every 60s while the tab is open."), /*#__PURE__*/
    React.createElement("li", null, "Manual ", /*#__PURE__*/React.createElement("b", null, "\u2191 Push now"), " / ", /*#__PURE__*/React.createElement("b", null, "\u2193 Pull now"), " always available."), /*#__PURE__*/
    React.createElement("li", null, "Conflicts: per-key last-write-wins, merged against last known remote \u2014 keys edited only on Device A and keys edited only on Device B both survive."

    )
    )
    ), /*#__PURE__*/

    React.createElement("section", null, /*#__PURE__*/
    React.createElement("h4", null, "Privacy & cost"), /*#__PURE__*/
    React.createElement("ul", null, /*#__PURE__*/
    React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "Cost:"), " $0. GitHub gists are free, unlimited for personal use."), /*#__PURE__*/
    React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "Access:"), " only people with your token can read the gist."), /*#__PURE__*/
    React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "Revoking:"), " github.com/settings/tokens \u2192 delete the CODEX token. All devices immediately lose sync (their local data is untouched)."
    ), /*#__PURE__*/
    React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "Wiping remote:"), " github.com \u2192 gists \u2192 delete the", /*#__PURE__*/
    React.createElement("code", null, "codex-sync.json"), " gist. Next push recreates it from the current device's state."
    )
    )
    ), /*#__PURE__*/

    React.createElement("section", null, /*#__PURE__*/
    React.createElement("h4", null, "Troubleshooting"), /*#__PURE__*/
    React.createElement("ul", null, /*#__PURE__*/
    React.createElement("li", null, "\"Token is missing the 'gist' scope\" \u2192 the token wasn't created with the gist box checked. Use the in-app", /*#__PURE__*/

    React.createElement("b", null, " Open GitHub token page"), " button \u2014 it pre-checks it."), /*#__PURE__*/
    React.createElement("li", null, "Marks don't appear on Device B \u2192 tap ", /*#__PURE__*/React.createElement("b", null, "\u2193 Pull now"), ". Auto-pull is 60s, manual is instant."
    ), /*#__PURE__*/
    React.createElement("li", null, "Got the token confused with the API key \u2192 API keys (", /*#__PURE__*/
    React.createElement("code", null, "sk-ant-\u2026"), ") are for the Oracle. Sync uses a GitHub PAT (", /*#__PURE__*/
    React.createElement("code", null, "ghp_\u2026"), "). They live in separate boxes.")
    )
    )
    )
    )
    ));

}

function SyncSection() {
  const [backend, setBackendState] = useState(() => window.CODEX_SYNC?.getBackend() || "");
  const [user, setUser] = useState(() => window.CODEX_SYNC?.user || null);
  const [last, setLast] = useState(() => window.CODEX_SYNC?.getLast() || null);
  const [auto, setAuto] = useState(() => window.CODEX_SYNC?.getAuto() || false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(Date.now());
  const [pat, setPat] = useState("");
  const [link, setLink] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if (!window.CODEX_SYNC) return;
    const offAuth = window.CODEX_SYNC.on("auth", (info) => {
      setUser(info.user);
      setBackendState(info.backend || "");
      if (info.user && info.backend === "github") {
        const gl = window.CODEX_SYNC.github.getGistLink?.();
        if (gl) setLink(gl);
      } else {setLink("");}
    });
    const offSynced = window.CODEX_SYNC.on("synced", (info) => setLast(info));
    const offErr = window.CODEX_SYNC.on("error", (e) => setErr(e.message || ""));
    const tick = setInterval(() => setNow(Date.now()), 5000);
    return () => {offAuth();offSynced();offErr();clearInterval(tick);};
  }, []);

  const fmtAgo = (t) => {
    if (!t) return "—";
    const s = Math.floor((now - t) / 1000);
    if (s < 5) return "just now";
    if (s < 60) return s + "s ago";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  };

  const connectGithub = async () => {
    if (!pat.trim()) return;
    setBusy(true);setErr("");
    try {
      const r = await window.CODEX_SYNC.github.connect(pat.trim());
      setLink(r.gistLink || "");
      setPat(""); // never keep in component state
    } catch (e) {setErr(e.message || String(e));}
    setBusy(false);
  };
  const disconnect = async () => {
    if (backend === "github") window.CODEX_SYNC.github.disconnect();else
    if (backend === "firebase") await window.CODEX_SYNC.firebase.signOut();
    setUser(null);setBackendState("");setLink("");
  };
  const pushNow = async () => {
    setBusy(true);setErr("");
    try {await window.CODEX_SYNC.pushNow();} catch (e) {setErr(e.message || String(e));}
    setBusy(false);
  };
  const pullNow = async () => {
    setBusy(true);setErr("");
    try {await window.CODEX_SYNC.pullOnce();} catch (e) {setErr(e.message || String(e));}
    setBusy(false);
  };
  const copyLink = async () => {
    if (!link) return;
    try {await navigator.clipboard.writeText(link);setErr("");} catch {}
  };

  const helpBtn = /*#__PURE__*/
  React.createElement("button", { className: "cx-sync-help-btn", onClick: () => setHelpOpen(true), title: "How sync works", "aria-label": "Open sync tutorial" }, "?"

  );


  if (!backend || !user) {
    return (/*#__PURE__*/
      React.createElement("div", { className: "cx-sync" }, /*#__PURE__*/
      React.createElement(SyncHelpModal, { open: helpOpen, onClose: () => setHelpOpen(false) }), /*#__PURE__*/
      React.createElement("div", { className: "cx-sync-titlebar" }, /*#__PURE__*/
      React.createElement("span", null, "Cross-device sync"),
      helpBtn
      ), /*#__PURE__*/
      React.createElement("div", { className: "cx-sync-setup" }, /*#__PURE__*/
      React.createElement("p", { className: "cx-sync-hint" }, "Sync your marks, notes, settings, and cached scripture across every device you use. Setup takes about 30 seconds \u2014 your data lives in a private gist owned by your GitHub account; only your token can read it."



      ), /*#__PURE__*/



      React.createElement("div", { className: "cx-sync-steps" }, /*#__PURE__*/
      React.createElement("div", { className: "cx-sync-step" }, /*#__PURE__*/
      React.createElement("span", { className: "cx-sync-step-n" }, "1"), /*#__PURE__*/
      React.createElement("div", null, /*#__PURE__*/
      React.createElement("b", null, "Get your GitHub token"), /*#__PURE__*/
      React.createElement("p", null, "Click below \u2014 opens GitHub with the right scope (", /*#__PURE__*/React.createElement("code", null, "gist"), ") pre-checked. Scroll down and hit ", /*#__PURE__*/React.createElement("b", null, "Generate token"), ", then copy."), /*#__PURE__*/
      React.createElement("button", {
        className: "cx-mini-btn",
        onClick: () => {
          const url = "https://github.com/settings/tokens/new?description=CODEX%20sync&scopes=gist";
          // Try popup first (gives focus back to us when closed);
          // fall back to new tab for popup-blocker browsers.
          const w = window.open(url, "codex-gh-token", "width=900,height=700,noopener,noreferrer");
          if (!w) window.open(url, "_blank", "noopener,noreferrer");
        } },
      "\u26A1 Open GitHub token page"

      ), /*#__PURE__*/
      React.createElement("details", { className: "cx-sync-help" }, /*#__PURE__*/
      React.createElement("summary", null, "On a phone? Scan this with your laptop instead"), /*#__PURE__*/
      React.createElement(SyncQR, { data: "https://github.com/settings/tokens/new?description=CODEX%20sync&scopes=gist", size: 160 })
      )
      )
      ), /*#__PURE__*/

      React.createElement("div", { className: "cx-sync-step" }, /*#__PURE__*/
      React.createElement("span", { className: "cx-sync-step-n" }, "2"), /*#__PURE__*/
      React.createElement("div", null, /*#__PURE__*/
      React.createElement("b", null, "Paste the token here"), /*#__PURE__*/
      React.createElement("p", null, "App will create your private gist and turn on sync."), /*#__PURE__*/
      React.createElement("input", {
        className: "cx-sync-cfg",
        type: "password",
        placeholder: "ghp_...",
        value: pat,
        onChange: (e) => setPat(e.target.value),
        spellCheck: false,
        autoComplete: "off",
        style: { fontFamily: "ui-monospace, monospace", padding: "10px", height: "auto" },
        onKeyDown: (e) => {if (e.key === "Enter") connectGithub();} }
      ),
      err ? /*#__PURE__*/React.createElement("p", { className: "cx-sync-err" }, err) : null, /*#__PURE__*/
      React.createElement("button", { className: "cx-mini-btn", onClick: connectGithub, disabled: busy || !pat.trim() },
      busy ? "Connecting…" : "Connect & create personal gist"
      )
      )
      )
      ), /*#__PURE__*/

      React.createElement("details", { className: "cx-sync-help" }, /*#__PURE__*/
      React.createElement("summary", null, "Or use Firebase (Google sign-in, more setup)"), /*#__PURE__*/
      React.createElement(FirebaseSetupBlock, null)
      )
      )
      ));

  }

  // Connected state
  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-sync" }, /*#__PURE__*/
    React.createElement(SyncHelpModal, { open: helpOpen, onClose: () => setHelpOpen(false) }), /*#__PURE__*/
    React.createElement("div", { className: "cx-sync-titlebar" }, /*#__PURE__*/
    React.createElement("span", null, "Cross-device sync"),
    helpBtn
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-sync-active" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-sync-user" },
    user.photo ? /*#__PURE__*/React.createElement("img", { src: user.photo, alt: "", className: "cx-sync-avatar", referrerPolicy: "no-referrer" }) : null, /*#__PURE__*/
    React.createElement("div", null, /*#__PURE__*/
    React.createElement("b", null, user.name || user.email || "(connected)"), /*#__PURE__*/
    React.createElement("em", null, backend === "github" ? "GitHub Gist" : "Firebase · " + (user.email || ""))
    )
    ),

    link ? /*#__PURE__*/
    React.createElement("div", { className: "cx-sync-link" }, /*#__PURE__*/
    React.createElement("span", null, "Your personal sync gist:"), /*#__PURE__*/
    React.createElement("div", { className: "cx-sync-link-row" }, /*#__PURE__*/
    React.createElement("input", { className: "cx-sync-link-input", readOnly: true, value: link, onFocus: (e) => e.target.select() }), /*#__PURE__*/
    React.createElement("button", { className: "cx-mini-btn cx-sync-tiny", onClick: copyLink }, "copy"), /*#__PURE__*/
    React.createElement("a", { className: "cx-mini-btn cx-sync-tiny", href: link, target: "_blank", rel: "noopener noreferrer" }, "open \u2197")
    ), /*#__PURE__*/
    React.createElement("details", { className: "cx-sync-help", style: { marginTop: 6 } }, /*#__PURE__*/
    React.createElement("summary", null, /*#__PURE__*/React.createElement("b", null, "Add another device \u2192"), " two ways"), /*#__PURE__*/
    React.createElement("div", { className: "cx-sync-join" }, /*#__PURE__*/
    React.createElement("p", { className: "cx-sync-hint" }, /*#__PURE__*/
    React.createElement("b", null, "Quick path:"), " open ", /*#__PURE__*/React.createElement("a", { href: location.origin + location.pathname, target: "_blank", rel: "noopener noreferrer" }, location.host + location.pathname), " on the other device, open ", /*#__PURE__*/
    React.createElement("b", null, "Settings \u2192 Cross-device sync"), ", and paste the same GitHub token (the one starting ", /*#__PURE__*/
    React.createElement("code", null, "ghp_"), "). It will find this gist and join the sync."
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-sync-qr-block" }, /*#__PURE__*/
    React.createElement(SyncQR, { data: location.origin + location.pathname, size: 160 }), /*#__PURE__*/
    React.createElement("div", null, /*#__PURE__*/
    React.createElement("p", { className: "cx-sync-hint", style: { margin: 0 } }, "Scan this with your phone camera to open CODEX there, then paste your token. ", /*#__PURE__*/

    React.createElement("b", null, "Your token never leaves this device"
    ), " \u2014 re-pasting it on the new device is the secure way to authorise it."

    )
    )
    )
    )
    )
    ) :
    null, /*#__PURE__*/

    React.createElement("div", { className: "cx-sync-status" }, /*#__PURE__*/
    React.createElement("span", null, "Last sync:"), /*#__PURE__*/
    React.createElement("b", null, last ? `${fmtAgo(last.at)} · ${last.direction === "up" ? "↑ pushed" : "↓ pulled"}${last.changed ? ` ${last.changed} keys` : last.count ? ` ${last.count} keys` : ""}` : "never")
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-sync-row" }, /*#__PURE__*/
    React.createElement("button", { className: "cx-mini-btn", onClick: pushNow, disabled: busy }, "\u2191 Push now"), /*#__PURE__*/
    React.createElement("button", { className: "cx-mini-btn", onClick: pullNow, disabled: busy }, "\u2193 Pull now"), /*#__PURE__*/
    React.createElement("label", { className: "cx-sync-auto" }, /*#__PURE__*/
    React.createElement("input", { type: "checkbox", checked: auto, onChange: (e) => {
        setAuto(e.target.checked);
        window.CODEX_SYNC.setAuto(e.target.checked);
      } }), /*#__PURE__*/
    React.createElement("span", null, "auto-sync on change")
    )
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-sync-row" }, /*#__PURE__*/
    React.createElement("button", { className: "cx-mini-btn cx-sync-tiny", onClick: disconnect, disabled: busy }, "Disconnect")
    ),
    err ? /*#__PURE__*/React.createElement("p", { className: "cx-sync-err" }, err) : null
    )
    ));

}

// Firebase setup form, only shown when user expands the "or use Firebase" details
function FirebaseSetupBlock() {
  const [cfgText, setCfgText] = useState(() => {
    const c = window.CODEX_SYNC?.firebase?.getConfig();
    return c ? JSON.stringify(c, null, 2) : "";
  });
  const [err, setErr] = useState("");
  const save = () => {
    setErr("");
    try {
      const parsed = JSON.parse(cfgText.trim());
      const need = ["apiKey", "authDomain", "projectId", "appId"];
      const missing = need.filter((k) => !parsed[k]);
      if (missing.length) {setErr("Missing: " + missing.join(", "));return;}
      window.CODEX_SYNC.firebase.setConfig(parsed);
      window.location.reload();
    } catch (e) {setErr("Invalid JSON: " + e.message);}
  };
  return (/*#__PURE__*/
    React.createElement(React.Fragment, null, /*#__PURE__*/
    React.createElement("ol", null, /*#__PURE__*/
    React.createElement("li", null, "console.firebase.google.com \u2192 Add project"), /*#__PURE__*/
    React.createElement("li", null, "Auth \u2192 Sign-in method \u2192 Google \u2192 Enable"), /*#__PURE__*/
    React.createElement("li", null, "Firestore Database \u2192 Create database"), /*#__PURE__*/
    React.createElement("li", null, "Project settings \u2192 Add web app \u2192 copy ", /*#__PURE__*/React.createElement("code", null, "firebaseConfig")), /*#__PURE__*/
    React.createElement("li", null, "Paste JSON below + add Firestore rule:", " ", /*#__PURE__*/
    React.createElement("code", null, "match /users/", "{", "uid", "}", "/", "{", "document=**", "}", " ", "{", " allow read, write: if request.auth.uid == uid; ", "}"))
    ), /*#__PURE__*/
    React.createElement("textarea", {
      className: "cx-sync-cfg",
      placeholder: "{ \"apiKey\": \"...\", \"authDomain\": \"...\", \"projectId\": \"...\", \"appId\": \"...\" }",
      value: cfgText,
      onChange: (e) => setCfgText(e.target.value),
      rows: 6,
      spellCheck: false }
    ),
    err ? /*#__PURE__*/React.createElement("p", { className: "cx-sync-err" }, err) : null, /*#__PURE__*/
    React.createElement("button", { className: "cx-mini-btn", onClick: save, disabled: !cfgText.trim() }, "Save Firebase config & reload")
    ));

}

// ── Toast emit helper — the single, app-wide way to surface a notification.
// Plain:  cxToast("Saved", "ok")
// Mark:   cxToast({ variant:"mark", icon:"▦", label:"Mastery", title, desc, kind })
// Everything routes through the ONE codex:toast bus rendered by ToastDock.
function cxToast(msgOrDetail, kind) {
  try {
    const detail = msgOrDetail && typeof msgOrDetail === "object" ?
    msgOrDetail :
    { msg: String(msgOrDetail == null ? "" : msgOrDetail), kind };
    window.dispatchEvent(new CustomEvent("codex:toast", { detail }));
  } catch {}
}

// ── ToastDock — the SINGLE notification renderer. Listens for `codex:toast`
// and shows both plain toasts ({msg,kind}) and rich "mark" variants
// ({variant:'mark',icon,label,title,desc,kind}) in one bottom-right dock.
// Stack up to 3, one lifetime (4200ms; 6000ms under reduced-motion), one
// .is-exiting class, one z-index.
function ToastDock() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const reduced = (() => {
      try {return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;}
      catch {return false;}
    })();
    const LIFETIME = reduced ? 6000 : 4200;
    const onToast = (e) => {
      const d = e.detail || {};
      const kindRaw = d.kind;
      const kind = ["ok", "warn", "err"].includes(kindRaw) ? kindRaw : "info";
      const id = Math.random().toString(36).slice(2);
      if (d.variant === "mark") {
        // Rich milestone/achievement mark. Require at least a title or label.
        const label = String(d.label || "").slice(0, 80);
        const title = String(d.title || "").slice(0, 160);
        const desc = String(d.desc || "").slice(0, 220);
        if (!label && !title && !desc) return;
        setItems((prev) => [...prev, {
          id, variant: "mark", kind,
          icon: d.icon || "▦", label, title, desc
        }].slice(-3));
        setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), LIFETIME);
        return;
      }
      // Plain toast (back-compatible).
      const msg = String(d.msg || "").slice(0, 220);
      if (!msg) return;
      // Suppress AI / fetch error toasts while offline — they'd fail anyway
      // and the OFFLINE pill already tells the user what's going on.
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      if (offline && kindRaw === "err" && /panel|fetch|network|api|model|oracle|generate/i.test(msg)) return;
      setItems((prev) => [...prev, { id, msg, kind }].slice(-3));
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), LIFETIME);
    };
    window.addEventListener("codex:toast", onToast);
    window.__cxToastListener = true;
    return () => {window.removeEventListener("codex:toast", onToast);window.__cxToastListener = false;};
  }, []);
  if (!items.length) return null;
  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-toast-dock", "aria-live": "polite" },
    items.map((t) =>
    t.variant === "mark" ? /*#__PURE__*/
    React.createElement("div", { key: t.id, className: `cx-toast cx-toast--mark cx-toast-${t.kind}` }, /*#__PURE__*/
    React.createElement("span", { className: "cx-toast-icon", "aria-hidden": "true" }, t.icon || "▦"), /*#__PURE__*/
    React.createElement("div", { className: "cx-toast-body" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-toast-label" }, t.label), /*#__PURE__*/
    React.createElement("div", { className: "cx-toast-title" }, t.title), /*#__PURE__*/
    React.createElement("div", { className: "cx-toast-desc" }, t.desc)
    )
    ) : /*#__PURE__*/

    React.createElement("div", { key: t.id, className: `cx-toast cx-toast-${t.kind}` }, t.msg)

    )
    ));

}

// ── AutoCacheTick — pill that surfaces auto-cache progress in the footer.
// Hidden when idle / done. Listens to the events fired by auto-cache.js.
function AutoCacheTick() {
  const [state, setState] = useState({ phase: "idle", done: 0, total: 0, pct: 0 });
  useEffect(() => {
    const onStart = (e) => setState({ phase: "running", done: 0, total: e.detail.total || 0, pct: 0 });
    const onTick = (e) => {
      const d = e.detail || {};
      const total = d.total || 0;
      const done = d.done || 0;
      const pct = total ? Math.min(100, Math.round(done / total * 100)) : 0;
      setState({ phase: "running", done, total, pct });
    };
    const onDone = () => {
      setState({ phase: "done", done: 0, total: 0, pct: 100 });
      // Briefly flash "✓ INSTALLED" then hide.
      setTimeout(() => setState((s) => ({ ...s, phase: "hidden" })), 4000);
    };
    const onErr = () => setState({ phase: "hidden", done: 0, total: 0, pct: 0 });
    window.addEventListener("codex:autocache-start", onStart);
    window.addEventListener("codex:autocache-tick", onTick);
    window.addEventListener("codex:autocache-done", onDone);
    window.addEventListener("codex:autocache-error", onErr);
    return () => {
      window.removeEventListener("codex:autocache-start", onStart);
      window.removeEventListener("codex:autocache-tick", onTick);
      window.removeEventListener("codex:autocache-done", onDone);
      window.removeEventListener("codex:autocache-error", onErr);
    };
  }, []);
  if (state.phase === "idle" || state.phase === "hidden") return null;
  if (state.phase === "done") {
    return /*#__PURE__*/React.createElement(Tick, { className: "cx-hide-mobile cx-autocache is-done" }, "\u2713 INSTALLED");
  }
  return (/*#__PURE__*/
    React.createElement(Tick, { className: "cx-hide-mobile cx-autocache", title: `Caching scripture: ${state.done} / ${state.total} chapters` }, "INSTALL\xA0", /*#__PURE__*/
    React.createElement("b", null, state.pct, "%")
    ));

}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "autoTheme": true,
  "manualDark": true,
  "primaryTranslation": "kjv",
  "fontScale": 22,
  "scanlines": true,
  "accent": "cyan",
  "scriptureFont": "serif",
  "redLetter": true,
  "sideBySide": false,
  "highlightColor": "amber",
  "distractionFree": false,
  "yhwhMode": false,
  "lang": "en",
  "caffeinate": false,
  "notesEnabled": false,
  "oracleFontScale": 14,
  "hermeneuticDriftCompensation": false,
  "bootIntro": false,
  "provider": "anthropic",
  "model": "claude-haiku-4-5-20251001",
  "schizo": false,
  "continuityEnabled": true,
  "continuityThreshold": 1,
  "notifyCadence": "subtle"
} /*EDITMODE-END*/;

const HIGHLIGHT_COLORS = {
  amber: { name: "Amber", swatch: "#ffc46b" },
  cyan: { name: "Cyan", swatch: "#7ee0ff" },
  violet: { name: "Violet", swatch: "#c7a9ff" },
  green: { name: "Green", swatch: "#8de8a8" },
  rose: { name: "Rose", swatch: "#ff8291" }
};

const ACCENT_MAP = {
  cyan: { dark: "#7ee0ff", light: "#0a6884", glow: "rgba(126,224,255,.4)" },
  amber: { dark: "#ffc46b", light: "#7a4a05", glow: "rgba(255,196,107,.4)" },
  green: { dark: "#8de8a8", light: "#0b5c2a", glow: "rgba(141,232,168,.4)" },
  violet: { dark: "#c7a9ff", light: "#4a2da8", glow: "rgba(199,169,255,.4)" }
};

// "John 1:14" → { bookId, chapter, verse }
function parseRef(ref, books) {
  if (!ref) return null;
  const m = ref.trim().match(/^([\dIVX]+\s*)?([A-Za-zé\u00C0-\u017F]+(?:\s+(?:of\s+)?[A-Za-z]+)?)\s+(\d+)(?::(\d+))?/);
  if (!m) return null;
  const prefix = (m[1] || "").trim().replace(/\s+/g, "");
  const word = m[2];
  const ch = parseInt(m[3], 10);
  const v = m[4] ? parseInt(m[4], 10) : 1;
  const wantName = (prefix ? prefix + " " : "") + word;
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const wantNorm = norm(wantName);
  const wantWordNorm = norm(word);
  const book = books.find((b) => norm(b.name) === wantNorm || norm(b.name).startsWith(wantNorm)) ||
  books.find((b) => norm(b.name).includes(wantWordNorm));
  if (!book) return null;
  return { bookId: book.id, chapter: Math.min(ch, book.chapters), verse: v };
}

// Local i18n helper — terse so JSX stays readable. Falls back to the key
// itself if the global i18n module hasn't loaded (defensive).
function tt(k) {return window.t && window.t(k) || k;}

// ── First-run welcome tour ─────────────────────────────────────────────
// Four-step modal overlay. Shown once for genuinely new users (no
// codex.firstRun.v2 and no v1 either). Esc / "skip tour" / "Begin" all
// close it. Arrow keys + Enter navigate. Reduced-motion friendly.
function WelcomeTour({ onClose }) {
  const [step, setStep] = React.useState(0);
  const total = 4;
  const next = React.useCallback(() => {
    setStep((s) => s >= total - 1 ? (onClose(), s) : s + 1);
  }, [onClose]);
  const prev = React.useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {e.preventDefault();onClose();} else
      if (e.key === "Enter") {e.preventDefault();next();} else
      if (e.key === "ArrowRight") {e.preventDefault();next();} else
      if (e.key === "ArrowLeft") {e.preventDefault();prev();}
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [next, prev, onClose]);

  const openSettings = () => {
    try {window.dispatchEvent(new CustomEvent("codex:open-settings", { detail: { section: "api-keys" } }));} catch {}
    next();
  };

  const renderStep = () => {
    if (step === 0) {
      return (/*#__PURE__*/
        React.createElement("div", { className: "cx-welcome-stage cx-welcome-stage--hero" }, /*#__PURE__*/
        React.createElement("p", { className: "cx-welcome-eyebrow", style: { "--cx-w-i": 0 } }, "scripture \xB7 study \xB7 terminal"), /*#__PURE__*/
        React.createElement("h1", { className: "cx-welcome-wordmark", style: { "--cx-w-i": 1 } }, "CODEX"), /*#__PURE__*/
        React.createElement("div", { className: "cx-welcome-scripture", style: { "--cx-w-i": 2 } }, /*#__PURE__*/
        React.createElement("p", { className: "cx-welcome-scripture-greek", lang: "grc" }, "\u1F18\u03BD \u1F00\u03C1\u03C7\u1FC7 \u1F26\u03BD \u1F41 \u039B\u03CC\u03B3\u03BF\u03C2"), /*#__PURE__*/
        React.createElement("p", { className: "cx-welcome-scripture-en" }, "In the beginning was the Word.")
        ), /*#__PURE__*/
        React.createElement("p", { className: "cx-welcome-prompt", style: { "--cx-w-i": 3 } }, /*#__PURE__*/
        React.createElement("span", null, "press"), /*#__PURE__*/
        React.createElement("kbd", null, "\u21B5"), /*#__PURE__*/
        React.createElement("span", null, "to enter study"), /*#__PURE__*/
        React.createElement("span", { className: "cx-welcome-caret", "aria-hidden": "true" }, "\u258D")
        )
        ));

    }
    if (step === 1) {
      const pairs = [
      { keys: ["⌘", "K"], label: "Library · command palette" },
      { keys: ["/"], label: "Smart search · jump anywhere" },
      { keys: ["J", "K"], label: "Next / previous verse" },
      { keys: ["←", "→"], label: "Previous / next chapter · or swipe" },
      { keys: ["?"], label: "Every shortcut" }];

      return (/*#__PURE__*/
        React.createElement("div", { className: "cx-welcome-stage" }, /*#__PURE__*/
        React.createElement("p", { className: "cx-welcome-eyebrow", style: { "--cx-w-i": 0 } }, "02 \xB7 keystrokes"), /*#__PURE__*/
        React.createElement("h2", { className: "cx-welcome-headline2", style: { "--cx-w-i": 1 } }, "Reach anything, instantly."), /*#__PURE__*/
        React.createElement("ul", { className: "cx-welcome-keylist", style: { "--cx-w-i": 2 } },
        pairs.map((p, i) => /*#__PURE__*/
        React.createElement("li", { key: i }, /*#__PURE__*/
        React.createElement("span", { className: "cx-welcome-keys-cell" },
        p.keys.map((k, j) => /*#__PURE__*/React.createElement("kbd", { key: j }, k))
        ), /*#__PURE__*/
        React.createElement("span", { className: "cx-welcome-keys-desc" }, p.label)
        )
        )
        )
        ));

    }
    if (step === 2) {
      return (/*#__PURE__*/
        React.createElement("div", { className: "cx-welcome-stage" }, /*#__PURE__*/
        React.createElement("p", { className: "cx-welcome-eyebrow", style: { "--cx-w-i": 0 } }, "03 \xB7 the oracle"), /*#__PURE__*/
        React.createElement("h2", { className: "cx-welcome-headline2", style: { "--cx-w-i": 1 } }, "Wake the Oracle."), /*#__PURE__*/
        React.createElement("p", { className: "cx-welcome-sub", style: { "--cx-w-i": 2 } }, "Optional. Everything else works without it."), /*#__PURE__*/
        React.createElement("ul", { className: "cx-welcome-locked", style: { "--cx-w-i": 3 } }, /*#__PURE__*/
        React.createElement("li", null, "Commentary"), /*#__PURE__*/
        React.createElement("li", null, "Talmudic parallels"), /*#__PURE__*/
        React.createElement("li", null, "Gnosis overlay"), /*#__PURE__*/
        React.createElement("li", null, "Semantic search")
        ), /*#__PURE__*/
        React.createElement("div", { className: "cx-welcome-pair", style: { "--cx-w-i": 4 } }, /*#__PURE__*/
        React.createElement("button", { className: "cx-welcome-btn cx-welcome-btn--primary", onClick: openSettings }, "Add a key \u2192"), /*#__PURE__*/
        React.createElement("button", { className: "cx-welcome-btn cx-welcome-btn--ghost", onClick: next }, "Skip for now")
        )
        ));

    }
    return (/*#__PURE__*/
      React.createElement("div", { className: "cx-welcome-stage cx-welcome-stage--final" }, /*#__PURE__*/
      React.createElement("p", { className: "cx-welcome-eyebrow", style: { "--cx-w-i": 0 } }, "04 \xB7 open the book"), /*#__PURE__*/
      React.createElement("h2", { className: "cx-welcome-headline2 cx-welcome-headline2--lg", style: { "--cx-w-i": 1 } }, "Begin reading."), /*#__PURE__*/
      React.createElement("p", { className: "cx-welcome-sub cx-welcome-sub--lg", style: { "--cx-w-i": 2 } }, "John 1 is open. Tap any verse number to highlight. Click the title to jump books. Swipe left or right for chapters."


      ), /*#__PURE__*/
      React.createElement("div", { className: "cx-welcome-pair cx-welcome-pair--center", style: { "--cx-w-i": 3 } }, /*#__PURE__*/
      React.createElement("button", { className: "cx-welcome-btn cx-welcome-btn--primary cx-welcome-btn--lg", onClick: next }, "Begin \u2192")
      )
      ));

  };

  const pct = (step + 1) / total * 100;
  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-welcome-backdrop", role: "dialog", "aria-modal": "true", "aria-label": "Welcome to CODEX" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-welcome-scanlines", "aria-hidden": "true" }), /*#__PURE__*/
    React.createElement("div", { className: "cx-welcome-vignette", "aria-hidden": "true" }), /*#__PURE__*/
    React.createElement("button", { className: "cx-welcome-skip", onClick: onClose, "aria-label": "Skip tour" }, "skip tour \u2715"), /*#__PURE__*/
    React.createElement("div", { className: "cx-welcome-shell", key: step },
    renderStep()
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-welcome-nav", "aria-hidden": "false" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-welcome-dots", role: "tablist", "aria-label": "Tour progress" },
    Array.from({ length: total }).map((_, i) => /*#__PURE__*/
    React.createElement("span", { key: i, className: "cx-welcome-dot" + (i === step ? " is-active" : "") + (i < step ? " is-done" : "") })
    )
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-welcome-arrows" },
    step > 0 ? /*#__PURE__*/
    React.createElement("button", { className: "cx-welcome-arrow", onClick: prev, "aria-label": "Previous step" }, "\u2190 back") : /*#__PURE__*/
    React.createElement("span", { className: "cx-welcome-arrow cx-welcome-arrow--ghost" }, "\xA0"), /*#__PURE__*/
    React.createElement("button", { className: "cx-welcome-arrow cx-welcome-arrow--next", onClick: next, "aria-label": "Next step" },
    step === total - 1 ? "begin →" : "next →"
    )
    )
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-welcome-progress", "aria-hidden": "true" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-welcome-progress-fill", style: { width: pct + "%" } })
    )
    ));

}

// ── Engagement: Welcome-back card ────────────────────────────────────────
function WelcomeBack({ onContinue, onDismiss, onDiscoveryClick }) {
  const engage = window.CODEX_ENGAGE;
  if (!engage) return null;
  const stats = engage.loadStats();
  if (stats.sessionCount <= 1) return null;

  const sk = engage.loadStreak();
  const session = engage.loadSession();
  const disc = engage.getDailyDiscovery();
  const warn = engage.streakWarning();
  const tod = engage.timeOfDaySuggestion();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-welcome-back" }, /*#__PURE__*/
    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } }, /*#__PURE__*/
    React.createElement("div", { className: "cx-wb-greeting" }, greeting), /*#__PURE__*/
    React.createElement("button", { onClick: onDismiss, style: { background: "none", border: "none", color: "var(--cx-fg-dim)", cursor: "pointer", fontSize: "14px", padding: "0 2px" }, title: "Dismiss" }, "\xD7")
    ),

    sk.current > 0 && /*#__PURE__*/
    React.createElement("div", { className: "cx-wb-streak" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-flame" }, "🔥"), /*#__PURE__*/
    React.createElement("span", null, sk.current, "-day streak", sk.current === sk.longest ? " (personal best!)" : "")
    ),


    warn && /*#__PURE__*/
    React.createElement("div", { className: "cx-streak-warn" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-streak-warn-icon" }, "🔥"), /*#__PURE__*/
    React.createElement("span", null, warn.msg)
    ),


    session && /*#__PURE__*/
    React.createElement("button", { className: "cx-wb-continue", onClick: () => onContinue(session) }, /*#__PURE__*/
    React.createElement("span", { className: "cx-wb-continue-icon" }, "▶"), /*#__PURE__*/
    React.createElement("div", { className: "cx-wb-continue-text" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-wb-continue-ref" }, "Continue: ", session.bookName, " ", session.chapter), /*#__PURE__*/
    React.createElement("div", { className: "cx-wb-continue-sub" }, "Pick up where you left off")
    )
    ),


    disc && disc.title && /*#__PURE__*/
    React.createElement("div", { className: "cx-daily-disc", onClick: () => onDiscoveryClick(disc) }, /*#__PURE__*/
    React.createElement("div", { className: "cx-daily-disc-badge" }, "✦", " daily discovery \xB7 ", disc.type), /*#__PURE__*/
    React.createElement("div", { className: "cx-daily-disc-title" }, disc.title), /*#__PURE__*/
    React.createElement("div", { className: "cx-daily-disc-body" }, disc.body),
    disc.ref && /*#__PURE__*/React.createElement("div", { className: "cx-daily-disc-ref" }, disc.ref)
    )

    ));

}

// ── Engagement: achievement / milestone marks now render through the single
// ToastDock (codex:toast variant:'mark'). The old standalone AchievementToast
// component + its queue were removed to eliminate the dual render.

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  // Push the persisted language into the global i18n module so window.t()
  // returns the right strings on first paint and after every change. Also
  // updates <html lang> + dir for RTL (Hebrew) and font selection.
  useEffect(() => {
    if (window.applyCodexLang) window.applyCodexLang(t.lang || "en");
  }, [t.lang]);
  // Drift-mode label overlay — when on, t() resolves alt tags first.
  useEffect(() => {
    if (window.applyCodexDrift) window.applyCodexDrift(!!t.hermeneuticDriftCompensation);
  }, [t.hermeneuticDriftCompensation]);
  const { now, solar, dark } = useSolarClock(t.autoTheme, t.manualDark);
  const data = window.CODEX_DATA;

  const [tab, setTab] = useState("trans");
  const [primary, setPrimary] = useState(t.primaryTranslation);

  // Global bump so any consumer of window.CODEX_DATA.translations (right-rail
  // picker, compare set, offline panel) re-derives when a translation is
  // installed/removed.
  const [, _bumpTrans] = useState(0);
  useEffect(() => {
    const fn = () => _bumpTrans((n) => n + 1);
    window.addEventListener("codex:translations-changed", fn);
    return () => window.removeEventListener("codex:translations-changed", fn);
  }, []);

  // Multi-provider AI registry. Re-fetched from /api/health on mount and
  // whenever a key/engine change is broadcast so the model selector grays
  // out providers that aren't reachable / configured.
  const [availableProviders, setAvailableProviders] = useState({
    anthropic: { available: false, models: [] },
    xai: { available: false, models: [] },
    groq: { available: false, models: [] },
    ollama: { available: false, models: [] }
  });
  useEffect(() => {
    const probe = () => fetch("/api/health").
    then((r) => r.json()).
    then((d) => {if (d && d.providers) setAvailableProviders(d.providers);}).
    catch(() => {});
    probe();
    const onChange = () => probe();
    window.addEventListener("codex:engine-change", onChange);
    return () => window.removeEventListener("codex:engine-change", onChange);
  }, []);
  const [compareSet, setCompareSet] = useState(() => {
    try {
      const raw = localStorage.getItem("codex.compareSet");
      if (raw) return JSON.parse(raw);
    } catch {}
    return ["web", "clementine"];
  });
  const [sideBySide, setSideBySide] = useState(!!t.sideBySide);
  const [redLetter, setRedLetter] = useState(!!t.redLetter);
  const [gnosisOn, setGnosisOn] = useState(false);
  const [currentVerse, _setCurrentVerse] = useState(() => {
    try {
      const raw = localStorage.getItem("codex.passageLoc");
      if (raw) return JSON.parse(raw).verse || 1;
    } catch {}
    return 1;
  });
  // Persist every cursor change so reopening the tab restores the exact verse.
  const setCurrentVerse = useCallback((n) => {
    _setCurrentVerse(n);
    setPassageLoc((p) => ({ ...p, verse: n }));
  }, []);

  // ── Plugin system bridge ────────────────────────────────────────────────
  // pluginVersion bumps every time a plugin registers so panels.jsx (which
  // reads window.CODEX_PLUGINS_API.getPanels() at render time) re-renders
  // and picks up the new tab. Plugins themselves run outside React's tree.
  const [pluginVersion, setPluginVersion] = useState(0);
  useEffect(() => {
    const onReg = () => setPluginVersion((v) => v + 1);
    window.addEventListener("codex:plugin-registered", onReg);
    // Also bump once on mount in case plugins registered before App mounted.
    if (window.CODEX_PLUGINS_API && window.CODEX_PLUGINS_API.list().length) {
      setPluginVersion((v) => v + 1);
    }
    return () => window.removeEventListener("codex:plugin-registered", onReg);
  }, []);

  // ── Schizo Mode eligibility ─────────────────────────────────────────────
  // Toggle visibility is LIVE — only when the user is currently focused on
  // Acts 16:26 (the prison earthquake, every bond loosed). Once they enable
  // the mode it stays on across navigation; they just lose the toggle until
  // they return to the verse. This makes the easter egg feel like a door
  // that opens only when you're standing in front of it.
  const [schizoEligible, setSchizoEligible] = useState(false);

  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [panelData, setPanelData] = useState(null);
  const [panelStatus, setPanelStatus] = useState({ loading: false, error: null });
  // Meta about the current chapter's panels — surfaces to the user as a
  // "CACHED · Nd ago" badge so they can SEE that revisits never re-pull.
  const [panelMeta, setPanelMeta] = useState({ fromCache: false, fetchedAt: 0 });
  // DISARM — companion panel surfacing weaponized misreadings of verses
  // in this chapter, plus the textual rebuttal. Loaded in parallel with
  // the main panel set; own cache slot via CODEX_PANELS.loadDisarm.
  const [disarmData, setDisarmData] = useState(null);
  const [disarmStatus, setDisarmStatus] = useState({ loading: false, error: null });
  const [disarmMeta, setDisarmMeta] = useState({ fromCache: false, fetchedAt: 0 });

  // ── dynamic passage state ─────────────────────────────────────────────
  // passageLoc now persists the verse cursor too so a relaunch lands you
  // exactly where you left off — same chapter, same scroll target.
  const [passageLoc, setPassageLoc] = useState(() => {
    try {
      const raw = localStorage.getItem("codex.passageLoc");
      if (raw) {
        const parsed = JSON.parse(raw);
        return { verse: 1, ...parsed };
      }
    } catch {}
    return { ...data.defaultPassage, verse: 1 };
  });
  const [passage, setPassage] = useState({
    bookId: passageLoc.bookId,
    chapter: passageLoc.chapter,
    book: data.books.find((b) => b.id === passageLoc.bookId)?.name || "?",
    title: "",
    subtitle: "",
    verses: [],
    loading: true,
    error: null
  });

  // Apply / remove the is-schizo body class for visual tone.
  useEffect(() => {
    const on = !!(schizoEligible && t.schizo);
    document.body.classList.toggle("is-schizo", on);
    return () => {document.body.classList.toggle("is-schizo", false);};
  }, [schizoEligible, t.schizo]);

  // Schizo Mode eligibility detection — placed here, AFTER `passage` is
  // defined, because Babel-env transpiles const→var (hoists declarations)
  // and an earlier deps-array reference to passage.bookId would crash on
  // first render. See the schizoEligible useState above for the long note.
  //
  // Trigger: Acts 16:26 — the prison earthquake. "And suddenly there was a
  // great earthquake, so that the foundations of the prison were shaken:
  // and immediately all the doors were opened, and every one's bands were
  // loosed." Schizo Mode is about breaking free; this verse is the canon's
  // archetypal break-out. The trigger requires the user to actually land
  // ON v26 as their cursor (not just open Acts 16) — so it's hidden enough
  // that it's a real discovery, not a stumble.
  useEffect(() => {
    const focused = passage.bookId === "act" && passage.chapter === 16 && currentVerse === 26;
    setSchizoEligible((prev) => {
      if (focused && !prev) {
        // First time landing — subtle feedback.
        try {window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: "⚯ a door opened in the settings panel", kind: "ok" } }));} catch {}
      }
      return focused;
    });
  }, [passage.bookId, passage.chapter, currentVerse]);

  // Kick off the Disarm panel for the current chapter — parallel to the
  // main panel set, own cache, own error state. Seeded entries (if the
  // chapter has a hand-crafted seed in data.seedPanels) take precedence.
  const loadDisarmData = useCallback((bookId, chapter, bookName) => {
    const seed = data.seedPanels[`${bookId}.${chapter}`];
    if (seed && seed.disarm) {
      setDisarmData(seed.disarm);
      setDisarmStatus({ loading: false, error: null });
      setDisarmMeta({ fromCache: true, fetchedAt: 0, seed: true });
      return;
    }
    if (!window.CODEX_PANELS?.loadDisarm) return;
    const cached = window.CODEX_PANELS.getDisarmCached(bookId, chapter);
    if (cached) {
      const meta = window.CODEX_PANELS.getDisarmMeta(bookId, chapter);
      setDisarmData(cached);
      setDisarmStatus({ loading: false, error: null });
      setDisarmMeta({ fromCache: true, fetchedAt: meta?.fetchedAt || 0 });
      return;
    }
    setDisarmData(null);
    setDisarmStatus({ loading: false, error: null });
    setDisarmMeta({ fromCache: false, fetchedAt: 0 });
    // Lazy — don't auto-fire the network call until the user opens the tab
    // (the DRAFT button triggers regenerateDisarm). This keeps the AI bill
    // bounded and avoids hammering the API on every chapter change.
  }, []);

  const loadPanelData = useCallback(async (bookId, chapter, bookName) => {
    // Always kick the Disarm loader alongside the main panel set.
    loadDisarmData(bookId, chapter, bookName);
    const seed = data.seedPanels[`${bookId}.${chapter}`];
    if (seed) {
      setPanelData(seed);
      setPanelStatus({ loading: false, error: null });
      setPanelMeta({ fromCache: true, fetchedAt: 0, seed: true });
      return;
    }
    const cached = window.CODEX_PANELS.getCached(bookId, chapter);
    if (cached) {
      const meta = window.CODEX_PANELS.getCachedMeta(bookId, chapter);
      setPanelData(cached);
      setPanelStatus({ loading: false, error: null });
      setPanelMeta({ fromCache: true, fetchedAt: meta?.fetchedAt || 0 });
      return;
    }
    setPanelData(null);
    setPanelStatus({ loading: true, error: null });
    setPanelMeta({ fromCache: false, fetchedAt: 0 });
    try {
      const generated = await window.CODEX_PANELS.load(bookId, chapter, bookName, { provider: t.provider, model: t.model });
      setPanelData(generated);
      setPanelStatus({ loading: false, error: null });
      setPanelMeta({ fromCache: false, fetchedAt: Date.now(), fresh: true });
    } catch (e) {
      setPanelStatus({ loading: false, error: String(e.message || e) });
    }
  }, [loadDisarmData]);

  const regenerateDisarm = useCallback(async () => {
    if (!window.CODEX_PANELS?.loadDisarm) return;
    try {window.CODEX_PANELS.purgeDisarm(passage.bookId, passage.chapter);} catch {}
    setDisarmData(null);
    setDisarmStatus({ loading: true, error: null });
    setDisarmMeta({ fromCache: false, fetchedAt: 0 });
    try {
      const generated = await window.CODEX_PANELS.loadDisarm({
        passage, currentVerse,
        provider: t.provider, model: t.model, force: true
      });
      setDisarmData(generated);
      setDisarmStatus({ loading: false, error: null });
      setDisarmMeta({ fromCache: false, fetchedAt: Date.now(), fresh: true });
    } catch (e) {
      setDisarmStatus({ loading: false, error: String(e.message || e) });
    }
  }, [passage, currentVerse, t.provider, t.model]);

  const regeneratePanels = useCallback(async () => {
    window.CODEX_PANELS.purge(passage.bookId, passage.chapter);
    setPanelData(null);
    setPanelStatus({ loading: true, error: null });
    setPanelMeta({ fromCache: false, fetchedAt: 0 });
    try {
      const generated = await window.CODEX_PANELS.load(passage.bookId, passage.chapter, passage.book, { force: true, provider: t.provider, model: t.model });
      setPanelData(generated);
      setPanelStatus({ loading: false, error: null });
      setPanelMeta({ fromCache: false, fetchedAt: Date.now(), fresh: true });
    } catch (e) {
      setPanelStatus({ loading: false, error: String(e.message || e) });
    }
  }, [passage.bookId, passage.chapter, passage.book]);

  const loadPassage = useCallback(async (bookId, chapter, verse = 1) => {
    const book = data.books.find((b) => b.id === bookId);
    if (!book) return;
    const chap = Math.max(1, Math.min(chapter, book.chapters));
    // Per-book last-chapter memory so returning to a book lands you on
    // the chapter you left off at instead of always chapter 1.
    try {
      const raw = localStorage.getItem("codex.lastChapter.v1");
      const map = raw ? JSON.parse(raw) : {};
      map[bookId] = chap;
      localStorage.setItem("codex.lastChapter.v1", JSON.stringify(map));
    } catch {}
    setPassageLoc({ bookId, chapter: chap, verse });
    _setCurrentVerse(verse);
    setPassage((p) => ({
      ...p,
      bookId, chapter: chap, book: book.name,
      verses: [], loading: true, error: null
    }));
    loadPanelData(bookId, chap, book.name);
    try {
      const trs = Array.from(new Set([primary, ...compareSet]));
      const verses = await window.BIBLE.loadMulti(bookId, chap, trs);
      const seed = data.seedPanels[`${bookId}.${chap}`];
      const cachedPanel = window.CODEX_PANELS.getCached(bookId, chap);
      const panel = seed || cachedPanel;
      setPassage({
        bookId, chapter: chap, book: book.name,
        title: panel?.title || `${book.name} ${chap}`,
        subtitle: panel?.subtitle || "",
        verses, loading: false, error: null
      });
      // Phase 1.2 — feed the full-text search index as the user reads.
      try {
        window.CODEX_SEARCH?.ingestPassage?.({
          bookId, chapter: chap, verses, primary
        });
      } catch {}
      // Idle prefetch of the next chapter for the primary translation so
      // prev/next navigation feels instant. Safe to no-op on failure.
      try {
        const nextCh = chap + 1;
        if (nextCh <= (book.chapters || 0)) {
          const run = () => {
            try {window.BIBLE.loadChapter(bookId, nextCh, primary);} catch {}
          };
          if ("requestIdleCallback" in window) {
            window.requestIdleCallback(() => setTimeout(run, 250), { timeout: 4000 });
          } else {
            setTimeout(run, 1200);
          }
        }
      } catch {}
    } catch (e) {
      setPassage((p) => ({ ...p, loading: false, error: String(e.message || e) }));
    }
  }, [primary, compareSet, loadPanelData]);

  // When the UI language changes, AI panels need to re-render in the
  // new language. cacheKey is language-suffixed so getCached() returns
  // null for the new lang (or the previously-cached translation if it
  // exists). Re-invoking loadPanelData picks up that lookup.
  useEffect(() => {
    const onLang = () => {
      if (passage.bookId && passage.chapter) {
        loadPanelData(passage.bookId, passage.chapter, passage.book);
      }
    };
    window.addEventListener("codex:lang", onLang);
    return () => window.removeEventListener("codex:lang", onLang);
  }, [passage.bookId, passage.chapter, passage.book, loadPanelData]);

  // ── Plugin lifecycle hooks ──────────────────────────────────────────────
  // Every chapter change: fire codex:navigate + call each plugin's onNavigate.
  useEffect(() => {
    if (!passage.book || !passage.chapter) return;
    const detail = { book: passage.book, bookId: passage.bookId, chapter: passage.chapter };
    try {window.dispatchEvent(new CustomEvent("codex:navigate", { detail }));} catch {}
    if (window.CODEX_ENGAGE) {
      window.CODEX_ENGAGE.trackChapter(detail.bookId || passage.bookId, detail.chapter || passage.chapter);
      window.CODEX_ENGAGE.saveSession(detail.bookId || passage.bookId, detail.chapter || passage.chapter, detail.book || passage.book || "");
      const newAch = window.CODEX_ENGAGE.checkAchievements();
      if (newAch && newAch.length) showAchievements(newAch);
    }
    if (window.CODEX_PLUGINS_API) {
      window.CODEX_PLUGINS_API.onNavigate(passage.book, passage.chapter);
    }
  }, [passage.bookId, passage.chapter, passage.book]); // eslint-disable-line react-hooks/exhaustive-deps

  // Every verse cursor change: fire codex:verse-select + call onVerseSelect.
  useEffect(() => {
    if (!passage.book || !passage.chapter || !currentVerse) return;
    const ref = {
      book: passage.book, bookId: passage.bookId,
      chapter: passage.chapter, verse: currentVerse,
      translation: primary
    };
    try {window.dispatchEvent(new CustomEvent("codex:verse-select", { detail: { ref } }));} catch {}
    if (window.CODEX_PLUGINS_API) window.CODEX_PLUGINS_API.onVerseSelect(ref);
  }, [passage.bookId, passage.chapter, passage.book, currentVerse, primary]);

  // v7.5 ACTION — expose the live cursor to non-React chrome (wm.js dock).
  // window.CODEX_NOW always reflects "where the reader is"; 'codex:now' fires
  // on every change so the dock can re-render. Defensive: never throws.
  useEffect(() => {
    if (!passage.book || !passage.chapter) return;
    try {
      const v = currentVerse || 1;
      window.CODEX_NOW = {
        ref: `${passage.book} ${passage.chapter}:${v}`,
        book: passage.book,
        bookId: passage.bookId,
        chapter: passage.chapter,
        verse: v
      };
      window.dispatchEvent(new CustomEvent("codex:now", { detail: window.CODEX_NOW }));
    } catch {}
  }, [passage.bookId, passage.chapter, passage.book, currentVerse]);

  // Update passage title once panels finish generating, so the header reflects the AI title.
  useEffect(() => {
    if (panelData && (!passage.title || passage.title === `${passage.book} ${passage.chapter}`)) {
      setPassage((p) => ({ ...p, title: panelData.title || p.title, subtitle: panelData.subtitle || p.subtitle }));
    }
    // eslint-disable-next-line
  }, [panelData]);

  // Initial load + reload when translation set changes (so all panes have data).
  // Pass the persisted verse so the cursor lands where the user left off.
  useEffect(() => {
    loadPassage(passageLoc.bookId, passageLoc.chapter, passageLoc.verse || currentVerse || 1);
    // eslint-disable-next-line
  }, [primary, JSON.stringify(compareSet)]);

  useEffect(() => {try {localStorage.setItem("codex.passageLoc", JSON.stringify(passageLoc));} catch {}}, [passageLoc]);

  // Personal-bible MARKS — unified concept: a mark IS a highlight. One list,
  // one schema, one mental model.
  //   { "jhn.1.14": { color: "amber", ts: 1715500000000, note: "And the Word…" } }
  // Persists in localStorage. Old string-only entries auto-migrate on load.
  const [highlights, setHighlights] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("codex.highlights.v1") || "{}");
      const migrated = {};
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v === "string") migrated[k] = { color: v, ts: Date.now(), note: "" };else
        migrated[k] = v;
      }
      return migrated;
    } catch {return {};}
  });
  useEffect(() => {try {localStorage.setItem("codex.highlights.v1", JSON.stringify(highlights));} catch {}}, [highlights]);

  const toggleHighlight = useCallback((bookId, chapter, n, color, verseText) => {
    const key = `${bookId}.${chapter}.${n}`;
    const c = color || t.highlightColor || "amber";
    setHighlights((h) => {
      const next = { ...h };
      const cur = next[key];
      if (cur && cur.color === c) {
        delete next[key]; // same colour → toggle off
      } else {
        next[key] = {
          color: c,
          ts: Date.now(),
          note: cur?.note || (verseText ?
          verseText.replace(/\s+/g, " ").trim().split(" ").slice(0, 7).join(" ") + "…" :
          "")
        };
        if (window.CODEX_ENGAGE) window.CODEX_ENGAGE.trackHighlight();
      }
      return next;
    });
  }, [t.highlightColor]);

  const clearHighlight = useCallback((bookId, chapter, n) => {
    const key = `${bookId}.${chapter}.${n}`;
    setHighlights((h) => {const next = { ...h };delete next[key];return next;});
  }, []);

  // Reels' LIKE promises "also bookmarks it" — marks ARE highlights, so
  // materialize the like as a mark or it never shows up in the Marks rail.
  // Idempotent: an existing mark is left alone (never toggled off by a like).
  useEffect(() => {
    const onAdd = (e) => {
      const ref = e?.detail?.ref;
      if (typeof ref !== "string") return;
      const [bookId, ch, vn] = ref.split(".");
      const chapter = parseInt(ch, 10),n = parseInt(vn, 10);
      if (!bookId || !Number.isFinite(chapter) || !Number.isFinite(n)) return;
      setHighlights((h) => {
        const key = `${bookId}.${chapter}.${n}`;
        if (h[key]) return h;
        return { ...h, [key]: { color: t.highlightColor || "amber", ts: Date.now(), note: e?.detail?.title || "" } };
      });
    };
    window.addEventListener("codex:bookmark-added", onAdd);
    return () => window.removeEventListener("codex:bookmark-added", onAdd);
  }, [t.highlightColor]);

  // ── Schizo cipher mode ─────────────────────────────────────────────────
  // When Schizo Mode is enabled, pressing "=" anywhere outside an input
  // prompts for a gematria value and jumps to the first matching verse.
  // Also dispatches a `codex:cipher-search` event so other surfaces can
  // listen. Falls back gracefully when the library index is empty.
  useEffect(() => {
    if (!(schizoEligible && t.schizo)) return undefined;
    const isEditable = (el) => {
      if (!el) return false;
      const tag = (el.tagName || "").toLowerCase();
      return tag === "input" || tag === "textarea" || el.isContentEditable;
    };
    const onKey = (e) => {
      if (e.key !== "=" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditable(e.target)) return;
      e.preventDefault();
      const raw = window.prompt("⚯ Cipher search — gematria value:", "666");
      if (!raw) return;
      const n = parseInt(String(raw).replace(/^=/, "").trim(), 10);
      if (!Number.isFinite(n)) return;
      const idx = window.CODEX_GEMATRIA_INDEX;
      const fire = (matches) => {
        window.dispatchEvent(new CustomEvent("codex:cipher-search", { detail: { value: n, matches } }));
        if (!matches || !matches.length) {cxToast(`⚯ No verses in your library sum to ${n}.`, "warn");return;}
        const preview = matches.slice(0, 8).map((m) => `• ${m.ref}  (${m.word} · ${m.system})`).join("\n");
        const go = window.confirm(`⚯ ${matches.length} match${matches.length === 1 ? "" : "es"} for ${n}\n\n${preview}\n\nJump to first match?`);
        if (!go) return;
        const ref = matches[0].ref || "";
        const [bookId, chStr, vStr] = ref.split(".");
        const ch = parseInt(chStr, 10),vN = parseInt(vStr, 10);
        if (bookId && Number.isFinite(ch)) loadPassage(bookId, ch, Number.isFinite(vN) ? vN : 1);
      };
      try {
        if (idx && idx.ensure) {
          idx.ensure().then(() => fire(idx.find(n) || [])).catch(() => fire([]));
        } else if (idx && idx.find) {
          fire(idx.find(n) || []);
        } else {fire([]);}
      } catch {fire([]);}
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [schizoEligible, t.schizo, loadPassage]);

  // Pinned-marks set, persisted separately from the highlight cache so we
  // don't have to migrate the existing schema.
  const PINS_KEY = "codex.marks.pinned.v1";
  const [pinnedSet, setPinnedSet] = useState(() => {
    try {return new Set(JSON.parse(localStorage.getItem(PINS_KEY) || "[]"));}
    catch {return new Set();}
  });
  const togglePinMark = useCallback((mark) => {
    setPinnedSet((prev) => {
      const next = new Set(prev);
      if (next.has(mark.key)) next.delete(mark.key);else next.add(mark.key);
      try {localStorage.setItem(PINS_KEY, JSON.stringify([...next]));} catch {}
      return next;
    });
  }, []);

  // Derived: marks list for the MARKS tab — pinned bubble to the top
  // (newest-pinned-first), then unpinned newest-first.
  const marks = useMemo(() => {
    return Object.entries(highlights).
    map(([key, v]) => {
      const [bookId, ch, n] = key.split(".");
      const book = data.books.find((b) => b.id === bookId);
      return {
        key,
        bookId,
        chapter: parseInt(ch, 10),
        verse: parseInt(n, 10),
        color: v.color || "amber",
        ts: v.ts || 0,
        note: v.note || "",
        ref: book ? `${book.name} ${ch}:${n}` : `${bookId} ${ch}:${n}`,
        pinned: pinnedSet.has(key)
      };
    }).
    sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.ts - a.ts;
    });
  }, [highlights, data.books, pinnedSet]);

  // Floating verse menu state — opened from Reader (right-click / ⋯ button).
  const [verseMenu, setVerseMenu] = useState(null); // { verse, anchor }
  const openVerseMenu = useCallback((v, anchor) => setVerseMenu({ verse: v, anchor }), []);
  const closeVerseMenu = useCallback(() => setVerseMenu(null), []);

  // Verse-map modal state — opened from VerseMenu (MAP item).
  const [verseMap, setVerseMap] = useState(null); // { verse, refStr, text }
  const openVerseMap = useCallback((v, refStr, text) => setVerseMap({ verse: v, refStr, text }), []);
  const closeVerseMap = useCallback(() => setVerseMap(null), []);

  // Art + Compare modals — same pattern as map.
  const [verseArt, setVerseArt] = useState(null);
  const openVerseArt = useCallback((v, refStr, text) => setVerseArt({ verse: v, refStr, text }), []);
  const closeVerseArt = useCallback(() => setVerseArt(null), []);

  const [verseCompare, setVerseCompare] = useState(null);
  const openVerseCompare = useCallback((v, refStr) => setVerseCompare({ verse: v, refStr }), []);
  const closeVerseCompare = useCallback(() => setVerseCompare(null), []);

  const [verseMirror, setVerseMirror] = useState(null);
  const openVerseMirror = useCallback((v, refStr, text) => setVerseMirror({ verse: v, refStr, text }), []);
  const closeVerseMirror = useCallback(() => setVerseMirror(null), []);

  const [verseSword, setVerseSword] = useState(null);
  const openVerseSword = useCallback((v, refStr, text) => setVerseSword({ verse: v, refStr, text }), []);
  const closeVerseSword = useCallback(() => setVerseSword(null), []);

  // ── CONSTELLATION — the canon as one body. ─────────────────────────────
  const [constOpen, setConstOpen] = useState(false);
  useEffect(() => {
    window.codexOpenConstellation = () => setConstOpen(true);
    return () => {delete window.codexOpenConstellation;};
  }, []);

  // ── OMNIBAR — ⌘K, the one door. ───────────────────────────────────────
  const [omniOpen, setOmniOpen] = useState(false);
  useEffect(() => {
    window.codexOpenOmni = () => setOmniOpen(true);
    return () => {delete window.codexOpenOmni;};
  }, []);

  // ── Reading trail — a quiet ring of the passages visited (ring of 100,
  // local only). The kernel's session_trail tool reads it so the LOOM can
  // weave a session into a study. Coarse (book+chapter) by design.
  useEffect(() => {
    if (!passage?.bookId || !passage?.chapter) return;
    try {
      const book = CODEX_DATA.books.find((b) => b.id === passage.bookId);
      const ref = `${book ? book.name : passage.bookId} ${passage.chapter}`;
      const trail = JSON.parse(localStorage.getItem("codex.trail") || "[]");
      if (trail.length && trail[trail.length - 1].ref === ref) return;
      trail.push({ ref, at: Date.now() });
      localStorage.setItem("codex.trail", JSON.stringify(trail.slice(-100)));
    } catch {}
  }, [passage?.bookId, passage?.chapter]);

  // ── OPS — the mission cockpit (agentic OS). Opened from the verse menu
  // (seeded with the verse) or programmatically via window.codexOpenOps.
  const [opsOpen, setOpsOpen] = useState(null); // null | { seed }
  const openOps = useCallback((seed) => setOpsOpen({ seed: seed || "" }), []);
  const closeOps = useCallback(() => setOpsOpen(null), []);
  useEffect(() => {
    window.codexOpenOps = openOps;
    return () => {if (window.codexOpenOps === openOps) delete window.codexOpenOps;};
  }, [openOps]);

  // The kernel's open_console tool lands here: navigate the reader, resolve
  // the verse text, then open the requested depth console — exactly as if
  // the reader had clicked the verse-menu row themselves.
  useEffect(() => {
    const onOsOpen = (e) => {
      const { kind, ref } = e.detail || {};
      if (!kind || !ref) return;
      const p = parseRef(ref, CODEX_DATA.books);
      if (!p) return;
      try {window.codexJumpToRef && window.codexJumpToRef(ref);} catch {}
      // Let navigation commit so the consoles read the right passage state.
      setTimeout(async () => {
        let text = "";
        try {
          const data = await BIBLE.loadChapter(p.bookId, p.chapter, primary);
          const vs = data && data.verses || data || [];
          const v = Array.isArray(vs) ? vs.find((x) => (x.verse || x.n) === p.verse) : null;
          text = v ? String(v.text || "").trim() : "";
        } catch {}
        const verse = { n: p.verse };
        const open = {
          map: () => openVerseMap(verse, ref, text),
          mirror: () => openVerseMirror(verse, ref, text),
          sword: () => openVerseSword(verse, ref, text),
          art: () => openVerseArt(verse, ref, text),
          compare: () => openVerseCompare(verse, ref)
        }[kind];
        if (open) open();
      }, 700);
    };
    window.addEventListener("codex:os-open", onOsOpen);
    return () => window.removeEventListener("codex:os-open", onOsOpen);
  }, [primary, openVerseMap, openVerseMirror, openVerseSword, openVerseArt, openVerseCompare]);

  // ── PWA install — capture the browser's deferred install prompt so the
  // settings button can fire the native dialog with one tap. Falls back to
  // platform-specific guidance on iOS (where no event is fired). The whole
  // app shell + Bible cache + settings then live offline forever.
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(() =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true
  );
  const isIOS = useMemo(() => /iPhone|iPad|iPod/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent), []);
  useEffect(() => {
    const onPrompt = (e) => {e.preventDefault();setInstallPrompt(e);};
    const onInstalled = () => {setInstalled(true);setInstallPrompt(null);};
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  const triggerInstall = useCallback(async () => {
    if (installed) return;
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setInstallPrompt(null);
      return;
    }
    if (isIOS) {
      cxToast("Install on iPhone/iPad: tap Share (↑), then “Add to Home Screen”, then Add. CODEX runs full-screen and fully offline.", "info");
      return;
    }
    cxToast("No install prompt yet — refresh once or twice. CODEX installs in Chrome, Edge, Brave, Arc, Safari (iOS), and Samsung Internet.", "info");
  }, [installed, installPrompt, isIOS]);

  // ── Export / import — open-format snapshot of every codex.* localStorage
  // key plus a small header. Lets users migrate marks, notes, cached
  // chapters, panels, settings to another browser, device, or compatible app.
  // No proprietary fields — everything is plain JSON the user can inspect.
  // Keys that contain secrets — NEVER exported, NEVER overwritten by import.
  const SENSITIVE_PREFIXES = [
  "codex.api.keys", // AI provider API keys
  "codex.anthropic.key", // legacy Anthropic key
  "codex.sync.github.token", // GitHub PAT for gist sync
  "codex.sync.firebase", // Firebase config / tokens
  "codex.btc.token", // donation pool bearer token
  "codex.session.", // ephemeral session state
  "codex.oracle" // Oracle chat history — PRIVATE, local-only; never exported or overwritten by import
  ];
  const isSensitive = (k) => SENSITIVE_PREFIXES.some((p) => k.startsWith(p));

  const exportAll = useCallback(() => {
    const dataMap = {};
    let marksCount = 0,panelsCount = 0,biblesCount = 0,skippedSecrets = 0;
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith("codex.")) continue;
      if (isSensitive(k)) {skippedSecrets++;continue;}
      const raw = localStorage.getItem(k);
      try {dataMap[k] = JSON.parse(raw);}
      catch {dataMap[k] = raw;}
      if (k === "codex.highlights.v1" && dataMap[k] && typeof dataMap[k] === "object") marksCount = Object.keys(dataMap[k]).length;
      if (k.startsWith("codex.panels.v1.")) panelsCount++;
      if (k.startsWith("codex.bible.")) biblesCount++;
    }
    const payload = {
      format: "codex.export",
      version: 1,
      app: "CODEX Bible Study",
      exportedAt: new Date().toISOString(),
      summary: { marks: marksCount, panels: panelsCount, bibleCacheBuckets: biblesCount, keys: Object.keys(dataMap).length },
      data: dataMap
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `codex-export-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, []);

  const importPick = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const text = await f.text();
        const obj = JSON.parse(text);
        if (obj.format !== "codex.export" || !obj.data || typeof obj.data !== "object") {
          cxToast("This isn't a CODEX export file (missing format/data).", "err");
          return;
        }
        // Filter out any secrets that might be in a stale export file
        const incoming = Object.keys(obj.data).filter((k) => k.startsWith("codex.") && !isSensitive(k));
        if (!incoming.length) {cxToast("Export contains no codex.* data.", "warn");return;}
        const summary = obj.summary ?
        `Marks: ${obj.summary.marks ?? "?"}\nPanels: ${obj.summary.panels ?? "?"}\nKeys: ${obj.summary.keys ?? incoming.length}` :
        `Keys: ${incoming.length}`;
        if (!window.confirm(`Import will REPLACE all current CODEX data:\n\n${summary}\n\nFrom: ${obj.exportedAt || "(unknown date)"}\n\nContinue?`)) return;
        for (const k of Object.keys(localStorage)) {
          // Preserve secrets and sync config during import
          if (k.startsWith("codex.") && !isSensitive(k)) localStorage.removeItem(k);
        }
        for (const k of incoming) {
          const v = obj.data[k];
          localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
        }
        window.location.reload();
      } catch (e) {
        cxToast("Import failed: " + (e.message || e), "err");
      }
    };
    input.click();
  }, []);

  // Distraction-free: hide both rails on desktop. Toggle with the ⊟ button or ESC twice.
  const [distractionFree, setDistractionFree] = useState(!!t.distractionFree);
  useEffect(() => {setDistractionFree(!!t.distractionFree);}, [t.distractionFree]);
  const toggleDistractionFree = useCallback(() => {
    const v = !distractionFree;
    setDistractionFree(v);
    setTweak("distractionFree", v);
  }, [distractionFree]);

  // Per-rail fold state — desktop only. Persists so the layout reopens the
  // way you left it. Mobile rails still slide via leftOpen / rightOpen.
  const [leftCollapsed, setLeftCollapsed] = useState(() => {
    try {return localStorage.getItem("codex.ui.leftCollapsed") === "1";} catch {return false;}
  });
  const [rightCollapsed, setRightCollapsed] = useState(() => {
    try {return localStorage.getItem("codex.ui.rightCollapsed") === "1";} catch {return false;}
  });
  useEffect(() => {try {localStorage.setItem("codex.ui.leftCollapsed", leftCollapsed ? "1" : "0");} catch {}}, [leftCollapsed]);
  useEffect(() => {try {localStorage.setItem("codex.ui.rightCollapsed", rightCollapsed ? "1" : "0");} catch {}}, [rightCollapsed]);

  // ── Caffeinate · Screen Wake Lock ──────────────────────────────────
  // Holds a Screen Wake Lock so phone/tablet/laptop screens stay awake
  // while reading. Released the moment the user toggles it off, switches
  // tabs (auto-released by browser), or the app is hidden — re-acquired on
  // visibility return so a glance away doesn't permanently lose the lock.
  const wakeLockRef = useRef(null);
  const acquireLock = useCallback(async () => {
    if (!("wakeLock" in navigator) || wakeLockRef.current) return;
    try {
      const lock = await navigator.wakeLock.request("screen");
      lock.addEventListener("release", () => {wakeLockRef.current = null;});
      wakeLockRef.current = lock;
    } catch (e) {/* user gesture missing or browser unsupported — ignore */}
  }, []);
  const releaseLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {await wakeLockRef.current.release();} catch {}
      wakeLockRef.current = null;
    }
  }, []);
  useEffect(() => {
    if (t.caffeinate) acquireLock();else releaseLock();
    return () => {releaseLock();};
    // eslint-disable-next-line
  }, [t.caffeinate]);
  // Re-acquire on tab return (browsers auto-release on visibilitychange)
  useEffect(() => {
    const onVis = () => {
      if (t.caffeinate && document.visibilityState === "visible") acquireLock();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line
  }, [t.caffeinate]);

  // Theater mode: YouTube-style focus. Hides rails AND status/footer chrome,
  // centers the reader. ESC exits. Press F or click the focus button to enter.
  // Not persisted — it's a per-session reading state, not a setting.
  const [theater, setTheater] = useState(false);
  const toggleTheater = useCallback(() => setTheater((t) => !t), []);
  // Keyboard shortcut overlay — `?` opens it, Esc closes.
  const [showShortcuts, setShowShortcuts] = useState(false);
  // a11y: hold the modal node + the element to restore focus to on close.
  const kbdModalRef = useRef(null);
  const kbdReturnFocusRef = useRef(null);
  // Move focus into the shortcuts modal on open; restore it on close. Tab is
  // trapped inside the modal while it is open (see keydown handler below).
  useEffect(() => {
    if (showShortcuts) {
      // Capture whatever was focused so we can restore it later.
      kbdReturnFocusRef.current =
      document.activeElement && document.activeElement !== document.body ?
      document.activeElement : null;
      // Defer to the next frame so the modal has mounted.
      requestAnimationFrame(() => {
        const modal = kbdModalRef.current;
        if (!modal) return;
        const closeBtn = modal.querySelector(".cx-kbd-x");
        (closeBtn || modal).focus?.();
      });
    } else {
      // Restore focus to the trigger if it's still in the document.
      const prev = kbdReturnFocusRef.current;
      kbdReturnFocusRef.current = null;
      if (prev && typeof prev.focus === "function" && document.contains(prev)) {
        prev.focus();
      }
    }
  }, [showShortcuts]);

  // Phase 1.2 — full-text search modal
  const [searchOpen, setSearchOpen] = useState(false);

  // Cross-reference chain — the host owns the canonical thread of verse keys
  // (`bookId.chapter.verse`). The crossrefs panel reflects it via
  // codex:xref-thread; following a ref pushes, Back pops. Seeded to the host
  // verse when the panel opens.
  const [xrefThread, setXrefThread] = useState([]);

  // ── Engagement state ──────────────────────────────────────────────────
  const [wbDismissed, setWbDismissed] = useState(false);

  // Newly-unlocked achievements surface through the single ToastDock as
  // calm "mark" variants — no separate queue, no second renderer.
  const showAchievements = useCallback((newlyUnlocked) => {
    if (!newlyUnlocked || !newlyUnlocked.length) return;
    newlyUnlocked.forEach((a) => {
      if (!a) return;
      cxToast({
        variant: "mark",
        icon: a.icon || "▦",
        label: "Achievement",
        title: a.title || "",
        desc: a.desc || "",
        kind: "ok"
      });
    });
  }, []);

  // Track session on boot + check for new achievements
  useEffect(() => {
    if (window.CODEX_ENGAGE) {
      const newAch = window.CODEX_ENGAGE.trackSession();
      if (newAch && newAch.length) showAchievements(newAch);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Continuity & Mastery (Phase 2.5) — push the user's daily-threshold tweak
  // into the engagement engine. dailyThreshold = qualifying depth events a
  // calendar day needs to count toward continuity (default 1). Local-only;
  // the engine persists it to codex.engagement.config.v1. Guarded so a missing
  // engine (Lite/offline) never throws.
  useEffect(() => {
    try {
      const eng = window.CODEX_ENGAGEMENT;
      if (eng && typeof eng.setConfig === "function") {
        const n = parseInt(t.continuityThreshold, 10);
        eng.setConfig({ dailyThreshold: n > 0 ? n : 1 });
      }
    } catch {}
  }, [t.continuityThreshold]);

  // The SINGLE milestone/continuity -> notification adapter. Listens to
  // codex:milestone and codex:continuity-tick and re-emits codex:toast
  // variant:'mark' so the one ToastDock renders everything (no IntelToastDock,
  // no separate queue). Mastery level-ups and closed quests are loud;
  // threshold/first-time milestones and continuity ticks stay terse. Calm
  // terminal aesthetic, no confetti, no streak-guilt.
  useEffect(() => {
    if (t.continuityEnabled === false) return;
    const tt2 = (k, f) => {try {const v = window.t && window.t(k);return v && v !== k ? v : f;} catch {return f;}};
    const onMilestone = (e) => {
      const d = e && e.detail || {};
      const label = d.label || d.labelEn || "";
      if (d.kind === "mastery-level") {
        cxToast({
          variant: "mark", icon: "▦",
          label: tt2("cx.mastery.title", "Mastery"),
          title: d.domain ? tt2("cx.domain." + d.domain, d.domain) : label || "",
          desc: label, kind: "ok"
        });
      } else if (d.kind === "quest-complete") {
        cxToast({
          variant: "mark", icon: "✦",
          label: tt2("cx.quest.title", "Quest"),
          title: tt2("cx.quest.complete", "Closed"),
          desc: label, kind: "ok"
        });
      } else {
        // threshold / first-time milestone — terse.
        cxToast({
          variant: "mark", icon: "▦",
          label: tt2("cx.milestone.title", "Milestone"),
          title: label, desc: "", kind: "info"
        });
      }
    };
    const onTick = (e) => {
      const d = e && e.detail || {};
      const statusText = d.statusText || d.status || tt2("cx.continuity.title", "Continuity");
      const current = d.current != null ? d.current : d.streak != null ? d.streak : "";
      cxToast({
        variant: "mark", icon: "⌁",
        label: tt2("cx.continuity.title", "Continuity"),
        title: String(statusText),
        desc: current === "" ? "" : "streak " + current,
        kind: "info"
      });
    };
    window.addEventListener("codex:milestone", onMilestone);
    window.addEventListener("codex:continuity-tick", onTick);
    return () => {
      window.removeEventListener("codex:milestone", onMilestone);
      window.removeEventListener("codex:continuity-tick", onTick);
    };
  }, [t.continuityEnabled]);

  // First-run welcome tour (v2). A 4-step modal overlay. Replaces the old
  // v1 chip strip. Migration: if v1 is set (existing user), treat v2 as
  // already complete — never show. Only fires for genuinely new users.
  // Scripture-first: a new user is NEVER gated behind a full-screen tour.
  // They land directly on the chapter — a plain Bible page, the way it should
  // greet you. On a genuine first run we fire one gentle, dismissible hint
  // pointing at the menu + study rails. The full tour stays available on
  // demand via the `codex:open-tour` event (e.g. from Help).
  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    let firstRun = false;
    try {
      const seen = localStorage.getItem("codex.firstRun.v2") || localStorage.getItem("codex.firstRun.v1");
      firstRun = !seen;
      if (!localStorage.getItem("codex.firstRun.v2")) {
        localStorage.setItem("codex.firstRun.v2", JSON.stringify({ completed: Date.now(), migrated: !firstRun }));
      }
    } catch {}
    if (firstRun) {
      const id = setTimeout(() => {
        try {
          window.dispatchEvent(new CustomEvent("codex:toast", {
            detail: { msg: "Welcome.  ≣ books · ⋮ study tools · tap any verse.", kind: "info" }
          }));
        } catch {}
      }, 1400);
      // best-effort cleanup if unmounted fast
      return () => clearTimeout(id);
    }
  }, []);
  useEffect(() => {
    const openTour = () => setTourOpen(true);
    window.addEventListener("codex:open-tour", openTour);
    return () => window.removeEventListener("codex:open-tour", openTour);
  }, []);
  const closeTour = useCallback(() => {
    try {localStorage.setItem("codex.firstRun.v2", JSON.stringify({ completed: Date.now() }));} catch {}
    setTourOpen(false);
  }, []);

  // Online/offline state for the footer pill. Suppress AI panel error
  // toasts while offline (panels would fail anyway — no point yelling).
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {window.removeEventListener("online", on);window.removeEventListener("offline", off);};
  }, []);

  // ── Global keyboard navigation (Phase 0.6) ─────────────────────────────
  // Single source of truth for all top-level keybindings. Skips typing
  // contexts so we don't steal keys inside inputs / contenteditable.
  useEffect(() => {
    const isTyping = (el) => {
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    };

    const flashVerse = (el) => {
      if (!el) return;
      el.classList.add("cx-kbd-flash");
      setTimeout(() => el.classList.remove("cx-kbd-flash"), 220);
    };

    const verseNodes = () =>
    Array.from(document.querySelectorAll(".cx-verse, .cx-verse-row"));

    const scrollToVerse = (dir) => {
      const nodes = verseNodes();
      if (!nodes.length) return;
      const vnOf = (n) => Number(n.getAttribute("data-vn") || n.dataset?.vn);
      // Step relative to the currently-selected verse so J/K stays in sync
      // with the tracked cursor (verse menu, oracle context, etc.).
      let idx = nodes.findIndex((n) => vnOf(n) === currentVerse);
      if (idx < 0) {
        // No tracked match in view — fall back to the verse nearest center.
        const mid = window.innerHeight / 2;
        let best = Infinity;
        idx = 0;
        nodes.forEach((n, i) => {
          const r = n.getBoundingClientRect();
          const d = Math.abs((r.top + r.bottom) / 2 - mid);
          if (d < best) {best = d;idx = i;}
        });
      }
      const next = Math.max(0, Math.min(nodes.length - 1, idx + dir));
      const target = nodes[next];
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      flashVerse(target);
      // Keep state in sync with what J/K just highlighted.
      const landed = vnOf(target);
      if (Number.isFinite(landed)) setCurrentVerse(landed);
    };

    const focusSearch = () => {
      // Phase 1.2 — open the full-text search overlay
      if (window.CODEX_ENGAGE) window.CODEX_ENGAGE.trackSearch();
      setSearchOpen(true);
      // Defer focus to the next frame so the overlay has mounted.
      requestAnimationFrame(() => {
        const el = document.querySelector('.cx-search-input, [data-cx-search]');
        if (el) {el.focus();el.select?.();}
      });
    };

    const dispatchShortcut = (action) => {
      window.dispatchEvent(new CustomEvent("codex:shortcut", { detail: { action } }));
    };

    const onKey = (e) => {
      const target = e.target;
      const typing = isTyping(target);

      // ── Always-on keys (work even inside inputs) ──────────────────────
      if (e.key === "Escape") {
        if (searchOpen) {setSearchOpen(false);e.preventDefault();return;}
        if (showShortcuts) {setShowShortcuts(false);e.preventDefault();return;}
        if (theater) {setTheater(false);e.preventDefault();return;}
        // Generic escape — let listeners (verse menu, popovers, etc.) close.
        window.dispatchEvent(new CustomEvent("codex:escape"));
        setVerseMenu(null);
        setLeftOpen(false);
        setRightOpen(false);
        return;
      }
      // ── Focus trap for the shortcuts modal ────────────────────────────
      // While the overlay is open, keep Tab cycling inside the modal so focus
      // can't escape to the page behind it.
      if (showShortcuts && e.key === "Tab" && kbdModalRef.current) {
        const modal = kbdModalRef.current;
        const focusables = Array.from(
          modal.querySelectorAll(
            'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (focusables.length) {
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          const active = document.activeElement;
          if (e.shiftKey && (active === first || !modal.contains(active))) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && (active === last || !modal.contains(active))) {
            e.preventDefault();
            first.focus();
          }
        } else {
          // Nothing tabbable but the modal itself — keep focus pinned.
          e.preventDefault();
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        // ⌘K is the OMNIBAR — the one door. (It used to focus the search
        // box; the omnibar's search mode subsumes that entirely.)
        setOmniOpen((o) => !o);
        return;
      }

      // Below here: ignore when user is typing.
      if (typing) return;
      // Ignore when modifier keys are held (don't fight browser/native shortcuts).
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key;

      // `?` (Shift+/) — shortcut overlay
      if (k === "?") {e.preventDefault();setShowShortcuts((v) => !v);return;}

      // Enter on a verse row → open verse menu
      if (k === "Enter") {
        const row = target.closest?.(".cx-verse, .cx-verse-row");
        if (row) {
          e.preventDefault();
          const n = Number(row.getAttribute("data-vn") || row.dataset?.vn);
          const v = passage.verses.find((x) => x.n === n) || passage.verses.find((x) => x.n === currentVerse);
          if (v) openVerseMenu(v, row.getBoundingClientRect());
          return;
        }
      }

      // Panel tabs 1..9
      if (/^[1-9]$/.test(k)) {
        const tabs = (window.railTabs ? window.railTabs() : null) || [
        { id: "trans" }, { id: "talmud" }, { id: "comm" }, { id: "gem" }, { id: "gnosis" }];

        const idx = Number(k) - 1;
        if (idx < tabs.length) {
          e.preventDefault();
          const id = tabs[idx].id;
          if (id === "gnosis" && !gnosisOn) setGnosisOn(true);
          setTab(id);
        }
        return;
      }

      switch (k) {
        case "j":case "J":
          e.preventDefault();scrollToVerse(+1);return;
        case "k":case "K":
          e.preventDefault();scrollToVerse(-1);return;
        case "h":case "H":{
            e.preventDefault();
            const book = data.books.find((b) => b.id === passage.bookId);
            if (passage.chapter > 1) loadPassage(passage.bookId, passage.chapter - 1, 1);else
            {
              const idx = data.books.findIndex((b) => b.id === passage.bookId);
              if (idx > 0) loadPassage(data.books[idx - 1].id, data.books[idx - 1].chapters, 1);
            }
            return;
          }
        case "l":case "L":{
            e.preventDefault();
            const book = data.books.find((b) => b.id === passage.bookId);
            if (book && passage.chapter < book.chapters) loadPassage(passage.bookId, passage.chapter + 1, 1);else
            {
              const idx = data.books.findIndex((b) => b.id === passage.bookId);
              if (idx >= 0 && idx < data.books.length - 1) loadPassage(data.books[idx + 1].id, 1, 1);
            }
            return;
          }
        case "o":case "O":
          // Oracle lives in the left rail — open it.
          e.preventDefault();
          setLeftOpen((o) => !o);
          if (leftCollapsed) setLeftCollapsed(false);
          dispatchShortcut("toggle-oracle");
          return;
        case "b":case "B":
          // Bookmarks rail (left). Just open the left rail where marks live.
          e.preventDefault();
          setLeftOpen((o) => !o);
          if (leftCollapsed) setLeftCollapsed(false);
          dispatchShortcut("toggle-bookmarks");
          return;
        case "n":case "N":{
            e.preventDefault();
            let visible = false;
            try {
              visible = localStorage.getItem("codex.notes.visible") === "1";
              localStorage.setItem("codex.notes.visible", visible ? "0" : "1");
            } catch {}
            if (!t.notesEnabled) setTweak("notesEnabled", true);
            window.dispatchEvent(new CustomEvent("codex:notes:toggle"));
            dispatchShortcut("toggle-notes");
            return;
          }
        case "m":case "M":
          e.preventDefault();
          if (verseMap) {
            closeVerseMap();
          } else {
            const cv = currentVerse || 1;
            const bookName = (CODEX_DATA.books.find((b) => b.id === book) || {}).name || book;
            const refStr = `${bookName} ${chapter}:${cv}`;
            openVerseMap(cv, refStr, "");
          }
          dispatchShortcut("toggle-map");
          return;
        case "t":case "T":
          e.preventDefault();
          // Open the right rail on the translations tab.
          setTab("trans");
          setRightOpen(true);
          if (rightCollapsed) setRightCollapsed(false);
          dispatchShortcut("open-translations");
          return;
        case "s":case "S":{
            e.preventDefault();
            const v = !sideBySide;
            setSideBySide(v);
            setTweak("sideBySide", v);
            return;
          }
        case "f":case "F":
          e.preventDefault();
          setTheater((v) => !v);
          return;
        default:
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // Re-bind whenever the closures' captured state changes.
  }, [theater, showShortcuts, searchOpen, passage, currentVerse, sideBySide, gnosisOn,
  leftCollapsed, rightCollapsed, data, loadPassage, openVerseMenu, t.notesEnabled]);

  useEffect(() => {setPrimary(t.primaryTranslation);}, [t.primaryTranslation]);
  useEffect(() => {setSideBySide(!!t.sideBySide);}, [t.sideBySide]);
  useEffect(() => {setRedLetter(!!t.redLetter);}, [t.redLetter]);
  useEffect(() => {try {localStorage.setItem("codex.compareSet", JSON.stringify(compareSet));} catch {}}, [compareSet]);

  const onToggleCompare = useCallback((id) => {
    setCompareSet((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }, []);

  const jumpToRef = useCallback((refStr) => {
    const loc = parseRef(refStr, data.books);
    if (loc) loadPassage(loc.bookId, loc.chapter, loc.verse);
    setLeftOpen(false);
  }, [data.books, loadPassage]);

  // Expose jumpToRef globally so external modules (side quests etc.)
  // can pivot the reader to a passage by reference string.
  useEffect(() => {window.codexJumpToRef = jumpToRef;}, [jumpToRef]);

  // Library smart-search dispatches codex:jump-ref for verse-level jumps;
  // chapter-level jumps go through onSelectChapter directly.
  useEffect(() => {
    const onJump = (e) => {const r = e && e.detail && e.detail.ref;if (r) jumpToRef(r);};
    window.addEventListener("codex:jump-ref", onJump);
    return () => window.removeEventListener("codex:jump-ref", onJump);
  }, [jumpToRef]);

  // Scroll a verse row into view and briefly flash it. Reuses the same
  // cx-kbd-flash treatment as keyboard verse navigation. Defensive: a missing
  // row (chapter still loading) is a no-op.
  const scrollAndFlash = useCallback((n) => {
    try {
      const sel = `.cx-verse[data-vn='${n}'], .cx-verse-row[data-vn='${n}']`;
      const el = document.querySelector(sel) ||
      document.querySelector(".cx-verse.is-hl, .cx-verse-row.is-hl");
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("cx-kbd-flash");
      setTimeout(() => el.classList.remove("cx-kbd-flash"), 220);
    } catch {}
  }, []);

  // Cross-reference chain navigation. The crossrefs panel announces intent on
  // the canonical bus; the host owns the thread + the reader pivot.
  //  · codex:xref-jump {key, ref, push} — push the key, navigate, flash.
  //  · codex:xref-back — pop, navigate to the new top (or seed), flash.
  // After each mutation the host re-broadcasts codex:xref-thread so the panel
  // reflects the canonical thread.
  const parseKeyVerse = (key) => {
    const parts = String(key || "").split(".");
    const v = parseInt(parts[2], 10);
    return Number.isFinite(v) ? v : 1;
  };
  // Verse key (`bookId.chapter.verse`) -> human ref ("Book C:V") that
  // jumpToRef/parseRef understands (parseRef matches on book NAME, not id).
  const keyToRef = useCallback((key) => {
    const parts = String(key || "").split(".");
    const bookId = (parts[0] || "").toLowerCase();
    const ch = parseInt(parts[1], 10);
    const v = parseInt(parts[2], 10);
    if (!bookId || !Number.isFinite(ch)) return null;
    const book = (data.books || []).find((b) => b.id === bookId);
    if (!book) return null;
    return `${book.name} ${ch}${Number.isFinite(v) ? ":" + v : ""}`;
  }, [data.books]);
  useEffect(() => {
    const onXrefJump = (e) => {
      const d = e && e.detail || {};
      const key = d.key || "";
      if (!key) return;
      if (d.push !== false) setXrefThread((prev) => [...prev, key]);
      // The host's codex:jump-ref listener routes to jumpToRef — dispatch once
      // (don't also call jumpToRef directly, or the reader navigates twice).
      const ref = d.ref || keyToRef(key);
      if (ref) {try {window.dispatchEvent(new CustomEvent("codex:jump-ref", { detail: { ref, source: "xref" } }));} catch {}}
      requestAnimationFrame(() => scrollAndFlash(parseKeyVerse(key)));
    };
    const onXrefBack = () => {
      setXrefThread((prev) => {
        if (!prev.length) return prev;
        const next = prev.slice(0, -1);
        const top = next.length ? next[next.length - 1] : null;
        if (top) {
          const ref = keyToRef(top);
          if (ref) {try {window.dispatchEvent(new CustomEvent("codex:jump-ref", { detail: { ref, source: "xref" } }));} catch {}}
          requestAnimationFrame(() => scrollAndFlash(parseKeyVerse(top)));
        }
        return next;
      });
    };
    window.addEventListener("codex:xref-jump", onXrefJump);
    window.addEventListener("codex:xref-back", onXrefBack);
    return () => {
      window.removeEventListener("codex:xref-jump", onXrefJump);
      window.removeEventListener("codex:xref-back", onXrefBack);
    };
  }, [scrollAndFlash, keyToRef]);

  // Re-broadcast the canonical thread whenever it changes so the crossrefs
  // panel breadcrumb stays in sync (the panel is a pure reflector).
  useEffect(() => {
    try {window.dispatchEvent(new CustomEvent("codex:xref-thread", { detail: { thread: xrefThread } }));} catch {}
  }, [xrefThread]);

  // Click on the reader title opens the Library. On mobile this slides the
  // left drawer in; on desktop the rail is already visible, so we also
  // un-collapse it and focus its search — otherwise the click looked dead.
  useEffect(() => {
    const onOpen = () => {
      setLeftOpen(true);
      setLeftCollapsed(false);
      setTimeout(() => {
        try {window.dispatchEvent(new CustomEvent("codex:focus-lib-search"));} catch {}
      }, 60);
    };
    window.addEventListener("codex:open-library", onOpen);
    return () => window.removeEventListener("codex:open-library", onOpen);
  }, []);

  // Plugin panels (cross-references, Strong's, word-study, dictionary,
  // passage-guide, vox, map) ask to be shown via `codex:open-panel`. Nothing
  // listened for it before, so those verse-menu actions silently did nothing.
  // Normalize the various detail shapes to the canonical tab id
  // `plugin:<pluginId>:<panelId>`, surface the right rail, switch to the tab,
  // and focus the clicked verse so the panel renders for it.
  useEffect(() => {
    const onOpenPanel = (e) => {
      const d = e && e.detail || {};
      let id = d.panelId || "";
      if (!id) return;
      if (d.pluginId && id.indexOf(":") === -1) id = `${d.pluginId}:${id}`;
      if (id.indexOf("plugin:") !== 0) id = `plugin:${id}`;
      const v = d.ctx && (d.ctx.verse || d.ctx.ref && d.ctx.ref.verse);
      if (v) setCurrentVerse(v);
      // Opening the cross-references panel for a verse seeds (resets) the
      // chain thread to that host verse so the breadcrumb starts fresh.
      if (id === "plugin:crossrefs-tsk:crossrefs") {
        const c = d.ctx && (d.ctx.ref || d.ctx) || {};
        const bId = c.bookId,ch = c.chapter,vn = c.verse;
        if (bId && ch) setXrefThread([`${String(bId).toLowerCase()}.${ch}.${vn || 1}`]);
      }
      setRightOpen(true);
      setRightCollapsed(false);
      setTab(id);
    };
    window.addEventListener("codex:open-panel", onOpenPanel);
    return () => window.removeEventListener("codex:open-panel", onOpenPanel);
  }, []);

  // Exiting a fullscreen experience (e.g. Reels) should return to reading, not
  // leave the rail open behind a dimmed scrim. Reels dispatches this on close.
  useEffect(() => {
    const onCloseRails = () => {setLeftOpen(false);setRightOpen(false);};
    window.addEventListener("codex:close-rails", onCloseRails);
    return () => window.removeEventListener("codex:close-rails", onCloseRails);
  }, []);

  // Quick translation switcher in the reader header → set primary.
  useEffect(() => {
    const onSet = (e) => {const id = e && e.detail && e.detail.id;if (id) setPrimary(id);};
    window.addEventListener("codex:set-primary", onSet);
    return () => window.removeEventListener("codex:set-primary", onSet);
  }, []);

  const onSelectMark = useCallback((m) => {
    loadPassage(m.bookId, m.chapter, m.verse);
    setLeftOpen(false);
  }, [loadPassage]);

  const onClearMark = useCallback((m) => {
    clearHighlight(m.bookId, m.chapter, m.verse);
  }, [clearHighlight]);

  const onMarkCurrent = useCallback(() => {
    const v = passage.verses.find((x) => x.n === currentVerse) || passage.verses[0];
    if (!v) return;
    const text = v[primary] || v.kjv || v.web || Object.values(v).find((x) => typeof x === "string") || "";
    toggleHighlight(passage.bookId, passage.chapter, v.n, null, text);
  }, [passage, currentVerse, primary, toggleHighlight]);

  const setPrimaryAndPersist = (id) => {
    setPrimary(id);
    setTweak("primaryTranslation", id);
  };

  const accent = ACCENT_MAP[t.accent] || ACCENT_MAP.cyan;
  // Drift mode hijacks the accent for the matrix-green Easter-egg theme.
  const driftAccent = { dark: "#39ff7a", light: "#0c5a30", glow: "rgba(57, 255, 122, 0.45)" };
  const useAccent = t.hermeneuticDriftCompensation ? driftAccent : accent;
  const themeStyle = {
    "--cx-accent": dark ? useAccent.dark : useAccent.light,
    "--cx-accent-glow": useAccent.glow,
    "--cx-oracle-fs": `${t.oracleFontScale || 14}px`
  };

  return (/*#__PURE__*/
    React.createElement("div", {
      className: `cx-app ${dark ? "is-dark" : "is-light"} ${t.scanlines ? "has-scan" : ""} font-${t.scriptureFont} ${leftOpen ? "left-open" : ""} ${rightOpen ? "right-open" : ""} ${distractionFree ? "is-distraction-free" : ""} ${theater ? "is-theater" : ""} ${leftCollapsed ? "is-l-collapsed" : ""} ${rightCollapsed ? "is-r-collapsed" : ""} ${t.hermeneuticDriftCompensation ? "is-drift" : ""} ${schizoEligible && t.schizo ? "is-schizo" : ""}`,
      style: themeStyle }, /*#__PURE__*/

    React.createElement("div", {
      className: "cx-rail-scrim",
      onClick: () => {setLeftOpen(false);setRightOpen(false);},
      "aria-hidden": true }
    ), /*#__PURE__*/
    React.createElement(StatusBar, {
      now: now, solar: solar, dark: dark,
      autoTheme: t.autoTheme,
      onToggleTheme: () => {
        if (t.autoTheme) setTweak("autoTheme", false);
        setTweak("manualDark", !dark);
      },
      onToggleAuto: () => setTweak("autoTheme", !t.autoTheme),
      bookmarkCount: marks.length,
      gnosisOn: gnosisOn,
      onToggleLeft: () => setLeftOpen((o) => !o),
      onToggleRight: () => setRightOpen((o) => !o),
      primary: primary,
      onSelectPrimary: setPrimaryAndPersist }
    ), /*#__PURE__*/

    React.createElement("div", { className: "cx-grid" },
    leftCollapsed ? /*#__PURE__*/
    React.createElement("button", {
      className: "cx-rail-spine cx-rail-spine-l",
      onClick: () => setLeftCollapsed(false),
      title: "Show library + oracle + marks",
      "aria-label": "Expand left rail" }, /*#__PURE__*/

    React.createElement("span", { className: "cx-rail-spine-glyph" }, "\u2263"), /*#__PURE__*/
    React.createElement("span", { className: "cx-rail-spine-arr" }, "\u25B6")
    ) :
    null, /*#__PURE__*/

    React.createElement(LeftRail, {
      isCollapsed: leftCollapsed,
      onCollapse: () => setLeftCollapsed(true),
      activeBookId: passage.bookId,
      activeChapter: passage.chapter,
      marks: marks,
      highlightColors: HIGHLIGHT_COLORS,
      onSelectMark: onSelectMark,
      onClearMark: onClearMark,
      onTogglePinMark: togglePinMark,
      onMarkCurrent: onMarkCurrent,
      onSelectChapter: (bookId, ch) => {loadPassage(bookId, ch, 1);setLeftOpen(false);},
      currentRef: `${passage.book} ${passage.chapter}:${currentVerse}`,
      onClose: () => setLeftOpen(false),
      oracleProps: {
        passage, currentVerse, primary, gnosisOn,
        driftMode: !!t.hermeneuticDriftCompensation,
        provider: t.provider || "anthropic",
        model: t.model || "claude-haiku-4-5-20251001",
        availableProviders,
        onAddBookmark: ({ ref }) => jumpToRef(ref), // legacy hook → just jump
        onJumpTo: ({ ref }) => jumpToRef(ref)
      } }
    ),

    tourOpen ? /*#__PURE__*/React.createElement(WelcomeTour, { onClose: closeTour }) : null, /*#__PURE__*/




    React.createElement("div", { className: "cx-center-col" },
    !wbDismissed && /*#__PURE__*/
    React.createElement(WelcomeBack, {
      onContinue: (session) => {
        loadPassage(session.bookId, session.chapter, 1);
        setWbDismissed(true);
      },
      onDismiss: () => setWbDismissed(true),
      onDiscoveryClick: (disc) => {
        if (disc.ref) {
          // Handle compound refs like "Gen 3:8 ↔ John 20:15" — take the first
          const firstRef = disc.ref.split(/\s*[↔→←]\s*/)[0].trim();
          const loc = parseRef(firstRef, data.books);
          if (loc) loadPassage(loc.bookId, loc.chapter, loc.verse || 1);
        }
        setWbDismissed(true);
      } }
    ),











    t.continuityEnabled !== false && window.CODEX_CONTINUITY && window.CODEX_CONTINUITY.Mount ?
    React.createElement(window.CODEX_CONTINUITY.Mount) :
    null, /*#__PURE__*/

    React.createElement(Reader, {
      schizo: !!(schizoEligible && t.schizo),
      passage: passage,
      primary: primary,
      compareTranslations: compareSet,
      sideBySide: sideBySide,
      onToggleSideBySide: () => {const v = !sideBySide;setSideBySide(v);setTweak("sideBySide", v);},
      gnosisOn: gnosisOn,
      redLetter: redLetter,
      onToggleRedLetter: () => {const v = !redLetter;setRedLetter(v);setTweak("redLetter", v);},
      fontScale: t.fontScale,
      onCycleFontSize: () => {
        const sizes = [16, 19, 22, 26, 30];
        const idx = sizes.indexOf(t.fontScale);
        const next = sizes[(idx + 1) % sizes.length] || 22;
        setTweak("fontScale", next);
      },
      highlightedVerse: currentVerse,
      onSelectVerse: (n) => setCurrentVerse(n),
      onSelectPrimary: setPrimaryAndPersist,
      yhwhMode: !!t.yhwhMode,
      onToggleYHWH: () => setTweak("yhwhMode", !t.yhwhMode),
      highlights: highlights,
      highlightColor: t.highlightColor,
      onToggleHighlight: (n, color) => {
        const v = passage.verses.find((x) => x.n === n);
        const text = v ? v[primary] || v.kjv || v.web || "" : "";
        toggleHighlight(passage.bookId, passage.chapter, n, color, text);
      },
      onOpenVerseMenu: openVerseMenu,
      panelData: panelData,
      onPrevChapter: () => {
        const book = data.books.find((b) => b.id === passage.bookId);
        if (passage.chapter > 1) loadPassage(passage.bookId, passage.chapter - 1, 1);else
        {
          const idx = data.books.findIndex((b) => b.id === passage.bookId);
          if (idx > 0) loadPassage(data.books[idx - 1].id, data.books[idx - 1].chapters, 1);
        }
      },
      onNextChapter: () => {
        const book = data.books.find((b) => b.id === passage.bookId);
        if (passage.chapter < book.chapters) loadPassage(passage.bookId, passage.chapter + 1, 1);else
        {
          const idx = data.books.findIndex((b) => b.id === passage.bookId);
          if (idx < data.books.length - 1) loadPassage(data.books[idx + 1].id, 1, 1);
        }
      } }
    )
    ), /*#__PURE__*/




    React.createElement(RightRail, {
      isCollapsed: rightCollapsed,
      onCollapse: () => setRightCollapsed(true),
      tab: tab,
      onTab: setTab,
      gnosisOn: gnosisOn,
      onToggleGnosis: setGnosisOn,
      primary: primary,
      onPrimary: setPrimaryAndPersist,
      compareSet: compareSet,
      onToggleCompare: onToggleCompare,
      passage: passage,
      currentVerse: currentVerse,
      panelData: panelData,
      panelStatus: panelStatus,
      panelMeta: panelMeta,
      onRegeneratePanels: regeneratePanels,
      disarmData: disarmData,
      disarmStatus: disarmStatus,
      disarmMeta: disarmMeta,
      onRegenerateDisarm: regenerateDisarm,
      onClose: () => setRightOpen(false),
      onJumpRef: jumpToRef,
      pluginVersion: pluginVersion,
      translation: primary }
    ),

    rightCollapsed ? /*#__PURE__*/
    React.createElement("button", {
      className: "cx-rail-spine cx-rail-spine-r",
      onClick: () => setRightCollapsed(false),
      title: "Show translations + panels",
      "aria-label": "Expand right rail" }, /*#__PURE__*/

    React.createElement("span", { className: "cx-rail-spine-arr" }, "\u25C0"), /*#__PURE__*/
    React.createElement("span", { className: "cx-rail-spine-glyph" }, "\u22EE")
    ) :
    null
    ), /*#__PURE__*/

    React.createElement(FooterBar, {
      currentVerse: currentVerse,
      passage: passage,
      gnosisOn: gnosisOn,
      onToggleGnosis: setGnosisOn,
      compareCount: compareSet.length,
      onOpenLeft: () => setLeftOpen(true),
      onOpenRight: () => setRightOpen(true),
      distractionFree: distractionFree,
      onToggleDistractionFree: toggleDistractionFree,
      theater: theater,
      onToggleTheater: toggleTheater,
      leftCollapsed: leftCollapsed,
      onToggleLeftCollapsed: () => {
        setLeftOpen(false); // close any mobile slide-out too
        setLeftCollapsed((v) => !v);
      },
      rightCollapsed: rightCollapsed,
      onToggleRightCollapsed: () => {
        setRightOpen(false);
        setRightCollapsed((v) => !v);
      },
      onShowShortcuts: () => setShowShortcuts(true),
      onOpenReels: () => {setRightOpen(true);setRightCollapsed(false);setTab("plugin:reels:reels");},
      isOnline: isOnline }
    ),

    theater ? /*#__PURE__*/
    React.createElement("button", { className: "cx-theater-exit", onClick: () => setTheater(false), title: "Exit focus (ESC)" }, "\u25D0 EXIT FOCUS \xB7 ESC"

    ) :
    null,

    schizoEligible && t.schizo ? /*#__PURE__*/
    React.createElement("div", { className: "cx-schizo-sigil", "aria-hidden": "true", title: "Schizo Mode active" }, "\u26AF") :
    null, /*#__PURE__*/

    React.createElement(ToastDock, null),


    searchOpen && window.CODEX_SearchBar ?
    React.createElement(window.CODEX_SearchBar, {
      open: true,
      onClose: () => setSearchOpen(false),
      onNavigate: (bookId, chapter, verse) => {
        try {loadPassage(bookId, chapter, verse || 1);} catch {}
      }
    }) :
    null,

    showShortcuts ? /*#__PURE__*/
    React.createElement("div", { className: "cx-kbd-overlay", onClick: () => setShowShortcuts(false), role: "dialog", "aria-modal": "true", "aria-label": "Keyboard shortcuts" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-kbd-modal", ref: kbdModalRef, tabIndex: -1, onClick: (e) => e.stopPropagation() }, /*#__PURE__*/
    React.createElement("div", { className: "cx-kbd-hd" }, /*#__PURE__*/
    React.createElement("b", null, "Keyboard shortcuts"), /*#__PURE__*/
    React.createElement("button", { className: "cx-kbd-x", onClick: () => setShowShortcuts(false), "aria-label": "Close" }, "\xD7")
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-kbd-grid" },
    [
    ["J", "Next verse"],
    ["K", "Previous verse"],
    ["H", "Previous chapter"],
    ["L", "Next chapter"],
    ["⌘/Ctrl + K", "Focus search"],
    ["1 – 9", "Switch panel tab"],
    ["O", "Toggle Oracle / left rail"],
    ["B", "Toggle bookmarks"],
    ["N", "Toggle notes"],
    ["M", "Toggle verse map"],
    ["T", "Open translations"],
    ["S", "Toggle side-by-side"],
    ["F", "Toggle theater mode"],
    ["Enter", "Open verse menu (on a verse)"],
    ["?", "Show this overlay"],
    ["Esc", "Close popovers / overlays"]].
    map(([key, label]) => /*#__PURE__*/
    React.createElement(React.Fragment, { key: key }, /*#__PURE__*/
    React.createElement("kbd", { className: "cx-kbd-key" }, key), /*#__PURE__*/
    React.createElement("span", { className: "cx-kbd-lbl" }, label)
    )
    )
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-kbd-ft" }, "Press ", /*#__PURE__*/React.createElement("kbd", { className: "cx-kbd-key" }, "?"), " any time to reopen.")
    )
    ) :
    null,

    verseMenu && window.VerseMenu ? /*#__PURE__*/
    React.createElement(VerseMenu, {
      anchor: verseMenu.anchor,
      verse: verseMenu.verse,
      passage: passage,
      primary: primary,
      translations: data.translations,
      sideBySide: sideBySide,
      gnosisOn: gnosisOn,
      highlightColor: t.highlightColor,
      highlightColors: HIGHLIGHT_COLORS,
      currentHighlight: highlights[`${passage.bookId}.${passage.chapter}.${verseMenu.verse?.n}`]?.color || null,
      onClose: closeVerseMenu,
      onCompare: (n) => {
        setCurrentVerse(n);
        if (!sideBySide) {setSideBySide(true);setTweak("sideBySide", true);}
      },
      onSetPrimary: setPrimaryAndPersist,
      onAskOracle: (verse, refStr, text) => {
        setLeftOpen(true);
        window.dispatchEvent(new CustomEvent("oracle:prefill", { detail: { ref: refStr, text } }));
      },
      onToggleGnosis: setGnosisOn,
      onToggleHighlight: (color) => {
        const v = verseMenu.verse;
        const text = v ? v[primary] || v.kjv || v.web || "" : "";
        toggleHighlight(passage.bookId, passage.chapter, v.n, color, text);
      },
      onClearHighlight: () => clearHighlight(passage.bookId, passage.chapter, verseMenu.verse.n),
      onOpenMap: openVerseMap,
      onOpenArt: openVerseArt,
      onOpenCompare: openVerseCompare,
      onOpenMirror: openVerseMirror,
      onOpenSword: openVerseSword,
      onOpenOps: (v, refStr) => openOps(`Build a cited study of ${refStr} — context, cross-references, original language, and what this verse divides.`),
      pluginVersion: pluginVersion,
      onOpenNote: (v, refStr) => {
        if (window.CODEX_ENGAGE) window.CODEX_ENGAGE.trackNote();
        // Pre-seed the draft in localStorage BEFORE the widget mounts so
        // its initial state already has the verse pinned. Bulletproof
        // against race conditions between enabling notes + the open
        // event reaching a not-yet-mounted listener.
        try {
          const cur = localStorage.getItem("codex.notes.draft") || "";
          const prefix = `[${refStr}] `;
          if (!cur.startsWith(prefix)) {
            localStorage.setItem("codex.notes.draft", prefix + cur);
          }
          localStorage.setItem("codex.notes.visible", "1");
        } catch {}
        if (!t.notesEnabled) setTweak("notesEnabled", true);
        // Also dispatch the event so already-mounted widgets pick up
        // the new ref immediately (without overwriting drafts).
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("codex:notes:show", { detail: { ref: refStr } }));
        }, 60);
      } }
    ) :
    null,

    verseMap && window.VerseMap ? /*#__PURE__*/
    React.createElement(VerseMap, {
      verse: verseMap.verse,
      refStr: verseMap.refStr,
      verseText: verseMap.text,
      passage: passage,
      primary: primary,
      onClose: closeVerseMap }
    ) :
    null,

    verseArt && window.VerseArt ? /*#__PURE__*/
    React.createElement(VerseArt, {
      verse: verseArt.verse,
      refStr: verseArt.refStr,
      verseText: verseArt.text,
      passage: passage,
      primary: primary,
      onClose: closeVerseArt }
    ) :
    null,

    window.Notes && t.notesEnabled ? /*#__PURE__*/
    React.createElement(Notes, {
      passage: passage,
      currentVerse: currentVerse,
      onJumpTo: ({ ref }) => jumpToRef(ref),
      onDisable: () => setTweak("notesEnabled", false) }
    ) :
    null,

    verseCompare && window.VerseCompare ? /*#__PURE__*/
    React.createElement(VerseCompare, {
      verse: verseCompare.verse,
      refStr: verseCompare.refStr,
      passage: passage,
      primary: primary,
      onClose: closeVerseCompare }
    ) :
    null,

    verseMirror && window.VerseMirror ? /*#__PURE__*/
    React.createElement(VerseMirror, {
      verse: verseMirror.verse,
      refStr: verseMirror.refStr,
      verseText: verseMirror.text,
      passage: passage,
      primary: primary,
      onClose: closeVerseMirror,
      onJumpRef: jumpToRef }
    ) :
    null,

    verseSword && window.VerseSword ? /*#__PURE__*/
    React.createElement(VerseSword, {
      verse: verseSword.verse,
      refStr: verseSword.refStr,
      verseText: verseSword.text,
      passage: passage,
      primary: primary,
      onClose: closeVerseSword,
      onJumpRef: jumpToRef }
    ) :
    null,

    opsOpen && window.VerseOps ? /*#__PURE__*/
    React.createElement(VerseOps, {
      seed: opsOpen.seed,
      onClose: closeOps,
      onJumpRef: jumpToRef }
    ) :
    null,

    omniOpen && window.Omnibar ? /*#__PURE__*/
    React.createElement(Omnibar, { onClose: () => setOmniOpen(false) }) :
    null,

    constOpen && window.VerseConstellation ? /*#__PURE__*/
    React.createElement(VerseConstellation, { onClose: () => setConstOpen(false) }) :
    null, /*#__PURE__*/















    React.createElement(TweaksPanel, { title: tt("settings") }, /*#__PURE__*/
    React.createElement(TweakSection, { label: tt("language") }), /*#__PURE__*/
    React.createElement(LangPicker, { value: t.lang || "en", onChange: (v) => setTweak("lang", v) }), /*#__PURE__*/

    React.createElement(TweakSection, { label: "AI Engines" }), /*#__PURE__*/
    React.createElement(ApiKeysSection, null), /*#__PURE__*/

    React.createElement(TweakSection, { label: "AI Model" }), /*#__PURE__*/
    React.createElement(AIModelSection, {
      provider: t.provider || "anthropic",
      model: t.model || "claude-haiku-4-5-20251001",
      availableProviders: availableProviders,
      onChange: ({ provider, model }) => {
        setTweak("provider", provider);
        if (model) setTweak("model", model);
      } }
    ), /*#__PURE__*/

    React.createElement(TweakSection, { label: "Cross-device sync" }), /*#__PURE__*/
    React.createElement(SyncSection, null), /*#__PURE__*/

    React.createElement(TweakSection, { label: tt("install") }), /*#__PURE__*/
    React.createElement("button", {
      className: `cx-install-btn ${installed ? "is-installed" : ""}`,
      onClick: triggerInstall,
      disabled: installed,
      title: installed ?
      "CODEX is installed and runs fully offline." :
      isIOS ?
      "Tap to see iPhone / iPad install steps." :
      "Install CODEX as a real app — works offline, lives on your dock." },

    installed ? /*#__PURE__*/
    React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", { className: "cx-install-glyph" }, "\u2713"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, window.t?.("installed") || "INSTALLED"), /*#__PURE__*/React.createElement("i", null, window.t?.("installed.sub") || "running as a standalone app · offline-ready"))) : /*#__PURE__*/
    React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", { className: "cx-install-glyph" }, "\u2913"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, window.t?.("install.codex") || "INSTALL CODEX"), /*#__PURE__*/React.createElement("i", null, isIOS ? window.t?.("install.ios.sub") || "tap for iPhone / iPad steps" : window.t?.("install.sub") || "one tap · offline · home-screen icon")))
    ), /*#__PURE__*/

    React.createElement(TweakSection, { label: window.t?.("look") || "Look" }), /*#__PURE__*/
    React.createElement(TweakColor, { label: tt("look.accent"),
      value: ACCENT_MAP[t.accent].dark,
      options: Object.values(ACCENT_MAP).map((a) => a.dark),
      onChange: (v) => {
        const key = Object.keys(ACCENT_MAP).find((k) => ACCENT_MAP[k].dark === v) || "cyan";
        setTweak("accent", key);
      } }), /*#__PURE__*/
    React.createElement(TweakToggle, { label: tt("look.scanlines"), value: t.scanlines,
      onChange: (v) => setTweak("scanlines", v) }),




    schizoEligible ? /*#__PURE__*/
    React.createElement("div", { className: "cx-schizo-toggle" }, /*#__PURE__*/
    React.createElement(TweakToggle, { label: "Schizo Mode", value: !!t.schizo,
      onChange: (v) => setTweak("schizo", v) })
    ) :
    null, /*#__PURE__*/

    React.createElement("div", { style: { marginTop: 8, fontSize: 11, opacity: 0.7, letterSpacing: '.04em' } }, "Day-mode palette"),
    typeof LightThemePicker !== "undefined" ? /*#__PURE__*/React.createElement(LightThemePicker, null) : typeof window !== "undefined" && window.LightThemePicker ? React.createElement(window.LightThemePicker) : null, /*#__PURE__*/


    React.createElement(TweakSection, { label: tt("marks") }), /*#__PURE__*/
    React.createElement(TweakColor, { label: tt("marks.color"),
      value: HIGHLIGHT_COLORS[t.highlightColor]?.swatch || HIGHLIGHT_COLORS.amber.swatch,
      options: Object.values(HIGHLIGHT_COLORS).map((c) => c.swatch),
      onChange: (v) => {
        const key = Object.keys(HIGHLIGHT_COLORS).find((k) => HIGHLIGHT_COLORS[k].swatch === v) || "amber";
        setTweak("highlightColor", key);
      } }), /*#__PURE__*/
    React.createElement("button", {
      className: "cx-mini-btn",
      style: { marginTop: 6 },
      onClick: () => {
        if (marks.length === 0) return;
        const msg = (tt("marks.clear.confirm") || "Clear all {n} marks?").replace("{n}", marks.length);
        if (window.confirm(msg)) setHighlights({});
      } },
    tt("marks.clear"), " (", marks.length, ")"), /*#__PURE__*/

    React.createElement(TweakSection, { label: tt("reading") }), /*#__PURE__*/
    React.createElement(TweakToggle, { label: tt("reading.caffeinate"), value: !!t.caffeinate,
      onChange: (v) => setTweak("caffeinate", v) }), /*#__PURE__*/
    React.createElement(TweakToggle, { label: tt("reading.notes"), value: !!t.notesEnabled,
      onChange: (v) => setTweak("notesEnabled", v) }), /*#__PURE__*/
    React.createElement(TweakToggle, {
      label: "Auto-bundle translations as I read",
      value: window.CODEX_TP?.autoBundleEnabled?.() ?? true,
      onChange: (v) => {window.CODEX_TP?.setAutoBundle?.(v);} }
    ), /*#__PURE__*/
    React.createElement(TweakSlider, { label: tt("reading.oracle.fs"), value: t.oracleFontScale || 14,
      min: 11, max: 20, unit: "px",
      onChange: (v) => setTweak("oracleFontScale", v) }),
    !("wakeLock" in navigator) ? /*#__PURE__*/
    React.createElement("p", { className: "cx-export-hint", style: { marginTop: -2 } },
    tt("reading.caffeinate.unsupported")
    ) :
    null, /*#__PURE__*/

    React.createElement(TweakSection, { label: "Modules" }), /*#__PURE__*/
    React.createElement("div", { className: "cx-export-row" }, /*#__PURE__*/
    React.createElement("button", {
      className: "cx-mini-btn",
      title: "Browse and install plugin modules",
      onClick: () => {
        setRightOpen(true);
        setRightCollapsed(false);
        setTab("plugin:marketplace:market");
      } },
    "Open Marketplace")
    ), /*#__PURE__*/
    React.createElement("p", { className: "cx-export-hint" }, "Install, update, and manage plugin modules from the Marketplace."), /*#__PURE__*/

    React.createElement(TweakSection, { label: tt("data.portable") }), /*#__PURE__*/
    React.createElement("div", { className: "cx-export-row" }, /*#__PURE__*/
    React.createElement("button", { className: "cx-mini-btn", onClick: exportAll, title: "Download every mark, cached chapter, panel, and setting as one JSON file" },
    tt("data.export")
    ), /*#__PURE__*/
    React.createElement("button", { className: "cx-mini-btn", onClick: importPick, title: "Restore from a CODEX export file" },
    tt("data.import")
    )
    ), /*#__PURE__*/
    React.createElement("p", { className: "cx-export-hint" }, tt("data.hint")), /*#__PURE__*/

    React.createElement(TweakSection, { label: tt("cache") }), /*#__PURE__*/
    React.createElement(OfflineStatus, { bookLookup: data.books }), /*#__PURE__*/
    React.createElement(CachedPanelsBrowser, { onJump: jumpToRef, bookLookup: data.books }), /*#__PURE__*/
    React.createElement("button", {
      className: "cx-mini-btn",
      onClick: async () => {
        if (!window.confirm("Clear all cached chapters and panels? Your marks and settings stay.")) return;
        for (const k of Object.keys(localStorage)) {
          if (/^codex\.(bible|panels|redletter)\./i.test(k)) localStorage.removeItem(k);
        }
        if (window.caches) {
          for (const n of await caches.keys()) await caches.delete(n);
        }
        window.location.reload();
      } },
    tt("cache.clear")), /*#__PURE__*/

    React.createElement(TweakSection, { label: "Offline \xB7 Bibles" }), /*#__PURE__*/
    React.createElement(OfflineBiblesPanel, { bookLookup: data.books }), /*#__PURE__*/



    React.createElement(TweakSection, { label: "Advanced inference" }), /*#__PURE__*/
    React.createElement(TweakToggle, {
      label: "Hermeneutic drift compensation",
      value: !!t.hermeneuticDriftCompensation,
      onChange: (v) => setTweak("hermeneuticDriftCompensation", v) }
    ), /*#__PURE__*/
    React.createElement("p", { className: "cx-export-hint", style: { marginTop: -2, opacity: 0.55 } }, "Cross-corpus inferential broadening. Experimental."

    ), /*#__PURE__*/

    React.createElement(TweakSection, { label: "First impression" }), /*#__PURE__*/
    React.createElement(TweakToggle, {
      label: "Boot intro sequence",
      value: !!t.bootIntro,
      onChange: (v) => {
        setTweak("bootIntro", v);
        try {localStorage.setItem("codex.bootIntro", v ? "1" : "0");} catch {}
      } }
    ), /*#__PURE__*/
    React.createElement("p", { className: "cx-export-hint", style: { marginTop: -2, opacity: 0.55 } }, "Terminal-style cold boot on launch. Off = jump straight to scripture."

    ), /*#__PURE__*/





    React.createElement(TweakSection, { label: "Keyboard" }), /*#__PURE__*/
    React.createElement("button", {
      className: "cx-mini-btn",
      onClick: () => setShowShortcuts(true),
      title: "Show keyboard shortcut reference (or press ?)" },
    "\u2328 SHOW KEYBOARD SHORTCUTS (?)"), /*#__PURE__*/
    React.createElement("p", { className: "cx-export-hint", style: { marginTop: -2 } }, "Full keyboard navigation: J/K to scroll verses, H/L for chapters, 1\u20139 for panels, O/B/N/M/T/S/F for features, ? for the full list, Esc to close popovers."



    ), /*#__PURE__*/

    React.createElement(TweakSection, { label: "Danger zone" }), /*#__PURE__*/
    React.createElement("button", {
      className: "cx-mini-btn cx-reset-btn",
      onClick: () => {
        if (!window.confirm("Reset all settings to factory defaults?\n\nThis clears: theme, accent, font size, language, API keys, drift mode, and every UI tweak.\n\nKeeps: your marks, notes, cached scripture, panels, conversations.")) return;
        try {
          localStorage.removeItem("codex.tweaks.v1");
          localStorage.removeItem("codex.api.keys.v1");
          localStorage.removeItem("codex.lrail.width");
          localStorage.removeItem("codex.rrail.width");
          localStorage.removeItem("codex.tp.lang.order.v1");
          localStorage.removeItem("codex.tp.lang.collapsed.v1");
          localStorage.removeItem("codex.tp.trans.order.v1");
          localStorage.removeItem("codex.oracle.quickHidden");
        } catch {}
        window.location.reload();
      },
      title: "Wipe every preference and reload \u2014 leaves your marks, notes, and cached scripture untouched." },
    "\u21BA RESET FACTORY SETTINGS"), /*#__PURE__*/
    React.createElement("p", { className: "cx-export-hint", style: { marginTop: -2 } }, "Wipes settings + API keys only. Your marks, notes, and cached scripture survive. (Use the cache button above for those.)"


    )
    )
    ));

}

// Offline-status indicator — top-of-cache section. Tells the user at a
// glance whether the app can survive without network: SW installed +
// scripture chapters cached + panels cached. Critical reassurance for
// readers using CODEX in places where connectivity is dangerous or rare.
// ── Offline-bibles catalog · per-translation status, verify, repair ────
// Lists every translation that has at least one chapter cached. For each,
// shows the cached/total counts and offers "Test" (cache-only sanity scan
// + tries to read a sample chapter without network) and "Repair" (re-fetch
// missing or corrupt chapters).
function OfflineBiblesPanel({ bookLookup }) {
  const [bumpKey, bump] = useState(0);
  const [busy, setBusy] = useState(null); // translation id currently testing/repairing
  const [results, setResults] = useState({});
  const [diag, setDiag] = useState(null);
  const data = window.CODEX_DATA;
  const bumpNow = () => bump((n) => n + 1);

  // BIBLE.ready resolves after IDB warm-load + LS migration. Bump so the
  // memoised translations list re-derives with cached counts now visible.
  useEffect(() => {
    const onReady = () => {bumpNow();refreshDiag();};
    window.addEventListener("codex:bible:ready", onReady);
    if (window.BIBLE?.ready) window.BIBLE.ready.then(onReady);
    return () => window.removeEventListener("codex:bible:ready", onReady);
  }, []);
  const refreshDiag = async () => {
    if (!window.BIBLE?.storage?.diagnose) return;
    try {setDiag(await window.BIBLE.storage.diagnose());} catch {}
  };
  useEffect(() => {refreshDiag();}, [bumpKey]);

  // Translations with any cache at all. Re-derived on every bump so
  // remove/repair actually shrink the list immediately.
  const translations = useMemo(() => {
    if (!window.BIBLE?.cacheStats) return [];
    return data.translations.
    map((t) => ({ t, stats: window.BIBLE.cacheStats(t.id, bookLookup) })).
    filter(({ stats }) => stats.cached > 0);
  }, [data.translations, bookLookup, bumpKey]);

  const test = async (t) => {
    setBusy(t.id);
    setResults((r) => ({ ...r, [t.id]: { phase: "scanning…" } }));
    const v = window.BIBLE.verifyTranslation(t.id, bookLookup);
    // Thorough offline-read smoke test: pick UP TO 5 random cached
    // chapters, simulate offline by stubbing fetch, ensure each loads
    // cleanly. After Phase A the source of truth is IDB (mirrored to
    // _memCache), not localStorage — so we sweep the bookLookup for any
    // cached entry rather than reading the stale legacy LS blob.
    const keys = [];
    for (const b of bookLookup) {
      for (let ch = 1; ch <= b.chapters; ch++) {
        if (window.BIBLE.readOffline(b.id, ch, t.id)) keys.push(`${b.id}.${ch}.${t.id}`);
      }
    }
    const picks = [];
    for (let i = 0; i < Math.min(5, keys.length); i++) {
      const idx = Math.floor(Math.random() * keys.length);
      picks.push(keys.splice(idx, 1)[0]);
    }
    const samples = [];
    const origFetch = window.fetch;
    window.fetch = () => Promise.reject(new Error("__OFFLINE_TEST__"));
    try {
      for (const k of picks) {
        const [bookId, ch] = k.split(".");
        try {
          const verses = await window.BIBLE.loadChapter(bookId, parseInt(ch, 10), t.id);
          const ok = Array.isArray(verses) && verses.length > 0 &&
          typeof verses[0]?.text === "string" && verses[0].text.length > 4;
          samples.push({ ref: `${bookId} ${ch}`, ok, count: verses?.length || 0 });
        } catch (e) {
          samples.push({ ref: `${bookId} ${ch}`, ok: false, err: String(e.message || e).slice(0, 40) });
        }
      }
    } finally {
      window.fetch = origFetch;
    }
    const allOk = samples.length > 0 && samples.every((s) => s.ok);
    const smoke = {
      ok: allOk,
      sample: samples.length === 0 ?
      "no chapters to test" :
      `${samples.filter((s) => s.ok).length}/${samples.length} chapters read offline · ${samples.map((s) => `${s.ref}${s.ok ? "✓" : "✗"}`).join(" ")}`
    };
    setResults((r) => ({ ...r, [t.id]: { ...v, smoke } }));
    setBusy(null);
  };

  const repair = (t) => {
    setBusy(t.id);
    setResults((r) => ({ ...r, [t.id]: { ...(r[t.id] || {}), phase: `repairing 0…` } }));
    window.BIBLE.repairTranslation(t.id, bookLookup, (p) => {
      if (p.complete) {
        const cs = p.checksum;
        const phase = p.nothingToDo ?
        "nothing to repair" :
        cs?.passed ?
        `✓ checksum OK · ${cs.cached}/${cs.total} chapters · ${cs.totalVerses} verses` :
        `repair done · ${cs?.cached || "?"}/${cs?.total || "?"} cached · ${cs?.missing || 0} unrecoverable · ${cs?.corrupt || 0} corrupt`;
        setResults((r) => ({ ...r, [t.id]: { ...(cs || {}), smoke: r[t.id]?.smoke, phase } }));
        setBusy(null);
        bumpNow();
        return;
      }
      if (p.aborted) {setBusy(null);bumpNow();return;}
      // Update progress string depending on phase
      const msg = p.phase === "retry" ?
      `retrying stragglers ${p.retryDone || 0}/${p.retryTotal || 0}` + (p.error ? ` (failed ${p.book} ${p.chapter})` : "") :
      `repairing ${p.done}/${p.total}` + (p.error ? ` (skipped ${p.book} ${p.chapter})` : "");
      setResults((r) => ({ ...r, [t.id]: { ...(r[t.id] || {}), phase: msg } }));
      if ((p.done || 0) % 25 === 0) bumpNow();
    });
  };

  const exportBundleFile = (t) => {
    const bundle = window.BIBLE.storage.exportBundle(t.id);
    const blob = new Blob([JSON.stringify(bundle)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t.id}.json`;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setResults((r) => ({ ...r, [t.id]: { ...(r[t.id] || {}), phase: `exported ${bundle.chapterCount} chapters as ${t.id}.json — drop into /data/bibles/ to ship` } }));
  };

  const remove = (t) => {
    if (!window.confirm(`Remove the offline copy of ${t.name}? Chapters re-fetch as you read.`)) return;
    // Go through BIBLE.removeTranslation so the in-memory cache stays
    // consistent (direct localStorage writes were leaving _memCache stale).
    const removed = window.BIBLE.removeTranslation(t.id);
    try {window.dispatchEvent(new CustomEvent("codex:translations-changed", { detail: { id: t.id } }));} catch {}
    setResults((r) => {const x = { ...r };delete x[t.id];return x;});
    bumpNow();
    return removed;
  };

  if (translations.length === 0) {
    return (/*#__PURE__*/
      React.createElement("p", { className: "cx-export-hint", style: { opacity: 0.6 } }, "No bibles downloaded yet. Use the offline icon next to a translation in the Translations panel to save it for offline reading."


      ));

  }

  // ── Mass operations: TEST ALL / REPAIR ALL / CHECK UPDATES ───────────
  const [massBusy, setMassBusy] = useState(null);
  const [massStatus, setMassStatus] = useState("");
  const [updates, setUpdates] = useState(null); // null | array of update entries
  const [updateChoices, setUpdateChoices] = useState({});

  const testAll = async () => {
    setMassBusy("test");
    let pass = 0,fail = 0;
    // Snapshot the list since cache mutations during the loop could
    // change `translations`. Read smoke result directly from the local
    // smoke variable rather than React state (closure was stale).
    const list = translations.slice();
    for (const { t } of list) {
      setMassStatus(`testing ${t.name}… (${pass + fail + 1}/${list.length})`);
      // Replicate test()'s smoke logic inline so we can read the result
      // synchronously without waiting for a React re-render.
      const v = window.BIBLE.verifyTranslation(t.id, bookLookup);
      const cache = JSON.parse(localStorage.getItem("codex.bible.cache.v2") || "{}");
      const allKeys = [];
      for (const b of bookLookup) for (let ch = 1; ch <= b.chapters; ch++)
      if (window.BIBLE.readOffline(b.id, ch, t.id)) allKeys.push({ b: b.id, c: ch });
      const picks = [];const pool = allKeys.slice();
      for (let i = 0; i < Math.min(5, pool.length); i++) {
        const idx = Math.floor(Math.random() * pool.length);
        picks.push(pool.splice(idx, 1)[0]);
      }
      const samples = [];
      const orig = window.fetch;
      window.fetch = () => Promise.reject(new Error("__OFFLINE_TEST__"));
      try {
        for (const k of picks) {
          try {
            const verses = await window.BIBLE.loadChapter(k.b, k.c, t.id);
            const ok = Array.isArray(verses) && verses.length > 0 && typeof verses[0]?.text === "string" && verses[0].text.length > 4;
            samples.push({ ref: `${k.b} ${k.c}`, ok });
          } catch (e) {
            samples.push({ ref: `${k.b} ${k.c}`, ok: false });
          }
        }
      } finally {window.fetch = orig;}
      const allOk = samples.length > 0 && samples.every((s) => s.ok);
      const smoke = { ok: allOk, sample: samples.length === 0 ? "no chapters to test" : `${samples.filter((s) => s.ok).length}/${samples.length} read offline` };
      setResults((r) => ({ ...r, [t.id]: { ...v, smoke } }));
      if (allOk) pass++;else fail++;
    }
    setMassStatus(`✓ TEST ALL complete · ${pass} ok · ${fail} with issues`);
    setMassBusy(null);
  };

  const repairAll = async () => {
    if (!window.confirm(`Repair every cached translation (${translations.length})? This may take many minutes.`)) return;
    setMassBusy("repair");
    let i = 0;
    for (const { t } of translations) {
      i++;
      setMassStatus(`repairing ${t.name} · ${i}/${translations.length}`);
      await new Promise((resolve) => {
        window.BIBLE.repairTranslation(t.id, bookLookup, (p) => {
          if (p.complete || p.aborted) {
            const cs = p.checksum;
            setResults((r) => ({ ...r, [t.id]: { ...(cs || {}), phase: cs?.passed ? `✓ ${cs.cached}/${cs.total} · ${cs.totalVerses} verses` : `done · ${cs?.cached}/${cs?.total}` } }));
            resolve();
          }
        });
      });
      bumpNow();
    }
    setMassStatus(`✓ REPAIR ALL complete`);
    setMassBusy(null);
  };

  const checkUpdates = async () => {
    setMassBusy("check");
    setMassStatus("checking…");
    try {
      const list = await window.BIBLE.storage.checkUpdates(window.CODEX_DATA.translations);
      setUpdates(list);
      const initial = {};
      for (const u of list) initial[u.id] = u.hasUpdate; // pre-check the ones with updates
      setUpdateChoices(initial);
      const have = list.filter((u) => u.hasUpdate).length;
      setMassStatus(have ? `${have} update${have > 1 ? "s" : ""} available` : "all up-to-date");
    } catch (e) {
      setMassStatus("check failed: " + (e.message || e));
    }
    setMassBusy(null);
  };

  const applyUpdates = async () => {
    const targets = updates.filter((u) => updateChoices[u.id]);
    if (!targets.length) return;
    setMassBusy("update");
    let i = 0;
    for (const u of targets) {
      i++;
      setMassStatus(`updating ${u.name} · ${i}/${targets.length}`);
      // Force re-fetch by removing then loading via repair (which fetches all missing)
      window.BIBLE.removeTranslation(u.id);
      try {window.dispatchEvent(new CustomEvent("codex:translations-changed", { detail: { id: u.id } }));} catch {}
      await new Promise((r) => setTimeout(r, 100));
      const t = window.CODEX_DATA.translations.find((x) => x.id === u.id);
      await new Promise((resolve) => {
        window.BIBLE.repairTranslation(u.id, bookLookup, (p) => {if (p.complete || p.aborted) resolve();});
      });
    }
    setMassStatus(`✓ updated ${targets.length} translation${targets.length > 1 ? "s" : ""}`);
    setUpdates(null);
    setMassBusy(null);
    bumpNow();
  };

  const onImportBundleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const r = await window.BIBLE.storage.importBundle(text);
      cxToast(`Imported ${r.imported} chapters of ${r.translation}.`, "ok");
      bumpNow();
      refreshDiag();
    } catch (err) {
      cxToast("Import failed: " + (err.message || err), "err");
    }
    // reset input so the same file can be re-selected
    e.target.value = "";
  };

  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-ob" }, /*#__PURE__*/

    React.createElement("div", { className: "cx-ob-toolbar" }, /*#__PURE__*/
    React.createElement("button", { className: "cx-mini-btn", disabled: !!massBusy || translations.length === 0, onClick: checkUpdates },
    massBusy === "check" ? "…" : "↻ CHECK UPDATES"
    ), /*#__PURE__*/
    React.createElement("button", { className: "cx-mini-btn", disabled: !!massBusy || translations.length === 0, onClick: testAll },
    massBusy === "test" ? "…" : "✓ TEST ALL"
    ), /*#__PURE__*/
    React.createElement("button", { className: "cx-mini-btn", disabled: !!massBusy || translations.length === 0, onClick: repairAll },
    massBusy === "repair" ? "…" : "↺ REPAIR ALL"
    )
    ),
    massStatus ? /*#__PURE__*/React.createElement("p", { className: "cx-ob-mass-status" }, massStatus) : null,


    updates ? /*#__PURE__*/
    React.createElement("div", { className: "cx-ob-updates" }, /*#__PURE__*/
    React.createElement("header", { className: "cx-ob-updates-h" }, /*#__PURE__*/
    React.createElement("span", null, updates.filter((u) => u.hasUpdate).length, " update(s) available \xB7 pick which to apply"), /*#__PURE__*/
    React.createElement("button", { className: "cx-mini-btn", onClick: () => setUpdates(null) }, "\u2715")
    ), /*#__PURE__*/
    React.createElement("ul", { className: "cx-ob-updates-list" },
    updates.length === 0 ? /*#__PURE__*/
    React.createElement("li", { className: "cx-ob-empty" }, "No cached translations to check.") :
    updates.map((u) => {
      const ourDate = u.ourFetchedAt ? new Date(u.ourFetchedAt).toISOString().slice(0, 10) : "—";
      const srcDate = u.sourceUpdatedAt ? new Date(u.sourceUpdatedAt).toISOString().slice(0, 10) : "—";
      return (/*#__PURE__*/
        React.createElement("li", { key: u.id, className: `cx-ob-update-row ${u.hasUpdate ? "is-stale" : ""}` }, /*#__PURE__*/
        React.createElement("label", null, /*#__PURE__*/
        React.createElement("input", { type: "checkbox", checked: !!updateChoices[u.id], disabled: !u.hasUpdate,
          onChange: (e) => setUpdateChoices((c) => ({ ...c, [u.id]: e.target.checked })) }), /*#__PURE__*/
        React.createElement("span", { className: "cx-ob-update-name" }, u.name), /*#__PURE__*/
        React.createElement("span", { className: "cx-ob-update-meta" },
        u.hasUpdate ? /*#__PURE__*/
        React.createElement("em", null, "\u2191 source ", srcDate, " \xB7 ours ", ourDate, " (", u.ageDays, "d old)") :
        u.source === "bible-api" ? /*#__PURE__*/React.createElement("em", null, "no version info from source") : /*#__PURE__*/React.createElement("em", null, "up-to-date \xB7 ", ourDate)
        )
        )
        ));

    })
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-ob-updates-actions" }, /*#__PURE__*/
    React.createElement("button", { className: "cx-mini-btn", disabled: !!massBusy || !Object.values(updateChoices).some(Boolean), onClick: applyUpdates },
    massBusy === "update" ? "UPDATING…" : `↓ APPLY ${Object.values(updateChoices).filter(Boolean).length}`
    )
    )
    ) :
    null, /*#__PURE__*/

    React.createElement("div", { className: "cx-ob-import" }, /*#__PURE__*/
    React.createElement("label", { className: "cx-mini-btn", title: "Import a JSON bundle file (output of the BUNDLE button on any cached translation, or a hand-crafted bundle)." }, "\u2912 IMPORT BUNDLE", /*#__PURE__*/

    React.createElement("input", { type: "file", accept: ".json,application/json", onChange: onImportBundleFile, style: { display: "none" } })
    ), /*#__PURE__*/
    React.createElement("span", { className: "cx-export-hint", style: { fontSize: 9.5, opacity: 0.55 } }, "A bundle is a single .json file written by the BUNDLE button below \u2014 drop one in to import every chapter into the local cache instantly."

    )
    ),
    diag ? /*#__PURE__*/
    React.createElement("div", { className: "cx-ob-diag", title: `Backend: ${diag.backend}` }, /*#__PURE__*/
    React.createElement("span", { className: "cx-ob-diag-l" }, /*#__PURE__*/
    React.createElement("i", { className: `cx-ob-diag-dot ${diag.backend === "indexeddb" ? "is-ok" : "is-warn"}` }),
    diag.backend === "indexeddb" ? "INDEXEDDB" : "FALLBACK · LOCAL"
    ), /*#__PURE__*/
    React.createElement("span", { className: "cx-ob-diag-r" },
    diag.chapterCount, " chapters \xB7 ", diag.approxMB, " MB",
    diag.quotaMB ? ` / ${diag.quotaMB} MB quota` : ""
    )
    ) :
    null,
    translations.map(({ t, stats }) => {
      const r = results[t.id];
      return (/*#__PURE__*/
        React.createElement("div", { key: t.id, className: `cx-ob-row ${stats.fully ? "is-full" : "is-partial"}` }, /*#__PURE__*/
        React.createElement("div", { className: "cx-ob-head" }, /*#__PURE__*/
        React.createElement("span", { className: "cx-ob-glyph" }, t.glyph), /*#__PURE__*/
        React.createElement("span", { className: "cx-ob-name" }, t.name), /*#__PURE__*/
        React.createElement("span", { className: "cx-ob-count" }, stats.cached, "/", stats.total, stats.fully ? " ✓" : "")
        ),
        r ? /*#__PURE__*/
        React.createElement("div", { className: `cx-ob-status ${r.ok ? "is-ok" : "is-warn"}` },
        r.phase ? /*#__PURE__*/React.createElement("em", null, r.phase) : null,
        r.summary ? /*#__PURE__*/React.createElement("span", null, r.summary) : null,
        r.smoke ? /*#__PURE__*/
        React.createElement("small", { className: r.smoke.ok ? "is-ok" : "is-warn" },
        r.smoke.ok ? "✓ offline read OK · " : "✗ offline read failed · ",
        r.smoke.sample
        ) :
        null
        ) :
        null, /*#__PURE__*/
        React.createElement("div", { className: "cx-ob-actions" }, /*#__PURE__*/
        React.createElement("button", { className: "cx-mini-btn", disabled: busy === t.id, onClick: () => test(t) },
        busy === t.id && results[t.id]?.phase?.startsWith("scanning") ? "…" : "TEST"
        ),
        r && !r.ok && r.missing && r.missing.length + (r.corrupt?.length || 0) > 0 || !stats.fully ? /*#__PURE__*/
        React.createElement("button", { className: "cx-mini-btn", disabled: busy === t.id, onClick: () => repair(t) },
        busy === t.id ? "REPAIRING…" : `REPAIR ${stats.total - stats.cached || r?.missing?.length || 0}`
        ) :
        null, /*#__PURE__*/
        React.createElement("button", {
          className: "cx-mini-btn",
          disabled: busy === t.id || stats.cached === 0,
          onClick: () => exportBundleFile(t),
          title: "Download a pre-baked bundle of every cached chapter for this translation. Save the file at /data/bibles/<id>.json so the app loads it instantly on next install." },
        "\u2913 BUNDLE"), /*#__PURE__*/
        React.createElement("button", { className: "cx-mini-btn cx-ob-rm", disabled: busy === t.id, onClick: () => remove(t) }, "REMOVE")
        )
        ));

    })
    ));

}

function OfflineStatus({ bookLookup }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);
  // tick is intentionally referenced so the lint-passing minified build
  // doesn't strip the interval — the data we read is mostly synchronous,
  // we just want to refresh the snapshot every few seconds.
  void tick;
  const swReady = !!navigator.serviceWorker?.controller;
  const bibleCache = (() => {
    try {return JSON.parse(localStorage.getItem("codex.bible.cache.v2") || "{}");}
    catch {return {};}
  })();
  const bibleCount = Object.keys(bibleCache).length;
  // Per-translation tally
  const transTally = {};
  for (const k of Object.keys(bibleCache)) {
    const tId = k.split(".").pop();
    transTally[tId] = (transTally[tId] || 0) + 1;
  }
  const fullyCached = window.BIBLE?.cacheStats ?
  window.CODEX_DATA.translations.filter((t) => window.BIBLE.cacheStats(t.id, bookLookup).fully) :
  [];
  const panelChapters = (window.CODEX_PANELS?.cacheStats?.() || []).length;
  // Storage used (approx — sum of all codex.* keys)
  const usedBytes = Object.keys(localStorage).
  filter((k) => k.startsWith("codex.")).
  reduce((s, k) => s + (localStorage.getItem(k)?.length || 0), 0);
  const fmt = (b) => b < 1024 ? `${b}B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)}KB` : `${(b / 1024 / 1024).toFixed(1)}MB`;

  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-offline-status" }, /*#__PURE__*/
    React.createElement("div", { className: `cx-offline-row ${swReady ? "is-ok" : "is-warn"}` }, /*#__PURE__*/
    React.createElement("span", { className: "cx-offline-dot" }), /*#__PURE__*/
    React.createElement("span", { className: "cx-offline-lbl" }, "SERVICE WORKER"), /*#__PURE__*/
    React.createElement("span", { className: "cx-offline-val" }, swReady ? "active · app shell offline" : "installing…")
    ), /*#__PURE__*/
    React.createElement("div", { className: `cx-offline-row ${bibleCount > 0 ? "is-ok" : "is-dim"}` }, /*#__PURE__*/
    React.createElement("span", { className: "cx-offline-dot" }), /*#__PURE__*/
    React.createElement("span", { className: "cx-offline-lbl" }, "BIBLE CHAPTERS"), /*#__PURE__*/
    React.createElement("span", { className: "cx-offline-val" }, bibleCount, " cached across ", Object.keys(transTally).length, " translations")
    ),
    fullyCached.length > 0 ? /*#__PURE__*/
    React.createElement("div", { className: "cx-offline-row is-ok" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-offline-dot" }), /*#__PURE__*/
    React.createElement("span", { className: "cx-offline-lbl" }, "FULLY OFFLINE"), /*#__PURE__*/
    React.createElement("span", { className: "cx-offline-val" }, fullyCached.map((t) => t.name).join(", "))
    ) :
    null, /*#__PURE__*/
    React.createElement("div", { className: `cx-offline-row ${panelChapters > 0 ? "is-ok" : "is-dim"}` }, /*#__PURE__*/
    React.createElement("span", { className: "cx-offline-dot" }), /*#__PURE__*/
    React.createElement("span", { className: "cx-offline-lbl" }, "PANELS (TALMUD / GNOSIS / \u2026)"), /*#__PURE__*/
    React.createElement("span", { className: "cx-offline-val" }, panelChapters, " chapter", panelChapters === 1 ? "" : "s", " cached")
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-offline-row is-dim" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-offline-dot" }), /*#__PURE__*/
    React.createElement("span", { className: "cx-offline-lbl" }, "STORAGE"), /*#__PURE__*/
    React.createElement("span", { className: "cx-offline-val" }, fmt(usedBytes), " used")
    )
    ));

}

// Cache browser — lists every chapter's panels (Talmud / Commentary /
// Gematria / Gnosis / Cross-refs) that's been generated and stored offline.
// Click any row to jump straight there. Confirms to the user that nothing
// is being re-pulled: chapters they've visited are listed here forever.
function CachedPanelsBrowser({ onJump, bookLookup }) {
  const [tick, setTick] = useState(0);
  const stats = useMemo(() => {
    if (!window.CODEX_PANELS?.cacheStats) return [];
    return window.CODEX_PANELS.cacheStats();
  }, [tick]);
  const totalBytes = stats.reduce((s, r) => s + r.bytes, 0);
  const fmtSize = (b) => b < 1024 ? `${b}B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)}KB` : `${(b / 1024 / 1024).toFixed(2)}MB`;
  const human = (ts) => {
    if (!ts) return "—";
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
    const d = new Date(ts);
    return `${d.getFullYear()}·${String(d.getMonth() + 1).padStart(2, "0")}·${String(d.getDate()).padStart(2, "0")}`;
  };
  const label = (ref) => {
    const [bookId, chapter] = ref.split(".");
    const book = bookLookup.find((b) => b.id === bookId);
    return book ? `${book.name} ${chapter}` : `${bookId} ${chapter}`;
  };
  if (stats.length === 0) {
    return (/*#__PURE__*/
      React.createElement("p", { className: "cx-export-hint", style: { marginTop: 6 } }, "No panels cached yet. Visit any chapter and Talmud / Commentary / Gematria / Gnosis content for that passage will be saved here for offline reading."


      ));

  }
  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-cache-browser" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-cache-browser-h" }, /*#__PURE__*/
    React.createElement("span", null, stats.length, " chapters cached \xB7 ", fmtSize(totalBytes))
    ), /*#__PURE__*/
    React.createElement("ul", null,
    stats.slice(0, 50).map((r) => /*#__PURE__*/
    React.createElement("li", { key: r.ref }, /*#__PURE__*/
    React.createElement("button", {
      className: "cx-cache-row",
      onClick: () => onJump(label(r.ref)),
      title: `Open ${label(r.ref)} · cached ${r.fetchedAt ? new Date(r.fetchedAt).toLocaleString() : "unknown"}` }, /*#__PURE__*/

    React.createElement("span", { className: "cx-cache-row-ref" }, label(r.ref)), /*#__PURE__*/
    React.createElement("span", { className: "cx-cache-row-meta" }, human(r.fetchedAt), " \xB7 ", fmtSize(r.bytes))
    )
    )
    )
    ),
    stats.length > 50 ? /*#__PURE__*/
    React.createElement("p", { className: "cx-export-hint", style: { marginTop: 4 } }, "+ ",
    stats.length - 50, " more (oldest hidden)."
    ) :
    null
    ));

}

function FooterBar({ currentVerse, passage, gnosisOn, onToggleGnosis, compareCount, onOpenLeft, onOpenRight, distractionFree, onToggleDistractionFree, theater, onToggleTheater, leftCollapsed, onToggleLeftCollapsed, rightCollapsed, onToggleRightCollapsed, onShowShortcuts, onOpenReels, isOnline = true }) {
  return (/*#__PURE__*/
    React.createElement("footer", { className: "cx-footer" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-footer-l" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-footer-cluster" }, /*#__PURE__*/




    React.createElement("button", { className: "cx-mobile-fab", onClick: onOpenLeft, "aria-label": "Library" }, "\u2263"), /*#__PURE__*/
    React.createElement("button", {
      className: `cx-df-toggle ${distractionFree ? "is-on" : ""}`,
      onClick: onToggleDistractionFree,
      title: distractionFree ? "Show panels" : "Calm mode (hide both rails)",
      "aria-pressed": distractionFree },
    distractionFree ? "⊞" : "⊟"), /*#__PURE__*/
    React.createElement("button", {
      className: "cx-df-toggle",
      onClick: () => window.postMessage({ type: "__activate_edit_mode" }, "*"),
      title: "Settings",
      "aria-label": "Settings",
      "data-tweaks-trigger": true },
    "\u2699"),
    onOpenReels ? /*#__PURE__*/
    React.createElement("button", {
      className: "cx-df-toggle cx-reels-launch",
      onClick: onOpenReels,
      title: "Reels \u2014 endless scripture feed",
      "aria-label": "Open Reels" },
    "\u2756") :
    null
    ),


    compareCount > 0 ? /*#__PURE__*/
    React.createElement(Tick, { className: "cx-hide-mobile" }, tt("footer.compare"), "\xA0", /*#__PURE__*/React.createElement("b", null, pad(compareCount))) :
    null, /*#__PURE__*/
    React.createElement(Tick, { className: "cx-hide-mobile" }, tt("footer.cache"), "\xA0", /*#__PURE__*/React.createElement("b", null, tt("footer.cache.value"))), /*#__PURE__*/
    React.createElement(AutoCacheTick, null)
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-footer-c" }, /*#__PURE__*/
    React.createElement("button", {
      className: `cx-gnosis-master ${gnosisOn ? "is-on" : ""}`,
      onClick: () => onToggleGnosis(!gnosisOn) }, /*#__PURE__*/

    React.createElement("span", { className: "cx-gnosis-master-ring" }), /*#__PURE__*/
    React.createElement("span", { className: "cx-gnosis-master-lbl" }, "\u27C1 ",
    gnosisOn ? tt("footer.gnosis.engaged") : tt("footer.gnosis.dormant")
    )
    )
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-footer-r" },


    !isOnline ? /*#__PURE__*/
    React.createElement("span", { className: "cx-offline-pill", title: "No network \u2014 cached chapters/panels still work" }, "OFFLINE \u2014 cached only") :
    null,
    onShowShortcuts ? /*#__PURE__*/
    React.createElement("button", {
      className: "cx-kbd-chip",
      onClick: onShowShortcuts,
      title: "Keyboard shortcuts (?)",
      "aria-label": "Keyboard shortcuts" },
    "?") :
    null, /*#__PURE__*/
    React.createElement("button", { className: "cx-mobile-fab", onClick: onOpenRight, "aria-label": "Panels" }, "\u22EE")
    )
    ));

}

// Top-level error boundary — if something inside App throws, render a
// friendly recovery message instead of leaving the page blank. The
// boot-splash polls for #root having children, so even an error boundary
// rendering an error block dismisses the splash gracefully.
class CodexAppBoundary extends React.Component {
  constructor(p) {super(p);this.state = { err: null };}
  static getDerivedStateFromError(err) {return { err };}
  componentDidCatch(err, info) {
    console.error("[CODEX] App boundary caught:", err, info && info.componentStack);
  }
  render() {
    if (this.state.err) {
      return React.createElement("div", {
        style: { padding: "60px 40px", color: "#c9d6e6", background: "#06080e", height: "100vh", overflow: "auto", fontFamily: "ui-monospace, Menlo, monospace" }
      },
      React.createElement("h1", { style: { color: "#7ee0ff", fontFamily: "Cormorant Garamond, serif", fontWeight: 400, fontSize: 28 } }, "CODEX hit a snag."),
      React.createElement("p", { style: { color: "#6b7c95", fontSize: 13, marginBottom: 24 } }, "The app caught a render error. Try clearing caches and reloading."),
      React.createElement("button", {
        style: { background: "transparent", color: "#7ee0ff", border: "1px solid #7ee0ff", padding: "10px 18px", fontFamily: "inherit", fontSize: 12, letterSpacing: ".1em", cursor: "pointer", borderRadius: 4 },
        onClick: async () => {
          try {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const r of regs) await r.unregister();
            const ks = await caches.keys();
            for (const k of ks) await caches.delete(k);
          } catch {}
          location.reload();
        }
      }, "↺ CLEAR CACHE + RELOAD"),
      React.createElement("pre", { style: { marginTop: 36, color: "#ff8291", fontSize: 11, whiteSpace: "pre-wrap", opacity: 0.85 } },
      String(this.state.err.message || ""), "\n\n", String(this.state.err.stack || ""))
      );
    }
    return this.props.children;
  }
}
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(/*#__PURE__*/React.createElement(CodexAppBoundary, null, /*#__PURE__*/React.createElement(App, null)));
})();
