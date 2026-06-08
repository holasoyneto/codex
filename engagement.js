// CODEX — Engagement Engine (Hook Model)
//
// Implements Nir Eyal's Hook Model cycle:
//   Trigger → Action → Variable Reward → Investment
//
// Tracks reading streaks, achievements, session stats, and daily
// discoveries.  Pure data layer — no React, no DOM.  UI components
// in app.jsx and plans.jsx consume window.CODEX_ENGAGE.

(function () {
  "use strict";

  // ── Storage keys ─────────────────────────────────────────────────────
  const STATS_KEY        = "codex.engagement.stats.v1";
  const STREAK_KEY       = "codex.engagement.streak.v1";
  const ACHIEVEMENTS_KEY = "codex.engagement.achievements.v1";
  const DAILY_KEY        = "codex.engagement.daily.v1";
  const SESSION_KEY      = "codex.engagement.session.v1";
  const REEL_LIKES_KEY   = "codex.reels.likes.v1";   // [{key,type,anchor,title,book,ts}]
  const ORACLE_TOPICS_KEY = "codex.engagement.oracle.v1";  // { [bookId]: weight }

  // ── Reel likes + reader taste profile ────────────────────────────────
  function reelCardKey(card) {
    if (!card) return "";
    return `${card.type || "?"}:${card.id || card.anchor || card.title || "?"}`;
  }
  function loadReelLikes() {
    try { return JSON.parse(localStorage.getItem(REEL_LIKES_KEY) || "[]") || []; }
    catch { return []; }
  }
  function saveReelLikes(list) {
    try { localStorage.setItem(REEL_LIKES_KEY, JSON.stringify(list.slice(-500))); } catch {}
  }
  function loadOracleTopics() {
    try { return JSON.parse(localStorage.getItem(ORACLE_TOPICS_KEY) || "{}") || {}; }
    catch { return {}; }
  }
  function saveOracleTopics(map) {
    try { localStorage.setItem(ORACLE_TOPICS_KEY, JSON.stringify(map)); } catch {}
  }
  function bookOf(anchor) {
    return (typeof anchor === "string" && anchor.indexOf(".") > 0) ? anchor.split(".")[0] : null;
  }

  // ── Date helpers ─────────────────────────────────────────────────────
  function isoToday() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  }
  function isoOffset(iso, days) {
    const [Y, M, D] = iso.split("-").map(Number);
    const d = new Date(Y, M - 1, D);
    d.setDate(d.getDate() + days);
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  }
  function daysBetween(a, b) {
    const da = new Date(a).getTime(), db = new Date(b).getTime();
    return Math.round((db - da) / 86400000);
  }

  // ── Stats ────────────────────────────────────────────────────────────
  function defaultStats() {
    return {
      firstOpen:          new Date().toISOString(),
      sessionCount:       0,
      chaptersRead:       {},     // { "gen.1": "2024-01-15", ... }
      totalChapters:      0,
      versesHighlighted:  0,
      notesCreated:       0,
      panelsViewed:       0,
      oracleQuestions:    0,
      searchesPerformed:  0,
      reelsViewed:        0,
      questsCompleted:    0,
      lastSession:        null,
    };
  }
  function loadStats() {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      return raw ? { ...defaultStats(), ...JSON.parse(raw) } : defaultStats();
    } catch { return defaultStats(); }
  }
  function saveStats(s) {
    try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch {}
  }

  // ── Streak ───────────────────────────────────────────────────────────
  function defaultStreak() {
    return { current: 0, longest: 0, lastDate: null, history: {} };
  }
  function loadStreak() {
    try {
      const raw = localStorage.getItem(STREAK_KEY);
      return raw ? { ...defaultStreak(), ...JSON.parse(raw) } : defaultStreak();
    } catch { return defaultStreak(); }
  }
  function saveStreak(sk) {
    try { localStorage.setItem(STREAK_KEY, JSON.stringify(sk)); } catch {}
  }

  /** Record that the user was active today. Returns the updated streak. */
  function recordDay() {
    const sk    = loadStreak();
    const today = isoToday();
    if (sk.lastDate === today) return sk;            // already counted

    const yesterday = isoOffset(today, -1);
    sk.current = sk.lastDate === yesterday ? sk.current + 1 : 1;
    sk.lastDate = today;
    sk.longest  = Math.max(sk.longest, sk.current);
    sk.history[today] = true;

    // Trim to last 400 days
    const cutoff = isoOffset(today, -400);
    for (const d of Object.keys(sk.history)) {
      if (d < cutoff) delete sk.history[d];
    }
    saveStreak(sk);
    return sk;
  }

  // ── Achievements ─────────────────────────────────────────────────────
  const ACHIEVEMENTS = [
    // ─ reading milestones
    { id: "first_chapter",     title: "First Steps",      desc: "Read your first chapter",     icon: "\u{1F4D6}", tier: 1, check: (s) => s.totalChapters >= 1 },
    { id: "ten_chapters",      title: "Student",          desc: "Read 10 chapters",            icon: "\u{1F4DA}", tier: 1, check: (s) => s.totalChapters >= 10 },
    { id: "fifty_chapters",    title: "Scholar",          desc: "Read 50 chapters",            icon: "\u{1F3DB}", tier: 2, check: (s) => s.totalChapters >= 50 },
    { id: "hundred_chapters",  title: "Sage",             desc: "Read 100 chapters",           icon: "\u{1F52E}", tier: 2, check: (s) => s.totalChapters >= 100 },
    { id: "fivehundred_ch",    title: "Oracle",           desc: "Read 500 chapters",           icon: "⚡",    tier: 3, check: (s) => s.totalChapters >= 500 },
    { id: "thousand_ch",       title: "Living Library",   desc: "Read 1,000 chapters",         icon: "\u{1F30C}", tier: 3, check: (s) => s.totalChapters >= 1000 },

    // ─ streak milestones
    { id: "streak_3",   title: "Kindling",       desc: "3-day reading streak",    icon: "\u{1F525}", tier: 1, check: (_, k) => k.longest >= 3 },
    { id: "streak_7",   title: "On Fire",        desc: "7-day reading streak",    icon: "\u{1F525}", tier: 1, check: (_, k) => k.longest >= 7 },
    { id: "streak_14",  title: "Ablaze",         desc: "14-day reading streak",   icon: "\u{1F525}", tier: 2, check: (_, k) => k.longest >= 14 },
    { id: "streak_30",  title: "Inferno",        desc: "30-day reading streak",   icon: "\u{1F525}", tier: 2, check: (_, k) => k.longest >= 30 },
    { id: "streak_100", title: "Eternal Flame",  desc: "100-day reading streak",  icon: "\u{1F525}", tier: 3, check: (_, k) => k.longest >= 100 },
    { id: "streak_365", title: "Burning Bush",   desc: "365-day reading streak",  icon: "\u{1F33F}\u{1F525}", tier: 3, check: (_, k) => k.longest >= 365 },

    // ─ feature discovery
    { id: "first_highlight", title: "Illuminator",    desc: "Highlight your first verse",   icon: "✨", tier: 1, check: (s) => s.versesHighlighted >= 1 },
    { id: "first_note",     title: "Scribe",          desc: "Write your first note",        icon: "\u{1FAB6}", tier: 1, check: (s) => s.notesCreated >= 1 },
    { id: "first_oracle",   title: "Seeker",          desc: "Ask the Oracle a question",    icon: "\u{1F52E}", tier: 1, check: (s) => s.oracleQuestions >= 1 },
    { id: "first_search",   title: "Explorer",        desc: "Search the scriptures",        icon: "\u{1F50D}", tier: 1, check: (s) => s.searchesPerformed >= 1 },
    { id: "panel_x10",      title: "Analyst",         desc: "View 10 AI panels",            icon: "\u{1F4CA}", tier: 1, check: (s) => s.panelsViewed >= 10 },
    { id: "panel_x100",     title: "Deep Analyst",    desc: "View 100 AI panels",           icon: "\u{1F9E0}", tier: 2, check: (s) => s.panelsViewed >= 100 },
    { id: "reels_x50",      title: "Scroll Keeper",   desc: "View 50 Reels cards",          icon: "\u{1F4DC}", tier: 2, check: (s) => s.reelsViewed >= 50 },
    { id: "quest_x1",       title: "Quester",         desc: "Complete a study quest",        icon: "\u{1F3AF}", tier: 2, check: (s) => s.questsCompleted >= 1 },

    // ─ session milestones
    { id: "sessions_10",  title: "Regular",        desc: "Open CODEX 10 times",    icon: "\u{1F3E0}", tier: 1, check: (s) => s.sessionCount >= 10 },
    { id: "sessions_50",  title: "Habitual",       desc: "Open CODEX 50 times",    icon: "⚙️", tier: 2, check: (s) => s.sessionCount >= 50 },
    { id: "sessions_100", title: "Devoted",        desc: "Open CODEX 100 times",   icon: "⭐",    tier: 2, check: (s) => s.sessionCount >= 100 },
    { id: "sessions_365", title: "Disciple",       desc: "Open CODEX 365 times",   icon: "\u{1F451}", tier: 3, check: (s) => s.sessionCount >= 365 },

    // ─ investment depth
    { id: "notes_x10",      title: "Commentator",  desc: "Write 10 notes",                icon: "\u{1F4DD}", tier: 2, check: (s) => s.notesCreated >= 10 },
    { id: "highlights_x25", title: "Highlighter",  desc: "Highlight 25 verses",           icon: "\u{1F308}", tier: 2, check: (s) => s.versesHighlighted >= 25 },
    { id: "highlights_x100",title: "Marked Canon",  desc: "Highlight 100 verses",          icon: "\u{1F4A1}", tier: 3, check: (s) => s.versesHighlighted >= 100 },
  ];

  function loadUnlocked() {
    try {
      return JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY)) || {};
    } catch { return {}; }
  }

  /** Returns array of newly-unlocked achievement descriptors. */
  function checkAchievements() {
    const stats    = loadStats();
    const streak   = loadStreak();
    const unlocked = loadUnlocked();
    const fresh    = [];

    for (const a of ACHIEVEMENTS) {
      if (unlocked[a.id]) continue;
      try {
        if (a.check(stats, streak)) {
          unlocked[a.id] = isoToday();
          fresh.push(a);
        }
      } catch {}
    }
    if (fresh.length) {
      try { localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(unlocked)); } catch {}
    }
    return fresh;
  }

  // ── Daily Discovery (Variable Reward) ────────────────────────────────
  // Each day the user gets a different type of discovery to keep
  // the reward schedule unpredictable — the core dopamine driver.

  const DISCOVERY_TYPES = [
    "verse-of-day",      // A featured verse with reflective prompt
    "word-spotlight",    // A Hebrew/Greek word deep-dive
    "number-pattern",    // A gematria / numerological discovery
    "cross-echo",        // Two passages that echo each other
    "did-you-know",      // A surprising historical or textual fact
    "name-of-god",       // One of the 70+ Hebrew divine names
    "prophecy-pair",     // OT prophecy ↔ NT fulfillment
  ];

  // Deterministic daily seed so discovery is stable within a day
  // but changes every day (variable reward schedule).
  function hashDate(iso) {
    let h = 5381;
    for (let i = 0; i < iso.length; i++) {
      h = ((h << 5) + h + iso.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  // A curated mini-pool for fully-offline daily discoveries.
  // Each entry is self-contained — no AI call required.
  const CURATED_DAILY = [
    { type: "verse-of-day",   title: "The Word Made Flesh",     ref: "John 1:14",       body: "And the Word became flesh and dwelt among us, full of grace and truth." },
    { type: "verse-of-day",   title: "Be Still",                ref: "Psalm 46:10",     body: "Be still, and know that I am God." },
    { type: "verse-of-day",   title: "Living Water",            ref: "John 7:38",       body: "Whoever believes in me, rivers of living water will flow from within them." },
    { type: "verse-of-day",   title: "The Shema",               ref: "Deuteronomy 6:4", body: "Hear, O Israel: the LORD our God, the LORD is one." },
    { type: "word-spotlight", title: "Hesed (חֶסֶד)",  ref: "Psalm 136:1",     body: "Steadfast love, covenant loyalty, lovingkindness — the untranslatable mercy at the heart of Torah. Appears 248 times in the Hebrew Bible." },
    { type: "word-spotlight", title: "Logos (Λόγος)",   ref: "John 1:1",        body: "Word, reason, divine order — bridges Hebrew dabar and Greek philosophy. John chose this term to speak to both worlds." },
    { type: "word-spotlight", title: "Ruach (רוּחַ)",   ref: "Genesis 1:2",     body: "Spirit, breath, wind — the animating force hovering over the waters at creation. Feminine noun in Hebrew." },
    { type: "number-pattern", title: "153 Fish",                ref: "John 21:11",      body: "153 is the 17th triangular number (1+2+…+17). In gematria, it encodes completeness — every nation’s fish caught in one net." },
    { type: "number-pattern", title: "The Number 40",           ref: "Genesis 7:12",    body: "Rain fell 40 days. Moses on Sinai 40 days. Israel wandered 40 years. Jesus fasted 40 days. 40 = a generation of testing and transformation." },
    { type: "cross-echo",     title: "Garden ↔ Garden",    ref: "Genesis 3:8 ↔ John 20:15", body: "Humanity lost God in a garden (Eden). Mary found the risen Christ in a garden (the tomb). The narrative arc closes where it began." },
    { type: "cross-echo",     title: "Water from Rock",         ref: "Exodus 17:6 ↔ 1 Corinthians 10:4", body: "Moses struck the rock and water flowed. Paul says that rock was Christ — a spiritual well that followed Israel through the desert." },
    { type: "did-you-know",   title: "Psalms in the NT",        ref: "Psalms",           body: "The New Testament quotes or alludes to the Psalms more than any other Old Testament book — over 100 direct citations." },
    { type: "did-you-know",   title: "The Oldest Fragment",     ref: "Numbers 6:24–26", body: "The Aaronic blessing (\"The LORD bless you and keep you\") was found on two silver scrolls from 600 BC — the oldest known biblical text, predating the Dead Sea Scrolls by 400 years." },
    { type: "did-you-know",   title: "Hapax Legomena",          ref: "2 Timothy 3:16",   body: "The Bible contains over 1,500 hapax legomena — words that appear only once in the entire text. Each one is a puzzle for translators." },
    { type: "name-of-god",    title: "El Shaddai",              ref: "Genesis 17:1",     body: "God Almighty — or perhaps “God of the Mountain.” The name God used with Abraham before revealing YHWH to Moses." },
    { type: "name-of-god",    title: "YHWH-Yireh",              ref: "Genesis 22:14",    body: "\"The LORD Will Provide\" — named by Abraham on Mount Moriah after the ram appeared in the thicket. The same mountain where Solomon built the Temple." },
    { type: "name-of-god",    title: "El Elyon",                ref: "Genesis 14:18",    body: "God Most High — the name Melchizedek used. A title that transcends tribal religion, pointing to a universal sovereign." },
    { type: "prophecy-pair",  title: "Born in Bethlehem",       ref: "Micah 5:2 → Matthew 2:1", body: "Micah, 700 years before the event, named Bethlehem Ephrathah as the birthplace of a ruler whose origins are from eternity." },
    { type: "prophecy-pair",  title: "Pierced Hands",           ref: "Psalm 22:16 → John 20:25", body: "\"They pierced my hands and my feet\" — written centuries before crucifixion was invented as a method of execution." },
    { type: "prophecy-pair",  title: "Thirty Silver Coins",     ref: "Zechariah 11:12–13 → Matthew 26:15", body: "Zechariah described the price of betrayal (30 pieces of silver) and that it would be thrown to the potter — 500 years before Judas." },
    { type: "verse-of-day",   title: "The Narrow Gate",         ref: "Matthew 7:14",     body: "Narrow is the gate and difficult is the way which leads to life, and there are few who find it." },
    { type: "verse-of-day",   title: "Iron Sharpens Iron",      ref: "Proverbs 27:17",   body: "As iron sharpens iron, so one person sharpens another." },
    { type: "word-spotlight", title: "Selah (סֶלָה)",   ref: "Psalm 3:2",       body: "Appears 71 times in Psalms and 3 times in Habakkuk. Nobody knows exactly what it means — perhaps a musical pause, a meditation cue, or an affirmation like “Amen.”" },
    { type: "number-pattern", title: "Seven Days",              ref: "Genesis 2:2",      body: "7 days of creation. 7 seals, 7 trumpets, 7 bowls in Revelation. 7 appears 735 times in the Bible. The number of divine completion." },
    { type: "cross-echo",     title: "Serpent Lifted Up",       ref: "Numbers 21:9 ↔ John 3:14", body: "Moses lifted a bronze serpent on a pole to heal. Jesus said “As Moses lifted up the serpent… so must the Son of Man be lifted up.” The symbol of curse became the symbol of salvation." },
    { type: "did-you-know",   title: "No Letter J",             ref: "Matthew 1:21",     body: "The name “Jesus” didn’t exist until the 16th century. His name was Yeshua (ישוע) — meaning “YHWH saves” — rendered Iesous in Greek." },
    { type: "name-of-god",    title: "Adonai Tzva’ot",     ref: "1 Samuel 1:3",     body: "Lord of Hosts — commander of the heavenly armies. Hannah was the first person recorded using this name, in desperate prayer for a child." },
    { type: "prophecy-pair",  title: "The Suffering Servant",   ref: "Isaiah 53:5 → 1 Peter 2:24", body: "\"He was wounded for our transgressions\" — the most debated prophecy in Jewish-Christian dialogue, written 700 years before Calvary." },
    { type: "number-pattern", title: "888 — Iesous",       ref: "Matthew 1:1",      body: "In Greek isopsephy, ΙΗΣΟΥΣ (Jesus) = 10+8+200+70+400+200 = 888. One beyond 7 (perfection) in every digit — resurrection mathematics." },
  ];

  function getDailyDiscovery() {
    const today = isoToday();
    try {
      const c = JSON.parse(localStorage.getItem(DAILY_KEY));
      if (c && c.date === today) return c;
    } catch {}
    const seed = hashDate(today);
    const pick = CURATED_DAILY[seed % CURATED_DAILY.length];
    const disc = { ...pick, date: today, seed };
    try { localStorage.setItem(DAILY_KEY, JSON.stringify(disc)); } catch {}
    return disc;
  }

  // ── Session tracker ──────────────────────────────────────────────────
  // Tracks last-read position so "Continue Reading" works.
  function loadSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
    } catch { return null; }
  }
  function saveSession(bookId, chapter, bookName) {
    const s = { bookId, chapter, bookName, ts: Date.now() };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch {}
  }

  // ── Notification helpers ─────────────────────────────────────────────
  async function requestNotifications() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    return (await Notification.requestPermission()) === "granted";
  }

  function fireNotification(title, body) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try {
      new Notification(title, { body, icon: "/icon-192.png", badge: "/icon-192.png" });
    } catch {}
  }

  // ── Loss-aversion streak warning ─────────────────────────────────────
  // Returns a warning message if the streak is at risk.
  function streakWarning() {
    const sk = loadStreak();
    if (sk.current < 2) return null;
    const today = isoToday();
    if (sk.lastDate === today) return null;           // already safe
    if (sk.lastDate === isoOffset(today, -1)) {
      return {
        level: "warn",
        msg: `Don’t break your ${sk.current}-day streak! Read today to keep the flame alive.`,
        current: sk.current,
      };
    }
    return null;  // streak already broken or not started
  }

  // ── Time-of-day suggestion (contextual trigger) ──────────────────────
  function timeOfDaySuggestion() {
    const h = new Date().getHours();
    if (h >= 5 && h < 9)        return { period: "morning",   suggestion: "Start the day with a Psalm", book: "psa" };
    if (h >= 9 && h < 12)       return { period: "morning",   suggestion: "Morning wisdom from Proverbs", book: "pro" };
    if (h >= 12 && h < 17)      return { period: "afternoon", suggestion: "Afternoon reading: the Gospels", book: "mat" };
    if (h >= 17 && h < 21)      return { period: "evening",   suggestion: "Evening reflection with Ecclesiastes", book: "ecc" };
    return { period: "night",   suggestion: "Night reading: the Psalms", book: "psa" };
  }

  // ── Engagement score (composite metric) ──────────────────────────────
  function engagementScore() {
    const s  = loadStats();
    const sk = loadStreak();
    // Weighted score — rewards consistent engagement over one-off binges
    return Math.round(
      (s.totalChapters * 2) +
      (sk.longest * 5) +
      (sk.current * 3) +
      (s.versesHighlighted * 1) +
      (s.notesCreated * 2) +
      (s.oracleQuestions * 1) +
      (s.panelsViewed * 0.5) +
      (s.reelsViewed * 0.2) +
      (s.sessionCount * 0.5)
    );
  }

  // ── Public API ───────────────────────────────────────────────────────
  const api = {
    // Data loaders
    loadStats,
    loadStreak,
    loadUnlocked,
    loadSession,
    saveSession,

    // Core cycle
    recordDay,
    checkAchievements,
    getDailyDiscovery,
    streakWarning,
    timeOfDaySuggestion,
    engagementScore,
    ACHIEVEMENTS,

    // Notifications
    requestNotifications,
    fireNotification,

    // ── Convenience trackers ───────────────────────────────────────────
    // Each returns an array of newly-unlocked achievements (may be empty).
    trackChapter(bookId, chapter) {
      const s = loadStats();
      const key = `${bookId}.${chapter}`;
      if (!s.chaptersRead[key]) {
        s.chaptersRead[key] = isoToday();
        s.totalChapters = Object.keys(s.chaptersRead).length;
        saveStats(s);
      }
      recordDay();
      return checkAchievements();
    },
    trackHighlight() {
      const s = loadStats(); s.versesHighlighted++; saveStats(s);
      return checkAchievements();
    },
    trackNote() {
      const s = loadStats(); s.notesCreated++; saveStats(s);
      return checkAchievements();
    },
    trackOracle(ctx) {
      const s = loadStats(); s.oracleQuestions++; saveStats(s);
      if (ctx && ctx.book) {
        const t = loadOracleTopics();
        t[ctx.book] = (t[ctx.book] || 0) + 1;
        saveOracleTopics(t);
      }
      return checkAchievements();
    },
    trackSearch() {
      const s = loadStats(); s.searchesPerformed++; saveStats(s);
      return checkAchievements();
    },
    trackPanel() {
      const s = loadStats(); s.panelsViewed++; saveStats(s);
      return checkAchievements();
    },
    trackReel() {
      const s = loadStats(); s.reelsViewed++; saveStats(s);
      return checkAchievements();
    },
    // ── Reel likes (the explicit taste signal) ───────────────────────
    isReelLiked(card) {
      const k = reelCardKey(card);
      return loadReelLikes().some((l) => l.key === k);
    },
    // Toggle a like. Returns { liked: boolean, achievements }.
    toggleReelLike(card) {
      const k = reelCardKey(card);
      let list = loadReelLikes();
      const idx = list.findIndex((l) => l.key === k);
      let liked;
      if (idx >= 0) { list.splice(idx, 1); liked = false; }
      else {
        list.push({
          key: k, type: card.type || null, anchor: card.anchor || null,
          title: card.title || null, book: bookOf(card.anchor), ts: Date.now(),
        });
        liked = true;
      }
      saveReelLikes(list);
      recordDay();
      return { liked, achievements: checkAchievements() };
    },
    getReelLikes() { return loadReelLikes(); },
    // Wipe learned personalization (likes + oracle topics). Keeps the user's
    // real data (highlights, notes, reading history, streaks) intact.
    clearProfile() {
      try { localStorage.removeItem(REEL_LIKES_KEY); } catch {}
      try { localStorage.removeItem(ORACLE_TOPICS_KEY); } catch {}
      return { ok: true };
    },
    // Derive a taste profile from explicit likes + highlights + reading
    // history. Used to bias the Reels feed toward what the reader engages with.
    buildReaderProfile() {
      const likes = loadReelLikes();
      const stats = loadStats();
      const cardTypes = {};   // type → weight
      const books = {};       // bookId → weight
      const likedKeys = {};
      for (const l of likes) {
        likedKeys[l.key] = true;
        if (l.type) cardTypes[l.type] = (cardTypes[l.type] || 0) + 2;   // explicit like = strong
        if (l.book) books[l.book] = (books[l.book] || 0) + 2;
      }
      // Highlights = medium signal (verse-level interest).
      try {
        const hl = JSON.parse(localStorage.getItem("codex.highlights.v1") || localStorage.getItem("codex.marks.v1") || "{}");
        for (const key of Object.keys(hl)) { const b = bookOf(key); if (b) books[b] = (books[b] || 0) + 1; }
      } catch {}
      // Reading history = light signal.
      try {
        for (const ref of Object.keys(stats.chaptersRead || {})) { const b = bookOf(ref); if (b) books[b] = (books[b] || 0) + 0.5; }
      } catch {}
      // Oracle topics = medium signal (asking about a book biases the feed toward it).
      try {
        const topics = loadOracleTopics();
        for (const b of Object.keys(topics)) { books[b] = (books[b] || 0) + 1.5 * topics[b]; }
      } catch {}
      const topBooks = Object.keys(books).sort((a, b) => books[b] - books[a]).slice(0, 8);
      const topTypes = Object.keys(cardTypes).sort((a, b) => cardTypes[b] - cardTypes[a]);
      const likeCount = likes.length;
      return {
        cardTypes, books, likedKeys, topBooks, topTypes,
        likeCount,
        hasSignal: likeCount > 0 || topBooks.length > 0,
        tier: likeCount >= 20 ? "deep" : likeCount >= 5 ? "engaged" : likeCount >= 1 ? "warming" : "new",
      };
    },
    trackQuest() {
      const s = loadStats(); s.questsCompleted++; saveStats(s);
      return checkAchievements();
    },
    trackSession() {
      const s = loadStats();
      s.sessionCount++;
      s.lastSession = new Date().toISOString();
      saveStats(s);
      recordDay();
      return checkAchievements();
    },
  };

  window.CODEX_ENGAGE = api;
})();


// ════════════════════════════════════════════════════════════════════════
// CODEX — Continuity & Mastery Engine  (Phase 2.5)
//
// A NEW namespace: window.CODEX_ENGAGEMENT. Lives alongside (does NOT touch)
// the legacy window.CODEX_ENGAGE Hook-Model layer above.
//
// DESIGN LAW (non-negotiable):
//   • DEPTH-GATED, not presence-gated. Opening/scrolling/idling NEVER advance
//     anything. Only depth actions count (Strong's lookup, cross-ref thread,
//     word study, note written, quest step, gematria match, guide read, …).
//   • GRACE-SHAPED. Continuity (the streak) forgives lapses with grace tokens.
//     No red, no broken-flame, no "don't break your streak" — ever.
//   • SOLO-FIRST. No leaderboard, no social, no friends. Anywhere.
//   • NO mascot / confetti / cute. Terminal "analyst desk" framing.
//   • TRADITION-AGNOSTIC. Never assumes one tradition's calendar/canon.
//   • LOCAL-ONLY. localStorage + IndexedDB. Never phones home. Never routed
//     through observability.js. Rides the existing codex.* export/import.
//   • NEVER THROWS at load. All IDB wrapped in try/catch with LS fallback.
//   • Offline + Lite mode (?lite=1): engine still loads; UI may hide surfaces.
//
// The rest of the build binds to the FROZEN CONTRACT returned by this agent.
// ════════════════════════════════════════════════════════════════════════
(function () {
  "use strict";

  // ── Storage keys (all codex.* so they ride export/import automatically) ──
  const K_CONTINUITY = "codex.continuity.v1";   // { current, longest, lastDay, grace, history, ringStart }
  const K_MASTERY    = "codex.mastery.v1";       // { [domain]: { score, threads, level, lastTs } }
  const K_MILESTONES = "codex.milestones.v1";    // { [milestoneId]: isoDay }
  const K_QUESTS     = "codex.quests.v1";        // { [questId]: { status, step, startedAt, updatedAt, completedAt } }
  const K_EVENTLOG   = "codex.eventlog.v1";      // LS fallback array (capped) for the append-only log
  const K_CONFIG     = "codex.engagement.config.v1"; // { dailyThreshold }

  const IDB_NAME  = "codex-engagement";
  const IDB_STORE = "events";
  const IDB_VERSION = 1;
  const LS_LOG_CAP = 2000;   // capped fallback array size
  const GRACE_CAP  = 2;      // hold at most 2 grace tokens
  const GRACE_EVERY = 7;     // auto-grant 1 grace token every 7 continuity days

  const DEFAULT_DAILY_THRESHOLD = 1;  // qualifying depth events needed to count a day

  // ── tiny helpers ─────────────────────────────────────────────────────
  function safeT(key, fallback) {
    try {
      if (typeof window !== "undefined" && typeof window.t === "function") {
        const v = window.t(key);
        if (v && v !== key) return v;
      }
    } catch (_) {}
    return fallback;
  }
  function lsGet(key, dflt) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? dflt : JSON.parse(raw);
    } catch (_) { return dflt; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (_) { return false; }
  }
  function dispatch(name, detail) {
    try {
      if (typeof window !== "undefined" && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent(name, { detail }));
      }
    } catch (_) {}
  }
  function now() { return Date.now(); }

  // ── date helpers (local calendar day, matches legacy engine) ──────────
  function isoDay(ts) {
    const d = ts == null ? new Date() : new Date(ts);
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  }
  function dayOffset(iso, days) {
    const [Y, M, D] = iso.split("-").map(Number);
    const d = new Date(Y, M - 1, D);
    d.setDate(d.getDate() + days);
    return isoDay(d.getTime());
  }
  function daysBetween(a, b) {
    const da = new Date(a + "T00:00:00").getTime();
    const db = new Date(b + "T00:00:00").getTime();
    return Math.round((db - da) / 86400000);
  }

  // ── config ────────────────────────────────────────────────────────────
  function getConfig() {
    const c = lsGet(K_CONFIG, null) || {};
    return { dailyThreshold: Math.max(1, c.dailyThreshold || DEFAULT_DAILY_THRESHOLD) };
  }
  function setConfig(patch) {
    const c = { ...getConfig(), ...(patch || {}) };
    lsSet(K_CONFIG, c);
    return c;
  }

  // ════════════════════════════════════════════════════════════════════
  // DOMAIN + DEPTH-ACTION TAXONOMY  (the contract emitters bind to)
  // ════════════════════════════════════════════════════════════════════
  // Eight mastery domains. Tradition-agnostic labels via i18n at the UI layer.
  const DOMAINS = [
    "hebrew-greek",     // Strong's, lemmas, word studies
    "cross-references", // followed cross-ref threads / chains
    "gematria",         // numeric / isopsephy matches
    "talmud",           // daf / mishnah study
    "patristics",       // church-fathers commentary
    "gnosis",           // gnostic / nag-hammadi reading
    "geography",        // map / place study
    "canon-coverage",   // breadth across the canon (chapters/books closed)
  ];

  // Depth-action types. Each: { weight, domain }.
  //   weight  → how much it advances mastery (closing a thread weighs more
  //             than a single lookup). A day counts toward continuity if it
  //             has >= dailyThreshold qualifying depth events (any type).
  //   domain  → which mastery domain it feeds (null = continuity-only, feeds
  //             no specific domain but still qualifies the day).
  const DEPTH_ACTIONS = {
    // — Hebrew/Greek —
    "strongs-lookup":      { weight: 1, domain: "hebrew-greek" },
    "lemma-open":          { weight: 1, domain: "hebrew-greek" },
    "word-study-complete": { weight: 5, domain: "hebrew-greek" }, // closing a thread
    // — Cross-references —
    "crossref-follow":     { weight: 1, domain: "cross-references" },
    "crossref-chain":      { weight: 5, domain: "cross-references" }, // >=3-hop chain closed
    // — Gematria —
    "gematria-lookup":     { weight: 1, domain: "gematria" },
    "gematria-match":      { weight: 4, domain: "gematria" }, // match found in user's own library
    // — Talmud —
    "daf-read":            { weight: 3, domain: "talmud" },
    "mishnah-study":       { weight: 3, domain: "talmud" },
    // — Patristics —
    "patristics-read":     { weight: 2, domain: "patristics" },
    // — Gnosis —
    "gnosis-read":         { weight: 2, domain: "gnosis" },
    // — Geography —
    "map-place-study":     { weight: 2, domain: "geography" },
    // — Canon coverage —
    "passage-guide-read":  { weight: 4, domain: "canon-coverage" }, // a full passage guide
    "chapter-closed":      { weight: 1, domain: "canon-coverage" },
    "study-built":         { weight: 5, domain: "canon-coverage" }, // a built study
    // — Cross-cutting depth (feed no single domain, still qualify the day) —
    "note-written":        { weight: 2, domain: null },
    "discovery-logged":    { weight: 2, domain: null },
    "quest-step":          { weight: 3, domain: null }, // re-tagged to quest's domain when known
  };

  // Mastery level thresholds (cumulative weight → named level).
  const MASTERY_LEVELS = [
    { level: 0, min: 0,    key: "cx.mastery.lvl.dormant",  en: "Dormant" },
    { level: 1, min: 10,   key: "cx.mastery.lvl.tracking", en: "Tracking" },
    { level: 2, min: 40,   key: "cx.mastery.lvl.analyst",  en: "Analyst" },
    { level: 3, min: 120,  key: "cx.mastery.lvl.adept",    en: "Adept" },
    { level: 4, min: 300,  key: "cx.mastery.lvl.cryptic",  en: "Cryptographer" },
    { level: 5, min: 700,  key: "cx.mastery.lvl.oracle",   en: "Oracle-grade" },
  ];
  function levelForScore(score) {
    let lv = MASTERY_LEVELS[0];
    for (const m of MASTERY_LEVELS) if (score >= m.min) lv = m;
    return lv;
  }

  // ════════════════════════════════════════════════════════════════════
  // EVENT LOG — append-only. IndexedDB primary, capped LS array fallback.
  // ════════════════════════════════════════════════════════════════════
  let _idb = null;          // cached open db
  let _idbBroken = false;   // once a failure is seen, stop trying IDB this session

  function openLogDB() {
    return new Promise(function (resolve, reject) {
      if (_idbBroken) return reject(new Error("idb-disabled"));
      if (_idb) return resolve(_idb);
      if (typeof indexedDB === "undefined") { _idbBroken = true; return reject(new Error("no-idb")); }
      let req;
      try { req = indexedDB.open(IDB_NAME, IDB_VERSION); }
      catch (e) { _idbBroken = true; return reject(e); }
      req.onupgradeneeded = function (e) {
        try {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            const os = db.createObjectStore(IDB_STORE, { keyPath: "id", autoIncrement: true });
            os.createIndex("ts", "ts", { unique: false });
            os.createIndex("domain", "domain", { unique: false });
          }
        } catch (_) {}
      };
      req.onsuccess = function () { _idb = req.result; resolve(_idb); };
      req.onerror = function () { _idbBroken = true; reject(req.error || new Error("idb-open-failed")); };
    });
  }

  function idbAppend(evt) {
    return openLogDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        try {
          const tx = db.transaction(IDB_STORE, "readwrite");
          tx.objectStore(IDB_STORE).add(evt);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { reject(tx.error); };
          tx.onabort = function () { reject(tx.error); };
        } catch (e) { reject(e); }
      });
    });
  }

  function idbAll() {
    return openLogDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        try {
          const tx = db.transaction(IDB_STORE, "readonly");
          const req = tx.objectStore(IDB_STORE).getAll();
          req.onsuccess = function () { resolve(req.result || []); };
          req.onerror = function () { reject(req.error); };
        } catch (e) { reject(e); }
      });
    });
  }

  function idbClear() {
    return openLogDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        try {
          const tx = db.transaction(IDB_STORE, "readwrite");
          tx.objectStore(IDB_STORE).clear();
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { reject(tx.error); };
        } catch (e) { reject(e); }
      });
    });
  }

  // LS fallback (also a synchronous mirror of "today's" events for fast day-counting)
  function lsLogAppend(evt) {
    const arr = lsGet(K_EVENTLOG, []) || [];
    arr.push(evt);
    if (arr.length > LS_LOG_CAP) arr.splice(0, arr.length - LS_LOG_CAP);
    lsSet(K_EVENTLOG, arr);
  }
  function lsLogAll() { return lsGet(K_EVENTLOG, []) || []; }

  // Append to the durable log. Never throws. Always mirrors to the capped
  // LS array (cheap, synchronous, survives IDB failure & powers day-counting).
  function appendEvent(evt) {
    lsLogAppend(evt);                       // synchronous mirror — always
    try {
      idbAppend(evt).catch(function () {}); // best-effort durable append
    } catch (_) {}
  }

  // ════════════════════════════════════════════════════════════════════
  // CONTINUITY (the streak) + GRACE
  // ════════════════════════════════════════════════════════════════════
  function defaultContinuity() {
    return {
      current: 0,        // current continuity length in days
      longest: 0,        // best ever
      lastDay: null,     // iso day of last qualifying day
      todayCount: 0,     // qualifying depth events recorded today
      countedToday: false, // whether today already counted
      grace: 0,          // grace tokens held (cap GRACE_CAP)
      graceSpentDays: {}, // { isoDay: true } days that a token covered
      sinceGrace: 0,     // qualifying days since last grace grant
      ringStart: null,   // iso day the current continuity ring began
      history: {},       // { isoDay: true } qualifying days (trimmed to 400)
    };
  }
  function loadContinuity() {
    const c = lsGet(K_CONTINUITY, null);
    return c ? { ...defaultContinuity(), ...c } : defaultContinuity();
  }
  function saveContinuity(c) { lsSet(K_CONTINUITY, c); }

  // Resolve the gap between lastDay and `today`, spending grace silently for
  // missed days. Returns { status, graceSpent }. No guilt framing ever.
  function reconcileGap(c, today) {
    if (!c.lastDay) return { status: "fresh", graceSpent: 0 };
    const gap = daysBetween(c.lastDay, today);
    if (gap <= 1) return { status: "continuous", graceSpent: 0 };
    // gap-1 missed days between lastDay and today
    const missed = gap - 1;
    let spent = 0;
    for (let i = 0; i < missed; i++) {
      if (c.grace > 0) {
        c.grace -= 1;
        spent += 1;
        const coveredDay = dayOffset(c.lastDay, i + 1);
        c.graceSpentDays[coveredDay] = true;
      } else {
        // No token: continuity pauses (NOT broken). It will restart at 1 on
        // the next qualifying day. No loss state, no red.
        return { status: "paused", graceSpent: spent };
      }
    }
    // All missed days covered by grace → continuity HELD.
    return { status: "held", graceSpent: spent };
  }

  // Record one qualifying depth event toward continuity. Returns a summary.
  // Dispatches codex:continuity-tick only when a NEW day first qualifies.
  function tickContinuity() {
    const cfg = getConfig();
    const c = loadContinuity();
    const today = isoDay();

    // Roll over to a new day if needed.
    if (c.lastCountDay !== today) {
      // Different day than where todayCount was accruing.
      if (c.lastDay === today) {
        // already counted today; just resume accrual count
      } else {
        c.todayCount = 0;
        c.countedToday = false;
      }
      c.lastCountDay = today;
    }

    c.todayCount += 1;

    // Already counted today → nothing more to do (no tick).
    if (c.lastDay === today) {
      saveContinuity(c);
      return continuityStatus(c);
    }

    // Need threshold to count the day.
    if (c.todayCount < cfg.dailyThreshold) {
      saveContinuity(c);
      return continuityStatus(c);
    }

    // ── Today qualifies. Reconcile any gap with grace, then advance. ──
    const gap = reconcileGap(c, today);
    if (gap.status === "paused") {
      c.current = 1;             // restart, no guilt
      c.ringStart = today;
    } else if (gap.status === "fresh") {
      c.current = 1;
      c.ringStart = today;
    } else {
      c.current = (c.current || 0) + 1; // continuous or held
      if (!c.ringStart) c.ringStart = today;
    }

    c.lastDay = today;
    c.countedToday = true;
    c.longest = Math.max(c.longest || 0, c.current);
    c.history[today] = true;
    c.sinceGrace = (c.sinceGrace || 0) + 1;

    // Auto-grant grace every GRACE_EVERY qualifying days (cap GRACE_CAP).
    let graceGranted = 0;
    while (c.sinceGrace >= GRACE_EVERY && c.grace < GRACE_CAP) {
      c.grace += 1;
      c.sinceGrace -= GRACE_EVERY;
      graceGranted += 1;
    }
    if (c.sinceGrace >= GRACE_EVERY) c.sinceGrace = c.sinceGrace % GRACE_EVERY;

    // Trim history to last 400 days.
    const cutoff = dayOffset(today, -400);
    for (const d of Object.keys(c.history)) if (d < cutoff) delete c.history[d];
    for (const d of Object.keys(c.graceSpentDays)) if (d < cutoff) delete c.graceSpentDays[d];

    saveContinuity(c);

    const status = continuityStatus(c, { graceSpent: gap.graceSpent, graceGranted, gapStatus: gap.status });
    dispatch("codex:continuity-tick", status);
    return status;
  }

  function continuityStatus(c, extra) {
    c = c || loadContinuity();
    extra = extra || {};
    const today = isoDay();
    let copyKey = "cx.continuity.active", copyEn = "Continuity active";
    if (extra.graceSpent > 0) { copyKey = "cx.continuity.held"; copyEn = "Continuity held — grace spent"; }
    else if (extra.gapStatus === "paused") { copyKey = "cx.continuity.resumed"; copyEn = "Continuity resumed"; }
    else if (!c.lastDay) { copyKey = "cx.continuity.idle"; copyEn = "Continuity idle"; }
    return {
      current: c.current || 0,
      longest: c.longest || 0,
      lastDay: c.lastDay || null,
      countedToday: c.lastDay === today,
      grace: c.grace || 0,
      graceCap: GRACE_CAP,
      graceSpent: extra.graceSpent || 0,
      graceGranted: extra.graceGranted || 0,
      ringStart: c.ringStart || null,
      sinceGrace: c.sinceGrace || 0,
      nextGraceIn: Math.max(0, GRACE_EVERY - (c.sinceGrace || 0)),
      statusKey: copyKey,
      statusText: safeT(copyKey, copyEn),
    };
  }

  // Read-only continuity snapshot that ALSO reconciles a stale gap for display
  // (spends grace if the user opened after a lapse) without requiring an event.
  function continuity() {
    const c = loadContinuity();
    const today = isoDay();
    if (c.lastDay && c.lastDay !== today) {
      const gap = reconcileGap(c, today);
      if (gap.graceSpent > 0 || gap.status === "paused") {
        if (gap.status === "paused") { /* paused: current stays; restarts on next qualifying day */ }
        saveContinuity(c);
        return continuityStatus(c, { graceSpent: gap.graceSpent, gapStatus: gap.status });
      }
    }
    return continuityStatus(c);
  }

  // ════════════════════════════════════════════════════════════════════
  // MASTERY (per domain) — rises from closing threads (weighted events)
  // ════════════════════════════════════════════════════════════════════
  function loadMastery() {
    const m = lsGet(K_MASTERY, null) || {};
    for (const d of DOMAINS) if (!m[d]) m[d] = { score: 0, threads: 0, level: 0, lastTs: null };
    return m;
  }
  function saveMastery(m) { lsSet(K_MASTERY, m); }

  function bumpMastery(domain, weight, isThread) {
    if (!domain || DOMAINS.indexOf(domain) === -1) return null;
    const m = loadMastery();
    const cell = m[domain];
    const prevLevel = cell.level;
    cell.score += weight;
    if (isThread) cell.threads += 1;
    cell.lastTs = now();
    const lv = levelForScore(cell.score);
    cell.level = lv.level;
    saveMastery(m);
    if (lv.level > prevLevel) {
      // A level-up is a milestone too.
      unlockMilestone("mastery." + domain + ".lvl" + lv.level, {
        kind: "mastery-level", domain, level: lv.level,
        labelEn: lv.en, labelKey: lv.key,
      });
    }
    return { domain, score: cell.score, level: cell.level, threads: cell.threads, levelLabel: safeT(lv.key, lv.en) };
  }

  function mastery(domain) {
    const m = loadMastery();
    if (domain) {
      const cell = m[domain] || { score: 0, threads: 0, level: 0, lastTs: null };
      const lv = levelForScore(cell.score);
      return { domain, ...cell, levelLabel: safeT(lv.key, lv.en), levelKey: lv.key };
    }
    const out = {};
    for (const d of DOMAINS) {
      const cell = m[d];
      const lv = levelForScore(cell.score);
      out[d] = { ...cell, domain: d, levelLabel: safeT(lv.key, lv.en), levelKey: lv.key };
    }
    return out;
  }

  // ════════════════════════════════════════════════════════════════════
  // MILESTONES / DISCOVERY — unified unlock system
  // ════════════════════════════════════════════════════════════════════
  // Generalizes verse-map's 10/25/50/100 and "first time you opened X".
  // Counters are derived from the event log mirror; thresholds unlock once.
  const MILESTONE_RULES = [
    // Cross-reference breadth (generalizes verse-map 10/25/50/100)
    { id: "crossref.10",  domain: "cross-references", count: "crossref-follow", n: 10,  labelEn: "10 cross-ref threads" },
    { id: "crossref.25",  domain: "cross-references", count: "crossref-follow", n: 25,  labelEn: "25 cross-ref threads" },
    { id: "crossref.50",  domain: "cross-references", count: "crossref-follow", n: 50,  labelEn: "50 cross-ref threads" },
    { id: "crossref.100", domain: "cross-references", count: "crossref-follow", n: 100, labelEn: "100 cross-ref threads" },
    // Word-study depth
    { id: "wordstudy.10", domain: "hebrew-greek", count: "word-study-complete", n: 10, labelEn: "10 word studies closed" },
    { id: "wordstudy.25", domain: "hebrew-greek", count: "word-study-complete", n: 25, labelEn: "25 word studies closed" },
    // Gematria matches
    { id: "gematria.10",  domain: "gematria", count: "gematria-match", n: 10, labelEn: "10 gematria matches" },
    // Canon coverage
    { id: "canon.50",  domain: "canon-coverage", count: "chapter-closed", n: 50,  labelEn: "50 chapters closed" },
    { id: "canon.150", domain: "canon-coverage", count: "chapter-closed", n: 150, labelEn: "150 chapters closed" },
  ];

  function loadMilestones() { return lsGet(K_MILESTONES, {}) || {}; }
  function saveMilestones(m) { lsSet(K_MILESTONES, m); }

  // Unlock a milestone by id if not already held. Dispatches codex:milestone.
  function unlockMilestone(id, meta) {
    const held = loadMilestones();
    if (held[id]) return null;
    held[id] = isoDay();
    saveMilestones(held);
    const detail = { id, day: held[id], ...(meta || {}) };
    if (detail.labelEn && !detail.label) detail.label = safeT("cx.milestone." + id, detail.labelEn);
    dispatch("codex:milestone", detail);
    return detail;
  }

  // "First time you did X" milestones (per depth-action type).
  function checkFirstTime(type) {
    const id = "first." + type;
    const held = loadMilestones();
    if (held[id]) return;
    const labelEn = "First " + type.replace(/-/g, " ");
    unlockMilestone(id, { kind: "first", type, labelEn });
  }

  // Threshold milestones from running counters.
  function loadCounters() { return lsGet("codex.engagement.counters.v1", {}) || {}; }
  function saveCounters(c) { lsSet("codex.engagement.counters.v1", c); }
  function bumpCounter(type) {
    const c = loadCounters();
    c[type] = (c[type] || 0) + 1;
    saveCounters(c);
    for (const rule of MILESTONE_RULES) {
      if (rule.count === type && c[type] === rule.n) {
        unlockMilestone(rule.id, { kind: "threshold", domain: rule.domain, n: rule.n, labelEn: rule.labelEn });
      }
    }
    return c[type];
  }

  function milestones() {
    return { unlocked: loadMilestones(), counters: loadCounters(), rules: MILESTONE_RULES.slice() };
  }

  // ════════════════════════════════════════════════════════════════════
  // CORE: record(event) — the single ingestion point
  // ════════════════════════════════════════════════════════════════════
  // event = { type, ref?, weight?, domain?, ts? }
  // Returns a summary; never throws.
  function record(event) {
    try {
      if (!event || typeof event !== "object" || !event.type) return null;
      const spec = DEPTH_ACTIONS[event.type] || {};
      const type = event.type;
      const weight = (typeof event.weight === "number" && event.weight > 0) ? event.weight : (spec.weight || 1);
      const domain = event.domain || spec.domain || null;
      const ts = event.ts || now();
      const ref = event.ref != null ? event.ref : null;

      const logEvt = { ts, type, ref, weight, domain };
      appendEvent(logEvt);

      // First-time + threshold milestones
      checkFirstTime(type);
      bumpCounter(type);

      // Mastery: every weighted event nudges its domain; "thread-closing"
      // actions (weight >= 4) count as a closed thread.
      const isThread = weight >= 4;
      let masteryResult = null;
      if (domain) masteryResult = bumpMastery(domain, weight, isThread);

      // Continuity: any qualifying depth event ticks the day.
      const cont = tickContinuity();

      const summary = { recorded: logEvt, continuity: cont, mastery: masteryResult };
      return summary;
    } catch (_) {
      return null;
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // QUESTS runtime
  // ════════════════════════════════════════════════════════════════════
  let _questPackCache = null;

  function _getModuleSync(id) {
    // Best-effort sync lookup if a host has pre-staged modules.
    try {
      if (window.CODEX_MODULE_DATA && window.CODEX_MODULE_DATA[id]) return window.CODEX_MODULE_DATA[id];
    } catch (_) {}
    return null;
  }

  function _loadQuestPack() {
    if (_questPackCache) return Promise.resolve(_questPackCache);
    const staged = _getModuleSync("quests-curated");
    if (staged && staged.quests) { _questPackCache = staged; return Promise.resolve(staged); }
    // Try the module loader (IDB-cached), then plain fetch.
    const viaLoader = (window.CODEX_MODULES && typeof window.CODEX_MODULES.loadModule === "function")
      ? window.CODEX_MODULES.loadModule("quests-curated").catch(function () { return null; })
      : Promise.resolve(null);
    return viaLoader.then(function (mod) {
      if (mod && mod.quests) { _questPackCache = mod; return mod; }
      return fetch("data/modules/quests-curated.json", { credentials: "same-origin" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { if (j && j.quests) { _questPackCache = j; return j; } return { quests: [] }; })
        .catch(function () { return { quests: [] }; });
    });
  }

  function listQuests() {
    return _loadQuestPack().then(function (pack) {
      const states = lsGet(K_QUESTS, {}) || {};
      return (pack.quests || []).map(function (q) {
        const st = states[q.meta.id] || null;
        return {
          id: q.meta.id,
          title: q.meta.title,
          tradition: q.meta.tradition || null,
          domain: q.meta.domain || null,
          steps: (q.steps || []).length,
          ring: q.meta.ring || null,
          status: st ? st.status : "available",
          step: st ? st.step : 0,
        };
      });
    });
  }

  function getQuest(id) {
    return _loadQuestPack().then(function (pack) {
      return (pack.quests || []).find(function (q) { return q.meta.id === id; }) || null;
    });
  }

  function questState(id) {
    const states = lsGet(K_QUESTS, {}) || {};
    return states[id] || { status: "available", step: 0, startedAt: null, updatedAt: null, completedAt: null };
  }
  function _writeQuestState(id, patch) {
    const states = lsGet(K_QUESTS, {}) || {};
    states[id] = { ...questState(id), ...patch, updatedAt: now() };
    lsSet(K_QUESTS, states);
    return states[id];
  }

  function startQuest(id) {
    return getQuest(id).then(function (q) {
      if (!q) return null;
      const st = _writeQuestState(id, { status: "active", step: 0, startedAt: now(), completedAt: null });
      dispatch("codex:quest-step", { questId: id, step: 0, status: "active", domain: q.meta.domain || null });
      return st;
    });
  }

  // Advance the active quest one step. Records a depth event (quest-step,
  // re-tagged to the quest's domain) so it feeds mastery + continuity.
  function advanceQuest(id) {
    return getQuest(id).then(function (q) {
      if (!q) return null;
      const total = (q.steps || []).length;
      const cur = questState(id);
      let step = (cur.step || 0);
      if (cur.status !== "active") {
        // auto-start on first advance
        _writeQuestState(id, { status: "active", startedAt: cur.startedAt || now() });
      }
      // Record the depth action for the step being completed.
      record({ type: "quest-step", ref: id + "#" + step, weight: DEPTH_ACTIONS["quest-step"].weight, domain: q.meta.domain || null });
      step += 1;
      const done = step >= total;
      const st = _writeQuestState(id, {
        status: done ? "complete" : "active",
        step: done ? total : step,
        completedAt: done ? now() : null,
      });
      dispatch("codex:quest-step", { questId: id, step: st.step, status: st.status, domain: q.meta.domain || null });
      if (done) {
        unlockMilestone("quest." + id, { kind: "quest-complete", questId: id, domain: q.meta.domain || null, labelEn: "Quest closed: " + q.meta.title });
      }
      return st;
    });
  }

  // ════════════════════════════════════════════════════════════════════
  // nextThread(ctx) — pure-logic single best next thread. NO AI.
  // ════════════════════════════════════════════════════════════════════
  // ctx (all optional): { ref, book, library:[{ref,gematria?}], parsha, daf,
  //                       crossrefsAvailable:bool }
  // Returns one suggestion: { kind, title, ref?, questId?, reason }.
  // Synchronous best-effort against already-cached data only.
  function nextThread(ctx) {
    ctx = ctx || {};
    try {
      // 1) An unfinished quest is the strongest pull (a thread already opened).
      const states = lsGet(K_QUESTS, {}) || {};
      const active = Object.keys(states).find(function (id) { return states[id].status === "active"; });
      if (active) {
        const pack = _questPackCache;
        const q = pack && pack.quests ? pack.quests.find(function (x) { return x.meta.id === active; }) : null;
        return {
          kind: "quest",
          questId: active,
          title: q ? q.meta.title : active,
          step: states[active].step || 0,
          reason: safeT("cx.nextthread.quest", "Resume an open quest thread"),
        };
      }

      // 2) A gematria match in the user's OWN library (high-signal coincidence).
      if (Array.isArray(ctx.library) && ctx.library.length > 1) {
        const byVal = {};
        for (const item of ctx.library) {
          if (item && typeof item.gematria === "number") {
            (byVal[item.gematria] = byVal[item.gematria] || []).push(item);
          }
        }
        for (const v of Object.keys(byVal)) {
          if (byVal[v].length >= 2) {
            return {
              kind: "gematria",
              value: Number(v),
              refs: byVal[v].slice(0, 4).map(function (i) { return i.ref; }),
              title: safeT("cx.nextthread.gematria", "A gematria match sits in your own library"),
              reason: byVal[v].map(function (i) { return i.ref; }).slice(0, 3).join(" · "),
            };
          }
        }
      }

      // 3) A cross-ref worth chasing from the current verse.
      if (ctx.ref && ctx.crossrefsAvailable) {
        return {
          kind: "crossref",
          ref: ctx.ref,
          title: safeT("cx.nextthread.crossref", "Follow a cross-ref thread from here"),
          reason: ctx.ref,
        };
      }

      // 4) The day's parsha / daf (tradition-agnostic: only if host supplies it).
      if (ctx.daf) {
        return { kind: "daf", ref: ctx.daf, title: safeT("cx.nextthread.daf", "Today's daf"), reason: ctx.daf };
      }
      if (ctx.parsha) {
        return { kind: "parsha", ref: ctx.parsha, title: safeT("cx.nextthread.parsha", "This week's parsha"), reason: ctx.parsha };
      }

      // 5) Suggest starting the most on-ramp quest.
      if (_questPackCache && _questPackCache.quests && _questPackCache.quests.length) {
        const q = _questPackCache.quests[0];
        return { kind: "quest-start", questId: q.meta.id, title: q.meta.title, reason: safeT("cx.nextthread.start", "Open a new thread") };
      }

      return { kind: "none", title: safeT("cx.nextthread.none", "Open any depth surface to begin a thread"), reason: null };
    } catch (_) {
      return { kind: "none", title: safeT("cx.nextthread.none", "Open any depth surface to begin a thread"), reason: null };
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // SEASONS (read-only helpers over seasons.json)
  // ════════════════════════════════════════════════════════════════════
  let _seasonsCache = null;
  function listSeasons() {
    if (_seasonsCache) return Promise.resolve(_seasonsCache.seasons || []);
    const staged = _getModuleSync("seasons");
    if (staged && staged.seasons) { _seasonsCache = staged; return Promise.resolve(staged.seasons); }
    return fetch("data/modules/seasons.json", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { _seasonsCache = j || { seasons: [] }; return _seasonsCache.seasons || []; })
      .catch(function () { return []; });
  }

  // ════════════════════════════════════════════════════════════════════
  // EXPORT / IMPORT / CLEAR  (all engagement state, local-only)
  // ════════════════════════════════════════════════════════════════════
  // The codex.* localStorage keys already ride the app-wide export. This
  // gives a self-contained bundle that ALSO captures the IDB event log.
  function exportState() {
    const base = {
      format: "codex.engagement",
      version: 1,
      exportedAt: new Date().toISOString(),
      continuity: lsGet(K_CONTINUITY, null),
      mastery: lsGet(K_MASTERY, null),
      milestones: lsGet(K_MILESTONES, null),
      counters: loadCounters(),
      quests: lsGet(K_QUESTS, null),
      config: getConfig(),
      eventlog: lsLogAll(),  // capped LS mirror (sync)
    };
    // Best-effort: replace with the full durable IDB log if available.
    return idbAll().then(function (all) {
      if (all && all.length) base.eventlog = all;
      return base;
    }).catch(function () { return base; });
  }

  function importState(bundle) {
    try {
      if (!bundle || bundle.format !== "codex.engagement" || !bundle.version) return false;
      if (bundle.continuity) lsSet(K_CONTINUITY, bundle.continuity);
      if (bundle.mastery)    lsSet(K_MASTERY, bundle.mastery);
      if (bundle.milestones) lsSet(K_MILESTONES, bundle.milestones);
      if (bundle.counters)   saveCounters(bundle.counters);
      if (bundle.quests)     lsSet(K_QUESTS, bundle.quests);
      if (bundle.config)     setConfig(bundle.config);
      if (Array.isArray(bundle.eventlog)) {
        const capped = bundle.eventlog.slice(-LS_LOG_CAP);
        lsSet(K_EVENTLOG, capped);
        // Rehydrate IDB best-effort.
        idbClear().then(function () {
          bundle.eventlog.forEach(function (e) { idbAppend(e).catch(function () {}); });
        }).catch(function () {});
      }
      return true;
    } catch (_) { return false; }
  }

  function clearState() {
    [K_CONTINUITY, K_MASTERY, K_MILESTONES, K_QUESTS, K_EVENTLOG, K_CONFIG,
     "codex.engagement.counters.v1"].forEach(function (k) {
      try { localStorage.removeItem(k); } catch (_) {}
    });
    _questPackCache = null; _seasonsCache = null;
    idbClear().catch(function () {});
    return { ok: true };
  }

  // ════════════════════════════════════════════════════════════════════
  // BUS WIRING — the engine LISTENS so emitters only need to dispatch.
  // ════════════════════════════════════════════════════════════════════
  function onDepthAction(e) {
    const d = (e && e.detail) || {};
    record({ type: d.type, ref: d.ref, weight: d.weight, domain: d.domain, ts: d.ts });
  }
  try {
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("codex:depth-action", onDepthAction);
    }
  } catch (_) {}

  // ── Public API (the FROZEN CONTRACT) ──────────────────────────────────
  const ENGAGEMENT = {
    // version + taxonomy
    VERSION: "2.5.0",
    DOMAINS: DOMAINS.slice(),
    DEPTH_ACTIONS: DEPTH_ACTIONS,
    MASTERY_LEVELS: MASTERY_LEVELS.slice(),
    STORAGE_KEYS: {
      continuity: K_CONTINUITY, mastery: K_MASTERY, milestones: K_MILESTONES,
      quests: K_QUESTS, eventlog: K_EVENTLOG, config: K_CONFIG,
      counters: "codex.engagement.counters.v1",
    },

    // core ingestion
    record: record,                 // record({type,ref?,weight?,domain?,ts?})
    emit: function (type, ref, weight, domain) { // convenience: dispatch the bus event
      dispatch("codex:depth-action", { type, ref, weight, domain });
    },

    // continuity + grace
    continuity: continuity,         // () → status (reconciles gap for display)
    continuityStatus: function () { return continuityStatus(loadContinuity()); },

    // mastery
    mastery: mastery,               // (domain?) → cell | map

    // milestones / discovery
    milestones: milestones,         // () → { unlocked, counters, rules }
    unlockMilestone: unlockMilestone, // (id, meta?) → detail | null

    // next thread (pure logic, no AI)
    nextThread: nextThread,         // (ctx) → suggestion

    // quests
    listQuests: listQuests,         // () → Promise<[{id,title,...}]>
    getQuest: getQuest,             // (id) → Promise<questModule|null>
    startQuest: startQuest,         // (id) → Promise<state>
    advanceQuest: advanceQuest,     // (id) → Promise<state>
    questState: questState,         // (id) → state (sync)

    // seasons
    listSeasons: listSeasons,       // () → Promise<[season]>

    // config
    getConfig: getConfig,
    setConfig: setConfig,

    // event log access (durable)
    eventLog: function () { return idbAll().catch(function () { return lsLogAll(); }); },

    // export / import / clear (local-only)
    export: exportState,            // () → Promise<bundle>
    import: importState,            // (bundle) → bool
    clear: clearState,              // () → { ok }
  };

  // RESERVED hook for AI quest generation (NOT implemented here — contract only).
  // A later AI agent implements window.CODEX_QUESTGEN.generate(theme, opts?).
  if (typeof window !== "undefined" && !window.CODEX_QUESTGEN) {
    window.CODEX_QUESTGEN = {
      // generate(theme:string, opts?:{tradition?,domain?,steps?}) → Promise<questModule>
      generate: null,
      // Adapter the UI/AI uses to register a generated quest into the runtime.
      register: function (questModule) {
        try {
          if (!questModule || !questModule.meta || !questModule.meta.id) return false;
          if (!_questPackCache) _questPackCache = { quests: [] };
          const idx = _questPackCache.quests.findIndex(function (q) { return q.meta.id === questModule.meta.id; });
          if (idx >= 0) _questPackCache.quests[idx] = questModule;
          else _questPackCache.quests.push(questModule);
          return true;
        } catch (_) { return false; }
      },
    };
  }

  if (typeof window !== "undefined") window.CODEX_ENGAGEMENT = ENGAGEMENT;
})();
