// CODEX — Biblical Timeline (Phase 2.2) — horizontal scrollable history of
// every significant biblical event. Pure CSS layout (no SVG), three zoom
// levels, era color bands, category filter chips, search, and a current-
// chapter highlight that listens to codex:navigate so events sharing a ref
// with the active passage glow.
//
// Self-registers as a CODEX plugin via window.CODEX_PLUGINS_API so it
// appears as a TIMELINE tab in the right rail without touching app.jsx or
// panels.jsx.

(function () {
  "use strict";

  const { useState, useEffect, useRef, useMemo, useCallback } = React;

  // ───────────────────────────────────────────────────────────────────────
  // Era metadata — order matters (chronological)
  // ───────────────────────────────────────────────────────────────────────
  const ERAS = [
    { id: "primeval",         label: "Primeval",          tint: "#5a4a8a" },
    { id: "patriarchs",       label: "Patriarchs",        tint: "#7a5a3a" },
    { id: "egypt-exodus",     label: "Egypt & Exodus",    tint: "#b08040" },
    { id: "conquest",         label: "Conquest",          tint: "#a04848" },
    { id: "judges",           label: "Judges",            tint: "#806038" },
    { id: "united-monarchy",  label: "United Monarchy",   tint: "#b89030" },
    { id: "divided-kingdom",  label: "Divided Kingdom",   tint: "#7a8030" },
    { id: "exile",            label: "Exile",             tint: "#406878" },
    { id: "return",           label: "Return",            tint: "#3a8878" },
    { id: "intertestamental", label: "Intertestamental",  tint: "#506060" },
    { id: "life-of-christ",   label: "Life of Christ",    tint: "#c0a040" },
    { id: "apostolic",        label: "Apostolic Age",     tint: "#3098b8" },
    { id: "post-canonical",   label: "Post-Canonical",    tint: "#6850a0" },
  ];
  const ERA_LOOKUP = Object.fromEntries(ERAS.map(e => [e.id, e]));

  const CATEGORIES = [
    { id: "narrative",  label: "Narrative",  glyph: "◆" },
    { id: "prophecy",   label: "Prophecy",   glyph: "✦" },
    { id: "war",        label: "War",        glyph: "⚔" },
    { id: "covenant",   label: "Covenant",   glyph: "◈" },
    { id: "miracle",    label: "Miracle",    glyph: "✺" },
    { id: "council",    label: "Council",    glyph: "❖" },
    { id: "martyrdom",  label: "Martyrdom",  glyph: "✝" },
    { id: "writing",    label: "Writing",    glyph: "✎" },
  ];
  const CAT_LOOKUP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

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
      } finally { State.loading = null; }
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
  function shortYear(y) {
    if (y < 0) return `${-y}`;
    return `${y}`;
  }

  // Canonical OSIS book id → display name. Falls back to capitalized id.
  function bookIdToName(id) {
    const data = window.CODEX_DATA;
    if (data && data.books) {
      // Try common 3-letter osis match
      const direct = data.books.find(b => (b.id || "").toLowerCase() === id);
      if (direct) return direct.name;
      // Some apps use full names as ids
      const guess = data.books.find(b => (b.id || "").toLowerCase().startsWith(id));
      if (guess) return guess.name;
    }
    // Final fallback — fixed lookup of common OSIS abbreviations.
    const FALLBACK = {
      gen:"Genesis", exo:"Exodus", lev:"Leviticus", num:"Numbers", deu:"Deuteronomy",
      jos:"Joshua", jdg:"Judges", rut:"Ruth",
      "1sa":"1 Samuel","2sa":"2 Samuel","1ki":"1 Kings","2ki":"2 Kings",
      "1ch":"1 Chronicles","2ch":"2 Chronicles", ezr:"Ezra", neh:"Nehemiah", est:"Esther",
      job:"Job", psa:"Psalms", pro:"Proverbs", ecc:"Ecclesiastes", sng:"Song of Songs",
      isa:"Isaiah", jer:"Jeremiah", lam:"Lamentations", eze:"Ezekiel", dan:"Daniel",
      hos:"Hosea", joe:"Joel", amo:"Amos", oba:"Obadiah", jon:"Jonah", mic:"Micah",
      nah:"Nahum", hab:"Habakkuk", zep:"Zephaniah", hag:"Haggai", zec:"Zechariah", mal:"Malachi",
      mat:"Matthew", mrk:"Mark", luk:"Luke", jhn:"John", act:"Acts",
      rom:"Romans", "1co":"1 Corinthians","2co":"2 Corinthians", gal:"Galatians",
      eph:"Ephesians", php:"Philippians", col:"Colossians",
      "1th":"1 Thessalonians","2th":"2 Thessalonians","1ti":"1 Timothy","2ti":"2 Timothy",
      tit:"Titus", phm:"Philemon", heb:"Hebrews", jas:"James",
      "1pe":"1 Peter","2pe":"2 Peter","1jn":"1 John","2jn":"2 John","3jn":"3 John",
      jud:"Jude", rev:"Revelation",
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
    const display = verse
      ? `${bookIdToName(bookId)} ${chapter}:${verse}`
      : `${bookIdToName(bookId)} ${chapter}`;
    return { bookId, chapter, verse, display, raw: ref };
  }

  // Does an event reference the given (bookId, chapter)?
  function eventMatchesPassage(ev, bookId, chapter) {
    if (!ev || !ev.scripture || !bookId) return false;
    const wantBook = String(bookId).toLowerCase();
    for (const r of ev.scripture) {
      const p = parseScriptureRef(r);
      if (!p) continue;
      // Match by id prefix to be tolerant of "gen" vs "genesis"
      if (p.bookId === wantBook || wantBook.startsWith(p.bookId) || p.bookId.startsWith(wantBook)) {
        if (!chapter) return true;
        // Check chapter range if event ref is a span
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

  // ───────────────────────────────────────────────────────────────────────
  // Axis decimation — pick a sensible tick interval given pixel budget.
  // ───────────────────────────────────────────────────────────────────────
  function pickTickInterval(spanYears, pxPerYear) {
    // Aim for ~80px between labels.
    const targetPx = 80;
    const wantYears = targetPx / Math.max(pxPerYear, 0.0001);
    const candidates = [10, 25, 50, 100, 200, 250, 500, 1000];
    for (const c of candidates) if (c >= wantYears) return c;
    return 2000;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Main panel
  // ───────────────────────────────────────────────────────────────────────
  function TimelinePanel(ctx) {
    const [events, setEvents] = useState(null);
    const [zoom, setZoom] = useState("detail"); // era | century | detail
    const [filterCats, setFilterCats] = useState(() => new Set(CATEGORIES.map(c => c.id)));
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState(null);
    const [hover, setHover] = useState(null);
    const [containerW, setContainerW] = useState(900);
    const [passage, setPassage] = useState(() => ({
      bookId: (ctx && ctx.passage && ctx.passage.bookId) || null,
      chapter: (ctx && ctx.passage && ctx.passage.chapter) || null,
    }));

    const trackRef = useRef(null);
    const scrollRef = useRef(null);

    // Load data
    useEffect(() => {
      let alive = true;
      loadEvents().then(es => { if (alive) setEvents(es); });
      return () => { alive = false; };
    }, []);

    // Listen for chapter changes
    useEffect(() => {
      function onNav(e) {
        const d = e.detail || {};
        setPassage({ bookId: d.bookId || null, chapter: d.chapter || null });
      }
      window.addEventListener("codex:navigate", onNav);
      return () => window.removeEventListener("codex:navigate", onNav);
    }, []);

    // ResizeObserver — track width for axis decimation
    useEffect(() => {
      const el = trackRef.current;
      if (!el || typeof ResizeObserver === "undefined") return;
      const ro = new ResizeObserver((entries) => {
        for (const ent of entries) {
          const w = ent.contentRect.width;
          if (w > 0) setContainerW(w);
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, [events]);

    // Filter pipeline
    const filtered = useMemo(() => {
      if (!events) return [];
      const q = search.trim().toLowerCase();
      return events.filter(ev => {
        if (!filterCats.has(ev.category)) return false;
        if (q && !(ev.title.toLowerCase().includes(q) || (ev.summary || "").toLowerCase().includes(q))) return false;
        return true;
      });
    }, [events, filterCats, search]);

    // Compute timeline pixel span based on zoom level.
    const { minY, maxY, totalW } = useMemo(() => {
      if (!filtered.length) return { minY: -4000, maxY: 800, totalW: containerW };
      let lo = filtered[0].year, hi = filtered[filtered.length - 1].year;
      lo = Math.floor(lo / 100) * 100 - 50;
      hi = Math.ceil(hi / 100) * 100 + 50;
      // Width scales with zoom: era ~= container width, century ~= 4x, detail ~= 12x
      const factor = zoom === "era" ? 1.4 : zoom === "century" ? 5 : 14;
      const totalW = Math.max(containerW, Math.round((hi - lo) * (containerW / 4000) * factor));
      return { minY: lo, maxY: hi, totalW };
    }, [filtered, zoom, containerW]);

    const pxPerYear = totalW / Math.max(maxY - minY, 1);
    const yearToX = useCallback((y) => (y - minY) * pxPerYear, [minY, pxPerYear]);

    // Era bands (rounded background tints)
    const eraBands = useMemo(() => {
      if (!filtered.length) return [];
      const bands = [];
      for (const era of ERAS) {
        const inEra = filtered.filter(e => e.era === era.id);
        if (!inEra.length) continue;
        const lo = Math.min(...inEra.map(e => e.year_range ? e.year_range[0] : e.year));
        const hi = Math.max(...inEra.map(e => e.year_range ? e.year_range[1] : e.year));
        bands.push({ era, lo, hi });
      }
      return bands;
    }, [filtered]);

    // Axis ticks
    const ticks = useMemo(() => {
      const span = maxY - minY;
      const interval = pickTickInterval(span, pxPerYear);
      const start = Math.ceil(minY / interval) * interval;
      const out = [];
      for (let y = start; y <= maxY; y += interval) out.push(y);
      return out;
    }, [minY, maxY, pxPerYear]);

    // Bucket events at era/century zoom levels so markers don't pile up.
    const renderedMarkers = useMemo(() => {
      if (zoom === "detail" || !filtered.length) {
        return filtered.map(e => ({ kind: "event", ev: e }));
      }
      const bucketSize = zoom === "era" ? 200 : 100;
      const buckets = new Map();
      for (const e of filtered) {
        const k = Math.floor(e.year / bucketSize) * bucketSize;
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push(e);
      }
      const out = [];
      for (const [k, list] of buckets) {
        if (list.length === 1) out.push({ kind: "event", ev: list[0] });
        else out.push({ kind: "bucket", year: k + bucketSize / 2, list });
      }
      return out;
    }, [filtered, zoom]);

    // Category filter toggle
    const toggleCat = useCallback((id) => {
      setFilterCats(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        if (next.size === 0) return new Set(CATEGORIES.map(c => c.id));
        return next;
      });
    }, []);

    // When a scripture ref is clicked
    const onJumpRef = useCallback((rawRef) => {
      const p = parseScriptureRef(rawRef);
      if (!p) return;
      if (typeof window.codexJumpToRef === "function") {
        window.codexJumpToRef(p.display);
      } else {
        window.dispatchEvent(new CustomEvent("codex:navigate", {
          detail: { book: bookIdToName(p.bookId), bookId: p.bookId, chapter: p.chapter, verse: p.verse || 1 },
        }));
      }
    }, []);

    // Auto-scroll to selected when it changes
    useEffect(() => {
      if (!selected || !scrollRef.current) return;
      const x = yearToX(selected.year);
      const sw = scrollRef.current.clientWidth;
      scrollRef.current.scrollTo({ left: Math.max(0, x - sw / 2), behavior: "smooth" });
    }, [selected, yearToX]);

    if (!events) {
      return React.createElement("div", { className: "cx-tl-root cx-tl-loading" },
        React.createElement("div", { className: "cx-tl-skel" }, "loading biblical timeline…"));
    }

    return (
      <div className="cx-tl-root">
        {/* Header: zoom + filters + search */}
        <div className="cx-tl-head">
          <div className="cx-tl-title">
            <span className="cx-tl-title-main">Biblical Timeline</span>
            <span className="cx-tl-title-meta">{filtered.length} events</span>
          </div>
          <div className="cx-tl-controls">
            <div className="cx-tl-zoom" role="tablist" aria-label="Timeline zoom">
              {["era", "century", "detail"].map(z =>
                <button key={z}
                  className={"cx-tl-zoom-btn" + (zoom === z ? " is-on" : "")}
                  onClick={() => setZoom(z)}
                  aria-pressed={zoom === z}>{z.toUpperCase()}</button>
              )}
            </div>
            <input
              className="cx-tl-search"
              type="search"
              placeholder="search events…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Category filter chips */}
        <div className="cx-tl-chips">
          {CATEGORIES.map(c => {
            const on = filterCats.has(c.id);
            return (
              <button key={c.id}
                className={"cx-tl-chip cx-tl-chip-" + c.id + (on ? " is-on" : "")}
                onClick={() => toggleCat(c.id)}
                aria-pressed={on}
                title={c.label}>
                <span className="cx-tl-chip-glyph">{c.glyph}</span>
                <span className="cx-tl-chip-lbl">{c.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable horizontal timeline */}
        <div className="cx-tl-scroll" ref={scrollRef}>
          <div className="cx-tl-track" ref={trackRef} style={{ width: totalW + "px" }}>
            {/* Era color bands behind everything */}
            <div className="cx-tl-bands">
              {eraBands.map(b => (
                <div key={b.era.id}
                     className="cx-tl-band"
                     title={b.era.label}
                     style={{
                       left: yearToX(b.lo) + "px",
                       width: Math.max(8, yearToX(b.hi) - yearToX(b.lo)) + "px",
                       background: `linear-gradient(180deg, ${b.era.tint}22, ${b.era.tint}10)`,
                       borderColor: `${b.era.tint}55`,
                     }}>
                  <span className="cx-tl-band-label">{b.era.label}</span>
                </div>
              ))}
            </div>

            {/* Center axis line */}
            <div className="cx-tl-axis" />

            {/* Year tick labels */}
            <div className="cx-tl-ticks">
              {ticks.map(y => (
                <div key={y} className="cx-tl-tick" style={{ left: yearToX(y) + "px" }}>
                  <div className="cx-tl-tick-mark" />
                  <div className="cx-tl-tick-lbl">{yearLabel(y)}</div>
                </div>
              ))}
            </div>

            {/* Event markers */}
            <div className="cx-tl-markers">
              {renderedMarkers.map((m, i) => {
                if (m.kind === "bucket") {
                  return (
                    <button key={"b" + i}
                      className="cx-tl-bucket"
                      style={{ left: yearToX(m.year) + "px" }}
                      onClick={() => { setZoom("detail"); setSelected(m.list[0]); }}
                      title={`${m.list.length} events near ${yearLabel(Math.round(m.year))}`}>
                      <span className="cx-tl-bucket-n">{m.list.length}</span>
                    </button>
                  );
                }
                const e = m.ev;
                const era = ERA_LOOKUP[e.era];
                const cat = CAT_LOOKUP[e.category];
                const isHere = passage.bookId && eventMatchesPassage(e, passage.bookId, passage.chapter);
                const isSel = selected && selected.id === e.id;
                const top = (Math.abs(hashStr(e.id)) % 5) * 12; // gentle vertical stagger to reduce overlap
                return (
                  <button
                    key={e.id}
                    className={"cx-tl-mark cx-tl-mark-" + e.category + (isHere ? " is-here" : "") + (isSel ? " is-sel" : "")}
                    style={{
                      left: yearToX(e.year) + "px",
                      top: top + "px",
                      borderColor: era ? era.tint : "var(--cx-line)",
                    }}
                    onMouseEnter={() => setHover(e)}
                    onMouseLeave={() => setHover(h => h && h.id === e.id ? null : h)}
                    onFocus={() => setHover(e)}
                    onBlur={() => setHover(h => h && h.id === e.id ? null : h)}
                    onClick={() => setSelected(e)}
                    aria-label={`${e.title} (${yearLabel(e.year)})`}>
                    <span className="cx-tl-mark-stem" style={{ background: era ? era.tint : "var(--cx-fg-dim)" }} />
                    <span className="cx-tl-mark-dot" style={{ background: era ? era.tint : "var(--cx-fg)" }}>
                      {cat ? cat.glyph : "●"}
                    </span>
                    {zoom === "detail" && (
                      <span className="cx-tl-mark-lbl">{e.title}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Hover tooltip */}
            {hover && (
              <div className="cx-tl-tip"
                   style={{ left: yearToX(hover.year) + "px" }}>
                <div className="cx-tl-tip-title">{hover.title}</div>
                <div className="cx-tl-tip-year">{yearLabel(hover.year)}</div>
                <div className="cx-tl-tip-sum">{hover.summary}</div>
              </div>
            )}
          </div>
        </div>

        {/* Detail card */}
        {selected ? (
          <div className="cx-tl-detail">
            <div className="cx-tl-detail-head">
              <div className="cx-tl-detail-era"
                   style={{ background: (ERA_LOOKUP[selected.era] || {}).tint + "33",
                            borderColor: (ERA_LOOKUP[selected.era] || {}).tint + "88" }}>
                {(ERA_LOOKUP[selected.era] || { label: selected.era }).label}
              </div>
              <div className="cx-tl-detail-cat">
                {(CAT_LOOKUP[selected.category] || {}).glyph} {(CAT_LOOKUP[selected.category] || { label: selected.category }).label}
              </div>
              <button className="cx-tl-detail-x" onClick={() => setSelected(null)} aria-label="Close">✕</button>
            </div>
            <h3 className="cx-tl-detail-title">{selected.title}</h3>
            <div className="cx-tl-detail-year">{yearLabel(selected.year)}
              {selected.year_range && (selected.year_range[0] !== selected.year_range[1])
                ? <span className="cx-tl-detail-range"> · range {yearLabel(selected.year_range[0])} – {yearLabel(selected.year_range[1])}</span>
                : null}
            </div>
            <p className="cx-tl-detail-sum">{selected.summary}</p>
            {selected.scripture && selected.scripture.length > 0 && (
              <div className="cx-tl-detail-refs">
                <div className="cx-tl-detail-refs-h">Scripture</div>
                <div className="cx-tl-detail-refs-list">
                  {selected.scripture.map((r, i) => {
                    const p = parseScriptureRef(r);
                    if (!p) return null;
                    return (
                      <button key={i} className="cx-tl-ref"
                              onClick={() => onJumpRef(r)}>{p.display}</button>
                    );
                  })}
                </div>
              </div>
            )}
            {selected.people && selected.people.length > 0 && (
              <div className="cx-tl-detail-meta">
                <span className="cx-tl-detail-meta-h">People:</span>{" "}
                {selected.people.join(", ")}
              </div>
            )}
            {selected.places && selected.places.length > 0 && (
              <div className="cx-tl-detail-meta">
                <span className="cx-tl-detail-meta-h">Places:</span>{" "}
                {selected.places.join(", ")}
              </div>
            )}
          </div>
        ) : (
          <div className="cx-tl-hint">
            Click any marker to see the event. Use the zoom buttons to widen or compress the axis. Events tied to your current passage glow.
          </div>
        )}
      </div>
    );
  }

  // Cheap deterministic hash for stable per-event vertical stagger
  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return h;
  }

  // Expose for reuse
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
        version: "1.0.0",
        panels: [{
          id: "timeline",
          label: "TIMELINE",
          glyph: "⏳",
          icon: "⏳",
          render: (ctx) => React.createElement(TimelinePanel, ctx),
        }],
      });
    } catch (e) {
      console.warn("[timeline] plugin registration failed:", e);
    }
  }
  registerPlugin();
})();
