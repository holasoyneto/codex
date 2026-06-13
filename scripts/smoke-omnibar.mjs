// smoke-omnibar.mjs — ⌘K omnibar smoke: open, GUIDE MODE empty-state (living
// example rows that execute), forgiving input ('Jhon 3 16' → did-you-mean),
// never-a-dead-end fallbacks ('xqzzt' → kernel/search/Oracle), ref preview,
// verb rows, live search rows, mission row, execute a jump. Zero JS pageerrors.
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

  const setOmniValue = (v) => page.evaluate((val) => {
    const inp = document.querySelector(".cx-omni-input");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(inp, val);
    inp.dispatchEvent(new Event("input", { bubbles: true }));
  }, v);
  const openOmni = async () => {
    await page.keyboard.down("Meta"); await page.keyboard.press("k"); await page.keyboard.up("Meta");
    await new Promise(r => setTimeout(r, 400));
    return page.evaluate(() => !!document.querySelector(".cx-omni"));
  };
  const readerTitle = () => page.evaluate(() =>
    (document.querySelector(".cxr-loc b, .cx-reader-titles h1, h1")||{}).textContent || "");

  // ── 1 · ⌘K opens INTO GUIDE MODE — living example rows, first-run line ──
  const open1 = await openOmni();
  const guide = await page.evaluate(() => ({
    rows: document.querySelectorAll(".cx-omni-row.is-guide").length,
    firstline: !!document.querySelector(".cx-omni-firstline"),
    titles: [...document.querySelectorAll(".cx-omni-row.is-guide b")].map(b => b.textContent),
    allHaveSubs: [...document.querySelectorAll(".cx-omni-row.is-guide .cx-omni-row-txt span")].length >= 4,
  }));
  log("⌘K opens:", open1, "guide:", JSON.stringify(guide));

  // ── 2 · clicking a guide example EXECUTES (reader jumps to John 3:16) ──
  const guideClicked = await page.evaluate(() => {
    const row = [...document.querySelectorAll(".cx-omni-row.is-guide")]
      .find(r => /John 3:16/.test(r.textContent));
    if (!row) return false;
    row.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    return true;
  });
  await new Promise(r => setTimeout(r, 1800));
  const afterGuide = {
    clicked: guideClicked,
    omniClosed: await page.evaluate(() => !document.querySelector(".cx-omni")),
    title: await readerTitle(),
    firstRunDismissed: await page.evaluate(() => { try { return localStorage.getItem("codex.omni.guided.v1") === "1"; } catch { return false; } }),
  };
  log("guide exec:", JSON.stringify(afterGuide));

  // ── 3 · ref mode: preview + verb fan (existing contract) ──
  await openOmni();
  await page.type(".cx-omni-input", "Genesis 1:1", { delay: 12 });
  await new Promise(r => setTimeout(r, 1200));
  const refState = await page.evaluate(() => ({
    rows: document.querySelectorAll(".cx-omni-row").length,
    preview: (document.querySelector(".cx-omni-preview p")||{}).textContent || "",
    firstRow: (document.querySelector(".cx-omni-row b")||{}).textContent || "",
  }));
  log("ref mode:", JSON.stringify({ rows: refState.rows, firstRow: refState.firstRow, preview: refState.preview.slice(0, 60) }));

  // ── 4 · FORGIVING INPUT — 'Jhon 3 16' resolves via did-you-mean ──
  await setOmniValue("Jhon 3 16");
  await new Promise(r => setTimeout(r, 900));
  const fuzzy = await page.evaluate(() => ({
    firstRow: (document.querySelector(".cx-omni-row b")||{}).textContent || "",
    rows: document.querySelectorAll(".cx-omni-row").length,
  }));
  log("fuzzy 'Jhon 3 16':", JSON.stringify(fuzzy));
  await page.keyboard.press("Enter");
  await new Promise(r => setTimeout(r, 1600));
  const fuzzyTitle = await readerTitle();
  log("after fuzzy jump:", fuzzyTitle);

  // ── 5 · NEVER A DEAD END — gibberish gets kernel/search/Oracle rows ──
  await openOmni();
  await setOmniValue("xqzzt");
  await new Promise(r => setTimeout(r, 1000));
  const deadEnd = await page.evaluate(() => {
    const titles = [...document.querySelectorAll(".cx-omni-row b")].map(b => b.textContent);
    return {
      rows: titles.length,
      fallbacks: titles.filter(t => /ask the kernel|search the text|ask the Oracle/i.test(t)).length,
      titles: titles.slice(0, 4),
    };
  });
  log("gibberish 'xqzzt':", JSON.stringify(deadEnd));

  // ── 6 · search mode (existing contract) ──
  await setOmniValue("light");
  await new Promise(r => setTimeout(r, 900));
  const searchState = await page.evaluate(() => ({
    rows: document.querySelectorAll(".cx-omni-row").length,
    hits: [].slice.call(document.querySelectorAll(".cx-omni-row b")).map(b => b.textContent).slice(0, 3),
    missionRow: [].slice.call(document.querySelectorAll(".cx-omni-row b")).some(b => /^Mission:/.test(b.textContent)),
  }));
  log("search mode:", JSON.stringify(searchState));

  // ── 7 · execute a ref jump end-to-end (existing contract) ──
  await setOmniValue("Psalms 23");
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
    && guide.rows >= 4 && guide.firstline && guide.allHaveSubs
    && afterGuide.clicked && afterGuide.omniClosed && /john/i.test(afterGuide.title) && afterGuide.firstRunDismissed
    && refState.rows >= 5 && refState.preview.length > 10
    && /did you mean john 3:16/i.test(fuzzy.firstRow) && /john/i.test(fuzzyTitle)
    && deadEnd.rows >= 2 && deadEnd.fallbacks >= 2
    && searchState.rows >= 1 && searchState.missionRow !== undefined
    && after.omniClosed && /psalm/i.test(after.title)
    && jsErrors.length === 0;
  log(ok ? "PASS" : "FAIL");
  process.exitCode = ok ? 0 : 1;
} finally {
  await browser.close();
}
