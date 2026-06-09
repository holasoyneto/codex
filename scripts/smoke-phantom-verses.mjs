// CODEX — phantom-verse regression smoke.
// Repro: a compare translation with divergent versification (Vulgate
// Psalm 39 = Masoretic Psalm 40) used to inject empty verse rows past the
// end of the primary translation's chapter. This drives the real app to
// Psalms 39 (KJV primary + Vulgate compare loaded via loadMulti) and
// asserts every rendered verse row has non-empty text.
// Run: node scripts/smoke-phantom-verses.mjs   (server must be on :7777)
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const fail = (m) => { console.error("[smoke-phantom] FAIL —", m); process.exit(1); };

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});
try {
  const page = await browser.newPage();
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push("pageerror: " + e.message));

  console.log("[smoke-phantom] loading", URL);
  await page.goto(URL, { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 })
    .catch(() => fail("__CODEX_READY__ never became true"));

  // 1) Data layer: loadMulti must not emit rows whose every translation
  //    text is empty.
  const multi = await page.evaluate(async () => {
    const verses = await window.BIBLE.loadMulti("psa", 39, ["kjv", "clementine"]);
    return verses.map(v => ({
      n: v.n,
      hasAny: Object.keys(v).some(k => k !== "n" && String(v[k] || "").trim()),
      hasKjv: !!String(v.kjv || "").trim(),
    }));
  }).catch(e => fail("loadMulti threw: " + e.message));
  const emptyRows = multi.filter(v => !v.hasAny);
  if (emptyRows.length) fail("loadMulti emitted all-empty rows: " + JSON.stringify(emptyRows));
  console.log(`[smoke-phantom] loadMulti psa.39 [kjv,clementine]: ${multi.length} merged rows, 0 all-empty.`);

  // 2) Render layer: navigate the live reader to Psalms 39 and assert no
  //    rendered row is blank. (Compare translations stay merged into
  //    passage.verses even in single-column mode — the old bug.)
  await page.evaluate(() => window.codexJumpToRef("Psalms 39:1"));
  await page.waitForFunction(() => {
    const h1 = document.querySelector(".cx-reader-titles h1");
    const rows = document.querySelectorAll(".cx-verse, .cx-verse-row");
    return h1 && /psalm/i.test(h1.textContent || "") && rows.length > 0;
  }, { timeout: 30000 }).catch(() => fail("Psalms 39 never rendered"));
  // Let any late compare-translation merge repaint settle.
  await new Promise(r => setTimeout(r, 1500));

  const rendered = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".cx-verse, .cx-verse-row")).map(el => {
      const num = (el.querySelector("[class*='num'], sup") || {}).textContent || "";
      const clone = el.cloneNode(true);
      clone.querySelectorAll("[class*='num'], sup").forEach(n => n.remove());
      return { num: num.trim(), text: (clone.textContent || "").trim() };
    })
  );
  const blank = rendered.filter(r => !r.text);
  if (blank.length) fail("blank verse rows rendered: " + JSON.stringify(blank));
  if (jsErrors.length) fail("JS errors: " + JSON.stringify(jsErrors));
  console.log(`[smoke-phantom] PASS — ${rendered.length} rendered rows, all non-empty (last: v${rendered[rendered.length - 1]?.num}).`);
} finally {
  await browser.close();
}
