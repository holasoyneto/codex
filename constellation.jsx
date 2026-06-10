// CODEX — constellation.jsx · ◉ THE CONSTELLATION — the canon as one body.
//
// Every cross-reference in the Treasury of Scripture Knowledge — three
// hundred and forty thousand threads — drawn at once: the whole Bible as
// a ring of 1,189 chapters, every connection a chord of light through the
// center. The famous arc-diagram poster, except alive:
//
//   · hover any chapter  → its every thread IGNITES; the count reads out
//   · hover a book arc   → the whole book's web lights together
//   · click              → the reader flies to that chapter
//   · your reading trail → burns gold on the ring (local, never uploaded)
//   · the open passage   → pulses where you stand
//
// Honest plumbing: the chords are the REAL TSK adjacency (public domain),
// aggregated verse→chapter in front of you with a progress readout — no
// precomputed mystery blob. OT chapters speak cyan, NT amber; a chord
// between testaments blends both — the seam of the covenants, visible.
//
// Performance: the full wheel renders ONCE into an offscreen layer (top
// ~6,000 chords by weight, alpha-scaled); pointer work only re-blits the
// base and draws the ignited set — silk at 60fps on a laptop.

const CONST_OT_HUE = "#7ee0ff";
const CONST_NT_HUE = "#e8b465";
const CONST_GOLD   = "#ffd479";
const CONST_TOP_CHORDS = 6000;

// ── Canon geometry — global chapter index from the canonical book list ──
function constCanon() {
  const books = (window.CODEX_DATA && window.CODEX_DATA.books) || [];
  const chapters = [];           // [{bookId, bookName, testament, ch, idx}]
  const offset = {};             // bookId -> first global index
  books.forEach((b) => {
    offset[b.id] = chapters.length;
    for (let c = 1; c <= b.chapters; c++) {
      chapters.push({ bookId: b.id, bookName: b.name, testament: b.testament, ch: c, idx: chapters.length });
    }
  });
  return { books, chapters, offset, count: chapters.length };
}

// Aggregate TSK verse-pairs → undirected chapter-pair weights, chunked so
// the UI can read out progress. Returns { pairs:[[a,b,w]…w-desc], adj:Map }.
function constAggregate(tsk, canon, onProgress) {
  return new Promise((resolve, reject) => {
    try {
      const verses = (tsk && (tsk.verses || tsk.data && tsk.data.verses)) || {};
      const keys = Object.keys(verses);
      const W = new Map(); // packed key a*4096+b (a<b) -> weight
      const chapIdx = (key) => {
        const p = key.split(".");
        const off = canon.offset[p[0]];
        if (off === undefined) return -1;
        const ch = parseInt(p[1], 10);
        if (!ch || ch < 1) return -1;
        return off + ch - 1;
      };
      let i = 0, threads = 0;
      const CHUNK = 2500;
      const step = () => {
        const end = Math.min(i + CHUNK, keys.length);
        for (; i < end; i++) {
          const a = chapIdx(keys[i]);
          if (a < 0) continue;
          const targets = verses[keys[i]];
          if (!Array.isArray(targets)) continue;
          for (let t = 0; t < targets.length; t++) {
            const b = chapIdx(targets[t]);
            if (b < 0 || b === a) continue;
            threads++;
            const k = a < b ? a * 4096 + b : b * 4096 + a;
            W.set(k, (W.get(k) || 0) + 1);
          }
        }
        if (onProgress) onProgress(Math.round((i / keys.length) * 100), threads);
        if (i < keys.length) { setTimeout(step, 0); return; }
        // Unpack, sort by weight, build per-chapter adjacency.
        const pairs = [];
        W.forEach((w, k) => pairs.push([Math.floor(k / 4096), k % 4096, w]));
        pairs.sort((x, y) => y[2] - x[2]);
        const adj = new Map();
        pairs.forEach(([a, b, w]) => {
          if (!adj.has(a)) adj.set(a, []);
          if (!adj.has(b)) adj.set(b, []);
          adj.get(a).push([b, w]);
          adj.get(b).push([a, w]);
        });
        resolve({ pairs, adj, threads, verseKeys: keys.length });
      };
      step();
    } catch (e) { reject(e); }
  });
}

function VerseConstellation({ onClose }) {
  const I = window.CODEX_INTEL;
  const wrapRef = useRef(null);
  const baseRef = useRef(null);   // offscreen base layer
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState("loading"); // loading | ready | error
  const [progress, setProgress] = useState({ pct: 0, threads: 0 });
  const [err, setErr] = useState(null);
  const dataRef = useRef(null);   // { canon, pairs, adj, threads }
  const geoRef = useRef(null);    // { cx, cy, R, angles[] }
  const hoverRef = useRef({ chapter: -1, book: -1 });
  const [hud, setHud] = useState(null); // { label, threads } | null

  // ── Load + aggregate ───────────────────────────────────────────────────
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        if (!window.CODEX_MODULES || !window.CODEX_MODULES.loadModule) throw new Error("Module loader unavailable");
        const tsk = await window.CODEX_MODULES.loadModule("tsk-sample");
        if (dead) return;
        const canon = constCanon();
        if (!canon.count) throw new Error("Canon unavailable");
        const agg = await constAggregate(tsk, canon, (pct, threads) => {
          if (!dead) setProgress({ pct, threads });
        });
        if (dead) return;
        dataRef.current = { canon, ...agg };
        setPhase("ready");
      } catch (e) {
        if (!dead) { setErr(String(e.message || e)); setPhase("error"); }
      }
    })();
    return () => { dead = true; };
  }, []);

  // ESC closes
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ── Geometry: chapter → angle (gaps between books), xy on the ring ─────
  const computeGeo = (w, h) => {
    const d = dataRef.current;
    if (!d) return null;
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) / 2 - 44;
    const BOOK_GAP = (Math.PI * 2) * 0.0016;
    const total = d.canon.count;
    const gaps = d.canon.books.length * BOOK_GAP;
    const per = ((Math.PI * 2) - gaps) / total;
    const angles = new Array(total);
    let a = -Math.PI / 2; // start at 12 o'clock, Genesis
    d.canon.books.forEach((b) => {
      const off = d.canon.offset[b.id];
      for (let c = 0; c < b.chapters; c++) { angles[off + c] = a + per / 2; a += per; }
      a += BOOK_GAP;
    });
    return { cx, cy, R, angles, per };
  };
  const xyOf = (idx, r) => {
    const g = geoRef.current;
    const a = g.angles[idx];
    return [g.cx + Math.cos(a) * r, g.cy + Math.sin(a) * r];
  };
  const hueOf = (idx) => (dataRef.current.canon.chapters[idx].testament === "NT" ? CONST_NT_HUE : CONST_OT_HUE);

  // One chord — quadratic toward the center, pulled harder for far pairs.
  const chord = (ctx, a, b, color, alpha, width) => {
    const g = geoRef.current;
    const [x1, y1] = xyOf(a, g.R), [x2, y2] = xyOf(b, g.R);
    const da = Math.abs(g.angles[a] - g.angles[b]);
    const span = Math.min(da, Math.PI * 2 - da) / Math.PI; // 0..1
    const k = 1 - (0.15 + span * 0.8);                      // far pairs dive deep
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(g.cx + ((x1 + x2) / 2 - g.cx) * k, g.cy + ((y1 + y2) / 2 - g.cy) * k, x2, y2);
    ctx.stroke();
  };

  // ── Base layer: ring + book arcs + top chords — rendered once ──────────
  const renderBase = () => {
    const canvas = canvasRef.current, d = dataRef.current;
    if (!canvas || !d) return;
    const { w, h } = I.intelCanvas.fit(canvas);
    geoRef.current = computeGeo(w, h);
    const g = geoRef.current;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    if (!baseRef.current) baseRef.current = document.createElement("canvas");
    const base = baseRef.current;
    base.width = w * dpr; base.height = h * dpr;
    const ctx = base.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // chords — heaviest first so fine threads sit on top of the glow mass
    const top = d.pairs.slice(0, CONST_TOP_CHORDS);
    const wMax = top.length ? top[0][2] : 1;
    for (let i = top.length - 1; i >= 0; i--) {
      const [a, b, wt] = top[i];
      const t = wt / wMax;
      const color = hueOf(a) === hueOf(b) ? hueOf(a) : CONST_GOLD; // covenant seam glows gold
      chord(ctx, a, b, color, 0.028 + t * 0.16, 0.5 + t * 0.9);
    }
    ctx.globalAlpha = 1;

    // ring: book arcs + chapter ticks
    d.canon.books.forEach((b) => {
      const off = d.canon.offset[b.id];
      const a0 = g.angles[off] - g.per / 2;
      const a1 = g.angles[off + b.chapters - 1] + g.per / 2;
      ctx.strokeStyle = b.testament === "NT" ? CONST_NT_HUE : CONST_OT_HUE;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R + 6, a0, a1); ctx.stroke();
      // label books with enough arc to carry text
      if ((a1 - a0) * g.R > 26) {
        const mid = (a0 + a1) / 2;
        ctx.save();
        ctx.translate(g.cx + Math.cos(mid) * (g.R + 18), g.cy + Math.sin(mid) * (g.R + 18));
        let rot = mid + Math.PI / 2;
        if (mid > 0 && mid < Math.PI) rot += Math.PI; // keep text upright
        ctx.rotate(rot);
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = b.testament === "NT" ? CONST_NT_HUE : CONST_OT_HUE;
        ctx.font = "600 8.5px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText(b.name.toUpperCase().slice(0, 14), 0, 0);
        ctx.restore();
      }
    });
    ctx.globalAlpha = 1;
    blit();
  };

  // ── Frame: base + overlays (hover ignite, trail, current passage) ──────
  const blit = () => {
    const canvas = canvasRef.current, d = dataRef.current, g = geoRef.current;
    if (!canvas || !d || !g) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = canvas.width / dpr, h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(baseRef.current, 0, 0, w, h);

    // gold trail — the chapters this reader has walked
    try {
      const trail = JSON.parse(localStorage.getItem("codex.trail") || "[]");
      const seen = new Set();
      trail.forEach((t) => {
        const p = window.CODEX_KERNEL && window.CODEX_KERNEL.parseRef(t.ref);
        if (!p) return;
        const idx = d.canon.offset[p.bookId] + p.chapter - 1;
        if (seen.has(idx)) return;
        seen.add(idx);
        const [x, y] = xyOf(idx, g.R + 6);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = CONST_GOLD;
        ctx.shadowColor = CONST_GOLD; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      });
    } catch {}

    // hover ignition
    const hv = hoverRef.current;
    const ignite = [];
    if (hv.chapter >= 0) ignite.push(hv.chapter);
    else if (hv.book >= 0) {
      const b = d.canon.books[hv.book];
      const off = d.canon.offset[b.id];
      for (let c = 0; c < b.chapters; c++) ignite.push(off + c);
    }
    if (ignite.length) {
      let threadCount = 0;
      ctx.save();
      ignite.forEach((idx) => {
        const edges = d.adj.get(idx) || [];
        threadCount += edges.length;
        edges.forEach(([other, wt]) => {
          chord(ctx, idx, other, hueOf(other), Math.min(0.85, 0.3 + wt * 0.06), 0.8);
        });
      });
      ctx.restore();
      // endpoint markers
      ctx.globalAlpha = 1;
      ignite.forEach((idx) => {
        const [x, y] = xyOf(idx, g.R + 6);
        ctx.fillStyle = "#fff";
        ctx.shadowColor = hueOf(idx); ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      });
    }
    ctx.globalAlpha = 1;
  };

  // pointer → chapter / book band
  const hitTest = (mx, my) => {
    const g = geoRef.current, d = dataRef.current;
    if (!g || !d) return { chapter: -1, book: -1 };
    const dx = mx - g.cx, dy = my - g.cy;
    const r = Math.hypot(dx, dy);
    if (r < g.R - 26 || r > g.R + 30) return { chapter: -1, book: -1 };
    let ang = Math.atan2(dy, dx);
    // nearest chapter by angle
    let best = -1, bestD = Infinity;
    for (let i = 0; i < g.angles.length; i++) {
      let da = Math.abs(ang - g.angles[i]);
      if (da > Math.PI) da = Math.PI * 2 - da;
      if (da < bestD) { bestD = da; best = i; }
    }
    if (bestD > g.per * 4) return { chapter: -1, book: -1 };
    if (r > g.R + 10) {
      // label band → whole book
      const bId = d.canon.chapters[best].bookId;
      return { chapter: -1, book: d.canon.books.findIndex((b) => b.id === bId) };
    }
    return { chapter: best, book: -1 };
  };

  const onMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    const prev = hoverRef.current;
    if (hit.chapter === prev.chapter && hit.book === prev.book) return;
    hoverRef.current = hit;
    const d = dataRef.current;
    if (hit.chapter >= 0) {
      const c = d.canon.chapters[hit.chapter];
      const edges = d.adj.get(hit.chapter) || [];
      const threads = edges.reduce((s, [, w]) => s + w, 0);
      setHud({ label: `${c.bookName.toUpperCase()} ${c.ch}`, threads });
    } else if (hit.book >= 0) {
      const b = d.canon.books[hit.book];
      const off = d.canon.offset[b.id];
      let threads = 0;
      for (let c = 0; c < b.chapters; c++) (d.adj.get(off + c) || []).forEach(([, w]) => { threads += w; });
      setHud({ label: b.name.toUpperCase(), threads });
    } else setHud(null);
    requestAnimationFrame(blit);
  };

  const onClick = () => {
    const hv = hoverRef.current, d = dataRef.current;
    if (!d) return;
    let target = null;
    if (hv.chapter >= 0) {
      const c = d.canon.chapters[hv.chapter];
      target = `${c.bookName} ${c.ch}`;
    } else if (hv.book >= 0) {
      target = `${d.canon.books[hv.book].name} 1`;
    }
    if (target && window.codexJumpToRef) {
      window.codexJumpToRef(target);
      try { window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: `◉ ${target}`, kind: "ok" } })); } catch {}
    }
  };

  // render base once ready; re-render on resize
  useEffect(() => {
    if (phase !== "ready") return;
    renderBase();
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    let t = 0;
    const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(renderBase, 120); });
    ro.observe(canvas);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, [phase]);

  const d = dataRef.current;
  return (
    <div className="cx-const-backdrop" onClick={onClose} role="dialog" aria-label="The Constellation — the canon as one body">
      <div className="cx-const" onClick={(e) => e.stopPropagation()} ref={wrapRef}>
        <span className="cx-corner cx-tl" /><span className="cx-corner cx-tr" />
        <span className="cx-corner cx-bl" /><span className="cx-corner cx-br" />

        <header className="cx-const-h">
          <span className="cx-const-h-tag">CODEX · CONSTELLATION</span>
          <span className="cx-const-h-sub">the canon as one body — every thread of the Treasury, drawn live</span>
          <button className="cx-const-x" onClick={onClose} aria-label="Close" title="Close (ESC)">×</button>
        </header>

        <IntelBanner console="CONSTELLATION" scope="WHOLE CANON" note="TREASURY OF SCRIPTURE KNOWLEDGE · PUBLIC DOMAIN · AGGREGATED IN FRONT OF YOU" />

        {phase === "loading" ? (
          <div className="cx-const-loading">
            <div className="cx-const-loading-ring" aria-hidden="true" />
            <span>INDEXING THE CANON</span>
            <span className="cx-const-loading-sub">{progress.pct}% · {progress.threads.toLocaleString()} threads woven</span>
          </div>
        ) : phase === "error" ? (
          <div className="cx-const-err">
            <b>THE LOOM IS DARK</b>
            <code>{err}</code>
            <span className="cx-const-err-hint">The Treasury module (≈5 MB) loads on first use — check your connection and reopen.</span>
          </div>
        ) : (
          <div className="cx-const-stage">
            <canvas
              ref={canvasRef}
              className="cx-const-canvas"
              onMouseMove={onMove}
              onMouseLeave={() => { hoverRef.current = { chapter: -1, book: -1 }; setHud(null); requestAnimationFrame(blit); }}
              onClick={onClick}
              role="img"
              aria-label="Chord wheel of all cross-references in the canon"
            />
            <div className="cx-const-stats" aria-hidden="true">
              <span>{d ? d.canon.count.toLocaleString() : "—"} CHAPTERS</span>
              <span>{d ? d.threads.toLocaleString() : "—"} THREADS</span>
              <span>TOP {CONST_TOP_CHORDS.toLocaleString()} DRAWN · ALL IGNITE ON HOVER</span>
            </div>
            {hud ? (
              <div className="cx-const-hud">
                <b>{hud.label}</b>
                <span>{hud.threads.toLocaleString()} threads · click to read</span>
              </div>
            ) : (
              <div className="cx-const-hud is-idle">
                <span>hover the ring · OT speaks cyan, NT amber, the covenant seam gold · your trail burns gold on the rim</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { VerseConstellation });
