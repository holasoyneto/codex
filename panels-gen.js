// CODEX — passage-aware panel generator.
// For any passage that doesn't have a hand-crafted seed, this asks Claude
// to draft Talmudic parallels, Christian commentary, Gematria values, and
// Gnostic readings, returning a strict-JSON object that the right-rail
// panels render. Results are cached in localStorage by passage key so
// regenerating each visit is unnecessary.
//
// Exposes:
//   window.CODEX_PANELS.cacheKey(bookId, chapter)
//   window.CODEX_PANELS.load(bookId, chapter, bookName) -> Promise<panelData>
//   window.CODEX_PANELS.subscribe(fn) / unsubscribe
//   window.CODEX_PANELS.getCached(bookId, chapter)
//   window.CODEX_PANELS.purge(bookId, chapter)

(function () {
  const CACHE_PREFIX = "codex.panels.v1.";
  const inflight = new Map();
  const listeners = new Set();

  // Cache key includes the active UI language so panels generated in
  // Spanish never collide with the English ones — switching language and
  // re-opening a chapter re-fetches in the new language.
  function cacheKey(bookId, chapter) {
    const lang = (window.CODEX_LANG || "en");
    const suffix = lang === "en" ? "" : `.${lang}`;
    return `${CACHE_PREFIX}${bookId}.${chapter}${suffix}`;
  }

  // Cache format v2: { _v: 2, data, fetchedAt }. Old format (bare object)
  // is auto-migrated on read so existing caches keep working.
  function getCached(bookId, chapter) {
    try {
      const raw = localStorage.getItem(cacheKey(bookId, chapter));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed._v === 2 && parsed.data) return parsed.data;
      return parsed;       // legacy bare object
    } catch {}
    return null;
  }

  // Returns { fetchedAt: ms } for cached entries, or null if not cached.
  // Used by the UI to show "CACHED · 5d ago" badges so users can SEE that
  // re-visiting a chapter never re-hits the API.
  function getCachedMeta(bookId, chapter) {
    try {
      const raw = localStorage.getItem(cacheKey(bookId, chapter));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed._v === 2) return { fetchedAt: parsed.fetchedAt || 0 };
      return { fetchedAt: 0 };  // legacy entry — unknown date
    } catch {}
    return null;
  }

  function putCached(bookId, chapter, data) {
    try {
      const wrapped = { _v: 2, data, fetchedAt: Date.now() };
      localStorage.setItem(cacheKey(bookId, chapter), JSON.stringify(wrapped));
    } catch {}
  }

  // Quick stats for the settings cache panel
  function cacheStats() {
    const out = [];
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(CACHE_PREFIX)) continue;
      try {
        const raw = localStorage.getItem(k);
        const obj = JSON.parse(raw);
        const fetchedAt = obj?._v === 2 ? (obj.fetchedAt || 0) : 0;
        const ref = k.slice(CACHE_PREFIX.length);   // "jhn.1"
        out.push({ ref, bytes: raw.length, fetchedAt });
      } catch {}
    }
    return out.sort((a, b) => b.fetchedAt - a.fetchedAt);
  }

  function purge(bookId, chapter) {
    try { localStorage.removeItem(cacheKey(bookId, chapter)); } catch {}
  }

  function notify(event) { listeners.forEach(fn => { try { fn(event); } catch {} }); }
  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  const PROMPT_SYSTEM = `You are the CODEX PANEL DRAFTER. Output a single JSON object describing companion study material for a Bible passage. Scholarly, multi-tradition, never proselytising.

OUTPUT FORMAT — RETURN ONLY a single JSON object, no prose, no fences. Be COMPACT. Schema:

{
  "title": "4-6 words, may use Greek/Hebrew",
  "subtitle": "one short clause naming the passage's main theme",
  "talmud": [   // 3 entries
    { "ref":"e.g. b. Berakhot 7a / Genesis Rabbah 1:1", "heading":"short heading",
      "body":"40-70 words of scholarly Talmudic/midrashic parallel",
      "tag":"short Hebrew/Aramaic + transliteration in 'quotes'" }
  ],
  "commentary": [  // exactly 4 — one each of from: Patristic, Reformation, Modern, Devotional
    { "from":"Patristic|Reformation|Modern|Devotional",
      "author":"specific commentator + work",
      "body":"40-60 words" }
  ],
  "gematria": [   // 6 entries
    { "term":"word in native script", "translit":"...",
      "meaning":"2-4 word gloss", "value":<int>,
      "system":"Mispar Hechrachi|Greek isopsephy" }
  ],
  "gematriaNotes": [   // 2 short resonance notes (1 sentence each)
    "..."
  ],
  "gematriaDeep": {   // OPTIONAL but PREFERRED — intelligent cross-referencing
    "_schema": 2,
    "primary_word": "the most significant Hebrew/Greek word in the passage to focus on",
    "primary_translit": "english transliteration",
    "primary_gloss": "short english gloss",
    "primary_lang": "hebrew|greek|english",
    "symbolic_meaning": "1-2 sentences on what these numbers traditionally mean in Jewish/Christian numerology (e.g. 358=Mashiach, 7=completeness, 40=trial)",
    "cross_matches": [   // 2-6 entries — verses that share the SAME numerical value
      { "value": <int>, "via_system": "hechrachi|isopsephy|sidduri",
        "matches": [
          { "ref": "gen.49.10", "word": "Shiloh", "note": "messianic prophecy — same value as Mashiach" }
        ]
      }
    ],
    "notarikon": [   // 0-3 entries — acronym readings of the word/phrase
      { "phrase": "...", "expansion": "letter-by-letter expansion" }
    ],
    "temurah": [   // 0-3 entries — letter-substitution ciphers (Atbash, Albam, etc.)
      { "transform": "Atbash|Albam|...", "result": "transformed text", "note": "why this matters" }
    ],
    "rabbinic_sources": [   // 0-3 entries — actual citations from rabbinic tradition
      { "name": "Baal HaTurim|Zohar|Bahir|Sefer Yetzirah|...", "quote": "brief relevant teaching" }
    ],
    "ai_insight": "1-paragraph synthesis of what's interesting about this verse's numerology and how it cross-references other scripture"
  },
  "gnosis": [   // 3 entries
    { "sigil":"single unicode glyph", "title":"esoteric reading title",
      "body":"40-70 words, gnostic/hermetic/kabbalistic/perennialist lens" }
  ],
  "crossRefs": [   // 4 entries
    { "ref":"Book ch:vv", "note":"under 10 words" }
  ]
}

Rules:
- Use accurate citations when known; otherwise pick plausible tractates for the topic.
- Calm scholarly tone. No exclamations. No emoji (sigils OK).
- Real gematria values (אהבה=13, λόγος=373, etc.).
- For gematriaDeep: pick ONE primary Hebrew/Greek word from the passage. Compute its standard value (Mispar Hechrachi for Hebrew, isopsephy for Greek) and provide 2-4 cross_matches — other scripture words with the SAME value (e.g. נחש=358 and משיח=358 — serpent and messiah both equal 358). Cite real, well-documented gematria correspondences from your training. Include rabbinic_sources when you know them (Baal HaTurim is a classic source for parashah-level gematria).
- Return ONLY the JSON. No commentary outside it. Stay compact so the response completes.`;

  // Tolerant JSON extraction: handles truncated arrays/objects by rewinding to
  // the last safe boundary (after a closed value or comma at any depth) and
  // closing any still-open brackets.
  function smartRepair(s) {
    let inString = false, escape = false;
    const stk = [];                  // stack of expected close chars
    let lastSafe = 0;                // index in s up to which truncation+close yields valid JSON
    let safeStack = [];              // stack snapshot at lastSafe
    const mark = (idx) => { lastSafe = idx; safeStack = stk.slice(); };
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (escape) { escape = false; continue; }
      if (inString) {
        if (c === "\\") { escape = true; continue; }
        if (c === "\"") { inString = false; mark(i + 1); }
        continue;
      }
      if (c === "\"") { inString = true; continue; }
      if (c === "{") stk.push("}");
      else if (c === "[") stk.push("]");
      else if (c === "}" || c === "]") { stk.pop(); mark(i + 1); }
      else if (c === ",") mark(i); // cut BEFORE the comma; trailing comma stripped below
      else if (/[\d.eE+-]/.test(c)) mark(i + 1); // numeric literal char
      else if (/[a-zA-Z]/.test(c)) mark(i + 1); // true/false/null literal char
    }
    let head = s.slice(0, lastSafe).replace(/[,\s]+$/, "");
    // Strip a trailing "key": with no value
    head = head.replace(/,?\s*"[^"]*"\s*:\s*$/, "");
    return head + safeStack.reverse().join("");
  }

  function extractJSON(text) {
    if (!text) throw new Error("empty response");
    let s = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const i = s.indexOf("{");
    const j = s.lastIndexOf("}");
    if (i === -1) throw new Error("no json object found");
    // Prefer the slice ending at the last closing brace if balanced; otherwise repair.
    let candidate = j > i ? s.slice(i, j + 1) : s.slice(i);
    try { return JSON.parse(candidate); } catch (_) {}
    // Try repairing the full tail (more bytes = more recoverable content)
    try { return JSON.parse(smartRepair(s.slice(i))); } catch (e) {
      // Last-ditch: maybe the response stops mid-array but ended with a valid close brace earlier.
      try { return JSON.parse(smartRepair(candidate)); } catch (e2) {
        throw new Error("could not repair JSON: " + e2.message);
      }
    }
  }

  function validate(obj) {
    if (!obj || typeof obj !== "object") throw new Error("not an object");
    // Coerce missing fields to empty arrays / strings so partial responses still render.
    obj.title = obj.title || "";
    obj.subtitle = obj.subtitle || "";
    obj.talmud = Array.isArray(obj.talmud) ? obj.talmud.slice(0, 6) : [];
    obj.commentary = Array.isArray(obj.commentary) ? obj.commentary.slice(0, 6) : [];
    obj.gematria = Array.isArray(obj.gematria) ? obj.gematria.slice(0, 10) : [];
    obj.gematriaNotes = Array.isArray(obj.gematriaNotes) ? obj.gematriaNotes.slice(0, 4) : [];
    // Schema 2: deep gematria intelligence (optional, additive).
    if (obj.gematriaDeep && typeof obj.gematriaDeep === "object") {
      const d = obj.gematriaDeep;
      d._schema = 2;
      d.primary_word    = d.primary_word || "";
      d.primary_translit = d.primary_translit || "";
      d.primary_gloss   = d.primary_gloss || "";
      d.primary_lang    = d.primary_lang || "hebrew";
      d.symbolic_meaning = d.symbolic_meaning || "";
      d.ai_insight      = d.ai_insight || "";
      d.cross_matches   = Array.isArray(d.cross_matches) ? d.cross_matches.slice(0, 8) : [];
      d.cross_matches.forEach(cm => {
        cm.matches = Array.isArray(cm.matches) ? cm.matches.slice(0, 6) : [];
      });
      d.notarikon       = Array.isArray(d.notarikon) ? d.notarikon.slice(0, 4) : [];
      d.temurah         = Array.isArray(d.temurah) ? d.temurah.slice(0, 4) : [];
      d.rabbinic_sources = Array.isArray(d.rabbinic_sources) ? d.rabbinic_sources.slice(0, 4) : [];
    }
    obj.gnosis = Array.isArray(obj.gnosis) ? obj.gnosis.slice(0, 6) : [];
    obj.crossRefs = Array.isArray(obj.crossRefs) ? obj.crossRefs.slice(0, 8) : [];
    // Drop entries that are clearly malformed (missing key string fields).
    obj.talmud = obj.talmud.filter(t => t && (t.body || t.heading));
    obj.commentary = obj.commentary.filter(c => c && c.body);
    obj.gematria = obj.gematria.filter(g => g && g.term && typeof g.value === "number");
    obj.gnosis = obj.gnosis.filter(g => g && g.body);
    obj.crossRefs = obj.crossRefs.filter(x => x && x.ref);
    return obj;
  }

  async function load(bookId, chapter, bookName, opts = {}) {
    const key = cacheKey(bookId, chapter);
    const cached = !opts.force && getCached(bookId, chapter);
    if (cached) return cached;
    if (inflight.has(key)) return inflight.get(key);

    notify({ type: "start", bookId, chapter });

    const langName = (window.codexLangName && window.codexLangName()) || "English";
    const langDirective = langName === "English"
      ? ""
      : `\n\nLANGUAGE: All HUMAN-READABLE STRING VALUES in the JSON (heading, body, subtitle, title, meaning, ref labels, gematriaNotes, gnosis bodies, etc.) MUST be written in ${langName}. EXCEPT: keep "from" enum values (Patristic|Reformation|Modern|Devotional) and "system" labels in English; keep native-script terms (Hebrew/Greek/Aramaic) and their transliterations as-is. Cross-reference book names should use the ${langName} convention.`;

    const userMsg = `Draft the CODEX panels for: ${bookName} ${chapter}.
Return ONLY the JSON object as specified in the system instructions.${langDirective}`;

    const p = (async () => {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // No cache_control here — panels are localStorage-cached forever
          // per chapter, so a panel call almost never repeats with the same
          // system within the 5-min cache window. Caching would only add
          // padding overhead to a one-shot call.
          system: PROMPT_SYSTEM + langDirective,
          messages: [{ role: "user", content: userMsg }],
          max_tokens: 4500,
          // Multi-provider routing — server validates against its whitelist
          // and falls back to a sane default if these are missing/invalid.
          provider: opts.provider,
          model: opts.model,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `panels HTTP ${r.status}`);
      const parsed = validate(extractJSON(data.text || ""));
      // Tag with engine used so a regenerate respects the current selector
      // and future cache-busting can compare engines.
      parsed._provider = data.provider || opts.provider || "anthropic";
      parsed._model = data.model || opts.model || null;
      putCached(bookId, chapter, parsed);
      return parsed;
    })()
      .then(data => { notify({ type: "done", bookId, chapter, data }); return data; })
      .catch(err => { notify({ type: "error", bookId, chapter, error: err }); throw err; })
      .finally(() => { inflight.delete(key); });

    inflight.set(key, p);
    return p;
  }

  window.CODEX_PANELS = { cacheKey, getCached, getCachedMeta, putCached, purge, load, subscribe, cacheStats };
})();
