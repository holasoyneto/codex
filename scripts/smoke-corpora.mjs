// smoke-corpora.mjs — real corpora: WLC (Hebrew Tanakh) + SBLGNT (Greek NT)
// ship as offline bundles. Loading Genesis 1 in WLC and John 1 in SBLGNT
// must return real original-language text from the bundle path, and the
// library must scope its shelf to the testament the corpus contains.
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const log = (...a) => console.log("[corpora]", ...a);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push("pageerror: " + e.message));
  await page.setViewport({ width: 1680, height: 1050 });
  await page.goto(URL, { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });

  const res = await page.evaluate(async () => {
    const wlc = await window.BIBLE.loadChapter("gen", 1, "wlc");
    const sbl = await window.BIBLE.loadChapter("jhn", 1, "sblgnt");
    const reg = window.CODEX_DATA.translations;
    return {
      wlcCount: wlc.length, wlcV1: wlc[0]?.text || "",
      sblCount: sbl.length, sblV1: sbl[0]?.text || "",
      wlcCanons: reg.find(t => t.id === "wlc")?.canons,
      sblCanons: reg.find(t => t.id === "sblgnt")?.canons,
    };
  });

  const fail = (m) => { throw new Error(m + " · " + JSON.stringify(res)); };
  if (res.wlcCount !== 31) fail("WLC Gen 1 should have 31 verses");
  // Hebrew block test (cantillation marks sit between letters, so don't
  // string-match words — just require the text to be substantially Hebrew).
  if (!/[֐-׿]{2}/.test(res.wlcV1)) fail("WLC Gen 1:1 is not Hebrew");
  if (res.sblCount < 50) fail("SBLGNT John 1 should have ~51 verses");
  if (!/λόγος|ἀρχῇ/.test(res.sblV1)) fail("SBLGNT John 1:1 is not Greek");
  if (!res.wlcCanons?.includes("ot")) fail("wlc registry entry missing canons:['ot']");
  if (!res.sblCanons?.includes("nt")) fail("sblgnt registry entry missing canons:['nt']");
  if (jsErrors.length) fail("JS errors: " + jsErrors.join(" | "));

  log("WLC Gen 1:", res.wlcCount, "vv ·", res.wlcV1.slice(0, 40));
  log("SBLGNT Jhn 1:", res.sblCount, "vv ·", res.sblV1.slice(0, 40));
  log("PASS");
} finally {
  await browser.close();
}
