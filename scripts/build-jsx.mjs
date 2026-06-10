// build-jsx.mjs — the SPEED foundation: pre-transpile every .jsx the app
// declares to plain JS in dist/, so the browser never runs Babel again.
//
// Zero new deps: uses the same @babel/standalone (devDependency) that used
// to run IN the browser — same `react` preset, so output is byte-for-intent
// identical to what babel-standalone produced at runtime. Modern syntax
// (optional chaining etc.) passes through untouched, exactly as before —
// every supported browser already ran it natively.
//
// The deploy story stays zero-build for USERS: dist/*.js are committed and
// shipped as plain <script> tags. This script is dev tooling only — run it
// after editing any .jsx:   npm run build   (or node scripts/build-jsx.mjs)
//
// Doubles as the .jsx syntax gate: any parse error fails the build loudly.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Babel = require("@babel/standalone");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

// The build order is the document order — read it from index.html itself so
// the two can never drift. Accepts both the legacy text/babel tags and the
// dist tags (so the script is idempotent over an already-converted file).
const jsxFiles = [];
const re = /<script[^>]*src="(?:dist\/)?([A-Za-z0-9_.-]+?)\.(jsx|js)"[^>]*><\/script>/g;
let m;
while ((m = re.exec(html))) {
  const isBabel = /type="text\/babel"/.test(m[0]);
  const isDist = /src="dist\//.test(m[0]);
  if (isBabel || (isDist && m[2] === "js")) jsxFiles.push(m[1] + ".jsx");
}
if (!jsxFiles.length) {
  console.error("[build] no .jsx script tags found in index.html — nothing to do");
  process.exit(1);
}

mkdirSync(join(ROOT, "dist"), { recursive: true });

let failed = 0;
for (const f of jsxFiles) {
  const src = readFileSync(join(ROOT, f), "utf8");
  try {
    const out = Babel.transform(src, {
      presets: ["react"],
      filename: f,
      sourceMaps: false,
      compact: false,
      retainLines: true, // line numbers in stack traces still point home
    });
    const banner = `// GENERATED from ${f} by scripts/build-jsx.mjs — do not edit; edit the .jsx and run \`npm run build\`.\n`;
    // IIFE wrapper — faithful to how babel-standalone executed text/babel
    // scripts (each in its own lexical scope). Without it, top-level consts
    // in different files (e.g. `const { useState } = React`) collide in the
    // shared global scope of plain <script> files. Globals still escape via
    // Object.assign(window, ...) exactly as before.
    const wrapped = banner + "(function () {\n" + out.code + "\n})();\n";
    writeFileSync(join(ROOT, "dist", basename(f, ".jsx") + ".js"), wrapped);
    console.log(`[build] ${f} → dist/${basename(f, ".jsx")}.js (${(out.code.length / 1024).toFixed(0)} KB)`);
  } catch (e) {
    failed++;
    console.error(`[build] FAIL ${f}: ${e.message}`);
  }
}
if (failed) { console.error(`[build] ${failed} file(s) failed`); process.exit(1); }
console.log(`[build] OK — ${jsxFiles.length} files transpiled`);
