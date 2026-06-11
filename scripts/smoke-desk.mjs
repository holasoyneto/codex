// smoke-desk.mjs — v9 FACE TO FACE: the desk replaces the grid on OS·7
// desktops. First open = reader alone as a floating WM window; library and
// study open as free windows via window.codexDesk; focus mode hides every
// non-reader window; the open set survives reload; classic grid returns
// when os7 is off. Zero pageerrors throughout.
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const log = (...a) => console.log("[desk]", ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"] });
try {
  // Incognito context = clean profile = honest FIRST OPEN.
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push("pageerror: " + e.message));
  await page.setViewport({ width: 1680, height: 1050 });
  const boot = async () => {
    await page.goto(URL, { waitUntil: "load", timeout: 30000 });
    await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
    await page.waitForFunction(() => document.querySelectorAll(".cx-verse,.cx-verse-row").length > 0, { timeout: 20000 });
    await sleep(800);
  };
  await boot();

  const fail = (m, x) => { throw new Error(m + (x !== undefined ? " · " + JSON.stringify(x) : "")); };

  // 1 · First open: reader is a WM window, alone; the grid is gone.
  const first = await page.evaluate(() => ({
    grid: !!document.querySelector(".cx-grid"),
    reader: !!document.querySelector('[data-desk="sys:reader"] .cx-win .cx-verse, [data-desk="sys:reader"] .cx-win .cx-verse-row'),
    readerWm: !!document.querySelector('[data-desk="sys:reader"] .cx-win.cx-wm-win'),
    library: !!document.querySelector('[data-desk="sys:library"]'),
    study: !!document.querySelector('[data-desk="sys:study"]'),
    desk: window.codexDesk && window.codexDesk.state(),
  }));
  if (first.grid) fail("grid should be gone under the desk", first);
  if (!first.reader) fail("reader verses should render inside the reader window", first);
  if (!first.readerWm) fail("reader window should be WM-enhanced (drag/resize)", first);
  if (first.library || first.study) fail("first open must be the reader ALONE", first);
  log("first open: reader alone, WM-enhanced, no grid ✓");

  // 2 · Library + study open as windows with real content.
  await page.evaluate(() => { window.codexDesk.open("library"); window.codexDesk.open("study"); });
  await sleep(1200);
  const wins = await page.evaluate(() => {
    const probe = (id) => {
      const el = document.querySelector(`[data-desk="${id}"] .cx-win`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), wm: el.classList.contains("cx-wm-win") };
    };
    return { lib: probe("sys:library"), study: probe("sys:study") };
  });
  if (!wins.lib || wins.lib.w < 200 || !wins.lib.wm) fail("library window missing/empty", wins);
  if (!wins.study || wins.study.w < 200 || !wins.study.wm) fail("study window missing/empty", wins);
  log("library + study float as WM windows ✓", wins);

  // 3 · Focus mode hides everything but the reader; Esc restores.
  await page.evaluate(() => window.codexDesk.focus(true));
  await sleep(300);
  const focused = await page.evaluate(() => ({
    body: document.body.classList.contains("cx-focus"),
    libHidden: getComputedStyle(document.querySelector('[data-desk="sys:library"]')).display === "none",
    readerShown: getComputedStyle(document.querySelector('[data-desk="sys:reader"]')).display !== "none",
  }));
  if (!focused.body || !focused.libHidden || !focused.readerShown) fail("focus mode wrong", focused);
  await page.keyboard.press("Escape");
  await sleep(300);
  const unfocused = await page.evaluate(() => ({
    body: document.body.classList.contains("cx-focus"),
    libShown: getComputedStyle(document.querySelector('[data-desk="sys:library"]')).display !== "none",
  }));
  if (unfocused.body || !unfocused.libShown) fail("Esc should exit focus and restore the desk", unfocused);
  log("focus mode: F-in, Esc-out, only the Word ✓");

  // 4 · The open set survives reload (codex.desk.v1).
  await boot();
  const after = await page.evaluate(() => ({
    library: !!document.querySelector('[data-desk="sys:library"]'),
    study: !!document.querySelector('[data-desk="sys:study"]'),
  }));
  if (!after.library || !after.study) fail("desk layout should survive reload", after);
  log("desk persists across reload ✓");

  // 5 · Classic mode (os7 off) still renders the grid.
  await page.evaluate(() => window.codexOS7(false));
  await sleep(800);
  const classic = await page.evaluate(() => ({
    grid: !!document.querySelector(".cx-grid"),
    deskWin: !!document.querySelector("[data-desk]"),
  }));
  if (!classic.grid || classic.deskWin) fail("classic grid should return with os7 off", classic);
  await page.evaluate(() => window.codexOS7(true));
  log("classic grid intact with os7 off ✓");

  if (jsErrors.length) fail("JS errors", jsErrors);
  log("PASS");
} finally {
  await browser.close();
}
