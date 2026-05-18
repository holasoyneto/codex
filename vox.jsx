// vox.jsx
// CODEX — VOX: multilingual AI/natural voice reading + multi-tradition prayer guide.
//
// Self-registering plugin. Zero conflicts with other modules; appends a single
// right-rail tab (VOX, glyph ◉) plus a verse-menu action ("Read aloud").
//
// Voice engine: native Web Speech API (window.speechSynthesis). Zero cost,
// offline-capable, works on every modern browser. Quality depends on the
// host platform — Chrome/Edge on macOS expose Apple's premium "Natural" /
// "Enhanced" / "Premium" voices; iOS Safari exposes the system voices;
// Android exposes Google TTS; Linux falls back to eSpeak. We surface a
// quality hint when a voice name contains those keywords.
//
// Future: VoxEngine.cloudProvider is a deliberate slot for swapping in a
// premium cloud TTS (OpenAI/ElevenLabs/etc.) via a server endpoint such as
// POST /api/tts. The current "ENHANCE VOICE" button is greyed with a
// "coming soon" tooltip until that endpoint exists.
//
// Events on window:
//   codex:vox-speak     { text, ref?, lang? } — start reading the given text
//   codex:vox-stop                            — stop any in-flight playback
//   codex:vox-progress  { verseRef }          — emitted as we cross verse boundaries
//                                               (the reader can listen and highlight)

(function () {
  if (typeof window === "undefined") return;
  const { useState, useEffect, useMemo, useCallback, useRef } = React;

  // ───────────────────────────────────────────────────────────────────────
  // VoxEngine — thin wrapper over speechSynthesis with chunking & callbacks
  // ───────────────────────────────────────────────────────────────────────
  const VoxEngine = (() => {
    const SS = typeof window !== "undefined" ? window.speechSynthesis : null;
    let _voicesCache = [];
    let _voicesReady = false;
    const _voiceListeners = new Set();

    function refreshVoices() {
      if (!SS) return [];
      const list = SS.getVoices() || [];
      if (list.length) {
        _voicesCache = list;
        _voicesReady = true;
        for (const fn of _voiceListeners) { try { fn(list); } catch (e) {} }
      }
      return list;
    }

    if (SS) {
      // Voices populate asynchronously on most browsers; subscribe.
      try {
        SS.onvoiceschanged = refreshVoices;
        refreshVoices();
      } catch (e) {}
    }

    function voices() {
      if (!_voicesReady) refreshVoices();
      return _voicesCache.slice();
    }

    function onVoicesChanged(fn) {
      _voiceListeners.add(fn);
      return () => _voiceListeners.delete(fn);
    }

    function listByLang() {
      const out = {};
      for (const v of voices()) {
        const code = (v.lang || "").split(/[-_]/)[0].toLowerCase() || "??";
        if (!out[code]) out[code] = [];
        out[code].push(v);
      }
      return out;
    }

    // Some voice engines truncate long utterances (Chrome ~200 chars per
    // utterance is safest, some stall over 32KB total). Split on sentence
    // boundaries so the rhythm is preserved.
    function chunkText(text, maxLen = 200) {
      const clean = String(text || "").replace(/\s+/g, " ").trim();
      if (!clean) return [];
      if (clean.length <= maxLen) return [clean];
      const out = [];
      // First pass — split on sentence terminators.
      const sentences = clean.match(/[^.!?…—:;]+[.!?…—:;]?/g) || [clean];
      let buf = "";
      for (const s of sentences) {
        const piece = s.trim();
        if (!piece) continue;
        if ((buf + " " + piece).trim().length > maxLen) {
          if (buf) out.push(buf.trim());
          if (piece.length > maxLen) {
            // Hard split on word boundaries.
            const words = piece.split(/\s+/);
            let line = "";
            for (const w of words) {
              if ((line + " " + w).trim().length > maxLen) {
                if (line) out.push(line.trim());
                line = w;
              } else {
                line = line ? line + " " + w : w;
              }
            }
            if (line) buf = line;
            else buf = "";
          } else {
            buf = piece;
          }
        } else {
          buf = buf ? buf + " " + piece : piece;
        }
      }
      if (buf) out.push(buf.trim());
      return out;
    }

    let _currentUtterances = [];
    let _currentOnEnd = null;

    function stop() {
      if (!SS) return;
      try { SS.cancel(); } catch (e) {}
      _currentUtterances = [];
      _currentOnEnd = null;
    }

    // speak({ text | chunks, voice, lang, rate, pitch, volume, onWord, onChunkStart, onEnd, onError })
    // - `text`: full string; will be auto-chunked.
    // - `chunks`: pre-chunked array of { text, meta? } — preferred when you
    //   want callbacks per logical unit (e.g. one chunk per verse).
    function speak(opts = {}) {
      if (!SS) { opts.onError && opts.onError(new Error("speechSynthesis unavailable")); return; }
      stop(); // never overlap
      const chunks = Array.isArray(opts.chunks) && opts.chunks.length
        ? opts.chunks
        : chunkText(opts.text).map(t => ({ text: t }));
      if (!chunks.length) { opts.onEnd && opts.onEnd(); return; }

      const utts = chunks.map((chunk, i) => {
        const u = new SpeechSynthesisUtterance(chunk.text);
        if (opts.voice)  u.voice = opts.voice;
        if (opts.lang)   u.lang = opts.lang;
        if (typeof opts.rate === "number")   u.rate = Math.max(0.1, Math.min(10, opts.rate));
        if (typeof opts.pitch === "number")  u.pitch = Math.max(0, Math.min(2, opts.pitch));
        if (typeof opts.volume === "number") u.volume = Math.max(0, Math.min(1, opts.volume));
        u.onstart = () => { opts.onChunkStart && opts.onChunkStart(i, chunk); };
        u.onboundary = (e) => { opts.onWord && opts.onWord(e, i, chunk); };
        u.onend = () => {
          if (i === chunks.length - 1) {
            _currentUtterances = [];
            _currentOnEnd = null;
            opts.onEnd && opts.onEnd();
          }
        };
        u.onerror = (e) => {
          // Don't treat "canceled" as a hard error — that's just stop().
          if (e && e.error === "canceled") return;
          opts.onError && opts.onError(e);
        };
        return u;
      });
      _currentUtterances = utts;
      _currentOnEnd = opts.onEnd || null;
      for (const u of utts) {
        try { SS.speak(u); } catch (e) { opts.onError && opts.onError(e); }
      }
    }

    function pause()  { try { SS && SS.pause();  } catch (e) {} }
    function resume() { try { SS && SS.resume(); } catch (e) {} }
    function isPlaying() { return !!(SS && SS.speaking); }
    function isPaused()  { return !!(SS && SS.paused); }
    function isAvailable() { return !!SS; }

    return {
      voices, onVoicesChanged, listByLang, chunkText,
      speak, pause, resume, stop,
      isPlaying, isPaused, isAvailable,
      // Future: assign a function here returning Promise<Blob> of synthesized
      // audio from a cloud provider (OpenAI/ElevenLabs/etc.) via /api/tts.
      cloudProvider: null,
    };
  })();

  window.CODEX_VOX = VoxEngine;

  // ───────────────────────────────────────────────────────────────────────
  // Helpers
  // ───────────────────────────────────────────────────────────────────────
  function booksList() { return (window.CODEX_DATA && window.CODEX_DATA.books) || []; }
  function bookName(bookId) {
    const b = booksList().find((x) => x.id === bookId);
    return b ? b.name : bookId;
  }
  function activeTranslationLang(translationId) {
    try {
      const t = (window.CODEX_DATA && window.CODEX_DATA.translations || [])
        .find((x) => x.id === translationId);
      const lang = (t && (t.lang || t.language)) || "en";
      return String(lang).toLowerCase();
    } catch (e) { return "en"; }
  }

  function isNaturalVoice(v) {
    const n = (v && v.name) || "";
    return /(natural|neural|enhanced|premium|wavenet|studio|hd)/i.test(n);
  }

  function langDisplay(code) {
    const M = {
      en: "English", es: "Español", fr: "Français", de: "Deutsch",
      it: "Italiano", pt: "Português", he: "עברית", ar: "العربية",
      zh: "中文", ja: "日本語", ko: "한국어", ru: "Русский",
      el: "Ελληνικά", la: "Latina", hi: "हिन्दी", nl: "Nederlands",
      pl: "Polski", tr: "Türkçe", sv: "Svenska", id: "Bahasa",
    };
    return M[code] || code.toUpperCase();
  }

  // Read a chapter's verses via the canonical BIBLE store.
  async function loadChapterVerses(bookId, chapter, translation) {
    try {
      if (window.BIBLE && typeof window.BIBLE.getChapter === "function") {
        const ch = await window.BIBLE.getChapter(bookId, chapter, translation);
        if (ch && Array.isArray(ch.verses)) return ch.verses;
        if (Array.isArray(ch)) return ch;
      }
    } catch (e) {}
    return [];
  }

  // Per-voice prefs persistence
  function prefsKey(voiceId) { return "codex.vox.prefs." + (voiceId || "default"); }
  function loadPrefs(voiceId) {
    try {
      const j = localStorage.getItem(prefsKey(voiceId));
      if (j) return JSON.parse(j);
    } catch (e) {}
    return { rate: 1.0, pitch: 1.0, volume: 1.0 };
  }
  function savePrefs(voiceId, prefs) {
    try { localStorage.setItem(prefsKey(voiceId), JSON.stringify(prefs)); } catch (e) {}
  }

  // ───────────────────────────────────────────────────────────────────────
  // Prayer-formats module loader
  // ───────────────────────────────────────────────────────────────────────
  let _prayersPromise = null;
  function loadPrayerFormats() {
    if (_prayersPromise) return _prayersPromise;
    _prayersPromise = (async () => {
      // Try the modules system first (cached in IndexedDB).
      try {
        if (window.CODEX_MODULES && typeof window.CODEX_MODULES.loadModule === "function") {
          const m = await window.CODEX_MODULES.loadModule("prayer-formats");
          if (m && Array.isArray(m.formats)) return m;
        }
      } catch (e) {}
      // Fallback — direct fetch of the bundled file.
      try {
        const r = await fetch("data/modules/prayer-formats.json");
        if (r.ok) return await r.json();
      } catch (e) {}
      return { formats: [] };
    })().catch((e) => { _prayersPromise = null; throw e; });
    return _prayersPromise;
  }

  const BADGE_COLORS = {
    christian:  { bg: "#3a2d10", fg: "#ffd47a", line: "#a07d2c" },
    catholic:   { bg: "#3a1414", fg: "#ffa0a0", line: "#a04848" },
    orthodox:   { bg: "#10203a", fg: "#a0c8ff", line: "#3060a0" },
    jewish:     { bg: "#102438", fg: "#9bd0ff", line: "#3a78b0" },
    messianic:  { bg: "#142a2a", fg: "#9be0d4", line: "#3a8878" },
    muslim:     { bg: "#0f2a18", fg: "#a0e6b4", line: "#3a8858" },
    sufi:       { bg: "#2a160f", fg: "#ffc8a0", line: "#a0683a" },
    gnostic:    { bg: "#231038", fg: "#d0a8ff", line: "#7048a0" },
    hermetic:   { bg: "#1f1038", fg: "#c0a0ff", line: "#6048a0" },
    quaker:     { bg: "#1c1f22", fg: "#c8cdd2", line: "#6a7480" },
    newage:     { bg: "#102a2a", fg: "#a0e8ff", line: "#3a8888" },
    interfaith: { bg: "#241d10", fg: "#dccc9e", line: "#7a6940" },
  };
  function badgeStyle(badge) {
    const c = BADGE_COLORS[badge] || BADGE_COLORS.interfaith;
    return {
      background: c.bg, color: c.fg, border: "1px solid " + c.line,
      padding: "2px 8px", fontSize: "10px", letterSpacing: "0.12em",
      borderRadius: "10px", fontWeight: 600, textTransform: "uppercase",
      display: "inline-block",
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // VoxPanel — main component
  // ───────────────────────────────────────────────────────────────────────
  function VoxPanel(ctx) {
    const [mode, setMode] = useState("reading"); // reading | prayer
    const [voices, setVoices] = useState(() => VoxEngine.voices());
    const [voiceId, setVoiceId] = useState(() => {
      try { return localStorage.getItem("codex.vox.selectedVoice") || ""; }
      catch (e) { return ""; }
    });
    const [source, setSource] = useState("chapter"); // chapter | verse | custom
    const [customText, setCustomText] = useState("");
    const [prefs, setPrefs] = useState(() => loadPrefs(voiceId));
    const [playing, setPlaying] = useState(false);
    const [paused, setPaused] = useState(false);
    const [currentVerse, setCurrentVerse] = useState(null);
    const [status, setStatus] = useState("");
    const cancelRef = useRef(false);

    // Refresh voices when the OS list arrives.
    useEffect(() => {
      const off = VoxEngine.onVoicesChanged((list) => setVoices(list.slice()));
      return off;
    }, []);

    // Auto-pick a voice that matches the active translation's language.
    const targetLang = activeTranslationLang(ctx.translation);
    useEffect(() => {
      if (voiceId) {
        // Validate it still exists.
        const v = voices.find(x => x.voiceURI === voiceId);
        if (v) return;
      }
      if (!voices.length) return;
      // Prefer Natural/Enhanced voice matching the language.
      const matchLang = voices.filter(v => (v.lang || "").toLowerCase().startsWith(targetLang));
      const pool = matchLang.length ? matchLang : voices;
      const natural = pool.find(isNaturalVoice);
      const pick = natural || pool[0];
      if (pick) {
        setVoiceId(pick.voiceURI);
        try { localStorage.setItem("codex.vox.selectedVoice", pick.voiceURI); } catch (e) {}
        setPrefs(loadPrefs(pick.voiceURI));
      }
    }, [voices, targetLang, ctx.translation]);

    const selectedVoice = useMemo(
      () => voices.find(v => v.voiceURI === voiceId) || null,
      [voices, voiceId]
    );

    function persistPrefs(next) {
      setPrefs(next);
      if (voiceId) savePrefs(voiceId, next);
    }

    function pickVoice(uri) {
      setVoiceId(uri);
      try { localStorage.setItem("codex.vox.selectedVoice", uri); } catch (e) {}
      setPrefs(loadPrefs(uri));
    }

    // Group voices by language with quality badges.
    const grouped = useMemo(() => {
      const out = {};
      for (const v of voices) {
        const code = (v.lang || "").split(/[-_]/)[0].toLowerCase() || "??";
        if (!out[code]) out[code] = [];
        out[code].push(v);
      }
      // Sort each group: natural voices first, then alphabetical.
      for (const code of Object.keys(out)) {
        out[code].sort((a, b) => {
          const na = isNaturalVoice(a) ? 0 : 1;
          const nb = isNaturalVoice(b) ? 0 : 1;
          if (na !== nb) return na - nb;
          return (a.name || "").localeCompare(b.name || "");
        });
      }
      return out;
    }, [voices]);

    const sortedLangCodes = useMemo(() => {
      const codes = Object.keys(grouped);
      codes.sort((a, b) => {
        // Active translation's language first
        if (a === targetLang) return -1;
        if (b === targetLang) return 1;
        return a.localeCompare(b);
      });
      return codes;
    }, [grouped, targetLang]);

    // ── Reading actions ─────────────────────────────────────────────────
    async function getReadingChunks() {
      if (source === "verse" && ctx.bookId && ctx.chapter && ctx.verse) {
        const verses = await loadChapterVerses(ctx.bookId, ctx.chapter, ctx.translation);
        const v = verses.find(x => Number(x.verse || x.num) === Number(ctx.verse));
        if (v) {
          const text = v.text || v.t || "";
          return [{ text, meta: { ref: `${ctx.bookId}.${ctx.chapter}.${ctx.verse}` } }];
        }
        return [];
      }
      if (source === "custom") {
        const t = customText.trim();
        if (!t) return [];
        return VoxEngine.chunkText(t).map(s => ({ text: s }));
      }
      // chapter
      const verses = await loadChapterVerses(ctx.bookId, ctx.chapter, ctx.translation);
      if (!verses.length) return [];
      const out = [];
      for (const v of verses) {
        const num = v.verse || v.num;
        const text = (v.text || v.t || "").trim();
        if (!text) continue;
        const ref = `${ctx.bookId}.${ctx.chapter}.${num}`;
        // Each verse becomes one chunk for clean per-verse highlight; if a
        // verse is itself huge, chunkText will keep utterances under cap.
        const sub = VoxEngine.chunkText(text, 220);
        sub.forEach((piece, i) => {
          out.push({ text: piece, meta: { ref, verse: num, isFirstSubchunk: i === 0 } });
        });
      }
      return out;
    }

    function speakChunks(chunks, { rateOverride } = {}) {
      if (!chunks.length) { setStatus("Nothing to read."); return; }
      setStatus(""); setPlaying(true); setPaused(false); cancelRef.current = false;
      VoxEngine.speak({
        chunks,
        voice: selectedVoice,
        lang: selectedVoice ? selectedVoice.lang : undefined,
        rate: rateOverride != null ? rateOverride : prefs.rate,
        pitch: prefs.pitch,
        volume: prefs.volume,
        onChunkStart(i, chunk) {
          if (chunk.meta && chunk.meta.ref && chunk.meta.isFirstSubchunk !== false) {
            setCurrentVerse(chunk.meta.ref);
            try {
              window.dispatchEvent(new CustomEvent("codex:vox-progress", {
                detail: { verseRef: chunk.meta.ref, verse: chunk.meta.verse },
              }));
            } catch (e) {}
          }
        },
        onEnd() { setPlaying(false); setPaused(false); setCurrentVerse(null); },
        onError(e) {
          setPlaying(false); setPaused(false);
          if (!cancelRef.current) setStatus("Voice error: " + (e && (e.error || e.message) || "unknown"));
        },
      });
    }

    async function play() {
      const chunks = await getReadingChunks();
      speakChunks(chunks);
    }
    function pause() { VoxEngine.pause(); setPaused(true); }
    function resume() { VoxEngine.resume(); setPaused(false); }
    function stop() {
      cancelRef.current = true;
      VoxEngine.stop();
      setPlaying(false); setPaused(false); setCurrentVerse(null);
    }

    // Verse-step ±: navigate the reader to the prev/next verse and (optionally)
    // restart playback at that verse.
    async function verseStep(delta) {
      const v = Math.max(1, (Number(ctx.verse) || 1) + delta);
      try {
        window.dispatchEvent(new CustomEvent("codex:navigate", {
          detail: { book: bookName(ctx.bookId), bookId: ctx.bookId, chapter: ctx.chapter, verse: v },
        }));
      } catch (e) {}
    }

    // Listen for verse-menu shortcut from other plugins.
    useEffect(() => {
      function onSpeakReq(e) {
        const d = (e && e.detail) || {};
        if (!d.text) return;
        const chunks = VoxEngine.chunkText(d.text).map(s => ({
          text: s, meta: d.ref ? { ref: d.ref } : null,
        }));
        speakChunks(chunks);
      }
      function onStopReq() { stop(); }
      window.addEventListener("codex:vox-speak", onSpeakReq);
      window.addEventListener("codex:vox-stop", onStopReq);
      return () => {
        window.removeEventListener("codex:vox-speak", onSpeakReq);
        window.removeEventListener("codex:vox-stop", onStopReq);
      };
    }, [selectedVoice, prefs.rate, prefs.pitch, prefs.volume]);

    // Stop on unmount.
    useEffect(() => () => { try { VoxEngine.stop(); } catch (e) {} }, []);

    // ── Render ──────────────────────────────────────────────────────────
    return React.createElement("div", { className: "cx-vox-panel", style: panelStyle },
      React.createElement(VoxHeader, { mode, setMode }),
      mode === "reading"
        ? React.createElement(ReadingPane, {
            ctx, voices, grouped, sortedLangCodes, voiceId, pickVoice,
            selectedVoice, prefs, persistPrefs, source, setSource,
            customText, setCustomText, playing, paused, currentVerse, status,
            play, pause, resume, stop, verseStep,
          })
        : React.createElement(PrayerPane, {
            ctx, selectedVoice, voices, voiceId, pickVoice,
            grouped, sortedLangCodes,
            prefs,
          })
    );
  }

  // ───────────────────────────────────────────────────────────────────────
  // Header (tab switch)
  // ───────────────────────────────────────────────────────────────────────
  function VoxHeader({ mode, setMode }) {
    const tabBtn = (id, label) => React.createElement("button", {
      key: id, onClick: () => setMode(id), className: "cx-vox-tab",
      style: {
        flex: 1, padding: "10px 12px",
        background: mode === id ? "#1a2230" : "transparent",
        color: mode === id ? "#7ee0ff" : "#8b96a2",
        border: "1px solid " + (mode === id ? "#3a4a5e" : "#212a35"),
        borderBottom: mode === id ? "1px solid #1a2230" : "1px solid #212a35",
        cursor: "pointer", letterSpacing: "0.18em", fontSize: "11px",
        fontFamily: "ui-monospace, 'JetBrains Mono', Menlo, monospace",
        fontWeight: 600,
      },
    }, label);

    return React.createElement("div", { className: "cx-vox-tabs", style: {
      display: "flex", borderBottom: "1px solid #212a35", marginBottom: 14,
    } }, tabBtn("reading", "◉ READING"), tabBtn("prayer", "✶ PRAYER"));
  }

  // ───────────────────────────────────────────────────────────────────────
  // ReadingPane
  // ───────────────────────────────────────────────────────────────────────
  function ReadingPane({
    ctx, voices, grouped, sortedLangCodes, voiceId, pickVoice,
    selectedVoice, prefs, persistPrefs, source, setSource,
    customText, setCustomText, playing, paused, currentVerse, status,
    play, pause, resume, stop, verseStep,
  }) {
    if (!VoxEngine.isAvailable()) {
      return React.createElement("div", { style: { padding: 16, color: "#ffc46b" } },
        "Your browser does not expose speechSynthesis. Try Chrome, Edge, Safari, or Firefox.");
    }

    const refLabel = ctx.bookId && ctx.chapter
      ? `${bookName(ctx.bookId)} ${ctx.chapter}${ctx.verse ? ":" + ctx.verse : ""}`
      : "—";

    const radio = (val, label) => React.createElement("label", {
      key: val,
      style: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#c9d4dc", cursor: "pointer" },
    },
      React.createElement("input", {
        type: "radio", name: "vox-source", checked: source === val,
        onChange: () => setSource(val),
      }),
      label
    );

    const playBtn = playing && !paused
      ? React.createElement("button", { className: "cx-vox-btn cx-vox-btn-primary", onClick: pause, style: btnPrimary }, "❚❚ PAUSE")
      : playing && paused
      ? React.createElement("button", { className: "cx-vox-btn cx-vox-btn-primary", onClick: resume, style: btnPrimary }, "▶ RESUME")
      : React.createElement("button", { className: "cx-vox-btn cx-vox-btn-primary", onClick: play, style: btnPrimary }, "▶ PLAY");

    return React.createElement("div", { style: { padding: "0 14px 16px" } },

      // Context strip
      React.createElement("div", { style: ctxStripStyle },
        React.createElement("span", { style: { color: "#6b7785", letterSpacing: "0.16em", fontSize: 10 } }, "READING"),
        React.createElement("span", { style: { color: "#7ee0ff", fontWeight: 600 } }, refLabel),
      ),

      // Source picker
      React.createElement("div", { style: { marginBottom: 14 } },
        React.createElement("div", { style: sectionLabelStyle }, "SOURCE"),
        React.createElement("div", { style: { display: "flex", gap: 14, flexWrap: "wrap" } },
          radio("chapter", "Current chapter"),
          radio("verse",   "Current verse only"),
          radio("custom",  "Custom text"),
        ),
        source === "custom" && React.createElement("textarea", {
          value: customText, onChange: e => setCustomText(e.target.value),
          placeholder: "Paste or type any text in any language…",
          rows: 4,
          style: {
            width: "100%", marginTop: 8, padding: 10,
            background: "#0a0f17", color: "#d8e0e8",
            border: "1px solid #232d3a", borderRadius: 6,
            fontFamily: "Cormorant Garamond, Georgia, serif",
            fontSize: 15, lineHeight: 1.5, resize: "vertical",
          },
        }),
      ),

      // Voice picker
      React.createElement("div", { style: { marginBottom: 14 } },
        React.createElement("div", { style: sectionLabelStyle },
          "VOICE",
          selectedVoice && isNaturalVoice(selectedVoice) &&
            React.createElement("span", { style: naturalBadge }, "★ NATURAL"),
        ),
        React.createElement("select", {
          value: voiceId, onChange: e => pickVoice(e.target.value),
          style: selectStyle,
        },
          !voices.length && React.createElement("option", { value: "" }, "Loading voices…"),
          sortedLangCodes.map(code =>
            React.createElement("optgroup", { key: code, label: langDisplay(code) + (code === activeTranslationLang(ctx.translation) ? " · matches translation" : "") },
              grouped[code].map(v => React.createElement("option", { key: v.voiceURI, value: v.voiceURI },
                v.name + (isNaturalVoice(v) ? "  ★" : "") + " · " + v.lang
              ))
            )
          )
        ),
      ),

      // Sliders
      React.createElement("div", { style: { marginBottom: 14 } },
        React.createElement(Slider, {
          label: "Speed", min: 0.5, max: 2.0, step: 0.05,
          value: prefs.rate, onChange: v => persistPrefs({ ...prefs, rate: v }),
          format: v => v.toFixed(2) + "×",
        }),
        React.createElement(Slider, {
          label: "Pitch", min: 0.5, max: 2.0, step: 0.05,
          value: prefs.pitch, onChange: v => persistPrefs({ ...prefs, pitch: v }),
          format: v => v.toFixed(2),
        }),
        React.createElement(Slider, {
          label: "Volume", min: 0, max: 1.0, step: 0.05,
          value: prefs.volume, onChange: v => persistPrefs({ ...prefs, volume: v }),
          format: v => Math.round(v * 100) + "%",
        }),
      ),

      // Playback controls
      React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "stretch", marginBottom: 12 } },
        playBtn,
        React.createElement("button", { onClick: stop, style: btnSecondary, disabled: !playing }, "■ STOP"),
        React.createElement("button", { onClick: () => verseStep(-1), style: btnSecondary, title: "Previous verse" }, "◀ VERSE"),
        React.createElement("button", { onClick: () => verseStep(+1), style: btnSecondary, title: "Next verse" }, "VERSE ▶"),
      ),

      // Cloud-TTS placeholder
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 14 } },
        React.createElement("button", {
          disabled: true,
          title: "Coming soon — premium voices via cloud TTS providers (OpenAI / ElevenLabs / etc.)",
          style: { ...btnSecondary, opacity: 0.45, cursor: "not-allowed" },
        }, "✦ ENHANCE VOICE"),
        React.createElement("span", { style: { fontSize: 11, color: "#6b7785" } },
          "Premium cloud TTS — coming soon"),
      ),

      // Status / now-speaking
      currentVerse && React.createElement("div", { style: nowSpeakingStyle },
        "▸ Speaking: ", React.createElement("b", { style: { color: "#7ee0ff" } }, currentVerse)),
      status && React.createElement("div", { style: { fontSize: 12, color: "#ffc46b", marginTop: 6 } }, status),

      React.createElement("div", { style: { marginTop: 18, fontSize: 11, color: "#6b7785", lineHeight: 1.6 } },
        "Voice quality depends on your OS/browser. macOS & iOS Safari surface Apple's premium voices (★). On Linux you may see eSpeak fallback. Per-voice speed/pitch are saved automatically."),
    );
  }

  // ───────────────────────────────────────────────────────────────────────
  // PrayerPane
  // ───────────────────────────────────────────────────────────────────────
  function PrayerPane({ ctx, selectedVoice, voices, voiceId, pickVoice, grouped, sortedLangCodes, prefs }) {
    const [pack, setPack] = useState(null);
    const [err, setErr] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    const [activeIdx, setActiveIdx] = useState(-1);
    const [playing, setPlaying] = useState(false);
    const [paused, setPaused] = useState(false);
    const [timerRemaining, setTimerRemaining] = useState(0);
    const [timerActive, setTimerActive] = useState(false);
    const [situation, setSituation] = useState("");
    const [generated, setGenerated] = useState(null);
    const [genBusy, setGenBusy] = useState(false);
    const [genErr, setGenErr] = useState("");
    const [genTradition, setGenTradition] = useState("Christian");
    const playSeqRef = useRef({ idx: 0, sections: [], rate: 0.85, canceled: false });
    const timerRef = useRef(null);

    useEffect(() => {
      loadPrayerFormats().then(setPack).catch(e => setErr(String(e && e.message || e)));
    }, []);

    useEffect(() => () => {
      try { VoxEngine.stop(); } catch (e) {}
      if (timerRef.current) clearInterval(timerRef.current);
    }, []);

    const formats = (pack && pack.formats) || [];
    const selected = formats.find(f => f.id === selectedId) || null;

    function startPrayer(format) {
      try { VoxEngine.stop(); } catch (e) {}
      setSelectedId(format.id);
      setActiveIdx(-1);
      setGenerated(null);
    }

    function playSection(idx) {
      const seq = playSeqRef.current;
      if (seq.canceled) return;
      if (idx >= seq.sections.length) {
        setPlaying(false); setPaused(false); setActiveIdx(-1); return;
      }
      const s = seq.sections[idx];
      setActiveIdx(idx);
      // Silence sections: wait `duration` seconds (in addition to TTS reading
      // the cue line if non-empty).
      const isSilence = s.type === "silence";
      const cueText = s.text || (isSilence ? "" : "");
      const advance = () => {
        if (seq.canceled) return;
        if (isSilence && s.duration) {
          // Hold silence with a soft countdown.
          const wait = Math.max(0, Number(s.duration) || 0) * 1000;
          setTimeout(() => playSection(idx + 1), wait);
        } else {
          playSection(idx + 1);
        }
      };
      if (!cueText) { advance(); return; }
      VoxEngine.speak({
        text: cueText,
        voice: selectedVoice,
        lang: selectedVoice ? selectedVoice.lang : undefined,
        rate: seq.rate,
        pitch: prefs.pitch,
        volume: prefs.volume,
        onEnd: () => {
          // Add a short reflective pause between sections.
          const gap = s.type === "petition" || s.type === "doxology" ? 700 : 400;
          setTimeout(advance, gap);
        },
        onError: () => advance(),
      });
    }

    function guide(format) {
      if (!format) return;
      const sections = (generated && generated.formatId === format.id)
        ? generated.sections
        : (format.sections || []);
      if (!sections.length) return;
      const rate = (format.pace_rate || 0.82) * 1.0;
      playSeqRef.current = { idx: 0, sections, rate, canceled: false };
      setPlaying(true); setPaused(false); setActiveIdx(0);
      playSection(0);
    }

    function pause() { try { VoxEngine.pause(); } catch (e) {} setPaused(true); }
    function resume() { try { VoxEngine.resume(); } catch (e) {} setPaused(false); }
    function stop() {
      playSeqRef.current.canceled = true;
      try { VoxEngine.stop(); } catch (e) {}
      setPlaying(false); setPaused(false); setActiveIdx(-1);
    }

    // ── Prayer timer ────────────────────────────────────────────────────
    function startTimer(seconds) {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimerActive(true); setTimerRemaining(seconds);
      timerRef.current = setInterval(() => {
        setTimerRemaining(r => {
          if (r <= 1) {
            clearInterval(timerRef.current); timerRef.current = null;
            setTimerActive(false);
            // Gentle audible cue.
            try { VoxEngine.speak({ text: "Amen.", voice: selectedVoice, rate: 0.8 }); } catch (e) {}
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }
    function stopTimer() {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setTimerActive(false); setTimerRemaining(0);
    }
    function fmtTime(s) {
      const m = Math.floor(s / 60), sec = s % 60;
      return String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
    }

    // ── AI prayer generation ────────────────────────────────────────────
    async function generatePrayer() {
      const sit = situation.trim();
      if (!sit) { setGenErr("Describe the situation first."); return; }
      setGenBusy(true); setGenErr(""); setGenerated(null);
      try {
        const tradition = genTradition || "Christian";
        const system = `You generate reverent, well-crafted prayers in the ${tradition} tradition. Use the form's conventions where applicable: invocation, body / petition, doxology, and a closing such as Amen. Be sincere, never theatrical. About 150 words. Output ONLY the prayer text, no preamble or commentary, no markdown headers.`;
        const provider = (window.CODEX_AI && window.CODEX_AI.getActiveProvider && window.CODEX_AI.getActiveProvider()) || null;
        const body = {
          system,
          messages: [{ role: "user", content: `Compose a prayer for this situation: ${sit}` }],
          max_tokens: 600,
        };
        if (provider && provider.provider) body.provider = provider.provider;
        if (provider && provider.model)    body.model    = provider.model;
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const d = await r.json();
        const txt = d && (d.text || d.content || d.message);
        if (!txt) throw new Error(d && d.error ? d.error : "AI engine returned no text.");
        // Split into sections by paragraph.
        const paras = String(txt).split(/\n{2,}|(?<=[.!?])\s{2,}/).map(s => s.trim()).filter(Boolean);
        const sections = paras.length
          ? paras.map((p, i) => ({
              type: i === 0 ? "invocation" : (i === paras.length - 1 ? "doxology" : "petition"),
              text: p,
            }))
          : [{ type: "petition", text: String(txt).trim() }];
        setGenerated({
          formatId: "petitionary-free",
          tradition,
          text: String(txt).trim(),
          sections,
        });
      } catch (e) {
        setGenErr(String(e && e.message || e));
      } finally {
        setGenBusy(false);
      }
    }

    if (err) {
      return React.createElement("div", { style: { padding: 16, color: "#ffc46b" } },
        "Could not load prayer formats: ", err);
    }
    if (!pack) {
      return React.createElement("div", { style: { padding: 16, color: "#6b7785" } },
        "Loading prayer formats…");
    }

    return React.createElement("div", { style: { padding: "0 14px 18px" } },

      React.createElement("div", { style: ctxStripStyle },
        React.createElement("span", { style: { color: "#6b7785", letterSpacing: "0.16em", fontSize: 10 } }, "PRAYER"),
        React.createElement("span", { style: { color: "#ffc46b" } },
          `${formats.length} traditions`),
      ),

      // Tradition cards grid
      !selected && React.createElement("div", { style: cardsGrid },
        formats.map(f => React.createElement("button", {
          key: f.id, onClick: () => startPrayer(f), className: "cx-vox-prayer-card",
          style: cardStyle,
        },
          React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 } },
            React.createElement("div", { style: cardTitleStyle }, f.name),
            React.createElement("span", { style: badgeStyle(f.badge) }, f.badge || "—"),
          ),
          React.createElement("div", { style: cardTraditionStyle }, f.tradition),
          f.summary && React.createElement("div", { style: cardSummaryStyle }, f.summary),
        )),
      ),

      // Selected prayer view
      selected && React.createElement("div", null,
        React.createElement("button", {
          onClick: () => { stop(); setSelectedId(null); setGenerated(null); },
          style: { ...btnSecondary, marginBottom: 12 },
        }, "← All traditions"),

        React.createElement("div", { style: { marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" } },
          React.createElement("div", null,
            React.createElement("div", { style: { fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: 24, color: "#e8ecf2", lineHeight: 1.15 } },
              selected.name),
            React.createElement("div", { style: { fontSize: 11, color: "#8b96a2", letterSpacing: "0.10em", textTransform: "uppercase", marginTop: 2 } },
              selected.tradition),
          ),
          React.createElement("span", { style: badgeStyle(selected.badge) }, selected.badge || "—"),
        ),

        // Voice override quick-pick for prayer mode
        React.createElement("div", { style: { marginBottom: 12 } },
          React.createElement("div", { style: { ...sectionLabelStyle, marginBottom: 4 } }, "VOICE"),
          React.createElement("select", {
            value: voiceId, onChange: e => pickVoice(e.target.value),
            style: selectStyle,
          },
            sortedLangCodes.map(code =>
              React.createElement("optgroup", { key: code, label: langDisplay(code) },
                grouped[code].map(v => React.createElement("option", { key: v.voiceURI, value: v.voiceURI },
                  v.name + (isNaturalVoice(v) ? "  ★" : "") + " · " + v.lang
                ))
              )
            )
          ),
        ),

        // Controls
        React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 } },
          !playing && React.createElement("button", { onClick: () => guide(selected), style: btnPrimary }, "✶ GUIDE ME"),
          playing && !paused && React.createElement("button", { onClick: pause, style: btnPrimary }, "❚❚ PAUSE"),
          playing && paused && React.createElement("button", { onClick: resume, style: btnPrimary }, "▶ RESUME"),
          playing && React.createElement("button", { onClick: stop, style: btnSecondary }, "■ STOP"),
        ),

        // Prayer body — render sections in big serif
        React.createElement("div", { style: prayerBodyStyle },
          ((generated && generated.formatId === selected.id) ? generated.sections : (selected.sections || []))
            .map((s, i) => React.createElement("div", {
              key: i,
              style: {
                ...sectionStyle,
                ...(activeIdx === i ? activeSectionStyle : null),
                ...(s.type === "silence" ? silenceSectionStyle : null),
              },
            },
              React.createElement("div", { style: sectionTagStyle }, s.type),
              React.createElement("div", { style: sectionTextStyle(selected.lang_default) }, s.text || (s.type === "silence" ? "…" : "")),
              s.type === "silence" && s.duration ? React.createElement("div", { style: silenceDurStyle }, `${s.duration}s`) : null,
            ))
        ),

        // AI personalization
        selected.id === "petitionary-free" && React.createElement("div", { style: { marginTop: 16, padding: 12, background: "#0e1320", border: "1px solid #232d3a", borderRadius: 8 } },
          React.createElement("div", { style: sectionLabelStyle }, "GENERATE A PRAYER"),
          React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" } },
            ["Christian","Catholic","Orthodox","Jewish","Messianic","Sufi","Gnostic","Hermetic","Quaker","New Age","Interfaith"].map(t =>
              React.createElement("button", {
                key: t, onClick: () => setGenTradition(t),
                style: {
                  fontSize: 11, padding: "3px 8px", borderRadius: 10, cursor: "pointer",
                  border: "1px solid " + (genTradition === t ? "#7ee0ff" : "#2a3340"),
                  background: genTradition === t ? "#13202e" : "transparent",
                  color: genTradition === t ? "#7ee0ff" : "#8b96a2",
                },
              }, t)
            )
          ),
          React.createElement("textarea", {
            value: situation, onChange: e => setSituation(e.target.value),
            placeholder: "Describe the situation… e.g. anxiety before a job interview, grief over a friend, gratitude after recovery.",
            rows: 3,
            style: {
              width: "100%", padding: 10, marginBottom: 8,
              background: "#0a0f17", color: "#d8e0e8",
              border: "1px solid #232d3a", borderRadius: 6,
              fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: 14, lineHeight: 1.5,
            },
          }),
          React.createElement("div", { style: { display: "flex", gap: 8 } },
            React.createElement("button", { onClick: generatePrayer, disabled: genBusy, style: { ...btnPrimary, opacity: genBusy ? 0.5 : 1 } },
              genBusy ? "Composing…" : "✶ COMPOSE"),
            generated && React.createElement("button", { onClick: () => guide(selected), style: btnSecondary }, "▶ READ ALOUD"),
          ),
          genErr && React.createElement("div", { style: { fontSize: 12, color: "#ffc46b", marginTop: 8 } }, genErr),
        ),

        // Prayer timer
        React.createElement("div", { style: { marginTop: 16, padding: 12, background: "#0e1320", border: "1px solid #232d3a", borderRadius: 8 } },
          React.createElement("div", { style: { ...sectionLabelStyle, display: "flex", justifyContent: "space-between", alignItems: "center" } },
            React.createElement("span", null, "TIMER"),
            timerActive && React.createElement("span", { style: { color: "#7ee0ff", fontFamily: "ui-monospace, monospace", fontSize: 14 } }, fmtTime(timerRemaining))
          ),
          React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
            [1, 3, 5, 10, 20].map(m => React.createElement("button", {
              key: m, onClick: () => startTimer(m * 60), style: btnSecondary,
            }, `${m} min`)),
            timerActive && React.createElement("button", { onClick: stopTimer, style: { ...btnSecondary, color: "#ffc46b" } }, "Stop timer"),
          ),
        ),
      ),
    );
  }

  // ───────────────────────────────────────────────────────────────────────
  // Slider component
  // ───────────────────────────────────────────────────────────────────────
  function Slider({ label, min, max, step, value, onChange, format }) {
    return React.createElement("div", { style: { marginBottom: 8 } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8b96a2", letterSpacing: "0.10em", marginBottom: 2 } },
        React.createElement("span", null, label.toUpperCase()),
        React.createElement("span", { style: { color: "#c9d4dc", fontFamily: "ui-monospace, monospace" } }, format ? format(value) : value),
      ),
      React.createElement("input", {
        className: "cx-vox-slider",
        type: "range", min, max, step, value,
        onChange: e => onChange(parseFloat(e.target.value)),
        style: { width: "100%" },
      }),
    );
  }

  // ───────────────────────────────────────────────────────────────────────
  // Inline styles
  // ───────────────────────────────────────────────────────────────────────
  const panelStyle = {
    fontFamily: "Inter Tight, system-ui, sans-serif",
    color: "#c9d4dc",
    background: "#0a0f17",
    minHeight: "100%",
  };
  const sectionLabelStyle = {
    fontSize: 10, letterSpacing: "0.18em", color: "#6b7785",
    textTransform: "uppercase", marginBottom: 6,
    display: "flex", alignItems: "center", gap: 8,
  };
  const naturalBadge = {
    color: "#7ee0ff", fontSize: 9, letterSpacing: "0.18em",
    border: "1px solid #2a4a60", padding: "1px 6px", borderRadius: 6,
  };
  const ctxStripStyle = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "8px 10px", marginBottom: 14,
    background: "#0e1320", border: "1px solid #232d3a", borderRadius: 6,
    fontSize: 12,
  };
  const selectStyle = {
    width: "100%", padding: "8px 10px",
    background: "#0a0f17", color: "#d8e0e8",
    border: "1px solid #2a3340", borderRadius: 6,
    fontFamily: "ui-monospace, 'JetBrains Mono', monospace", fontSize: 12,
  };
  const btnPrimary = {
    padding: "12px 18px", minHeight: 44,
    background: "linear-gradient(180deg, #1a3548, #0e2030)",
    color: "#7ee0ff",
    border: "1px solid #3a6080",
    borderRadius: 8, cursor: "pointer", fontWeight: 700,
    letterSpacing: "0.15em", fontSize: 12,
    fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
  };
  const btnSecondary = {
    padding: "10px 14px", minHeight: 40,
    background: "#13202e", color: "#c9d4dc",
    border: "1px solid #2a3340",
    borderRadius: 8, cursor: "pointer",
    letterSpacing: "0.12em", fontSize: 11,
    fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
  };
  const nowSpeakingStyle = {
    padding: "8px 10px", background: "#10202e",
    border: "1px solid #2a4a60", borderRadius: 6,
    fontSize: 12, color: "#c9d4dc", marginTop: 6,
  };
  const cardsGrid = {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 10,
  };
  const cardStyle = {
    textAlign: "left", padding: 12,
    background: "#0e1320", border: "1px solid #232d3a",
    borderRadius: 8, cursor: "pointer", color: "#c9d4dc",
    fontFamily: "Inter Tight, system-ui, sans-serif",
  };
  const cardTitleStyle = {
    fontFamily: "Cormorant Garamond, Georgia, serif",
    fontSize: 18, color: "#e8ecf2", lineHeight: 1.15,
  };
  const cardTraditionStyle = {
    fontSize: 11, color: "#8b96a2", letterSpacing: "0.08em",
    marginBottom: 6, textTransform: "uppercase",
  };
  const cardSummaryStyle = {
    fontSize: 12, color: "#a4afba", lineHeight: 1.5,
  };
  const prayerBodyStyle = {
    marginTop: 8,
  };
  const sectionStyle = {
    padding: "10px 12px", marginBottom: 8,
    background: "#0e1320", border: "1px solid #1f2a36",
    borderRadius: 6,
    transition: "background 320ms ease, border-color 320ms ease",
  };
  const activeSectionStyle = {
    background: "#15263a", borderColor: "#3a6080",
    boxShadow: "0 0 0 1px rgba(126,224,255,0.15)",
  };
  const silenceSectionStyle = {
    background: "#0a0f17", borderStyle: "dashed",
    color: "#8b96a2", fontStyle: "italic",
  };
  const sectionTagStyle = {
    fontSize: 9, letterSpacing: "0.20em", textTransform: "uppercase",
    color: "#6b7785", marginBottom: 4,
  };
  function sectionTextStyle(langDefault) {
    const isHeb = langDefault === "he";
    return {
      fontFamily: isHeb
        ? "Cardo, 'Times New Roman', serif"
        : "Cormorant Garamond, Georgia, serif",
      fontSize: 17, lineHeight: 1.55, color: "#e0e6ec",
    };
  }
  const silenceDurStyle = {
    fontSize: 11, color: "#6b7785", marginTop: 4,
    fontFamily: "ui-monospace, monospace",
  };

  window.CODEX_VoxPanel = VoxPanel;

  // ───────────────────────────────────────────────────────────────────────
  // Plugin registration
  // ───────────────────────────────────────────────────────────────────────
  function doRegister() {
    if (!window.CODEX_PLUGINS_API || typeof window.CODEX_PLUGINS_API.register !== "function") return false;
    return window.CODEX_PLUGINS_API.register({
      id: "vox",
      name: "VOX — Voice + Prayer",
      version: "1.0.0",
      panels: [{
        id: "vox",
        label: "VOX",
        glyph: "◉",
        render(ctx) {
          return React.createElement(VoxPanel, {
            book: ctx.book,
            bookId: ctx.bookId,
            chapter: ctx.chapter,
            verse: ctx.verse,
            translation: ctx.translation,
          });
        },
      }],
      verseActions: [{
        label: "Read aloud",
        icon: "◉",
        handler(verseRef) {
          try {
            const text = (verseRef && typeof verseRef === "object" && verseRef.text) ? verseRef.text : "";
            const refStr = (verseRef && typeof verseRef === "object")
              ? (verseRef.ref || (verseRef.bookId && verseRef.chapter && verseRef.verse
                  ? `${verseRef.bookId}.${verseRef.chapter}.${verseRef.verse}` : null))
              : String(verseRef);
            window.dispatchEvent(new CustomEvent("codex:vox-speak", {
              detail: { text, ref: refStr, lang: verseRef && verseRef.translation },
            }));
            window.dispatchEvent(new CustomEvent("codex:open-panel", {
              detail: { panelId: "vox:vox" },
            }));
          } catch (e) {}
        },
      }],
    });
  }

  if (!doRegister()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", doRegister, { once: true });
    } else {
      window.addEventListener("load", doRegister, { once: true });
    }
  }
})();
