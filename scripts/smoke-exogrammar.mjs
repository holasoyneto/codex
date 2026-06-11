// smoke-exogrammar.mjs — v9.3 EXOGRAMMAR: GNOSIS is THE RESONANCE FIELD
// (horizontal luminance bands, prose only on summon) and DISARM is THE
// OPPOSITION INSTRUMENT (two-sided weaponization⇄rebuttal pairs joined by
// a visible thread, collapsed to one-liners). Opens the study window via
// window.codexDesk.open("study"), surfaces both panels, asserts the new
// DOM, expands one of each, and demands zero pageerrors.
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const log = (...a) => console.log("[exogrammar]", ...a);
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

  // 1 · Open the study window on the desk.
  await page.evaluate(() => window.codexDesk.open("study"));
  await sleep(1000);
  const study = await page.evaluate(() => !!document.querySelector('[data-desk="sys:study"] .cx-win'));
  if (!study) fail("study window did not open");
  log("study window open ✓");

  // 2 · Summon the GNOSIS deck card (builtin-tab event unlocks + targets it).
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("codex:open-builtin-tab", { detail: { tabId: "gnosis" } })));
  await page.waitForSelector('[data-desk="sys:study"] .cx-gnosis-band', { timeout: 15000 });
  const gnosis = await page.evaluate(() => {
    const root = document.querySelector('[data-desk="sys:study"]');
    const bands = [...root.querySelectorAll(".cx-gnosis-band")];
    return {
      bands: bands.length,
      headers: root.querySelectorAll(".cx-gnosis-band-h[aria-expanded]").length,
      sigils: root.querySelectorAll(".cx-gnosis-band-sigil").length,
      // shape before script: NO prose until a band is summoned
      proseBeforeTouch: root.querySelectorAll(".cx-gnosis-band-body").length,
      // luminance/position treatment: each band carries its --gn-t field var
      fieldVar: bands.length ? bands[0].style.getPropertyValue("--gn-t") !== "" : false,
      drift: bands.length > 1 ? getComputedStyle(bands[bands.length - 1]).marginLeft !== getComputedStyle(bands[0]).marginLeft : true,
    };
  });
  if (gnosis.bands < 1) fail("no resonance bands", gnosis);
  if (gnosis.headers !== gnosis.bands) fail("bands must be aria-expanded buttons", gnosis);
  if (gnosis.proseBeforeTouch !== 0) fail("prose visible before summoning", gnosis);
  if (!gnosis.fieldVar || !gnosis.drift) fail("luminance/position field missing", gnosis);
  log(`gnosis: ${gnosis.bands} resonance bands, no prose until summoned, field treatment live ✓`);

  // 3 · Touch a band → body unfolds in place; touch a second → both open.
  // (clicks go through the DOM — deck cards scroll, so coordinates lie)
  const domClick = (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) throw new Error("no node " + s); el.click(); }, sel);
  await domClick('[data-desk="sys:study"] .cx-gnosis-band:nth-child(1) .cx-gnosis-band-h');
  await sleep(250);
  const oneOpen = await page.evaluate(() => ({
    open: document.querySelectorAll('[data-desk="sys:study"] .cx-gnosis-band.is-open').length,
    body: !!document.querySelector('[data-desk="sys:study"] .cx-gnosis-band.is-open .cx-gnosis-band-body p'),
    expanded: document.querySelector('[data-desk="sys:study"] .cx-gnosis-band.is-open .cx-gnosis-band-h')?.getAttribute("aria-expanded"),
  }));
  if (oneOpen.open !== 1 || !oneOpen.body || oneOpen.expanded !== "true") fail("band did not unfold", oneOpen);
  const second = await page.$('[data-desk="sys:study"] .cx-gnosis-band:nth-child(2) .cx-gnosis-band-h');
  if (second) {
    await domClick('[data-desk="sys:study"] .cx-gnosis-band:nth-child(2) .cx-gnosis-band-h'); await sleep(250);
    const both = await page.evaluate(() => document.querySelectorAll('[data-desk="sys:study"] .cx-gnosis-band.is-open').length);
    if (both !== 2) fail("multiple bands should resonate at once", { both });
    log("gnosis: band unfolds in place; two bands open at once ✓");
  } else {
    log("gnosis: band unfolds in place ✓ (single-band passage)");
  }

  // 4 · Keyboard: Enter on a focused band toggles it (it is a real button).
  await page.evaluate(() => document.querySelector('[data-desk="sys:study"] .cx-gnosis-band:nth-child(1) .cx-gnosis-band-h').focus());
  await page.keyboard.press("Enter");
  await sleep(250);
  const reclosed = await page.evaluate(() =>
    document.querySelector('[data-desk="sys:study"] .cx-gnosis-band:nth-child(1)').classList.contains("is-open"));
  if (reclosed) fail("Enter should have re-collapsed the focused band");
  log("gnosis: keyboard Enter toggles a band ✓");

  // 5 · Summon DISARM — the opposition instrument.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("codex:open-builtin-tab", { detail: { tabId: "disarm" } })));
  await page.waitForSelector('[data-desk="sys:study"] .cx-disarm-pair', { timeout: 15000 });
  const disarm = await page.evaluate(() => {
    const root = document.querySelector('[data-desk="sys:study"]');
    return {
      pairs: root.querySelectorAll(".cx-disarm-pair").length,
      banner: !!root.querySelector(".cx-disarm-banner"),
      chips: root.querySelectorAll(".cx-disarm-vchip").length,
      miniClaims: root.querySelectorAll(".cx-disarm-mini.is-claim").length,
      miniRebuts: root.querySelectorAll(".cx-disarm-mini.is-rebut").length,
      // collapsed by default: no expanded duel yet
      duelsBeforeTouch: root.querySelectorAll(".cx-disarm-duel").length,
    };
  });
  if (disarm.pairs < 1) fail("no opposition pairs", disarm);
  if (!disarm.banner) fail("SCHOLARLY SURVEY banner missing", disarm);
  if (disarm.miniClaims !== disarm.pairs || disarm.miniRebuts !== disarm.pairs) fail("one-liner claim⇄rebuttal rows missing", disarm);
  if (disarm.duelsBeforeTouch !== 0) fail("pairs must start collapsed", disarm);
  log(`disarm: ${disarm.pairs} pairs collapsed to claim⇄rebuttal one-liners, banner present ✓`);

  // 6 · Expand a pair → two sides + the joining thread, then verse chip jump.
  await domClick('[data-desk="sys:study"] .cx-disarm-pair:nth-child(1) .cx-disarm-pair-toggle');
  await sleep(250);
  const duel = await page.evaluate(() => {
    const root = document.querySelector('[data-desk="sys:study"] .cx-disarm-pair.is-open');
    if (!root) return null;
    return {
      weapon: !!root.querySelector(".cx-disarm-duel .cx-disarm-side.is-weapon .cx-disarm-claim"),
      rebut: !!root.querySelector(".cx-disarm-duel .cx-disarm-side.is-rebut .cx-disarm-rebut-body"),
      thread: !!root.querySelector(".cx-disarm-duel .cx-disarm-thread"),
      expanded: root.querySelector(".cx-disarm-pair-toggle")?.getAttribute("aria-expanded"),
    };
  });
  if (!duel || !duel.weapon || !duel.rebut || !duel.thread || duel.expanded !== "true")
    fail("expanded duel incomplete (sides/thread)", duel);
  const chip = await page.$('[data-desk="sys:study"] .cx-disarm-vchip:not(.is-static)');
  if (chip) {
    await domClick('[data-desk="sys:study"] .cx-disarm-vchip:not(.is-static)'); await sleep(400);
    if (jsErrors.length) fail("verse chip jump raised errors", jsErrors);
    log("disarm: duel expands with thread; verse chip jumps clean ✓");
  } else {
    log("disarm: duel expands with thread ✓ (no verse chips on this passage)");
  }

  if (jsErrors.length) fail("JS errors", jsErrors);
  log("PASS");
} finally {
  await browser.close();
}
