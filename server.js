// CODEX dev server. Serves static files + proxies Oracle chat to the
// Anthropic API. Set ANTHROPIC_API_KEY in env. No deps — std lib only.

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const DIR = __dirname;

// Read .env from the app directory (KEY=value, # comments). Lets the user
// drop their Anthropic key in a file instead of exporting it every shell.
function loadDotenv() {
  try {
    const raw = fs.readFileSync(path.join(DIR, ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  } catch {}
}
loadDotenv();

// Mutable so the user can paste a key into the Oracle UI at runtime.
let API_KEY = process.env.ANTHROPIC_API_KEY || "";
let XAI_KEY = process.env.XAI_API_KEY || "";
const MODEL = process.env.CODEX_MODEL || "claude-haiku-4-5-20251001";

// Multi-provider model registry. Whitelisted so a poisoned client payload
// can't point us at an arbitrary endpoint or premium model.
const PROVIDERS = {
  anthropic: {
    label: "Anthropic (Claude)",
    models: [
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", tier: "fast" },
      { id: "claude-sonnet-4-6",         label: "Claude Sonnet 4.6", tier: "balanced" },
      { id: "claude-opus-4-7",           label: "Claude Opus 4.7",   tier: "best" },
    ],
  },
  xai: {
    label: "xAI (Grok)",
    models: [
      { id: "grok-3-mini",  label: "Grok 3 Mini",  tier: "fast" },
      { id: "grok-3",       label: "Grok 3",       tier: "balanced" },
      { id: "grok-4",       label: "Grok 4",       tier: "best" },
      { id: "grok-4-heavy", label: "Grok 4 Heavy", tier: "premium" },
    ],
  },
  ollama: {
    label: "Local (Ollama)",
    models: [], // discovered at runtime via /api/health
  },
};

function modelProvider(modelId) {
  for (const [name, p] of Object.entries(PROVIDERS)) {
    if (p.models.some(m => m.id === modelId)) return name;
  }
  return null;
}

// Rolling token counters surfaced via /api/health for the in-app indicator.
const USAGE = {
  input: 0, output: 0,
  cache_create: 0, cache_read: 0,
  calls: 0, sinceISO: new Date().toISOString(),
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".jsx":  "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".svg":  "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function serveStatic(req, res) {
  let url = req.url.split("?")[0];
  if (url === "/") url = "/index.html";
  const filePath = path.join(DIR, decodeURIComponent(url));
  if (!filePath.startsWith(DIR)) { res.writeHead(403); res.end("forbidden"); return; }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404); res.end("not found"); return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain" });
  fs.createReadStream(filePath).pipe(res);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", c => buf += c);
    req.on("end", () => resolve(buf));
    req.on("error", reject);
  });
}

function postAnthropic(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const r = https.request({
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body),
      },
    }, resp => {
      let buf = "";
      resp.on("data", c => buf += c);
      resp.on("end", () => {
        try { resolve({ status: resp.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: resp.statusCode, body: { error: buf } }); }
      });
    });
    r.on("error", reject);
    r.write(body);
    r.end();
  });
}

// xAI Grok — OpenAI-compatible chat completions API.
// https://docs.x.ai — translates {system, messages, max_tokens, model} to
// OpenAI shape and back to the same { text, model, usage } envelope our
// client expects, so panels-gen and oracle stay provider-agnostic.
function postXAI(payload) {
  return new Promise((resolve, reject) => {
    const oaiMessages = [];
    if (payload.system) oaiMessages.push({ role: "system", content: payload.system });
    for (const m of payload.messages || []) oaiMessages.push(m);
    const body = JSON.stringify({
      model: payload.model,
      messages: oaiMessages,
      max_tokens: payload.max_tokens || 1024,
      temperature: 0.7,
    });
    const r = https.request({
      hostname: "api.x.ai",
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${XAI_KEY}`,
        "Content-Length": Buffer.byteLength(body),
      },
    }, resp => {
      let buf = "";
      resp.on("data", c => buf += c);
      resp.on("end", () => {
        try {
          const parsed = JSON.parse(buf);
          if (resp.statusCode >= 400) {
            resolve({ status: resp.statusCode, body: parsed });
            return;
          }
          // Normalize OpenAI shape -> Anthropic-style envelope.
          const text = parsed.choices?.[0]?.message?.content || "";
          const usage = parsed.usage || {};
          resolve({
            status: 200,
            body: {
              content: [{ type: "text", text }],
              model: parsed.model || payload.model,
              usage: {
                input_tokens: usage.prompt_tokens || 0,
                output_tokens: usage.completion_tokens || 0,
                cache_creation_input_tokens: 0,
                cache_read_input_tokens: 0,
              },
            },
          });
        } catch (e) {
          resolve({ status: resp.statusCode, body: { error: buf } });
        }
      });
    });
    r.on("error", reject);
    r.write(body);
    r.end();
  });
}

// Ollama — local LLM at http://localhost:11434, OpenAI-compatible endpoint.
// Same normalization as postXAI so the client never has to care.
function postOllama(payload) {
  return new Promise((resolve, reject) => {
    const oaiMessages = [];
    if (payload.system) oaiMessages.push({ role: "system", content: payload.system });
    for (const m of payload.messages || []) oaiMessages.push(m);
    const body = JSON.stringify({
      model: payload.model || "qwen2.5:14b-instruct-q4_K_M",
      messages: oaiMessages,
      max_tokens: payload.max_tokens || 1024,
      stream: false,
    });
    const r = http.request({
      hostname: "localhost",
      port: 11434,
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    }, resp => {
      let buf = "";
      resp.on("data", c => buf += c);
      resp.on("end", () => {
        try {
          const parsed = JSON.parse(buf);
          if (resp.statusCode >= 400) {
            resolve({ status: resp.statusCode, body: parsed });
            return;
          }
          const text = parsed.choices?.[0]?.message?.content || "";
          resolve({
            status: 200,
            body: {
              content: [{ type: "text", text }],
              model: parsed.model || payload.model,
              usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
            },
          });
        } catch (e) {
          resolve({ status: resp.statusCode, body: { error: buf } });
        }
      });
    });
    r.on("error", () => resolve({ status: 503, body: { error: "Ollama not reachable on localhost:11434" } }));
    r.write(body);
    r.end();
  });
}

// Probe Ollama on startup so the client can light up the "Local" engine
// option in the model selector. Re-probed lazily on every /api/health hit.
let OLLAMA_STATUS = { ok: false, models: [], lastProbe: 0 };
function probeOllama() {
  return new Promise((resolve) => {
    const r = http.request({
      hostname: "localhost", port: 11434, path: "/api/tags", method: "GET",
    }, resp => {
      let buf = "";
      resp.on("data", c => buf += c);
      resp.on("end", () => {
        try {
          const tags = JSON.parse(buf);
          const models = (tags.models || []).map(m => ({ id: m.name, label: m.name, tier: "local" }));
          OLLAMA_STATUS = { ok: true, models, lastProbe: Date.now() };
          PROVIDERS.ollama.models = models;
        } catch {
          OLLAMA_STATUS = { ok: false, models: [], lastProbe: Date.now() };
        }
        resolve();
      });
    });
    r.on("error", () => { OLLAMA_STATUS = { ok: false, models: [], lastProbe: Date.now() }; resolve(); });
    r.setTimeout(800, () => { r.destroy(); resolve(); });
    r.end();
  });
}

const server = http.createServer(async (req, res) => {
  // CORS for localhost dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.url === "/api/health") {
    // Re-probe Ollama opportunistically (rate-limited to once per 10s)
    if (Date.now() - OLLAMA_STATUS.lastProbe > 10000) { await probeOllama(); }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      hasKey: !!API_KEY,
      model: MODEL,
      usage: USAGE,
      providers: {
        anthropic: { available: !!API_KEY, models: PROVIDERS.anthropic.models },
        xai:       { available: !!XAI_KEY, models: PROVIDERS.xai.models },
        ollama:    { available: OLLAMA_STATUS.ok, models: PROVIDERS.ollama.models },
      },
    }));
    return;
  }

  if (req.url === "/api/key" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw);
      const key = parsed.key;
      // Accept an explicit provider, else infer from the key prefix.
      // Anthropic keys start with "sk-ant-", xAI keys start with "xai-".
      let provider = parsed.provider;
      if (!provider) {
        if (key && key.startsWith("xai-")) provider = "xai";
        else if (key && key.startsWith("sk-ant-")) provider = "anthropic";
        else if (key && key.startsWith("sk-")) provider = "anthropic";
      }
      if (!key || (provider !== "anthropic" && provider !== "xai")) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid key — expected Anthropic (sk-ant-…) or xAI (xai-…) key" }));
        return;
      }
      const trimmed = key.trim();
      const envVar = provider === "xai" ? "XAI_API_KEY" : "ANTHROPIC_API_KEY";
      if (provider === "xai") XAI_KEY = trimmed; else API_KEY = trimmed;
      // Persist to .env for next restart so the user only enters it once.
      try {
        const envPath = path.join(DIR, ".env");
        let body = "";
        try { body = fs.readFileSync(envPath, "utf8"); } catch {}
        const re = new RegExp(`^${envVar}\\s*=.*$`, "m");
        if (re.test(body)) {
          body = body.replace(re, `${envVar}=${trimmed}`);
        } else {
          body = (body ? body.trimEnd() + "\n" : "") + `${envVar}=${trimmed}\n`;
        }
        fs.writeFileSync(envPath, body, { mode: 0o600 });
      } catch (e) {
        console.warn("Could not persist key to .env:", e.message);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, provider, hasKey: true }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(e.message || e) }));
    }
    return;
  }

  if (req.url === "/api/chat" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const { system, messages, max_tokens, model, provider: reqProvider } = JSON.parse(raw);

      // Resolve provider: explicit request wins, else infer from model id,
      // else fall back to anthropic (legacy behavior).
      let provider = reqProvider || (model && modelProvider(model)) || "anthropic";
      let chosenModel = model;

      // Validate model is in our whitelist for the provider.
      if (provider !== "ollama") {
        const allowed = new Set(PROVIDERS[provider]?.models.map(m => m.id) || []);
        if (!chosenModel || !allowed.has(chosenModel)) {
          chosenModel = provider === "anthropic" ? MODEL : PROVIDERS[provider].models[0]?.id;
        }
      }

      // Auth check per provider.
      if (provider === "anthropic" && !API_KEY) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No ANTHROPIC_API_KEY set. Add it via Settings → AI Model, or set in .env." }));
        return;
      }
      if (provider === "xai" && !XAI_KEY) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No XAI_API_KEY set. Add it via Settings → AI Model, or set in .env." }));
        return;
      }

      const payload = {
        model: chosenModel,
        max_tokens: max_tokens || 1024,
        system: system || undefined,
        messages: messages || [],
      };

      let resp;
      if (provider === "xai")        resp = await postXAI(payload);
      else if (provider === "ollama") resp = await postOllama(payload);
      else                            resp = await postAnthropic(payload);

      if (resp.status >= 400) {
        res.writeHead(resp.status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(resp.body));
        return;
      }
      const text = (resp.body.content || []).filter(c => c.type === "text").map(c => c.text).join("");
      const u = resp.body.usage || {};
      USAGE.input += u.input_tokens || 0;
      USAGE.output += u.output_tokens || 0;
      USAGE.cache_create += u.cache_creation_input_tokens || 0;
      USAGE.cache_read += u.cache_read_input_tokens || 0;
      USAGE.calls += 1;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ text, model: resp.body.model, provider, usage: u }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(e.message || e) }));
    }
    return;
  }

  serveStatic(req, res);
});

// Bind to 0.0.0.0 so iPhones / iPads on the same Wi-Fi can connect.
// Discover and print every reachable IPv4 address so you can pick the right one.
function lanAddresses() {
  const os = require("os");
  const out = [];
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const it of ifs[name] || []) {
      if (it.family === "IPv4" && !it.internal) out.push({ iface: name, address: it.address });
    }
  }
  return out;
}

server.listen(PORT, "0.0.0.0", async () => {
  const lan = lanAddresses();
  await probeOllama();
  console.log(`\n┌─ CODEX server  ────────────────────────────────────────────`);
  console.log(`│  port:    ${PORT}`);
  console.log(`│  default: ${MODEL}`);
  console.log(`│  providers:`);
  console.log(`│    · anthropic  ${API_KEY ? "✓ key set" : "✗ no key  (set ANTHROPIC_API_KEY)"}`);
  console.log(`│    · xai/grok   ${XAI_KEY ? "✓ key set" : "✗ no key  (set XAI_API_KEY)"}`);
  console.log(`│    · ollama     ${OLLAMA_STATUS.ok ? `✓ ${OLLAMA_STATUS.models.length} local model(s)` : "✗ not running on :11434"}`);
  console.log(`│`);
  console.log(`│  desktop: http://localhost:${PORT}`);
  for (const a of lan) console.log(`│  phone:   http://${a.address}:${PORT}   (${a.iface})`);
  console.log(`└────────────────────────────────────────────────────────────\n`);
});
