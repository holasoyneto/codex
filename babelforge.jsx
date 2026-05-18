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

  // ── Canon presets (book id arrays for the wizard scope) ─────────────
  const CANON = {
    OT: ["gen","exo","lev","num","deu","jos","jdg","rut","1sa","2sa","1ki","2ki","1ch","2ch","ezr","neh","est","job","psa","pro","ecc","sng","isa","jer","lam","ezk","dan","hos","jol","amo","oba","jon","mic","nam","hab","zep","hag","zec","mal"],
    NT: ["mat","mrk","luk","jhn","act","rom","1co","2co","gal","eph","php","col","1th","2th","1ti","2ti","tit","phm","heb","jas","1pe","2pe","1jn","2jn","3jn","jud","rev"],
    TORAH: ["gen","exo","lev","num","deu"],
    GOSPELS: ["mat","mrk","luk","jhn"],
    PAULINE: ["rom","1co","2co","gal","eph","php","col","1th","2th","1ti","2ti","tit","phm"],
  };
  CANON.BIBLE = CANON.OT.concat(CANON.NT);
  const PRESETS = [
    { id: "bible",   label: "Whole Bible (66)",  books: CANON.BIBLE   },
    { id: "ot",      label: "Whole OT (39)",     books: CANON.OT      },
    { id: "nt",      label: "Whole NT (27)",     books: CANON.NT      },
    { id: "torah",   label: "Torah (5)",         books: CANON.TORAH   },
    { id: "gospels", label: "Gospels (4)",       books: CANON.GOSPELS },
    { id: "pauline", label: "Pauline (13)",      books: CANON.PAULINE },
  ];

  // Normalize a project's scope to an iterable of { bookId, fromChap, toChap }.
  // Supports both new multi-book `scope.books: [...]` and legacy single-book
  // `scope.book + scope.chapters: [a,b]`. Read-time migration only.
  function normalizeScope(project) {
    const sc = project.scope || {};
    const out = [];
    if (Array.isArray(sc.books) && sc.books.length) {
      for (const bid of sc.books) {
        const b = bookById(bid);
        out.push({ bookId: bid, fromChap: 1, toChap: b.chapters || 1 });
      }
      return out;
    }
    if (sc.book) {
      const [a, b] = Array.isArray(sc.chapters) ? sc.chapters : [1, 1];
      out.push({ bookId: sc.book, fromChap: a, toChap: b });
    }
    return out;
  }

  // First book / chapter pair for navigation defaults.
  function scopeFirst(project) {
    const arr = normalizeScope(project);
    if (!arr.length) return { bookId: "gen", chapter: 1 };
    return { bookId: arr[0].bookId, chapter: arr[0].fromChap };
  }

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
    if (!translationId || translationId === "blank") return "";
    try {
      if (window.BIBLE && typeof window.BIBLE.loadChapter === "function") {
        const list = await window.BIBLE.loadChapter(bookId, chapter, translationId);
        const v = Array.isArray(list) ? list.find(x => x.n === verse) : null;
        if (v && v.text) return v.text;
      }
    } catch (e) { /* fall through */ }
    return "";
  }

  // Cache chapter verse-lengths per project so verse navigation can step
  // past true chapter ends rather than a hardcoded "v > 60". Maps
  // `${bookId}.${chapter}.${translation}` → integer length.
  const _chapterLenCache = {};
  async function chapterLen(translationId, bookId, chapter) {
    const k = `${bookId}.${chapter}.${translationId}`;
    if (_chapterLenCache[k]) return _chapterLenCache[k];
    if (!translationId || translationId === "blank") return 50;
    try {
      if (window.BIBLE && typeof window.BIBLE.loadChapter === "function") {
        const list = await window.BIBLE.loadChapter(bookId, chapter, translationId);
        const n = Array.isArray(list) && list.length ? list[list.length - 1].n : 0;
        if (n) { _chapterLenCache[k] = n; return n; }
      }
    } catch {}
    return 50;
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
    const body = JSON.stringify({
      system: systemPrompt,
      messages: [{ role: "user", content: userMsg }],
      max_tokens: 1200,
      provider: tweaks.aiProvider || tweaks.provider,
      model: tweaks.aiModel || tweaks.model
    });
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body
      });
      if (r.status === 429) {
        const ra = parseFloat(r.headers.get("Retry-After") || "");
        const baseWait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 2000;
        const jitter = Math.floor(Math.random() * 500);
        await new Promise(res => setTimeout(res, baseWait * (attempt + 1) + jitter));
        lastErr = new Error("rate-limited (429)");
        continue;
      }
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `BabelForge AI HTTP ${r.status}`);
      return data.text || "";
    }
    throw lastErr || new Error("BabelForge AI: 429 retries exhausted");
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
    const [scopePreset, setScopePreset] = useState("single"); // "single" or preset.id

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
        scope: scopePreset === "single"
          ? { book: bookId, chapters: [Math.min(chapStart, chapEnd), Math.max(chapStart, chapEnd)] }
          : { books: (PRESETS.find(p => p.id === scopePreset) || {}).books || [bookId] },
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
            E("label", null, "Scope — preset"),
            E("div", { className: "bf-preset-row", style: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 } },
              E("button", {
                type: "button",
                className: "bf-rigor-btn" + (scopePreset === "single" ? " on" : ""),
                onClick: () => setScopePreset("single")
              }, "Single book"),
              PRESETS.map(p => E("button", {
                key: p.id, type: "button",
                className: "bf-rigor-btn" + (scopePreset === p.id ? " on" : ""),
                onClick: () => setScopePreset(p.id)
              }, p.label))
            ),
            scopePreset === "single" ? E("div", null,
              E("label", null, "Book"),
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
            ) : E("div", { className: "bf-preset-summary", style: { padding: 10, background: "#0f1620", borderRadius: 6, fontSize: 13, color: "#8a98a8" } },
              (() => {
                const p = PRESETS.find(x => x.id === scopePreset);
                if (!p) return null;
                return p.books.length + " books — translation will run book-by-book in the background. You can stop any time.";
              })()
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
  function VerseEditor({ project, ref_, onUpdateVerse, onPrev, onNext, onJump, voiceTpl }) {
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

    const [bk, ch, vs] = ref_.split(".");
    const chapter = parseInt(ch, 10);
    const verse = parseInt(vs, 10);
    const bookForRef = bk;

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
      setLiteral(literalCribFor(bookForRef, chapter, verse));
    }, [ref_, project.id]);

    // Load base verse from existing translation
    useEffect(() => {
      let alive = true;
      if (project.base_translation && project.base_translation !== "blank") {
        fetchBaseVerse(project.base_translation, bookForRef, chapter, verse)
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

    const scopeBooks = normalizeScope(project).map(s => s.bookId);
    const bookOpts = (scopeBooks.length ? scopeBooks : [bookForRef]).map(b => ({ id: b, name: (bookById(b).name || b).toUpperCase(), chapters: bookById(b).chapters || 1 }));
    const curBookMeta = bookOpts.find(b => b.id === bookForRef) || bookOpts[0];
    const chapMax = curBookMeta.chapters || 1;
    // Best-effort verse cap — assume 176 (Ps 119) so the user can jump
    // even into long chapters. Out-of-range jumps just show blank base.
    const verseMax = 176;

    return E("div", { className: "bf-editor" },
      E("div", { className: "bf-editor-toolbar" },
        E("button", { className: "bf-btn ghost", onClick: onPrev, title: "Previous verse (←)" }, "‹"),
        E("select", {
          className: "bf-in", style: { padding: "4px 6px", marginRight: 4 },
          value: bookForRef,
          onChange: e => onJump && onJump(e.target.value, 1, 1),
          title: "Jump to book"
        }, bookOpts.map(b => E("option", { key: b.id, value: b.id }, b.name))),
        E("input", {
          className: "bf-in", type: "number", min: 1, max: chapMax, value: chapter,
          style: { width: 56, padding: "4px 6px", textAlign: "center" },
          onChange: e => { const n = parseInt(e.target.value, 10); if (!isNaN(n) && n >= 1 && n <= chapMax) onJump && onJump(bookForRef, n, verse); },
          title: `Chapter (1–${chapMax})`
        }),
        E("span", { style: { opacity: 0.55 } }, ":"),
        E("input", {
          className: "bf-in", type: "number", min: 1, max: verseMax, value: verse,
          style: { width: 56, padding: "4px 6px", textAlign: "center" },
          onChange: e => { const n = parseInt(e.target.value, 10); if (!isNaN(n) && n >= 1 && n <= verseMax) onJump && onJump(bookForRef, chapter, n); },
          title: "Verse"
        }),
        E("button", { className: "bf-btn ghost", onClick: onNext, title: "Next verse (→)" }, "›"),
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
  function ProjectEditor({ project, onUpdate, onBack, autoForge, onAutoForgeStarted }) {
    const eng = engine();
    const [voiceTpl, setVoiceTpl] = useState(null);
    const _first = scopeFirst(project);
    const [currentBook, setCurrentBook] = useState(_first.bookId);
    const [currentVerse, setCurrentVerse] = useState(1);
    const [currentChap, setCurrentChap] = useState(_first.chapter);
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

    const ref_ = `${currentBook}.${currentChap}.${currentVerse}`;

    function updateVerse(refKey, patch) {
      const verses = Object.assign({}, project.verses);
      const prev = verses[refKey] || {};
      verses[refKey] = Object.assign({}, prev, patch);
      onUpdate(Object.assign({}, project, { verses, modified: Date.now() }));
    }

    // Async-aware step: respects the actual chapter length from the base
    // translation. Falls back to bookById(...).chapters for the chapter
    // upper bound when traversing into a new chapter.
    async function step(d) {
      let v = currentVerse + d;
      let c = currentChap;
      let b = currentBook;
      const scope = normalizeScope(project);
      const cur = scope.find(s => s.bookId === b) || scope[0] || { bookId: b, fromChap: 1, toChap: bookById(b).chapters || 1 };
      if (v < 1) {
        c = Math.max(cur.fromChap, c - 1);
        const len = await chapterLen(project.base_translation, b, c);
        v = len;
      }
      const curLen = await chapterLen(project.base_translation, b, c);
      if (v > curLen) {
        c = c + 1;
        if (c > cur.toChap) {
          // step into next book in scope
          const idx = scope.findIndex(s => s.bookId === b);
          if (idx >= 0 && idx + 1 < scope.length) {
            b = scope[idx + 1].bookId;
            c = scope[idx + 1].fromChap;
          } else {
            c = cur.toChap;
            const len2 = await chapterLen(project.base_translation, b, c);
            v = Math.min(v, len2); setCurrentBook(b); setCurrentChap(c); setCurrentVerse(v); return;
          }
        }
        v = 1;
      }
      setCurrentBook(b); setCurrentChap(c); setCurrentVerse(v);
    }

    async function bulkTranslate(n) {
      if (!eng) return;
      setBulkBusy(true);
      try {
        const voice = voiceTpl || project.voice_custom || {};
        const sys = eng.buildSystemPrompt(voice, project.rigor, { target_language: project.target_language });
        const scope = normalizeScope(project);
        let b = currentBook, c = currentChap, v = currentVerse;
        let cur = scope.find(s => s.bookId === b) || scope[0];
        const updates = Object.assign({}, project.verses);
        let refused = 0;
        for (let i = 0; i < n; i++) {
          if (!cur) break;
          const key = `${b}.${c}.${v}`;
          if (updates[key] && updates[key].locked) { v++; }
          else {
            const base = await fetchBaseVerse(project.base_translation, b, c, v);
            if (base) {
              const userMsg = eng.buildUserMessage({ ref: key, base, literal_crib: literalCribFor(b, c, v) });
              try {
                const raw = await callAI(sys, userMsg);
                const parsed = eng.parseAIDraft(raw);
                if (parsed.draft && parsed.draft.trim()) {
                  const r = eng.checkRigor(parsed.draft, base, "", project.rigor);
                  updates[key] = {
                    base, draft: parsed.draft, mode: "ai",
                    ai_notes: eng.mergeNotes(parsed.notes, r.notes),
                    badge: r.badge, locked: false
                  };
                } else {
                  refused++;
                }
              } catch (e) { /* keep going */ }
            }
            v++;
          }
          const len = await chapterLen(project.base_translation, b, c);
          if (v > len) {
            c++; v = 1;
            if (c > cur.toChap) {
              const idx = scope.findIndex(s => s.bookId === b);
              if (idx + 1 < scope.length) { cur = scope[idx + 1]; b = cur.bookId; c = cur.fromChap; }
              else break;
            }
          }
        }
        const next = Object.assign({}, project, { verses: updates, modified: Date.now() });
        onUpdate(next);
        try {
          const raw = localStorage.getItem("codex.babelforge.v1");
          const st  = raw ? JSON.parse(raw) : { projects: [], activeId: null };
          const i = (st.projects || []).findIndex(p => p.id === project.id);
          if (i >= 0) st.projects[i] = next;
          else st.projects = (st.projects || []).concat([next]);
          localStorage.setItem("codex.babelforge.v1", JSON.stringify(st));
        } catch (e) { console.warn("[babelforge] direct-save failed:", e); }
        if (refused) console.warn(`BabelForge: ${refused} verses refused (empty draft)`);
        try { window.dispatchEvent(new CustomEvent("codex:translations-changed", { detail: { id: "bf-" + project.id.replace(/^proj-/, "") } })); } catch {}
      } finally { setBulkBusy(false); }
    }

    // ── Full-scope translation ──────────────────────────────────────
    // Walks every chapter in the project's scope, fetches each chapter
    // from the base translation in one shot (so we know how many verses
    // it actually has), then translates each verse with bounded
    // parallelism. Live progress so the user can leave it running.
    const [fullBusy, setFullBusy] = useState(false);
    const [fullProgress, setFullProgress] = useState(null);
    const fullAbort = useRef({ stop: false });
    const progressRef = useRef({ done: 0, total: 0, skipped: 0, refused: 0, label: "" });
    const progressRaf = useRef(null);
    function scheduleProgressFlush() {
      if (progressRaf.current) return;
      progressRaf.current = requestAnimationFrame(() => {
        progressRaf.current = null;
        const snap = Object.assign({}, progressRef.current);
        setFullProgress(snap);
        // Mirror to global forge status so the projects-list banner can show it.
        try {
          if (window.CODEX_BabelForge && window.CODEX_BabelForge.forgeStatus &&
              window.CODEX_BabelForge.forgeStatus.projectId === project.id) {
            setForgeStatus({
              projectId: project.id, name: project.name,
              done: snap.done, total: snap.total, running: true
            });
          }
        } catch {}
      });
    }

    async function translateEntireScope(opts) {
      if (!eng) return;
      if (fullBusy) return;
      const silent = opts && opts.silent;
      const scope = normalizeScope(project);
      if (!scope.length) return;
      const scopeLabel = scope.length === 1
        ? `${scope[0].bookId} ${scope[0].fromChap}–${scope[0].toChap}`
        : `${scope.length} books`;
      if (!silent && !window.confirm(`Translate the ENTIRE scope (${scopeLabel}) in voice "${project.voice_template}"? This may take many minutes and many AI calls. You can stop at any time.`)) return;
      setFullBusy(true);
      fullAbort.current.stop = false;
      progressRef.current = { done: 0, total: 0, skipped: 0, refused: 0, label: "starting…" };
      scheduleProgressFlush();
      const voice = voiceTpl || project.voice_custom || {};
      const sys = eng.buildSystemPrompt(voice, project.rigor, { target_language: project.target_language });
      const updates = Object.assign({}, project.verses);
      const CONCURRENCY = 4;
      const trId = "bf-" + project.id.replace(/^proj-/, "");
      try {
        for (const seg of scope) {
          if (fullAbort.current.stop) break;
          const { bookId, fromChap, toChap } = seg;
          // Discover verse counts per chapter for THIS book first.
          const chapters = [];
          for (let c = fromChap; c <= toChap; c++) {
            if (fullAbort.current.stop) break;
            let baseList = [];
            try {
              baseList = await window.BIBLE.loadChapter(bookId, c, project.base_translation);
            } catch { baseList = []; }
            chapters.push({ c, verses: baseList });
            progressRef.current.total += baseList.length;
            progressRef.current.label = `discovered ${bookId} ${c}`;
            scheduleProgressFlush();
          }
          // Translate chapter-by-chapter with bounded concurrency.
          for (const ch of chapters) {
            if (fullAbort.current.stop) break;
            const queue = ch.verses.slice();
            const workers = Array.from({ length: CONCURRENCY }, async () => {
              while (queue.length && !fullAbort.current.stop) {
                const v = queue.shift();
                if (!v) break;
                const key = `${bookId}.${ch.c}.${v.n}`;
                if (updates[key] && updates[key].locked) {
                  progressRef.current.skipped++;
                  progressRef.current.done++;
                  progressRef.current.label = `${bookId} ${ch.c}:${v.n} (locked)`;
                  scheduleProgressFlush();
                  continue;
                }
                if (updates[key] && updates[key].draft && updates[key].draft.trim()) {
                  progressRef.current.done++;
                  progressRef.current.label = `${bookId} ${ch.c}:${v.n} (skip)`;
                  scheduleProgressFlush();
                  continue;
                }
                try {
                  const userMsg = eng.buildUserMessage({ ref: key, base: v.text, literal_crib: literalCribFor(bookId, ch.c, v.n) });
                  const raw = await callAI(sys, userMsg);
                  const parsed = eng.parseAIDraft(raw);
                  if (parsed.draft && parsed.draft.trim()) {
                    const r = eng.checkRigor(parsed.draft, v.text, "", project.rigor);
                    updates[key] = {
                      base: v.text, draft: parsed.draft, mode: "ai",
                      ai_notes: eng.mergeNotes(parsed.notes, r.notes),
                      badge: r.badge, locked: false
                    };
                  } else {
                    progressRef.current.refused++;
                  }
                } catch (e) {
                  // Count AI failures separately so the user sees WHY
                  // verses aren't being written (e.g. 401 from a bad
                  // .env key). First failure also raises a toast.
                  progressRef.current.errors = (progressRef.current.errors || 0) + 1;
                  if (!progressRef.current._toasted) {
                    progressRef.current._toasted = true;
                    try { window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: `BabelForge AI call failed: ${String(e.message || e).slice(0, 120)}. Check your API key in Settings.`, kind: "err" } })); } catch {}
                  }
                }
                progressRef.current.done++;
                progressRef.current.label = `${bookId} ${ch.c}:${v.n}`;
                scheduleProgressFlush();
              }
            });
            await Promise.all(workers);
            // Commit per-chapter so progress survives reload AND so the
            // Reader can read translated verses immediately. We write to
            // localStorage DIRECTLY (read-modify-write) so persistence
            // survives ProjectEditor / BabelForgePanel unmounts (the user
            // navigating away from the BABEL tab during a long forge).
            const next = Object.assign({}, project, { verses: updates, modified: Date.now() });
            onUpdate(next);
            try {
              const raw = localStorage.getItem("codex.babelforge.v1");
              const st  = raw ? JSON.parse(raw) : { projects: [], activeId: null };
              const i = (st.projects || []).findIndex(p => p.id === project.id);
              if (i >= 0) st.projects[i] = next;
              else st.projects = (st.projects || []).concat([next]);
              localStorage.setItem("codex.babelforge.v1", JSON.stringify(st));
            } catch (e) { console.warn("[babelforge] direct-save failed:", e); }
            try { window.dispatchEvent(new CustomEvent("codex:translations-changed", { detail: { id: trId } })); } catch {}
          }
        }
      } finally {
        setFullBusy(false);
        setFullProgress(null);
        if (progressRaf.current) { cancelAnimationFrame(progressRaf.current); progressRaf.current = null; }
        try {
          if (window.CODEX_BabelForge && window.CODEX_BabelForge.forgeStatus &&
              window.CODEX_BabelForge.forgeStatus.projectId === project.id) {
            setForgeStatus(null);
          }
        } catch {}
      }
    }
    function stopFull() { fullAbort.current.stop = true; }
    // Expose so the projects-list one-click flow can start a background pass.
    ProjectEditor._lastTranslateEntireScope = translateEntireScope;

    // Auto-forge: started from the one-click flow. Wait until voiceTpl is
    // resolved, then kick off translateEntireScope({ silent: true }).
    const autoForgeStarted = useRef(false);
    useEffect(() => {
      if (!autoForge || autoForgeStarted.current) return;
      if (!eng) return;
      // voiceTpl may still be loading for built-in templates — wait one tick.
      const ready = (project.voice_template === "custom") || voiceTpl;
      if (!ready) return;
      autoForgeStarted.current = true;
      onAutoForgeStarted && onAutoForgeStarted();
      translateEntireScope({ silent: true });
    }, [autoForge, voiceTpl, eng]);

    // ── Install in Reader ───────────────────────────────────────────
    // Registers this project as a translation in CODEX_DATA.translations,
    // backed by the babelforge source kind. The user can then pick it
    // from the right-rail translations picker.
    function installInReader() {
      try {
        const data = window.CODEX_DATA;
        if (!data || !Array.isArray(data.translations)) {
          alert("Reader catalog not available.");
          return;
        }
        const trId = "bf-" + project.id.replace(/^proj-/, "");
        const existing = data.translations.find(t => t.id === trId);
        const entry = {
          id: trId,
          name: project.name + " · BabelForge",
          year: new Date().getFullYear() + "",
          license: "User-generated (BabelForge)",
          glyph: "⌬",
          lang: (project.target_language || "en").toUpperCase().slice(0, 2),
          source: "babelforge",
          apiId: trId,
          projectId: project.id,
          babelforge: true,
        };
        if (existing) {
          Object.assign(existing, entry);
          data.translations = data.translations.slice();
        } else {
          data.translations = data.translations.concat([entry]);
        }
        onUpdate(Object.assign({}, project, { installed: true, modified: Date.now() }));
        try { window.dispatchEvent(new CustomEvent("codex:translations-changed", { detail: { id: trId } })); } catch {}
        alert(`"${project.name}" is now available in the Reader translation picker as "${entry.name}".`);
      } catch (e) {
        alert("Install failed: " + e.message);
      }
    }
    function uninstallFromReader() {
      try {
        const data = window.CODEX_DATA;
        const trId = "bf-" + project.id.replace(/^proj-/, "");
        if (data && Array.isArray(data.translations)) {
          data.translations = data.translations.filter(t => t.id !== trId);
        }
        onUpdate(Object.assign({}, project, { installed: false, modified: Date.now() }));
        try { window.dispatchEvent(new CustomEvent("codex:translations-changed", { detail: { id: trId, removed: true } })); } catch {}
      } catch (e) { alert("Uninstall failed: " + e.message); }
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
      // Try to inline the full voice template so importers can restore it.
      let voiceInline = null;
      try {
        if (project.voice_template === "custom") {
          voiceInline = project.voice_custom || null;
        } else if (eng && eng.getTemplate) {
          voiceInline = eng.getTemplate(project.voice_template) || null;
        }
      } catch {}
      const out = {
        meta: {
          id: project.id, name: project.name,
          type: "translation", format: "codex-translation/2",
          manifest_version: "codex-translation/2",
          voice: project.voice_template, rigor: project.rigor,
          base: project.base_translation, target_language: project.target_language,
          source_language: project.source_language,
          scope: project.scope,
          voice_template_inline: voiceInline,
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
            "scope: ", (() => {
              const s = normalizeScope(project);
              if (s.length === 1) return `${s[0].bookId} ${s[0].fromChap}–${s[0].toChap}`;
              return `${s.length} books`;
            })()
          )
        )
      ),
      E("div", { className: "bf-proj-stats" },
        E("span", null, totalVerses, " verses drafted"),
        E("span", { className: "bf-badge bf-badge-ok" }, "✓ ", okCount),
        E("span", { className: "bf-badge bf-badge-warn" }, "⚠ ", warnCount),
        E("span", { className: "bf-badge bf-badge-fail" }, "✗ ", failCount)
      ),
      // ── Project settings strip — change source / target / rigor live.
      // Source can be swapped at any time; future verses use the new base.
      // Changing source on an installed translation also bumps Reader cache.
      E("div", { className: "bf-proj-settings", style: { display: "flex", gap: 10, padding: "10px 12px", borderTop: "1px solid var(--cx-line, #1f2a36)", borderBottom: "1px solid var(--cx-line, #1f2a36)", flexWrap: "wrap", alignItems: "center", fontSize: 11 } },
        E("label", { style: { display: "flex", flexDirection: "column", gap: 2 } },
          E("span", { style: { opacity: 0.7, letterSpacing: ".06em", textTransform: "uppercase", fontSize: 10 } }, "Source"),
          E("select", {
            className: "bf-in", style: { minWidth: 180, padding: "4px 6px" },
            value: project.base_translation || "kjv",
            onChange: (e) => {
              const next = Object.assign({}, project, { base_translation: e.target.value, modified: Date.now() });
              onUpdate(next);
              if (project.installed) {
                try { window.dispatchEvent(new CustomEvent("codex:translations-changed", { detail: { id: "bf-" + project.id.replace(/^proj-/, "") } })); } catch {}
              }
            }
          },
            translationList().filter(t => !String(t.id || "").startsWith("bf-")).map(t =>
              E("option", { key: t.id, value: t.id }, `${t.name} (${t.id})`)
            )
          )
        ),
        E("label", { style: { display: "flex", flexDirection: "column", gap: 2 } },
          E("span", { style: { opacity: 0.7, letterSpacing: ".06em", textTransform: "uppercase", fontSize: 10 } }, "Target lang"),
          E("select", {
            className: "bf-in", style: { width: 130, padding: "4px 6px" },
            value: project.target_language || "en",
            onChange: (e) => onUpdate(Object.assign({}, project, { target_language: e.target.value, modified: Date.now() }))
          },
            ((window.CODEX_LANGS || [{id:"en",label:"English"}]).map(l =>
              E("option", { key: l.id, value: l.id }, l.label)
            ))
          )
        ),
        E("label", { style: { display: "flex", flexDirection: "column", gap: 2 } },
          E("span", { style: { opacity: 0.7, letterSpacing: ".06em", textTransform: "uppercase", fontSize: 10 } }, "Rigor"),
          E("select", {
            className: "bf-in", style: { width: 120, padding: "4px 6px" },
            value: project.rigor || "balanced",
            onChange: (e) => onUpdate(Object.assign({}, project, { rigor: e.target.value, modified: Date.now() }))
          },
            ["strict","balanced","loose","free"].map(r => E("option", { key: r, value: r }, r))
          )
        ),
        E("div", { style: { flex: 1 } }),
        project.installed && E("button", {
          className: "bf-btn ghost", style: { padding: "4px 10px" },
          title: "Re-translate every chapter using the new source — leaves locked verses alone",
          onClick: () => {
            if (!window.confirm("Wipe non-locked drafts and re-forge with the current source/voice?")) return;
            const verses = Object.fromEntries(Object.entries(project.verses || {}).filter(([,v]) => v && v.locked));
            const cleared = Object.assign({}, project, { verses, modified: Date.now() });
            onUpdate(cleared);
            setTimeout(() => translateEntireScope({ silent: true }), 50);
          }
        }, "↻ Re-forge")
      ),
      E(VerseEditor, {
        project, ref_,
        onUpdateVerse: updateVerse,
        onPrev: () => step(-1), onNext: () => step(1),
        onJump: (b, c, v) => {
          if (b) setCurrentBook(b);
          if (typeof c === "number" && !isNaN(c)) setCurrentChap(c);
          if (typeof v === "number" && !isNaN(v)) setCurrentVerse(v);
        },
        voiceTpl
      }),
      E("div", { className: "bf-bulk" },
        E("button", { className: "bf-btn", onClick: () => bulkTranslate(10), disabled: bulkBusy || fullBusy },
          bulkBusy ? "Translating…" : "Translate next 10 verses ⌬"),
        E("button", { className: "bf-btn primary", onClick: translateEntireScope, disabled: bulkBusy || fullBusy, title: "Generate the whole scope automatically — usable in the Reader in seconds" },
          fullBusy ? "Translating ENTIRE scope…" : "⚡ Translate ENTIRE scope"),
        fullBusy && E("button", { className: "bf-btn ghost", onClick: stopFull }, "Stop"),
        E("button", { className: "bf-btn ghost", onClick: recheckAll, disabled: fullBusy }, "Re-check rigor on all"),
        E("div", { style: { flex: 1 } }),
        E("button", {
          className: "bf-btn " + (project.installed ? "ghost" : "primary"),
          onClick: project.installed ? uninstallFromReader : installInReader,
          disabled: fullBusy,
          title: project.installed ? "Remove from Reader translation picker" : "Make available in the main Bible reader"
        }, project.installed ? "✓ Installed in Reader · Remove" : "📖 Install in Reader"),
        E("button", { className: "bf-btn", onClick: () => setExportOpen(o => !o) }, "Export ▾")
      ),
      fullProgress && E("div", { className: "bf-fullprog", style: { padding: "8px 12px", fontFamily: "ui-monospace, monospace", fontSize: "12px", color: "var(--cx-fg-dim, #8a98a8)" } },
        `${fullProgress.done} / ${fullProgress.total} verses · ${fullProgress.label || ""}`,
        (fullProgress.skipped || fullProgress.refused || fullProgress.errors) ? E("div", { style: { marginTop: 2, fontSize: 11, color: fullProgress.errors ? "#ff7e7e" : undefined } },
          fullProgress.skipped ? `${fullProgress.skipped} skipped (locked) · ` : "",
          fullProgress.refused ? `${fullProgress.refused} refused (empty draft) · ` : "",
          fullProgress.errors ? `${fullProgress.errors} FAILED (check API key)` : ""
        ) : null,
        E("div", { style: { height: 3, background: "#1f2a36", marginTop: 6, borderRadius: 2, overflow: "hidden" } },
          E("div", { style: { height: "100%", width: ((fullProgress.total ? fullProgress.done / fullProgress.total : 0) * 100) + "%", background: "#7ee0ff", transition: "width 200ms ease" } })
        )
      ),
      exportOpen && E("div", { className: "bf-export-tray" },
        E("button", { className: "bf-btn", onClick: exportJSON }, "CODEX Translation JSON"),
        E("button", { className: "bf-btn", onClick: exportMarkdown }, "Markdown"),
        E("button", { className: "bf-btn", onClick: shareUrl }, "Copy share URL"),
        E("button", {
          className: "bf-btn", onClick: () => {
            const pick = window.CODEX_BabelForge && window.CODEX_BabelForge.importPicker;
            if (pick) pick();
            else alert("Importer not ready — go back to the projects list.");
          }
        }, "⤒ Import .json")
      )
    );
  }

  // Direct install (used by 1-click Forge flow + import). Mirrors
  // installInReader() in ProjectEditor but works without component context.
  function _directInstall(project) {
    try {
      const data = window.CODEX_DATA;
      if (!data || !Array.isArray(data.translations)) return false;
      const trId = "bf-" + project.id.replace(/^proj-/, "");
      const existing = data.translations.find(t => t.id === trId);
      const entry = {
        id: trId,
        name: project.name + " · BabelForge",
        year: new Date().getFullYear() + "",
        license: "User-generated (BabelForge)",
        glyph: "⌬",
        lang: (project.target_language || "en").toUpperCase().slice(0, 2),
        source: "babelforge",
        apiId: trId,
        projectId: project.id,
        babelforge: true,
      };
      if (existing) {
        Object.assign(existing, entry);
        data.translations = data.translations.slice(); // new ref so React memos re-derive
      } else {
        data.translations = data.translations.concat([entry]);
      }
      try { window.dispatchEvent(new CustomEvent("codex:translations-changed", { detail: { id: trId } })); } catch {}
      return true;
    } catch { return false; }
  }

  // Persistent global forge status (only one at a time for now).
  window.CODEX_BabelForge = window.CODEX_BabelForge || {};
  function setForgeStatus(s) {
    window.CODEX_BabelForge.forgeStatus = s;
    try { window.dispatchEvent(new CustomEvent("codex:babelforge-forge-status", { detail: s })); } catch {}
  }

  // ── Headless background-forge service ──────────────────────────────
  // Lets the Reader (or any other code) ask BabelForge to translate a
  // chapter / book in the background without needing the BABEL panel to
  // be mounted. Survives unmount because it writes straight to
  // localStorage["codex.babelforge.v1"] (read-modify-write).
  //
  // Public API:
  //   refreshChapter({translationId, bookId, chapter, force=true}) →
  //     bool — re-translates every verse in this chapter for the project
  //     backing translationId. Replaces existing drafts (unless locked).
  //   ensureChapter({translationId, bookId, chapter}) →
  //     bool — only translates verses that don't yet have a draft. Used
  //     by the Reader's "auto-forge on view" hook.
  //   ensureBook({translationId, bookId}) → fires-and-returns
  //     queues every chapter in a book for background translation.
  //
  // All paths skip if the project isn't installed OR has no AI key.
  const _bgState = {
    inflight: new Set(),       // "bf-<id>:gen.1" keys currently translating
    bookQueues: new Map(),     // bf-id → Set<bookId> queued for whole-book
  };

  function _hasKeySync() {
    try {
      const raw = localStorage.getItem("codex.api.keys.v1");
      const j = raw ? JSON.parse(raw) : null;
      if (j && (j.anthropic || j.grok || j.xai)) return true;
    } catch {}
    return false;
  }

  function _projectFor(translationId) {
    if (!translationId || !translationId.startsWith("bf-")) return null;
    const projId = "proj-" + translationId.replace(/^bf-/, "");
    try {
      const st = JSON.parse(localStorage.getItem("codex.babelforge.v1") || "{}");
      return (st.projects || []).find(p => p.id === projId) || null;
    } catch { return null; }
  }
  function _saveProject(updated) {
    try {
      const st = JSON.parse(localStorage.getItem("codex.babelforge.v1") || "{}");
      const i = (st.projects || []).findIndex(p => p.id === updated.id);
      if (i >= 0) st.projects[i] = updated;
      else st.projects = (st.projects || []).concat([updated]);
      localStorage.setItem("codex.babelforge.v1", JSON.stringify(st));
      return true;
    } catch (e) { console.warn("[babelforge bg] save failed:", e); return false; }
  }

  async function _translateChapter(translationId, bookId, chapter, { force = false } = {}) {
    const key = `${translationId}:${bookId}.${chapter}`;
    if (_bgState.inflight.has(key)) return false;
    if (!_hasKeySync()) return false;
    const eng = engine();
    if (!eng) return false;
    const project = _projectFor(translationId);
    if (!project) return false;
    _bgState.inflight.add(key);
    try {
      const base = await fetchBaseVerse.__chapter
        ? await fetchBaseVerse.__chapter(project.base_translation, bookId, chapter)
        : await (async () => {
            if (window.BIBLE && typeof window.BIBLE.loadChapter === "function") {
              return window.BIBLE.loadChapter(bookId, chapter, project.base_translation);
            }
            return [];
          })();
      if (!Array.isArray(base) || base.length === 0) return false;
      const voiceTpl = project.voice_template === "custom"
        ? project.voice_custom
        : (eng.getTemplate ? eng.getTemplate(project.voice_template) : null);
      const sys = eng.buildSystemPrompt(voiceTpl || {}, project.rigor, { target_language: project.target_language });
      const verses = Object.assign({}, project.verses || {});
      let touched = 0;
      const CONCURRENCY = 3;
      const queue = base.slice();
      const workers = Array.from({ length: CONCURRENCY }, async () => {
        while (queue.length) {
          const v = queue.shift();
          if (!v) break;
          const k = `${bookId}.${chapter}.${v.n}`;
          if (verses[k] && verses[k].locked) continue;
          if (!force && verses[k] && verses[k].draft && verses[k].draft.trim()) continue;
          try {
            const userMsg = eng.buildUserMessage({ ref: k, base: v.text, literal_crib: literalCribFor(bookId, chapter, v.n) });
            const raw = await callAI(sys, userMsg);
            const parsed = eng.parseAIDraft(raw);
            if (parsed.draft && parsed.draft.trim()) {
              const r = eng.checkRigor(parsed.draft, v.text, "", project.rigor);
              verses[k] = { base: v.text, draft: parsed.draft, mode: "ai", ai_notes: eng.mergeNotes(parsed.notes, r.notes), badge: r.badge, locked: false };
              touched++;
            }
          } catch (e) { /* swallow, surface via toast below if all failed */ }
        }
      });
      await Promise.all(workers);
      if (touched > 0) {
        const next = Object.assign({}, project, { verses, modified: Date.now() });
        _saveProject(next);
        try { window.dispatchEvent(new CustomEvent("codex:translations-changed", { detail: { id: translationId, chapter: `${bookId}.${chapter}` } })); } catch {}
        try { window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: `BabelForge · ${bookId.toUpperCase()} ${chapter} · ${touched} verses ready`, kind: "ok" } })); } catch {}
      }
      return touched > 0;
    } finally {
      _bgState.inflight.delete(key);
    }
  }

  async function refreshChapter({ translationId, bookId, chapter }) {
    return _translateChapter(translationId, bookId, chapter, { force: true });
  }
  async function ensureChapter({ translationId, bookId, chapter }) {
    const project = _projectFor(translationId);
    if (!project) return false;
    // Already fully drafted? Skip.
    const verses = project.verses || {};
    const has = Object.keys(verses).some(k => k.startsWith(`${bookId}.${chapter}.`) && verses[k].draft);
    if (has) return false;
    return _translateChapter(translationId, bookId, chapter, { force: false });
  }
  async function ensureBook({ translationId, bookId }) {
    const project = _projectFor(translationId);
    if (!project) return false;
    const meta = bookById(bookId);
    const total = meta && meta.chapters ? meta.chapters : 1;
    let q = _bgState.bookQueues.get(translationId);
    if (!q) { q = new Set(); _bgState.bookQueues.set(translationId, q); }
    if (q.has(bookId)) return false;       // already queued
    q.add(bookId);
    (async () => {
      try {
        for (let c = 1; c <= total; c++) {
          await ensureChapter({ translationId, bookId, chapter: c });
        }
      } finally { q.delete(bookId); }
    })();
    return true;
  }

  Object.assign(window.CODEX_BabelForge, { refreshChapter, ensureChapter, ensureBook });

  // 1-step Forge-Entire-Bible modal: voice + source text + name → go.
  function ForgeBibleModal({ onForge, onClose }) {
    const [templates, setTemplates] = useState([]);
    const [voiceId, setVoiceId] = useState("modern-scholar");
    const [customPrompt, setCustomPrompt] = useState("");
    const [name, setName] = useState("");
    const [sourceTr, setSourceTr] = useState("kjv");
    const [targetLang, setTargetLang] = useState("en");
    const [sourceTouched, setSourceTouched] = useState(false);
    const [nameTouched, setNameTouched] = useState(false);
    // Autosuggest source based on target language. If user hasn't touched
    // the source picker, swap it to a sensible default for the target.
    const SOURCE_BY_LANG = {
      en: "kjv", es: "rv1960", pt: "arc", fr: "lsg", de: "lutherbibel",
      la: "clementine", he: "wlc", el: "byz", hi: "hin"
    };
    useEffect(() => {
      if (sourceTouched) return;
      const suggested = SOURCE_BY_LANG[targetLang];
      if (suggested) {
        const exists = translationList().some(t => t.id === suggested);
        if (exists) setSourceTr(suggested);
      }
    }, [targetLang, sourceTouched]);
    const [hasKey, setHasKey] = useState(true);
    useEffect(() => {
      const eng = engine();
      if (eng) eng.loadVoiceTemplates().then(setTemplates);
    }, []);
    // Detect AI key — check localStorage (Anthropic/Grok), then /api/health
    // as a fallback (covers .env-based server keys when not in direct mode).
    useEffect(() => {
      let stop = false;
      (async () => {
        let ok = false;
        try {
          const raw = localStorage.getItem("codex.api.keys.v1");
          const j = raw ? JSON.parse(raw) : null;
          ok = !!(j && (j.anthropic || j.grok || j.xai || j.openai || j.google));
        } catch {}
        if (!ok) {
          try {
            const r = await fetch("/api/health");
            const d = await r.json();
            ok = !!(d && (d.hasKey || (d.providers && (d.providers.anthropic?.available || d.providers.xai?.available))));
          } catch {}
        }
        if (!stop) setHasKey(ok);
      })();
      const refresh = () => setHasKey(prev => prev); // re-run on event
      window.addEventListener("codex:keys-changed", refresh);
      return () => { stop = true; window.removeEventListener("codex:keys-changed", refresh); };
    }, []);
    const tpl = templates.find(t => t.id === voiceId);
    const defaultName = (tpl ? tpl.name : voiceId) + " Bible";
    const trans = translationList().filter(t => !String(t.id || "").startsWith("bf-"));
    const LANGS = (window.CODEX_LANGS || [
      { id: "en", label: "English" }, { id: "es", label: "Español" },
      { id: "pt", label: "Português" }, { id: "fr", label: "Français" },
      { id: "de", label: "Deutsch" }, { id: "la", label: "Latina" },
      { id: "he", label: "עברית" }, { id: "el", label: "Ἑλληνική" },
      { id: "hi", label: "हिन्दी" }
    ]);
    return E("div", { className: "bf-modal-bg", onClick: e => { if (e.target === e.currentTarget) onClose(); } },
      E("div", { className: "bf-modal" },
        E("div", { className: "bf-modal-head" },
          E("h2", null, "⚡ Forge an Entire Bible"),
          E("button", { className: "bf-x", onClick: onClose }, "×")
        ),
        E("div", { className: "bf-step" },
          E("div", { className: "bf-form" },
            !hasKey && E("div", { style: { padding: "10px 12px", background: "#3a2418", border: "1px solid #6a3a22", borderRadius: 6, color: "#ffc46b", fontSize: 12, marginBottom: 12, display: "flex", gap: 10, alignItems: "center" } },
              E("span", null, "⚠ No AI key detected."),
              E("button", {
                type: "button",
                className: "bf-btn",
                style: { marginLeft: "auto", padding: "4px 10px", fontSize: 11 },
                onClick: () => { try { window.dispatchEvent(new CustomEvent("codex:open-settings", { detail: { section: "api-keys" } })); } catch {}; onClose && onClose(); }
              }, "Open Settings →")
            ),
            E("label", null, "Source text (what to translate FROM)"),
            E("select", { className: "bf-in", value: sourceTr, onChange: e => { setSourceTr(e.target.value); setSourceTouched(true); } },
              trans.map(t => E("option", { key: t.id, value: t.id }, `${t.name} (${t.id})`))
            ),
            E("div", { style: { fontSize: 11, opacity: 0.65, marginTop: 4 } },
              sourceTouched ? "" : "↻ Auto-suggested for your target language. Change anytime."
            ),
            E("label", { style: { marginTop: 12 } }, "Target language"),
            E("select", { className: "bf-in", value: targetLang, onChange: e => setTargetLang(e.target.value) },
              LANGS.map(l => E("option", { key: l.id, value: l.id }, l.label))
            ),
            E("label", { style: { marginTop: 12 } }, "Voice"),
            E(VoicePicker, {
              templates, voiceId, setVoiceId, customPrompt, setCustomPrompt,
              onTemplatesChanged: () => { const eng = engine(); if (eng) eng.loadVoiceTemplates().then(setTemplates); }
            }),
            E("label", { style: { marginTop: 12 } }, "Name (auto-suggested from voice)"),
            E("input", {
              className: "bf-in",
              value: nameTouched ? name : defaultName,
              onChange: e => { setName(e.target.value); setNameTouched(true); },
              placeholder: defaultName
            })
          )
        ),
        E("div", { className: "bf-modal-foot" },
          E("div", { style: { flex: 1 } }),
          E("button", { className: "bf-btn ghost", onClick: onClose }, "Cancel"),
          E("button", {
            className: "bf-btn primary",
            disabled: !hasKey,
            onClick: () => onForge({ voiceId, customPrompt, name: (nameTouched && name) ? name : defaultName, sourceTr, targetLang })
          }, hasKey ? "Forge ⚡" : "Add a key first")
        )
      )
    );
  }

  // Importer modal for a share-URL payload.
  function ImportShareModal({ payload, onAccept, onClose }) {
    const verseCount = payload && payload.verses ? Object.keys(payload.verses).length : 0;
    return E("div", { className: "bf-modal-bg", onClick: e => { if (e.target === e.currentTarget) onClose(); } },
      E("div", { className: "bf-modal" },
        E("div", { className: "bf-modal-head" },
          E("h2", null, "Import this BabelForge share?"),
          E("button", { className: "bf-x", onClick: onClose }, "×")
        ),
        E("div", { className: "bf-step" },
          E("div", { className: "bf-form" },
            E("p", null, "Name: ", E("strong", null, payload && payload.n || "(unnamed)")),
            E("p", null, "Voice: ", E("strong", null, payload && payload.v || "?")),
            E("p", null, verseCount, " verses")
          )
        ),
        E("div", { className: "bf-modal-foot" },
          E("div", { style: { flex: 1 } }),
          E("button", { className: "bf-btn ghost", onClick: onClose }, "Dismiss"),
          E("button", { className: "bf-btn primary", onClick: onAccept }, "Accept & Import")
        )
      )
    );
  }

  // ── Top-level panel ─────────────────────────────────────────────────
  function BabelForgePanel(ctx) {
    const [state, setState] = useState(() => loadState());
    const [showWizard, setShowWizard] = useState(false);
    const [showForge, setShowForge] = useState(false);
    const [sharePayload, setSharePayload] = useState(null);
    const [forgeStatus, setForgeStatusLocal] = useState(window.CODEX_BabelForge.forgeStatus || null);
    const [pendingForgeId, setPendingForgeId] = useState(null);

    useEffect(() => { saveState(state); }, [state]);

    // Share-URL importer (#bf=<base64>).
    useEffect(() => {
      try {
        const m = (location.hash || "").match(/#bf=([^&]+)/);
        if (!m) return;
        const json = decodeURIComponent(escape(atob(m[1])));
        const parsed = JSON.parse(json);
        if (parsed && (parsed.n || parsed.verses)) setSharePayload(parsed);
      } catch {}
    }, []);

    // Live forge status mirror.
    useEffect(() => {
      const fn = (e) => setForgeStatusLocal(e.detail);
      window.addEventListener("codex:babelforge-forge-status", fn);
      return () => window.removeEventListener("codex:babelforge-forge-status", fn);
    }, []);

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

    // One-click: voice → source → target → name → forge entire Bible.
    async function doForgeBible({ voiceId, customPrompt, name, sourceTr, targetLang }) {
      const id = "proj-" + ulid();
      const project = {
        id,
        name: name || "Forged Bible",
        description: "Forged with one click — entire 66-book Bible.",
        created: Date.now(),
        modified: Date.now(),
        source_language: "auto",
        base_translation: sourceTr || "kjv",
        voice_template: voiceId === "custom" ? "custom" : voiceId,
        voice_custom: voiceId === "custom" ? {
          name: "Custom Voice",
          system_prompt: customPrompt || "Render in a thoughtful, lightly modernized English.",
          samples: []
        } : null,
        rigor: "balanced",
        target_language: targetLang || "en",
        scope: { books: CANON.BIBLE.slice() },
        verses: {},
        installed: true,
      };
      // Persist project; install in Reader immediately.
      const next = { projects: state.projects.concat([project]), activeId: project.id };
      setState(next); saveState(next);
      _directInstall(project);
      setShowForge(false);
      setPendingForgeId(project.id);
      setForgeStatus({ projectId: project.id, name: project.name, done: 0, total: 0, running: true });
    }

    // Import a .codex-translation/2 file.
    async function importTranslationJSON(file) {
      try {
        const txt = await file.text();
        const j = JSON.parse(txt);
        const meta = j.meta || {};
        const verses = {};
        Object.entries(j.verses || {}).forEach(([k, draft]) => { verses[k] = { draft: String(draft || ""), mode: "ai", locked: false }; });
        const id = "proj-" + ulid();
        const project = {
          id,
          name: meta.name || "Imported Translation",
          description: "Imported from " + (file.name || "JSON"),
          created: Date.now(),
          modified: Date.now(),
          source_language: meta.source_language || "auto",
          base_translation: meta.base || "kjv",
          voice_template: meta.voice || "modern-scholar",
          voice_custom: meta.voice === "custom" ? (meta.voice_template_inline || null) : null,
          rigor: meta.rigor || "balanced",
          target_language: meta.target_language || "en",
          scope: meta.scope || { books: CANON.BIBLE.slice() },
          verses,
        };
        const next = { projects: state.projects.concat([project]), activeId: project.id };
        setState(next); saveState(next);
        if (window.confirm("Imported. Install in the Reader now?")) _directInstall(Object.assign(project, { installed: true }));
      } catch (e) {
        alert("Import failed: " + e.message);
      }
    }
    function pickImportFile() {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = "application/json,.json";
      inp.onchange = () => { if (inp.files && inp.files[0]) importTranslationJSON(inp.files[0]); };
      inp.click();
    }
    // Expose for ProjectEditor's export tray.
    window.CODEX_BabelForge.importPicker = pickImportFile;

    function acceptShare() {
      if (!sharePayload) return;
      const id = "proj-" + ulid();
      const verses = {};
      Object.entries(sharePayload.verses || {}).forEach(([k, draft]) => { verses[k] = { draft: String(draft || ""), mode: "ai" }; });
      const project = {
        id,
        name: sharePayload.n || "Shared Translation",
        description: "Imported from share URL",
        created: Date.now(), modified: Date.now(),
        source_language: "auto", base_translation: "kjv",
        voice_template: sharePayload.v || "modern-scholar",
        voice_custom: null, rigor: "balanced", target_language: "en",
        scope: { books: CANON.BIBLE.slice() }, verses,
      };
      const next = { projects: state.projects.concat([project]), activeId: project.id };
      setState(next); saveState(next);
      setSharePayload(null);
      try { history.replaceState(null, "", location.pathname + location.search); } catch {}
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
        E("div", { className: "bf-forge-mega", style: { padding: 14, margin: "8px 0 14px", background: "linear-gradient(135deg,#1a2a3f,#26334a)", border: "1px solid #3a4d6a", borderRadius: 10 } },
          E("div", { style: { fontSize: 16, fontWeight: 600, color: "#cfe4ff" } }, "⚡ Forge an Entire Bible in one click"),
          E("div", { style: { fontSize: 12, color: "#8aa6c8", marginTop: 4 } }, "Pick a voice → name it → go. We translate all 66 books in the background."),
          E("button", {
            className: "bf-btn primary", style: { marginTop: 10 },
            onClick: () => setShowForge(true)
          }, "Forge ⚡")
        ),
        forgeStatus && forgeStatus.running && E("div", { style: { padding: "6px 10px", margin: "0 0 12px", background: "#102030", borderRadius: 6, fontSize: 12, color: "#cfe4ff" } },
          `Forging "${forgeStatus.name}"… ${forgeStatus.done}/${forgeStatus.total} verses`
        ),
        E("div", { className: "bf-list-head" },
          E("h3", null, "Your Translations"),
          E("button", { className: "bf-btn ghost", onClick: pickImportFile, title: "Import a .codex-translation/2 file" }, "⤒ Import"),
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
              p.voice_template, " · ", p.rigor, " · ",
              (() => {
                const s = normalizeScope(p);
                if (!s.length) return "(no scope)";
                if (s.length === 1) return `${s[0].bookId.toUpperCase()} ${s[0].fromChap}–${s[0].toChap}`;
                return `${s.length} books`;
              })(),
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
        onBack: backToList,
        autoForge: pendingForgeId === active.id,
        onAutoForgeStarted: () => setPendingForgeId(null)
      }),
      showWizard && E(NewProjectWizard, {
        onCreate: createProject,
        onClose: () => setShowWizard(false)
      }),
      showForge && E(ForgeBibleModal, {
        onForge: doForgeBible,
        onClose: () => setShowForge(false)
      }),
      sharePayload && E(ImportShareModal, {
        payload: sharePayload,
        onAccept: acceptShare,
        onClose: () => setSharePayload(null)
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

  // ── Re-register installed BabelForge projects as Reader translations
  // every boot so a user-authored translation survives reload.
  function reregisterInstalled() {
    try {
      const data = window.CODEX_DATA;
      if (!data || !Array.isArray(data.translations)) return;
      const state = loadState();
      let added = false;
      (state.projects || []).forEach(p => {
        if (!p.installed) return;
        const trId = "bf-" + p.id.replace(/^proj-/, "");
        if (data.translations.find(t => t.id === trId)) return;
        data.translations.push({
          id: trId,
          name: p.name + " · BabelForge",
          year: new Date(p.modified || Date.now()).getFullYear() + "",
          license: "User-generated (BabelForge)",
          glyph: "⌬",
          lang: (p.target_language || "en").toUpperCase().slice(0, 2),
          source: "babelforge",
          apiId: trId,
          projectId: p.id,
          babelforge: true,
        });
        added = true;
      });
      if (added) {
        data.translations = data.translations.slice();
        try { window.dispatchEvent(new CustomEvent("codex:translations-changed", { detail: { boot: true } })); } catch {}
      }
    } catch (e) { console.warn("babelforge: reregister failed", e); }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", reregisterInstalled, { once: true });
  } else {
    reregisterInstalled();
  }
})();
