// GENERATED from ops.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
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

// Self-injected CSS for the v11 additions (collapsible results); idempotent.
function opsEnsureCss() {
  if (typeof document === "undefined" || document.getElementById("cx-ops2-css")) return;
  const el = document.createElement("style");
  el.id = "cx-ops2-css";
  el.textContent = `
    .cx-ops-ev.is-result details { margin: 0; }
    .cx-ops-ev.is-result summary { cursor: pointer; list-style: none; display: flex; align-items: baseline; gap: 6px;
      font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 9.5px; letter-spacing: 0.06em;
      color: var(--cx-fg-dim, #8a98a8); }
    .cx-ops-ev.is-result summary::-webkit-details-marker { display: none; }
    .cx-ops-ev.is-result summary::before { content: "▸"; color: var(--cx-accent, #7ee0ff); flex: none; }
    .cx-ops-ev.is-result details[open] summary::before { content: "▾"; }
    .cx-ops-ev.is-result summary:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(126,224,255,0.5); border-radius: 3px; }
    .cx-ops-ev.is-result .cx-ops-ev-gist { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
    .cx-ops-ev.is-result.is-failed summary::before, .cx-ops-ev.is-result.is-failed .cx-ops-ev-gist { color: var(--cx-red, #ff8291); }
  `;
  document.head.appendChild(el);
}

function VerseOps({ seed, onClose, onJumpRef }) {
  useEffect(() => {opsEnsureCss();}, []);
  const [intent, setIntent] = useState(seed || "");
  const [mission, setMission] = useState(null); // live mission state
  const [events, setEvents] = useState([]); // step feed
  const [history, setHistory] = useState(() => window.CODEX_KERNEL ? window.CODEX_KERNEL.missions() : []);
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
      setEvents((prev) => [...prev, d]);
      if (d.type === "section") {
        setMission((m) => ({ ...m, artifact: { ...m.artifact, sections: [...m.artifact.sections, d.section] } }));
      } else if (d.type === "done") {
        setMission((m) => ({ ...m, status: "done", artifact: d.artifact || m.artifact }));
        setHistory(window.CODEX_KERNEL.missions());
      } else if (d.type === "error" || d.type === "abort") {
        setMission((m) => ({ ...m, status: d.type, error: d.error }));
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
      if (mission?.status === "running" && ctlRef.current) {ctlRef.current.abort();return;}
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

  const abort = () => {if (ctlRef.current) ctlRef.current.abort();};

  const openPast = (m) => {
    setMission({ ...m, live: false });
    setEvents((m.steps || []).map((s) => s.kind === "section" ?
    { type: "section", section: { heading: s.heading, body: "" } } :
    { type: "result", tool: s.tool, result: s.result, failed: s.failed }));
    setShowHistory(false);
  };

  const copyArtifact = () => {
    const a = mission?.artifact;
    if (!a) return;
    const md = [`# ${a.title || mission.intent}`, "", a.summary, "", ...a.sections.map((s) => `## ${s.heading}\n\n${s.body}`)].join("\n");
    try {navigator.clipboard.writeText(md);} catch {}
    try {window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: "◎ Artifact copied as markdown", kind: "ok" } }));} catch {}
  };

  // Convert the artifact into a saved study (builder.jsx shape, codex.studies.v1).
  const saveAsStudy = () => {
    const a = mission?.artifact;
    if (!a) return;
    const uid = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const sections = [];
    if (a.summary) {
      sections.push({ id: uid("section"), heading: "Summary", items: [{ type: "note", body: String(a.summary), _id: uid("item") }] });
    }
    for (const s of a.sections || []) {
      sections.push({ id: uid("section"), heading: s.heading || "Section", items: [{ type: "note", body: String(s.body || ""), _id: uid("item") }] });
    }
    if (!sections.length) sections.push({ id: uid("section"), heading: "I. ", items: [] });
    const study = {
      id: uid("study"),
      title: a.title || mission.intent || "Untitled study",
      created: now,
      modified: now,
      sections
    };
    try {
      let store;
      try {
        const parsed = JSON.parse(localStorage.getItem("codex.studies.v1") || "null");
        store = parsed && Array.isArray(parsed.studies) ? parsed : { studies: [], activeStudyId: null };
      } catch {store = { studies: [], activeStudyId: null };}
      store.studies.push(study);
      localStorage.setItem("codex.studies.v1", JSON.stringify(store));
      try {window.dispatchEvent(new CustomEvent("codex:studies-changed"));} catch {}
      try {window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: "✦ Saved to Studies", kind: "ok" } }));} catch {}
    } catch {}
  };

  // Narrate the artifact (title, summary, then sections) via codexSpeak.
  const readArtifact = () => {
    const a = mission?.artifact;
    if (!a || typeof window.codexSpeak !== "function") return;
    const text = [a.title || mission.intent, a.summary, ...(a.sections || []).map((s) => `${s.heading || ""}. ${s.body || ""}`)].
    filter(Boolean).join(". ");
    window.codexSpeak(text);
  };
  const stopReading = () => {
    try {if (window.speechSynthesis) window.speechSynthesis.cancel();} catch {}
  };
  const canSpeak = typeof window.codexSpeak === "function";

  const running = mission?.status === "running";
  const keyHint = !window.CODEX_KERNEL ? "kernel not loaded" : null;

  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-ops-backdrop", onClick: onClose, role: "dialog", "aria-label": "OPS \u2014 mission cockpit" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-ops", onClick: (e) => e.stopPropagation() }, /*#__PURE__*/
    React.createElement("span", { className: "cx-corner cx-tl" }), /*#__PURE__*/React.createElement("span", { className: "cx-corner cx-tr" }), /*#__PURE__*/
    React.createElement("span", { className: "cx-corner cx-bl" }), /*#__PURE__*/React.createElement("span", { className: "cx-corner cx-br" }), /*#__PURE__*/

    React.createElement("header", { className: "cx-ops-h" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-ops-h-tag" }, "CODEX \xB7 OPS"), /*#__PURE__*/
    React.createElement("span", { className: "cx-ops-h-status" },
    running ? /*#__PURE__*/React.createElement("span", { className: "cx-ops-live" }, /*#__PURE__*/React.createElement("i", null), "MISSION RUNNING") :
    mission?.status === "done" ? "MISSION COMPLETE" :
    mission?.status === "error" ? "MISSION FAILED" :
    mission?.status === "abort" ? "MISSION ABORTED" :
    "STANDING BY"
    ), /*#__PURE__*/
    React.createElement("button", { className: "cx-ops-hist", onClick: () => setShowHistory((h) => !h), title: "Past missions" }, "\u2263 MISSIONS ",
    history.length ? `(${history.length})` : ""
    ), /*#__PURE__*/
    React.createElement("button", { className: "cx-ops-x", onClick: onClose, "aria-label": "Close", title: "Close (ESC)" }, "\xD7")
    ), /*#__PURE__*/

    React.createElement(IntelBanner, { console: "OPS", scope: "MISSION CONTROL", note: "THE AGENT CALLS THE APP'S OWN TOOLS \xB7 EVERY RESULT COMPUTED LOCALLY \xB7 ARTIFACTS CITED" }), /*#__PURE__*/

    React.createElement("div", { className: "cx-ops-intent" }, /*#__PURE__*/
    React.createElement("textarea", {
      className: "cx-ops-input",
      placeholder: 'State your intent — e.g. "Trace the Logos from Genesis to Revelation and build me a cited study" or "How do the prophets and the gospels each use shepherd imagery?"',
      value: intent,
      onChange: (e) => setIntent(e.target.value),
      onKeyDown: (e) => {if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {e.preventDefault();launch();}},
      rows: 2,
      disabled: running }
    ),
    running ? /*#__PURE__*/
    React.createElement("button", { className: "cx-ops-run is-abort", onClick: abort, title: "Abort mission (ESC)" }, "\u25A0 ABORT") : /*#__PURE__*/
    React.createElement("button", { className: "cx-ops-run", onClick: launch, disabled: !intent.trim() || !!keyHint, title: "Launch mission (\u2318\u21B5)" }, "\u25B6 RUN")
    ),
    keyHint ? /*#__PURE__*/React.createElement("div", { className: "cx-ops-warn" }, keyHint) : null,

    showHistory ? /*#__PURE__*/
    React.createElement("div", { className: "cx-ops-history" },
    history.length === 0 ? /*#__PURE__*/React.createElement("p", { className: "cx-ops-empty" }, "No missions yet.") : /*#__PURE__*/
    React.createElement("ul", null,
    history.map((m) => /*#__PURE__*/
    React.createElement("li", { key: m.id, onClick: () => openPast(m), role: "button", tabIndex: 0,
      onKeyDown: (e) => {if (e.key === "Enter") openPast(m);} }, /*#__PURE__*/
    React.createElement("b", null, m.artifact?.title || m.intent), /*#__PURE__*/
    React.createElement("span", { className: `cx-ops-hstat is-${m.status}` }, m.status), /*#__PURE__*/
    React.createElement("small", null, (m.steps || []).length, " steps \xB7 ", new Date(m.startedAt).toLocaleString())
    )
    )
    )

    ) :
    null,

    mission ? /*#__PURE__*/
    React.createElement("div", { className: "cx-ops-mission" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-ops-feed", ref: feedRef, "aria-label": "Mission step feed" },
    events.map((ev, i) => /*#__PURE__*/React.createElement(OpsEvent, { key: i, ev: ev })),
    running ? /*#__PURE__*/React.createElement("div", { className: "cx-ops-thinking" }, /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null)) : null
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-ops-artifact", "aria-label": "Mission artifact" }, /*#__PURE__*/
    React.createElement("h3", { className: "cx-ops-art-title" }, mission.artifact?.title || mission.intent),
    mission.artifact?.summary ? /*#__PURE__*/React.createElement("p", { className: "cx-ops-art-summary" }, mission.artifact.summary) : null,
    (mission.artifact?.sections || []).map((s, i) => /*#__PURE__*/
    React.createElement("section", { key: i, className: "cx-ops-art-sec" }, /*#__PURE__*/
    React.createElement("h4", null, s.heading), /*#__PURE__*/
    React.createElement(ArtifactBody, { body: s.body, onJumpRef: onJumpRef })
    )
    ),
    mission.status === "done" ? /*#__PURE__*/
    React.createElement("div", { className: "cx-ops-art-actions" }, /*#__PURE__*/
    React.createElement("button", { onClick: copyArtifact, title: "Copy the artifact as markdown" }, "\u2398 COPY MARKDOWN"), /*#__PURE__*/
    React.createElement("button", { onClick: saveAsStudy, title: "Save the artifact to the Studies tab" }, "\u2726 SAVE AS STUDY"),
    canSpeak ? /*#__PURE__*/React.createElement("button", { onClick: readArtifact, title: "Read the artifact aloud" }, "\u25B6 READ") : null,
    canSpeak ? /*#__PURE__*/React.createElement("button", { onClick: stopReading, title: "Stop reading" }, "\u25A0") : null
    ) :
    null,
    mission.status === "error" ? /*#__PURE__*/React.createElement("div", { className: "cx-ops-error" }, /*#__PURE__*/React.createElement("b", null, "KERNEL FAULT"), /*#__PURE__*/React.createElement("code", null, mission.error)) : null
    )
    ) : /*#__PURE__*/

    React.createElement("div", { className: "cx-ops-idle" }, /*#__PURE__*/
    React.createElement("p", { className: "cx-ops-idle-line" }, "The kernel commands ", window.CODEX_KERNEL ? window.CODEX_KERNEL.tools().length : 0, " tools \u2014 search, passages, cross-references, gematria, the consoles."), /*#__PURE__*/
    React.createElement("p", { className: "cx-ops-idle-epigraph" }, "\u201CAsk, and it will be given to you; seek, and you will find.\u201D \u2014 Matt 7:7")
    )

    )
    ));

}

// One event card in the feed.
function OpsEvent({ ev }) {
  if (ev.type === "start") {
    return /*#__PURE__*/React.createElement("div", { className: "cx-ops-ev is-start" }, /*#__PURE__*/React.createElement("b", null, "MISSION START"), /*#__PURE__*/React.createElement("p", null, ev.intent));
  }
  if (ev.type === "tool") {
    return (/*#__PURE__*/
      React.createElement("div", { className: "cx-ops-ev is-tool" },
      ev.thought ? /*#__PURE__*/React.createElement("p", { className: "cx-ops-ev-thought" }, ev.thought) : null, /*#__PURE__*/
      React.createElement("code", null, "\u25B8 ", ev.tool, "(", Object.entries(ev.args || {}).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", "), ")")
      ));

  }
  if (ev.type === "result") {
    // Collapsible inline result: a one-line gist ("found 23 cross-refs…")
    // expands to the full tool output. <details> = keyboard-native.
    const full = String(ev.result || "");
    const lines = full.split("\n").map((s) => s.trim()).filter(Boolean);
    const gist = ev.failed ?
    lines[0] || "tool failed" :
    lines.length > 1 ? `${lines.length} lines · ${lines[0]}` : lines[0] || "(empty)";
    return (/*#__PURE__*/
      React.createElement("div", { className: `cx-ops-ev is-result ${ev.failed ? "is-failed" : ""}` }, /*#__PURE__*/
      React.createElement("details", null, /*#__PURE__*/
      React.createElement("summary", { title: "Expand the full tool result" },
      ev.tool ? /*#__PURE__*/React.createElement("b", null, ev.tool) : null, /*#__PURE__*/
      React.createElement("span", { className: "cx-ops-ev-gist" }, gist.slice(0, 110))
      ), /*#__PURE__*/
      React.createElement("pre", null, full.slice(0, 1600))
      )
      ));

  }
  if (ev.type === "section") {
    return /*#__PURE__*/React.createElement("div", { className: "cx-ops-ev is-section" }, /*#__PURE__*/React.createElement("b", null, "\xA7 ", ev.section?.heading));
  }
  if (ev.type === "done") {
    return /*#__PURE__*/React.createElement("div", { className: "cx-ops-ev is-done" }, /*#__PURE__*/React.createElement("b", null, "\u2713 MISSION COMPLETE", ev.budget ? " (step budget)" : ""));
  }
  if (ev.type === "error") {
    return /*#__PURE__*/React.createElement("div", { className: "cx-ops-ev is-failed" }, /*#__PURE__*/React.createElement("b", null, "\u2717 ", ev.error));
  }
  if (ev.type === "abort") {
    return /*#__PURE__*/React.createElement("div", { className: "cx-ops-ev is-failed" }, /*#__PURE__*/React.createElement("b", null, "\u25A0 aborted"));
  }
  return null;
}

// Artifact section body — renders through the shared CODEX_ARTIFACTS engine
// (rich markdown DOM, live ref chips with hover preview, codex:chart /
// codex:flow / codex:buttons / codex:verse-grid directives become real
// interactive SVG/buttons). Falls back to the legacy ref-chip renderer if
// the artifacts engine isn't loaded.
function ArtifactBody({ body, onJumpRef }) {
  const A = window.CODEX_ARTIFACTS;
  if (A && A.Rich) {
    return /*#__PURE__*/React.createElement("div", { className: "cx-ops-art-body" }, /*#__PURE__*/React.createElement(A.Rich, { text: String(body || "") }));
  }
  return /*#__PURE__*/React.createElement(ArtifactBodyLegacy, { body: body, onJumpRef: onJumpRef });
}

function ArtifactBodyLegacy({ body, onJumpRef }) {
  const parts = useMemo(() => {
    const re = /\b((?:[1-3]\s+)?[A-Z][a-z]+(?:\s+of\s+[A-Z][a-z]+)?)\s+(\d+):(\d+(?:[-–]\d+)?)\b/g;
    const out = [];
    let last = 0,m;
    const s = String(body || "");
    while (m = re.exec(s)) {
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

  return (/*#__PURE__*/
    React.createElement("p", { className: "cx-ops-art-body" },
    parts.map((p, i) => p.t === "ref" ? /*#__PURE__*/
    React.createElement("button", { key: i, className: "cx-ops-refchip", onClick: () => jump(p.v), title: `Jump to ${p.v}` }, p.v) : /*#__PURE__*/
    React.createElement("span", { key: i }, p.v))
    ));

}

Object.assign(window, { VerseOps });
})();
