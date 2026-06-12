// smoke-mobile.mjs — v12 THE PALM. The old mobile app is DEAD IN CODE:
// no status bar, no footer, no drawer grid, no rail scrim. The phone boots
// into THE WORD full-bleed with exactly one piece of chrome — the ORB —
// which opens the PALM (grip · verbs · panel chips); every launch is a
// full-screen SHEET hosting the same components the desk windows host.
//
// Verifies: boot → verses + zero old chrome; orb ≥44px inside the safe
// area; tap orb → palm with ≥5 grip launchers; shelves sheet opens and a
// header swipe-down dismisses it; TRANS sheet shows the language lanes of
// cards and one card tap flips CODEX_NOW.translation; ❂ galaxy goes
// full-screen and a star tap opens the dossier bottom card; orb long-press
// toggles focus; a chapter turn resets the reader scroll to the top; and
// ZERO pageerrors throughout.
//
// Run: node scripts/smoke-mobile.mjs   (server must be on :7777)
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const log = (...a) => console.log("[mobile]", ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});
try {
  // Incognito context = clean profile = honest FIRST OPEN on a phone.
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push("pageerror: " + e.message));
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  const fail = (m, x) => { throw new Error(m + (x !== undefined ? " · " + JSON.stringify(x) : "")); };

  const boot = async () => {
    await page.goto(URL, { waitUntil: "load", timeout: 30000 });
    await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
    await page.waitForFunction(() => document.querySelectorAll(".cx-verse-row").length > 0, { timeout: 25000 });
    await sleep(500);
  };
  await boot();

  // a · BOOT — THE WORD full-bleed; the old mobile chrome is GONE.
  const shell = await page.evaluate(() => ({
    mob: !!document.querySelector(".cx-mob"),
    reader: !!document.querySelector(".cx-mob-reader .cxr"),
    verses: document.querySelectorAll(".cx-mob-reader .cx-verse-row").length,
    trace: !!document.querySelector(".cx-mtrace"),
    status: document.querySelectorAll(".cx-status").length,
    footer: document.querySelectorAll(".cx-footer").length,
    grid: document.querySelectorAll(".cx-grid").length,
    scrim: document.querySelectorAll(".cx-rail-scrim").length,
    mobileApi: !!(window.codexMobile && window.codexMobile.on()),
  }));
  if (!shell.mob || !shell.reader) fail("mobile shell did not mount", shell);
  if (shell.verses < 1) fail("no verses in the full-bleed reader", shell);
  if (!shell.trace) fail("the TRACE (time · ◐) is missing", shell);
  if (shell.status || shell.footer || shell.grid || shell.scrim)
    fail("OLD MOBILE CHROME STILL RENDERS (.cx-status/.cx-footer/.cx-grid/.cx-rail-scrim)", shell);
  if (!shell.mobileApi) fail("window.codexMobile router missing", shell);
  log(`boot: THE WORD full-bleed · ${shell.verses} verses · trace on · zero old chrome ✓`);

  // b · THE ORB — ≥44px target, floating inside the safe area.
  const orb = await page.evaluate(() => {
    const el = document.querySelector(".cx-orb");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  });
  if (!orb) fail("the orb is missing");
  if (orb.w < 44 || orb.h < 44) fail("orb tap target under 44px", orb);
  if (orb.bottom > 844 || orb.top < 0 || orb.left < 0 || orb.right > 390)
    fail("orb floats outside the safe viewport", orb);
  log(`orb: ${Math.round(orb.w)}×${Math.round(orb.h)}px at y=${Math.round(orb.top)} — HIG target in the safe area ✓`);

  const orbCenter = async () => {
    const r = await page.evaluate(() => {
      const b = document.querySelector(".cx-orb").getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    });
    return r;
  };

  // c · TAP ORB → THE PALM (grip ≥5 launchers · verbs · panel chips).
  let oc = await orbCenter();
  await page.touchscreen.tap(oc.x, oc.y);
  await page.waitForSelector(".cx-palm", { timeout: 5000 });
  const palm = await page.evaluate(() => ({
    grip: document.querySelectorAll(".cx-palm .cx-palm-launch").length,
    verbs: document.querySelectorAll(".cx-palm .cx-palm-verb").length,
    chips: document.querySelectorAll(".cx-palm .cx-palm-chip").length,
    now: (document.querySelector(".cx-palm-now") || {}).textContent || "",
  }));
  if (palm.grip < 5) fail("palm grip must offer ≥5 launchers", palm);
  if (palm.verbs < 3) fail("palm verbs (⚔ ⌬ ◎) missing", palm);
  if (palm.chips < 8) fail("palm panel chips missing (8 builtins + plugins)", palm);
  log(`palm: ${palm.grip} grip · ${palm.verbs} verbs · ${palm.chips} chips · now="${palm.now}" ✓`);

  // d · SHELVES sheet opens; header swipe-down dismisses it.
  await page.evaluate(() => {
    [...document.querySelectorAll(".cx-palm-launch")]
      .find(b => /SHELVES/.test(b.textContent)).click();
  });
  await page.waitForSelector('.cx-sheet[data-sheet="library:"]', { timeout: 8000 });
  const lib = await page.evaluate(() => {
    const s = document.querySelector('.cx-sheet[data-sheet="library:"]');
    const r = s.getBoundingClientRect();
    return { w: r.width, h: r.height, grab: !!s.querySelector(".cx-sheet-grab"), palmGone: !document.querySelector(".cx-palm") };
  });
  if (lib.w < 380 || lib.h < 800) fail("shelves sheet is not full-screen", lib);
  if (!lib.grab) fail("sheet grabber missing", lib);
  if (!lib.palmGone) fail("palm should close when a sheet launches", lib);
  // swipe DOWN on the sheet header → dismiss
  const head = await page.evaluate(() => {
    const h = document.querySelector('.cx-sheet[data-sheet="library:"] .cx-sheet-h').getBoundingClientRect();
    return { x: h.x + h.width / 2, y: h.y + h.height / 2 };
  });
  await page.touchscreen.touchStart(head.x, head.y);
  for (let i = 1; i <= 8; i++) await page.touchscreen.touchMove(head.x, head.y + i * 28);
  await page.touchscreen.touchEnd();
  await sleep(450);
  const libGone = await page.evaluate(() => !document.querySelector('.cx-sheet[data-sheet="library:"]'));
  if (!libGone) fail("swipe-down did not dismiss the shelves sheet");
  log("shelves: full-screen sheet opened · header swipe-down dismissed ✓");

  // e · TRANS sheet — the NEW translations instrument (lanes of cards);
  //     one card tap flips the primary translation (CODEX_NOW follows).
  await page.evaluate(() => window.codexOpenPanel("trans"));
  await page.waitForSelector('.cx-sheet[data-sheet="builtin:trans"] .cx-tx-lane .cx-tx-card', { timeout: 15000 });
  const trans = await page.evaluate(() => {
    const s = document.querySelector('.cx-sheet[data-sheet="builtin:trans"]');
    return {
      lanes: s.querySelectorAll(".cx-tx-lane").length,
      cards: s.querySelectorAll(".cx-tx-card").length,
      primaryCard: !!s.querySelector(".cx-tx-card.is-primary"),
    };
  });
  if (trans.lanes < 2 || trans.cards < 5) fail("translation lanes/cards missing in the sheet", trans);
  if (!trans.primaryCard) fail("active translation card not marked", trans);
  const before = await page.evaluate(() => (window.CODEX_NOW || {}).translation);
  const target = await page.evaluate(() => {
    const s = document.querySelector('.cx-sheet[data-sheet="builtin:trans"]');
    const card = [...s.querySelectorAll(".cx-tx-card:not(.is-primary):not(.is-ghost)")]
      .find(c => c.querySelector(".cx-tx-card-pick:not([disabled])"));
    if (!card) return null;
    card.querySelector(".cx-tx-card-pick").click();
    return card.getAttribute("data-tx-id");
  });
  if (!target) fail("no tappable non-primary translation card");
  await page.waitForFunction((id) => (window.CODEX_NOW || {}).translation === id, { timeout: 15000 }, target);
  log(`trans sheet: ${trans.lanes} lanes · ${trans.cards} cards · tap flipped ${before} → ${target} ✓`);
  await page.evaluate(() => window.codexMobile.closeAll());
  await sleep(300);

  // f · ❂ GALAXY — full-screen on the phone; star tap → dossier bottom card.
  oc = await orbCenter();
  await page.touchscreen.tap(oc.x, oc.y);
  await page.waitForSelector(".cx-palm", { timeout: 5000 });
  await page.evaluate(() => {
    [...document.querySelectorAll(".cx-palm-launch")]
      .find(b => /GALAXY/.test(b.textContent)).click();
  });
  await page.waitForSelector(".cx-const-canvas.is-galaxy", { timeout: 60000 });
  // wait for the layout to settle (stars projected) before tapping
  await page.waitForFunction(
    () => !document.querySelector(".cx-const-laying") && !document.querySelector(".cx-const-loading"),
    { timeout: 60000 }
  );
  await sleep(1200);
  const constBox = await page.evaluate(() => {
    const r = document.querySelector(".cx-const").getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  if (constBox.w < 380 || constBox.h < 800) fail("galaxy is not full-screen on the phone", constBox);
  // tap a star: probe a grid of positions until the dossier opens
  const probes = [];
  for (const fy of [0.45, 0.5, 0.55, 0.4, 0.6, 0.35, 0.65])
    for (const fx of [0.5, 0.42, 0.58, 0.34, 0.66]) probes.push([fx * 390, fy * 844]);
  let dossier = false;
  for (const [px, py] of probes) {
    await page.touchscreen.tap(px, py);
    await sleep(450);
    dossier = await page.evaluate(() => !!document.querySelector(".cx-const-info"));
    if (dossier) break;
  }
  if (!dossier) fail("no star tap opened the dossier (probed " + probes.length + " points)");
  const card = await page.evaluate(() => {
    const el = document.querySelector(".cx-const-info");
    const r = el.getBoundingClientRect();
    return {
      label: (el.querySelector("header b") || {}).textContent || "",
      bottomCard: r.bottom > 844 - 120 && r.top > 844 * 0.3, // pinned low = bottom card
      verbs: el.querySelectorAll(".cx-const-info-verbs button").length,
    };
  });
  if (!card.label) fail("dossier card has no star label", card);
  if (!card.bottomCard) fail("dossier should sit as a bottom card on the phone", card);
  if (card.verbs < 3) fail("dossier verbs (READ/NEAR/PATH) missing", card);
  log(`galaxy: full-screen · tap → dossier bottom card "${card.label}" ✓`);
  await page.keyboard.press("Escape");
  await sleep(400);

  // g · ORB LONG-PRESS — focus mode on (trace dies), long-press again — off.
  oc = await orbCenter();
  await page.touchscreen.touchStart(oc.x, oc.y);
  await sleep(750);
  await page.touchscreen.touchEnd();
  await sleep(350);
  const focusOn = await page.evaluate(() => ({
    focus: !!document.querySelector(".cx-mob.is-focus"),
    body: document.body.classList.contains("cx-mfocus"),
    trace: !!document.querySelector(".cx-mtrace"),
    orb: !!document.querySelector(".cx-orb"),
  }));
  if (!focusOn.focus || !focusOn.body) fail("long-press did not enter focus", focusOn);
  if (focusOn.trace) fail("focus must kill even the trace", focusOn);
  if (!focusOn.orb) fail("the orb must survive focus", focusOn);
  await page.touchscreen.touchStart(oc.x, oc.y);
  await sleep(750);
  await page.touchscreen.touchEnd();
  await sleep(350);
  const focusOff = await page.evaluate(() => !document.querySelector(".cx-mob.is-focus"));
  if (!focusOff) fail("second long-press did not exit focus");
  log("orb long-press: focus on (only the Word + the orb) → off ✓");

  // h · CHAPTER TURN → the reader scroll RESETS TO THE FIRST VERSE.
  await page.evaluate(() => { document.querySelector(".cxr-scroll").scrollTop = 700; });
  await sleep(200);
  const scrolled = await page.evaluate(() => document.querySelector(".cxr-scroll").scrollTop);
  if (scrolled < 300) fail("precondition: could not scroll the reader down", { scrolled });
  const chapterBefore = await page.evaluate(() => (window.CODEX_NOW || {}).chapter);
  await page.evaluate(() => {
    // the reader's own next-chapter button (›)
    const navs = document.querySelectorAll(".cxr-bar .cxr-nav");
    navs[navs.length - 1].click();
  });
  await page.waitForFunction(
    (ch) => (window.CODEX_NOW || {}).chapter !== ch, { timeout: 15000 }, chapterBefore);
  await page.waitForFunction(
    () => document.querySelectorAll(".cx-verse-row").length > 0, { timeout: 20000 });
  await sleep(900); // let the smooth settle
  const turned = await page.evaluate(() => ({
    chapter: (window.CODEX_NOW || {}).chapter,
    scrollTop: document.querySelector(".cxr-scroll").scrollTop,
  }));
  if (turned.scrollTop !== 0) fail("chapter turn must reset the reader to the first verse", turned);
  log(`page turn: ch ${chapterBefore} → ${turned.chapter} · scrollTop=${turned.scrollTop} (the machine followed the eye) ✓`);

  // i · zero pageerrors throughout.
  if (jsErrors.length) fail("JS errors", jsErrors);
  log("PASS — the old mobile is dead; the palm lives.");
} finally {
  await browser.close();
}
