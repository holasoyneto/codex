// babelforge.jsx
// CODEX — BabelForge · Translation Lab.
//
// A right-rail plugin (tab "BABEL", glyph ⌬) that lets a user create their
// own AI-assisted Bible translation in any voice — from modern-scholar to
// pirate. Three-pane verse editor: original (Hebrew/Greek) · base (KJV etc.)
// · the user's draft + AI notes. Rigor settings (strict→free) enforce that
// every translation, however playful, preserves what the original says.
//
// Storage: localStorage["codex.babelforge.v1"] — see data model in spec.
// AI:      POST /api/chat — same shape as oracle / passage-guide.
// Engine:  window.CODEX_BabelForgeEngine (translate-engine.js).
//
// Self-registers as a plugin. Defers if the plugin API isn't loaded yet.

(function () {
  if (typeof window === "undefined") return;
  const { useState, useEffect, useMemo, useRef, useCallback } = React;
  const E = React.createElement;

  // ── Storage ────────────────────────────────────────────────────────
  const STORAGE_KEY = "codex.babelforge.v1";
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { projects: [], activeId: null };
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.projects)) return { projects: [], activeId: null };
      return parsed;
    } catch { return { projects: [], activeId: null }; }
  }
  function saveState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }
  function ulid() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  // ── Engine bridge (graceful if engine not yet loaded) ───────────────
  function engine() { return window.CODEX_BabelForgeEngine || null; }

  // ── Books table for scope picker ────────────────────────────────────
  function bookList() {
    try {
      if (window.CODEX_BOOKS && Array.isArray(window.CODEX_BOOKS)) return window.CODEX_BOOKS;
      if (window.CODEX_DATA && Array.isArray(window.CODEX_DATA.books)) return window.CODEX_DATA.books;
    } catch {}
    // Minimal fallback so the wizard still works.
    return [
      { id: "gen", name: "Genesis", chapters: 50 },
      { id: "exo", name: "Exodus", chapters: 40 },
      { id: "psa", name: "Psalms", chapters: 150 },
      { id: "isa", name: "Isaiah", chapters: 66 },
      { id: "mat", name: "Matthew", chapters: 28 },
      { id: "jhn", name: "John", chapters: 21 },
      { id: "rom", name: "Romans", chapters: 16 },
      { id: "rev", name: "Revelation", chapters: 22 }
    ];
  }
  function bookById(id) {
    const b = bookList().find(b => (b.id || b.bookId || "").toLowerCase() === String(id).toLowerCase());
    return b || { id, name: id, chapters: 1 };
  }

  // ── Translation list (existing CODEX translations to seed from) ─────
  function translationList() {
    try {
      if (window.CODEX_DATA && Array.isArray(window.CODEX_DATA.translations)) {
        return window.CODEX_DATA.translations.map(t => ({
          id: t.id || t.code || t.short || "?",
          name: t.name || t.short || t.id
        }));
      }
    } catch {}
    return [
      { id: "kjv", name: "King James Version" },
      { id: "asv", name: "American Standard Version" },
      { id: "web", name: "World English Bible" }
    ];
  }

  // ── Fetch a verse from a base translation (best-effort) ─────────────
  async function fetchBaseVerse(translationId, bookId, chapter, verse) {
    try {
      if (window.CODEX_Bible && typeof window.CODEX_Bible.getVerse === "function") {
        const v = await window.CODEX_Bible.getVerse(translationId, bookId, chapter, verse);
        if (v && (v.text || typeof v === "string")) return v.text || v;
      }
    } catch {}
    try {
      const url = `data/bibles/${translationId}/${bookId}.json`;
      const r = await fetch(url);
      if (r.ok) {
        const j = await r.json();
        const ch = (j.chapters && j.chapters[chapter - 1]) || (j[String(chapter)]);
        const v = ch && (ch.verses ? ch.verses[verse - 1] : ch[String(verse)]);
        if (v) return typeof v === "string" ? v : (v.text || "");
      }
    } catch {}
    return "";
  }

  // ── Strong's-based literal crib (best-effort, optional) ─────────────
  function literalCribFor(bookId, chapter, verse) {
    try {
      const lk = window.CODEX_StrongsLookup;
      if (lk && typeof lk.getVerseWords === "function") {
        const ws = lk.getVerseWords(`${bookId}.${chapter}.${verse}`);
        if (Array.isArray(ws) && ws.length) {
          return ws.map(w => w.gloss || w.lemma || w.translit).filter(Boolean).slice(0, 16).join(" / ");
        }
      }
    } catch {}
    return "";
  }

  // ── AI call ─────────────────────────────────────────────────────────
  async function callAI(systemPrompt, userMsg) {
    const tweaks = (window.CODEX_DATA && window.CODEX_DATA.tweaks) || {};
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: systemPrompt,
        messages: [{ role: "user", content: userMsg }],
        max_tokens: 1200,
        provider: tweaks.aiProvider || tweaks.provider,
        model: tweaks.aiModel || tweaks.model
      })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `BabelForge AI HTTP ${r.status}`);
    return data.text || "";
  }

  // ──────────────────────────────────────────────────────────────────
  // Components
  // ──────────────────────────────────────────────────────────────────

  function Glyph({ children }) {
    return E("span", { className: "bf-glyph" }, children);
  }

  function RigorPicker({ value, onChange }) {
    const eng = engine();
    const rigors = eng ? Object.keys(eng.RIGOR) : ["strict", "balanced", "loose", "free"];
    return E("div", { className: "bf-rigor-seg" },
      rigors.map(k =>
        E("button", {
          key: k,
          className: "bf-rigor-btn" + (value === k ? " on" : ""),
          onClick: () => onChange(k),
          title: eng && eng.RIGOR[k] ? eng.RIGOR[k].desc : ""
        }, eng && eng.RIGOR[k] ? eng.RIGOR[k].label : k)
      )
    );
  }

  function VoiceCard({ tpl, selected, onPick, onRemove }) {
    const sample = (tpl.samples && tpl.samples[0]) || null;
    const isCustom = tpl._ai_generated || tpl.category === "ai-generated" || (engine() && engine().isCustomVoice && engine().isCustomVoice(tpl.id));
    return E("div", { className: "bf-voice-card-wrap" },
      E("button", {
        className: "bf-voice-card" + (selected ? " selected" : "") + (isCustom ? " is-custom" : ""),
        onClick: () => onPick(tpl.id),
        type: "button"
      },
        isCustom ? E("span", { className: "bf-voice-badge", title: "AI-generated custom voice" }, "✨ CUSTOM") : null,
        E("div", { className: "bf-voice-name" }, tpl.name),
        E("div", { className: "bf-voice-desc" }, tpl.description),
        sample ? E("blockquote", { className: "bf-voice-sample" },
          E("div", { className: "bf-voice-sample-ref" }, sample.ref),
          E("div", { className: "bf-voice-sample-text" }, "“" + sample.draft + "”")
        ) : null,
        E("div", { className: "bf-voice-tags" },
          (tpl.tone || []).slice(0, 3).map(t => E("span", { key: t, className: "bf-tag" }, t))
        )
      ),
      isCustom && onRemove ? E("button", {
        className: "bf-voice-card-rm", type: "button",
        title: "Delete this custom voice",
        onClick: (e) => { e.stopPropagation(); if (window.confirm(`Delete the "${tpl.name}" voice?`)) onRemove(tpl.id); }
      }, "✕") : null
    );
  }

  // Voice picker step — built-in + AI-generated custom + "Generate with AI" + free-form custom prompt.
  // Lets the user describe a vibe ("1920s Chicago gangster slang") and the AI authors a complete
  // voice template (system prompt + sample verses + tone tags + rigor default), persisted to
  // localStorage and surfaced everywhere a template is listed.
  function VoicePicker({ templates, voiceId, setVoiceId, customPrompt, setCustomPrompt, onTemplatesChanged }) {
    const [aiPrompt, setAiPrompt] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);
    const [justMade, setJustMade] = useState(null);

    async function doGenerate() {
      const eng = engine();
      if (!eng || !eng.generateVoiceFromPrompt) {
        setErr("Engine not ready — reload."); return;
      }
      if (!aiPrompt.trim()) { setErr("Describe the voice you want."); return; }
      setBusy(true); setErr(null);
      try {
        const tpl = await eng.generateVoiceFromPrompt(aiPrompt.trim());
        setJustMade(tpl.id);
        setVoiceId(tpl.id);
        setAiPrompt("");
        onTemplatesChanged && onTemplatesChanged();
        // Clear the "just made" indicator after a beat
        setTimeout(() => setJustMade(null), 2400);
      } catch (e) {
        setErr(String(e.message || e));
      } finally {
        setBusy(false);
      }
    }

    function doRemove(id) {
      const eng = engine();
      if (eng && eng.removeCustomVoice) {
        eng.removeCustomVoice(id);
        // If we just removed the selected one, fall back
        if (voiceId === id) setVoiceId("modern-scholar");
        onTemplatesChanged && onTemplatesChanged();
      }
    }

    // Group: built-in first, then custom, then "Generate with AI" tile, then "Free-form custom".
    const built = templates.filter(t => !(t._ai_generated || t.category === "ai-generated"));
    const customs = templates.filter(t => (t._ai_generated || t.category === "ai-generated"));

    return E("div", { className: "bf-form" },
      E("label", null, "Pick a voice"),
      E("div", { className: "bf-voice-grid" },
        built.map(t => E(VoiceCard, {
          key: t.id, tpl: t, selected: voiceId === t.id, onPick: setVoiceId
        }))
      ),
      customs.length ? E("div", { style: { marginTop: 14 } },
        E("label", null, "✨ Your AI-generated voices"),
        E("div", { className: "bf-voice-grid" },
          customs.map(t => E(VoiceCard, {
            key: t.id, tpl: t,
            selected: voiceId === t.id,
            onPick: setVoiceId,
            onRemove: doRemove
          }))
        )
      ) : null,
      // ── AI-generator tile ──────────────────────────────────────────
      E("div", { className: "bf-voicegen", style: { marginTop: 16 } },
        E("div", { className: "bf-voicegen-h" },
          E("span", { className: "bf-voicegen-icon" }, "✨"),
          E("b", null, "Generate a new voice with AI"),
          E("span", { className: "bf-voicegen-sub" }, "describe the vibe → AI authors the template")
        ),
        E("div", { className: "bf-voicegen-row" },
          E("input", {
            className: "bf-in bf-voicegen-input",
            value: aiPrompt,
            onChange: e => setAiPrompt(e.target.value),
            placeholder: "e.g. '1920s Chicago gangster slang' · 'Bob Ross narrating' · 'corporate HR memo' · 'epic fantasy narrator'",
            disabled: busy,
            onKeyDown: (e) => { if (e.key === "Enter" && !busy) doGenerate(); }
          }),
          E("button", {
            className: "bf-btn bf-btn-accent",
            type: "button",
            disabled: busy || !aiPrompt.trim(),
            onClick: doGenerate
          }, busy ? "Designing…" : "Generate")
        ),
        err ? E("div", { className: "bf-voicegen-err" }, "⚠ " + err) : null,
        justMade ? E("div", { className: "bf-voicegen-ok" }, "✓ Saved — picked for this project") : null,
        E("div", { className: "bf-voicegen-hint" },
          "Tip: clearer prompts make better voices. Mention period, vocabulary, attitude, audience."
        )
      ),
      // ── Free-form custom prompt (no AI generation) ─────────────────
      E("div", { style: { marginTop: 16 } },
        E("button", {
          className: "bf-voice-card bf-voice-custom" + (voiceId === "custom" ? " selected" : ""),
          onClick: () => setVoiceId("custom"), type: "button"
        },
          E("div", { className: "bf-voice-name" }, "✶ Free-form custom prompt"),
          E("div", { className: "bf-voice-desc" }, "Write the system prompt yourself, verbatim. Skip both the AI designer and the built-in templates.")
        ),
        voiceId === "custom" && E("div", { style: { marginTop: 12 } },
          E("label", null, "Custom voice — system prompt"),
          E("textarea", {
            className: "bf-ta", value: customPrompt,
            onChange: e => setCustomPrompt(e.target.value), rows: 6,
            placeholder: "Describe the voice. e.g. 'Rewrite scripture in the voice of a 1980s synth-wave poet…'"
          })
        )
      )
    );
  }

  // ── Wizard ─────────────────────────────────────────────────────────
  function NewProjectWizard({ onCreate, onClose }) {
    const [step, setStep] = useState(1);
    const [templates, setTemplates] = useState([]);
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [sourceLang, setSourceLang] = useState("auto");
    const [baseTr, setBaseTr] = useState("kjv");
    const [voiceId, setVoiceId] = useState("modern-scholar");
    const [customPrompt, setCustomPrompt] = useState("");
    const [rigor, setRigor] = useState("balanced");
    const [targetLang, setTargetLang] = useState("en");
    const [bookId, setBookId] = useState("gen");
    const [chapStart, setChapStart] = useState(1);
    const [chapEnd, setChapEnd] = useState(1);

    useEffect(() => {
      const eng = engine();
      if (eng) eng.loadVoiceTemplates().then(setTemplates);
    }, []);

    useEffect(() => {
      const tpl = templates.find(t => t.id === voiceId);
      if (tpl && tpl.rigor_default) setRigor(tpl.rigor_default);
    }, [voiceId, templates]);

    const books = bookList();
    const trans = translationList();
    const book = bookById(bookId);

    function go(n) { setStep(Math.max(1, Math.min(5, n))); }

    function commit() {
      const id = "proj-" + ulid();
      const project = {
        id,
        name: name || "Untitled Translation",
        description: desc || "",
        created: Date.now(),
        modified: Date.now(),
        source_language: sourceLang,
        base_translation: baseTr,
        voice_template: voiceId === "custom" ? "custom" : voiceId,
        voice_custom: voiceId === "custom" ? {
          name: "Custom Voice",
          system_prompt: customPrompt || "Render in a thoughtful, lightly modernized English.",
          samples: []
        } : null,
        rigor,
        target_language: targetLang,
        scope: { book: bookId, chapters: [Math.min(chapStart, chapEnd), Math.max(chapStart, chapEnd)] },
        verses: {}
      };
      onCreate(project);
    }

    return E("div", { className: "bf-modal-bg", onClick: e => { if (e.target === e.currentTarget) onClose(); } },
      E("div", { className: "bf-modal" },
        E("div", { className: "bf-modal-head" },
          E("h2", null, "New Translation · Step ", step, " / 5"),
          E("button", { className: "bf-x", onClick: onClose }, "×")
        ),
        E("div", { className: "bf-step" },
          step === 1 && E("div", { className: "bf-form" },
            E("label", null, "Project name"),
            E("input", {
              className: "bf-in", value: name, onChange: e => setName(e.target.value),
              placeholder: "e.g. Genesis · Wall Street Bible"
            }),
            E("label", null, "Description (optional)"),
            E("textarea", {
              className: "bf-ta", value: desc, onChange: e => setDesc(e.target.value), rows: 3,
              placeholder: "What's the spirit of this translation? Who's it for?"
            })
          ),
          step === 2 && E("div", { className: "bf-form" },
            E("label", null, "Source language"),
            E("select", { className: "bf-in", value: sourceLang, onChange: e => setSourceLang(e.target.value) },
              ["auto", "hebrew", "greek", "aramaic", "english"].map(l =>
                E("option", { key: l, value: l }, l[0].toUpperCase() + l.slice(1)))
            ),
            E("label", null, "Base translation (your starting point)"),
            E("select", { className: "bf-in", value: baseTr, onChange: e => setBaseTr(e.target.value) },
              E("option", { value: "blank" }, "— Start blank —"),
              trans.map(t => E("option", { key: t.id, value: t.id }, `${t.name} (${t.id})`))
            ),
            E("label", null, "Target language (ISO code)"),
            E("input", {
              className: "bf-in", value: targetLang, onChange: e => setTargetLang(e.target.value),
              placeholder: "en, es, fr…"
            })
          ),
          step === 3 && E(VoicePicker, {
            templates, voiceId, setVoiceId, customPrompt, setCustomPrompt,
            onTemplatesChanged: () => {
              const eng = engine();
              if (eng) eng.loadVoiceTemplates().then(setTemplates);
            }
          }),
          step === 4 && E("div", { className: "bf-form" },
            E("label", null, "Rigor — how strict are the source-faithful checks?"),
            E(RigorPicker, { value: rigor, onChange: setRigor }),
            E("div", { className: "bf-rigor-explain" },
              (() => {
                const eng = engine();
                const r = eng && eng.RIGOR[rigor];
                return r ? r.desc : "";
              })()
            )
          ),
          step === 5 && E("div", { className: "bf-form" },
            E("label", null, "Scope — which book?"),
            E("select", { className: "bf-in", value: bookId, onChange: e => {
              setBookId(e.target.value);
              setChapStart(1); setChapEnd(1);
            }},
              books.map(b => E("option", { key: b.id || b.bookId, value: b.id || b.bookId },
                b.name + " (" + (b.chapters || "?") + ")"))
            ),
            E("div", { style: { display: "flex", gap: 12 } },
              E("div", { style: { flex: 1 } },
                E("label", null, "From chapter"),
                E("input", {
                  className: "bf-in", type: "number", min: 1, max: book.chapters || 150,
                  value: chapStart, onChange: e => setChapStart(parseInt(e.target.value) || 1)
                })
              ),
              E("div", { style: { flex: 1 } },
                E("label", null, "To chapter"),
                E("input", {
                  className: "bf-in", type: "number", min: 1, max: book.chapters || 150,
                  value: chapEnd, onChange: e => setChapEnd(parseInt(e.target.value) || 1)
                })
              )
            )
          )
        ),
        E("div", { className: "bf-modal-foot" },
          step > 1 && E("button", { className: "bf-btn ghost", onClick: () => go(step - 1) }, "← Back"),
          E("div", { style: { flex: 1 } }),
          step < 5 && E("button", { className: "bf-btn", onClick: () => go(step + 1) }, "Next →"),
          step === 5 && E("button", { className: "bf-btn primary", onClick: commit }, "Create Translation ⌬")
        )
      )
    );
  }

  // ── Verse Editor (three-pane) ──────────────────────────────────────
  function VerseEditor({ project, ref_, onUpdateVerse, onPrev, onNext, voiceTpl }) {
    const eng = engine();
    const [base, setBase] = useState("");
    const [draft, setDraft] = useState("");
    const [busy, setBusy] = useState(false);
    const [literal, setLiteral] = useState("");
    const [aiNotes, setAiNotes] = useState([]);
    const [rigorBadge, setRigorBadge] = useState(null);
    const [mode, setMode] = useState("ai");
    const [locked, setLocked] = useState(false);
    const [err, setErr] = useState("");

    const [, ch, vs] = ref_.split(".");
    const chapter = parseInt(ch, 10);
    const verse = parseInt(vs, 10);

    // Load existing verse from project
    useEffect(() => {
      const v = project.verses[ref_];
      if (v) {
        setBase(v.base || "");
        setDraft(v.draft || "");
        setAiNotes(v.ai_notes || []);
        setMode(v.mode || "ai");
        setLocked(!!v.locked);
        setRigorBadge(v.badge || null);
      } else {
        setDraft(""); setAiNotes([]); setRigorBadge(null); setMode("ai"); setLocked(false);
      }
      setLiteral(literalCribFor(project.scope.book, chapter, verse));
    }, [ref_, project.id]);

    // Load base verse from existing translation
    useEffect(() => {
      let alive = true;
      if (project.base_translation && project.base_translation !== "blank") {
        fetchBaseVerse(project.base_translation, project.scope.book, chapter, verse)
          .then(text => { if (alive) setBase(text || ""); });
      } else {
        setBase("");
      }
      return () => { alive = false; };
    }, [project.id, ref_]);

    function runRigor(d) {
      if (!eng) return null;
      const r = eng.checkRigor(d, base, "", project.rigor);
      setRigorBadge(r.badge);
      return r;
    }

    async function generateAI() {
      if (!eng) { setErr("Translation engine not loaded."); return; }
      setBusy(true); setErr("");
      try {
        const voice = voiceTpl || (project.voice_custom || {});
        const sys = eng.buildSystemPrompt(voice, project.rigor, { target_language: project.target_language });
        const user = eng.buildUserMessage({
          ref: ref_, source: "", source_language: project.source_language,
          base, literal_crib: literal
        });
        const raw = await callAI(sys, user);
        const parsed = eng.parseAIDraft(raw);
        setDraft(parsed.draft || "");
        const r = eng.checkRigor(parsed.draft, base, "", project.rigor);
        const merged = eng.mergeNotes(parsed.notes, r.notes);
        setAiNotes(merged);
        setRigorBadge(r.badge);
        setMode("ai");
        commit({ draft: parsed.draft, ai_notes: merged, badge: r.badge, mode: "ai" });
      } catch (e) {
        setErr(e.message || String(e));
      } finally { setBusy(false); }
    }

    function commit(patch) {
      onUpdateVerse(ref_, Object.assign({
        base, draft, ai_notes: aiNotes, mode, locked, badge: rigorBadge
      }, patch || {}));
    }

    function onDraftBlur() {
      const r = runRigor(draft);
      const notes = r ? r.notes : aiNotes;
      setAiNotes(notes);
      commit({ draft, ai_notes: notes, badge: r ? r.badge : rigorBadge, mode: mode === "ai" ? "edited" : "manual" });
    }

    function toggleLock() {
      const next = !locked;
      setLocked(next);
      commit({ locked: next });
    }

    const badgeText = rigorBadge === "ok"   ? "✓ source-faithful"
                    : rigorBadge === "warn" ? "⚠ flagged"
                    : rigorBadge === "fail" ? "✗ rigor-failed"
                    : "—";
    const badgeClass = "bf-badge bf-badge-" + (rigorBadge || "none");

    return E("div", { className: "bf-editor" },
      E("div", { className: "bf-editor-toolbar" },
        E("button", { className: "bf-btn ghost", onClick: onPrev, title: "Previous verse" }, "‹"),
        E("div", { className: "bf-ref" }, project.scope.book.toUpperCase(), " ", chapter, ":", verse),
        E("button", { className: "bf-btn ghost", onClick: onNext, title: "Next verse" }, "›"),
        E("div", { style: { flex: 1 } }),
        E("button", {
          className: "bf-btn" + (mode === "ai" ? " primary" : ""),
          onClick: () => setMode("ai")
        }, "AI"),
        E("button", {
          className: "bf-btn" + (mode === "manual" ? " primary" : ""),
          onClick: () => setMode("manual")
        }, "Manual"),
        E("button", { className: "bf-btn" + (locked ? " primary" : ""), onClick: toggleLock }, locked ? "🔒" : "🔓"),
        E("button", {
          className: "bf-btn", onClick: generateAI, disabled: busy || locked
        }, busy ? "…" : "Regenerate ⌬"),
        E("span", { className: badgeClass }, badgeText)
      ),
      err && E("div", { className: "bf-err" }, err),
      E("div", { className: "bf-three-pane" },
        E("div", { className: "bf-pane bf-pane-orig" },
          E("div", { className: "bf-pane-h" }, "Original / Crib"),
          E("div", { className: "bf-orig" }, literal || E("em", null, "no Strong's crib available for this verse")),
          E("div", { className: "bf-pane-meta" }, project.source_language)
        ),
        E("div", { className: "bf-pane bf-pane-base" },
          E("div", { className: "bf-pane-h" }, "Base · ", project.base_translation),
          E("div", { className: "bf-base" }, base || E("em", null, "(base text not available offline — start from blank or open online)"))
        ),
        E("div", { className: "bf-pane bf-pane-draft" },
          E("div", { className: "bf-pane-h" }, "Your Draft"),
          E("textarea", {
            className: "bf-draft", value: draft,
            onChange: e => setDraft(e.target.value),
            onBlur: onDraftBlur, rows: 6,
            disabled: locked,
            placeholder: mode === "ai" ? "Click Regenerate ⌬ to draft with AI…" : "Type your translation here…"
          }),
          E("div", { className: "bf-notes" },
            aiNotes.length === 0 && E("div", { className: "bf-note bf-note-info" }, "No notes yet."),
            aiNotes.map((n, i) => E("div", { key: i, className: "bf-note bf-note-" + (n.kind || "info") },
              E("span", { className: "bf-note-kind" }, (n.kind || "info").toUpperCase()),
              " ", n.msg
            ))
          )
        )
      )
    );
  }

  // ── Project Editor ─────────────────────────────────────────────────
  function ProjectEditor({ project, onUpdate, onBack }) {
    const eng = engine();
    const [voiceTpl, setVoiceTpl] = useState(null);
    const [currentVerse, setCurrentVerse] = useState(1);
    const [currentChap, setCurrentChap] = useState(project.scope.chapters[0]);
    const [bulkBusy, setBulkBusy] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);

    useEffect(() => {
      if (!eng) return;
      if (project.voice_template === "custom") {
        setVoiceTpl(project.voice_custom);
      } else {
        eng.loadVoiceTemplates().then(() => {
          setVoiceTpl(eng.getTemplate(project.voice_template));
        });
      }
    }, [project.id, project.voice_template]);

    const ref_ = `${project.scope.book}.${currentChap}.${currentVerse}`;

    function updateVerse(refKey, patch) {
      const verses = Object.assign({}, project.verses);
      const prev = verses[refKey] || {};
      verses[refKey] = Object.assign({}, prev, patch);
      onUpdate(Object.assign({}, project, { verses, modified: Date.now() }));
    }

    function step(d) {
      let v = currentVerse + d;
      let c = currentChap;
      if (v < 1) { c = Math.max(project.scope.chapters[0], c - 1); v = 30; }
      if (v > 60) { c = Math.min(project.scope.chapters[1], c + 1); v = 1; }
      setCurrentChap(c); setCurrentVerse(v);
    }

    async function bulkTranslate(n) {
      if (!eng) return;
      setBulkBusy(true);
      try {
        const voice = voiceTpl || project.voice_custom || {};
        const sys = eng.buildSystemPrompt(voice, project.rigor, { target_language: project.target_language });
        let c = currentChap, v = currentVerse;
        const updates = Object.assign({}, project.verses);
        for (let i = 0; i < n; i++) {
          const key = `${project.scope.book}.${c}.${v}`;
          if (updates[key] && updates[key].locked) { v++; continue; }
          const base = await fetchBaseVerse(project.base_translation, project.scope.book, c, v);
          if (!base) { v++; continue; }
          const userMsg = eng.buildUserMessage({ ref: key, base, literal_crib: literalCribFor(project.scope.book, c, v) });
          try {
            const raw = await callAI(sys, userMsg);
            const parsed = eng.parseAIDraft(raw);
            const r = eng.checkRigor(parsed.draft, base, "", project.rigor);
            updates[key] = {
              base, draft: parsed.draft, mode: "ai",
              ai_notes: eng.mergeNotes(parsed.notes, r.notes),
              badge: r.badge, locked: false
            };
          } catch (e) { /* keep going */ }
          v++;
          if (v > 60) { c++; v = 1; if (c > project.scope.chapters[1]) break; }
        }
        onUpdate(Object.assign({}, project, { verses: updates, modified: Date.now() }));
      } finally { setBulkBusy(false); }
    }

    function recheckAll() {
      if (!eng) return;
      const verses = Object.assign({}, project.verses);
      Object.keys(verses).forEach(k => {
        const v = verses[k];
        const r = eng.checkRigor(v.draft, v.base, "", project.rigor);
        verses[k] = Object.assign({}, v, { ai_notes: r.notes, badge: r.badge });
      });
      onUpdate(Object.assign({}, project, { verses, modified: Date.now() }));
    }

    function exportJSON() {
      const verses = {};
      Object.entries(project.verses).forEach(([k, v]) => { verses[k] = v.draft; });
      const out = {
        meta: {
          id: project.id, name: project.name,
          type: "translation", format: "codex-translation/1",
          voice: project.voice_template, rigor: project.rigor,
          base: project.base_translation, target_language: project.target_language,
          created: project.created, modified: project.modified
        },
        verses
      };
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.id}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function exportMarkdown() {
      const lines = [`# ${project.name}`, ``, `> Voice: **${project.voice_template}** · Rigor: **${project.rigor}** · Base: ${project.base_translation}`, ``];
      const sorted = Object.keys(project.verses).sort();
      sorted.forEach(k => {
        const v = project.verses[k];
        const [, c, vs] = k.split(".");
        lines.push(`**${c}:${vs}**  ${v.draft || ""}`);
      });
      const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${project.id}.md`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function shareUrl() {
      try {
        const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
          n: project.name, v: project.voice_template,
          verses: Object.fromEntries(Object.entries(project.verses).map(([k, v]) => [k, v.draft]))
        }))));
        const url = `${location.origin}${location.pathname}#bf=${payload}`;
        navigator.clipboard.writeText(url).catch(() => {});
        alert("Shareable URL copied to clipboard.");
      } catch (e) { alert("Could not build share URL: " + e.message); }
    }

    const totalVerses = Object.keys(project.verses).length;
    const okCount = Object.values(project.verses).filter(v => v.badge === "ok").length;
    const warnCount = Object.values(project.verses).filter(v => v.badge === "warn").length;
    const failCount = Object.values(project.verses).filter(v => v.badge === "fail").length;

    return E("div", { className: "bf-proj-editor" },
      E("div", { className: "bf-proj-head" },
        E("button", { className: "bf-btn ghost", onClick: onBack }, "← Projects"),
        E("div", { className: "bf-proj-title" },
          E("div", { className: "bf-proj-name" }, project.name),
          E("div", { className: "bf-proj-meta" },
            "voice: ", E("strong", null, project.voice_template), " · ",
            "rigor: ", E("strong", null, project.rigor), " · ",
            "scope: ", project.scope.book, " ", project.scope.chapters[0], "–", project.scope.chapters[1]
          )
        )
      ),
      E("div", { className: "bf-proj-stats" },
        E("span", null, totalVerses, " verses drafted"),
        E("span", { className: "bf-badge bf-badge-ok" }, "✓ ", okCount),
        E("span", { className: "bf-badge bf-badge-warn" }, "⚠ ", warnCount),
        E("span", { className: "bf-badge bf-badge-fail" }, "✗ ", failCount)
      ),
      E(VerseEditor, {
        project, ref_,
        onUpdateVerse: updateVerse,
        onPrev: () => step(-1), onNext: () => step(1),
        voiceTpl
      }),
      E("div", { className: "bf-bulk" },
        E("button", { className: "bf-btn", onClick: () => bulkTranslate(10), disabled: bulkBusy },
          bulkBusy ? "Translating…" : "Translate next 10 verses ⌬"),
        E("button", { className: "bf-btn ghost", onClick: recheckAll }, "Re-check rigor on all"),
        E("div", { style: { flex: 1 } }),
        E("button", { className: "bf-btn", onClick: () => setExportOpen(o => !o) }, "Export ▾")
      ),
      exportOpen && E("div", { className: "bf-export-tray" },
        E("button", { className: "bf-btn", onClick: exportJSON }, "CODEX Translation JSON"),
        E("button", { className: "bf-btn", onClick: exportMarkdown }, "Markdown"),
        E("button", { className: "bf-btn", onClick: shareUrl }, "Copy share URL")
      )
    );
  }

  // ── Top-level panel ─────────────────────────────────────────────────
  function BabelForgePanel(ctx) {
    const [state, setState] = useState(() => loadState());
    const [showWizard, setShowWizard] = useState(false);

    useEffect(() => { saveState(state); }, [state]);

    // Listen for "translate this verse" action coming from the verse menu.
    useEffect(() => {
      function onTranslateVerse(e) {
        const detail = e.detail || {};
        if (!detail.ref) return;
        // If there's an active project, open it; else nudge to create one.
        if (state.activeId) return;
        setShowWizard(true);
      }
      window.addEventListener("codex:babelforge-translate", onTranslateVerse);
      return () => window.removeEventListener("codex:babelforge-translate", onTranslateVerse);
    }, [state.activeId]);

    function createProject(p) {
      const next = {
        projects: state.projects.concat([p]),
        activeId: p.id
      };
      setState(next);
      setShowWizard(false);
    }
    function openProject(id) { setState(Object.assign({}, state, { activeId: id })); }
    function backToList()   { setState(Object.assign({}, state, { activeId: null })); }
    function deleteProject(id) {
      if (!confirm("Delete this translation project? This cannot be undone.")) return;
      setState({
        projects: state.projects.filter(p => p.id !== id),
        activeId: state.activeId === id ? null : state.activeId
      });
    }
    function updateProject(updated) {
      setState({
        projects: state.projects.map(p => p.id === updated.id ? updated : p),
        activeId: state.activeId
      });
    }

    const active = state.projects.find(p => p.id === state.activeId);

    return E("div", { className: "bf-root" },
      E("div", { className: "bf-header" },
        E("div", { className: "bf-title" },
          E(Glyph, null, "⌬"), " ", "BabelForge ", E("span", { className: "bf-sub" }, "· Translation Lab")
        ),
        E("div", { className: "bf-tagline" },
          "Serious scholarship meets playful creativity. Every translation, however playful, preserves what the original actually says."
        )
      ),
      !active && E("div", { className: "bf-list" },
        E("div", { className: "bf-list-head" },
          E("h3", null, "Your Translations"),
          E("button", { className: "bf-btn primary", onClick: () => setShowWizard(true) }, "+ New Translation")
        ),
        state.projects.length === 0 && E("div", { className: "bf-empty" },
          E("p", null, "No projects yet. Spin up your first translation — pick a voice from the catalog (Wall Street Tanakh? Picture-Book? Modern Scholar?) or write a custom system prompt. Rigor settings keep the AI honest."),
          E("button", { className: "bf-btn primary", onClick: () => setShowWizard(true) }, "Start your first ⌬")
        ),
        state.projects.map(p => E("div", { key: p.id, className: "bf-proj-row" },
          E("div", { className: "bf-proj-row-main", onClick: () => openProject(p.id) },
            E("div", { className: "bf-proj-row-name" }, p.name),
            E("div", { className: "bf-proj-row-meta" },
              p.voice_template, " · ", p.rigor, " · ", p.scope.book.toUpperCase(),
              " ", p.scope.chapters[0], "–", p.scope.chapters[1],
              " · ", Object.keys(p.verses || {}).length, " verses"
            )
          ),
          E("button", { className: "bf-btn ghost", onClick: () => openProject(p.id) }, "Open"),
          E("button", { className: "bf-btn ghost", onClick: () => deleteProject(p.id) }, "🗑")
        )),
        E("div", { className: "bf-community" },
          E("h4", null, "Community Translations"),
          E("p", null, E("em", null, "Coming soon — browse user-created translations shared with the community."))
        )
      ),
      active && E(ProjectEditor, {
        project: active,
        onUpdate: updateProject,
        onBack: backToList
      }),
      showWizard && E(NewProjectWizard, {
        onCreate: createProject,
        onClose: () => setShowWizard(false)
      })
    );
  }

  // ── Plugin registration ────────────────────────────────────────────
  function doRegister() {
    if (!window.CODEX_PLUGINS_API) return false;
    window.CODEX_PLUGINS_API.register({
      id: "babelforge",
      name: "BabelForge — Translation Lab",
      version: "1.0.0",
      panels: [{
        id: "babel",
        label: "BABEL",
        glyph: "⌬",
        render: (ctx) => E(BabelForgePanel, ctx || {})
      }],
      verseActions: [{
        label: "Translate this verse →",
        icon: "⌬",
        handler: (ctx) => {
          const ref = ctx && ctx.bookId && ctx.chapter && ctx.verse
            ? `${ctx.bookId}.${ctx.chapter}.${ctx.verse}` : null;
          window.dispatchEvent(new CustomEvent("codex:babelforge-translate", {
            detail: {
              ref,
              text: ctx && ctx.text,
              translation: ctx && ctx.translation
            }
          }));
          window.dispatchEvent(new CustomEvent("codex:open-panel", {
            detail: { pluginId: "babelforge", panelId: "babel", ctx: { ref } }
          }));
        }
      }]
    });
    return true;
  }

  if (!doRegister()) {
    // Defer until plugin API is ready (loaded by plugins.js).
    document.addEventListener("DOMContentLoaded", doRegister, { once: true });
    window.addEventListener("load", doRegister, { once: true });
  }
})();
