// CODEX · Phase 4.6 · AI Study Quests
// =====================================
// An AI-powered quest generator. Where `quest-messiah.jsx` ships a single
// hand-authored guided tour, this plugin lets the user describe ANY theme and
// has the model assemble a 5-8 step scripture quest with passages, questions,
// optional hints, and a closing reflection + AI feedback.
//
// Self-registers as a CODEX plugin (panel "QUESTS"), and also pushes a
// catalog entry into window.CODEX_QUESTS so the existing ⚔ status-bar button
// surfaces an "AI Study Quests" launcher.
//
// Storage layout (all under codex.* namespace):
//   codex.quests.completed         JSON array of finished quest envelopes
//   codex.quest.<id>.answers       per-step user answers + feedback
//   codex.quest.<id>.state         { stepIdx, hintsShown[] } for resume
//
// Network: POST /api/chat — uses the same shape as oracle/passage-guide so
// any configured AI engine works (Anthropic, xAI, Ollama).

(function () {
  if (typeof window === "undefined") return;

  // -------- constants ----------------------------------------------------
  const SUGGESTED = [
    "Trace covenant from Abraham to Christ",
    "What does Jesus say about prayer?",
    "Find the Spirit in the Old Testament",
    "How the apostles understood the resurrection",
    "Names of God in the Pentateuch",
    "Wisdom about suffering across the Bible",
  ];

  const SAVED_KEY = "codex.quests.completed";
  const stateKey   = (id) => `codex.quest.${id}.state`;
  const answersKey = (id) => `codex.quest.${id}.answers`;
  const draftKey   = (id) => `codex.quest.${id}.draft`;

  // -------- helpers ------------------------------------------------------
  function lsGet(k, fallback) {
    try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch {} }

  function getTweaks() {
    return (window.CODEX_DATA && window.CODEX_DATA.tweaks) || {};
  }

  function hasAiKey() {
    // Heuristic mirrors how oracle.jsx decides: if a provider/model is set
    // we attempt; the server returns an actionable error otherwise.
    const t = getTweaks();
    return !!(t.provider || t.model);
  }

  function newQuestId() {
    return "q_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
  }

  // Extract the first {...} JSON object from a possibly-noisy model reply.
  function extractJson(text) {
    if (!text) return null;
    const trimmed = text.trim()
      .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
    try { return JSON.parse(trimmed); } catch {}
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    return null;
  }

  // Hash a finished quest into a shareable URL fragment, mirroring the
  // study-builder pattern: `#quest=<base64-json>`.
  function encodeShare(envelope) {
    try {
      const json = JSON.stringify(envelope);
      const b64 = btoa(unescape(encodeURIComponent(json)));
      return `${location.origin}${location.pathname}#quest=${b64}`;
    } catch { return location.href; }
  }
  function tryImportFromHash() {
    if (!location.hash || !location.hash.startsWith("#quest=")) return null;
    try {
      const b64 = location.hash.slice("#quest=".length);
      const json = decodeURIComponent(escape(atob(b64)));
      return JSON.parse(json);
    } catch { return null; }
  }

  // -------- network: generate & feedback --------------------------------
  async function generateQuest(theme) {
    const t = getTweaks();
    const system = `You are CODEX QUEST DESIGNER. Generate a multi-step guided scripture quest on the user's theme. Return ONLY JSON with this exact shape:
{
  "title": "...",
  "blurb": "1-2 sentence overview",
  "estimate_minutes": 15,
  "steps": [
    {
      "n": 1,
      "passage": "Genesis 12:1-9",
      "passage_ref": "gen.12.1-9",
      "intro": "Brief framing (1-2 sentences) of why this passage matters here.",
      "question": "A thoughtful, open question that invites the user to respond from the text.",
      "guidance": "A hint the user can reveal — points without giving the answer."
    }
  ],
  "synthesis_prompt": "After all steps, ask the user to write a 1-paragraph reflection tying the thread together."
}
Rules: 5-8 steps. Scripture-faithful. Engaging questions, not catechism. Each step must reference a real Bible passage. Output only JSON, no preamble.`;
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: t.provider, model: t.model,
        system,
        messages: [{ role: "user", content: String(theme || "").trim() }],
        max_tokens: 2500,
      }),
    });
    const d = await r.json();
    if (!d || !d.text) throw new Error(d && d.error ? d.error : "No response from AI engine.");
    const quest = extractJson(d.text);
    if (!quest || !Array.isArray(quest.steps) || !quest.steps.length) {
      throw new Error("AI did not return a valid quest. Try a different theme.");
    }
    // Normalize
    quest.id = newQuestId();
    quest.theme = String(theme || "").trim();
    quest.created = Date.now();
    quest.steps = quest.steps.map((s, i) => ({
      n: i + 1,
      passage: s.passage || "",
      passage_ref: s.passage_ref || "",
      intro: s.intro || "",
      question: s.question || "",
      guidance: s.guidance || "",
    }));
    return quest;
  }

  async function generateFeedback(quest, answers) {
    const t = getTweaks();
    const compiled = quest.steps.map(s => {
      const a = answers[s.n] || "";
      return `Step ${s.n} — ${s.passage}\nQ: ${s.question}\nA: ${a || "(no answer)"}`;
    }).join("\n\n");
    const system = `You are a thoughtful, kind, scripture-rich teacher. Read the user's answers across this scripture quest and give honest, warm, specific feedback. Highlight any genuine insights they showed. Where they missed something important, gently point at the text. Close with ONE concrete follow-up reading suggestion (book + chapter). 200-300 words. Plain prose — no headings, no bullets.`;
    const userMsg = `Quest theme: ${quest.theme}\nQuest title: ${quest.title}\n\nUser's reflections:\n\n${compiled}`;
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: t.provider, model: t.model,
        system,
        messages: [{ role: "user", content: userMsg }],
        max_tokens: 900,
      }),
    });
    const d = await r.json();
    if (!d || !d.text) throw new Error(d && d.error ? d.error : "No feedback returned.");
    return d.text.trim();
  }

  // -------- shared UI bits ----------------------------------------------
  function RefLink({ refStr, onAfterJump }) {
    if (!refStr) return null;
    const onClick = (e) => {
      e.preventDefault();
      if (window.codexJumpToRef) window.codexJumpToRef(refStr);
      if (typeof onAfterJump === "function") onAfterJump();
    };
    return React.createElement("a", {
      className: "cx-quest-ref", href: "#", onClick,
      title: `Open ${refStr} in the reader`,
    }, refStr);
  }

  function Skeleton({ lines = 6 }) {
    return React.createElement("div", { className: "cx-quest-skel" },
      ...Array.from({ length: lines }).map((_, i) =>
        React.createElement("div", { key: i, className: "cx-quest-skel-line", style: { width: (60 + (i * 7) % 35) + "%" } })
      ),
    );
  }

  // -------- runner: full-page quest experience --------------------------
  function QuestRunner({ quest, onClose, onComplete }) {
    const { useState, useEffect } = React;
    const initial = lsGet(stateKey(quest.id), { stepIdx: 0, hintsShown: [] });
    const [stepIdx, setStepIdx] = useState(initial.stepIdx || 0);
    const [hintsShown, setHintsShown] = useState(new Set(initial.hintsShown || []));
    const [answers, setAnswers] = useState(() => lsGet(answersKey(quest.id), {}));
    const [draft, setDraft] = useState("");
    const [phase, setPhase] = useState(stepIdx >= quest.steps.length ? "synthesis" : "step");
    const [reflection, setReflection] = useState(() => lsGet(draftKey(quest.id), ""));
    const [feedback, setFeedback] = useState(null);
    const [loadingFb, setLoadingFb] = useState(false);
    const [fbErr, setFbErr] = useState(null);
    const [saved, setSaved] = useState(false);

    const step = quest.steps[stepIdx];
    const total = quest.steps.length;

    useEffect(() => {
      lsSet(stateKey(quest.id), { stepIdx, hintsShown: [...hintsShown] });
    }, [stepIdx, hintsShown, quest.id]);

    useEffect(() => {
      // Seed draft from any previously-stored answer when stepping in/out.
      if (phase === "step") setDraft(answers[step?.n] || "");
    }, [stepIdx, phase]);

    useEffect(() => {
      const onKey = (e) => { if (e.key === "Escape") onClose(); };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    const saveAnswer = () => {
      if (!step) return;
      const next = { ...answers, [step.n]: draft };
      setAnswers(next);
      lsSet(answersKey(quest.id), next);
    };

    const goNext = () => {
      saveAnswer();
      if (stepIdx < total - 1) setStepIdx(i => i + 1);
      else { setPhase("synthesis"); setStepIdx(total); }
    };
    const goPrev = () => {
      saveAnswer();
      if (phase === "synthesis") { setPhase("step"); setStepIdx(total - 1); }
      else if (stepIdx > 0) setStepIdx(i => i - 1);
    };

    const toggleHint = () => {
      const next = new Set(hintsShown);
      if (next.has(step.n)) next.delete(step.n); else next.add(step.n);
      setHintsShown(next);
    };

    const requestFeedback = async () => {
      lsSet(draftKey(quest.id), reflection);
      setLoadingFb(true); setFbErr(null);
      try {
        const combined = { ...answers };
        if (reflection && reflection.trim()) combined.__reflection = reflection.trim();
        // Include the reflection as a virtual final answer
        const fb = await generateFeedback(quest, { ...answers, [`reflection`]: reflection });
        setFeedback(fb);
      } catch (e) { setFbErr(String(e.message || e)); }
      finally { setLoadingFb(false); }
    };

    const saveCompleted = () => {
      const list = lsGet(SAVED_KEY, []);
      const envelope = {
        id: quest.id,
        title: quest.title,
        theme: quest.theme,
        blurb: quest.blurb,
        estimate_minutes: quest.estimate_minutes,
        steps: quest.steps,
        answers,
        reflection,
        feedback,
        completed_at: Date.now(),
      };
      // Replace if exists
      const idx = list.findIndex(x => x.id === envelope.id);
      if (idx >= 0) list[idx] = envelope; else list.unshift(envelope);
      lsSet(SAVED_KEY, list);
      setSaved(true);
      if (typeof onComplete === "function") onComplete(envelope);
    };

    const share = () => {
      const envelope = {
        id: quest.id, title: quest.title, theme: quest.theme,
        blurb: quest.blurb, estimate_minutes: quest.estimate_minutes,
        steps: quest.steps,
      };
      const url = encodeShare(envelope);
      try {
        if (navigator.share) { navigator.share({ title: quest.title, url }); }
        else { navigator.clipboard?.writeText(url); alert("Share link copied to clipboard."); }
      } catch { try { navigator.clipboard?.writeText(url); alert("Link copied."); } catch {} }
    };

    // -------- render ------------------------------------------------------
    const progressPct = phase === "synthesis" ? 100 : Math.round((stepIdx / total) * 100);

    return React.createElement("div", {
      className: "cx-quest-overlay", role: "dialog", "aria-label": `Quest: ${quest.title}`,
    },
      React.createElement("header", { className: "cx-quest-head" },
        React.createElement("span", { className: "cx-quest-tag" }, "AI QUEST"),
        React.createElement("h2", { className: "cx-quest-title-bar" }, quest.title),
        React.createElement("span", { className: "cx-quest-progress" },
          phase === "synthesis" ? "Reflection" : `Step ${stepIdx + 1} / ${total}`),
        React.createElement("button", {
          className: "cx-quest-close", onClick: onClose,
          "aria-label": "Close quest (Esc)", title: "Close · Esc",
        }, "✕"),
      ),
      React.createElement("div", { className: "cx-quest-pbar" },
        React.createElement("div", { className: "cx-quest-pbar-fill", style: { width: progressPct + "%" } }),
      ),
      React.createElement("div", { className: "cx-quest-body" },
        phase === "step" && step ? React.createElement("article", { className: "cx-quest-page" },
          React.createElement("div", { className: "cx-quest-step-no" }, `Step ${step.n} of ${total}`),
          React.createElement("div", { className: "cx-quest-passage" },
            React.createElement(RefLink, { refStr: step.passage, onAfterJump: onClose }),
          ),
          step.intro ? React.createElement("p", { className: "cx-quest-intro" }, step.intro) : null,
          React.createElement("div", { className: "cx-quest-q-wrap" },
            React.createElement("div", { className: "cx-quest-q-label" }, "Question"),
            React.createElement("p", { className: "cx-quest-question" }, step.question),
          ),
          React.createElement("textarea", {
            className: "cx-quest-answer",
            placeholder: "Write your thoughts here…",
            value: draft,
            onChange: e => setDraft(e.target.value),
            onBlur: saveAnswer,
            rows: 6,
          }),
          step.guidance ? React.createElement("div", { className: "cx-quest-hint-wrap" },
            React.createElement("button", { className: "cx-quest-hint-btn", onClick: toggleHint },
              hintsShown.has(step.n) ? "▾ Hide hint" : "▸ Show hint"),
            hintsShown.has(step.n) ? React.createElement("p", { className: "cx-quest-hint" }, step.guidance) : null,
          ) : null,
        ) : null,
        phase === "synthesis" ? React.createElement("article", { className: "cx-quest-page cx-quest-synthesis" },
          React.createElement("h1", { className: "cx-quest-syn-h" }, "Reflection"),
          React.createElement("p", { className: "cx-quest-syn-intro" },
            quest.synthesis_prompt || "Write a one-paragraph reflection tying together what you saw across this quest."),
          React.createElement("textarea", {
            className: "cx-quest-answer cx-quest-reflection",
            placeholder: "Your reflection…",
            value: reflection,
            onChange: e => setReflection(e.target.value),
            onBlur: () => lsSet(draftKey(quest.id), reflection),
            rows: 8,
          }),
          React.createElement("div", { className: "cx-quest-syn-actions" },
            React.createElement("button", {
              className: "cx-quest-primary", onClick: requestFeedback, disabled: loadingFb,
            }, loadingFb ? "Reading your answers…" : (feedback ? "↻ Regenerate feedback" : "Get AI feedback")),
            feedback ? React.createElement("button", {
              className: `cx-quest-secondary ${saved ? "is-saved" : ""}`, onClick: saveCompleted,
            }, saved ? "✓ Saved" : "Save quest") : null,
            feedback ? React.createElement("button", {
              className: "cx-quest-secondary", onClick: share,
            }, "Share") : null,
          ),
          loadingFb ? React.createElement(Skeleton, { lines: 5 }) : null,
          fbErr ? React.createElement("p", { className: "cx-quest-err" }, "⚠ " + fbErr) : null,
          feedback ? React.createElement("section", { className: "cx-quest-feedback" },
            React.createElement("h3", null, "Feedback"),
            React.createElement("p", null, feedback),
          ) : null,
        ) : null,
      ),
      React.createElement("footer", { className: "cx-quest-foot" },
        React.createElement("button", {
          className: "cx-quest-nav cx-quest-prev",
          onClick: goPrev, disabled: phase === "step" && stepIdx === 0,
        }, "← Previous"),
        React.createElement("span", { className: "cx-quest-foot-mid" }, quest.blurb || ""),
        phase === "step" ? React.createElement("button", {
          className: "cx-quest-nav cx-quest-next", onClick: goNext,
        }, stepIdx === total - 1 ? "Finish →" : "Next →") : null,
      ),
    );
  }

  // -------- generator panel --------------------------------------------
  function QuestPanel() {
    const { useState, useEffect } = React;
    const [theme, setTheme] = useState("");
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState(null);
    const [preview, setPreview] = useState(null);
    const [completed, setCompleted] = useState(() => lsGet(SAVED_KEY, []));

    useEffect(() => {
      // Pick up shared quests from URL hash on mount
      const shared = tryImportFromHash();
      if (shared && shared.steps) {
        setPreview({ ...shared, id: shared.id || newQuestId() });
        try { history.replaceState(null, "", location.pathname + location.search); } catch {}
      }
    }, []);

    const refreshCompleted = () => setCompleted(lsGet(SAVED_KEY, []));

    const startGenerate = async (q) => {
      const query = (q || theme || "").trim();
      if (!query) return;
      if (!hasAiKey()) {
        setErr("Add an AI key in Settings → AI Engines.");
        return;
      }
      setLoading(true); setErr(null); setPreview(null);
      try {
        const quest = await generateQuest(query);
        setPreview(quest);
      } catch (e) {
        setErr(String(e.message || e));
      } finally { setLoading(false); }
    };

    const begin = (quest) => {
      launchRunner(quest, () => refreshCompleted());
    };

    const resume = (envelope) => {
      // Re-launch a previously-completed (or in-progress) quest envelope.
      const quest = {
        id: envelope.id, title: envelope.title, theme: envelope.theme,
        blurb: envelope.blurb, estimate_minutes: envelope.estimate_minutes,
        steps: envelope.steps, synthesis_prompt: envelope.synthesis_prompt,
      };
      launchRunner(quest, () => refreshCompleted());
    };

    const deleteSaved = (id) => {
      const list = lsGet(SAVED_KEY, []).filter(x => x.id !== id);
      lsSet(SAVED_KEY, list);
      lsDel(stateKey(id)); lsDel(answersKey(id)); lsDel(draftKey(id));
      setCompleted(list);
    };

    return React.createElement("div", { className: "cx-quest-panel" },
      React.createElement("header", { className: "cx-quest-panel-h" },
        React.createElement("span", { className: "cx-quest-panel-glyph" }, "⚔"),
        React.createElement("div", null,
          React.createElement("h3", null, "AI Study Quests"),
          React.createElement("p", { className: "cx-quest-panel-sub" },
            "Custom guided tours through scripture, generated on demand."),
        ),
      ),

      // Suggested chip catalog
      React.createElement("section", { className: "cx-quest-catalog" },
        React.createElement("div", { className: "cx-quest-cat-label" }, "Suggested quests"),
        React.createElement("div", { className: "cx-quest-chips" },
          ...SUGGESTED.map((s, i) => React.createElement("button", {
            key: i, className: "cx-quest-chip",
            onClick: () => { setTheme(s); startGenerate(s); },
            disabled: loading,
          }, s)),
        ),
      ),

      // Free-form input
      React.createElement("section", { className: "cx-quest-gen" },
        React.createElement("label", { className: "cx-quest-gen-label" }, "Generate a quest about…"),
        React.createElement("div", { className: "cx-quest-gen-row" },
          React.createElement("input", {
            type: "text", className: "cx-quest-gen-input",
            placeholder: "e.g. The role of bread from Eden to Emmaus",
            value: theme,
            onChange: e => setTheme(e.target.value),
            onKeyDown: e => { if (e.key === "Enter") startGenerate(); },
            disabled: loading,
          }),
          React.createElement("button", {
            className: "cx-quest-gen-btn",
            onClick: () => startGenerate(),
            disabled: loading || !theme.trim(),
          }, loading ? "Designing…" : "Generate"),
        ),
        loading ? React.createElement(Skeleton, { lines: 7 }) : null,
        err ? React.createElement("p", { className: "cx-quest-err" }, "⚠ " + err) : null,
      ),

      // Preview of freshly generated quest
      preview ? React.createElement("section", { className: "cx-quest-preview" },
        React.createElement("div", { className: "cx-quest-preview-card" },
          React.createElement("div", { className: "cx-quest-preview-tag" }, "READY"),
          React.createElement("h3", null, preview.title),
          preview.blurb ? React.createElement("p", { className: "cx-quest-preview-blurb" }, preview.blurb) : null,
          React.createElement("div", { className: "cx-quest-preview-meta" },
            React.createElement("span", null, `${preview.steps.length} steps`),
            preview.estimate_minutes ? React.createElement("span", null, `~${preview.estimate_minutes} min`) : null,
          ),
          React.createElement("ol", { className: "cx-quest-preview-steps" },
            ...preview.steps.map((s, i) => React.createElement("li", { key: i },
              React.createElement("b", null, s.passage), " — ", s.question)),
          ),
          React.createElement("div", { className: "cx-quest-preview-actions" },
            React.createElement("button", { className: "cx-quest-primary", onClick: () => begin(preview) }, "Begin"),
            React.createElement("button", { className: "cx-quest-secondary", onClick: () => setPreview(null) }, "Dismiss"),
          ),
        ),
      ) : null,

      // My Quests
      completed && completed.length ? React.createElement("section", { className: "cx-quest-saved" },
        React.createElement("div", { className: "cx-quest-cat-label" }, "My quests"),
        React.createElement("ul", { className: "cx-quest-saved-list" },
          ...completed.map(e => React.createElement("li", { key: e.id, className: "cx-quest-saved-item" },
            React.createElement("div", { className: "cx-quest-saved-body" },
              React.createElement("b", null, e.title),
              e.blurb ? React.createElement("i", null, e.blurb) : null,
              React.createElement("span", { className: "cx-quest-saved-meta" },
                `${e.steps.length} steps · ${new Date(e.completed_at || Date.now()).toLocaleDateString()}`),
            ),
            React.createElement("div", { className: "cx-quest-saved-actions" },
              React.createElement("button", { className: "cx-quest-mini", onClick: () => resume(e) }, "Open"),
              React.createElement("button", { className: "cx-quest-mini cx-quest-mini-warn", onClick: () => deleteSaved(e.id) }, "Delete"),
            ),
          )),
        ),
      ) : null,
    );
  }

  // -------- mount/launch helpers ----------------------------------------
  function launchRunner(quest, onCompleteCb) {
    let host = document.getElementById("cx-ai-quest-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "cx-ai-quest-host";
      document.body.appendChild(host);
    }
    const root = ReactDOM.createRoot(host);
    const close = () => { root.unmount(); host.remove(); };
    root.render(React.createElement(QuestRunner, {
      quest, onClose: close,
      onComplete: (envelope) => { if (typeof onCompleteCb === "function") onCompleteCb(envelope); },
    }));
  }

  function launchCatalog() {
    // Standalone overlay wrapper around QuestPanel so the status-bar QUESTS
    // button can launch us without depending on right-rail panel state.
    let host = document.getElementById("cx-ai-quest-cat-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "cx-ai-quest-cat-host";
      document.body.appendChild(host);
    }
    const root = ReactDOM.createRoot(host);
    const close = () => { root.unmount(); host.remove(); };
    const Wrapper = () => React.createElement("div", {
      className: "cx-quest-overlay cx-quest-overlay-catalog", role: "dialog",
    },
      React.createElement("header", { className: "cx-quest-head" },
        React.createElement("span", { className: "cx-quest-tag" }, "AI QUESTS"),
        React.createElement("h2", { className: "cx-quest-title-bar" }, "Study Quest Catalog"),
        React.createElement("button", { className: "cx-quest-close", onClick: close, "aria-label": "Close" }, "✕"),
      ),
      React.createElement("div", { className: "cx-quest-body cx-quest-body-catalog" },
        React.createElement(QuestPanel, null),
      ),
    );
    root.render(React.createElement(Wrapper));
  }

  // -------- plugin registration -----------------------------------------
  function doRegister() {
    if (window.CODEX_PLUGINS_API && typeof window.CODEX_PLUGINS_API.register === "function") {
      window.CODEX_PLUGINS_API.register({
        id: "ai-quests",
        name: "AI Study Quests",
        version: "1.0.0",
        panels: [{
          id: "quests", label: "QUESTS", glyph: "⚔",
          render: () => React.createElement(QuestPanel, null),
        }],
      });
    }

    // Catalog entry for the existing ⚔ status-bar SideQuestsButton
    window.CODEX_QUESTS = window.CODEX_QUESTS || [];
    const QUEST_ID = "ai-quests-catalog";
    const entry = {
      id: QUEST_ID,
      glyph: "⚔",
      title: "AI Study Quests · custom guided tours",
      blurb: "Describe any theme — get a 5-8 step scripture quest with questions, hints, and AI feedback at the end.",
      run: launchCatalog,
    };
    const existing = window.CODEX_QUESTS.findIndex(q => q.id === QUEST_ID);
    if (existing >= 0) window.CODEX_QUESTS[existing] = entry;
    else window.CODEX_QUESTS.push(entry);

    // Public API for other modules
    window.CODEX_AI_QUESTS = {
      launchCatalog,
      launchRunner,
      generateQuest,
      generateFeedback,
    };
  }

  if (window.CODEX_PLUGINS_API) doRegister();
  else window.addEventListener("DOMContentLoaded", doRegister, { once: true });
})();
