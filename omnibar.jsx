// CODEX — omnibar.jsx · ⌘K — the one door.
//
//   "For now we see through a glass, darkly; but then face to face."
//                                                       — 1 Cor 13:12
//
// The OS had power scattered behind right-clicks, rail tabs and seven
// consoles. The omnibar is the single surface that reaches all of it —
// type, and the bar UNDERSTANDS:
//
//   John 3:16            → live verse PREVIEW inline, ↵ jumps the reader,
//                          one keystroke more opens any console on it
//   sword John 1:1       → the blade falls         (verbs: sword · mirror ·
//   map Exodus 14          map · art · compare · go · ops)
//   shepherd             → live full-text hits stream in as you type
//   how do the prophets… → ❖ becomes a kernel MISSION (OPS)
//   weave                → ⟐ the LOOM: your reading trail → a cited study
//
// Free of charge, free of friction — freeing the people means zero
// learning curve: one input, every depth. The bar never guesses silently:
// every row says exactly what ↵ will do.
//
// Honest plumbing: previews come from BIBLE.loadChapter, hits from
// CODEX_SEARCH — the same engines the reader trusts everywhere else.

const OMNI_VERBS = {
  sword:   { kind: "console", icon: "⚔", label: "SWORD — fourfold edge" },
  mirror:  { kind: "console", icon: "⌬", label: "MIRROR — pattern analysis" },
  map:     { kind: "console", icon: "◎", label: "MAP — geo intelligence" },
  art:     { kind: "console", icon: "▦", label: "ART — paintings & illustrations" },
  compare: { kind: "console", icon: "≡", label: "COMPARE — all translations" },
  go:      { kind: "go",      icon: "→", label: "GO — jump the reader" },
  ops:     { kind: "ops",     icon: "❖", label: "OPS — task the kernel" },
};

function omniParseRef(s) {
  const K = window.CODEX_KERNEL;
  return K && K.parseRef ? K.parseRef(s) : null;
}

function Omnibar({ onClose }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState(0);
  const [preview, setPreview] = useState(null); // { ref, text } | null
  const inputRef = useRef(null);
  const seqRef = useRef(0);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // ── Understand the query → build rows (debounced; async results race-guarded)
  useEffect(() => {
    const seq = ++seqRef.current;
    const text = q.trim();
    setSel(0);

    if (!text) { setItems([]); setPreview(null); return; }

    const rows = [];
    const finish = (extra) => {
      if (seqRef.current !== seq) return;
      setItems([...rows, ...(extra || [])]);
    };

    // 1 — verb form: "<verb> <rest>"
    const vm = text.match(/^(\w+)\s+(.+)$/);
    const verb = vm && OMNI_VERBS[vm[1].toLowerCase()];
    if (verb) {
      const rest = vm[2].trim();
      if (verb.kind === "ops") {
        rows.push({
          id: "verb-ops", icon: "❖", title: `Mission: ${rest}`,
          sub: "the kernel plans, calls the app's tools, writes a cited artifact",
          action: () => { window.codexOpenOps && window.codexOpenOps(rest); },
        });
      } else {
        const p = omniParseRef(rest);
        if (p) {
          const refStr = `${p.bookName} ${p.chapter}:${p.v1 || 1}`;
          rows.push({
            id: "verb-" + vm[1], icon: verb.icon, title: `${verb.label}`,
            sub: refStr,
            action: verb.kind === "go"
              ? () => { window.codexJumpToRef && window.codexJumpToRef(refStr); }
              : () => { window.dispatchEvent(new CustomEvent("codex:os-open", { detail: { kind: vm[1].toLowerCase(), ref: refStr } })); },
          });
        } else {
          rows.push({ id: "verb-bad", icon: verb.icon, title: verb.label, sub: `couldn't read "${rest}" as a reference`, action: null });
        }
      }
      setPreview(null);
      finish();
      return;
    }

    // 2 — bare reference: live preview + the full verb fan
    const p = omniParseRef(text);
    if (p) {
      const refStr = `${p.bookName} ${p.chapter}${p.v1 ? ":" + p.v1 : ""}`;
      rows.push({
        id: "ref-go", icon: "→", title: `Open ${refStr}`, sub: "jump the reader", primary: true,
        action: () => { window.codexJumpToRef && window.codexJumpToRef(refStr); },
      });
      ["sword", "mirror", "map", "art", "compare"].forEach(k => {
        const v = OMNI_VERBS[k];
        rows.push({
          id: "ref-" + k, icon: v.icon, title: v.label, sub: `on ${p.bookName} ${p.chapter}:${p.v1 || 1}`,
          action: () => { window.dispatchEvent(new CustomEvent("codex:os-open", { detail: { kind: k, ref: `${p.bookName} ${p.chapter}:${p.v1 || 1}` } })); },
        });
      });
      finish();
      // the dim glass becomes clear: show the verse BEFORE the jump
      const t = setTimeout(async () => {
        try {
          const data = await window.BIBLE.loadChapter(p.bookId, p.chapter, (window.CODEX_DATA?.tweaks?.primary) || "web");
          if (seqRef.current !== seq) return;
          const vs = (data && data.verses) || data || [];
          const pick = Array.isArray(vs)
            ? vs.filter(v => { const n = v.verse || v.n; return p.v1 ? (n >= p.v1 && n <= (p.v2 || p.v1)) : n <= 3; })
            : [];
          const textOut = pick.map(v => `${v.verse || v.n}. ${String(v.text || "").trim()}`).join("  ");
          setPreview(textOut ? { ref: refStr, text: textOut.slice(0, 420) } : null);
        } catch { if (seqRef.current === seq) setPreview(null); }
      }, 140);
      return () => clearTimeout(t);
    }

    // 3 — loom / weave
    if (/^(weave|loom)\b/i.test(text)) {
      rows.push({
        id: "loom", icon: "⟐", title: "Weave the session — the Loom",
        sub: "your reading trail becomes one cited study",
        action: () => {
          window.codexOpenOps && window.codexOpenOps(
            "Weave my session: call session_trail to see what I have been reading, name the thread that connects it, and build a short cited study that ties it together."
          );
        },
      });
      setPreview(null);
      finish();
      return;
    }

    // 4 — free text: live search hits + mission escape hatch
    setPreview(null);
    const isQuestion = /\?|^(how|why|what|where|when|who|trace|compare|build|study)\b/i.test(text);
    const missionRow = {
      id: "ops-free", icon: "❖", title: `Mission: ${text}`,
      sub: "task the kernel — plan, gather, write a cited artifact",
      primary: isQuestion,
      action: () => { window.codexOpenOps && window.codexOpenOps(text); },
    };
    if (isQuestion) rows.push(missionRow);
    finish();
    if (text.length >= 2 && window.CODEX_SEARCH?.search) {
      const t = setTimeout(async () => {
        try {
          const hits = await window.CODEX_SEARCH.search(text, { limit: 6 });
          if (seqRef.current !== seq) return;
          const fmt = (ref) => {
            // dotted keys ("gen.1.15") → canonical ("Genesis 1:15")
            try {
              const X = window.CODEX_CrossRefLookup;
              if (X && X.formatRef && /^[a-z0-9]+\.\d+\.\d+/i.test(ref)) return X.formatRef(ref);
            } catch {}
            return ref;
          };
          const hitRows = (Array.isArray(hits) ? hits : []).slice(0, 6).map((h, i) => {
            const ref = h.ref || h.id || "";
            return {
              id: "hit-" + i, icon: "Α", title: fmt(ref),
              sub: String(h.text || h.snippet || "").trim().slice(0, 110),
              action: () => { window.codexJumpToRef && window.codexJumpToRef(fmt(ref)); },
            };
          });
          finish([...hitRows, ...(isQuestion ? [] : [missionRow])]);
        } catch { /* keep whatever rows we had */ }
      }, 200);
      return () => clearTimeout(t);
    } else if (!isQuestion) {
      finish([missionRow]);
    }
  }, [q]);

  const exec = (row) => {
    if (!row || !row.action) return;
    row.action();
    onClose();
  };

  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(s + 1, items.length - 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); return; }
    if (e.key === "Enter") { e.preventDefault(); exec(items[sel]); return; }
  };

  return (
    <div className="cx-omni-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cx-omni" role="dialog" aria-modal="true" aria-label="Omnibar — one door to everything">
        <div className="cx-omni-bar">
          <span className="cx-omni-sigil" aria-hidden="true">⌘</span>
          <input
            ref={inputRef}
            className="cx-omni-input"
            placeholder="ref · word · sword John 1:1 · a question for the kernel · weave"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            spellCheck={false}
            aria-label="Omnibar input"
          />
          <kbd className="cx-omni-esc">esc</kbd>
        </div>

        {preview ? (
          <div className="cx-omni-preview">
            <span className="cx-omni-preview-ref">{preview.ref}</span>
            <p>{preview.text}</p>
          </div>
        ) : null}

        {items.length ? (
          <ul className="cx-omni-list" role="listbox">
            {items.map((row, i) => (
              <li
                key={row.id}
                role="option"
                aria-selected={i === sel}
                className={`cx-omni-row ${i === sel ? "is-sel" : ""} ${row.primary ? "is-primary" : ""} ${!row.action ? "is-dead" : ""}`}
                onMouseEnter={() => setSel(i)}
                onMouseDown={(e) => { e.preventDefault(); exec(row); }}
              >
                <i className="cx-omni-row-icon" aria-hidden="true">{row.icon}</i>
                <div className="cx-omni-row-txt">
                  <b>{row.title}</b>
                  {row.sub ? <span>{row.sub}</span> : null}
                </div>
                {i === sel && row.action ? <kbd>↵</kbd> : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="cx-omni-idle">
            <div className="cx-omni-idle-rows" aria-hidden="true">
              <span><i>→</i> John 3:16</span>
              <span><i>⚔</i> sword John 1:1</span>
              <span><i>Α</i> shepherd</span>
              <span><i>❖</i> how do the prophets use fire?</span>
              <span><i>⟐</i> weave</span>
            </div>
            <p className="cx-omni-epigraph">“For now we see through a glass, darkly; but then face to face.” — 1 Cor 13:12</p>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { Omnibar });
