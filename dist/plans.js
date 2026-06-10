// GENERATED from plans.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
// CODEX — Reading Plans (Phase 2.1) — daily scripture cadence.
//
// Bundles 7 default plans (Christian + Jewish): canonical 1y, chronological
// 1y, gospels 90d, psalms+proverbs 30d, whole bible 90d sprint, Daf Yomi
// preview, Torah triennial preview. Loads each as a CODEX_MODULES module.
//
// Registers as a CODEX plugin via window.CODEX_PLUGINS_API so it appears
// as a PLANS tab in the right rail without touching app.jsx or panels.jsx.
//
// State per plan is stored in localStorage under:
//   codex.plans.{planId}.start         (ISO yyyy-mm-dd of day 1)
//   codex.plans.{planId}.completed     (JSON array of "day.idx" strings)
//   codex.plans.{planId}.streakLastDate
//   codex.plans.{planId}.reminderTime  ("HH:MM" or "")

(function () {
  "use strict";

  const useState = React.useState,useEffect = React.useEffect,
    useMemo = React.useMemo,useCallback = React.useCallback;

  // ───────────────────────────────────────────────────────────────────────
  // Bundled plan IDs
  // ───────────────────────────────────────────────────────────────────────
  const BUNDLED_PLANS = [
  "plan-canonical-1y",
  "plan-chronological-1y",
  "plan-gospels-90",
  "plan-psalms-30",
  "plan-whole-bible-90",
  "plan-daf-yomi",
  "plan-torah-triennial"];


  // Local cache so we don't re-fetch each render
  const PLAN_CACHE = {};
  function loadPlan(id) {
    if (PLAN_CACHE[id]) return Promise.resolve(PLAN_CACHE[id]);
    const p = (window.CODEX_MODULES ?
    window.CODEX_MODULES.loadModule(id) :
    fetch(`data/modules/${id}.json`).then((r) => r.json())).
    then((mod) => {PLAN_CACHE[id] = mod;return mod;}).
    catch((e) => {console.warn("[plans] load failed", id, e);return null;});
    return p;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Book lookup — bookId → "Genesis" etc, for navigation
  // ───────────────────────────────────────────────────────────────────────
  function bookName(bookId) {
    try {
      const b = (window.CODEX_DATA?.books || []).find((x) => x.id === bookId);
      if (b) return b.name;
    } catch {}
    return bookId.toUpperCase();
  }

  // Parse a reading ref like "gen.1", "gen.1-3", "psa.119", or
  // "talmud.berakhot.2a". Returns { kind, label, navRef }.
  function parseReading(ref) {
    if (ref.startsWith("talmud.")) {
      const parts = ref.split(".");
      return { kind: "talmud", label: `Talmud · ${parts[1]} ${parts[2]}`, navRef: null };
    }
    const m = ref.match(/^([a-z0-9]+)\.(\d+)(?:-(\d+))?$/i);
    if (!m) return { kind: "unknown", label: ref, navRef: null };
    const [, b, a, z] = m;
    const name = bookName(b);
    const label = z ? `${name} ${a}–${z}` : `${name} ${a}`;
    // For multi-chapter ranges, nav to first chapter.
    const navRef = `${name} ${a}`;
    return { kind: "scripture", label, navRef, book: b, start: +a, end: z ? +z : +a };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Date helpers
  // ───────────────────────────────────────────────────────────────────────
  function isoToday() {
    const d = new Date();
    return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")].
    join("-");
  }
  function isoOffset(iso, daysOff) {
    const [Y, M, D] = iso.split("-").map(Number);
    const d = new Date(Y, M - 1, D);
    d.setDate(d.getDate() + daysOff);
    return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")].
    join("-");
  }
  function daysBetween(a, b) {
    const [Y1, M1, D1] = a.split("-").map(Number);
    const [Y2, M2, D2] = b.split("-").map(Number);
    const da = new Date(Y1, M1 - 1, D1).getTime();
    const db = new Date(Y2, M2 - 1, D2).getTime();
    return Math.round((db - da) / 86400000);
  }

  // ───────────────────────────────────────────────────────────────────────
  // Per-plan localStorage state
  // ───────────────────────────────────────────────────────────────────────
  function kPrefix(id) {return `codex.plans.${id}`;}
  function readStart(id) {
    try {return localStorage.getItem(kPrefix(id) + ".start") || null;} catch {return null;}
  }
  function writeStart(id, v) {
    try {localStorage.setItem(kPrefix(id) + ".start", v);} catch {}
  }
  function clearPlan(id) {
    for (const sub of ["start", "completed", "streakLastDate", "reminderTime"]) {
      try {localStorage.removeItem(`${kPrefix(id)}.${sub}`);} catch {}
    }
  }
  function readCompleted(id) {
    try {
      const raw = localStorage.getItem(kPrefix(id) + ".completed");
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {return new Set();}
  }
  function writeCompleted(id, set) {
    try {localStorage.setItem(kPrefix(id) + ".completed", JSON.stringify([...set]));} catch {}
  }
  function readReminder(id) {
    try {return localStorage.getItem(kPrefix(id) + ".reminderTime") || "";} catch {return "";}
  }
  function writeReminder(id, v) {
    try {localStorage.setItem(kPrefix(id) + ".reminderTime", v);} catch {}
  }

  // ───────────────────────────────────────────────────────────────────────
  // Unified continuity engine bridge (window.CODEX_ENGAGEMENT, Phase 2.5)
  //
  // Plans no longer maintain a parallel streak counter. Checking off a reading
  // dispatches a codex:depth-action so continuity + mastery are computed
  // centrally. Every call is guarded with typeof checks so the plan UI never
  // breaks when the engine is absent (Lite mode / offline / not yet loaded).
  // ───────────────────────────────────────────────────────────────────────
  function emitDepthAction(type, ref, weight, domain) {
    // Prefer the bus so the engine records when present; a missing listener is
    // a silent no-op. Fall back to CustomEvent dispatch for older environments.
    try {
      if (window.CODEX_ENGAGEMENT && typeof window.CODEX_ENGAGEMENT.emit === "function") {
        window.CODEX_ENGAGEMENT.emit(type, ref, weight, domain);
        return;
      }
    } catch {}
    try {
      if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" &&
      typeof CustomEvent === "function") {
        window.dispatchEvent(new CustomEvent("codex:depth-action", {
          detail: { type, ref, weight, domain }
        }));
      }
    } catch {}
  }

  // Read the unified continuity snapshot for display, or null if the engine is
  // absent. Never throws.
  function unifiedContinuity() {
    try {
      if (window.CODEX_ENGAGEMENT && typeof window.CODEX_ENGAGEMENT.continuity === "function") {
        return window.CODEX_ENGAGEMENT.continuity();
      }
    } catch {}
    return null;
  }

  // streak: count back consecutive days where ALL readings for that day were
  // checked. Retained only as a display FALLBACK when the unified continuity
  // engine is unavailable (Lite mode / offline / not yet loaded).
  function computeStreak(plan, completed) {
    const start = readStart(plan.meta.id);
    if (!start) return 0;
    const todayIso = isoToday();
    const todayN = daysBetween(start, todayIso) + 1; // 1-indexed day number
    let streak = 0;
    for (let d = todayN; d >= 1; d--) {
      const day = plan.days.find((x) => x.day === d);
      if (!day) break;
      const all = day.readings.every((_, idx) => completed.has(`${d}.${idx}`));
      if (all) streak++;else
      if (d < todayN) break; // missed past day → break
      else continue; // today not done is OK; keep looking back
    }
    return streak;
  }

  // ───────────────────────────────────────────────────────────────────────
  // StreakHeatmap — last 12 weeks activity grid from engagement engine
  // ───────────────────────────────────────────────────────────────────────
  function StreakHeatmap() {
    const engage = window.CODEX_ENGAGE;
    if (!engage) return null;

    const sk = engage.loadStreak();
    const today = isoToday();
    const cells = [];

    // Build 84 days ending today, aligned to week start (Sunday)
    const todayDate = new Date(today + "T00:00:00");
    const todayDow = todayDate.getDay(); // 0=Sun
    const startOffset = -(83 + todayDow); // start from first Sunday
    const totalDays = 84 + todayDow; // fill to complete the current week

    for (let i = 0; i < totalDays; i++) {
      const d = isoOffset(today, startOffset + i);
      const isActive = !!sk.history[d];
      const isToday = d === today;
      const isFuture = d > today;
      const cls = "cx-heatmap-cell" + (
      isActive ? " is-active" : "") + (
      isToday ? " is-today" : "") + (
      isFuture ? " is-future" : "");
      cells.push(/*#__PURE__*/
        React.createElement("div", { key: d, className: cls, "data-date": d, title: d + (isActive ? " ✓" : "") })
      );
    }

    const dows = ["S", "M", "T", "W", "T", "F", "S"];

    return (/*#__PURE__*/
      React.createElement("div", { className: "cx-heatmap" }, /*#__PURE__*/
      React.createElement("div", { className: "cx-heatmap-head" }, "READING ACTIVITY \xB7 LAST 12 WEEKS"), /*#__PURE__*/
      React.createElement("div", { className: "cx-heatmap-grid" },
      dows.map((d, i) => /*#__PURE__*/React.createElement("div", { key: "dow" + i, className: "cx-heatmap-dow" }, d)),
      cells
      )
      ));

  }

  // ───────────────────────────────────────────────────────────────────────
  // PlansPanel
  // ───────────────────────────────────────────────────────────────────────
  function PlansPanel(ctx) {
    const [plans, setPlans] = useState([]); // [{meta, days}]
    const [activeId, setActiveId] = useState(null);
    const [tick, setTick] = useState(0);

    // Load all bundled plans on mount
    useEffect(() => {
      let alive = true;
      Promise.all(BUNDLED_PLANS.map(loadPlan)).then((mods) => {
        if (!alive) return;
        const ok = mods.filter(Boolean);
        setPlans(ok);
        // Auto-select first plan with a start date (i.e. an active one)
        const active = ok.find((p) => readStart(p.meta.id));
        setActiveId(active ? active.meta.id : ok[0]?.meta.id || null);
      });
      return () => {alive = false;};
    }, []);

    const force = () => setTick((t) => t + 1);

    if (!plans.length) {
      return /*#__PURE__*/React.createElement("div", { className: "cx-plans-empty" }, "Loading reading plans\u2026");
    }

    const activePlan = plans.find((p) => p.meta.id === activeId) || plans[0];

    return (/*#__PURE__*/
      React.createElement("div", { className: "cx-plans" }, /*#__PURE__*/
      React.createElement("div", { className: "cx-plans-head" }, /*#__PURE__*/
      React.createElement("div", { className: "cx-plans-title" }, "READING PLANS"), /*#__PURE__*/
      React.createElement("div", { className: "cx-plans-sub" }, "Pick a cadence. Track every day. Keep the streak.")
      ), /*#__PURE__*/

      React.createElement("div", { className: "cx-plans-list" },
      plans.map((p) => {
        const isActive = !!readStart(p.meta.id);
        return (/*#__PURE__*/
          React.createElement("button", {
            key: p.meta.id,
            type: "button",
            className: `cx-plan-card ${activeId === p.meta.id ? "is-open" : ""} ${isActive ? "is-started" : ""}`,
            onClick: () => setActiveId(p.meta.id) }, /*#__PURE__*/

          React.createElement("div", { className: "cx-plan-card-row" }, /*#__PURE__*/
          React.createElement("span", { className: "cx-plan-card-name" }, p.meta.name),
          isActive ? /*#__PURE__*/React.createElement("span", { className: "cx-plan-badge" }, "ACTIVE") : null
          ), /*#__PURE__*/
          React.createElement("div", { className: "cx-plan-card-meta" },
          p.meta.days, " day", p.meta.days === 1 ? "" : "s",
          p.meta._partial ? " · preview" : ""
          ), /*#__PURE__*/
          React.createElement("div", { className: "cx-plan-card-desc" }, p.meta.description)
          ));

      })
      ), /*#__PURE__*/

      React.createElement(StreakHeatmap, null), /*#__PURE__*/

      React.createElement(PlanDetail, { plan: activePlan, onChange: force, key: activePlan.meta.id + ":" + tick })
      ));

  }

  // ───────────────────────────────────────────────────────────────────────
  // PlanDetail — Today, streak, calendar, catch-up, reminders
  // ───────────────────────────────────────────────────────────────────────
  function PlanDetail({ plan, onChange }) {
    const id = plan.meta.id;
    const [start, setStart] = useState(readStart(id));
    const [completed, setCompleted] = useState(() => readCompleted(id));
    const [reminder, setReminder] = useState(() => readReminder(id));

    useEffect(() => {
      setStart(readStart(id));
      setCompleted(readCompleted(id));
      setReminder(readReminder(id));
    }, [id]);

    function persistCompleted(set) {
      writeCompleted(id, set);
      setCompleted(new Set(set));
      onChange && onChange();
    }

    function startToday() {
      const today = isoToday();
      writeStart(id, today);
      setStart(today);
      onChange && onChange();
    }
    function resetPlan() {
      if (!confirm("Reset progress for this plan? Your check-marks and start date will be cleared.")) return;
      clearPlan(id);
      setStart(null);
      setCompleted(new Set());
      setReminder("");
      onChange && onChange();
    }

    if (!start) {
      return (/*#__PURE__*/
        React.createElement("div", { className: "cx-plan-detail" }, /*#__PURE__*/
        React.createElement("div", { className: "cx-plan-detail-empty" }, /*#__PURE__*/
        React.createElement("p", null, "You haven't started ", /*#__PURE__*/React.createElement("b", null, plan.meta.name), " yet."), /*#__PURE__*/
        React.createElement("p", { className: "cx-plan-detail-empty-sub" },
        plan.meta.days, " days \xB7 ", plan.days[0]?.readings?.length || 0, "+ readings per day"
        ), /*#__PURE__*/
        React.createElement("button", { type: "button", className: "cx-plan-btn cx-plan-btn-primary", onClick: startToday }, "Begin today"

        )
        )
        ));

    }

    const todayIso = isoToday();
    const dayNum = Math.max(1, daysBetween(start, todayIso) + 1);
    const totalDays = plan.days.length;
    const behind = Math.max(0, dayNum - 1 - countCompletedDays(plan, completed, dayNum - 1));
    // Display continuity from the UNIFIED engine when present; fall back to the
    // legacy local per-plan computation so the UI never breaks in Lite/offline.
    const cont = unifiedContinuity();
    const streak = cont && typeof cont.current === "number" ?
    cont.current :
    computeStreak(plan, completed);
    const longestStreak = cont && typeof cont.longest === "number" ?
    cont.longest :
    window.CODEX_ENGAGE?.loadStreak?.()?.longest || streak;
    const day = plan.days.find((d) => d.day === Math.min(dayNum, totalDays));

    function toggleReading(d, idx) {
      const key = `${d}.${idx}`;
      const next = new Set(completed);
      const wasDone = next.has(key);
      if (wasDone) next.delete(key);else next.add(key);
      persistCompleted(next);

      // Only checking ON is a depth action; un-checking never advances anything.
      if (!wasDone) {
        const dayEntry0 = plan.days.find((x) => x.day === d);
        const r = dayEntry0?.readings?.[idx];
        const parsed = r ? parseReading(r) : null;
        const ref = parsed?.navRef || (r ? `${id}#${d}.${idx}` : `${id}#${d}.${idx}`);
        // A single reading read → canon-coverage, chapter-weight (1).
        emitDepthAction("read", ref, 1, "canon-coverage");
      }

      // Check if all readings for this day are now complete
      const dayEntry = plan.days.find((x) => x.day === d);
      if (dayEntry) {
        const dayAllDone = dayEntry.readings.every((_, i) => next.has(`${d}.${i}`));
        if (dayAllDone && !wasDone) {
          // Fire celebration animation
          const el = document.querySelector(".cx-plan-detail");
          if (el) {
            el.classList.add("cx-plan-celebrate");
            setTimeout(() => el.classList.remove("cx-plan-celebrate"), 6000);
          }
          // Completing a full day of the plan is a closed plan-step thread —
          // routed through the UNIFIED continuity engine (depth-gated, central).
          emitDepthAction("plan-step", `${id}#${d}`, 4, "canon-coverage");
          // Legacy engagement engine (window.CODEX_ENGAGE) — kept intact so the
          // existing heatmap / achievements keep working. Guarded defensively.
          if (window.CODEX_ENGAGE) {
            try {window.CODEX_ENGAGE.recordDay();} catch {}
            try {window.CODEX_ENGAGE.checkAchievements();} catch {}
          }
        }
      }
    }

    function catchUp() {
      // Mark the most-recent missed day(s) as "addressed" by surfacing them.
      // Instead of auto-checking, scroll user through missed readings inline.
      // For simplicity: mark all readings of any uncompleted past day as complete.
      if (!confirm(`Mark all ${behind} missed day(s) as complete? You can also just read them and check them off manually.`)) return;
      const next = new Set(completed);
      for (let d = 1; d < dayNum; d++) {
        const entry = plan.days.find((x) => x.day === d);
        if (!entry) continue;
        const wasAllDone = entry.readings.every((_, idx) => next.has(`${d}.${idx}`));
        entry.readings.forEach((_, idx) => next.add(`${d}.${idx}`));
        // Newly-closed catch-up day → one plan-step into the unified engine.
        if (!wasAllDone) emitDepthAction("plan-step", `${id}#${d}`, 4, "canon-coverage");
      }
      persistCompleted(next);
    }

    function navigateReading(parsed) {
      if (!parsed.navRef) return;
      if (typeof window.codexJumpToRef === "function") {
        window.codexJumpToRef(parsed.navRef);
      }
    }

    function toggleReminder() {
      if (reminder) {
        writeReminder(id, "");
        setReminder("");
        return;
      }
      const t = prompt("Reminder time (24-hour HH:MM):", "08:00");
      if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return;
      if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
        Notification.requestPermission().then((perm) => {
          if (perm === "granted") {
            writeReminder(id, t);
            setReminder(t);
            scheduleReminder(plan, t);
          }
        });
      } else {
        writeReminder(id, t);
        setReminder(t);
        scheduleReminder(plan, t);
      }
    }

    return (/*#__PURE__*/
      React.createElement("div", { className: "cx-plan-detail" },
      (() => {
        const warn = window.CODEX_ENGAGE?.streakWarning?.();
        if (!warn) return null;
        return (/*#__PURE__*/
          React.createElement("div", { className: "cx-streak-warn" }, /*#__PURE__*/
          React.createElement("span", { className: "cx-streak-warn-icon" }, "\uD83D\uDD25"), /*#__PURE__*/
          React.createElement("span", null, warn.msg)
          ));

      })(), /*#__PURE__*/
      React.createElement("div", { className: "cx-plan-detail-head" }, /*#__PURE__*/
      React.createElement("div", { className: "cx-plan-detail-name" }, plan.meta.name), /*#__PURE__*/
      React.createElement("div", { className: "cx-plan-detail-meta" }, "Day ", /*#__PURE__*/
      React.createElement("b", null, Math.min(dayNum, totalDays)), " of ", totalDays, " \xB7", /*#__PURE__*/
      React.createElement("span", { className: "cx-plan-streak" }, " \uD83D\uDD25 ", streak, " day streak", streak === longestStreak ? " · personal best!" : ` · best: ${longestStreak}`)
      )
      ),

      behind >= 2 ? /*#__PURE__*/
      React.createElement("div", { className: "cx-plan-catchup" }, /*#__PURE__*/
      React.createElement("span", null, "You're ", /*#__PURE__*/React.createElement("b", null, behind), " day", behind === 1 ? "" : "s", " behind."), /*#__PURE__*/
      React.createElement("button", { type: "button", className: "cx-plan-btn", onClick: catchUp }, "\u2713 Catch up")
      ) :
      behind === 1 ? /*#__PURE__*/
      React.createElement("div", { className: "cx-plan-catchup" }, /*#__PURE__*/
      React.createElement("span", null, "You're ", /*#__PURE__*/React.createElement("b", null, "1"), " day behind.")
      ) :
      null,

      day ? /*#__PURE__*/
      React.createElement("div", { className: "cx-plan-today" }, /*#__PURE__*/
      React.createElement("div", { className: "cx-plan-today-label" }, "TODAY \xB7 DAY ", day.day),
      day.parshah ? /*#__PURE__*/React.createElement("div", { className: "cx-plan-today-parshah" }, "Parashat ", day.parshah, " (Year ", day.year, ")") : null, /*#__PURE__*/
      React.createElement("ul", { className: "cx-plan-readings" },
      day.readings.map((r, idx) => {
        const parsed = parseReading(r);
        const done = completed.has(`${day.day}.${idx}`);
        return (/*#__PURE__*/
          React.createElement("li", { key: idx, className: `cx-plan-reading ${done ? "is-done" : ""}` }, /*#__PURE__*/
          React.createElement("button", {
            type: "button",
            className: "cx-plan-check",
            onClick: () => toggleReading(day.day, idx),
            "aria-label": done ? "Mark unread" : "Mark read" },
          done ? "✓" : "○"), /*#__PURE__*/
          React.createElement("button", {
            type: "button",
            className: "cx-plan-readlink",
            onClick: () => navigateReading(parsed),
            disabled: !parsed.navRef },
          parsed.label)
          ));

      })
      )
      ) : /*#__PURE__*/

      React.createElement("div", { className: "cx-plan-done-all" }, /*#__PURE__*/
      React.createElement("div", { className: "cx-plan-done-glyph" }, "\u2726"), /*#__PURE__*/
      React.createElement("p", null, "You've finished the plan. Well done.")
      ), /*#__PURE__*/


      React.createElement(PlanCalendar, { plan: plan, completed: completed, start: start }), /*#__PURE__*/

      React.createElement("div", { className: "cx-plan-actions" }, /*#__PURE__*/
      React.createElement("button", { type: "button", className: "cx-plan-btn", onClick: toggleReminder },
      reminder ? `Reminder at ${reminder} · tap to clear` : "Daily reminder…"
      ), /*#__PURE__*/
      React.createElement("button", { type: "button", className: "cx-plan-btn cx-plan-btn-danger", onClick: resetPlan }, "Reset plan"

      )
      )
      ));

  }

  function countCompletedDays(plan, completed, throughDay) {
    let n = 0;
    for (let d = 1; d <= throughDay; d++) {
      const entry = plan.days.find((x) => x.day === d);
      if (!entry) continue;
      if (entry.readings.every((_, idx) => completed.has(`${d}.${idx}`))) n++;
    }
    return n;
  }

  // ───────────────────────────────────────────────────────────────────────
  // PlanCalendar — 7 row × 52 col heat-map of past completion
  // ───────────────────────────────────────────────────────────────────────
  function PlanCalendar({ plan, completed, start }) {
    const todayIso = isoToday();
    const todayN = Math.max(1, daysBetween(start, todayIso) + 1);
    const totalDays = plan.days.length;
    const showDays = Math.min(totalDays, 7 * 52);

    function statusFor(d) {
      const entry = plan.days.find((x) => x.day === d);
      if (!entry) return "future";
      const all = entry.readings.every((_, idx) => completed.has(`${d}.${idx}`));
      if (all) return "done";
      if (d < todayN) return "miss";
      if (d === todayN) return "today";
      return "future";
    }

    // Build grid: rows of 7, total ceil(showDays/7) cols.
    const cells = [];
    for (let d = 1; d <= showDays; d++) {
      const status = statusFor(d);
      const dateIso = isoOffset(start, d - 1);
      cells.push({ d, status, dateIso });
    }

    return (/*#__PURE__*/
      React.createElement("div", { className: "cx-plan-cal-wrap" }, /*#__PURE__*/
      React.createElement("div", { className: "cx-plan-cal-label" }, "PROGRESS"), /*#__PURE__*/
      React.createElement("div", { className: "cx-plan-cal", style: { gridTemplateColumns: `repeat(${Math.ceil(showDays / 7)}, 8px)` } },
      cells.map((c) => /*#__PURE__*/
      React.createElement("span", {
        key: c.d,
        className: `cx-plan-cell is-${c.status}`,
        title: `Day ${c.d} · ${c.dateIso} · ${c.status}` }
      )
      )
      ), /*#__PURE__*/
      React.createElement("div", { className: "cx-plan-cal-legend" }, /*#__PURE__*/
      React.createElement("span", { className: "cx-plan-cell is-done" }), " done", /*#__PURE__*/
      React.createElement("span", { className: "cx-plan-cell is-miss" }), " missed", /*#__PURE__*/
      React.createElement("span", { className: "cx-plan-cell is-today" }), " today", /*#__PURE__*/
      React.createElement("span", { className: "cx-plan-cell is-future" }), " upcoming"
      )
      ));

  }

  // ───────────────────────────────────────────────────────────────────────
  // Reminders — schedules a one-shot notification while the app is open
  // ───────────────────────────────────────────────────────────────────────
  const _scheduled = {};
  function scheduleReminder(plan, hhmm) {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    const id = plan.meta.id;
    if (_scheduled[id]) clearTimeout(_scheduled[id]);
    const [hh, mm] = hhmm.split(":").map(Number);
    const now = new Date();
    const next = new Date(now);
    next.setHours(hh, mm, 0, 0);
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
    const delay = next.getTime() - now.getTime();
    _scheduled[id] = setTimeout(() => {
      try {
        new Notification("CODEX · " + plan.meta.name, {
          body: "Today's reading is waiting.",
          icon: "icon.svg"
        });
      } catch {}
      // Re-arm for next day
      scheduleReminder(plan, hhmm);
    }, delay);
  }

  // On boot, re-arm any saved reminders
  function bootReminders() {
    Promise.all(BUNDLED_PLANS.map(loadPlan)).then((mods) => {
      for (const p of mods.filter(Boolean)) {
        const t = readReminder(p.meta.id);
        if (t) scheduleReminder(p, t);
      }
    });
  }

  // Expose for reuse / testing
  window.CODEX_Plans = { PlansPanel, loadPlan, parseReading };

  // ───────────────────────────────────────────────────────────────────────
  // Plugin registration
  // ───────────────────────────────────────────────────────────────────────
  function registerPlugin() {
    if (!window.CODEX_PLUGINS_API) {
      window.addEventListener("load", registerPlugin, { once: true });
      return;
    }
    try {
      window.CODEX_PLUGINS_API.register({
        id: "reading-plans",
        name: "Reading Plans",
        version: "1.0.0",
        panels: [{
          id: "plans",
          label: "PLANS",
          glyph: "⥁",
          icon: "⥁",
          render: (ctx) => React.createElement(PlansPanel, ctx || {})
        }]
      });
      setTimeout(bootReminders, 1500);
    } catch (e) {
      console.warn("[plans] plugin registration failed:", e);
    }
  }
  registerPlugin();
})();
})();
