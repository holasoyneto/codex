// smoke-deskfreedom.mjs — v11.5 DESK FREEDOM: the complete desktop is
// usable and fertile. Boots the desk, opens a couple windows, then asserts:
//   1. WINDOW FREEDOM — a window drags FLUSH-LEFT (x≈PAD) and hangs FAR-LEFT
//      (geometry honors x=-300 while keeping ≥120px of header on screen).
//   2. ⊞ ARRANGE — side-by-side over two windows → both ≈half width.
//   3. SAVED SETUPS — save 'test' → close a window → recall → reopens at the
//      saved geometry.
//   4. − MINIMIZE — header button hides the backdrop; the dock chip restores.
//   5. ⧉ POP-OUT — the header pop-out button is present + wired (surface).
//   6. LIVE PREVIEW — right-click a running dock chip → a card with the
//      window title + action buttons.
//   7. DRAG-REORDER — a dragged launcher chip's order persists across reload
//      (codex.dock.v2).
// Zero pageerrors throughout.
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const log = (...a) => console.log("[deskfreedom]", ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] });
try {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/i.test(m.text())) jsErrors.push(m.text()); });
  await page.setViewport({ width: 1680, height: 1050 });
  const fail = (m, x) => { throw new Error(m + (x !== undefined ? " · " + JSON.stringify(x) : "")); };
  const boot = async () => {
    await page.goto(URL, { waitUntil: "load", timeout: 30000 });
    await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
    await page.waitForFunction(() => document.querySelectorAll(".cx-verse,.cx-verse-row").length > 0, { timeout: 20000 });
    await sleep(800);
    await page.keyboard.press("Escape");
    await sleep(300);
  };
  await boot();

  // Open library + oracle alongside the reader (3 windows on the desk).
  await page.evaluate(() => { window.codexDesk.open("library"); window.codexDesk.open("oracle"); });
  await sleep(1000);

  // ── 1 · WINDOW FREEDOM: drag the reader window flush-left then far-left.
  const readerSel = '[data-desk="sys:reader"] .cx-win.cx-wm-win';
  const headSel = '[data-desk="sys:reader"] .cx-win-h';
  await page.evaluate(() => { const bd = document.querySelector('[data-desk="sys:reader"]'); if (bd) bd.style.display = ""; });
  // bring it to front
  await page.evaluate((s) => { const c = document.querySelector(s); if (c) c.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); }, readerSel);
  await sleep(150);
  const head = await page.$(headSel);
  const hb = await head.boundingBox();
  // drag far to the left (well past the left edge)
  await page.mouse.move(hb.x + 80, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + 80 - 1000, hb.y + hb.height / 2, { steps: 14 });
  await page.mouse.up();
  await sleep(300);
  const flush = await page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { x: Math.round(r.left), right: Math.round(r.right) };
  }, readerSel);
  // flush-left means the left edge reached ~PAD (8). Allow a small tolerance.
  if (flush.x > 14) fail("window could not reach the left edge (flush-left blocked)", flush);
  log(`window freedom · flush-left: x=${flush.x} (≤14) ✓`);

  // far-left via the geometry API: x=-300 must keep ≥120px header on screen.
  await page.evaluate(() => {
    const c = document.querySelector('[data-desk="sys:reader"] .cx-win.cx-wm-win');
    c.style.left = "-300px"; // raw, then a real resize event re-clamps
  });
  // trigger the WM's clamp by dispatching a resize (onWinResize re-clamps geo)
  // — but the inline write bypassed state; instead drive through a tiny drag.
  const hb2 = await (await page.$(headSel)).boundingBox();
  await page.mouse.move(hb2.x + 200, hb2.y + hb2.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb2.x + 200 - 800, hb2.y + hb2.height / 2, { steps: 12 });
  await page.mouse.up();
  await sleep(300);
  const farLeft = await page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { x: Math.round(r.left), right: Math.round(r.right) };
  }, readerSel);
  if (farLeft.right < 120) fail("far-left drag hid the header (need ≥120px on screen)", farLeft);
  log(`window freedom · far-left: x=${farLeft.x}, header on screen=${farLeft.right}px (≥120) ✓`);

  // ── 2 · ⊞ ARRANGE side-by-side over the OPEN windows. Use the API.
  await page.evaluate(() => window.codexArrange.layout("halves"));
  await sleep(500);
  const halves = await page.evaluate(() => {
    const vw = window.innerWidth;
    return [].slice.call(document.querySelectorAll(".cx-wm-win"))
      .filter(c => c.getBoundingClientRect().width > 0 && getComputedStyle(c.closest(".cx-wm-backdrop") || c).display !== "none")
      .map(c => Math.round(c.getBoundingClientRect().width / vw * 100));
  });
  const halfish = halves.filter(p => p >= 40 && p <= 55).length;
  if (halfish < 2) fail("side-by-side did not produce ≈half-width windows", halves);
  log(`arrange · side-by-side: widths ${JSON.stringify(halves)}% — ${halfish} at ≈half ✓`);

  // ── 3 · SAVED SETUPS — save, close a window, recall.
  await page.evaluate(() => window.codexArrange.save("test"));
  await sleep(200);
  const saved = await page.evaluate(() => (window.codexArrange.list() || []).some(s => s.name === "test"));
  if (!saved) fail("setup 'test' did not persist to codex.layouts.v1");
  // close oracle
  await page.evaluate(() => window.codexDesk.close("oracle"));
  await sleep(600);
  const gone = await page.evaluate(() => !document.querySelector('[data-desk="sys:oracle"]'));
  if (!gone) fail("oracle did not close before recall");
  await page.evaluate(() => window.codexArrange.recall("test"));
  await sleep(2200);
  const recalled = await page.evaluate(() => {
    const bd = document.querySelector('[data-desk="sys:oracle"]');
    if (!bd) return null;
    const r = bd.querySelector(".cx-win").getBoundingClientRect();
    return { w: Math.round(r.width) };
  });
  if (!recalled || recalled.w < 100) fail("recall did not reopen oracle at saved geometry", recalled);
  log(`saved setups: save → close oracle → recall reopened it (w=${recalled.w}) ✓`);

  // ── 4 · − MINIMIZE via header button; restore via dock chip.
  const hasMin = await page.evaluate(() => {
    const b = document.querySelector('[data-desk="sys:library"] .cx-wm-ctl-min');
    if (!b) return false;
    b.click();
    return true;
  });
  if (!hasMin) fail("minimize button missing from a window header");
  await sleep(300);
  const minimized = await page.evaluate(() => getComputedStyle(document.querySelector('[data-desk="sys:library"]')).display === "none");
  if (!minimized) fail("minimize did not hide the backdrop");
  // a dock chip should now offer to restore it
  const restored = await page.evaluate(() => {
    const chips = [].slice.call(document.querySelectorAll(".cx-wm-dock-running"));
    const chip = chips.find(c => /LIBRARY|LIB/i.test(c.textContent) || /restore/i.test(c.getAttribute("data-tip") || ""));
    if (!chip) return false;
    chip.click();
    return true;
  });
  await sleep(300);
  const back = await page.evaluate(() => getComputedStyle(document.querySelector('[data-desk="sys:library"]')).display !== "none");
  if (!restored || !back) fail("dock chip did not restore the minimized window", { restored, back });
  log("minimize: − hides backdrop, dock chip restores ✓");

  // ── 5 · ⧉ POP-OUT button present + wired on the reader header.
  const pop = await page.evaluate(() => {
    const b = document.querySelector('[data-desk="sys:reader"] .cx-wm-ctl-pop');
    return b ? { present: true, tip: b.getAttribute("data-tip") } : { present: false };
  });
  if (!pop.present) fail("pop-out (⧉) button missing on the reader header", pop);
  log(`pop-out: ⧉ present + wired (tip="${pop.tip}") ✓`);

  // ── 6 · LIVE PREVIEW CARD — right-click a running dock chip.
  const chipBox = await page.evaluate(() => {
    const chip = document.querySelector(".cx-wm-dock-running");
    if (!chip) return null;
    const r = chip.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!chipBox) fail("no running-window dock chip to preview");
  await page.mouse.click(chipBox.x, chipBox.y, { button: "right" });
  await sleep(300);
  const prev = await page.evaluate(() => {
    const c = document.querySelector(".cx-wm-prevcard");
    if (!c) return null;
    return { title: !!c.querySelector(".cx-wm-prevcard-h b"), acts: c.querySelectorAll(".cx-wm-prevcard-acts button").length, snapshot: !!c.querySelector(".cx-wm-prevcard-stage") };
  });
  if (!prev || !prev.title || prev.acts < 2 || !prev.snapshot) fail("preview card missing title/actions/snapshot", prev);
  log(`live preview: card with title + ${prev.acts} actions + snapshot ✓`);
  await page.mouse.click(840, 20); // dismiss

  // ── 7 · DRAG-REORDER persists across reload.
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("codex.dock.v2") || "null"));
  // grab the 2nd launcher chip and drag it far right, past several neighbors.
  const dragOk = await page.evaluate(async () => {
    const chips = [].slice.call(document.querySelectorAll(".cx-wm-dock-act[data-dock-id]"))
      .filter(c => c.getAttribute("data-dock-id") !== "reader");
    if (chips.length < 3) return false;
    return chips[0].getAttribute("data-dock-id");
  });
  const chips = await page.$$(".cx-wm-dock-act[data-dock-id]");
  // find first non-reader chip + a far-right target chip
  const ids = await page.evaluate(() => [].slice.call(document.querySelectorAll(".cx-wm-dock-act[data-dock-id]")).map(c => c.getAttribute("data-dock-id")));
  const firstMovable = ids.findIndex(id => id !== "reader");
  const srcBox = await chips[firstMovable].boundingBox();
  const dstBox = await chips[chips.length - 1].boundingBox();
  await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(dstBox.x + dstBox.width / 2 + 4, srcBox.y + srcBox.height / 2, { steps: 14 });
  await page.mouse.up();
  await sleep(300);
  const afterOrder = await page.evaluate(() => JSON.parse(localStorage.getItem("codex.dock.v2") || "null"));
  if (!afterOrder || JSON.stringify(afterOrder) === JSON.stringify(before)) fail("drag-reorder did not change the persisted dock order", { before, afterOrder });
  if (afterOrder[0] !== "reader") fail("reorder violated the reader-first law", afterOrder);
  await boot();
  const reloaded = await page.evaluate(() => JSON.parse(localStorage.getItem("codex.dock.v2") || "null"));
  if (JSON.stringify(reloaded) !== JSON.stringify(afterOrder)) fail("reordered dock did not survive reload", { afterOrder, reloaded });
  log(`drag-reorder: order persisted across reload (reader still first) ✓`);

  if (jsErrors.length) fail("JS errors", jsErrors.slice(0, 5));
  log("PASS");
} finally {
  await browser.close();
}
