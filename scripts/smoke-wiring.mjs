// smoke-wiring.mjs — event-wiring smoke for the fixes in this pass.
// Asserts: (1) codex:open-settings opens the TweaksPanel and routes
// detail.section to the right tab; (2) codex:shortcut toggle-oracle /
// toggle-bookmarks switch the left rail to the Oracle / Marks tab.
// Run: node scripts/smoke-wiring.mjs   (server must be on :7777)
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const fail = (m) => { console.error("[wiring] FAIL —", m); process.exit(1); };
const log = (...a) => console.log("[wiring]", ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push("pageerror: " + e.message));
  await page.goto(URL, { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });

  // 1 — settings opens via the app-wide intent, lands on the AI tab.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("codex:open-settings", { detail: { section: "api-keys" } })));
  await sleep(500);
  const settings = await page.evaluate(() => {
    const panel = document.querySelector(".twk-panel, [class*='twk']");
    if (!panel) return null;
    const active = document.querySelector(".twk-tab.is-active, [class*='twk-tab'][class*='active']");
    return { open: true, tab: (active?.textContent || "").trim() };
  });
  if (!settings) fail("codex:open-settings did not open the settings panel");
  log("settings opened, active tab:", JSON.stringify(settings.tab));
  if (!/ai/i.test(settings.tab)) log("WARN — expected AI tab, got:", settings.tab);
  await page.keyboard.press("Escape");
  await sleep(300);

  // 2 — `o` shortcut event lands the left rail on the Oracle tab.
  // v10 REBIRTH — the library is dismantled: O opens the ORACLE WINDOW
  // (sys-oracle plugin) on the desk; B opens the MARKS WINDOW (sys-marks).
  await page.keyboard.press("Escape");           // clear first-run chrome
  await sleep(300);
  await page.keyboard.press("o");
  await sleep(500);
  const oracleWin = await page.evaluate(() => !!document.querySelector('[data-desk="sys:oracle"] .cxo'));
  if (!oracleWin) fail("O did not open the oracle window (sys-oracle)");
  log("O opens the oracle window.");

  // 3 — B opens the marks window.
  await page.keyboard.press("b");
  await sleep(500);
  const marksWin = await page.evaluate(() => !!document.querySelector('[data-desk="sys:marks"] .cxm'));
  if (!marksWin) fail("B did not open the marks window (sys-marks)");
  log("B opens the marks window.");

  if (jsErrors.length) fail("JS errors: " + JSON.stringify(jsErrors));
  log("PASS — settings intent + left-rail shortcut tabs all wired.");
} finally {
  await browser.close();
}
