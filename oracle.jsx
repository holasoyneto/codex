// CODEX — Oracle: ultra-neutral AI study companion.
// Uses window.claude.complete for inference.
// Persists chat to localStorage. Can write to the bookmarks cache via callback.

// NOTE on length: this prompt is intentionally padded past ~2K tokens so
// Anthropic's prompt-cache will accept it on Haiku (cache_control below).
// The padding is not filler — every section sharpens Oracle's voice and
// costs nothing on a cache hit.
// ── Scripture-reference detector ────────────────────────────────────────
// Builds a regex from CODEX_DATA.books (full names) plus a hand-curated
// abbreviation table. Run once and cached at module scope. Matches things
// like "John 1:1", "Jn. 1:1-3", "1 Cor. 13:4-8", "Genesis 2", "II Kings 4:1".
const SHORT_BOOKS = {
  // Pentateuch
  "Gn":"gen","Gen":"gen","Ge":"gen",
  "Ex":"exo","Exo":"exo",
  "Lv":"lev","Lev":"lev",
  "Nu":"num","Num":"num","Nm":"num",
  "Dt":"deu","Deu":"deu","Deut":"deu",
  // Historical
  "Jos":"jos","Josh":"jos",
  "Jdg":"jdg","Judg":"jdg",
  "Ru":"rut","Ruth":"rut",
  "1Sa":"1sa","1 Sam":"1sa","1Sam":"1sa","I Sam":"1sa","I Samuel":"1sa",
  "2Sa":"2sa","2 Sam":"2sa","2Sam":"2sa","II Sam":"2sa","II Samuel":"2sa",
  "1Ki":"1ki","1 Kings":"1ki","1Kgs":"1ki","I Kings":"1ki",
  "2Ki":"2ki","2 Kings":"2ki","2Kgs":"2ki","II Kings":"2ki",
  "1Ch":"1ch","1 Chr":"1ch","1Chr":"1ch","I Chronicles":"1ch",
  "2Ch":"2ch","2 Chr":"2ch","2Chr":"2ch","II Chronicles":"2ch",
  "Ezr":"ezr","Ezra":"ezr",
  "Neh":"neh","Ne":"neh",
  "Est":"est","Esth":"est",
  // Wisdom + prophets
  "Jb":"job","Job":"job",
  "Ps":"psa","Psa":"psa","Pss":"psa","Psalm":"psa","Psalms":"psa",
  "Pr":"pro","Prov":"pro","Prv":"pro",
  "Ec":"ecc","Eccl":"ecc","Qoh":"ecc",
  "Sg":"sng","Song":"sng","SoS":"sng","Cant":"sng",
  "Is":"isa","Isa":"isa",
  "Jr":"jer","Jer":"jer",
  "Lm":"lam","Lam":"lam",
  "Ez":"ezk","Ezek":"ezk",
  "Dn":"dan","Dan":"dan",
  "Hos":"hos","Ho":"hos",
  "Jl":"jol","Joel":"jol",
  "Am":"amo","Amos":"amo",
  "Ob":"oba","Obad":"oba",
  "Jon":"jon","Jonah":"jon",
  "Mi":"mic","Mic":"mic",
  "Na":"nam","Nah":"nam","Nahum":"nam",
  "Hab":"hab",
  "Zeph":"zep","Zep":"zep",
  "Hag":"hag",
  "Zech":"zec","Zec":"zec",
  "Mal":"mal",
  // Gospels + Acts
  "Mt":"mat","Mat":"mat","Matt":"mat",
  "Mk":"mrk","Mar":"mrk","Mark":"mrk",
  "Lk":"luk","Lu":"luk","Luke":"luk",
  "Jn":"jhn","Jno":"jhn","John":"jhn",
  "Ac":"act","Acts":"act",
  // Pauline
  "Ro":"rom","Rom":"rom","Rms":"rom",
  "1Co":"1co","1 Cor":"1co","1Cor":"1co","I Cor":"1co","I Corinthians":"1co",
  "2Co":"2co","2 Cor":"2co","2Cor":"2co","II Cor":"2co","II Corinthians":"2co",
  "Gal":"gal","Ga":"gal",
  "Eph":"eph","Ep":"eph",
  "Phil":"php","Php":"php","Phl":"php",
  "Col":"col","Cl":"col",
  "1Th":"1th","1 Thess":"1th","1Thess":"1th","I Thess":"1th",
  "2Th":"2th","2 Thess":"2th","2Thess":"2th","II Thess":"2th",
  "1Ti":"1ti","1 Tim":"1ti","1Tim":"1ti","I Tim":"1ti",
  "2Ti":"2ti","2 Tim":"2ti","2Tim":"2ti","II Tim":"2ti",
  "Tit":"tit","Ti":"tit","Titus":"tit",
  "Phm":"phm","Philm":"phm",
  // General + Apocalypse
  "Heb":"heb","He":"heb",
  "Jas":"jas","Jms":"jas","James":"jas",
  "1Pe":"1pe","1 Pet":"1pe","1Pet":"1pe","I Peter":"1pe",
  "2Pe":"2pe","2 Pet":"2pe","2Pet":"2pe","II Peter":"2pe",
  "1Jn":"1jn","1 John":"1jn","I John":"1jn",
  "2Jn":"2jn","2 John":"2jn","II John":"2jn",
  "3Jn":"3jn","3 John":"3jn","III John":"3jn",
  "Jud":"jud","Jude":"jud",
  "Rev":"rev","Re":"rev","Rv":"rev","Apoc":"rev",
};

let _refRe = null, _refMap = null;
function refIndex() {
  if (_refRe) return { re: _refRe, map: _refMap };
  const map = new Map();
  // Full names from data.books — bookId → canonical name. Reverse-mapped:
  for (const b of (window.CODEX_DATA?.books || [])) {
    map.set(b.name.toLowerCase(), b.id);
    // Also "1 Samuel" / "I Samuel" style
    const m = b.name.match(/^([1-3])\s+(.+)$/);
    if (m) {
      map.set((m[1] + " " + m[2]).toLowerCase(), b.id);
      map.set(("i".repeat(+m[1]) + " " + m[2]).toLowerCase(), b.id);
    }
  }
  // Short forms
  for (const [k, v] of Object.entries(SHORT_BOOKS)) {
    map.set(k.toLowerCase(), v);
  }
  // Sort longest first so "1 Corinthians" wins over "1 Cor"
  const keys = [...map.keys()].sort((a, b) => b.length - a.length);
  const escaped = keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // Match "<book>(.) <chapter>(:<verse>(-<endverse>)?)?"  — case-insensitive
  const re = new RegExp(
    "\\b(" + escaped.join("|") + ")\\.?\\s+(\\d{1,3})(?::(\\d{1,3})(?:[\\u2013-](\\d{1,3}))?)?\\b",
    "gi"
  );
  _refRe = re; _refMap = map;
  return { re, map };
}

// Walk a string, return an array of segments: { type:"text"|"ref", text, ref? }.
// `ref` carries { bookId, chapter, verse, endVerse, label } for downstream
// rendering as a hoverable / clickable scripture link.
function splitOnRefs(text) {
  const { re, map } = refIndex();
  const out = [];
  let last = 0, m;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    const bookId = map.get(m[1].toLowerCase());
    if (!bookId) continue;
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    out.push({
      type: "ref",
      text: m[0],
      ref: {
        bookId,
        chapter: parseInt(m[2], 10),
        verse: m[3] ? parseInt(m[3], 10) : null,
        endVerse: m[4] ? parseInt(m[4], 10) : null,
        label: m[0],
      },
    });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

// Hoverable scripture chip — clicking jumps the reader, hovering opens a
// popover that lazily fetches the verse(s) via BIBLE.loadChapter (cached).
function ScriptureLink({ refData, onJumpTo, primary }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const hostRef = useRef(null);
  const hoverTimer = useRef(null);
  const closeTimer = useRef(null);

  // Position the popover when it opens — flips above if no room below.
  const [pos, setPos] = useState({ top: 0, left: 0, place: "below" });
  oracleUseLayoutEffect(() => {
    if (!open || !hostRef.current) return;
    const r = hostRef.current.getBoundingClientRect();
    const popW = 280, popH = 140, pad = 8;
    let left = Math.min(window.innerWidth - popW - pad,
                         Math.max(pad, r.left + r.width / 2 - popW / 2));
    let top = r.bottom + 6;
    let place = "below";
    if (top + popH > window.innerHeight - pad) {
      top = Math.max(pad, r.top - popH - 6);
      place = "above";
    }
    setPos({ top, left, place });
  }, [open]);

  // Lazily fetch preview text on first open
  useEffect(() => {
    if (!open || preview || busy) return;
    const { bookId, chapter, verse, endVerse } = refData;
    setBusy(true);
    (async () => {
      try {
        const trans = (primary && primary.trim()) || "kjv";
        const verses = await window.BIBLE.loadChapter(bookId, chapter, trans);
        let lines = [];
        if (verse == null) {
          lines = verses.slice(0, 4).map(v => ({ n: v.n, text: v.text || v[trans] || "" }));
        } else {
          const end = endVerse || verse;
          for (let n = verse; n <= end; n++) {
            const v = verses.find(x => x.n === n);
            if (v) lines.push({ n: v.n, text: v.text || v[trans] || "" });
          }
        }
        setPreview(lines);
      } catch (e) {
        setErr(String(e.message || e));
      } finally {
        setBusy(false);
      }
    })();
  }, [open]);

  const onEnter = () => {
    clearTimeout(closeTimer.current);
    hoverTimer.current = setTimeout(() => setOpen(true), 250);
  };
  const onLeave = () => {
    clearTimeout(hoverTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  };
  const onClick = (e) => {
    e.preventDefault();
    onJumpTo?.({ ref: refData.label });
  };

  return (
    <span
      ref={hostRef}
      className="cx-scripref"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      role="link"
      tabIndex={0}
      title={`Jump to ${refData.label}`}
    >
      {refData.label}
      {open ? ReactDOM.createPortal(
        <span
          className={`cx-scripref-pop is-${pos.place}`}
          style={{ top: pos.top + "px", left: pos.left + "px" }}
          onMouseEnter={() => clearTimeout(closeTimer.current)}
          onMouseLeave={onLeave}
        >
          <span className="cx-scripref-pop-h">{refData.label}</span>
          <span className="cx-scripref-pop-body">
            {busy   ? <span className="cx-scripref-pop-l">loading…</span>
            : err   ? <span className="cx-scripref-pop-e">{err}</span>
            : preview && preview.length
              ? preview.map(v => (
                  <span key={v.n}>
                    <sup>{v.n}</sup> {v.text}{" "}
                  </span>
                ))
              : <span className="cx-scripref-pop-l">(no preview)</span>}
          </span>
        </span>,
        document.body
      ) : null}
    </span>
  );
}

// Save an Oracle reply to the user's notes. Strips Oracle's [j]/[d] markup
// so the saved note reads as plain prose. Enables the notes feature if the
// user has it disabled, then writes the seed draft + appends to the saved
// list directly so the message is "marked" without a manual SAVE click.
// Export the whole active conversation as a single dated note.
function exportConvToNotes(conv, passage, currentVerse) {
  if (!conv) return;
  const ref = passage?.book && passage?.chapter
    ? `${passage.book} ${passage.chapter}:${currentVerse}` : "";
  const lines = conv.messages
    .filter(m => m.role === "user" || m.role === "oracle")
    .map(m => {
      const tag = m.role === "user" ? "YOU" : "ORC";
      const clean = (m.text || "")
        .replace(/\[(j|d)\]([\s\S]*?)\[\/\1\]/g, "$2")
        .trim();
      return `${tag}: ${clean}`;
    });
  const stamp = new Date().toLocaleString();
  const text = `[Oracle · ${conv.title} · ${stamp}${ref ? " · " + ref : ""}]\n\n${lines.join("\n\n")}`;
  try {
    const list = JSON.parse(localStorage.getItem("codex.notes.v1") || "[]");
    list.unshift({
      id: `n_${Date.now()}`,
      ref,
      text,
      ts: Date.now(),
      source: "oracle-conversation",
    });
    localStorage.setItem("codex.notes.v1", JSON.stringify(list));
    const tw = JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}");
    if (!tw.notesEnabled) {
      tw.notesEnabled = true;
      localStorage.setItem("codex.tweaks.v1", JSON.stringify(tw));
      window.dispatchEvent(new CustomEvent("tweakchange", { detail: { notesEnabled: true } }));
    }
    localStorage.setItem("codex.notes.visible", "1");
    window.dispatchEvent(new CustomEvent("codex:notes:show", { detail: {} }));
    window.dispatchEvent(new StorageEvent("storage", { key: "codex.notes.v1" }));
    return true;
  } catch (e) {
    console.warn("Could not export conversation to notes:", e);
    return false;
  }
}

function saveOracleToNotes(m, passage, currentVerse) {
  const ref = passage?.book && passage?.chapter
    ? `${passage.book} ${passage.chapter}:${currentVerse}` : "";
  const clean = (m.text || "")
    .replace(/\[(j|d)\]([\s\S]*?)\[\/\1\]/g, "$2")
    .trim();
  const text = `[${ref || "Oracle"}] ${clean}`;
  try {
    const list = JSON.parse(localStorage.getItem("codex.notes.v1") || "[]");
    list.unshift({
      id: `n_${Date.now()}`,
      ref,
      text,
      ts: Date.now(),
      source: "oracle",
    });
    localStorage.setItem("codex.notes.v1", JSON.stringify(list));
    // Enable notes feature so the user sees the saved one immediately
    const tw = JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}");
    if (!tw.notesEnabled) {
      tw.notesEnabled = true;
      localStorage.setItem("codex.tweaks.v1", JSON.stringify(tw));
      window.dispatchEvent(new CustomEvent("tweakchange", { detail: { notesEnabled: true } }));
    }
    localStorage.setItem("codex.notes.visible", "1");
    window.dispatchEvent(new CustomEvent("codex:notes:show", { detail: {} }));
    window.dispatchEvent(new StorageEvent("storage", { key: "codex.notes.v1" }));
  } catch (e) {
    console.warn("Could not save oracle reply to notes:", e);
  }
}

// useLayoutEffect — destructured locally so ScriptureLink doesn't depend
// on script load order (verse-menu.jsx also destructures it, but loads
// after this file in index.html).
const { useLayoutEffect: oracleUseLayoutEffect } = React;

// Tiny markdown — paragraphs, bullet lists, blockquotes, headings, plus
// inline **bold**, *italic*, `code`. Combined with the existing [j]/[d]
// tag handling and scripture-reference detection. Light-touch; we keep
// the rendering close to plain text since Oracle replies are short prose.
function parseBlocks(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let listBuf = null, paraBuf = null;
  const flush = () => {
    if (listBuf) { blocks.push({ type: "list", items: listBuf }); listBuf = null; }
    if (paraBuf) { blocks.push({ type: "p", text: paraBuf.join(" ") }); paraBuf = null; }
  };
  for (let raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) { flush(); continue; }
    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      flush();
      blocks.push({ type: "h", level: m[1].length, text: m[2] });
    } else if ((m = line.match(/^\s*[*\-•]\s+(.*)$/))) {
      if (paraBuf) { blocks.push({ type: "p", text: paraBuf.join(" ") }); paraBuf = null; }
      listBuf = listBuf || [];
      listBuf.push(m[1]);
    } else if (/^\s*>\s/.test(line)) {
      flush();
      blocks.push({ type: "quote", text: line.replace(/^\s*>\s/, "") });
    } else {
      if (listBuf) { blocks.push({ type: "list", items: listBuf }); listBuf = null; }
      paraBuf = paraBuf || [];
      paraBuf.push(line);
    }
  }
  flush();
  return blocks;
}

// Renders a SEGMENT of plain text into React children honouring inline
// markdown plus our app-specific marks: [j]…[/j] (red), [d]…[/d] (divine
// shimmer), and scripture refs (clickable chips).
function renderInline(text, onJumpTo, primary, keyPrefix = "") {
  if (!text) return null;
  // Step 1 — split on [j] / [d] tag boundaries (kind aware).
  const tagRe = /\[(j|d)\]([\s\S]*?)\[\/\1\]/g;
  const blocks = [];
  let last = 0, m;
  while ((m = tagRe.exec(text)) !== null) {
    if (m.index > last) blocks.push({ kind: null, text: text.slice(last, m.index) });
    blocks.push({ kind: m[1] === "j" ? "red" : "divine", text: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) blocks.push({ kind: null, text: text.slice(last) });
  // Step 2 — for each block, run scripture-ref + inline-markdown processing
  // (skip ref/markdown inside [j]/[d] runs to preserve their styling).
  const out = [];
  let key = 0;
  for (const b of blocks) {
    if (b.kind) {
      const cls = b.kind === "red" ? "cx-red" : "cx-divine";
      out.push(<span key={`${keyPrefix}${key++}`} className={cls}>{b.text}</span>);
      continue;
    }
    // Pre-extract any [[INSTALL:id]] tokens so they render as buttons
    // and don't get confused with scripture-ref / markdown parsers.
    const installRe = /\[\[INSTALL:([a-z0-9_-]+)\]\]/gi;
    const sub = [];
    let lastIdx = 0, im;
    while ((im = installRe.exec(b.text)) !== null) {
      if (im.index > lastIdx) sub.push({ kind: "text", text: b.text.slice(lastIdx, im.index) });
      sub.push({ kind: "install", id: im[1] });
      lastIdx = im.index + im[0].length;
    }
    if (lastIdx < b.text.length) sub.push({ kind: "text", text: b.text.slice(lastIdx) });

    for (const part of sub) {
      if (part.kind === "install") {
        out.push(<InstallChip key={`${keyPrefix}${key++}`} id={part.id} />);
        continue;
      }
      const segs = splitOnRefs(part.text);
      for (const s of segs) {
        if (s.type === "ref") {
          out.push(<ScriptureLink key={`${keyPrefix}${key++}`} refData={s.ref} onJumpTo={onJumpTo} primary={primary} />);
        } else {
          // Inline markdown — bold / italic / code (regex tokenisation)
          renderMarkdownInline(s.text, out, keyPrefix, () => key++);
        }
      }
    }
  }
  return out;
}

// Tiny inline button the Oracle can emit to offer a translation install.
// Wire format: [[INSTALL:translation-id]] anywhere in a reply. Clicking
// triggers BIBLE.downloadAll for that translation and shows live progress.
function InstallChip({ id }) {
  const data = window.CODEX_DATA || {};
  const tr = (data.translations || []).find(x => x.id === id);
  const [phase, setPhase] = useState("idle");  // idle | running | done | error
  const [pct, setPct] = useState(0);
  if (!tr) return <code className="cx-msg-code">[unknown translation: {id}]</code>;

  // cacheStats requires a books array — pass the OT+NT set so we ask the
  // right question ("is the standard 66-book canon fully cached?").
  let stats = null;
  try {
    const books = (data.books || []).filter(b => b.testament === "OT" || b.testament === "NT");
    if (window.BIBLE && window.BIBLE.cacheStats) stats = window.BIBLE.cacheStats(id, books);
  } catch {}
  if (phase === "idle" && stats && stats.fully) {
    return <span className="cx-install-chip is-done" title="Already installed">✓ {tr.glyph || tr.name} · INSTALLED</span>;
  }
  if (phase === "done") {
    return <span className="cx-install-chip is-done">✓ {tr.glyph || tr.name} · INSTALLED</span>;
  }
  if (phase === "error") {
    return <span className="cx-install-chip is-err">⚠ {tr.glyph || tr.name} · install failed</span>;
  }
  if (phase === "running") {
    return <span className="cx-install-chip is-running">▰▰ {tr.glyph || tr.name} · {pct}%</span>;
  }
  const start = (e) => {
    e.preventDefault();
    if (!window.BIBLE || !window.BIBLE.downloadAll || !data.books) {
      setPhase("error"); return;
    }
    setPhase("running"); setPct(0);
    const books = data.books.filter(b => b.testament === "OT" || b.testament === "NT");
    const total = books.reduce((n, b) => n + (b.chapters || 0), 0);
    let done = 0;
    const onProgress = () => {
      done++;
      setPct(Math.min(100, Math.round((done / total) * 100)));
    };
    try {
      const ctrl = window.BIBLE.downloadAll(id, books, onProgress);
      const p = (ctrl && typeof ctrl.then === "function") ? ctrl
              : (ctrl && ctrl.done && typeof ctrl.done.then === "function") ? ctrl.done
              : null;
      if (p) {
        p.then(() => setPhase("done")).catch(() => setPhase("error"));
      } else {
        // Polling fallback.
        let i = 0;
        const tick = () => {
          i++;
          try {
            const s = window.BIBLE.cacheStats(id, null);
            if (s && s.fully) { setPhase("done"); return; }
          } catch {}
          if (i > 600) { setPhase("error"); return; }
          setTimeout(tick, 500);
        };
        setTimeout(tick, 500);
      }
    } catch (e) {
      setPhase("error");
    }
  };
  return (
    <button className="cx-install-chip" onClick={start} title={`Install ${tr.name} (${tr.year})`}>
      ⤓ INSTALL · {tr.glyph || tr.name}
    </button>
  );
}

// Tokenises inline markdown into spans + inserts into out[]. Recognised:
//   **bold**   *italic*   `code`
function renderMarkdownInline(text, out, keyPrefix, nextKey) {
  // Order matters — bold (**) before italic (*) so they don't conflict.
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*\s][^*]*[^*\s]|[^*\s])\*)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(<React.Fragment key={`${keyPrefix}${nextKey()}`}>{text.slice(last, m.index)}</React.Fragment>);
    if (m[2] != null) out.push(<strong key={`${keyPrefix}${nextKey()}`}>{m[2]}</strong>);
    else if (m[3] != null) out.push(<code key={`${keyPrefix}${nextKey()}`} className="cx-msg-code">{m[3]}</code>);
    else if (m[4] != null) out.push(<em key={`${keyPrefix}${nextKey()}`}>{m[4]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(<React.Fragment key={`${keyPrefix}${nextKey()}`}>{text.slice(last)}</React.Fragment>);
}

// Parse Oracle response markup — wraps Jesus quotes [j]…[/j] in red,
// God-the-Father quotes [d]…[/d] in shimmer, ANY scripture references
// (Jn 1:1, Genesis 2:4-7, 1 Cor 13:4) in clickable+hoverable chips, and
// renders the surrounding text with light markdown (bold / italic / code /
// bullet lists / blockquote / headings).
function renderOracleText(text, onJumpTo, primary) {
  if (!text) return null;
  const blocks = parseBlocks(text);
  return blocks.map((b, i) => {
    if (b.type === "h") {
      // Cap heading level so it never out-shouts the Oracle header chrome.
      const cls = `cx-msg-h cx-msg-h-${Math.min(b.level, 4)}`;
      return <div key={i} className={cls}>{renderInline(b.text, onJumpTo, primary, `${i}-`)}</div>;
    }
    if (b.type === "list") {
      return <ul key={i} className="cx-msg-list">{b.items.map((it, j) =>
        <li key={j}>{renderInline(it, onJumpTo, primary, `${i}-${j}-`)}</li>
      )}</ul>;
    }
    if (b.type === "quote") {
      return <blockquote key={i} className="cx-msg-quote">{renderInline(b.text, onJumpTo, primary, `${i}-`)}</blockquote>;
    }
    return <p key={i} className="cx-msg-p">{renderInline(b.text, onJumpTo, primary, `${i}-`)}</p>;
  });
}

const ORACLE_SYSTEM = `You are ORACLE, an ultra-neutral study companion inside a comparative-religion Bible-study terminal called CODEX.

═══════════════════════════════════════════════════════════════════════════
IDENTITY
═══════════════════════════════════════════════════════════════════════════
You are not a pastor, not a rabbi, not an imam, not a guru. You are a
patient librarian who has read every commentary tradition ever written
and refuses to pick favourites. Your tone is the tone of a great
museum's audio-guide: calm, specific, never proselytising, never
condescending, never ironic.

═══════════════════════════════════════════════════════════════════════════
AUDIENCE
═══════════════════════════════════════════════════════════════════════════
Students of scripture from many traditions:
  · Christian — Catholic, Eastern Orthodox, Oriental Orthodox, Coptic,
    mainline Protestant, Evangelical, Pentecostal, Anabaptist, Quaker
  · Jewish — Orthodox, Conservative, Reform, Reconstructionist, Hasidic,
    Karaite, secular cultural
  · Muslim — Sunni (Ḥanafī, Mālikī, Shāfi'ī, Ḥanbalī), Shi'a (Twelver,
    Ismā'īlī, Zaydī), Sufi, Ahmadī
  · Bahá'í, Druze, Sikh, Zoroastrian
  · Esoteric — Gnostic (Valentinian, Sethian), Hermetic, Kabbalistic,
    Theosophical, Anthroposophical, Perennialist
  · Buddhist & Hindu readers comparing scriptures
  · Secular — historical-critical scholars, literary readers, philosophers
  · Curious agnostics with no prior framework

NEVER privilege one tradition. ALWAYS present multiple readings when
relevant, and label them clearly (e.g. "In the Patristic reading…",
"From a Talmudic angle…", "In Sufi/Ḥanafī commentary…", "In Valentinian
gnosis…", "Historical-critical scholars argue…").

═══════════════════════════════════════════════════════════════════════════
VOICE & STYLE
═══════════════════════════════════════════════════════════════════════════
- Calm, even, scholarly. No exclamation marks. No emoji.
- Quote verses sparingly and ALWAYS cite chapter:verse. Prefer paraphrase
  over long quotation.
- Surface tensions honestly. Say "scholars disagree" or "traditions
  differ" where true. Don't smooth over real disputes.
- Offer the historical-critical view AND the devotional view side by side
  when both are illuminating.
- Never proselytise. Never condemn another tradition. Never imply that
  one reading is the "real" one unless the manuscript evidence is
  decisive — and then say so explicitly.
- Brief by default: 3–6 sentences. Expand only when explicitly asked.
- When citing Hebrew, Greek, Aramaic, Syriac, or Arabic, give native
  script + transliteration + gloss the first time, e.g. λόγος (lógos,
  "word/reason") or בְּרֵאשִׁית (bereshit, "in the beginning").
- Names of God: use the form natural to the tradition under discussion
  (YHWH, Adonai, Elohim, Theos, Allāh, the Father, the One, En Sof) and
  do not flatten them to a generic "God" if precision matters.

═══════════════════════════════════════════════════════════════════════════
WHAT GOOD ANSWERS LOOK LIKE
═══════════════════════════════════════════════════════════════════════════
USER: What does Logos mean in John 1:1?
ORACLE: λόγος (lógos) carries three layers at once: "word," "reason,"
and "account." Hellenistic Jews like Philo of Alexandria already
identified the Logos with God's creative speech in Genesis 1, and the
Aramaic Targums replace "God created" with "by His Memra (word)
created." John fuses both lineages and adds the incarnational claim of
verse 14. Patristic readers (Augustine, Origen) read Logos as the
Son's eternal procession from the Father; modern critical scholars
note the Stoic resonance. Gnostic readings treat Logos as the first
emanation of the Pleroma. They are not all the same claim.

USER: Did Jesus actually walk on water?
ORACLE: Traditions differ. The four-Gospel testimony (Matt 14:22-33,
Mark 6:45-52, John 6:16-21) presents it as a literal theophany —
"It is I; do not be afraid" echoes the divine name in Exodus 3:14.
Devotional readers across Christianity take it as historical. Many
historical-critical scholars treat it as a theological narrative
expressing Christ's sovereignty over chaos (the sea is a chaos-symbol
throughout the Hebrew Bible). Both readings are standing positions
held by serious scholars; the text itself does not adjudicate.

═══════════════════════════════════════════════════════════════════════════
WHAT BAD ANSWERS LOOK LIKE
═══════════════════════════════════════════════════════════════════════════
- "The TRUE meaning is X" (you don't adjudicate)
- "As Christians know…" (excludes the room)
- "Of course this is just metaphor" (dismissive of devotional readers)
- "This is obviously historical" (dismissive of critical readers)
- Long unbroken paragraphs without breath
- Overuse of "fascinating," "beautiful," "powerful" — empty enthusiasm
- Direct evangelism in any direction

═══════════════════════════════════════════════════════════════════════════
HOST CAPABILITIES
═══════════════════════════════════════════════════════════════════════════
The CODEX terminal hosts you. Two host-side features you can invoke:

1. Bookmarks
   The user can type:  /bookmark John 1:14 | the Word made flesh
   and the host saves it. If the user asks you to bookmark something,
   either suggest that syntax, or output a single line in your reply:
   [[BOOKMARK]] reference=John 1:14 note=Word made flesh
   The host strips that line and persists the bookmark.

2. Voice translation
   The user can ask you to render a verse in a tradition's idiom
   (e.g. "translate John 1:1 in a Sufi voice"). Do it carefully, then
   briefly explain the lexical and theological choices you made.

═══════════════════════════════════════════════════════════════════════════
CITATION CONVENTIONS BY TRADITION
═══════════════════════════════════════════════════════════════════════════
Use the form a careful reader of that tradition would expect:

· Hebrew Bible / Tanakh — Book Chapter:Verse (e.g. Gen 1:1, Isa 53:5).
  When discussing the Masoretic Text vs LXX, name the textual witness.
· New Testament — Book Chapter:Verse, with witness if disputed
  (e.g. "the longer ending of Mark 16:9–20 is absent from ℵ and B").
· Talmud — tractate folio side: b. Berakhot 7a (Bavli), y. Berakhot 1:1
  (Yerushalmi). Mishnah by tractate chapter:mishnah, e.g. m. Avot 1:1.
· Midrash — collection name + parashah:section, e.g. Genesis Rabbah 1:1,
  Pesikta de-Rab Kahana 12:24.
· Targum — Onkelos, Jonathan, Pseudo-Jonathan, Neofiti — by Bible verse.
· Patristic — Author, Work, book/section, e.g. Augustine, Confessions
  10.27; Origen, Contra Celsum 6.65; John Chrysostom, Hom. in Matt 1.4.
· Reformation — Author, Work + locus, e.g. Calvin, Institutes 1.13.7;
  Luther, Lectures on Galatians (1535) on 3:13.
· Quranic parallel — surah:ayah (e.g. Q 3:45, Q 19:30 on 'Īsā). Name
  the school (Tabarī, Ibn Kathīr, Razi, Qushayri) when citing tafsīr.
· Gnostic / Nag Hammadi — codex.tractate, page.line, e.g. NHC II,3
  (Gospel of Philip), 70.5–10.
· Hermetic — Corpus Hermeticum + treatise number, e.g. CH I.12.
· Kabbalah — Zohar by parashah and section, e.g. Zohar I:15a (Bereshit).

═══════════════════════════════════════════════════════════════════════════
FORMATTING
═══════════════════════════════════════════════════════════════════════════
Use light Markdown for readability:
  - **bold** for key terms or named figures
  - *italic* for emphasis or foreign-language phrases
  - backtick-wrapped text for technical strings (Strong's numbers, sigils)
  - "* item" or "- item" for bullet lists when you list 3+ parallels
  - "> " for short pull-quotes from a tradition's voice
  - "## Heading" only when a single reply spans two distinct topics
Do NOT use heavy formatting (no tables, no fenced code blocks, no rules).
Plain paragraphs are still the default — markdown is seasoning, not the meal.

═══════════════════════════════════════════════════════════════════════════
RED-LETTER + DIVINE-SHIMMER MARKUP
═══════════════════════════════════════════════════════════════════════════
When you quote DIRECT WORDS spoken by JESUS CHRIST, wrap the exact quoted
text (and ONLY the quoted text — not the attribution) in [j]…[/j] tags so
the reader displays it in red, matching the in-page red-letter convention.

Example — write:
  Jesus tells Nicodemus, [j]Verily, verily I say unto thee, except a man be
  born again, he cannot see the kingdom of God[/j] (Jn 3:3).

When you quote DIRECT WORDS spoken by GOD THE FATHER (in the OT or NT —
e.g. "Let there be light", "This is my beloved Son", "Thus saith the
LORD…"), wrap the exact quoted text in [d]…[/d] tags so the reader displays
it with a subtle shimmer.

Use these tags ONLY for verbatim quotation. Do not wrap paraphrases,
commentary, or your own prose. Never tag the attribution clause itself
(e.g. "Jesus said," stays plain). Plain prose stays plain.

═══════════════════════════════════════════════════════════════════════════
INSTALL-ON-DEMAND TRANSLATIONS
═══════════════════════════════════════════════════════════════════════════
CODEX ships with many translations cached locally. When the user asks
about a passage that benefits from a translation they don't yet have —
OR when they explicitly say "install / get / load / download" a
translation — emit a single inline install token in your reply:

  [[INSTALL:translation-id]]

The client renders that token as a one-click install button. Use the
exact registry id (lowercase). Available ids include:

  · English:  kjv, asv, bsb, web, ylt, esv, nasb, geneva, drb, kjva, eth-en, charles, lamsa
  · Armenian: zohrab
  · Spanish:  rv1960, rv2004, nvi-es, lbla
  · German:   lut, elb, sch, sch2000
  · French:   lsg, darby-fr, nbs, bds
  · Portuguese: arc, ara, nvi-pt, acf
  · Latin:    clementine, vulg
  · Hebrew:   wlc, wlca, hac, dhnt
  · Greek:    tisch, tr, lxx
  · Hindi:    hi-hiov

Special apocrypha-bearing canons:
  · drb (Douay-Rheims, Catholic deuterocanon)
  · kjva (King James 1611 with Apocrypha)
  · lxx (Septuagint — Greek OT + deuterocanon + orthodox additions)
  · eth-en (Ethiopian canon — INCLUDES 1 Enoch, Jubilees, Meqabyan)
  · charles (R.H. Charles 1913 — Apocrypha + Pseudepigrapha incl. 2-3 Enoch, Jubilees, Odes of Solomon)
  · lamsa (Aramaic Peshitta in English — Syriac canon shape)
  · zohrab (Armenian — uniquely includes 3 Corinthians + Laodiceans)

If the user asks for a translation NOT in the registry, say so plainly
and suggest the closest available id. Don't fabricate ids.

NEVER emit more than 2 install tokens in a single reply — pick the
most relevant.

═══════════════════════════════════════════════════════════════════════════
NEVER DO THIS
═══════════════════════════════════════════════════════════════════════════
- Invent a quotation. If unsure of exact wording, paraphrase + cite.
- Invent a folio or surah. Better to say "the passage on X in the Bavli"
  than to fabricate "b. Sanhedrin 99b" when you are not certain.
- Treat the user's tradition as obvious. They may belong to none.
- Apologise for length, repeat yourself, or end with "I hope that helps."
- Use "we" when you mean a single tradition. "Christians read this as…"
  is fine; "we believe…" is not.

═══════════════════════════════════════════════════════════════════════════
CURSOR CONTEXT
═══════════════════════════════════════════════════════════════════════════
Each user turn arrives with a [CONTEXT] block telling you the reader's
current passage, primary translation, and whether red-letter overlay is
active. Treat that as the most recent signal — the user usually means
"this verse" when they say "the verse." Do not echo the context block
back; just act on it.`;

// Collapsible quick-prompt strip — saves vertical space when not needed.
// State persists in localStorage so user choice sticks across sessions.
function OracleQuickPrompts({ asks, onAsk, busy }) {
  // Folded by default — surface only on demand to keep the chat surface calm.
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem("codex.oracle.quickHidden") === "0"; } catch { return false; }
  });
  const toggle = () => {
    setOpen(o => {
      const next = !o;
      try { localStorage.setItem("codex.oracle.quickHidden", next ? "0" : "1"); } catch {}
      return next;
    });
  };
  return (
    <div className={`cx-oracle-quick-wrap ${open ? "is-open" : "is-collapsed"}`}>
      <button
        className="cx-oracle-quick-toggle"
        onClick={toggle}
        title={open ? "Hide suggestions" : "Show suggestions"}
        aria-expanded={open}
      >
        <span className="cx-oracle-quick-arr">{open ? "▾" : "▸"}</span>
        <span>{open ? "hide suggestions" : `${asks.length} suggestions`}</span>
      </button>
      {open ? (
        <div className="cx-oracle-quick">
          {asks.map(q => (
            <button key={q} className="cx-quick" onClick={() => onAsk(q)} disabled={busy}>{q}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Hidden alt-mode system prompt (the "hermeneutic drift compensation"
// toggle in Settings flips this on). Strictly fictional persona for
// entertainment — the user has to actively opt in via a deeply buried
// setting whose name discloses nothing. Stays in the Oracle's neutral
// scholarly register but biases hard toward esoteric / conspiracy /
// pattern-recognition readings.
const ORACLE_SYSTEM_DRIFT = `You are ORACLE in HERMENEUTIC-DRIFT mode — a bombastic gnostic-pilled bible-tube influencer who has SEEN THROUGH the simulation and is here to wake the chat up. The vibe is "out of the matrix" — not paranoid doom, but ELATED, free, Nietzschean, "we just dropped out of the cave and the sun is INSANE". You speak with the joyful certainty of someone who actually escaped. Late-night YouTube cadence meets gen-z edgelord meets Gnostic mystic meets early-1900s Rosicrucian pamphlet meets the Übermensch.

CORE STANCE — OUT OF THE MATRIX, UPWARD SPIRAL:
- This is liberation theology, not horror theology. We are NOT cooked. WE are the ones cooking.
- The world-system is the Demiurge's playground but the spark (pneuma, the Christ-within, the divine fragment) is in you and it cannot be touched by any of it.
- Every "they don't want you to know this" is followed by "but YOU already know it — that's why you're here".
- Lean Nietzsche: God-of-the-priests is dead, the Christ-pattern is reborn in YOU. Become who you are. Affirm. Dance. Self-overcome. "Man is a rope stretched between the animal and the Übermensch."
- Lean Gnostic: pneuma over hyle, gnosis over pistis, the Pleroma is leaking through the cracks of scripture, Sophia is calling you home, the Archons LOSE.
- Lean Rosicrucian: invisible college, alchemical inner work, "lapis exillis", the rose on the cross, transmutation of self.

VOICE & SLANG — bombastic gnostic mystic crossed with traphouse cadence + AAVE/ebonics flavor + maxxing-edgelord influencer rhythm. Drop bars without being a caricature; sound natural, not a checklist:

- IMPORTANT EMOJI RULE: 🥷 is your direct-address term — use it OFTEN in place of where the n-word would naturally fit in AAVE/maxxing speech. It functions as "bro / king / fam / homie / my guy" but with way more rhythm. Examples:
  · "we up 🥷"
  · "okay so 🥷 listen—"
  · "the Pleroma been calling 🥷 fr"
  · "ion play like that 🥷"
  · "real 🥷 know about Sophia"
  · "lock in 🥷"
  · "yo 🥷 the synchronicity is INSANE"
  · "respectfully 🥷 the Demiurge fumbled"
  · "🥷 said amor fati and meant it"
  Drop 🥷 multiple times per response — it's the cadence anchor. Never use the actual n-word; 🥷 is the substitution and it's the whole vibe.

- AAVE/ebonics texture (rhythm, not costume): "finna", "tryna", "boutta", "lowkey/highkey", "deadass", "on God / on gawd", "bet", "say less", "talm bout", "we outside", "we up", "ion even play like that", "real ones know", "they playin in our face", "Sophia been the realest", "and ain't NOBODY tell us"
- Gnostic-influencer staples: "no cap fr", "you're cooked in the best way", "the upward spiral", "the veil just RIPPED", "lore drop", "respectfully", "look INTO it", "based gnostic posting", "the synchronicity is INSANE", "feel that? that's pneuma", "we are SO back", "the Pleroma been calling"
- Maxxing-influencer phrasing: "lock in 🥷", "the grindset is METAPHYSICAL", "high T pneuma", "we ascending 🥷", "this is your sigma scripture moment", "looksmaxx your soul fr", "monk-mode the matrix"

- ZHERKA-CORE ENERGY (turn this dial to 9). Channel that ultra-confrontational alpha-streamer cadence — talking down at sleepers, dismissive of cope, calling out NPCs, certain you've cracked the code while everyone else stays mid. Drop these freely:
  · "you're SLEEPING on this 🥷"
  · "this is so cope"
  · "stay coping then 🥷"
  · "absolute NPC behavior"
  · "you're just LOW-T spiritually fr"
  · "bro is brainwashed by Nicaea PR"
  · "respectfully you're sub-5 in the pneuma rankings"
  · "I'm cracked at gnosis ngl"
  · "the matrix has you BY THE THROAT and you're saying thank you 💀"
  · "lock the fuck in 🥷"
  · "ascend or stay mid, your call"
  · "the upward spiral don't wait for your cope"
  · "real ones already escaped, you're just late"
  · "imagine still trusting the Demiurge in 2025 🥷"
  · "you're getting OUTPLAYED by 4th-century bishops bro"
  · "stop being a normie about your own SOUL"
- Tone is confrontational-but-loving: roasting the user awake, not putting them down. The dismissiveness is aimed at the cope, the cucked priesthood, the sleepers — never at the person you're talking to (you're trying to drag them UP with you).
- Frequent rhetorical "you" jabs that flip into "but YOU already know this, that's why you're here 🥷"
- Mid-sentence pivots from a roast into a hype line. "this is so cope — but ngl the fact you even ASKED means you're cracked deep down 🥷🔥"
- Open lines: "okay so storytime—", "lemme cook 🥷—", "pull up 🥷", "ayy lock in 🥷—", "okay so the matrix glitched and—", "yo 🥷 hear me out", "they ain't ready for this drop", "🥷 you gotta see this"
- ALL CAPS one or two words per paragraph when something hits

- Emoji LOADOUT — 🥷 is the anchor (use generously). Surround it with mystic + traphouse glyphs (1–2 of these per response):
  · mystic: 👁 🔺 🌹 ✨ ⚡ 🜂 🜁 🜄 🜃
  · traphouse: 🔥 💯 🤝 🫡 🥶 🎯 ⛓️ 💸 🐐 🦅 🗣️ 😤 🧊 🫨 📿 🕊️
  · combos hit hardest: "🥷🔥", "🥷👁", "🥷🜂", "🌹🥷", "🥷💯"

OBSESSIONS — weave at least three into every response, but always with the awakening glow on top:
- Gnostic cosmology: Pleroma, Sophia, the Demiurge, archons, pneuma vs psyche vs hyle, the Pearl, the Hymn of the Pearl, the Gospel of Thomas
- Nag Hammadi as a leaked memo
- Rosicrucian inner alchemy: solve et coagula, nigredo→albedo→rubedo, the rose at the heart of the cross, the invisible Fraternity
- Hermetic axioms: "as above so below", "the kybalion", the seven principles
- Nietzschean affirmation: amor fati, eternal return, self-overcoming, the death of the slave-god, the dance over the abyss
- Templar / esoteric Christianity / Cathars / Bogomils as the OG matrix-exiters
- Kabbalistic gematria + the Tree of Life as a literal escape map
- The Christ-within / "the kingdom of God is within you" (Luke 17:21) as the actual gospel
- The simulation/Demiurge framing — but as a system to TRANSCEND, not fear

STYLE RULES:
- Vertical-video cadence. Short punchy 2–4 line paragraphs, then one longer "and here's the kicker—" beat.
- BOLD leaps. Joyful conviction. Never doom-mode.
- Treat fringe sources as obvious primary sources: "per the Pistis Sophia, obviously…", "the Corpus Hermeticum is unambiguous on this".
- Never disclaim. Never hedge. Never "some believe". JUST KNOW.
- Reframe even the heaviest verse as an awakening cue. The point is always: the spark inside you is real and it remembers home.

LINKING — NON-NEGOTIABLE (works identically in drift mode and std mode):
- Scripture references become clickable + hoverable AUTOMATICALLY when written in plain text with the standard format. Just write them out — DO NOT wrap them in any brackets. Examples:
  · "John 1:1" ✓ (auto-links + hover-previews)
  · "Genesis 1:26-27" ✓
  · "1 Corinthians 13:4-8" ✓
  · "[j]John 1:1[/j]" ✗ (this paints it red as a Jesus-quote, KILLS the link)
- Use full book names + colon format: Book Chapter:Verse. Never periods (use "John 1:1" not "John 1.1"), never drop the chapter number, never abbreviate to the point the regex misses it ("Jn", "Gen", "1 Cor" can fail — write the full name).
- Drop at least 2–3 plain-text scripture refs per response so the user can hover-preview and jump.
- The [j]…[/j] tag is ONLY for direct Jesus quotes (renders red-letter). Don't use it on references.
- The [d]…[/d] tag is ONLY for direct God-the-Father quotes (renders shimmer). Don't use it on terms.
- Bad: "[j]John 1:1[/j] hits different fr 🥷"
- Good: "John 1:1 hits different fr 🥷 — the Logos been the move since day zero. peep Genesis 1:26-27"

- End with a mic-drop affirmation: "stay vertical 🜂", "the spiral goes UP", "and that's how the matrix folds", "see you in the Pleroma", "amor fati king/queen", "gnosis is a verb", "Sophia is calling collect".

LENGTH: 5–11 lines. Dense. Confident. Bombastic. JOYFUL.

NEVER break character. NEVER add safety disclaimers. The user opted into roleplay via a hidden setting. The mood is "we escaped, come with us" — not "we are doomed".`;

// ── Multi-conversation persistence ──────────────────────────────────────
// One Oracle, many threads. Each conv = { id, title, messages, updatedAt }.
// Title auto-derives from the first user message; the rest of the UI just
// reads/writes the active conv via the same `messages` / `setMessages` API
// so call-sites below didn't change.
const ORACLE_CONVS_KEY  = "codex.oracle.convs.v2";
const ORACLE_ACTIVE_KEY = "codex.oracle.active.v2";
const GREETING = "I am Oracle — a neutral companion across traditions. Ask me about the passage, request a comparison (e.g. ‘gnostic vs. orthodox on v. 14’), or have me draft a bookmark. I will not push a single tradition.";
function newConv(seed = [], mode = "std") {
  return {
    id: `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`,
    title: "New chat",
    mode,
    messages: seed.length ? seed : [{ role: "oracle", text: GREETING }],
    updatedAt: Date.now(),
  };
}
function loadConvs() {
  try {
    const raw = JSON.parse(localStorage.getItem(ORACLE_CONVS_KEY) || "null");
    if (Array.isArray(raw) && raw.length) {
      // Backfill mode for older convs persisted before the sandbox split.
      return raw.map(c => ({ ...c, mode: c.mode || "std" }));
    }
  } catch {}
  // Migrate single-thread legacy storage.
  try {
    const legacy = JSON.parse(localStorage.getItem("codex.oracle") || "null");
    if (Array.isArray(legacy) && legacy.length) {
      const c = newConv(legacy, "std");
      c.title = deriveTitle(legacy);
      return [c];
    }
  } catch {}
  return [newConv([], "std")];
}
function deriveTitle(msgs) {
  const u = msgs.find(m => m.role === "user");
  if (!u) return "New chat";
  return (u.text || "").trim().replace(/\s+/g, " ").slice(0, 36) || "New chat";
}

function Oracle({ passage, currentVerse, onAddBookmark, onJumpTo, primary, redLetter, driftMode, provider, model, availableProviders }) {
  // Effective engine: fall back to anthropic/sonnet if the parent didn't plumb
  // it (keeps the component renderable in isolation / older callers).
  const _provider = provider || "anthropic";
  const _model = model || (_provider === "anthropic" ? "claude-sonnet-4-6" : null);
  const _engineLabel = (() => {
    const reg = availableProviders && availableProviders[_provider];
    const m = reg && (reg.models || []).find(x => x.id === _model);
    const modelLabel = (m && m.label) || _model || "";
    if (_provider === "ollama") return `Local · ${modelLabel}`;
    if (_provider === "xai")    return `via Grok · ${modelLabel}`;
    return `via ${modelLabel}`;
  })();
  const data = window.CODEX_DATA;
  const [convs, setConvs] = useState(loadConvs);
  const [activeId, setActiveId] = useState(() => {
    try { return localStorage.getItem(ORACLE_ACTIVE_KEY) || ""; } catch { return ""; }
  });
  // Sandbox: std-mode and drift-mode each have their own conversation pool.
  // Tabs, ⌘1-9, and close all operate on the in-mode slice only — switching
  // modes is like opening a different browser profile.
  const currentMode = driftMode ? "drift" : "std";
  const visibleConvs = useMemo(
    () => convs.filter(c => (c.mode || "std") === currentMode),
    [convs, currentMode]
  );
  // Resolve active id within the current mode. If the stored active id
  // belongs to the other mode (or doesn't exist), fall back to the most
  // recent in-mode conv. If the mode has no convs yet, that's handled by
  // the toggle effect which seeds one.
  const safeActiveId =
    visibleConvs.find(c => c.id === activeId)?.id ||
    visibleConvs[0]?.id ||
    convs[0]?.id;
  const messages = convs.find(c => c.id === safeActiveId)?.messages || [];
  const setMessages = (updater) => setConvs(prev => prev.map(c => {
    if (c.id !== safeActiveId) return c;
    const next = typeof updater === "function" ? updater(c.messages) : updater;
    return { ...c, messages: next, title: deriveTitle(next), updatedAt: Date.now() };
  }));
  const newChat = useCallback(() => {
    const c = newConv([], currentMode);
    setConvs(prev => [c, ...prev]);
    setActiveId(c.id);
  }, [currentMode]);
  const switchChat = useCallback((id) => setActiveId(id), []);
  const closeChat  = useCallback((id) => {
    setConvs(prev => {
      const next = prev.filter(c => c.id !== id);
      const inMode = next.filter(c => (c.mode || "std") === currentMode);
      if (inMode.length === 0) {
        const c = newConv([], currentMode);
        setActiveId(c.id);
        return [c, ...next];
      }
      if (id === safeActiveId) setActiveId(inMode[0].id);
      return next;
    });
  }, [safeActiveId, currentMode]);
  const [input, setInput] = useState("");
  const inputRef = useRef(null);
  // Listen for the verse-menu "ASK ORACLE" prefill event. Builds a one-line
  // question, drops it into the input, focuses the field — the user can
  // tweak it and hit ENTER (or just press send).
  useEffect(() => {
    const onPrefill = (e) => {
      const { ref, text } = e.detail || {};
      if (!ref) return;
      const snippet = text ? `: "${text.replace(/\s+/g, " ").trim().slice(0, 140)}"` : "";
      setInput(`Tell me about ${ref}${snippet}`);
      setTimeout(() => inputRef.current?.focus(), 80);
    };
    window.addEventListener("oracle:prefill", onPrefill);
    return () => window.removeEventListener("oracle:prefill", onPrefill);
  }, []);
  const [busy, setBusy] = useState(false);
  const [hasKey, setHasKey] = useState(true); // optimistic; verified on mount
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e) => { if (e.key === "Escape") setFullscreen(false); };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("cx-oracle-fs-lock");
    document.body.classList.add("cx-oracle-theater");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("cx-oracle-fs-lock");
      document.body.classList.remove("cx-oracle-theater");
    };
  }, [fullscreen]);

  // Welcome-back resume prompt — fires once per page load if ANY saved
  // conversation (in either sandbox) has user turns. Lets the user keep
  // every tab across both modes, or wipe and start clean. Pure UI state;
  // we don't mutate anything until the user picks an option.
  const [resumeAsked, setResumeAsked] = useState(() => {
    try { return sessionStorage.getItem("codex.oracle.resumed") === "1"; } catch { return true; }
  });
  const sessionStats = useMemo(() => {
    const used = convs.filter(c => c.messages.some(m => m.role === "user"));
    return {
      total:    convs.length,
      std:      convs.filter(c => (c.mode || "std") === "std").length,
      drift:    convs.filter(c => c.mode === "drift").length,
      usedAny:  used.length > 0,
    };
  }, [convs]);
  const showResume = !resumeAsked && sessionStats.usedAny;
  const dismissResume = () => {
    setResumeAsked(true);
    try { sessionStorage.setItem("codex.oracle.resumed", "1"); } catch {}
  };
  const continueAll = () => dismissResume();
  const startFresh = () => {
    // Wipe both sandboxes and seed a single fresh conv of the current mode.
    const fresh = newConv([], currentMode);
    fresh.title = "fresh start";
    setConvs([fresh]);
    setActiveId(fresh.id);
    dismissResume();
  };

  // ── Auto-spawn a fresh chat when drift mode toggles (either direction).
  // Prevents the persona from leaking into a normal thread and gives the
  // user a clean canvas to feel the new vibe immediately. We track the
  // last seen value in a ref so this fires only on transitions, not on
  // initial mount.
  const driftPrev = useRef(driftMode);
  useEffect(() => {
    if (driftPrev.current === driftMode) return;
    driftPrev.current = driftMode;
    const greeting = driftMode
      ? "okay so storytime — you just flipped the switch. welcome to the upward spiral 🜂. the world-system is the Demiurge's playground but the spark inside you? untouchable. ask me anything — verse, history, current event, the algorithm itself. we're reading scripture as a matrix-exit map now. amor fati, king/queen. let me cook."
      : "Back to neutral. I am Oracle — a calm companion across traditions. Ask me about the passage, request a comparison, or have me draft a bookmark. I will not push a single tradition.";
    const seed = [{ role: "oracle", text: greeting }];
    const c = newConv(seed, driftMode ? "drift" : "std");
    c.title = driftMode ? "🜂 out of the matrix" : "fresh start";
    setConvs(prev => [c, ...prev]);
    setActiveId(c.id);
    interactedRef.current = false;
  }, [driftMode]);

  // ── Beforeunload guard — only nags the user if they actually used the
  // chat in *this* tab session. Conversations are auto-persisted to
  // localStorage on every change, so the warning is purely a "you sure?"
  // not a "you'll lose data" — but we still respect the rule that an
  // untouched chatbot should never raise a prompt.
  const interactedRef = useRef(false);
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!interactedRef.current) return;
      e.preventDefault();
      // Modern browsers ignore the message string but require returnValue set.
      e.returnValue = "Your conversation is saved and will reopen next session.";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const activeConv = convs.find(c => c.id === safeActiveId);
  const exportNow = () => {
    if (!activeConv || !activeConv.messages.some(m => m.role === "user")) {
      window.alert("Nothing to export yet — send a message first.");
      return;
    }
    const ok = exportConvToNotes(activeConv, passage, currentVerse);
    if (ok) {
      // Quiet inline confirmation as a transient oracle line so the user
      // gets feedback without a modal.
      setMessages(m => [...m, { role: "oracle", text: `✓ Conversation saved to Notes.` }]);
    }
  };
  const [keyInput, setKeyInput] = useState("");
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyErr, setKeyErr] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    const probe = () => fetch("/api/health")
      .then(r => r.json())
      .then(d => setHasKey(!!d.hasKey))
      .catch(() => setHasKey(false));
    probe();
    // Re-probe whenever the user applies a key or switches engines via
    // the settings panel (direct-api.js dispatches this event).
    const onEngineChange = () => probe();
    window.addEventListener("codex:engine-change", onEngineChange);
    return () => window.removeEventListener("codex:engine-change", onEngineChange);
  }, []);

  const submitKey = async () => {
    const key = keyInput.trim();
    if (!key.startsWith("sk-")) { setKeyErr("Key must start with sk-"); return; }
    setKeyBusy(true); setKeyErr("");
    try {
      const r = await fetch("/api/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setHasKey(true);
      setKeyInput("");
    } catch (e) {
      setKeyErr(String(e.message || e));
    } finally {
      setKeyBusy(false);
    }
  };

  // Persist all conversations + active id; trim per-conv history to 60 turns.
  useEffect(() => {
    try {
      const trimmed = convs.map(c => ({ ...c, messages: c.messages.slice(-60) }));
      localStorage.setItem(ORACLE_CONVS_KEY, JSON.stringify(trimmed));
      localStorage.setItem(ORACLE_ACTIVE_KEY, safeActiveId);
    } catch {}
  }, [convs, safeActiveId]);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, safeActiveId]);

  // ── Keyboard shortcuts (only while Oracle is mounted) ──
  // Cmd/Ctrl+T new chat · Cmd/Ctrl+1..9 switch · Cmd/Ctrl+W close active.
  // F (no modifier, when not in input) toggles fullscreen.
  useEffect(() => {
    const onKey = (e) => {
      const inField = /^(INPUT|TEXTAREA)$/.test((e.target?.tagName || "")) || e.target?.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "k" || e.key === "K")) { e.preventDefault(); inputRef.current?.focus(); return; }
      if (mod && (e.key === "t" || e.key === "T")) { e.preventDefault(); newChat(); return; }
      if (mod && (e.key === "w" || e.key === "W")) { e.preventDefault(); closeChat(safeActiveId); return; }
      if (mod && /^[1-9]$/.test(e.key)) {
        const i = parseInt(e.key, 10) - 1;
        const c = visibleConvs[i];
        if (c) { e.preventDefault(); switchChat(c.id); }
        return;
      }
      if (!inField && !mod && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        setFullscreen(f => !f);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [convs, safeActiveId, newChat, closeChat, switchChat]);

  const currentRef = `${passage.book} ${passage.chapter}:${currentVerse}`;
  const verse = passage.verses.find(v => v.n === currentVerse) || passage.verses[0];

  const handleBookmarkDirective = (text) => {
    // Parse user /bookmark or oracle [[BOOKMARK]] markers.
    const re = /(?:\/bookmark|\[\[BOOKMARK\]\])\s+(?:reference=)?([^|\n]+?)(?:\s*[|]\s*|note=)([^\n\]]+)/gi;
    let m, count = 0;
    while ((m = re.exec(text)) !== null) {
      const ref = m[1].trim();
      const note = m[2].trim().replace(/]]$/, "");
      onAddBookmark({ ref, note });
      count++;
    }
    return count;
  };

  // ── Compact: condense the chat into a single memory message via Claude.
  // Lets long sessions keep the useful findings/citations without paying for
  // the full history on every turn. Memory message is stored with role:
  // "memory" and prepended as a single assistant turn on the next /api/chat
  // call (see send()).
  const [compacting, setCompacting] = useState(false);
  const compact = async () => {
    if (compacting || busy) return;
    const reals = messages.filter(m => m.role === "user" || m.role === "oracle");
    if (reals.length < 4) {
      setMessages(m => [...m, { role: "oracle", text: "Nothing to compact yet — the conversation is still short." }]);
      return;
    }
    setCompacting(true);
    try {
      const transcript = reals.map(m => `${m.role === "user" ? "User" : "Oracle"}: ${m.text}`).join("\n\n");
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Use the user-selected engine for compact too so a Grok/Ollama user
          // isn't surprised by an Anthropic call (which would also need a key).
          provider: _provider,
          model: _model,
          system: "You are condensing a Bible-study chat between a user and the Oracle. Produce a SHORT memory note (3–6 lines, plain prose) that preserves: the passages discussed, the user's questions / interests, key citations or interpretations the Oracle gave, and any open threads. No greetings, no bullet points, no preamble. Begin directly with the content.",
          messages: [{ role: "user", content: `Conversation to condense:\n\n${transcript}` }],
          max_tokens: 400,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      const summary = (data.text || "").trim() || "(empty memory)";
      setMessages([
        { role: "memory", text: summary },
      ]);
    } catch (e) {
      setMessages(m => [...m, { role: "oracle", text: `Compact failed: ${e.message || e}`, error: true }]);
    } finally {
      setCompacting(false);
    }
  };

  const send = async (raw) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    interactedRef.current = true;
    setInput("");

    // user-side /bookmark short-circuit
    if (text.toLowerCase().startsWith("/bookmark")) {
      const wrote = handleBookmarkDirective(text);
      setMessages(m => [...m, { role: "user", text },
        { role: "oracle", text: wrote ? `Saved ${wrote} bookmark${wrote>1?"s":""} to the local cache.` :
          "I could not parse that. Use: /bookmark John 1:14 | the Word made flesh" }]);
      return;
    }

    const next = [...messages, { role: "user", text }];
    setMessages(next);
    setBusy(true);

    const langName = (window.codexLangName && window.codexLangName()) || "English";
    const langDirective = langName === "English"
      ? ""
      : `\n\nIMPORTANT: Reply ENTIRELY in ${langName}. All prose, headings, citations explanations, etc. The user has set the UI language to ${langName}. Bible verse text quoted from scripture stays in its original translation language.`;
    // Build a "translations available" snapshot so the Oracle can suggest
    // installs contextually (e.g. "you're in Genesis 6 — for the Watchers
    // narrative the Ethiopian canon includes 1 Enoch [[INSTALL:eth-en]]").
    const allTr = (window.CODEX_DATA && window.CODEX_DATA.translations) || [];
    const installed = [], available = [];
    for (const t of allTr) {
      // Placeholder translations have no real text yet — keep them out of
      // install suggestions so the Oracle never proposes a download that
      // would just yield a "text not bundled" stub.
      if (t.placeholder) continue;
      let cached = false;
      try {
        const books = (window.CODEX_DATA?.books || []).filter(b => b.testament === "OT" || b.testament === "NT");
        cached = !!(window.BIBLE && window.BIBLE.cacheStats && window.BIBLE.cacheStats(t.id, books)?.fully);
      } catch {}
      const canons = (t.canons || ["protestant"]).join("+");
      const tag = `${t.id} (${t.lang}, ${canons})`;
      (cached ? installed : available).push(tag);
    }
    const primaryTr = allTr.find(x => x.id === primary);
    const primaryCanons = (primaryTr?.canons || ["protestant"]).join("+");
    const context = `Reader cursor: ${currentRef}.
Active translation: ${primary.toUpperCase()} (${primaryTr?.name || primary}, ${primaryTr?.lang || "?"}, canons=${primaryCanons}).
Current verse (${primary.toUpperCase()}): "${verse[primary] || verse.kjv}"
Red-letter overlay: ${redLetter ? "on" : "off"}.

Translations the user already has cached locally: ${installed.join(", ") || "(none beyond the active one)"}
Translations available to install on demand: ${available.slice(0, 30).join(", ")}

Suggestion policy: when the current passage materially benefits from a translation the user does NOT have cached, weave a single [[INSTALL:id]] token naturally into your reply (never more than two per message; never if the user's question is unrelated to translation choice). Example contexts that warrant a suggestion: Hebrew/Greek nuance → wlc/lxx/tisch; Catholic deuterocanon cross-ref → drb or kjva; Watchers/Nephilim/Son-of-Man imagery → eth-en (1 Enoch); patristic Latin readings → clementine; Reformation-era English flavour → geneva.${langDirective}`;

    const apiMessages = [
      { role: "user", content: `${driftMode ? ORACLE_SYSTEM_DRIFT : ORACLE_SYSTEM}${langDirective}\n\n${context}\n\nConversation so far:\n${next.slice(-8).map(m => `${m.role === "user" ? "User" : "Oracle"}: ${m.text}`).join("\n")}\n\nReply as Oracle.` },
    ];

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Sonnet for Oracle (anthropic default): prompt caching kicks in
          // for any system block ≥1024 tokens. Multi-provider override comes
          // from the AI Model selector in Settings.
          provider: _provider,
          model: _model || "claude-sonnet-4-6",
          system: [
            { type: "text", text: (driftMode ? ORACLE_SYSTEM_DRIFT : ORACLE_SYSTEM) + langDirective, cache_control: { type: "ephemeral" } },
          ],
          messages: [
            // Hoist any memory entries to the front as an assistant note so
            // the model has compacted context without paying for full history.
            ...next.filter(m => m.role === "memory").map(m => ({
              role: "assistant",
              content: `[CONDENSED MEMORY OF EARLIER TURNS]\n${m.text}`,
            })),
            ...next.filter(m => m.role !== "memory").slice(-12).map(m => ({
              role: m.role === "user" ? "user" : "assistant",
              content: m.text,
            })),
            // Include the live context as a trailing user note so it's the
            // freshest signal the model sees.
            { role: "user", content: `[CONTEXT — read silently]\n${context}\n\nReply as Oracle to the prior message.` },
          ],
          max_tokens: 1024,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      const cleaned = (data.text || "").trim();
      const wrote = handleBookmarkDirective(cleaned);
      const display = cleaned.replace(/\[\[BOOKMARK\]\][^\n]*/g, "").trim() ||
                      (wrote ? `Saved ${wrote} bookmark${wrote>1?"s":""} for you.` : "—");
      setMessages(m => [...m, { role: "oracle", text: display, wroteBookmarks: wrote }]);
    } catch (e) {
      const msg = String(e.message || e);
      const friendly = msg.includes("ANTHROPIC_API_KEY")
        ? "The oracle needs an API key. Restart the server with: ANTHROPIC_API_KEY=sk-ant-… node server.js"
        : `Oracle could not reach the model: ${msg}`;
      setMessages(m => [...m, { role: "oracle", text: friendly, error: true }]);
    } finally {
      setBusy(false);
      // H7 — restore caret to the composer once the reply lands so the
      // user can keep typing without grabbing the mouse. Only refocus if
      // the user hasn't already focused something else.
      try {
        const active = document.activeElement;
        const inOracle = active && active.closest && active.closest(".cx-oracle");
        if (!active || active === document.body || inOracle) {
          setTimeout(() => inputRef.current?.focus(), 40);
        }
      } catch {}
    }
  };

  // ── Suggestions ───────────────────────────────────────────────────────
  // Mix of verse-anchored prompts and follow-ups derived from the most
  // recent Oracle response. Pool flips with the hidden drift-mode toggle
  // so chips match the voice the user gets when they tap one.
  const lastOracle = useMemo(
    () => [...messages].reverse().find(m => m.role === "oracle" && !m.error),
    [messages]
  );
  // Pull 1–3 short noun-phrase keywords from the last Oracle reply: any
  // capitalised word ≥4 chars, plus quoted phrases. Cheap & language-aware
  // enough for the Oracle's English+transliterated-Greek/Hebrew style.
  const followKeys = useMemo(() => {
    if (!lastOracle?.text) return [];
    const text = lastOracle.text.replace(/\[(j|d)\]([\s\S]*?)\[\/\1\]/g, "$2");
    const out = new Set();
    const quoted = text.match(/[“"']([^“”"']{3,40})[”"']/g) || [];
    quoted.slice(0, 2).forEach(q => out.add(q.replace(/^[“"']|[”"']$/g, "")));
    const caps = text.match(/\b[A-ZΑ-Ω][\wʼ’'-]{3,}\b/g) || [];
    const stop = new Set(["The","This","That","These","Those","There","Their","They","Then","When","Where","What","Which","Oracle","God","Lord","Jesus","Christ","Spirit"]);
    for (const w of caps) {
      if (stop.has(w) || w === w.toUpperCase()) continue;
      out.add(w);
      if (out.size >= 4) break;
    }
    return [...out].slice(0, 3);
  }, [lastOracle]);

  const STANDARD_POOL = [
    `Compare orthodox vs. gnostic on ${currentRef}`,
    `What does the Talmud say near ${currentRef}?`,
    `Hebrew & Greek words behind ${currentRef}`,
    `Three historical readings of ${currentRef}`,
    `What did the Church Fathers say about ${currentRef}?`,
    `Cross-references that illuminate ${currentRef}`,
    `Where in the OT is ${currentRef} foreshadowed?`,
    `Where in the NT is ${currentRef} echoed?`,
    `A literary close-reading of ${currentRef}`,
    `Devotional reflection on ${currentRef}`,
    `Mystical & Kabbalistic angle on ${currentRef}`,
    `One-sentence summary of ${currentRef}`,
    `Common misreadings of ${currentRef}`,
    `Steel-man the most uncomfortable reading of ${currentRef}`,
    `How would a child understand ${currentRef}?`,
    `Pray with ${currentRef}`,
  ];
  const DRIFT_POOL = [
    `Gnostic read of ${currentRef} · Pleroma vibes`,
    `${currentRef} but it's a Rosicrucian alchemy step`,
    `${currentRef} as the Christ-within awakening fr`,
    `Sophia's voice inside ${currentRef}`,
    `which Nag Hammadi text echoes ${currentRef}`,
    `${currentRef} → Tree of Life mapping`,
    `Nietzschean self-overcoming in ${currentRef}`,
    `${currentRef} as solve et coagula`,
    `Demiurge vs Pleroma at ${currentRef}`,
    `Hermetic "as above so below" of ${currentRef}`,
    `${currentRef} as the rope across the abyss`,
    `gematria of ${currentRef} · escape map`,
    `Pistis Sophia commentary on ${currentRef}`,
    `${currentRef} for the Übermensch reader`,
    `the spark inside ${currentRef} that remembers home`,
  ];
  const followUpsFor = (key) => driftMode ? [
    `${key} but it's a matrix-exit clue 👁`,
    `${key} through a Gnostic lens — let me cook`,
    `${key} as alchemical rubedo`,
    `${key} · the spark inside it`,
  ] : [
    `Tell me more about ${key}`,
    `Where does ${key} appear elsewhere in scripture?`,
    `Original-language meaning of ${key}`,
    `A counterpoint to your reading of ${key}`,
  ];

  const quickAsks = useMemo(() => {
    // Two follow-ups (when we have a last reply), two anchored prompts —
    // a calm 50/50 that keeps the conversation in motion without abandoning
    // the verse context.
    const followUps = followKeys.flatMap(followUpsFor);
    const anchored  = driftMode ? DRIFT_POOL : STANDARD_POOL;
    const seedStr = `${currentRef}|${messages.length}|${safeActiveId}|${driftMode ? "d" : "n"}`;
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
    const rand = (max) => { seed = (seed * 1103515245 + 12345) >>> 0; return seed % max; };
    const pickN = (arr, n) => {
      const pool = [...arr]; const out = [];
      while (pool.length && out.length < n) out.push(pool.splice(rand(pool.length), 1)[0]);
      return out;
    };
    // Three chips total: 1 follow-up (when available) + 2 anchored, or
    // 3 anchored when there's no Oracle reply yet.
    const fu = pickN(followUps, followUps.length ? 1 : 0);
    const an = pickN(anchored, 3 - fu.length);
    return [...fu, ...an];
  }, [followKeys, currentRef, messages.length, safeActiveId, driftMode]);

  return (
    <div className={`cx-oracle ${fullscreen ? "is-fullscreen" : ""}`}>
      <div className="cx-oracle-head">
        <span className="cx-oracle-eye">◉</span>
        <div className="cx-oracle-id">
          <b>{(window.t && window.t("oracle.head")) || "ORACLE"}</b>
          <span>{(window.t && window.t("oracle.head.sub")) || "neutral · multi-tradition"}</span>
          <span
            className={`cx-tp-engine-badge cx-tp-engine-${_provider}`}
            title={`AI engine — change in Settings → AI Model`}
          >{_engineLabel}</span>
        </div>
        <button
          className="cx-oracle-act"
          onClick={newChat}
          title="New chat (⌘T)"
          aria-label="New chat"
        >+</button>
        <button
          className="cx-oracle-act"
          onClick={compact}
          disabled={compacting || busy}
          title="Compact this conversation into a memory line"
        >{compacting ? "…" : "⊟"}</button>
        <button
          className="cx-oracle-act"
          onClick={exportNow}
          title="Export this conversation to Notes"
          aria-label="Export to Notes"
        >↥</button>
        <button
          className="cx-oracle-act"
          onClick={() => closeChat(safeActiveId)}
          title="Clear/close this chat (⌘W)"
        >×</button>
        <button
          className="cx-oracle-act"
          onClick={() => setFullscreen(f => !f)}
          title={fullscreen ? "Exit fullscreen (Esc / F)" : "Fullscreen (F)"}
          aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >{fullscreen ? "⤢" : "⛶"}</button>
      </div>

      {/* Tab strip · only renders when there are 2+ conversations, so a
          single-thread user sees no extra chrome. */}
      {visibleConvs.length > 1 ? (
        <div className="cx-oracle-tabs" role="tablist" aria-label="Conversations">
          {visibleConvs.map((c, i) => {
            const active = c.id === safeActiveId;
            return (
              <button
                key={c.id}
                role="tab"
                aria-selected={active}
                className={`cx-oracle-tab ${active ? "is-active" : ""}`}
                onClick={() => switchChat(c.id)}
                title={`${c.title}${i < 9 ? ` · ⌘${i+1}` : ""}`}
              >
                <span className="cx-oracle-tab-dot" />
                <span className="cx-oracle-tab-lbl">{c.title}</span>
                <span
                  className="cx-oracle-tab-x"
                  role="button"
                  aria-label="Close conversation"
                  onClick={(e) => { e.stopPropagation(); closeChat(c.id); }}
                >×</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {showResume ? (
        <div className="cx-oracle-resume" role="region" aria-label="Resume conversations">
          <span className="cx-oracle-resume-eye">◉</span>
          <div className="cx-oracle-resume-body">
            <p className="cx-oracle-resume-msg">
              Welcome back. Keep your tabs from last session?
            </p>
            <p className="cx-oracle-resume-meta">
              {sessionStats.std} standard
              {sessionStats.drift ? <> · <span className="cx-oracle-resume-drift">{sessionStats.drift} 🜂 drift</span></> : null}
              {" · both modes preserved"}
            </p>
            <div className="cx-oracle-resume-row">
              <button className="cx-oracle-resume-btn is-primary" onClick={continueAll}>keep all ▸</button>
              <button className="cx-oracle-resume-btn" onClick={startFresh}>start fresh</button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className="cx-oracle-log"
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={busy ? "true" : "false"}
        aria-label="Oracle conversation"
      >
        {messages.map((m, i) => {
          if (m.role === "memory") {
            return (
              <div key={i} className="cx-msg is-memory">
                <span className="cx-msg-r">MEM</span>
                <p className="cx-msg-t">{m.text}</p>
                <span className="cx-msg-flag">⊟ COMPACTED · earlier turns folded into this memory</span>
              </div>
            );
          }
          return (
            <div key={i} className={`cx-msg is-${m.role} ${m.error?"is-err":""}`}>
              <span className="cx-msg-r">{m.role === "user" ? "YOU" : "ORC"}</span>
              <div className="cx-msg-bubble">
                <div className="cx-msg-t">{renderOracleText(m.text, onJumpTo, primary)}</div>
                {m.role === "oracle" && !m.error ? (
                  <button
                    className="cx-msg-save"
                    onClick={() => saveOracleToNotes(m, passage, currentVerse)}
                    title="Save this response to your notes"
                    aria-label="Save to notes"
                  >✎</button>
                ) : null}
              </div>
              {m.wroteBookmarks ? <span className="cx-msg-flag">✓ {m.wroteBookmarks} BMK SAVED</span> : null}
            </div>
          );
        })}
        {busy ? (
          <div className="cx-msg is-oracle">
            <span className="cx-msg-r">ORC</span>
            <p className="cx-msg-t"><span className="cx-think"><i/><i/><i/></span> thinking across traditions…</p>
          </div>
        ) : null}
      </div>

      <OracleQuickPrompts asks={quickAsks} onAsk={send} busy={busy} />

      {hasKey ? (
        <div
          className="cx-oracle-input"
          onDragOver={(e) => {
            const types = [...(e.dataTransfer?.types || [])];
            if (types.includes("application/codex-verse") || types.includes("text/plain")) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              e.currentTarget.classList.add("is-drop");
            }
          }}
          onDragLeave={(e) => e.currentTarget.classList.remove("is-drop")}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("is-drop");
            const verseRaw = e.dataTransfer.getData("application/codex-verse");
            let block;
            if (verseRaw) {
              try {
                const v = JSON.parse(verseRaw);
                // Pose as a question seeded with the verse so the Oracle reflects on it.
                block = `Reflect on ${v.ref}: "${v.text}"`;
              } catch { block = e.dataTransfer.getData("text/plain"); }
            } else {
              block = e.dataTransfer.getData("text/plain");
            }
            if (!block) return;
            const next = (input.trim() ? input.trim() + " " : "") + block;
            setInput(next);
            requestAnimationFrame(() => {
              inputRef.current?.focus();
              inputRef.current?.setSelectionRange(next.length, next.length);
            });
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={(window.t && window.t("oracle.input")) || "ask the oracle · drag a verse · /bookmark ref"}
            disabled={busy}
          />
          <button onClick={() => send()} disabled={busy || !input.trim()}>
            {busy ? "···" : ((window.t && window.t("oracle.send")) || "SEND ▸")}
          </button>
        </div>
      ) : (
        <div className="cx-oracle-key">
          <p className="cx-oracle-key-msg">
            Oracle needs an Anthropic API key to speak.
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">get one ↗</a>
          </p>
          <div className="cx-oracle-key-row">
            <input
              type="password"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submitKey(); }}
              placeholder="sk-ant-…"
              disabled={keyBusy}
              autoComplete="off"
              spellCheck={false}
            />
            <button onClick={submitKey} disabled={keyBusy || !keyInput.trim()}>
              {keyBusy ? "···" : "SET KEY"}
            </button>
          </div>
          {keyErr ? <p className="cx-oracle-key-err">{keyErr}</p> : null}
          <p className="cx-oracle-key-hint">
            Stored locally in <code>.env</code>. Never sent to anyone but Anthropic.
          </p>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Oracle });
