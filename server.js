// CODEX dev server. Serves static files + proxies Oracle chat to the
// Anthropic API. Set ANTHROPIC_API_KEY in env. No deps — std lib only.

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

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
// Groq (groq.com — NOT xAI's Grok). OpenAI-compatible API at api.groq.com.
// Free tier; keys begin with `gsk_`.
let GROQ_KEY = process.env.GROQ_API_KEY || "";
// Google Gemini (Google AI Studio). Native generateContent API at
// generativelanguage.googleapis.com. Free tier ~15 req/min, 1M tokens/day.
// Keys are usually `AIza…` but can vary — we don't gate on prefix.
let GEMINI_KEY = process.env.GEMINI_API_KEY || "";
// Ollama — local LLM daemon. Default URL is the standard local install.
// Override with OLLAMA_URL=http://other-host:11434 for a LAN box.
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/+$/, "");
let OLLAMA_HOST = "localhost", OLLAMA_PORT = 11434, OLLAMA_PROTO = "http";
try {
  const u = new URL(OLLAMA_URL);
  OLLAMA_HOST = u.hostname;
  OLLAMA_PORT = parseInt(u.port || (u.protocol === "https:" ? "443" : "80"), 10);
  OLLAMA_PROTO = u.protocol === "https:" ? "https" : "http";
} catch {}
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
  groq: {
    label: "Groq (free fast inference)",
    models: [
      { id: "llama-3.3-70b-versatile",        label: "Llama 3.3 70B Versatile",  tier: "best"      },
      { id: "llama-3.1-8b-instant",           label: "Llama 3.1 8B Instant",     tier: "fast"      },
      { id: "mixtral-8x7b-32768",             label: "Mixtral 8x7B (32k)",       tier: "balanced"  },
      { id: "deepseek-r1-distill-llama-70b",  label: "DeepSeek R1 Distill 70B",  tier: "reasoning" },
      { id: "qwen-2.5-32b",                   label: "Qwen 2.5 32B",             tier: "balanced"  },
    ],
  },
  gemini: {
    label: "Google Gemini (free · AI Studio)",
    models: [
      { id: "gemini-2.0-flash",                  label: "Gemini 2.0 Flash",          tier: "fast"      },
      { id: "gemini-2.5-flash",                  label: "Gemini 2.5 Flash",          tier: "balanced"  },
      { id: "gemini-2.5-pro",                    label: "Gemini 2.5 Pro",            tier: "best"      },
      { id: "gemini-2.0-flash-thinking-exp",     label: "Gemini 2.0 Flash Thinking", tier: "reasoning" },
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

// Groq — groq.com (DISTINCT from xAI's Grok). OpenAI-compatible chat
// completions at api.groq.com/openai/v1. Free tier; Bearer gsk_… key.
function postGroq(payload) {
  return new Promise((resolve, reject) => {
    const oaiMessages = [];
    if (payload.system) oaiMessages.push({ role: "system", content: payload.system });
    for (const m of payload.messages || []) oaiMessages.push(m);
    const body = JSON.stringify({
      model: payload.model || "llama-3.3-70b-versatile",
      messages: oaiMessages,
      max_tokens: payload.max_tokens || 1024,
      temperature: 0.7,
    });
    const r = https.request({
      hostname: "api.groq.com",
      path: "/openai/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_KEY}`,
        "Content-Length": Buffer.byteLength(body),
      },
    }, resp => {
      let buf = "";
      resp.on("data", c => buf += c);
      resp.on("end", () => {
        try {
          const parsed = JSON.parse(buf);
          if (resp.statusCode >= 400) { resolve({ status: resp.statusCode, body: parsed }); return; }
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

// Google Gemini — native generateContent API (NOT OpenAI-compatible).
// Differences vs Groq/xAI:
//   • API key is a URL query param, NOT a Bearer header.
//   • Messages live under `contents[]` with role `"user"` or `"model"`
//     (Anthropic "assistant" → Gemini "model").
//   • Content blocks are `{parts: [{text}]}` instead of plain strings.
//   • System prompt is a sibling `systemInstruction` field, not a message.
// Response normalizes to the same {content, model, usage} envelope.
function postGemini(payload) {
  return new Promise((resolve, reject) => {
    const model = payload.model || "gemini-2.0-flash";
    // Translate Anthropic-shape messages → Gemini contents.
    const contents = [];
    for (const m of payload.messages || []) {
      const role = m.role === "assistant" ? "model" : "user";
      let text = "";
      if (typeof m.content === "string") text = m.content;
      else if (Array.isArray(m.content)) text = m.content.map(b => (b && b.text) || "").join("\n");
      else if (m.content && m.content.text) text = m.content.text;
      contents.push({ role, parts: [{ text }] });
    }
    const reqBody = {
      contents,
      generationConfig: { maxOutputTokens: payload.max_tokens || 1024, temperature: 0.7 },
    };
    if (payload.system) {
      const sysText = typeof payload.system === "string"
        ? payload.system
        : (Array.isArray(payload.system)
            ? payload.system.map(s => (typeof s === "string" ? s : (s && s.text) || "")).join("\n\n")
            : (payload.system.text || ""));
      if (sysText) reqBody.systemInstruction = { parts: [{ text: sysText }] };
    }
    const body = JSON.stringify(reqBody);
    const r = https.request({
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`,
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
          if (resp.statusCode >= 400) { resolve({ status: resp.statusCode, body: parsed }); return; }
          const cand = (parsed.candidates && parsed.candidates[0]) || {};
          const parts = (cand.content && cand.content.parts) || [];
          const text = parts.map(p => p.text || "").join("");
          const um = parsed.usageMetadata || {};
          resolve({
            status: 200,
            body: {
              content: [{ type: "text", text }],
              model,
              usage: {
                input_tokens: um.promptTokenCount || 0,
                output_tokens: um.candidatesTokenCount || 0,
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

// Ollama — local LLM (default http://localhost:11434), OpenAI-compatible
// endpoint. Same normalization as postXAI so the client never has to care.
function postOllama(payload) {
  return new Promise((resolve, reject) => {
    const oaiMessages = [];
    if (payload.system) oaiMessages.push({ role: "system", content: payload.system });
    for (const m of payload.messages || []) oaiMessages.push(m);
    const fallbackModel = process.env.OLLAMA_MODEL
      || (OLLAMA_STATUS.models[0] && OLLAMA_STATUS.models[0].id)
      || "qwen2.5:14b-instruct-q4_K_M";
    const body = JSON.stringify({
      model: payload.model || fallbackModel,
      messages: oaiMessages,
      max_tokens: payload.max_tokens || 1024,
      stream: false,
    });
    const transport = OLLAMA_PROTO === "https" ? https : http;
    const r = transport.request({
      hostname: OLLAMA_HOST,
      port: OLLAMA_PORT,
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
    r.on("error", () => resolve({ status: 503, body: { error: `Ollama not reachable at ${OLLAMA_URL}` } }));
    r.write(body);
    r.end();
  });
}

// Probe Ollama on startup so the client can light up the "Local" engine
// option in the model selector. Re-probed lazily on every /api/health hit.
let OLLAMA_STATUS = { ok: false, models: [], lastProbe: 0 };
function probeOllama() {
  return new Promise((resolve) => {
    const transport = OLLAMA_PROTO === "https" ? https : http;
    const r = transport.request({
      hostname: OLLAMA_HOST, port: OLLAMA_PORT, path: "/api/tags", method: "GET",
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

// ─────────────────────────────────────────────────────────────────────
// Phase 5.4 — Public Data API (v1)
// Read-only JSON endpoints over the bundled data/modules/* files. These
// are additive and do not touch the existing /api/chat, /api/key,
// /api/health routes above. CORS headers are set globally below.
// ─────────────────────────────────────────────────────────────────────

const MODULE_DIR = path.join(DIR, "data", "modules");
const MODULE_CACHE = Object.create(null);
function readModule(filename) {
  if (MODULE_CACHE[filename]) return MODULE_CACHE[filename];
  try {
    const raw = fs.readFileSync(path.join(MODULE_DIR, filename), "utf8");
    MODULE_CACHE[filename] = JSON.parse(raw);
    return MODULE_CACHE[filename];
  } catch (e) {
    return null;
  }
}

// Simple in-memory IP rate limiter: 100 requests / 60s window.
const RATE = new Map(); // ip -> { count, windowStart }
const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60_000;
function rateCheck(ip) {
  const now = Date.now();
  const entry = RATE.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    RATE.set(ip, { count: 1, windowStart: now });
    return { ok: true, remaining: RATE_LIMIT - 1 };
  }
  entry.count++;
  if (entry.count > RATE_LIMIT) return { ok: false, remaining: 0, retryAfter: Math.ceil((RATE_WINDOW_MS - (now - entry.windowStart)) / 1000) };
  return { ok: true, remaining: RATE_LIMIT - entry.count };
}

const APP_VERSION = "5.4.0";

function jsonReply(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

// ISO week (1..53) per ISO-8601.
function isoWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

// Returns true if the URL was handled.
function handleDataApi(req, res, urlObj) {
  const p = urlObj.pathname;
  if (!p.startsWith("/api/v1/")) return false;

  // Rate-limit per IP.
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").toString().split(",")[0].trim();
  const rc = rateCheck(ip);
  res.setHeader("X-RateLimit-Limit", String(RATE_LIMIT));
  res.setHeader("X-RateLimit-Remaining", String(rc.remaining));
  if (!rc.ok) {
    res.setHeader("Retry-After", String(rc.retryAfter));
    jsonReply(res, 429, { error: "rate limit exceeded", retryAfter: rc.retryAfter });
    return true;
  }

  // /api/v1/health-public — safe for external monitoring.
  if (p === "/api/v1/health-public") {
    let count = 0;
    try { count = fs.readdirSync(MODULE_DIR).filter(f => f.endsWith(".json") && !f.startsWith("_")).length; } catch {}
    jsonReply(res, 200, { ok: true, version: APP_VERSION, modules_count: count });
    return true;
  }

  // /api/v1/modules — list every bundled module's meta block.
  if (p === "/api/v1/modules") {
    const out = [];
    try {
      for (const file of fs.readdirSync(MODULE_DIR)) {
        if (!file.endsWith(".json") || file.startsWith("_")) continue;
        const mod = readModule(file);
        if (mod && mod.meta) out.push({ file, ...mod.meta });
      }
    } catch (e) {
      return jsonReply(res, 500, { error: "could not enumerate modules" }), true;
    }
    jsonReply(res, 200, { modules: out, count: out.length });
    return true;
  }

  // /api/v1/strongs/:id — Strong's lexicon lookup.
  const mStrongs = p.match(/^\/api\/v1\/strongs\/([HG]\d+)$/i);
  if (mStrongs) {
    const id = mStrongs[1].toUpperCase();
    const file = id[0] === "H" ? "strongs-hebrew.json" : "strongs-greek.json";
    const mod = readModule(file);
    if (!mod) return jsonReply(res, 500, { error: "lexicon not available", file }), true;
    const entry = (mod.entries || {})[id];
    if (!entry) return jsonReply(res, 404, { error: "not found", id }), true;
    jsonReply(res, 200, { id, ...entry });
    return true;
  }

  // /api/v1/crossref/:ref — TSK cross-references for a verse.
  const mXref = p.match(/^\/api\/v1\/crossref\/(.+)$/);
  if (mXref) {
    const ref = decodeURIComponent(mXref[1]).toLowerCase();
    const mod = readModule("tsk-sample.json");
    if (!mod) return jsonReply(res, 500, { error: "crossref data not available" }), true;
    const list = (mod.verses || {})[ref];
    if (!list) return jsonReply(res, 404, { error: "not found", ref }), true;
    jsonReply(res, 200, { ref, crossrefs: list, source: mod.meta?.name || "TSK" });
    return true;
  }

  // /api/v1/search — stub. Full-text server-side search is future work.
  if (p === "/api/v1/search") {
    const q = (urlObj.searchParams.get("q") || "").trim();
    const translation = urlObj.searchParams.get("translation") || "kjv";
    const limit = Math.min(parseInt(urlObj.searchParams.get("limit") || "20", 10) || 20, 100);
    if (!q) return jsonReply(res, 400, { error: "missing q parameter" }), true;
    jsonReply(res, 200, {
      q, translation, limit,
      results: [],
      note: "Server-side full-text search is not yet implemented. CODEX currently performs keyword search in the client against cached Bible texts. A full server-side index is planned for Phase 5.6.",
      stub: true,
    });
    return true;
  }

  // /api/v1/timeline — filter timeline events.
  if (p === "/api/v1/timeline") {
    const mod = readModule("timeline-events.json");
    if (!mod) return jsonReply(res, 500, { error: "timeline data not available" }), true;
    const from = urlObj.searchParams.has("from") ? parseInt(urlObj.searchParams.get("from"), 10) : -Infinity;
    const to   = urlObj.searchParams.has("to")   ? parseInt(urlObj.searchParams.get("to"),   10) :  Infinity;
    const category = urlObj.searchParams.get("category");
    const era      = urlObj.searchParams.get("era");
    let events = (mod.events || []).filter(e => {
      if (typeof e.year === "number" && (e.year < from || e.year > to)) return false;
      if (category && e.category !== category) return false;
      if (era && e.era !== era) return false;
      return true;
    });
    const limit = parseInt(urlObj.searchParams.get("limit") || "1000", 10) || 1000;
    if (events.length > limit) events = events.slice(0, limit);
    jsonReply(res, 200, { count: events.length, from, to, category: category || null, era: era || null, events });
    return true;
  }

  // /api/v1/parsha — current or specified ISO week parsha.
  if (p === "/api/v1/parsha") {
    const mod = readModule("parsha.json");
    if (!mod) return jsonReply(res, 500, { error: "parsha data not available" }), true;
    const list = mod.parashot || [];
    const weekParam = urlObj.searchParams.get("week");
    let weekNum;
    if (!weekParam || weekParam === "current") weekNum = isoWeek(new Date());
    else weekNum = parseInt(weekParam, 10);
    if (!Number.isFinite(weekNum) || weekNum < 1) return jsonReply(res, 400, { error: "invalid week", week: weekParam }), true;
    // Map ISO week (1..53) into the 54-parsha cycle.
    const idx = ((weekNum - 1) % list.length + list.length) % list.length;
    const entry = list[idx];
    if (!entry) return jsonReply(res, 404, { error: "no parsha for week", week: weekNum }), true;
    jsonReply(res, 200, { week: weekNum, parsha: entry, cycle: mod.cycle || "annual" });
    return true;
  }

  // Unknown /api/v1/* route.
  jsonReply(res, 404, { error: "unknown endpoint", path: p });
  return true;
}

// ─────────────────────────────────────────────────────────────────────
// BTC donation → free Haiku pool
// On-chain BTC verified via blockstream.info (mainnet) or its testnet
// endpoint when CODEX_BTC_TESTNET=1. Each verified tx unlocks a token
// quota of Haiku tokens redeemable through the server's pool API key.
// ─────────────────────────────────────────────────────────────────────

const DONATION_BTC_ADDRESS = process.env.DONATION_BTC_ADDRESS || "";
const BTC_TESTNET = process.env.CODEX_BTC_TESTNET === "1";
const BTC_HOST = "blockstream.info";
const BTC_API_BASE = BTC_TESTNET ? "/testnet/api" : "/api";
const USD_PER_BTC_HOST = "mempool.space";
const TOKENS_PER_USD = 250_000;
const HAIKU_MODEL_ID = "claude-haiku-4-5-20251001";

const DONATIONS_DIR = path.join(DIR, "data");
const DONATIONS_FILE = path.join(DONATIONS_DIR, "donations.json");
const DONATIONS_AUDIT = path.join(DONATIONS_DIR, "donations.audit.log");

function loadDonations() {
  try { return JSON.parse(fs.readFileSync(DONATIONS_FILE, "utf8")); }
  catch { return {}; }
}
function saveDonations(map) {
  try { fs.mkdirSync(DONATIONS_DIR, { recursive: true }); } catch {}
  const tmp = DONATIONS_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(map, null, 2));
  fs.renameSync(tmp, DONATIONS_FILE);
}
function auditLog(line) {
  try { fs.appendFileSync(DONATIONS_AUDIT, `${new Date().toISOString()} ${line}\n`); } catch {}
}

let DONATIONS = loadDonations();
// Secondary index: token -> tx_hash, built lazily for O(1) chat lookups.
const TOKEN_INDEX = new Map();
for (const [tx, rec] of Object.entries(DONATIONS)) {
  if (rec && rec.token) TOKEN_INDEX.set(rec.token, tx);
}

// Cache for tx + price lookups (60s tx, 5min price).
const BTC_CACHE = { tx: new Map(), price: { value: 0, ts: 0 } };
function httpsGetJson(host, p) {
  return new Promise((resolve) => {
    const r = https.request({ hostname: host, path: p, method: "GET", headers: { "User-Agent": "codex-server/1.0" } }, resp => {
      let buf = "";
      resp.on("data", c => buf += c);
      resp.on("end", () => {
        if (resp.statusCode === 404) return resolve({ status: 404, body: null });
        try { resolve({ status: resp.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: resp.statusCode, body: null, raw: buf }); }
      });
    });
    r.on("error", () => resolve({ status: 0, body: null }));
    r.setTimeout(8000, () => { r.destroy(); resolve({ status: 0, body: null }); });
    r.end();
  });
}
async function fetchTx(txHash) {
  const cached = BTC_CACHE.tx.get(txHash);
  if (cached && Date.now() - cached.ts < 60_000) return cached.value;
  const r = await httpsGetJson(BTC_HOST, `${BTC_API_BASE}/tx/${txHash}`);
  BTC_CACHE.tx.set(txHash, { value: r, ts: Date.now() });
  return r;
}
async function fetchBtcUsd() {
  if (Date.now() - BTC_CACHE.price.ts < 5 * 60_000 && BTC_CACHE.price.value > 0) return BTC_CACHE.price.value;
  const r = await httpsGetJson(USD_PER_BTC_HOST, "/api/v1/prices");
  const usd = r.body && (r.body.USD || r.body.usd);
  if (usd && Number.isFinite(usd)) {
    BTC_CACHE.price = { value: usd, ts: Date.now() };
    return usd;
  }
  return BTC_CACHE.price.value || 0;
}

// Per-IP rate limit for claim endpoint: 5/min.
const BTC_RATE = new Map();
function btcClaimRate(ip) {
  const now = Date.now();
  const e = BTC_RATE.get(ip);
  if (!e || now - e.start > 60_000) { BTC_RATE.set(ip, { count: 1, start: now }); return true; }
  e.count++;
  return e.count <= 5;
}

function clientIp(req) {
  return (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").toString().split(",")[0].trim();
}

function findDonationToken(req) {
  const auth = req.headers["authorization"] || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1].trim();
  const tx = TOKEN_INDEX.get(token);
  if (!tx) return null;
  const rec = DONATIONS[tx];
  if (!rec || rec.token !== token) return null;
  return { tx, rec };
}

function estimateTokens(payload, respText, usage) {
  if (usage && (usage.input_tokens || usage.output_tokens)) {
    return (usage.input_tokens || 0) + (usage.output_tokens || 0)
      + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
  }
  // Fallback: ~4 chars per token estimate.
  let chars = 0;
  const sys = payload.system;
  if (typeof sys === "string") chars += sys.length;
  for (const m of payload.messages || []) {
    const c = m.content;
    if (typeof c === "string") chars += c.length;
    else if (Array.isArray(c)) for (const b of c) chars += ((b && b.text) || "").length;
  }
  chars += (respText || "").length;
  return Math.ceil(chars / 4);
}

const server = http.createServer(async (req, res) => {
  // CORS for localhost dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  // Phase 5.4 public Data API (GET /api/v1/*). Returns true if handled.
  if (req.method === "GET" && req.url.startsWith("/api/v1/")) {
    const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (handleDataApi(req, res, urlObj)) return;
  }

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
        anthropic: { available: !!API_KEY,    models: PROVIDERS.anthropic.models },
        xai:       { available: !!XAI_KEY,    models: PROVIDERS.xai.models },
        groq:      { available: !!GROQ_KEY,   models: PROVIDERS.groq.models },
        gemini:    { available: !!GEMINI_KEY, models: PROVIDERS.gemini.models },
        ollama:    { available: OLLAMA_STATUS.ok, url: OLLAMA_URL, models: PROVIDERS.ollama.models },
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
      // Anthropic: "sk-ant-"; xAI Grok: "xai-"; Groq: "gsk_"; Gemini: "AIza"
      // (Gemini keys without that prefix must pass provider explicitly).
      let provider = parsed.provider;
      if (!provider) {
        if (key && key.startsWith("xai-")) provider = "xai";
        else if (key && key.startsWith("gsk_")) provider = "groq";
        else if (key && key.startsWith("AIza")) provider = "gemini";
        else if (key && key.startsWith("sk-ant-")) provider = "anthropic";
        else if (key && key.startsWith("sk-")) provider = "anthropic";
      }
      if (!key || (provider !== "anthropic" && provider !== "xai" && provider !== "groq" && provider !== "gemini")) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid key — expected Anthropic (sk-ant-…), xAI (xai-…), Groq (gsk_…) or Gemini (AIza…) key" }));
        return;
      }
      const trimmed = key.trim();
      const envVar = provider === "xai" ? "XAI_API_KEY"
                   : provider === "groq" ? "GROQ_API_KEY"
                   : provider === "gemini" ? "GEMINI_API_KEY"
                   : "ANTHROPIC_API_KEY";
      if (provider === "xai") XAI_KEY = trimmed;
      else if (provider === "groq") GROQ_KEY = trimmed;
      else if (provider === "gemini") GEMINI_KEY = trimmed;
      else API_KEY = trimmed;
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

  // ── BTC donation endpoints ─────────────────────────────────────────
  if (req.url === "/api/btc-info" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      address: DONATION_BTC_ADDRESS || "",
      configured: !!DONATION_BTC_ADDRESS,
      testnet: BTC_TESTNET,
      min_usd: 1,
      tokens_per_usd: TOKENS_PER_USD,
      model: HAIKU_MODEL_ID,
    }));
    return;
  }

  if (req.url.startsWith("/api/btc-status") && req.method === "GET") {
    const u = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const token = (u.searchParams.get("token") || "").trim();
    const tx = TOKEN_INDEX.get(token);
    const rec = tx ? DONATIONS[tx] : null;
    if (!rec || rec.token !== token) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "token not found" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      remaining_tokens: rec.remaining_tokens,
      total_tokens: rec.total_tokens,
      claimed_at: rec.claimed_at,
      model: HAIKU_MODEL_ID,
    }));
    return;
  }

  if (req.url === "/api/btc-claim" && req.method === "POST") {
    try {
      const ip = clientIp(req);
      if (!btcClaimRate(ip)) {
        res.writeHead(429, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "rate limit exceeded, try again in a minute" }));
        return;
      }
      if (!DONATION_BTC_ADDRESS) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "donation address not configured on server" }));
        return;
      }
      const raw = await readBody(req);
      const body = JSON.parse(raw || "{}");
      const txHash = String(body.tx_hash || "").trim().toLowerCase();
      const claimerEmail = body.claimer_email ? String(body.claimer_email).trim().slice(0, 200) : "";
      if (!/^[0-9a-f]{64}$/.test(txHash)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid tx_hash format" }));
        return;
      }

      // Recovery: existing record returns same token + current quota.
      if (DONATIONS[txHash]) {
        const rec = DONATIONS[txHash];
        auditLog(`recover ip=${ip} tx=${txHash.slice(0,8)}…`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          ok: true, status: "recovered",
          token: rec.token,
          total_tokens: rec.total_tokens,
          remaining_tokens: rec.remaining_tokens,
          sats: rec.sats, btc_usd: rec.btc_usd,
        }));
        return;
      }

      const txResp = await fetchTx(txHash);
      if (txResp.status === 404 || !txResp.body) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "tx not found" }));
        return;
      }
      const tx = txResp.body;
      const confirmed = !!(tx.status && tx.status.confirmed);
      if (!confirmed) {
        res.writeHead(402, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "tx unconfirmed" }));
        return;
      }
      let sats = 0;
      for (const out of tx.vout || []) {
        if (out && out.scriptpubkey_address === DONATION_BTC_ADDRESS) sats += (out.value || 0);
      }
      if (sats <= 0) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "tx does not send to donation address" }));
        return;
      }
      const btcUsd = await fetchBtcUsd();
      if (!btcUsd) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "could not fetch BTC/USD price, try again" }));
        return;
      }
      const usdValue = (sats / 1e8) * btcUsd;
      const totalTokens = Math.floor(usdValue * TOKENS_PER_USD);
      if (totalTokens < 1) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "donation too small, minimum $1 USD equivalent" }));
        return;
      }
      const token = crypto.randomBytes(24).toString("base64url");
      const rec = {
        tx_hash: txHash,
        token,
        total_tokens: totalTokens,
        remaining_tokens: totalTokens,
        sats,
        btc_usd: btcUsd,
        claimed_at: new Date().toISOString(),
        claimer_email: claimerEmail || undefined,
        confirmed_block: (tx.status && tx.status.block_height) || null,
      };
      DONATIONS[txHash] = rec;
      TOKEN_INDEX.set(token, txHash);
      saveDonations(DONATIONS);
      auditLog(`new ip=${ip} sats=${sats} usd=${usdValue.toFixed(2)} tokens=${totalTokens}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        ok: true, status: "new",
        token,
        total_tokens: totalTokens,
        remaining_tokens: totalTokens,
        sats, btc_usd: btcUsd,
      }));
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

      // BTC donation token short-circuit: forces Haiku on the pool key.
      const donation = findDonationToken(req);
      if (donation) {
        if (donation.rec.remaining_tokens <= 0) {
          res.writeHead(402, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "donation quota exhausted", remaining_tokens: 0 }));
          return;
        }
        if (!API_KEY) {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "donation pool unavailable: server has no ANTHROPIC_API_KEY configured" }));
          return;
        }
        const payload = {
          model: HAIKU_MODEL_ID,
          max_tokens: max_tokens || 1024,
          system: system || undefined,
          messages: messages || [],
        };
        const resp = await postAnthropic(payload);
        if (resp.status >= 400) {
          res.writeHead(resp.status, { "Content-Type": "application/json" });
          res.end(JSON.stringify(resp.body));
          return;
        }
        const text = (resp.body.content || []).filter(c => c.type === "text").map(c => c.text).join("");
        const u = resp.body.usage || {};
        const spent = estimateTokens(payload, text, u);
        donation.rec.remaining_tokens = Math.max(0, donation.rec.remaining_tokens - spent);
        DONATIONS[donation.tx] = donation.rec;
        saveDonations(DONATIONS);
        USAGE.input += u.input_tokens || 0;
        USAGE.output += u.output_tokens || 0;
        USAGE.cache_create += u.cache_creation_input_tokens || 0;
        USAGE.cache_read += u.cache_read_input_tokens || 0;
        USAGE.calls += 1;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          text, model: resp.body.model, provider: "anthropic", usage: u,
          donation_remaining: donation.rec.remaining_tokens,
          donation_spent: spent,
        }));
        return;
      }


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
      if (provider === "groq" && !GROQ_KEY) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No GROQ_API_KEY set. Add it via Settings → AI Model, or set in .env." }));
        return;
      }
      if (provider === "gemini" && !GEMINI_KEY) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No GEMINI_API_KEY set. Add it via Settings → AI Model, or set in .env." }));
        return;
      }

      const payload = {
        model: chosenModel,
        max_tokens: max_tokens || 1024,
        system: system || undefined,
        messages: messages || [],
      };

      let resp;
      if (provider === "xai")         resp = await postXAI(payload);
      else if (provider === "groq")   resp = await postGroq(payload);
      else if (provider === "gemini") resp = await postGemini(payload);
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
  console.log(`│    · groq       ${GROQ_KEY ? "✓ key set" : "✗ no key  (set GROQ_API_KEY)"}`);
  console.log(`│    · gemini     ${GEMINI_KEY ? "✓ key set" : "✗ no key  (set GEMINI_API_KEY)"}`);
  console.log(`│    · ollama     ${OLLAMA_STATUS.ok ? `✓ ${OLLAMA_STATUS.models.length} local model(s) @ ${OLLAMA_URL}` : `✗ not running @ ${OLLAMA_URL}`}`);
  console.log(`│`);
  console.log(`│  desktop: http://localhost:${PORT}`);
  for (const a of lan) console.log(`│  phone:   http://${a.address}:${PORT}   (${a.iface})`);
  console.log(`└────────────────────────────────────────────────────────────\n`);
});
