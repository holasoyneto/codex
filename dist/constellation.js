// GENERATED from constellation.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
// CODEX — constellation.jsx · ❂ THE CONSTELLATION — the canon as one galaxy.
//
// Every cross-reference in the Treasury of Scripture Knowledge — hundreds
// of thousands of threads — as navigable 3D space. 1,189 chapters are
// stars, clustered by their natural families, linked by every thread.
// Since v9.3 the galaxy is the ONLY view ("constellation only needs the
// galaxy") — the 2D chord wheel is gone:
//
//   · drag to orbit · scroll to dive · click a star to approach
//   · double-click a star      → the reader flies to that chapter
//   · PATH "Gen 1 → Rev 21"    → the route burns gold through space
//   · NEAR "Isaiah 53"         → the ego-network ignites, camera flies in
//   · FAMILIES                 → stars recolor by label-propagation clusters
//   · your reading trail       → burns gold (local, never uploaded)
//
// Honest plumbing: the threads are the REAL TSK adjacency (public domain),
// aggregated verse→chapter in front of you with a progress readout — no
// precomputed mystery blob. OT stars speak cyan, NT amber; a thread
// between testaments goes gold — the seam of the covenants, visible.

const CONST_OT_HUE = "#7ee0ff";
const CONST_NT_HUE = "#e8b465";
const CONST_GOLD = "#ffd479";
const CONST_FAMILY_HUES = ["#7ee0ff", "#e8b465", "#b88cff", "#9bd66b", "#ff8291", "#5bd0b0", "#e0a7ff", "#ffd479"];

// ── Graph tools — the wheel is one VIEW of a real graph instrument. ─────
// Dijkstra with cost 1/weight: paths prefer STRONG threads, so a route is
// scholarship (heavily-attested links), not trivia.
function constPath(adj, from, to) {
  if (from === to) return [from];
  const dist = new Map([[from, 0]]);
  const prev = new Map();
  const done = new Set();
  // tiny binary-less PQ — fine at ~2k nodes
  const frontier = new Map([[from, 0]]);
  while (frontier.size) {
    let u = -1,best = Infinity;
    frontier.forEach((d, k) => {if (d < best) {best = d;u = k;}});
    frontier.delete(u);
    if (u === to) break;
    done.add(u);
    (adj.get(u) || []).forEach(([v, w]) => {
      if (done.has(v)) return;
      const nd = best + 1 / (w + 0.0001);
      if (nd < (dist.has(v) ? dist.get(v) : Infinity)) {
        dist.set(v, nd);prev.set(v, u);frontier.set(v, nd);
      }
    });
  }
  if (!prev.has(to)) return null;
  const path = [to];
  while (path[path.length - 1] !== from) path.push(prev.get(path[path.length - 1]));
  return path.reverse();
}

// ── 3D galaxy layout — family-seeded clusters relaxed by edge springs. ──
// Families sit on a fibonacci sphere; chapters jitter around their family
// center; then edge springs pull linked chapters together while a coarse
// spatial grid keeps neighbors from collapsing. Chunked for a progress
// readout; the result caches (codex.galaxy.v1) so reopen is instant.
function constGalaxyLayout(adj, pairs, count, famLabel, onProgress) {
  return new Promise((resolve) => {
    const R = 320;
    const pos = new Float32Array(count * 3);
    // family centers — fibonacci sphere
    const famCount = Math.max(1, famLabel ? Math.max.apply(null, famLabel) + 1 : 1);
    const centers = [];
    const GA = Math.PI * (3 - Math.sqrt(5));
    for (let f = 0; f < famCount; f++) {
      const y = famCount === 1 ? 0 : 1 - f / (famCount - 1) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const th = GA * f;
      centers.push([Math.cos(th) * r * R, y * R, Math.sin(th) * r * R]);
    }
    // deterministic per-node jitter (no Math.random → stable layouts)
    const jit = (i, k) => {
      const s = Math.sin(i * 374761.393 + k * 668265.263) * 43758.5453;
      return (s - Math.floor(s)) * 2 - 1;
    };
    for (let i = 0; i < count; i++) {
      const c = centers[famLabel ? famLabel[i] % famCount : 0];
      pos[i * 3] = c[0] + jit(i, 1) * R * 0.38;
      pos[i * 3 + 1] = c[1] + jit(i, 2) * R * 0.38;
      pos[i * 3 + 2] = c[2] + jit(i, 3) * R * 0.38;
    }
    const springs = pairs.slice(0, 9000);
    const wMax = springs.length ? springs[0][2] : 1;
    const ITER = 90;
    let it = 0;
    const step = () => {
      const end = Math.min(it + 6, ITER);
      for (; it < end; it++) {
        const t = 1 - it / ITER; // cooling
        // springs
        for (let s = 0; s < springs.length; s++) {
          const [a, b, w] = springs[s];
          const ax = a * 3,bx = b * 3;
          let dx = pos[bx] - pos[ax],dy = pos[bx + 1] - pos[ax + 1],dz = pos[bx + 2] - pos[ax + 2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
          const want = 60 + 180 * (1 - Math.min(1, w / wMax));
          const f = (dist - want) / dist * 0.012 * t * (0.4 + 0.6 * (w / wMax));
          dx *= f;dy *= f;dz *= f;
          pos[ax] += dx;pos[ax + 1] += dy;pos[ax + 2] += dz;
          pos[bx] -= dx;pos[bx + 1] -= dy;pos[bx + 2] -= dz;
        }
        // coarse grid repulsion — only same-cell neighbors push apart
        const cell = 46;
        const grid = new Map();
        for (let i = 0; i < count; i++) {
          const k = Math.round(pos[i * 3] / cell) + "," + Math.round(pos[i * 3 + 1] / cell) + "," + Math.round(pos[i * 3 + 2] / cell);
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push(i);
        }
        grid.forEach((bucket) => {
          for (let x = 0; x < bucket.length; x++) for (let y = x + 1; y < bucket.length; y++) {
            const a = bucket[x] * 3,b = bucket[y] * 3;
            let dx = pos[b] - pos[a],dy = pos[b + 1] - pos[a + 1],dz = pos[b + 2] - pos[a + 2];
            const d2 = dx * dx + dy * dy + dz * dz || 1;
            if (d2 > cell * cell) continue;
            const f = cell * cell / d2 * 0.6 * t;
            const d = Math.sqrt(d2);
            dx = dx / d * f;dy = dy / d * f;dz = dz / d * f;
            pos[a] -= dx;pos[a + 1] -= dy;pos[a + 2] -= dz;
            pos[b] += dx;pos[b + 1] += dy;pos[b + 2] += dz;
          }
        });
      }
      if (onProgress) onProgress(Math.round(it / ITER * 100));
      if (it < ITER) {setTimeout(step, 0);return;}
      resolve(pos);
    };
    step();
  });
}

// Label propagation — the canon's natural families, found in the client.
// Weighted majority vote per node, a few sweeps; deterministic order.
function constFamilies(adj, count) {
  const label = new Array(count);
  for (let i = 0; i < count; i++) label[i] = i;
  for (let sweep = 0; sweep < 6; sweep++) {
    let changed = 0;
    for (let i = 0; i < count; i++) {
      const votes = new Map();
      (adj.get(i) || []).forEach(([v, w]) => {
        votes.set(label[v], (votes.get(label[v]) || 0) + w);
      });
      if (!votes.size) continue;
      let bestL = label[i],bestV = -1;
      votes.forEach((v, l) => {if (v > bestV) {bestV = v;bestL = l;}});
      if (bestL !== label[i]) {label[i] = bestL;changed++;}
    }
    if (!changed) break;
  }
  // compact to family indices ranked by size
  const sizes = new Map();
  label.forEach((l) => sizes.set(l, (sizes.get(l) || 0) + 1));
  const ranked = [...sizes.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l);
  const famOf = new Map(ranked.map((l, i) => [l, i]));
  return { label: label.map((l) => famOf.get(l)), families: ranked.length };
}

// ── Canon geometry — global chapter index from the canonical book list ──
function constCanon() {
  const books = window.CODEX_DATA && window.CODEX_DATA.books || [];
  const chapters = []; // [{bookId, bookName, testament, ch, idx}]
  const offset = {}; // bookId -> first global index
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
      const verses = tsk && (tsk.verses || tsk.data && tsk.data.verses) || {};
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
      let i = 0,threads = 0;
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
        if (onProgress) onProgress(Math.round(i / keys.length * 100), threads);
        if (i < keys.length) {setTimeout(step, 0);return;}
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
    } catch (e) {reject(e);}
  });
}

function VerseConstellation({ onClose }) {
  const I = window.CODEX_INTEL;
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState("loading"); // loading | ready | error
  const [progress, setProgress] = useState({ pct: 0, threads: 0 });
  const [err, setErr] = useState(null);
  const dataRef = useRef(null); // { canon, pairs, adj, threads }
  const [hud, setHud] = useState(null); // { label, threads } | null
  // v10 — clicking a star opens a REAL dossier, not a two-line hud:
  // { idx, label, bookId, chapter, testament, fam, degree, threads, rows }
  const [info, setInfo] = useState(null);

  // ── Graph-instrument state: query → PATH / NEAR; FAMILIES color mode ──
  const [query, setQuery] = useState("");
  const [route, setRoute] = useState(null); // { path:[idx], labels:[str] } | null
  const [near, setNear] = useState(null); // { label, rows:[{idx,label,w}] } | null
  const [famOn, setFamOn] = useState(false);
  const famRef = useRef(null); // { label[], families }

  const labelOf = (idx) => {
    const c = dataRef.current.canon.chapters[idx];
    return `${c.bookName} ${c.ch}`;
  };

  const runQuery = () => {
    const d = dataRef.current;
    if (!d) return;
    const K = window.CODEX_KERNEL;
    const text = query.trim();
    setRoute(null);setNear(null);
    if (!text || !K?.parseRef) return;
    const idxOf = (s) => {
      const p = K.parseRef(s.trim());
      if (!p) return -1;
      const off = d.canon.offset[p.bookId];
      return off === undefined ? -1 : off + p.chapter - 1;
    };
    const m = text.split(/\s*(?:->|→|>| to )\s*/i);
    if (m.length >= 2) {
      const a = idxOf(m[0]),b = idxOf(m[1]);
      if (a < 0 || b < 0) {setHud({ label: "UNREADABLE REFS", threads: 0 });return;}
      const path = constPath(d.adj, a, b);
      if (!path) {setHud({ label: "NO THREAD PATH", threads: 0 });return;}
      setRoute({ path, labels: path.map(labelOf) });
      // fly the camera to the route's origin so the gold thread is in view
      if (galaxyRef.current) {selRef.current = a;flyTo(a);}
    } else {
      const a = idxOf(text);
      if (a < 0) {setHud({ label: "UNREADABLE REF", threads: 0 });return;}
      const rows = (d.adj.get(a) || []).slice().sort((x, y) => y[1] - x[1]).slice(0, 14).
      map(([idx, w]) => ({ idx, label: labelOf(idx), w }));
      setNear({ idx: a, label: labelOf(a), rows });
      if (galaxyRef.current) {selRef.current = a;flyTo(a);}
    }
  };

  const toggleFamilies = () => {
    const d = dataRef.current;
    if (!d) return;
    if (!famRef.current) famRef.current = constFamilies(d.adj, d.canon.count);
    setFamOn((v) => !v);
  };

  // v10.2 — the dossier carries the Word itself: the whole chapter when it
  // fits, an honest preview when long, a pulsing orb while it travels.
  // Source resolution mirrors the reader's chain (primary first, then any
  // corpus whose declared canons cover the book) — DC stars read too.
  const inspectSeqRef = useRef(0);
  const dossierSourceChain = (bookId) => {
    const D = window.CODEX_DATA || {};
    const book = (D.books || []).find((b) => b.id === bookId);
    const primary = D.tweaks && D.tweaks.primaryTranslation || "web";
    const canonsOf = (t) => new Set(t.canons && t.canons.length ? t.canons : ["protestant"]);
    const covers = (t) => {
      const c = canonsOf(t);
      if (!book) return c.has("protestant");
      if (book.testament === "OT") return c.has("protestant") || c.has("ot");
      if (book.testament === "NT") return c.has("protestant") || c.has("nt");
      return c.has(book.canon);
    };
    const all = D.translations || [];
    const chain = [];
    const cur = all.find((t) => t.id === primary);
    if (cur && covers(cur)) chain.push(primary);
    all.forEach((t) => {if (t.id !== primary && covers(t)) chain.push(t.id);});
    return chain.length ? chain : [primary];
  };

  // v10 — the star dossier. Everything the graph knows about one chapter,
  // readable and actionable: testament, family, thread mass, strongest
  // neighbors (each clickable), READ / NEAR / PATH-FROM verbs.
  const inspect = (idx) => {
    const d = dataRef.current;
    if (!d || idx < 0 || idx >= d.canon.count) return;
    const c = d.canon.chapters[idx];
    const edges = d.adj.get(idx) || [];
    if (!famRef.current) famRef.current = constFamilies(d.adj, d.canon.count);
    const rows = edges.slice().sort((x, y) => y[1] - x[1]).slice(0, 8).
    map(([i2, w]) => ({ idx: i2, label: labelOf(i2), w }));
    selRef.current = idx;
    setHud(null);
    setInfo({
      idx,
      label: labelOf(idx),
      bookId: c.bookId,
      chapter: c.ch,
      testament: c.testament || "DC",
      fam: famRef.current.label[idx],
      degree: edges.length,
      threads: edges.reduce((s, [, w2]) => s + w2, 0),
      rows,
      text: { state: "loading" }
    });
    // fetch the chapter text — sequence-guarded so a fast second click
    // never paints a stale chapter into a fresh dossier
    const seq = ++inspectSeqRef.current;
    (async () => {
      for (const tr of dossierSourceChain(c.bookId)) {
        try {
          const vv = await window.BIBLE.loadChapter(c.bookId, c.ch, tr);
          if (vv && vv.length && vv.some((v) => v.text && v.text.trim())) {
            if (inspectSeqRef.current !== seq) return;
            setInfo((prev) => prev && prev.idx === idx ?
            { ...prev, text: { state: "ready", verses: vv, from: tr } } : prev);
            return;
          }
        } catch {/* next source */}
      }
      if (inspectSeqRef.current !== seq) return;
      setInfo((prev) => prev && prev.idx === idx ? { ...prev, text: { state: "none" } } : prev);
    })();
  };
  // test + automation hook (smoke uses this — canvas pixels can't be queried)
  useEffect(() => {
    window.codexConstInspect = (idx) => {inspect(idx);if (galaxyRef.current) flyTo(idx);};
    return () => {delete window.codexConstInspect;};
  });

  // ── GALAXY — the canon as navigable 3D space. The ONLY view since v9.3:
  // the 2D chord wheel is gone ("constellation only needs the galaxy").
  const [galaxyPct, setGalaxyPct] = useState(-1); // -1 idle · 0-99 laying out · 100 ready
  const galaxyRef = useRef(null); // Float32Array positions
  const camRef = useRef({ yaw: 0.6, pitch: 0.25, dist: 760, tx: 0, ty: 0, tz: 0 });
  const dragRef = useRef(null);
  const selRef = useRef(-1); // selected node
  const rafRef = useRef(0);
  const degRef = useRef(null); // node degree (sizes)
  const spriteRef = useRef({}); // hue → glow sprite canvas

  const enterGalaxy = async () => {
    const d = dataRef.current;
    if (!d) return;
    if (!famRef.current) famRef.current = constFamilies(d.adj, d.canon.count);
    if (!degRef.current) {
      const deg = new Float32Array(d.canon.count);
      d.adj.forEach((edges, i) => {deg[i] = edges.length;});
      degRef.current = deg;
    }
    if (!galaxyRef.current) {
      // cached layout?
      try {
        const raw = localStorage.getItem("codex.galaxy.v1");
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr) && arr.length === d.canon.count * 3) galaxyRef.current = Float32Array.from(arr);
        }
      } catch {}
    }
    if (!galaxyRef.current) {
      setGalaxyPct(0);
      const pos = await constGalaxyLayout(d.adj, d.pairs, d.canon.count, famRef.current.label, setGalaxyPct);
      galaxyRef.current = pos;
      try {localStorage.setItem("codex.galaxy.v1", JSON.stringify(Array.from(pos).map((n) => Math.round(n))));} catch {}
    }
    setGalaxyPct(100);
  };

  const glowSprite = (hue) => {
    if (spriteRef.current[hue]) return spriteRef.current[hue];
    const s = document.createElement("canvas");
    s.width = s.height = 32;
    const c = s.getContext("2d");
    const grad = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, hue);
    grad.addColorStop(0.35, hue + "99");
    grad.addColorStop(1, hue + "00");
    c.fillStyle = grad;
    c.fillRect(0, 0, 32, 32);
    spriteRef.current[hue] = s;
    return s;
  };

  // project a node → [sx, sy, scale] or null when behind the camera
  const project = (i, w, h) => {
    const p = galaxyRef.current,cam = camRef.current;
    let x = p[i * 3] - cam.tx,y = p[i * 3 + 1] - cam.ty,z = p[i * 3 + 2] - cam.tz;
    const cy = Math.cos(cam.yaw),sy = Math.sin(cam.yaw);
    const cx2 = Math.cos(cam.pitch),sx2 = Math.sin(cam.pitch);
    let x1 = x * cy - z * sy,z1 = x * sy + z * cy;
    let y1 = y * cx2 - z1 * sx2,z2 = y * sx2 + z1 * cx2;
    const zc = z2 + cam.dist;
    if (zc < 40) return null;
    const f = 620 / zc;
    return [w / 2 + x1 * f, h / 2 + y1 * f, f];
  };

  const drawGalaxy = () => {
    const canvas = canvasRef.current,d = dataRef.current;
    if (!canvas || !d || !galaxyRef.current) return;
    const { w, h } = I.intelCanvas.fit(canvas);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    const proj = new Array(d.canon.count);
    for (let i = 0; i < d.canon.count; i++) proj[i] = project(i, w, h);

    // edges — top set, depth + weight faded; NEAR/selection ignites its own
    const edges = d.pairs.slice(0, 3800);
    const wMax = edges.length ? edges[0][2] : 1;
    ctx.lineWidth = 0.6;
    for (let s = edges.length - 1; s >= 0; s--) {
      const [a, b, wt] = edges[s];
      const pa = proj[a],pb = proj[b];
      if (!pa || !pb) continue;
      const depth = Math.min(pa[2], pb[2]);
      const al = (0.025 + wt / wMax * 0.1) * Math.min(1, depth * 1.6);
      if (al < 0.015) continue;
      const ha = hueOf(a),hb = hueOf(b);
      ctx.strokeStyle = ha === hb ? ha : CONST_GOLD;
      ctx.globalAlpha = al;
      ctx.beginPath();ctx.moveTo(pa[0], pa[1]);ctx.lineTo(pb[0], pb[1]);ctx.stroke();
    }

    // ignition overlays (NEAR / selection / PATH)
    const igniteFrom = (idx, bright) => {
      (d.adj.get(idx) || []).forEach(([other, wt]) => {
        const pa = proj[idx],pb = proj[other];
        if (!pa || !pb) return;
        ctx.strokeStyle = hueOf(other);
        ctx.globalAlpha = Math.min(0.85, (bright ? 0.3 : 0.2) + wt * 0.05);
        ctx.lineWidth = 0.9;
        ctx.beginPath();ctx.moveTo(pa[0], pa[1]);ctx.lineTo(pb[0], pb[1]);ctx.stroke();
      });
    };
    if (near) igniteFrom(near.idx, true);
    if (selRef.current >= 0) igniteFrom(selRef.current, true);
    if (route && route.path.length > 1) {
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = CONST_GOLD;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      let started = false;
      route.path.forEach((idx) => {
        const p = proj[idx];
        if (!p) {started = false;return;}
        if (!started) {ctx.moveTo(p[0], p[1]);started = true;} else
        ctx.lineTo(p[0], p[1]);
      });
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // nodes — painter order by depth; glow sprites sized by degree
    const order = [];
    for (let i = 0; i < d.canon.count; i++) if (proj[i]) order.push(i);
    order.sort((a, b2) => proj[a][2] - proj[b2][2]);
    let trailSet = null;
    try {
      trailSet = new Set(JSON.parse(localStorage.getItem("codex.trail") || "[]").map((t) => {
        const p = window.CODEX_KERNEL && window.CODEX_KERNEL.parseRef(t.ref);
        return p ? d.canon.offset[p.bookId] + p.chapter - 1 : -1;
      }));
    } catch {}
    const deg = degRef.current;
    order.forEach((i) => {
      const [sx, sy, f] = proj[i];
      const base = 2.2 + Math.sqrt(deg[i] || 1) * 0.5;
      const size = Math.max(1.6, base * f * 1.6);
      const hue = trailSet && trailSet.has(i) ? CONST_GOLD : hueOf(i);
      ctx.globalAlpha = Math.min(1, 0.35 + f);
      ctx.drawImage(glowSprite(hue), sx - size, sy - size, size * 2, size * 2);
      if (i === selRef.current) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.beginPath();ctx.arc(sx, sy, size + 3, 0, Math.PI * 2);ctx.stroke();
      }
    });
    // proximity labels — the ~14 biggest on screen
    ctx.globalAlpha = 1;
    ctx.font = "600 9px ui-monospace, monospace";
    ctx.textAlign = "center";
    order.slice(-90).filter((i) => proj[i][2] > 0.85).slice(-14).forEach((i) => {
      const [sx, sy, f] = proj[i];
      const c = d.canon.chapters[i];
      ctx.fillStyle = hueOf(i);
      ctx.fillText(`${c.bookName.toUpperCase()} ${c.ch}`, sx, sy - (3 + Math.sqrt(deg[i] || 1) * f));
    });
    ctx.globalAlpha = 1;
  };

  // wheel dolly — attached non-passively so the page never scroll-fights
  useEffect(() => {
    if (phase !== "ready") return;
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = onGalaxyPointer.wheel;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [phase, galaxyPct]);

  // galaxy render loop — slow idle orbit, stops on unmount
  useEffect(() => {
    if (phase !== "ready" || galaxyPct < 100) return;
    let live = true;
    const reduced = I.intelReducedMotion();
    const tick = () => {
      if (!live) return;
      if (!dragRef.current && !reduced) camRef.current.yaw += 0.0007;
      drawGalaxy();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {live = false;cancelAnimationFrame(rafRef.current);};
  }, [phase, galaxyPct, famOn, near, route]);

  const galaxyHit = (mx, my) => {
    const canvas = canvasRef.current,d = dataRef.current;
    if (!canvas || !d || !galaxyRef.current) return -1;
    const r = canvas.getBoundingClientRect();
    let best = -1,bestD = 14;
    for (let i = 0; i < d.canon.count; i++) {
      const p = project(i, r.width, r.height);
      if (!p) continue;
      const dx = p[0] - mx,dy = p[1] - my;
      const dd = Math.hypot(dx, dy);
      if (dd < bestD) {bestD = dd;best = i;}
    }
    return best;
  };

  const flyTo = (idx) => {
    const p = galaxyRef.current,cam = camRef.current;
    if (!p) return;
    const from = { tx: cam.tx, ty: cam.ty, tz: cam.tz, dist: cam.dist };
    const to = { tx: p[idx * 3], ty: p[idx * 3 + 1], tz: p[idx * 3 + 2], dist: 300 };
    const T0 = performance.now();
    const DUR = I.intelReducedMotion() ? 0 : 700;
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const stepFly = (now) => {
      const t = DUR ? Math.min(1, (now - T0) / DUR) : 1;
      const e = ease(t);
      cam.tx = from.tx + (to.tx - from.tx) * e;
      cam.ty = from.ty + (to.ty - from.ty) * e;
      cam.tz = from.tz + (to.tz - from.tz) * e;
      cam.dist = from.dist + (to.dist - from.dist) * e;
      if (t < 1) requestAnimationFrame(stepFly);
    };
    requestAnimationFrame(stepFly);
  };

  const onGalaxyPointer = {
    down: (e) => {
      dragRef.current = { x: e.clientX, y: e.clientY, yaw: camRef.current.yaw, pitch: camRef.current.pitch, moved: false };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    move: (e) => {
      const dr = dragRef.current;
      if (dr) {
        const dx = e.clientX - dr.x,dy = e.clientY - dr.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) dr.moved = true;
        camRef.current.yaw = dr.yaw + dx * 0.005;
        camRef.current.pitch = Math.max(-1.4, Math.min(1.4, dr.pitch + dy * 0.005));
      }
    },
    up: (e) => {
      const dr = dragRef.current;
      dragRef.current = null;
      if (dr && !dr.moved) {
        const rect = canvasRef.current.getBoundingClientRect();
        const hit = galaxyHit(e.clientX - rect.left, e.clientY - rect.top);
        selRef.current = hit;
        if (hit >= 0) {
          inspect(hit);
          flyTo(hit);
        } else {setInfo(null);setHud(null);}
      }
    },
    dbl: (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      const hit = galaxyHit(e.clientX - rect.left, e.clientY - rect.top);
      if (hit >= 0 && window.codexJumpToRef) {
        window.codexJumpToRef(labelOf(hit));
        try {window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: `❂ ${labelOf(hit)}`, kind: "ok" } }));} catch {}
      }
    },
    wheel: (e) => {
      e.preventDefault();
      camRef.current.dist = Math.max(120, Math.min(2400, camRef.current.dist * (1 + e.deltaY * 0.0011)));
    }
  };
  // (famOn / route / near redraw via the galaxy render-loop deps above)

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
        if (!dead) {setErr(String(e.message || e));setPhase("error");}
      }
    })();
    return () => {dead = true;};
  }, []);

  // ESC closes
  useEffect(() => {
    const onKey = (e) => {if (e.key === "Escape") onClose();};
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Dossier-text styles — self-injected (one tag, idempotent) instead of
  // styles.css because a parallel build owns that file right now.
  // TODO: fold into styles.css at the next quiet moment.
  useEffect(() => {
    if (document.getElementById("cx-const-text-css")) return;
    const el = document.createElement("style");
    el.id = "cx-const-text-css";
    el.textContent = `
      .cx-const-info-text { margin: 8px 0 4px; max-height: 240px; overflow-y: auto; padding-right: 4px; }
      .cx-const-info-text p { font-family: var(--cx-serif, Georgia, serif); font-size: 13px; line-height: 1.55; color: var(--cx-fg); margin: 0 0 6px; }
      .cx-const-info-text p sup { font-family: var(--cx-mono); font-size: 8.5px; color: var(--cx-accent); margin-right: 5px; opacity: 0.8; }
      .cx-const-info-more, .cx-const-info-src { font-family: var(--cx-mono) !important; font-size: 9.5px !important; letter-spacing: 0.08em; color: var(--cx-fg-dim) !important; }
      .cx-const-info-text.is-loading { display: flex; align-items: center; gap: 8px; font-family: var(--cx-mono); font-size: 9.5px; letter-spacing: 0.12em; color: var(--cx-fg-dim); }
      .cx-const-orb { width: 10px; height: 10px; border-radius: 50%; flex: none;
        background: radial-gradient(circle, var(--cx-accent) 0%, color-mix(in oklab, var(--cx-accent) 40%, transparent) 60%, transparent 100%);
        animation: cx-orb-pulse 1.1s ease-in-out infinite; }
      @keyframes cx-orb-pulse { 0%, 100% { transform: scale(0.7); opacity: 0.5; } 50% { transform: scale(1.15); opacity: 1; } }
      @media (prefers-reduced-motion: reduce) { .cx-const-orb { animation: none; opacity: 0.9; } }
    `;
    document.head.appendChild(el);
  }, []);

  // ── Color: testament hues, or natural families when FAMILIES is on ─────
  const hueOf = (idx) => {
    if (famOn && famRef.current) {
      return CONST_FAMILY_HUES[famRef.current.label[idx] % CONST_FAMILY_HUES.length];
    }
    return dataRef.current.canon.chapters[idx].testament === "NT" ? CONST_NT_HUE : CONST_OT_HUE;
  };

  // the moment the canon is woven, enter the galaxy — there is no other view
  useEffect(() => {
    if (phase === "ready") enterGalaxy();
  }, [phase]);

  const d = dataRef.current;
  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-const-backdrop", onClick: onClose, role: "dialog", "aria-label": "The Constellation \u2014 the canon as one body" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-const", onClick: (e) => e.stopPropagation(), ref: wrapRef }, /*#__PURE__*/
    React.createElement("span", { className: "cx-corner cx-tl" }), /*#__PURE__*/React.createElement("span", { className: "cx-corner cx-tr" }), /*#__PURE__*/
    React.createElement("span", { className: "cx-corner cx-bl" }), /*#__PURE__*/React.createElement("span", { className: "cx-corner cx-br" }), /*#__PURE__*/

    React.createElement("header", { className: "cx-const-h" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-const-h-tag" }, "CODEX \xB7 CONSTELLATION"), /*#__PURE__*/
    React.createElement("span", { className: "cx-const-h-sub" }, "the canon as one galaxy \u2014 every thread of the Treasury, navigable space"), /*#__PURE__*/
    React.createElement("button", { className: "cx-const-x", onClick: onClose, "aria-label": "Close", title: "Close (ESC)" }, "\xD7")
    ), /*#__PURE__*/

    React.createElement(IntelBanner, { console: "CONSTELLATION", scope: "WHOLE CANON", note: "TREASURY OF SCRIPTURE KNOWLEDGE \xB7 PUBLIC DOMAIN \xB7 AGGREGATED IN FRONT OF YOU" }),

    phase === "loading" ? /*#__PURE__*/
    React.createElement("div", { className: "cx-const-loading" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-const-loading-ring", "aria-hidden": "true" }), /*#__PURE__*/
    React.createElement("span", null, "INDEXING THE CANON"), /*#__PURE__*/
    React.createElement("span", { className: "cx-const-loading-sub" }, progress.pct, "% \xB7 ", progress.threads.toLocaleString(), " threads woven")
    ) :
    phase === "error" ? /*#__PURE__*/
    React.createElement("div", { className: "cx-const-err" }, /*#__PURE__*/
    React.createElement("b", null, "THE LOOM IS DARK"), /*#__PURE__*/
    React.createElement("code", null, err), /*#__PURE__*/
    React.createElement("span", { className: "cx-const-err-hint" }, "The Treasury module (\u22485 MB) loads on first use \u2014 check your connection and reopen.")
    ) : /*#__PURE__*/

    React.createElement("div", { className: "cx-const-stage" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-const-tools" }, /*#__PURE__*/
    React.createElement("input", {
      className: "cx-const-q",
      placeholder: "PATH: \"Genesis 1 \u2192 Revelation 21\" \xB7 NEAR: \"Isaiah 53\" \xB7 \u21B5",
      value: query,
      onChange: (e) => setQuery(e.target.value),
      onKeyDown: (e) => {if (e.key === "Enter") {e.preventDefault();runQuery();}e.stopPropagation();},
      spellCheck: false,
      "aria-label": "Graph query \u2014 one ref for the neighborhood, two refs for a path" }
    ), /*#__PURE__*/
    React.createElement("button", {
      className: `cx-const-fam ${famOn ? "is-on" : ""}`,
      onClick: toggleFamilies,
      title: "Color the canon by its natural families (label propagation over the thread graph)" },
    "\u2726 FAMILIES", famOn && famRef.current ? ` · ${Math.min(famRef.current.families, CONST_FAMILY_HUES.length)}` : ""),
    route || near ? /*#__PURE__*/
    React.createElement("button", { className: "cx-const-clear", onClick: () => {setRoute(null);setNear(null);setQuery("");}, title: "Clear query" }, "\xD7") :
    null
    ),

    route ? /*#__PURE__*/
    React.createElement("div", { className: "cx-const-route", "aria-label": "Thread path" },
    route.labels.map((l, i) => /*#__PURE__*/
    React.createElement("span", { key: i, className: "cx-const-hop" }, /*#__PURE__*/
    React.createElement("button", { onClick: () => window.codexJumpToRef && window.codexJumpToRef(l), title: `Read ${l}` }, l),
    i < route.labels.length - 1 ? /*#__PURE__*/React.createElement("i", { "aria-hidden": "true" }, "\u2192") : null
    )
    ), /*#__PURE__*/
    React.createElement("small", null, route.path.length - 1, " hop", route.path.length > 2 ? "s" : "", " through the strongest threads")
    ) :
    null,

    near ? /*#__PURE__*/
    React.createElement("div", { className: "cx-const-near", "aria-label": "Strongest neighbors" }, /*#__PURE__*/
    React.createElement("b", null, near.label, " \u2014 strongest threads"), /*#__PURE__*/
    React.createElement("ul", null,
    near.rows.map((r) => /*#__PURE__*/
    React.createElement("li", { key: r.idx }, /*#__PURE__*/
    React.createElement("button", { onClick: () => window.codexJumpToRef && window.codexJumpToRef(r.label), title: `Read ${r.label}` }, r.label), /*#__PURE__*/
    React.createElement("span", null, r.w)
    )
    )
    )
    ) :
    null,
    galaxyPct >= 0 && galaxyPct < 100 ? /*#__PURE__*/
    React.createElement("div", { className: "cx-const-laying" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-const-loading-ring", "aria-hidden": "true" }), /*#__PURE__*/
    React.createElement("span", null, "LAYING OUT THE GALAXY \xB7 ", galaxyPct, "%")
    ) :
    null, /*#__PURE__*/
    React.createElement("canvas", {
      ref: canvasRef,
      className: "cx-const-canvas is-galaxy",
      onMouseMove: onGalaxyPointer.move,
      onPointerDown: onGalaxyPointer.down,
      onPointerUp: onGalaxyPointer.up,
      onDoubleClick: onGalaxyPointer.dbl,
      role: "img",
      "aria-label": "Galaxy \u2014 the canon as navigable 3D space" }
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-const-stats", "aria-hidden": "true" }, /*#__PURE__*/
    React.createElement("span", null, d ? d.canon.count.toLocaleString() : "—", " STARS"), /*#__PURE__*/
    React.createElement("span", null, d ? d.threads.toLocaleString() : "—", " THREADS"), /*#__PURE__*/
    React.createElement("span", null, "STARS SIZED BY THREAD-WEIGHT \xB7 YOUR TRAIL BURNS GOLD")
    ),
    info ? /*#__PURE__*/
    React.createElement("aside", { className: "cx-const-info", "aria-label": `${info.label} — star dossier` }, /*#__PURE__*/
    React.createElement("header", null, /*#__PURE__*/
    React.createElement("b", null, info.label.toUpperCase()), /*#__PURE__*/
    React.createElement("button", { className: "cx-const-info-x", onClick: () => {setInfo(null);selRef.current = -1;}, "aria-label": "Close dossier" }, "\xD7")
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-const-info-meta" }, /*#__PURE__*/
    React.createElement("span", { className: `is-${info.testament.toLowerCase()}` }, info.testament), /*#__PURE__*/
    React.createElement("span", null, "FAMILY ", info.fam + 1), /*#__PURE__*/
    React.createElement("span", null, info.degree, " LINKS"), /*#__PURE__*/
    React.createElement("span", null, info.threads.toLocaleString(), " THREADS")
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-const-info-verbs" }, /*#__PURE__*/
    React.createElement("button", { onClick: () => {
        // READ — structured jump (bookId+chapter), so apocrypha
        // and Greek additions open via the corpus workflow even
        // when their display names defeat the string parser.
        if (window.codexGoto) window.codexGoto(info.bookId, info.chapter, 1);else
        if (window.codexJumpToRef) window.codexJumpToRef(info.label);
        try {window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: `❂ ${info.label}`, kind: "ok" } }));} catch {}
      } }, "\u2726 READ"), /*#__PURE__*/
    React.createElement("button", { onClick: () => {setQuery(info.label);setRoute(null);
        const rows = info.rows.slice(0, 14);
        setNear({ idx: info.idx, label: info.label, rows });
      } }, "\u25C9 NEAR"), /*#__PURE__*/
    React.createElement("button", { onClick: () => {setQuery(`${info.label} → `);setInfo(null);},
      title: "Start a PATH query from this star" }, "\u2316 PATH FROM")
    ),


    info.text && info.text.state === "loading" ? /*#__PURE__*/
    React.createElement("div", { className: "cx-const-info-text is-loading", role: "status", "aria-label": "Fetching the chapter" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-const-orb", "aria-hidden": "true" }), /*#__PURE__*/
    React.createElement("span", null, "FETCHING THE WORD\u2026")
    ) :
    info.text && info.text.state === "ready" ? /*#__PURE__*/
    React.createElement("div", { className: "cx-const-info-text", "aria-label": `${info.label} — text` },
    (info.text.verses.length <= 14 ? info.text.verses : info.text.verses.slice(0, 6)).map((v) => /*#__PURE__*/
    React.createElement("p", { key: v.n }, /*#__PURE__*/React.createElement("sup", null, v.n), v.text)
    ),
    info.text.verses.length > 14 ? /*#__PURE__*/
    React.createElement("p", { className: "cx-const-info-more" }, "\u22EF ", info.text.verses.length - 6, " more verses \u2014 \u2726 READ opens the whole chapter") :
    null,
    (() => {
      const primary = window.CODEX_DATA && window.CODEX_DATA.tweaks && window.CODEX_DATA.tweaks.primaryTranslation || "web";
      return info.text.from && info.text.from !== primary ? /*#__PURE__*/
      React.createElement("p", { className: "cx-const-info-src" }, "\u21C4 served from ", String(info.text.from).toUpperCase()) :
      null;
    })()
    ) :
    info.text && info.text.state === "none" ? /*#__PURE__*/
    React.createElement("p", { className: "cx-const-info-none" }, "No source carries this chapter yet \u2014 the corpus is still growing.") :
    null,
    info.rows.length ? /*#__PURE__*/
    React.createElement("ul", { className: "cx-const-info-rows" },
    info.rows.map((r) => /*#__PURE__*/
    React.createElement("li", { key: r.idx }, /*#__PURE__*/
    React.createElement("button", { onClick: () => {inspect(r.idx);flyTo(r.idx);}, title: `Inspect ${r.label}` }, r.label), /*#__PURE__*/
    React.createElement("span", null, r.w)
    )
    )
    ) : /*#__PURE__*/

    React.createElement("p", { className: "cx-const-info-none" }, "No Treasury threads touch this chapter \u2014 it sits outside the 66-book TSK web. \u2726 READ still opens it.")

    ) :
    hud ? /*#__PURE__*/
    React.createElement("div", { className: "cx-const-hud" }, /*#__PURE__*/
    React.createElement("b", null, hud.label), /*#__PURE__*/
    React.createElement("span", null, hud.threads.toLocaleString(), " threads \xB7 double-click to read")
    ) : /*#__PURE__*/

    React.createElement("div", { className: "cx-const-hud is-idle" }, /*#__PURE__*/
    React.createElement("span", null, "drag to orbit \xB7 scroll to dive \xB7 click a star for its dossier \xB7 double-click to read \xB7 your trail burns gold")
    )

    )

    )
    ));

}

Object.assign(window, { VerseConstellation });
})();
