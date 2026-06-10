// CODEX — ops.jsx · ◎ OPS — the mission cockpit of the agentic OS.
//
// The reader states an INTENT in plain language ("trace the Logos from
// Genesis to Revelation and build me a study", "compare how the prophets
// and the gospels use 'shepherd'"). The CODEX KERNEL (kernel.js) runs the
// mission: the model plans, calls the app's OWN tools (search, passages,
// cross-refs, gematria, console-opens), and writes a cited artifact section
// by section. This console renders the mission LIVE:
//
//   left  — the step feed: every thought, tool call and result as it lands
//   right — the artifact: title, sections, summary, growing in real time
//
// Honest by construction: tool results are computed locally by the app
// (the model never fabricates a search hit or a gematria value), sections
// must cite refs, and the kernel forces a closing Caveats section.
//
// Mission history persists (codex.missions, ring of 20) — reopen any prior
// artifact from the MISSIONS drawer.

function VerseOps({ seed, onClose, onJumpRef }) {
  const [intent, setIntent] = useState(seed || "");
  const [mission, setMission] = useState(null);   // live mission state
  const [events, setEvents] = useState([]);        // step feed
  const [history, setHistory] = useState(() => (window.CODEX_KERNEL ? window.CODEX_KERNEL.missions() : []));
  const [showHistory, setShowHistory] = useState(false);
  const ctlRef = useRef(null);
  const feedRef = useRef(null);

  // Subscribe to the kernel bus for the live feed.
  useEffect(() => {
    const onK = (e) => {
      const d = e.detail || {};
      if (!mission || d.id !== mission.id) {
        if (d.type === "start") {
          setMission({ id: d.id, intent: d.intent, status: "running", artifact: { title: "", summary: "", sections: [] } });
          setEvents([{ type: "start", intent: d.intent, maxSteps: d.maxSteps }]);
        }
        return;
      }
      setEvents(prev => [...prev, d]);
      if (d.type === "section") {
        setMission(m => ({ ...m, artifact: { ...m.artifact, sections: [...m.artifact.sections, d.section] } }));
      } else if (d.type === "done") {
        setMission(m => ({ ...m, status: "done", artifact: d.artifact || m.artifact }));
        setHistory(window.CODEX_KERNEL.missions());
      } else if (d.type === "error" || d.type === "abort") {
        setMission(m => ({ ...m, status: d.type, error: d.error }));
        setHistory(window.CODEX_KERNEL.missions());
      }
    };
    window.addEventListener("codex:kernel", onK);
    return () => window.removeEventListener("codex:kernel", onK);
  }, [mission]);

  // Keep the feed pinned to the newest step.
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events]);

  // ESC closes (unless a mission is mid-flight — then it aborts first).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (mission?.status === "running" && ctlRef.current) { ctlRef.current.abort(); return; }
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, mission]);

  const launch = () => {
    const text = intent.trim();
    if (!text || !window.CODEX_KERNEL) return;
    if (mission?.status === "running") return;
    setEvents([]);
    setMission(null);
    ctlRef.current = window.CODEX_KERNEL.run(text);
  };

  const abort = () => { if (ctlRef.current) ctlRef.current.abort(); };

  const openPast = (m) => {
    setMission({ ...m, live: false });
    setEvents((m.steps || []).map(s => s.kind === "section"
      ? { type: "section", section: { heading: s.heading, body: "" } }
      : { type: "result", tool: s.tool, result: s.result, failed: s.failed }));
    setShowHistory(false);
  };

  const copyArtifact = () => {
    const a = mission?.artifact;
    if (!a) return;
    const md = [`# ${a.title || mission.intent}`, "", a.summary, "", ...a.sections.map(s => `## ${s.heading}\n\n${s.body}`)].join("\n");
    try { navigator.clipboard.writeText(md); } catch {}
    try { window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: "◎ Artifact copied as markdown", kind: "ok" } })); } catch {}
  };

  const running = mission?.status === "running";
  const keyHint = !window.CODEX_KERNEL ? "kernel not loaded" : null;

  return (
    <div className="cx-ops-backdrop" onClick={onClose} role="dialog" aria-label="OPS — mission cockpit">
      <div className="cx-ops" onClick={e => e.stopPropagation()}>
        <span className="cx-corner cx-tl" /><span className="cx-corner cx-tr" />
        <span className="cx-corner cx-bl" /><span className="cx-corner cx-br" />

        <header className="cx-ops-h">
          <span className="cx-ops-h-tag">CODEX · OPS</span>
          <span className="cx-ops-h-status">
            {running ? <span className="cx-ops-live"><i />MISSION RUNNING</span>
              : mission?.status === "done" ? "MISSION COMPLETE"
              : mission?.status === "error" ? "MISSION FAILED"
              : mission?.status === "abort" ? "MISSION ABORTED"
              : "STANDING BY"}
          </span>
          <button className="cx-ops-hist" onClick={() => setShowHistory(h => !h)} title="Past missions">
            ≣ MISSIONS {history.length ? `(${history.length})` : ""}
          </button>
          <button className="cx-ops-x" onClick={onClose} aria-label="Close" title="Close (ESC)">×</button>
        </header>

        <IntelBanner console="OPS" scope="MISSION CONTROL" note="THE AGENT CALLS THE APP'S OWN TOOLS · EVERY RESULT COMPUTED LOCALLY · ARTIFACTS CITED" />

        <div className="cx-ops-intent">
          <textarea
            className="cx-ops-input"
            placeholder={'State your intent — e.g. "Trace the Logos from Genesis to Revelation and build me a cited study" or "How do the prophets and the gospels each use shepherd imagery?"'}
            value={intent}
            onChange={e => setIntent(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); launch(); } }}
            rows={2}
            disabled={running}
          />
          {running
            ? <button className="cx-ops-run is-abort" onClick={abort} title="Abort mission (ESC)">■ ABORT</button>
            : <button className="cx-ops-run" onClick={launch} disabled={!intent.trim() || !!keyHint} title="Launch mission (⌘↵)">▶ RUN</button>}
        </div>
        {keyHint ? <div className="cx-ops-warn">{keyHint}</div> : null}

        {showHistory ? (
          <div className="cx-ops-history">
            {history.length === 0 ? <p className="cx-ops-empty">No missions yet.</p> : (
              <ul>
                {history.map(m => (
                  <li key={m.id} onClick={() => openPast(m)} role="button" tabIndex={0}
                      onKeyDown={e => { if (e.key === "Enter") openPast(m); }}>
                    <b>{m.artifact?.title || m.intent}</b>
                    <span className={`cx-ops-hstat is-${m.status}`}>{m.status}</span>
                    <small>{(m.steps || []).length} steps · {new Date(m.startedAt).toLocaleString()}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {mission ? (
          <div className="cx-ops-mission">
            <div className="cx-ops-feed" ref={feedRef} aria-label="Mission step feed">
              {events.map((ev, i) => <OpsEvent key={i} ev={ev} />)}
              {running ? <div className="cx-ops-thinking"><i /><i /><i /></div> : null}
            </div>
            <div className="cx-ops-artifact" aria-label="Mission artifact">
              <h3 className="cx-ops-art-title">{mission.artifact?.title || mission.intent}</h3>
              {mission.artifact?.summary ? <p className="cx-ops-art-summary">{mission.artifact.summary}</p> : null}
              {(mission.artifact?.sections || []).map((s, i) => (
                <section key={i} className="cx-ops-art-sec">
                  <h4>{s.heading}</h4>
                  <ArtifactBody body={s.body} onJumpRef={onJumpRef} />
                </section>
              ))}
              {mission.status === "done" ? (
                <div className="cx-ops-art-actions">
                  <button onClick={copyArtifact} title="Copy the artifact as markdown">⎘ COPY MARKDOWN</button>
                </div>
              ) : null}
              {mission.status === "error" ? <div className="cx-ops-error"><b>KERNEL FAULT</b><code>{mission.error}</code></div> : null}
            </div>
          </div>
        ) : (
          <div className="cx-ops-idle">
            <p className="cx-ops-idle-line">The kernel commands {window.CODEX_KERNEL ? window.CODEX_KERNEL.tools().length : 0} tools — search, passages, cross-references, gematria, the consoles.</p>
            <p className="cx-ops-idle-epigraph">“Ask, and it will be given to you; seek, and you will find.” — Matt 7:7</p>
          </div>
        )}
      </div>
    </div>
  );
}

// One event card in the feed.
function OpsEvent({ ev }) {
  if (ev.type === "start") {
    return <div className="cx-ops-ev is-start"><b>MISSION START</b><p>{ev.intent}</p></div>;
  }
  if (ev.type === "tool") {
    return (
      <div className="cx-ops-ev is-tool">
        {ev.thought ? <p className="cx-ops-ev-thought">{ev.thought}</p> : null}
        <code>▸ {ev.tool}({Object.entries(ev.args || {}).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ")})</code>
      </div>
    );
  }
  if (ev.type === "result") {
    return (
      <div className={`cx-ops-ev is-result ${ev.failed ? "is-failed" : ""}`}>
        <pre>{String(ev.result || "").slice(0, 600)}</pre>
      </div>
    );
  }
  if (ev.type === "section") {
    return <div className="cx-ops-ev is-section"><b>§ {ev.section?.heading}</b></div>;
  }
  if (ev.type === "done") {
    return <div className="cx-ops-ev is-done"><b>✓ MISSION COMPLETE{ev.budget ? " (step budget)" : ""}</b></div>;
  }
  if (ev.type === "error") {
    return <div className="cx-ops-ev is-failed"><b>✗ {ev.error}</b></div>;
  }
  if (ev.type === "abort") {
    return <div className="cx-ops-ev is-failed"><b>■ aborted</b></div>;
  }
  return null;
}

// Artifact section body — renders refs like "John 1:1" as jump chips.
function ArtifactBody({ body, onJumpRef }) {
  const parts = useMemo(() => {
    const re = /\b((?:[1-3]\s+)?[A-Z][a-z]+(?:\s+of\s+[A-Z][a-z]+)?)\s+(\d+):(\d+(?:[-–]\d+)?)\b/g;
    const out = [];
    let last = 0, m;
    const s = String(body || "");
    while ((m = re.exec(s))) {
      if (m.index > last) out.push({ t: "text", v: s.slice(last, m.index) });
      out.push({ t: "ref", v: m[0] });
      last = m.index + m[0].length;
    }
    if (last < s.length) out.push({ t: "text", v: s.slice(last) });
    return out;
  }, [body]);

  const jump = (ref) => {
    if (typeof onJumpRef === "function") return onJumpRef(ref);
    if (typeof window.codexJumpToRef === "function") return window.codexJumpToRef(ref);
  };

  return (
    <p className="cx-ops-art-body">
      {parts.map((p, i) => p.t === "ref"
        ? <button key={i} className="cx-ops-refchip" onClick={() => jump(p.v)} title={`Jump to ${p.v}`}>{p.v}</button>
        : <span key={i}>{p.v}</span>)}
    </p>
  );
}

Object.assign(window, { VerseOps });
