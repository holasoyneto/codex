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
      "- open_console/goto are for SHOWING the reader things — use at most 2 per mission, only when visual context truly helps.",
      "- Return ONLY the JSON object each turn.",
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
    var r = await fetch("/api/chat", {
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
    var body = await r.json().catch(function () { return {}; });
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

  window.CODEX_KERNEL = {
    register: register,
    tools: function () { return Object.keys(TOOLS); },
    run: run,
    missions: loadMissions,
    parseRef: parseRef,
  };
})();
