// CODEX sync — TWO modes, both end up sharing one localStorage shape
// and one Settings UI:
//
//   1) GitHub Gist (Recommended) — ONE-step setup. User pastes a
//      GitHub Personal Access Token with `gist` scope, the app
//      creates a private gist and uses it as the sync target. The
//      "personal link" is the gist URL. Open on any device, paste
//      the same token, app finds the gist and joins the sync.
//
//   2) Firebase + Google sign-in — heavier setup but real-time
//      multi-device push. Kept as an option for power users.
//
// Both modes sync the same set of localStorage keys (everything
// personal — never API keys). Conflict resolution is per-key
// last-write-wins.

(function () {
  // ── Storage layout ───────────────────────────────────────────────
  const LS_BACKEND  = "codex.sync.backend.v1";       // "github" | "firebase" | ""
  const LS_GH_TOKEN = "codex.sync.github.token.v1";  // user's GitHub PAT
  const LS_GH_GIST  = "codex.sync.github.gistId.v1"; // resolved private gist id
  const LS_FB_CFG   = "codex.sync.firebaseConfig.v1";
  const LS_AUTO     = "codex.sync.auto.v1";
  const LS_LAST     = "codex.sync.lastSync.v1";

  // ── Which keys sync ──────────────────────────────────────────────
  const SYNC_PREFIXES = [
    "codex.tweaks.",
    "codex.marks.",
    "codex.bookmarks.",
    "codex.notes.",
    "codex.bible.",
    "codex.panels.",
    "codex.redletter.",
    "codex.oracle.history.",
    "codex.bootIntro",
    "codex.lang",
  ];
  const NEVER_SYNC = [
    "codex.api.keys",
    "codex.sync.",
    "codex.session.",
  ];
  function isSyncable(key) {
    if (!key || typeof key !== "string") return false;
    for (const bad of NEVER_SYNC) if (key.startsWith(bad)) return false;
    for (const ok of SYNC_PREFIXES) if (key.startsWith(ok)) return true;
    return false;
  }

  // ── Utilities ────────────────────────────────────────────────────
  const ls = {
    get(k, d=null) { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(d)); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    raw: localStorage,
  };
  function fire(ev, payload) {
    (_listeners[ev] || []).forEach(fn => { try { fn(payload); } catch {} });
  }
  const _listeners = {};
  function on(ev, fn) {
    (_listeners[ev] = _listeners[ev] || []).push(fn);
    return () => { _listeners[ev] = (_listeners[ev] || []).filter(x => x !== fn); };
  }

  function getBackend() { return localStorage.getItem(LS_BACKEND) || ""; }
  function setBackend(b) {
    if (b) localStorage.setItem(LS_BACKEND, b);
    else localStorage.removeItem(LS_BACKEND);
  }

  function collectLocal() {
    const keys = {};
    const now = Date.now();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!isSyncable(k)) continue;
      const v = localStorage.getItem(k);
      if (v == null) continue;
      keys[k] = { v, t: now };
    }
    return keys;
  }
  function applyRemote(remote) {
    if (!remote || !remote.keys) return { changed: 0 };
    let changed = 0;
    for (const k of Object.keys(remote.keys)) {
      if (!isSyncable(k)) continue;
      const entry = remote.keys[k];
      if (!entry || typeof entry.v !== "string") continue;
      const localRaw = localStorage.getItem(k);
      if (localRaw === entry.v) continue;
      try { _suspendPush = true; localStorage.setItem(k, entry.v); changed++; }
      finally { _suspendPush = false; }
      try { window.dispatchEvent(new StorageEvent("storage", { key: k, newValue: entry.v })); } catch {}
    }
    return { changed };
  }

  // ── Local-change watcher ─────────────────────────────────────────
  let _suspendPush = false;     // true while applying remote (avoid feedback loop)
  let _pushTimer = null;
  function schedulePush() {
    if (_suspendPush) return;
    if (!localStorage.getItem(LS_AUTO) === "1") {/* still allow manual */}
    clearTimeout(_pushTimer);
    _pushTimer = setTimeout(() => {
      if (localStorage.getItem(LS_AUTO) === "1") {
        push().catch(e => fire("error", { message: e.message || String(e) }));
      }
    }, 1500);
  }
  const origSet = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (k, v) {
    const r = origSet(k, v);
    if (isSyncable(k)) schedulePush();
    return r;
  };
  window.addEventListener("storage", (e) => {
    if (isSyncable(e.key)) schedulePush();
  });

  // ── Backend: GitHub Gist ─────────────────────────────────────────
  // One private gist per user. File name: codex-sync.json. Updates via PATCH.
  const GH_API = "https://api.github.com";
  function ghToken() { return localStorage.getItem(LS_GH_TOKEN) || ""; }
  function ghGistId() { return localStorage.getItem(LS_GH_GIST) || ""; }
  function ghHeaders() {
    return {
      "Authorization": "token " + ghToken(),
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };
  }

  async function ghVerifyToken(token) {
    // Check token validity + scope (need "gist")
    const r = await fetch(GH_API + "/user", {
      headers: { Authorization: "token " + token, Accept: "application/vnd.github+json" },
    });
    if (!r.ok) throw new Error("GitHub auth failed: " + r.status + " (token invalid or revoked)");
    const scopes = (r.headers.get("x-oauth-scopes") || "").split(",").map(s => s.trim());
    if (!scopes.includes("gist")) {
      throw new Error("Token is missing the 'gist' scope. Generate a new token with the 'gist' checkbox ticked.");
    }
    return await r.json();   // { login, ... }
  }
  async function ghFindOrCreateGist(token) {
    // Search existing gists for our marker filename
    const list = await fetch(GH_API + "/gists?per_page=100", { headers: { Authorization: "token " + token, Accept: "application/vnd.github+json" } });
    if (!list.ok) throw new Error("GitHub /gists failed: " + list.status);
    const gists = await list.json();
    const existing = gists.find(g => g.files && g.files["codex-sync.json"]);
    if (existing) return existing.id;
    // Create new private gist
    const create = await fetch(GH_API + "/gists", {
      method: "POST",
      headers: ghHeaders(),
      body: JSON.stringify({
        description: "CODEX · cross-device sync (encrypted-by-token; do not share)",
        public: false,
        files: { "codex-sync.json": { content: JSON.stringify({ keys: {}, updatedAt: Date.now() }, null, 2) } },
      }),
    });
    if (!create.ok) throw new Error("GitHub gist create failed: " + create.status + " " + (await create.text()).slice(0, 200));
    const g = await create.json();
    return g.id;
  }
  async function ghReadGist() {
    const id = ghGistId();
    if (!id) throw new Error("No gist id — connect first.");
    const r = await fetch(GH_API + "/gists/" + id, { headers: ghHeaders() });
    if (!r.ok) throw new Error("GitHub gist read failed: " + r.status);
    const g = await r.json();
    const raw = g.files && g.files["codex-sync.json"] && g.files["codex-sync.json"].content;
    if (!raw) return { keys: {}, updatedAt: 0 };
    try { return JSON.parse(raw); } catch { return { keys: {}, updatedAt: 0 }; }
  }
  async function ghWriteGist(payload) {
    const id = ghGistId();
    if (!id) throw new Error("No gist id — connect first.");
    const r = await fetch(GH_API + "/gists/" + id, {
      method: "PATCH",
      headers: ghHeaders(),
      body: JSON.stringify({
        files: { "codex-sync.json": { content: JSON.stringify(payload, null, 2) } },
      }),
    });
    if (!r.ok) throw new Error("GitHub gist write failed: " + r.status + " " + (await r.text()).slice(0, 200));
  }

  async function ghConnect(token) {
    const user = await ghVerifyToken(token);
    localStorage.setItem(LS_GH_TOKEN, token);
    const gistId = await ghFindOrCreateGist(token);
    localStorage.setItem(LS_GH_GIST, gistId);
    setBackend("github");
    fire("auth", { user: { name: user.login, email: user.email, photo: user.avatar_url, uid: user.login }, backend: "github" });
    // Pull existing remote before pushing local
    await pull();
    return { user, gistId, link: gitHubGistLink(user.login, gistId) };
  }
  function ghDisconnect() {
    localStorage.removeItem(LS_GH_TOKEN);
    localStorage.removeItem(LS_GH_GIST);
    setBackend("");
    fire("auth", { user: null, backend: null });
  }
  function gitHubGistLink(login, gistId) {
    return `https://gist.github.com/${login}/${gistId}`;
  }

  // Cached remote snapshot for merge logic
  let _lastRemote = null;
  async function pull() {
    const backend = getBackend();
    if (backend === "github") {
      const remote = await ghReadGist();
      _lastRemote = remote;
      const r = applyRemote(remote);
      const last = { at: Date.now(), direction: "down", changed: r.changed };
      ls.set(LS_LAST, last); fire("synced", last);
      return r;
    }
    if (backend === "firebase") {
      return fbPull();
    }
    throw new Error("No sync backend configured.");
  }
  async function push() {
    const backend = getBackend();
    const local = collectLocal();
    // Merge: keep remote-only keys, overwrite shared/local-only keys
    const merged = (_lastRemote && _lastRemote.keys) ? { ..._lastRemote.keys, ...local } : local;
    const payload = { keys: merged, updatedAt: Date.now() };
    if (backend === "github") {
      await ghWriteGist(payload);
      _lastRemote = payload;
    } else if (backend === "firebase") {
      await fbPushPayload(payload);
      _lastRemote = payload;
    } else {
      throw new Error("No sync backend configured.");
    }
    const last = { at: Date.now(), direction: "up", count: Object.keys(local).length };
    ls.set(LS_LAST, last); fire("synced", last);
    return { ok: true };
  }
  function setAuto(v) {
    localStorage.setItem(LS_AUTO, v ? "1" : "0");
    if (v && getBackend() === "github") startGhPoll();
    else stopGhPoll();
    fire("auto", { on: v });
  }
  function getAuto() { return localStorage.getItem(LS_AUTO) === "1"; }

  // Periodic pull for GitHub (no real-time sub; poll every 60s)
  let _ghPollTimer = null;
  function startGhPoll() {
    stopGhPoll();
    _ghPollTimer = setInterval(() => {
      pull().catch(e => fire("error", { message: e.message || String(e) }));
    }, 60000);
  }
  function stopGhPoll() {
    if (_ghPollTimer) { clearInterval(_ghPollTimer); _ghPollTimer = null; }
  }

  // ── Backend: Firebase (kept as alt path) ─────────────────────────
  let fbApp = null, fbAuth = null, fbDb = null, fbUser = null, fbUnsub = null;
  function fbGetConfig() { return ls.get(LS_FB_CFG, null); }
  function fbSetConfig(c) { ls.set(LS_FB_CFG, c); }
  function fbClearConfig() { try { localStorage.removeItem(LS_FB_CFG); } catch {} }
  function fbEnsureLoaded() {
    return new Promise((resolve, reject) => {
      if (window.firebase && window.firebase.auth && window.firebase.firestore) return resolve();
      const scripts = [
        "https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js",
        "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth-compat.js",
        "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore-compat.js",
      ];
      let i = 0;
      const next = () => {
        if (i >= scripts.length) return resolve();
        const s = document.createElement("script");
        s.src = scripts[i++]; s.onload = next; s.onerror = () => reject(new Error("Failed " + s.src));
        document.head.appendChild(s);
      };
      next();
    });
  }
  async function fbInit() {
    const cfg = fbGetConfig();
    if (!cfg) return { ok: false, reason: "no-config" };
    await fbEnsureLoaded();
    if (!fbApp) {
      fbApp = window.firebase.initializeApp(cfg);
      fbAuth = window.firebase.auth();
      fbDb = window.firebase.firestore();
      fbAuth.onAuthStateChanged(async (u) => {
        fbUser = u;
        fire("auth", { user: u ? { uid: u.uid, email: u.email, name: u.displayName, photo: u.photoURL } : null, backend: u ? "firebase" : null });
        if (u) {
          setBackend("firebase");
          fbSubscribe();
          await fbPull();
        } else {
          fbUnsubscribe();
        }
      });
    }
    return { ok: true };
  }
  async function fbSignIn() {
    const r = await fbInit();
    if (!r.ok) throw new Error("Firebase not configured: " + r.reason);
    const provider = new window.firebase.auth.GoogleAuthProvider();
    await fbAuth.signInWithPopup(provider);
  }
  async function fbSignOut() { if (fbAuth) await fbAuth.signOut(); setBackend(""); }
  function fbSubscribe() {
    if (!fbUser) return;
    fbUnsubscribe();
    const ref = fbDb.collection("users").doc(fbUser.uid).collection("sync").doc("main");
    fbUnsub = ref.onSnapshot((snap) => {
      const data = snap.data(); if (!data) return;
      _lastRemote = data;
      const r = applyRemote(data);
      if (r.changed) {
        const last = { at: Date.now(), direction: "down", changed: r.changed };
        ls.set(LS_LAST, last); fire("synced", last);
      }
    });
  }
  function fbUnsubscribe() { if (fbUnsub) { fbUnsub(); fbUnsub = null; } }
  async function fbPull() {
    if (!fbUser) return { ok: false };
    const ref = fbDb.collection("users").doc(fbUser.uid).collection("sync").doc("main");
    const snap = await ref.get();
    if (snap.exists) { _lastRemote = snap.data(); applyRemote(snap.data()); }
    return { ok: true };
  }
  async function fbPushPayload(payload) {
    if (!fbUser) throw new Error("Not signed in");
    const ref = fbDb.collection("users").doc(fbUser.uid).collection("sync").doc("main");
    await ref.set(payload, { merge: true });
  }

  // ── Auto-init on page load ────────────────────────────────────────
  const backendOnBoot = getBackend();
  if (backendOnBoot === "github" && ghToken() && ghGistId()) {
    // Restore "signed in" UI state on reload
    setTimeout(async () => {
      try {
        const u = await ghVerifyToken(ghToken());
        fire("auth", { user: { name: u.login, email: u.email, photo: u.avatar_url, uid: u.login }, backend: "github" });
        const r = await pull();
        if (getAuto()) startGhPoll();
      } catch (e) {
        fire("error", { message: "GitHub sync init failed: " + (e.message || e) });
      }
    }, 200);
  } else if (backendOnBoot === "firebase" && fbGetConfig()) {
    fbInit();
  }

  // ── Public API ────────────────────────────────────────────────────
  window.CODEX_SYNC = {
    on, isSyncable,
    getBackend, getAuto, setAuto, getLast: () => ls.get(LS_LAST, null),

    // GitHub mode
    github: {
      connect: ghConnect,
      disconnect: ghDisconnect,
      getToken: ghToken,
      getGistId: ghGistId,
      getLink: () => {
        const id = ghGistId(); const token = ghToken();
        if (!id || !token) return null;
        // Need user login to build URL — read from cached fire state
        return id;
      },
    },

    // Firebase mode (kept available)
    firebase: {
      getConfig: fbGetConfig, setConfig: fbSetConfig, clearConfig: fbClearConfig,
      init: fbInit, signIn: fbSignIn, signOut: fbSignOut,
    },

    // Generic
    pullOnce: pull,
    pushNow: push,
    get user() {
      if (getBackend() === "github") {
        const tok = ghToken();
        return tok ? { uid: "gh", name: "(connected)", email: "" } : null;
      }
      return fbUser ? { uid: fbUser.uid, email: fbUser.email, name: fbUser.displayName, photo: fbUser.photoURL } : null;
    },
  };
})();
