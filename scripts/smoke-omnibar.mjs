// smoke-omnibar.mjs — ⌘K omnibar smoke: open, ref preview, verb rows,
// live search rows, mission row, execute a jump. Zero JS pageerrors.
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const log = (...a) => console.log("[omni]", ...a);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type()==="error" && !/Failed to load resource/i.test(m.text())) jsErrors.push(m.text()); });

  await page.goto(URL, { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
  await page.waitForFunction(() => document.querySelectorAll(".cx-verse,.cx-verse-row").length > 0, { timeout: 20000 });

  // ⌘K opens
  await page.keyboard.down("Meta"); await page.keyboard.press("k"); await page.keyboard.up("Meta");
  await new Promise(r => setTimeout(r, 400));
  const open1 = await page.evaluate(() => !!document.querySelector(".cx-omni"));
  log("⌘K opens:", open1);

  // Ref mode: preview + verb fan
  await page.type(".cx-omni-input", "Genesis 1:1", { delay: 12 });
  await new Promise(r => setTimeout(r, 1200));
  const refState = await page.evaluate(() => ({
    rows: document.querySelectorAll(".cx-omni-row").length,
    preview: (document.querySelector(".cx-omni-preview p")||{}).textContent || "",
    firstRow: (document.querySelector(".cx-omni-row b")||{}).textContent || "",
  }));
  log("ref mode:", JSON.stringify({ rows: refState.rows, firstRow: refState.firstRow, preview: refState.preview.slice(0, 60) }));

  // Search mode
  await page.evaluate(() => {
    const inp = document.querySelector(".cx-omni-input");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(inp, "light");
    inp.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 900));
  const searchState = await page.evaluate(() => ({
    rows: document.querySelectorAll(".cx-omni-row").length,
    hits: [].slice.call(document.querySelectorAll(".cx-omni-row b")).map(b => b.textContent).slice(0, 3),
    missionRow: [].slice.call(document.querySelectorAll(".cx-omni-row b")).some(b => /^Mission:/.test(b.textContent)),
  }));
  log("search mode:", JSON.stringify(searchState));

  // Execute a ref jump end-to-end
  await page.evaluate(() => {
    const inp = document.querySelector(".cx-omni-input");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(inp, "Psalms 23");
    inp.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 700));
  await page.keyboard.press("Enter");
  await new Promise(r => setTimeout(r, 1800));
  const after = await page.evaluate(() => ({
    omniClosed: !document.querySelector(".cx-omni"),
    // v10: the rebuilt reader shows its location in .cxr-loc b; the old
    // .cx-reader-titles h1 stays as a fallback for the classic path.
    title: (document.querySelector(".cxr-loc b, .cx-reader-titles h1, h1")||{}).textContent || "",
    trail: JSON.parse(localStorage.getItem("codex.trail") || "[]").length,
  }));
  log("after jump:", JSON.stringify(after));

  log("jsErrors:", JSON.stringify(jsErrors.slice(0,5)));
  const ok = open1
    && refState.rows >= 5 && refState.preview.length > 10
    && searchState.rows >= 1 && searchState.missionRow !== undefined
    && after.omniClosed && /psalm/i.test(after.title)
    && jsErrors.length === 0;
  log(ok ? "PASS" : "FAIL");
  process.exitCode = ok ? 0 : 1;
} finally {
  await browser.close();
}
