// smoke-sword.mjs — ⚔ SWORD (fourfold-edge console) interaction smoke.
// Boots the app, opens the verse menu, clicks SWORD, and asserts the console
// reaches a body / error state. Probes the blade canvas, the strata pair
// cards, gematria chips, and a stratum ref-jump. Mirrors smoke-map.mjs.
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const log = (...a) => console.log("[sword]", ...a);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type()==="error" && !/Failed to load resource/i.test(m.text())) jsErrors.push(m.text()); });

  await page.goto(URL, { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
  await page.waitForFunction(() => document.querySelectorAll(".cx-verse,.cx-verse-row").length > 0, { timeout: 20000 });
  log("booted; verses present");

  const opened = await page.evaluate(() => {
    const n = document.querySelector(".cx-vnum");
    if (!n) return false;
    const r = n.getBoundingClientRect();
    n.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left+3, clientY: r.top+3 }));
    return true;
  });
  await new Promise(r => setTimeout(r, 400));
  log("verse menu opened:", await page.evaluate(() => !!document.querySelector(".cx-vm")), "(ctx:", opened, ")");

  const clicked = await page.evaluate(() => {
    const rows = [].slice.call(document.querySelectorAll(".cx-vm-row, button, [role='menuitem']"));
    // No \b — row text runs glyphs/labels together ("⚔SWORDfourfold edge…").
    const row = rows.find(b => /sword/i.test(b.textContent||""));
    if (!row) return { found:false, rows: [].slice.call(document.querySelectorAll(".cx-vm-row")).map(r=>r.textContent.trim()) };
    row.click();
    return { found:true };
  });
  log("clicked SWORD row:", JSON.stringify(clicked));

  await new Promise(r => setTimeout(r, 1200));
  log("console (.cx-sword) opened:", await page.evaluate(() => !!document.querySelector(".cx-sword")));

  // Wait for the analysis (cached or live AI — can take ~30s) or an error.
  await page.waitForFunction(() => {
    return document.querySelector(".cx-sword-body, .cx-sword-err");
  }, { timeout: 60000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2200)); // let the cleave animation land

  const state = await page.evaluate(() => ({
    loading: !!document.querySelector(".cx-sword-loading"),
    hasBody: !!document.querySelector(".cx-sword-body"),
    hasErr: !!document.querySelector(".cx-sword-err"),
    errText: (document.querySelector(".cx-sword-err code")||{}).textContent || "",
    canvas: !!document.querySelector(".cx-sword-canvas"),
    strata: document.querySelectorAll(".cx-sword-stratum").length,
    pairs: document.querySelectorAll(".cx-sword-pair").length,
    gemChips: document.querySelectorAll(".cx-sword-gem-chip").length,
    refs: document.querySelectorAll(".cx-sword-ref").length,
    caveats: !!document.querySelector(".cx-sword-caveats"),
    banner: !!document.querySelector(".cx-sword .cx-intel-banner, .cx-sword + .cx-intel-banner, .cx-sword-backdrop .cx-intel-banner"),
  }));
  log("state:", JSON.stringify(state));

  // If strata rendered, try a ref-jump from the first stratum footer.
  if (state.hasBody && state.refs > 0) {
    const jump = await page.evaluate(() => {
      let called = null;
      const orig = window.codexJumpToRef;
      window.codexJumpToRef = (r) => { called = r; return orig && orig(r); };
      const btn = document.querySelector(".cx-sword-ref");
      const label = (btn.querySelector("b")||{}).textContent || "";
      btn.click();
      return { label, called };
    });
    log("ref jump:", JSON.stringify(jump));
  }

  log("jsErrors:", JSON.stringify(jsErrors.slice(0,5)));
  const ok = (state.hasBody || state.hasErr) && jsErrors.length === 0
    && (!state.hasBody || state.strata === 4); // a real analysis must cleave into exactly 4
  log(ok ? "PASS" : "FAIL");
  process.exitCode = ok ? 0 : 1;
} finally {
  await browser.close();
}
