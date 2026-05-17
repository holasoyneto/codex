// CODEX — main app

const { useState, useEffect, useMemo, useRef, useCallback } = React;

// ── Language picker · 4-col grid of glyph pills, matches CODEX aesthetic.
function LangPicker({ value, onChange }) {
  const langs = window.CODEX_LANGS || [{ id: "en", label: "English", glyph: "EN" }];
  return (
    <div className="cx-langs">
      {langs.map(l => (
        <button
          key={l.id}
          className={`cx-lang ${value === l.id ? "is-on" : ""}`}
          onClick={() => onChange(l.id)}
          title={l.label}
          aria-pressed={value === l.id}
        >
          <span className="cx-lang-glyph">{l.glyph}</span>
          <span className="cx-lang-name">{l.label}</span>
        </button>
      ))}
    </div>
  );
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
      req.onupgradeneeded = () => { req.result.createObjectStore(_KEYS_IDB_STORE); };
      req.onsuccess = () => { _keysIdb = req.result; resolve(_keysIdb); };
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function _idbGetKeys() {
  const db = await _openKeysIdb(); if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(_KEYS_IDB_STORE, "readonly");
      const r = tx.objectStore(_KEYS_IDB_STORE).get("api");
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function _idbSetKeys(v) {
  const db = await _openKeysIdb(); if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(_KEYS_IDB_STORE, "readwrite");
      tx.objectStore(_KEYS_IDB_STORE).put(v, "api");
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch { resolve(false); }
  });
}
// Hydrate localStorage from IDB on cold start if LS is empty (e.g. iOS
// ITP cleared it but IDB survived). Best-effort; fires once.
(function hydrateKeysFromIdb() {
  try {
    const ls = localStorage.getItem(API_KEYS_STORE);
    if (ls) return;                            // LS already has keys
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
  try { return { active: "anthropic", anthropic: "", grok: "", ...JSON.parse(localStorage.getItem(API_KEYS_STORE) || "null") }; }
  catch { return { active: "anthropic", anthropic: "", grok: "" }; }
}
// Returns { ok, where } so callers can surface real persistence failures
// to the user instead of silently swallowing QuotaExceededError.
function saveApiKeys(v) {
  let lsOk = false;
  try { localStorage.setItem(API_KEYS_STORE, JSON.stringify(v)); lsOk = true; } catch {}
  // Always mirror to IDB in the background. If LS failed (quota / ITP),
  // IDB is the only thing keeping the key for the next session — and
  // hydrateKeysFromIdb on the next boot will copy it back into LS once
  // there's room.
  _idbSetKeys(v).catch(() => {});
  return { ok: lsOk, where: lsOk ? "localStorage+idb" : "idb-only" };
}

function ApiKeysSection() {
  const [keys, setKeys] = useState(loadApiKeys);
  const [showA, setShowA] = useState(false);
  const [showG, setShowG] = useState(false);
  const [busyA, setBusyA] = useState(false);
  const [busyG, setBusyG] = useState(false);
  const [statusA, setStatusA] = useState("");
  const [statusG, setStatusG] = useState("");
  // Persist on every keystroke so the direct-API shim always sees the
  // latest values; Apply re-broadcasts so any open Oracle re-probes.
  const update = (patch) => {
    const next = { ...keys, ...patch };
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
    try { window.CODEX_DIRECT && window.CODEX_DIRECT.notifyEngineChange(); } catch {}
  };

  // If IDB hydration completes after this component first mounted (rare
  // but possible on slow IDB opens), pull the restored keys into state.
  useEffect(() => {
    const onRestore = (e) => {
      const v = e?.detail;
      if (!v || typeof v !== "object") return;
      // Only adopt if our state has no anthropic key yet (don't clobber).
      setKeys((cur) => (cur.anthropic || cur.grok) ? cur : { ...cur, ...v });
    };
    window.addEventListener("codex:keys:restored", onRestore);
    return () => window.removeEventListener("codex:keys:restored", onRestore);
  }, []);

  // Try to push the Anthropic key to /api/key (only succeeds when the
  // Node server is up). On static hosting the shim still has the key in
  // localStorage, so we treat a failed POST as "applied locally".
  const applyAnthropic = async () => {
    const key = (keys.anthropic || "").trim();
    if (!key.startsWith("sk-")) { setStatusA("Key must start with sk-"); return; }
    setBusyA(true); setStatusA("");
    try {
      const r = await fetch("/api/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (r.ok) { setStatusA("✓ applied"); }
      else { setStatusA("✓ saved locally"); }
    } catch (e) {
      // No server — that's fine in direct mode, key is already in LS.
      setStatusA("✓ saved locally");
    } finally {
      setBusyA(false);
      try { window.CODEX_DIRECT && window.CODEX_DIRECT.notifyEngineChange(); } catch {}
    }
  };

  // Grok lives entirely in localStorage (no server endpoint). Apply just
  // validates the prefix and pings the engine-change listeners.
  const applyGrok = () => {
    const key = (keys.grok || "").trim();
    if (!key.startsWith("xai-")) { setStatusG("Key must start with xai-"); return; }
    setBusyG(true); setStatusG("");
    // localStorage write already happened in update(); re-notify and done.
    try { window.CODEX_DIRECT && window.CODEX_DIRECT.notifyEngineChange(); } catch {}
    setStatusG("✓ applied");
    setBusyG(false);
  };

  return (
    <div className="cx-api">
      <div className="cx-api-seg" role="tablist" aria-label="Active engine">
        <button
          role="tab"
          aria-selected={keys.active === "anthropic"}
          className={`cx-api-seg-btn ${keys.active === "anthropic" ? "is-on" : ""}`}
          onClick={() => update({ active: "anthropic" })}
          disabled={!keys.anthropic}
          title={keys.anthropic ? "Use Claude as the Oracle engine" : "Add your Anthropic key first"}
        >
          <span className="cx-api-seg-glyph">◉</span>
          <span><b>Anthropic</b><i>Claude{keys.active === "anthropic" ? " · active" : ""}</i></span>
        </button>
        <button
          role="tab"
          aria-selected={keys.active === "grok"}
          className={`cx-api-seg-btn ${keys.active === "grok" ? "is-on" : ""}`}
          onClick={() => update({ active: "grok" })}
          disabled={!keys.grok}
          title={keys.grok ? "Use Grok as the Oracle engine" : "Add your Grok key first"}
        >
          <span className="cx-api-seg-glyph">⌬</span>
          <span><b>Grok</b><i>xAI{keys.active === "grok" ? " · active" : ""}</i></span>
        </button>
      </div>

      <div className="cx-api-field">
        <label className="cx-api-lbl">
          <span>Anthropic API key</span>
          {statusA ? <em className={`cx-api-status ${statusA.startsWith("✓") ? "is-ok" : "is-err"}`}>{statusA}</em> : null}
        </label>
        <div className="cx-api-row">
          <input
            className="cx-api-input"
            type={showA ? "text" : "password"}
            value={keys.anthropic}
            placeholder="sk-ant-..."
            onChange={(e) => update({ anthropic: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") applyAnthropic(); }}
            spellCheck={false}
            autoComplete="off"
          />
          <button className="cx-api-eye" onClick={() => setShowA(s => !s)} title={showA ? "Hide" : "Show"}>{showA ? "◐" : "◌"}</button>
          <button className="cx-api-save" onClick={applyAnthropic} disabled={busyA || !keys.anthropic}>
            {busyA ? "···" : "APPLY"}
          </button>
        </div>
      </div>

      <div className="cx-api-field">
        <label className="cx-api-lbl">
          <span>Grok API key</span>
          {statusG ? <em className={`cx-api-status ${statusG.startsWith("✓") ? "is-ok" : "is-err"}`}>{statusG}</em> : null}
        </label>
        <div className="cx-api-row">
          <input
            className="cx-api-input"
            type={showG ? "text" : "password"}
            value={keys.grok}
            placeholder="xai-..."
            onChange={(e) => update({ grok: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") applyGrok(); }}
            spellCheck={false}
            autoComplete="off"
          />
          <button className="cx-api-eye" onClick={() => setShowG(s => !s)} title={showG ? "Hide" : "Show"}>{showG ? "◐" : "◌"}</button>
          <button className="cx-api-save" onClick={applyGrok} disabled={busyG || !keys.grok}>
            {busyG ? "···" : "APPLY"}
          </button>
        </div>
        <p className="cx-api-hint">Both keys stay in your browser. Switch engines via the toggle above — takes effect on the next Oracle reply.</p>
      </div>
    </div>
  );
}

// Tiny QR-code component — uses the public api.qrserver.com PNG endpoint
// so we don't ship a 50KB JS QR lib. The data param is URL-encoded.
// Falls back to a plain link if the image fails to load.
function SyncQR({ data, size = 180 }) {
  const [errored, setErrored] = useState(false);
  const enc = encodeURIComponent(data);
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=2&data=${enc}`;
  if (errored) {
    return <div className="cx-sync-qr-fallback"><a href={data} target="_blank" rel="noopener noreferrer">{data}</a></div>;
  }
  return (
    <div className="cx-sync-qr">
      <img src={src} alt="QR code" width={size} height={size} onError={() => setErrored(true)} />
      <a className="cx-sync-qr-link" href={data} target="_blank" rel="noopener noreferrer">{data.length > 48 ? data.slice(0, 48) + "…" : data}</a>
    </div>
  );
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
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="cx-syncmod-scrim" onMouseDown={onClose}>
      <div className="cx-syncmod" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Cross-device sync tutorial">
        <div className="cx-syncmod-hd">
          <b>How Cross-device sync works</b>
          <button className="cx-syncmod-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="cx-syncmod-body">
          <section>
            <h4>What this does</h4>
            <p>
              Every device you use opens the same CODEX — your marks, notes,
              settings, cached scripture, and Oracle history follow you.
              Mark a verse on your phone, see it on your laptop within ~60s.
            </p>
          </section>

          <section>
            <h4>What stays on each device (never syncs)</h4>
            <ul>
              <li><b>API keys</b> — each device keeps its own. Security.</li>
              <li><b>Boot intro toggle</b> — per-device preference.</li>
              <li>Session-only state like the open tab.</li>
            </ul>
          </section>

          <section>
            <h4>Where your data lives</h4>
            <p>
              In a <b>private GitHub Gist owned by you</b>. CODEX creates one
              file (<code>codex-sync.json</code>) the first time you connect.
              Only requests signed with your token can read it — GitHub's
              servers enforce that. I never see your data, your token, or
              your gist.
            </p>
          </section>

          <section>
            <h4>Setup, first device</h4>
            <ol>
              <li>Click <b>Open GitHub token page</b> in the Sync section.
                  GitHub opens with the right permission (<code>gist</code>)
                  pre-checked.</li>
              <li>Scroll down → <b>Generate token</b>.</li>
              <li>Copy the <code>ghp_…</code> string.</li>
              <li>Paste it back in CODEX → <b>Connect & create personal gist</b>.</li>
            </ol>
          </section>

          <section>
            <h4>Adding more devices</h4>
            <ol>
              <li>Once connected, expand <b>"Add another device →"</b>.</li>
              <li>Scan the QR code with the new device's camera — it opens CODEX.</li>
              <li>In Settings on the new device, paste the SAME GitHub token.</li>
              <li>App finds your existing gist and joins the sync.</li>
            </ol>
            <p className="cx-syncmod-aside">
              The QR contains <b>only the app URL</b>, never your token.
              Re-pasting on the new device is the safe way to authorise it
              (URLs leak through history, screenshots, screen shares — tokens
              shouldn't).
            </p>
          </section>

          <section>
            <h4>Sync rhythm</h4>
            <ul>
              <li><b>Push:</b> 1.5s after any local change (when auto-sync is on).</li>
              <li><b>Pull:</b> every 60s while the tab is open.</li>
              <li>Manual <b>↑ Push now</b> / <b>↓ Pull now</b> always available.</li>
              <li>Conflicts: per-key last-write-wins, merged against last
                  known remote — keys edited only on Device A and keys
                  edited only on Device B both survive.</li>
            </ul>
          </section>

          <section>
            <h4>Privacy &amp; cost</h4>
            <ul>
              <li><b>Cost:</b> $0. GitHub gists are free, unlimited for personal use.</li>
              <li><b>Access:</b> only people with your token can read the gist.</li>
              <li><b>Revoking:</b> github.com/settings/tokens → delete the CODEX token.
                  All devices immediately lose sync (their local data is untouched).</li>
              <li><b>Wiping remote:</b> github.com → gists → delete the
                  <code>codex-sync.json</code> gist. Next push recreates it from
                  the current device's state.</li>
            </ul>
          </section>

          <section>
            <h4>Troubleshooting</h4>
            <ul>
              <li>"Token is missing the 'gist' scope" → the token wasn't created
                  with the gist box checked. Use the in-app
                  <b> Open GitHub token page</b> button — it pre-checks it.</li>
              <li>Marks don't appear on Device B → tap <b>↓ Pull now</b>.
                  Auto-pull is 60s, manual is instant.</li>
              <li>Got the token confused with the API key → API keys
                  (<code>sk-ant-…</code>) are for the Oracle. Sync uses a
                  GitHub PAT (<code>ghp_…</code>). They live in separate boxes.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
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
    const offAuth   = window.CODEX_SYNC.on("auth",   (info) => {
      setUser(info.user);
      setBackendState(info.backend || "");
      if (info.user && info.backend === "github") {
        const gl = window.CODEX_SYNC.github.getGistLink?.();
        if (gl) setLink(gl);
      } else { setLink(""); }
    });
    const offSynced = window.CODEX_SYNC.on("synced", (info) => setLast(info));
    const offErr    = window.CODEX_SYNC.on("error",  (e)    => setErr(e.message || ""));
    const tick = setInterval(() => setNow(Date.now()), 5000);
    return () => { offAuth(); offSynced(); offErr(); clearInterval(tick); };
  }, []);

  const fmtAgo = (t) => {
    if (!t) return "—";
    const s = Math.floor((now - t) / 1000);
    if (s < 5) return "just now";
    if (s < 60) return s + "s ago";
    if (s < 3600) return Math.floor(s/60) + "m ago";
    if (s < 86400) return Math.floor(s/3600) + "h ago";
    return Math.floor(s/86400) + "d ago";
  };

  const connectGithub = async () => {
    if (!pat.trim()) return;
    setBusy(true); setErr("");
    try {
      const r = await window.CODEX_SYNC.github.connect(pat.trim());
      setLink(r.gistLink || "");
      setPat("");  // never keep in component state
    } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  };
  const disconnect = async () => {
    if (backend === "github") window.CODEX_SYNC.github.disconnect();
    else if (backend === "firebase") await window.CODEX_SYNC.firebase.signOut();
    setUser(null); setBackendState(""); setLink("");
  };
  const pushNow = async () => {
    setBusy(true); setErr("");
    try { await window.CODEX_SYNC.pushNow(); } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  };
  const pullNow = async () => {
    setBusy(true); setErr("");
    try { await window.CODEX_SYNC.pullOnce(); } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  };
  const copyLink = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setErr(""); } catch {}
  };

  const helpBtn = (
    <button className="cx-sync-help-btn" onClick={() => setHelpOpen(true)} title="How sync works" aria-label="Open sync tutorial">
      ?
    </button>
  );

  if (!backend || !user) {
    return (
      <div className="cx-sync">
        <SyncHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
        <div className="cx-sync-titlebar">
          <span>Cross-device sync</span>
          {helpBtn}
        </div>
        <div className="cx-sync-setup">
          <p className="cx-sync-hint">
            Sync your marks, notes, settings, and cached scripture across every
            device you use. Setup takes about 30 seconds — your data lives in a
            private gist owned by your GitHub account; only your token can read it.
          </p>

          {/* Two-step in-app generator: button opens the prefilled GitHub
              token page in a popup, then user pastes back here. */}
          <div className="cx-sync-steps">
            <div className="cx-sync-step">
              <span className="cx-sync-step-n">1</span>
              <div>
                <b>Get your GitHub token</b>
                <p>Click below — opens GitHub with the right scope (<code>gist</code>) pre-checked. Scroll down and hit <b>Generate token</b>, then copy.</p>
                <button
                  className="cx-mini-btn"
                  onClick={() => {
                    const url = "https://github.com/settings/tokens/new?description=CODEX%20sync&scopes=gist";
                    // Try popup first (gives focus back to us when closed);
                    // fall back to new tab for popup-blocker browsers.
                    const w = window.open(url, "codex-gh-token", "width=900,height=700,noopener,noreferrer");
                    if (!w) window.open(url, "_blank", "noopener,noreferrer");
                  }}
                >
                  ⚡ Open GitHub token page
                </button>
                <details className="cx-sync-help">
                  <summary>On a phone? Scan this with your laptop instead</summary>
                  <SyncQR data="https://github.com/settings/tokens/new?description=CODEX%20sync&scopes=gist" size={160} />
                </details>
              </div>
            </div>

            <div className="cx-sync-step">
              <span className="cx-sync-step-n">2</span>
              <div>
                <b>Paste the token here</b>
                <p>App will create your private gist and turn on sync.</p>
                <input
                  className="cx-sync-cfg"
                  type="password"
                  placeholder="ghp_..."
                  value={pat}
                  onChange={e => setPat(e.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                  style={{ fontFamily: "ui-monospace, monospace", padding: "10px", height: "auto" }}
                  onKeyDown={e => { if (e.key === "Enter") connectGithub(); }}
                />
                {err ? <p className="cx-sync-err">{err}</p> : null}
                <button className="cx-mini-btn" onClick={connectGithub} disabled={busy || !pat.trim()}>
                  {busy ? "Connecting…" : "Connect & create personal gist"}
                </button>
              </div>
            </div>
          </div>

          <details className="cx-sync-help">
            <summary>Or use Firebase (Google sign-in, more setup)</summary>
            <FirebaseSetupBlock />
          </details>
        </div>
      </div>
    );
  }

  // Connected state
  return (
    <div className="cx-sync">
      <SyncHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <div className="cx-sync-titlebar">
        <span>Cross-device sync</span>
        {helpBtn}
      </div>
      <div className="cx-sync-active">
        <div className="cx-sync-user">
          {user.photo ? <img src={user.photo} alt="" className="cx-sync-avatar" referrerPolicy="no-referrer" /> : null}
          <div>
            <b>{user.name || user.email || "(connected)"}</b>
            <em>{backend === "github" ? "GitHub Gist" : "Firebase · " + (user.email || "")}</em>
          </div>
        </div>

        {link ? (
          <div className="cx-sync-link">
            <span>Your personal sync gist:</span>
            <div className="cx-sync-link-row">
              <input className="cx-sync-link-input" readOnly value={link} onFocus={e => e.target.select()} />
              <button className="cx-mini-btn cx-sync-tiny" onClick={copyLink}>copy</button>
              <a className="cx-mini-btn cx-sync-tiny" href={link} target="_blank" rel="noopener noreferrer">open ↗</a>
            </div>
            <details className="cx-sync-help" style={{ marginTop: 6 }}>
              <summary><b>Add another device →</b> two ways</summary>
              <div className="cx-sync-join">
                <p className="cx-sync-hint">
                  <b>Quick path:</b> open <a href={location.origin + location.pathname} target="_blank" rel="noopener noreferrer">{location.host + location.pathname}</a> on the other device,
                  open <b>Settings → Cross-device sync</b>, and paste the same GitHub token
                  (the one starting <code>ghp_</code>). It will find this gist and join the sync.
                </p>
                <div className="cx-sync-qr-block">
                  <SyncQR data={location.origin + location.pathname} size={160} />
                  <div>
                    <p className="cx-sync-hint" style={{ margin: 0 }}>
                      Scan this with your phone camera to open CODEX there,
                      then paste your token. <b>Your token never leaves this
                      device</b> — re-pasting it on the new device is the secure
                      way to authorise it.
                    </p>
                  </div>
                </div>
              </div>
            </details>
          </div>
        ) : null}

        <div className="cx-sync-status">
          <span>Last sync:</span>
          <b>{last ? `${fmtAgo(last.at)} · ${last.direction === "up" ? "↑ pushed" : "↓ pulled"}${last.changed ? ` ${last.changed} keys` : last.count ? ` ${last.count} keys` : ""}` : "never"}</b>
        </div>
        <div className="cx-sync-row">
          <button className="cx-mini-btn" onClick={pushNow} disabled={busy}>↑ Push now</button>
          <button className="cx-mini-btn" onClick={pullNow} disabled={busy}>↓ Pull now</button>
          <label className="cx-sync-auto">
            <input type="checkbox" checked={auto} onChange={e => {
              setAuto(e.target.checked);
              window.CODEX_SYNC.setAuto(e.target.checked);
            }} />
            <span>auto-sync on change</span>
          </label>
        </div>
        <div className="cx-sync-row">
          <button className="cx-mini-btn cx-sync-tiny" onClick={disconnect} disabled={busy}>Disconnect</button>
        </div>
        {err ? <p className="cx-sync-err">{err}</p> : null}
      </div>
    </div>
  );
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
      const missing = need.filter(k => !parsed[k]);
      if (missing.length) { setErr("Missing: " + missing.join(", ")); return; }
      window.CODEX_SYNC.firebase.setConfig(parsed);
      window.location.reload();
    } catch (e) { setErr("Invalid JSON: " + e.message); }
  };
  return (
    <>
      <ol>
        <li>console.firebase.google.com → Add project</li>
        <li>Auth → Sign-in method → Google → Enable</li>
        <li>Firestore Database → Create database</li>
        <li>Project settings → Add web app → copy <code>firebaseConfig</code></li>
        <li>Paste JSON below + add Firestore rule:{" "}
            <code>match /users/{"{"}uid{"}"}/{"{"}document=**{"}"} {"{"} allow read, write: if request.auth.uid == uid; {"}"}</code></li>
      </ol>
      <textarea
        className="cx-sync-cfg"
        placeholder='{ "apiKey": "...", "authDomain": "...", "projectId": "...", "appId": "..." }'
        value={cfgText}
        onChange={e => setCfgText(e.target.value)}
        rows={6}
        spellCheck={false}
      />
      {err ? <p className="cx-sync-err">{err}</p> : null}
      <button className="cx-mini-btn" onClick={save} disabled={!cfgText.trim()}>Save Firebase config & reload</button>
    </>
  );
}

// ── AutoCacheTick — pill that surfaces auto-cache progress in the footer.
// Hidden when idle / done. Listens to the events fired by auto-cache.js.
function AutoCacheTick() {
  const [state, setState] = useState({ phase: "idle", done: 0, total: 0, pct: 0 });
  useEffect(() => {
    const onStart = (e) => setState({ phase: "running", done: 0, total: e.detail.total || 0, pct: 0 });
    const onTick  = (e) => {
      const d = e.detail || {};
      const total = d.total || 0;
      const done = d.done || 0;
      const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
      setState({ phase: "running", done, total, pct });
    };
    const onDone  = () => {
      setState({ phase: "done", done: 0, total: 0, pct: 100 });
      // Briefly flash "✓ INSTALLED" then hide.
      setTimeout(() => setState((s) => ({ ...s, phase: "hidden" })), 4000);
    };
    const onErr   = () => setState({ phase: "hidden", done: 0, total: 0, pct: 0 });
    window.addEventListener("codex:autocache-start", onStart);
    window.addEventListener("codex:autocache-tick",  onTick);
    window.addEventListener("codex:autocache-done",  onDone);
    window.addEventListener("codex:autocache-error", onErr);
    return () => {
      window.removeEventListener("codex:autocache-start", onStart);
      window.removeEventListener("codex:autocache-tick",  onTick);
      window.removeEventListener("codex:autocache-done",  onDone);
      window.removeEventListener("codex:autocache-error", onErr);
    };
  }, []);
  if (state.phase === "idle" || state.phase === "hidden") return null;
  if (state.phase === "done") {
    return <Tick className="cx-hide-mobile cx-autocache is-done">✓ INSTALLED</Tick>;
  }
  return (
    <Tick className="cx-hide-mobile cx-autocache" title={`Caching scripture: ${state.done} / ${state.total} chapters`}>
      INSTALL&nbsp;<b>{state.pct}%</b>
    </Tick>
  );
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
  "bootIntro": true,
  "provider": "anthropic",
  "model": "claude-haiku-4-5-20251001"
}/*EDITMODE-END*/;

const HIGHLIGHT_COLORS = {
  amber:  { name: "Amber",  swatch: "#ffc46b" },
  cyan:   { name: "Cyan",   swatch: "#7ee0ff" },
  violet: { name: "Violet", swatch: "#c7a9ff" },
  green:  { name: "Green",  swatch: "#8de8a8" },
  rose:   { name: "Rose",   swatch: "#ff8291" },
};

const ACCENT_MAP = {
  cyan:   { dark: "#7ee0ff", light: "#0a6884", glow: "rgba(126,224,255,.4)" },
  amber:  { dark: "#ffc46b", light: "#7a4a05", glow: "rgba(255,196,107,.4)" },
  green:  { dark: "#8de8a8", light: "#0b5c2a", glow: "rgba(141,232,168,.4)" },
  violet: { dark: "#c7a9ff", light: "#4a2da8", glow: "rgba(199,169,255,.4)" },
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
  const book = books.find(b => norm(b.name) === wantNorm || norm(b.name).startsWith(wantNorm))
            || books.find(b => norm(b.name).includes(wantWordNorm));
  if (!book) return null;
  return { bookId: book.id, chapter: Math.min(ch, book.chapters), verse: v };
}

// Local i18n helper — terse so JSX stays readable. Falls back to the key
// itself if the global i18n module hasn't loaded (defensive).
function tt(k) { return (window.t && window.t(k)) || k; }

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

  // Multi-provider AI registry. Re-fetched from /api/health on mount and
  // whenever a key/engine change is broadcast so the model selector grays
  // out providers that aren't reachable / configured.
  const [availableProviders, setAvailableProviders] = useState({
    anthropic: { available: false, models: [] },
    xai:       { available: false, models: [] },
    ollama:    { available: false, models: [] },
  });
  useEffect(() => {
    const probe = () => fetch("/api/health")
      .then(r => r.json())
      .then(d => { if (d && d.providers) setAvailableProviders(d.providers); })
      .catch(() => {});
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
    setPassageLoc(p => ({ ...p, verse: n }));
  }, []);

  // ── Plugin system bridge ────────────────────────────────────────────────
  // pluginVersion bumps every time a plugin registers so panels.jsx (which
  // reads window.CODEX_PLUGINS_API.getPanels() at render time) re-renders
  // and picks up the new tab. Plugins themselves run outside React's tree.
  const [pluginVersion, setPluginVersion] = useState(0);
  useEffect(() => {
    const onReg = () => setPluginVersion(v => v + 1);
    window.addEventListener("codex:plugin-registered", onReg);
    // Also bump once on mount in case plugins registered before App mounted.
    if (window.CODEX_PLUGINS_API && window.CODEX_PLUGINS_API.list().length) {
      setPluginVersion(v => v + 1);
    }
    return () => window.removeEventListener("codex:plugin-registered", onReg);
  }, []);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [panelData, setPanelData] = useState(null);
  const [panelStatus, setPanelStatus] = useState({ loading: false, error: null });
  // Meta about the current chapter's panels — surfaces to the user as a
  // "CACHED · Nd ago" badge so they can SEE that revisits never re-pull.
  const [panelMeta, setPanelMeta] = useState({ fromCache: false, fetchedAt: 0 });

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
    book: data.books.find(b => b.id === passageLoc.bookId)?.name || "?",
    title: "",
    subtitle: "",
    verses: [],
    loading: true,
    error: null,
  });

  const loadPanelData = useCallback(async (bookId, chapter, bookName) => {
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
  }, []);

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
    const book = data.books.find(b => b.id === bookId);
    if (!book) return;
    const chap = Math.max(1, Math.min(chapter, book.chapters));
    setPassageLoc({ bookId, chapter: chap, verse });
    _setCurrentVerse(verse);
    setPassage(p => ({
      ...p,
      bookId, chapter: chap, book: book.name,
      verses: [], loading: true, error: null,
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
        verses, loading: false, error: null,
      });
    } catch (e) {
      setPassage(p => ({ ...p, loading: false, error: String(e.message || e) }));
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
    try { window.dispatchEvent(new CustomEvent("codex:navigate", { detail })); } catch {}
    if (window.CODEX_PLUGINS_API) {
      window.CODEX_PLUGINS_API.onNavigate(passage.book, passage.chapter);
    }
  }, [passage.bookId, passage.chapter, passage.book]);

  // Every verse cursor change: fire codex:verse-select + call onVerseSelect.
  useEffect(() => {
    if (!passage.book || !passage.chapter || !currentVerse) return;
    const ref = {
      book: passage.book, bookId: passage.bookId,
      chapter: passage.chapter, verse: currentVerse,
      translation: primary,
    };
    try { window.dispatchEvent(new CustomEvent("codex:verse-select", { detail: { ref } })); } catch {}
    if (window.CODEX_PLUGINS_API) window.CODEX_PLUGINS_API.onVerseSelect(ref);
  }, [passage.bookId, passage.chapter, passage.book, currentVerse, primary]);

  // Update passage title once panels finish generating, so the header reflects the AI title.
  useEffect(() => {
    if (panelData && (!passage.title || passage.title === `${passage.book} ${passage.chapter}`)) {
      setPassage(p => ({ ...p, title: panelData.title || p.title, subtitle: panelData.subtitle || p.subtitle }));
    }
    // eslint-disable-next-line
  }, [panelData]);

  // Initial load + reload when translation set changes (so all panes have data).
  // Pass the persisted verse so the cursor lands where the user left off.
  useEffect(() => {
    loadPassage(passageLoc.bookId, passageLoc.chapter, passageLoc.verse || currentVerse || 1);
    // eslint-disable-next-line
  }, [primary, JSON.stringify(compareSet)]);

  useEffect(() => { try { localStorage.setItem("codex.passageLoc", JSON.stringify(passageLoc)); } catch {} }, [passageLoc]);

  // Personal-bible MARKS — unified concept: a mark IS a highlight. One list,
  // one schema, one mental model.
  //   { "jhn.1.14": { color: "amber", ts: 1715500000000, note: "And the Word…" } }
  // Persists in localStorage. Old string-only entries auto-migrate on load.
  const [highlights, setHighlights] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("codex.highlights.v1") || "{}");
      const migrated = {};
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v === "string") migrated[k] = { color: v, ts: Date.now(), note: "" };
        else migrated[k] = v;
      }
      return migrated;
    } catch { return {}; }
  });
  useEffect(() => { try { localStorage.setItem("codex.highlights.v1", JSON.stringify(highlights)); } catch {} }, [highlights]);

  const toggleHighlight = useCallback((bookId, chapter, n, color, verseText) => {
    const key = `${bookId}.${chapter}.${n}`;
    const c = color || t.highlightColor || "amber";
    setHighlights(h => {
      const next = { ...h };
      const cur = next[key];
      if (cur && cur.color === c) {
        delete next[key];                         // same colour → toggle off
      } else {
        next[key] = {
          color: c,
          ts: Date.now(),
          note: cur?.note || (verseText
            ? verseText.replace(/\s+/g, " ").trim().split(" ").slice(0, 7).join(" ") + "…"
            : ""),
        };
      }
      return next;
    });
  }, [t.highlightColor]);

  const clearHighlight = useCallback((bookId, chapter, n) => {
    const key = `${bookId}.${chapter}.${n}`;
    setHighlights(h => { const next = { ...h }; delete next[key]; return next; });
  }, []);

  // Pinned-marks set, persisted separately from the highlight cache so we
  // don't have to migrate the existing schema.
  const PINS_KEY = "codex.marks.pinned.v1";
  const [pinnedSet, setPinnedSet] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(PINS_KEY) || "[]")); }
    catch { return new Set(); }
  });
  const togglePinMark = useCallback((mark) => {
    setPinnedSet(prev => {
      const next = new Set(prev);
      if (next.has(mark.key)) next.delete(mark.key); else next.add(mark.key);
      try { localStorage.setItem(PINS_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  // Derived: marks list for the MARKS tab — pinned bubble to the top
  // (newest-pinned-first), then unpinned newest-first.
  const marks = useMemo(() => {
    return Object.entries(highlights)
      .map(([key, v]) => {
        const [bookId, ch, n] = key.split(".");
        const book = data.books.find(b => b.id === bookId);
        return {
          key,
          bookId,
          chapter: parseInt(ch, 10),
          verse: parseInt(n, 10),
          color: v.color || "amber",
          ts: v.ts || 0,
          note: v.note || "",
          ref: book ? `${book.name} ${ch}:${n}` : `${bookId} ${ch}:${n}`,
          pinned: pinnedSet.has(key),
        };
      })
      .sort((a, b) => {
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

  // ── PWA install — capture the browser's deferred install prompt so the
  // settings button can fire the native dialog with one tap. Falls back to
  // platform-specific guidance on iOS (where no event is fired). The whole
  // app shell + Bible cache + settings then live offline forever.
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(() =>
    window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true
  );
  const isIOS = useMemo(() => /iPhone|iPad|iPod/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent), []);
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setInstallPrompt(e); };
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); };
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
      window.alert("To install CODEX on iPhone or iPad:\n\n1. Tap the Share button (the square with an upward arrow)\n2. Scroll down and tap “Add to Home Screen”\n3. Tap Add\n\nCODEX will appear on your home screen and run full-screen, fully offline.");
      return;
    }
    window.alert("Your browser hasn't offered an install prompt yet — try refreshing once or twice. CODEX is fully installable in Chrome, Edge, Brave, Arc, Safari (iOS), and Samsung Internet.");
  }, [installed, installPrompt, isIOS]);

  // ── Export / import — open-format snapshot of every codex.* localStorage
  // key plus a small header. Lets users migrate marks, oracle history, cached
  // chapters, panels, settings to another browser, device, or compatible app.
  // No proprietary fields — everything is plain JSON the user can inspect.
  const exportAll = useCallback(() => {
    const dataMap = {};
    let marksCount = 0, panelsCount = 0, biblesCount = 0;
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith("codex.")) continue;
      const raw = localStorage.getItem(k);
      try { dataMap[k] = JSON.parse(raw); }
      catch { dataMap[k] = raw; }
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
      data: dataMap,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href     = url;
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
        const obj  = JSON.parse(text);
        if (obj.format !== "codex.export" || !obj.data || typeof obj.data !== "object") {
          window.alert("This isn't a CODEX export file (missing format/data).");
          return;
        }
        const incoming = Object.keys(obj.data).filter(k => k.startsWith("codex."));
        if (!incoming.length) { window.alert("Export contains no codex.* data."); return; }
        const summary = obj.summary
          ? `Marks: ${obj.summary.marks ?? "?"}\nPanels: ${obj.summary.panels ?? "?"}\nKeys: ${obj.summary.keys ?? incoming.length}`
          : `Keys: ${incoming.length}`;
        if (!window.confirm(`Import will REPLACE all current CODEX data:\n\n${summary}\n\nFrom: ${obj.exportedAt || "(unknown date)"}\n\nContinue?`)) return;
        for (const k of Object.keys(localStorage)) {
          if (k.startsWith("codex.")) localStorage.removeItem(k);
        }
        for (const k of incoming) {
          const v = obj.data[k];
          localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
        }
        window.location.reload();
      } catch (e) {
        window.alert("Import failed: " + (e.message || e));
      }
    };
    input.click();
  }, []);

  // Distraction-free: hide both rails on desktop. Toggle with the ⊟ button or ESC twice.
  const [distractionFree, setDistractionFree] = useState(!!t.distractionFree);
  useEffect(() => { setDistractionFree(!!t.distractionFree); }, [t.distractionFree]);
  const toggleDistractionFree = useCallback(() => {
    const v = !distractionFree;
    setDistractionFree(v);
    setTweak("distractionFree", v);
  }, [distractionFree]);

  // Per-rail fold state — desktop only. Persists so the layout reopens the
  // way you left it. Mobile rails still slide via leftOpen / rightOpen.
  const [leftCollapsed, setLeftCollapsed] = useState(() => {
    try { return localStorage.getItem("codex.ui.leftCollapsed") === "1"; } catch { return false; }
  });
  const [rightCollapsed, setRightCollapsed] = useState(() => {
    try { return localStorage.getItem("codex.ui.rightCollapsed") === "1"; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem("codex.ui.leftCollapsed", leftCollapsed ? "1" : "0"); } catch {} }, [leftCollapsed]);
  useEffect(() => { try { localStorage.setItem("codex.ui.rightCollapsed", rightCollapsed ? "1" : "0"); } catch {} }, [rightCollapsed]);

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
      lock.addEventListener("release", () => { wakeLockRef.current = null; });
      wakeLockRef.current = lock;
    } catch (e) { /* user gesture missing or browser unsupported — ignore */ }
  }, []);
  const releaseLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release(); } catch {}
      wakeLockRef.current = null;
    }
  }, []);
  useEffect(() => {
    if (t.caffeinate) acquireLock(); else releaseLock();
    return () => { releaseLock(); };
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
  const toggleTheater = useCallback(() => setTheater(t => !t), []);
  // Keyboard shortcut overlay — `?` opens it, Esc closes.
  const [showShortcuts, setShowShortcuts] = useState(false);

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
      const mid = window.innerHeight / 2;
      // Find the verse closest to vertical center; advance from there.
      let idx = 0, best = Infinity;
      nodes.forEach((n, i) => {
        const r = n.getBoundingClientRect();
        const d = Math.abs((r.top + r.bottom) / 2 - mid);
        if (d < best) { best = d; idx = i; }
      });
      const next = Math.max(0, Math.min(nodes.length - 1, idx + dir));
      const target = nodes[next];
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      flashVerse(target);
    };

    const focusSearch = () => {
      const sel = '.cx-search-input, [data-cx-search], input[type="search"]';
      const el = document.querySelector(sel);
      if (el) { el.focus(); el.select?.(); }
      else console.log("[codex] Cmd+K: search bar not yet implemented (Phase 1.2)");
    };

    const dispatchShortcut = (action) => {
      window.dispatchEvent(new CustomEvent("codex:shortcut", { detail: { action } }));
    };

    const onKey = (e) => {
      const target = e.target;
      const typing = isTyping(target);

      // ── Always-on keys (work even inside inputs) ──────────────────────
      if (e.key === "Escape") {
        if (showShortcuts) { setShowShortcuts(false); e.preventDefault(); return; }
        if (theater) { setTheater(false); e.preventDefault(); return; }
        // Generic escape — let listeners (verse menu, popovers, etc.) close.
        window.dispatchEvent(new CustomEvent("codex:escape"));
        setVerseMenu(null);
        setLeftOpen(false);
        setRightOpen(false);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        focusSearch();
        return;
      }

      // Below here: ignore when user is typing.
      if (typing) return;
      // Ignore when modifier keys are held (don't fight browser/native shortcuts).
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key;

      // `?` (Shift+/) — shortcut overlay
      if (k === "?") { e.preventDefault(); setShowShortcuts(v => !v); return; }

      // Enter on a verse row → open verse menu
      if (k === "Enter") {
        const row = target.closest?.(".cx-verse, .cx-verse-row");
        if (row) {
          e.preventDefault();
          const n = Number(row.getAttribute("data-vn") || row.dataset?.vn);
          const v = passage.verses.find(x => x.n === n) || passage.verses.find(x => x.n === currentVerse);
          if (v) openVerseMenu(v, row.getBoundingClientRect());
          return;
        }
      }

      // Panel tabs 1..9
      if (/^[1-9]$/.test(k)) {
        const tabs = (window.railTabs ? window.railTabs() : null) || [
          { id: "trans" }, { id: "talmud" }, { id: "comm" }, { id: "gem" }, { id: "gnosis" }
        ];
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
        case "j": case "J":
          e.preventDefault(); scrollToVerse(+1); return;
        case "k": case "K":
          e.preventDefault(); scrollToVerse(-1); return;
        case "h": case "H": {
          e.preventDefault();
          const book = data.books.find(b => b.id === passage.bookId);
          if (passage.chapter > 1) loadPassage(passage.bookId, passage.chapter - 1, 1);
          else {
            const idx = data.books.findIndex(b => b.id === passage.bookId);
            if (idx > 0) loadPassage(data.books[idx-1].id, data.books[idx-1].chapters, 1);
          }
          return;
        }
        case "l": case "L": {
          e.preventDefault();
          const book = data.books.find(b => b.id === passage.bookId);
          if (book && passage.chapter < book.chapters) loadPassage(passage.bookId, passage.chapter + 1, 1);
          else {
            const idx = data.books.findIndex(b => b.id === passage.bookId);
            if (idx >= 0 && idx < data.books.length - 1) loadPassage(data.books[idx+1].id, 1, 1);
          }
          return;
        }
        case "o": case "O":
          // Oracle lives in the left rail — open it.
          e.preventDefault();
          setLeftOpen(o => !o);
          if (leftCollapsed) setLeftCollapsed(false);
          dispatchShortcut("toggle-oracle");
          return;
        case "b": case "B":
          // Bookmarks rail (left). Just open the left rail where marks live.
          e.preventDefault();
          setLeftOpen(o => !o);
          if (leftCollapsed) setLeftCollapsed(false);
          dispatchShortcut("toggle-bookmarks");
          return;
        case "n": case "N": {
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
        case "m": case "M":
          e.preventDefault();
          dispatchShortcut("toggle-map");
          console.log("[codex] M: verse-map toggle dispatched (handler TODO)");
          return;
        case "t": case "T":
          e.preventDefault();
          // Open the right rail on the translations tab.
          setTab("trans");
          setRightOpen(true);
          if (rightCollapsed) setRightCollapsed(false);
          dispatchShortcut("open-translations");
          return;
        case "s": case "S": {
          e.preventDefault();
          const v = !sideBySide;
          setSideBySide(v);
          setTweak("sideBySide", v);
          return;
        }
        case "f": case "F":
          e.preventDefault();
          setTheater(v => !v);
          return;
        default:
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // Re-bind whenever the closures' captured state changes.
  }, [theater, showShortcuts, passage, currentVerse, sideBySide, gnosisOn,
      leftCollapsed, rightCollapsed, data, loadPassage, openVerseMenu, t.notesEnabled]);

  useEffect(() => { setPrimary(t.primaryTranslation); }, [t.primaryTranslation]);
  useEffect(() => { setSideBySide(!!t.sideBySide); }, [t.sideBySide]);
  useEffect(() => { setRedLetter(!!t.redLetter); }, [t.redLetter]);
  useEffect(() => { try { localStorage.setItem("codex.compareSet", JSON.stringify(compareSet)); } catch {} }, [compareSet]);

  const onToggleCompare = useCallback((id) => {
    setCompareSet(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const jumpToRef = useCallback((refStr) => {
    const loc = parseRef(refStr, data.books);
    if (loc) loadPassage(loc.bookId, loc.chapter, loc.verse);
    setLeftOpen(false);
  }, [data.books, loadPassage]);

  // Expose jumpToRef globally so external modules (side quests etc.)
  // can pivot the reader to a passage by reference string.
  useEffect(() => { window.codexJumpToRef = jumpToRef; }, [jumpToRef]);

  const onSelectMark = useCallback((m) => {
    loadPassage(m.bookId, m.chapter, m.verse);
    setLeftOpen(false);
  }, [loadPassage]);

  const onClearMark = useCallback((m) => {
    clearHighlight(m.bookId, m.chapter, m.verse);
  }, [clearHighlight]);

  const onMarkCurrent = useCallback(() => {
    const v = passage.verses.find(x => x.n === currentVerse) || passage.verses[0];
    if (!v) return;
    const text = v[primary] || v.kjv || v.web || Object.values(v).find(x => typeof x === "string") || "";
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
    "--cx-oracle-fs": `${t.oracleFontScale || 14}px`,
  };

  return (
    <div
      className={`cx-app ${dark ? "is-dark" : "is-light"} ${t.scanlines ? "has-scan" : ""} font-${t.scriptureFont} ${leftOpen ? "left-open" : ""} ${rightOpen ? "right-open" : ""} ${distractionFree ? "is-distraction-free" : ""} ${theater ? "is-theater" : ""} ${leftCollapsed ? "is-l-collapsed" : ""} ${rightCollapsed ? "is-r-collapsed" : ""} ${t.hermeneuticDriftCompensation ? "is-drift" : ""}`}
      style={themeStyle}
    >
      <div
        className="cx-rail-scrim"
        onClick={() => { setLeftOpen(false); setRightOpen(false); }}
        aria-hidden
      />
      <StatusBar
        now={now} solar={solar} dark={dark}
        autoTheme={t.autoTheme}
        onToggleTheme={() => {
          if (t.autoTheme) setTweak("autoTheme", false);
          setTweak("manualDark", !dark);
        }}
        onToggleAuto={() => setTweak("autoTheme", !t.autoTheme)}
        bookmarkCount={marks.length}
        gnosisOn={gnosisOn}
        onToggleLeft={() => setLeftOpen(o => !o)}
        onToggleRight={() => setRightOpen(o => !o)}
        primary={primary}
        onSelectPrimary={setPrimaryAndPersist}
      />

      <div className="cx-grid">
        {leftCollapsed ? (
          <button
            className="cx-rail-spine cx-rail-spine-l"
            onClick={() => setLeftCollapsed(false)}
            title="Show library + oracle + marks"
            aria-label="Expand left rail"
          >
            <span className="cx-rail-spine-glyph">≣</span>
            <span className="cx-rail-spine-arr">▶</span>
          </button>
        ) : null}

        <LeftRail
          isCollapsed={leftCollapsed}
          onCollapse={() => setLeftCollapsed(true)}
          activeBookId={passage.bookId}
          activeChapter={passage.chapter}
          marks={marks}
          highlightColors={HIGHLIGHT_COLORS}
          onSelectMark={onSelectMark}
          onClearMark={onClearMark}
          onTogglePinMark={togglePinMark}
          onMarkCurrent={onMarkCurrent}
          onSelectChapter={(bookId, ch) => { loadPassage(bookId, ch, 1); setLeftOpen(false); }}
          currentRef={`${passage.book} ${passage.chapter}:${currentVerse}`}
          onClose={() => setLeftOpen(false)}
          oracleProps={{
            passage, currentVerse, primary, gnosisOn,
            driftMode: !!t.hermeneuticDriftCompensation,
            provider: t.provider || "anthropic",
            model: t.model || "claude-haiku-4-5-20251001",
            availableProviders,
            onAddBookmark: ({ ref }) => jumpToRef(ref),  // legacy hook → just jump
            onJumpTo: ({ ref }) => jumpToRef(ref),
          }}
        />

        <Reader
          passage={passage}
          primary={primary}
          compareTranslations={compareSet}
          sideBySide={sideBySide}
          onToggleSideBySide={() => { const v = !sideBySide; setSideBySide(v); setTweak("sideBySide", v); }}
          gnosisOn={gnosisOn}
          redLetter={redLetter}
          onToggleRedLetter={() => { const v = !redLetter; setRedLetter(v); setTweak("redLetter", v); }}
          fontScale={t.fontScale}
          onCycleFontSize={() => {
            const sizes = [16, 19, 22, 26, 30];
            const idx = sizes.indexOf(t.fontScale);
            const next = sizes[(idx + 1) % sizes.length] || 22;
            setTweak("fontScale", next);
          }}
          highlightedVerse={currentVerse}
          onSelectVerse={(n) => setCurrentVerse(n)}
          onSelectPrimary={setPrimaryAndPersist}
          yhwhMode={!!t.yhwhMode}
          onToggleYHWH={() => setTweak("yhwhMode", !t.yhwhMode)}
          highlights={highlights}
          highlightColor={t.highlightColor}
          onToggleHighlight={(n, color) => {
            const v = passage.verses.find(x => x.n === n);
            const text = v ? (v[primary] || v.kjv || v.web || "") : "";
            toggleHighlight(passage.bookId, passage.chapter, n, color, text);
          }}
          onOpenVerseMenu={openVerseMenu}
          panelData={panelData}
          onPrevChapter={() => {
            const book = data.books.find(b => b.id === passage.bookId);
            if (passage.chapter > 1) loadPassage(passage.bookId, passage.chapter - 1, 1);
            else {
              const idx = data.books.findIndex(b => b.id === passage.bookId);
              if (idx > 0) loadPassage(data.books[idx-1].id, data.books[idx-1].chapters, 1);
            }
          }}
          onNextChapter={() => {
            const book = data.books.find(b => b.id === passage.bookId);
            if (passage.chapter < book.chapters) loadPassage(passage.bookId, passage.chapter + 1, 1);
            else {
              const idx = data.books.findIndex(b => b.id === passage.bookId);
              if (idx < data.books.length - 1) loadPassage(data.books[idx+1].id, 1, 1);
            }
          }}
        />

        <RightRail
          isCollapsed={rightCollapsed}
          onCollapse={() => setRightCollapsed(true)}
          tab={tab}
          onTab={setTab}
          gnosisOn={gnosisOn}
          onToggleGnosis={setGnosisOn}
          primary={primary}
          onPrimary={setPrimaryAndPersist}
          compareSet={compareSet}
          onToggleCompare={onToggleCompare}
          passage={passage}
          currentVerse={currentVerse}
          panelData={panelData}
          panelStatus={panelStatus}
          panelMeta={panelMeta}
          onRegeneratePanels={regeneratePanels}
          onClose={() => setRightOpen(false)}
          onJumpRef={jumpToRef}
          pluginVersion={pluginVersion}
          translation={primary}
        />

        {rightCollapsed ? (
          <button
            className="cx-rail-spine cx-rail-spine-r"
            onClick={() => setRightCollapsed(false)}
            title="Show translations + panels"
            aria-label="Expand right rail"
          >
            <span className="cx-rail-spine-arr">◀</span>
            <span className="cx-rail-spine-glyph">⋮</span>
          </button>
        ) : null}
      </div>

      <FooterBar
        currentVerse={currentVerse}
        passage={passage}
        gnosisOn={gnosisOn}
        onToggleGnosis={setGnosisOn}
        compareCount={compareSet.length}
        onOpenLeft={() => setLeftOpen(true)}
        onOpenRight={() => setRightOpen(true)}
        distractionFree={distractionFree}
        onToggleDistractionFree={toggleDistractionFree}
        theater={theater}
        onToggleTheater={toggleTheater}
        leftCollapsed={leftCollapsed}
        onToggleLeftCollapsed={() => {
          setLeftOpen(false);          // close any mobile slide-out too
          setLeftCollapsed(v => !v);
        }}
        rightCollapsed={rightCollapsed}
        onToggleRightCollapsed={() => {
          setRightOpen(false);
          setRightCollapsed(v => !v);
        }}
      />

      {theater ? (
        <button className="cx-theater-exit" onClick={() => setTheater(false)} title="Exit focus (ESC)">
          ◐ EXIT FOCUS · ESC
        </button>
      ) : null}

      {showShortcuts ? (
        <div className="cx-kbd-overlay" onClick={() => setShowShortcuts(false)} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
          <div className="cx-kbd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cx-kbd-hd">
              <b>Keyboard shortcuts</b>
              <button className="cx-kbd-x" onClick={() => setShowShortcuts(false)} aria-label="Close">×</button>
            </div>
            <div className="cx-kbd-grid">
              {[
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
                ["Esc", "Close popovers / overlays"],
              ].map(([key, label]) => (
                <React.Fragment key={key}>
                  <kbd className="cx-kbd-key">{key}</kbd>
                  <span className="cx-kbd-lbl">{label}</span>
                </React.Fragment>
              ))}
            </div>
            <div className="cx-kbd-ft">Press <kbd className="cx-kbd-key">?</kbd> any time to reopen.</div>
          </div>
        </div>
      ) : null}

      {verseMenu && window.VerseMenu ? (
        <VerseMenu
          anchor={verseMenu.anchor}
          verse={verseMenu.verse}
          passage={passage}
          primary={primary}
          translations={data.translations}
          sideBySide={sideBySide}
          gnosisOn={gnosisOn}
          highlightColor={t.highlightColor}
          highlightColors={HIGHLIGHT_COLORS}
          currentHighlight={highlights[`${passage.bookId}.${passage.chapter}.${verseMenu.verse?.n}`]?.color || null}
          onClose={closeVerseMenu}
          onCompare={(n) => {
            setCurrentVerse(n);
            if (!sideBySide) { setSideBySide(true); setTweak("sideBySide", true); }
          }}
          onSetPrimary={setPrimaryAndPersist}
          onAskOracle={(verse, refStr, text) => {
            setLeftOpen(true);
            window.dispatchEvent(new CustomEvent("oracle:prefill", { detail: { ref: refStr, text } }));
          }}
          onToggleGnosis={setGnosisOn}
          onToggleHighlight={(color) => {
            const v = verseMenu.verse;
            const text = v ? (v[primary] || v.kjv || v.web || "") : "";
            toggleHighlight(passage.bookId, passage.chapter, v.n, color, text);
          }}
          onClearHighlight={() => clearHighlight(passage.bookId, passage.chapter, verseMenu.verse.n)}
          onOpenMap={openVerseMap}
          onOpenArt={openVerseArt}
          onOpenCompare={openVerseCompare}
          onOpenMirror={openVerseMirror}
          pluginVersion={pluginVersion}
          onOpenNote={(v, refStr) => {
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
          }}
        />
      ) : null}

      {verseMap && window.VerseMap ? (
        <VerseMap
          verse={verseMap.verse}
          refStr={verseMap.refStr}
          verseText={verseMap.text}
          passage={passage}
          primary={primary}
          onClose={closeVerseMap}
        />
      ) : null}

      {verseArt && window.VerseArt ? (
        <VerseArt
          verse={verseArt.verse}
          refStr={verseArt.refStr}
          verseText={verseArt.text}
          passage={passage}
          primary={primary}
          onClose={closeVerseArt}
        />
      ) : null}

      {window.Notes && t.notesEnabled ? (
        <Notes
          passage={passage}
          currentVerse={currentVerse}
          onJumpTo={({ ref }) => jumpToRef(ref)}
          onDisable={() => setTweak("notesEnabled", false)}
        />
      ) : null}

      {verseCompare && window.VerseCompare ? (
        <VerseCompare
          verse={verseCompare.verse}
          refStr={verseCompare.refStr}
          passage={passage}
          primary={primary}
          onClose={closeVerseCompare}
        />
      ) : null}

      {verseMirror && window.VerseMirror ? (
        <VerseMirror
          verse={verseMirror.verse}
          refStr={verseMirror.refStr}
          verseText={verseMirror.text}
          passage={passage}
          primary={primary}
          onClose={closeVerseMirror}
          onJumpRef={jumpToRef}
        />
      ) : null}

      <ShortcutsHelp />

      {/* Settings panel — only controls that are NOT already reachable as
          prominent first-class buttons. Removed redundancies:
            · Manual dies/noct → DIES/NOCT button at top right
            · Auto-sync → AUTO button at top right
            · Primary translation → status-bar dropdown + Translations panel
            · Red-letter → RED-LETTER button in reader head
            · Side-by-side → SINGLE/SIDE × SIDE button in reader head
            · Body size → Aa cycle button in reader head
            · Distraction-free → ⊟ button in footer
            · Gnosis overlay → GNOSIS DORMANT/ENGAGED master ring in footer
       */}
      <TweaksPanel title={tt("settings")}>
        <TweakSection label={tt("language")} />
        <LangPicker value={t.lang || "en"} onChange={(v) => setTweak("lang", v)} />

        <TweakSection label="AI Engines" />
        <ApiKeysSection />

        <TweakSection label="AI Model" />
        <AIModelSection
          provider={t.provider || "anthropic"}
          model={t.model || "claude-haiku-4-5-20251001"}
          availableProviders={availableProviders}
          onChange={({ provider, model }) => {
            setTweak("provider", provider);
            if (model) setTweak("model", model);
          }}
        />

        <TweakSection label="Cross-device sync" />
        <SyncSection />

        <TweakSection label={tt("install")} />
        <button
          className={`cx-install-btn ${installed ? "is-installed" : ""}`}
          onClick={triggerInstall}
          disabled={installed}
          title={installed
            ? "CODEX is installed and runs fully offline."
            : isIOS
              ? "Tap to see iPhone / iPad install steps."
              : "Install CODEX as a real app — works offline, lives on your dock."}
        >
          {installed
            ? <><span className="cx-install-glyph">✓</span><span><b>{(window.t?.("installed")) || "INSTALLED"}</b><i>{(window.t?.("installed.sub")) || "running as a standalone app · offline-ready"}</i></span></>
            : <><span className="cx-install-glyph">⤓</span><span><b>{(window.t?.("install.codex")) || "INSTALL CODEX"}</b><i>{isIOS ? ((window.t?.("install.ios.sub")) || "tap for iPhone / iPad steps") : ((window.t?.("install.sub")) || "one tap · offline · home-screen icon")}</i></span></>}
        </button>

        <TweakSection label={(window.t?.("look")) || "Look"} />
        <TweakColor label={tt("look.accent")}
          value={ACCENT_MAP[t.accent].dark}
          options={Object.values(ACCENT_MAP).map(a => a.dark)}
          onChange={(v) => {
            const key = Object.keys(ACCENT_MAP).find(k => ACCENT_MAP[k].dark === v) || "cyan";
            setTweak("accent", key);
          }} />
        <TweakToggle label={tt("look.scanlines")} value={t.scanlines}
          onChange={(v) => setTweak("scanlines", v)} />
        {/* Scripture face moved to the reader-head View popover (Aa). */}

        <TweakSection label={tt("marks")} />
        <TweakColor label={tt("marks.color")}
          value={HIGHLIGHT_COLORS[t.highlightColor]?.swatch || HIGHLIGHT_COLORS.amber.swatch}
          options={Object.values(HIGHLIGHT_COLORS).map(c => c.swatch)}
          onChange={(v) => {
            const key = Object.keys(HIGHLIGHT_COLORS).find(k => HIGHLIGHT_COLORS[k].swatch === v) || "amber";
            setTweak("highlightColor", key);
          }} />
        <button
          className="cx-mini-btn"
          style={{ marginTop: 6 }}
          onClick={() => {
            if (marks.length === 0) return;
            const msg = (tt("marks.clear.confirm") || "Clear all {n} marks?").replace("{n}", marks.length);
            if (window.confirm(msg)) setHighlights({});
          }}
        >{tt("marks.clear")} ({marks.length})</button>

        <TweakSection label={tt("reading")} />
        <TweakToggle label={tt("reading.caffeinate")} value={!!t.caffeinate}
          onChange={(v) => setTweak("caffeinate", v)} />
        <TweakToggle label={tt("reading.notes")} value={!!t.notesEnabled}
          onChange={(v) => setTweak("notesEnabled", v)} />
        <TweakSlider label={tt("reading.oracle.fs")} value={t.oracleFontScale || 14}
          min={11} max={20} unit="px"
          onChange={(v) => setTweak("oracleFontScale", v)} />
        {!("wakeLock" in navigator) ? (
          <p className="cx-export-hint" style={{ marginTop: -2 }}>
            {tt("reading.caffeinate.unsupported")}
          </p>
        ) : null}

        <TweakSection label={tt("data.portable")} />
        <div className="cx-export-row">
          <button className="cx-mini-btn" onClick={exportAll} title="Download every mark, cached chapter, panel, and setting as one JSON file">
            {tt("data.export")}
          </button>
          <button className="cx-mini-btn" onClick={importPick} title="Restore from a CODEX export file">
            {tt("data.import")}
          </button>
        </div>
        <p className="cx-export-hint">{tt("data.hint")}</p>

        <TweakSection label={tt("cache")} />
        <OfflineStatus bookLookup={data.books} />
        <CachedPanelsBrowser onJump={jumpToRef} bookLookup={data.books} />
        <button
          className="cx-mini-btn"
          onClick={async () => {
            if (!window.confirm("Clear all cached chapters and panels? Your marks and settings stay.")) return;
            for (const k of Object.keys(localStorage)) {
              if (/^codex\.(bible|panels|redletter)\./i.test(k)) localStorage.removeItem(k);
            }
            if (window.caches) {
              for (const n of await caches.keys()) await caches.delete(n);
            }
            window.location.reload();
          }}
        >{tt("cache.clear")}</button>

        <TweakSection label="Offline · Bibles" />
        <OfflineBiblesPanel bookLookup={data.books} />

        {/* Innocuous label, max-camouflage. Flips Oracle into conspiracy
            mode for users who go looking. Stored as a tweak so it persists. */}
        <TweakSection label="Advanced inference" />
        <TweakToggle
          label="Hermeneutic drift compensation"
          value={!!t.hermeneuticDriftCompensation}
          onChange={(v) => setTweak("hermeneuticDriftCompensation", v)}
        />
        <p className="cx-export-hint" style={{ marginTop: -2, opacity: 0.55 }}>
          Cross-corpus inferential broadening. Experimental.
        </p>

        <TweakSection label="First impression" />
        <TweakToggle
          label="Boot intro sequence"
          value={!!t.bootIntro}
          onChange={(v) => {
            setTweak("bootIntro", v);
            try { localStorage.setItem("codex.bootIntro", v ? "1" : "0"); } catch {}
          }}
        />
        <p className="cx-export-hint" style={{ marginTop: -2, opacity: 0.55 }}>
          Terminal-style cold boot on launch. Off = jump straight to scripture.
        </p>

        {/* Reset to factory defaults · scoped to user preferences + API
            keys. Leaves cached scripture, panels, marks, and saved
            conversations alone (those have their own clear actions
            above). Asks twice because it's irreversible. */}
        <TweakSection label="Keyboard" />
        <button
          className="cx-mini-btn"
          onClick={() => setShowShortcuts(true)}
          title="Show keyboard shortcut reference (or press ?)"
        >⌨ SHOW KEYBOARD SHORTCUTS (?)</button>
        <p className="cx-export-hint" style={{ marginTop: -2 }}>
          Full keyboard navigation: J/K to scroll verses, H/L for chapters,
          1–9 for panels, O/B/N/M/T/S/F for features, ? for the full list,
          Esc to close popovers.
        </p>

        <TweakSection label="Danger zone" />
        <button
          className="cx-mini-btn cx-reset-btn"
          onClick={() => {
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
          }}
          title="Wipe every preference and reload — leaves your marks, notes, and cached scripture untouched."
        >↺ RESET FACTORY SETTINGS</button>
        <p className="cx-export-hint" style={{ marginTop: -2 }}>
          Wipes settings + API keys only. Your marks, notes, and cached
          scripture survive. (Use the cache button above for those.)
        </p>
      </TweaksPanel>
    </div>
  );
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
  const [busy, setBusy] = useState(null);   // translation id currently testing/repairing
  const [results, setResults] = useState({});
  const [diag, setDiag] = useState(null);
  const data = window.CODEX_DATA;
  const bumpNow = () => bump(n => n + 1);

  // BIBLE.ready resolves after IDB warm-load + LS migration. Bump so the
  // memoised translations list re-derives with cached counts now visible.
  useEffect(() => {
    const onReady = () => { bumpNow(); refreshDiag(); };
    window.addEventListener("codex:bible:ready", onReady);
    if (window.BIBLE?.ready) window.BIBLE.ready.then(onReady);
    return () => window.removeEventListener("codex:bible:ready", onReady);
  }, []);
  const refreshDiag = async () => {
    if (!window.BIBLE?.storage?.diagnose) return;
    try { setDiag(await window.BIBLE.storage.diagnose()); } catch {}
  };
  useEffect(() => { refreshDiag(); }, [bumpKey]);

  // Translations with any cache at all. Re-derived on every bump so
  // remove/repair actually shrink the list immediately.
  const translations = useMemo(() => {
    if (!window.BIBLE?.cacheStats) return [];
    return data.translations
      .map(t => ({ t, stats: window.BIBLE.cacheStats(t.id, bookLookup) }))
      .filter(({ stats }) => stats.cached > 0);
  }, [data.translations, bookLookup, bumpKey]);

  const test = async (t) => {
    setBusy(t.id);
    setResults(r => ({ ...r, [t.id]: { phase: "scanning…" } }));
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
          const ok = Array.isArray(verses) && verses.length > 0
            && typeof verses[0]?.text === "string" && verses[0].text.length > 4;
          samples.push({ ref: `${bookId} ${ch}`, ok, count: verses?.length || 0 });
        } catch (e) {
          samples.push({ ref: `${bookId} ${ch}`, ok: false, err: String(e.message || e).slice(0, 40) });
        }
      }
    } finally {
      window.fetch = origFetch;
    }
    const allOk = samples.length > 0 && samples.every(s => s.ok);
    const smoke = {
      ok: allOk,
      sample: samples.length === 0
        ? "no chapters to test"
        : `${samples.filter(s => s.ok).length}/${samples.length} chapters read offline · ${samples.map(s => `${s.ref}${s.ok ? "✓" : "✗"}`).join(" ")}`,
    };
    setResults(r => ({ ...r, [t.id]: { ...v, smoke } }));
    setBusy(null);
  };

  const repair = (t) => {
    setBusy(t.id);
    setResults(r => ({ ...r, [t.id]: { ...(r[t.id] || {}), phase: `repairing 0…` } }));
    window.BIBLE.repairTranslation(t.id, bookLookup, (p) => {
      if (p.complete) {
        const cs = p.checksum;
        const phase = p.nothingToDo
          ? "nothing to repair"
          : cs?.passed
            ? `✓ checksum OK · ${cs.cached}/${cs.total} chapters · ${cs.totalVerses} verses`
            : `repair done · ${cs?.cached || "?"}/${cs?.total || "?"} cached · ${cs?.missing || 0} unrecoverable · ${cs?.corrupt || 0} corrupt`;
        setResults(r => ({ ...r, [t.id]: { ...(cs || {}), smoke: r[t.id]?.smoke, phase } }));
        setBusy(null);
        bumpNow();
        return;
      }
      if (p.aborted) { setBusy(null); bumpNow(); return; }
      // Update progress string depending on phase
      const msg = p.phase === "retry"
        ? `retrying stragglers ${p.retryDone || 0}/${p.retryTotal || 0}` + (p.error ? ` (failed ${p.book} ${p.chapter})` : "")
        : `repairing ${p.done}/${p.total}` + (p.error ? ` (skipped ${p.book} ${p.chapter})` : "");
      setResults(r => ({ ...r, [t.id]: { ...(r[t.id] || {}), phase: msg } }));
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
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setResults(r => ({ ...r, [t.id]: { ...(r[t.id] || {}), phase: `exported ${bundle.chapterCount} chapters as ${t.id}.json — drop into /data/bibles/ to ship` } }));
  };

  const remove = (t) => {
    if (!window.confirm(`Remove the offline copy of ${t.name}? Chapters re-fetch as you read.`)) return;
    // Go through BIBLE.removeTranslation so the in-memory cache stays
    // consistent (direct localStorage writes were leaving _memCache stale).
    const removed = window.BIBLE.removeTranslation(t.id);
    setResults(r => { const x = { ...r }; delete x[t.id]; return x; });
    bumpNow();
    return removed;
  };

  if (translations.length === 0) {
    return (
      <p className="cx-export-hint" style={{ opacity: 0.6 }}>
        No bibles downloaded yet. Use the offline icon next to a translation
        in the Translations panel to save it for offline reading.
      </p>
    );
  }

  // ── Mass operations: TEST ALL / REPAIR ALL / CHECK UPDATES ───────────
  const [massBusy, setMassBusy] = useState(null);
  const [massStatus, setMassStatus] = useState("");
  const [updates, setUpdates] = useState(null);   // null | array of update entries
  const [updateChoices, setUpdateChoices] = useState({});

  const testAll = async () => {
    setMassBusy("test");
    let pass = 0, fail = 0;
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
        if (window.BIBLE.readOffline(b.id, ch, t.id)) allKeys.push({b: b.id, c: ch});
      const picks = []; const pool = allKeys.slice();
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
      } finally { window.fetch = orig; }
      const allOk = samples.length > 0 && samples.every(s => s.ok);
      const smoke = { ok: allOk, sample: samples.length === 0 ? "no chapters to test" : `${samples.filter(s => s.ok).length}/${samples.length} read offline` };
      setResults(r => ({ ...r, [t.id]: { ...v, smoke } }));
      if (allOk) pass++; else fail++;
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
      await new Promise(resolve => {
        window.BIBLE.repairTranslation(t.id, bookLookup, (p) => {
          if (p.complete || p.aborted) {
            const cs = p.checksum;
            setResults(r => ({ ...r, [t.id]: { ...(cs || {}), phase: cs?.passed ? `✓ ${cs.cached}/${cs.total} · ${cs.totalVerses} verses` : `done · ${cs?.cached}/${cs?.total}` } }));
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
      for (const u of list) initial[u.id] = u.hasUpdate;   // pre-check the ones with updates
      setUpdateChoices(initial);
      const have = list.filter(u => u.hasUpdate).length;
      setMassStatus(have ? `${have} update${have>1?"s":""} available` : "all up-to-date");
    } catch (e) {
      setMassStatus("check failed: " + (e.message || e));
    }
    setMassBusy(null);
  };

  const applyUpdates = async () => {
    const targets = updates.filter(u => updateChoices[u.id]);
    if (!targets.length) return;
    setMassBusy("update");
    let i = 0;
    for (const u of targets) {
      i++;
      setMassStatus(`updating ${u.name} · ${i}/${targets.length}`);
      // Force re-fetch by removing then loading via repair (which fetches all missing)
      window.BIBLE.removeTranslation(u.id);
      await new Promise(r => setTimeout(r, 100));
      const t = window.CODEX_DATA.translations.find(x => x.id === u.id);
      await new Promise(resolve => {
        window.BIBLE.repairTranslation(u.id, bookLookup, (p) => { if (p.complete || p.aborted) resolve(); });
      });
    }
    setMassStatus(`✓ updated ${targets.length} translation${targets.length>1?"s":""}`);
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
      window.alert(`Imported ${r.imported} chapters of ${r.translation}.`);
      bumpNow();
      refreshDiag();
    } catch (err) {
      window.alert("Import failed: " + (err.message || err));
    }
    // reset input so the same file can be re-selected
    e.target.value = "";
  };

  return (
    <div className="cx-ob">
      {/* Mass-action toolbar */}
      <div className="cx-ob-toolbar">
        <button className="cx-mini-btn" disabled={!!massBusy || translations.length===0} onClick={checkUpdates}>
          {massBusy === "check" ? "…" : "↻ CHECK UPDATES"}
        </button>
        <button className="cx-mini-btn" disabled={!!massBusy || translations.length===0} onClick={testAll}>
          {massBusy === "test" ? "…" : "✓ TEST ALL"}
        </button>
        <button className="cx-mini-btn" disabled={!!massBusy || translations.length===0} onClick={repairAll}>
          {massBusy === "repair" ? "…" : "↺ REPAIR ALL"}
        </button>
      </div>
      {massStatus ? <p className="cx-ob-mass-status">{massStatus}</p> : null}

      {/* Updates modal — inline list with checkboxes */}
      {updates ? (
        <div className="cx-ob-updates">
          <header className="cx-ob-updates-h">
            <span>{updates.filter(u=>u.hasUpdate).length} update(s) available · pick which to apply</span>
            <button className="cx-mini-btn" onClick={() => setUpdates(null)}>✕</button>
          </header>
          <ul className="cx-ob-updates-list">
            {updates.length === 0 ? (
              <li className="cx-ob-empty">No cached translations to check.</li>
            ) : updates.map(u => {
              const ourDate = u.ourFetchedAt ? new Date(u.ourFetchedAt).toISOString().slice(0,10) : "—";
              const srcDate = u.sourceUpdatedAt ? new Date(u.sourceUpdatedAt).toISOString().slice(0,10) : "—";
              return (
                <li key={u.id} className={`cx-ob-update-row ${u.hasUpdate ? "is-stale" : ""}`}>
                  <label>
                    <input type="checkbox" checked={!!updateChoices[u.id]} disabled={!u.hasUpdate}
                           onChange={e => setUpdateChoices(c => ({ ...c, [u.id]: e.target.checked }))} />
                    <span className="cx-ob-update-name">{u.name}</span>
                    <span className="cx-ob-update-meta">
                      {u.hasUpdate
                        ? <em>↑ source {srcDate} · ours {ourDate} ({u.ageDays}d old)</em>
                        : u.source === "bible-api" ? <em>no version info from source</em> : <em>up-to-date · {ourDate}</em>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="cx-ob-updates-actions">
            <button className="cx-mini-btn" disabled={!!massBusy || !Object.values(updateChoices).some(Boolean)} onClick={applyUpdates}>
              {massBusy === "update" ? "UPDATING…" : `↓ APPLY ${Object.values(updateChoices).filter(Boolean).length}`}
            </button>
          </div>
        </div>
      ) : null}

      <div className="cx-ob-import">
        <label className="cx-mini-btn" title="Import a JSON bundle file (output of the BUNDLE button on any cached translation, or a hand-crafted bundle).">
          ⤒ IMPORT BUNDLE
          <input type="file" accept=".json,application/json" onChange={onImportBundleFile} style={{ display: "none" }} />
        </label>
        <span className="cx-export-hint" style={{ fontSize: 9.5, opacity: 0.55 }}>
          A bundle is a single .json file written by the BUNDLE button below — drop one in to import every chapter into the local cache instantly.
        </span>
      </div>
      {diag ? (
        <div className="cx-ob-diag" title={`Backend: ${diag.backend}`}>
          <span className="cx-ob-diag-l">
            <i className={`cx-ob-diag-dot ${diag.backend === "indexeddb" ? "is-ok" : "is-warn"}`} />
            {diag.backend === "indexeddb" ? "INDEXEDDB" : "FALLBACK · LOCAL"}
          </span>
          <span className="cx-ob-diag-r">
            {diag.chapterCount} chapters · {diag.approxMB} MB
            {diag.quotaMB ? ` / ${diag.quotaMB} MB quota` : ""}
          </span>
        </div>
      ) : null}
      {translations.map(({ t, stats }) => {
        const r = results[t.id];
        return (
          <div key={t.id} className={`cx-ob-row ${stats.fully ? "is-full" : "is-partial"}`}>
            <div className="cx-ob-head">
              <span className="cx-ob-glyph">{t.glyph}</span>
              <span className="cx-ob-name">{t.name}</span>
              <span className="cx-ob-count">{stats.cached}/{stats.total}{stats.fully ? " ✓" : ""}</span>
            </div>
            {r ? (
              <div className={`cx-ob-status ${r.ok ? "is-ok" : "is-warn"}`}>
                {r.phase ? <em>{r.phase}</em> : null}
                {r.summary ? <span>{r.summary}</span> : null}
                {r.smoke ? (
                  <small className={r.smoke.ok ? "is-ok" : "is-warn"}>
                    {r.smoke.ok ? "✓ offline read OK · " : "✗ offline read failed · "}
                    {r.smoke.sample}
                  </small>
                ) : null}
              </div>
            ) : null}
            <div className="cx-ob-actions">
              <button className="cx-mini-btn" disabled={busy === t.id} onClick={() => test(t)}>
                {busy === t.id && results[t.id]?.phase?.startsWith("scanning") ? "…" : "TEST"}
              </button>
              {(r && !r.ok && r.missing && (r.missing.length + (r.corrupt?.length || 0)) > 0) || !stats.fully ? (
                <button className="cx-mini-btn" disabled={busy === t.id} onClick={() => repair(t)}>
                  {busy === t.id ? "REPAIRING…" : `REPAIR ${stats.total - stats.cached || (r?.missing?.length || 0)}`}
                </button>
              ) : null}
              <button
                className="cx-mini-btn"
                disabled={busy === t.id || stats.cached === 0}
                onClick={() => exportBundleFile(t)}
                title="Download a pre-baked bundle of every cached chapter for this translation. Save the file at /data/bibles/<id>.json so the app loads it instantly on next install."
              >⤓ BUNDLE</button>
              <button className="cx-mini-btn cx-ob-rm" disabled={busy === t.id} onClick={() => remove(t)}>REMOVE</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OfflineStatus({ bookLookup }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 5000);
    return () => clearInterval(id);
  }, []);
  // tick is intentionally referenced so the lint-passing minified build
  // doesn't strip the interval — the data we read is mostly synchronous,
  // we just want to refresh the snapshot every few seconds.
  void tick;
  const swReady = !!navigator.serviceWorker?.controller;
  const bibleCache = (() => {
    try { return JSON.parse(localStorage.getItem("codex.bible.cache.v2") || "{}"); }
    catch { return {}; }
  })();
  const bibleCount = Object.keys(bibleCache).length;
  // Per-translation tally
  const transTally = {};
  for (const k of Object.keys(bibleCache)) {
    const tId = k.split(".").pop();
    transTally[tId] = (transTally[tId] || 0) + 1;
  }
  const fullyCached = window.BIBLE?.cacheStats
    ? window.CODEX_DATA.translations.filter(t => window.BIBLE.cacheStats(t.id, bookLookup).fully)
    : [];
  const panelChapters = (window.CODEX_PANELS?.cacheStats?.() || []).length;
  // Storage used (approx — sum of all codex.* keys)
  const usedBytes = Object.keys(localStorage)
    .filter(k => k.startsWith("codex."))
    .reduce((s, k) => s + (localStorage.getItem(k)?.length || 0), 0);
  const fmt = (b) => b < 1024 ? `${b}B` : b < 1024*1024 ? `${(b/1024).toFixed(0)}KB` : `${(b/1024/1024).toFixed(1)}MB`;

  return (
    <div className="cx-offline-status">
      <div className={`cx-offline-row ${swReady ? "is-ok" : "is-warn"}`}>
        <span className="cx-offline-dot" />
        <span className="cx-offline-lbl">SERVICE WORKER</span>
        <span className="cx-offline-val">{swReady ? "active · app shell offline" : "installing…"}</span>
      </div>
      <div className={`cx-offline-row ${bibleCount > 0 ? "is-ok" : "is-dim"}`}>
        <span className="cx-offline-dot" />
        <span className="cx-offline-lbl">BIBLE CHAPTERS</span>
        <span className="cx-offline-val">{bibleCount} cached across {Object.keys(transTally).length} translations</span>
      </div>
      {fullyCached.length > 0 ? (
        <div className="cx-offline-row is-ok">
          <span className="cx-offline-dot" />
          <span className="cx-offline-lbl">FULLY OFFLINE</span>
          <span className="cx-offline-val">{fullyCached.map(t => t.name).join(", ")}</span>
        </div>
      ) : null}
      <div className={`cx-offline-row ${panelChapters > 0 ? "is-ok" : "is-dim"}`}>
        <span className="cx-offline-dot" />
        <span className="cx-offline-lbl">PANELS (TALMUD / GNOSIS / …)</span>
        <span className="cx-offline-val">{panelChapters} chapter{panelChapters === 1 ? "" : "s"} cached</span>
      </div>
      <div className="cx-offline-row is-dim">
        <span className="cx-offline-dot" />
        <span className="cx-offline-lbl">STORAGE</span>
        <span className="cx-offline-val">{fmt(usedBytes)} used</span>
      </div>
    </div>
  );
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
  const fmtSize = (b) => b < 1024 ? `${b}B` : b < 1024*1024 ? `${(b/1024).toFixed(1)}KB` : `${(b/1024/1024).toFixed(2)}MB`;
  const human = (ts) => {
    if (!ts) return "—";
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff/60)}m`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h`;
    if (diff < 86400*7) return `${Math.floor(diff/86400)}d`;
    const d = new Date(ts);
    return `${d.getFullYear()}·${String(d.getMonth()+1).padStart(2,"0")}·${String(d.getDate()).padStart(2,"0")}`;
  };
  const label = (ref) => {
    const [bookId, chapter] = ref.split(".");
    const book = bookLookup.find(b => b.id === bookId);
    return book ? `${book.name} ${chapter}` : `${bookId} ${chapter}`;
  };
  if (stats.length === 0) {
    return (
      <p className="cx-export-hint" style={{ marginTop: 6 }}>
        No panels cached yet. Visit any chapter and Talmud / Commentary / Gematria /
        Gnosis content for that passage will be saved here for offline reading.
      </p>
    );
  }
  return (
    <div className="cx-cache-browser">
      <div className="cx-cache-browser-h">
        <span>{stats.length} chapters cached · {fmtSize(totalBytes)}</span>
      </div>
      <ul>
        {stats.slice(0, 50).map(r => (
          <li key={r.ref}>
            <button
              className="cx-cache-row"
              onClick={() => onJump(label(r.ref))}
              title={`Open ${label(r.ref)} · cached ${r.fetchedAt ? new Date(r.fetchedAt).toLocaleString() : "unknown"}`}
            >
              <span className="cx-cache-row-ref">{label(r.ref)}</span>
              <span className="cx-cache-row-meta">{human(r.fetchedAt)} · {fmtSize(r.bytes)}</span>
            </button>
          </li>
        ))}
      </ul>
      {stats.length > 50 ? (
        <p className="cx-export-hint" style={{ marginTop: 4 }}>
          + {stats.length - 50} more (oldest hidden).
        </p>
      ) : null}
    </div>
  );
}

function FooterBar({ currentVerse, passage, gnosisOn, onToggleGnosis, compareCount, onOpenLeft, onOpenRight, distractionFree, onToggleDistractionFree, theater, onToggleTheater, leftCollapsed, onToggleLeftCollapsed, rightCollapsed, onToggleRightCollapsed }) {
  return (
    <footer className="cx-footer">
      <div className="cx-footer-l">
        <div className="cx-footer-cluster">
          {/* Mobile-only library FAB. Per-rail collapse toggles (◧ ◨) and
              theater-mode (◐) removed: the rails have spine-clicks for the
              same purpose, and Oracle has its own ⛶ fullscreen. Down to
              two clean controls: "calm" (distraction-free) + Settings. */}
          <button className="cx-mobile-fab" onClick={onOpenLeft} aria-label="Library">≣</button>
          <button
            className={`cx-df-toggle ${distractionFree ? "is-on" : ""}`}
            onClick={onToggleDistractionFree}
            title={distractionFree ? "Show panels" : "Calm mode (hide both rails)"}
            aria-pressed={distractionFree}
          >{distractionFree ? "⊞" : "⊟"}</button>
          <button
            className="cx-df-toggle"
            onClick={() => window.postMessage({ type: "__activate_edit_mode" }, "*")}
            title="Settings"
            aria-label="Settings"
            data-tweaks-trigger
          >⚙</button>
        </div>
        {/* Compare-count tick: only renders when there's actually something
            to compare. Kills a permanently-zero pill in the default state. */}
        {compareCount > 0 ? (
          <Tick className="cx-hide-mobile">{tt("footer.compare")}&nbsp;<b>{pad(compareCount)}</b></Tick>
        ) : null}
        <Tick className="cx-hide-mobile">{tt("footer.cache")}&nbsp;<b>{tt("footer.cache.value")}</b></Tick>
        <AutoCacheTick />
      </div>
      <div className="cx-footer-c">
        <button
          className={`cx-gnosis-master ${gnosisOn ? "is-on" : ""}`}
          onClick={() => onToggleGnosis(!gnosisOn)}
        >
          <span className="cx-gnosis-master-ring" />
          <span className="cx-gnosis-master-lbl">
            ⟁ {gnosisOn ? tt("footer.gnosis.engaged") : tt("footer.gnosis.dormant")}
          </span>
        </button>
      </div>
      <div className="cx-footer-r">
        {/* Dropped: faux LATENCY + faux NODE pills. They never reflected real
            state and ate ~140px of footer real-estate. */}
        <button className="cx-mobile-fab" onClick={onOpenRight} aria-label="Panels">⋮</button>
      </div>
    </footer>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
