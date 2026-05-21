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
  const BTC_TOKEN_LS = "codex.btc.token.v1";       // donation-pool bearer token

  function btcToken() {
    try { return (localStorage.getItem(BTC_TOKEN_LS) || "").trim(); } catch { return ""; }
  }

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

  // Groq (groq.com — NOT xAI's Grok). OpenAI-compatible. Free tier.
  const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
  const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";
  const GROQ_MODEL_MAP = {
    "claude-haiku-4-5-20251001": "llama-3.1-8b-instant",
    "claude-sonnet-4-6":         "llama-3.3-70b-versatile",
    "claude-opus-4-7":           "deepseek-r1-distill-llama-70b",
    "grok-3-mini":               "llama-3.1-8b-instant",
    "grok-3":                    "llama-3.3-70b-versatile",
    "grok-4":                    "deepseek-r1-distill-llama-70b",
  };
  const GROQ_ALLOWED = new Set([
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
    "deepseek-r1-distill-llama-70b",
    "qwen-2.5-32b",
  ]);

  // Google Gemini — native generateContent (NOT OpenAI-shape). API key
  // travels as a URL query param (?key=…), NOT a Bearer header. Roles
  // differ from Anthropic: "assistant" must be translated to "model"
  // in BOTH directions when shuttling messages back and forth.
  const GEMINI_URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
  const GEMINI_DEFAULT_MODEL = "gemini-2.0-flash";
  const GEMINI_MODEL_MAP = {
    "claude-haiku-4-5-20251001": "gemini-2.0-flash",
    "claude-sonnet-4-6":         "gemini-2.5-flash",
    "claude-opus-4-7":           "gemini-2.5-pro",
    "grok-3-mini":               "gemini-2.0-flash",
    "grok-3":                    "gemini-2.5-flash",
    "grok-4":                    "gemini-2.5-pro",
  };
  const GEMINI_ALLOWED = new Set([
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash-thinking-exp",
  ]);

  // Ollama — local daemon. URL is user-configurable from Settings.
  const OLLAMA_URL_KEY   = "codex.ollama.url.v1";
  const OLLAMA_MODEL_KEY = "codex.ollama.model.v1";
  const OLLAMA_DEFAULT_URL = "http://localhost:11434";
  function loadOllamaConfig() {
    let url = OLLAMA_DEFAULT_URL, model = "";
    try { url = (localStorage.getItem(OLLAMA_URL_KEY) || OLLAMA_DEFAULT_URL).replace(/\/+$/, ""); } catch {}
    try { model = localStorage.getItem(OLLAMA_MODEL_KEY) || ""; } catch {}
    return { url, model };
  }

  const VALID_ENGINES = new Set(["anthropic", "grok", "groq", "gemini", "ollama"]);
  function loadKeys() {
    let out = { active: "anthropic", anthropic: "", grok: "", groq: "", gemini: "" };
    try {
      const raw = JSON.parse(localStorage.getItem(KEYS_LS) || "null");
      if (raw && typeof raw === "object") out = { ...out, ...raw };
    } catch {}
    if (!out.anthropic) {
      try { out.anthropic = localStorage.getItem(LEGACY_KEY_LS) || ""; } catch {}
    }
    out.anthropic = String(out.anthropic || "").trim();
    out.grok = String(out.grok || "").trim();
    out.groq = String(out.groq || "").trim();
    out.gemini = String(out.gemini || "").trim();
    // Auto-correct active when it points at an empty side.
    const hasFor = (a) => a === "ollama" ? true /* keyless */
      : a === "groq" ? !!out.groq
      : a === "grok" ? !!out.grok
      : a === "gemini" ? !!out.gemini
      : !!out.anthropic;
    if (!VALID_ENGINES.has(out.active) || (out.active !== "ollama" && !hasFor(out.active))) {
      // Prefer the first engine the user actually has set up. Gemini keys
      // don't have a single fixed prefix (usually AIza but not always), so
      // we don't try to infer from prefix — the user picks the tab manually.
      if (out.groq && out.groq.startsWith("gsk_")) out.active = "groq";
      else if (out.grok) out.active = "grok";
      else if (out.gemini) out.active = "gemini";
      else if (out.anthropic) out.active = "anthropic";
      // Else leave whatever was there; UI can flip to ollama explicitly.
    }
    return out;
  }
  function activeEngine() {
    const a = loadKeys().active;
    return VALID_ENGINES.has(a) ? a : "anthropic";
  }
  function activeKey() {
    const k = loadKeys();
    if (k.active === "grok")   return k.grok || "";
    if (k.active === "groq")   return k.groq || "";
    if (k.active === "gemini") return k.gemini || "";
    if (k.active === "ollama") return ""; // keyless
    return k.anthropic || "";
  }
  function hasAnyKey() {
    const k = loadKeys();
    return !!(k.anthropic || k.grok || k.groq || k.gemini);
  }

  function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  async function handleHealth() {
    const eng = activeEngine();
    const k = loadKeys();
    const oll = loadOllamaConfig();
    const defaultModel = eng === "grok" ? XAI_DEFAULT_MODEL
      : eng === "groq" ? GROQ_DEFAULT_MODEL
      : eng === "gemini" ? GEMINI_DEFAULT_MODEL
      : eng === "ollama" ? (oll.model || "")
      : ANTHROPIC_DEFAULT_MODEL;
    return jsonResponse({
      ok: true,
      hasKey: !!activeKey() || eng === "ollama",
      engine: eng,
      model: defaultModel,
      mode: "direct",
      usage: { input: 0, output: 0, cache_read: 0, cache_create: 0, calls: 0 },
      providers: {
        anthropic: { available: !!k.anthropic, models: [] },
        xai:       { available: !!k.grok,      models: [] },
        groq:      { available: !!k.groq,      models: Array.from(GROQ_ALLOWED).map(id => ({ id, label: id })) },
        gemini:    { available: !!k.gemini,    models: Array.from(GEMINI_ALLOWED).map(id => ({ id, label: id })) },
        ollama:    { available: false, url: oll.url, models: [] }, // probed by UI
      },
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
      // inline "set key" UI can accept any of the keyed providers.
      let provider = body.provider;
      if (provider === "xai") provider = "grok"; // server uses "xai", client uses "grok"
      if (!provider) {
        if (key.startsWith("xai-")) provider = "grok";
        else if (key.startsWith("gsk_")) provider = "groq";
        else if (key.startsWith("AIza")) provider = "gemini";
        else if (key.startsWith("sk-")) provider = "anthropic";
      }
      if (!key || (provider !== "anthropic" && provider !== "grok" && provider !== "groq" && provider !== "gemini")) {
        return jsonResponse({ error: "Invalid key — expected Anthropic (sk-…), xAI (xai-…), Groq (gsk_…) or Gemini (AIza…) key" }, 400);
      }
      const cur = loadKeys();
      const next = { ...cur };
      if (provider === "grok")        { next.grok = key; next.active = "grok"; }
      else if (provider === "groq")   { next.groq = key; next.active = "groq"; }
      else if (provider === "gemini") { next.gemini = key; next.active = "gemini"; }
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

  // Groq — OpenAI-shape, Bearer gsk_… key. Mirror of callGrok with a
  // different URL + default model.
  async function callGroq(payload, key) {
    const requested = payload.model;
    const model = GROQ_ALLOWED.has(requested)
      ? requested
      : (GROQ_MODEL_MAP[requested] || GROQ_DEFAULT_MODEL);
    const sys = flattenSystem(payload.system);
    const messages = [];
    if (sys) messages.push({ role: "system", content: sys });
    for (const m of (payload.messages || [])) {
      messages.push({ role: m.role, content: flattenContent(m.content) });
    }
    const resp = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + key,
      },
      body: JSON.stringify({ model, max_tokens: payload.max_tokens || 1024, messages, stream: false }),
    });
    let data;
    try { data = await resp.json(); }
    catch { return { status: 502, body: { error: "Groq returned non-JSON" } }; }
    if (!resp.ok) {
      const msg = (data && data.error && (data.error.message || data.error)) || `HTTP ${resp.status}`;
      return { status: resp.status, body: { error: typeof msg === "string" ? msg : JSON.stringify(msg) } };
    }
    const text = (((data.choices || [])[0] || {}).message || {}).content || "";
    const u = data.usage || {};
    return {
      status: 200,
      body: {
        text, model: data.model,
        usage: { input_tokens: u.prompt_tokens || 0, output_tokens: u.completion_tokens || 0 },
        engine: "groq",
      },
    };
  }

  // Google Gemini — native generateContent. Key is a URL query param.
  // Anthropic "assistant" role → Gemini "model" role.
  // System prompt rides in `systemInstruction`, not the messages array.
  async function callGemini(payload, key) {
    const requested = payload.model;
    const model = GEMINI_ALLOWED.has(requested)
      ? requested
      : (GEMINI_MODEL_MAP[requested] || GEMINI_DEFAULT_MODEL);
    const sys = flattenSystem(payload.system);
    const contents = [];
    for (const m of (payload.messages || [])) {
      const role = m.role === "assistant" ? "model" : "user";
      contents.push({ role, parts: [{ text: flattenContent(m.content) }] });
    }
    const reqBody = {
      contents,
      generationConfig: { maxOutputTokens: payload.max_tokens || 1024, temperature: 0.7 },
    };
    if (sys) reqBody.systemInstruction = { parts: [{ text: sys }] };
    const url = `${GEMINI_URL_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    let resp;
    try {
      resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });
    } catch (e) {
      return { status: 503, body: { error: "Gemini unreachable: " + String(e.message || e) } };
    }
    let data;
    try { data = await resp.json(); }
    catch { return { status: 502, body: { error: "Gemini returned non-JSON" } }; }
    if (!resp.ok) {
      const msg = (data && data.error && (data.error.message || data.error)) || `HTTP ${resp.status}`;
      return { status: resp.status, body: { error: typeof msg === "string" ? msg : JSON.stringify(msg) } };
    }
    const cand = (data.candidates || [])[0] || {};
    const parts = (cand.content && cand.content.parts) || [];
    const text = parts.map(p => p.text || "").join("");
    const um = data.usageMetadata || {};
    return {
      status: 200,
      body: {
        text, model,
        usage: { input_tokens: um.promptTokenCount || 0, output_tokens: um.candidatesTokenCount || 0 },
        engine: "gemini",
      },
    };
  }

  // Ollama — direct browser→localhost POST. No auth header. Only works when
  // the browser, the Ollama daemon, and the user are all on the same host
  // (or the daemon is exposed on the LAN and CORS-permitted).
  async function callOllama(payload) {
    const { url, model: defaultModel } = loadOllamaConfig();
    const model = payload.model || defaultModel || "llama3.2";
    const sys = flattenSystem(payload.system);
    const messages = [];
    if (sys) messages.push({ role: "system", content: sys });
    for (const m of (payload.messages || [])) {
      messages.push({ role: m.role, content: flattenContent(m.content) });
    }
    let resp;
    try {
      resp = await fetch(url + "/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, max_tokens: payload.max_tokens || 1024, messages, stream: false }),
      });
    } catch (e) {
      return { status: 503, body: { error: "Ollama not reachable at " + url + " — is the daemon running?" } };
    }
    let data;
    try { data = await resp.json(); }
    catch { return { status: 502, body: { error: "Ollama returned non-JSON" } }; }
    if (!resp.ok) {
      const msg = (data && data.error && (data.error.message || data.error)) || `HTTP ${resp.status}`;
      return { status: resp.status, body: { error: typeof msg === "string" ? msg : JSON.stringify(msg) } };
    }
    const text = (((data.choices || [])[0] || {}).message || {}).content || "";
    return {
      status: 200,
      body: {
        text, model: data.model || model,
        usage: { input_tokens: 0, output_tokens: 0 },
        engine: "ollama",
      },
    };
  }

  async function handleChat(init) {
    let payloadPreview = {};
    try { payloadPreview = JSON.parse(init.body || "{}"); } catch {}
    // Explicit per-request provider wins over the persisted active engine.
    // Server uses "xai", client storage uses "grok" — normalize.
    let engine = payloadPreview.provider || activeEngine();
    if (engine === "xai") engine = "grok";
    if (!VALID_ENGINES.has(engine)) engine = activeEngine();
    const k = loadKeys();
    const key = engine === "grok" ? k.grok
              : engine === "groq" ? k.groq
              : engine === "gemini" ? k.gemini
              : engine === "ollama" ? ""
              : k.anthropic;
    if (engine !== "ollama" && !key) {
      if (btcToken()) {
        return jsonResponse({
          error: "Donation pool requires the hosted server. Use direct mode with your own key, or open the app from the Node server."
        }, 503);
      }
      const label = engine === "grok" ? "Grok"
                  : engine === "groq" ? "Groq"
                  : engine === "gemini" ? "Gemini"
                  : "Anthropic";
      return jsonResponse({
        error: `No ${label} API key set. Open Settings → API keys and Apply your key.`
      }, 503);
    }
    let payload;
    try { payload = JSON.parse(init.body || "{}"); }
    catch (e) { return jsonResponse({ error: "Bad JSON in request body" }, 400); }

    let result;
    try {
      result = engine === "grok"   ? await callGrok(payload, key)
             : engine === "groq"   ? await callGroq(payload, key)
             : engine === "gemini" ? await callGemini(payload, key)
             : engine === "ollama" ? await callOllama(payload)
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

    // Donation pool: attach Bearer token to /api/chat when present and the
    // user hasn't set their own active key (or pool is preferred).
    const isChat = (url.replace(/^https?:\/\/[^/]+/, "") === "/api/chat");
    const tok = btcToken();
    if (!DIRECT_MODE) {
      if (isChat && tok && !activeKey()) {
        const opts2 = { ...(init || {}) };
        const h = new Headers(opts2.headers || {});
        if (!h.has("Authorization")) h.set("Authorization", "Bearer " + tok);
        opts2.headers = h;
        return originalFetch(input, opts2);
      }
      return originalFetch(input, init);
    }

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
