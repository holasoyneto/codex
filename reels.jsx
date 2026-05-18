// CODEX — Reels (Phase 2.6) — endless scriptural scroll.
//
// TikTok-shaped vertical card feed for scripture: hand-curated cards
// (data/modules/reels-curated.json) interleaved with cards generated on
// the fly from existing systems (verse-art cache, panel cache, Strong's
// lexicon, gematria). Pre-loads in the background while the user reads
// so the feed is always full of fresh content.
//
// Registers as a CODEX plugin via window.CODEX_PLUGINS_API so it appears
// as a REELS tab in the right rail without touching app.jsx or panels.jsx.

(function () {
  "use strict";

  const useState = React.useState, useEffect = React.useEffect,
        useRef   = React.useRef,   useMemo    = React.useMemo,
        useCallback = React.useCallback;

  // ───────────────────────────────────────────────────────────────────────
  // Deck management
  // ───────────────────────────────────────────────────────────────────────

  const DECK_KEY = "codex.reels.deck.v1";
  const SEEN_KEY = "codex.reels.seen.v1";

  // In-memory deck state — survives navigation but rebuilt on cold start.
  const State = {
    curated: null,            // loaded curated cards array
    deck:    [],              // next ~30 cards to show
    seen:    null,            // Set of "type:id" already served
    busy:    false,           // generation in flight
    listeners: new Set(),     // re-render triggers
  };

  function bumpListeners() { State.listeners.forEach(fn => { try { fn(); } catch {} }); }

  function loadSeen() {
    if (State.seen) return State.seen;
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      State.seen = new Set(raw ? JSON.parse(raw) : []);
    } catch { State.seen = new Set(); }
    return State.seen;
  }
  function markSeen(card) {
    const s = loadSeen(); s.add(cardKey(card));
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...s].slice(-2000))); } catch {}
  }
  function cardKey(c) { return `${c.type}:${c.id || (c.anchor || "x") + ":" + (c.title || "").slice(0, 32)}`; }

  async function loadCurated() {
    if (State.curated) return State.curated;
    try {
      if (window.CODEX_MODULES) {
        const mod = await window.CODEX_MODULES.loadModule("reels-curated");
        State.curated = mod.cards || [];
      } else {
        const r = await fetch("data/modules/reels-curated.json");
        const j = await r.json();
        State.curated = j.cards || [];
      }
    } catch (e) {
      console.warn("[reels] could not load curated deck:", e);
      State.curated = [];
    }
    return State.curated;
  }

  // Pull a fresh card off the wheel. Round-robins through types so the
  // user never sees 5 of the same kind in a row.
  function pickCurated(typeRotation) {
    const seen = loadSeen();
    const pool = State.curated.filter(c => !seen.has(cardKey(c)));
    if (!pool.length) {
      // All cards seen — reset the rolling window so the user can re-encounter
      State.seen = new Set();
      try { localStorage.removeItem(SEEN_KEY); } catch {}
      return State.curated[Math.floor(Math.random() * State.curated.length)];
    }
    const preferredType = typeRotation;
    const byType = pool.filter(c => c.type === preferredType);
    const choice = (byType.length ? byType : pool)[Math.floor(Math.random() * (byType.length || pool.length))];
    return choice;
  }

  // Build a card from the current chapter context — uses existing caches
  // (verse art, gematria, panels) opportunistically.
  function fromContext(ctx) {
    if (!ctx || !ctx.bookId || !ctx.chapter) return null;
    // Look for cached verse-art on a random verse of the current chapter
    try {
      for (let v = 1; v <= 20; v++) {
        const key = `codex.art.${ctx.bookId}.${ctx.chapter}.${v}`;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const art = JSON.parse(raw);
        const work = (art.works || []).find(w => w.commonsFile);
        if (!work) continue;
        const cardId = `art:${ctx.bookId}.${ctx.chapter}.${v}.${work.title}`;
        if (loadSeen().has(`art-verse:${cardId}`)) continue;
        return {
          type: "art-verse",
          id: cardId,
          anchor: `${ctx.bookId}.${ctx.chapter}.${v}`,
          title: work.title,
          artist: work.artist,
          year: work.year,
          medium: work.medium,
          image: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(work.commonsFile)}?width=1200`,
          body: work.summary || "",
          hue: "#0a0e16",
        };
      }
    } catch {}
    return null;
  }

  // Rotation order — interleaves card kinds so the feed feels alive.
  const TYPE_ORDER = [
    "light-verse", "symbol", "name-of-god", "did-you-know",
    "art-verse", "parable-3", "prophecy-pair", "counting",
    "question", "quest-tease",
  ];

  async function refillDeck(ctx, targetSize = 30) {
    if (State.busy) return;
    State.busy = true;
    try {
      await loadCurated();
      let i = State.deck.length;
      let attempts = 0;
      while (State.deck.length < targetSize && attempts < 200) {
        const typeForSlot = TYPE_ORDER[i % TYPE_ORDER.length];
        let card = null;
        if (typeForSlot === "art-verse") {
          card = fromContext(ctx);
        }
        if (!card) card = pickCurated(typeForSlot);
        if (card && !State.deck.find(c => cardKey(c) === cardKey(card))) {
          State.deck.push(card);
          markSeen(card);
          i++;
        }
        attempts++;
      }
      try { localStorage.setItem(DECK_KEY, JSON.stringify(State.deck)); } catch {}
    } finally {
      State.busy = false;
      bumpListeners();
    }
  }

  function restoreDeck() {
    if (State.deck.length) return;
    try {
      const raw = localStorage.getItem(DECK_KEY);
      if (raw) State.deck = JSON.parse(raw) || [];
    } catch {}
  }

  // Pre-load hook — called when the user navigates. Triggers a refill so
  // by the time they open Reels there's a stocked deck.
  let preloadDebounce = 0;
  function schedulePreload(ctx) {
    clearTimeout(preloadDebounce);
    preloadDebounce = setTimeout(() => {
      restoreDeck();
      refillDeck(ctx, 30).catch(() => {});
    }, 1200);
  }
  window.addEventListener("codex:navigate", (e) => {
    schedulePreload(e.detail || {});
  });
  // Kick off once on load too
  setTimeout(() => { restoreDeck(); refillDeck({}, 30).catch(() => {}); }, 800);

  // ───────────────────────────────────────────────────────────────────────
  // Card renderers
  // ───────────────────────────────────────────────────────────────────────

  const TYPE_LABELS = {
    "art-verse":     "⌖ ART",
    "light-verse":   "✦ LIGHT",
    "symbol":        "◊ SYMBOL",
    "name-of-god":   "ℵ NAME",
    "did-you-know":  "✱ DID YOU KNOW",
    "parable-3":     "❧ PARABLE",
    "prophecy-pair": "⟿ PROPHECY",
    "counting":      "# NUMBER",
    "question":      "? QUESTION",
    "quest-tease":   "⌬ QUEST",
  };

  function refLabel(anchor) {
    if (!anchor) return "";
    const parts = anchor.split(".");
    const bookId = parts[0];
    const book = (window.CODEX_DATA?.bookName && window.CODEX_DATA.bookName(bookId)) || bookId.toUpperCase();
    return parts.length >= 3 ? `${book} ${parts[1]}:${parts[2]}` : `${book} ${parts[1] || ""}`;
  }

  function navigateToAnchor(anchor) {
    if (!anchor) return;
    if (typeof window.codexJumpToRef === "function") {
      const parts = anchor.split(".");
      const book = (window.CODEX_DATA?.bookName && window.CODEX_DATA.bookName(parts[0])) || parts[0];
      window.codexJumpToRef(parts.length >= 3 ? `${book} ${parts[1]}:${parts[2]}` : `${book} ${parts[1]}`);
    } else {
      window.dispatchEvent(new CustomEvent("codex:navigate", { detail: { anchor } }));
    }
  }

  function CardArtVerse({ card }) {
    return (
      <div className="cx-reel cx-reel-art" style={{ background: card.hue }}>
        {card.image ? <img className="cx-reel-hero" src={card.image} alt={card.title} loading="lazy" /> : null}
        <div className="cx-reel-art-grad" />
        <div className="cx-reel-art-meta">
          <div className="cx-reel-art-title">{card.title}</div>
          <div className="cx-reel-art-artist">{card.artist || ""}{card.year ? ` · ${card.year}` : ""}</div>
        </div>
        <div className="cx-reel-art-verse">
          <div className="cx-reel-art-ref">{refLabel(card.anchor)}</div>
          {card.body ? <p>{card.body}</p> : null}
        </div>
      </div>
    );
  }

  function CardLightVerse({ card }) {
    return (
      <div className="cx-reel cx-reel-light" style={{ background: card.hue || "#06080e" }}>
        <div className="cx-reel-light-text">{card.body}</div>
        <div className="cx-reel-light-ref">{refLabel(card.anchor)}</div>
      </div>
    );
  }

  function CardSymbol({ card }) {
    return (
      <div className="cx-reel cx-reel-symbol" style={{ ['--card-hue']: card.hue }}>
        <div className="cx-reel-symbol-glyph">{card.glyph || "◊"}</div>
        <div className="cx-reel-symbol-title">{card.title}</div>
        <p className="cx-reel-symbol-body">{card.body}</p>
        <div className="cx-reel-symbol-ref">{refLabel(card.anchor)}</div>
      </div>
    );
  }

  function CardNameOfGod({ card }) {
    return (
      <div className="cx-reel cx-reel-name" style={{ ['--card-hue']: card.hue }}>
        <div className="cx-reel-name-hebrew">{card.title}</div>
        <p className="cx-reel-name-body">{card.body}</p>
        <div className="cx-reel-name-ref">{refLabel(card.anchor)}</div>
      </div>
    );
  }

  function CardDidYouKnow({ card }) {
    return (
      <div className="cx-reel cx-reel-fact" style={{ ['--card-hue']: card.hue }}>
        <div className="cx-reel-fact-label">DID YOU KNOW</div>
        <div className="cx-reel-fact-title">{card.title}</div>
        <p className="cx-reel-fact-body">{card.body}</p>
        {card.anchor ? <div className="cx-reel-fact-ref">{refLabel(card.anchor)}</div> : null}
      </div>
    );
  }

  function CardParable({ card }) {
    return (
      <div className="cx-reel cx-reel-parable" style={{ ['--card-hue']: card.hue }}>
        <div className="cx-reel-parable-label">A PARABLE IN THREE SENTENCES</div>
        <div className="cx-reel-parable-title">{card.title}</div>
        <p className="cx-reel-parable-body">{card.body}</p>
        <div className="cx-reel-parable-ref">{refLabel(card.anchor)}</div>
      </div>
    );
  }

  function CardProphecyPair({ card }) {
    return (
      <div className="cx-reel cx-reel-prophecy" style={{ ['--card-hue']: card.hue }}>
        <div className="cx-reel-prophecy-title">{card.title}</div>
        <div className="cx-reel-prophecy-half">
          <div className="cx-reel-prophecy-tag">PROPHECY · {refLabel(card.anchor)}</div>
          <p>{card.prophecy}</p>
        </div>
        <div className="cx-reel-prophecy-arrow">↓</div>
        <div className="cx-reel-prophecy-half is-fulfilled">
          <div className="cx-reel-prophecy-tag">FULFILLED · {refLabel(card.fulfillment)}</div>
          <p>{card.fulfillment_text}</p>
        </div>
      </div>
    );
  }

  function CardCounting({ card }) {
    return (
      <div className="cx-reel cx-reel-count" style={{ ['--card-hue']: card.hue }}>
        <div className="cx-reel-count-num">{card.title}</div>
        <p className="cx-reel-count-body">{card.body}</p>
      </div>
    );
  }

  function CardQuestion({ card }) {
    const [revealed, setRevealed] = useState(false);
    return (
      <div className="cx-reel cx-reel-q" style={{ ['--card-hue']: card.hue }}>
        <div className="cx-reel-q-label">QUESTION</div>
        <div className="cx-reel-q-text">{card.question}</div>
        {revealed ? (
          <p className="cx-reel-q-answer">{card.answer}</p>
        ) : (
          <button type="button" className="cx-reel-q-reveal" onClick={() => setRevealed(true)}>
            tap to reveal
          </button>
        )}
        {card.anchor ? <div className="cx-reel-q-ref">{refLabel(card.anchor)}</div> : null}
      </div>
    );
  }

  function CardQuest({ card }) {
    return (
      <div className="cx-reel cx-reel-quest" style={{ ['--card-hue']: card.hue }}>
        <div className="cx-reel-quest-label">A QUEST</div>
        <div className="cx-reel-quest-title">{card.title}</div>
        <p className="cx-reel-quest-body">{card.body}</p>
        <div className="cx-reel-quest-ref">{refLabel(card.anchor)}</div>
      </div>
    );
  }

  const CARD_RENDERERS = {
    "art-verse":     CardArtVerse,
    "light-verse":   CardLightVerse,
    "symbol":        CardSymbol,
    "name-of-god":   CardNameOfGod,
    "did-you-know":  CardDidYouKnow,
    "parable-3":     CardParable,
    "prophecy-pair": CardProphecyPair,
    "counting":      CardCounting,
    "question":      CardQuestion,
    "quest-tease":   CardQuest,
  };

  // ───────────────────────────────────────────────────────────────────────
  // Feed component — vertical scroll-snap
  // ───────────────────────────────────────────────────────────────────────

  function ReelsFeed({ ctx, fullscreen, onClose }) {
    const [, force] = useState(0);
    useEffect(() => {
      const bump = () => force(n => n + 1);
      State.listeners.add(bump);
      restoreDeck();
      if (State.deck.length < 10) refillDeck(ctx, 30).catch(() => {});
      return () => { State.listeners.delete(bump); };
    }, []);

    const [activeIdx, setActiveIdx] = useState(0);
    const scrollRef = useRef(null);

    // Watch for scroll-snap position
    const onScroll = useCallback(() => {
      const el = scrollRef.current; if (!el) return;
      const cardH = el.clientHeight;
      const idx = Math.round(el.scrollTop / cardH);
      if (idx !== activeIdx) setActiveIdx(idx);
      // Refill near the end
      if (idx > State.deck.length - 8) refillDeck(ctx, State.deck.length + 20).catch(() => {});
    }, [activeIdx, ctx]);

    // Keyboard nav
    useEffect(() => {
      const el = scrollRef.current; if (!el) return;
      const onKey = (e) => {
        if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " " || e.key === "j") {
          e.preventDefault();
          el.scrollBy({ top: el.clientHeight, behavior: "smooth" });
        } else if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "k") {
          e.preventDefault();
          el.scrollBy({ top: -el.clientHeight, behavior: "smooth" });
        } else if (e.key === "Escape" && onClose) {
          onClose();
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    if (!State.deck.length) {
      return <div className="cx-reels-empty">loading the feed…</div>;
    }

    return (
      <div className={`cx-reels ${fullscreen ? "is-fullscreen" : ""}`}>
        {fullscreen && onClose ? (
          <button type="button" className="cx-reels-close" onClick={onClose} aria-label="Close reels">✕</button>
        ) : null}
        <div className="cx-reels-scroll" ref={scrollRef} onScroll={onScroll}>
          {State.deck.map((card, i) => {
            const Renderer = CARD_RENDERERS[card.type] || CardLightVerse;
            return (
              <section key={cardKey(card) + ":" + i} className="cx-reels-slot" aria-label={card.title || card.type}>
                <div className="cx-reel-typebadge">{TYPE_LABELS[card.type] || "◌"}</div>
                <Renderer card={card} />
                <ReelActions card={card} onClose={onClose} />
              </section>
            );
          })}
        </div>
        <div className="cx-reels-dots" aria-hidden="true">
          {State.deck.slice(0, 10).map((_, i) => (
            <span key={i} className={`cx-reels-dot ${i === activeIdx ? "is-on" : ""}`} />
          ))}
        </div>
      </div>
    );
  }

  function ReelActions({ card, onClose }) {
    const saveToBookmark = () => {
      if (!card.anchor) return;
      try {
        const list = JSON.parse(localStorage.getItem("codex.bookmarks") || "[]");
        list.push({ ref: card.anchor, kind: "reel", title: card.title || card.type, at: Date.now() });
        localStorage.setItem("codex.bookmarks", JSON.stringify(list));
        window.dispatchEvent(new CustomEvent("codex:bookmark-added", { detail: { ref: card.anchor } }));
      } catch {}
    };
    const openPassage = () => {
      navigateToAnchor(card.anchor);
      if (onClose) onClose();
    };
    const sharePlainText = () => {
      const text = [card.title, card.body || card.question || "", card.anchor ? `— ${refLabel(card.anchor)}` : ""]
        .filter(Boolean).join("\n\n");
      try { navigator.clipboard?.writeText(text); } catch {}
    };
    return (
      <div className="cx-reel-actions">
        <button type="button" className="cx-reel-act" onClick={saveToBookmark} title="Save to bookmarks" disabled={!card.anchor}>♡</button>
        <button type="button" className="cx-reel-act" onClick={openPassage} title="Open passage" disabled={!card.anchor}>📖</button>
        {window.CODEX_NormieToggle && (card.body || card.fulfillment_text)
          ? <window.CODEX_NormieToggle text={card.body || card.fulfillment_text} scope={`reel-${card.type}`} />
          : null}
        <button type="button" className="cx-reel-act" onClick={sharePlainText} title="Copy">⤴</button>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────
  // Panel + fullscreen mode
  // ───────────────────────────────────────────────────────────────────────

  // Reels is fullscreen ONLY. When the panel tab mounts, we immediately
  // pop the fullscreen overlay; the in-panel area is just a thin launcher
  // so the user can re-open after dismissing without leaving the tab.
  function ReelsPanel(ctx) {
    const [fs, setFs] = useState(true);
    useEffect(() => { setFs(true); }, []);
    // Render the overlay through a portal to document.body so it escapes
    // every parent stacking context / transform / clip (the right-rail
    // panel was clipping the "fullscreen" overlay on some viewports).
    const overlay = fs ? (
      <div className="cx-reels-overlay" role="dialog" aria-label="Reels fullscreen" onClick={(e) => e.target === e.currentTarget && setFs(false)}>
        <ReelsFeed ctx={ctx} fullscreen={true} onClose={() => setFs(false)} />
      </div>
    ) : null;
    const portal = (overlay && window.ReactDOM && window.ReactDOM.createPortal)
      ? window.ReactDOM.createPortal(overlay, document.body)
      : overlay;
    return (
      <div className="cx-reels-pane">
        <div className="cx-reels-head">
          <span className="cx-reels-title">REELS</span>
          <span className="cx-reels-sub" style={{opacity:0.6, fontSize:"11px", marginLeft:"8px"}}>fullscreen only</span>
          <button type="button" className="cx-reels-fs" onClick={() => setFs(true)} title="Open reels">⛶ Open</button>
        </div>
        {portal}
      </div>
    );
  }

  // Expose for reuse
  window.CODEX_Reels = { ReelsFeed, ReelsPanel, refillDeck, schedulePreload };

  // Plugin registration — defer if API not ready yet
  function registerPlugin() {
    if (!window.CODEX_PLUGINS_API) {
      window.addEventListener("load", registerPlugin, { once: true });
      return;
    }
    try {
      window.CODEX_PLUGINS_API.register({
        id: "reels",
        name: "Reels",
        version: "1.0.0",
        panels: [{
          id: "reels",
          label: "REELS",
          glyph: "▶",
          icon: "⬚",
          render: (ctx) => React.createElement(ReelsPanel, ctx || {}),
        }],
        onNavigate: (book, chapter) => {
          schedulePreload({ bookId: book, chapter });
        },
      });
    } catch (e) {
      console.warn("[reels] plugin registration failed:", e);
    }
  }
  registerPlugin();
})();
