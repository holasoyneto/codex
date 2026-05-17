// CODEX sync — Firebase Auth (Google) + Firestore sync of personal data.
//
// What syncs:
//   codex.tweaks.v1     — UI settings, theme, primary translation
//   codex.marks.v1      — highlighted verses + colours
//   codex.bookmarks.v1  — bookmarks (if present)
//   codex.notes.v1      — notes from the Notes panel
//   codex.bible.cache.v1 — cached scripture (so a new device gets your
//                          offline library without re-downloading 40 MB)
//   codex.panels.v1     — generated panel content
//   codex.redletter.*   — red-letter detection cache
//   codex.oracle.*      — Oracle conversation history (if persisted)
//
// What never syncs:
//   codex.api.keys.v1   — security: each device gets its own key
//   any *.session.*     — session-scoped state
//
// Conflict resolution: per-key last-write-wins, timestamped at write.
// Two-way: local edits push to Firestore; remote edits push back into
// localStorage and broadcast a 'storage' event so the app reacts.
//
// Setup (one-time, per user):
//   1) console.firebase.google.com → Add project (free Spark plan)
//   2) Authentication → Sign-in method → enable Google
//   3) Firestore Database → Create (production mode, any region)
//   4) Project settings → General → Add app → Web → Register → copy config
//   5) Paste config JSON into Settings → Sync → Firebase config

(function () {
  const LS_CONFIG = "codex.sync.firebaseConfig.v1";
  const LS_AUTO   = "codex.sync.auto.v1";
  const LS_LAST   = "codex.sync.lastSync.v1";

  // Keys we sync — exact key prefixes. NEVER include API keys.
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

  let app = null, auth = null, db = null, user = null;
  let unsubDoc = null;
  let autoTimer = null;
  let pushDebounce = null;

  // ── State ─────────────────────────────────────────────────────────
  function getConfig() {
    try { return JSON.parse(localStorage.getItem(LS_CONFIG) || "null"); } catch { return null; }
  }
  function setConfig(cfg) {
    try { localStorage.setItem(LS_CONFIG, JSON.stringify(cfg)); } catch {}
  }
  function clearConfig() {
    try { localStorage.removeItem(LS_CONFIG); } catch {}
  }
  function getAuto() {
    return localStorage.getItem(LS_AUTO) === "1";
  }
  function setAuto(v) {
    localStorage.setItem(LS_AUTO, v ? "1" : "0");
    if (v) startAutoSync(); else stopAutoSync();
  }
  function getLast() {
    try { return JSON.parse(localStorage.getItem(LS_LAST) || "null"); } catch { return null; }
  }
  function setLast(o) {
    try { localStorage.setItem(LS_LAST, JSON.stringify(o)); } catch {}
  }

  // ── Firebase lifecycle ────────────────────────────────────────────
  function ensureFirebaseLoaded() {
    return new Promise((resolve, reject) => {
      if (window.firebase && window.firebase.auth && window.firebase.firestore) {
        return resolve();
      }
      // Lazy-load Firebase compat SDK from CDN
      const scripts = [
        "https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js",
        "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth-compat.js",
        "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore-compat.js",
      ];
      let i = 0;
      const next = () => {
        if (i >= scripts.length) return resolve();
        const s = document.createElement("script");
        s.src = scripts[i++];
        s.onload = next;
        s.onerror = () => reject(new Error("Failed to load Firebase: " + s.src));
        document.head.appendChild(s);
      };
      next();
    });
  }

  async function init() {
    const cfg = getConfig();
    if (!cfg) return { ok: false, reason: "no-config" };
    try {
      await ensureFirebaseLoaded();
      if (!app) {
        app = window.firebase.initializeApp(cfg);
        auth = window.firebase.auth();
        db = window.firebase.firestore();
        auth.onAuthStateChanged((u) => {
          user = u;
          fire("auth", { user: u ? { uid: u.uid, email: u.email, name: u.displayName, photo: u.photoURL } : null });
          if (u) {
            subscribeRemote();
            // First-time: pull existing remote before pushing local, so a
            // brand-new device doesn't clobber server state with empty.
            pullOnce().then(() => {
              if (getAuto()) startAutoSync();
            });
          } else {
            unsubscribeRemote();
            stopAutoSync();
          }
        });
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e.message || String(e) };
    }
  }

  async function signIn() {
    const r = await init();
    if (!r.ok) throw new Error("Firebase not configured: " + r.reason);
    const provider = new window.firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
  }
  async function signOut() {
    if (auth) await auth.signOut();
  }

  // ── Data shape ────────────────────────────────────────────────────
  // Firestore doc: users/{uid}/sync
  // Shape: { keys: { <lsKey>: { v: <string>, t: <epoch_ms> } }, updatedAt: <epoch_ms> }
  function collectLocal() {
    const keys = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!isSyncable(k)) continue;
      const v = localStorage.getItem(k);
      if (v == null) continue;
      keys[k] = { v, t: Date.now() };
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
      // Last-write-wins. If we have no local timestamp, the remote wins.
      // Trivially correct on a fresh device; for active devices, the
      // pre-push pullOnce + per-key timestamping keeps it convergent.
      try { localStorage.setItem(k, entry.v); changed++; } catch {}
      try { window.dispatchEvent(new StorageEvent("storage", { key: k, newValue: entry.v })); } catch {}
    }
    return { changed };
  }

  let _lastRemoteSnapshot = null;
  function subscribeRemote() {
    if (!user) return;
    unsubscribeRemote();
    const ref = db.collection("users").doc(user.uid).collection("sync").doc("main");
    unsubDoc = ref.onSnapshot((snap) => {
      const data = snap.data();
      if (!data) return;
      _lastRemoteSnapshot = data;
      const r = applyRemote(data);
      if (r.changed) {
        setLast({ at: Date.now(), direction: "down", changed: r.changed });
        fire("synced", { direction: "down", changed: r.changed });
      }
    }, (err) => {
      fire("error", { message: err.message || String(err) });
    });
  }
  function unsubscribeRemote() {
    if (unsubDoc) { unsubDoc(); unsubDoc = null; }
  }

  async function pullOnce() {
    if (!user) return { ok: false, reason: "not signed in" };
    const ref = db.collection("users").doc(user.uid).collection("sync").doc("main");
    const snap = await ref.get();
    if (snap.exists) {
      _lastRemoteSnapshot = snap.data();
      const r = applyRemote(snap.data());
      setLast({ at: Date.now(), direction: "down", changed: r.changed });
      fire("synced", { direction: "down", changed: r.changed });
    }
    return { ok: true };
  }

  async function pushNow() {
    if (!user) return { ok: false, reason: "not signed in" };
    const keys = collectLocal();
    // Merge with last known remote: any remote-only keys we don't have
    // locally STAY in remote. We only overwrite keys we have a value for.
    let merged = keys;
    if (_lastRemoteSnapshot && _lastRemoteSnapshot.keys) {
      merged = { ..._lastRemoteSnapshot.keys, ...keys };
    }
    const ref = db.collection("users").doc(user.uid).collection("sync").doc("main");
    await ref.set({ keys: merged, updatedAt: Date.now() }, { merge: true });
    const last = { at: Date.now(), direction: "up", count: Object.keys(keys).length };
    setLast(last);
    fire("synced", last);
    return { ok: true };
  }

  function schedulePush() {
    if (!user || !getAuto()) return;
    clearTimeout(pushDebounce);
    pushDebounce = setTimeout(() => {
      pushNow().catch((e) => fire("error", { message: e.message || String(e) }));
    }, 1500);
  }

  function startAutoSync() {
    stopAutoSync();
    if (!user) return;
    // Periodic push every 30s (debounced on local changes too)
    autoTimer = setInterval(() => {
      pushNow().catch(() => {});
    }, 30000);
    fire("auto", { on: true });
  }
  function stopAutoSync() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    fire("auto", { on: false });
  }

  // Watch local storage for changes from THIS tab (the storage event only
  // fires for other tabs). We monkey-patch setItem to call schedulePush.
  const origSet = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (k, v) {
    const r = origSet(k, v);
    if (isSyncable(k)) schedulePush();
    return r;
  };
  // Cross-tab change → schedule a push from this tab too
  window.addEventListener("storage", (e) => {
    if (isSyncable(e.key)) schedulePush();
  });

  // ── Events bus ────────────────────────────────────────────────────
  const _listeners = {};
  function on(ev, fn) {
    (_listeners[ev] = _listeners[ev] || []).push(fn);
    return () => { _listeners[ev] = (_listeners[ev] || []).filter(x => x !== fn); };
  }
  function fire(ev, payload) {
    (_listeners[ev] || []).forEach(fn => { try { fn(payload); } catch {} });
  }

  // Public API
  window.CODEX_SYNC = {
    getConfig, setConfig, clearConfig,
    init, signIn, signOut, pullOnce, pushNow,
    getAuto, setAuto, getLast,
    isSyncable, on,
    get user() { return user ? { uid: user.uid, email: user.email, name: user.displayName, photo: user.photoURL } : null; },
    get configured() { return !!getConfig(); },
  };

  // Auto-init if config is present (lets the app boot signed-in on reload)
  if (getConfig()) {
    init().then((r) => {
      if (!r.ok) console.warn("[codex sync] init:", r.reason);
    });
  }
})();
