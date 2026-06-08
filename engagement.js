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
