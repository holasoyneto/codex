import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = "http://localhost:7777/";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"] });
try {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(URL, { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
  await page.waitForFunction(() => document.querySelectorAll(".cx-verse,.cx-verse-row").length > 0, { timeout: 20000 });
  await sleep(1000);
  await page.keyboard.press("Escape");
  await sleep(300);
  const sel = '[data-desk="sys:reader"] .cx-win';
  const drag = async (toX, label) => {
    const r0 = await page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return {x:Math.round(r.x),w:Math.round(r.width)}; }, sel);
    const hb = await (await page.$('[data-desk="sys:reader"] .cx-win .cx-win-h')).boundingBox();
    const grabX = hb.x + 80, grabY = hb.y + 12; // grab near LEFT (title area)
    await page.mouse.move(grabX, grabY);
    await page.mouse.down();
    const cursorTarget = grabX + (toX - r0.x);
    await page.mouse.move(cursorTarget, grabY + 1, { steps: 12 });
    await sleep(120);
    const during = await page.evaluate(s => {
      const r = document.querySelector(s).getBoundingClientRect();
      const p = document.querySelector(".cx-wm-preview");
      return {x:Math.round(r.x), preview: p && p.style.display !== "none" ? p.style.left : null};
    }, sel);
    await page.mouse.up();
    await sleep(400);
    const after = await page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return {x:Math.round(r.x),w:Math.round(r.width)}; }, sel);
    console.log(label, { from:r0, cursorTarget: Math.round(cursorTarget), during, after });
  };
  await drag(8, "drag to x=8:");
  await drag(-300, "drag to x=-300:");
  await drag(600, "drag back to x=600:");
  // also test a console: open mirror via codex:os-open
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("codex:os-open", { detail: { kind: "mirror", ref: "John 1:1" } })));
  await sleep(1500);
  const m = await page.evaluate(() => { const el = document.querySelector(".cx-mirror.cx-wm-win"); if (!el) return null; const r = el.getBoundingClientRect(); return {x:Math.round(r.x),w:Math.round(r.width)}; });
  console.log("mirror:", m);
  if (m) {
    const hb = await (await page.$(".cx-mirror .cx-wm-head")).boundingBox();
    const grabX = hb.x + 80, grabY = hb.y + 12;
    await page.mouse.move(grabX, grabY); await page.mouse.down();
    await page.mouse.move(grabX + (8 - m.x), grabY, { steps: 12 });
    await sleep(120);
    await page.mouse.up(); await sleep(400);
    const after = await page.evaluate(() => { const r = document.querySelector(".cx-mirror.cx-wm-win").getBoundingClientRect(); return {x:Math.round(r.x),w:Math.round(r.width)}; });
    console.log("mirror after drag to x=8:", after);
  }
} finally { await browser.close(); }
