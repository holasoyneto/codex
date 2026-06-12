// GENERATED from jewish-study.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
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
  7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];


  function approxHebrewDate(d) {
    const months = window.CODEX_JEWISH_MONTHS_CACHE || null;
    // Days since approx Tishrei 1 of the *current* Hebrew year.
    const year = d.getFullYear();
    let anchor = new Date(year, 8, 15); // Sep 15
    if (d < anchor) {
      anchor = new Date(year - 1, 8, 15);
    }
    const daysSinceAnchor = Math.floor((d - anchor) / 86400000);
    const monthIdx = Math.min(11, Math.floor(daysSinceAnchor / 30));
    const dayInMonth = daysSinceAnchor % 30 + 1;
    const monthN = MONTH_ORDER_FROM_TISHREI[monthIdx];
    const hYear = d >= anchor ? year + 3761 : year + 3760;
    const monthMeta = months ?
    months.find((m) => m.n === monthN) :
    { n: monthN, name: "", translit: "" };
    return {
      day: dayInMonth,
      month: monthMeta || { n: monthN, name: "", translit: "" },
      year: hYear,
      daysSinceAnchor
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
    const list = window.CODEX_DATA && window.CODEX_DATA.books || [];
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
        detail: { book: bookName(bookId), bookId, chapter }
      }));
    } catch (e) {console.warn("jewish-study: jump failed", e);}
  }

  // ── Engagement depth emission (guarded) ───────────────────────────────
  // Defensive: never throw if the engagement engine / CustomEvent is absent
  // (Lite mode). Only emits depth types that exist in engagement.js.
  function emitDepth(type, ref, weight) {
    try {
      if (typeof window === "undefined" || typeof window.CustomEvent !== "function") return;
      window.dispatchEvent(new CustomEvent("codex:depth-action", {
        detail: { type, ref, weight }
      }));
    } catch (e) {/* no-op: engagement is optional */}
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

  // ── Accurate Hebrew → Gregorian (the "goy calendar") ──────────────────
  // Uses the browser's built-in Hebrew calendar (Intl ca-hebrew): accurate,
  // offline, and works for ANY Gregorian year — current, future, or historical
  // — so the user knows exactly when each holiday falls. Maps our holiday
  // month transliterations → Intl's Hebrew month names (Adar → Adar/Adar II
  // to cover leap years, where Purim's "14 Adar" lands in Adar II).
  const _HEB_INTL = {
    nisan: ["Nisan"], iyar: ["Iyar"], iyyar: ["Iyar"], sivan: ["Sivan"],
    tammuz: ["Tammuz"], tamuz: ["Tammuz"], av: ["Av"], elul: ["Elul"],
    tishrei: ["Tishri"], tishri: ["Tishri"],
    cheshvan: ["Heshvan"], marcheshvan: ["Heshvan"], heshvan: ["Heshvan"],
    kislev: ["Kislev"], tevet: ["Tevet"], teveth: ["Tevet"],
    shevat: ["Shevat"], shvat: ["Shevat"],
    adar: ["Adar", "Adar II"], "adar i": ["Adar I"], "adar ii": ["Adar II"]
  };
  const _gregCache = {};
  let _hebFmt;
  function gregForHoliday(day, translit, gregYear) {
    if (!day || !translit || !gregYear) return null;
    const accept = _HEB_INTL[String(translit).toLowerCase().trim()];
    if (!accept) return null;
    const key = gregYear + ":" + translit + ":" + day;
    if (key in _gregCache) return _gregCache[key];
    let out = null;
    try {
      if (!_hebFmt) _hebFmt = new Intl.DateTimeFormat("en-u-ca-hebrew", { day: "numeric", month: "long", timeZone: "UTC" });
      const base = Date.UTC(gregYear, 0, 1);
      for (let i = 0; i < 366; i++) {
        const d = new Date(base + i * 86400000);
        if (d.getUTCFullYear() !== gregYear) break;
        let mo = "",dd = "";
        for (const p of _hebFmt.formatToParts(d)) {
          if (p.type === "month") mo = p.value;else
          if (p.type === "day") dd = p.value;
        }
        if (Number(dd) === Number(day) && accept.indexOf(mo) !== -1) {out = d;break;}
      }
    } catch (e) {out = null;}
    _gregCache[key] = out;
    return out;
  }
  function fmtGreg(d) {
    if (!d) return null;
    try {return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });}
    catch (e) {return null;}
  }
  function holidayGreg(dateStr, gregYear) {
    const p = parseHolidayDate(dateStr);
    return p ? fmtGreg(gregForHoliday(p.day, p.translit, gregYear)) : null;
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
    const idx = (days % mod.days.length + mod.days.length) % mod.days.length;
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
    const [holYear, setHolYear] = useState(() => {try {return new Date().getFullYear();} catch (e) {return 2026;}});

    useEffect(() => {
      let cancelled = false;
      Promise.all([
      loadModule("parsha").catch((e) => ({ _err: e.message })),
      loadModule("hebrew-calendar").catch((e) => ({ _err: e.message })),
      loadModule("plan-daf-yomi").catch(() => null) // optional
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
      return () => {cancelled = true;};
    }, []);

    const today = useMemo(() => new Date(), []);
    const heb = useMemo(() => approxHebrewDate(today), [today, cal]);

    const parashot = parsha && parsha.parashot || [];
    const current = parshaIdx != null ? parashot[parshaIdx] : null;

    // Holiday awareness
    const holidayInfo = useMemo(() => {
      if (!cal || !Array.isArray(cal.holidays)) return null;
      const withDays = cal.holidays.
      map((h) => ({ h, days: daysUntilHoliday(h, heb, cal.months) })).
      filter((x) => x.days != null).
      sort((a, b) => a.days - b.days);
      const upcoming = withDays.find((x) => x.days >= -3 && x.days <= 14);
      const next = withDays.find((x) => x.days > 14) || withDays[0];
      return { upcoming, next };
    }, [cal, heb]);

    const todayDaf = useMemo(() => todaysDaf(daf), [daf]);

    // ── Engagement: a daf view ──────────────────────────────────────────
    // The panel only mounts when the user opens Jewish Study, so a truthy
    // todayDaf represents an actual Daf Yomi view. De-dupe per daf day so we
    // emit once per distinct daf (re-opening the same daf won't double-count).
    const lastDafRef = React.useRef(null);
    useEffect(() => {
      if (!todayDaf) return;
      const dayKey = todayDaf.day != null ? String(todayDaf.day) : null;
      if (dayKey != null && lastDafRef.current === dayKey) return;
      lastDafRef.current = dayKey;
      const ref = dayKey != null ?
      "daf:" + dayKey :
      todayDaf.readings && todayDaf.readings[0] || "daf";
      emitDepth("daf-read", ref, 3);
    }, [todayDaf]);

    // ── Render helpers ──────────────────────────────────────────────────
    const renderRefList = (refs) => {
      if (!refs || refs.length === 0) return /*#__PURE__*/React.createElement("span", { style: { opacity: 0.6 } }, "\u2014");
      return refs.map((r, i) => /*#__PURE__*/
      React.createElement("span", { key: i },
      i > 0 ? /*#__PURE__*/React.createElement("span", { style: { opacity: 0.4, margin: "0 6px" } }, "\xB7") : null, /*#__PURE__*/
      React.createElement("button", { className: "cx-js-ref", onClick: () => jumpToRef(r) }, formatRef(r))
      )
      );
    };

    return (/*#__PURE__*/
      React.createElement("div", { className: "cx-js-pane" }, /*#__PURE__*/

      React.createElement("header", { className: "cx-js-datestrip" }, /*#__PURE__*/
      React.createElement("div", { className: "cx-js-hebdate" }, /*#__PURE__*/
      React.createElement("span", { className: "cx-js-approx", title: "Approximate \u2014 see help article" }, "\u2248"), /*#__PURE__*/
      React.createElement("span", { className: "cx-js-hebbig" },
      heb.day, " ", /*#__PURE__*/React.createElement("span", { className: "cx-js-hebmonth" }, heb.month.name || heb.month.translit)
      ), /*#__PURE__*/
      React.createElement("span", { className: "cx-js-translit" },
      heb.day, " ", heb.month.translit, " ", heb.year
      )
      ), /*#__PURE__*/
      React.createElement("div", { className: "cx-js-gregdate" },
      today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      )
      ),

      err ? /*#__PURE__*/
      React.createElement("div", { className: "cx-js-status cx-js-warn" }, "Couldn't load Jewish study modules: ", err) :
      null,


      current ? /*#__PURE__*/
      React.createElement("section", { className: "cx-js-parsha" }, /*#__PURE__*/
      React.createElement("div", { className: "cx-js-section-label" }, "PARASHAT HASHAVUA \xB7 WEEK ", current.n, "/54"), /*#__PURE__*/
      React.createElement("div", { className: "cx-js-parsha-name" }, current.name), /*#__PURE__*/
      React.createElement("div", { className: "cx-js-parsha-translit" },
      current.translit, " ", /*#__PURE__*/React.createElement("span", { className: "cx-js-parsha-meaning" }, "\u2014 \"", current.meaning, "\"")
      ), /*#__PURE__*/
      React.createElement("div", { className: "cx-js-parsha-readings" }, /*#__PURE__*/
      React.createElement("div", { className: "cx-js-reading-row" }, /*#__PURE__*/
      React.createElement("span", { className: "cx-js-reading-label" }, "Torah"), /*#__PURE__*/
      React.createElement("button", { className: "cx-js-ref cx-js-ref-lg", onClick: () => jumpToRef(current.torah) },
      formatRef(current.torah)
      )
      ), /*#__PURE__*/
      React.createElement("div", { className: "cx-js-reading-row" }, /*#__PURE__*/
      React.createElement("span", { className: "cx-js-reading-label" }, "Haftarah"), /*#__PURE__*/
      React.createElement("button", { className: "cx-js-ref cx-js-ref-lg", onClick: () => jumpToRef(current.haftarah) },
      formatRef(current.haftarah)
      )
      )
      ), /*#__PURE__*/
      React.createElement("div", { className: "cx-js-parsha-nav" }, /*#__PURE__*/
      React.createElement("button", { className: "cx-js-pill", onClick: () => setParshaIdx((i) => (i - 1 + parashot.length) % parashot.length) }, "\u2190 PREV"), /*#__PURE__*/
      React.createElement("button", { className: "cx-js-pill cx-js-pill-today", onClick: () => setParshaIdx(pickParshaIndex(parashot)) }, "JUMP TO TODAY"), /*#__PURE__*/
      React.createElement("button", { className: "cx-js-pill", onClick: () => setParshaIdx((i) => (i + 1) % parashot.length) }, "NEXT \u2192")
      )
      ) :
      !err ? /*#__PURE__*/React.createElement("div", { className: "cx-js-status" }, "Loading parashot\u2026") : null,


      holidayInfo && holidayInfo.upcoming ? /*#__PURE__*/
      React.createElement("section", { className: "cx-js-holiday-card" }, /*#__PURE__*/
      React.createElement("div", { className: "cx-js-section-label cx-js-gold" },
      holidayInfo.upcoming.days <= 0 ? "HAPPENING NOW" : `IN ${holidayInfo.upcoming.days} DAYS`
      ), /*#__PURE__*/
      React.createElement("div", { className: "cx-js-holiday-name" }, holidayInfo.upcoming.h.hebrew), /*#__PURE__*/
      React.createElement("div", { className: "cx-js-holiday-translit" },
      holidayInfo.upcoming.h.name, " ", /*#__PURE__*/React.createElement("span", { className: "cx-js-dim" }, "\xB7 ", holidayInfo.upcoming.h.date),
      (() => {const g = holidayGreg(holidayInfo.upcoming.h.date, today && today.getFullYear ? today.getFullYear() : holYear);return g ? /*#__PURE__*/React.createElement("span", { style: { color: "var(--cx-accent)", marginLeft: 6 } }, "\xB7 ", g) : null;})()
      ), /*#__PURE__*/
      React.createElement("div", { className: "cx-js-holiday-readings" }, /*#__PURE__*/
      React.createElement("span", { className: "cx-js-reading-label" }, "Readings"), /*#__PURE__*/
      React.createElement("div", { className: "cx-js-reading-refs" }, renderRefList(holidayInfo.upcoming.h.readings))
      )
      ) :
      holidayInfo && holidayInfo.next ? /*#__PURE__*/
      React.createElement("div", { className: "cx-js-next-holiday" }, "Next holiday: ", /*#__PURE__*/
      React.createElement("b", null, holidayInfo.next.h.name), " in ", Math.max(0, holidayInfo.next.days), " days"
      ) :
      null,


      todayDaf ? /*#__PURE__*/
      React.createElement("section", { className: "cx-js-daf" }, /*#__PURE__*/
      React.createElement("div", { className: "cx-js-section-label" }, "DAF YOMI \xB7 DAY ", todayDaf.day), /*#__PURE__*/
      React.createElement("div", { className: "cx-js-daf-refs" },
      todayDaf.readings.map((r, i) => /*#__PURE__*/
      /* v10 — dapim are READABLE now: codexOpenText fetches the
         page live from Sefaria into a floating text window. */
      React.createElement("button", { key: i, type: "button", className: "cx-js-daf-ref is-live",
        title: `Open ${r.replace(/^talmud\./, "").replace(/\./g, " ")} (live from Sefaria)`,
        onClick: () => {if (window.codexOpenText) window.codexOpenText(r);} },
      r.replace(/^talmud\./, "").replace(/\./g, " ")
      )
      )
      )
      ) :
      null,


      cal ? /*#__PURE__*/
      React.createElement(React.Fragment, null, /*#__PURE__*/
      React.createElement("section", { className: "cx-js-collapse" }, /*#__PURE__*/
      React.createElement("button", { className: "cx-js-collapse-head", onClick: () => setShowMonths((s) => !s) }, /*#__PURE__*/
      React.createElement("span", null, showMonths ? "▾" : "▸"), " All 12 Hebrew months"
      ),
      showMonths ? /*#__PURE__*/
      React.createElement("table", { className: "cx-js-table" }, /*#__PURE__*/
      React.createElement("thead", null, /*#__PURE__*/
      React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "#"), /*#__PURE__*/React.createElement("th", null, "Hebrew"), /*#__PURE__*/React.createElement("th", null, "Translit"), /*#__PURE__*/React.createElement("th", null, "Gregorian"), /*#__PURE__*/React.createElement("th", null, "Notes"))
      ), /*#__PURE__*/
      React.createElement("tbody", null,
      cal.months.map((m) => /*#__PURE__*/
      React.createElement("tr", { key: m.n }, /*#__PURE__*/
      React.createElement("td", null, m.n), /*#__PURE__*/
      React.createElement("td", { className: "cx-js-heb" }, m.name), /*#__PURE__*/
      React.createElement("td", null, m.translit), /*#__PURE__*/
      React.createElement("td", { className: "cx-js-dim" }, m.approxGregorian), /*#__PURE__*/
      React.createElement("td", { className: "cx-js-dim" }, m.notes)
      )
      )
      )
      ) :
      null
      ), /*#__PURE__*/

      React.createElement("section", { className: "cx-js-collapse" }, /*#__PURE__*/
      React.createElement("button", { className: "cx-js-collapse-head", onClick: () => setShowHolidays((s) => !s) }, /*#__PURE__*/
      React.createElement("span", null, showHolidays ? "▾" : "▸"), " All major holidays"
      ),
      showHolidays ? /*#__PURE__*/
      React.createElement(React.Fragment, null, /*#__PURE__*/
      React.createElement("div", { className: "cx-js-year-row", style: { display: "flex", alignItems: "center", gap: 8, margin: "6px 0 10px", fontSize: "0.85em" } }, /*#__PURE__*/
      React.createElement("span", { className: "cx-js-dim" }, "Gregorian dates \xB7"), /*#__PURE__*/
      React.createElement("button", { className: "cx-js-ref", onClick: () => setHolYear((y) => y - 1), "aria-label": "Previous year", title: "Earlier year" }, "\u25C0"), /*#__PURE__*/
      React.createElement("b", { style: { minWidth: 42, textAlign: "center" } }, holYear), /*#__PURE__*/
      React.createElement("button", { className: "cx-js-ref", onClick: () => setHolYear((y) => y + 1), "aria-label": "Next year", title: "Later year" }, "\u25B6")
      ), /*#__PURE__*/
      React.createElement("ul", { className: "cx-js-holiday-list" },
      cal.holidays.map((h) => {
        const greg = holidayGreg(h.date, holYear);
        return (/*#__PURE__*/
          React.createElement("li", { key: h.id, className: "cx-js-holiday-li" }, /*#__PURE__*/
          React.createElement("div", { className: "cx-js-holiday-li-head" }, /*#__PURE__*/
          React.createElement("span", { className: "cx-js-heb" }, h.hebrew), /*#__PURE__*/
          React.createElement("span", null, " \xB7 "), /*#__PURE__*/
          React.createElement("span", null, h.name), /*#__PURE__*/
          React.createElement("span", { className: "cx-js-dim" }, " \xB7 ", h.date),
          greg ? /*#__PURE__*/React.createElement("span", { style: { color: "var(--cx-accent)", marginLeft: 6 } }, "\xB7 ", greg) : null
          ), /*#__PURE__*/
          React.createElement("div", { className: "cx-js-reading-refs" }, renderRefList(h.readings))
          ));

      })
      )
      ) :
      null
      )
      ) :
      null, /*#__PURE__*/

      React.createElement("footer", { className: "cx-js-foot" }, "Hebrew dates here are an approximation. A precise lunar-calendar engine is on the roadmap."

      )
      ));

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
        const sorted = c.holidays.
        map((h) => ({ h, days: daysUntilHoliday(h, heb, c.months) })).
        filter((x) => x.days != null).
        sort((a, b) => a.days - b.days);
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
    }
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
        render(ctx) {return React.createElement(JewishStudyPanel, ctx || {});}
      }]
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
})();
