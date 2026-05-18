// CODEX — AI-powered UI translation.
//
// When the user picks a language from Settings, this module ensures every
// keyed UI string (and any extra strings registered by plugins) is rendered
// in that language. Behavior:
//
//   1. On lang change, hydrate from localStorage cache (instant).
//   2. If the cache for that lang is incomplete AND an AI key is configured,
//      batch-translate the missing keys via /api/chat, merge into the live
//      i18n table, persist, then dispatch codex:lang so React re-renders.
//   3. If no AI key is configured, show a one-time warning toast.
//   4. Plugins can call window.CODEX_registerStrings({key:english,...}) to
//      register their own strings; the next lang change picks them up.
//
// Cache key: codex.aiUi.v1.<lang> → { [key]: translated }
// Translations are persisted forever — only re-fetched for missing keys.

(function () {
  if (typeof window === "undefined") return;

  const CACHE_PREFIX = "codex.aiUi.v1.";
  const WARN_KEY     = "codex.aiUi.warned.v1";

  const LANG_NAMES = {
    en: "English", es: "Spanish", de: "German", pt: "Portuguese",
    fr: "French", la: "Latin", he: "Hebrew", el: "Greek", hi: "Hindi"
  };

  // Plugins / late code can register extra strings to be translated.
  const _extra = {};                 // { key: englishSource }
  window.CODEX_registerStrings = function (obj) {
    if (!obj || typeof obj !== "object") return;
    let changed = false;
    Object.keys(obj).forEach(k => {
      if (typeof obj[k] === "string" && !_extra[k]) { _extra[k] = obj[k]; changed = true; }
    });
    if (changed && window.CODEX_LANG && window.CODEX_LANG !== "en") {
      // Trigger a translation pass for the newly registered strings.
      translateMissing(window.CODEX_LANG).catch(()=>{});
    }
  };

  function loadCache(lang) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + lang);
      return raw ? (JSON.parse(raw) || {}) : {};
    } catch { return {}; }
  }
  function saveCache(lang, dict) {
    try { localStorage.setItem(CACHE_PREFIX + lang, JSON.stringify(dict)); } catch {}
  }

  function allEnglishStrings() {
    const T = window.CODEX_T || {};
    const en = T.en || {};
    const out = Object.assign({}, en, _extra);
    return out;
  }

  function hasAIKey() {
    try {
      // direct-api.js stores the resolved provider key under codex.api.keys.v1
      const raw = localStorage.getItem("codex.api.keys.v1");
      if (!raw) return false;
      const j = JSON.parse(raw);
      return !!(j && (j.anthropic || j.xai || j.openai || j.google));
    } catch { return false; }
  }

  function toast(msg, kind) {
    try {
      window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg, kind: kind || "warn" } }));
    } catch {}
    // Fallback so the user still sees it if no toast listener
    if (!window.__cxToastListener) {
      console.warn("[codex i18n]", msg);
    }
  }

  // Hydrate the live i18n table from cache (synchronous, instant).
  function hydrate(lang) {
    if (!lang || lang === "en") return;
    const T = window.CODEX_T;
    if (!T) return;
    if (!T[lang]) T[lang] = {};
    const cache = loadCache(lang);
    Object.assign(T[lang], cache);
  }

  // Translate any keys that don't yet have a non-trivial entry in T[lang].
  // Batched to keep prompts under model limits.
  let _inflight = null;
  async function translateMissing(lang) {
    if (!lang || lang === "en") return;
    if (_inflight && _inflight.lang === lang) return _inflight.p;
    const T = window.CODEX_T;
    if (!T) return;
    if (!T[lang]) T[lang] = {};

    const cache = loadCache(lang);
    const en = allEnglishStrings();
    const missing = {};
    Object.keys(en).forEach(k => {
      // Skip if already present in cache OR shipped baseline translation
      // (avoid re-translating curated strings).
      if (cache[k]) return;
      const baseline = T[lang][k];
      if (baseline && baseline !== en[k]) return;
      missing[k] = en[k];
    });
    const keys = Object.keys(missing);
    if (keys.length === 0) return;

    if (!hasAIKey()) {
      // One-time warning per session per language.
      const warned = (function(){ try { return JSON.parse(localStorage.getItem(WARN_KEY) || "{}"); } catch { return {}; } })();
      if (!warned[lang]) {
        warned[lang] = Date.now();
        try { localStorage.setItem(WARN_KEY, JSON.stringify(warned)); } catch {}
        toast(`Add an AI key in Settings to translate the whole app into ${LANG_NAMES[lang] || lang}. Falling back to English where translations are missing.`, "warn");
      }
      return;
    }

    const p = (async () => {
      const BATCH = 60;
      const langName = LANG_NAMES[lang] || lang;
      const merged = Object.assign({}, cache);
      for (let i = 0; i < keys.length; i += BATCH) {
        const slice = keys.slice(i, i + BATCH);
        const payload = {};
        slice.forEach(k => { payload[k] = missing[k]; });
        const sys = `You translate UI strings for a Bible study app from English to ${langName}. Return ONLY valid JSON in the same shape (same keys), with each value replaced by a faithful natural ${langName} translation. Preserve placeholders like {n}, {ref}, punctuation, and casing intent (ALL-CAPS stays ALL-CAPS where shown). Keep translations terse — UI buttons must remain short. Do not add commentary, do not wrap in markdown fences.`;
        const usr  = `Translate this JSON object to ${langName}:\n` + JSON.stringify(payload, null, 2);
        try {
          const r = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system: sys,
              messages: [{ role: "user", content: usr }],
              max_tokens: 3000,
            }),
          });
          const data = await r.json();
          if (!r.ok || data.error) throw new Error(data.error || ("HTTP " + r.status));
          let txt = String(data.text || "").trim()
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/```\s*$/, "");
          const a = txt.indexOf("{");
          const b = txt.lastIndexOf("}");
          if (a < 0 || b < 0) continue;
          let obj;
          try { obj = JSON.parse(txt.slice(a, b + 1)); } catch { continue; }
          Object.keys(obj).forEach(k => {
            if (typeof obj[k] === "string") merged[k] = obj[k];
          });
          // Incremental save + live update so the UI fills in as we go.
          saveCache(lang, merged);
          Object.assign(T[lang], merged);
          window.dispatchEvent(new CustomEvent("codex:lang", { detail: { lang, progress: { done: Math.min(i + BATCH, keys.length), total: keys.length } } }));
        } catch (e) {
          console.warn("[codex i18n] batch failed:", e.message);
          // Don't throw — keep going so partial progress still helps.
        }
      }
      toast(`UI translation to ${langName} complete.`, "ok");
    })();
    _inflight = { lang, p };
    p.finally(() => { if (_inflight && _inflight.lang === lang) _inflight = null; });
    return p;
  }

  // Wrap applyCodexLang so any lang change kicks off hydrate + translate.
  function install() {
    if (!window.applyCodexLang) {
      // i18n.js hasn't loaded yet — try again next tick.
      return setTimeout(install, 30);
    }
    const orig = window.applyCodexLang;
    window.applyCodexLang = function (lang) {
      hydrate(lang);
      orig(lang);
      if (lang && lang !== "en") {
        // Fire-and-forget; UI re-renders as batches complete.
        translateMissing(lang).catch(()=>{});
      }
    };
    // Hydrate the initial lang if non-en was already chosen.
    if (window.CODEX_LANG && window.CODEX_LANG !== "en") {
      hydrate(window.CODEX_LANG);
      // Defer the network pass so we don't block first paint.
      setTimeout(() => translateMissing(window.CODEX_LANG).catch(()=>{}), 1500);
    }
  }
  install();

  // ── DOM walker — catches the long tail of hardcoded English strings
  // that don't flow through t(). We collect visible text nodes, ignore
  // anything inside scripture / code / inputs / data-no-translate trees,
  // cache by text hash per lang, batch them to the AI, then swap.
  const NODE_CACHE_PREFIX = "codex.aiUiNodes.v1."; // per-lang { hash: translated }
  const SKIP_SEL = "script,style,code,pre,textarea,input,.cx-verse-text,.cx-chap,.cx-verse-num,[data-no-translate],.bf-draft,.cx-note-body,.cx-oracle-bubble,.cx-mark-snippet,.cx-search-snippet,.cx-reel-art-verse,.cx-reel-light-text";

  function _hash(s) {
    let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return ("h" + (h >>> 0).toString(36));
  }
  function _isCandidateText(t) {
    if (!t) return false;
    const s = t.trim();
    if (s.length < 2 || s.length > 140) return false;
    // Must contain at least one ascii letter sequence of length 3+
    if (!/[A-Za-z]{3,}/.test(s)) return false;
    // Skip pure numbers, refs (gen.1.1), urls, file-paths
    if (/^[\d.:,\s-]+$/.test(s)) return false;
    if (/^https?:\/\//i.test(s)) return false;
    if (/^[a-z]+\.\d+\.\d+/i.test(s)) return false;
    return true;
  }
  function _shouldSkip(node) {
    let p = node.parentElement;
    while (p) {
      if (p.matches && p.matches(SKIP_SEL)) return true;
      if (p.getAttribute && p.getAttribute("contenteditable") === "true") return true;
      p = p.parentElement;
    }
    return false;
  }

  let _domQueue = new Map();   // hash → { text, nodes:[textNode...] }
  let _domBusy = false;
  let _domTimer = 0;

  function _scheduleFlush() {
    if (_domTimer) clearTimeout(_domTimer);
    _domTimer = setTimeout(_flushDomQueue, 700);
  }
  async function _flushDomQueue() {
    const lang = window.CODEX_LANG;
    if (!lang || lang === "en" || _domBusy) return;
    if (!hasAIKey()) return;
    if (_domQueue.size === 0) return;

    let cache;
    try { cache = JSON.parse(localStorage.getItem(NODE_CACHE_PREFIX + lang) || "{}"); } catch { cache = {}; }

    // Apply anything already cached, collect the rest.
    const todo = [];
    _domQueue.forEach((entry, hash) => {
      if (cache[hash]) {
        entry.nodes.forEach(n => { try { n.nodeValue = cache[hash]; } catch {} });
      } else {
        todo.push({ hash, text: entry.text, nodes: entry.nodes });
      }
    });
    _domQueue = new Map();
    if (todo.length === 0) return;

    _domBusy = true;
    try {
      const BATCH = 40;
      const langName = LANG_NAMES[lang] || lang;
      for (let i = 0; i < todo.length; i += BATCH) {
        const slice = todo.slice(i, i + BATCH);
        const payload = {};
        slice.forEach(item => { payload[item.hash] = item.text; });
        const sys = `You translate visible UI strings from English to ${langName} for a Bible study app. Return ONLY a JSON object using the same keys with each value replaced by a faithful, terse ${langName} translation. Preserve placeholders, casing intent (ALL-CAPS stays ALL-CAPS), punctuation, surrounding whitespace, and emojis. Never add commentary or markdown fences.`;
        const usr = `Translate to ${langName}:\n` + JSON.stringify(payload, null, 2);
        try {
          const r = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ system: sys, messages: [{ role: "user", content: usr }], max_tokens: 2200 }),
          });
          const data = await r.json();
          if (!r.ok || data.error) continue;
          let txt = String(data.text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
          const a = txt.indexOf("{"); const b = txt.lastIndexOf("}");
          if (a < 0 || b < 0) continue;
          let obj; try { obj = JSON.parse(txt.slice(a, b + 1)); } catch { continue; }
          slice.forEach(item => {
            const tr = obj[item.hash];
            if (typeof tr === "string" && tr.trim()) {
              cache[item.hash] = tr;
              item.nodes.forEach(n => { try { n.nodeValue = tr; } catch {} });
            }
          });
          try { localStorage.setItem(NODE_CACHE_PREFIX + lang, JSON.stringify(cache)); } catch {}
        } catch (e) { /* keep going */ }
      }
    } finally {
      _domBusy = false;
    }
  }

  function _collectAndQueue(root) {
    const lang = window.CODEX_LANG;
    if (!lang || lang === "en") return;
    let cache;
    try { cache = JSON.parse(localStorage.getItem(NODE_CACHE_PREFIX + lang) || "{}"); } catch { cache = {}; }
    const enValues = new Set(Object.values(window.CODEX_T && window.CODEX_T.en || {}));
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!_isCandidateText(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        if (_shouldSkip(n)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let n; let touched = false;
    while ((n = walker.nextNode())) {
      const raw = n.nodeValue;
      const trimmed = raw.trim();
      // Skip if string equals current translated text (already swapped)
      // Heuristic: must look like English (no extended Hebrew/Greek/Hindi).
      if (/[֐-׿Ͱ-Ͽऀ-ॿ]/.test(trimmed)) continue;
      const h = _hash(trimmed);
      if (cache[h]) {
        // Apply immediately if not already.
        if (n.nodeValue !== cache[h]) { try { n.nodeValue = cache[h]; touched = true; } catch {} }
        continue;
      }
      const entry = _domQueue.get(h) || { text: trimmed, nodes: [] };
      if (entry.nodes.indexOf(n) === -1) entry.nodes.push(n);
      _domQueue.set(h, entry);
    }
    if (_domQueue.size > 0) _scheduleFlush();
  }

  function _installDomWalker() {
    if (window.__cxDomWalkerInstalled) return;
    window.__cxDomWalkerInstalled = true;
    const sweep = () => {
      if (!document.body) return;
      _collectAndQueue(document.body);
    };
    sweep();
    const mo = new MutationObserver((mutations) => {
      mutations.forEach(m => {
        m.addedNodes && m.addedNodes.forEach(n => {
          if (n.nodeType === 1) _collectAndQueue(n);
          else if (n.nodeType === 3 && _isCandidateText(n.nodeValue) && !_shouldSkip(n)) {
            // single text node added
            const trimmed = n.nodeValue.trim();
            const h = _hash(trimmed);
            const entry = _domQueue.get(h) || { text: trimmed, nodes: [] };
            entry.nodes.push(n);
            _domQueue.set(h, entry);
            _scheduleFlush();
          }
        });
      });
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: false });
    // Re-sweep on lang change.
    window.addEventListener("codex:lang", () => {
      // Clear the in-memory queue; cached translations re-apply on sweep.
      _domQueue = new Map();
      setTimeout(sweep, 100);
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _installDomWalker, { once: true });
  } else {
    _installDomWalker();
  }

  window.CODEX_aiTranslateUI = {
    translateMissing,
    hydrate,
    hasAIKey,
    clearCache: (lang) => {
      try { localStorage.removeItem(CACHE_PREFIX + lang); } catch {}
      try { localStorage.removeItem(NODE_CACHE_PREFIX + lang); } catch {}
    },
    sweepDom: () => { _domQueue = new Map(); _collectAndQueue(document.body); },
  };
})();
