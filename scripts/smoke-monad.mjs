// smoke-monad.mjs — v8 MONAD: plugin panels float as real WM windows.
// codexOpenWindow spawns a window bound to the reader; drag moves it;
// geometry + the open set persist across reload; × closes; omnibar panel
// rows route plugins to windows under os7 desktop. Zero pageerrors.
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const log = (...a) => console.log("[monad]", ...a);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push("pageerror: " + e.message));
  await page.setViewport({ width: 1680, height: 1050 });
  const boot = async () => {
    await page.goto(URL, { waitUntil: "load", timeout: 30000 });
    await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
    await page.waitForFunction(() => document.querySelectorAll(".cx-verse,.cx-verse-row").length > 0, { timeout: 20000 });
    await new Promise(r => setTimeout(r, 900)); // plugins register
  };
  await boot();

  const opened = await page.evaluate(() => window.codexOpenWindow && window.codexOpenWindow({ id: "plugin:crossrefs-tsk:crossrefs", title: "CROSS-REFS", glyph: "✝" }));
  await new Promise(r => setTimeout(r, 1500));
  const state = await page.evaluate(() => {
    const card = document.querySelector(".cx-win");
    const r = card ? card.getBoundingClientRect() : null;
    return {
      opened: !!card,
      wm: card ? card.classList.contains("cx-wm-win") : false,
      hasContent: card ? (card.querySelector(".cx-win-body").textContent || "").length > 40 : false,
      ctx: card ? (card.querySelector(".cx-win-h-ctx") || {}).textContent || "" : "",
      rect: r ? { x: Math.round(r.x), y: Math.round(r.y) } : null,
      dockChips: document.querySelectorAll(".cx-wm-dock-chip").length,
    };
  });
  log("spawn:", JSON.stringify({ opened, ...state }));

  // drag the window by its header
  const head = await page.$(".cx-win-h");
  const hb = await head.boundingBox();
  await page.mouse.move(hb.x + 60, hb.y + 10);
  await page.mouse.down();
  await page.mouse.move(hb.x + 60 + 140, hb.y + 10 + 90, { steps: 8 });
  await page.mouse.up();
  await new Promise(r => setTimeout(r, 400));
  const afterDrag = await page.evaluate(() => {
    const r = document.querySelector(".cx-win").getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y) };
  });
  const dragged = Math.abs(afterDrag.x - state.rect.x - 140) < 12 && Math.abs(afterDrag.y - state.rect.y - 90) < 12;
  log("drag:", JSON.stringify({ before: state.rect, after: afterDrag, dragged }));

  // persistence: reload → window reopens at the dragged geometry
  await boot();
  const persisted = await page.evaluate(() => {
    const card = document.querySelector(".cx-win");
    if (!card) return { reopened: false };
    const r = card.getBoundingClientRect();
    return { reopened: true, x: Math.round(r.x), y: Math.round(r.y) };
  });
  const geoHeld = persisted.reopened && Math.abs(persisted.x - afterDrag.x) < 12 && Math.abs(persisted.y - afterDrag.y) < 12;
  log("persist:", JSON.stringify({ ...persisted, geoHeld }));

  // close + omnibar routing
  await page.evaluate(() => document.querySelector(".cx-win-x").click());
  await new Promise(r => setTimeout(r, 400));
  const closed = await page.evaluate(() => !document.querySelector(".cx-win"));
  await page.keyboard.down("Meta"); await page.keyboard.press("k"); await page.keyboard.up("Meta");
  await new Promise(r => setTimeout(r, 250));
  await page.evaluate(() => {
    const inp = document.querySelector(".cx-omni-input");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(inp, "plans");
    inp.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => {
    const row = [].slice.call(document.querySelectorAll(".cx-omni-row")).find(r => /PLANS panel/i.test(r.textContent));
    if (row) row.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  });
  await new Promise(r => setTimeout(r, 1200));
  const viaOmni = await page.evaluate(() => {
    const card = document.querySelector(".cx-win");
    return { win: !!card, title: card ? (card.querySelector(".cx-win-h-title") || {}).textContent : "" };
  });
  log("closed:", closed, "· omnibar→window:", JSON.stringify(viaOmni));
  log("jsErrors:", JSON.stringify(jsErrors.slice(0, 4)));

  const ok = opened && state.wm && state.hasContent && dragged && geoHeld && closed && viaOmni.win && jsErrors.length === 0;
  log(ok ? "PASS" : "FAIL");
  process.exitCode = ok ? 0 : 1;
} finally {
  await browser.close();
}
