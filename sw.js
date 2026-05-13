// CODEX service worker — offline-first app shell + opportunistic caching of
// Bible verses, panel JSON, fonts. Three caches:
//
//   codex-shell-vN  — own-origin static files (HTML/CSS/JS/JSX/icons).
//                     Pre-cached on install. Stale-while-revalidate on fetch.
//   codex-data-vN   — cross-origin Bible API responses + Google Fonts files.
//                     Cache-first (rarely change). Opaque responses are OK.
//   codex-panels-vN — same-origin /api/* responses (currently we never cache
//                     POSTs; reserved for future GET endpoints).
//
// Bumping VERSION drops the old caches on activate. Anything served from
// localStorage (verses, panels, marks, settings) keeps working as before
// because that storage is independent of the SW caches.

const VERSION = "v121";
const SHELL = `codex-shell-${VERSION}`;
const DATA  = `codex-data-${VERSION}`;
const PANELS = `codex-panels-${VERSION}`;
const ALL = [SHELL, DATA, PANELS];

// Files we want available offline immediately. Anything fetched later is
// added on-the-fly by the runtime handler below.
const SHELL_FILES = [
  "/",
  "/index.html",
  "/styles.css",
  "/manifest.json",
  "/icon.svg",
  "/i18n.js",
  "/data.js",
  "/bible.js",
  "/panels-gen.js",
  "/tweaks-panel.jsx",
  "/components.jsx",
  "/panels.jsx",
  "/oracle.jsx",
  "/library.jsx",
  "/verse-menu.jsx",
  "/verse-map.jsx",
  "/verse-art.jsx",
  "/verse-compare.jsx",
  "/verse-mirror.jsx",
  "/repo-add.jsx",
  "/notes.jsx",
  "/quest-messiah.jsx",
  "/app.jsx",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // addAll is atomic — if any file fails, install fails. Use individual
    // adds so a single 404 doesn't block the whole shell from caching.
    await Promise.all(SHELL_FILES.map(async (url) => {
      try { await cache.add(new Request(url, { cache: "reload" })); }
      catch (e) { /* ignore — best-effort */ }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set(ALL);
    for (const k of await caches.keys()) {
      if (k.startsWith("codex-") && !keep.has(k)) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

// Helpers
const SAME_ORIGIN = self.location.origin;

function isOwnAsset(url) {
  return url.origin === SAME_ORIGIN
    && !url.pathname.startsWith("/api/")
    && !url.pathname.startsWith("/sw.js");
}

function isFont(url) {
  return /(?:fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.host);
}

function isBibleApi(url) {
  // Bible verse APIs are cross-origin (e.g. bible-api.com, etc.). We can't
  // know every endpoint in advance — opportunistically cache anything that
  // looks like JSON from cross-origin GETs.
  return url.origin !== SAME_ORIGIN && !isFont(url);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;       // only GET is cacheable
  const url = new URL(req.url);

  // Anthropic chat endpoint — never cache, always go to network. Oracle
  // replies must stay live.
  if (url.pathname === "/api/chat" || url.pathname === "/api/key" || url.pathname === "/api/health") {
    return;                                // let it fall through to network
  }

  if (isOwnAsset(url)) {
    event.respondWith(staleWhileRevalidate(req, SHELL));
    return;
  }

  if (isFont(url)) {
    event.respondWith(cacheFirst(req, SHELL));
    return;
  }

  if (isBibleApi(url)) {
    event.respondWith(cacheFirst(req, DATA));
    return;
  }
});

// Cache-first: return cached if present, else fetch and cache.
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const resp = await fetch(req);
    // Even opaque responses (no-cors) can be cached and replayed.
    if (resp && (resp.ok || resp.type === "opaque")) {
      cache.put(req, resp.clone()).catch(() => {});
    }
    return resp;
  } catch (e) {
    // Offline + nothing cached — return a minimal error response so callers
    // can degrade gracefully.
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Stale-while-revalidate: serve cached immediately, refresh in background.
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req).then((resp) => {
    if (resp && resp.ok) cache.put(req, resp.clone()).catch(() => {});
    return resp;
  }).catch(() => null);
  return cached || (await network) || new Response("offline", { status: 503 });
}
