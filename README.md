# CODEX

> **Like Palantir, but for the Bible.** An all-source scripture intelligence terminal. 43+ translation feeds, AI fusion analysts (Talmud · gnosis · gematria · patristic commentary), an Oracle interrogator, and BabelForge — a lab to forge cover-translations of any book in any voice. Air-gap capable. Offline-first PWA. Eyes only.

<p align="center">
  <img src="./icon.svg" width="120" alt="CODEX icon" />
</p>

<p align="center">
  <em>Screenshot goes here — drop a <code>screenshot.png</code> next to <code>icon.svg</code> and swap this line.</em>
</p>

---

## What is this

CODEX is what you'd get if a scripture-obsessed analyst sat down to build an intelligence-grade reader. A terminal, not a website. A station, not an app. Every verse is a target. Every corpus is a feed. The job is to follow the thread.

Open a verse. A column of analysts wakes up — Talmudic parallels, patristic commentary, gematria, Strong's, cross-references, and the Gnostic mirror (Nag Hammadi, Pistis Sophia, Thomas). All feeds, all the time. No paywall, no devotional pablum, no fenced-off canon. The weird stuff is on purpose — Enoch, Jubilees, Meqabyan, the apocalypses — you don't get to study a canon by reading half of it.

Then there's **BabelForge** — a translation lab. Pick a voice (1611 King James, beat poet, courtroom transcript, 1920s gangster, your bubbe), pick a source, hit forge. The model generates your own AI-translated edition of any book and installs it as a Reader translation alongside KJV. It's your cover-Bible. Make it sound like you.

## Why CODEX

|                          | CODEX | YouVersion | Logos | Sefaria | Bible Gateway |
| ------------------------ | :---: | :--------: | :---: | :-----: | :-----------: |
| Open source              |   ✓   |     ✗      |   ✗   |    ✓    |       ✗       |
| Runs fully offline       |   ✓   |     ~      |   ~   |    ✗    |       ✗       |
| AI study companions      |   ✓   |     ✗      |   ~   |    ✗    |       ✗       |
| Talmud + Gnostic corpus  |   ✓   |     ✗      |   ~   |  partial|       ✗       |
| Build your own translation | ✓ |     ✗      |   ✗   |    ✗    |       ✗       |

(`~` = partial / paid tier)

## Features

### READ
- 43+ translations: KJV, ESV, WEB, BSB, LXX, Vulgate, Peshitta, Targumim, more
- Side-by-side compare (up to 4 columns)
- Red-letter mode, paragraph mode, interlinear toggle
- Cormorant serif for scripture, JetBrains Mono for the chrome
- Reels-style scripture cards for doomscrolling Psalms

### STUDY
- Strong's lookup on every word (Hebrew + Greek)
- Gematria panel — isopsephy, ordinal, mispar gadol
- Talmudic parallels and Jewish lectionary alignment
- Patristic + reformer commentary chain
- Cross-reference graph and verse maps (geographic)

### CREATE
- **BabelForge** — generate your own AI-translated Bible in any voice
- Notes, bookmarks, highlights with tag search
- Reading plans (chronological, canonical, custom)
- Export verses as cards, share as deep links

### DISCOVER
- **Oracle** chat — ask any question, get cited answers
- Gnostic + apocryphal panel: Nag Hammadi, Thomas, Pistis Sophia, Enoch
- Hebrew calendar, parsha tracker, daf yomi alignment
- "Walk this verse" — geographic verse maps via Leaflet

### OFFLINE
- Full PWA — install to home screen on any device
- Service worker caches every translation you open
- IndexedDB for notes, plans, your forged translations
- Works on a plane, in a tent, in a basement
- No build step — single HTML file, fork and go

## Getting started

```
git clone https://github.com/holasoyneto/codex
cd codex
node server.js
# open http://localhost:3000 — drop in your API key in Settings to enable AI panels
```

Or just open the hosted build: **https://holasoyneto.github.io/codex**

### Connecting an AI engine

CODEX speaks to five providers — pick whichever you like, mix and match, or run them all. Keys live only in your browser (`localStorage`) and the optional `.env` for the local Node server.

- **Anthropic Claude** *(paid, highest quality)* — get a key at [console.anthropic.com](https://console.anthropic.com/settings/keys), drop it into Settings → API keys (starts with `sk-ant-…`). Best for nuanced exegesis and long contexts.
- **xAI Grok** *(paid)* — sign up at [console.x.ai](https://console.x.ai), paste the `xai-…` key. Fast, conversational.
- **Groq** *(free, very fast)* — different company from xAI's Grok. Free tier at [console.groq.com](https://console.groq.com) gives you Llama 3.3 70B, DeepSeek R1, Mixtral, and Qwen running on custom LPU silicon. Keys start with `gsk_…`. The fastest hosted option per token.
- **Google Gemini** *(free, multimodal, 1M tokens/day)* — sign up at [aistudio.google.com/apikey](https://aistudio.google.com/apikey), paste the key into Settings → API keys. No prefix pattern — just a long alphanumeric string. Best free tier for image + audio inputs (when we expose those).
- **Ollama** *(local, free, private)* — install from [ollama.com](https://ollama.com), `ollama pull llama3.2`, then start the daemon. CODEX auto-detects it on `http://localhost:11434`. No key, no network — everything runs on your machine.

## Tech

Single-page React 18 app loaded via CDN with Babel-standalone — there is no build step, no bundler, no `node_modules` graveyard. Persistence lives in IndexedDB; offline lives in a Service Worker; translations stream from public-domain APIs and cache locally. The plugin system means every companion panel (gematria, Talmud, gnosis, Oracle) is a drop-in JSX module. Fork the repo, open `index.html`, and you're already running it.

## License

BSD-3-Clause. Take it, ship it, remix it, sell it. Just don't paywall the public domain, and don't slap our name on whatever you remix without asking first.

## Acknowledgements

- Public-domain scripture from [bible-api.com](https://bible-api.com), [bolls.life](https://bolls.life), and [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases)
- [Sefaria](https://www.sefaria.org) for the Jewish corpus model that inspired the parallel panel
- [Nag Hammadi Library](http://gnosis.org/naghamm/nhl.html) for the Coptic texts
- Fonts: [Cormorant](https://fonts.google.com/specimen/Cormorant) (SIL OFL) and [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (SIL OFL)
- Maps via [Leaflet](https://leafletjs.com)
- Quiet thanks to z. for the late-night sanity checks
- Built for everyone who has ever stayed up until 3am chasing a footnote
