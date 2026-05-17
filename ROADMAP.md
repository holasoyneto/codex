# CODEX — Beat Logos in Open-Source Style

## Context

CODEX is a PWA Bible study app (~28 files, zero build step) that already ships: 43 translations, AI panels (Talmud/Commentary/Gematria/Gnosis/Apologetics), Oracle chat (Claude), side-by-side comparison, verse map, highlights/bookmarks/notes, reading quests, and full offline support via service worker. It runs on a single Node server + static files.

**Goal:** Make CODEX the open-source alternative to Logos Bible Software. Logos charges $100–$5,000+ for study libraries, is Windows/Mac only, and has no community extensibility. CODEX can win by being free, open, browser-native, offline-first, extensible via plugins, and AI-native from day one.

**Competitive landscape & user feedback:**

**Logos** ($$$) — Best-in-class original-language tools, massive library.
- *What people love:* Passage Guide (one-page study summary), interlinear, exhaustive search, deep original-language tools, sermon prep workflow
- *What people hate:* **Price** ($100–$5,000+), bloated desktop app (3+ GB RAM), crashes, subscription creep for cloud features, steep learning curve ("need a PhD to use it"), Windows/Mac only, no mobile parity, closed ecosystem locks you into their format
- *Kill vector:* Open-source Passage Guide + free Strong's + AI commentary beats their $500 starter pack

**e-Sword** (free, Windows) — Beloved by pastors and self-taught scholars.
- *What people love:* Free, Strong's integration, verse-by-verse commentary, simple UI, fast search, huge module library (user-created), offline-first
- *What people hate:* **Windows-only** (no Mac, no mobile, no web), dated 2005-era UI, no updates for years, no AI/modern features, clunky module install process, no cloud sync, crashes on large searches
- *Kill vector:* CODEX is e-Sword's feature set + AI + modern UI + runs everywhere

**YouVersion / Bible App** (free, mobile) — Most downloaded Bible app (500M+ installs).
- *What people love:* **2,800+ translations**, beautiful reading experience, reading plans with social accountability, verse images for sharing, audio Bibles, offline downloads, daily verse notifications, community features (friends, shared plans), simple and approachable
- *What people hate:* **Zero study depth** — no Strong's, no concordance, no cross-references, no original languages, no commentary, search is keyword-only (no semantic), reading plans feel shallow ("devotional fluff"), social features feel forced, ads for premium features, no power-user tools at all, "a mile wide and an inch deep"
- *Kill vector:* CODEX matches their reading experience + adds all the study depth they're missing + AI. YouVersion users who outgrow it have nowhere to go except Logos ($$$) — CODEX is the bridge.

**Jewish apps** (Sefaria, etc.) — Sefaria is the closest open-source peer.
- *What people love:* Interconnected texts (Torah ↔ Talmud ↔ Midrash ↔ Rashi), Hebrew-first, community translations, open API
- *What people hate:* Web-only (no native app quality), no AI, UI is functional but not beautiful, no Protestant/Catholic/Gnostic texts, no original-language tools beyond Hebrew, search is basic, no reading plans
- *Kill vector:* CODEX adds Jewish study tools (parsha, Hebrew calendar, Talmud cross-refs) that Sefaria has — plus AI, plus Gnostic/apocryphal texts that no Jewish app touches

**CODEX advantages today:** AI-native panels, PWA (any device), offline-first, beautiful UI, zero cost. **Gaps to close:** original-language tools (Strong's, interlinear), search, cross-references, reading plans, extensibility, and native distribution.

---

## Audience — The Ultimate Good Book

CODEX is not a "Christian app" or a "Jewish app." It is the **ultimate study tool for anyone serious about these texts** — regardless of tradition, theology, or motive.

**Who should love CODEX:**

| Audience | What CODEX gives them |
|----------|----------------------|
| **Christians** (all denominations) | AI commentary, Strong's, reading plans, cross-references, 43+ translations, sermon builder |
| **Jews** (Orthodox → Reform) | Torah with parsha cycle, Hebrew calendar integration, Talmud cross-references, cantillation marks, Hebrew-first interlinear, Rashi/commentator modules |
| **Gnostics** | Nag Hammadi library, Gospel of Thomas, Pistis Sophia — already partially supported via apocryphal translations + AI Gnosis panel |
| **Rosicrucians & esotericists** | Gematria panel (already built), numerology, cross-text symbolic analysis, Enoch (already bundled) |
| **Academics & historians** | Original-language tools, translation comparison with diff, timeline, manuscript variant notes, critical apparatus |
| **Conspiracy theorists & decoders** | Gematria, number patterns, cross-reference chains, symbolic concordance, hidden pattern search |
| **Nerds of all sorts** | Terminal mode, keyboard-only navigation, plugin API, CLI, open data formats, self-hostable, hackable |

**Design principle:** Every tradition's features are first-class, not afterthoughts. A Jewish user sees parsha readings and Hebrew calendar by default. A Gnostic user can load Nag Hammadi as a primary text. An academic sees manuscript variants. The app adapts to who you are.

**North-star principle: indistinguishable from magic.** Every feature should feel impossibly thoughtful — the kind of thing where the user pauses and says "wait, how does it know that?" The recipe: chain existing data (cached verses, AI panels, GPS, calendar, plugins) into reactive experiences the user didn't ask for but immediately wants. Examples already shipping or in plan: pre-loaded Reels deck that's full by the time you open it; Help wiki auto-translates to your UI language; "Translate for normies" on dense esoterica; Tourist Mode that surfaces biblical sites within walking distance; intelligent timeline that morphs the map per year; gematria that finds every same-value verse in your library. The pattern: make the obvious thing happen before the user knows to ask.

---

## Architecture Decisions

### Plugin System
```
window.CODEX_PLUGINS = [];
CODEX_PLUGINS.push({
  id: "strongs-concordance",
  name: "Strong's Concordance",
  version: "1.0.0",
  panels: [{ id, label, render(ctx) }],     // new panel tabs
  verseActions: [{ label, icon, handler }],  // verse long-press menu items
  onNavigate(book, chapter) {},              // lifecycle hook
  onVerseSelect(ref) {},                     // tap hook
});
// App mounts registered panels as tabs alongside built-in Talmud/Commentary/etc.
// Event bus: window.dispatchEvent(new CustomEvent("codex:navigate", {detail}))
```

### Module Format (JSON)
```json
{
  "meta": { "id": "strongs-hebrew", "type": "lexicon", "version": "1.0.0", "lang": "en" },
  "entries": { "H1": { "word": "אָב", "translit": "av", "def": "father", "usage": 1215 } }
}
```
Types: `lexicon`, `concordance`, `cross-reference`, `commentary`, `reading-plan`, `timeline`, `map-overlay`

Stored in `data/modules/` (bundled) or loaded from community repos. Cached in localStorage/IndexedDB.

### Key Files to Modify

| File | Role |
|------|------|
| `app.jsx` | Main app state, plugin mount, new tweaks, search state |
| `components.jsx` | VerseRow (interlinear mode, Strong's tap targets), VerseSideRow |
| `panels.jsx` | Dynamic panel tabs from plugins + built-in |
| `panels-gen.js` | Engine routing (cloud/local), panel caching with `_engine` tag |
| `server.js` | Ollama proxy `/api/chat-local`, `/api/health` Ollama status, search index endpoint |
| `tweaks-panel.jsx` | Engine selector, new study tool toggles |
| `oracle.jsx` | Stays Claude-only; label when engine != cloud |
| `styles.css` | All new component styles (interlinear, search, reading plans, etc.) |
| `verse-menu.jsx` | Strong's lookup action, cross-ref action in verse context menu |
| `sw.js` | Cache new module files, bump version |
| New: `search.js` | Full-text search index (FlexSearch or lunr, client-side) |
| New: `strongs.jsx` | Strong's concordance panel + interlinear overlay |
| New: `crossref.jsx` | TSK cross-reference panel |
| New: `plans.jsx` | Reading plan engine + UI |
| New: `webllm.js` | Phase 4 — on-device LLM via WebLLM |
| New: `data/modules/*.json` | Bundled study modules (Strong's, TSK, etc.) |

---

## Phase 0 — Foundation (15 days)

### 0.0 Help Wiki (DONE 2026-05-17, out-of-plan addition)
- **`help.jsx`** + **`data/help/articles.json`** + `.cx-help-*` styles + new "Help" tab in `tweaks-panel.jsx`. JSON-driven articles, predictive client-side fuzzy search, Ask-Oracle path through `/api/chat` with the corpus stuffed into the user turn, inline markdown renderer. Registered in `index.html` + `sw.js` (v156). Update articles each release.

### 0.1 Plugin System (~3 days)
- **`app.jsx`**: Add `window.CODEX_PLUGINS` array. On boot, iterate registered plugins: mount their panels into the tab bar, register verse actions into the verse menu, bind lifecycle hooks to navigation events.
- **`panels.jsx`**: Refactor tab rendering to merge built-in panels (Talmud, Commentary, etc.) with plugin-registered panels. Each plugin panel gets a `render(ctx)` call with `{ book, chapter, verse, translation }`.
- **`verse-menu.jsx`**: Extend the verse long-press/right-click menu to include plugin-registered `verseActions`.
- Event bus: `codex:navigate`, `codex:verse-select`, `codex:panel-open` custom events on `window`.

### 0.2 Module Loader (~2 days)
- **New `modules.js`**: `loadModule(id)` — checks localStorage/IndexedDB cache, falls back to `data/modules/{id}.json` or remote URL. Returns parsed JSON. `listModules()` returns installed module metadata.
- JSON schema validation for module `meta` field (type, version, lang).
- Lazy-load: modules only fetched when the plugin/panel that needs them is first opened.

### 0.3 CLI / Terminal Mode (~3 days)
- **New `cli.js`**: Node script — `node cli.js "John 3:16" --translation KJV --panels commentary,talmud`
- Reuses `panels-gen.js` and `bible.js` fetch logic (already isomorphic — they use `fetch()`).
- Output: colored terminal text (chalk) — verse text, panel JSON pretty-printed.
- `--oracle "question"` flag for single-turn Oracle queries.
- `--search "term"` for offline full-text search.

### 0.4 Lite Mode (~2 days)
- **`app.jsx`**: New tweak `liteMode: false`. When true: hide AI panels entirely, hide Oracle, hide verse art, hide map. Just scripture + highlights + bookmarks + notes.
- Useful for low-bandwidth, low-power, distraction-free reading.
- URL param `?lite=1` to force lite mode without touching settings.
- Reduces JS parse/eval to ~40% of full app.

### 0.5 Micro-Screen Support (~2 days)
- **`styles.css`**: New `@media (max-width: 320px)` and `(max-width: 280px)` breakpoints.
- Collapse side rails entirely on <320px. Stack nav vertically.
- Font floor: `clamp(12px, 3.5vw, 16px)` for verse text.
- Touch targets remain 44px (HIG) — use full-width tap rows instead of inline buttons.
- Test: iPhone SE (320px), Galaxy Fold inner (280px).

### 0.6 Full Keyboard Navigation (~3 days)
- **`app.jsx`**: Global keydown handler. Every feature accessible without a mouse.
- **Keybindings:**
  - `J` / `K` — next/prev verse (scroll + highlight)
  - `H` / `L` — prev/next chapter
  - `Cmd+K` / `Ctrl+K` — search
  - `1`–`9` — switch to panel tab 1–9
  - `O` — open Oracle chat
  - `B` — toggle bookmarks rail
  - `N` — toggle notes
  - `M` — toggle verse map
  - `T` — open translation picker
  - `S` — toggle side-by-side
  - `F` — toggle theater/fullscreen
  - `?` — show keyboard shortcut overlay
  - `Esc` — close any open popover/modal/search
  - `Enter` on selected verse — open verse menu
  - `Tab` / `Shift+Tab` — navigate between focusable elements (standard, but ensure all custom controls are in tab order)
- **`styles.css`**: `:focus-visible` ring on all interactive elements (2px accent outline). Hidden on mouse click (`:focus:not(:focus-visible)` resets).
- **`tweaks-panel.jsx`**: "Keyboard shortcuts" help panel accessible via `?` key.
- **Vim-mode** (optional tweak): `j/k/h/l/gg/G/:/` for the truly committed.

### 0.7 Responsive Polish (~3 days)
- Audit all components at 280px, 320px, 375px, 768px, 1024px, 1440px, 2560px.
- Fix any remaining scrollbar, overflow, z-index, or touch-target issues found.
- Ensure theater mode scales properly at all breakpoints (already started — max-width for side-by-side lifted to `min(1600px, 95vw)`).

---

## Phase 1 — Scholar Tools (24 days)

### 1.1 Strong's Concordance (~7 days)
- **New `data/modules/strongs-hebrew.json`** + **`strongs-greek.json`**: Full Strong's lexicon (~8,800 Hebrew + ~5,600 Greek entries). Source: public domain datasets (OpenScriptures, morphhb).
- **New `strongs.jsx`**: Panel component. On verse select, looks up each word's Strong's number, displays: original word, transliteration, gloss, full definition, occurrences count, "see also" links.
- **`components.jsx` — VerseRow interlinear mode**: When `tweaks.interlinear` is on, render each English word with its Hebrew/Greek original + Strong's number below in small text. Tap a word to open the Strong's panel entry. Requires a word-level alignment map (bundled as `data/modules/alignment-kjv.json` for KJV; other translations show Strong's panel without inline interlinear).
- **`verse-menu.jsx`**: Add "Strong's Lookup" action — opens the Strong's panel filtered to that verse.
- **`tweaks-panel.jsx`**: Toggle for interlinear display (off by default).

### 1.2 Full-Text Search (~5 days)
- **New `search.js`**: Client-side search engine. Build index from cached Bible text (all downloaded translations). Use FlexSearch (tiny, fast, MIT) loaded from CDN.
- Index structure: `{ ref: "gen.1.1", text: "In the beginning...", translation: "KJV" }`. Built lazily on first search, persisted to IndexedDB.
- **`app.jsx`**: Search state — query, results, active. Toggle search bar with `Cmd+K` / `Ctrl+K` or magnifying glass icon.
- **UI**: Slide-down search bar with instant results. Show verse ref + snippet with highlighted matches. Click result navigates to that chapter/verse.
- Supports phrase search (`"in the beginning"`), wildcard (`lov*`), and translation filter (`@ESV love`).
- **Offline-first**: Index built from locally cached verses. No server needed.

### 1.3 Cross-References (TSK) (~5 days)
- **New `data/modules/tsk.json`**: Treasury of Scripture Knowledge — ~340,000 cross-references, public domain. Compressed ~4 MB.
- **New `crossref.jsx`**: Panel component. For selected verse, shows all TSK cross-references grouped by theme. Each ref is a clickable link that navigates to that passage.
- **`verse-menu.jsx`**: Add "Cross-References" action.
- Chain navigation: clicking a cross-ref loads that verse's cross-refs too — enables "follow the thread" study.

### 1.4 Word Study (~4 days)
- **New `wordstudy.jsx`**: Deep-dive on a single word. Shows: every occurrence in current translation (concordance search), frequency by book (bar chart via CSS), original language root (from Strong's), semantic range, related words.
- Accessed from: Strong's panel "Study this word" button, or verse-menu "Word Study" action.
- **`search.js`**: Add `concordance(strongsNumber)` — returns all verses containing that Strong's number (requires alignment data).

### 1.5 Jewish Study Tools (~5 days)
- **Torah parsha cycle**: `data/modules/parsha.json` — all 54 weekly Torah portions with start/end refs, haftarah readings, and maftir. When reading Torah books, show "Parashat Vayikra" label in nav bar with this week's portion highlighted.
- **Hebrew calendar integration**: Show Hebrew date alongside Gregorian. Highlight Shabbat readings, holidays (Pesach, Sukkot, Shavuot, etc.) with their special readings.
- **Cantillation marks (ta'amim)**: When reading Hebrew text, option to show/hide cantillation marks. Bundled as `data/modules/cantillation.json` mapped to Hebrew verse text.
- **Rashi script toggle**: For Hebrew text, option to display in Rashi script font (for users accustomed to traditional Talmud layout).
- **Talmudic cross-references**: `data/modules/talmud-refs.json` — map Torah verses to Talmud discussions. Panel shows: "Discussed in Berakhot 12b, Sanhedrin 56a" with links (initially to Sefaria API, later to bundled text).
- **Gematria enhancements**: The existing Gematria panel already computes numerical values. Extend with: multiple gematria methods (standard, ordinal, reduced, Atbash), cross-verse number matches, and "words with same value" lookup table.
- **Jewish reading plans**: Bundled plans for Daf Yomi (7.5-year Talmud cycle), Torah triennial cycle, Tehillim (Psalms) monthly cycle.
- **`tweaks-panel.jsx`**: "Jewish Study" toggle group — parsha labels, Hebrew calendar, cantillation, Rashi script.

### 1.6 Scripture Comparison Upgrades (~3 days)
- **`verse-compare.jsx`**: Enhance existing side-by-side view. Add: word-level diff highlighting between translations (green = added, red = removed, yellow = changed). Uses simple LCS diff algorithm.
- **Synoptic Gospels mode**: Side-by-side parallel passages (Matt/Mark/Luke) with color-coded shared/unique material. Bundled as `data/modules/synoptic-parallels.json`.

---

## Phase 2 — Disciple Tools (20 days)

### 2.1 Reading Plans (~6 days)
- **New `plans.jsx`**: Reading plan engine. Plan format (JSON module):
  ```json
  { "meta": { "id": "chronological-1y", "type": "reading-plan", "days": 365 },
    "days": [{ "day": 1, "readings": ["gen.1-2", "ps.1"] }] }
  ```
- Bundled plans: Chronological (1 year), Canonical (1 year), Gospels (90 days), Psalms & Proverbs (30 days), Whole Bible (90 days).
- UI: Plan selector, today's reading with checkmarks, streak counter, calendar heat-map of completion, catch-up mode (doubles up missed days).
- Progress persisted to `localStorage` → `codex.plans.v1.{planId}`.
- Notifications: optional daily reminder via `Notification` API (PWA).

### 2.2 Timeline (~4 days)
- **New `timeline.jsx`**: Visual timeline of biblical events. Horizontal scrollable SVG/CSS timeline.
- Data: `data/modules/timeline.json` — ~500 events with date ranges, scripture refs, descriptions.
- Click an event → navigate to the passage. Zoom levels: epoch (Creation→Revelation), era (Patriarchs, Judges, Kingdom, etc.), detail (individual events).
- Current chapter's events highlighted on the timeline.

### 2.3 Passage Guide (~4 days)
- **New `passage-guide.jsx`**: One-page study summary for current chapter. Aggregates: outline, key themes, cross-references (top 10 from TSK), word studies (top 5 significant words), historical context, geography (link to verse-map), and AI commentary panel.
- This is the "Logos Passage Guide killer" — their most-loved feature, recreated with open data + AI.
- Assembled from existing modules + one AI call for the synthesis paragraph.

### 2.4 Bible Dictionary (~3 days)
- **New `data/modules/easton.json`**: Easton's Bible Dictionary (~4,000 entries, public domain).
- **New `dictionary.jsx`**: Search + browse. Entries linked from Strong's panel, passage guide, and verse menu.
- Auto-detect proper nouns in current chapter → show dictionary entries in sidebar.

### 2.5 Sermon / Study Builder (~3 days)
- **New `builder.jsx`**: Collect verses, notes, panel excerpts, and cross-references into a structured outline.
- Drag-and-drop reordering. Export to Markdown, PDF (via `print()`), or clipboard.
- "Add to Study" button in verse menu + panels.
- Saved studies persisted to localStorage, exportable as `.codex-study` JSON files.

### 2.6 Reels — Endless Scriptural Scroll (~5 days)

A TikTok-style **vertical card feed** for scripture. Each "reel" is a full-bleed card with one image + a short evocative text. Users swipe (mobile) or arrow/scroll (desktop) through curated and AI-generated content while waiting in line, sitting on the train, or in any 30-second window. **Always something new to discover** — no algorithm doom-loop, just well-crafted moments from the canon.

**Audit of current art panel** (`verse-art.jsx`):
- Already curates 6-8 paintings/frescoes/manuscripts per verse with Wikimedia Commons thumbnails
- Solid base — caches per verse, has `+ MORE` pagination, tolerant JSON parser for partial responses
- Limitation: it's grid-of-thumbnails inside a panel. Beautiful but static. The Reels feature *reuses* this data in a far more engaging vertical-scroll experience.

**Reel card types** (the variety is the point — keep the user surprised):

1. **Art-Verse** — single Wikimedia painting as hero background + the depicted verse overlay. (Reuses verse-art cache.)
2. **Verse-of-the-now** — a thematically relevant verse for the current time/season/Hebrew calendar date, with rendered typography.
3. **Original-language gem** — one Hebrew/Greek word from the verse, big and beautiful, with transliteration + meaning + Strong's number.
4. **Gematria moment** — a verse + its gematria value + what it equals symbolically ("358 — Mashiach").
5. **Cross-ref echo** — two parallel verses side-by-side, one OT one NT, with the thematic thread named.
6. **Talmudic gloss** — a 2-sentence rabbinic comment on the verse, attributed.
7. **Patristic gloss** — a 2-sentence church-father comment, attributed.
8. **Gnostic shadow** — a Nag Hammadi parallel surfaced quietly, with a "plain version" toggle.
9. **Symbol card** — Tree of Life / Lamb / Lion of Judah / Bread / Living Water — image + symbolic meaning + scriptural anchor.
10. **Name of God** — one of the 70+ Hebrew names (El Shaddai, YHWH-Yireh, El Elyon, etc.), with meaning + a verse using it.
11. **Saint or prophet of the day** — Orthodox/Catholic/Hebrew calendar-driven figure, with brief life + relevant verse.
12. **Parable in 3 sentences** — a parable retold tersely, with art.
13. **Did-you-know** — surprising biblical/historical fact ("the New Testament quotes Psalms more than any other book").
14. **Prophecy → fulfillment** — OT prophecy card + NT fulfillment card paired.
15. **Quest tease** — "Read Mark 8:29 — try to spot the turning point." 1-tap to open chapter.
16. **Counting card** — "153 fish in John 21 — 17th triangular number — 1+2+...+17 = 153." Pure math + symbol.
17. **Map moment** — a geographical card: "Capernaum: Jesus' base of operations · 16 events here." Static map snippet.
18. **Apocrypha curiosity** — a saying from Thomas / Enoch / Sirach with art.
19. **Question card** — "What was Lazarus' sister's name? (tap to reveal)" — gentle gamification.
20. **Light moment** — a calligraphic verse on a single-color backdrop. Pure beauty, no other UI.

**Pre-load cache strategy** (the key to "always-fresh" without latency):
- When user reads chapter X, background-fetch reel content for: (a) verses in the *current* chapter, (b) next chapter, (c) prev chapter. Reuse what already exists — verse-art cache, panel cache, gematria computations.
- Curated cards (`data/modules/reels-curated.json`) ship pre-built: symbol cards, names of God, did-you-knows, prophecy pairings, quest teases. ~200-300 hand-authored cards, no AI cost.
- A round-robin scheduler interleaves card types so the user never sees 5 commentary cards in a row.
- Cache: `codex.reels.deck.v1` keeps the next 30 cards in localStorage. As user scrolls past one, a new one is generated/fetched and queued at the end.
- Generation budget: at most 1 AI call per ~10 scrolled cards (rate-limit so we don't burn API). Curated + cached cards fill the gaps.
- IndexedDB stores ever-served cards keyed by `{type, refOrId, lang}` so reels never repeat in a session — but can re-surface days later.

**UI shape:**
- New right-rail tab: **REELS** with a "stack" glyph.
- Click → fullscreen mode (similar to `is-theater`) with a single card centered.
- Vertical swipe / arrow keys / scroll wheel / space-bar → next card.
- Each card has bottom-bar action chips:
  - ♡ Save (adds to bookmarks + notes)
  - 📖 Open passage (jumps to the chapter the card points to)
  - 🪶 Plain version (when applicable — reuses `NormieToggle`)
  - ✦ Generate more like this (asks for similar cards on the same theme)
  - ⤴ Share (copy formatted reference + text)
- Progress dots up the right edge (subtle).
- Top-left: card type badge ("⚯ GEMATRIA · Gen 1:1") in monospace caps.
- Auto-advance toggle (off by default; some users want the feed to slowly auto-progress at ~8s/card).
- Settings: pick which card types to include / exclude.

**Files:**
- New `reels.jsx` — the panel + fullscreen viewer, generation orchestrator, card renderer per type. Registers as a CODEX plugin (`window.CODEX_PLUGINS_API.register`).
- New `data/modules/reels-curated.json` — hand-authored curated deck.
- New `reels-cache.js` — small worker-like background loader. Hooks into `codex:navigate` (already dispatched by app.jsx via the plugin system) to preload cards for the current/adjacent chapters.
- `styles.css` — new `.cx-reel-*` block: full-bleed card layout, smooth scroll-snap on a vertical container, hero image gradients, typography for the various card types.
- `data/help/articles.json` — new "reels" article.

**Why this works:**
- Reuses every existing system (verse-art, panels, gematria, normie translation, cross-refs, plugin system) — no new generation pipeline needed for most types.
- Curated deck means zero-network experience is still beautiful and varied.
- Pre-cache while reading means by the time the user opens Reels, there are already 20+ cards ready.
- TikTok-shaped interaction is universally understood; users get it instantly.
- The 20 card types are wildly different from each other, so the feed never gets stale — unlike a single-source feed (e.g. just verse art) which gets repetitive.

### 2.7 Map Magic — Tourist Mode & AI Timeline (~7 days)

The verse-map already plots biblical POIs and timeline of empires. Overhaul it into something **indistinguishable from magic** — pokémon-go-meets-bible-history.

**Tourist Mode** — GPS-aware, in-the-moment:
- Request `navigator.geolocation`. Pin user on the map. AI fetches "biblical/sacred sites within 50 km of you, ranked by significance" with: distance, era, scripture refs, what to see, best time of day, walking-route hint, "if you only have an hour" top 3, and a "deeper rabbit hole" for a less-visited but historically rich site.
- Cached per coarse `{lat, lng}` for 24h.
- Works in Jerusalem, Rome, Athens, Istanbul, Alexandria, anywhere with biblical/early-church history. Falls back gracefully where no sites exist nearby ("nothing biblical within 50km — here's the closest manuscript discovery instead").

**Pokemon-GO Discoveries**:
- All known biblical sites globally as faint dots on the map. Within 1 km of user → pulse softly as "DISCOVERABLE". Tap → AI generates a narrative card ("You're standing where Paul addressed the Areopagus, Acts 17:22-31 happened on this rocky outcrop in ~50 CE").
- Discovered sites saved to `localStorage.codex.discovered` — a personal pilgrimage log with date stamps.
- Counter in corner: "🏛 7 sites discovered".
- Achievement-style milestones at 10/25/50/100.

**AI-Intelligent Timeline Slider**:
- Drag the year slider — the map *morphs* to the political situation of that year (empire borders refresh, irrelevant POIs fade, contemporary POIs glow).
- A "what was happening here?" badge floats next to the slider with live AI-generated context (debounced 300ms). Example dragging to 587 BC over Jerusalem: "Babylonian siege under Nebuchadnezzar · Temple destroyed · Lamentations being composed."
- Cached per `{location_centroid, year_decade}`.

**Fix the blurry slider labels** — dynamic decimation via ResizeObserver. Major labels at -2000/-1000/0/1000/2000 ("2K BC / 1K BC / 0 / 1K / 2K"); minor ticks every 250 years; polity boundaries as accent tick marks.

**Layered overlays** (toggle group):
- ✦ Biblical events (default)
- ◯ Pilgrimage routes (Via Dolorosa, Camino, etc.)
- ⬡ Manuscript discoveries (Dead Sea Scrolls site, Nag Hammadi, Sinai)
- ☰ Empire borders at current slider year
- ⚐ My discoveries (personal pilgrimage pins)

**Voice tour mode**: Web Speech API narrates the AI summary aloud in user's UI language. Native, no API cost.

**Files**: `verse-map.jsx` (extend), styles.css (append), `data/help/articles.json` (tourist-mode + map-magic articles).

### 2.8 Gematria Intelligence (~4 days)

Make the existing Gematria panel **AI-intelligent cross-referencing**. User said: "make gematria ai intelligent cross referencing."

**New `gematria.js` library** — pure compute, no React, ~250 lines:
- **Hebrew systems**: hechrachi (absolute), sidduri (ordinal), katan (reduced), katan mispari (integral reduced), boneh (triangular), atbash, albam, ne'elam (hidden), ha-akhor (back)
- **Greek**: isopsephy standard + ordinal
- **English**: ordinal, reduction, reverse
- Exposed as `window.CODEX_GEMATRIA.{hebrew, greek, english, all}`

**Library-wide cross-reference index** — on Gematria panel mount, scan every cached verse in the user's library, build `{ value: [{ref, text, system}] }`. Persisted to localStorage, rebuilt incrementally as new chapters are cached. The result: "this verse sums to 358 (Mashiach) — appears in 47 other verses in your library, including Genesis 49:10..." surfaced instantly.

**Upgraded panel schema** (`_schema: 2` in panels-gen.js prompt):
- `primary_word` — the most significant word in the verse
- `values` — all systems computed
- `symbolic_meaning` — what these numbers traditionally mean
- `cross_matches` — both from AI training and from the user's actual library
- `notarikon` (acronyms) + `temurah` (letter permutations) where rabbinic sources apply
- `rabbinic_sources` — Baal HaTurim, Akiva, etc. with quotes
- `ai_insight` — synthesis paragraph
- **Cross-language values**: if verse exists in Hebrew + Greek + English in library, show all three values side by side

**Renderer**: collapsible sections, click cross-match row → navigate. "From canon" tab (AI's knowledge) + "From your library" tab (computed locally).

### 2.9 Panel Depth Expansion (~6 days)
The existing AI panels (Talmud · Commentary · Gematria · Gnosis) are good starters but shallow vs. what serious students ask online. Deepen each with structured sub-sections and source citations.

**Talmud panel — expand from "one quote" to full sugya context:**
- Sub-sections: *Mishnah cited*, *Gemara discussion*, *Rashi's gloss*, *Tosafot dispute*, *Mishneh Torah / Shulchan Aruch ruling*, *Modern halakhic application*.
- For each, AI returns text + tractate.daf citation (e.g. `Berakhot 5a`).
- Render each section as a collapsible card with the citation as a header. Click citation → open the source text panel (initially via Sefaria API link, later bundled).
- Add aggadic vs halachic toggle — emphasize one or the other.
- Cross-reference current verse to all relevant Talmudic discussions, not just one.

**Commentary panel — expand from single voice to multi-tradition chorus:**
- Sub-sections per commentator school: *Patristic* (Chrysostom/Augustine/Origen), *Medieval* (Aquinas/Bonaventure/Calvin/Luther — depending on tradition), *Reformed*, *Catholic*, *Eastern Orthodox*, *Critical/Historical*, *Modern Evangelical*, *Liberation Theology*, *Feminist*, *Black-Church*, *Messianic Jewish*.
- AI returns a short paragraph per voice, with the commentator's name and approximate era.
- Toggle which schools to show (saved per user).
- Include the *consensus* and the *dispute* — where do traditions agree, where do they fight.
- "Compare commentators" mode: pick 2, show side-by-side reasoning.

**Gematria panel — expand from single value to multi-system numerology hub:**
- All major gematria methods computed and displayed:
  - *Mispar Hechrachi* (standard / absolute)
  - *Mispar Sidduri* (ordinal)
  - *Mispar Katan* (reduced — single digit)
  - *Mispar Katan Mispari* (integral reduced)
  - *Mispar Boneh* (building / triangular)
  - *AtBash* (substitution cipher reversal)
  - *Albam*
  - *Mispar Ne'elam* (hidden — spelled-out letter names minus the letter)
  - *Mispar HaPanim* (faces)
  - *Greek isopsephy* (for NT verses) — both Christian and Hellenistic methods
  - *English ordinal* / *Reverse* / *Reduction* — for English-text esoteric study
- *Cross-matches*: "this verse sums to 358 (mashiach), same as: [list of other verses with same sum]".
- *Pattern detection*: significant numbers highlighted (7, 12, 40, 70, 144, 153, 318, 358, 666, 888, 1000).
- *Word-of-the-day*: pick a Hebrew/Greek word in the verse, show its gematria across all systems + symbolic associations.
- *Notarikon* (acronyms) + *Temurah* (letter permutations) — surfaced where rabbinic sources use them on this verse.
- AI explanation paragraph: "Why does this number matter?" — historical + traditional interpretations from people like the Baal HaTurim, Rabbi Akiva, Pythagoreans (for Greek).
- This is what people search online: "gematria of love in hebrew", "777 meaning bible", "Jesus gematria 888" — surface those answers structurally.

**Gnosis panel — expand from one quote to full Gnostic intertextual map:**
- Sub-sections: *Nag Hammadi parallels* (Gospel of Thomas, Gospel of Philip, Gospel of Truth, Apocryphon of John, etc.), *Sethian texts*, *Valentinian commentary*, *Hermetic Corpus*, *Pistis Sophia*, *Manichean echoes*, *Mandaean parallels*.
- Each citation includes the source codex + section (e.g. `NHC II,2 — Thomas saying 22`).
- *Hidden/esoteric meaning* sub-section: what the Gnostic tradition reads behind the literal text — demiurge, archons, pleroma, aeons, sophia, divine spark.
- *Comparison with proto-orthodox reading*: how the church fathers (Irenaeus, Hippolytus) refuted this passage's Gnostic reading.
- *Modern esoteric readings*: Theosophical, Jungian (Answer to Job), Steinerian, Rosicrucian, Kabbalistic Christian.
- AI returns curated quotes (~50-100 words each), with source.
- This serves both serious students of Gnosticism AND curious people who searched "what does the gospel of thomas say about ___".

**Implementation:**
- `panels-gen.js`: extend prompts to request structured JSON with the sub-sections per panel type. Schema versioned (`_schema: 2`) — old cached panels fall back to legacy renderer.
- `panels.jsx`: each panel renders as collapsible sub-section cards instead of one wall of text.
- Cache impact: each panel response ~2-4× larger. Worth it. Still well under 4 KB per panel.
- Citation links open a new "Source" panel for that text (Sefaria for Talmud, Nag Hammadi Library website for Gnosis until we bundle them).
- All sub-section labels translatable via i18n.
- Article in Help Wiki updated to explain the new structure.

---

## Phase 3 — Ecclesia / Community (16 days)

### 3.1 Module Marketplace (~6 days)
- **Module spec** published as `MODULES.md` — open format anyone can author.
- **Community repo index**: `data/module-index.json` — curated list of community modules with URL, checksum, description, rating.
- **`repo-add.jsx`** (existing): Extend to support module repos alongside translation repos. Browse → preview → install flow.
- One-click install: downloads JSON module to IndexedDB, registers with plugin system.
- Categories: Lexicons, Commentaries, Devotionals, Reading Plans, Maps, Timelines, Language Packs.

### 3.2 Shared Study Guides (~4 days)
- Export a study (from builder) as a shareable `.codex-study` JSON file or URL (base64-encoded in hash).
- Import via drag-drop or paste URL.
- **Future**: GitHub-backed sharing — push study to a gist, share link opens it in CODEX.

### 3.3 Open Specification (~3 days)
- Write `SPEC.md`: formal spec for the CODEX module format, plugin API, event bus, and theme system.
- `CONTRIBUTING.md`: how to create a plugin, build a module, submit to the index.
- `API.md`: document all `window.CODEX_*` globals and events.

### 3.4 i18n / Localization (~3 days)
- **`i18n.js`** (existing): Extend translation coverage. Currently supports UI strings — ensure all new features (search, plans, dictionary, etc.) use `t()` for all user-facing text.
- Community-contributed language packs as modules.
- RTL support for Arabic, Hebrew UI (already partially handled for Hebrew scripture text).

---

## Phase 4 — Oracle Ascendant / AI (18 days)

### 4.1 Ollama Local LLM (~4 days)
- **`server.js`**: Add `postOllama()` mirroring `postAnthropic()`, hitting `localhost:11434/v1/chat/completions`. Add `/api/chat-local` route. Startup probe for Ollama availability. Extend `/api/health` with `{ ollama: { ok, models[] } }`.
- **`panels-gen.js`**: Accept `engine` param. Route to `/api/chat-local` (Ollama) or `/api/chat` (Claude). Tag cached panels with `_engine`. Add `refine()` — send local draft to Claude for quality upgrade.
- **`app.jsx`**: Add `engine: "auto"` to `TWEAK_DEFAULTS`. Auto cascade: Cloud → LAN → Device.
- **`tweaks-panel.jsx`**: Engine selector (Auto / Cloud / Local LAN / On-device). Disabled options grey out with reason.
- **`panels.jsx`**: Engine badge in pane header. "Refine via Claude" button on non-cloud panels.
- Recommended model: `qwen2.5:14b-instruct-q4_K_M` (Apple Silicon).

### 4.2 AI Exegesis Panel (~4 days)
- **New panel type in `panels-gen.js`**: "Exegesis" — deeper than Commentary. Prompt instructs: original language analysis, historical-critical context, literary structure, theological implications, application.
- ~800-token output vs Commentary's ~300. Cached separately.
- Toggle between "Quick Commentary" and "Deep Exegesis" in panel header.

### 4.3 AI Translation Analysis (~3 days)
- **New panel type**: "Translation Analysis" — compare how 3–5 translations render the current passage, explain the differences, identify where translation philosophy (formal vs dynamic) drives divergence.
- Uses the already-loaded comparison translations from `codex.compareSet`.

### 4.4 Semantic Search (~4 days)
- "Find passages about forgiveness" → AI-powered conceptual search, not just keyword.
- Client sends query to Oracle endpoint. Response: list of relevant passages with relevance scores and brief explanations.
- Results integrate with the existing search UI (tab: "Text Search" | "Concept Search").
- Cacheable: store query→results in localStorage for offline re-access.

### 4.5 Schizo Mode (Easter Egg) (~2 days)
- **Trigger**: Only visible in Settings when the user is currently reading **Revelation 13:18** ("Here is wisdom. Let him that hath understanding count the number of the beast..."). The toggle appears at the bottom of the tweaks panel with a faint glitch animation — easy to miss unless you're looking.
- **`app.jsx`**: Check `book === "rev" && chapter === 13` and verse 18 is in viewport → set `schizo_eligible: true` in state. `tweaks-panel.jsx` shows the toggle only when eligible.
- **What it does** (when enabled, persists in `codex.tweaks.v1.schizo`):
  - **Number overlay**: Every verse shows its gematria total faintly in the margin. Verses whose gematria matches significant numbers (7, 12, 40, 144, 153, 666, 888, 1776) pulse with a subtle glow.
  - **Pattern threads**: AI panel gains a "Patterns" tab — surfaces numerological connections between current verse and other passages with matching gematria values, shared word roots, or symbolic motifs (water, fire, serpent, etc.).
  - **Cross-text echoes**: When reading any verse, show faint "echo" annotations from Enoch, Nag Hammadi, Dead Sea Scrolls, and Hermetica where thematic parallels exist. Data from `data/modules/echoes.json`.
  - **Cipher mode**: Search bar gains a `=` prefix for gematria search — type `=666` to find all verses summing to 666 in any loaded translation.
  - **Visual tone**: Slight matrix-green tint on dark mode. Verse numbers render in a monospace cipher font. Panel headers get a faint scanline effect.
  - **Not a joke**: The features are real, useful study tools for anyone interested in numerological and intertextual analysis. The hidden trigger is just a nod to the content — "let him that hath understanding."

### 4.6 AI Study Quests (~3 days)
- Extend existing quest system (`quest-messiah.jsx` pattern).
- AI-generated quests: "Trace the theme of covenant through Genesis" — Oracle generates a sequence of passages + questions. User progresses through, answers questions, gets AI feedback.
- Community can share quests as modules.

---

## Phase 5 — Omnipresent / Distribution (16 days)

### 5.1 Capacitor Native Apps (~6 days)
- Wrap CODEX in Capacitor for iOS App Store + Google Play.
- Native features: push notifications for reading plans, share sheet integration, Siri Shortcuts ("Read today's passage").
- Offline: full app + cached translations bundle in the app binary.

### 5.2 Browser Extension (~4 days)
- Chrome/Firefox/Safari extension. Highlight any text on the web → right-click "Look up in CODEX" → popup with verse, cross-refs, Strong's.
- Verse-of-the-day in new tab page (optional).

### 5.3 Embeddable Widget (~3 days)
- `<script src="codex.js"></script><codex-reader book="john" chapter="3" verse="16"></codex-reader>`
- Web component. Churches embed on their websites. Supports theming via CSS custom properties.

### 5.4 Data API (~3 days)
- Public REST API for CODEX module data: `/api/v1/strongs/H1`, `/api/v1/crossref/gen.1.1`, `/api/v1/search?q=love`.
- Powers the browser extension, third-party apps, and CLI mode.

### 5.5 Linux Desktop App (~5 days) — **Final Phase Priority**
- **Linux first** (then macOS, then Windows). Linux users are the natural early audience: open-source-friendly, value privacy, often run local LLMs.
- **Tauri** (not Electron) — Rust-based, ~3 MB binary vs Electron's 150 MB, uses native webview, faster startup, lower memory.
- **Distribution:** AppImage (universal), Flatpak (Flathub), `.deb` (Debian/Ubuntu), `.rpm` (Fedora), AUR package (Arch).
- **Auto-updates:** Built-in Tauri updater. Checks `releases.codex.app/latest.json` on startup. Background download, prompt user to restart for install. Signed with GPG.
- **Native features beyond web:**
  - System tray icon with quick "Verse of the day" access
  - Global hotkey (e.g. `Ctrl+Alt+B`) to invoke from anywhere
  - Native file dialogs for module import/study export
  - File associations: `.codex-study`, `.codex-module` files open in CODEX
  - Native notifications for reading plan reminders (no permission prompts)
  - Embeds Ollama detection + one-click "Install Ollama" via system package manager
- **Local server bundled:** No need for separate `node server.js` — Tauri sidecar process. User just launches the app.
- **Files**: `src-tauri/` Rust project (~200 lines: window setup, updater config, tray, hotkey, sidecar). Web app is just the existing CODEX bundle.

---

## Competitive Kill Chart

| Feature | Logos ($$$) | e-Sword | YouVersion | Sefaria | CODEX (free, open) |
|---------|:-----------:|:-------:|:----------:|:-------:|:------------------:|
| Price | $100–$5,000 | Free | Free | Free | **Free** |
| Open source | No | No | No | Yes | **Yes** |
| Browser/PWA | No | No | Yes | Web | **Yes (offline PWA)** |
| AI commentary | No | No | No | No | **Yes (5+ panels)** |
| AI chat | No | No | No | No | **Yes (Oracle)** |
| Local LLM / air-gap | No | No | No | No | **Yes (Ollama)** |
| Strong's concordance | $$$ | Yes | No | Partial | **Yes** |
| Interlinear | $$$ | Partial | No | No | **Yes** |
| Cross-references (TSK) | Yes | Yes | No | Talmudic | **Yes + Talmudic** |
| Full-text + semantic search | Yes | Yes | Basic | Basic | **Yes + AI semantic** |
| Reading plans | Basic | No | **Best** | No | **Yes (all traditions)** |
| Torah parsha / Hebrew calendar | No | No | No | **Yes** | **Yes** |
| Gematria / numerology | No | No | No | Partial | **Yes (built-in + schizo mode)** |
| Gnostic / apocryphal texts | No | No | No | No | **Yes (Enoch, Nag Hammadi)** |
| Plugin/module system | Paid | No | No | API | **Yes, open** |
| Keyboard-only navigation | Partial | No | No | Partial | **Yes (full + vim mode)** |
| Terminal/CLI | No | No | No | No | **Yes** |
| Mobile native | $$$ | No | **Yes** | No | **Capacitor** |
| Translations | 100+ (paid) | 20+ | **2,800+** | 30+ | **43 + community repos** |

---

## Verification

### Phase 0
- Plugin system: register a dummy plugin with a panel + verse action. Confirm it appears in the UI.
- CLI: `node cli.js "John 3:16" --translation KJV` prints formatted verse + panels.
- Lite mode: `?lite=1` → only scripture, highlights, notes visible. No AI panels or Oracle.
- Keyboard: navigate entire app using only keyboard. `J/K` scrolls verses, `H/L` changes chapters, `?` shows shortcuts, `Cmd+K` opens search. All controls reachable via Tab.
- Micro-screen: Resize to 280px wide → all content readable, all touch targets >= 44px.

### Phase 1
- Strong's: tap any word in KJV interlinear mode → Strong's panel shows definition, transliteration, occurrence count.
- Search: `Cmd+K`, type "love" → instant results across all cached translations.
- Cross-refs: select John 3:16 → TSK panel shows 15+ cross-references, each clickable.

### Phase 2
- Reading plan: start "Chronological 1 Year" → today's readings shown, check off → streak counter increments.
- Passage guide: open Genesis 1 → unified summary page with outline, themes, cross-refs, word studies.

### Phase 3
- Module install: browse module index → install "Easton's Dictionary" → appears in panels.
- Export/import: create a study, export as `.codex-study`, import on another browser → identical.

### Phase 4
- Ollama: `ollama serve` + CODEX restart → Settings shows "Local LAN" available → panels generate offline.
- Semantic search: "passages about forgiveness" → returns relevant results beyond keyword matches.
- Schizo mode: Navigate to Revelation 13:18. Scroll verse 18 into view. Open Settings → "Schizo Mode" toggle is now visible at bottom. Enable it. Return to reading — gematria numbers appear in margins, matching numbers glow. Search `=666` returns matching verses. Switch to a different book — the Settings toggle disappears (but mode stays active if already enabled).

### Phase 5
- Capacitor: `npx cap run ios` → app launches in simulator with all features working.
- Widget: `<codex-reader>` renders John 3:16 on a test HTML page.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Strong's alignment data quality | Start with KJV (best-mapped), expand to ESV/NASB. Interlinear is KJV-only initially; other translations get panel-only Strong's |
| FlexSearch bundle size (~15 KB gzipped) | Lazy-load only on first search invocation. Lite mode never loads it |
| TSK dataset size (~4 MB) | Lazy-load on first cross-ref access. Compress with gzip in SW cache |
| Ollama JSON adherence (~5–10% failure) | `smartRepair()` already exists in `panels-gen.js`. Tighten regex patterns if needed |
| Module security (community JSON) | Validate schema strictly. Modules are data-only (no executable code). Plugins are code — require explicit user consent |
| Scope creep | Each phase is independently shippable. Phase 0 foundation must land first; later phases can be reordered based on community demand |

---

## Timeline Summary

| Phase | Name | Days | Cumulative |
|-------|------|------|-----------|
| 0 | Foundation (plugins, modules, CLI, lite, keyboard nav, micro-screen) | 18 | 18 |
| 1 | Scholar (Strong's, search, cross-refs, word study, Jewish tools) | 29 | 47 |
| 2 | Disciple (plans, timeline, passage guide, dictionary, builder) | 20 | 67 |
| 3 | Ecclesia (marketplace, sharing, spec, i18n) | 16 | 83 |
| 4 | Oracle Ascendant (Ollama, exegesis, translation analysis, semantic search, schizo mode, quests) | 20 | 103 |
| 5 | Omnipresent (native apps, extension, widget, API, Linux desktop) | 21 | 124 |

**Total: ~124 working days** (6 months at full pace, 9–11 months at sustainable open-source pace).

Phase 0 is the critical path — everything else builds on plugins + modules. Phases 1–5 can be partially parallelized once the foundation is solid.
