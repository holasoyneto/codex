// CODEX direct-API shim — when running without a Node backend (e.g. on
// GitHub Pages), proxy /api/* fetches straight to the chosen AI provider
// using the user's locally-stored key. Keys never leave the browser
// except to the provider itself.
//
// Two providers are supported:
//   • Anthropic Claude   — api.anthropic.com/v1/messages
//   • xAI Grok           — api.x.ai/v1/chat/completions   (OpenAI-shape)
//
// The active engine is read from localStorage (codex.api.keys.v1, written
// by the settings panel in app.jsx). Switching the engine in settings
// takes effect on the next /api/chat call — no reload needed.
//
// Detection: we probe /api/health on load. If it fails or returns non-JSON
// (e.g. GitHub Pages 404 HTML) we flip into "direct mode" and monkey-patch
// fetch to handle the three /api/* routes the client uses.

(function () {
  const KEYS_LS = "codex.api.keys.v1";   // shared with app.jsx ApiKeysSection
  const LEGACY_KEY_LS = "codex.anthropic.key.v1";  // pre-engine-switch fallback

  const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
  const ANTHROPIC_VERSION = "2023-06-01";
  const ANTHROPIC_DEFAULT_MODEL = "claude-haiku-4-5-20251001";
  const ANTHROPIC_ALLOWED = new Set([
    "claude-haiku-4-5-20251001",
    "claude-sonnet-4-6",
    "claude-opus-4-7",
  ]);

  const XAI_URL = "https://api.x.ai/v1/chat/completions";
  const XAI_DEFAULT_MODEL = "grok-3";
  // Best-effort mapping from Claude model ids to a comparable Grok tier.
  // Model names per xAI as of 2026-Q2; if a model is unavailable on the
  // user's account the call falls through with a clear error.
  const XAI_MODEL_MAP = {
    "claude-haiku-4-5-20251001": "grok-3-mini",
    "claude-sonnet-4-6":         "grok-3",
    "claude-opus-4-7":           "grok-4",
  };

  function loadKeys() {
    let out = { active: "anthropic", anthropic: "", grok: "" };
    try {
      const raw = JSON.parse(localStorage.getItem(KEYS_LS) || "null");
      if (raw && typeof raw === "object") out = { ...out, ...raw };
    } catch {}
    // Fallback to the legacy single-key store if a key was set under the
    // old shim before the engine switcher landed.
    if (!out.anthropic) {
      try { out.anthropic = localStorage.getItem(LEGACY_KEY_LS) || ""; } catch {}
    }
    // Defensive: paste from password managers / mobile keyboards frequently
    // leaves trailing whitespace or a stray newline. Anthropic rejects such
    // keys with "invalid x-api-key" — which is exactly the user-reported bug
    // where the key looked saved but every page load failed until they
    // re-Applied (the apply path happened to trim via handleKey).
    out.anthropic = String(out.anthropic || "").trim();
    out.grok = String(out.grok || "").trim();
    // Auto-correct `active` if it points at a side with no key but the other
    // side has one — e.g. user pasted only an xai- key but never tapped the
    // Grok tab in Settings. Previously activeKey() returned "" and chat 503'd
    // with "no Anthropic key", forcing a manual fix every session.
    if (out.active === "grok" && !out.grok && out.anthropic) out.active = "anthropic";
    if (out.active === "anthropic" && !out.anthropic && out.grok) out.active = "grok";
    // Infer from prefix if active was never set sanely.
    if (out.active !== "grok" && out.active !== "anthropic") {
      out.active = out.grok && !out.anthropic ? "grok" : "anthropic";
    }
    return out;
  }
  function activeEngine() { return loadKeys().active === "grok" ? "grok" : "anthropic"; }
  function activeKey() {
    const k = loadKeys();
    return k.active === "grok" ? (k.grok || "") : (k.anthropic || "");
  }
  function hasAnyKey() {
    const k = loadKeys();
    return !!(k.anthropic || k.grok);
  }

  function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  async function handleHealth() {
    return jsonResponse({
      ok: true,
      hasKey: !!activeKey(),
      engine: activeEngine(),
      model: activeEngine() === "grok" ? XAI_DEFAULT_MODEL : ANTHROPIC_DEFAULT_MODEL,
      mode: "direct",
      usage: { input: 0, output: 0, cache_read: 0, cache_create: 0, calls: 0 },
    });
  }

  // /api/key still exists for backwards-compat with oracle.jsx's inline
  // key prompt. We always store it as the *Anthropic* key (the inline
  // prompt only accepts sk- keys). Engine-aware key entry happens in
  // the settings panel via direct localStorage writes.
  async function handleKey(init) {
    try {
      const body = JSON.parse(init.body || "{}");
      const key = (body.key || "").trim();
      // Infer provider from key prefix (matches server.js behavior) so the
      // inline "set key" UI can accept either Anthropic or Grok keys.
      let provider = body.provider;
      if (!provider) {
        if (key.startsWith("xai-")) provider = "grok";
        else if (key.startsWith("sk-")) provider = "anthropic";
      }
      if (!key || (provider !== "anthropic" && provider !== "grok")) {
        return jsonResponse({ error: "Invalid key — expected Anthropic (sk-…) or xAI (xai-…) key" }, 400);
      }
      const cur = loadKeys();
      const next = { ...cur };
      if (provider === "grok") { next.grok = key; next.active = "grok"; }
      else { next.anthropic = key; next.active = "anthropic"; try { localStorage.setItem(LEGACY_KEY_LS, key); } catch {} }
      try { localStorage.setItem(KEYS_LS, JSON.stringify(next)); } catch {}
      return jsonResponse({ ok: true, hasKey: true, engine: provider });
    } catch (e) {
      return jsonResponse({ error: String(e.message || e) }, 500);
    }
  }

  // Flatten Anthropic system blocks (which may be string, or array of
  // {type:"text", text, cache_control}) down to a single string for Grok.
  function flattenSystem(sys) {
    if (!sys) return "";
    if (typeof sys === "string") return sys;
    if (Array.isArray(sys)) {
      return sys.map(s => (typeof s === "string" ? s : (s && s.text) || "")).join("\n\n").trim();
    }
    if (typeof sys === "object" && sys.text) return sys.text;
    return "";
  }
  // Flatten an Anthropic message content (string OR array of text blocks).
  function flattenContent(c) {
    if (typeof c === "string") return c;
    if (Array.isArray(c)) return c.map(x => (typeof x === "string" ? x : (x && x.text) || "")).join("\n");
    if (c && typeof c === "object" && c.text) return c.text;
    return "";
  }

  async function callAnthropic(payload, key) {
    const model = ANTHROPIC_ALLOWED.has(payload.model) ? payload.model : ANTHROPIC_DEFAULT_MODEL;
    const reqBody = {
      model,
      max_tokens: payload.max_tokens || 1024,
      messages: payload.messages || [],
    };
    if (payload.system) reqBody.system = payload.system;

    const resp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": ANTHROPIC_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(reqBody),
    });
    let data;
    try { data = await resp.json(); }
    catch { return { status: 502, body: { error: "Anthropic returned non-JSON" } }; }
    if (!resp.ok) {
      const msg = (data && data.error && data.error.message) || data.error || `HTTP ${resp.status}`;
      return { status: resp.status, body: { error: typeof msg === "string" ? msg : JSON.stringify(msg) } };
    }
    const text = ((data.content || []).filter(c => c.type === "text").map(c => c.text).join(""));
    return { status: 200, body: { text, model: data.model, usage: data.usage || {}, engine: "anthropic" } };
  }

  async function callGrok(payload, key) {
    const model = XAI_MODEL_MAP[payload.model] || (payload.model && payload.model.startsWith("grok") ? payload.model : XAI_DEFAULT_MODEL);
    const sys = flattenSystem(payload.system);
    const messages = [];
    if (sys) messages.push({ role: "system", content: sys });
    for (const m of (payload.messages || [])) {
      messages.push({ role: m.role, content: flattenContent(m.content) });
    }
    const reqBody = {
      model,
      max_tokens: payload.max_tokens || 1024,
      messages,
      stream: false,
    };
    const resp = await fetch(XAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + key,
      },
      body: JSON.stringify(reqBody),
    });
    let data;
    try { data = await resp.json(); }
    catch { return { status: 502, body: { error: "xAI returned non-JSON" } }; }
    if (!resp.ok) {
      const msg = (data && data.error && (data.error.message || data.error)) || `HTTP ${resp.status}`;
      return { status: resp.status, body: { error: typeof msg === "string" ? msg : JSON.stringify(msg) } };
    }
    const text = (((data.choices || [])[0] || {}).message || {}).content || "";
    const u = data.usage || {};
    return {
      status: 200,
      body: {
        text,
        model: data.model,
        usage: {
          input_tokens: u.prompt_tokens || 0,
          output_tokens: u.completion_tokens || 0,
        },
        engine: "grok",
      },
    };
  }

  async function handleChat(init) {
    const engine = activeEngine();
    const key = activeKey();
    if (!key) {
      return jsonResponse({
        error: `No ${engine === "grok" ? "Grok" : "Anthropic"} API key set. Open Settings → API keys and Apply your key.`
      }, 503);
    }
    let payload;
    try { payload = JSON.parse(init.body || "{}"); }
    catch (e) { return jsonResponse({ error: "Bad JSON in request body" }, 400); }

    let result;
    try {
      result = engine === "grok"
        ? await callGrok(payload, key)
        : await callAnthropic(payload, key);
    } catch (e) {
      return jsonResponse({ error: "Network error: " + String(e.message || e) }, 500);
    }
    // Self-healing: if the provider rejected the key but we still have a
    // valid-looking one in storage, re-assert a sanitized copy and retry
    // exactly once. Covers the "I saved my key but every load fails until
    // I open Settings and click Apply" regression class.
    if (result.status === 401 || result.status === 403) {
      try {
        const raw = JSON.parse(localStorage.getItem(KEYS_LS) || "null") || {};
        const sanitized = {
          active: raw.active === "grok" ? "grok" : "anthropic",
          anthropic: String(raw.anthropic || "").trim(),
          grok: String(raw.grok || "").trim(),
        };
        // If `active` points at an empty side but the other has a key, flip.
        if (sanitized.active === "anthropic" && !sanitized.anthropic && sanitized.grok) sanitized.active = "grok";
        if (sanitized.active === "grok" && !sanitized.grok && sanitized.anthropic) sanitized.active = "anthropic";
        const changed = JSON.stringify(sanitized) !== JSON.stringify({ active: raw.active, anthropic: raw.anthropic, grok: raw.grok });
        const fresh = sanitized.active === "grok" ? sanitized.grok : sanitized.anthropic;
        if (changed && fresh && fresh !== key) {
          try { localStorage.setItem(KEYS_LS, JSON.stringify(sanitized)); } catch {}
          try { window.dispatchEvent(new CustomEvent("codex:engine-change", { detail: { engine: sanitized.active } })); } catch {}
          const retry = sanitized.active === "grok"
            ? await callGrok(payload, fresh)
            : await callAnthropic(payload, fresh);
          return jsonResponse(retry.body, retry.status);
        }
      } catch {}
    }
    return jsonResponse(result.body, result.status);
  }

  // Capture the unwrapped fetch BEFORE we install the shim so probeMode
  // can talk straight to the real Node server without re-entering its
  // own wrapper (which previously caused recursive shim activation and
  // wedged the page into direct mode against a working backend).
  const originalFetch = window.fetch.bind(window);

  // Decide whether we're in direct mode. We're conservative: only flip on
  // when the health probe clearly fails or returns non-JSON. On localhost
  // with the Node server, we leave fetch alone.
  let DIRECT_MODE = null;
  async function probeMode() {
    try {
      const r = await originalFetch("/api/health", { method: "GET" });
      if (!r.ok) return true;
      const ct = r.headers.get("content-type") || "";
      if (!ct.includes("application/json")) return true;
      const d = await r.json();
      // Direct mode ONLY if the server explicitly says so; otherwise stand
      // down. Previously checked d.mode === "direct" — but a real server
      // never includes that field, so the probe was correctly returning
      // false; the actual recursion bug above was the trigger.
      return !d || d.mode === "direct";
    } catch {
      return true;
    }
  }

  window.fetch = async function (input, init) {
    let url = "";
    if (typeof input === "string") url = input;
    else if (input && input.url) url = input.url;

    const isApi = url.startsWith("/api/") || url.includes(location.host + "/api/");
    if (!isApi) return originalFetch(input, init);

    if (DIRECT_MODE === null) DIRECT_MODE = await probeMode();
    if (!DIRECT_MODE) return originalFetch(input, init);

    const path = url.replace(/^https?:\/\/[^/]+/, "");
    const opts = init || (input && typeof input === "object" ? input : {});

    if (path === "/api/health") return handleHealth();
    if (path === "/api/key" && (opts.method || "").toUpperCase() === "POST") return handleKey(opts);
    if (path === "/api/chat" && (opts.method || "").toUpperCase() === "POST") return handleChat(opts);

    return jsonResponse({ error: "Endpoint not available in direct mode: " + path }, 404);
  };

  // Expose for debugging + so the settings panel can broadcast engine
  // changes (Oracle re-probes hasKey when this fires).
  window.CODEX_DIRECT = {
    loadKeys, activeEngine, activeKey, hasAnyKey, probeMode,
    notifyEngineChange() {
      try { window.dispatchEvent(new CustomEvent("codex:engine-change", { detail: { engine: activeEngine() } })); } catch {}
    },
  };
})();
