// CODEX — Continuity & Mastery presentation layer (Phase 2.5).
//
// The "analyst desk" UI on top of window.CODEX_ENGAGEMENT (engagement.js).
// This file owns PRESENTATION + WIRING only — every number, status string,
// quest, season and milestone comes from the engine. We never compute streaks,
// never advance anything, never store engagement state here.
//
// Surfaces built (all via the FROZEN CONTRACT css classes + t() keys):
//   (a) ContinuityIndicator — terse current-continuity + grace readout.
//   (b) AnalystDossier      — per-domain mastery bars, books-at-depth, longest
//                             thread, continuity, the unified INTEL LOG.
//   (c) QuestPlayer         — runs a curated quest (read/find/connect/reflect);
//                             the reflect step writes a note → note-written
//                             depth event; AI feedback is clearly labeled;
//                             the closed quest is exportable as a .codex-study.
//   (d) NextThread          — one quiet "⌁ next: …" line, refreshed on
//                             codex:navigate / codex:open-panel. Never a modal,
//                             never an infinite feed.
//
// DESIGN LAW honored here (the engine enforces the rest):
//   • DEPTH-GATED — this UI emits a depth event ONLY when the user completes a
//     real depth action (advance a quest step, write a reflection note). Merely
//     OPENING the dossier / viewing a quest NEVER advances anything.
//   • GRACE-SHAPED — no red, no broken flame, no "don't break your streak".
//     We bind to engine statusKey/statusText verbatim.
//   • SOLO-FIRST — zero social / leaderboard / ranking surface.
//   • NO mascot / confetti / cute — terminal lexicon, static celebration form
//     under prefers-reduced-motion.
//   • LOCAL-ONLY — all state via the engine (localStorage + IDB). The .codex-
//     study export is a local file download; nothing is phoned home.
//   • a11y — every user-facing string via t(); keyboard parity; :focus-visible
//     left to styles.css; RTL-safe (no hard-coded left/right).
//   • Offline + Lite (?lite=1) — renders NOTHING gracefully; never throws.

(function () {
  "use strict";

  if (typeof window === "undefined" || !window.React) return;

  const React = window.React;
  const { useState, useEffect, useRef, useCallback, useMemo } = React;

  // ── Lite mode — ?lite=1 hides engagement surfaces entirely. The engine
  //    still loads; we just render nothing. (Never throws if location is odd.)
  let LITE = false;
  try {
    const q = new URLSearchParams(window.location.search || "");
    LITE = q.get("lite") === "1" || q.get("lite") === "true";
  } catch (_) { LITE = false; }

  // ── i18n — terse helper. Falls back to the supplied English if the global
  //    i18n module (i18n.js, owned elsewhere) hasn't registered the cx.* keys.
  function t(key, fallback, vars) {
    let out = fallback != null ? fallback : key;
    try {
      if (typeof window.t === "function") {
        const v = window.t(key);
        if (v && v !== key) out = v;
      }
    } catch (_) {}
    if (vars) {
      out = String(out).replace(/\{(\w+)\}/g, function (m, k) {
        return vars[k] != null ? vars[k] : m;
      });
    }
    return out;
  }

  // ── Engine access — every call guarded; engine may be absent / mid-load.
  function ENG() {
    return (typeof window !== "undefined" && window.CODEX_ENGAGEMENT) || null;
  }
  function safe(fn, dflt) {
    try { const v = fn(); return v == null ? dflt : v; }
    catch (_) { return dflt; }
  }

  // Domain display order (the engine's canonical 8). Read from the engine so
  // we never drift from its taxonomy; fall back to the contract list.
  const FALLBACK_DOMAINS = [
    "hebrew-greek", "cross-references", "gematria", "talmud",
    "patristics", "gnosis", "geography", "canon-coverage",
  ];
  function domains() {
    const e = ENG();
    const d = e && Array.isArray(e.DOMAINS) ? e.DOMAINS : null;
    return (d && d.length) ? d : FALLBACK_DOMAINS;
  }

  function reducedMotion() {
    try {
      return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (_) { return false; }
  }

  function isoStamp(ts) {
    // ts may be an ISO day string or an epoch ms. Render a calm date stamp.
    try {
      if (ts == null) return "";
      if (typeof ts === "string" && /^\d{4}-\d{2}-\d{2}/.test(ts)) return ts.slice(0, 10);
      const d = new Date(ts);
      if (isNaN(d.getTime())) return String(ts);
      return d.toISOString().slice(0, 10);
    } catch (_) { return ""; }
  }

  // A small ASCII bar — "▓▓▓▓░" — for the analyst-desk voice. Pure text so it
  // reads identically with or without styles.css and is screen-reader-sane via
  // the aria-label we attach at the call site.
  function asciiBar(pct, cells) {
    const n = cells || 5;
    const filled = Math.max(0, Math.min(n, Math.round((pct / 100) * n)));
    return "▓".repeat(filled) + "░".repeat(n - filled);
  }

  // Emit a depth event through the engine (preferred) or the bus (fallback).
  // Called ONLY on a genuine depth action, never on open/scroll/view.
  function emitDepth(type, ref, weight, domain) {
    const e = ENG();
    try {
      if (e && typeof e.emit === "function") { e.emit(type, ref || undefined, weight, domain); return; }
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent("codex:depth-action", {
        detail: { type: type, ref: ref || null, weight: weight, domain: domain || null },
      }));
    } catch (_) {}
  }

  // ════════════════════════════════════════════════════════════════════════
  // (a) ContinuityIndicator — terse readout. No flame, no guilt. Calm.
  // ════════════════════════════════════════════════════════════════════════
  function ContinuityIndicator(props) {
    const compact = !!(props && props.compact);
    const [status, setStatus] = useState(function () {
      return safe(function () {
        const e = ENG();
        // continuity() reconciles a stale gap for display (may silently spend
        // grace). That's the correct read-only call for a passive indicator.
        return e ? e.continuity() : null;
      }, null);
    });

    useEffect(function () {
      function refresh() {
        setStatus(safe(function () {
          const e = ENG();
          return e ? e.continuityStatus() : null;  // pure read, no side effects
        }, null));
      }
      // Re-read on a fresh continuity tick (depth-gated, fired by the engine)
      // and whenever any depth action lands.
      window.addEventListener("codex:continuity-tick", refresh);
      window.addEventListener("codex:depth-action", refresh);
      return function () {
        window.removeEventListener("codex:continuity-tick", refresh);
        window.removeEventListener("codex:depth-action", refresh);
      };
    }, []);

    if (!status) return null;

    const held = (status.graceSpent || 0) > 0;
    const idle = !status.lastDay;
    const cls = "cx-continuity"
      + (held ? " cx-continuity-held" : "")
      + (idle ? " cx-continuity-idle" : "");

    const grace = Math.max(0, status.grace || 0);
    const graceCap = status.graceCap || 2;
    // Grace tokens as calm dots — never a broken flame.
    const graceDots = "◆".repeat(grace) + "◇".repeat(Math.max(0, graceCap - grace));

    const ringPct = (function () {
      // Show progress within the current 7-day grace ring (purely cosmetic).
      const span = (status.nextGraceIn != null && status.sinceGrace != null)
        ? (status.sinceGrace + status.nextGraceIn) : 7;
      const done = status.sinceGrace || 0;
      return span > 0 ? Math.min(100, Math.round((done / span) * 100)) : 0;
    })();

    return (
      <div className={cls} role="status" aria-live="polite">
        <div
          className="cx-continuity-ring"
          role="img"
          aria-label={t("cx.continuity.ring", "Continuity ring") + " · " + ringPct + "%"}
          data-static={reducedMotion() ? "1" : undefined}
          style={{ "--cx-ring-pct": ringPct }}
        >
          <span className="cx-continuity-count">{status.current || 0}</span>
        </div>
        {!compact && (
          <div className="cx-continuity-meta">
            <span className="cx-continuity-status">{status.statusText || t("cx.continuity.active", "Continuity active")}</span>
            <span
              className="cx-continuity-grace"
              title={t("cx.continuity.grace", "Grace") + (status.nextGraceIn > 0
                ? " · " + t("cx.continuity.grace.next", "Next grace token in {n} days", { n: status.nextGraceIn })
                : "")}
              aria-label={t("cx.continuity.grace", "Grace") + " " + grace + "/" + graceCap}
            >
              {t("cx.continuity.grace", "Grace")} {graceDots}
            </span>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // Mastery grid — per-domain bars in the analyst-desk voice.
  //   "MASTERY · HEBREW ▓▓▓▓░ 78% · 412 threads"
  // ════════════════════════════════════════════════════════════════════════
  function MasteryGrid() {
    const [cells, setCells] = useState(function () {
      return safe(function () { const e = ENG(); return e ? e.mastery() : null; }, null);
    });

    useEffect(function () {
      function refresh() {
        setCells(safe(function () { const e = ENG(); return e ? e.mastery() : null; }, null));
      }
      window.addEventListener("codex:depth-action", refresh);
      window.addEventListener("codex:milestone", refresh);
      window.addEventListener("codex:quest-step", refresh);
      return function () {
        window.removeEventListener("codex:depth-action", refresh);
        window.removeEventListener("codex:milestone", refresh);
        window.removeEventListener("codex:quest-step", refresh);
      };
    }, []);

    const e = ENG();
    const levels = (e && Array.isArray(e.MASTERY_LEVELS)) ? e.MASTERY_LEVELS : null;

    // Compute a 0–100 progress toward the NEXT level for the bar fill.
    function pctToNext(score, levelIdx) {
      if (!levels || !levels.length) return 0;
      const cur = levels[Math.min(levelIdx, levels.length - 1)];
      const nxt = levels[levelIdx + 1];
      if (!nxt) return 100; // already at the top level
      const base = cur ? cur.min : 0;
      const span = nxt.min - base;
      if (span <= 0) return 100;
      return Math.max(0, Math.min(100, Math.round(((score - base) / span) * 100)));
    }

    return (
      <div className="cx-mastery-grid">
        {domains().map(function (d) {
          const cell = (cells && cells[d]) || { score: 0, threads: 0, level: 0, levelLabel: "" };
          const pct = pctToNext(cell.score || 0, cell.level || 0);
          const bar = asciiBar(pct, 5);
          const domainLabel = t("cx.domain." + d, d);
          const levelLabel = cell.levelLabel || t("cx.mastery.lvl.dormant", "Dormant");
          return (
            <div className="cx-mastery-domain" key={d}>
              <div className="cx-mastery-domain-head">
                <span className="cx-mastery-domain-name">{domainLabel}</span>
                <span className="cx-mastery-level">{levelLabel}</span>
              </div>
              <div
                className="cx-mastery-bar"
                role="img"
                aria-label={domainLabel + " · " + levelLabel + " · " + pct + "%"}
                data-static={reducedMotion() ? "1" : undefined}
                style={{ "--cx-bar-pct": pct }}
              >
                <span className="cx-mastery-bar-ascii" aria-hidden="true">{bar}</span>
                <span className="cx-mastery-bar-pct" aria-hidden="true">{pct}%</span>
              </div>
              <div className="cx-mastery-threads">
                {t("cx.mastery.threads", "{n} threads closed", { n: cell.threads || 0 })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // Intel log — the unified discovery/milestone feed with date stamps.
  // Reads the engine's eventLog() (durable IDB → LS fallback) + milestones().
  // ════════════════════════════════════════════════════════════════════════
  function IntelLog() {
    const [rows, setRows] = useState([]);

    const load = useCallback(function () {
      const e = ENG();
      if (!e) { setRows([]); return; }
      // Milestones are the "discoveries logged" headline rows; the raw event
      // log gives weight>=4 (thread-closing) depth events as supporting intel.
      const ms = safe(function () { return e.milestones(); }, { unlocked: {} }) || { unlocked: {} };
      const msRows = Object.keys(ms.unlocked || {}).map(function (id) {
        return { kind: "milestone", id: id, stamp: ms.unlocked[id] };
      });
      Promise.resolve(safe(function () { return e.eventLog(); }, []))
        .then(function (log) {
          const closing = (Array.isArray(log) ? log : [])
            .filter(function (ev) { return ev && (ev.weight || 0) >= 4; })
            .slice(-40)
            .reverse()
            .map(function (ev) {
              return {
                kind: "thread",
                id: ev.type + (ev.ref ? " · " + ev.ref : ""),
                domain: ev.domain || null,
                stamp: ev.ts,
              };
            });
          // Merge, newest first by stamp.
          const all = msRows.concat(closing).sort(function (a, b) {
            const av = +new Date(isoStamp(a.stamp)) || 0;
            const bv = +new Date(isoStamp(b.stamp)) || 0;
            return bv - av;
          });
          setRows(all.slice(0, 50));
        })
        .catch(function () { setRows(msRows); });
    }, []);

    useEffect(function () {
      load();
      window.addEventListener("codex:milestone", load);
      window.addEventListener("codex:depth-action", load);
      return function () {
        window.removeEventListener("codex:milestone", load);
        window.removeEventListener("codex:depth-action", load);
      };
    }, [load]);

    if (!rows.length) {
      return <div className="cx-dossier-stat cx-dossier-empty">{t("cx.dossier.empty", "No threads opened yet. Begin any depth surface to open a case.")}</div>;
    }

    return (
      <ul className="cx-intel-log" aria-label={t("cx.dossier.intel", "Intel")}>
        {rows.map(function (r, i) {
          const label = r.kind === "milestone"
            ? t("cx.milestone.discovery", "Discovery logged")
            : (r.domain ? t("cx.domain." + r.domain, r.domain) : t("cx.milestone.unlocked", "Milestone logged"));
          return (
            <li className="cx-intel-badge" key={r.id + ":" + i}>
              <span className="cx-intel-badge-stamp">{isoStamp(r.stamp)}</span>
              <span className="cx-intel-badge-label">{label}</span>
              <span className="cx-intel-badge-ref">{r.id}</span>
            </li>
          );
        })}
      </ul>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // (c) QuestPlayer — runs ONE curated quest. read/find/connect/reflect.
  //   • advance() drives engine.advanceQuest() (which records the depth event).
  //   • reflect writes a note (codex.notes.v1) AND emits note-written.
  //   • AI feedback is OPTIONAL, clearly LABELED, and never blocks completion.
  //   • a closed quest exports as a .codex-study JSON (local download only).
  // ════════════════════════════════════════════════════════════════════════
  const STEP_KIND_KEY = {
    read: "cx.quest.step.read",
    find: "cx.quest.step.find",
    connect: "cx.quest.step.connect",
    reflect: "cx.quest.step.reflect",
  };
  const STEP_KIND_EN = { read: "Read", find: "Find", connect: "Connect", reflect: "Reflect" };

  function jumpRef(refStr) {
    try { if (refStr && window.codexJumpToRef) window.codexJumpToRef(refStr); } catch (_) {}
  }

  function saveReflectionNote(questTitle, stepIdx, text) {
    // Persist to the same store notes.jsx uses, so the reflection shows up in
    // the user's notes. Then emit the note-written depth event (weight 2,
    // cross-cutting) so it qualifies the day + feeds continuity.
    try {
      const KEY = "codex.notes.v1";
      let arr = [];
      try { arr = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (_) { arr = []; }
      if (!Array.isArray(arr)) arr = [];
      arr.push({
        id: "quest-reflect-" + Date.now().toString(36),
        text: String(text || "").slice(0, 4000),
        ref: null,
        tag: "quest",
        title: "Reflection · " + (questTitle || ""),
        created: Date.now(),
      });
      localStorage.setItem(KEY, JSON.stringify(arr));
    } catch (_) {}
    emitDepth("note-written", "quest-reflect", undefined, null);
  }

  function QuestPlayer(props) {
    const questId = props.questId;
    const onClose = props.onClose;
    const [quest, setQuest] = useState(null);     // full module { meta, steps }
    const [state, setState] = useState(null);     // engine quest state
    const [reflection, setReflection] = useState("");
    const [reflectionSaved, setReflectionSaved] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [fbLoading, setFbLoading] = useState(false);
    const [fbError, setFbError] = useState("");
    const liveRef = useRef(null);

    // Load the full quest module + its local state.
    useEffect(function () {
      let alive = true;
      const e = ENG();
      if (!e || !questId) return;
      Promise.resolve(safe(function () { return e.getQuest(questId); }, null))
        .then(function (q) { if (alive) setQuest(q || null); })
        .catch(function () { if (alive) setQuest(null); });
      setState(safe(function () { return e.questState(questId); }, null));
      return function () { alive = false; };
    }, [questId]);

    // Stay in sync with engine quest-step events.
    useEffect(function () {
      function onStep(ev) {
        const d = (ev && ev.detail) || {};
        if (d.questId && d.questId !== questId) return;
        setState(safe(function () { const e = ENG(); return e ? e.questState(questId) : null; }, null));
      }
      window.addEventListener("codex:quest-step", onStep);
      return function () { window.removeEventListener("codex:quest-step", onStep); };
    }, [questId]);

    if (!quest) return null;
    const steps = Array.isArray(quest.steps) ? quest.steps : [];
    const st = state || { status: "available", step: 0 };
    const stepIdx = Math.min(st.step || 0, Math.max(0, steps.length - 1));
    const done = st.status === "complete";
    const cur = steps[stepIdx] || null;
    const isReflect = cur && cur.kind === "reflect";

    const start = function () {
      const e = ENG(); if (!e) return;
      Promise.resolve(safe(function () { return e.startQuest(questId); }, null))
        .then(function () { setState(safe(function () { return e.questState(questId); }, null)); });
    };

    const advance = function () {
      // For a reflect step, require a saved reflection first (the depth action
      // IS the writing). For other steps the advance is the depth action.
      if (isReflect && !reflectionSaved && reflection.trim()) {
        saveReflectionNote(quest.meta && quest.meta.title, stepIdx, reflection);
        setReflectionSaved(true);
      }
      const e = ENG(); if (!e) return;
      Promise.resolve(safe(function () { return e.advanceQuest(questId); }, null))
        .then(function () { setState(safe(function () { return e.questState(questId); }, null)); });
    };

    // AI feedback — optional, clearly labeled, never required. Uses the same
    // /api/chat path the rest of the app uses; degrades to a calm error line.
    const requestFeedback = function () {
      setFbLoading(true); setFbError("");
      let provider = "anthropic", model = undefined;
      try {
        // Same source the rest of the app uses for the active provider/model.
        const tw = (window.CODEX_DATA && window.CODEX_DATA.tweaks) || {};
        provider = tw.provider || provider; model = tw.model || model;
      } catch (_) {}
      const compiled = steps.map(function (s, i) {
        return (i + 1) + ". [" + (s.kind || "") + "] " + (s.prompt || "");
      }).join("\n");
      const system = "You are a careful, tradition-agnostic scripture analyst giving feedback on a reader's quest reflection. Be specific and honest, name the text, never push one tradition. 150-220 words, plain prose.";
      const userMsg = "Quest: " + (quest.meta && quest.meta.title || "") + "\n\nSteps:\n" + compiled + "\n\nReader's reflection:\n" + (reflection.trim() || "(none written)");
      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider, model: model, system: system, messages: [{ role: "user", content: userMsg }], max_tokens: 700 }),
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.text) throw new Error((d && d.error) || "no feedback");
          setFeedback(String(d.text).trim());
        })
        .catch(function () { setFbError(t("cx.dossier.empty", "")); })
        .finally(function () { setFbLoading(false); });
    };

    // Export the closed quest as a .codex-study module (local download only).
    const exportStudy = function () {
      try {
        const bundle = {
          format: "codex.study",
          version: 1,
          kind: "quest-reflection",
          exportedAt: new Date().toISOString(),
          quest: { id: quest.meta && quest.meta.id, title: quest.meta && quest.meta.title, tradition: quest.meta && quest.meta.tradition, domain: quest.meta && quest.meta.domain, ring: quest.meta && quest.meta.ring },
          steps: steps.map(function (s) { return { kind: s.kind, refs: s.refs || null, prompt: s.prompt, reveal: s.reveal || null }; }),
          reflection: reflection.trim() || null,
          feedback: feedback || null,
        };
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = (quest.meta && quest.meta.id ? quest.meta.id : "quest") + ".codex-study.json";
        document.body.appendChild(a); a.click();
        setTimeout(function () { try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch (_) {} }, 0);
      } catch (_) {}
    };

    const kindLabel = function (k) { return t(STEP_KIND_KEY[k] || "cx.quest.step.read", STEP_KIND_EN[k] || "Read"); };

    return (
      <div className={"cx-quest-card cx-quest-active" + (done ? " cx-quest-complete" : "")} role="group" aria-label={quest.meta && quest.meta.title}>
        <div className="cx-quest-card-head">
          <span className="cx-quest-card-title">{quest.meta && quest.meta.title}</span>
          {onClose && (
            <button type="button" className="cx-quest-close" onClick={onClose} aria-label="Close quest">✕</button>
          )}
        </div>

        <div className="cx-quest-progress" aria-label={(Math.min(st.step || 0, steps.length)) + " / " + steps.length}>
          {steps.map(function (s, i) {
            const cls = "cx-quest-progress-pip"
              + (i < (st.step || 0) ? " is-done" : "")
              + (i === stepIdx && !done ? " is-current" : "");
            return <span key={i} className={cls} aria-hidden="true">{i < (st.step || 0) ? "▰" : "▱"}</span>;
          })}
        </div>

        {!done && st.status !== "active" && (
          <div className="cx-quest-step">
            <p className="cx-quest-step-prompt">{steps[0] && steps[0].prompt}</p>
            <button type="button" className="cx-quest-btn" onClick={start}>{t("cx.quest.start", "Open thread")}</button>
          </div>
        )}

        {!done && st.status === "active" && cur && (
          <div className="cx-quest-step" ref={liveRef} aria-live="polite">
            <div className="cx-quest-step-kind">{kindLabel(cur.kind)}</div>
            {Array.isArray(cur.refs) && cur.refs.length > 0 && (
              <div className="cx-quest-step-refs">
                {cur.refs.map(function (rf, i) {
                  return (
                    <a key={i} className="cx-quest-ref" href="#"
                       onClick={function (ev) { ev.preventDefault(); jumpRef(rf); }}
                       title={"Open " + rf}>{rf}</a>
                  );
                })}
              </div>
            )}
            <p className="cx-quest-step-prompt">{cur.prompt}</p>

            {isReflect && (
              <div className="cx-quest-reflect">
                <label className="cx-quest-reflect-label" htmlFor="cx-quest-reflect-ta">{t("cx.quest.step.reflect", "Reflect")}</label>
                <textarea
                  id="cx-quest-reflect-ta"
                  className="cx-quest-reflect-ta"
                  value={reflection}
                  onChange={function (ev) { setReflection(ev.target.value); setReflectionSaved(false); }}
                  rows={4}
                />
              </div>
            )}

            {cur.reveal && (
              <details className="cx-quest-reveal">
                <summary>{t("cx.quest.reveal", "Reveal")}</summary>
                <p>{cur.reveal}</p>
              </details>
            )}

            <button
              type="button"
              className="cx-quest-btn"
              onClick={advance}
              disabled={isReflect && !reflection.trim()}
            >
              {t("cx.quest.advance", "Advance")}
            </button>
          </div>
        )}

        {done && (
          <div className="cx-quest-step cx-quest-done">
            <p className="cx-quest-step-prompt">{t("cx.quest.complete", "Closed")}</p>

            {/* AI feedback — OPTIONAL + clearly labeled. Never gates completion. */}
            <div className="cx-quest-feedback">
              {!feedback && !fbLoading && (
                <button type="button" className="cx-quest-btn cx-quest-btn-ghost" onClick={requestFeedback}>
                  {t("cx.milestone.unlocked", "AI analyst feedback")}
                </button>
              )}
              {fbLoading && <p className="cx-quest-feedback-loading">…</p>}
              {feedback && (
                <blockquote className="cx-quest-feedback-text" data-ai="1">
                  <span className="cx-quest-feedback-flag" aria-hidden="true">AI</span>
                  {feedback}
                </blockquote>
              )}
              {fbError && <p className="cx-quest-feedback-err">{fbError || "—"}</p>}
            </div>

            <button type="button" className="cx-quest-btn" onClick={exportStudy}>
              ⤓ .codex-study
            </button>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // Quest list — curated quests with per-quest state. Opening one mounts the
  // QuestPlayer inline. Merely listing/opening NEVER advances anything.
  // ════════════════════════════════════════════════════════════════════════
  function QuestList() {
    const [quests, setQuests] = useState([]);
    const [openId, setOpenId] = useState(null);

    const load = useCallback(function () {
      const e = ENG();
      if (!e) { setQuests([]); return; }
      Promise.resolve(safe(function () { return e.listQuests(); }, []))
        .then(function (qs) { setQuests(Array.isArray(qs) ? qs : []); })
        .catch(function () { setQuests([]); });
    }, []);

    useEffect(function () {
      load();
      window.addEventListener("codex:quest-step", load);
      return function () { window.removeEventListener("codex:quest-step", load); };
    }, [load]);

    function statusLabel(s) {
      if (s === "complete") return t("cx.quest.complete", "Closed");
      if (s === "active") return t("cx.quest.active", "In progress");
      return t("cx.quest.available", "Available");
    }

    if (openId) {
      return <QuestPlayer questId={openId} onClose={function () { setOpenId(null); load(); }} />;
    }

    return (
      <div className="cx-quest-list" aria-label={t("cx.quest.title", "Quests")}>
        {!quests.length && (
          <div className="cx-dossier-stat cx-dossier-empty">{t("cx.dossier.empty", "No threads opened yet. Begin any depth surface to open a case.")}</div>
        )}
        {quests.map(function (q) {
          const cls = "cx-quest-card"
            + (q.status === "active" ? " cx-quest-active" : "")
            + (q.status === "complete" ? " cx-quest-complete" : "");
          return (
            <button
              type="button"
              key={q.id}
              className={cls}
              onClick={function () { setOpenId(q.id); }}
            >
              <span className="cx-quest-card-title">{q.title}</span>
              <span className="cx-quest-card-meta">
                {q.domain ? t("cx.domain." + q.domain, q.domain) : ""}
                {q.tradition ? " · " + q.tradition : ""}
              </span>
              <span className="cx-quest-card-status">
                {statusLabel(q.status)}{q.steps ? " · " + (q.step || 0) + "/" + q.steps : ""}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // (b) AnalystDossier — the engagement home panel. Continuity + mastery +
  //   books-at-depth + longest thread + quests + the unified intel log.
  // ════════════════════════════════════════════════════════════════════════
  function AnalystDossier(ctx) {
    const [snap, setSnap] = useState(function () {
      return {
        continuity: safe(function () { const e = ENG(); return e ? e.continuityStatus() : null; }, null),
        mastery: safe(function () { const e = ENG(); return e ? e.mastery() : null; }, null),
      };
    });

    useEffect(function () {
      function refresh() {
        setSnap({
          continuity: safe(function () { const e = ENG(); return e ? e.continuityStatus() : null; }, null),
          mastery: safe(function () { const e = ENG(); return e ? e.mastery() : null; }, null),
        });
      }
      window.addEventListener("codex:depth-action", refresh);
      window.addEventListener("codex:continuity-tick", refresh);
      window.addEventListener("codex:milestone", refresh);
      return function () {
        window.removeEventListener("codex:depth-action", refresh);
        window.removeEventListener("codex:continuity-tick", refresh);
        window.removeEventListener("codex:milestone", refresh);
      };
    }, []);

    if (!ENG()) {
      return <div className="cx-dossier"><div className="cx-dossier-stat cx-dossier-empty">{t("cx.dossier.empty", "No threads opened yet. Begin any depth surface to open a case.")}</div></div>;
    }

    // Derived intel stats from mastery: books-at-depth ≈ canon-coverage threads;
    // longest thread ≈ the top domain by closed threads.
    const m = snap.mastery || {};
    const canon = m["canon-coverage"] || { threads: 0 };
    let topDomain = null, topThreads = 0;
    Object.keys(m).forEach(function (d) {
      const th = (m[d] && m[d].threads) || 0;
      if (th > topThreads) { topThreads = th; topDomain = d; }
    });
    const cont = snap.continuity || {};

    return (
      <div className="cx-dossier">
        <div className="cx-dossier-header">
          <span className="cx-dossier-title">{t("cx.dossier.title", "Analyst desk")}</span>
        </div>

        <IntelBanner console="CONTINUITY" scope="READER DOSSIER" note="YOUR OWN RECORD · STORED LOCALLY · NEVER UPLOADED" />

        <div className="cx-dossier-section cx-dossier-section--continuity">
          <ContinuityIndicator />
        </div>

        <div className="cx-dossier-section cx-dossier-section--intel">
          <div className="cx-dossier-stat">
            <span className="cx-dossier-stat-k">{t("cx.continuity.title", "Continuity")}</span>
            <span className="cx-dossier-stat-v">{cont.current || 0} · ↥ {cont.longest || 0}</span>
          </div>
          <div className="cx-dossier-stat">
            <span className="cx-dossier-stat-k">{t("cx.domain.canon-coverage", "Canon coverage")}</span>
            <span className="cx-dossier-stat-v">{t("cx.mastery.threads", "{n} threads closed", { n: canon.threads || 0 })}</span>
          </div>
          <div className="cx-dossier-stat">
            <span className="cx-dossier-stat-k">↻</span>
            <span className="cx-dossier-stat-v">{topDomain ? t("cx.domain." + topDomain, topDomain) + " · " + topThreads : "—"}</span>
          </div>
        </div>

        <div className="cx-dossier-section cx-dossier-section--mastery">
          <div className="cx-dossier-subhead">{t("cx.mastery.title", "Mastery")}</div>
          <MasteryGrid />
        </div>

        <div className="cx-dossier-section cx-dossier-section--quests">
          <div className="cx-dossier-subhead">{t("cx.quest.title", "Quests")}</div>
          <QuestList />
        </div>

        <div className="cx-dossier-section cx-dossier-section--log">
          <div className="cx-dossier-subhead">{t("cx.dossier.intel", "Intel")}</div>
          <IntelLog />
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // (d) NextThread — one quiet "⌁ next: …" line. Refreshed on navigation /
  //   panel-open. NEVER a modal, NEVER an infinite feed.
  // ════════════════════════════════════════════════════════════════════════
  function buildCtx(detail) {
    // Assemble a best-effort ctx for nextThread() from cheap host signals.
    const ctx = {};
    try {
      const d = detail || {};
      if (d.ref) ctx.ref = d.ref;
      if (d.book) ctx.book = d.book;
      // The user's own library (gematria-tagged refs), if the host exposes it.
      const lib = safe(function () {
        return (window.CODEX_LIBRARY && window.CODEX_LIBRARY.list && window.CODEX_LIBRARY.list()) || null;
      }, null);
      if (Array.isArray(lib)) ctx.library = lib;
      // Today's daf / this week's parsha if the host pre-staged them.
      const daf = safe(function () { return window.CODEX_TODAY_DAF || null; }, null);
      if (daf) ctx.daf = daf;
      const parsha = safe(function () { return window.CODEX_WEEK_PARSHA || null; }, null);
      if (parsha) ctx.parsha = parsha;
      ctx.crossrefsAvailable = true;
    } catch (_) {}
    return ctx;
  }

  function NextThread() {
    const [sugg, setSugg] = useState(null);
    // Session-scoped dismissal — a professional surface must always be
    // closable. Dismissing hides the thread line until the next session.
    const [dismissed, setDismissed] = useState(function () {
      return safe(function () { return sessionStorage.getItem("cx-nextthread-dismissed") === "1"; }, false);
    });

    const refresh = useCallback(function (detail) {
      const e = ENG();
      if (!e) { setSugg(null); return; }
      const s = safe(function () { return e.nextThread(buildCtx(detail)); }, null);
      // "none" is not a suggestion — render nothing rather than ambient noise.
      setSugg(s && s.kind && s.kind !== "none" ? s : null);
    }, []);

    useEffect(function () {
      refresh(null);
      function onNav(ev) { refresh((ev && ev.detail) || null); }
      function onPanel(ev) { refresh((ev && ev.detail) || null); }
      function onStep() { refresh(null); }
      window.addEventListener("codex:navigate", onNav);
      window.addEventListener("codex:open-panel", onPanel);
      window.addEventListener("codex:quest-step", onStep);
      window.addEventListener("codex:depth-action", onStep);
      return function () {
        window.removeEventListener("codex:navigate", onNav);
        window.removeEventListener("codex:open-panel", onPanel);
        window.removeEventListener("codex:quest-step", onStep);
        window.removeEventListener("codex:depth-action", onStep);
      };
    }, [refresh]);

    if (!sugg || dismissed) return null;

    const kindKey = {
      quest: "cx.nextthread.quest",
      "quest-start": "cx.nextthread.start",
      gematria: "cx.nextthread.gematria",
      crossref: "cx.nextthread.crossref",
      daf: "cx.nextthread.daf",
      parsha: "cx.nextthread.parsha",
    }[sugg.kind] || "cx.nextthread.start";

    const kindEn = {
      quest: "Resume an open quest thread",
      "quest-start": "Open a new thread",
      gematria: "A gematria match sits in your own library",
      crossref: "Follow a cross-ref thread from here",
      daf: "Today's daf",
      parsha: "This week's parsha",
    }[sugg.kind] || "Open a new thread";

    const label = sugg.title || t(kindKey, kindEn);

    const act = function () {
      // Acting on the suggestion is just navigation — NOT a depth event. The
      // depth event fires when the user actually completes the surface.
      try {
        if (sugg.ref && window.codexJumpToRef) { window.codexJumpToRef(sugg.ref); return; }
        if (sugg.kind === "quest" || sugg.kind === "quest-start") {
          window.dispatchEvent(new CustomEvent("codex:open-panel", { detail: { panelId: "continuity:dossier" } }));
          return;
        }
      } catch (_) {}
    };

    const dismiss = function (ev) {
      if (ev) ev.stopPropagation();
      safe(function () { sessionStorage.setItem("cx-nextthread-dismissed", "1"); }, null);
      setDismissed(true);
    };

    return (
      <div className="cx-nextthread" title={t("cx.nextthread.title", "Next thread")}>
        <button type="button" className="cx-nextthread-btn" onClick={act}>
          <span className="cx-nextthread-glyph" aria-hidden="true">⌁</span>
          <span className="cx-nextthread-label">{label}</span>
          {sugg.reason ? <span className="cx-nextthread-reason">{sugg.reason}</span> : null}
        </button>
        <button
          type="button"
          className="cx-nextthread-x"
          onClick={dismiss}
          aria-label={t("cx.nextthread.dismiss", "Dismiss suggestion")}
          title={t("cx.nextthread.dismiss", "Dismiss suggestion")}
        >×</button>
      </div>
    );
  }

  // A composite mount that the host renders once near the app root. Hosts the
  // ambient surfaces (next-thread line). Milestones/ticks render through the
  // host's unified codex:toast adapter + ToastDock — see app.jsx. The dossier
  // itself is a rail panel registered as a plugin below.
  function ContinuityMount() {
    if (LITE || !ENG()) return null;
    return (
      <div className="cx-continuity-mount">
        <NextThread />
      </div>
    );
  }

  // ── Public surface for the host (app.jsx mounts <CODEX_CONTINUITY.Mount/>) ──
  window.CODEX_CONTINUITY = {
    Mount: ContinuityMount,
    ContinuityIndicator: ContinuityIndicator,
    AnalystDossier: AnalystDossier,
    QuestList: QuestList,
    QuestPlayer: QuestPlayer,
    NextThread: NextThread,
    lite: LITE,
  };

  // ── Plugin registration — the ANALYST DESK rail panel. Deferred if the
  //    plugin API or the engine isn't ready yet. In Lite mode we still expose
  //    the namespace but skip the heavy rail surface.
  function registerPlugin() {
    if (LITE) return;
    if (!window.CODEX_PLUGINS_API) {
      window.addEventListener("load", registerPlugin, { once: true });
      return;
    }
    try {
      window.CODEX_PLUGINS_API.register({
        id: "continuity",
        name: "Analyst Desk",
        version: "1.0.0",
        panels: [{
          id: "dossier",
          label: t("cx.dossier.title", "Analyst desk").toUpperCase(),
          glyph: "▦",
          icon: "▦",
          render: function (ctx) {
            // Engine absent → graceful empty (component handles it).
            return React.createElement(AnalystDossier, ctx || {});
          },
        }],
      });
    } catch (e) {
      // Never throw — registration failure must not brick the app.
      try { console.warn("[continuity] plugin registration failed:", e); } catch (_) {}
    }
  }
  registerPlugin();
})();
