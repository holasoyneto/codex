// CODEX direct-API shim — when running without a Node backend (e.g. on
// GitHub Pages), proxy /api/* fetches straight to api.anthropic.com using
// the user's locally-stored key. The key never leaves the browser except
// to Anthropic itself.
//
// Detection: we probe /api/health on load. If it fails or returns non-JSON
// (e.g. GitHub Pages 404 HTML), we flip into "direct mode" and monkey-patch
// fetch to handle the three /api/* routes the client uses.

(function () {
  const KEY_LS = "codex.anthropic.key.v1";
  const ALLOWED_MODELS = new Set([
    "claude-haiku-4-5-20251001",
    "claude-sonnet-4-6",
    "claude-opus-4-7",
  ]);
  const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
  const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
  const ANTHROPIC_VERSION = "2023-06-01";

  function getKey() {
    try { return localStorage.getItem(KEY_LS) || ""; } catch { return ""; }
  }
  function setKey(k) {
    try { localStorage.setItem(KEY_LS, k); } catch {}
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
      hasKey: !!getKey(),
      model: DEFAULT_MODEL,
      mode: "direct",
      usage: { input: 0, output: 0, cache_read: 0, cache_create: 0, calls: 0 },
    });
  }

  async function handleKey(init) {
    try {
      const body = JSON.parse(init.body || "{}");
      const key = (body.key || "").trim();
      if (!key.startsWith("sk-")) {
        return jsonResponse({ error: "Invalid key — must start with sk-" }, 400);
      }
      setKey(key);
      return jsonResponse({ ok: true, hasKey: true });
    } catch (e) {
      return jsonResponse({ error: String(e.message || e) }, 500);
    }
  }

  async function handleChat(init) {
    const key = getKey();
    if (!key) {
      return jsonResponse({
        error: "No API key set. Click SET KEY and paste your Anthropic key first."
      }, 503);
    }
    let payload;
    try { payload = JSON.parse(init.body || "{}"); }
    catch (e) { return jsonResponse({ error: "Bad JSON in request body" }, 400); }

    const model = ALLOWED_MODELS.has(payload.model) ? payload.model : DEFAULT_MODEL;
    const reqBody = {
      model,
      max_tokens: payload.max_tokens || 1024,
      messages: payload.messages || [],
    };
    if (payload.system) reqBody.system = payload.system;

    let resp;
    try {
      resp = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": ANTHROPIC_VERSION,
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify(reqBody),
      });
    } catch (e) {
      return jsonResponse({ error: "Network error: " + String(e.message || e) }, 500);
    }

    let data;
    try { data = await resp.json(); }
    catch { return jsonResponse({ error: "Anthropic returned non-JSON" }, 502); }

    if (!resp.ok) {
      const msg = (data && data.error && data.error.message) || data.error || `HTTP ${resp.status}`;
      return jsonResponse({ error: typeof msg === "string" ? msg : JSON.stringify(msg) }, resp.status);
    }

    const text = ((data.content || []).filter(c => c.type === "text").map(c => c.text).join(""));
    return jsonResponse({ text, model: data.model, usage: data.usage || {} });
  }

  // Decide whether we're in direct mode. We're conservative: only flip on
  // when the health probe clearly fails or returns non-JSON. On localhost
  // with the Node server, we leave fetch alone.
  let DIRECT_MODE = null;
  async function probeMode() {
    try {
      const r = await fetch("/api/health", { method: "GET" });
      if (!r.ok) return true;
      const ct = r.headers.get("content-type") || "";
      if (!ct.includes("application/json")) return true;
      const d = await r.json();
      // If health returns ok and reports server-side hasKey support, we're
      // talking to the real server. Stay in proxy mode.
      return !d || d.mode === "direct";  // default false → stay proxied
    } catch {
      return true;  // any failure → assume no server
    }
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    let url = "";
    if (typeof input === "string") url = input;
    else if (input && input.url) url = input.url;

    // Only intercept our own /api/* paths.
    const isApi = url.startsWith("/api/") || url.includes(location.host + "/api/");
    if (!isApi) return originalFetch(input, init);

    if (DIRECT_MODE === null) DIRECT_MODE = await probeMode();
    if (!DIRECT_MODE) return originalFetch(input, init);

    const path = url.replace(/^https?:\/\/[^/]+/, "");
    const opts = init || (input && typeof input === "object" ? input : {});

    if (path === "/api/health") return handleHealth();
    if (path === "/api/key" && (opts.method || "").toUpperCase() === "POST") return handleKey(opts);
    if (path === "/api/chat" && (opts.method || "").toUpperCase() === "POST") return handleChat(opts);

    // Anything else under /api/ — fall through to a 404 JSON.
    return jsonResponse({ error: "Endpoint not available in direct mode: " + path }, 404);
  };

  // Expose for debugging.
  window.CODEX_DIRECT = { getKey, setKey, probeMode };
})();
