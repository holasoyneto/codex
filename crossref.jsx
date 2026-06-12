// crossref.jsx
// CODEX — Treasury of Scripture Knowledge cross-references · THE THREAD WEB.
//
// EXOGRAMMAR verdict: REMAKE. The TSK data is a graph; the old panel rendered
// it as a concordance-habit list. This is the ego-graph instrument:
//
//   · CENTER — the current verse is the central node (serif label). Its
//     cross-references orbit on a canvas, ring-ordered by canonical order
//     (TSK carries no votes/weights; if a module ever does, distance becomes
//     ∝ 1/strength — wired below). Node color speaks covenant: OT cyan
//     #7ee0ff / NT amber #e8b465; an edge that crosses the testament seam
//     burns gold #ffd479. Theme-bearing modules color by theme instead.
//   · ONE GESTURE DEEP — click an orbit node and it BECOMES the center;
//     the walked trail renders as a clickable breadcrumb under the canvas
//     (the chain machinery is the panel's soul). Double-click jumps the
//     reader (codexGoto / codexJumpToRef). Hover brightens the edge and
//     fills a readout (ref · theme · snippet · the compare affordance).
//   · THE TEXT IS THE ZOOM-IN — tap the center node (or the ¶ chip) and the
//     center verse's prose unfolds beneath the canvas via BIBLE.loadChapter.
//     Prose is summoned, never ambient (law 3).
//   · Physics stay light: static radial layout, one 300ms eased re-layout on
//     re-center, no continuous simulation. DPR-aware, ResizeObserver,
//     pointer hit-testing, prefers-reduced-motion → snap. A compact
//     visually-hidden (focus-revealed) list of real buttons mirrors the
//     graph for keyboards/readers.
//
// Exports (unchanged contract):
//   window.CODEX_CrossRefPanel   — React component (panel host)
//   window.CODEX_CrossRefLookup  — { getCrossRefs(verseRef), formatRef, parseVerseKey }
//   plugin id "crossrefs-tsk", panel id "crossrefs" (→ plugin:crossrefs-tsk:crossrefs)
//
// External events keep working:
//   · codex:xref-jump {key} — still recenters this graph (and the app host
//     still navigates the reader + pushes its thread; app.jsx untouched).
//   · codex:xref-back — pops the walked chain.
//   · codex:xref-thread — still broadcast by the host (app.jsx) untouched.
//   In-panel single-click recenters LOCALLY (the graph walks, the reader
//   stays put — reading is the deliberate double-click), so the panel owns
//   the walked trail; external dispatches still land on it via the bus.
//
// Automation hooks (the codexConstInspect pattern):
//   window.codexXrefCenter(ref)  — programmatic re-center ("gen.1.1" or "Genesis 1:1")
//   window.codexXrefState()      — { center, chain, count, nodes:[{key,x,y}] }

(function () {
  if (typeof window === "undefined") return;
  const { useState, useEffect, useMemo, useCallback, useRef } = React;

  const MODULE_ID = "tsk-sample";

  // The app's covenant language (mirrors the Galaxy).
  const OT_C = "#7ee0ff";   // OT — cyan
  const NT_C = "#e8b465";   // NT — amber
  const SEAM_C = "#ffd479"; // the seam — gold, for edges that cross covenants
  const SERIF_FONT = 'Georgia, "Iowan Old Style", "Times New Roman", serif';
  const MONO_FONT = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

  // ── Module cache shared across panel mounts ───────────────────────────
  let _modPromise = null;
  function loadTsk() {
    if (_modPromise) return _modPromise;
    if (!window.CODEX_MODULES || typeof window.CODEX_MODULES.loadModule !== "function") {
      return Promise.reject(new Error("CODEX_MODULES not available"));
    }
    _modPromise = window.CODEX_MODULES.loadModule(MODULE_ID).catch((e) => {
      _modPromise = null;
      throw e;
    });
    return _modPromise;
  }

  // ── Book id ↔ display name helpers ────────────────────────────────────
  function booksList() {
    return (window.CODEX_DATA && window.CODEX_DATA.books) || [];
  }
  function bookName(bookId) {
    const b = booksList().find((x) => x.id === bookId);
    return b ? b.name : bookId;
  }
  // Canonical index + testament for a book id.
  function bookMeta(bookId) {
    const books = booksList();
    const i = books.findIndex((b) => b.id === bookId);
    return { index: i, testament: i >= 0 ? books[i].testament : null };
  }

  // Parse "jhn.3.16" → { bookId:"jhn", chapter:3, verse:16 }
  function parseVerseKey(key) {
    if (!key || typeof key !== "string") return null;
    const parts = key.split(".");
    if (parts.length < 2) return null;
    const bookId = parts[0].toLowerCase();
    const chapter = parseInt(parts[1], 10);
    const verse = parts[2] ? parseInt(parts[2], 10) : null;
    if (!bookId || !Number.isFinite(chapter)) return null;
    return { bookId, chapter, verse };
  }

  // Build "Book C:V" display string from key.
  function formatRef(key) {
    const p = parseVerseKey(key);
    if (!p) return key;
    return `${bookName(p.bookId)} ${p.chapter}${p.verse ? ":" + p.verse : ""}`;
  }

  // Compact mono label for orbit nodes: "GEN 1:1".
  function shortRef(key) {
    const p = parseVerseKey(key);
    if (!p) return key;
    return `${p.bookId.toUpperCase()} ${p.chapter}${p.verse ? ":" + p.verse : ""}`;
  }

  // Accept a verse key ("gen.1.1") OR a human ref ("Genesis 1:1") → key.
  function normalizeKey(ref) {
    if (!ref) return null;
    const s = String(ref).trim();
    if (/^[0-9a-z]{2,3}\.\d+(\.\d+)?$/i.test(s)) return s.toLowerCase();
    const m = s.match(/^(.+?)\s+(\d+)(?:[:.](\d+))?$/);
    if (!m) return null;
    const nm = m[1].trim().toLowerCase();
    const b = booksList().find((x) => x.name.toLowerCase() === nm || x.id === nm);
    if (!b) return null;
    return `${b.id}.${m[2]}${m[3] ? "." + m[3] : ""}`;
  }

  // Lookup helper: Returns a Promise<[{ref,theme}|string]>.
  function getCrossRefs(verseRef) {
    return loadTsk().then((mod) => {
      if (!mod || !mod.verses) return [];
      const key =
        typeof verseRef === "string"
          ? verseRef.toLowerCase()
          : verseRef && verseRef.bookId
            ? `${verseRef.bookId}.${verseRef.chapter}.${verseRef.verse || ""}`.replace(/\.$/, "")
            : "";
      return mod.verses[key] || [];
    });
  }

  window.CODEX_CrossRefLookup = { getCrossRefs, formatRef, parseVerseKey };

  // ── Verse snippet — pull from window.BIBLE cache if available ─────────
  // (bible.js caches chapters as a bare verses ARRAY [{n,text}]; older code
  // expected {verses:[…]} — support both shapes.)
  function chapterVerses(ch) {
    if (Array.isArray(ch)) return ch;
    if (ch && Array.isArray(ch.verses)) return ch.verses;
    return [];
  }
  function snippetFor(key, translation) {
    try {
      const p = parseVerseKey(key);
      if (!p || !window.BIBLE || typeof window.BIBLE.getCachedChapter !== "function") return null;
      const tr = translation || "kjv";
      const ch = window.BIBLE.getCachedChapter(p.bookId, p.chapter, tr);
      const v = chapterVerses(ch).find((x) => x && x.n === (p.verse || 1));
      if (!v) return null;
      const text = v[tr] || v.text || "";
      return text ? String(text).trim() : null;
    } catch {
      return null;
    }
  }

  // ── Depth-action emit (frozen contract: crossref-follow w1 / chain w5) ─
  function emitDepth(type, ref, weight) {
    try {
      const E = window.CODEX_ENGAGEMENT;
      if (E && typeof E.emit === "function") { E.emit(type, ref || null, weight, "cross-references"); return; }
      if (typeof window.CustomEvent === "function") {
        window.dispatchEvent(new CustomEvent("codex:depth-action", {
          detail: { type, ref: ref || null, weight, domain: "cross-references" },
        }));
      }
    } catch (e) {}
  }

  // ── Optional AI "resonance" — silent degrade when no key is set ───────
  function hasAiKey() {
    try {
      const k = JSON.parse(localStorage.getItem("codex.api.keys.v1") || "null") || {};
      if (k.active === "ollama") return true; // local, keyless
      if (k.anthropic || k.grok || k.groq || k.gemini) return true;
    } catch (e) {}
    try { if (localStorage.getItem("codex.anthropic.key")) return true; } catch (e) {}
    const t = (window.CODEX_DATA && window.CODEX_DATA.tweaks) || {};
    return !!(t.provider || t.model);
  }

  function getActiveEngine() { return window.CODEX_INTEL.intelEngine(); }

  const RESONANCE_PROMPT =
    "You are a calm, scholarly study aide. In ONE or TWO sentences (under 45 words, no preamble, " +
    "no quotation marks), name the thematic thread that links these two scripture references. " +
    "Be specific and neutral; cite the shared motif, not a sermon.";

  function fetchResonance(sourceKey, targetKey, translation) {
    const eng = getActiveEngine();
    const model = eng.model || "claude-haiku-4-5-20251001";
    const cacheKey = "codex.xref.resonance." + sourceKey + "|" + targetKey + "|" + (eng.provider || "") + "|" + model;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached != null) return Promise.resolve(cached || null);
    } catch (e) {}
    const srcRef = formatRef(sourceKey), tgtRef = formatRef(targetKey);
    const srcText = snippetFor(sourceKey, translation) || "";
    const tgtText = snippetFor(targetKey, translation) || "";
    return fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: eng.provider,
        model,
        system: RESONANCE_PROMPT,
        messages: [{
          role: "user",
          content: `A: ${srcRef}${srcText ? " — " + srcText : ""}\nB: ${tgtRef}${tgtText ? " — " + tgtText : ""}\n\nName the link.`,
        }],
        max_tokens: 120,
      }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((body) => {
        const text = body && typeof body.text === "string" ? body.text.trim() : "";
        const out = text ? text.replace(/^["“]|["”]$/g, "").trim() : "";
        try { localStorage.setItem(cacheKey, out); } catch (e) {}
        return out || null;
      })
      .catch(() => null);
  }

  // ── Color helpers ──────────────────────────────────────────────────────
  function rgba(hex, a) {
    const h = String(hex || "#7ee0ff").replace("#", "");
    const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(f, 16);
    if (!Number.isFinite(n)) return `rgba(126,224,255,${a})`;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  // Stable theme → color (the sample TSK module carried {ref,theme} rows;
  // the full corpus is bare strings — covenant colors then).
  const THEME_HUES = ["#7ee0ff", "#e8b465", "#b3a4ff", "#8fe6b8", "#ff9db1", "#ffd479", "#9ad0ff", "#e0c3fc"];
  function themeColor(theme) {
    let h = 0;
    const s = String(theme);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return THEME_HUES[h % THEME_HUES.length];
  }
  function cssFg() {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--cx-fg").trim();
      return v || "#dfe7ec";
    } catch { return "#dfe7ec"; }
  }

  // ── The canvas instrument ──────────────────────────────────────────────
  // Static radial ego-graph. All hot state lives in refs; React only feeds
  // it nodes + center and receives gestures back.
  function XrefGraph({ nodes, centerKey, centerLabel, centerColor, probeRef,
                       onRecenter, onReaderJump, onCenterTap, onHoverNode }) {
    const wrapRef = useRef(null);
    const canvasRef = useRef(null);
    const engineRef = useRef(null);
    const clickT = useRef(0);

    // Latest props readable from the imperative engine.
    const nodesRef = useRef(nodes); nodesRef.current = nodes;
    const centerRef = useRef(null);
    centerRef.current = { key: centerKey, label: centerLabel, color: centerColor };
    const cbRef = useRef(null);
    cbRef.current = { onRecenter, onReaderJump, onCenterTap, onHoverNode };

    useEffect(() => {
      const canvas = canvasRef.current, wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const ctx2 = canvas.getContext("2d");
      const st = { w: 0, h: 0, dpr: 1, cx: 0, cy: 0, pos: {}, targets: {}, from: {}, t0: 0, raf: 0, hover: null };

      const reduced = () => {
        try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
        catch { return false; }
      };

      // Ring-ordered radial layout (canonical order). If a module carries
      // per-ref strength (votes/weights), distance becomes ∝ 1/strength.
      function computeTargets() {
        const cx = st.w / 2, cy = st.h / 2;
        const list = nodesRef.current;
        const n = list.length;
        const maxR = Math.max(40, Math.min(st.w, st.h) / 2 - 30);
        const targets = {};
        const hasStrength = list.some((nd) => Number.isFinite(nd.strength));
        const maxS = hasStrength ? Math.max(1, ...list.map((nd) => nd.strength || 1)) : 1;
        list.forEach((nd, i) => {
          const a = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2;
          let r;
          if (hasStrength) {
            const s = Math.max(0, Math.min(1, (nd.strength || 1) / maxS));
            r = maxR * (1 - 0.55 * s); // strong link = close orbit
          } else {
            // gentle 3-step radius stagger keeps crowded rings legible
            r = n <= 16 ? maxR * 0.82 : maxR * (0.68 + 0.16 * (i % 3) / 2);
          }
          targets[nd.key] = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
        });
        return { targets, cx, cy };
      }

      function draw() {
        ctx2.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
        ctx2.clearRect(0, 0, st.w, st.h);
        const list = nodesRef.current;
        const C = centerRef.current;
        const many = list.length > 24;
        // edges first
        list.forEach((nd) => {
          const p = st.pos[nd.key]; if (!p) return;
          const hov = st.hover === nd.key;
          ctx2.strokeStyle = rgba(nd.seam ? SEAM_C : nd.color, hov ? 0.9 : 0.26);
          ctx2.lineWidth = hov ? 1.6 : 1;
          ctx2.beginPath(); ctx2.moveTo(st.cx, st.cy); ctx2.lineTo(p.x, p.y); ctx2.stroke();
        });
        // orbit nodes + labels
        list.forEach((nd) => {
          const p = st.pos[nd.key]; if (!p) return;
          const hov = st.hover === nd.key;
          ctx2.beginPath(); ctx2.arc(p.x, p.y, hov ? 6 : 4.2, 0, Math.PI * 2);
          ctx2.fillStyle = rgba(nd.color, hov ? 1 : 0.92);
          ctx2.fill();
          if (!many || hov) {
            ctx2.font = (hov ? "600 " : "") + "8.5px " + MONO_FONT;
            const dx = p.x - st.cx, dy = p.y - st.cy, dl = Math.hypot(dx, dy) || 1;
            ctx2.textAlign = Math.abs(dx) < dl * 0.35 ? "center" : (dx > 0 ? "left" : "right");
            ctx2.textBaseline = dy > dl * 0.35 ? "top" : (dy < -dl * 0.35 ? "bottom" : "middle");
            ctx2.fillStyle = rgba(nd.color, hov ? 1 : 0.7);
            ctx2.fillText(nd.label, p.x + (dx / dl) * 9, p.y + (dy / dl) * 9);
          }
        });
        // the center — current verse, serif label (law 7: the Word is serif)
        ctx2.beginPath(); ctx2.arc(st.cx, st.cy, 8, 0, Math.PI * 2);
        ctx2.fillStyle = C.color; ctx2.fill();
        ctx2.beginPath(); ctx2.arc(st.cx, st.cy, 11.5, 0, Math.PI * 2);
        ctx2.strokeStyle = rgba(C.color, 0.45); ctx2.lineWidth = 1; ctx2.stroke();
        ctx2.font = "600 13px " + SERIF_FONT;
        ctx2.textAlign = "center"; ctx2.textBaseline = "top";
        ctx2.fillStyle = cssFg();
        ctx2.fillText(C.label, st.cx, st.cy + 16);
      }

      function layout(immediate) {
        const { targets, cx, cy } = computeTargets();
        st.cx = cx; st.cy = cy; st.targets = targets;
        if (probeRef) probeRef.current = { pos: targets, cx, cy };
        cancelAnimationFrame(st.raf);
        if (immediate || reduced()) { st.pos = Object.assign({}, targets); draw(); return; }
        st.from = {};
        Object.keys(targets).forEach((k) => { st.from[k] = st.pos[k] || { x: cx, y: cy }; });
        st.t0 = performance.now();
        const tick = () => {
          const t = Math.min(1, (performance.now() - st.t0) / 300);
          const e = 1 - Math.pow(1 - t, 3); // easeOutCubic
          const pos = {};
          Object.keys(st.targets).forEach((k) => {
            const a = st.from[k], b = st.targets[k];
            pos[k] = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
          });
          st.pos = pos; draw();
          if (t < 1) st.raf = requestAnimationFrame(tick);
        };
        st.raf = requestAnimationFrame(tick);
      }

      function resize() {
        const r = wrap.getBoundingClientRect();
        st.w = Math.max(80, r.width); st.h = Math.max(80, r.height);
        st.dpr = Math.min(3, window.devicePixelRatio || 1);
        canvas.width = Math.round(st.w * st.dpr);
        canvas.height = Math.round(st.h * st.dpr);
        layout(true);
      }

      function hit(mx, my) {
        let best = null, bd = 13;
        nodesRef.current.forEach((nd) => {
          const p = st.pos[nd.key]; if (!p) return;
          const d = Math.hypot(mx - p.x, my - p.y);
          if (d < bd) { bd = d; best = nd; }
        });
        if (best) return { node: best };
        if (Math.hypot(mx - st.cx, my - st.cy) < 16) return { center: true };
        return null;
      }

      engineRef.current = { layout, draw, hit, st };
      const ro = new ResizeObserver(() => resize());
      ro.observe(wrap);
      resize();
      return () => {
        ro.disconnect();
        cancelAnimationFrame(st.raf);
        engineRef.current = null;
      };
    }, []);

    // Re-layout (eased) when the node set or the center changes.
    const sig = useMemo(
      () => centerKey + "::" + nodes.map((n) => n.key).join("|"),
      [nodes, centerKey]
    );
    useEffect(() => {
      if (engineRef.current) engineRef.current.layout(false);
    }, [sig]);

    const evPos = (e) => {
      const r = canvasRef.current.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const handleMove = (e) => {
      const eng = engineRef.current; if (!eng) return;
      const { x, y } = evPos(e);
      const h = eng.hit(x, y);
      const key = h && h.node ? h.node.key : null;
      canvasRef.current.style.cursor = h ? "pointer" : "";
      if (key !== eng.st.hover) {
        eng.st.hover = key;
        eng.draw();
        if (key) cbRef.current.onHoverNode(key);
      }
    };
    const handleLeave = () => {
      const eng = engineRef.current; if (!eng) return;
      if (eng.st.hover) { eng.st.hover = null; eng.draw(); }
    };
    // click = recenter (or center-tap → text); double-click = open in reader.
    // Double detection is self-reliant (two clicks on the same target within
    // 350ms, or a native detail>=2): headless Chrome and most touch browsers
    // never synthesize `dblclick`, so we don't depend on it.
    const lastClick = useRef({ t: 0, key: null });
    const handleClick = (e) => {
      const eng = engineRef.current; if (!eng) return;
      const { x, y } = evPos(e);
      const h = eng.hit(x, y);
      const now = performance.now();
      const key = h ? (h.center ? "__center__" : h.node.key) : null;
      const isDbl = !!key && (e.detail >= 2 ||
        (key === lastClick.current.key && now - lastClick.current.t < 350));
      lastClick.current = { t: now, key };
      if (clickT.current) { clearTimeout(clickT.current); clickT.current = 0; }
      if (!h) return;
      if (isDbl) {
        if (h.node) cbRef.current.onReaderJump(h.node.key);
        else cbRef.current.onCenterTap();
        return;
      }
      clickT.current = setTimeout(() => {
        clickT.current = 0;
        if (h.center) cbRef.current.onCenterTap();
        else cbRef.current.onRecenter(h.node.key);
      }, 280);
    };

    return (
      <div ref={wrapRef} className="cx-xrefg-stage">
        <canvas
          ref={canvasRef}
          className="cx-xrefg-canvas"
          onPointerMove={handleMove}
          onPointerLeave={handleLeave}
          onClick={handleClick}
          aria-hidden="true"
        />
      </div>
    );
  }

  // ── The panel component ───────────────────────────────────────────────
  function CrossRefPanel({ book, bookId, chapter, verse, translation }) {
    const [mod, setMod] = useState(null);
    const [err, setErr] = useState(null);
    const [loading, setLoading] = useState(true);

    // Thread-web styles — self-injected (one tag, idempotent) instead of
    // styles.css because a parallel build owns that file right now.
    // TODO: fold into styles.css at the next quiet moment.
    useEffect(() => {
      if (document.getElementById("cx-xref-graph-css")) return;
      const el = document.createElement("style");
      el.id = "cx-xref-graph-css";
      el.textContent = `
        .cx-xrefg { padding: 8px 10px 12px; color: var(--cx-fg, #c9d4dc); font-family: var(--cx-font-ui, ui-sans-serif, system-ui); font-size: 12px; line-height: 1.5; }
        .cx-xrefg-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; padding-bottom: 6px; border-bottom: 1px solid var(--cx-rule, rgba(126,224,255,0.16)); }
        .cx-xrefg-counts { font-family: var(--cx-font-mono, ui-monospace, monospace); font-size: 9.5px; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.72; }
        .cx-xrefg-stage { position: relative; width: 100%; height: 264px; }
        @media (max-width: 880px) { .cx-xrefg-stage { height: 200px; } }
        .cx-xrefg-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: pan-y pinch-zoom; }
        .cx-xrefg-trail { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; margin: 6px 0 2px; }
        .cx-xrefg-chip { background: transparent; border: 1px solid var(--cx-rule, rgba(126,224,255,0.22)); color: var(--cx-fg, #c9d4dc); font-family: var(--cx-font-mono, ui-monospace, monospace); font-size: 9.5px; letter-spacing: 0.06em; padding: 1px 7px; border-radius: 9px; cursor: pointer; line-height: 1.6; }
        .cx-xrefg-chip[aria-pressed="true"] { color: var(--cx-accent, #7ee0ff); border-color: var(--cx-accent, #7ee0ff); }
        .cx-xrefg-crumb.is-current { color: var(--cx-accent, #7ee0ff); border-color: var(--cx-accent, #7ee0ff); cursor: default; }
        .cx-xrefg-crumb-sep { opacity: 0.45; font-size: 9px; }
        .cx-xrefg-text { margin: 8px 2px 2px; font-family: var(--cx-serif, ${SERIF_FONT}); font-size: 13.5px; line-height: 1.62; }
        .cx-xrefg-text sup { font-family: var(--cx-font-mono, ui-monospace, monospace); font-size: 8.5px; color: var(--cx-accent, #7ee0ff); margin-right: 5px; opacity: 0.8; }
        .cx-xrefg-readout { margin-top: 8px; padding-top: 6px; border-top: 1px dotted var(--cx-rule, rgba(126,224,255,0.18)); min-height: 30px; }
        .cx-xrefg-ro-line { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .cx-xrefg-ro-ref { font-family: var(--cx-font-mono, ui-monospace, monospace); font-weight: 600; font-size: 11px; }
        .cx-xrefg-ro-theme { font-family: var(--cx-font-mono, ui-monospace, monospace); font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.75; }
        .cx-xrefg-ro-snip { margin-top: 3px; font-style: italic; font-size: 12px; opacity: 0.85; }
        .cx-xrefg-hint { opacity: 0.5; font-size: 10.5px; letter-spacing: 0.03em; }
        /* keyboard mirror of the graph — visually hidden, revealed on focus */
        .cx-xrefg-alist { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; margin: 0; padding: 0; list-style: none; }
        .cx-xrefg-alist:focus-within { position: static; width: auto; height: auto; clip-path: none; white-space: normal; display: flex; flex-wrap: wrap; gap: 4px; padding: 6px 0 0; max-height: 120px; overflow-y: auto; }
        .cx-xrefg-alist li { display: inline-block; }
        .cx-xrefg-foot { margin-top: 10px; padding-top: 6px; border-top: 1px solid var(--cx-rule, rgba(126,224,255,0.12)); font-family: var(--cx-font-mono, ui-monospace, monospace); font-size: 9px; opacity: 0.55; letter-spacing: 0.05em; display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
      `;
      document.head.appendChild(el);
    }, []);

    // The host verse key — the web's base when no chain has been walked.
    const hostKey = `${bookId}.${chapter}.${verse || 1}`;

    // The walked chain (the panel's soul). The panel owns it: single-click
    // recenters the graph WITHOUT dragging the reader along (reading is the
    // deliberate double-click). External codex:xref-jump/back still land
    // here so other surfaces keep working unchanged.
    const [chain, setChain] = useState([]);
    const currentKey = chain.length ? chain[chain.length - 1] : hostKey;

    const chainRef = useRef(chain); chainRef.current = chain;
    const currentKeyRef = useRef(currentKey); currentKeyRef.current = currentKey;

    const pushChain = useCallback((key) => {
      setChain((c) => (c.length && c[c.length - 1] === key) ? c : [...c, key]);
    }, []);

    // Recenter = the primary gesture. Emits the frozen depth contract.
    const recenter = useCallback((key) => {
      const k = String(key || "").toLowerCase();
      if (!k || k === currentKeyRef.current) return;
      const hops = chainRef.current.length + 1;
      if (hops >= 3) emitDepth("crossref-chain", k, 5);
      else emitDepth("crossref-follow", k, 1);
      pushChain(k);
    }, [pushChain]);

    // External bus — keep the canonical events working (app.jsx untouched:
    // it still navigates + pushes its thread on codex:xref-jump and
    // re-broadcasts codex:xref-thread; here the graph follows along).
    useEffect(() => {
      const onJump = (e) => {
        const k = e && e.detail && e.detail.key;
        if (k) pushChain(String(k).toLowerCase());
      };
      const onBack = () => setChain((c) => c.slice(0, -1));
      window.addEventListener("codex:xref-jump", onJump);
      window.addEventListener("codex:xref-back", onBack);
      return () => {
        window.removeEventListener("codex:xref-jump", onJump);
        window.removeEventListener("codex:xref-back", onBack);
      };
    }, [pushChain]);

    // Double-click → jump the reader (prose is deliberate, law 3/4).
    const openInReader = useCallback((key) => {
      const p = parseVerseKey(key);
      if (!p) return;
      try {
        if (typeof window.codexGoto === "function") window.codexGoto(p.bookId, p.chapter, p.verse || 1);
        else if (typeof window.codexJumpToRef === "function") window.codexJumpToRef(formatRef(key));
      } catch (e) {}
    }, []);

    // Module load
    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      loadTsk().then(
        (m) => { if (!cancelled) { setMod(m); setLoading(false); } },
        (e) => { if (!cancelled) { setErr(e.message || String(e)); setLoading(false); } }
      );
      return () => { cancelled = true; };
    }, []);

    // Refs for the current center (chapter fallback preserved from v1).
    const refs = useMemo(() => {
      if (!mod || !mod.verses) return [];
      const direct = mod.verses[currentKey] || [];
      if (direct.length) return direct;
      const p = parseVerseKey(currentKey);
      if (!p) return [];
      const sameChapter = Object.keys(mod.verses)
        .filter((k) => k.startsWith(`${p.bookId}.${p.chapter}.`));
      return sameChapter.length === 1 ? mod.verses[sameChapter[0]] : [];
    }, [mod, currentKey]);

    // Normalise: full TSK stores plain strings; the earlier sample stored
    // objects { ref, theme }. Support both, dedupe, sort canonically.
    const normRefs = useMemo(() => {
      return refs.map((r) => (typeof r === "string" ? { ref: r } : r));
    }, [refs]);

    const centerP = parseVerseKey(currentKey);
    const centerMeta = bookMeta(centerP ? centerP.bookId : "");
    const centerColor = centerMeta.testament === "NT" ? NT_C : OT_C;

    const nodes = useMemo(() => {
      const seen = new Set();
      const out = [];
      normRefs.forEach((r) => {
        const key = String(r.ref || "").toLowerCase();
        if (!key || seen.has(key) || key === currentKey) return;
        const p = parseVerseKey(key);
        if (!p) return;
        seen.add(key);
        const m = bookMeta(p.bookId);
        const theme = r.theme || null;
        out.push({
          key,
          theme,
          note: r.note || null,
          testament: m.testament,
          seam: !!(m.testament && centerMeta.testament && m.testament !== centerMeta.testament),
          strength: Number.isFinite(r.votes) ? r.votes : (Number.isFinite(r.w) ? r.w : null),
          color: theme ? themeColor(theme) : (m.testament === "NT" ? NT_C : OT_C),
          label: shortRef(key),
          order: (m.index < 0 ? 999 : m.index) * 1e6 + p.chapter * 1e3 + (p.verse || 0),
        });
      });
      out.sort((a, b) => a.order - b.order);
      return out;
    }, [normRefs, currentKey, centerMeta.testament]);
    const nodesRef = useRef(nodes); nodesRef.current = nodes;

    // Hover readout — sticky (survives pointer leaving the canvas) so the
    // compare affordance is reachable. Cleared on recenter.
    const [focusKey, setFocusKey] = useState(null);
    const [expandedCompareKey, setExpandedCompareKey] = useState(null);
    const [resonance, setResonance] = useState({}); // targetKey -> string|null
    const aiEnabled = useMemo(() => hasAiKey(), [mod]);
    useEffect(() => { setFocusKey(null); setExpandedCompareKey(null); }, [currentKey]);

    const onToggleCompare = useCallback((targetKey) => {
      setExpandedCompareKey((cur) => {
        const next = cur === targetKey ? null : targetKey;
        if (next && aiEnabled && !(targetKey in resonance)) {
          setResonance((r) => ({ ...r, [targetKey]: null }));
          fetchResonance(currentKey, targetKey, translation).then((note) => {
            setResonance((r) => ({ ...r, [targetKey]: note || "" }));
          });
        }
        return next;
      });
    }, [aiEnabled, resonance, currentKey, translation]);

    // THE TEXT IS THE ZOOM-IN — tap the center (or ¶) and the verse's prose
    // unfolds beneath the canvas. Follows the center as you walk the web.
    const [textOpen, setTextOpen] = useState(false);
    const [verseText, setVerseText] = useState(null); // { key, state, text }
    useEffect(() => {
      if (!textOpen) return;
      let on = true;
      const key = currentKey;
      const p = parseVerseKey(key);
      if (!p) return;
      setVerseText({ key, state: "loading", text: null });
      const tr = translation || "web";
      Promise.resolve()
        .then(() => (window.BIBLE && typeof window.BIBLE.loadChapter === "function")
          ? window.BIBLE.loadChapter(p.bookId, p.chapter, tr) : null)
        .then((ch) => {
          if (!on) return;
          const v = chapterVerses(ch).find((x) => x && x.n === (p.verse || 1));
          const text = v ? String(v[tr] || v.text || "").trim() : "";
          setVerseText({ key, state: "done", text: text || null });
        })
        .catch(() => { if (on) setVerseText({ key, state: "done", text: null }); });
      return () => { on = false; };
    }, [textOpen, currentKey, translation]);

    // Automation hooks (the codexConstInspect pattern) + canvas probe.
    const probeRef = useRef({ pos: {}, cx: 0, cy: 0 });
    useEffect(() => {
      window.codexXrefCenter = (ref) => {
        const k = normalizeKey(ref);
        if (k) recenter(k);
        return k || null;
      };
      window.codexXrefState = () => {
        const pb = probeRef.current || { pos: {} };
        const list = nodesRef.current || [];
        return {
          center: currentKeyRef.current,
          chain: chainRef.current.slice(),
          count: list.length,
          nodes: list.map((nd) => {
            const p = pb.pos[nd.key] || {};
            return { key: nd.key, x: p.x, y: p.y };
          }),
        };
      };
      return () => { delete window.codexXrefCenter; delete window.codexXrefState; };
    }, [recenter]);

    // The walked trail: [host, ...chain]; crumb i clicked → chain.slice(0, i).
    const crumbs = [hostKey, ...chain];
    const focusNode = focusKey ? nodes.find((n) => n.key === focusKey) : null;
    const focusSnip = focusNode ? snippetFor(focusNode.key, translation) : null;
    const note = focusNode ? resonance[focusNode.key] : undefined;

    return (
      <div className="cx-xrefg">
        <header className="cx-xrefg-head">
          <span className="cx-xrefg-counts">
            {loading ? "Treasury of Scripture Knowledge" :
              `${nodes.length} cross-reference${nodes.length === 1 ? "" : "s"} · Treasury of Scripture Knowledge`}
          </span>
        </header>

        {loading ? (
          <div style={statusStyle}>Loading TSK…</div>
        ) : err ? (
          <div style={{ ...statusStyle, color: "var(--cx-warn, #ffc46b)" }}>
            Couldn't load cross-references: {err}
          </div>
        ) : (
          <div>
            <XrefGraph
              nodes={nodes}
              centerKey={currentKey}
              centerLabel={formatRef(currentKey)}
              centerColor={centerColor}
              probeRef={probeRef}
              onRecenter={recenter}
              onReaderJump={openInReader}
              onCenterTap={() => setTextOpen((v) => !v)}
              onHoverNode={(k) => setFocusKey(k)}
            />
            {nodes.length === 0 ? (
              <div style={statusStyle}>
                No cross-references for <b>{formatRef(currentKey)}</b>.
              </div>
            ) : null}

            {/* the walked trail — each crumb re-centers back */}
            <nav className="cx-xrefg-trail" aria-label="Walked cross-reference trail">
              {chain.length > 0 ? (
                <button
                  className="cx-xrefg-chip"
                  onClick={() => setChain((c) => c.slice(0, -1))}
                  title="Step back"
                >← back</button>
              ) : null}
              {crumbs.map((k, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {i > 0 ? <span className="cx-xrefg-crumb-sep">→</span> : null}
                  <button
                    className={"cx-xrefg-chip cx-xrefg-crumb" + (i === crumbs.length - 1 ? " is-current" : "")}
                    onClick={() => { if (i < crumbs.length - 1) setChain((c) => c.slice(0, i)); }}
                    aria-current={i === crumbs.length - 1 ? "true" : undefined}
                    title={i === crumbs.length - 1 ? "Current center" : `Re-center on ${formatRef(k)}`}
                  >{shortRef(k)}</button>
                </span>
              ))}
              <button
                className="cx-xrefg-chip"
                onClick={() => setTextOpen((v) => !v)}
                aria-pressed={textOpen}
                title="Unfold the center verse's text"
              >¶ text</button>
            </nav>

            {/* the zoom-in: the center verse's prose, summoned */}
            {textOpen ? (
              <div className="cx-xrefg-text">
                {(!verseText || verseText.state === "loading") ? (
                  <span style={{ opacity: 0.55 }}>summoning…</span>
                ) : verseText.text ? (
                  <p style={{ margin: 0 }}>
                    <sup>{(parseVerseKey(verseText.key) || {}).verse || 1}</sup>
                    {verseText.text}
                  </p>
                ) : (
                  <span style={{ opacity: 0.55 }}>Text unavailable offline for {formatRef(currentKey)}.</span>
                )}
              </div>
            ) : null}

            {/* hover readout + the compare affordance */}
            <div className="cx-xrefg-readout">
              {focusNode ? (
                <div>
                  <div className="cx-xrefg-ro-line">
                    <span className="cx-xrefg-ro-ref" style={{ color: focusNode.color }}>
                      {formatRef(focusNode.key)}
                    </span>
                    {focusNode.theme ? (
                      <span className="cx-xrefg-ro-theme" style={{ color: focusNode.color }}>
                        {focusNode.theme}
                      </span>
                    ) : null}
                    <button
                      className="cx-xrefg-chip"
                      style={expandedCompareKey === focusNode.key
                        ? { color: "var(--cx-accent, #7ee0ff)", borderColor: "var(--cx-accent, #7ee0ff)" }
                        : undefined}
                      onClick={() => onToggleCompare(focusNode.key)}
                      aria-expanded={expandedCompareKey === focusNode.key}
                      title="Compare side by side"
                    >{expandedCompareKey === focusNode.key ? "× close" : "▦ compare"}</button>
                    <button
                      className="cx-xrefg-chip"
                      onClick={() => openInReader(focusNode.key)}
                      title={`Open ${formatRef(focusNode.key)} in reader`}
                    >open ↗</button>
                  </div>
                  {focusNode.note ? <div className="cx-xrefg-ro-snip">{focusNode.note}</div> : null}
                  {focusSnip ? (
                    <div className="cx-xrefg-ro-snip">
                      {focusSnip.length > 180 ? focusSnip.slice(0, 177) + "…" : focusSnip}
                    </div>
                  ) : null}
                  {expandedCompareKey === focusNode.key ? (
                    <div style={compareWrapStyle}>
                      <div style={compareColsStyle}>
                        <div style={compareColStyle}>
                          <div style={compareHeadStyle}>{formatRef(currentKey)}</div>
                          <div style={compareTextStyle}>
                            {snippetFor(currentKey, translation) || <span style={{ opacity: 0.55 }}>Text not cached.</span>}
                          </div>
                        </div>
                        <div style={compareColStyle}>
                          <div style={compareHeadStyle}>{formatRef(focusNode.key)}</div>
                          <div style={compareTextStyle}>
                            {focusSnip || <span style={{ opacity: 0.55 }}>Text not cached.</span>}
                          </div>
                        </div>
                      </div>
                      {aiEnabled && (note === null || (typeof note === "string" && note)) ? (
                        <div style={resonanceStyle}>
                          <span style={resonanceLabelStyle}>resonance</span>{" "}
                          {note === null ? <span style={{ opacity: 0.6 }}>reading…</span> : note}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : nodes.length ? (
                <div className="cx-xrefg-hint">
                  hover a thread · click re-centers · double-click opens the reader · tap the center for text
                </div>
              ) : null}
            </div>

            {/* keyboard/screen-reader mirror — real buttons, Enter re-centers */}
            <ul
              className="cx-xrefg-alist"
              role="list"
              aria-label={`Cross-references of ${formatRef(currentKey)} — Enter re-centers the web`}
            >
              {nodes.map((nd) => (
                <li key={nd.key} role="listitem">
                  <button
                    className="cx-xrefg-chip"
                    onClick={() => recenter(nd.key)}
                    onFocus={() => setFocusKey(nd.key)}
                  >{formatRef(nd.key)}</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <footer className="cx-xrefg-foot">
          <span>
            R. A. Torrey, Treasury of Scripture Knowledge · public domain
            {mod && mod.meta && mod.meta.totalRefs
              ? ` · ${Number(mod.meta.totalRefs).toLocaleString()} refs corpus-wide`
              : ""}
          </span>
          <span>OT <span style={{ color: OT_C }}>●</span> · NT <span style={{ color: NT_C }}>●</span> · seam <span style={{ color: SEAM_C }}>—</span></span>
        </footer>
      </div>
    );
  }

  // Inline styles for the bits shared with v1 (compare block, statuses).
  const statusStyle = { padding: "16px 4px", opacity: 0.8 };
  const compareWrapStyle = {
    margin: "8px 0 2px",
    padding: "8px",
    border: "1px solid var(--cx-rule, rgba(126,224,255,0.18))",
    borderRadius: 4,
    background: "var(--cx-panel, rgba(255,255,255,0.03))",
  };
  const compareColsStyle = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  };
  const compareColStyle = { minWidth: 0 };
  const compareHeadStyle = {
    fontFamily: "var(--cx-font-mono, ui-monospace, JetBrains Mono, monospace)",
    color: "var(--cx-accent, #7ee0ff)",
    fontSize: 11,
    fontWeight: 600,
    marginBottom: 4,
  };
  const compareTextStyle = { fontSize: 12, lineHeight: 1.5, opacity: 0.92 };
  const resonanceStyle = {
    marginTop: 8,
    paddingTop: 6,
    borderTop: "1px dotted var(--cx-rule, rgba(126,224,255,0.18))",
    fontSize: 12,
    lineHeight: 1.5,
    fontStyle: "italic",
    opacity: 0.9,
  };
  const resonanceLabelStyle = {
    fontStyle: "normal",
    fontSize: 9,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    opacity: 0.55,
    fontFamily: "var(--cx-font-mono, ui-monospace, monospace)",
  };

  window.CODEX_CrossRefPanel = CrossRefPanel;

  // ── Plugin registration (unchanged contract) ──────────────────────────
  function openCrossRefsForVerse(ctx) {
    try {
      window.dispatchEvent(new CustomEvent("codex:open-panel", {
        detail: { panelId: "crossrefs-tsk:crossrefs", ctx },
      }));
    } catch {}
  }

  function doRegister() {
    if (!window.CODEX_PLUGINS_API || typeof window.CODEX_PLUGINS_API.register !== "function") return false;
    return window.CODEX_PLUGINS_API.register({
      id: "crossrefs-tsk",
      name: "TSK Cross-References",
      version: "2.0.0",
      panels: [{
        id: "crossrefs",
        label: "CROSS-REFS",
        glyph: "✝",
        render(ctx) {
          const c = ctx || {};
          return React.createElement(CrossRefPanel, {
            book: c.book,
            bookId: c.bookId || "John",
            chapter: c.chapter || 1,
            verse: c.verse || 1,
            translation: c.translation,
          });
        },
      }],
      verseActions: [{
        label: "Cross-References",
        icon: "✝",
        handler(verseRef) { openCrossRefsForVerse({ ref: verseRef }); },
      }],
    });
  }

  if (!doRegister()) {
    // Defer to window load if the plugin API isn't ready yet.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", doRegister, { once: true });
    } else {
      window.addEventListener("load", doRegister, { once: true });
    }
  }
})();
