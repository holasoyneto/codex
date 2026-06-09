// smoke-wm.mjs — window-manager (wm.js) interaction smoke.
// Boots the app at a desktop viewport (where the WM activates), opens the
// MIRROR console from the verse menu, and asserts: the console enters
// window mode (.cx-wm-win), dragging the header moves it, an edge handle
// resizes it, double-clicking the header maximizes it, and geometry
// persists to localStorage — with zero JS pageerrors throughout.
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const log = (...a) => console.log("[wm]", ...a);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type()==="error" && !/Failed to load resource/i.test(m.text())) jsErrors.push(m.text()); });

  await page.goto(URL, { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
  await page.waitForFunction(() => document.querySelectorAll(".cx-verse,.cx-verse-row").length > 0, { timeout: 20000 });
  log("booted at 1440x900; verses present");

  // Open the verse menu → MIRROR console.
  await page.evaluate(() => {
    const n = document.querySelector(".cx-vnum");
    const r = n.getBoundingClientRect();
    n.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left+3, clientY: r.top+3 }));
  });
  await new Promise(r => setTimeout(r, 400));
  const clicked = await page.evaluate(() => {
    const rows = [].slice.call(document.querySelectorAll(".cx-vm-row, button, [role='menuitem']"));
    const row = rows.find(b => /mirror/i.test(b.textContent||""));
    if (!row) return { found:false };
    row.click();
    return { found:true };
  });
  log("clicked MIRROR row:", JSON.stringify(clicked));
  await new Promise(r => setTimeout(r, 900));

  // 1 — window mode engaged.
  const win = await page.evaluate(() => {
    const w = document.querySelector(".cx-mirror.cx-wm-win");
    if (!w) return null;
    const r = w.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
             handles: w.querySelectorAll(".cx-wm-rs").length,
             backdropThrough: getComputedStyle(w.parentElement).pointerEvents === "none" };
  });
  log("window mode:", JSON.stringify(win));
  if (!win) throw new Error("console did not enter window mode");

  // 2 — drag the header 120px right / 60px down.
  const head = await page.$(".cx-mirror .cx-wm-head");
  const hb = await head.boundingBox();
  await page.mouse.move(hb.x + hb.width/2, hb.y + hb.height/2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width/2 + 120, hb.y + hb.height/2 + 60, { steps: 8 });
  await page.mouse.up();
  await new Promise(r => setTimeout(r, 300));
  const afterDrag = await page.evaluate(() => {
    const r = document.querySelector(".cx-mirror.cx-wm-win").getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top) };
  });
  const dragged = Math.abs(afterDrag.x - (win.x + 120)) <= 4 && Math.abs(afterDrag.y - (win.y + 60)) <= 4;
  log("drag:", JSON.stringify({ from: { x: win.x, y: win.y }, to: afterDrag, ok: dragged }));

  // 3 — resize from the SE corner: +80 / +50.
  const se = await page.$(".cx-mirror .cx-wm-rs-se");
  const sb = await se.boundingBox();
  await page.mouse.move(sb.x + sb.width/2, sb.y + sb.height/2);
  await page.mouse.down();
  await page.mouse.move(sb.x + sb.width/2 + 80, sb.y + sb.height/2 + 50, { steps: 6 });
  await page.mouse.up();
  await new Promise(r => setTimeout(r, 300));
  const afterResize = await page.evaluate(() => {
    const r = document.querySelector(".cx-mirror.cx-wm-win").getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  const resized = Math.abs(afterResize.w - (win.w + 80)) <= 4 && Math.abs(afterResize.h - (win.h + 50)) <= 4;
  log("resize:", JSON.stringify({ from: { w: win.w, h: win.h }, to: afterResize, ok: resized }));

  // 4 — double-press header → maximize; again → restore. (Two real click
  // sequences <400ms apart: the WM detects doubles on pointerdown pairs.)
  const dblPress = async () => { await head.click(); await new Promise(r => setTimeout(r, 80)); await head.click(); };
  await dblPress();
  await new Promise(r => setTimeout(r, 500));
  const maxed = await page.evaluate(() => {
    const r = document.querySelector(".cx-mirror.cx-wm-win").getBoundingClientRect();
    return r.width >= window.innerWidth - 40 && r.height >= window.innerHeight - 40;
  });
  await dblPress();
  await new Promise(r => setTimeout(r, 500));
  const restored = await page.evaluate((w) => {
    const r = document.querySelector(".cx-mirror.cx-wm-win").getBoundingClientRect();
    return Math.abs(Math.round(r.width) - w) <= 6;
  }, afterResize.w);
  log("maximize/restore:", JSON.stringify({ maxed, restored }));

  // 5 — geometry persisted.
  const persisted = await page.evaluate(() => {
    try { return !!JSON.parse(localStorage.getItem("cx-wm-geo:mirror") || "null"); } catch { return false; }
  });
  log("geometry persisted:", persisted);

  log("jsErrors:", JSON.stringify(jsErrors.slice(0,5)));
  const ok = dragged && resized && maxed && restored && persisted && jsErrors.length === 0;
  log(ok ? "PASS" : "FAIL");
  process.exitCode = ok ? 0 : 1;
} finally {
  await browser.close();
}
