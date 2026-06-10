// GENERATED from sword.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
// CODEX — sword.jsx · ⚔ THE SWORD — the fourfold edge.
//
//   "For the word of God is living and active, sharper than any two-edged
//    sword, piercing until it divides soul from spirit, joints from marrow;
//    it judges the thoughts and intentions of the heart."  — Hebrews 4:12
//
// This console takes that verse at its word. Open it on ANY verse and the
// blade falls: a single canvas strike cleaves the verse into its four
// classical strata, surveyed through BOTH great fourfold traditions at once:
//
//   PaRDeS (Jewish)            Quadriga (Christian)         depth
//   ── Peshat  · plain     ←→  Littera   · literal          surface
//   ── Remez   · hint      ←→  Allegoria · typological        │
//   ── Drash   · inquiry   ←→  Moralis   · tropological       │
//   ── Sod     · secret    ←→  Anagogia  · anagogical       marrow
//
// Two edges, one blade — rendered as aligned pairs so the reader sees where
// the traditions cut together and where they part. The Sod stratum carries
// LIVE gematria computed client-side by the real engine (gematria.js), never
// asserted by the AI. Each stratum cites representative voices and clickable
// canonical refs.
//
// Honesty is part of the edge: the banner marks everything as survey, the
// caveats always render, and no stratum is presented as "the" meaning —
// the fourfold method exists precisely because the Word out-cuts any single
// reading.
//
// Cached forever in localStorage by verse key
// (codex.swords.${bookId}.${chapter}.${verse}). RE-FORGE re-analyzes.

const SWORD_SCHEMA_V = 1;

const SWORD_PROMPT = `You are CODEX SWORD — a scholar of classical fourfold exegesis, fluent in BOTH the Jewish PaRDeS method (Peshat, Remez, Drash, Sod) and the Christian Quadriga (literal, typological/allegorical, tropological/moral, anagogical). For the given verse, return a single JSON object surveying it through both traditions, stratum by stratum. Calm, scholarly, neutral. No prose outside the JSON. No fences.

Schema:
{
  "theme":   "1 short clause naming what this verse is doing (e.g. 'the Word as pre-existent agent of creation').",
  "edge":    "1 sentence naming the DIVISION this verse makes — what it separates in the reader or in history (soul/intention, kingdom/empire, letter/spirit). Scholarly, not homiletic.",

  "original": {
    "lang":           "hebrew | greek | aramaic",
    "text":           "The verse in its original language (unpointed Hebrew acceptable). Empty string if genuinely uncertain.",
    "translit":       "Standard transliteration. Empty if text empty.",
    "keyTerm":        "THE pivotal word of the verse in the original script (e.g. λόγος, ברא). Empty if unsure.",
    "keyTermTranslit":"Its transliteration.",
    "keyTermGloss":   "1-line gloss of the key term."
  },

  "strata": [
    // EXACTLY 4 entries, surface → depth. Each pairs the two traditions at
    // the same depth. 'pardes'/'quadriga' are 2-4 sentence scholarly readings
    // in that register. 'voices' cites 1-2 representative interpreters per
    // tradition (real, attributable — e.g. 'Rashi', 'Ibn Ezra', 'Origen,
    // De Principiis IV', 'Aquinas, ST I q.1 a.10'). 'refs' are 1-3 canonical
    // cross-refs THIS stratum naturally opens onto.
    {
      "depth":        1,
      "pardesName":   "Peshat",   "pardesGloss":  "plain",
      "quadrigaName": "Littera",  "quadrigaGloss":"literal",
      "pardes":       "The plain-sense reading: grammar, context, what the words say where they stand.",
      "quadriga":     "The literal sense as the Christian tradition receives it.",
      "voicesPardes": "…", "voicesQuadriga": "…",
      "refs": [ { "ref": "Book ch:vv", "note": "under 10 words" } ],
      "converge":     "1 short clause — where the two traditions agree at this depth, or where they part. Honest."
    },
    { "depth": 2, "pardesName": "Remez", "pardesGloss": "hint",    "quadrigaName": "Allegoria", "quadrigaGloss": "typological",  ... },
    { "depth": 3, "pardesName": "Drash", "pardesGloss": "inquiry", "quadrigaName": "Moralis",   "quadrigaGloss": "tropological", ... },
    { "depth": 4, "pardesName": "Sod",   "pardesGloss": "secret",  "quadrigaName": "Anagogia",  "quadrigaGloss": "anagogical",   ... }
  ],

  "caveats": [
    // 1-3 scholarly caveats. ALWAYS include at least one — e.g. that the
    // fourfold schema is a medieval systematization, that Sod traditions are
    // esoteric and contested, that no single stratum exhausts the verse.
    "..."
  ]
}

Rules:
- Real interpreters only, correctly attributed to the right tradition and stratum. If no famous voice fits a stratum, write a school ('Lurianic kabbalists', 'Antiochene school') — never invent names.
- The original-language text must be the real text of THIS verse (Masoretic / NA-style). If you are not confident, return empty strings — the UI degrades gracefully. Never fabricate.
- Sod/Anagogia: survey what the traditions SAY (Zohar, mystical readings, beatific vision), clearly as their claim, never as fact. Do not compute gematria — the app computes it locally.
- For verses where a stratum is thin (genealogies, greetings), say so honestly inside the reading rather than forcing depth.
- refs use canonical book names ("John 1:1", "1 Corinthians 13:4-8").
- Calm scholarly tone. No exclamations. No emoji.
- Return ONLY the JSON object.`;

function swordJumpRef(onJumpRef, ref) {
  if (typeof onJumpRef === "function") return onJumpRef(ref);
  if (typeof window.codexJumpToRef === "function") return window.codexJumpToRef(ref);
}

// The stratum palette — one hue per depth, surface→marrow. Shared by the
// blade canvas and the cards so hover-sync reads instantly.
const SWORD_HUES = ["#7ee0ff", "#9bd66b", "#e8b465", "#b88cff"];

function VerseSword({ verse, refStr, verseText, passage, primary, onClose, onJumpRef }) {
  const I = window.CODEX_INTEL;
  const key = `codex.swords.${passage.bookId}.${passage.chapter}.${verse?.n}`;
  const [data, setData] = useState(() => {
    try {const raw = localStorage.getItem(key);if (raw) return JSON.parse(raw);}
    catch {}
    return null;
  });
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(!data);

  useEffect(() => {
    if (data) return;
    let cancelled = false;
    (async () => {
      try {
        const obj = await I.intelAI({
          system: SWORD_PROMPT,
          user: `Verse: ${refStr}\nText: ${verseText}\n\nReturn the JSON object.`,
          maxTokens: 3200
        });
        if (cancelled) return;
        obj._schema = SWORD_SCHEMA_V;
        try {localStorage.setItem(key, JSON.stringify(obj));} catch {}
        setData(obj);
        setLoading(false);
        try {
          window.dispatchEvent(new CustomEvent("codex:depth-action", {
            detail: { type: "gnosis-read", ref: refStr, weight: 1, domain: null }
          }));
        } catch {}
      } catch (e) {
        if (cancelled) return;
        setErr(String(e.message || e));
        setLoading(false);
      }
    })();
    return () => {cancelled = true;};
  }, [key, data]);

  useEffect(() => {
    const onKey = (e) => {if (e.key === "Escape") onClose();};
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const reforge = () => {
    try {localStorage.removeItem(key);} catch {}
    setData(null);setErr(null);setLoading(true);
  };

  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-sword-backdrop", onClick: onClose, role: "dialog", "aria-label": "The Sword \u2014 fourfold exegesis console" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-sword", onClick: (e) => e.stopPropagation() }, /*#__PURE__*/
    React.createElement("span", { className: "cx-corner cx-tl" }), /*#__PURE__*/
    React.createElement("span", { className: "cx-corner cx-tr" }), /*#__PURE__*/
    React.createElement("span", { className: "cx-corner cx-bl" }), /*#__PURE__*/
    React.createElement("span", { className: "cx-corner cx-br" }), /*#__PURE__*/

    React.createElement("header", { className: "cx-sword-h" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-sword-h-tag" }, "CODEX \xB7 SWORD"), /*#__PURE__*/
    React.createElement("span", { className: "cx-sword-h-ref" }, refStr),
    data?.theme ? /*#__PURE__*/React.createElement("span", { className: "cx-sword-h-theme" }, "\u2014 ", data.theme) : null,
    data ? /*#__PURE__*/React.createElement("button", { className: "cx-sword-rean", onClick: reforge, title: "Re-forge \u2014 run the fourfold analysis again" }, "\u27F2 RE-FORGE") : null, /*#__PURE__*/
    React.createElement("button", { className: "cx-sword-x", onClick: onClose, "aria-label": "Close", title: "Close (ESC)" }, "\xD7")
    ), /*#__PURE__*/

    React.createElement(IntelBanner, { console: "SWORD", scope: "FOURFOLD EDGE", note: "HEB 4:12 \xB7 TWO TRADITIONS, ONE BLADE \xB7 SURVEY, NOT VERDICT" }),

    loading ? /*#__PURE__*/
    React.createElement("div", { className: "cx-sword-loading" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-sword-loading-blade" }, /*#__PURE__*/React.createElement("i", null)), /*#__PURE__*/
    React.createElement("span", null, "DRAWING \xB7 PESHAT \xB7 REMEZ \xB7 DRASH \xB7 SOD"), /*#__PURE__*/
    React.createElement("span", { className: "cx-sword-loading-sub" }, "setting the edge against ", refStr, " \u2014 two traditions, four strata\u2026"), /*#__PURE__*/
    React.createElement("span", { className: "cx-sword-loading-epigraph" }, "\u201Cpiercing until it divides soul from spirit, joints from marrow\u201D \u2014 Heb 4:12")
    ) :
    err ? /*#__PURE__*/
    React.createElement("div", { className: "cx-sword-err" }, /*#__PURE__*/
    React.createElement("b", null, "THE BLADE IS SHEATHED"), /*#__PURE__*/
    React.createElement("code", null, err),
    /credential|authentic|api key|no .*_api_key|401|403|provider/i.test(err) ? /*#__PURE__*/
    React.createElement("span", { className: "cx-sword-err-hint" }, "Add an AI provider API key in Settings \u2192 AI Model, then reopen the Sword.") :
    null
    ) :
    data ? /*#__PURE__*/
    React.createElement(SwordBody, { data: data, refStr: refStr, verseText: verseText, onJumpRef: onJumpRef }) :
    null
    )
    ));

}

// ── Console body ─────────────────────────────────────────────────────────
function SwordBody({ data, refStr, verseText, onJumpRef }) {
  const [hoverDepth, setHoverDepth] = useState(0); // 0 = none, 1..4
  const strata = Array.isArray(data.strata) ? data.strata.slice(0, 4) : [];

  // LIVE gematria — computed here by the real engine, never by the AI.
  const gematria = useMemo(() => {
    const G = window.CODEX_GEMATRIA;
    const term = data.original?.keyTerm || "";
    if (!G || !term) return null;
    try {
      const v = G.all(term);
      if (!v || !v.lang) return null;
      const pick = v.lang === "hebrew" ?
      [["standard", v.hechrachi], ["ordinal", v.sidduri], ["reduced", v.katan], ["atbash", v.atbash]] :
      v.lang === "greek" ?
      [["isopsephy", v.isopsephy], ["ordinal", v.ordinal], ["reduced", v.reduced]] :
      [];
      return { lang: v.lang, systems: pick.filter(([, n]) => typeof n === "number" && n > 0) };
    } catch {return null;}
  }, [data]);

  const scrollToStratum = (depth) => {
    const el = document.querySelector(`[data-sword-depth="${depth}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("is-flash");
      setTimeout(() => el.classList.remove("is-flash"), 1100);
    }
  };

  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-sword-body" }, /*#__PURE__*/

    React.createElement("blockquote", { className: "cx-sword-verse" }, /*#__PURE__*/
    React.createElement("p", null, verseText), /*#__PURE__*/
    React.createElement("cite", null, refStr)
    ),

    data.original?.text ? /*#__PURE__*/
    React.createElement("div", { className: `cx-sword-orig is-${data.original.lang || "unknown"}` }, /*#__PURE__*/
    React.createElement("span", { className: "cx-sword-orig-text", lang: data.original.lang === "greek" ? "el" : "he", dir: data.original.lang === "greek" ? "ltr" : "rtl" },
    data.original.text
    ),
    data.original.translit ? /*#__PURE__*/React.createElement("span", { className: "cx-sword-orig-translit" }, data.original.translit) : null
    ) :
    null,

    data.edge ? /*#__PURE__*/
    React.createElement("div", { className: "cx-sword-edge" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-sword-edge-tag" }, "THE EDGE"), /*#__PURE__*/
    React.createElement(IntelDecrypt, { text: data.edge, className: "cx-sword-edge-line", as: "span" })
    ) :
    null,

    strata.length === 4 ? /*#__PURE__*/
    React.createElement(SwordBlade, {
      strata: strata,
      hoverDepth: hoverDepth,
      onHover: setHoverDepth,
      onPick: scrollToStratum }
    ) :
    null,

    data.original?.keyTerm ? /*#__PURE__*/
    React.createElement("div", { className: "cx-sword-term" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-sword-term-word", dir: data.original.lang === "greek" ? "ltr" : "rtl" }, data.original.keyTerm), /*#__PURE__*/
    React.createElement("span", { className: "cx-sword-term-meta" }, /*#__PURE__*/
    React.createElement("b", null, data.original.keyTermTranslit),
    data.original.keyTermGloss ? /*#__PURE__*/React.createElement("i", null, " \u2014 ", data.original.keyTermGloss) : null
    ),
    gematria?.systems?.length ? /*#__PURE__*/
    React.createElement("span", { className: "cx-sword-term-gem", title: `Computed locally by the CODEX gematria engine (${gematria.lang})` },
    gematria.systems.map(([sys, n]) => /*#__PURE__*/
    React.createElement("span", { key: sys, className: "cx-sword-gem-chip" }, /*#__PURE__*/React.createElement("b", null, n), /*#__PURE__*/React.createElement("i", null, sys))
    )
    ) :
    null
    ) :
    null, /*#__PURE__*/

    React.createElement("div", { className: "cx-sword-cols", "aria-hidden": "true" }, /*#__PURE__*/
    React.createElement("span", null, "\u05E4\u05E8\u05D3\u05F4\u05E1 \xB7 PARDES"), /*#__PURE__*/
    React.createElement("span", null, "QUADRIGA \xB7 IIII SENSUS")
    ), /*#__PURE__*/

    React.createElement("ol", { className: "cx-sword-strata" },
    strata.map((s, i) => /*#__PURE__*/
    React.createElement(SwordStratum, {
      key: i,
      s: s,
      depth: i + 1,
      hue: SWORD_HUES[i],
      hot: hoverDepth === i + 1,
      onHover: setHoverDepth,
      onJumpRef: onJumpRef }
    )
    )
    ),

    data.caveats?.length ? /*#__PURE__*/
    React.createElement("div", { className: "cx-sword-caveats" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-sword-caveats-tag" }, "CAVEATS"), /*#__PURE__*/
    React.createElement("ul", null, data.caveats.map((c, i) => /*#__PURE__*/React.createElement("li", { key: i }, c)))
    ) :
    null
    ));

}

// ── The blade — canvas strike + cleave ──────────────────────────────────
// One animation, two phases: the edge sweeps across (the strike), then the
// four strata shear apart from the cut line, each drifting to its resting
// depth with its names burning in. After the cleave it renders statically,
// re-drawing only on hover/resize. Reduced motion: straight to final frame.
function SwordBlade({ strata, hoverDepth, onHover, onPick }) {
  const I = window.CODEX_INTEL;
  const canvasRef = useRef(null);
  const bandsRef = useRef([]); // [{depth, y0, y1}] for hit-testing
  const animRef = useRef({ done: I.intelReducedMotion(), start: 0, raf: 0 });

  const draw = (p) => {
    // p: 0→1 strike, 1→2 cleave; ≥2 = final
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { w, h } = I.intelCanvas.fit(canvas);
    ctx.clearRect(0, 0, w, h);
    const midY = 26;
    const strike = Math.min(1, p);
    const cleave = Math.max(0, Math.min(1, p - 1));
    const ease = (t) => 1 - Math.pow(1 - t, 3);

    // The edge — a single gleaming line sweeping across.
    const edgeX = 8 + ease(strike) * (w - 16);
    ctx.save();
    ctx.strokeStyle = "#eaf6ff";
    ctx.shadowColor = "#7ee0ff";
    ctx.shadowBlur = 12;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(8, midY);
    ctx.lineTo(edgeX, midY);
    ctx.stroke();
    if (strike < 1) {
      // the moving point of the blade
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 18;
      ctx.beginPath();ctx.arc(edgeX, midY, 2.4, 0, Math.PI * 2);ctx.fill();
    }
    ctx.restore();

    // The strata — four bands shearing downward from the cut.
    const bandH = Math.max(18, (h - midY - 14) / 4 - 6);
    const bands = [];
    const e = ease(cleave);
    for (let i = 0; i < 4; i++) {
      const s = strata[i] || {};
      const hue = SWORD_HUES[i];
      const restY = midY + 10 + i * (bandH + 6);
      const y = midY + (restY - midY) * e;
      const isHot = hoverDepth === i + 1;
      const alpha = cleave <= 0 ? 0 : isHot ? 0.95 : hoverDepth ? 0.35 : 0.8;
      if (alpha > 0) {
        ctx.save();
        ctx.globalAlpha = alpha * 0.14;
        ctx.fillStyle = hue;
        ctx.fillRect(10, y, w - 20, bandH);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = hue;
        ctx.lineWidth = isHot ? 1.4 : 0.8;
        ctx.shadowColor = hue;
        ctx.shadowBlur = isHot ? 9 : 4;
        ctx.strokeRect(10, y, w - 20, bandH);
        // names — PaRDeS at left, Quadriga at right, depth rune centered
        ctx.shadowBlur = 0;
        ctx.fillStyle = hue;
        ctx.font = "600 10px ui-monospace, monospace";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(`${s.pardesName || ""} · ${s.pardesGloss || ""}`.toUpperCase(), 20, y + bandH / 2);
        ctx.textAlign = "right";
        ctx.fillText(`${s.quadrigaName || ""} · ${s.quadrigaGloss || ""}`.toUpperCase(), w - 20, y + bandH / 2);
        ctx.textAlign = "center";
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillText("│".repeat(i + 1), w / 2, y + bandH / 2);
        ctx.restore();
      }
      bands.push({ depth: i + 1, y0: y, y1: y + bandH });
    }
    bandsRef.current = cleave >= 1 ? bands : [];
  };

  useEffect(() => {
    const anim = animRef.current;
    if (anim.done) {draw(2);return;}
    let cancelled = false;
    const DUR = 1500; // 500ms strike + 1000ms cleave
    const step = (ts) => {
      if (cancelled) return;
      if (!anim.start) anim.start = ts;
      const t = (ts - anim.start) / DUR;
      const p = t < 1 / 3 ? t * 3 : 1 + (t - 1 / 3) / (2 / 3);
      draw(Math.min(2, p));
      if (t < 1) anim.raf = requestAnimationFrame(step);else
      {anim.done = true;draw(2);}
    };
    anim.raf = requestAnimationFrame(step);
    return () => {cancelled = true;cancelAnimationFrame(anim.raf);};
  }, [strata]);

  useEffect(() => {if (animRef.current.done) draw(2);}, [hoverDepth]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {if (animRef.current.done) draw(2);});
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [strata, hoverDepth]);

  const hit = (evt) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const my = evt.clientY - rect.top;
    return bandsRef.current.find((b) => my >= b.y0 && my <= b.y1) || null;
  };

  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-sword-blade" }, /*#__PURE__*/
    React.createElement("canvas", {
      ref: canvasRef,
      className: "cx-sword-canvas",
      style: { cursor: hoverDepth ? "pointer" : "default" },
      onMouseMove: (e) => onHover(hit(e)?.depth || 0),
      onMouseLeave: () => onHover(0),
      onClick: (e) => {const b = hit(e);if (b) onPick(b.depth);},
      role: "img",
      "aria-label": "The blade \u2014 four exegetical strata cleaved from the verse" }
    )
    ));

}

// ── One stratum — the paired reading card ────────────────────────────────
function SwordStratum({ s, depth, hue, hot, onHover, onJumpRef }) {
  return (/*#__PURE__*/
    React.createElement("li", {
      className: `cx-sword-stratum ${hot ? "is-hot" : ""}`,
      "data-sword-depth": depth,
      style: { "--sw-hue": hue },
      onMouseEnter: () => onHover(depth),
      onMouseLeave: () => onHover(0) }, /*#__PURE__*/

    React.createElement("header", { className: "cx-sword-stratum-h" }, /*#__PURE__*/
    React.createElement(IntelStamp, { code: `S-${depth}`, tone: "dim" }), /*#__PURE__*/
    React.createElement("span", { className: "cx-sword-stratum-depth", "aria-hidden": "true" }, "│".repeat(depth))
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-sword-pair" }, /*#__PURE__*/
    React.createElement("article", { className: "cx-sword-read is-pardes" }, /*#__PURE__*/
    React.createElement("h4", null, s.pardesName, " ", /*#__PURE__*/React.createElement("i", null, "\xB7 ", s.pardesGloss)), /*#__PURE__*/
    React.createElement("p", null, s.pardes),
    s.voicesPardes ? /*#__PURE__*/React.createElement("small", null, s.voicesPardes) : null
    ), /*#__PURE__*/
    React.createElement("article", { className: "cx-sword-read is-quadriga" }, /*#__PURE__*/
    React.createElement("h4", null, s.quadrigaName, " ", /*#__PURE__*/React.createElement("i", null, "\xB7 ", s.quadrigaGloss)), /*#__PURE__*/
    React.createElement("p", null, s.quadriga),
    s.voicesQuadriga ? /*#__PURE__*/React.createElement("small", null, s.voicesQuadriga) : null
    )
    ),
    s.converge || s.refs && s.refs.length ? /*#__PURE__*/
    React.createElement("footer", { className: "cx-sword-stratum-f" },
    s.converge ? /*#__PURE__*/React.createElement("span", { className: "cx-sword-converge" }, "\u27E1 ", s.converge) : null,
    Array.isArray(s.refs) ? s.refs.slice(0, 3).map((r, i) => /*#__PURE__*/
    React.createElement("button", {
      key: i,
      className: "cx-sword-ref",
      onClick: () => swordJumpRef(onJumpRef, r.ref),
      title: `Jump to ${r.ref}` }, /*#__PURE__*/
    React.createElement("b", null, r.ref), r.note ? /*#__PURE__*/React.createElement("span", null, " ", r.note) : null)
    ) : null
    ) :
    null
    ));

}

Object.assign(window, { VerseSword });
})();
