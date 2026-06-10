// GENERATED from reels.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
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

  const useState = React.useState,useEffect = React.useEffect,
    useRef = React.useRef,useMemo = React.useMemo,
    useCallback = React.useCallback;

  // ───────────────────────────────────────────────────────────────────────
  // Deck management
  // ───────────────────────────────────────────────────────────────────────

  const DECK_KEY = "codex.reels.deck.v1";
  const SEEN_KEY = "codex.reels.seen.v1";

  // In-memory deck state — survives navigation but rebuilt on cold start.
  const State = {
    curated: null, // loaded curated cards array
    deck: [], // next ~30 cards to show
    seen: null, // Set of "type:id" already served
    busy: false, // generation in flight
    listeners: new Set() // re-render triggers
  };

  function bumpListeners() {State.listeners.forEach((fn) => {try {fn();} catch {}});}

  // Depth-action emitter — fires ONLY on genuine depth actions (open passage,
  // quest-tease tap, a question resolved), NEVER on mere scrolling/viewing a
  // reel (that stays a no-op so it can't advance continuity — see the existing
  // no-doom-loop rule). Defensive: guarded so nothing breaks when the
  // engagement engine is absent / in Lite mode. The engine listens on the
  // codex:depth-action bus event and records it (bumps mastery + continuity).
  function emitDepth(type, ref, weight, domain) {
    try {
      if (typeof window !== "undefined" &&
      window.CODEX_ENGAGEMENT &&
      typeof window.CODEX_ENGAGEMENT.emit === "function") {
        window.CODEX_ENGAGEMENT.emit(type, ref || undefined, weight, domain);
        return;
      }
    } catch {}
    // Fallback: dispatch the bus event directly (the engine still listens),
    // so an emit() that is missing/throwing never silently drops the signal.
    try {
      window.dispatchEvent(new CustomEvent("codex:depth-action", {
        detail: { type, ref: ref || null, weight, domain: domain || null }
      }));
    } catch {}
  }

  function loadSeen() {
    if (State.seen) return State.seen;
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      State.seen = new Set(raw ? JSON.parse(raw) : []);
    } catch {State.seen = new Set();}
    return State.seen;
  }
  function markSeen(card) {
    const s = loadSeen();s.add(cardKey(card));
    try {localStorage.setItem(SEEN_KEY, JSON.stringify([...s].slice(-2000)));} catch {}
  }
  function cardKey(c) {return `${c.type}:${c.id || (c.anchor || "x") + ":" + (c.title || "").slice(0, 32)}`;}

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
  function pickCurated(typeRotation, profile) {
    const seen = loadSeen();
    let pool = State.curated.filter((c) => !seen.has(cardKey(c)));
    if (!pool.length) {
      // All cards seen — reset the rolling window so the user can re-encounter
      State.seen = new Set();
      try {localStorage.removeItem(SEEN_KEY);} catch {}
      return State.curated[Math.floor(Math.random() * State.curated.length)];
    }
    // Profile bias: when the reader has favourite books, prefer cards anchored
    // there — but only when that still leaves a healthy pool (keep variety).
    if (profile && profile.topBooks && profile.topBooks.length) {
      const fav = pool.filter((c) => {
        const b = typeof c.anchor === "string" && c.anchor.indexOf(".") > 0 ? c.anchor.split(".")[0] : null;
        return b && profile.topBooks.indexOf(b) >= 0;
      });
      if (fav.length >= 3 && Math.random() < 0.6) pool = fav;
    }
    const preferredType = typeRotation;
    const byType = pool.filter((c) => c.type === preferredType);
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
        const work = (art.works || []).find((w) => w.commonsFile);
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
          hue: "#0a0e16"
        };
      }
    } catch {}
    return null;
  }

  // Rotation order — interleaves card kinds so the feed feels alive.
  const TYPE_ORDER = [
  "light-verse", "symbol", "name-of-god", "did-you-know",
  "art-verse", "parable-3", "prophecy-pair", "counting",
  "question", "quest-tease"];


  async function refillDeck(ctx, targetSize = 30) {
    if (State.busy) return;
    State.busy = true;
    try {
      await loadCurated();
      // Reader taste profile (from likes + highlights + history). Biases the
      // feed toward preferred card types/books while keeping ~45% exploration.
      const profile = window.CODEX_ENGAGE && window.CODEX_ENGAGE.buildReaderProfile ?
      window.CODEX_ENGAGE.buildReaderProfile() : null;
      let i = State.deck.length;
      let attempts = 0;
      while (State.deck.length < targetSize && attempts < 200) {
        let typeForSlot = TYPE_ORDER[i % TYPE_ORDER.length];
        if (profile && profile.topTypes && profile.topTypes.length && Math.random() < 0.55) {
          typeForSlot = profile.topTypes[Math.floor(Math.random() * Math.min(3, profile.topTypes.length))];
        }
        let card = null;
        if (typeForSlot === "art-verse") {
          card = fromContext(ctx);
        }
        if (!card) card = pickCurated(typeForSlot, profile);
        if (card && !State.deck.find((c) => cardKey(c) === cardKey(card))) {
          State.deck.push(card);
          markSeen(card);
          i++;
        }
        attempts++;
      }
      try {localStorage.setItem(DECK_KEY, JSON.stringify(State.deck));} catch {}
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
  setTimeout(() => {restoreDeck();refillDeck({}, 30).catch(() => {});}, 800);

  // ───────────────────────────────────────────────────────────────────────
  // Card renderers
  // ───────────────────────────────────────────────────────────────────────

  const TYPE_LABELS = {
    "art-verse": "⌖ ART",
    "light-verse": "✦ LIGHT",
    "symbol": "◊ SYMBOL",
    "name-of-god": "ℵ NAME",
    "did-you-know": "✱ DID YOU KNOW",
    "parable-3": "❧ PARABLE",
    "prophecy-pair": "⟿ PROPHECY",
    "counting": "# NUMBER",
    "question": "? QUESTION",
    "quest-tease": "⌬ QUEST"
  };

  function refLabel(anchor) {
    if (!anchor) return "";
    const parts = anchor.split(".");
    const bookId = parts[0];
    const book = window.CODEX_DATA?.bookName && window.CODEX_DATA.bookName(bookId) || bookId.toUpperCase();
    return parts.length >= 3 ? `${book} ${parts[1]}:${parts[2]}` : `${book} ${parts[1] || ""}`;
  }

  function navigateToAnchor(anchor) {
    if (!anchor) return;
    if (typeof window.codexJumpToRef === "function") {
      const parts = anchor.split(".");
      const book = window.CODEX_DATA?.bookName && window.CODEX_DATA.bookName(parts[0]) || parts[0];
      window.codexJumpToRef(parts.length >= 3 ? `${book} ${parts[1]}:${parts[2]}` : `${book} ${parts[1]}`);
    } else {
      window.dispatchEvent(new CustomEvent("codex:navigate", { detail: { anchor } }));
    }
  }

  function CardArtVerse({ card }) {
    return (/*#__PURE__*/
      React.createElement("div", { className: "cx-reel cx-reel-art", style: { background: card.hue } },
      card.image ? /*#__PURE__*/React.createElement("img", { className: "cx-reel-hero", src: card.image, alt: card.title, loading: "lazy" }) : null, /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-art-grad" }), /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-art-meta" }, /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-art-title" }, card.title), /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-art-artist" }, card.artist || "", card.year ? ` · ${card.year}` : "")
      ), /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-art-verse" }, /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-art-ref" }, refLabel(card.anchor)),
      card.body ? /*#__PURE__*/React.createElement("p", null, card.body) : null
      )
      ));

  }

  function CardLightVerse({ card }) {
    return (/*#__PURE__*/
      React.createElement("div", { className: "cx-reel cx-reel-light", style: { background: card.hue || "#06080e" } }, /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-light-text" }, card.body), /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-light-ref" }, refLabel(card.anchor))
      ));

  }

  function CardSymbol({ card }) {
    return (/*#__PURE__*/
      React.createElement("div", { className: "cx-reel cx-reel-symbol", style: { ['--card-hue']: card.hue } }, /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-symbol-glyph" }, card.glyph || "◊"), /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-symbol-title" }, card.title), /*#__PURE__*/
      React.createElement("p", { className: "cx-reel-symbol-body" }, card.body), /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-symbol-ref" }, refLabel(card.anchor))
      ));

  }

  function CardNameOfGod({ card }) {
    return (/*#__PURE__*/
      React.createElement("div", { className: "cx-reel cx-reel-name", style: { ['--card-hue']: card.hue } }, /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-name-hebrew" }, card.title), /*#__PURE__*/
      React.createElement("p", { className: "cx-reel-name-body" }, card.body), /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-name-ref" }, refLabel(card.anchor))
      ));

  }

  function CardDidYouKnow({ card }) {
    return (/*#__PURE__*/
      React.createElement("div", { className: "cx-reel cx-reel-fact", style: { ['--card-hue']: card.hue } }, /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-fact-label" }, "DID YOU KNOW"), /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-fact-title" }, card.title), /*#__PURE__*/
      React.createElement("p", { className: "cx-reel-fact-body" }, card.body),
      card.anchor ? /*#__PURE__*/React.createElement("div", { className: "cx-reel-fact-ref" }, refLabel(card.anchor)) : null
      ));

  }

  function CardParable({ card }) {
    return (/*#__PURE__*/
      React.createElement("div", { className: "cx-reel cx-reel-parable", style: { ['--card-hue']: card.hue } }, /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-parable-label" }, "A PARABLE IN THREE SENTENCES"), /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-parable-title" }, card.title), /*#__PURE__*/
      React.createElement("p", { className: "cx-reel-parable-body" }, card.body), /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-parable-ref" }, refLabel(card.anchor))
      ));

  }

  function CardProphecyPair({ card }) {
    return (/*#__PURE__*/
      React.createElement("div", { className: "cx-reel cx-reel-prophecy", style: { ['--card-hue']: card.hue } }, /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-prophecy-title" }, card.title), /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-prophecy-half" }, /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-prophecy-tag" }, "PROPHECY \xB7 ", refLabel(card.anchor)), /*#__PURE__*/
      React.createElement("p", null, card.prophecy)
      ), /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-prophecy-arrow" }, "\u2193"), /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-prophecy-half is-fulfilled" }, /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-prophecy-tag" }, "FULFILLED \xB7 ", refLabel(card.fulfillment)), /*#__PURE__*/
      React.createElement("p", null, card.fulfillment_text)
      )
      ));

  }

  function CardCounting({ card }) {
    return (/*#__PURE__*/
      React.createElement("div", { className: "cx-reel cx-reel-count", style: { ['--card-hue']: card.hue } }, /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-count-num" }, card.title), /*#__PURE__*/
      React.createElement("p", { className: "cx-reel-count-body" }, card.body)
      ));

  }

  function CardQuestion({ card }) {
    const [revealed, setRevealed] = useState(false);
    // Resolving a question is a genuine depth action ("find/question" card
    // resolved). Log it as a discovery (weight 2, cross-cutting / no domain).
    // Only on the explicit reveal tap, never on mount/scroll.
    const resolve = () => {
      setRevealed(true);
      emitDepth("discovery-logged", card.anchor || (card.id ? "reel:" + card.id : null), 2, null);
    };
    return (/*#__PURE__*/
      React.createElement("div", { className: "cx-reel cx-reel-q", style: { ['--card-hue']: card.hue } }, /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-q-label" }, "QUESTION"), /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-q-text" }, card.question),
      revealed ? /*#__PURE__*/
      React.createElement("p", { className: "cx-reel-q-answer" }, card.answer) : /*#__PURE__*/

      React.createElement("button", { type: "button", className: "cx-reel-q-reveal", onClick: resolve }, "tap to reveal"

      ),

      card.anchor ? /*#__PURE__*/React.createElement("div", { className: "cx-reel-q-ref" }, refLabel(card.anchor)) : null
      ));

  }

  function CardQuest({ card }) {
    // Picking up a quest-tease is a genuine depth action: the reader is opening
    // a thread. Emit on the explicit tap only (never on scroll/view), then try
    // to start a matching curated quest if the engine exposes one, and follow
    // the passage. All engine calls guarded for Lite/offline.
    const openThread = () => {
      emitDepth("quest-step", card.questId || card.id || card.anchor || null, 3, null);
      try {
        const ENG = typeof window !== "undefined" && window.CODEX_ENGAGEMENT || null;
        const qid = card.questId || card.id;
        if (qid && ENG && typeof ENG.questState === "function" && typeof ENG.startQuest === "function") {
          const st = ENG.questState(qid);
          if (!st || st.status === "available") {
            Promise.resolve(ENG.startQuest(qid)).catch(() => {});
          }
        }
      } catch {}
      if (card.anchor) navigateToAnchor(card.anchor);
    };
    return (/*#__PURE__*/
      React.createElement("div", { className: "cx-reel cx-reel-quest", style: { ['--card-hue']: card.hue } }, /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-quest-label" }, "A QUEST"), /*#__PURE__*/
      React.createElement("button", { type: "button", className: "cx-reel-quest-tap", onClick: openThread,
        title: "Open this thread" }, /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-quest-title" }, card.title), /*#__PURE__*/
      React.createElement("p", { className: "cx-reel-quest-body" }, card.body)
      ), /*#__PURE__*/
      React.createElement("div", { className: "cx-reel-quest-ref" }, refLabel(card.anchor))
      ));

  }

  const CARD_RENDERERS = {
    "art-verse": CardArtVerse,
    "light-verse": CardLightVerse,
    "symbol": CardSymbol,
    "name-of-god": CardNameOfGod,
    "did-you-know": CardDidYouKnow,
    "parable-3": CardParable,
    "prophecy-pair": CardProphecyPair,
    "counting": CardCounting,
    "question": CardQuestion,
    "quest-tease": CardQuest
  };

  // ───────────────────────────────────────────────────────────────────────
  // Feed component — vertical scroll-snap
  // ───────────────────────────────────────────────────────────────────────

  function ReelsFeed({ ctx, fullscreen, onClose }) {
    const [, force] = useState(0);
    useEffect(() => {
      const bump = () => force((n) => n + 1);
      State.listeners.add(bump);
      restoreDeck();
      if (State.deck.length < 10) refillDeck(ctx, 30).catch(() => {});
      return () => {State.listeners.delete(bump);};
    }, []);

    const [activeIdx, setActiveIdx] = useState(0);
    const scrollRef = useRef(null);

    // Watch for scroll-snap position
    const onScroll = useCallback(() => {
      const el = scrollRef.current;if (!el) return;
      const cardH = el.clientHeight;
      const idx = Math.round(el.scrollTop / cardH);
      if (idx !== activeIdx) {setActiveIdx(idx);if (window.CODEX_ENGAGE) window.CODEX_ENGAGE.trackReel();}
      // Refill near the end
      if (idx > State.deck.length - 8) refillDeck(ctx, State.deck.length + 20).catch(() => {});
    }, [activeIdx, ctx]);

    // Keyboard nav. Resolve the scroller INSIDE the handler — on first
    // render the deck is still loading, so scrollRef.current is null and an
    // early-return here would mean Escape never binds (the deps never change).
    useEffect(() => {
      const onKey = (e) => {
        const el = scrollRef.current;
        if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " " || e.key === "j") {
          if (!el) return;
          e.preventDefault();
          el.scrollBy({ top: el.clientHeight, behavior: "smooth" });
        } else if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "k") {
          if (!el) return;
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
      return /*#__PURE__*/React.createElement("div", { className: "cx-reels-empty" }, "loading the feed\u2026");
    }

    return (/*#__PURE__*/
      React.createElement("div", { className: `cx-reels ${fullscreen ? "is-fullscreen" : ""}` },
      fullscreen && onClose ? /*#__PURE__*/
      React.createElement("button", { type: "button", className: "cx-reels-close", onClick: onClose, "aria-label": "Close reels" }, "\u2715") :
      null, /*#__PURE__*/
      React.createElement("div", { className: "cx-reels-scroll", ref: scrollRef, onScroll: onScroll },
      State.deck.map((card, i) => {
        const Renderer = CARD_RENDERERS[card.type] || CardLightVerse;
        return (/*#__PURE__*/
          React.createElement("section", { key: cardKey(card) + ":" + i, className: "cx-reels-slot", "aria-label": card.title || card.type }, /*#__PURE__*/
          React.createElement("div", { className: "cx-reel-typebadge" }, TYPE_LABELS[card.type] || "◌"), /*#__PURE__*/
          React.createElement(Renderer, { card: card }), /*#__PURE__*/
          React.createElement(ReelActions, { card: card, onClose: onClose })
          ));

      })
      ), /*#__PURE__*/
      React.createElement("div", { className: "cx-reels-dots", "aria-hidden": "true" },
      State.deck.slice(0, 10).map((_, i) => /*#__PURE__*/
      React.createElement("span", { key: i, className: `cx-reels-dot ${i === activeIdx ? "is-on" : ""}` })
      )
      )
      ));

  }

  function ReelActions({ card, onClose }) {
    const ENG = typeof window !== "undefined" && window.CODEX_ENGAGE || null;
    const [liked, setLiked] = useState(() => {
      try {return !!(ENG && ENG.isReelLiked && ENG.isReelLiked(card));} catch {return false;}
    });
    const toast = (msg, kind) => {
      try {window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg, kind: kind || "ok" } }));} catch {}
    };

    // LIKE — records the explicit taste signal (engagement profile) and, if the
    // card points at a passage, also bookmarks it. Works on every card type.
    const like = () => {
      let res = { liked: !liked };
      try {if (ENG && ENG.toggleReelLike) res = ENG.toggleReelLike(card);} catch {}
      setLiked(res.liked);
      if (res.liked && card.anchor) {
        try {
          const list = JSON.parse(localStorage.getItem("codex.bookmarks") || "[]");
          if (!list.some((b) => b.ref === card.anchor && b.kind === "reel")) {
            list.push({ ref: card.anchor, kind: "reel", title: card.title || card.type, at: Date.now() });
            localStorage.setItem("codex.bookmarks", JSON.stringify(list));
            window.dispatchEvent(new CustomEvent("codex:bookmark-added", { detail: { ref: card.anchor, title: card.title || card.type } }));
          }
        } catch {}
      }
      toast(res.liked ? "♥ Liked — your feed will lean this way" : "Removed from likes");
    };

    const openPassage = () => {
      // Genuine depth action: the reader is following the card's thread into
      // the passage. Use the contract crossref-follow type (weight 1,
      // cross-references). Guarded so Lite/offline never breaks.
      if (card.anchor) emitDepth("crossref-follow", card.anchor, 1, "cross-references");
      navigateToAnchor(card.anchor);
      if (onClose) onClose();
    };

    // SHARE — native share sheet when available (mobile + supported desktop),
    // clipboard fallback otherwise, with explicit feedback either way.
    const share = async () => {
      const text = [card.title, card.body || card.question || "", card.anchor ? `— ${refLabel(card.anchor)}` : "", "", "✦ via CODEX"].
      filter(Boolean).join("\n");
      try {
        if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
          await navigator.share({ title: card.title || "CODEX", text });
          return; // native sheet handled it
        }
      } catch (e) {
        if (e && e.name === "AbortError") return; // user dismissed — silent
        // otherwise fall through to clipboard
      }
      try {
        await navigator.clipboard.writeText(text);
        toast("Copied to clipboard");
      } catch (e) {
        toast("Share unavailable here", "warn");
      }
    };

    return (/*#__PURE__*/
      React.createElement("div", { className: "cx-reel-actions" }, /*#__PURE__*/
      React.createElement("button", { type: "button", className: `cx-reel-act ${liked ? "is-liked" : ""}`, onClick: like,
        title: liked ? "Unlike" : "Like — show me more like this", "aria-pressed": liked }, liked ? "♥" : "♡"), /*#__PURE__*/
      React.createElement("button", { type: "button", className: "cx-reel-act", onClick: openPassage, title: "Open passage", disabled: !card.anchor }, "\uD83D\uDCD6"),
      window.CODEX_NormieToggle && (card.body || card.fulfillment_text) ? /*#__PURE__*/
      React.createElement(window.CODEX_NormieToggle, { text: card.body || card.fulfillment_text, scope: `reel-${card.type}` }) :
      null, /*#__PURE__*/
      React.createElement("button", { type: "button", className: "cx-reel-act", onClick: share, title: "Share" }, "\u2934")
      ));

  }

  // ───────────────────────────────────────────────────────────────────────
  // Panel + fullscreen mode
  // ───────────────────────────────────────────────────────────────────────

  // Reels is fullscreen ONLY. When the panel tab mounts, we immediately
  // pop the fullscreen overlay; the in-panel area is just a thin launcher
  // so the user can re-open after dismissing without leaving the tab.
  function ReelsPanel(ctx) {
    const [fs, setFs] = useState(true);
    useEffect(() => {setFs(true);}, []);
    // Closing reels returns to reading: drop fullscreen AND ask the host to
    // close the rails, so we don't leave an open rail behind a dimmed scrim
    // (the "exit reels leaves the screen dimmed, needs an extra click" bug).
    const closeFs = () => {
      setFs(false);
      try {window.dispatchEvent(new CustomEvent("codex:close-rails"));} catch (e) {}
    };
    // Render the overlay through a portal to document.body so it escapes
    // every parent stacking context / transform / clip (the right-rail
    // panel was clipping the "fullscreen" overlay on some viewports).
    const overlay = fs ? /*#__PURE__*/
    React.createElement("div", { className: "cx-reels-overlay", role: "dialog", "aria-label": "Reels fullscreen", onClick: (e) => e.target === e.currentTarget && closeFs() }, /*#__PURE__*/
    React.createElement(ReelsFeed, { ctx: ctx, fullscreen: true, onClose: closeFs })
    ) :
    null;
    const portal = overlay && window.ReactDOM && window.ReactDOM.createPortal ?
    window.ReactDOM.createPortal(overlay, document.body) :
    overlay;
    return (/*#__PURE__*/
      React.createElement("div", { className: "cx-reels-pane" }, /*#__PURE__*/
      React.createElement("div", { className: "cx-reels-head" }, /*#__PURE__*/
      React.createElement("span", { className: "cx-reels-title" }, "REELS"), /*#__PURE__*/
      React.createElement("span", { className: "cx-reels-sub", style: { opacity: 0.6, fontSize: "11px", marginLeft: "8px" } }, "fullscreen only"), /*#__PURE__*/
      React.createElement("button", { type: "button", className: "cx-reels-fs", onClick: () => setFs(true), title: "Open reels" }, "\u26F6 Open")
      ),
      portal
      ));

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
          render: (ctx) => React.createElement(ReelsPanel, ctx || {})
        }],
        onNavigate: (book, chapter) => {
          schedulePreload({ bookId: book, chapter });
        }
      });
    } catch (e) {
      console.warn("[reels] plugin registration failed:", e);
    }
  }
  registerPlugin();
})();
})();
