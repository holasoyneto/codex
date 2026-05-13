// CODEX — verse art · paintings, illustrations, manuscripts depicting the scene.
//
// Sister to verse-map.jsx. Asks Claude to surface 6–8 notable artworks for the
// verse, then renders them as a grid of cards. Thumbnails come from Wikimedia
// Commons (`Special:FilePath/<file>?width=` redirects to the file) when the
// model knows the filename; otherwise the card shows a stylised placeholder
// with the metadata. Cached forever in localStorage by verse.
//
// "+ MORE" makes a follow-up call passing the list of titles already shown so
// Claude returns a different set rather than repeating itself.

const ART_PROMPT = `You are CODEX ART — a visual-arts curator for biblical passages. For the given verse, identify notable paintings, frescoes, illuminated manuscripts, sculptures, or films that depict THIS specific scene. Return a single JSON object. No prose, no fences, only the JSON.

Schema:
{
  "scene":   "1 sentence naming the scene depicted (e.g. 'The Annunciation to Mary').",
  "works": [
    {
      "title":       "Work title",
      "artist":      "Artist name (or 'Anonymous')",
      "year":        <integer year, BCE negative — best estimate>,
      "medium":      "e.g. 'oil on canvas', 'fresco', 'illuminated manuscript', 'film'",
      "location":    "Museum / collection / location if known, else ''",
      "commonsFile": "Wikimedia Commons filename if you are confident it exists (e.g. 'Caravaggio_-_The_Calling_of_Saint_Matthew.jpg'). Empty string if unsure.",
      "wikipedia":   "Wikipedia article title if known (English), else ''",
      "summary":     "2 sentences on composition + significance — calm, scholarly.",
      "themes":      "3–5 short visual themes, comma-separated"
    }
  ]
}

Rules:
- 6–8 works. Span eras (Byzantine → Renaissance → Baroque → Modern → Contemporary) when plausible.
- Only include works whose existence and attribution you are confident in.
- commonsFile must be a real file you have seen referenced; otherwise leave empty (placeholder will show).
- Calm scholarly tone. No exclamations, no emoji.
- Return ONLY the JSON object.`;

const ART_MORE_PROMPT = (excludeTitles) => `Same task as before — return MORE artworks for the same verse, in the same JSON schema. EXCLUDE these already-shown titles: ${excludeTitles.map(t => `"${t}"`).join(", ")}. Aim for different artists, eras, or media. 6 new works.`;

// Walks the text from the start, tracking the deepest fully-balanced cursor.
// On a JSON.parse failure rewinds to that point, strips trailing comma, and
// closes any still-open brackets — recovers a partial works[] from a
// truncated response without losing earlier valid entries.
function tolerantParse(s) {
  try { return JSON.parse(s); } catch {}
  let inString = false, escape = false;
  const stk = [];
  let lastSafe = 0, safeStack = [];
  const mark = (idx) => { lastSafe = idx; safeStack = stk.slice(); };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (inString) {
      if (c === "\\") { escape = true; continue; }
      if (c === "\"") { inString = false; mark(i + 1); }
      continue;
    }
    if (c === "\"") { inString = true; continue; }
    if (c === "{" || c === "[") stk.push(c === "{" ? "}" : "]");
    else if (c === "}" || c === "]") { stk.pop(); mark(i + 1); }
    else if (c === ",") mark(i);
    else if (/[\d.eE+\-tfn ul]/.test(c)) mark(i + 1);
  }
  let head = s.slice(0, lastSafe).replace(/[,\s]+$/, "");
  head = head.replace(/,?\s*"[^"]*"\s*:\s*$/, "");
  return JSON.parse(head + safeStack.reverse().join(""));
}

function VerseArt({ verse, refStr, verseText, passage, primary, onClose }) {
  const key = `codex.art.${passage.bookId}.${passage.chapter}.${verse?.n}`;
  const [data, setData]    = useState(() => {
    try { const raw = localStorage.getItem(key); if (raw) return JSON.parse(raw); }
    catch {}
    return null;
  });
  const [err, setErr]      = useState(null);
  const [loading, setLoading] = useState(!data);
  const [moreBusy, setMoreBusy] = useState(false);

  // Initial fetch
  useEffect(() => {
    if (data) return;
    let cancelled = false;
    fetchArt({ excludeTitles: [] })
      .then(obj => { if (!cancelled) { setData(obj); setLoading(false); persist(obj); } })
      .catch(e   => { if (!cancelled) { setErr(String(e.message || e)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [key]);

  // ESC closes
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function persist(obj) { try { localStorage.setItem(key, JSON.stringify(obj)); } catch {} }

  async function fetchArt({ excludeTitles, append }) {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        system: ART_PROMPT,
        messages: [{
          role: "user",
          content: excludeTitles?.length
            ? `Verse: ${refStr}\nText: ${verseText}\n\n${ART_MORE_PROMPT(excludeTitles)}`
            : `Verse: ${refStr}\nText: ${verseText}\n\nReturn the JSON object.`,
        }],
        max_tokens: 2400,
      }),
    });
    const body = await r.json();
    if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
    const text = (body.text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const i = text.indexOf("{");
    if (i === -1) throw new Error("Art response not JSON");
    return tolerantParse(text.slice(i));
  }

  async function loadMore() {
    if (moreBusy || !data?.works) return;
    setMoreBusy(true);
    try {
      const exclude = data.works.map(w => w.title);
      const more = await fetchArt({ excludeTitles: exclude, append: true });
      const merged = {
        scene: data.scene,
        works: [...data.works, ...(more.works || [])],
      };
      setData(merged);
      persist(merged);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setMoreBusy(false);
    }
  }

  return (
    <div className="cx-art-backdrop" onClick={onClose} role="dialog" aria-label="Verse artworks">
      <div className="cx-art" onClick={e => e.stopPropagation()}>
        <span className="cx-corner cx-tl" />
        <span className="cx-corner cx-tr" />
        <span className="cx-corner cx-bl" />
        <span className="cx-corner cx-br" />

        <header className="cx-art-h">
          <span className="cx-art-h-tag">CODEX · ART</span>
          <span className="cx-art-h-ref">{refStr}</span>
          {data?.scene ? <span className="cx-art-h-scene">— {data.scene}</span> : null}
          <button className="cx-art-x" onClick={onClose} aria-label="Close" title="Close (ESC)">×</button>
        </header>

        {loading ? (
          <div className="cx-art-loading">
            <div className="cx-art-spin"><i/><i/><i/><i/></div>
            <span>SURVEYING · PAINTINGS · ILLUMINATIONS · FILMS</span>
            <span className="cx-art-loading-sub">querying the visual record across two millennia…</span>
          </div>
        ) : err ? (
          <div className="cx-art-err">
            <b>ART ORACLE OFFLINE</b>
            <code>{err}</code>
          </div>
        ) : data ? (
          <>
            <div className="cx-art-grid">
              {(data.works || []).map((w, i) => <ArtCard key={`${w.title}-${i}`} work={w} />)}
            </div>
            <footer className="cx-art-foot">
              <span className="cx-art-foot-count">{data.works?.length || 0} works</span>
              <button
                className="cx-art-more"
                onClick={loadMore}
                disabled={moreBusy}
                title="Surface more artworks for this verse"
              >{moreBusy ? "loading…" : "+ MORE"}</button>
            </footer>
          </>
        ) : null}
      </div>
    </div>
  );
}

// Multi-source image resolver — tries every path Wikimedia exposes before
// falling back to placeholder. Each result memoised in module scope so
// repeat opens of the same artwork (or other cards citing the same artist)
// don't refetch.
const _artImgCache = new Map();
async function resolveArtImage(work) {
  const key = `${work.commonsFile || ""}|${work.wikipedia || ""}|${work.title}|${work.artist}`;
  if (_artImgCache.has(key)) return _artImgCache.get(key);
  const result = await (async () => {
    // 1. Direct Commons file path (Claude's most-confident hint)
    if (work.commonsFile) {
      const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(work.commonsFile)}?width=600`;
      if (await preloadImg(url)) return url;
    }
    // 2. Wikipedia article summary by article title (most reliable signal)
    if (work.wikipedia) {
      const t = work.wikipedia.replace(/ /g, "_");
      const url = await wikiThumb(t);
      if (url) return url;
    }
    // 3. Summary lookup by the work's title alone
    if (work.title) {
      const url = await wikiThumb(work.title.replace(/ /g, "_"));
      if (url) return url;
    }
    // 4. Title + artist combined (catches "<artist>'s <work>" article titles)
    if (work.title && work.artist) {
      const combo = `${work.title} ${work.artist}`.replace(/ /g, "_");
      const url = await wikiThumb(combo);
      if (url) return url;
    }
    // 5. Commons MediaWiki search — last resort, finds any matching file
    try {
      const q = `${work.title} ${work.artist || ""}`.trim();
      const r = await fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srnamespace=6&format=json&origin=*`,
        { headers: { "Accept": "application/json" } }
      );
      if (r.ok) {
        const j = await r.json();
        const first = j?.query?.search?.[0]?.title;
        if (first) {
          const file = first.replace(/^File:/, "");
          const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=600`;
          if (await preloadImg(url)) return url;
        }
      }
    } catch {}
    return null;
  })();
  _artImgCache.set(key, result);
  return result;
}
async function preloadImg(src) {
  return new Promise(res => {
    const img = new Image();
    img.onload  = () => res(true);
    img.onerror = () => res(false);
    img.src = src;
  });
}
async function wikiThumb(slug) {
  try {
    const r = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`,
      { headers: { "Accept": "application/json" } }
    );
    if (!r.ok) return null;
    const j = await r.json();
    return j.thumbnail?.source || j.originalimage?.source || null;
  } catch { return null; }
}

function ArtCard({ work }) {
  const [src, setSrc] = useState(null);
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setResolving(true);
    resolveArtImage(work).then(url => {
      if (!cancelled) { setSrc(url); setResolving(false); }
    });
    return () => { cancelled = true; };
  }, [work.title, work.artist, work.commonsFile, work.wikipedia]);

  const wikiHref = work.wikipedia
    ? `https://en.wikipedia.org/wiki/${encodeURIComponent(work.wikipedia.replace(/ /g, "_"))}`
    : work.commonsFile
      ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(work.commonsFile)}`
      : `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${work.title} ${work.artist}`)}`;
  const yr = (() => {
    if (!work.year && work.year !== 0) return "";
    const n = Math.abs(work.year);
    return `${n} ${work.year < 0 ? "BCE" : "CE"}`;
  })();

  return (
    <a className="cx-art-card" href={wikiHref} target="_blank" rel="noopener noreferrer" title={`Open ${work.title}`}>
      <div className="cx-art-card-img" data-loading={resolving ? "1" : null}>
        {src ? (
          <img src={src} alt={`${work.title} — ${work.artist}`} loading="lazy"
               onError={() => setSrc(null)} />
        ) : resolving ? (
          <div className="cx-art-placeholder">
            <span className="cx-art-placeholder-frame">
              <span className="cx-art-placeholder-glyph">⟳</span>
            </span>
            <span className="cx-art-placeholder-l">searching wikimedia…</span>
          </div>
        ) : (
          <div className="cx-art-placeholder">
            <span className="cx-art-placeholder-frame">
              <span className="cx-art-placeholder-glyph">◬</span>
            </span>
            <span className="cx-art-placeholder-l">no image catalogued</span>
          </div>
        )}
      </div>
      <div className="cx-art-card-meta">
        <h4 className="cx-art-card-title">{work.title}</h4>
        <div className="cx-art-card-attrib">
          <span className="cx-art-card-artist">{work.artist || "Anonymous"}</span>
          {yr ? <span className="cx-art-card-year">· {yr}</span> : null}
        </div>
        {(work.medium || work.location) ? (
          <div className="cx-art-card-tech">
            {work.medium ? <span>{work.medium}</span> : null}
            {work.medium && work.location ? <span> · </span> : null}
            {work.location ? <span>{work.location}</span> : null}
          </div>
        ) : null}
        {work.summary ? <p className="cx-art-card-summary">{work.summary}</p> : null}
        {work.themes ? <div className="cx-art-card-themes">{work.themes}</div> : null}
      </div>
    </a>
  );
}

Object.assign(window, { VerseArt });
