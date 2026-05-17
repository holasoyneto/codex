# Contributing to CODEX

Thanks for showing up. CODEX is open-source, vanilla, no-build — anyone with a text editor and Node can ship a meaningful change in an afternoon. This guide explains how.

Companion docs: [`SPEC.md`](./SPEC.md) (the formal extension spec) · [`MODULES.md`](./MODULES.md) (data modules) · [`API.md`](./API.md) (window globals + events) · [`ROADMAP.md`](./ROADMAP.md).

---

## 1. Philosophy

We are building an **open-source alternative to Logos** that respects attention, multiple traditions, and the reader's intelligence.

1. **Open source first.** Everything that ships in `main` is permissively licensed and inspectable. No closed binaries, no obfuscation. Where a corpus is restricted, we prefer to ship a public-domain alternative.
2. **Distraction-respectful.** No popups. No streaks. No badges for opening the app. Notifications are off by default. The default state of every UI affordance is *quiet*.
3. **Multi-tradition.** Jewish, Catholic, Orthodox, Protestant, charismatic, academic, esoteric. CODEX surfaces parallels without claiming a winner. Scholarship, not proselytising.
4. **AI-native but optional.** Oracle, panel generation, and translation drift are powerful when on, but the app reads scripture beautifully with the network unplugged and zero LLM access.
5. **No build step.** Vanilla React via Babel-standalone. JSX in `.jsx`, plain JS in `.js`. If you can edit a file and refresh, you can ship.

If a feature pulls in any direction opposite these, expect pushback.

---

## 2. Run it locally

```bash
git clone <fork-url> bible_study_app
cd bible_study_app
node server.js
```

That's it. Open `http://localhost:3000`. There is no install step. There is no bundler.

Optional: drop an `.env` with `ANTHROPIC_API_KEY=sk-ant-…` (or `XAI_API_KEY=xai-…`) if you want to try Oracle and panel generation. The app works completely offline without it; AI features will just be inert.

For local LLMs, run [Ollama](https://ollama.com) on `localhost:11434` — `/api/health` discovers it automatically.

---

## 3. File map

```
index.html             ── single-page entrypoint, loads everything
app.jsx                ── root React component, routing, layout
server.js              ── Node std-lib HTTP server + AI proxy (no deps)
sw.js                  ── service worker (3 caches, version bumps)

bible.js               ── translation registry, verse fetchers, IDB chapter cache
data.js                ── static tables (book ids, chapter counts, …)
modules.js             ── module loader (lexicons, cross-refs, …) → SPEC.md §4
plugins.js             ── plugin host (panels + verse actions + hooks) → SPEC.md §3
search.js              ── full-text search over cached verses
gematria.js            ── pure-compute gematria + cross-ref index
panels-gen.js          ── AI panel generator (Talmud / Commentary / Gematria / …)
i18n.js                ── UI string lookup + drift
light-themes.js        ── light theme registry
auto-cache.js          ── background pre-fetch of common chapters
sync.js                ── cross-device sync (Gist / Firebase backends)
direct-api.js          ── browser-direct AI client (BYO key, skips server)

panels.jsx             ── right-rail panels: Talmud, Commentary, Gematria, …
components.jsx         ── shared UI building blocks
help.jsx               ── in-app Help Wiki (reads data/help/articles.json)
oracle.jsx             ── chat UI
notes.jsx              ── notes + highlights + bookmarks
strongs.jsx            ── Strong's panel + lookup UI
crossref.jsx           ── cross-reference panel
reels.jsx              ── discovery feed
verse-*.jsx            ── verse menu, compare, mirror, map, art
quest-messiah.jsx      ── quest engine
tweaks-panel.jsx       ── developer tweak panel
repo-add.jsx           ── add-a-module-repo UI
library.jsx            ── library/catalog view

data/
  modules/             ── shipped JSON modules (SPEC §4 / MODULES.md)
  help/articles.json   ── in-app help articles
  …                    ── verses, marks, red-letter, etc.

styles.css             ── all styles, no preprocessor
manifest.json          ── PWA manifest
icon.svg               ── app icon
```

---

## 4. Coding conventions

- **Vanilla React via Babel-standalone**, transpiled in the browser. No TypeScript. No JSX type checker. No bundler.
- **`.jsx`** for files containing JSX. **`.js`** for plain JS. The MIME map in `server.js` serves both as `text/javascript`.
- **No npm dependencies in the runtime.** Node std-lib only in `server.js`. The PWA can be hosted on any static host (GitHub Pages already works) when AI features aren't needed.
- **No global mutation outside `window.CODEX_*`.** Use the documented namespace (see [`API.md`](./API.md)).
- **`var` is fine in older files** (e.g. `modules.js`). New code uses `const`/`let` and arrow functions, but stay consistent within a file.
- **2-space indent**, semicolons, double quotes in JS, single in JSX attributes. Match what you see nearby.
- **Comment the *why*.** The code says *what*; comments should explain *why this approach*. Look at the headers of `plugins.js`, `panels-gen.js`, `modules.js` for the house style.
- **One file = one concern.** When a `.jsx` exceeds ~600 lines, consider splitting along a natural seam.

---

## 5. Adding a new translation

Translations live in `bible.js`. The general pattern:

1. Register a translation in the `TRANSLATIONS` table (id, label, language, default versification, fetcher).
2. Provide a fetcher function that returns `{ verses: [{ n, text }] }` for `(book, chapter)`. It can hit any API or use bundled JSON.
3. If your translation has special needs (Hebrew RTL, Greek polytonic, red-letter overrides, YHWH restoration), wire those flags into the existing overlay system.
4. Add a smoke test: open the app, switch to your translation, verify a few key passages render correctly.

For a self-contained text (no external API), bundle the JSON under `data/<your-id>/` and have the fetcher read from there. The service worker will pick it up automatically.

---

## 6. Writing a panel (plugin)

Smallest possible plugin:

```html
<script>
window.CODEX_PLUGINS = window.CODEX_PLUGINS || [];
window.CODEX_PLUGINS.push({
  id: "hello-world",
  name: "Hello World",
  version: "0.1.0",
  panels: [{
    id: "hello", label: "Hello", glyph: "✦",
    render({ book, chapter, verse, container }) {
      container.textContent = `Hello from ${book} ${chapter}:${verse ?? "?"}`;
    },
  }],
});
</script>
```

Drop that in `index.html` (or load it from anywhere) and you've added a right-rail panel.

Full lifecycle, ctx shape, and event hooks: [`SPEC.md` §3](./SPEC.md#3-plugin-spec).

---

## 7. Writing a help article

Open `data/help/articles.json`. Add an object to the `articles` array:

```jsonc
{
  "id": "my-article",                 // required, kebab-case, unique
  "title": "My Article",              // required
  "category": "Developer",            // must match one in `categories`
  "tags": ["plugin", "module"],       // for in-wiki search
  "lastUpdated": "2026-05-18",
  "body": "# Heading\n\nMarkdown content…"
}
```

Bump the file's top-level `"updated"` date. The Help Wiki picks it up on next load — no code changes needed.

---

## 8. Commit messages

Conventional-style, short imperative subject:

```
feat: add Greek concordance module
fix: panels-gen cache key collides across languages
docs: clarify plugin lifecycle in SPEC.md
refactor: split notes.jsx into notes-store + notes-ui
perf: lazy-load gematria index on first panel open
chore: bump sw VERSION to v167
```

The body (optional) explains *why*. Wrap at ~72 chars. One commit per logical change.

---

## 9. Pull requests

A good PR:

1. **Has a focused title** matching the commit style above.
2. **Explains the user-visible change** in 2-3 sentences. Screenshots / short screencaps for UI work.
3. **Notes any storage / cache / SW version bumps.** If you change a `codex.*.v<N>` key shape, bump the suffix and migrate on read.
4. **Updates docs.** If you add a window global, document it in `API.md`. If you add a module type, update `SPEC.md` §4 and `MODULES.md`. New user-facing feature? Add a help article and update the chatbot function index (see `feedback_chatbot_function_index.md`).
5. **Stays small.** Big PRs get split. If you must ship something large, post a short design note in an issue first.

### Etiquette

- Don't bundle unrelated changes.
- Don't re-format files you didn't touch.
- Don't introduce a build step. (We will close the PR.)
- Don't add runtime npm dependencies. (Same.)
- If you're not sure whether a change fits, open a draft PR or an issue — we'd rather chat early than ask you to redo work.

---

## 10. Code of conduct

Be kind. Disagree with ideas, not people. Assume the other person is smart and acting in good faith. Apologise quickly when you slip. If a thread is getting hot, walk away for an hour.

CODEX exists at a busy intersection of traditions. We host all of them with curiosity and refuse none of them by default. Discussion that proselytises, mocks, or dismisses any tradition will be moderated.

That's the whole thing.

---

## 11. Where to go next

- The formal spec: [`SPEC.md`](./SPEC.md)
- Modules tutorial: [`MODULES.md`](./MODULES.md)
- API reference: [`API.md`](./API.md)
- The roadmap (what we'd love help with): [`ROADMAP.md`](./ROADMAP.md)

Welcome aboard.
