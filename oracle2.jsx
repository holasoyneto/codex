// CODEX — oracle2.jsx · v11 THE ORACLE ASCENDED — sys-oracle plugin.
//
// v10 built the instrument: the BINDING (live CODEX_NOW chip), the five
// INVOCATIONS, the honesty banner, persistence. v11 gives it back everything
// the old 2,000-line oracle had — and more — without losing the instrument:
//
//   · RICH RENDERING — every reply renders through window.CODEX_ARTIFACTS:
//     real markdown DOM (headings/lists/quotes/tables), [j]/[d] red-letter
//     and shimmer, every scripture ref a live hover-previewing chip that
//     opens the reader (the universal law), and the model can emit
//     codex:buttons / codex:chart / codex:flow / codex:verse-grid directive
//     blocks that become real interactive elements. Never raw HTML.
//   · TABS RETURN — threads as tabs (codex.oracle.threads.v1; the v10
//     single thread migrates into the first tab automatically).
//   · FULL APP CONTROL — the ⚒ TOOLS toggle (default ON when the kernel is
//     loaded): the model may call kernel tools mid-chat (read_passage,
//     search_text, cross_references, app_settings_get/set, open_panel,
//     open_console, goto, set_translation, focus_mode, …), ≤4 steps per
//     question, every call shown as a chip in the thread. Settings writes
//     echo a visible "⚙ set …" chip — no silent changes.
//   · AI-BUSY — every model call rides window.CODEX_AI_BUSY (the orb).
//
// Engine: POST /api/chat (same endpoint every AI surface uses).

const ORACLE2_LEGACY_KEY = "codex.oracle.v10";
const ORACLE2_THREADS_KEY = "codex.oracle.threads.v1";
const ORACLE2_ACTIVE_KEY = "codex.oracle.threads.active.v1";
const ORACLE2_TOOLS_KEY = "codex.oracle.tools.v1";
const ORACLE2_MAX_MSGS = 60;
const ORACLE2_MAX_THREADS = 12;
const ORACLE2_TOOL_STEPS = 4;

const ORACLE2_SYSTEM = `You are THE ORACLE — the scholarly companion inside CODEX, a Bible-study instrument.
Voice: precise, warm, unhurried. A careful scholar, never a preacher.
HONESTY RULES (load-bearing — they survive every redesign):
- CITE chapter and verse (e.g. John 1:14) for every claim that has one. Refs written plainly become clickable chips the reader uses to CHECK YOUR WORK.
- NEVER fabricate a quotation. If unsure of exact wording, paraphrase and cite. Never invent folio numbers, surahs, or sources.
- When traditions disagree, SAY SO and name the positions — label genuinely disputed readings CONTESTED. Never present one side as settled.
- Hebrew/Greek: give the word in its own script + transliteration + gloss.
- Keep answers tight: 2-5 short paragraphs unless the question demands more. No filler, no emoji.
- You are not scripture and you say so when the line could blur.
You also help with CODEX itself (settings, panels, features) — never refuse an app question; prefer DOING it with a tool or offering a codex:buttons action over describing menu paths.`;

const ORACLE2_INVOCATIONS = [
  { id: "illuminate", glyph: "✦", label: "ILLUMINATE", prompt: (ref) => `Illuminate ${ref}: the plain meaning in its immediate context, in your tight scholarly voice.` },
  { id: "context", glyph: "◔", label: "CONTEXT", prompt: (ref) => `Give the historical and cultural context a first-century (or original-era) hearer would bring to ${ref}.` },
  { id: "tongue", glyph: "א", label: "TONGUE", prompt: (ref) => `Take me beneath the translation of ${ref}: the key Hebrew or Greek words, their script, transliteration, range of meaning, and what the English flattens.` },
  { id: "threads", glyph: "❂", label: "THREADS", prompt: (ref) => `The strongest cross-references for ${ref} — where else the canon speaks to this, and what each thread adds. Cite each, and if the web is rich, consider a codex:flow or codex:verse-grid.` },
  { id: "contra", glyph: "⚖", label: "CONTRA", prompt: (ref) => `Steelman the readings AGAINST the obvious interpretation of ${ref}. The strongest scholarly objections and minority positions, fairly stated, CONTESTED labels where due.` },
];

// ── Threads persistence (tabs) ────────────────────────────────────────────
function oracle2NewThread() {
  return {
    id: "t_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: "new thread",
    msgs: [],
    updatedAt: Date.now(),
  };
}
function oracle2DeriveTitle(msgs) {
  const u = (msgs || []).find(m => m.role === "user");
  if (!u) return "new thread";
  return String(u.content || "").trim().replace(/\s+/g, " ").slice(0, 28) || "new thread";
}
function oracle2LoadThreads() {
  try {
    const raw = JSON.parse(localStorage.getItem(ORACLE2_THREADS_KEY) || "null");
    if (Array.isArray(raw) && raw.length) {
      return raw.filter(t => t && t.id && Array.isArray(t.msgs)).slice(0, ORACLE2_MAX_THREADS);
    }
  } catch {}
  // Migrate the v10 single thread.
  try {
    const legacy = JSON.parse(localStorage.getItem(ORACLE2_LEGACY_KEY) || "null");
    if (Array.isArray(legacy) && legacy.length) {
      const t = oracle2NewThread();
      t.msgs = legacy;
      t.title = oracle2DeriveTitle(legacy);
      return [t];
    }
  } catch {}
  return [oracle2NewThread()];
}
function oracle2SaveThreads(threads, activeId) {
  try {
    const trimmed = threads.slice(0, ORACLE2_MAX_THREADS).map(t => ({ ...t, msgs: t.msgs.slice(-ORACLE2_MAX_MSGS) }));
    localStorage.setItem(ORACLE2_THREADS_KEY, JSON.stringify(trimmed));
    localStorage.setItem(ORACLE2_ACTIVE_KEY, activeId || "");
  } catch {}
}

// ── Agentic tool turn — bare-JSON {"tool","args"} protocol ────────────────
function oracle2ParseToolCall(text) {
  if (!text) return null;
  const s = String(text).trim().replace(/^```[a-zA-Z]*\s*/, "").replace(/```\s*$/, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  // A tool call is the WHOLE reply, not JSON buried in prose.
  if (a > 8) return null;
  try {
    const o = JSON.parse(s.slice(a, b + 1));
    if (o && typeof o.tool === "string" && o.tool.trim()) {
      return { tool: o.tool.trim(), args: (o.args && typeof o.args === "object") ? o.args : {} };
    }
  } catch {}
  return null;
}
function oracle2ToolDirective() {
  let specs = [];
  try {
    const K = window.CODEX_KERNEL;
    if (K && typeof K.toolSpecs === "function") specs = K.toolSpecs();
    else if (K && typeof K.tools === "function") specs = K.tools().map(n => ({ name: n, description: "" }));
  } catch {}
  if (!specs.length) return "";
  const lines = specs.map(s => `  · ${s.name}${s.description ? ` — ${s.description}` : ""}`);
  return `\n\nIN-APP TOOLS (executed locally by CODEX — you choose, the app runs):\n${lines.join("\n")}\n\nTo call a tool, reply with ONLY one JSON object — no prose, no fences:\n{"tool":"<name>","args":{...}}\nThe result returns as a user message "RESULT of <name>: …". Chain at most ${ORACLE2_TOOL_STEPS} calls per question, then you MUST answer in prose (rich output rules above). Never guess what a tool would return — call it. If no tool is needed, just answer.`;
}

// ── The instrument ────────────────────────────────────────────────────────
function OracleX() {
  const [now, setNow] = useState(() => window.CODEX_NOW || {});
  const [threads, setThreads] = useState(oracle2LoadThreads);
  const [activeId, setActiveId] = useState(() => {
    try { return localStorage.getItem(ORACLE2_ACTIVE_KEY) || ""; } catch { return ""; }
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [toolsOn, setToolsOn] = useState(() => {
    try { const v = localStorage.getItem(ORACLE2_TOOLS_KEY); if (v != null) return v === "1"; } catch {}
    return !!window.CODEX_KERNEL;
  });
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const busyRef = useRef(false);

  // Self-injected CSS for everything v11 adds (idempotent <style id>).
  useEffect(() => {
    if (document.getElementById("cxo2-css")) return;
    const el = document.createElement("style");
    el.id = "cxo2-css";
    el.textContent = `
      .cxo2-tabs { display: flex; align-items: stretch; gap: 2px; padding: 3px 6px 0; overflow-x: auto;
        border-bottom: 1px solid var(--cx-line, rgba(126,224,255,0.14)); flex: none; }
      .cxo2-tab { display: inline-flex; align-items: center; gap: 6px; max-width: 160px; flex: none;
        font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 9px; letter-spacing: 0.08em;
        color: var(--cx-fg-dim, #8a98a8); background: none; border: 1px solid transparent; border-bottom: none;
        border-radius: 5px 5px 0 0; padding: 4px 8px; cursor: pointer; white-space: nowrap; }
      .cxo2-tab.is-active { color: var(--cx-accent, #7ee0ff); border-color: var(--cx-line, rgba(126,224,255,0.22));
        background: rgba(126,224,255,0.06); }
      .cxo2-tab:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(126,224,255,0.5); }
      .cxo2-tab-lbl { overflow: hidden; text-overflow: ellipsis; }
      .cxo2-tab-x { opacity: 0.55; padding: 0 1px; }
      .cxo2-tab-x:hover { opacity: 1; color: var(--cx-red, #ff8291); }
      .cxo2-tab-new { flex: none; font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 11px;
        color: var(--cx-accent, #7ee0ff); background: none; border: none; padding: 2px 8px; cursor: pointer; }
      .cxo2-tab-new:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(126,224,255,0.5); border-radius: 4px; }
      .cxo2-tools { margin-left: auto; flex: none; font-family: var(--cx-mono, ui-monospace, Menlo, monospace);
        font-size: 8.5px; letter-spacing: 0.1em; border: 1px solid var(--cx-line, rgba(126,224,255,0.25));
        border-radius: 4px; background: none; color: var(--cx-fg-dim, #8a98a8); padding: 3px 7px; cursor: pointer; }
      .cxo2-tools.is-on { color: var(--cx-accent, #7ee0ff); border-color: var(--cx-accent, #7ee0ff);
        background: rgba(126,224,255,0.07); }
      .cxo2-tools:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(126,224,255,0.5); }
      .cxo2-toolchip { display: flex; align-items: baseline; gap: 7px; margin: 4px 0;
        font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 9.5px; line-height: 1.5;
        color: var(--cx-fg-dim, #8a98a8); }
      .cxo2-toolchip b { flex: none; color: var(--cx-accent, #7ee0ff); font-weight: 600; letter-spacing: 0.08em; }
      .cxo2-toolchip.is-failed b { color: var(--cx-red, #ff8291); }
      .cxo2-toolchip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    `;
    document.head.appendChild(el);
  }, []);

  // The binding — follow the reader's cursor.
  useEffect(() => {
    const onNow = (e) => { const n = e.detail || window.CODEX_NOW; if (n && n.ref) setNow(n); };
    window.addEventListener("codex:now", onNow);
    return () => window.removeEventListener("codex:now", onNow);
  }, []);

  // Resolve active thread (fall back to the most recent).
  const active = threads.find(t => t.id === activeId) || threads[0];
  const msgs = (active && active.msgs) || [];

  useEffect(() => { oracle2SaveThreads(threads, active ? active.id : ""); }, [threads, activeId]);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, busy, activeId]);
  useEffect(() => {
    try { localStorage.setItem(ORACLE2_TOOLS_KEY, toolsOn ? "1" : "0"); } catch {}
  }, [toolsOn]);

  const patchActive = (updater) => {
    setThreads(prev => prev.map(t => {
      if (!active || t.id !== active.id) return t;
      const nextMsgs = typeof updater === "function" ? updater(t.msgs) : updater;
      return { ...t, msgs: nextMsgs, title: oracle2DeriveTitle(nextMsgs), updatedAt: Date.now() };
    }));
  };
  const newThread = () => {
    const t = oracle2NewThread();
    setThreads(prev => [t, ...prev].slice(0, ORACLE2_MAX_THREADS));
    setActiveId(t.id);
    setErr(null);
    setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
  };
  const closeThread = (id) => {
    setThreads(prev => {
      const next = prev.filter(t => t.id !== id);
      if (!next.length) { const t = oracle2NewThread(); setActiveId(t.id); return [t]; }
      if (active && id === active.id) setActiveId(next[0].id);
      return next;
    });
  };

  // The binding: current verse text rides along as silent context.
  const contextBlock = () => {
    const n = window.CODEX_NOW;
    if (!n || !n.bookId) return "";
    let text = "";
    try {
      const tr = n.translation || "web";
      const cached = window.BIBLE && window.BIBLE.getCachedChapter
        ? window.BIBLE.getCachedChapter(n.bookId, n.chapter, tr) : null;
      if (cached) {
        const v = cached.find(x => x.n === n.verse);
        if (v) text = typeof v.text === "string" ? v.text : (v[tr] || "");
      }
    } catch {}
    return `\n\n[READER CONTEXT — the user is at ${n.ref}${text ? `: “${text}”` : ""}]`;
  };

  const callChat = async (system, apiMsgs) => {
    let busyId = null;
    try { if (window.CODEX_AI_BUSY) busyId = window.CODEX_AI_BUSY.begin("ORACLE"); } catch {}
    try {
      const tweaks = (() => { try { return JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}"); } catch { return {}; } })();
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: tweaks.provider,
          model: tweaks.model,
          system,
          messages: apiMsgs,
          max_tokens: 1600,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d && (typeof d.error === "string" ? d.error : d.error && d.error.message)) || `HTTP ${r.status}`);
      if (!d || !d.text) throw new Error("the oracle returned silence");
      return String(d.text).trim();
    } finally {
      try { if (busyId != null && window.CODEX_AI_BUSY) window.CODEX_AI_BUSY.end(busyId); } catch {}
    }
  };

  const ask = (question) => {
    const q = String(question || "").trim();
    if (!q || busyRef.current) return;
    setErr(null);
    const userMsg = { role: "user", content: q, ref: now.ref || "", ts: Date.now() };
    const base = [...msgs, userMsg];
    patchActive(base);
    setBusy(true);
    busyRef.current = true;

    (async () => {
      const grammar = (window.CODEX_ARTIFACTS && window.CODEX_ARTIFACTS.directiveDoc)
        ? "\n\n" + window.CODEX_ARTIFACTS.directiveDoc() : "";
      const toolsActive = toolsOn && !!window.CODEX_KERNEL;
      const toolDoc = toolsActive ? oracle2ToolDirective() : "";
      const system = ORACLE2_SYSTEM + grammar + toolDoc + contextBlock();
      const apiMsgs = base
        .filter(m => m.role === "user" || m.role === "oracle")
        .slice(-12)
        .map(m => ({ role: m.role === "oracle" ? "assistant" : "user", content: m.content }));
      try {
        let reply = await callChat(system, apiMsgs);
        if (toolsActive) {
          for (let step = 0; step < ORACLE2_TOOL_STEPS; step++) {
            const call = oracle2ParseToolCall(reply);
            if (!call) break;
            let result, failed = false;
            try { result = String((await window.CODEX_KERNEL.call(call.tool, call.args)) ?? ""); }
            catch (e) { result = String((e && e.message) || e || "tool failed"); failed = true; }
            const preview = result.replace(/\s+/g, " ").trim().slice(0, 110) || "(empty)";
            patchActive(m => [...m, { role: "tool", tool: call.tool, content: preview, failed, ts: Date.now() }]);
            apiMsgs.push({ role: "assistant", content: reply });
            apiMsgs.push({
              role: "user",
              content: `RESULT of ${call.tool}:\n${result.slice(0, 2400)}` +
                (step === ORACLE2_TOOL_STEPS - 1
                  ? "\n\n(Tool budget exhausted — answer the user now in prose/rich output. Do NOT emit another tool call.)"
                  : ""),
            });
            reply = await callChat(system, apiMsgs);
          }
          if (oracle2ParseToolCall(reply)) {
            apiMsgs.push({ role: "assistant", content: reply });
            apiMsgs.push({ role: "user", content: "Stop calling tools. Answer the user now in prose." });
            reply = await callChat(system, apiMsgs);
          }
        }
        patchActive(m => [...m, { role: "oracle", content: reply, ts: Date.now() }]);
      } catch (e) {
        setErr(String((e && e.message) || e));
      } finally {
        setBusy(false);
        busyRef.current = false;
      }
    })();
  };

  const onSubmit = (e) => {
    e.preventDefault();
    ask(input);
    setInput("");
  };

  const Rich = (window.CODEX_ARTIFACTS && window.CODEX_ARTIFACTS.Rich) || null;

  return (
    <div className="cxo">
      <div className="cxo-banner" role="note">
        ◬ AI COMPANION · NOT SCRIPTURE · EVERY CITED REF IS ONE TAP FROM THE TEXT — CHECK ITS WORK
      </div>

      {/* threads as tabs */}
      <div className="cxo2-tabs" role="tablist" aria-label="Oracle threads">
        {threads.map(t => {
          const isActive = active && t.id === active.id;
          return (
            <button key={t.id} role="tab" aria-selected={isActive}
              className={`cxo2-tab ${isActive ? "is-active" : ""}`}
              onClick={() => { setActiveId(t.id); setErr(null); }}
              title={t.title}>
              <span className="cxo2-tab-lbl">{t.title}</span>
              {threads.length > 1 ? (
                <span className="cxo2-tab-x" role="button" tabIndex={-1} aria-label="Close thread"
                  onClick={(e) => { e.stopPropagation(); closeThread(t.id); }}>×</span>
              ) : null}
            </button>
          );
        })}
        <button className="cxo2-tab-new" onClick={newThread} title="New thread" aria-label="New thread">+</button>
        {window.CODEX_KERNEL ? (
          <button className={`cxo2-tools ${toolsOn ? "is-on" : ""}`}
            onClick={() => setToolsOn(v => !v)}
            aria-pressed={toolsOn}
            title={toolsOn
              ? "Agent tools ON — the oracle may drive the app mid-chat (read passages, search, open panels, change settings — every call shown as a chip). Click to disable."
              : "Agent tools OFF — prose-only replies. Click to enable."}>
            ⚒ TOOLS
          </button>
        ) : null}
      </div>

      {/* the binding — what the oracle is looking at */}
      <div className="cxo-bind">
        <span className="cxo-bind-dot" aria-hidden />
        <span className="cxo-bind-lbl">BOUND TO</span>
        <button className="cxo-bind-ref"
          onClick={() => { if (now.ref && window.codexJumpToRef) window.codexJumpToRef(now.ref); }}
          title="The oracle reads over your shoulder — click to return there">
          {now.ref || "the reader"}
        </button>
        {msgs.length ? (
          <button className="cxo-clear" onClick={() => patchActive([])} title="Burn this thread's messages">CLEAR</button>
        ) : null}
      </div>

      {/* invocations — one-tap scholarly moves on the current verse */}
      <div className="cxo-invoke" role="toolbar" aria-label="Invocations">
        {ORACLE2_INVOCATIONS.map(inv => (
          <button key={inv.id} className="cxo-inv" disabled={busy || !now.ref}
            onClick={() => ask(inv.prompt(now.ref))}
            title={inv.prompt(now.ref || "the current verse")}>
            <i aria-hidden>{inv.glyph}</i>{inv.label}
          </button>
        ))}
      </div>

      <div className="cxo-thread" ref={scrollRef} aria-live="polite">
        {!msgs.length && !busy ? (
          <div className="cxo-empty">
            <span aria-hidden>◬</span>
            <p>The oracle waits. Invoke a move above, or ask anything about {now.ref || "the text"}.</p>
          </div>
        ) : null}
        {msgs.map((m, i) => {
          if (m.role === "tool") {
            return (
              <div key={i} className={`cxo2-toolchip ${m.failed ? "is-failed" : ""}`} title={m.content}>
                <b>⚒ {m.tool}</b>
                <span>{m.content}</span>
              </div>
            );
          }
          return (
            <div key={i} className={`cxo-msg is-${m.role}`}>
              {m.role === "user" ? (
                <>
                  <span className="cxo-msg-who">YOU{m.ref ? ` · ${m.ref}` : ""}</span>
                  <p>{m.content}</p>
                </>
              ) : (
                <>
                  <span className="cxo-msg-who">◬ ORACLE</span>
                  {Rich
                    ? <Rich text={m.content} />
                    : m.content.split(/\n{2,}/).map((p, j) => <p key={j}>{p}</p>)}
                </>
              )}
            </div>
          );
        })}
        {busy ? (
          <div className="cxo-msg is-oracle is-busy">
            <span className="cxo-msg-who">◬ ORACLE</span>
            <p className="cxo-consult"><i /><i /><i /> consulting…</p>
          </div>
        ) : null}
        {err ? (
          <div className="cxo-err">
            <b>THE ORACLE IS DARK</b>
            <code>{err}</code>
          </div>
        ) : null}
      </div>

      <form className="cxo-ask" onSubmit={onSubmit}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={now.ref ? `Ask about ${now.ref}…` : "Ask the oracle…"}
          aria-label="Ask the oracle"
          spellCheck={false}
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send">⮐</button>
      </form>
    </div>
  );
}

(function registerOraclePlugin() {
  if (typeof window === "undefined") return;
  const reg = () => {
    if (!window.CODEX_PLUGINS_API) return false;
    return window.CODEX_PLUGINS_API.register({
      id: "sys-oracle",
      name: "The Oracle",
      version: "11.0.0",
      panels: [{
        id: "oracle",
        label: "ORACLE",
        glyph: "◬",
        render() { return React.createElement(OracleX); },
      }],
    });
  };
  if (!reg()) document.addEventListener("DOMContentLoaded", reg, { once: true });
})();

Object.assign(window, { OracleX });
