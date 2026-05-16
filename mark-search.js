// CODEX — semantic mark search
// ─────────────────────────────────────────────────────────────────────────
// A small async ranker that asks the Oracle to score the user's saved
// marks against a free-text query. Used when literal substring search
// returns too few hits — typing "love" should also surface 1 Cor 13,
// John 3:16, and Romans 8:38 even when none of them have "love" in
// the ref string.
//
// Cache: localStorage["codex.marksearch.v1"] keyed by a signature of
// the query + the set of mark keys, so repeated queries are instant
// and don't burn API tokens. Capped at 50 entries (LRU-ish).
//
// Contract:
//   await window.MarkSearch.rank(query, marks, context)
//     → Promise<[{ key, reason }]>   ordered most→least relevant
//
// Marks shape (from app.jsx):
//   { key, ref, color, note?, text?, ts, pinned? }

(function () {
  const CACHE_KEY = "codex.marksearch.v1";
  const CACHE_MAX = 50;

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") || {}; }
    catch { return {}; }
  }
  function writeCache(cache) {
    const keys = Object.keys(cache);
    if (keys.length > CACHE_MAX) {
      // Drop oldest by ts. Entries without ts treated as oldest.
      const sorted = keys
        .map(k => [k, cache[k]?.ts || 0])
        .sort((a, b) => a[1] - b[1]);
      const drop = sorted.slice(0, sorted.length - CACHE_MAX);
      for (const [k] of drop) delete cache[k];
    }
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* quota */ }
  }
  function clearCache() {
    try { localStorage.removeItem(CACHE_KEY); } catch {}
  }

  function sigFor(query, marks) {
    const norm = (query || "").trim().toLowerCase();
    // Mark fingerprint = sorted keys + total count. Cheap enough.
    const keys = marks.map(m => m.key).sort().join(",");
    return `${norm}||${marks.length}||${keys}`;
  }

  function previewMark(m, i) {
    const ref  = m.ref || "?";
    const col  = m.color || "?";
    const note = m.note ? ` · note:"${String(m.note).slice(0, 90)}"` : "";
    const text = m.text ? ` · text:"${String(m.text).slice(0, 110)}"` : "";
    return `${i + 1}. [${m.key}] ${ref} · ${col}${note}${text}`;
  }

  async function rank(query, marks, context) {
    const q = (query || "").trim();
    if (!q || !Array.isArray(marks) || marks.length === 0) return [];

    const sig = sigFor(q, marks);
    const cache = readCache();
    const hit = cache[sig];
    if (hit && Array.isArray(hit.results)) {
      // Refresh ts so it survives LRU eviction.
      cache[sig] = { ...hit, ts: Date.now() };
      writeCache(cache);
      return hit.results;
    }

    const list = marks.map(previewMark).join("\n");
    const system = [
      "You are CODEX · mark-search ranker.",
      "Given a user query and their saved scripture marks, return an ordered JSON array",
      "of the most semantically relevant marks. Match on biblical themes, motifs,",
      "characters, doctrines, emotional resonance — NOT just literal substrings.",
      "If the query echoes a passage you can identify, prioritise marks on or near it.",
      "If the user's current passage is provided, give a small tie-breaker boost to",
      "marks that cross-resonate with where they're reading.",
      "Return AT MOST 12 results. If nothing meaningfully matches, return [].",
      "Output ONLY the JSON array, no preface, no fences. Schema:",
      `[{"key":"<mark-key>","reason":"<≤14-word reason>"}]`,
    ].join("\n");

    const user = [
      `Query: "${q}"`,
      context ? `Current passage: ${context}` : "Current passage: (none)",
      "",
      `Marks (${marks.length}):`,
      list,
      "",
      "Return ranked JSON.",
    ].join("\n");

    let results = [];
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system,
          messages: [{ role: "user", content: user }],
          max_tokens: 600,
        }),
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const data = await r.json();
      const txt = String(data.text || "").trim();
      // Tolerate accidental code fences / leading prose.
      const m = txt.match(/\[[\s\S]*\]/);
      if (!m) return [];
      const parsed = JSON.parse(m[0]);
      if (!Array.isArray(parsed)) return [];
      const validKeys = new Set(marks.map(x => x.key));
      results = parsed
        .filter(x => x && typeof x.key === "string" && validKeys.has(x.key))
        .slice(0, 12)
        .map(x => ({ key: x.key, reason: String(x.reason || "").slice(0, 140) }));
    } catch (e) {
      console.warn("MarkSearch.rank failed:", e);
      return [];
    }

    cache[sig] = { ts: Date.now(), results };
    writeCache(cache);
    return results;
  }

  window.MarkSearch = { rank, clearCache };
})();
