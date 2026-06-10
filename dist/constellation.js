// GENERATED from constellation.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
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
const CONST_GOLD = "#ffd479";
const CONST_TOP_CHORDS = 6000;
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
  const baseRef = useRef(null); // offscreen base layer
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState("loading"); // loading | ready | error
  const [progress, setProgress] = useState({ pct: 0, threads: 0 });
  const [err, setErr] = useState(null);
  const dataRef = useRef(null); // { canon, pairs, adj, threads }
  const geoRef = useRef(null); // { cx, cy, R, angles[] }
  const hoverRef = useRef({ chapter: -1, book: -1 });
  const [hud, setHud] = useState(null); // { label, threads } | null

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
    } else {
      const a = idxOf(text);
      if (a < 0) {setHud({ label: "UNREADABLE REF", threads: 0 });return;}
      const rows = (d.adj.get(a) || []).slice().sort((x, y) => y[1] - x[1]).slice(0, 14).
      map(([idx, w]) => ({ idx, label: labelOf(idx), w }));
      setNear({ idx: a, label: labelOf(a), rows });
      if (view === "galaxy" && galaxyRef.current) {selRef.current = a;flyTo(a);}
    }
    if (view !== "galaxy") requestAnimationFrame(blit);
  };

  const toggleFamilies = () => {
    const d = dataRef.current;
    if (!d) return;
    if (!famRef.current) famRef.current = constFamilies(d.adj, d.canon.count);
    setFamOn((v) => !v);
  };

  // ── GALAXY — the same graph as navigable 3D space ─────────────────────
  const [view, setView] = useState("ring"); // ring | galaxy
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
    setView("galaxy");
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
    if (view !== "galaxy") return;
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = onGalaxyPointer.wheel;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [view, galaxyPct]);

  // galaxy render loop — slow idle orbit, stops on unmount / view switch
  useEffect(() => {
    if (view !== "galaxy" || galaxyPct < 100) return;
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
  }, [view, galaxyPct, famOn, near, route]);

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
          const d = dataRef.current;
          const edges = d.adj.get(hit) || [];
          setHud({ label: labelOf(hit).toUpperCase(), threads: edges.reduce((s, [, w2]) => s + w2, 0) });
          flyTo(hit);
        } else setHud(null);
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
  // re-render the base when the color mode flips
  useEffect(() => {if (phase === "ready") renderBase();}, [famOn]);
  // redraw overlays when route/near change
  useEffect(() => {if (phase === "ready") requestAnimationFrame(blit);}, [route, near]);

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

  // ── Geometry: chapter → angle (gaps between books), xy on the ring ─────
  const computeGeo = (w, h) => {
    const d = dataRef.current;
    if (!d) return null;
    const cx = w / 2,cy = h / 2;
    const R = Math.min(w, h) / 2 - 44;
    const BOOK_GAP = Math.PI * 2 * 0.0016;
    const total = d.canon.count;
    const gaps = d.canon.books.length * BOOK_GAP;
    const per = (Math.PI * 2 - gaps) / total;
    const angles = new Array(total);
    let a = -Math.PI / 2; // start at 12 o'clock, Genesis
    d.canon.books.forEach((b) => {
      const off = d.canon.offset[b.id];
      for (let c = 0; c < b.chapters; c++) {angles[off + c] = a + per / 2;a += per;}
      a += BOOK_GAP;
    });
    return { cx, cy, R, angles, per };
  };
  const xyOf = (idx, r) => {
    const g = geoRef.current;
    const a = g.angles[idx];
    return [g.cx + Math.cos(a) * r, g.cy + Math.sin(a) * r];
  };
  const hueOf = (idx) => {
    if (famOn && famRef.current) {
      return CONST_FAMILY_HUES[famRef.current.label[idx] % CONST_FAMILY_HUES.length];
    }
    return dataRef.current.canon.chapters[idx].testament === "NT" ? CONST_NT_HUE : CONST_OT_HUE;
  };

  // One chord — quadratic toward the center, pulled harder for far pairs.
  const chord = (ctx, a, b, color, alpha, width) => {
    const g = geoRef.current;
    const [x1, y1] = xyOf(a, g.R),[x2, y2] = xyOf(b, g.R);
    const da = Math.abs(g.angles[a] - g.angles[b]);
    const span = Math.min(da, Math.PI * 2 - da) / Math.PI; // 0..1
    const k = 1 - (0.15 + span * 0.8); // far pairs dive deep
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
    const canvas = canvasRef.current,d = dataRef.current;
    if (!canvas || !d) return;
    const { w, h } = I.intelCanvas.fit(canvas);
    geoRef.current = computeGeo(w, h);
    const g = geoRef.current;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    if (!baseRef.current) baseRef.current = document.createElement("canvas");
    const base = baseRef.current;
    base.width = w * dpr;base.height = h * dpr;
    const ctx = base.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // chords — heaviest first so fine threads sit on top of the glow mass
    const top = d.pairs.slice(0, CONST_TOP_CHORDS);
    const wMax = top.length ? top[0][2] : 1;
    for (let i = top.length - 1; i >= 0; i--) {
      const [a, b, wt] = top[i];
      const t = wt / wMax;
      // same hue → that family/testament color; mixed → the gold seam
      const ha = hueOf(a),hb = hueOf(b);
      const color = ha === hb ? ha : CONST_GOLD;
      chord(ctx, a, b, color, 0.028 + t * 0.16, 0.5 + t * 0.9);
    }
    ctx.globalAlpha = 1;

    // ring: book arcs + chapter ticks
    d.canon.books.forEach((b) => {
      const off = d.canon.offset[b.id];
      const a0 = g.angles[off] - g.per / 2;
      const a1 = g.angles[off + b.chapters - 1] + g.per / 2;
      ctx.strokeStyle = famOn ? hueOf(off) : b.testament === "NT" ? CONST_NT_HUE : CONST_OT_HUE;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 2.5;
      ctx.beginPath();ctx.arc(g.cx, g.cy, g.R + 6, a0, a1);ctx.stroke();
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
    const canvas = canvasRef.current,d = dataRef.current,g = geoRef.current;
    if (!canvas || !d || !g) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = canvas.width / dpr,h = canvas.height / dpr;
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
        ctx.shadowColor = CONST_GOLD;ctx.shadowBlur = 6;
        ctx.beginPath();ctx.arc(x, y, 2, 0, Math.PI * 2);ctx.fill();
        ctx.shadowBlur = 0;
      });
    } catch {}

    // PATH overlay — the route burns gold over a dimmed field
    if (route && route.path.length > 1) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      for (let i = 0; i < route.path.length - 1; i++) {
        chord(ctx, route.path[i], route.path[i + 1], CONST_GOLD, 0.95, 2.2);
      }
      ctx.globalAlpha = 1;
      route.path.forEach((idx, i) => {
        const [x, y] = xyOf(idx, g.R + 6);
        ctx.fillStyle = i === 0 || i === route.path.length - 1 ? "#fff" : CONST_GOLD;
        ctx.shadowColor = CONST_GOLD;ctx.shadowBlur = 12;
        ctx.beginPath();ctx.arc(x, y, i === 0 || i === route.path.length - 1 ? 4 : 2.8, 0, Math.PI * 2);ctx.fill();
        ctx.shadowBlur = 0;
      });
    }

    // NEAR overlay — the ego-network ignites
    if (near) {
      (dataRef.current.adj.get(near.idx) || []).forEach(([other, wt]) => {
        chord(ctx, near.idx, other, hueOf(other), Math.min(0.8, 0.25 + wt * 0.05), 0.8);
      });
      const [x, y] = xyOf(near.idx, g.R + 6);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff";
      ctx.shadowColor = CONST_GOLD;ctx.shadowBlur = 12;
      ctx.beginPath();ctx.arc(x, y, 4, 0, Math.PI * 2);ctx.fill();
      ctx.shadowBlur = 0;
    }

    // hover ignition
    const hv = hoverRef.current;
    const ignite = [];
    if (hv.chapter >= 0) ignite.push(hv.chapter);else
    if (hv.book >= 0) {
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
        ctx.shadowColor = hueOf(idx);ctx.shadowBlur = 10;
        ctx.beginPath();ctx.arc(x, y, 2.6, 0, Math.PI * 2);ctx.fill();
        ctx.shadowBlur = 0;
      });
    }
    ctx.globalAlpha = 1;
  };

  // pointer → chapter / book band
  const hitTest = (mx, my) => {
    const g = geoRef.current,d = dataRef.current;
    if (!g || !d) return { chapter: -1, book: -1 };
    const dx = mx - g.cx,dy = my - g.cy;
    const r = Math.hypot(dx, dy);
    if (r < g.R - 26 || r > g.R + 30) return { chapter: -1, book: -1 };
    let ang = Math.atan2(dy, dx);
    // nearest chapter by angle
    let best = -1,bestD = Infinity;
    for (let i = 0; i < g.angles.length; i++) {
      let da = Math.abs(ang - g.angles[i]);
      if (da > Math.PI) da = Math.PI * 2 - da;
      if (da < bestD) {bestD = da;best = i;}
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
      for (let c = 0; c < b.chapters; c++) (d.adj.get(off + c) || []).forEach(([, w]) => {threads += w;});
      setHud({ label: b.name.toUpperCase(), threads });
    } else setHud(null);
    requestAnimationFrame(blit);
  };

  const onClick = () => {
    const hv = hoverRef.current,d = dataRef.current;
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
      try {window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: `◉ ${target}`, kind: "ok" } }));} catch {}
    }
  };

  // render base once ready; re-render on resize
  useEffect(() => {
    if (phase !== "ready") return;
    renderBase();
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    let t = 0;
    const ro = new ResizeObserver(() => {clearTimeout(t);t = setTimeout(renderBase, 120);});
    ro.observe(canvas);
    return () => {ro.disconnect();clearTimeout(t);};
  }, [phase]);

  const d = dataRef.current;
  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-const-backdrop", onClick: onClose, role: "dialog", "aria-label": "The Constellation \u2014 the canon as one body" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-const", onClick: (e) => e.stopPropagation(), ref: wrapRef }, /*#__PURE__*/
    React.createElement("span", { className: "cx-corner cx-tl" }), /*#__PURE__*/React.createElement("span", { className: "cx-corner cx-tr" }), /*#__PURE__*/
    React.createElement("span", { className: "cx-corner cx-bl" }), /*#__PURE__*/React.createElement("span", { className: "cx-corner cx-br" }), /*#__PURE__*/

    React.createElement("header", { className: "cx-const-h" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-const-h-tag" }, "CODEX \xB7 CONSTELLATION"), /*#__PURE__*/
    React.createElement("span", { className: "cx-const-h-sub" }, "the canon as one body \u2014 every thread of the Treasury, drawn live"), /*#__PURE__*/
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
    React.createElement("button", {
      className: "cx-const-fam",
      onClick: () => {
        if (view === "ring") enterGalaxy();else
        {setView("ring");requestAnimationFrame(renderBase);}
      },
      title: view === "ring" ? "Galaxy — fly the canon in 3D" : "Ring — the chord wheel" },
    view === "ring" ? "❂ GALAXY" : "◐ RING"), /*#__PURE__*/
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
    React.createElement("button", { className: "cx-const-clear", onClick: () => {setRoute(null);setNear(null);setQuery("");requestAnimationFrame(blit);}, title: "Clear query" }, "\xD7") :
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
    view === "galaxy" && galaxyPct >= 0 && galaxyPct < 100 ? /*#__PURE__*/
    React.createElement("div", { className: "cx-const-laying" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-const-loading-ring", "aria-hidden": "true" }), /*#__PURE__*/
    React.createElement("span", null, "LAYING OUT THE GALAXY \xB7 ", galaxyPct, "%")
    ) :
    null, /*#__PURE__*/
    React.createElement("canvas", {
      ref: canvasRef,
      className: `cx-const-canvas ${view === "galaxy" ? "is-galaxy" : ""}`,
      onMouseMove: view === "ring" ? onMove : onGalaxyPointer.move,
      onMouseLeave: view === "ring" ? () => {hoverRef.current = { chapter: -1, book: -1 };setHud(null);requestAnimationFrame(blit);} : undefined,
      onClick: view === "ring" ? onClick : undefined,
      onPointerDown: view === "galaxy" ? onGalaxyPointer.down : undefined,
      onPointerUp: view === "galaxy" ? onGalaxyPointer.up : undefined,
      onDoubleClick: view === "galaxy" ? onGalaxyPointer.dbl : undefined,
      role: "img",
      "aria-label": view === "galaxy" ? "Galaxy — the canon as navigable 3D space" : "Chord wheel of all cross-references in the canon" }
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-const-stats", "aria-hidden": "true" }, /*#__PURE__*/
    React.createElement("span", null, d ? d.canon.count.toLocaleString() : "—", " CHAPTERS"), /*#__PURE__*/
    React.createElement("span", null, d ? d.threads.toLocaleString() : "—", " THREADS"), /*#__PURE__*/
    React.createElement("span", null, "TOP ", CONST_TOP_CHORDS.toLocaleString(), " DRAWN \xB7 ALL IGNITE ON HOVER")
    ),
    hud ? /*#__PURE__*/
    React.createElement("div", { className: "cx-const-hud" }, /*#__PURE__*/
    React.createElement("b", null, hud.label), /*#__PURE__*/
    React.createElement("span", null, hud.threads.toLocaleString(), " threads \xB7 click to read")
    ) : /*#__PURE__*/

    React.createElement("div", { className: "cx-const-hud is-idle" }, /*#__PURE__*/
    React.createElement("span", null, view === "galaxy" ?
    "drag to orbit · scroll to dive · click a star to approach · double-click to read · your trail burns gold" :
    "hover the ring · OT speaks cyan, NT amber, the covenant seam gold · your trail burns gold on the rim")
    )

    )

    )
    ));

}

Object.assign(window, { VerseConstellation });
})();
