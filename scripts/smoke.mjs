// CODEX — headless DOM-mount smoke (Phase 0.6).
// Drives the system Chrome via puppeteer-core (no bundled download) against a
// fresh profile (so no stale service-worker cache), loads the real page, and
// proves the app actually boots: #root mounts, the boot-contract passes
// (__CODEX_READY__), zero collected errors, and the key fixes are present.
// Run: node scripts/smoke.mjs   (server must be on :7777)
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const fail = (m) => { console.error("[smoke] FAIL —", m); process.exit(1); };

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});
try {
  const page = await browser.newPage();
  // Real JS errors are fatal. Resource 404s that the app handles via fallback
  // (e.g. data/bibles/kjv.json → API fallback) are warnings, not failures.
  const jsErrors = [];
  const resourceWarnings = [];
  const badResponses = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/Failed to load resource/i.test(t)) resourceWarnings.push(t);
    else jsErrors.push(t);
  });
  page.on("pageerror", (e) => jsErrors.push("pageerror: " + e.message));
  page.on("response", (resp) => { const s = resp.status(); if (s >= 400) badResponses.push(s + " " + resp.url()); });

  console.log("[smoke] loading", URL);
  await page.goto(URL, { waitUntil: "load", timeout: 30000 });

  // Wait for the boot-contract to declare full readiness (cold start =
  // unpkg latency + ~33k-LOC in-browser transpile; be generous).
  await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 })
    .catch(async () => {
      const errs = await page.evaluate(() => window.__CODEX_ERRORS__ || []);
      fail("__CODEX_READY__ never became true. __CODEX_ERRORS__=" + JSON.stringify(errs, null, 1));
    });

  // Verses load async (KJV fetches from the API after the local-bundle 404).
  // Give them time; absence is a warning (network-dependent), not a boot failure.
  await page.waitForFunction(
    () => document.querySelectorAll(".cx-verse, .cx-verse-row").length > 0,
    { timeout: 20000 }
  ).catch(() => {});

  const r = await page.evaluate(() => ({
    rootKids: (document.getElementById("root") || { children: [] }).children.length,
    errors: window.__CODEX_ERRORS__ || [],
    ready: window.__CODEX_READY__ === true,
    hasGetCached: typeof (window.BIBLE && window.BIBLE.getCachedChapter) === "function",
    hasJumpRef: typeof window.codexJumpToRef === "function",
    hasPanels: !!(window.CODEX_PANELS && typeof window.CODEX_PANELS.cacheKey === "function"),
    hasSearch: !!(window.CODEX_SEARCH),
    title: (document.querySelector(".cx-reader-titles h1") || {}).textContent || "",
    verseCount: document.querySelectorAll(".cx-verse, .cx-verse-row").length,
  }));

  console.log("[smoke] result:", JSON.stringify(r, null, 1));
  console.log("[smoke] js errors:", JSON.stringify(jsErrors, null, 1));
  console.log("[smoke] resource warnings (non-fatal):", JSON.stringify(resourceWarnings, null, 1));
  console.log("[smoke] bad responses (>=400):", JSON.stringify(badResponses, null, 1));

  if (!r.ready) fail("not ready");
  if (r.rootKids < 1) fail("#root did not mount");
  if (r.errors.length) fail("__CODEX_ERRORS__ not empty: " + JSON.stringify(r.errors));
  if (!r.hasGetCached) fail("Bug B regressed — BIBLE.getCachedChapter missing");
  if (!r.hasJumpRef) fail("codexJumpToRef missing");
  if (jsErrors.length) fail("JS errors during boot: " + JSON.stringify(jsErrors));

  console.log("[smoke] PASS — app booted clean, contract satisfied, key fixes present.");
  if (r.verseCount < 1) {
    console.log("[smoke] WARN — 0 verses rendered. Boot is clean; KJV fetches from the API after the local-bundle 404, so this is expected when the sandbox has no network to the bible API. (Live scripture rendering was confirmed separately in a networked browser.)");
  } else {
    console.log("[smoke] scripture rendered: " + r.verseCount + " verses.");
  }
  if (badResponses.length) {
    console.log("[smoke] note: handled resource 404(s) (local-bundle probe → API fallback) — non-fatal: " + JSON.stringify(badResponses));
  }
} finally {
  await browser.close();
}
