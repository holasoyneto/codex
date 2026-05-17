# CODEX — Module Authoring Guide

A **module** is a pure-JSON file that adds study data to CODEX — a lexicon, a cross-reference set, a commentary, a reading plan, a timeline, a map overlay, a dictionary, a parsha cycle, or a cantillation table. Modules are loaded by `modules.js` into IndexedDB and surfaced through the right rail and verse menu.

Modules are **the easiest way to contribute to CODEX** — no JavaScript required. If you can write valid JSON, you can ship a module.

See also: [`SPEC.md`](./SPEC.md) for the formal spec · [`CONTRIBUTING.md`](./CONTRIBUTING.md) · [`API.md`](./API.md).

---

## 1. The meta envelope

Every module begins with the same outer shape:

```jsonc
{
  "meta": {
    "id":      "my-module",         // required · kebab-case · unique globally
    "type":    "lexicon",           // required · see §2
    "version": "1.0.0",             // required · semver
    "name":    "My Module",         // recommended
    "lang":    "en",                // BCP-47 tag of the module's prose
    "description": "1-2 sentences", // optional
    "source":  "Attribution",       // optional, but please attribute
    "_partial": false,              // optional · true if data is incomplete
    "note":    "Anything readers should know"
  },
  // ── type-specific keys go here ──
}
```

### Semver guidance

- **patch** (`1.0.0 → 1.0.1`) — content fixes, typos, more accurate entries
- **minor** (`1.0.0 → 1.1.0`) — additive entries, no breaking changes
- **major** (`1.0.0 → 2.0.0`) — restructure; loader will overwrite the cached copy

The loader (`modules.js`) revalidates `meta.version` against the network on every load and upgrades the IDB cache when they differ.

### Reference conventions

Verse references throughout modules use **`bookId.chapter.verse`**, all lowercase, with the 3-letter book id (e.g. `gen.1.1`, `jhn.3.16`, `psa.119.105`). Ranges use a hyphen: `gen.1.1-2.3`.

---

## 2. The ten module types

Defined in `modules.js → VALID_TYPES`:

| Type | Purpose | Body key | Reference example |
|---|---|---|---|
| `lexicon` | Word entries (Hebrew, Greek, theological) | `entries` | `data/modules/strongs-hebrew.json` |
| `concordance` | Word↔verse alignment | `coverage` + `verses` | `data/modules/alignment-kjv-sample.json` |
| `cross-reference` | Per-verse parallel passages | `verses` | `data/modules/tsk-sample.json` |
| `commentary` | Per-verse or per-chapter prose | `entries` | (community) |
| `reading-plan` | Day/week schedule of passages | `cycle` + `parashot`/`days` | `data/modules/parsha.json` |
| `timeline` | Historical events tied to dates/months | `months` / `events` | `data/modules/hebrew-calendar.json` |
| `map-overlay` | Geographic features tied to refs | `features` | (community) |
| `dictionary` | Place / person / topic articles | `entries` | (community) |
| `parsha` | Torah portions (separate from generic plan) | `parashot` | (use `reading-plan`) |
| `cantillation` | Trope marks / chant patterns per verse | `verses` | (community) |

Every existing module in `data/modules/` is a worked example you can study and copy.

---

## 3. Type entry shapes (with examples)

### 3.1 `lexicon`

`entries` is keyed by **lemma id** (Strong's number, lemma slug, or anything stable). Each entry is a flat object — only `gloss` is required.

```jsonc
{
  "meta": { "id": "strongs-hebrew", "type": "lexicon", "version": "1.0.0", "lang": "en", "name": "Strong's Hebrew" },
  "entries": {
    "H430": {
      "word":     "אֱלֹהִים",
      "translit": "Elohim",
      "pron":     "el-o-heem'",
      "pos":      "n-m",
      "gloss":    "God, gods",
      "def":      "plural of H433; gods in the ordinary sense …",
      "usage":    2606
    }
  }
}
```

Render path: `window.CODEX_StrongsLookup(id)` → the Strong's panel.

### 3.2 `concordance`

A word↔verse alignment. Two common shapes:

```jsonc
{
  "meta": { "id": "alignment-kjv-sample", "type": "concordance", "version": "1.0.0", "lang": "en" },
  "coverage": [ "gen.1", "psa.23", "jhn.1" ],
  "verses": {
    "gen.1.1": [
      { "word": "beginning", "strong": "H7225", "from": 1, "to": 1 },
      { "word": "God",       "strong": "H430",  "from": 4, "to": 4 }
    ]
  }
}
```

`coverage` advertises which chapters/verses the module covers so the UI can show a "partial" badge.

### 3.3 `cross-reference`

```jsonc
{
  "meta": { "id": "tsk-sample", "type": "cross-reference", "version": "1.0.0", "lang": "en" },
  "verses": {
    "gen.1.1": [
      { "ref": "jhn.1.1", "theme": "In the beginning · Word" },
      { "ref": "col.1.16", "theme": "All things created by/for him" }
    ]
  }
}
```

Render path: `window.CODEX_CrossRefLookup(ref)` → the Cross-Ref panel.

### 3.4 `commentary`

```jsonc
{
  "meta": { "id": "calvin-genesis", "type": "commentary", "version": "1.0.0", "lang": "en" },
  "entries": {
    "gen.1.1": {
      "author": "John Calvin",
      "title":  "Commentary on Genesis",
      "body":   "Moses simply intends to assert that the world…"
    },
    "gen.1": {                           // chapter-level
      "intro": "The argument of this chapter is…"
    }
  }
}
```

### 3.5 `reading-plan`

For named recurring cycles (Parashat HaShavua, M'Cheyne, F260…):

```jsonc
{
  "meta": { "id": "parsha", "type": "reading-plan", "version": "1.0.0", "name": "Torah Weekly Portions" },
  "cycle": "annual",
  "parashot": [
    { "n": 1, "name": "בְּרֵאשִׁית", "translit": "Bereshit",
      "torah": "gen.1.1-6.8", "haftarah": "isa.42.5-43.10" }
  ]
}
```

For day-numbered plans, use `days` instead of `parashot`:

```jsonc
{ "days": [ { "n": 1, "refs": ["gen.1", "mat.1", "psa.1"] } ] }
```

### 3.6 `timeline`

```jsonc
{
  "meta": { "id": "hebrew-calendar", "type": "timeline", "version": "1.0.0" },
  "months": [
    { "n": 1, "name": "נִיסָן", "translit": "Nisan",
      "approxGregorian": "Mar–Apr",
      "notes": "Pesach 15 Nisan" }
  ],
  "events": [                             // optional alongside months
    { "year": -1446, "label": "Exodus", "refs": ["exo.12"] }
  ]
}
```

### 3.7 `map-overlay`

```jsonc
{
  "meta": { "id": "paul-journeys", "type": "map-overlay", "version": "1.0.0" },
  "features": [
    { "id": "antioch-syria", "name": "Antioch (Syria)",
      "lat": 36.20, "lng": 36.16,
      "refs": ["act.11.19", "act.13.1"] },
    { "id": "journey-1", "kind": "route",
      "name": "First Missionary Journey",
      "path": [ ["antioch-syria"], ["cyprus"], ["perga"], ["antioch-pisidia"] ],
      "refs": ["act.13", "act.14"] }
  ]
}
```

### 3.8 `dictionary`

Article-style entries keyed by slug:

```jsonc
{
  "meta": { "id": "easton", "type": "dictionary", "version": "1.0.0", "lang": "en" },
  "entries": {
    "ephod": {
      "title": "Ephod",
      "body":  "A sacred vestment worn by the high priest…",
      "refs":  ["exo.28.6", "1sa.2.18"]
    }
  }
}
```

### 3.9 `parsha`

(Same shape as a `reading-plan` with `parashot`.) Reserved type for tooling that wants the calendar UI specifically.

### 3.10 `cantillation`

Per-verse trope marks for chanting Torah/Haftarah/Megillot:

```jsonc
{
  "meta": { "id": "torah-trope-ashkenaz", "type": "cantillation", "version": "1.0.0", "lang": "he" },
  "verses": {
    "gen.1.1": {
      "tropes": ["tipcha","mercha","etnachta","sof-pasuk"],
      "system": "ashkenaz"
    }
  }
}
```

---

## 4. Testing a module locally

1. Drop your JSON into `data/modules/<your-id>.json`.
2. Start the dev server: `node server.js`.
3. Open `http://localhost:3000`.
4. In the JS console:

   ```js
   await CODEX_MODULES.loadModule("your-id");
   await CODEX_MODULES.listModules();
   ```

5. To force a service-worker refresh after editing the JSON:

   ```js
   navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.update()));
   ```

   …or hard-reload (Shift+Reload) and the loader will fetch over the network.

6. To wipe a cached copy and re-fetch:

   ```js
   await CODEX_MODULES.removeModule("your-id");
   ```

If validation fails, you'll see a clear error in the console: `invalid module: meta.type 'foo' not recognized`, etc.

---

## 5. Publishing your module

Two routes today, one route soon:

1. **Drop-in:** open a PR adding the JSON to `data/modules/` plus an entry in `data/modules/_index.json` if it should preload.
2. **Self-hosted URL:** host the JSON anywhere and load it via `CODEX_MODULES.loadModuleFromUrl(url, expectedId)`. Users add the URL through *Settings → Modules → Add repo*.
3. **Community index (coming):** Phase 3.1 of the [ROADMAP](./ROADMAP.md) introduces a curated registry — your module gets a one-tap install card in the in-app catalog.

### Attribution and licensing

Please include `meta.source` for any public-domain corpus you draw from (e.g. *Treasury of Scripture Knowledge, 1834, public domain*). For modern works, ship only what you own or have explicit permission to redistribute. CODEX's repository defaults to permissive licensing — see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

### Size and partials

Big corpora are welcome. If you only have part of one, set `meta._partial: true` and `meta.note: "Sample subset…"` so the UI can render a transparent "partial" badge. Future iterations can ship the full set as a `minor` version bump.

---

## 6. Beyond the ten types

The ten types in `VALID_TYPES` are the loader-validated set. If you have a genuinely new kind of study data (e.g. *musical settings*, *liturgical responses*, *handwriting samples*), open an issue first — extending the validator is a one-line change once we agree on the shape.

For purely **rendering**-oriented extensions (a new right-rail panel, a verse-menu action), write a **plugin** instead. See [`SPEC.md` §3](./SPEC.md#3-plugin-spec).
