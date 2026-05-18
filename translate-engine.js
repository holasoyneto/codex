// translate-engine.js
// CODEX BabelForge — translation engine helpers. NO React, no DOM mounting.
// Exposes window.CODEX_BabelForgeEngine with:
//   buildSystemPrompt(voice, rigor, opts)        -> string
//   buildUserMessage(verseCtx)                   -> string
//   parseAIDraft(rawText)                        -> { draft, notes, confidence }
//   checkRigor(draft, base, source, rigor)       -> { notes, passed, badge }
//   loadVoiceTemplates()                         -> Promise<templates[]>
//   listTemplates()                              -> templates[] (sync if cached)
//   getTemplate(id)                              -> template | null
//
// "Reverent toward the source text — every translation, however playful,
//  preserves what the original actually says." That's the core invariant.

(function () {
  if (typeof window === "undefined") return;

  // ── Doctrinal anchors ─────────────────────────────────────────────
  // Theologically load-bearing words that must not be paraphrased
  // *away* — they can appear in a stylistic synonym, but the concept
  // must survive. We check the BASE translation for which anchors are
  // load-bearing in *this verse*, then look for either the word or a
  // recognized synonym in the draft.
  const DOCTRINAL_ANCHORS = {
    "god":        ["god", "lord", "almighty", "creator", "father", "founder", "diosito", "señor", "adonai", "hashem", "yhwh", "yahweh", "elohim", "el", "deus", "the maker", "captain", "the one", "i am"],
    "lord":       ["lord", "god", "adonai", "hashem", "yhwh", "yahweh", "señor", "captain", "the almighty"],
    "christ":     ["christ", "mashiach", "messiah", "anointed", "the son", "yeshua", "jesus"],
    "jesus":      ["jesus", "yeshua", "christ", "the son", "the lord", "the master"],
    "spirit":     ["spirit", "ruach", "breath", "wind", "spirit-fire", "ghost"],
    "sin":        ["sin", "transgression", "iniquity", "trespass", "malfeasance", "turnover", "tech debt", "shortfall", "guilt", "wrong"],
    "salvation":  ["salvation", "saved", "deliverance", "rescue", "game-winner", "hotfix", "restored", "redeem", "ransom"],
    "covenant":   ["covenant", "pact", "promise", "term sheet", "agreement", "treaty", "no-trade", "api contract", "vow"],
    "kingdom":    ["kingdom", "realm", "reign", "dynasty", "platform", "throne", "rule"],
    "faith":      ["faith", "trust", "belief", "loyalty", "emunah"],
    "grace":      ["grace", "favor", "gift", "mercy", "chesed", "kindness"],
    "love":       ["love", "amor", "agape", "chesed", "adore", "cherish"],
    "righteous":  ["righteous", "just", "upright", "tzaddik"],
    "heaven":     ["heaven", "heavens", "sky", "high realm", "the kingdom"],
    "holy":       ["holy", "kadosh", "set apart", "sacred", "consecrated"]
  };

  // Proper nouns we expect to survive verbatim (or in a known native form).
  // The voice templates can substitute Yeshua for Jesus etc. — so we keep
  // a SYNONYM map and consider any of the listed forms acceptable.
  const PROPER_NOUN_SYNONYMS = {
    "jesus":   ["jesus", "yeshua", "yeshu", "jesús", "iesus", "the lord", "christ", "mashiach"],
    "christ":  ["christ", "mashiach", "messiah", "the anointed"],
    "moses":   ["moses", "moshe", "moisés"],
    "abraham": ["abraham", "avraham", "abram"],
    "david":   ["david", "dawid", "david"],
    "mary":    ["mary", "miriam", "maría", "la virgencita"],
    "john":    ["john", "yochanan", "juan"],
    "peter":   ["peter", "kepha", "cephas", "pedro", "simón", "shimon", "simon"],
    "paul":    ["paul", "shaul", "saul", "pablo"],
    "israel":  ["israel", "yisrael"],
    "jerusalem": ["jerusalem", "yerushalayim", "jerusalén", "the city"],
    "egypt":   ["egypt", "mitzrayim", "egipto"],
    "god":     ["god", "lord", "adonai", "hashem", "elohim", "yhwh", "yahweh", "diosito", "señor", "the founder", "the almighty", "the maker", "deus", "captain"]
  };

  function tokens(s) {
    return String(s || "").toLowerCase()
      .replace(/[^a-záéíóúñü' -]/gi, " ")
      .split(/\s+/).filter(Boolean);
  }
  function wordCount(s) { return tokens(s).length; }
  function hasAny(draft, list) {
    if (!draft) return false;
    const lo = " " + String(draft).toLowerCase() + " ";
    return list.some(w => lo.includes(" " + w.toLowerCase() + " ") ||
                          lo.includes(" " + w.toLowerCase() + "'") ||
                          lo.includes(w.toLowerCase()));
  }

  // ── Template cache ────────────────────────────────────────────────
  // Built-in templates ship in data/modules/voice-templates.json.
  // Custom templates live in localStorage and are merged in at load time.
  // AI-generated templates (via generateVoiceFromPrompt) write to the
  // custom store and become available everywhere a template is listed.
  const CUSTOM_KEY = "codex.babelforge.customVoices.v1";

  let _builtIns = null;
  let _builtInsPromise = null;
  let _customs = null;

  function loadCustomVoices() {
    if (_customs) return _customs;
    try {
      const raw = localStorage.getItem(CUSTOM_KEY);
      _customs = raw ? (JSON.parse(raw) || []) : [];
    } catch { _customs = []; }
    return _customs;
  }
  function persistCustomVoices() {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(_customs || [])); } catch {}
  }
  function saveCustomVoice(tpl) {
    if (!tpl || !tpl.id || !tpl.name || !tpl.system_prompt) {
      throw new Error("Invalid voice template — needs id + name + system_prompt");
    }
    loadCustomVoices();
    // Replace if id collides, else append
    const i = _customs.findIndex(t => t.id === tpl.id);
    if (i >= 0) _customs[i] = tpl; else _customs.push(tpl);
    persistCustomVoices();
    return tpl;
  }
  function removeCustomVoice(id) {
    loadCustomVoices();
    const before = _customs.length;
    _customs = _customs.filter(t => t.id !== id);
    persistCustomVoices();
    return _customs.length < before;
  }
  function listCustomVoices() { return loadCustomVoices().slice(); }
  function isCustomVoice(id) { return loadCustomVoices().some(t => t.id === id); }

  function loadVoiceTemplates() {
    if (_builtIns) return Promise.resolve([..._builtIns, ...loadCustomVoices()]);
    if (_builtInsPromise) return _builtInsPromise.then(() => [..._builtIns, ...loadCustomVoices()]);
    _builtInsPromise = fetch("data/modules/voice-templates.json")
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        _builtIns = (j && Array.isArray(j.templates)) ? j.templates : [];
        return _builtIns;
      })
      .catch(() => { _builtIns = []; return _builtIns; });
    return _builtInsPromise.then(() => [..._builtIns, ...loadCustomVoices()]);
  }
  function listTemplates() {
    return [...(_builtIns || []), ...loadCustomVoices()];
  }
  function getTemplate(id) {
    if (_builtIns) {
      const b = _builtIns.find(t => t.id === id);
      if (b) return b;
    }
    return loadCustomVoices().find(t => t.id === id) || null;
  }

  // ── AI-generated voice templates ──────────────────────────────────
  // User describes a vibe ("1920s Chicago gangster slang"). We ask the
  // AI to author a complete template matching our schema and save it as
  // a custom voice. Returns the saved template.
  async function generateVoiceFromPrompt(userPrompt, { provider, model } = {}) {
    if (!userPrompt || !userPrompt.trim()) {
      throw new Error("Prompt is empty.");
    }
    const tweaks = (window.CODEX_DATA && window.CODEX_DATA.tweaks) || {};
    const p = provider || tweaks.provider;
    const m = model    || tweaks.model;
    const sys = `You are BabelForge Voice Designer. The user describes a translation voice; you author a complete voice template for rewriting scripture in that style. Return ONLY JSON, no prose, no fences:

{
  "id": "kebab-case-id-derived-from-the-vibe",
  "name": "Title Case Name",
  "description": "1 sentence — what reading this Bible would feel like.",
  "category": "themed",
  "system_prompt": "A 2-4 sentence directive that will be sent verbatim to the translation AI. MUST say: preserve all proper nouns, preserve the sequence of events, preserve theological meaning even when style is playful. Then describe the voice vividly.",
  "samples": [
    { "ref": "gen.1.1", "original": "In the beginning God created the heaven and the earth.", "draft": "<one-sentence sample in the new voice>" },
    { "ref": "john.3.16", "original": "For God so loved the world, that he gave his only begotten Son...", "draft": "<one-sentence sample in the new voice>" }
  ],
  "rigor_default": "balanced",
  "tone": ["tag1", "tag2", "tag3"]
}

Rules:
- Be vivid and specific. A voice template is only as good as its system_prompt.
- Honor the user's intent. If they ask for "1920s Chicago gangster", don't soften it; if they ask "kid-friendly Christmas-story narrator", don't make it stiff.
- Reverence-of-content is non-negotiable; voice-of-delivery is the playground.
- Pick rigor_default by vibe: scholarly/literal voices → "strict"; mainstream/themed → "balanced"; experimental/playful → "loose".
- tone is 2-5 short tags.`;
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: p, model: m,
        system: sys,
        messages: [{ role: "user", content: userPrompt }],
        max_tokens: 1200,
      }),
    });
    const data = await resp.json();
    if (!resp.ok || data.error) throw new Error(data.error || `AI returned ${resp.status}`);
    const text = (data.text || "").trim();
    // Tolerate fenced code blocks
    const json = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    let tpl;
    try { tpl = JSON.parse(json); } catch (e) {
      throw new Error("AI didn't return parseable JSON. Try a clearer prompt.");
    }
    // Validate + normalize
    if (!tpl.id)            tpl.id = "custom-" + Math.random().toString(36).slice(2, 8);
    if (!tpl.id.startsWith("custom-")) tpl.id = "custom-" + tpl.id;
    if (!tpl.name)          tpl.name = userPrompt.slice(0, 40);
    if (!tpl.description)   tpl.description = userPrompt;
    if (!tpl.category)      tpl.category = "ai-generated";
    if (!tpl.rigor_default) tpl.rigor_default = "balanced";
    if (!Array.isArray(tpl.tone))    tpl.tone = ["ai-generated"];
    if (!Array.isArray(tpl.samples)) tpl.samples = [];
    if (!tpl.system_prompt) {
      throw new Error("AI didn't produce a system_prompt. Try a clearer prompt.");
    }
    tpl._ai_generated = true;
    tpl._created = Date.now();
    tpl._source_prompt = userPrompt;
    saveCustomVoice(tpl);
    return tpl;
  }

  // ── Rigor rule packs ──────────────────────────────────────────────
  const RIGOR = {
    strict: {
      label: "Strict",
      desc: "AI refuses any addition or omission. Doctrinal anchors enforced. Word-count tightly bounded.",
      maxDelta: 0.30,        // 30% word-count drift
      anchorRequired: true,
      properNounRequired: true,
      promptRules:
        "RIGOR: STRICT. You MUST preserve every proper noun, every event in order, every theological term. " +
        "Do NOT add or remove content. If you cannot produce a faithful rendering in this voice, return an empty draft string and a note (kind:'fail') explaining why."
    },
    balanced: {
      label: "Balanced",
      desc: "AI flags additions/omissions as warnings. Doctrinal anchors must survive in synonym form.",
      maxDelta: 0.60,
      anchorRequired: true,
      properNounRequired: true,
      promptRules:
        "RIGOR: BALANCED. Preserve every proper noun (a recognized native equivalent like Yeshua for Jesus is fine), every event in sequence, every theological meaning. Stylistic additions are OK; flag them in notes (kind:'warn')."
    },
    loose: {
      label: "Loose",
      desc: "Style can flex. Theology must hold. Doctrinal anchors should survive in some form.",
      maxDelta: 1.20,
      anchorRequired: true,
      properNounRequired: false,
      promptRules:
        "RIGOR: LOOSE. The voice is allowed to flex. You MUST preserve theological meaning and the sequence of events. Proper nouns may be replaced by an in-world equivalent (e.g. 'the Captain Above All' for God in pirate voice) — but flag this in notes."
    },
    free: {
      label: "Free",
      desc: "No automated checks. Pure creative mode. Use with care.",
      maxDelta: Infinity,
      anchorRequired: false,
      properNounRequired: false,
      promptRules:
        "RIGOR: FREE. No checks. Channel the voice fully. Stay reverent toward the source."
    }
  };

  // ── Prompt builders ───────────────────────────────────────────────
  const BASE_INVARIANTS =
    "BABELFORGE INVARIANTS — these never bend, regardless of voice:\n" +
    "1. Preserve every proper noun (or a recognized native equivalent).\n" +
    "2. Preserve the sequence of events.\n" +
    "3. Preserve subject/object/verb relationships — who did what to whom.\n" +
    "4. Do NOT change theological meaning even if the style is playful.\n" +
    "5. Paraphrase the vehicle, not the cargo.\n";

  const OUTPUT_FORMAT =
    "OUTPUT FORMAT — return ONLY a single JSON object, no prose, no fences:\n" +
    "{\n" +
    "  \"draft\": \"<the rendered verse in the requested voice>\",\n" +
    "  \"notes\": [ { \"kind\": \"info|warn|fail\", \"msg\": \"<short rationale>\" } ],\n" +
    "  \"confidence\": <number 0..1 — your faithfulness self-assessment>\n" +
    "}\n";

  function buildSystemPrompt(voice, rigor, opts) {
    const r = RIGOR[rigor] || RIGOR.balanced;
    const v = voice || {};
    const targetLang = (opts && opts.target_language) || "en";
    const langDirective = targetLang === "en" ? "" :
      `\nTARGET LANGUAGE: write the draft in ${targetLang}. Keep proper nouns in their established target-language form.\n`;
    const voiceBlock = v.system_prompt
      ? `VOICE — ${v.name || "Custom"}:\n${v.system_prompt}\n`
      : `VOICE — Custom:\nRender in a faithful, lightly modernized English.\n`;
    const samples = Array.isArray(v.samples) && v.samples.length
      ? "\nSAMPLES (this voice in action):\n" +
        v.samples.map(s => `  • ${s.ref} — orig: "${s.original}" → draft: "${s.draft}"`).join("\n") + "\n"
      : "";
    return [
      "You are the CODEX BabelForge translator — a scholarly-yet-playful Bible translation engine.",
      "",
      voiceBlock,
      samples,
      BASE_INVARIANTS,
      r.promptRules + langDirective,
      "",
      OUTPUT_FORMAT,
      "Return the JSON object and nothing else."
    ].join("\n");
  }

  function buildUserMessage(verseCtx) {
    const lines = [];
    lines.push(`REFERENCE: ${verseCtx.ref || "(unknown)"}`);
    if (verseCtx.source) lines.push(`ORIGINAL (${verseCtx.source_language || "source"}): ${verseCtx.source}`);
    if (verseCtx.base)   lines.push(`BASE TRANSLATION: ${verseCtx.base}`);
    if (verseCtx.literal_crib) lines.push(`LITERAL CRIB: ${verseCtx.literal_crib}`);
    lines.push("");
    lines.push("Render this single verse in the requested voice. Return ONLY the JSON object.");
    return lines.join("\n");
  }

  // ── Response parser ───────────────────────────────────────────────
  function parseAIDraft(rawText) {
    if (!rawText) return { draft: "", notes: [{ kind: "fail", msg: "empty AI response" }], confidence: 0 };
    let s = String(rawText).trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    const i = s.indexOf("{");
    const j = s.lastIndexOf("}");
    if (i === -1 || j === -1) {
      return { draft: s, notes: [{ kind: "warn", msg: "AI returned prose, not JSON — using as-is" }], confidence: 0.3 };
    }
    let obj;
    try { obj = JSON.parse(s.slice(i, j + 1)); }
    catch (e) {
      return { draft: s.slice(i, j + 1), notes: [{ kind: "warn", msg: "JSON parse failed: " + e.message }], confidence: 0.2 };
    }
    return {
      draft: String(obj.draft || ""),
      notes: Array.isArray(obj.notes) ? obj.notes.filter(n => n && n.msg).map(n => ({
        kind: ["info", "warn", "fail"].includes(n.kind) ? n.kind : "info",
        msg: String(n.msg).slice(0, 240)
      })) : [],
      confidence: typeof obj.confidence === "number" ? Math.max(0, Math.min(1, obj.confidence)) : 0.7
    };
  }

  // ── Rigor check engine ────────────────────────────────────────────
  // Runs LOCAL deterministic checks on a draft (independent of AI self-report).
  // Returns badge: "ok" | "warn" | "fail" — the user always sees the truth.
  function checkRigor(draft, base, source, rigorId) {
    const rigor = RIGOR[rigorId] || RIGOR.balanced;
    const notes = [];
    let passed = true;

    if (!draft || !String(draft).trim()) {
      return { notes: [{ kind: "fail", msg: "Draft is empty." }], passed: false, badge: "fail" };
    }

    // Word-count delta (vs the base translation if present, else vs source)
    const reference = base || source || "";
    if (reference) {
      const refN = wordCount(reference);
      const draftN = wordCount(draft);
      if (refN > 0) {
        const delta = Math.abs(draftN - refN) / refN;
        if (delta > rigor.maxDelta) {
          notes.push({
            kind: rigorId === "strict" ? "fail" : "warn",
            msg: `Word count drift ${Math.round(delta * 100)}% (base ${refN}, draft ${draftN}). Rigor limit ${Math.round(rigor.maxDelta * 100)}%.`
          });
          if (rigorId === "strict") passed = false;
        }
        if (delta > 0.5) {
          notes.push({ kind: "info", msg: `Length drift >50% will be flagged in any rigor level — verify nothing was added or dropped.` });
        }
      }
    }

    // Doctrinal anchors — for each anchor present in base, expect a synonym in draft
    if (rigor.anchorRequired && base) {
      const baseLo = base.toLowerCase();
      Object.keys(DOCTRINAL_ANCHORS).forEach(anchor => {
        if (baseLo.includes(anchor)) {
          if (!hasAny(draft, DOCTRINAL_ANCHORS[anchor])) {
            notes.push({
              kind: rigorId === "strict" ? "fail" : "warn",
              msg: `Doctrinal anchor "${anchor}" appears in base but not in draft (or any recognized synonym).`
            });
            if (rigorId === "strict") passed = false;
          }
        }
      });
    }

    // Proper nouns — capitalized words in base of length >= 3 should appear
    // (or a synonym) in the draft.
    if (rigor.properNounRequired && base) {
      const propers = (base.match(/\b[A-Z][a-zA-Z]{2,}\b/g) || [])
        .filter(w => !["The", "And", "But", "For", "Lord", "God", "He", "She", "Who", "What", "When", "Where", "Why", "How", "Yea", "Verily", "Behold", "Now", "Then", "Thus", "So", "All", "Of", "In", "On", "At", "To", "From", "With"].includes(w));
      const seen = new Set();
      propers.forEach(p => {
        const key = p.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        const syns = PROPER_NOUN_SYNONYMS[key] || [key];
        if (!hasAny(draft, syns)) {
          notes.push({
            kind: rigorId === "strict" ? "fail" : "warn",
            msg: `Proper noun "${p}" in base is missing from draft (no recognized equivalent found).`
          });
          if (rigorId === "strict") passed = false;
        }
      });
    }

    if (!notes.length) notes.push({ kind: "info", msg: "Source-faithful — all rigor checks passed." });

    const hasFail = notes.some(n => n.kind === "fail");
    const hasWarn = notes.some(n => n.kind === "warn");
    const badge = hasFail ? "fail" : (hasWarn ? "warn" : "ok");
    return { notes, passed: !hasFail, badge };
  }

  // Merge AI self-reported notes with local rigor notes (dedupe by msg).
  function mergeNotes(aiNotes, rigorNotes) {
    const out = [];
    const seen = new Set();
    [].concat(rigorNotes || [], aiNotes || []).forEach(n => {
      const k = (n.kind || "info") + "::" + (n.msg || "");
      if (seen.has(k)) return;
      seen.add(k);
      out.push(n);
    });
    return out;
  }

  // ── Export ────────────────────────────────────────────────────────
  window.CODEX_BabelForgeEngine = {
    RIGOR,
    DOCTRINAL_ANCHORS,
    PROPER_NOUN_SYNONYMS,
    buildSystemPrompt,
    buildUserMessage,
    parseAIDraft,
    checkRigor,
    mergeNotes,
    loadVoiceTemplates,
    listTemplates,
    getTemplate,
    listCustomVoices,
    saveCustomVoice,
    removeCustomVoice,
    isCustomVoice,
    generateVoiceFromPrompt,
    wordCount
  };

  // Kick off template load early so the UI has data on first paint.
  loadVoiceTemplates();
})();
