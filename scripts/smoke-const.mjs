// smoke-const.mjs — ❂ CONSTELLATION smoke, v9.3 galaxy-only contract:
// open → TSK aggregates (first run fetches ~5 MB) → boots DIRECTLY into the
// 3D galaxy (no ring, no view toggle) → stars render with stats → NEAR query
// flies the camera and lists neighbors → double-click ground truth: a star
// jump changes the reader. v11.4: THE GALAXY FOLLOWS THE READER — codexGoto
// elsewhere fires codex:now → zoom-out flight (telemetry) + gold walked-trail
// polyline (__CODEX_CONST_TRAIL) + dossier follows + ⌫ TRAIL chip clears.
// Zero pageerrors.
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const log = (...a) => console.log("[const]", ...a);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push("pageerror: " + e.message));
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(URL, { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
  await page.waitForFunction(() => document.querySelectorAll(".cx-verse,.cx-verse-row").length > 0, { timeout: 20000 });

  await page.evaluate(() => window.codexOpenConstellation());
  await page.waitForFunction(() => document.querySelector(".cx-const-canvas, .cx-const-err"), { timeout: 120000 });
  const isErr = await page.evaluate(() => !!document.querySelector(".cx-const-err"));
  if (isErr) {
    log("error state:", await page.evaluate(() => (document.querySelector(".cx-const-err code")||{}).textContent));
    log(jsErrors.length === 0 ? "PASS (clean error state)" : "FAIL");
    process.exitCode = jsErrors.length === 0 ? 0 : 1;
  } else {
    // galaxy layout runs (or loads from codex.galaxy.v1); wait it out
    await page.waitForFunction(() => !document.querySelector(".cx-const-laying"), { timeout: 120000 });
    await new Promise(r => setTimeout(r, 1500));

    const state = await page.evaluate(() => ({
      galaxyCanvas: !!document.querySelector(".cx-const-canvas.is-galaxy"),
      viewToggle: [...document.querySelectorAll(".cx-const-tools button")].some(b => /RING|GALAXY/.test(b.textContent)),
      stats: (document.querySelector(".cx-const-stats")||{}).textContent || "",
      cached: !!localStorage.getItem("codex.galaxy.v1"),
    }));
    log("state:", JSON.stringify(state));

    // NEAR query — the instrument must fly the camera + list neighbors
    await page.evaluate(() => {
      const inp = document.querySelector(".cx-const-q");
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(inp, "Isaiah 53");
      inp.dispatchEvent(new Event("input", { bubbles: true }));
      inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 1400));
    const near = await page.evaluate(() => ({
      box: !!document.querySelector(".cx-const-near"),
      rows: document.querySelectorAll(".cx-const-near li").length,
    }));
    log("NEAR Isaiah 53:", JSON.stringify(near));

    // double-click center → the star the camera flew to → reader jumps
    const rect = await page.evaluate(() => {
      const r = document.querySelector(".cx-const-canvas").getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.click(rect.x, rect.y, { clickCount: 2 });
    await new Promise(r => setTimeout(r, 1800));
    const title = await page.evaluate(() => (document.querySelector(".cx-reader-titles h1, h1")||{}).textContent || "");
    log("reader after double-click:", title);

    // ── v11.4 THE GALAXY FOLLOWS THE READER ──────────────────────────────
    // navigate the reader elsewhere (codexGoto → codex:now) while the galaxy
    // is open: the camera must fly OUT (flight telemetry), the gold walked
    // trail must grow, and the dossier must land on the new star.
    const before = await page.evaluate(() => ({
      flights: (window.__CODEX_CONST_FLIGHT || {}).flights || 0,
      trail: window.__CODEX_CONST_TRAIL || 0,
      dist: 0,
    }));
    await page.evaluate(() => window.codexGoto("rev", 21, 1));
    await new Promise(r => setTimeout(r, 2600));
    const follow = await page.evaluate(() => ({
      flights: (window.__CODEX_CONST_FLIGHT || {}).flights || 0,
      maxDist: (window.__CODEX_CONST_FLIGHT || {}).lastMaxDist || 0,
      trail: window.__CODEX_CONST_TRAIL || 0,
      dossier: (document.querySelector(".cx-const-info header b")||{}).textContent || "",
      chip: !!document.querySelector(".cx-const-trailchip"),
    }));
    log("follow (codexGoto rev 21):", JSON.stringify(follow));

    // second hop — the trail is a path, not a pair
    await page.evaluate(() => window.codexGoto("gen", 1, 1));
    await new Promise(r => setTimeout(r, 2600));
    const follow2 = await page.evaluate(() => ({
      flights: (window.__CODEX_CONST_FLIGHT || {}).flights || 0,
      trail: window.__CODEX_CONST_TRAIL || 0,
      dossier: (document.querySelector(".cx-const-info header b")||{}).textContent || "",
    }));
    log("follow 2 (codexGoto gen 1):", JSON.stringify(follow2));

    // ⌫ TRAIL chip clears the walked trail
    const chipCleared = await page.evaluate(() => {
      const chip = document.querySelector(".cx-const-trailchip");
      if (!chip) return { had: false };
      chip.click();
      return { had: true };
    });
    await new Promise(r => setTimeout(r, 400));
    const afterClear = await page.evaluate(() => ({
      trail: window.__CODEX_CONST_TRAIL || 0,
      chip: !!document.querySelector(".cx-const-trailchip"),
    }));
    log("trail clear:", JSON.stringify({ ...chipCleared, ...afterClear }));
    log("jsErrors:", JSON.stringify(jsErrors.slice(0, 4)));

    const ok = state.galaxyCanvas && !state.viewToggle && /STARS/.test(state.stats) &&
      near.box && near.rows > 3 && state.cached &&
      follow.flights > before.flights && follow.maxDist > 300 &&
      follow.trail > before.trail && /REVELATION 21/i.test(follow.dossier) &&
      follow2.flights > follow.flights && follow2.trail > follow.trail &&
      /GENESIS 1/i.test(follow2.dossier) && follow.chip && chipCleared.had &&
      afterClear.trail === 0 && !afterClear.chip &&
      jsErrors.length === 0;
    log(ok ? "PASS" : "FAIL");
    process.exitCode = ok ? 0 : 1;
  }
} finally {
  await browser.close();
}
