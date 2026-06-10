// GENERATED from intel.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
// CODEX — intel.jsx · shared "intelligence console" design system.
//
// The OSINT-grade visual language used across CODEX sections (Mirror, Map,
// Cross-refs, Timeline, Oracle, dossiers). One small set of primitives so
// every surface speaks the same dialect:
//
//   <IntelDecrypt text>        — text that resolves out of cipher noise
//   <IntelBars value>          — 0-100 signal-strength meter (5 bars)
//   <IntelBanner ...>          — classification strip (honest: always marks
//                                AI analysis as scholarly survey, not fact)
//   <IntelTicker items>        — cycling single-line intel feed
//   <IntelStamp code>          — monospace ID chip ("H-03", "SRC-12")
//   intelGrade(intensity)      — {key,label} CONFIRMED-style grading
//   intelCanvas helpers        — glow nodes + bezier link arcs for the
//                                cascade / link-analysis canvases
//
// Everything is defensive: no primitive ever throws; reduced-motion is
// honoured (decrypt + ticker degrade to static rendering).

const INTEL_GLYPHS = "█▓▒░<>/\\|=+*#@$%&0123456789ABCDEF";

function intelReducedMotion() {
  try {return window.matchMedia("(prefers-reduced-motion: reduce)").matches;}
  catch {return false;}
}

// ── Decrypt-in text ─────────────────────────────────────────────────────
// Scrambles every character, then resolves left→right. Runs once per mount.
function IntelDecrypt({ text, speed = 18, className = "", as = "span" }) {
  const target = String(text == null ? "" : text);
  const [shown, setShown] = useState(() => intelReducedMotion() ? target : "");
  const doneRef = useRef(intelReducedMotion());

  useEffect(() => {
    if (doneRef.current) {setShown(target);return;}
    let raf = 0,start = 0,cancelled = false;
    const step = (ts) => {
      if (cancelled) return;
      if (!start) start = ts;
      // resolved chars grow with time; unresolved tail shows cipher noise
      const resolved = Math.min(target.length, Math.floor((ts - start) / speed));
      if (resolved >= target.length) {setShown(target);doneRef.current = true;return;}
      let s = target.slice(0, resolved);
      const tail = Math.min(target.length - resolved, 10);
      for (let i = 0; i < tail; i++) {
        const ch = target[resolved + i];
        s += ch === " " ? " " : INTEL_GLYPHS[Math.random() * INTEL_GLYPHS.length | 0];
      }
      setShown(s);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {cancelled = true;cancelAnimationFrame(raf);};
  }, [target]);

  const Tag = as;
  return /*#__PURE__*/React.createElement(Tag, { className: `cx-intel-decrypt ${className}`, "aria-label": target }, shown || " ");
}

// ── Signal-strength meter ───────────────────────────────────────────────
// value: 0-100. Five bars, lit count ∝ value, glow on the lit ones.
function IntelBars({ value, label, className = "" }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const lit = Math.max(1, Math.round(v / 100 * 5));
  const g = intelGrade(v);
  return (/*#__PURE__*/
    React.createElement("span", { className: `cx-intel-bars is-${g.key} ${className}`,
      role: "img", "aria-label": `${label || "signal"} ${v}/100 — ${g.label}`,
      title: `${label || "resonance"} · ${v}/100 · ${g.label}` },
    [1, 2, 3, 4, 5].map((i) => /*#__PURE__*/
    React.createElement("i", { key: i, className: i <= lit ? "is-lit" : "", style: { height: `${3 + i * 2}px` } })
    ), /*#__PURE__*/
    React.createElement("b", { className: "cx-intel-bars-grade" }, g.label)
    ));

}

// Grade an intensity score the way an analyst desk would mark confidence.
function intelGrade(v) {
  const n = Number(v) || 0;
  if (n >= 75) return { key: "strong", label: "STRONG" };
  if (n >= 45) return { key: "moderate", label: "MODERATE" };
  return { key: "faint", label: "FAINT" };
}

// ── Classification banner ───────────────────────────────────────────────
// The honest Palantir strip: names the console + scope, and ALWAYS carries
// the survey-not-prediction caveat so the scary aesthetic stays truthful.
function IntelBanner({ console: consoleName, scope, note, className = "" }) {
  return (/*#__PURE__*/
    React.createElement("div", { className: `cx-intel-banner ${className}`, role: "note" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-intel-banner-sig" }, "CODEX//", consoleName, scope ? `//${scope}` : ""), /*#__PURE__*/
    React.createElement("span", { className: "cx-intel-banner-note" }, note || "OPEN RECORD · FREELY GIVEN · SCHOLARLY SURVEY, NOT PREDICTION")
    ));

}

// ── Cycling intel ticker ────────────────────────────────────────────────
// items: array of strings (or {text} objects). One line, rotates.
function IntelTicker({ items, interval = 3500, className = "" }) {
  const list = (Array.isArray(items) ? items : []).map((x) => typeof x === "string" ? x : x && x.text || "").filter(Boolean);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (list.length < 2 || intelReducedMotion()) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % list.length), interval);
    return () => clearInterval(t);
  }, [list.length, interval]);
  if (!list.length) return null;
  return (/*#__PURE__*/
    React.createElement("div", { className: `cx-intel-ticker ${className}`, "aria-live": "off" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-intel-ticker-dot", "aria-hidden": "true" }), /*#__PURE__*/
    React.createElement("span", { className: "cx-intel-ticker-line", key: idx }, list[idx % list.length]),
    list.length > 1 ? /*#__PURE__*/React.createElement("span", { className: "cx-intel-ticker-n" }, idx % list.length + 1, "/", list.length) : null
    ));

}

// ── ID stamp chip ───────────────────────────────────────────────────────
function IntelStamp({ code, tone = "accent", className = "" }) {
  return /*#__PURE__*/React.createElement("span", { className: `cx-intel-stamp is-${tone} ${className}` }, code);
}

// ── Canvas helpers — shared by the Mirror cascade + crossref link graph ──
// All take a 2d ctx and plain numbers; no React, no state.
const intelCanvas = {
  // Resize a canvas to its CSS box at device-pixel ratio. Returns {w,h}.
  fit(canvas) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)),h = Math.max(1, Math.round(r.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;canvas.height = h * dpr;
      canvas.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return { w, h };
  },
  // Quadratic glow arc from (x1,y1) to (x2,y2), bowing by `bow` px.
  // t ∈ [0,1] draws a partial arc (for animated sweep-in).
  arc(ctx, x1, y1, x2, y2, { color = "#7cf", width = 1, glow = 6, bow = -40, alpha = 0.8, t = 1 } = {}) {
    const mx = (x1 + x2) / 2,my = (y1 + y2) / 2 + bow;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    ctx.beginPath();
    if (t >= 1) {
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(mx, my, x2, y2);
    } else {
      // subdivide the quadratic and draw the first t of it
      const n = Math.max(2, Math.floor(40 * t));
      ctx.moveTo(x1, y1);
      for (let i = 1; i <= n; i++) {
        const u = i / 40;
        if (u > t) break;
        const a = 1 - u;
        ctx.lineTo(a * a * x1 + 2 * a * u * mx + u * u * x2,
        a * a * y1 + 2 * a * u * my + u * u * y2);
      }
    }
    ctx.stroke();
    ctx.restore();
  },
  // Glowing node with halo ring. r scales with `weight` 0-100.
  node(ctx, x, y, { color = "#7cf", weight = 50, ring = true, alpha = 1 } = {}) {
    const r = 2.5 + Math.max(0, Math.min(100, weight)) / 100 * 4.5;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();ctx.arc(x, y, r, 0, Math.PI * 2);ctx.fill();
    if (ring) {
      ctx.shadowBlur = 0;
      ctx.globalAlpha = alpha * 0.35;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();ctx.arc(x, y, r + 4, 0, Math.PI * 2);ctx.stroke();
    }
    ctx.restore();
    return r;
  },
  // Read the app accent color so canvases match the active theme.
  accent() {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--cx-accent").trim();
      return v || "#7cf";
    } catch {return "#7cf";}
  }
};

// ── Canonical shared helpers ────────────────────────────────────────────
// One home for the utilities every AI console used to re-implement
// (verse-map, verse-mirror, verse-art each carried private copies).

// Tolerant JSON parser — recovers usable data from truncated AI responses.
function intelParseJSON(s) {
  try {return JSON.parse(s);} catch {}
  let inString = false,escape = false;
  const stk = [];
  let lastSafe = 0,safeStack = [];
  const mark = (idx) => {lastSafe = idx;safeStack = stk.slice();};
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) {escape = false;continue;}
    if (inString) {
      if (c === "\\") {escape = true;continue;}
      if (c === "\"") {inString = false;mark(i + 1);}
      continue;
    }
    if (c === "\"") {inString = true;continue;}
    if (c === "{" || c === "[") stk.push(c === "{" ? "}" : "]");else
    if (c === "}" || c === "]") {stk.pop();mark(i + 1);} else
    if (c === ",") mark(i);else
    if (/[\d.eE+\-tfn ul]/.test(c)) mark(i + 1);
  }
  let head = s.slice(0, lastSafe).replace(/[,\s]+$/, "");
  head = head.replace(/,?\s*"[^"]*"\s*:\s*$/, "");
  return JSON.parse(head + safeStack.reverse().join(""));
}

// "1492 BCE" / "70 CE" / "—"
function intelFmtYear(y) {
  if (y === 0 || y == null || Number.isNaN(y)) return "—";
  return `${Math.abs(y)} ${y < 0 ? "BCE" : "CE"}`;
}

function intelEscapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

// The user's active engine, same resolution the AI panels use.
function intelEngine() {
  const t = window.CODEX_DATA && window.CODEX_DATA.tweaks || {};
  return { provider: t.provider || undefined, model: t.model || undefined };
}

// Server error shapes vary: {error:"msg"} or {error:{message}} — get a string.
function intelErrMessage(body, status) {
  const e = body && body.error;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") return e.message || e.type || JSON.stringify(e);
  return `HTTP ${status}`;
}

// The /api/chat → JSON-object pipeline every console repeats:
// engine resolution → POST → fence-strip → first "{" → tolerant parse.
// Throws Error with a human-readable message on any failure.
async function intelAI({ system, user, maxTokens = 2400, model, provider }) {
  const eng = intelEngine();
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: provider !== undefined ? provider : eng.provider,
      model: model || eng.model || "claude-haiku-4-5-20251001",
      system,
      messages: [{ role: "user", content: user }],
      max_tokens: maxTokens
    })
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(intelErrMessage(body, r.status));
  const text = (body.text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const i = text.indexOf("{");
  if (i === -1) throw new Error("Response was not JSON");
  return intelParseJSON(text.slice(i));
}

Object.assign(window, { IntelDecrypt, IntelBars, IntelBanner, IntelTicker, IntelStamp });
window.CODEX_INTEL = {
  IntelDecrypt, IntelBars, IntelBanner, IntelTicker, IntelStamp,
  intelGrade, intelCanvas, intelReducedMotion,
  intelParseJSON, intelFmtYear, intelEscapeHtml, intelEngine, intelErrMessage, intelAI
};
})();
