import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:3000/";
const log = (...a) => console.log("[mirror]", ...a);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  const jsErrors = [];
  const chatCalls = [];
  page.on("pageerror", (e) => jsErrors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type()==="error" && !/Failed to load resource/i.test(m.text())) jsErrors.push(m.text()); });
  page.on("request", (r) => { if (/\/api\/chat/.test(r.url())) { try { chatCalls.push({ body: r.postData() }); } catch {} } });
  page.on("response", async (r) => { if (/\/api\/chat/.test(r.url())) { const c = chatCalls[chatCalls.length-1] || (chatCalls.push({})&&chatCalls[chatCalls.length-1]); c.status = r.status(); try { c.resp = (await r.text()).slice(0,200); } catch {} } });

  await page.goto(URL, { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
  await page.waitForFunction(() => document.querySelectorAll(".cx-verse,.cx-verse-row").length > 0, { timeout: 20000 });
  log("booted; verses present");

  const eng = await page.evaluate(() => (window.CODEX_DATA && window.CODEX_DATA.tweaks) || null);
  log("active tweaks engine:", JSON.stringify(eng && { provider: eng.provider, model: eng.model }));

  const opened = await page.evaluate(() => {
    const n = document.querySelector(".cx-vnum");
    if (!n) return false;
    const r = n.getBoundingClientRect();
    n.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left+3, clientY: r.top+3 }));
    return true;
  });
  await new Promise(r => setTimeout(r, 400));
  const menuOpen = await page.evaluate(() => !!document.querySelector(".cx-vm"));
  log("verse menu opened:", menuOpen);

  const clicked = await page.evaluate(() => {
    const rows = [].slice.call(document.querySelectorAll(".cx-vm-row, button, [role='menuitem']"));
    const row = rows.find(b => /mirror/i.test(b.textContent||""));
    if (!row) return { found:false, rows: [].slice.call(document.querySelectorAll(".cx-vm-row")).map(r=>r.textContent.trim()) };
    row.click();
    return { found:true };
  });
  log("clicked MIRROR row:", JSON.stringify(clicked));

  await new Promise(r => setTimeout(r, 1500));
  const modalOpen = await page.evaluate(() => !!document.querySelector(".cx-mirror"));
  log("modal (.cx-mirror) opened:", modalOpen);

  // Wait for generation result (data, error, or loading)
  await page.waitForFunction(() => {
    return document.querySelector(".cx-mirror-body, .cx-mirror-err");
  }, { timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 800));

  const state = await page.evaluate(() => ({
    loading: !!document.querySelector(".cx-mirror-loading"),
    hasBody: !!document.querySelector(".cx-mirror-body"),
    hasErr: !!document.querySelector(".cx-mirror-err"),
    errText: (document.querySelector(".cx-mirror-err code")||{}).textContent || "",
    xrefChips: document.querySelectorAll(".cx-mirror-xref li").length,
    sections: document.querySelectorAll(".cx-mirror-sect").length,
    readerTitleBefore: (document.querySelector(".cx-reader-title, .cx-passage-title, h1, h2")||{}).textContent || "",
  }));
  log("state:", JSON.stringify(state));
  log("chat calls:", JSON.stringify(chatCalls));

  // Try clicking a ref chip and watch reader title / jumpToRef
  let jump = { tried:false };
  if (state.xrefChips > 0) {
    jump = await page.evaluate(() => {
      let called = null;
      const orig = window.codexJumpToRef;
      window.codexJumpToRef = (r) => { called = r; return orig && orig(r); };
      const chip = document.querySelector(".cx-mirror-xref li.is-clickable, .cx-mirror-xref li[role='button']");
      const any = document.querySelector(".cx-mirror-xref li");
      (chip||any).click();
      return { tried:true, clickable: !!chip, refText: (any.querySelector("b")||{}).textContent };
    });
    await new Promise(r => setTimeout(r, 600));
    jump.navState = await page.evaluate(() => ({ mirrorStillOpen: !!document.querySelector(".cx-mirror") }));
  }
  log("ref jump:", JSON.stringify(jump));
  log("jsErrors:", JSON.stringify(jsErrors.slice(0,5)));
} finally {
  await browser.close();
}
