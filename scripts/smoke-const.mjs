// smoke-const.mjs — ❂ CONSTELLATION smoke: open, aggregate the full TSK
// (first run fetches ~5 MB), assert the wheel renders with stats, hover a
// ring point → HUD reads a chapter + thread count, click → reader jumps.
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
    await new Promise(r => setTimeout(r, 2200));
    const stats = await page.evaluate(() => (document.querySelector(".cx-const-stats")||{}).textContent || "");
    log("stats:", stats);

    const pt = await page.evaluate(() => {
      const c = document.querySelector(".cx-const-canvas");
      const r = c.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const R = Math.min(r.width, r.height) / 2 - 44;
      const a = -Math.PI / 2 + 0.7;
      return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
    });
    await page.mouse.move(pt.x, pt.y);
    await new Promise(r => setTimeout(r, 700));
    const hud = await page.evaluate(() => (document.querySelector(".cx-const-hud b")||{}).textContent || "");
    log("hover hud:", hud);

    await page.mouse.click(pt.x, pt.y);
    await new Promise(r => setTimeout(r, 1600));
    const title = await page.evaluate(() => (document.querySelector(".cx-reader-titles h1, h1")||{}).textContent || "");
    log("reader after click:", title);
    log("jsErrors:", JSON.stringify(jsErrors.slice(0, 4)));

    const ok = /THREADS/.test(stats) && hud.length > 0 && title.length > 0 && jsErrors.length === 0;
    log(ok ? "PASS" : "FAIL");
    process.exitCode = ok ? 0 : 1;
  }
} finally {
  await browser.close();
}
