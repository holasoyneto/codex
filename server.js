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
const MODEL = process.env.CODEX_MODEL || "claude-haiku-4-5-20251001";

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

const server = http.createServer(async (req, res) => {
  // CORS for localhost dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.url === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, hasKey: !!API_KEY, model: MODEL, usage: USAGE }));
    return;
  }

  if (req.url === "/api/key" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const { key } = JSON.parse(raw);
      if (!key || !key.startsWith("sk-")) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid key — must start with sk-" }));
        return;
      }
      API_KEY = key.trim();
      // Persist to .env for next restart so the user only enters it once.
      try {
        const envPath = path.join(DIR, ".env");
        let body = "";
        try { body = fs.readFileSync(envPath, "utf8"); } catch {}
        if (/^ANTHROPIC_API_KEY\s*=/m.test(body)) {
          body = body.replace(/^ANTHROPIC_API_KEY\s*=.*$/m, `ANTHROPIC_API_KEY=${API_KEY}`);
        } else {
          body = (body ? body.trimEnd() + "\n" : "") + `ANTHROPIC_API_KEY=${API_KEY}\n`;
        }
        fs.writeFileSync(envPath, body, { mode: 0o600 });
      } catch (e) {
        console.warn("Could not persist key to .env:", e.message);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, hasKey: true }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(e.message || e) }));
    }
    return;
  }

  if (req.url === "/api/chat" && req.method === "POST") {
    if (!API_KEY) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "No ANTHROPIC_API_KEY set on the server. Restart with: ANTHROPIC_API_KEY=sk-ant-… node server.js" }));
      return;
    }
    try {
      const raw = await readBody(req);
      const { system, messages, max_tokens, model } = JSON.parse(raw);
      // Allow the client to request a specific model. Whitelist what we'll
      // accept so a poisoned client payload can't aim at an expensive model.
      const ALLOWED = new Set([
        "claude-haiku-4-5-20251001",
        "claude-sonnet-4-6",
        "claude-opus-4-7",
      ]);
      const chosenModel = (model && ALLOWED.has(model)) ? model : MODEL;
      const resp = await postAnthropic({
        model: chosenModel,
        max_tokens: max_tokens || 1024,
        system: system || undefined,
        messages: messages || [],
      });
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
      res.end(JSON.stringify({ text, model: resp.body.model, usage: u }));
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

server.listen(PORT, "0.0.0.0", () => {
  const lan = lanAddresses();
  console.log(`\n┌─ CODEX server  ────────────────────────────────────────────`);
  console.log(`│  port:  ${PORT}`);
  console.log(`│  key:   ${API_KEY ? "set" : "MISSING — Oracle disabled until you add a key"}`);
  console.log(`│  model: ${MODEL}`);
  console.log(`│`);
  console.log(`│  desktop: http://localhost:${PORT}`);
  for (const a of lan) console.log(`│  phone:   http://${a.address}:${PORT}   (${a.iface})`);
  console.log(`└────────────────────────────────────────────────────────────\n`);
});
