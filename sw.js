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

const VERSION = "v201";
const SHELL = `codex-shell-${VERSION}`;
const DATA  = `codex-data-${VERSION}`;
const PANELS = `codex-panels-${VERSION}`;
const ALL = [SHELL, DATA, PANELS];

// Resolve every shell URL against the SW's scope so offline works whether
// the app is mounted at "/" (local Node) or "/codex/" (GitHub Pages).
const SCOPE = self.registration ? self.registration.scope : self.location.origin + "/";
const r = (p) => new URL(p, SCOPE).toString();

// Files we want available offline immediately. Anything fetched later is
// added on-the-fly by the runtime handler below.
const SHELL_FILES = [
  r("./"),
  r("index.html"),
  r("styles.css"),
  r("manifest.json"),
  r("icon.svg"),
  r("direct-api.js"),
  r("i18n.js"),
  r("ai-translate-ui.js"),
  r("light-themes.js"),
  r("data.js"),
  r("bible.js"),
  r("auto-cache.js"),
  r("sync.js"),
  r("modules.js"),
  r("plugins.js"),
  r("gematria.js"),
  r("panels-gen.js"),
  r("mark-search.js"),
  r("search.js"),
  r("tweaks-panel.jsx"),
  r("help.jsx"),
  r("data/help/articles.json"),
  r("components.jsx"),
  r("panels.jsx"),
  r("oracle.jsx"),
  r("library.jsx"),
  r("verse-menu.jsx"),
  r("verse-map.jsx"),
  r("verse-art.jsx"),
  r("verse-compare.jsx"),
  r("verse-mirror.jsx"),
  r("repo-add.jsx"),
  r("notes.jsx"),
  r("quest-messiah.jsx"),
  r("ai-quests.jsx"),
  r("crossref.jsx"),
  r("strongs.jsx"),
  r("word-study.jsx"),
  r("data/modules/tsk-sample.json"),
  r("data/modules/strongs-hebrew.json"),
  r("data/modules/strongs-greek.json"),
  r("data/modules/alignment-kjv-sample.json"),
  r("reels.jsx"),
  r("data/modules/reels-curated.json"),
  r("dictionary.jsx"),
  r("data/modules/easton-sample.json"),
  r("timeline.jsx"),
  r("data/modules/timeline-events.json"),
  r("jewish-study.jsx"),
  r("babelforge.jsx"),
  r("translate-engine.js"),
  r("data/modules/voice-templates.json"),
  r("data/modules/parsha.json"),
  r("data/modules/hebrew-calendar.json"),
  r("data/modules/plan-daf-yomi.json"),
  r("passage-guide.jsx"),
  r("builder.jsx"),
  r("plans.jsx"),
  r("data/modules/plan-canonical-1y.json"),
  r("data/modules/plan-chronological-1y.json"),
  r("data/modules/plan-gospels-90.json"),
  r("data/modules/plan-psalms-30.json"),
  r("data/modules/plan-whole-bible-90.json"),
  r("data/modules/plan-daf-yomi.json"),
  r("data/modules/plan-torah-triennial.json"),
  r("data/modules/kabbalah-mappings.json"),
  r("marketplace.jsx"),
  r("compare.jsx"),
  r("vox.jsx"),
  r("data/modules/prayer-formats.json"),
  r("data/module-index.json"),
  r("app.jsx"),
  // Bundled Bibles (static JSON shipped in the repo). Pre-cached so
  // first cold offline launch can render apocryphal/Enoch content too.
  r("data/bibles/eth-en.json"),
  r("data/red-letter.json"),
];

// Cross-origin assets the app NEEDS to boot — React, Babel, Leaflet,
// Google Fonts CSS. Pre-cached on install so a cold offline launch
// (iOS PWA on an airplane) finds them in the cache instead of hitting
// the network. Listed as absolute URLs because they aren't scope-relative.
// Pinned to the exact versions referenced from index.html.
const VENDOR_FILES = [
  "https://unpkg.com/react@18.3.1/umd/react.development.js",
  "https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js",
  "https://unpkg.com/@babel/standalone@7.29.0/babel.min.js",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Cardo:ital@0;1&display=swap",
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
    // Vendor (cross-origin) goes into the DATA cache so it survives shell
    // bumps. Without explicit pre-caching, iOS PWA cold launches with no
    // network never get React/Babel/Leaflet — the page stays blank.
    const dataCache = await caches.open(DATA);
    await Promise.all(VENDOR_FILES.map(async (url) => {
      try {
        // mode: 'cors' so the cached response is full (not opaque) — lets
        // subresource integrity checks pass when replayed offline.
        const req = new Request(url, { mode: "cors", credentials: "omit", cache: "reload" });
        const resp = await fetch(req);
        if (resp && (resp.ok || resp.type === "opaque")) {
          await dataCache.put(url, resp.clone());
        }
      } catch (e) { /* best-effort */ }
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
  // Match anything served from our origin EXCEPT api routes (handled by
  // direct-api shim or proxied to a backend) and the SW itself. Works
  // for both "/" and "/codex/" mounts.
  return url.origin === SAME_ORIGIN
    && !/\/api\//.test(url.pathname)
    && !/\/sw\.js$/.test(url.pathname);
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
  if (/\/api\/(chat|key|health)$/.test(url.pathname)) {
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
