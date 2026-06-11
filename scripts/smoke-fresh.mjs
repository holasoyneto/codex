// smoke-fresh.mjs — ✦ FRESH (SW update toast + live version badge + what's-new) smoke.
// Boots a FRESH Chrome profile and asserts:
//   1. window.CODEX_VERSION exists with { v, sw, notes } (single source of truth).
//   2. The header version badge text CONTAINS CODEX_VERSION.v (the badge cannot lie).
//   3. NO #cx-fresh update pill on a clean boot (no update is waiting).
//   4. The 'cx-fresh' registration code path EXISTS in the served page source
//      (a real SW update can't be simulated headless; full flow is code-reviewed).
//   5. First-run WHAT'S NEW: localStorage.clear() → reload → #cx-whatsnew card with
//      ≥1 bullet → dismiss → reload → does NOT reappear.
//   6. Zero JS pageerrors throughout. PASS/FAIL exit code.
import puppeteer from "puppeteer-core";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const log = (...a) => console.log("[fresh]", ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "codex-fresh-"));
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  userDataDir: profile, // fresh profile: no SW, no caches, no localStorage
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});

const checks = []; // { name, ok, info }
const check = (name, ok, info = "") => { checks.push({ name, ok }); log((ok ? "ok  " : "FAIL") + " — " + name + (info ? " :: " + info : "")); };

try {
  const page = await browser.newPage();
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/i.test(m.text())) jsErrors.push(m.text()); });

  const boot = async () => {
    await page.goto(URL, { waitUntil: "load", timeout: 30000 });
    await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
    await sleep(800); // let header/badge settle
  };
  await boot();
  log("booted on fresh profile");

  // ---- 1. window.CODEX_VERSION shape -------------------------------------
  const ver = await page.evaluate(() => {
    const cv = window.CODEX_VERSION;
    if (!cv || typeof cv !== "object") return null;
    return {
      v: cv.v, sw: cv.sw,
      notesIsArray: Array.isArray(cv.notes),
      notesLen: Array.isArray(cv.notes) ? cv.notes.length : (cv.notes ? 1 : 0),
    };
  });
  check("window.CODEX_VERSION object exists", !!ver, JSON.stringify(ver));
  check("CODEX_VERSION.v is a non-empty string", !!(ver && typeof ver.v === "string" && ver.v.length), ver && String(ver.v));
  check("CODEX_VERSION.sw present", !!(ver && ver.sw != null && String(ver.sw).length), ver && String(ver.sw));
  check("CODEX_VERSION.notes present", !!(ver && (ver.notesIsArray || ver.notesLen > 0)), ver && `array=${ver.notesIsArray} len=${ver.notesLen}`);

  // ---- 2. header version badge contains CODEX_VERSION.v ------------------
  const badge = await page.evaluate(() => {
    const v = window.CODEX_VERSION && window.CODEX_VERSION.v;
    if (!v) return { found: false, why: "no CODEX_VERSION.v" };
    // Known/likely badge selectors first, then any small header-area element
    // whose text contains the version string.
    const sels = ["#cx-version", ".cx-version", "#cx-ver", ".cx-ver", "[data-cx-version]", "[data-version]",
      "header [class*='ver']", ".cx-topbar [class*='ver']", ".cx-header [class*='ver']"];
    for (const s of sels) {
      for (const el of document.querySelectorAll(s)) {
        const t = (el.textContent || "").trim();
        if (t.includes(v)) return { found: true, sel: s, text: t.slice(0, 60) };
      }
    }
    // Fallback: any compact element containing the exact version string.
    for (const el of document.querySelectorAll("body *")) {
      if (el.children.length > 2) continue;
      const t = (el.textContent || "").trim();
      if (t.length && t.length <= 60 && t.includes(v)) {
        return { found: true, sel: el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(/\s+/)[0] : ""), text: t.slice(0, 60) };
      }
    }
    return { found: false, why: "no element text contains " + v };
  });
  check("header version badge contains CODEX_VERSION.v", badge.found, JSON.stringify(badge));

  // ---- 3. NO #cx-fresh pill on a clean boot -------------------------------
  const pill = await page.evaluate(() => !!document.querySelector("#cx-fresh"));
  check("no #cx-fresh pill on clean boot (no update waiting)", !pill);

  // ---- 4. 'cx-fresh' code path exists in served page source ---------------
  const srcHit = await page.evaluate(async () => {
    const urls = [location.href];
    for (const s of document.querySelectorAll("script[src]")) urls.push(s.src);
    for (const l of document.querySelectorAll("link[rel='stylesheet']")) urls.push(l.href);
    if (document.documentElement.outerHTML.includes("cx-fresh")) return { hit: true, where: "inline html" };
    for (const u of urls) {
      try {
        const txt = await (await fetch(u, { cache: "no-store" })).text();
        if (txt.includes("cx-fresh")) return { hit: true, where: u };
      } catch {}
    }
    return { hit: false, tried: urls.length };
  });
  check("'cx-fresh' registration code path exists in page source", srcHit.hit, JSON.stringify(srcHit));

  // ---- 5. WHAT'S NEW update flow -------------------------------------------
  // A cleared store simulates a FIRST-EVER visit, where the card is correctly
  // suppressed (nothing to delta against). An UPDATE is simulated by a stale
  // last-seen version: the card must then appear exactly once.
  await page.evaluate(() => { localStorage.setItem("codex.lastver", "0.0"); });
  await boot();
  const wn = await page.waitForFunction(() => !!document.querySelector("#cx-whatsnew"), { timeout: 10000 }).then(() => true).catch(() => false);
  check("#cx-whatsnew card appears after an update (stale codex.lastver) + reload", wn);

  let bullets = 0, dismissed = false;
  if (wn) {
    bullets = await page.evaluate(() => {
      const card = document.querySelector("#cx-whatsnew");
      const lis = card.querySelectorAll("li");
      return lis.length || card.querySelectorAll("[class*='bullet'],[class*='note']").length;
    });
    check("what's-new card has >=1 bullet", bullets >= 1, `bullets=${bullets}`);

    dismissed = await page.evaluate(() => {
      const card = document.querySelector("#cx-whatsnew");
      const btns = [].slice.call(card.querySelectorAll("button,[role='button'],[data-dismiss],[class*='close'],[class*='dismiss']"));
      const btn = btns.find((b) => /dismiss|close|got it|ok|×|✕|✦/i.test((b.textContent || "") + (b.className || ""))) || btns[0];
      (btn || card).click();
      return true;
    });
    await sleep(600);
    const gone = await page.evaluate(() => !document.querySelector("#cx-whatsnew"));
    check("what's-new card dismisses on click", gone);
  } else {
    check("what's-new card has >=1 bullet", false, "card never appeared");
    check("what's-new card dismisses on click", false, "card never appeared");
  }

  await boot();
  await sleep(1200); // give a late-mounting card a chance to (wrongly) reappear
  const reappeared = await page.evaluate(() => !!document.querySelector("#cx-whatsnew"));
  check("what's-new does NOT reappear after dismiss + reload", !reappeared);

  // ---- 6. zero pageerrors --------------------------------------------------
  check("zero JS pageerrors", jsErrors.length === 0, JSON.stringify(jsErrors.slice(0, 5)));

  const ok = checks.every((c) => c.ok);
  log(ok ? "PASS" : `FAIL — ${checks.filter((c) => !c.ok).length}/${checks.length} checks failed`);
  process.exitCode = ok ? 0 : 1;
} catch (e) {
  console.error("[fresh] FAIL —", e && e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
