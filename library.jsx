// CODEX — Library panel
// "Simplicity is the ultimate sophistication."
//
// One typographic list. 66 books, two typographic dividers, an instant filter
// that vanishes when empty. Click a book — its chapter strip lifts in beneath
// it; click another, the first retracts. No carets, no badges, no nested
// sections. The current book sits highlighted with its current chapter shown
// as "31 / 50" so you always know where you are.

// ── Smart query parser ─────────────────────────────────────────────────
// Recognises three intents:
//   ref   — "john 3:16", "gen 1-3", "psa 23", "rev 13:18" → exact navigation
//   book  — "genesis", "gen", "rev" → filter to matching books
//   text  — anything else of length >= 3 → full-text search via CODEX_SEARCH
// Returns { kind, ref?, books, text } so the renderer can pick a path.
function _parseSmartQuery(raw, books) {
  const q = (raw || "").trim();
  if (!q) return { kind: "empty", books: [] };

  // Match "BookName C" or "BookName C:V" or "BookName C-D" / "BookName C:V-W"
  const m = q.match(/^([1-3]?\s*[A-Za-zé']+(?:\s+[A-Za-zé']+){0,3})\s*(\d+)?(?::(\d+))?(?:-(\d+))?\s*$/i);
  const norm = s => String(s || "").toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
  // First try ref interpretation
  if (m) {
    const wantBook = norm(m[1]);
    const ch = m[2] ? parseInt(m[2], 10) : null;
    const vs = m[3] ? parseInt(m[3], 10) : null;
    const found = books.find(b =>
      norm(b.name) === wantBook ||
      norm(b.id)   === wantBook ||
      norm(b.name).startsWith(wantBook) ||
      norm(b.id).startsWith(wantBook)
    );
    if (found && ch !== null) {
      const validCh = Math.min(Math.max(1, ch), found.chapters || 1);
      return { kind: "ref", ref: { bookId: found.id, chapter: validCh, verse: vs }, book: found, books: [found] };
    }
    if (found && ch === null && wantBook.length >= 2) {
      // Book-only — show book card with chapter grid
      return { kind: "book", book: found, books: [found] };
    }
  }
  // Substring book match
  const needle = q.toLowerCase();
  const bookMatches = books.filter(b =>
    b.name.toLowerCase().includes(needle) || (b.id || "").toLowerCase().includes(needle)
  );
  if (bookMatches.length && q.length <= 12) {
    return { kind: "book", books: bookMatches, text: q.length >= 3 ? q : null };
  }
  // Fall through to text search
  if (q.length >= 3) return { kind: "text", books: [], text: q };
  return { kind: "empty", books: [] };
}

// ── Inline text-search suggestions hook ────────────────────────────────
// Debounces input, hits window.CODEX_SEARCH if available, returns top N
// hits with snippets. No-ops when query length < 3 or no index.
function _useTextSuggestions(query, primary) {
  const [hits, setHits] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let stop = false;
    const q = String(query || "").trim();
    if (!q || q.length < 3 || !window.CODEX_SEARCH || typeof window.CODEX_SEARCH.search !== "function") {
      setHits([]); setLoading(false); return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const opts = primary ? { translation: primary, limit: 8 } : { limit: 8 };
        const res = await window.CODEX_SEARCH.search(q, opts);
        if (!stop) setHits(Array.isArray(res) ? res.slice(0, 8) : []);
      } catch { if (!stop) setHits([]); }
      finally { if (!stop) setLoading(false); }
    }, 180);
    return () => { stop = true; clearTimeout(t); };
  }, [query, primary]);
  return { hits, loading };
}

function Library({ activeBookId, activeChapter, onSelectChapter, activeTranslation, onJumpRef }) {
  const data = window.CODEX_DATA;
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(activeBookId);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef(null);
  const openRowRef = useRef(null);
  const inputRef = useRef(null);

  // Resolve which canons the active translation includes. Default is
  // protestant-only (66 books) when the registry doesn't say otherwise.
  const canons = useMemo(() => {
    const t = (data.translations || []).find(x => x.id === activeTranslation);
    const list = (t && t.canons && t.canons.length) ? t.canons : ["protestant"];
    return new Set(list);
  }, [activeTranslation, data.translations]);
  const showsBook = (b) => {
    if (b.testament === "OT" || b.testament === "NT") return canons.has("protestant");
    return canons.has(b.canon);
  };
  // Track whether the last openId change came from an external activeBookId
  // change (nav arrows etc.) so we only auto-scroll then. User taps should
  // expand in place — no jumping the viewport.
  const externalChange = useRef(true); // first paint counts as external

  // Whenever the active book changes from outside (e.g. nav arrows), keep the
  // open one in sync so the chapter strip follows naturally.
  useEffect(() => {
    externalChange.current = true;
    setOpenId(activeBookId);
  }, [activeBookId]);

  // Scroll the open book into view ONLY when the change came from outside.
  useEffect(() => {
    if (!externalChange.current) return;
    externalChange.current = false;
    if (!openRowRef.current || !scrollRef.current) return;
    const row = openRowRef.current;
    const box = scrollRef.current;
    const rT = row.offsetTop;
    const rB = rT + row.offsetHeight;
    if (rT < box.scrollTop + 8 || rB > box.scrollTop + box.clientHeight - 8) {
      box.scrollTo({ top: rT - 60, behavior: "smooth" });
    }
  }, [openId]);

  const match = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return null;
    return new Set(data.books
      .filter(b => b.name.toLowerCase().includes(needle) || b.id.includes(needle))
      .map(b => b.id));
  }, [q, data.books]);

  // ── Smart suggestions ────────────────────────────────────────────
  const parsed = useMemo(() => _parseSmartQuery(q, data.books || []), [q, data.books]);
  const { hits: textHits, loading: textLoading } = _useTextSuggestions(
    parsed.kind === "text" ? q : (parsed.kind === "book" && parsed.text ? parsed.text : ""),
    activeTranslation
  );
  const flatSuggestions = useMemo(() => {
    const out = [];
    if (parsed.kind === "ref" && parsed.ref) {
      const b = parsed.book;
      const ref = parsed.ref;
      out.push({
        kind: "jump",
        label: `${b.name} ${ref.chapter}${ref.verse ? `:${ref.verse}` : ""}`,
        sub: ref.verse ? "open verse" : "open chapter",
        do: () => { onSelectChapter(b.id, ref.chapter); if (ref.verse && onJumpRef) onJumpRef(`${b.id}.${ref.chapter}.${ref.verse}`); }
      });
    }
    (parsed.books || []).slice(0, 4).forEach(b => {
      out.push({
        kind: "book",
        label: b.name,
        sub: `${b.chapters} chapters · ${b.testament}`,
        do: () => {
          let last = 1;
          try { const m = JSON.parse(localStorage.getItem("codex.lastChapter.v1") || "{}"); if (Number.isFinite(m[b.id])) last = Math.min(m[b.id], b.chapters); } catch {}
          onSelectChapter(b.id, last);
        }
      });
    });
    textHits.slice(0, 6).forEach(h => {
      const parts = String(h.ref || "").split(".");
      const bookId = parts[0], ch = parseInt(parts[1], 10), v = parseInt(parts[2], 10);
      const b = data.books.find(x => x.id === bookId);
      if (!b || !ch) return;
      out.push({
        kind: "verse",
        label: `${b.name} ${ch}${v ? `:${v}` : ""}`,
        sub: String(h.snippet || h.text || "").slice(0, 80),
        do: () => { onSelectChapter(bookId, ch); if (v && onJumpRef) onJumpRef(`${bookId}.${ch}.${v}`); }
      });
    });
    return out;
  }, [parsed, textHits, data.books, onSelectChapter, onJumpRef]);
  // Reset cursor when suggestions change
  useEffect(() => { setActiveIdx(0); }, [q]);
  const onInputKey = (e) => {
    if (!flatSuggestions.length) {
      if (e.key === "Enter" && parsed.kind === "ref" && parsed.ref) {
        e.preventDefault();
        onSelectChapter(parsed.book.id, parsed.ref.chapter);
        if (parsed.ref.verse && onJumpRef) onJumpRef(`${parsed.book.id}.${parsed.ref.chapter}.${parsed.ref.verse}`);
        setQ(""); setSuggestOpen(false);
      }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => (i + 1) % flatSuggestions.length); setSuggestOpen(true); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => (i - 1 + flatSuggestions.length) % flatSuggestions.length); setSuggestOpen(true); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const s = flatSuggestions[activeIdx]; if (s) s.do();
      setQ(""); setSuggestOpen(false);
    }
    else if (e.key === "Escape") { setQ(""); setSuggestOpen(false); }
  };
  // Bind "/" globally to focus the library search.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || "";
      if (/input|textarea/i.test(tag) || (e.target && e.target.isContentEditable)) return;
      e.preventDefault();
      inputRef.current && inputRef.current.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const ot = useMemo(() => data.books.filter(b => b.testament === "OT" && showsBook(b)), [data.books, canons]);
  const nt = useMemo(() => data.books.filter(b => b.testament === "NT" && showsBook(b)), [data.books, canons]);
  // Group deuterocanonical/apocryphal books by canon so each "shelf"
  // (Apocrypha, Orthodox additions, Ge'ez/Ethiopian) gets its own header.
  const dcGroups = useMemo(() => {
    const groups = [
      { canon: "deuterocanon",   labelKey: "lib.apocrypha",     fallback: "Apocrypha · Deuterocanon" },
      { canon: "orthodox",       labelKey: "lib.orthodox",      fallback: "Orthodox additions" },
      { canon: "ethiopian",      labelKey: "lib.ethiopian",     fallback: "Ge'ez · Ethiopian" },
      { canon: "armenian",       labelKey: "lib.armenian",      fallback: "Armenian additions" },
      { canon: "syriac",         labelKey: "lib.syriac",        fallback: "Syriac · Peshitta" },
      { canon: "coptic",         labelKey: "lib.coptic",        fallback: "Coptic additions" },
      { canon: "pseudepigrapha", labelKey: "lib.pseudepigrapha",fallback: "Pseudepigrapha" },
    ];
    return groups
      .filter(g => canons.has(g.canon))
      .map(g => ({
        ...g,
        books: data.books.filter(b => b.testament === "DC" && b.canon === g.canon),
      }))
      .filter(g => g.books.length);
  }, [data.books, canons]);

  const renderBook = (b) => {
    if (match && !match.has(b.id)) return null;
    const isActive = b.id === activeBookId;
    const isOpen   = b.id === openId;
    return (
      <div key={b.id} className="cx-lib-book" ref={isOpen ? openRowRef : null}>
        <button
          className="cx-lib-row"
          data-active={isActive ? "true" : "false"}
          data-open={isOpen ? "true" : "false"}
          onClick={() => {
            // Expand the chapter strip AND, if this isn't already the
            // active book, jump to the user's remembered last chapter
            // for it (or chapter 1 the first time).
            setOpenId(isOpen ? null : b.id);
            if (!isActive) {
              let last = 1;
              try {
                const raw = localStorage.getItem("codex.lastChapter.v1");
                const map = raw ? JSON.parse(raw) : {};
                if (map && Number.isFinite(map[b.id])) last = Math.min(map[b.id], b.chapters);
              } catch {}
              onSelectChapter(b.id, last);
            }
          }}
        >
          <span className="cx-lib-name">{b.name}</span>
          <span className="cx-lib-meta">
            {isActive ? `${activeChapter} / ${b.chapters}` : b.chapters}
          </span>
        </button>
        {isOpen ? (
          <div className="cx-lib-chs" role="group" aria-label={`${b.name} chapters`}>
            {Array.from({ length: b.chapters }, (_, i) => i + 1).map(ch => (
              <button
                key={ch}
                className="cx-lib-ch"
                data-active={isActive && ch === activeChapter ? "true" : "false"}
                onClick={() => onSelectChapter(b.id, ch)}
                aria-label={`${b.name} chapter ${ch}`}
              >{ch}</button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  const otShown = ot.filter(b => !match || match.has(b.id));
  const ntShown = nt.filter(b => !match || match.has(b.id));
  const dcShown = dcGroups.map(g => ({
    ...g,
    books: g.books.filter(b => !match || match.has(b.id)),
  })).filter(g => g.books.length);
  const dcCount = dcShown.reduce((n, g) => n + g.books.length, 0);
  const total   = (match ? match.size : (otShown.length + ntShown.length + dcCount));

  return (
    <div className="cx-lib">
      <div className="cx-lib-search">
        <input
          ref={inputRef}
          type="text"
          placeholder={(window.t && window.t("lib.find")) || "Search · Book · 'John 3:16' · 'love' · /"}
          value={q}
          onChange={e => { setQ(e.target.value); setSuggestOpen(true); }}
          onFocus={() => setSuggestOpen(true)}
          onBlur={() => setTimeout(() => setSuggestOpen(false), 180)}
          onKeyDown={onInputKey}
          aria-label="Smart search — book, reference, or word"
          aria-autocomplete="list"
          aria-expanded={suggestOpen && flatSuggestions.length > 0}
          spellCheck={false}
        />
        {q ? (
          <button className="cx-lib-clear" onClick={() => setQ("")} aria-label="Clear">×</button>
        ) : (
          <span className="cx-lib-count" title="Press / to focus this search">/</span>
        )}
        {suggestOpen && flatSuggestions.length > 0 ? (
          <div className="cx-lib-suggest" role="listbox" aria-label="Search suggestions">
            {(() => {
              const groups = { jump: [], book: [], verse: [] };
              flatSuggestions.forEach((s, i) => groups[s.kind].push({ ...s, i }));
              const blocks = [];
              if (groups.jump.length) blocks.push(["✦ JUMP", groups.jump]);
              if (groups.book.length) blocks.push(["BOOKS", groups.book]);
              if (groups.verse.length) blocks.push([`VERSES${textLoading ? " · searching…" : ""}`, groups.verse]);
              return blocks.map(([label, items]) => (
                <React.Fragment key={label}>
                  <div className="cx-lib-suggest-h">{label}</div>
                  {items.map(s => (
                    <button
                      key={s.kind + ":" + s.label}
                      type="button"
                      role="option"
                      aria-selected={activeIdx === s.i}
                      className={`cx-lib-suggest-row ${activeIdx === s.i ? "is-active" : ""}`}
                      onMouseEnter={() => setActiveIdx(s.i)}
                      onMouseDown={(e) => { e.preventDefault(); s.do(); setQ(""); setSuggestOpen(false); }}
                    >
                      <span className="cx-lib-suggest-lbl">{s.label}</span>
                      <span className="cx-lib-suggest-sub">{s.sub}</span>
                    </button>
                  ))}
                </React.Fragment>
              ));
            })()}
            {parsed.kind === "text" && !textHits.length && !textLoading ? (
              <div className="cx-lib-suggest-empty">no verses contain "{q}" in your cached corpus</div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="cx-lib-scroll" ref={scrollRef}>
        {otShown.length > 0 ? <h3 className="cx-lib-h">{(window.t && window.t("lib.ot")) || "The Old Testament"}</h3> : null}
        {otShown.map(renderBook)}
        {ntShown.length > 0 ? <h3 className="cx-lib-h">{(window.t && window.t("lib.nt")) || "The New Testament"}</h3> : null}
        {ntShown.map(renderBook)}
        {dcShown.map(g => (
          <React.Fragment key={g.canon}>
            <h3 className="cx-lib-h">{(window.t && window.t(g.labelKey)) || g.fallback}</h3>
            {g.books.map(renderBook)}
          </React.Fragment>
        ))}
        {otShown.length === 0 && ntShown.length === 0 && dcShown.length === 0 ? (
          <p className="cx-lib-empty">{(window.t && window.t("lib.empty")) || "No book by that name."}</p>
        ) : null}
      </div>
    </div>
  );
}

Object.assign(window, { Library });
