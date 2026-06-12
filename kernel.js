// kernel.js — the CODEX KERNEL: the agentic core of the OS.
//
// Everything CODEX can do — full-text search, passage reading, cross-
// references, gematria, the depth consoles — is registered here as a TOOL.
// The kernel runs MISSIONS: the reader states an intent ("trace the Logos
// from Genesis to Revelation and build a study"), and an agent loop lets the
// model plan → call tools → read results → write artifact sections → finish.
// Every step streams to the UI over the window event bus (codex:kernel) so
// the OPS console can render the mission live: thought, tool, result,
// section, done.
//
// Design constraints:
//   · Zero deps, classic script. All tool execution is LOCAL — the model
//     only ever chooses; the kernel runs the app's own functions. The AI
//     never fabricates a search result or a gematria value: it reads them.
//   · Honest artifacts: the system prompt requires citations by canonical
//     ref for every claim sourced from a tool result, and a final caveat.
//   · Bounded: maxSteps cap (default 10), per-result truncation, abortable.
//   · Extensible: plugins can CODEX_KERNEL.register({...}) new tools — the
//     prompt is rebuilt from the live registry on every mission.
//
// Storage: missions persist to localStorage codex.missions (ring of 20).
(function () {
  "use strict";
  if (window.CODEX_KERNEL) return;

  // ── Ref parsing — "John 1:1-5", "1 Samuel 3", "Rev 13" ────────────────
  var ROMAN = { "1": "i", "2": "ii", "3": "iii" };
  function normBook(s) {
    s = String(s || "").toLowerCase().trim()
      .replace(/^([123])\s+/, function (_, d) { return ROMAN[d] + " "; })
      .replace(/\./g, "");
    return s;
  }
  function findBook(name) {
    var books = (window.CODEX_DATA && window.CODEX_DATA.books) || [];
    var n = normBook(name);
    var exact = null, prefix = null;
    for (var i = 0; i < books.length; i++) {
      var bn = normBook(books[i].name);
      if (bn === n) { exact = books[i]; break; }
      if (!prefix && bn.indexOf(n) === 0) prefix = books[i];
      if (!prefix && books[i].id === n.replace(/\s/g, "")) prefix = books[i];
    }
    return exact || prefix || null;
  }
  function parseRef(ref) {
    var m = String(ref || "").trim().match(/^(.+?)\s+(\d+)(?::(\d+)(?:\s*[-–]\s*(\d+))?)?$/);
    if (!m) return null;
    var book = findBook(m[1]);
    if (!book) return null;
    return {
      bookId: book.id, bookName: book.name,
      chapter: parseInt(m[2], 10),
      v1: m[3] ? parseInt(m[3], 10) : null,
      v2: m[4] ? parseInt(m[4], 10) : (m[3] ? parseInt(m[3], 10) : null),
    };
  }

  function primaryTranslation() {
    try {
      var t = (window.CODEX_DATA && window.CODEX_DATA.tweaks) || {};
      return t.primary || localStorage.getItem("codex.primary") || "web";
    } catch (_) { return "web"; }
  }

  function clip(s, n) { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n) + " …[truncated]" : s; }

  // ── Tool registry ──────────────────────────────────────────────────────
  var TOOLS = {};
  function register(tool) {
    if (!tool || !tool.name || typeof tool.run !== "function") return false;
    TOOLS[tool.name] = tool;
    return true;
  }

  register({
    name: "read_passage",
    description: "Read scripture text. args: {ref: 'Book ch' or 'Book ch:v' or 'Book ch:v1-v2'}. Returns the verses.",
    run: async function (args) {
      var p = parseRef(args && args.ref);
      if (!p) throw new Error("Unparseable ref: " + (args && args.ref));
      var data = await window.BIBLE.loadChapter(p.bookId, p.chapter, primaryTranslation());
      var verses = (data && data.verses) || data || [];
      if (!Array.isArray(verses)) throw new Error("No verses for " + args.ref);
      var out = verses
        .filter(function (v) {
          var n = v.verse || v.n;
          if (p.v1 == null) return true;
          return n >= p.v1 && n <= (p.v2 || p.v1);
        })
        .map(function (v) { return (v.verse || v.n) + ". " + String(v.text || "").trim(); })
        .join("\n");
      return clip(p.bookName + " " + p.chapter + ":\n" + out, 2600);
    },
  });

  register({
    name: "search_text",
    description: "Full-text search across cached scripture. args: {query: 'words OR \"a phrase\"', limit?: number}. Returns matching verses with refs.",
    run: async function (args) {
      if (!window.CODEX_SEARCH || !window.CODEX_SEARCH.search) throw new Error("Search engine unavailable");
      var hits = await window.CODEX_SEARCH.search(String(args.query || ""), { limit: Math.min(args.limit || 8, 15) });
      if (!Array.isArray(hits) || !hits.length) return "No matches for: " + args.query;
      return hits.slice(0, Math.min(args.limit || 8, 15)).map(function (h) {
        var ref = h.ref || h.id || "";
        var text = h.text || h.snippet || "";
        return ref + " — " + clip(String(text).trim(), 160);
      }).join("\n");
    },
  });

  register({
    name: "cross_references",
    description: "Treasury of Scripture Knowledge cross-references for a verse. args: {ref: 'Book ch:v'}.",
    run: async function (args) {
      var X = window.CODEX_CrossRefLookup;
      if (!X || !X.getCrossRefs) throw new Error("Cross-reference module unavailable");
      var p = parseRef(args && args.ref);
      if (!p || p.v1 == null) throw new Error("Need a verse ref like 'John 1:1'");
      var key = p.bookId + "." + p.chapter + "." + p.v1;
      var refs = await X.getCrossRefs(key);
      if (!Array.isArray(refs) || !refs.length) return "No cross-references recorded for " + args.ref;
      return refs.slice(0, 14).map(function (r) {
        try { return X.formatRef ? X.formatRef(r.ref || r) : String(r.ref || r); }
        catch (_) { return String(r.ref || r); }
      }).join(" · ");
    },
  });

  register({
    name: "gematria",
    description: "Compute gematria/isopsephy LOCALLY for a Hebrew or Greek word/phrase. args: {text}. Never guess these values — always call this.",
    run: async function (args) {
      var G = window.CODEX_GEMATRIA;
      if (!G || !G.all) throw new Error("Gematria engine unavailable");
      var v = G.all(String(args.text || ""));
      return JSON.stringify(v);
    },
  });

  register({
    name: "open_console",
    description: "Open a depth console on a verse for the reader (visual side-effect; result text is just confirmation). args: {kind: 'map'|'mirror'|'sword'|'art'|'compare', ref: 'Book ch:v'}.",
    sideEffect: true,
    run: async function (args) {
      var kind = String(args.kind || "").toLowerCase();
      if (["map", "mirror", "sword", "art", "compare"].indexOf(kind) === -1) throw new Error("Unknown console: " + kind);
      var p = parseRef(args && args.ref);
      if (!p || p.v1 == null) throw new Error("Need a verse ref like 'John 1:1'");
      window.dispatchEvent(new CustomEvent("codex:os-open", { detail: { kind: kind, ref: args.ref } }));
      return "Opened " + kind.toUpperCase() + " on " + args.ref + " for the reader.";
    },
  });

  register({
    name: "goto",
    description: "Navigate the reader to a passage (visual side-effect). args: {ref}.",
    sideEffect: true,
    run: async function (args) {
      if (typeof window.codexJumpToRef !== "function") throw new Error("Navigation unavailable");
      window.codexJumpToRef(String(args.ref || ""));
      return "Reader navigated to " + args.ref + ".";
    },
  });

  register({
    name: "session_trail",
    description: "The reader's recent reading trail (passages visited, most recent last). args: {hours?: number — window to include, default 12}. Use this for 'weave my session' style missions.",
    run: async function (args) {
      var hours = Math.max(1, Math.min((args && args.hours) || 12, 168));
      var cutoff = Date.now() - hours * 3600 * 1000;
      var trail;
      try { trail = JSON.parse(localStorage.getItem("codex.trail") || "[]"); } catch (_) { trail = []; }
      var recent = trail.filter(function (t) { return t.at >= cutoff; });
      if (!recent.length) return "The trail is empty for the last " + hours + "h — the reader hasn't moved between passages yet. Ask them to read first, or weave from the current passage alone.";
      return recent.map(function (t) {
        var d = new Date(t.at);
        return t.ref + "  (" + d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0") + ")";
      }).join("\n");
    },
  });

  // ── Lexicon & study tools — Strong's, Easton's, timeline, notes ────────
  var strongsCache = {}; // "H"|"G" → Promise<entries>
  function strongsEntries(prefix) {
    var id = prefix === "H" ? "strongs-hebrew" : "strongs-greek";
    if (!strongsCache[prefix]) {
      if (!window.CODEX_MODULES || typeof window.CODEX_MODULES.loadModule !== "function") {
        return Promise.reject(new Error("Strong's lexicon unavailable (module loader missing)"));
      }
      strongsCache[prefix] = window.CODEX_MODULES.loadModule(id).then(function (json) {
        var entries = json && json.entries;
        if (!entries) throw new Error("Strong's module " + id + " has no entries");
        return entries;
      });
      strongsCache[prefix].catch(function () { delete strongsCache[prefix]; });
    }
    return strongsCache[prefix];
  }
  function fmtStrongs(key, e) {
    var head = key + " " + (e.word || "") + (e.translit ? " (" + e.translit + ")" : "");
    var bits = [];
    if (e.pos) bits.push(e.pos);
    if (e.gloss) bits.push("gloss: " + e.gloss);
    if (e.def) bits.push("def: " + clip(String(e.def), 400));
    if (e.kjv) bits.push("KJV renderings: " + clip(String(e.kjv), 160));
    return head + " — " + bits.join(" · ");
  }

  register({
    name: "strongs_lookup",
    description: "Strong's lexicon entry (Hebrew/Greek). args: {number?: 'H7225' or 'G3056', word?: english/translit/lemma to search}. Returns lemma, transliteration, definition.",
    run: async function (args) {
      var num = String((args && args.number) || "").trim().toUpperCase();
      var word = String((args && args.word) || "").trim();
      if (!num && !word) throw new Error("Provide a Strong's number (e.g. H7225) or a word to search");
      if (num) {
        if (!/^[HG]\d+$/.test(num)) throw new Error("Bad Strong's number: " + num + " (expected H#### or G####)");
        var entry = null;
        if (typeof window.CODEX_StrongsLookup === "function") {
          try { entry = window.CODEX_StrongsLookup(num); } catch (_) { entry = null; }
        }
        if (!entry) entry = (await strongsEntries(num.charAt(0)))[num] || null;
        if (!entry) return "No Strong's entry for " + num + ".";
        return clip(fmtStrongs(num, entry), 900);
      }
      var needle = word.toLowerCase();
      var out = [], loadedAny = false, prefixes = ["H", "G"];
      for (var i = 0; i < prefixes.length && out.length < 6; i++) {
        var entries;
        try { entries = await strongsEntries(prefixes[i]); loadedAny = true; } catch (_) { continue; }
        var keys = Object.keys(entries);
        for (var j = 0; j < keys.length && out.length < 6; j++) {
          var e = entries[keys[j]];
          var hay = ((e.word || "") + " " + (e.translit || "") + " " + (e.gloss || "")).toLowerCase();
          if (hay.indexOf(needle) !== -1) out.push(fmtStrongs(keys[j], e));
        }
      }
      if (!loadedAny) throw new Error("Strong's lexicon modules unavailable");
      if (!out.length) return "No Strong's entries match '" + word + "'.";
      return clip(out.join("\n"), 2000);
    },
  });

  register({
    name: "dictionary_lookup",
    description: "Easton's Bible Dictionary entry for a term. args: {term: e.g. 'alpha'}. Returns the entry text with scripture refs.",
    run: async function (args) {
      var term = String((args && args.term) || "").trim().toLowerCase();
      if (!term) throw new Error("Need a term to look up");
      if (!window.CODEX_MODULES || typeof window.CODEX_MODULES.loadModule !== "function") throw new Error("Dictionary unavailable (module loader missing)");
      var mod;
      try { mod = await window.CODEX_MODULES.loadModule("easton-sample"); }
      catch (e) { throw new Error("Dictionary module unavailable: " + String((e && e.message) || e)); }
      var entries = (mod && mod.entries) || {};
      var entry = entries[term];
      if (!entry) {
        var near = Object.keys(entries).filter(function (k) { return k.indexOf(term) === 0; }).slice(0, 6);
        return "No Easton's entry for '" + term + "'." + (near.length ? " Near matches: " + near.join(", ") : "");
      }
      var refs = Array.isArray(entry.refs) && entry.refs.length ? "\nRefs: " + entry.refs.slice(0, 10).join(" · ") : "";
      return clip((entry.title || term) + " — " + String(entry.body || "").trim(), 1200) + refs;
    },
  });

  register({
    name: "timeline_events",
    description: "Biblical timeline events. args: {yearFrom?: number (negative = BC, e.g. -1000), yearTo?: number, query?: title/people/places keyword}. Returns up to 12 'year — title' lines.",
    run: async function (args) {
      var events = null;
      if (window.CODEX_Timeline && typeof window.CODEX_Timeline.loadEvents === "function") {
        events = await window.CODEX_Timeline.loadEvents();
      } else if (window.CODEX_MODULES && typeof window.CODEX_MODULES.loadModule === "function") {
        var mod = await window.CODEX_MODULES.loadModule("timeline-events").catch(function () { return null; });
        events = (mod && mod.events && mod.events.slice().sort(function (a, b) { return (a.year || 0) - (b.year || 0); })) || null;
      }
      if (!Array.isArray(events) || !events.length) throw new Error("Timeline module unavailable");
      var q = String((args && args.query) || "").trim().toLowerCase();
      var from = args && args.yearFrom != null && args.yearFrom !== "" ? parseInt(args.yearFrom, 10) : null;
      var to = args && args.yearTo != null && args.yearTo !== "" ? parseInt(args.yearTo, 10) : null;
      if (from != null && isNaN(from)) from = null;
      if (to != null && isNaN(to)) to = null;
      var hits = events.filter(function (ev) {
        if (from != null && ev.year < from) return false;
        if (to != null && ev.year > to) return false;
        if (q) {
          var hay = ((ev.title || "") + " " + (ev.summary || "") + " " + (ev.era || "") + " " +
            (ev.people || []).join(" ") + " " + (ev.places || []).join(" ")).toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });
      if (!hits.length) return "No timeline events match.";
      function yearLabel(y) { return y < 0 ? (-y) + " BC" : (y === 0 ? "1 BC/AD" : "AD " + y); }
      return hits.slice(0, 12).map(function (ev) {
        return yearLabel(ev.year) + " — " + ev.title +
          (Array.isArray(ev.scripture) && ev.scripture.length ? " (" + ev.scripture[0] + ")" : "");
      }).join("\n");
    },
  });

  register({
    name: "save_note",
    description: "Save a study note for the reader — it appears in the Notes panel (side-effect). args: {ref: display ref like 'John 1:14' (may be ''), title?: short heading, body: the note text}.",
    sideEffect: true,
    run: async function (args) {
      var body = String((args && args.body) || "").trim();
      if (!body) throw new Error("Note body is empty");
      var title = String((args && args.title) || "").trim();
      var ref = String((args && args.ref) || "").trim();
      var note = { id: "n_" + Date.now(), text: clip(title ? title + "\n" + body : body, 4000), ref: ref, ts: Date.now() };
      var notes;
      try { notes = JSON.parse(localStorage.getItem("codex.notes.v1") || "[]"); } catch (_) { notes = []; }
      if (!Array.isArray(notes)) notes = [];
      try {
        localStorage.setItem("codex.notes.v1", JSON.stringify([note].concat(notes)));
        localStorage.setItem("codex.notes.visible", "1");
      } catch (e) { throw new Error("Could not persist note: " + String((e && e.message) || e)); }
      try { window.dispatchEvent(new CustomEvent("codex:notes:show")); } catch (_) {}
      return "Note saved" + (ref ? " on " + ref : "") + " (" + (notes.length + 1) + " total) — visible in the Notes panel.";
    },
  });

  // ── App-control tools — settings, panels, translation, focus ──────────
  // The settings tools speak to the SAME store the Settings panel uses
  // (localStorage codex.tweaks.v1 + the 'tweakchange' event + the
  // __edit_mode_set_keys host message — see tweaks-panel.jsx useTweaks).
  var TWEAKS_LS = "codex.tweaks.v1";
  function readTweaks() {
    try { return JSON.parse(localStorage.getItem(TWEAKS_LS) || "{}") || {}; }
    catch (_) { return {}; }
  }
  function writeTweak(key, value) {
    var stored = readTweaks();
    var prev = stored[key];
    stored[key] = value;
    try { localStorage.setItem(TWEAKS_LS, JSON.stringify(stored)); }
    catch (e) { throw new Error("Could not persist setting: " + String(e && e.message || e)); }
    var edits = {}; edits[key] = value;
    try { window.parent.postMessage({ type: "__edit_mode_set_keys", edits: edits }, "*"); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent("tweakchange", { detail: edits })); } catch (_) {}
    // No silent changes — every write echoes a visible chip.
    try {
      window.dispatchEvent(new CustomEvent("codex:toast", {
        detail: { msg: "⚙ set " + key + " " + JSON.stringify(value), kind: "ok" },
      }));
    } catch (_) {}
    return prev;
  }

  register({
    name: "app_settings_get",
    description: "Read the user's app settings (the same codex.tweaks.v1 store the Settings panel uses). args: {key?: read one setting}. Returns JSON.",
    run: async function (args) {
      var t = readTweaks();
      var key = args && args.key != null ? String(args.key) : "";
      if (key) return JSON.stringify({ key: key, value: t.hasOwnProperty(key) ? t[key] : null, set: t.hasOwnProperty(key) });
      return clip(JSON.stringify(t), 2000);
    },
  });

  register({
    name: "app_settings_set",
    description: "Change ONE app setting through the same store Settings uses (visible side-effect; the change is echoed to the user as a ⚙ chip — never silent). args: {key, value}. Useful keys: fontScale (number, reader text size), oracleFontScale, scriptureFont ('serif'|'mono'), accent ('cyan'|'amber'|'violet'|'green'|'rose'), redLetter (bool), sideBySide (bool), distractionFree (bool), primaryTranslation (translation id), provider, model.",
    sideEffect: true,
    run: async function (args) {
      var key = String((args && args.key) || "").trim();
      if (!key) throw new Error("Need args.key");
      if (!(args && "value" in args)) throw new Error("Need args.value");
      var prev = writeTweak(key, args.value);
      return "⚙ set " + key + " " + JSON.stringify(args.value) +
        (prev !== undefined ? " (was " + JSON.stringify(prev) + ")" : "") +
        " — persisted to the Settings store; some surfaces apply it on their next render.";
    },
  });

  register({
    name: "open_panel",
    description: "Open an app panel/window for the reader (visual side-effect). args: {id: one of trans|talmud|comm|gem|gnosis|disarm|exeg|txan (study panels) or library|oracle|marks|reader (desk windows)}.",
    sideEffect: true,
    run: async function (args) {
      var id = String((args && args.id) || "").trim();
      if (!id) throw new Error("Need args.id");
      var deskIds = ["reader", "library", "oracle", "marks"];
      if (deskIds.indexOf(id) !== -1 && window.codexDesk && window.codexDesk.open) {
        window.codexDesk.open(id);
        return "Opened the " + id.toUpperCase() + " window.";
      }
      if (window.codexDeskPanels && window.codexDeskPanels.open) {
        window.codexDeskPanels.open(id);
        return "Opened the " + id.toUpperCase() + " panel window.";
      }
      try {
        window.dispatchEvent(new CustomEvent("codex:open-builtin-tab", { detail: { tabId: id } }));
        return "Requested the " + id.toUpperCase() + " panel.";
      } catch (e) { throw new Error("Panel host unavailable"); }
    },
  });

  register({
    name: "set_translation",
    description: "Switch the reader's primary translation (visual side-effect). args: {id: translation id like 'kjv', 'web', 'lxx', 'wlc'}.",
    sideEffect: true,
    run: async function (args) {
      var id = String((args && args.id) || "").trim().toLowerCase();
      if (!id) throw new Error("Need args.id");
      var list = (window.CODEX_DATA && window.CODEX_DATA.translations) || [];
      if (list.length && !list.some(function (t) { return t.id === id; })) {
        throw new Error("Unknown translation id: " + id + ". Known: " + list.slice(0, 30).map(function (t) { return t.id; }).join(", "));
      }
      if (typeof window.codexSetPrimary === "function") { window.codexSetPrimary(id); }
      else {
        writeTweak("primaryTranslation", id);
        try { window.dispatchEvent(new CustomEvent("codex:set-primary", { detail: { id: id } })); } catch (_) {}
      }
      return "Primary translation switched to " + id.toUpperCase() + ".";
    },
  });

  register({
    name: "focus_mode",
    description: "Toggle focus mode — hides every window except the reader (visual side-effect). args: {on: true|false}.",
    sideEffect: true,
    run: async function (args) {
      var on = !!(args && args.on);
      if (!window.codexDesk || typeof window.codexDesk.focus !== "function") throw new Error("Desk unavailable");
      window.codexDesk.focus(on);
      return "Focus mode " + (on ? "ON — only the Word remains." : "off — the desk is back.");
    },
  });

  // Optional semantic search — registered only if the engine ships it.
  if (window.CODEX_SEARCH && typeof window.CODEX_SEARCH.searchSemantic === "function") {
    register({
      name: "semantic_search",
      description: "Conceptual search (meaning, not keywords) across cached scripture. args: {query}.",
      run: async function (args) {
        var hits = await window.CODEX_SEARCH.searchSemantic(String(args.query || ""), { limit: 8 });
        if (!Array.isArray(hits) || !hits.length) return "No conceptual matches.";
        return hits.slice(0, 8).map(function (h) {
          return (h.ref || h.id || "") + " — " + clip(String(h.text || h.snippet || "").trim(), 160);
        }).join("\n");
      },
    });
  }

  // ── The agent prompt — rebuilt per mission from the live registry ──────
  function kernelPrompt(maxSteps) {
    var lines = Object.keys(TOOLS).map(function (k) {
      return "  · " + k + " — " + TOOLS[k].description;
    });
    // Section bodies render through the artifacts engine — teach the model
    // the rich-output grammar so artifacts can carry charts/flows/buttons.
    var artDoc = "";
    try {
      if (window.CODEX_ARTIFACTS && window.CODEX_ARTIFACTS.directiveDoc) {
        artDoc = "\n\nSECTION BODIES — " + window.CODEX_ARTIFACTS.directiveDoc() +
          "\nChart/flow data must come from your tool results in THIS mission — never invented.";
      }
    } catch (_) {}
    return [
      "You are the CODEX KERNEL — the mission agent of a Bible-study OS. You accomplish the reader's intent by calling the app's own tools, then writing a cited artifact. You are a careful scholar: every factual claim in your sections must be traceable to a tool result or marked as interpretation; cite canonical refs (e.g. John 1:1) inline. Survey traditions neutrally; never preach.",
      "",
      "TOOLS:",
      lines.join("\n"),
      "",
      "PROTOCOL — reply with ONE JSON object per turn, nothing else, no fences:",
      '  {"thought":"why this step","tool":"<name>","args":{...}}            — call a tool',
      '  {"thought":"...","section":{"heading":"...","body":"markdown, cited"}} — append an artifact section',
      '  {"thought":"...","done":{"title":"...","summary":"2-3 sentences"}}     — finish the mission',
      "",
      "RULES:",
      "- GATHER before you WRITE: read/search/cross-reference first, then sections.",
      "- ≤ " + maxSteps + " total steps. Plan tightly. 2-5 sections is a good artifact.",
      "- Never invent verse text, cross-references, or gematria values — call the tool.",
      "- The final section must be a short 'Caveats' note (interpretive limits).",
      "- open_console/goto/open_panel/focus_mode are for SHOWING the reader things — use at most 2 per mission, only when visual context truly helps.",
      "- app_settings_set changes the user's real settings — only when the intent explicitly asks for it.",
      "- Return ONLY the JSON object each turn.",
      artDoc,
    ].join("\n");
  }

  // ── Mission storage ────────────────────────────────────────────────────
  function loadMissions() {
    try { return JSON.parse(localStorage.getItem("codex.missions") || "[]"); } catch (_) { return []; }
  }
  function saveMission(m) {
    try {
      var all = loadMissions();
      var i = all.findIndex(function (x) { return x.id === m.id; });
      if (i >= 0) all[i] = m; else all.unshift(m);
      localStorage.setItem("codex.missions", JSON.stringify(all.slice(0, 20)));
    } catch (_) {}
  }

  function emit(detail) {
    try { window.dispatchEvent(new CustomEvent("codex:kernel", { detail: detail })); } catch (_) {}
  }

  // ── The loop ───────────────────────────────────────────────────────────
  async function chat(messages, system) {
    var I = window.CODEX_INTEL;
    var eng = I.intelEngine();
    // AI-busy bus — the orb pulses for the duration of every model call.
    var busyId = null;
    try { if (window.CODEX_AI_BUSY) busyId = window.CODEX_AI_BUSY.begin("KERNEL MISSION"); } catch (_) {}
    var r, body;
    try {
      r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: eng.provider,
          model: eng.model || "claude-haiku-4-5-20251001",
          system: system,
          messages: messages,
          max_tokens: 1400,
        }),
      });
      body = await r.json().catch(function () { return {}; });
    } finally {
      try { if (busyId != null && window.CODEX_AI_BUSY) window.CODEX_AI_BUSY.end(busyId); } catch (_) {}
    }
    if (!r.ok) throw new Error(I.intelErrMessage(body, r.status));
    var text = String(body.text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    var i = text.indexOf("{");
    if (i === -1) throw new Error("Kernel step was not JSON");
    return I.intelParseJSON(text.slice(i));
  }

  function run(intent, opts) {
    opts = opts || {};
    var maxSteps = Math.min(opts.maxSteps || 10, 16);
    var id = "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var aborted = false;
    var mission = {
      id: id, intent: String(intent || ""), startedAt: Date.now(),
      status: "running", steps: [],
      artifact: { title: "", summary: "", sections: [] },
    };
    saveMission(mission);
    emit({ id: id, type: "start", intent: mission.intent, maxSteps: maxSteps });

    (async function () {
      var system = kernelPrompt(maxSteps);
      var messages = [{ role: "user", content: "INTENT: " + mission.intent + "\n\nBegin. Return your first JSON step." }];
      try {
        for (var step = 1; step <= maxSteps; step++) {
          if (aborted) throw new Error("aborted");
          var move = await chat(messages, system);
          if (aborted) throw new Error("aborted");
          var thought = String(move.thought || "");
          messages.push({ role: "assistant", content: JSON.stringify(move) });

          if (move.done) {
            mission.artifact.title = String(move.done.title || mission.intent);
            mission.artifact.summary = String(move.done.summary || "");
            mission.status = "done";
            mission.finishedAt = Date.now();
            saveMission(mission);
            emit({ id: id, type: "done", step: step, thought: thought, artifact: mission.artifact });
            return;
          }

          if (move.section && move.section.heading) {
            var sec = { heading: String(move.section.heading), body: String(move.section.body || "") };
            mission.artifact.sections.push(sec);
            mission.steps.push({ kind: "section", heading: sec.heading });
            saveMission(mission);
            emit({ id: id, type: "section", step: step, thought: thought, section: sec });
            messages.push({ role: "user", content: "Section recorded (" + mission.artifact.sections.length + " so far). Next JSON step." });
            continue;
          }

          var toolName = String(move.tool || "");
          var tool = TOOLS[toolName];
          emit({ id: id, type: "tool", step: step, thought: thought, tool: toolName, args: move.args || {} });
          var result, failed = false;
          if (!tool) { result = "Unknown tool: " + toolName + ". Available: " + Object.keys(TOOLS).join(", "); failed = true; }
          else {
            try { result = await tool.run(move.args || {}); }
            catch (e) { result = "TOOL ERROR: " + String(e && e.message || e); failed = true; }
          }
          var resStr = clip(typeof result === "string" ? result : JSON.stringify(result), 1600);
          mission.steps.push({ kind: "tool", tool: toolName, args: move.args || {}, result: clip(resStr, 400), failed: failed });
          saveMission(mission);
          emit({ id: id, type: "result", step: step, tool: toolName, result: resStr, failed: failed });
          messages.push({ role: "user", content: "RESULT of " + toolName + ":\n" + resStr + "\n\nNext JSON step (" + (maxSteps - step) + " remaining)." });
        }
        // Step budget exhausted — close out with what we have.
        mission.status = "done";
        mission.finishedAt = Date.now();
        if (!mission.artifact.title) mission.artifact.title = mission.intent;
        if (!mission.artifact.summary) mission.artifact.summary = "Mission reached its step budget; artifact contains the sections completed.";
        saveMission(mission);
        emit({ id: id, type: "done", step: maxSteps, thought: "step budget reached", artifact: mission.artifact, budget: true });
      } catch (e) {
        mission.status = aborted ? "aborted" : "error";
        mission.error = String(e && e.message || e);
        mission.finishedAt = Date.now();
        saveMission(mission);
        emit({ id: id, type: aborted ? "abort" : "error", error: mission.error });
      }
    })();

    return { id: id, abort: function () { aborted = true; } };
  }

  function call(name, args) {
    var tool = TOOLS[name];
    if (!tool) throw new Error("Unknown tool: " + name);
    return Promise.resolve(tool.run(args || {}));
  }

  window.CODEX_KERNEL = {
    register: register,
    tools: function () { return Object.keys(TOOLS); },
    // {name, description, sideEffect} for every registered tool — lets chat
    // surfaces (the Oracle's agentic mode) teach the model the live registry.
    toolSpecs: function () {
      return Object.keys(TOOLS).map(function (k) {
        return { name: k, description: TOOLS[k].description || "", sideEffect: !!TOOLS[k].sideEffect };
      });
    },
    call: call,
    run: run,
    missions: loadMissions,
    parseRef: parseRef,
  };
})();
