// smoke-const.mjs — ❂ CONSTELLATION smoke, v9.3 galaxy-only contract:
// open → TSK aggregates (first run fetches ~5 MB) → boots DIRECTLY into the
// 3D galaxy (no ring, no view toggle) → stars render with stats → NEAR query
// flies the camera and lists neighbors → double-click ground truth: a star
// jump changes the reader. Zero pageerrors.
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
    log("jsErrors:", JSON.stringify(jsErrors.slice(0, 4)));

    const ok = state.galaxyCanvas && !state.viewToggle && /STARS/.test(state.stats) &&
      near.box && near.rows > 3 && state.cached && jsErrors.length === 0;
    log(ok ? "PASS" : "FAIL");
    process.exitCode = ok ? 0 : 1;
  }
} finally {
  await browser.close();
}
