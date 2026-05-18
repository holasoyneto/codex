// jewish-study.jsx
// CODEX — Phase 1.5 Jewish Study Tools panel.
//
// Self-registers as the TORAH right-rail tab. Renders:
//   1. Today's (approximate) Hebrew date strip
//   2. This week's parsha + haftarah, with prev / next / today nav
//   3. Holiday awareness (upcoming-within-14-days card, or "next holiday" line)
//   4. Collapsible Hebrew calendar reference (12 months + all holidays)
//   5. Today's Daf Yomi (if plan-daf-yomi module is available)
//
// IMPORTANT: the Hebrew-date computation here is a deliberately rough
// approximation — Hebrew year ≈ Gregorian year + 3760, month based on a
// fixed Tishrei-1 anchor near Sep 15. A real engine (lunar conjunction,
// leap-month insertion) is future work. Dates are prefixed with "≈" so
// users know they're best-effort.
//
// Also exposes window.CODEX_JEWISH = { currentParsha, nextHoliday, hebrewDate }
// for other plugins to consume.

(function () {
  if (typeof window === "undefined") return;
  const { useState, useEffect, useMemo, useCallback } = React;

  // ── Module loaders ────────────────────────────────────────────────────
  const _cache = {};
  function loadModule(id) {
    if (_cache[id]) return _cache[id];
    if (!window.CODEX_MODULES || typeof window.CODEX_MODULES.loadModule !== "function") {
      return Promise.reject(new Error("CODEX_MODULES not available"));
    }
    _cache[id] = window.CODEX_MODULES.loadModule(id).catch((e) => {
      delete _cache[id];
      throw e;
    });
    return _cache[id];
  }

  // ── Hebrew date approximation ─────────────────────────────────────────
  // Anchored at Tishrei 1 ≈ September 15. Each month assumed 30 days
  // (alternating real lengths average ~29.5). Drift is acceptable for UI.
  const MONTH_ORDER_FROM_TISHREI = [
    7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6,
  ];

  function approxHebrewDate(d) {
    const months = (window.CODEX_JEWISH_MONTHS_CACHE) || null;
    // Days since approx Tishrei 1 of the *current* Hebrew year.
    const year = d.getFullYear();
    let anchor = new Date(year, 8, 15); // Sep 15
    if (d < anchor) {
      anchor = new Date(year - 1, 8, 15);
    }
    const daysSinceAnchor = Math.floor((d - anchor) / 86400000);
    const monthIdx = Math.min(11, Math.floor(daysSinceAnchor / 30));
    const dayInMonth = (daysSinceAnchor % 30) + 1;
    const monthN = MONTH_ORDER_FROM_TISHREI[monthIdx];
    const hYear = (d >= anchor ? year + 3761 : year + 3760);
    const monthMeta = months
      ? months.find((m) => m.n === monthN)
      : { n: monthN, name: "", translit: "" };
    return {
      day: dayInMonth,
      month: monthMeta || { n: monthN, name: "", translit: "" },
      year: hYear,
      daysSinceAnchor,
    };
  }

  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  }

  // ── Books helpers ─────────────────────────────────────────────────────
  function bookName(bookId) {
    const list = (window.CODEX_DATA && window.CODEX_DATA.books) || [];
    const b = list.find((x) => x.id === (bookId || "").toLowerCase());
    return b ? b.name : (bookId || "").toUpperCase();
  }

  function formatRef(key) {
    if (!key) return "";
    const parts = String(key).split(".");
    if (parts.length === 1) return bookName(parts[0]);
    const b = bookName(parts[0]);
    // Detect range: "gen.1.1-6.8"
    const rest = parts.slice(1).join(".");
    return `${b} ${rest}`;
  }

  function jumpToRef(refKey) {
    try {
      const display = formatRef(refKey);
      if (typeof window.codexJumpToRef === "function") {
        window.codexJumpToRef(display);
        return;
      }
      // Fallback dispatch
      const parts = String(refKey).split(".");
      const bookId = (parts[0] || "").toLowerCase();
      const chapter = parseInt(parts[1], 10) || 1;
      window.dispatchEvent(new CustomEvent("codex:navigate", {
        detail: { book: bookName(bookId), bookId, chapter },
      }));
    } catch (e) { console.warn("jewish-study: jump failed", e); }
  }

  // ── Holiday-date helpers ──────────────────────────────────────────────
  // Each holiday string like "15 Nisan" → { day, monthN }.
  function parseHolidayDate(date) {
    if (!date) return null;
    const m = String(date).match(/(\d+)(?:[–-]\d+)?\s+([A-Za-z'’]+)/);
    if (!m) return null;
    const day = parseInt(m[1], 10);
    const translit = m[2].replace(/['’]/g, "").toLowerCase();
    return { day, translit };
  }

  // Compute days-until for a holiday relative to "today's" approx hebrew date.
  function daysUntilHoliday(holiday, todayHeb, monthsList) {
    const parsed = parseHolidayDate(holiday.date);
    if (!parsed) return null;
    const monthMeta = monthsList.find(
      (m) => m.translit.toLowerCase().replace(/[-’']/g, "") === parsed.translit.replace(/[-’']/g, "")
    );
    if (!monthMeta) return null;
    // Compute target day-of-year (Tishrei-anchored). Tishrei month index 0.
    const tIdx = MONTH_ORDER_FROM_TISHREI.indexOf(monthMeta.n);
    const targetDoy = tIdx * 30 + (parsed.day - 1);
    const todayDoy = todayHeb.daysSinceAnchor;
    let diff = targetDoy - todayDoy;
    if (diff < -14) diff += 354; // wrap to next year (avg Hebrew year ~354d)
    return diff;
  }

  // ── Parsha picker ─────────────────────────────────────────────────────
  function pickParshaIndex(parashot) {
    const w = isoWeek(new Date());
    return ((w - 1) % parashot.length + parashot.length) % parashot.length;
  }

  // ── Daf Yomi today (relative to a fixed start date) ───────────────────
  function todaysDaf(mod) {
    if (!mod || !Array.isArray(mod.days) || mod.days.length === 0) return null;
    // Anchor day 1 to start-of-this-month of current real year — purely
    // illustrative until a real cycle anchor is wired. (Module is a 90-day
    // preview, so we just modulo through it.)
    const epoch = new Date(2026, 0, 1);
    const days = Math.floor((new Date() - epoch) / 86400000);
    const idx = ((days % mod.days.length) + mod.days.length) % mod.days.length;
    return mod.days[idx];
  }

  // ─────────────────────────────────────────────────────────────────────
  // Panel
  // ─────────────────────────────────────────────────────────────────────
  function JewishStudyPanel() {
    const [parsha, setParsha] = useState(null);
    const [cal, setCal] = useState(null);
    const [daf, setDaf] = useState(null);
    const [err, setErr] = useState(null);
    const [parshaIdx, setParshaIdx] = useState(null);
    const [showMonths, setShowMonths] = useState(false);
    const [showHolidays, setShowHolidays] = useState(false);

    useEffect(() => {
      let cancelled = false;
      Promise.all([
        loadModule("parsha").catch((e) => ({ _err: e.message })),
        loadModule("hebrew-calendar").catch((e) => ({ _err: e.message })),
        loadModule("plan-daf-yomi").catch(() => null), // optional
      ]).then(([p, c, d]) => {
        if (cancelled) return;
        if (p && p._err && c && c._err) setErr(p._err);
        if (p && !p._err) setParsha(p);
        if (c && !c._err) {
          setCal(c);
          window.CODEX_JEWISH_MONTHS_CACHE = c.months;
        }
        if (d && !d._err) setDaf(d);
        if (p && !p._err && Array.isArray(p.parashot)) {
          setParshaIdx(pickParshaIndex(p.parashot));
        }
      });
      return () => { cancelled = true; };
    }, []);

    const today = useMemo(() => new Date(), []);
    const heb = useMemo(() => approxHebrewDate(today), [today, cal]);

    const parashot = (parsha && parsha.parashot) || [];
    const current = parshaIdx != null ? parashot[parshaIdx] : null;

    // Holiday awareness
    const holidayInfo = useMemo(() => {
      if (!cal || !Array.isArray(cal.holidays)) return null;
      const withDays = cal.holidays
        .map((h) => ({ h, days: daysUntilHoliday(h, heb, cal.months) }))
        .filter((x) => x.days != null)
        .sort((a, b) => a.days - b.days);
      const upcoming = withDays.find((x) => x.days >= -3 && x.days <= 14);
      const next = withDays.find((x) => x.days > 14) || withDays[0];
      return { upcoming, next };
    }, [cal, heb]);

    const todayDaf = useMemo(() => todaysDaf(daf), [daf]);

    // ── Render helpers ──────────────────────────────────────────────────
    const renderRefList = (refs) => {
      if (!refs || refs.length === 0) return <span style={{ opacity: 0.6 }}>—</span>;
      return refs.map((r, i) => (
        <span key={i}>
          {i > 0 ? <span style={{ opacity: 0.4, margin: "0 6px" }}>·</span> : null}
          <button className="cx-js-ref" onClick={() => jumpToRef(r)}>{formatRef(r)}</button>
        </span>
      ));
    };

    return (
      <div className="cx-js-pane">
        {/* ── Date strip ───────────────────────────────────────── */}
        <header className="cx-js-datestrip">
          <div className="cx-js-hebdate">
            <span className="cx-js-approx" title="Approximate — see help article">≈</span>
            <span className="cx-js-hebbig">
              {heb.day} <span className="cx-js-hebmonth">{heb.month.name || heb.month.translit}</span>
            </span>
            <span className="cx-js-translit">
              {heb.day} {heb.month.translit} {heb.year}
            </span>
          </div>
          <div className="cx-js-gregdate">
            {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </div>
        </header>

        {err ? (
          <div className="cx-js-status cx-js-warn">Couldn't load Jewish study modules: {err}</div>
        ) : null}

        {/* ── This week's parsha ──────────────────────────────── */}
        {current ? (
          <section className="cx-js-parsha">
            <div className="cx-js-section-label">PARASHAT HASHAVUA · WEEK {current.n}/54</div>
            <div className="cx-js-parsha-name">{current.name}</div>
            <div className="cx-js-parsha-translit">
              {current.translit} <span className="cx-js-parsha-meaning">— "{current.meaning}"</span>
            </div>
            <div className="cx-js-parsha-readings">
              <div className="cx-js-reading-row">
                <span className="cx-js-reading-label">Torah</span>
                <button className="cx-js-ref cx-js-ref-lg" onClick={() => jumpToRef(current.torah)}>
                  {formatRef(current.torah)}
                </button>
              </div>
              <div className="cx-js-reading-row">
                <span className="cx-js-reading-label">Haftarah</span>
                <button className="cx-js-ref cx-js-ref-lg" onClick={() => jumpToRef(current.haftarah)}>
                  {formatRef(current.haftarah)}
                </button>
              </div>
            </div>
            <div className="cx-js-parsha-nav">
              <button className="cx-js-pill" onClick={() => setParshaIdx((i) => (i - 1 + parashot.length) % parashot.length)}>← PREV</button>
              <button className="cx-js-pill cx-js-pill-today" onClick={() => setParshaIdx(pickParshaIndex(parashot))}>JUMP TO TODAY</button>
              <button className="cx-js-pill" onClick={() => setParshaIdx((i) => (i + 1) % parashot.length)}>NEXT →</button>
            </div>
          </section>
        ) : !err ? <div className="cx-js-status">Loading parashot…</div> : null}

        {/* ── Holiday awareness ──────────────────────────────── */}
        {holidayInfo && holidayInfo.upcoming ? (
          <section className="cx-js-holiday-card">
            <div className="cx-js-section-label cx-js-gold">
              {holidayInfo.upcoming.days <= 0 ? "HAPPENING NOW" : `IN ${holidayInfo.upcoming.days} DAYS`}
            </div>
            <div className="cx-js-holiday-name">{holidayInfo.upcoming.h.hebrew}</div>
            <div className="cx-js-holiday-translit">
              {holidayInfo.upcoming.h.name} <span className="cx-js-dim">· {holidayInfo.upcoming.h.date}</span>
            </div>
            <div className="cx-js-holiday-readings">
              <span className="cx-js-reading-label">Readings</span>
              <div className="cx-js-reading-refs">{renderRefList(holidayInfo.upcoming.h.readings)}</div>
            </div>
          </section>
        ) : holidayInfo && holidayInfo.next ? (
          <div className="cx-js-next-holiday">
            Next holiday: <b>{holidayInfo.next.h.name}</b> in {Math.max(0, holidayInfo.next.days)} days
          </div>
        ) : null}

        {/* ── Daf Yomi today ─────────────────────────────────── */}
        {todayDaf ? (
          <section className="cx-js-daf">
            <div className="cx-js-section-label">DAF YOMI · DAY {todayDaf.day}</div>
            <div className="cx-js-daf-refs">
              {todayDaf.readings.map((r, i) => (
                <span key={i} className="cx-js-daf-ref" title="External Talmud lookup coming soon">
                  {r.replace(/^talmud\./, "").replace(/\./g, " ")}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Calendar reference ─────────────────────────────── */}
        {cal ? (
          <>
            <section className="cx-js-collapse">
              <button className="cx-js-collapse-head" onClick={() => setShowMonths((s) => !s)}>
                <span>{showMonths ? "▾" : "▸"}</span> All 12 Hebrew months
              </button>
              {showMonths ? (
                <table className="cx-js-table">
                  <thead>
                    <tr><th>#</th><th>Hebrew</th><th>Translit</th><th>Gregorian</th><th>Notes</th></tr>
                  </thead>
                  <tbody>
                    {cal.months.map((m) => (
                      <tr key={m.n}>
                        <td>{m.n}</td>
                        <td className="cx-js-heb">{m.name}</td>
                        <td>{m.translit}</td>
                        <td className="cx-js-dim">{m.approxGregorian}</td>
                        <td className="cx-js-dim">{m.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </section>

            <section className="cx-js-collapse">
              <button className="cx-js-collapse-head" onClick={() => setShowHolidays((s) => !s)}>
                <span>{showHolidays ? "▾" : "▸"}</span> All major holidays
              </button>
              {showHolidays ? (
                <ul className="cx-js-holiday-list">
                  {cal.holidays.map((h) => (
                    <li key={h.id} className="cx-js-holiday-li">
                      <div className="cx-js-holiday-li-head">
                        <span className="cx-js-heb">{h.hebrew}</span>
                        <span> · </span>
                        <span>{h.name}</span>
                        <span className="cx-js-dim"> · {h.date}</span>
                      </div>
                      <div className="cx-js-reading-refs">{renderRefList(h.readings)}</div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </>
        ) : null}

        <footer className="cx-js-foot">
          Hebrew dates here are an approximation. A precise lunar-calendar engine is on the roadmap.
        </footer>
      </div>
    );
  }

  // ── Public API for other plugins ──────────────────────────────────────
  window.CODEX_JEWISH = {
    currentParsha() {
      return loadModule("parsha").then((p) => {
        if (!p || !p.parashot) return null;
        return p.parashot[pickParshaIndex(p.parashot)];
      });
    },
    nextHoliday() {
      return loadModule("hebrew-calendar").then((c) => {
        if (!c || !c.holidays) return null;
        const heb = approxHebrewDate(new Date());
        const sorted = c.holidays
          .map((h) => ({ h, days: daysUntilHoliday(h, heb, c.months) }))
          .filter((x) => x.days != null)
          .sort((a, b) => a.days - b.days);
        const next = sorted.find((x) => x.days >= 0) || sorted[0];
        return next ? { ...next.h, daysUntil: next.days } : null;
      });
    },
    hebrewDate(d) {
      // Make sure months cache is populated for the name.
      const date = d || new Date();
      if (!window.CODEX_JEWISH_MONTHS_CACHE) {
        return loadModule("hebrew-calendar").then((c) => {
          window.CODEX_JEWISH_MONTHS_CACHE = c.months;
          return approxHebrewDate(date);
        });
      }
      return Promise.resolve(approxHebrewDate(date));
    },
  };

  window.CODEX_JewishStudyPanel = JewishStudyPanel;

  // ── Plugin registration ───────────────────────────────────────────────
  function doRegister() {
    if (!window.CODEX_PLUGINS_API || typeof window.CODEX_PLUGINS_API.register !== "function") return false;
    return window.CODEX_PLUGINS_API.register({
      id: "jewish-study",
      name: "Jewish Study Tools",
      version: "1.0.0",
      panels: [{
        id: "torah",
        label: "TORAH",
        glyph: "ה",
        render(ctx) { return React.createElement(JewishStudyPanel, ctx || {}); },
      }],
    });
  }

  if (!doRegister()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", doRegister, { once: true });
    } else {
      window.addEventListener("load", doRegister, { once: true });
    }
  }
})();
