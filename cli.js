#!/usr/bin/env node
// CODEX terminal client. Read scripture + run Oracle/panels from the shell.
// Pure Node 18+, no deps. Talks to bible-api.com for verses and to a
// locally-running CODEX server (default http://localhost:3001) for AI calls.

const SERVER = process.env.CODEX_SERVER || "http://localhost:3001";
const BIBLE_API = "https://bible-api.com";

// Tiny ANSI helpers — no chalk, no deps.
const c = {
  bold:  s => `\x1b[1m${s}\x1b[22m`,
  dim:   s => `\x1b[2m${s}\x1b[22m`,
  cyan:  s => `\x1b[36m${s}\x1b[39m`,
  white: s => `\x1b[37m${s}\x1b[39m`,
  red:   s => `\x1b[31m${s}\x1b[39m`,
  green: s => `\x1b[32m${s}\x1b[39m`,
  yellow:s => `\x1b[33m${s}\x1b[39m`,
};

const HELP = `${c.bold("CODEX cli")} — read scripture and run AI panels from the terminal.

${c.bold("USAGE")}
  node cli.js <reference> [--translation <id>] [--panels <a,b,c>]
  node cli.js --oracle <question>
  node cli.js --search <query>
  node cli.js --help

${c.bold("EXAMPLES")}
  node cli.js "John 3:16"
  node cli.js "John 3:16" --translation kjv
  node cli.js "Gen 1" --panels commentary,talmud
  node cli.js --oracle "What is grace?"
  node cli.js --search "love your enemies"

${c.bold("PANELS")}  commentary, talmud, gematria, gnosis, crossRefs  (comma-separated, or 'all')
${c.bold("ENV")}     CODEX_SERVER (default ${SERVER})
`;

// Hand-rolled arg parser. Boolean & string flags, plus positional ref.
function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") { out.flags.help = true; continue; }
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out.flags[key] = true;
      else { out.flags[key] = next; i++; }
    } else {
      out._.push(a);
    }
  }
  return out;
}

async function fetchVerse(ref, translation) {
  const t = (translation || "web").toLowerCase();
  const url = `${BIBLE_API}/${encodeURIComponent(ref)}?translation=${encodeURIComponent(t)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`bible-api HTTP ${r.status} for "${ref}" (${t})`);
  return r.json();
}

function renderPassage(data, translation) {
  const ref = data.reference || "(passage)";
  const t = (data.translation_id || translation || "web").toUpperCase();
  console.log("");
  console.log(c.bold(c.cyan(ref)) + "  " + c.dim(`[${t}]`));
  console.log(c.dim("─".repeat(Math.min(60, ref.length + t.length + 4))));
  const verses = Array.isArray(data.verses) ? data.verses : [];
  if (verses.length === 0 && data.text) {
    console.log(c.white(data.text.trim()));
  } else {
    for (const v of verses) {
      const num = c.dim(`${v.chapter}:${v.verse}`);
      console.log(`  ${num}  ${c.white((v.text || "").trim())}`);
    }
  }
  console.log("");
}

async function callChat({ system, messages, max_tokens }) {
  let r;
  try {
    r = await fetch(`${SERVER}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, messages, max_tokens: max_tokens || 1024 }),
    });
  } catch (e) {
    throw new Error(`Cannot reach CODEX server at ${SERVER} — is it running?  (start with: node server.js)\n  underlying: ${e.message}`);
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `server HTTP ${r.status}`);
  return data;
}

async function runOracle(question) {
  const system = "You are the CODEX ORACLE — a scholarly, multi-tradition Bible study companion. Answer clearly and concisely, drawing on Christian, Jewish, and esoteric traditions where relevant. No proselytising.";
  console.log(c.dim(`\nOracle ← ${question}\n`));
  const data = await callChat({
    system,
    messages: [{ role: "user", content: question }],
    max_tokens: 1200,
  });
  console.log(c.white((data.text || "").trim()));
  console.log("");
  if (data.usage) console.log(c.dim(`  tokens: in=${data.usage.input_tokens||0} out=${data.usage.output_tokens||0}`));
}

// System prompt replicated from panels-gen.js. Kept in-sync manually.
const PANELS_SYSTEM = `You are the CODEX PANEL DRAFTER. Output a single JSON object describing companion study material for a Bible passage. Scholarly, multi-tradition, never proselytising.

OUTPUT FORMAT — RETURN ONLY a single JSON object, no prose, no fences. Be COMPACT. Schema:

{
  "title": "4-6 words, may use Greek/Hebrew",
  "subtitle": "one short clause naming the passage's main theme",
  "talmud": [
    { "ref":"e.g. b. Berakhot 7a / Genesis Rabbah 1:1", "heading":"short heading",
      "body":"40-70 words of scholarly Talmudic/midrashic parallel",
      "tag":"short Hebrew/Aramaic + transliteration in 'quotes'" }
  ],
  "commentary": [
    { "from":"Patristic|Reformation|Modern|Devotional",
      "author":"specific commentator + work",
      "body":"40-60 words" }
  ],
  "gematria": [
    { "term":"word in native script", "translit":"...",
      "meaning":"2-4 word gloss", "value":<int>,
      "system":"Mispar Hechrachi|Greek isopsephy" }
  ],
  "gematriaNotes": [ "..." ],
  "gnosis": [
    { "sigil":"single unicode glyph", "title":"esoteric reading title",
      "body":"40-70 words, gnostic/hermetic/kabbalistic/perennialist lens" }
  ],
  "crossRefs": [
    { "ref":"Book ch:vv", "note":"under 10 words" }
  ]
}

Rules:
- Use accurate citations when known; otherwise pick plausible tractates for the topic.
- Calm scholarly tone. No exclamations. No emoji (sigils OK).
- Real gematria values (אהבה=13, λόγος=373, etc.).
- Return ONLY the JSON. No commentary outside it. Stay compact so the response completes.`;

function extractJSON(text) {
  if (!text) throw new Error("empty response");
  let s = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const i = s.indexOf("{");
  const j = s.lastIndexOf("}");
  if (i === -1) throw new Error("no JSON found in model output");
  return JSON.parse(s.slice(i, j + 1));
}

function wrap(text, width, indent) {
  const pad = " ".repeat(indent);
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > width) { lines.push(pad + line.trim()); line = w; }
    else line += " " + w;
  }
  if (line.trim()) lines.push(pad + line.trim());
  return lines.join("\n");
}

function renderPanels(obj, which) {
  const want = new Set(which);
  const all = want.has("all");
  console.log("");
  console.log(c.bold(c.cyan(obj.title || "Untitled")));
  if (obj.subtitle) console.log(c.dim(obj.subtitle));
  console.log("");

  const section = (key, label) => {
    if (!all && !want.has(key)) return;
    const arr = obj[key] || [];
    if (!arr.length && !(key === "gematria" && (obj.gematriaNotes || []).length)) return;
    console.log(c.bold(c.yellow("▸ " + label.toUpperCase())));
    console.log("");
    if (key === "talmud") {
      for (const t of arr) {
        console.log("  " + c.cyan(t.ref || "") + "  " + c.dim(t.tag || ""));
        if (t.heading) console.log("  " + c.bold(t.heading));
        console.log(wrap(t.body, 76, 2));
        console.log("");
      }
    } else if (key === "commentary") {
      for (const cm of arr) {
        console.log("  " + c.cyan(`[${cm.from || "?"}]`) + " " + c.bold(cm.author || ""));
        console.log(wrap(cm.body, 76, 2));
        console.log("");
      }
    } else if (key === "gematria") {
      for (const g of arr) {
        console.log(`  ${c.bold(g.term || "")}  ${c.dim(g.translit || "")}  = ${c.yellow(String(g.value))}  ${c.dim(`(${g.meaning || ""} · ${g.system || ""})`)}`);
      }
      if ((obj.gematriaNotes || []).length) {
        console.log("");
        for (const n of obj.gematriaNotes) console.log(wrap("• " + n, 76, 2));
      }
      console.log("");
    } else if (key === "gnosis") {
      for (const g of arr) {
        console.log("  " + c.cyan(g.sigil || "•") + "  " + c.bold(g.title || ""));
        console.log(wrap(g.body, 76, 2));
        console.log("");
      }
    } else if (key === "crossRefs") {
      for (const x of arr) console.log("  " + c.cyan(x.ref) + "  " + c.dim(x.note || ""));
      console.log("");
    }
  };

  section("commentary", "Commentary");
  section("talmud", "Talmud / Midrash");
  section("gematria", "Gematria");
  section("gnosis", "Gnosis");
  section("crossRefs", "Cross References");
}

async function runPanels(ref, panelList) {
  const which = (panelList === true || !panelList ? ["all"] : String(panelList).split(",").map(s => s.trim()).filter(Boolean));
  console.log(c.dim(`\nGenerating panels for ${ref}…`));
  const data = await callChat({
    system: PANELS_SYSTEM,
    messages: [{ role: "user", content: `Draft the CODEX panels for: ${ref}.\nReturn ONLY the JSON object as specified in the system instructions.` }],
    max_tokens: 3000,
  });
  let parsed;
  try { parsed = extractJSON(data.text || ""); }
  catch (e) {
    console.error(c.red("Failed to parse panel JSON: " + e.message));
    console.error(c.dim((data.text || "").slice(0, 500)));
    process.exit(1);
  }
  renderPanels(parsed, which);
}

async function runSearch(query) {
  const system = "You are a Bible scripture-search helper. The user gives a phrase or theme; return a JSON array of up to 8 matching passages. Schema: [{\"ref\":\"Book ch:vv\",\"translation\":\"WEB\",\"text\":\"verse text\",\"why\":\"under 12 words why this matches\"}]. Return ONLY the JSON array.";
  console.log(c.dim(`\nSearching: ${query}\n`));
  const data = await callChat({
    system,
    messages: [{ role: "user", content: query }],
    max_tokens: 1500,
  });
  let arr;
  try {
    const s = (data.text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const i = s.indexOf("["), j = s.lastIndexOf("]");
    arr = JSON.parse(s.slice(i, j + 1));
  } catch (e) {
    console.error(c.red("Failed to parse search results: " + e.message));
    console.error(c.dim((data.text || "").slice(0, 500)));
    process.exit(1);
  }
  for (const hit of arr) {
    console.log(c.bold(c.cyan(hit.ref || "?")) + "  " + c.dim(`[${hit.translation || "WEB"}]`));
    console.log(wrap(hit.text || "", 76, 2));
    if (hit.why) console.log(c.dim("  → " + hit.why));
    console.log("");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.flags.help || (args._.length === 0 && !args.flags.oracle && !args.flags.search)) {
    console.log(HELP);
    process.exit(args.flags.help ? 0 : 1);
  }

  try {
    if (args.flags.oracle) {
      const q = args.flags.oracle === true ? args._.join(" ") : args.flags.oracle;
      if (!q) throw new Error("--oracle needs a question");
      await runOracle(q);
      return;
    }
    if (args.flags.search) {
      const q = args.flags.search === true ? args._.join(" ") : args.flags.search;
      if (!q) throw new Error("--search needs a query");
      await runSearch(q);
      return;
    }

    const ref = args._.join(" ").trim();
    if (!ref) throw new Error("missing scripture reference");
    const translation = args.flags.translation || "web";

    // Always fetch + print the passage first.
    const data = await fetchVerse(ref, translation);
    renderPassage(data, translation);

    if (args.flags.panels) await runPanels(ref, args.flags.panels);
  } catch (e) {
    console.error(c.red("Error: ") + (e.message || String(e)));
    process.exit(1);
  }
}

main();
