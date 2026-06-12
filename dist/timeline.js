// GENERATED from timeline.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
// CODEX — Biblical Timeline · THE LIVING RIVER (v2 remake).
//
// EXOGRAMMAR verdict on v1: MOLT — the data was right, the skin was a
// document (discrete zoom buttons, a scrollbar, a footer card). v2 makes
// the axis itself the instrument:
//
//   · continuous wheel / pinch zoom, centered on the cursor — no buttons
//   · drag-pan with inertia (reduced-motion: inertia off, cuts only)
//   · era strata breathe behind the river; events sized by significance
//     (significance = breadth of attestation: refs + people + places)
//   · click an event → it CENTERS and an in-river detail card opens
//     (never a modal) carrying live scripture chips → codexGoto
//   · double-click an event → the reader jumps to its primary ref
//   · ◈ NOW-READING gold marker tracks codex:now (≈ label — the
//     verse→year mapping is approximate by nature, and says so)
//   · dense clusters fold into +N nodes that unfold on click (zoom-in)
//   · minimap strip at the foot — the whole river at a glance, draggable
//
// Honesty is load-bearing: the SCHOLARLY SURVEY banner stays, every date
// is "c." (conventional chronology, contested), the NOW marker is ≈.
//
// Self-registers as a CODEX plugin via window.CODEX_PLUGINS_API. All CSS
// self-injected (idempotent <style id="cx-tl2-css">) — styles.css is owned
// by a parallel build. Cross-IIFE law: window.* only.

(function () {
  "use strict";

  const { useState, useEffect, useRef, useMemo, useCallback } = React;

  // ───────────────────────────────────────────────────────────────────────
  // Era metadata — order matters (chronological)
  // ───────────────────────────────────────────────────────────────────────
  const ERAS = [
  { id: "primeval", label: "Primeval", tint: "#5a4a8a" },
  { id: "patriarchs", label: "Patriarchs", tint: "#7a5a3a" },
  { id: "egypt-exodus", label: "Egypt & Exodus", tint: "#b08040" },
  { id: "conquest", label: "Conquest", tint: "#a04848" },
  { id: "judges", label: "Judges", tint: "#806038" },
  { id: "united-monarchy", label: "United Monarchy", tint: "#b89030" },
  { id: "divided-kingdom", label: "Divided Kingdom", tint: "#7a8030" },
  { id: "exile", label: "Exile", tint: "#406878" },
  { id: "return", label: "Return", tint: "#3a8878" },
  { id: "intertestamental", label: "Intertestamental", tint: "#506060" },
  { id: "life-of-christ", label: "Life of Christ", tint: "#c0a040" },
  { id: "apostolic", label: "Apostolic Age", tint: "#3098b8" },
  { id: "post-canonical", label: "Post-Canonical", tint: "#6850a0" }];

  const ERA_LOOKUP = Object.fromEntries(ERAS.map((e) => [e.id, e]));

  const CATEGORIES = [
  { id: "narrative", label: "Narrative", glyph: "◆" },
  { id: "prophecy", label: "Prophecy", glyph: "✦" },
  { id: "war", label: "War", glyph: "⚔" },
  { id: "covenant", label: "Covenant", glyph: "◈" },
  { id: "miracle", label: "Miracle", glyph: "✺" },
  { id: "council", label: "Council", glyph: "❖" },
  { id: "martyrdom", label: "Martyrdom", glyph: "✝" },
  { id: "writing", label: "Writing", glyph: "✎" }];

  const CAT_LOOKUP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

  // ───────────────────────────────────────────────────────────────────────
  // Data loader (cached on window)
  // ───────────────────────────────────────────────────────────────────────
  const State = { events: null, loading: null };

  async function loadEvents() {
    if (State.events) return State.events;
    if (State.loading) return State.loading;
    State.loading = (async () => {
      try {
        let json;
        if (window.CODEX_MODULES) {
          json = await window.CODEX_MODULES.loadModule("timeline-events");
        } else {
          const r = await fetch("data/modules/timeline-events.json");
          json = await r.json();
        }
        const events = (json.events || []).slice().sort((a, b) => a.year - b.year);
        State.events = events;
        return events;
      } catch (e) {
        console.warn("[timeline] load failed:", e);
        State.events = [];
        return [];
      } finally {State.loading = null;}
    })();
    return State.loading;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Helpers
  // ───────────────────────────────────────────────────────────────────────
  function yearLabel(y) {
    if (y < 0) return `${-y} BC`;
    if (y === 0) return "1 BC/AD";
    return `AD ${y}`;
  }

  // Canonical OSIS book id → display name. Falls back to capitalized id.
  function bookIdToName(id) {
    const data = window.CODEX_DATA;
    if (data && data.books) {
      const direct = data.books.find((b) => (b.id || "").toLowerCase() === id);
      if (direct) return direct.name;
      const guess = data.books.find((b) => (b.id || "").toLowerCase().startsWith(id) || id.startsWith((b.id || "").toLowerCase()));
      if (guess) return guess.name;
    }
    const FALLBACK = {
      gen: "Genesis", exo: "Exodus", lev: "Leviticus", num: "Numbers", deu: "Deuteronomy",
      jos: "Joshua", jdg: "Judges", rut: "Ruth",
      "1sa": "1 Samuel", "2sa": "2 Samuel", "1ki": "1 Kings", "2ki": "2 Kings",
      "1ch": "1 Chronicles", "2ch": "2 Chronicles", ezr: "Ezra", neh: "Nehemiah", est: "Esther",
      job: "Job", psa: "Psalms", pro: "Proverbs", ecc: "Ecclesiastes", sng: "Song of Songs",
      isa: "Isaiah", jer: "Jeremiah", lam: "Lamentations", eze: "Ezekiel", dan: "Daniel",
      hos: "Hosea", joe: "Joel", amo: "Amos", oba: "Obadiah", jon: "Jonah", mic: "Micah",
      nah: "Nahum", hab: "Habakkuk", zep: "Zephaniah", hag: "Haggai", zec: "Zechariah", mal: "Malachi",
      mat: "Matthew", mrk: "Mark", luk: "Luke", jhn: "John", act: "Acts",
      rom: "Romans", "1co": "1 Corinthians", "2co": "2 Corinthians", gal: "Galatians",
      eph: "Ephesians", php: "Philippians", col: "Colossians",
      "1th": "1 Thessalonians", "2th": "2 Thessalonians", "1ti": "1 Timothy", "2ti": "2 Timothy",
      tit: "Titus", phm: "Philemon", heb: "Hebrews", jas: "James",
      "1pe": "1 Peter", "2pe": "2 Peter", "1jn": "1 John", "2jn": "2 John", "3jn": "3 John",
      jud: "Jude", rev: "Revelation"
    };
    return FALLBACK[id] || id;
  }

  // Parse an OSIS-ish ref like "gen.1.1-2.3" or "mat.5" into a human ref
  // ("Genesis 1:1" or "Matthew 5") and its component parts for matching.
  function parseScriptureRef(ref) {
    if (!ref) return null;
    const head = String(ref).split("-")[0];
    const parts = head.split(".");
    const bookId = parts[0].toLowerCase();
    const chapter = parts[1] ? parseInt(parts[1], 10) : 1;
    const verse = parts[2] ? parseInt(parts[2], 10) : null;
    const display = verse ?
    `${bookIdToName(bookId)} ${chapter}:${verse}` :
    `${bookIdToName(bookId)} ${chapter}`;
    return { bookId, chapter, verse, display, raw: ref };
  }

  // Resolve an OSIS-ish book id to the app's CODEX_DATA book id (3-letter).
  function resolveBookId(osisBook) {
    const want = String(osisBook || "").toLowerCase();
    const books = window.CODEX_DATA && window.CODEX_DATA.books || [];
    const direct = books.find((b) => (b.id || "").toLowerCase() === want);
    if (direct) return direct.id;
    const pfx = books.find((b) => want.startsWith((b.id || "").toLowerCase()) || (b.id || "").toLowerCase().startsWith(want));
    return pfx ? pfx.id : null;
  }

  // The one door to the reader — every clicked ref lands HERE.
  function gotoRef(rawRef) {
    const p = parseScriptureRef(rawRef);
    if (!p) return;
    const id = resolveBookId(p.bookId);
    if (id && typeof window.codexGoto === "function") {
      window.codexGoto(id, p.chapter, p.verse || 1);
      return;
    }
    if (typeof window.codexJumpToRef === "function") {
      window.codexJumpToRef(p.display);
      return;
    }
    window.dispatchEvent(new CustomEvent("codex:navigate", {
      detail: { book: bookIdToName(p.bookId), bookId: p.bookId, chapter: p.chapter, verse: p.verse || 1 }
    }));
  }

  // Does an event reference the given (bookId, chapter)?
  function eventMatchesPassage(ev, bookId, chapter) {
    if (!ev || !ev.scripture || !bookId) return false;
    const wantBook = String(bookId).toLowerCase();
    for (const r of ev.scripture) {
      const p = parseScriptureRef(r);
      if (!p) continue;
      if (p.bookId === wantBook || wantBook.startsWith(p.bookId) || p.bookId.startsWith(wantBook)) {
        if (!chapter) return true;
        const span = String(r).split("-");
        if (span.length === 1) {
          if (p.chapter === chapter) return true;
        } else {
          const tailParts = span[1].split(".");
          const endCh = tailParts.length >= 2 ? parseInt(tailParts[0], 10) : p.chapter;
          if (chapter >= p.chapter && chapter <= endCh) return true;
        }
      }
    }
    return false;
  }

  // Significance = breadth of attestation in the record itself (refs cited,
  // people named, places named). Honest: derived from the data, not vibes.
  function sigOf(ev) {
    const s = (ev.scripture || []).length;
    const p = (ev.people || []).length;
    const pl = (ev.places || []).length;
    const spanY = ev.year_range ? Math.abs((ev.year_range[1] || 0) - (ev.year_range[0] || 0)) : 0;
    return Math.min(5, 1 + s * 0.9 + p * 0.35 + pl * 0.25 + (spanY > 20 ? 0.5 : 0));
  }

  function pickTickInterval(spanYears, pxPerYear) {
    const targetPx = 90;
    const wantYears = targetPx / Math.max(pxPerYear, 0.0001);
    const candidates = [1, 2, 5, 10, 25, 50, 100, 200, 250, 500, 1000];
    for (const c of candidates) if (c >= wantYears) return c;
    return 2000;
  }

  function reduceMotion() {
    try {return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;}
    catch {return false;}
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  // ───────────────────────────────────────────────────────────────────────
  // Self-injected CSS (idempotent — constellation.jsx pattern)
  // ───────────────────────────────────────────────────────────────────────
  function injectCSS() {
    if (document.getElementById("cx-tl2-css")) return;
    const el = document.createElement("style");
    el.id = "cx-tl2-css";
    el.textContent = `
      .cx-tl2-root { display: flex; flex-direction: column; gap: 8px; height: 100%; min-height: 360px; padding: 10px 12px 12px; box-sizing: border-box; font-family: var(--cx-sans, ui-sans-serif, system-ui); }
      .cx-tl2-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
      .cx-tl2-title { font-family: var(--cx-mono, ui-monospace, monospace); font-size: 11px; letter-spacing: 0.18em; color: var(--cx-fg); font-weight: 700; }
      .cx-tl2-meta { font-family: var(--cx-mono, ui-monospace, monospace); font-size: 9px; letter-spacing: 0.1em; color: var(--cx-fg-dim); }
      .cx-tl2-span-ro { margin-left: auto; font-family: var(--cx-mono, ui-monospace, monospace); font-size: 9px; letter-spacing: 0.1em; color: var(--cx-accent); white-space: nowrap; }
      .cx-tl2-search { background: transparent; border: 1px solid var(--cx-line); border-radius: 6px; color: var(--cx-fg); font-family: var(--cx-mono, ui-monospace, monospace); font-size: 10px; padding: 5px 8px; min-height: 28px; width: 130px; }
      .cx-tl2-search:focus { outline: none; border-color: var(--cx-accent); }
      .cx-tl2-chips { display: flex; gap: 4px; flex-wrap: wrap; }
      .cx-tl2-chip { background: transparent; border: 1px solid var(--cx-line); border-radius: 10px; color: var(--cx-fg-dim); font-family: var(--cx-mono, ui-monospace, monospace); font-size: 9px; letter-spacing: 0.06em; padding: 3px 8px; min-height: 24px; cursor: pointer; }
      .cx-tl2-chip.is-on { color: var(--cx-accent); border-color: var(--cx-accent); }
      @media (pointer: coarse) { .cx-tl2-chip { min-height: 44px; padding: 6px 12px; } .cx-tl2-search { min-height: 44px; } }

      /* the river */
      .cx-tl2-river { position: relative; flex: 1; min-height: 200px; overflow: hidden; border: 1px solid var(--cx-line); border-radius: 8px; background: linear-gradient(180deg, color-mix(in srgb, var(--cx-bg-2, #0a0e18) 70%, transparent), transparent 40%, color-mix(in srgb, var(--cx-bg-2, #0a0e18) 70%, transparent)); cursor: grab; touch-action: pan-y; user-select: none; -webkit-user-select: none; }
      .cx-tl2-river.is-panning { cursor: grabbing; }
      .cx-tl2-strata { position: absolute; top: 0; bottom: 0; pointer-events: none; border-left: 1px solid transparent; border-right: 1px solid transparent; }
      .cx-tl2-strata-lbl { position: absolute; top: 6px; left: 8px; font-family: var(--cx-mono, ui-monospace, monospace); font-size: 9px; letter-spacing: 0.22em; text-transform: uppercase; opacity: 0.75; white-space: nowrap; }
      .cx-tl2-axis { position: absolute; left: 0; right: 0; top: 58%; height: 1px; background: var(--cx-line-strong, var(--cx-line)); pointer-events: none; }
      .cx-tl2-tick { position: absolute; top: 58%; width: 1px; height: 8px; background: var(--cx-line); transform: translateY(-4px); pointer-events: none; }
      .cx-tl2-tick-lbl { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); font-family: var(--cx-mono, ui-monospace, monospace); font-size: 8.5px; letter-spacing: 0.08em; color: var(--cx-fg-dim); white-space: nowrap; }
      .cx-tl2-river .cx-tl2-tick .cx-tl2-tick-lbl { top: 10px; }

      /* event nodes */
      .cx-tl2-ev { position: absolute; transform: translate(-50%, -50%); background: transparent; border: none; padding: 0; margin: 0; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 44px; min-height: 44px; justify-content: center; z-index: 4; }
      .cx-tl2-ev-dot { display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px solid; font-size: 9px; line-height: 1; color: var(--cx-bg, #06080e); box-shadow: 0 0 10px color-mix(in srgb, currentColor 0%, transparent); transition: transform 0.15s ease; }
      .cx-tl2-ev:hover .cx-tl2-ev-dot, .cx-tl2-ev:focus-visible .cx-tl2-ev-dot { transform: scale(1.25); }
      .cx-tl2-ev.is-sel .cx-tl2-ev-dot { outline: 2px solid var(--cx-accent); outline-offset: 2px; }
      .cx-tl2-ev.is-here .cx-tl2-ev-dot { outline: 2px solid var(--cx-accent-2, #ffc46b); outline-offset: 2px; }
      .cx-tl2-ev-stem { position: absolute; width: 1px; background: var(--cx-line); pointer-events: none; }
      .cx-tl2-ev-lbl { font-family: var(--cx-mono, ui-monospace, monospace); font-size: 8.5px; letter-spacing: 0.04em; color: var(--cx-fg); white-space: nowrap; max-width: 130px; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 3px var(--cx-bg, #06080e); }
      .cx-tl2-ev-yr { font-family: var(--cx-mono, ui-monospace, monospace); font-size: 7.5px; color: var(--cx-fg-dim); white-space: nowrap; }
      .cx-tl2-cluster { position: absolute; transform: translate(-50%, -50%); min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; cursor: zoom-in; z-index: 5; padding: 0; }
      .cx-tl2-cluster-core { display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px dashed var(--cx-accent); color: var(--cx-accent); background: color-mix(in srgb, var(--cx-accent) 12%, transparent); font-family: var(--cx-mono, ui-monospace, monospace); font-size: 10px; font-weight: 700; }
      .cx-tl2-cluster:hover .cx-tl2-cluster-core { background: color-mix(in srgb, var(--cx-accent) 24%, transparent); }

      /* NOW-READING gold marker */
      .cx-tl2-now { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--cx-accent-2, #ffc46b); pointer-events: none; z-index: 6; box-shadow: 0 0 8px color-mix(in srgb, var(--cx-accent-2, #ffc46b) 60%, transparent); }
      .cx-tl2-now-tag { position: absolute; top: 4px; transform: translateX(-50%); font-family: var(--cx-mono, ui-monospace, monospace); font-size: 8.5px; letter-spacing: 0.12em; color: var(--cx-accent-2, #ffc46b); background: color-mix(in srgb, var(--cx-bg, #06080e) 82%, transparent); border: 1px solid color-mix(in srgb, var(--cx-accent-2, #ffc46b) 50%, transparent); border-radius: 4px; padding: 2px 6px; white-space: nowrap; pointer-events: none; z-index: 7; }
      .cx-tl2-now-tag.is-edge { transform: none; }

      /* in-river detail card — never a modal */
      .cx-tl2-card { position: absolute; bottom: 10px; transform: translateX(-50%); width: min(320px, 86%); max-height: 62%; overflow-y: auto; background: var(--cx-panel-2, rgba(14,22,38,0.95)); border: 1px solid var(--cx-line-strong, var(--cx-line)); border-radius: 8px; padding: 10px 12px; z-index: 9; box-shadow: var(--cx-shadow, 0 8px 32px rgba(0,0,0,0.6)); cursor: auto; text-align: left; }
      .cx-tl2-card-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .cx-tl2-card-era { font-family: var(--cx-mono, ui-monospace, monospace); font-size: 8.5px; letter-spacing: 0.14em; text-transform: uppercase; border: 1px solid; border-radius: 4px; padding: 2px 6px; }
      .cx-tl2-card-cat { font-family: var(--cx-mono, ui-monospace, monospace); font-size: 8.5px; letter-spacing: 0.1em; color: var(--cx-fg-dim); }
      .cx-tl2-card-x { margin-left: auto; background: transparent; border: 1px solid var(--cx-line); border-radius: 6px; color: var(--cx-fg-dim); cursor: pointer; font-size: 12px; line-height: 1; padding: 4px 8px; min-width: 28px; min-height: 28px; }
      .cx-tl2-card-x:hover { color: var(--cx-fg); border-color: var(--cx-accent); }
      @media (pointer: coarse) { .cx-tl2-card-x { min-width: 44px; min-height: 44px; } }
      .cx-tl2-card-title { margin: 6px 0 2px; font-family: var(--cx-serif, Georgia, serif); font-size: 17px; font-weight: 600; color: var(--cx-fg); }
      .cx-tl2-card-year { font-family: var(--cx-mono, ui-monospace, monospace); font-size: 9.5px; letter-spacing: 0.08em; color: var(--cx-accent-2, #ffc46b); }
      .cx-tl2-card-sum { margin: 6px 0; font-family: var(--cx-serif, Georgia, serif); font-size: 13px; line-height: 1.5; color: var(--cx-fg); }
      .cx-tl2-card-refs { display: flex; gap: 5px; flex-wrap: wrap; margin: 6px 0 2px; }
      .cx-tl2-refchip { background: transparent; border: 1px solid color-mix(in srgb, var(--cx-accent) 50%, transparent); border-radius: 10px; color: var(--cx-accent); font-family: var(--cx-mono, ui-monospace, monospace); font-size: 9.5px; letter-spacing: 0.05em; padding: 4px 9px; min-height: 28px; cursor: pointer; }
      .cx-tl2-refchip:hover, .cx-tl2-refchip:focus-visible { background: color-mix(in srgb, var(--cx-accent) 16%, transparent); }
      @media (pointer: coarse) { .cx-tl2-refchip { min-height: 44px; padding: 8px 14px; } }
      .cx-tl2-card-meta { font-family: var(--cx-mono, ui-monospace, monospace); font-size: 9px; color: var(--cx-fg-dim); margin-top: 4px; letter-spacing: 0.04em; }
      .cx-tl2-card-honest { margin-top: 8px; padding-top: 6px; border-top: 1px dotted var(--cx-line); font-family: var(--cx-mono, ui-monospace, monospace); font-size: 8px; letter-spacing: 0.1em; color: var(--cx-fg-dim); text-transform: uppercase; }

      /* minimap */
      .cx-tl2-mini { position: relative; height: 30px; flex: none; border: 1px solid var(--cx-line); border-radius: 6px; overflow: hidden; cursor: pointer; touch-action: none; }
      .cx-tl2-mini-band { position: absolute; top: 0; bottom: 0; pointer-events: none; }
      .cx-tl2-mini-dot { position: absolute; bottom: 4px; width: 2px; background: var(--cx-fg-dim); opacity: 0.65; pointer-events: none; }
      .cx-tl2-mini-win { position: absolute; top: 0; bottom: 0; background: color-mix(in srgb, var(--cx-accent) 16%, transparent); border-left: 1px solid var(--cx-accent); border-right: 1px solid var(--cx-accent); pointer-events: none; }
      .cx-tl2-mini-now { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--cx-accent-2, #ffc46b); pointer-events: none; }

      .cx-tl2-hint { font-family: var(--cx-mono, ui-monospace, monospace); font-size: 8.5px; letter-spacing: 0.08em; color: var(--cx-fg-dim); text-align: center; }
      .cx-tl2-loading { display: flex; align-items: center; justify-content: center; gap: 10px; flex: 1; font-family: var(--cx-mono, ui-monospace, monospace); font-size: 10px; letter-spacing: 0.14em; color: var(--cx-fg-dim); }
      .cx-tl2-orb { width: 12px; height: 12px; border-radius: 50%; flex: none; background: radial-gradient(circle, var(--cx-accent) 0%, color-mix(in srgb, var(--cx-accent) 40%, transparent) 60%, transparent 100%); animation: cx-tl2-orb 1.1s ease-in-out infinite; }
      @keyframes cx-tl2-orb { 0%, 100% { transform: scale(0.7); opacity: 0.5; } 50% { transform: scale(1.2); opacity: 1; } }
      @media (prefers-reduced-motion: reduce) {
        .cx-tl2-orb { animation: none; opacity: 0.9; }
        .cx-tl2-ev-dot { transition: none; }
      }
    `;
    document.head.appendChild(el);
  }

  // ───────────────────────────────────────────────────────────────────────
  // Main panel — the living river
  // ───────────────────────────────────────────────────────────────────────
  function TimelinePanel(ctx) {
    injectCSS();
    const [events, setEvents] = useState(State.events);
    const [filterCats, setFilterCats] = useState(() => new Set(CATEGORIES.map((c) => c.id)));
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState(null);
    const [passage, setPassage] = useState(() => ({
      bookId: ctx && ctx.bookId || ctx && ctx.passage && ctx.passage.bookId || null,
      chapter: ctx && ctx.chapter || ctx && ctx.passage && ctx.passage.chapter || null,
      ref: null
    }));
    const [W, setW] = useState(900);
    const [H, setH] = useState(260);

    // view = { center (year at midline), span (years across the river) }
    const [view, setViewState] = useState(null);
    const viewRef = useRef(null);
    const setView = useCallback((next) => {
      setViewState((prev) => {
        const v = typeof next === "function" ? next(prev) : next;
        viewRef.current = v;
        try {window.__CODEX_TL_VIEW = v ? { center: v.center, span: v.span } : null;} catch {}
        return v;
      });
    }, []);

    const riverRef = useRef(null);
    const miniRef = useRef(null);
    const animRef = useRef(null);
    const panSuppressClick = useRef(false);

    // ── Data load (in-surface pulsing orb while resolving) ───────────────
    useEffect(() => {
      let alive = true;
      if (!events) loadEvents().then((es) => {if (alive) setEvents(es);});
      return () => {alive = false;};
    }, []);

    // ── Passage follows the reader: host props + codex:now + codex:navigate
    useEffect(() => {
      const bid = ctx && ctx.bookId || null,ch = ctx && ctx.chapter || null;
      if (!bid) return;
      setPassage((p) => p.bookId === bid && p.chapter === ch ? p : { bookId: bid, chapter: ch, ref: p.ref });
    }, [ctx && ctx.bookId, ctx && ctx.chapter]);
    useEffect(() => {
      const onNow = (e) => {
        const d = e.detail || window.CODEX_NOW || {};
        if (!d.bookId) return;
        setPassage({ bookId: d.bookId, chapter: d.chapter || null, ref: d.ref || null });
      };
      const onNav = (e) => {
        const d = e.detail || {};
        if (!d.bookId) return;
        setPassage((p) => ({ bookId: d.bookId, chapter: d.chapter || null, ref: p.ref }));
      };
      window.addEventListener("codex:now", onNow);
      window.addEventListener("codex:navigate", onNav);
      return () => {
        window.removeEventListener("codex:now", onNow);
        window.removeEventListener("codex:navigate", onNav);
      };
    }, []);

    // ready = the river tree is mounted (loading tree has no riverRef el).
    // Every listener effect keys on this so it binds AFTER the river exists.
    const ready = !!(events && view);

    // ── Geometry ──────────────────────────────────────────────────────────
    useEffect(() => {
      const el = riverRef.current;
      if (!el || typeof ResizeObserver === "undefined") return;
      const ro = new ResizeObserver((entries) => {
        for (const ent of entries) {
          if (ent.contentRect.width > 0) {setW(ent.contentRect.width);setH(ent.contentRect.height);}
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, [ready]);

    // ── Filter pipeline ───────────────────────────────────────────────────
    const filtered = useMemo(() => {
      if (!events) return [];
      const q = search.trim().toLowerCase();
      return events.filter((ev) => {
        if (!filterCats.has(ev.category)) return false;
        if (q && !(ev.title.toLowerCase().includes(q) || (ev.summary || "").toLowerCase().includes(q))) return false;
        return true;
      });
    }, [events, filterCats, search]);

    // Full extent of the record (all events, unfiltered — the river's banks)
    const full = useMemo(() => {
      if (!events || !events.length) return { lo: -4100, hi: 150 };
      const lo = events[0].year,hi = events[events.length - 1].year;
      const pad = Math.max(40, (hi - lo) * 0.03);
      return { lo: lo - pad, hi: hi + pad };
    }, [events]);
    const fullSpan = full.hi - full.lo;

    // Initialise the view once events land
    useEffect(() => {
      if (events && events.length && !viewRef.current) {
        setView({ center: (full.lo + full.hi) / 2, span: fullSpan });
      }
    }, [events, full.lo, full.hi]);

    const clampView = useCallback((center, span) => {
      const s = clamp(span, 4, fullSpan * 1.25);
      const c = clamp(center, full.lo - s * 0.25, full.hi + s * 0.25);
      return { center: c, span: s };
    }, [full.lo, full.hi, fullSpan]);

    const xOf = useCallback((y) => {
      const v = viewRef.current;
      if (!v) return 0;
      return (y - v.center) / v.span * W + W / 2;
    }, [W, view]);
    const yearAtX = useCallback((px) => {
      const v = viewRef.current;
      if (!v) return 0;
      return v.center + (px - W / 2) * v.span / W;
    }, [W, view]);

    // ── Animated fly (reduced-motion: cut) ────────────────────────────────
    const animateTo = useCallback((center, span, ms = 520) => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      const from = viewRef.current;
      const target = clampView(center, span);
      if (!from || reduceMotion()) {setView(target);return;}
      const t0 = performance.now();
      const step = (t) => {
        const k = clamp((t - t0) / ms, 0, 1);
        const e = easeInOut(k);
        setView({
          center: from.center + (target.center - from.center) * e,
          span: from.span + (target.span - from.span) * e
        });
        if (k < 1) animRef.current = requestAnimationFrame(step);else
        animRef.current = null;
      };
      animRef.current = requestAnimationFrame(step);
    }, [clampView, setView]);
    useEffect(() => () => {if (animRef.current) cancelAnimationFrame(animRef.current);}, []);

    // ── Wheel zoom, centered on cursor (passive:false — React can't) ─────
    useEffect(() => {
      const el = riverRef.current;
      if (!el) return;
      const onWheel = (e) => {
        if (!viewRef.current) return;
        e.preventDefault();
        if (animRef.current) {cancelAnimationFrame(animRef.current);animRef.current = null;}
        const rect = el.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const v = viewRef.current;
        const yearAt = v.center + (px - rect.width / 2) * v.span / rect.width;
        const f = Math.exp(e.deltaY * 0.0016);
        const span = clamp(v.span * f, 4, fullSpan * 1.25);
        const center = yearAt - (px - rect.width / 2) * span / rect.width;
        setView(clampView(center, span));
      };
      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    }, [fullSpan, clampView, setView, ready]);

    // ── Drag-pan with inertia + two-pointer pinch ────────────────────────
    const [panning, setPanning] = useState(false);
    useEffect(() => {
      const el = riverRef.current;
      if (!el) return;
      const ptrs = new Map(); // pointerId → {x, y}
      let dragging = false;
      let lastX = 0,lastT = 0,vel = 0;
      let startX = 0;
      let pinchSpan = 0,pinchDist = 0,pinchMidYear = 0;
      let inertiaRaf = null;

      const stopInertia = () => {if (inertiaRaf) {cancelAnimationFrame(inertiaRaf);inertiaRaf = null;}};

      const down = (e) => {
        if (!viewRef.current) return;
        stopInertia();
        if (animRef.current) {cancelAnimationFrame(animRef.current);animRef.current = null;}
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (ptrs.size === 2) {
          const [a, b] = [...ptrs.values()];
          pinchDist = Math.max(12, Math.abs(a.x - b.x));
          pinchSpan = viewRef.current.span;
          const rect = el.getBoundingClientRect();
          pinchMidYear = yearAtX((a.x + b.x) / 2 - rect.left);
          dragging = false;
        } else {
          startX = lastX = e.clientX;lastT = performance.now();vel = 0;
          dragging = false;
        }
      };
      const move = (e) => {
        if (!ptrs.has(e.pointerId) || !viewRef.current) return;
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const rect = el.getBoundingClientRect();
        if (ptrs.size === 2) {
          // pinch — scale span around the gesture midpoint
          const [a, b] = [...ptrs.values()];
          const d = Math.max(12, Math.abs(a.x - b.x));
          const span = clamp(pinchSpan * (pinchDist / d), 4, fullSpan * 1.25);
          const midPx = (a.x + b.x) / 2 - rect.left;
          const center = pinchMidYear - (midPx - rect.width / 2) * span / rect.width;
          setView(clampView(center, span));
          return;
        }
        const dxTotal = e.clientX - startX;
        if (!dragging && Math.abs(dxTotal) > 4) {
          dragging = true;
          panSuppressClick.current = true;
          setPanning(true);
          try {el.setPointerCapture(e.pointerId);} catch {}
        }
        if (!dragging) return;
        const dx = e.clientX - lastX;
        const now = performance.now();
        const dt = Math.max(1, now - lastT);
        vel = 0.8 * vel + 0.2 * (dx / dt); // px/ms, smoothed
        lastX = e.clientX;lastT = now;
        const v = viewRef.current;
        setView(clampView(v.center - dx * v.span / rect.width, v.span));
      };
      const up = (e) => {
        ptrs.delete(e.pointerId);
        if (ptrs.size > 0) return;
        const wasDragging = dragging;
        dragging = false;
        setPanning(false);
        setTimeout(() => {panSuppressClick.current = false;}, 0);
        if (!wasDragging || reduceMotion()) return;
        // inertia — decay velocity, keep panning
        let v0 = vel;
        const rect = el.getBoundingClientRect();
        const step = () => {
          v0 *= 0.93;
          if (Math.abs(v0) < 0.02) {inertiaRaf = null;return;}
          const v = viewRef.current;
          if (!v) return;
          setView(clampView(v.center - v0 * 16 * v.span / rect.width, v.span));
          inertiaRaf = requestAnimationFrame(step);
        };
        inertiaRaf = requestAnimationFrame(step);
      };
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      return () => {
        stopInertia();
        el.removeEventListener("pointerdown", down);
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
      };
    }, [fullSpan, clampView, setView, yearAtX, ready]);

    // ── Minimap drag — the whole river at a glance ────────────────────────
    useEffect(() => {
      const el = miniRef.current;
      if (!el) return;
      let active = false;
      const yearAtMini = (clientX) => {
        const rect = el.getBoundingClientRect();
        const t = clamp((clientX - rect.left) / rect.width, 0, 1);
        return full.lo + t * fullSpan;
      };
      const down = (e) => {
        active = true;
        try {el.setPointerCapture(e.pointerId);} catch {}
        const v = viewRef.current;if (!v) return;
        setView(clampView(yearAtMini(e.clientX), v.span));
      };
      const move = (e) => {
        if (!active) return;
        const v = viewRef.current;if (!v) return;
        setView(clampView(yearAtMini(e.clientX), v.span));
      };
      const up = () => {active = false;};
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      return () => {
        el.removeEventListener("pointerdown", down);
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
      };
    }, [full.lo, fullSpan, clampView, setView, ready]);

    // ── Layout: visible nodes, dense runs folded into +N clusters ────────
    const nodes = useMemo(() => {
      if (!view || !filtered.length) return [];
      const pxPerYear = W / view.span;
      const vis = filtered.filter((e) => {
        const x = (e.year - view.center) * pxPerYear + W / 2;
        return x > -80 && x < W + 80;
      });
      const out = [];
      let run = [];
      const flush = () => {
        if (!run.length) return;
        if (run.length >= 3) {
          const lo = run[0].year,hi = run[run.length - 1].year;
          out.push({ kind: "cluster", year: (lo + hi) / 2, lo, hi, list: run });
        } else {
          run.forEach((e) => out.push({ kind: "event", ev: e }));
        }
        run = [];
      };
      for (const e of vis) {
        if (!run.length || (e.year - run[run.length - 1].year) * pxPerYear < 26) run.push(e);else
        {flush();run = [e];}
      }
      flush();
      // lane assignment for singles — stagger above/below the axis
      let i = 0;
      for (const n of out) {
        if (n.kind === "event") {n.lane = i % 4;i++;}
      }
      return out;
    }, [filtered, view, W]);

    // ── Era strata (visible portion) ──────────────────────────────────────
    const strata = useMemo(() => {
      if (!events || !events.length) return [];
      const bands = [];
      for (const era of ERAS) {
        const inEra = events.filter((e) => e.era === era.id);
        if (!inEra.length) continue;
        const lo = Math.min(...inEra.map((e) => e.year_range ? e.year_range[0] : e.year));
        const hi = Math.max(...inEra.map((e) => e.year_range ? e.year_range[1] : e.year));
        bands.push({ era, lo, hi });
      }
      return bands;
    }, [events]);

    // ── Axis ticks ────────────────────────────────────────────────────────
    const ticks = useMemo(() => {
      if (!view) return [];
      const pxPerYear = W / view.span;
      const interval = pickTickInterval(view.span, pxPerYear);
      const lo = view.center - view.span / 2,hi = view.center + view.span / 2;
      const start = Math.ceil(lo / interval) * interval;
      const out = [];
      for (let y = start; y <= hi; y += interval) out.push(y);
      return out;
    }, [view, W]);

    // ── NOW-READING marker (≈ — verse→year mapping is approximate) ───────
    const nowMark = useMemo(() => {
      if (!events || !events.length || !passage.bookId) return null;
      let ev = events.find((e) => eventMatchesPassage(e, passage.bookId, passage.chapter));
      let exactCh = !!ev;
      if (!ev) ev = events.find((e) => eventMatchesPassage(e, passage.bookId, null));
      if (!ev) return null;
      const ref = passage.ref || `${bookIdToName(String(passage.bookId).toLowerCase())} ${passage.chapter || ""}`.trim();
      return { year: ev.year, ref, exactCh };
    }, [events, passage]);

    // ── Interactions ──────────────────────────────────────────────────────
    const toggleCat = useCallback((id) => {
      setFilterCats((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);else next.add(id);
        if (next.size === 0) return new Set(CATEGORIES.map((c) => c.id));
        return next;
      });
    }, []);

    const onEventClick = useCallback((e) => {
      if (panSuppressClick.current) return;
      setSelected(e);
      const v = viewRef.current;
      if (v) animateTo(e.year, v.span);
    }, [animateTo]);

    const onEventDouble = useCallback((e) => {
      if (e.scripture && e.scripture.length) gotoRef(e.scripture[0]);
    }, []);

    const onClusterClick = useCallback((c) => {
      if (panSuppressClick.current) return;
      const v = viewRef.current;
      if (!v) return;
      // unfold: zoom in far enough that the run spreads out
      const span = clamp(Math.max((c.hi - c.lo) * 2.4, 6), 4, v.span * 0.5);
      animateTo(c.year, span);
    }, [animateTo]);

    const fmtSpan = (s) => s >= 1000 ? `${(s / 1000).toFixed(1)}K yrs` : `${Math.round(s)} yrs`;

    // ── Render ────────────────────────────────────────────────────────────
    if (!events || !view) {
      return (/*#__PURE__*/
        React.createElement("div", { className: "cx-tl2-root" }, /*#__PURE__*/
        React.createElement("div", { className: "cx-tl2-loading" }, /*#__PURE__*/React.createElement("span", { className: "cx-tl2-orb" }), " RESOLVING CHRONOLOGY\u2026")
        ));

    }

    const pxPerYear = W / view.span;
    const axisTop = H * 0.58;
    const LANE_Y = [axisTop - 46, axisTop + 42, axisTop - 84, axisTop + 80];
    const showLabels = pxPerYear > 0.14;
    const IB = window.IntelBanner;

    return (/*#__PURE__*/
      React.createElement("div", { className: "cx-tl2-root" }, /*#__PURE__*/
      React.createElement("div", { className: "cx-tl2-head" }, /*#__PURE__*/
      React.createElement("span", { className: "cx-tl2-title" }, "\u23F3 THE RIVER"), /*#__PURE__*/
      React.createElement("span", { className: "cx-tl2-meta" }, filtered.length, " events \xB7 ", yearLabel(Math.round(view.center - view.span / 2)), " \u27F7 ", yearLabel(Math.round(view.center + view.span / 2))), /*#__PURE__*/
      React.createElement("span", { className: "cx-tl2-span-ro" }, "VIEW ", fmtSpan(view.span)), /*#__PURE__*/
      React.createElement("input", {
        className: "cx-tl2-search",
        type: "search",
        placeholder: "search events\u2026",
        value: search,
        onChange: (e) => setSearch(e.target.value),
        "aria-label": "Search timeline events" }
      )
      ),

      IB ? /*#__PURE__*/React.createElement(IB, { console: "TIMELINE", scope: "CHRONOLOGY", note: "datings follow conventional chronology \xB7 all years approximate \xB7 contested" }) : null, /*#__PURE__*/

      React.createElement("div", { className: "cx-tl2-chips" },
      CATEGORIES.map((c) => {
        const on = filterCats.has(c.id);
        return (/*#__PURE__*/
          React.createElement("button", { key: c.id,
            className: "cx-tl2-chip" + (on ? " is-on" : ""),
            onClick: () => toggleCat(c.id),
            "aria-pressed": on,
            title: c.label },
          c.glyph, " ", c.label
          ));

      })
      ), /*#__PURE__*/

      React.createElement("div", { className: "cx-tl2-river" + (panning ? " is-panning" : ""), ref: riverRef,
        role: "application", "aria-label": "Biblical timeline river \u2014 drag to pan, scroll to zoom" },

      strata.map((b) => {
        const x0 = xOf(b.lo),x1 = xOf(b.hi);
        if (x1 < -40 || x0 > W + 40) return null;
        return (/*#__PURE__*/
          React.createElement("div", { key: b.era.id, className: "cx-tl2-strata",
            style: {
              left: Math.max(-2, x0) + "px",
              width: Math.max(6, Math.min(W + 4, x1) - Math.max(-2, x0)) + "px",
              background: `linear-gradient(180deg, ${b.era.tint}26, ${b.era.tint}08 55%, ${b.era.tint}1d)`,
              borderLeftColor: `${b.era.tint}55`
            } }, /*#__PURE__*/
          React.createElement("span", { className: "cx-tl2-strata-lbl", style: { color: b.era.tint } }, b.era.label)
          ));

      }), /*#__PURE__*/

      React.createElement("div", { className: "cx-tl2-axis" }),


      ticks.map((y) => /*#__PURE__*/
      React.createElement("div", { key: y, className: "cx-tl2-tick", style: { left: xOf(y) + "px" } }, /*#__PURE__*/
      React.createElement("span", { className: "cx-tl2-tick-lbl" }, yearLabel(y))
      )
      ),


      nowMark ? (() => {
        const x = xOf(nowMark.year);
        const inView = x >= 0 && x <= W;
        const tagStyle = inView ?
        { left: clamp(x, 70, W - 70) + "px" } :
        x < 0 ? { left: "6px" } : { right: "6px" };
        return (/*#__PURE__*/
          React.createElement(React.Fragment, null,
          inView ? /*#__PURE__*/React.createElement("div", { className: "cx-tl2-now", style: { left: x + "px" } }) : null, /*#__PURE__*/
          React.createElement("div", { className: "cx-tl2-now-tag" + (inView ? "" : " is-edge"), style: tagStyle },
          inView ? "" : x < 0 ? "◂ " : "", "\u25C8 NOW \u2248 ", nowMark.ref, inView ? "" : x < 0 ? "" : " ▸"
          )
          ));

      })() : null,


      nodes.map((n, i) => {
        if (n.kind === "cluster") {
          const size = clamp(26 + n.list.length * 1.6, 28, 44);
          return (/*#__PURE__*/
            React.createElement("button", { key: "c" + i,
              className: "cx-tl2-cluster",
              style: { left: xOf(n.year) + "px", top: axisTop + "px" },
              onClick: () => onClusterClick(n),
              title: `${n.list.length} events · ${yearLabel(Math.round(n.lo))} – ${yearLabel(Math.round(n.hi))} — click to unfold`,
              "aria-label": `${n.list.length} folded events between ${yearLabel(Math.round(n.lo))} and ${yearLabel(Math.round(n.hi))}` }, /*#__PURE__*/
            React.createElement("span", { className: "cx-tl2-cluster-core", style: { width: size + "px", height: size + "px" } }, "+", n.list.length)
            ));

        }
        const e = n.ev;
        const era = ERA_LOOKUP[e.era];
        const cat = CAT_LOOKUP[e.category];
        const sig = sigOf(e);
        const d = Math.round(9 + sig * 2.6); // dot diameter by significance
        const y = LANE_Y[n.lane];
        const isSel = selected && selected.id === e.id;
        const isHere = passage.bookId && eventMatchesPassage(e, passage.bookId, passage.chapter);
        const tint = era ? era.tint : "var(--cx-fg-dim)";
        const stemTop = Math.min(y, axisTop),stemH = Math.abs(axisTop - y);
        return (/*#__PURE__*/
          React.createElement("button", {
            key: e.id,
            className: "cx-tl2-ev" + (isSel ? " is-sel" : "") + (isHere ? " is-here" : ""),
            style: { left: xOf(e.year) + "px", top: y + "px" },
            onClick: () => onEventClick(e),
            onDoubleClick: () => onEventDouble(e),
            title: `${e.title} · c. ${yearLabel(e.year)} — click to inspect, double-click to read`,
            "aria-label": `${e.title} (c. ${yearLabel(e.year)})` }, /*#__PURE__*/
          React.createElement("span", { className: "cx-tl2-ev-stem", style: { top: stemTop - y + d / 2 + 10 + "px", height: Math.max(0, stemH - d / 2 - 10) + "px", left: "50%", background: tint, opacity: 0.4 } }), /*#__PURE__*/
          React.createElement("span", { className: "cx-tl2-ev-dot",
            style: { width: d + "px", height: d + "px", background: tint, borderColor: tint, boxShadow: `0 0 ${4 + sig * 3}px ${tint}66` } },
          d >= 14 && cat ? cat.glyph : ""
          ),
          showLabels ? /*#__PURE__*/React.createElement("span", { className: "cx-tl2-ev-lbl" }, e.title) : null,
          showLabels && pxPerYear > 0.4 ? /*#__PURE__*/React.createElement("span", { className: "cx-tl2-ev-yr" }, "c. ", yearLabel(e.year)) : null
          ));

      }),


      selected ? (() => {
        const era = ERA_LOOKUP[selected.era];
        const cat = CAT_LOOKUP[selected.category];
        const cardX = clamp(xOf(selected.year), Math.min(180, W / 2), Math.max(W - 180, W / 2));
        return (/*#__PURE__*/
          React.createElement("div", { className: "cx-tl2-card", style: { left: cardX + "px" },
            onPointerDown: (e) => e.stopPropagation(),
            role: "region", "aria-label": `Event detail: ${selected.title}` }, /*#__PURE__*/
          React.createElement("div", { className: "cx-tl2-card-head" }, /*#__PURE__*/
          React.createElement("span", { className: "cx-tl2-card-era", style: { color: era ? era.tint : undefined, borderColor: (era ? era.tint : "#888") + "88", background: (era ? era.tint : "#888") + "22" } },
          (era || { label: selected.era }).label
          ), /*#__PURE__*/
          React.createElement("span", { className: "cx-tl2-card-cat" }, cat ? cat.glyph : "", " ", (cat || { label: selected.category }).label), /*#__PURE__*/
          React.createElement("button", { className: "cx-tl2-card-x", onClick: () => setSelected(null), "aria-label": "Close event detail" }, "\u2715")
          ), /*#__PURE__*/
          React.createElement("h3", { className: "cx-tl2-card-title" }, selected.title), /*#__PURE__*/
          React.createElement("div", { className: "cx-tl2-card-year" }, "c. ",
          yearLabel(selected.year),
          selected.year_range && selected.year_range[0] !== selected.year_range[1] ?
          ` · range ${yearLabel(selected.year_range[0])} – ${yearLabel(selected.year_range[1])}` :
          ""
          ), /*#__PURE__*/
          React.createElement("p", { className: "cx-tl2-card-sum" }, selected.summary),
          selected.scripture && selected.scripture.length ? /*#__PURE__*/
          React.createElement("div", { className: "cx-tl2-card-refs" },
          selected.scripture.map((r, j) => {
            const p = parseScriptureRef(r);
            if (!p) return null;
            return (/*#__PURE__*/
              React.createElement("button", { key: j, className: "cx-tl2-refchip", "data-osis": r,
                onClick: () => gotoRef(r),
                title: `Open the reader at ${p.display}` }, "\u2726 READ ",
              p.display
              ));

          })
          ) :
          null,
          selected.people && selected.people.length ? /*#__PURE__*/
          React.createElement("div", { className: "cx-tl2-card-meta" }, "PEOPLE \xB7 ", selected.people.join(", ")) :
          null,
          selected.places && selected.places.length ? /*#__PURE__*/
          React.createElement("div", { className: "cx-tl2-card-meta" }, "PLACES \xB7 ", selected.places.join(", ")) :
          null, /*#__PURE__*/
          React.createElement("div", { className: "cx-tl2-card-honest" }, "scholarly survey \xB7 dating conventional, not settled")
          ));

      })() : null
      ), /*#__PURE__*/


      React.createElement("div", { className: "cx-tl2-mini", ref: miniRef, role: "slider",
        "aria-label": "Timeline minimap \u2014 drag to move the view",
        "aria-valuemin": Math.round(full.lo), "aria-valuemax": Math.round(full.hi),
        "aria-valuenow": Math.round(view.center), tabIndex: 0,
        onKeyDown: (e) => {
          const stepY = view.span * 0.2;
          if (e.key === "ArrowLeft") {e.preventDefault();animateTo(view.center - stepY, view.span, 200);} else
          if (e.key === "ArrowRight") {e.preventDefault();animateTo(view.center + stepY, view.span, 200);} else
          if (e.key === "+" || e.key === "=") {e.preventDefault();animateTo(view.center, view.span * 0.6, 200);} else
          if (e.key === "-") {e.preventDefault();animateTo(view.center, view.span * 1.6, 200);}
        } },
      strata.map((b) => /*#__PURE__*/
      React.createElement("div", { key: b.era.id, className: "cx-tl2-mini-band",
        style: {
          left: (b.lo - full.lo) / fullSpan * 100 + "%",
          width: Math.max(0.4, (b.hi - b.lo) / fullSpan * 100) + "%",
          background: b.era.tint + "44"
        } })
      ),
      filtered.map((e) => /*#__PURE__*/
      React.createElement("span", { key: e.id, className: "cx-tl2-mini-dot",
        style: { left: (e.year - full.lo) / fullSpan * 100 + "%", height: 3 + sigOf(e) * 2 + "px" } })
      ),
      nowMark ? /*#__PURE__*/React.createElement("span", { className: "cx-tl2-mini-now", style: { left: (nowMark.year - full.lo) / fullSpan * 100 + "%" } }) : null, /*#__PURE__*/
      React.createElement("div", { className: "cx-tl2-mini-win",
        style: {
          left: clamp((view.center - view.span / 2 - full.lo) / fullSpan * 100, 0, 100) + "%",
          width: clamp(view.span / fullSpan * 100, 0.5, 100) + "%"
        } })
      ), /*#__PURE__*/

      React.createElement("div", { className: "cx-tl2-hint" }, "wheel / pinch = zoom \xB7 drag = pan \xB7 click = inspect \xB7 double-click = read \xB7 gold \u2248 where you are reading")
      ));

  }

  // Expose for reuse (same surface as v1 — engines outlive skins)
  window.CODEX_Timeline = { TimelinePanel, loadEvents, ERAS, CATEGORIES };

  // ───────────────────────────────────────────────────────────────────────
  // Plugin registration
  // ───────────────────────────────────────────────────────────────────────
  function registerPlugin() {
    if (!window.CODEX_PLUGINS_API) {
      window.addEventListener("load", registerPlugin, { once: true });
      return;
    }
    try {
      window.CODEX_PLUGINS_API.register({
        id: "biblical-timeline",
        name: "Biblical Timeline",
        version: "2.0.0",
        panels: [{
          id: "timeline",
          label: "TIMELINE",
          glyph: "⏳",
          icon: "⏳",
          render: (ctx) => React.createElement(TimelinePanel, ctx || {})
        }]
      });
    } catch (e) {
      console.warn("[timeline] plugin registration failed:", e);
    }
  }
  registerPlugin();
})();
})();
