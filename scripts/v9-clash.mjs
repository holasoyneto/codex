import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox","--disable-gpu","--force-device-scale-factor=1"] });
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
await page.setViewport({ width: 1880, height: 1100 });
await page.goto("http://localhost:7777/", { waitUntil: "load", timeout: 30000 });
await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
await sleep(800);
// dark mode + simulate a returning session so the briefing shows
await page.evaluate(() => {
  const tw = JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}");
  tw.autoTheme = false; tw.manualDark = true;
  localStorage.setItem("codex.tweaks.v1", JSON.stringify(tw));
  localStorage.setItem("codex.session.last", JSON.stringify({ bookId: "gen", chapter: 1, ts: Date.now() - 86400000 }));
});
await page.reload({ waitUntil: "load" });
await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
await sleep(1500);
const state = await page.evaluate(() => ({
  brief: !!document.querySelector(".cx-desk-brief"),
  briefInReader: !!document.querySelector('[data-desk="sys:reader"] .cx-wb, [data-desk="sys:reader"] .cx-welcome-back'),
  riserVisible: (() => { const l = document.querySelector('[data-desk="sys:reader"] .cx-frame-label'); return l ? getComputedStyle(l).display !== "none" : false; })(),
  readerCtx: (document.querySelector('[data-desk="sys:reader"] .cx-win-h-ctx') || {}).textContent,
}));
console.log(JSON.stringify(state));
await page.screenshot({ path: "/tmp/v91-clash-top.png", clip: { x: 0, y: 0, width: 1880, height: 700 } });
await browser.close();
