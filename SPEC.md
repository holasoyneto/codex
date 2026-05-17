# CODEX — Open Specification

**Status:** Living document. Versioned with the app (see `sw.js` → `VERSION`).
**Audience:** Plugin authors, module authors, translation maintainers, server operators.
**Companion docs:** [`MODULES.md`](./MODULES.md) · [`API.md`](./API.md) · [`CONTRIBUTING.md`](./CONTRIBUTING.md) · [`ROADMAP.md`](./ROADMAP.md)

CODEX is an open-source, distraction-respectful, multi-tradition Bible study PWA. The goal of this document is to make every extension surface — code, data, and translations — predictable enough that anyone can build on it without reading the entire codebase.

---

## 1. Architecture at a glance

```
┌──────────────────────────────── Browser (PWA) ────────────────────────────────┐
│                                                                               │
│   index.html ── boot ──▶ app.jsx (React via Babel-standalone, no bundler)     │
│       │                                                                       │
│       ├── data layer:   bible.js  data.js  modules.js  search.js  gematria.js │
│       ├── ui layer:     panels.jsx components.jsx help.jsx oracle.jsx …       │
│       ├── plugin host:  plugins.js   ── window.CODEX_PLUGINS_API              │
│       ├── service wrk:  sw.js        ── 3 caches: shell / data / panels       │
│       └── storage:      localStorage (codex.* keys) + IndexedDB (3 DBs)       │
│                                                                               │
└────────────────────────────────────┬──────────────────────────────────────────┘
                                     │ HTTPS (only when AI is invoked)
                                     ▼
┌──────────────────── server.js (Node, std-lib only, no deps) ──────────────────┐
│   /api/health   /api/key   /api/chat   ──▶  Anthropic | xAI | Ollama (local)  │
└───────────────────────────────────────────────────────────────────────────────┘
```

Everything below the server boundary is optional. CODEX is fully functional offline once the shell + a translation are cached; only LLM-backed features (Oracle, panel generation) need the proxy.

---

## 2. Extension surfaces

CODEX has **three** independent extension surfaces. Pick the smallest one that fits your goal.

| Surface | What it adds | Trust level | Loaded via |
|---|---|---|---|
| **Plugins** (code) | New right-rail panels, verse-menu actions, navigation/selection hooks | High — runs JS in the page | `<script>` tag or future installer |
| **Modules** (data) | Lexicons, cross-refs, commentaries, plans, timelines, maps, parshiot, cantillation | Low — pure JSON | `window.CODEX_MODULES.loadModule(id)` |
| **Translations** | Bible text in any language / versification | Low — JSON verses | `bible.js` translation registry |

See [`MODULES.md`](./MODULES.md) for the module authoring guide and [`CONTRIBUTING.md`](./CONTRIBUTING.md) for translations.

---

## 3. Plugin spec

### 3.1 Shape

```js
{
  id:      "strongs-concordance",   // required, unique, kebab-case
  name:    "Strong's Concordance",  // required, human-readable
  version: "1.0.0",                 // required, semver

  panels: [                         // optional — right-rail tabs
    {
      id:    "strongs",             // unique within plugin
      label: "Strong's",
      glyph: "ℋ",                   // 1-char visual marker
      render(ctx) { /* ... */ }     // see 3.3 below
    }
  ],

  verseActions: [                   // optional — verse-menu rows
    { label: "Strong's Lookup", icon: "ℋ", handler(verseRef) { /* ... */ } }
  ],

  onNavigate(book, chapter) {},     // optional — chapter-change hook
  onVerseSelect(ref)        {},     // optional — verse-cursor hook
}
```

### 3.2 Lifecycle

```
script loads  →  register()  →  codex:plugin-registered event
                     │
        ┌────────────┼─────────────────────────────────┐
        ▼            ▼                                 ▼
   panels mount  verseActions appear           hooks subscribed
   in right rail  in verse menu                      │
                                                     ▼
                                  ┌──────────────────────────────┐
                                  │  user navigates chapter ─────▶ onNavigate(book, ch)
                                  │  user taps verse       ─────▶ onVerseSelect(ref)
                                  │  user opens panel      ─────▶ panel.render(ctx)
                                  └──────────────────────────────┘
```

Every hook is wrapped in `try/catch`; one buggy plugin cannot brick the app.

### 3.3 Panel render context

```ts
render(ctx: {
  book:        string;   // book id, lowercase, e.g. "jhn"
  chapter:     number;
  verse:       number | null;
  translation: string;   // active translation id, e.g. "kjv"
  container:   HTMLElement; // mutate directly OR return a React element
}): React.ReactElement | void
```

### 3.4 Registration

```html
<!-- Push directly (before plugins.js loads, or after — both work): -->
<script>window.CODEX_PLUGINS = window.CODEX_PLUGINS || [];
        window.CODEX_PLUGINS.push({ id: "...", ... });</script>

<!-- Or, post-boot via the API: -->
<script>window.CODEX_PLUGINS_API.register({ id: "...", ... });</script>
```

See `plugins.js` for the canonical example at the bottom of the file.

---

## 4. Module spec

Modules are pure JSON. Every module has the same outer envelope:

```jsonc
{
  "meta": {
    "id":      "tsk-sample",       // required, unique, kebab-case
    "type":    "cross-reference",  // required, one of VALID_TYPES
    "version": "1.0.0",            // required, semver
    "name":    "Treasury of Scripture Knowledge",
    "lang":    "en",
    "_partial": true,              // optional — flag incomplete data
    "note":    "Sample subset…",   // optional
    "installedAt": 1740000000000   // set by loader on cache write
  },
  // ─── type-specific body keys ───
  "verses": { /* ... */ }
}
```

### 4.1 Valid module types

Defined in `modules.js → VALID_TYPES`:

```
lexicon       concordance       cross-reference   commentary
reading-plan  timeline          map-overlay       dictionary
parsha        cantillation
```

Each type has its own body schema — see [`MODULES.md`](./MODULES.md) for the entry shape of each.

### 4.2 Loader API (`window.CODEX_MODULES`)

```ts
loadModule(id: string):                       Promise<Module>
loadModuleFromUrl(url: string, expectedId):   Promise<Module>
listModules():                                Promise<MetaSummary[]>
removeModule(id: string):                     Promise<void>
hasModule(id: string):                        Promise<boolean>
VALID_TYPES:                                  string[]
```

**Cache strategy:** IndexedDB (`codex-modules` DB, `modules` store). `loadModule` reads cache → revalidates over network → upgrades only on version bump. On any network error, cached copy is served.

### 4.3 Module index

`data/modules/_index.json` lists modules the app should preload on boot. Empty `{ "modules": [] }` means lazy-load only. Plugins or settings UIs can call `loadModule(id)` at any time.

---

## 5. Event bus

Every event is a `CustomEvent` dispatched on `window`. Listen with `window.addEventListener(name, e => e.detail)`.

| Event | `detail` payload | Source |
|---|---|---|
| `codex:plugin-registered` | `{ plugin }` | `plugins.js` |
| `codex:navigate` | `{ book, chapter }` | `app.jsx` on chapter change |
| `codex:verse-select` | `{ ref }` where `ref = "jhn.1.1"` | `app.jsx` on tap |
| `codex:open-panel` | `{ id }` | rail click / hotkey |
| `codex:strongs-open` | `{ strong }` e.g. `"H430"` | inline-token tap |
| `codex:gematria` | `{ word, lang, values }` | gematria.js result |
| `codex:bible` | `{ translation, refs }` | bible.js bundle load |
| `codex:bookmark-added` | `{ ref, label }` | notes.jsx |
| `codex:notes` | `{ kind, ref }` | notes.jsx |
| `codex:lang` | `{ lang }` | i18n.js switch |
| `codex:keys` | `{ provider, hasKey }` | settings save |
| `codex:engine-change` | `{ provider, model }` | model picker |
| `codex:light-theme-change` | `{ id }` | light-themes.js |
| `codex:autocache-start` / `-tick` / `-done` / `-error` | `{ phase, progress, error? }` | auto-cache.js |
| `codex:overlays` | `{ which, on }` | overlay toggles |
| `codex:userpos` | `{ lat, lng }` | location consent |
| `codex:year` | `{ year }` | timeline scrubbing |
| `codex:discovered` | `{ category, id }` | progressive discovery system |
| `codex:tourist-mode` / `codex:tourist` / `codex:tourist-select` | `{ on }` / `{ stop }` / `{ ref }` | tourist mode |
| `codex:shortcut` | `{ key }` | global hotkeys |
| `codex:escape` | `{}` | esc-press broadcast |

Plugins may **dispatch** custom events under their own namespace (e.g. `myplugin:foo`) — please do not invent new `codex:*` names without proposing them in a PR.

---

## 6. Window globals

The full alphabetical reference is in [`API.md`](./API.md). At-a-glance:

| Global | Purpose |
|---|---|
| `window.CODEX_PLUGINS_API` | `register / list / getPanels / getVerseActions / dispatch / onNavigate / onVerseSelect` |
| `window.CODEX_PLUGINS` | Raw array — push to it pre-boot |
| `window.CODEX_MODULES` | `loadModule / loadModuleFromUrl / listModules / removeModule / hasModule / VALID_TYPES` |
| `window.CODEX_GEMATRIA` | Pure-compute: `hebrew.*`, `greek.*`, `english.*`, `all(text)`, `detectLang(text)` |
| `window.CODEX_GEMATRIA_INDEX` | `build / find / stats / reset / ensure` — cross-reference index over cached verses |
| `window.CODEX_SEARCH` | `index / ingestPassage / search(q, opts) / clear / stats / ready` |
| `window.CODEX_PANELS` | Panel JSON generator: `load / getCached / purge / subscribe / cacheKey / cacheStats` |
| `window.CODEX_StrongsPanel` `_Lookup` `_Renderer` | Right-rail Strong's UI + helpers |
| `window.CODEX_CrossRefPanel` `_Lookup` | Right-rail cross-ref UI + lookup |
| `window.CODEX_HelpWiki` | In-app help articles + search |
| `window.CODEX_NormieToggle` | Beginner-mode UI switch |
| `window.CODEX_LIGHT_THEMES` | Light-theme registry |
| `window.CODEX_Reels` | Discovery/Reels module |
| `window.CODEX_BIBLE_SITES` | Curated external link registry |
| `window.CODEX_MANUSCRIPT_SITES` | Curated manuscript link registry |
| `window.CODEX_PILGRIM_ROUTES` | Curated pilgrimage routes |
| `window.CODEX_QUESTS` | Quest engine (Messiah, etc.) |
| `window.CODEX_AUTOCACHE` | Background-cache progress controller |
| `window.CODEX_DIRECT` | Browser-side direct-to-provider client (BYO key) |
| `window.CODEX_DRIFT` | Animation/typography drift helpers |
| `window.CODEX_SYNC` | Cross-device sync (GitHub Gist / Firebase backends) |
| `window.CODEX_LANG` / `window.CODEX_LANGS` | Active UI language + registry |
| `window.CODEX_T` / `window.CODEX_T_DRIFT` / `window.t` | i18n string lookup |
| `window.codexJumpToRef(ref)` | Imperative navigation helper |
| `window.codexSpeak(text, opts?)` | TTS bridge |
| `window.codexLangName(code)` | Language code → display name |
| `window.BIBLE` | Translation registry + verse fetchers |
| `window.CODEX_DATA` | Static data tables (books, chapter counts, etc.) |
| `window.railTabs` | Mutable list of right-rail tabs (plugins extend this) |

---

## 7. Storage

### 7.1 localStorage — `codex.*` namespace

All app state lives under the `codex.` prefix. Versioned keys carry a `.v<N>` suffix; bump on incompatible schema changes and migrate on read.

| Key (prefix) | Shape | Notes |
|---|---|---|
| `codex.lang` | `"en" \| "es" \| …` | active UI language |
| `codex.bible.<trans>.<book>.<ch>` | `{ verses: [...] }` | per-chapter verse cache fallback |
| `codex.bible.cache.v2` | `{ [key]: verses[] }` | bulk fallback (legacy) |
| `codex.panels.v1.<book>.<ch>[.<lang>]` | `{ _v: 2, data, fetchedAt }` | generated panel JSON, see `panels-gen.js` |
| `codex.gematria.index.v1` | `{ _v, byValue, builtAt }` | cross-reference index |
| `codex.marksearch.v1` | `{ docs, builtAt }` | search index meta mirror |
| `codex.notes.v<N>` | `{ [ref]: noteText }` | user notes |
| `codex.notes.draft` | unsaved draft | |
| `codex.notes.{pos,size,visible,listOpen}` | window state | |
| `codex.highlights.v<N>` | `{ [ref]: colorId }` | user highlights |
| `codex.bookmarks` | `[{ ref, label, ts }]` | bookmarks list |
| `codex.bookmarks.<set>` | named bookmark sets | |
| `codex.marks.<kind>` | `[ref, …]` | red-letter / YHWH / etc. user overrides |
| `codex.marks.pinned.v<N>` | pinned marks | |
| `codex.api.keys.v<N>` | `{ anthropic?, xai? }` | BYO-key storage (browser-direct mode) |
| `codex.anthropic.key.v<N>` | legacy single key | |
| `codex.oracle.convs.v<N>` | `[{ id, title, messages }]` | Oracle conversation list |
| `codex.oracle.active.v<N>` | `string` (conv id) | |
| `codex.oracle.history.<id>` | full message history per conv | |
| `codex.oracle.quickHidden` | bool | quick-prompt visibility |
| `codex.oracle.resumed` | bool | resume-prompt seen flag |
| `codex.lightTheme.v<N>` | `string` (theme id) | |
| `codex.normie.*` | beginner-mode flags | |
| `codex.passageLoc` | `{ book, chapter }` | last reading position |
| `codex.compareSet` | `[trans, trans]` | side-by-side picks |
| `codex.discovered` | `{ [cat]: [id, …] }` | progressive discovery state |
| `codex.bootIntro` | bool | skip splash next launch |
| `codex.lrail.width` / `codex.rrail.width` | px | rail widths |
| `codex.export` | last export config | |
| `codex.primary` | active primary translation | |
| `codex.empire.*` | "empire" timeline overlay state | |
| `codex.quest.*` | quest progress per quest id | |
| `codex.reels.deck.v<N>` / `.seen.v<N>` | reels feed state | |
| `codex.redletter.{verses,endstate}.v<N>` / `codex.redletter.<flag>` | red-letter state | |
| `codex.repos.v<N>` | `[{ url, label }]` | added module repos |
| `codex.session.<key>` | per-session ephemeral cache | |
| `codex.sync.{auto,backend,firebaseConfig,github.*,lastSync}.v<N>` | sync settings | |
| `codex.maps.<id>` / `codex.mirrors.<id>` / `codex.art.<id>` / `codex.help.tr.<id>` | per-feature caches | |
| `codex.autocache.v<N>` | autocache progress | |
| `codex.help.tr.<articleId>.<lang>` | translated help cache | |

**Namespace rule:** if you ship a plugin, prefix your keys with `codex.plugin.<pluginId>.` to stay out of the core namespace.

### 7.2 IndexedDB

| DB | Store | Key | Value | Owner |
|---|---|---|---|---|
| `codex` | `chapters` | `"<translation>.<book>.<ch>"` | `{ verses: [{ n, text }] }` | `bible.js` |
| `codex-modules` | `modules` | `meta.id` | full module object | `modules.js` |
| `codex-search` | `docs` | doc id | `{ ref, translation, text }` (+ `__meta__`) | `search.js` |

### 7.3 Service worker caches

Defined in `sw.js`. Bump `VERSION` on incompatible asset changes.

```
codex-shell-v<N>   — own-origin static (precached, stale-while-revalidate)
codex-data-v<N>    — cross-origin Bible APIs + Google Fonts (cache-first)
codex-panels-v<N>  — reserved for future GET /api/* caching
```

---

## 8. Server endpoints

`server.js` is a zero-dependency Node HTTP server. It serves the static app + provides a minimal proxy.

### `GET /api/health`

```json
{
  "ok": true,
  "hasKey": true,
  "model": "claude-haiku-4-5-20251001",
  "usage": { "input": 0, "output": 0, "cache_create": 0, "cache_read": 0, "calls": 0, "sinceISO": "..." },
  "providers": {
    "anthropic": { "available": true,  "models": [...] },
    "xai":       { "available": false, "models": [...] },
    "ollama":    { "available": true,  "models": [...] }
  }
}
```

### `POST /api/key`

```json
{ "key": "sk-ant-…", "provider": "anthropic" }
```

Persists to `.env` (chmod 600). `provider` is inferred from prefix if omitted (`sk-ant-` → anthropic, `xai-` → xai).

### `POST /api/chat`

```jsonc
// request
{ "system": "...", "messages": [{ "role": "user", "content": "..." }],
  "max_tokens": 1024, "model": "claude-haiku-4-5-20251001",
  "provider": "anthropic" }

// response (provider-agnostic envelope)
{ "text": "...", "model": "...", "provider": "anthropic", "usage": {...} }
```

**Provider whitelist** is hard-coded in `server.js → PROVIDERS` so a poisoned client cannot point the proxy at an arbitrary endpoint. Adding a model requires a server-side change.

---

## 9. JSON schemas

### 9.1 Panel data (`window.CODEX_PANELS` cache value)

```jsonc
{
  "_v": 2,                  // cache wrapper version
  "fetchedAt": 1740000000000,
  "data": {
    "title": "string",
    "subtitle": "string",
    "talmud":      [ { "ref","heading","body","tag" }, ... ],     // 3
    "commentary":  [ { "from","author","body" }, ... ],           // 4
    "gematria":    [ { "term","translit","meaning","value","system" }, ... ], // 6
    "gematriaNotes": ["string", "string"],
    "gematriaDeep": { "_schema": 2, /* see panels-gen.js */ },
    "gnosis":       [ ... ],
    "apologetics":  [ ... ]
    // ...future fields keyed under their own panel id
  }
}
```

Forward-compat rule: unknown top-level fields are ignored by older builds; renderers must guard with optional chaining.

### 9.2 Module meta

```ts
type ModuleMeta = {
  id:        string;          // required, kebab-case
  type:      ModuleType;      // required, one of VALID_TYPES
  version:   string;          // required, semver
  name?:     string;
  lang?:     string;          // BCP-47 (en, he, el, es-MX, …)
  description?: string;
  source?:   string;          // attribution
  _partial?: boolean;         // signal incomplete data
  note?:     string;
  installedAt?: number;       // set by loader
};
```

### 9.3 Plugin

```ts
type Plugin = {
  id:      string;
  name:    string;
  version: string;
  panels?:        Array<{ id; label?; glyph?; render(ctx) }>;
  verseActions?:  Array<{ label; icon?; handler(ref) }>;
  onNavigate?:    (book: string, chapter: number) => void;
  onVerseSelect?: (ref: string) => void;
};
```

---

## 10. Versioning policy

| Surface | Version field | Bump when |
|---|---|---|
| Service-worker assets | `sw.js → VERSION` | Any incompatible static-asset change |
| Generated panel cache | `_v` in cached object | Cache shape changes |
| Panel "deep" sub-objects | `_schema` inside subtree | Sub-schema changes only |
| Module | `meta.version` (semver) | Any content change; loader upgrades on mismatch |
| Plugin | `plugin.version` (semver) | Public API/UX change |
| localStorage keys | `.v<N>` suffix on key | Schema-breaking change; migrate on read |

Semver guidance for modules and plugins: bump **patch** for content fixes, **minor** for additive entries, **major** for breaking structural changes.

---

## 11. Stability promises

- **Stable surface (1.x guarantees):** plugin shape, module envelope, event names listed in §5, `window.CODEX_PLUGINS_API`, `window.CODEX_MODULES`, `/api/*` request/response shapes.
- **Unstable / internal:** anything under `window.CODEX_*` not listed in §6, layout/render details, CSS class names, localStorage key internals.

When in doubt: ask in an issue, or read [`API.md`](./API.md) for the flat reference.
