// CODEX — verse mirror · geopolitical / prophetic resonance for any verse.
//
// Sister to verse-map.jsx and verse-art.jsx. Asks Claude to surface, for the
// selected verse:
//
//   · historicalParallels  — events through history that mirror the passage's
//                            theme (3-6, with date + place + brief connection)
//   · modernResonances     — recent geopolitical events (last ~30 years) where
//                            scholars / commentators have drawn parallels
//   · propheticReadings    — eschatological interpretations from MULTIPLE
//                            traditions (premillennial, amillennial, preterist,
//                            historicist, idealist) — never endorses one
//   · crossReferences      — clickable canonical cross-refs (jumpable in app)
//
// All AI text is flagged as scholarly survey, not prediction. The prompt
// requires multiple traditions for any prophetic content, and the UI labels
// each prophetic block by its school so the reader sees the spread.
//
// Cached forever in localStorage by verse key (codex.mirrors.${bookId}.${chapter}.${verse}).

const MIRROR_PROMPT = `You are CODEX MIRROR — a comparative-historian and scholar of biblical resonance through history. For the given verse, return a single JSON object surveying its historical parallels, modern geopolitical resonances, prophetic interpretive traditions, and canonical cross-references. Calm, scholarly, neutral. No prose outside the JSON. No fences.

Schema:
{
  "theme":               "1 short clause naming the verse's central theme that drives the mirroring (e.g. 'covenant fidelity tested by exile', 'the displacement of empire by a new king').",
  "summary":             "2 sentences situating the verse's enduring resonance — why scholars + theologians return to it across history.",

  "historicalParallels": [
    // 3-6 events FROM HISTORY that mirror this passage. Span multiple eras
    // and geographies. Each: a real event with verifiable name + approximate
    // date. The 'connection' is a SCHOLARLY observation, never a sermon.
    {
      "era":        "Era / period (e.g. '6th cent. BCE', 'Roman late antiquity', 'Reformation')",
      "year":       <integer year, negative = BCE; best estimate>,
      "event":      "Named event (e.g. 'Babylonian conquest of Judah', 'Council of Nicaea')",
      "place":      "Geographic centre (e.g. 'Jerusalem', 'Constantinople')",
      "connection": "1-2 sentences on the parallel — what scholars notice. Cite the figure/source if well-known.",
      "wiki":       "EN-Wikipedia article slug if confident (e.g. 'Council_of_Nicaea'). Empty string if unsure."
    }
  ],

  "modernResonances": [
    // 2-5 RECENT geopolitical events (last ~30 years, prefer last 10) where
    // commentators / theologians / journalists have drawn parallels with
    // this passage. Be careful: cite the OBSERVER, not just the event, when
    // the parallel is contested. Don't invent events.
    {
      "year":       <integer year>,
      "event":      "Real, named event",
      "place":      "Geographic centre",
      "connection": "1-2 sentences — who has drawn the parallel and why. Note when contested.",
      "wiki":       "EN-Wikipedia article slug if confident. Empty string if unsure."
    }
  ],

  "propheticReadings": [
    // 3-5 entries surveying how DIFFERENT eschatological schools read the
    // verse. ALWAYS include multiple traditions side-by-side (you are a
    // surveyor, not an advocate). Possible traditions:
    // 'Premillennial', 'Amillennial', 'Postmillennial', 'Preterist',
    // 'Historicist', 'Idealist', 'Dispensationalist', 'Rabbinic',
    // 'Patristic', 'Apocalyptic-Gnostic'. Pick what's relevant to the verse.
    {
      "tradition":      "Tradition name",
      "interpretation": "1-3 sentences — calm scholarly summary, never endorsement.",
      "keyVoice":       "1-line cite of a representative voice (e.g. 'John Walvoord, The Revelation of Jesus Christ, 1966'). Empty string if not famous."
    }
  ],

  "crossReferences": [
    // 4-8 canonical cross-refs — verses that resonate with this one.
    // These will be rendered as clickable chips in the UI (jump the reader).
    { "ref": "Book ch:vv", "note": "1 short clause — under 12 words." }
  ],

  "caveats": [
    // 1-3 short scholarly caveats — interpretive limits, contested attributions,
    // genre constraints (e.g. apocalyptic literature ≠ predictive almanac).
    "..."
  ]
}

Rules:
- Real events only. No invented figures. If unsure of a date, write your best estimate but mark with 'c.' in the era.
- Multiple prophetic traditions ALWAYS. Never just one — the value is in the spread.
- Modern resonances must cite a real observer when the parallel is non-obvious.
- crossReferences use canonical book names ("John 1:1", "1 Corinthians 13:4-8").
- Calm scholarly tone. No exclamations. No emoji.
- Return ONLY the JSON object.`;

// Tolerant JSON parser — same approach as verse-map / verse-art.
function parseMirrorJSON(s) {
  try { return JSON.parse(s); } catch {}
  let inString = false, escape = false;
  const stk = [];
  let lastSafe = 0, safeStack = [];
  const mark = (idx) => { lastSafe = idx; safeStack = stk.slice(); };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (inString) {
      if (c === "\\") { escape = true; continue; }
      if (c === "\"") { inString = false; mark(i + 1); }
      continue;
    }
    if (c === "\"") { inString = true; continue; }
    if (c === "{" || c === "[") stk.push(c === "{" ? "}" : "]");
    else if (c === "}" || c === "]") { stk.pop(); mark(i + 1); }
    else if (c === ",") mark(i);
    else if (/[\d.eE+\-tfn ul]/.test(c)) mark(i + 1);
  }
  let head = s.slice(0, lastSafe).replace(/[,\s]+$/, "");
  head = head.replace(/,?\s*"[^"]*"\s*:\s*$/, "");
  return JSON.parse(head + safeStack.reverse().join(""));
}

function fmtYear(y) {
  if (y === 0 || y == null || Number.isNaN(y)) return "—";
  const n = Math.abs(y);
  return `${n} ${y < 0 ? "BCE" : "CE"}`;
}

function VerseMirror({ verse, refStr, verseText, passage, primary, onClose, onJumpRef }) {
  const key = `codex.mirrors.${passage.bookId}.${passage.chapter}.${verse?.n}`;
  const [data, setData]    = useState(() => {
    try { const raw = localStorage.getItem(key); if (raw) return JSON.parse(raw); }
    catch {}
    return null;
  });
  const [err, setErr]      = useState(null);
  const [loading, setLoading] = useState(!data);

  useEffect(() => {
    if (data) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            system: MIRROR_PROMPT,
            messages: [{
              role: "user",
              content: `Verse: ${refStr}\nText: ${verseText}\n\nReturn the JSON object.`,
            }],
            max_tokens: 3200,
          }),
        });
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
        const text = (body.text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
        const i = text.indexOf("{");
        if (i === -1) throw new Error("Mirror response not JSON");
        const obj = parseMirrorJSON(text.slice(i));
        if (cancelled) return;
        try { localStorage.setItem(key, JSON.stringify(obj)); } catch {}
        setData(obj);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setErr(String(e.message || e));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [key]);

  // ESC closes
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="cx-mirror-backdrop" onClick={onClose} role="dialog" aria-label="Verse mirror">
      <div className="cx-mirror" onClick={e => e.stopPropagation()}>
        <span className="cx-corner cx-tl" />
        <span className="cx-corner cx-tr" />
        <span className="cx-corner cx-bl" />
        <span className="cx-corner cx-br" />

        <header className="cx-mirror-h">
          <span className="cx-mirror-h-tag">CODEX · MIRROR</span>
          <span className="cx-mirror-h-ref">{refStr}</span>
          {data?.theme ? <span className="cx-mirror-h-theme">— {data.theme}</span> : null}
          <button className="cx-mirror-x" onClick={onClose} aria-label="Close" title="Close (ESC)">×</button>
        </header>

        {loading ? (
          <div className="cx-mirror-loading">
            <div className="cx-mirror-spin"><i/><i/><i/><i/></div>
            <span>SURVEYING · HISTORY · NEWS · PROPHECY</span>
            <span className="cx-mirror-loading-sub">cross-checking historical parallels and prophetic schools…</span>
          </div>
        ) : err ? (
          <div className="cx-mirror-err">
            <b>MIRROR ORACLE OFFLINE</b>
            <code>{err}</code>
          </div>
        ) : data ? (
          <MirrorBody data={data} onJumpRef={onJumpRef} />
        ) : null}
      </div>
    </div>
  );
}

function MirrorBody({ data, onJumpRef }) {
  return (
    <div className="cx-mirror-body">
      {data.summary ? <p className="cx-mirror-summary">{data.summary}</p> : null}

      {data.historicalParallels?.length ? (
        <Section
          tag="HISTORY"
          title="Historical parallels"
          color="cyan"
        >
          <ol className="cx-mirror-list">
            {data.historicalParallels.map((h, i) => (
              <li key={i} className="cx-mirror-event">
                <header>
                  <span className="cx-mirror-event-yr">{fmtYear(h.year)}</span>
                  <span className="cx-mirror-event-place">{h.place}</span>
                  <span className="cx-mirror-event-era">{h.era}</span>
                </header>
                <h4>
                  {h.wiki
                    ? <a href={`https://en.wikipedia.org/wiki/${encodeURIComponent(h.wiki)}`}
                         target="_blank" rel="noopener noreferrer">{h.event} ↗</a>
                    : h.event}
                </h4>
                <p>{h.connection}</p>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      {data.modernResonances?.length ? (
        <Section
          tag="NEWS"
          title="Modern geopolitical resonances"
          color="amber"
        >
          <ol className="cx-mirror-list">
            {data.modernResonances.map((m, i) => (
              <li key={i} className="cx-mirror-event is-modern">
                <header>
                  <span className="cx-mirror-event-yr">{fmtYear(m.year)}</span>
                  <span className="cx-mirror-event-place">{m.place}</span>
                </header>
                <h4>
                  {m.wiki
                    ? <a href={`https://en.wikipedia.org/wiki/${encodeURIComponent(m.wiki)}`}
                         target="_blank" rel="noopener noreferrer">{m.event} ↗</a>
                    : m.event}
                </h4>
                <p>{m.connection}</p>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      {data.propheticReadings?.length ? (
        <Section
          tag="PROPHECY"
          title="Prophetic interpretive traditions"
          color="violet"
        >
          <ul className="cx-mirror-prophecy">
            {data.propheticReadings.map((p, i) => (
              <li key={i}>
                <span className="cx-mirror-tradition">{p.tradition}</span>
                <p>{p.interpretation}</p>
                {p.keyVoice ? <small>{p.keyVoice}</small> : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {data.crossReferences?.length ? (
        <Section
          tag="CROSS-REFS"
          title="Canonical cross-references"
          color="cyan"
        >
          <ul className="cx-mirror-xref">
            {data.crossReferences.map((x, i) => (
              <li
                key={i}
                onClick={() => onJumpRef && onJumpRef(x.ref)}
                className={onJumpRef ? "is-clickable" : ""}
                role={onJumpRef ? "button" : undefined}
                title={onJumpRef ? `Jump to ${x.ref}` : undefined}
              >
                <b>{x.ref}</b>
                <span>{x.note}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {data.caveats?.length ? (
        <Section tag="CAVEATS" title="Scholarly caveats" color="dim">
          <ul className="cx-mirror-caveats">
            {data.caveats.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

function Section({ tag, title, color, children }) {
  return (
    <section className={`cx-mirror-sect is-${color}`}>
      <header className="cx-mirror-sect-h">
        <span className="cx-mirror-sect-tag">{tag}</span>
        <h3>{title}</h3>
      </header>
      {children}
    </section>
  );
}

Object.assign(window, { VerseMirror });
