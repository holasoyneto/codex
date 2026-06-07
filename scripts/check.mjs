// scripts/check.mjs — Phase 0.5 JSX/JS parse gate.
//
// Reads index.html, extracts every LOCAL <script src="...js|.jsx"> file in the
// exact order it appears, and parses each one. The worst no-build failure is a
// single bad .jsx → blank page for ALL users; this catches it before ship,
// without changing what the browser loads.
//
//   .jsx  → transpiled with the pinned @babel/standalone (presets:['react'])
//           inside a try/catch. If @babel/standalone is not installed, .jsx
//           files are WARNED (skipped), not failed — the script stays usable
//           offline / without `npm install`.
//   .js   → parsed with node:vm `new Script` (syntax-only; never executed).
//
// Self-check: read the @babel/standalone version out of index.html and fail if
// it differs from package.json (kills CI-vs-browser transpiler drift).
//
// Exit code: non-zero if any file has a syntax error (or version drift).

import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const errors = [];
const warnings = [];

function fail(file, msg) {
  errors.push(`  ✗ ${file}: ${msg}`);
}
function warn(msg) {
  warnings.push(`  ! ${msg}`);
}

// ── 1. Read index.html, extract local script srcs (in order) ──────────────
const indexPath = path.join(ROOT, "index.html");
let html;
try {
  html = await readFile(indexPath, "utf8");
} catch (e) {
  console.error(`[check] cannot read ${indexPath}: ${e && e.message}`);
  process.exit(2);
}

// Match <script ... src="..."> capturing the src. Only LOCAL (non-http) .js/.jsx.
const srcRe = /<script\b[^>]*\bsrc=("|')([^"']+)\1[^>]*>/gi;
const files = [];
let m;
while ((m = srcRe.exec(html)) !== null) {
  const src = m[2].trim();
  if (/^https?:\/\//i.test(src) || src.startsWith("//")) continue; // CDN
  if (!/\.(jsx|js)$/i.test(src)) continue;
  files.push(src);
}

if (files.length === 0) {
  console.error("[check] no local .js/.jsx <script src> found in index.html");
  process.exit(2);
}

// ── 2. Version drift self-check (index.html ↔ package.json) ────────────────
const idxBabel = (html.match(/@babel\/standalone@([0-9][0-9.\-A-Za-z]*)/) || [])[1] || null;
let pkgBabel = null;
try {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const dd = pkg.devDependencies || {};
  pkgBabel = (dd["@babel/standalone"] || "").replace(/^[~^]/, "") || null;
} catch (e) {
  warn(`could not read package.json for version check: ${e && e.message}`);
}
if (idxBabel && pkgBabel && idxBabel !== pkgBabel) {
  fail(
    "index.html / package.json",
    `@babel/standalone version drift: index.html=${idxBabel} package.json=${pkgBabel}`
  );
}

// ── 3. Try to load @babel/standalone (optional) ───────────────────────────
let Babel = null;
try {
  const mod = await import("@babel/standalone");
  Babel = mod.default || mod;
  if (Babel && typeof Babel.transform !== "function") Babel = null;
} catch (_) {
  Babel = null;
}
if (!Babel) {
  warn(
    "@babel/standalone not installed — .jsx files will be WARNED (skipped), .js still parsed. Run `npm install` for full coverage."
  );
}

// ── 4. Parse each file ────────────────────────────────────────────────────
let checked = 0;
let skipped = 0;
for (const rel of files) {
  const abs = path.join(ROOT, rel);
  if (!existsSync(abs)) {
    fail(rel, "file not found on disk");
    continue;
  }
  let code;
  try {
    code = readFileSync(abs, "utf8");
  } catch (e) {
    fail(rel, `cannot read: ${e && e.message}`);
    continue;
  }

  const isJsx = /\.jsx$/i.test(rel);
  if (isJsx) {
    if (!Babel) {
      skipped++;
      continue; // warned globally above
    }
    try {
      Babel.transform(code, {
        presets: ["react"],
        filename: rel,
        sourceType: "script",
        ast: false,
        code: false
      });
      checked++;
    } catch (e) {
      fail(rel, `JSX syntax error: ${(e && e.message) || e}`);
    }
  } else {
    // .js — syntax-only parse via node:vm. Never executes the code.
    try {
      // eslint-disable-next-line no-new
      new vm.Script(code, { filename: rel });
      checked++;
    } catch (e) {
      fail(rel, `JS syntax error: ${(e && e.message) || e}`);
    }
  }
}

// ── 5. Report ─────────────────────────────────────────────────────────────
console.log(`[check] index.html declares ${files.length} local script file(s).`);
console.log(`[check] parsed OK: ${checked}${skipped ? `, skipped (no babel): ${skipped}` : ""}`);
if (warnings.length) {
  console.warn("[check] warnings:");
  for (const w of warnings) console.warn(w);
}
if (errors.length) {
  console.error("[check] FAILED — syntax/parse errors:");
  for (const e of errors) console.error(e);
  process.exit(1);
}
console.log("[check] OK — all parsed files are syntactically valid.");
process.exit(0);
