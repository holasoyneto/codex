// smoke-ghosts.mjs — the 18 "ghost" registry books (deuterocanon /
// pseudepigrapha entries no translation source carried) must now load
// real text from the "beyond" bundle instead of a dead page. For every
// ghost id, loadChapter(id, 1, "beyond") must return ≥1 verse of
// non-empty text; 2 Baruch 53 (the reported dead page) must be the cloud
// vision — if it doesn't mention the cloud and the waters, the chapter
// alignment is wrong.
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const log = (...a) => console.log("[ghosts]", ...a);

const GHOSTS = [
  "esg", "jub", "1mq", "2mq", "3mq", "4ezr", "3co", "lao", "ps2",
  "2ba", "epb", "1cl", "2cl", "2en", "3en", "jas-pat", "od-sol", "ap-mos",
];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push("pageerror: " + e.message));
  await page.setViewport({ width: 1680, height: 1050 });
  await page.goto(URL, { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });

  const res = await page.evaluate(async (ids) => {
    const out = { books: {}, baruch53: null };
    for (const id of ids) {
      try {
        const verses = await window.BIBLE.loadChapter(id, 1, "beyond");
        out.books[id] = {
          count: Array.isArray(verses) ? verses.length : 0,
          first: verses?.[0]?.text || "",
          allNonEmpty: Array.isArray(verses) && verses.length > 0 &&
            verses.every((v) => typeof v.text === "string" && v.text.trim().length > 0),
        };
      } catch (e) {
        out.books[id] = { error: String(e?.message || e) };
      }
    }
    const b53 = await window.BIBLE.loadChapter("2ba", 53, "beyond");
    out.baruch53 = { count: b53?.length || 0, text: (b53 || []).map((v) => v.text).join(" ") };
    return out;
  }, GHOSTS);

  const fail = (m) => { throw new Error(m); };
  for (const id of GHOSTS) {
    const r = res.books[id];
    if (!r || r.error) fail(`${id} ch1 failed to load: ${r?.error}`);
    if (!r.count || !r.allNonEmpty) fail(`${id} ch1 returned ${r?.count || 0} verses / empty text`);
    log(`${id}: ${r.count} vv · ${r.first.slice(0, 60)}`);
  }
  // 2 Baruch 53 is the vision of the cloud rising from the sea raining
  // black and bright waters — the user's original dead page.
  if (!res.baruch53.count) fail("2ba ch53 returned no verses");
  if (!/cloud/i.test(res.baruch53.text) || !/waters/i.test(res.baruch53.text))
    fail("2ba ch53 is not the cloud vision — chapter alignment is wrong: " + res.baruch53.text.slice(0, 120));
  log(`2ba.53: ${res.baruch53.count} vv · cloud vision confirmed`);

  if (jsErrors.length) fail("JS errors: " + jsErrors.join(" | "));
  log("PASS");
} finally {
  await browser.close();
}
