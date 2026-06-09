// CODEX — verse mirror · the Temporal Intelligence Console.
//
// "Palantir for the Bible": for any verse, an analyst-grade survey of how the
// passage echoes through recorded history — rendered as a live link-analysis
// cascade, not a wall of text.
//
//   · RESONANCE CASCADE  — canvas timeline from the verse's own year to the
//                          present; every historical parallel and modern
//                          resonance is a glowing node, connected back to the
//                          verse-origin by a swept arc. Node size + glow scale
//                          with AI-scored resonance intensity (0-100).
//   · DOSSIERS           — each event is an intel card: ID stamp, year/place
//                          readout, signal-strength grading, source link.
//   · PROPHECY SPREAD    — eschatological schools side-by-side (premil, amil,
//                          preterist, historicist, idealist…) — surveyed,
//                          never endorsed.
//   · CROSS-REFS         — clickable canonical jumps.
//   · TICKER             — cycling one-line event feed at the console foot.
//
// Honesty is part of the aesthetic: a classification banner marks everything
// as SCHOLARLY SURVEY · NOT PREDICTION, contested parallels carry a CONTESTED
// stamp, and the caveats section always renders when present.
//
// Schema v2 (cached with _schema: 2): events gain lat/lng (so the Map console
// can plot them on its RESONANCE layer), intensity 0-100, contested flag, and
// a top-level `pattern` line naming the recurring structure the events share.
// v1 caches still render; a RE-ANALYZE control upgrades them in place.
//
// Cached forever in localStorage by verse key
// (codex.mirrors.${bookId}.${chapter}.${verse}).

const MIRROR_SCHEMA_V = 2;

const MIRROR_PROMPT = `You are CODEX MIRROR — a comparative-historian and scholar of biblical resonance through history. For the given verse, return a single JSON object surveying its historical parallels, modern geopolitical resonances, prophetic interpretive traditions, and canonical cross-references. Calm, scholarly, neutral. No prose outside the JSON. No fences.

Schema:
{
  "theme":     "1 short clause naming the verse's central theme that drives the mirroring (e.g. 'covenant fidelity tested by exile').",
  "summary":   "2 sentences situating the verse's enduring resonance — why scholars + theologians return to it across history.",
  "verseYear": <integer year the verse's events happened (or book written for non-narrative), negative = BCE>,
  "pattern":   "1 sentence naming the recurring STRUCTURAL pattern the parallels share (e.g. 'an empire at its peak humiliated within a generation of deifying itself') — the shape an analyst would flag.",

  "historicalParallels": [
    // 4-6 events FROM HISTORY that mirror this passage. Span multiple eras
    // and geographies. Each: a real event with verifiable name + approximate
    // date. The 'connection' is a SCHOLARLY observation, never a sermon.
    {
      "era":        "Era / period (e.g. '6th cent. BCE', 'Reformation')",
      "year":       <integer year, negative = BCE; best estimate>,
      "event":      "Named event (e.g. 'Babylonian conquest of Judah')",
      "place":      "Geographic centre (e.g. 'Jerusalem')",
      "lat":        <decimal latitude of that place>,
      "lng":        <decimal longitude>,
      "intensity":  <0-100 — strength of the scholarly resonance: how directly and how often scholars have drawn this parallel>,
      "connection": "1-2 sentences on the parallel — what scholars notice. Cite the figure/source if well-known.",
      "wiki":       "EN-Wikipedia article slug if confident (e.g. 'Council_of_Nicaea'). Empty string if unsure."
    }
  ],

  "modernResonances": [
    // 2-5 RECENT geopolitical events (last ~30 years, prefer last 10) where
    // commentators / theologians / journalists have drawn parallels with
    // this passage. Cite the OBSERVER, not just the event, when the parallel
    // is contested. Don't invent events.
    {
      "year":       <integer year>,
      "event":      "Real, named event",
      "place":      "Geographic centre",
      "lat":        <decimal latitude>,
      "lng":        <decimal longitude>,
      "intensity":  <0-100 — strength/frequency of the drawn parallel>,
      "contested":  <true if the parallel is disputed or partisan>,
      "connection": "1-2 sentences — who has drawn the parallel and why. Note when contested.",
      "wiki":       "EN-Wikipedia article slug if confident. Empty string if unsure."
    }
  ],

  "propheticReadings": [
    // 3-5 entries surveying how DIFFERENT eschatological schools read the
    // verse. ALWAYS multiple traditions side-by-side (you are a surveyor,
    // not an advocate). Possible: 'Premillennial', 'Amillennial',
    // 'Postmillennial', 'Preterist', 'Historicist', 'Idealist',
    // 'Dispensationalist', 'Rabbinic', 'Patristic', 'Apocalyptic-Gnostic'.
    {
      "tradition":      "Tradition name",
      "interpretation": "1-3 sentences — calm scholarly summary, never endorsement.",
      "keyVoice":       "1-line cite of a representative voice. Empty string if not famous."
    }
  ],

  "crossReferences": [
    // 4-8 canonical cross-refs — verses that resonate with this one.
    { "ref": "Book ch:vv", "note": "1 short clause — under 12 words." }
  ],

  "caveats": [
    // 1-3 short scholarly caveats — interpretive limits, contested
    // attributions, genre constraints.
    "..."
  ]
}

Rules:
- Real events only. No invented figures. If unsure of a date, best estimate marked 'c.' in the era.
- lat/lng must be real-world coordinates of the named place. No invented numbers.
- intensity reflects the documented weight of the parallel in scholarship/commentary — not drama.
- Multiple prophetic traditions ALWAYS. Never just one — the value is in the spread.
- Modern resonances must cite a real observer when the parallel is non-obvious; set contested honestly.
- crossReferences use canonical book names ("John 1:1", "1 Corinthians 13:4-8").
- Calm scholarly tone. No exclamations. No emoji.
- Return ONLY the JSON object.`;

// Navigate the reader to a cross-reference. Prefer the prop wired from
// app.jsx; fall back to the global jump fn so the Mirror still works when
// opened from contexts that don't pass onJumpRef.
function mirrorJumpRef(onJumpRef, ref) {
  if (typeof onJumpRef === "function") return onJumpRef(ref);
  if (typeof window.codexJumpToRef === "function") return window.codexJumpToRef(ref);
}

function VerseMirror({ verse, refStr, verseText, passage, primary, onClose, onJumpRef }) {
  const I = window.CODEX_INTEL;
  const key = `codex.mirrors.${passage.bookId}.${passage.chapter}.${verse?.n}`;
  const [data, setData] = useState(() => {
    try { const raw = localStorage.getItem(key); if (raw) return JSON.parse(raw); }
    catch {}
    return null;
  });
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(!data);

  useEffect(() => {
    if (data) return;
    let cancelled = false;
    (async () => {
      try {
        const obj = await I.intelAI({
          system: MIRROR_PROMPT,
          user: `Verse: ${refStr}\nText: ${verseText}\n\nReturn the JSON object.`,
          maxTokens: 3600,
        });
        if (cancelled) return;
        obj._schema = MIRROR_SCHEMA_V;
        try { localStorage.setItem(key, JSON.stringify(obj)); } catch {}
        setData(obj);
        setLoading(false);
        // Depth signal — mirrors are deep study; the engagement engine
        // listens for this on the bus (guarded, Lite-safe, never throws).
        try {
          window.dispatchEvent(new CustomEvent("codex:depth-action", {
            detail: { type: "gnosis-read", ref: refStr, weight: 1, domain: null },
          }));
        } catch {}
      } catch (e) {
        if (cancelled) return;
        setErr(String(e.message || e));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [key, data]);

  // ESC closes
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const reanalyze = () => {
    try { localStorage.removeItem(key); } catch {}
    setData(null);
    setErr(null);
    setLoading(true);
  };

  const isLegacy = data && (data._schema || 1) < MIRROR_SCHEMA_V;

  return (
    <div className="cx-mirror-backdrop" onClick={onClose} role="dialog" aria-label="Verse mirror — temporal intelligence console">
      <div className="cx-mirror" onClick={e => e.stopPropagation()}>
        <span className="cx-corner cx-tl" />
        <span className="cx-corner cx-tr" />
        <span className="cx-corner cx-bl" />
        <span className="cx-corner cx-br" />

        <header className="cx-mirror-h">
          <span className="cx-mirror-h-tag">CODEX · MIRROR</span>
          <span className="cx-mirror-h-ref">{refStr}</span>
          {data?.theme ? <span className="cx-mirror-h-theme">— {data.theme}</span> : null}
          {data ? (
            <button
              className="cx-mirror-rean"
              onClick={reanalyze}
              title={isLegacy ? "Re-analyze with the v2 engine (adds cascade + geo intel)" : "Re-analyze this verse"}
            >{isLegacy ? "⟲ UPGRADE INTEL" : "⟲"}</button>
          ) : null}
          <button className="cx-mirror-x" onClick={onClose} aria-label="Close" title="Close (ESC)">×</button>
        </header>

        <IntelBanner console="MIRROR" scope="PATTERN ANALYSIS" />

        {loading ? (
          <div className="cx-mirror-loading">
            <div className="cx-mirror-spin"><i/><i/><i/><i/></div>
            <span>CORRELATING · HISTORY · SIGNALS · PROPHECY</span>
            <span className="cx-mirror-loading-sub">sweeping 3,000 years of open record for structural resonance…</span>
            <span className="cx-mirror-loading-epigraph">“the word of God is living and active, sharper than any two-edged sword” — Heb 4:12</span>
          </div>
        ) : err ? (
          <div className="cx-mirror-err">
            <b>MIRROR ORACLE OFFLINE</b>
            <code>{err}</code>
            {/credential|authentic|api key|no .*_api_key|401|403|provider/i.test(err) ? (
              <span className="cx-mirror-err-hint">
                Add an AI provider API key in Settings → AI Model, then reopen the Mirror.
              </span>
            ) : null}
          </div>
        ) : data ? (
          <MirrorBody data={data} refStr={refStr} onJumpRef={onJumpRef} />
        ) : null}
      </div>
    </div>
  );
}

// ── Console body ─────────────────────────────────────────────────────────
function MirrorBody({ data, refStr, onJumpRef }) {
  const I = window.CODEX_INTEL;
  const [hoverId, setHoverId] = useState(null);

  // Unified event list powering the cascade, dossiers and ticker.
  const events = useMemo(() => {
    const out = [];
    (data.historicalParallels || []).forEach((h, i) => out.push({
      ...h, id: `H-${String(i + 1).padStart(2, "0")}`, kind: "hist",
    }));
    (data.modernResonances || []).forEach((m, i) => out.push({
      ...m, id: `M-${String(i + 1).padStart(2, "0")}`, kind: "mod",
    }));
    return out.filter(e => typeof e.year === "number");
  }, [data]);

  const tickerItems = useMemo(() => events.map(e =>
    `${I.intelFmtYear(e.year)} · ${(e.place || "").toUpperCase()} · ${e.event}`
  ), [events]);

  const scrollToDossier = (id) => {
    const el = document.querySelector(`[data-mirror-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("is-flash");
      setTimeout(() => el.classList.remove("is-flash"), 1200);
    }
  };

  return (
    <>
      <div className="cx-mirror-body">
        {data.summary ? <p className="cx-mirror-summary">{data.summary}</p> : null}

        {data.pattern ? (
          <div className="cx-mirror-pattern">
            <span className="cx-mirror-pattern-tag">PATTERN LOCK</span>
            <IntelDecrypt text={data.pattern} className="cx-mirror-pattern-line" as="span" />
          </div>
        ) : null}

        <div className="cx-mirror-counts" aria-hidden="true">
          <span>{String((data.historicalParallels || []).length).padStart(2, "0")} HISTORICAL</span>
          <span>{String((data.modernResonances || []).length).padStart(2, "0")} MODERN</span>
          <span>{String((data.propheticReadings || []).length).padStart(2, "0")} TRADITIONS</span>
          <span>{String((data.crossReferences || []).length).padStart(2, "0")} XREFS</span>
        </div>

        {events.length ? (
          <ResonanceCascade
            events={events}
            verseYear={typeof data.verseYear === "number" ? data.verseYear : Math.min(...events.map(e => e.year), 0)}
            refStr={refStr}
            hoverId={hoverId}
            onHover={setHoverId}
            onPick={scrollToDossier}
          />
        ) : null}

        {data.historicalParallels?.length ? (
          <MirrorSection tag="HISTORY" title="Historical parallels" color="cyan">
            <ol className="cx-mirror-list">
              {events.filter(e => e.kind === "hist").map(h => (
                <MirrorDossier key={h.id} ev={h} hoverId={hoverId} onHover={setHoverId} />
              ))}
            </ol>
          </MirrorSection>
        ) : null}

        {data.modernResonances?.length ? (
          <MirrorSection tag="SIGNALS" title="Modern geopolitical resonances" color="amber">
            <ol className="cx-mirror-list">
              {events.filter(e => e.kind === "mod").map(m => (
                <MirrorDossier key={m.id} ev={m} hoverId={hoverId} onHover={setHoverId} />
              ))}
            </ol>
          </MirrorSection>
        ) : null}

        {data.propheticReadings?.length ? (
          <MirrorSection tag="PROPHECY" title="Prophetic interpretive traditions" color="violet">
            <div className="cx-mirror-spread">
              {data.propheticReadings.map((p, i) => (
                <div key={i} className="cx-mirror-trad">
                  <header>
                    <IntelStamp code={`P-${String(i + 1).padStart(2, "0")}`} tone="violet" />
                    <span className="cx-mirror-tradition">{p.tradition}</span>
                  </header>
                  <p>{p.interpretation}</p>
                  {p.keyVoice ? <small>{p.keyVoice}</small> : null}
                </div>
              ))}
            </div>
          </MirrorSection>
        ) : null}

        {data.crossReferences?.length ? (
          <MirrorSection tag="CROSS-REFS" title="Canonical cross-references" color="cyan">
            <ul className="cx-mirror-xref">
              {data.crossReferences.map((x, i) => (
                <li
                  key={i}
                  onClick={() => mirrorJumpRef(onJumpRef, x.ref)}
                  className="is-clickable"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); mirrorJumpRef(onJumpRef, x.ref); } }}
                  title={`Jump to ${x.ref}`}
                >
                  <b>{x.ref}</b>
                  <span>{x.note}</span>
                </li>
              ))}
            </ul>
          </MirrorSection>
        ) : null}

        {data.caveats?.length ? (
          <MirrorSection tag="CAVEATS" title="Scholarly caveats" color="dim">
            <ul className="cx-mirror-caveats">
              {data.caveats.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </MirrorSection>
        ) : null}

        {events.some(e => typeof e.lat === "number") ? (
          <div className="cx-mirror-maphint">
            ⌖ these events carry coordinates — open <b>MAP</b> on this verse and enable the <b>RESONANCE</b> layer to plot them.
          </div>
        ) : null}
      </div>

      <IntelTicker items={tickerItems} className="cx-mirror-ticker" />
    </>
  );
}

// ── Resonance cascade — the canvas timeline ─────────────────────────────
// X-axis: verse year → present, power-compressed so antiquity doesn't crush
// the modern era. Arcs sweep in once (≈1.4s, staggered); after that the
// canvas re-renders statically on hover/resize. Hit-testing on mousemove.
function ResonanceCascade({ events, verseYear, refStr, hoverId, onHover, onPick }) {
  const I = window.CODEX_INTEL;
  const canvasRef = useRef(null);
  const nodesRef = useRef([]);        // [{id, x, y, r}] for hit-testing
  const animRef = useRef({ done: I.intelReducedMotion(), start: 0, raf: 0 });

  const Y0 = Math.min(verseYear, ...events.map(e => e.year));
  const Y1 = 2030;
  const xOf = (yr, w, pad) => {
    const t = Math.max(0, Math.min(1, (yr - Y0) / (Y1 - Y0)));
    return pad + Math.pow(t, 0.62) * (w - pad * 2);
  };

  const draw = (progress) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { w, h } = I.intelCanvas.fit(canvas);
    const pad = 26, baseY = h - 34;
    ctx.clearRect(0, 0, w, h);
    const accent = I.intelCanvas.accent();
    const amber = "#e8b465";
    const dimC = "rgba(128,140,160,0.5)";

    // Baseline + year ticks
    ctx.save();
    ctx.strokeStyle = "rgba(128,140,160,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, baseY); ctx.lineTo(w - pad, baseY); ctx.stroke();
    ctx.fillStyle = dimC;
    ctx.font = "8.5px ui-monospace, monospace";
    ctx.textAlign = "center";
    const span = Y1 - Y0;
    const step = span > 2500 ? 1000 : span > 1200 ? 500 : span > 400 ? 200 : 100;
    for (let yr = Math.ceil(Y0 / step) * step; yr <= Y1; yr += step) {
      const x = xOf(yr, w, pad);
      ctx.beginPath(); ctx.moveTo(x, baseY); ctx.lineTo(x, baseY + 4); ctx.stroke();
      ctx.fillText(yr < 0 ? `${Math.abs(yr)}BCE` : `${yr}`, x, baseY + 14);
    }
    ctx.restore();

    // Origin node — the verse itself.
    const ox = xOf(verseYear, w, pad);
    I.intelCanvas.node(ctx, ox, baseY, { color: accent, weight: 100, alpha: 1 });
    ctx.save();
    ctx.fillStyle = accent;
    ctx.font = "600 9px ui-monospace, monospace";
    ctx.textAlign = ox < w / 2 ? "left" : "right";
    ctx.fillText(refStr.toUpperCase(), ox < w / 2 ? ox + 10 : ox - 10, baseY - 8);
    ctx.restore();

    // Arcs + event nodes (staggered sweep on first paint).
    const nodes = [];
    const n = events.length;
    events.forEach((e, i) => {
      const x = xOf(e.year, w, pad);
      const isHover = hoverId === e.id;
      const color = e.kind === "mod" ? amber : accent;
      const stagger = n > 1 ? (i / (n * 1.6)) : 0;
      const t = progress >= 1 ? 1 : Math.max(0, Math.min(1, (progress - stagger) / (1 - stagger || 1)));
      const dist = Math.abs(x - ox);
      const bow = -Math.min(0.42 * (h - 50), 14 + dist * 0.22);
      if (t > 0 && dist > 2) {
        I.intelCanvas.arc(ctx, ox, baseY, x, baseY, {
          color, bow, t,
          width: isHover ? 1.6 : 1,
          alpha: isHover ? 0.95 : (hoverId ? 0.25 : 0.55),
          glow: isHover ? 10 : 5,
        });
      }
      if (t >= 1 || progress >= 1) {
        const r = I.intelCanvas.node(ctx, x, baseY, {
          color, weight: e.intensity || 50,
          alpha: isHover ? 1 : (hoverId ? 0.45 : 0.9),
        });
        nodes.push({ id: e.id, x, y: baseY, r: r + 5 });
        if (isHover) {
          ctx.save();
          ctx.fillStyle = color;
          ctx.font = "600 9px ui-monospace, monospace";
          ctx.textAlign = x < w / 2 ? "left" : "right";
          const lbl = `${e.id} · ${I.intelFmtYear(e.year)} · ${(e.place || "").toUpperCase()}`;
          ctx.fillText(lbl, x < w / 2 ? x + 9 : x - 9, baseY - 16 + bow * 0.35);
          ctx.restore();
        }
      }
    });
    nodesRef.current = nodes;
  };

  // Initial animated sweep — once per data set.
  useEffect(() => {
    const anim = animRef.current;
    if (anim.done) { draw(1); return; }
    let cancelled = false;
    const DUR = 1400;
    const step = (ts) => {
      if (cancelled) return;
      if (!anim.start) anim.start = ts;
      const p = Math.min(1, (ts - anim.start) / DUR);
      draw(p);
      if (p < 1) anim.raf = requestAnimationFrame(step);
      else anim.done = true;
    };
    anim.raf = requestAnimationFrame(step);
    return () => { cancelled = true; cancelAnimationFrame(anim.raf); };
  }, [events]);

  // Static redraw on hover change / resize after the sweep.
  useEffect(() => {
    if (animRef.current.done) draw(1);
  }, [hoverId]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { if (animRef.current.done) draw(1); });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [events, hoverId]);

  const hit = (evt) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = evt.clientX - rect.left, my = evt.clientY - rect.top;
    let best = null, bestD = 14;
    nodesRef.current.forEach(nd => {
      const d = Math.hypot(nd.x - mx, nd.y - my);
      if (d < Math.max(nd.r, 10) + 4 && d < bestD) { best = nd; bestD = d; }
    });
    return best;
  };

  return (
    <div className="cx-mirror-cascade">
      <div className="cx-mirror-cascade-h">
        <span className="cx-mirror-cascade-tag">RESONANCE CASCADE</span>
        <span className="cx-mirror-cascade-legend">
          <i className="is-hist" /> HISTORICAL
          <i className="is-mod" /> MODERN
          <span className="cx-mirror-cascade-hint">node ∝ resonance strength</span>
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="cx-mirror-canvas"
        style={{ cursor: hoverId ? "pointer" : "default" }}
        onMouseMove={(e) => onHover(hit(e)?.id || null)}
        onMouseLeave={() => onHover(null)}
        onClick={(e) => { const nd = hit(e); if (nd) onPick(nd.id); }}
        aria-label="Resonance cascade — timeline of historical parallels"
        role="img"
      />
    </div>
  );
}

// ── Dossier card — one event ─────────────────────────────────────────────
function MirrorDossier({ ev, hoverId, onHover }) {
  const I = window.CODEX_INTEL;
  const hasGeo = typeof ev.lat === "number" && typeof ev.lng === "number";
  return (
    <li
      className={`cx-mirror-event ${ev.kind === "mod" ? "is-modern" : ""} ${hoverId === ev.id ? "is-hot" : ""}`}
      data-mirror-id={ev.id}
      onMouseEnter={() => onHover(ev.id)}
      onMouseLeave={() => onHover(null)}
    >
      <header>
        <IntelStamp code={ev.id} tone={ev.kind === "mod" ? "amber" : "accent"} />
        <span className="cx-mirror-event-yr">{I.intelFmtYear(ev.year)}</span>
        <span className="cx-mirror-event-place">{ev.place}</span>
        {ev.era ? <span className="cx-mirror-event-era">{ev.era}</span> : null}
        {ev.contested ? <IntelStamp code="CONTESTED" tone="red" /> : null}
        {typeof ev.intensity === "number" ? <IntelBars value={ev.intensity} label="resonance" className="cx-mirror-event-bars" /> : null}
      </header>
      <h4>
        {ev.wiki
          ? <a href={`https://en.wikipedia.org/wiki/${encodeURIComponent(ev.wiki)}`}
               target="_blank" rel="noopener noreferrer">{ev.event} ↗</a>
          : ev.event}
      </h4>
      <p>{ev.connection}</p>
      {hasGeo ? (
        <span className="cx-mirror-event-geo">⌖ {ev.lat.toFixed(2)}°, {ev.lng.toFixed(2)}°</span>
      ) : null}
    </li>
  );
}

function MirrorSection({ tag, title, color, children }) {
  const [open, setOpen] = useState(true);
  return (
    <section className={`cx-mirror-sect is-${color} ${open ? "is-open" : "is-collapsed"}`}>
      <header
        className="cx-mirror-sect-h is-clickable"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        title={open ? "Collapse" : "Expand"}
        onClick={() => setOpen(o => !o)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(o => !o); } }}
      >
        <span className="cx-mirror-sect-tag">{tag}</span>
        <h3>{title}</h3>
        <span className="cx-mirror-sect-caret" aria-hidden="true">{open ? "▾" : "▸"}</span>
      </header>
      {open ? children : null}
    </section>
  );
}

Object.assign(window, { VerseMirror });
