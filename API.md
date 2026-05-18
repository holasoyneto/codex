# CODEX — API Reference

A flat, alphabetical reference for every documented `window.CODEX_*` global, helper function, and `codex:*` custom event the app dispatches.

Signatures use TypeScript-style notation but the runtime is plain JS. Prose descriptions are intentionally one or two sentences each — for deep context see [`SPEC.md`](./SPEC.md) and [`MODULES.md`](./MODULES.md).

---

## Window globals

### `window.BIBLE`

```ts
type Bible = {
  translations: Translation[];
  getChapter(translation: string, book: string, chapter: number): Promise<{ verses: Verse[] }>;
  // … plus internal _memCache and helpers
};
```
The translation registry + verse fetcher. Backs every reader view and seeds `CODEX_SEARCH` and `CODEX_GEMATRIA_INDEX`.

### `window.codexJumpToRef(ref: string): void`
Imperative navigator. Pass `"jhn.1.1"` or `"jhn.1"` to jump the reader to that location. Dispatches `codex:navigate` and (if a verse is given) `codex:verse-select`.

### `window.codexLangName(code: string): string`
Looks up a BCP-47 language code's display name, honoring the active UI language. Falls back to the code itself when unknown.

### `window.codexSpeak(text: string, opts?: { lang?: string; rate?: number; voice?: string }): void`
TTS bridge over `speechSynthesis`. Cancels any in-flight utterance before speaking.

### `window.CODEX_AUTOCACHE`
```ts
{ start(); stop(); status(): { phase, progress, total }; resume(); }
```
Background pre-fetch controller for chapters/panels. Emits `codex:autocache-start|tick|done|error`.

### `window.CODEX_BIBLE_SITES`
Curated array of external Bible-study links surfaced in the verse menu. Each entry: `{ id, name, url(ref), category, langs }`.

### `window.CODEX_CrossRefLookup(ref: string): Promise<CrossRef[]>`
Returns cross-references for a verse, drawing from any loaded `cross-reference` modules.

### `window.CODEX_CrossRefPanel`
React component rendering the right-rail cross-reference UI. Internal — listed for completeness.

### `window.CODEX_DATA`
Static tables: book ids, canonical orders, chapter counts, abbreviation maps. Read-only.

### `window.CODEX_DIRECT`
Browser-direct AI client used in BYO-key mode. Same `{system, messages, …} → { text, model, usage }` shape as `/api/chat`, but talks to providers from the page when the user has supplied their own key.

### `window.CODEX_DRIFT`
Animation/typography drift helpers (subtle motion utilities used in chrome).

### `window.CODEX_GEMATRIA`
```ts
{
  detectLang(text: string): "hebrew" | "greek" | "english" | "mixed";
  strip(text: string): string;
  hebrew:  { hechrachi, gadol, sidduri, katan, katan_mispari, boneh, kidmi,
             atbash, albam, neelam, haakhor };   // each: (text) => number
  greek:   { isopsephy, ordinal, reduced };
  english: { ordinal, reduction, reverse };
  all(text: string): Record<string, number>;
}
```
Pure on-device gematria. No network, no async.

### `window.CODEX_GEMATRIA_INDEX`
```ts
{
  build():   Promise<void>;
  find(value: number, system?: string): { ref, word, system }[];
  stats():   { values, entries, builtAt };
  reset():   Promise<void>;
  ensure():  Promise<Index>;
}
```
Cross-reference index that groups every cached verse's words by gematria value. Persisted under `codex.gematria.index.v1`. Auto-rebuilds (throttled) when new chapters arrive.

### `window.CODEX_HelpWiki`
In-app Help: `open(id?)`, `search(q)`, `categories`, `articles`. Reads `data/help/articles.json`.

### `window.CODEX_LANG: string` · `window.CODEX_LANGS: Lang[]`
Active UI language and the registry of available languages.

### `window.CODEX_LIGHT_THEMES`
```ts
{ list(): Theme[]; apply(id: string): void; current(): Theme; }
```
Light-theme registry. Emits `codex:light-theme-change` on apply.

### `window.CODEX_MANUSCRIPT_SITES`
Curated array of manuscript-image links (Leningrad Codex, Sinaiticus, etc.) for the verse menu.

### `window.CODEX_MODULES`
```ts
{
  loadModule(id: string):                            Promise<Module>;
  loadModuleFromUrl(url: string, expectedId: string):Promise<Module>;
  listModules():                                     Promise<MetaSummary[]>;
  removeModule(id: string):                          Promise<void>;
  hasModule(id: string):                             Promise<boolean>;
  VALID_TYPES:                                       string[];
}
```
Data module loader with IDB cache + version-aware revalidation. See [`SPEC.md` §4](./SPEC.md#4-module-spec) and [`MODULES.md`](./MODULES.md).

### `window.CODEX_NormieToggle`
Beginner-mode switch. `get(): boolean` · `set(on: boolean): void`. Hides advanced affordances when on.

### `window.CODEX_PANELS`
```ts
{
  cacheKey(book: string, chapter: number): string;
  load(book, chapter, bookName): Promise<PanelData>;
  getCached(book, chapter):      PanelData | null;
  getCachedMeta(book, chapter):  { fetchedAt } | null;
  cacheStats():                  { ref, bytes, fetchedAt }[];
  purge(book, chapter):          void;
  subscribe(fn):                 () => void;
}
```
AI-backed panel JSON generator for Talmud/Commentary/Gematria/Gnosis/Apologetics. localStorage cache (`codex.panels.v1.*`).

### `window.CODEX_PILGRIM_ROUTES`
Curated pilgrimage-route data (e.g. Via Dolorosa, Camino).

### `window.CODEX_PLUGINS: Plugin[]`
Raw plugin array. Pre-boot scripts push directly; the API adopts pending entries on load.

### `window.CODEX_PLUGINS_API`
```ts
{
  register(plugin: Plugin):       boolean;
  list():                         Plugin[];
  getPanels():                    PluginPanel[];
  getVerseActions():              PluginVerseAction[];
  dispatch(event: string, detail: any): void;
  onNavigate(book, chapter):      void;
  onVerseSelect(ref):             void;
}
```
Canonical plugin host. See [`SPEC.md` §3](./SPEC.md#3-plugin-spec).

### `window.CODEX_QUESTS`
Quest engine (Messianic, manuscript, geography quests). `start(id)`, `progress(id)`, `complete(id)`.

### `window.CODEX_Reels`
Discovery / Reels feed: `next()`, `seen(id)`, `deck()`.

### `window.CODEX_SEARCH`
```ts
{
  index(translation: string, refsObject: any): Promise<void>;
  ingestPassage(passage: any):                 Promise<void>;
  search(query: string, opts?: { limit? }):    Promise<Result[]>;
  clear():                                     Promise<void>;
  stats():                                     { translations, verses, indexedAt, built };
  ready:                                       Promise<void>;
}
```
Full-text search over cached verses. Self-contained IDB (`codex-search`).

### `window.CODEX_SearchBar`
React component for the top-bar search input. Internal — opens `CODEX_SEARCH` UI.

### `window.CODEX_StrongsLookup(id: string): Entry | null`
Look up a Strong's entry by id (e.g. `"H430"`, `"G3056"`) across loaded lexicons.

### `window.CODEX_StrongsPanel`
React component rendering the right-rail Strong's UI.

### `window.CODEX_StrongsRenderer`
Helper that decorates verse text with clickable Strong's tokens when an aligned `concordance` module covers it.

### `window.CODEX_SYNC`
```ts
{
  backend(): "github" | "firebase" | null;
  push(): Promise<void>;
  pull(): Promise<void>;
  status(): { lastSync, backend, auto };
}
```
Cross-device sync (Gist / Firebase backends).

### `window.CODEX_T(key: string, vars?: object): string` · `window.t`
i18n string lookup. `window.t` is an alias.

### `window.CODEX_T_DRIFT`
Drift-aware translation lookup used for poetic/literary UI strings (subtle variation across reloads).

### `window.railTabs`
Mutable array of right-rail tab descriptors. Plugins extend it via `CODEX_PLUGINS_API.register({ panels: […] })`.

---

## Custom events

All events are `CustomEvent` instances dispatched on `window`. Subscribe with `addEventListener(name, e => e.detail)`.

### `codex:autocache-start` · `codex:autocache-tick` · `codex:autocache-done` · `codex:autocache-error`
Background-cache lifecycle. Detail: `{ phase, progress, total, error? }`.

### `codex:bible`
Bible bundle loaded. Detail: `{ translation, refs }`.

### `codex:bookmark-added`
Detail: `{ ref, label, ts }`.

### `codex:discovered`
Progressive-discovery system unlocked something. Detail: `{ category, id }`.

### `codex:engine-change`
User changed AI provider/model. Detail: `{ provider, model }`.

### `codex:escape`
Global Esc-key broadcast. No detail. Use to dismiss your overlay.

### `codex:gematria`
A gematria computation completed. Detail: `{ word, lang, values }`.

### `codex:keys`
User saved/cleared an API key. Detail: `{ provider, hasKey }`.

### `codex:lang`
UI language changed. Detail: `{ lang }`.

### `codex:light-theme-change`
Detail: `{ id }`.

### `codex:navigate`
Reader moved to a new chapter. Detail: `{ book, chapter }`.

### `codex:notes`
Notes/highlights changed. Detail: `{ kind, ref }`.

### `codex:open-panel`
Open a right-rail panel by id. Detail: `{ id }`. Useful to call `dispatch("codex:open-panel", { id: "strongs" })` from a verse action.

### `codex:overlays`
Reader overlay (red-letter, YHWH, verse-numbers, …) toggled. Detail: `{ which, on }`.

### `codex:plugin-registered`
A plugin successfully registered. Detail: `{ plugin }`.

### `codex:shortcut`
Hotkey fired. Detail: `{ key }`.

### `codex:strongs-open`
Inline token tapped. Detail: `{ strong }` e.g. `"H430"`.

### `codex:tourist-mode` · `codex:tourist` · `codex:tourist-select`
Tourist mode lifecycle. Details: `{ on }` / `{ stop }` / `{ ref }`.

### `codex:userpos`
User granted geolocation. Detail: `{ lat, lng }`.

### `codex:verse-select`
Verse cursor moved. Detail: `{ ref }` (`"jhn.1.1"`).

### `codex:year`
Timeline scrubbed. Detail: `{ year }`.

---

## See also

- [`SPEC.md`](./SPEC.md) — formal extension specification
- [`MODULES.md`](./MODULES.md) — module authoring guide
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — how to contribute code, modules, translations
- [`ROADMAP.md`](./ROADMAP.md) — what's next

---

## Phase 5.4 — Public Data API (v1)

Read-only JSON endpoints over the bundled `data/modules/*.json` files. All endpoints are `GET`, return `application/json`, are CORS-open (`Access-Control-Allow-Origin: *`), and are rate-limited to **100 requests / minute / IP** (`429` with `Retry-After` on exceed).

Base path: `/api/v1`

### `GET /api/v1/health-public`

Safe-for-monitoring health probe. Reveals no key, usage, or provider info.

```json
{ "ok": true, "version": "5.4.0", "modules_count": 18 }
```

### `GET /api/v1/modules`

Lists every bundled module's `meta` block.

```json
{ "count": 18, "modules": [ { "file": "strongs-hebrew.json", "id": "strongs-hebrew", "type": "lexicon", "name": "...", "version": "1.0.0" }, ... ] }
```

### `GET /api/v1/strongs/:id`

Strong's lexicon entry. `id` is `H<n>` (Hebrew) or `G<n>` (Greek). 404 if missing.

```
GET /api/v1/strongs/H1
→ { "id": "H1", "word": "אָב", "translit": "av", "gloss": "father", "def": "...", "usage": 1215 }
```

### `GET /api/v1/crossref/:ref`

TSK cross-references for a verse. `ref` uses lowercase `book.chapter.verse` (e.g. `gen.1.1`, `john.3.16`).

```
GET /api/v1/crossref/gen.1.1
→ { "ref": "gen.1.1", "crossrefs": [ { "ref": "jhn.1.1", "theme": "..." }, ... ], "source": "TSK ..." }
```

### `GET /api/v1/search?q=love&translation=kjv&limit=20`

**Stub.** Full-text server-side search is not yet implemented; CODEX currently searches client-side against cached Bible text. The response includes an explanatory `note` and `stub: true`.

```json
{ "q": "love", "translation": "kjv", "limit": 20, "results": [], "stub": true, "note": "Server-side full-text search is not yet implemented..." }
```

### `GET /api/v1/timeline?from=-2000&to=2000&category=narrative&era=patriarchs&limit=1000`

Filter the bundled timeline events. All query params optional. `from`/`to` are integer years (negative = BCE).

```json
{ "count": 12, "from": -2000, "to": 2000, "category": "narrative", "era": null, "events": [ ... ] }
```

### `GET /api/v1/parsha?week=current` · `?week=42`

Returns the parsha for the given ISO week (1..53), or the current ISO week if `week` is omitted or `current`. The 54-parsha cycle wraps modulo its length.

```json
{ "week": 20, "parsha": { "n": 20, "name": "...", "translit": "Tetzaveh", "torah": "exo.27.20-30.10", ... }, "cycle": "annual" }
```

### Rate limiting

Every `/api/v1/*` response sets `X-RateLimit-Limit` and `X-RateLimit-Remaining`. When the limit is exceeded:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 47
{ "error": "rate limit exceeded", "retryAfter": 47 }
```

### Error shape

Misses return JSON 404 with a friendly shape:

```json
{ "error": "not found", "ref": "gen.99.99" }
```
