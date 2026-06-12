// smoke-settings.mjs — THE SETTINGS (v12 remake) + HELP CURRENT.
//
// Verifies, against the LIVE page (no hardcoded defaults):
//   a · window.CODEX_SETTINGS_INDEX structurally covers every key of the
//       app's registered tweak defaults (window.CODEX_TWEAK_DEFAULTS — the
//       superset of app.jsx TWEAK_DEFAULTS) OR the key is deliberately
//       listed in window.CODEX_SETTINGS_DEPRECATED. Nothing silently drops.
//   b · the settings panel opens (codex:open-settings), search 'font'
//       live-filters to font rows only.
//   c · flipping the fontScale slider IN THE UI repaints the reader font.
//   d · flipping the theme IN THE UI changes the body class.
//   e · API key inputs are masked (type=password) with a reveal eye and an
//       honest TEST button.
//   f · the danger zone is isolated and confirm-gated.
//   g · works as a 390px mobile sheet too (zero pageerrors).
//   h · HELP: ≥8 articles; one mentions 'palm', one 'thread web'; none
//       presents 'rail'/'deck' as live UI (word-boundary match).
// Zero pageerrors throughout.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const log = (...a) => console.log("[settings]", ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"] });
try {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push("pageerror: " + e.message));
  await page.setViewport({ width: 1680, height: 1050 });
  await page.goto(URL, { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
  await page.waitForFunction(() => document.querySelectorAll(".cx-verse,.cx-verse-row").length > 0, { timeout: 20000 });
  await sleep(600);
  const fail = (m, x) => { throw new Error(m + (x !== undefined ? " · " + JSON.stringify(x) : "")); };

  // a · INVENTORY — index covers live defaults or DEPRECATED; no silent drops.
  const inv = await page.evaluate(() => {
    const idx = window.CODEX_SETTINGS_INDEX || [];
    const dep = new Set(window.CODEX_SETTINGS_DEPRECATED || []);
    const defaults = window.CODEX_TWEAK_DEFAULTS || {};
    const indexed = new Set(idx.map(e => e.key));
    const missing = Object.keys(defaults).filter(k => !indexed.has(k) && !dep.has(k));
    const shape = idx.filter(e => !(e.key && e.label && e.kind && e.group)).map(e => e.key);
    return {
      n: idx.length, nDefaults: Object.keys(defaults).length, nDep: dep.size,
      missing, shape, groups: [...new Set(idx.map(e => e.group))],
      hasOverlays: ["overlayGnosis","overlayTalmud","overlayCommentary","divineGold","divineHebrew"].filter(k => indexed.has(k)),
    };
  });
  if (!inv.n) fail("CODEX_SETTINGS_INDEX missing/empty", inv);
  if (inv.nDefaults < 20) fail("live tweak defaults look unregistered (expected the app's full set)", inv);
  if (inv.missing.length) fail("tweak keys silently dropped from the index", inv.missing);
  if (inv.shape.length) fail("index entries missing key/label/kind/group", inv.shape);
  if (!inv.nDep) fail("DEPRECATED set missing — dead keys must be explicit", inv);
  if (inv.hasOverlays.length !== 5) fail("reader-soul tweak keys (overlays/golden Name) not indexed", inv.hasOverlays);
  log(`inventory: ${inv.n} indexed · ${inv.nDefaults} live defaults covered · ${inv.nDep} deprecated explicit · groups ${inv.groups.join("/")} ✓`);

  // b · OPEN + SEARCH 'font' filters live.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("codex:open-settings", { detail: {} })));
  await page.waitForSelector(".twkx-panel .twkx-search input", { timeout: 10000 });
  await page.type(".twkx-panel .twkx-search input", "font");
  await sleep(250);
  const search = await page.evaluate(() => {
    const items = [...document.querySelectorAll(".twkx-item")];
    const visible = items.filter(el => !el.classList.contains("twkx-hide") && el.getAttribute("data-passive") !== "1");
    return {
      total: items.length, shown: visible.length,
      texts: visible.map(el => (el.textContent || "").slice(0, 60)),
      allFontish: visible.every(el => /font|size|face|scale/i.test((el.textContent || "") + (el.getAttribute("data-kw") || ""))),
    };
  });
  if (!search.shown || search.shown >= search.total) fail("search 'font' did not filter", search);
  if (!search.allFontish) fail("search 'font' shows non-font rows", search.texts);
  log(`search 'font': ${search.shown}/${search.total} rows · all font-related ✓`);

  // c · fontScale UI flip → reader repaints (live preview).
  await page.evaluate(() => {
    const i = document.querySelector(".twkx-search input");
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(i, "");
    i.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await sleep(200);
  const before = await page.evaluate(() => {
    const v = document.querySelector(".cxr .cxr-v, .cx-verse, .cx-verse-row");
    return v ? getComputedStyle(v).fontSize : null;
  });
  const flipped = await page.evaluate(() => {
    const sliders = [...document.querySelectorAll('.twkx-panel input[type="range"]')];
    const s = sliders.find(el => /scripture size/i.test(el.getAttribute("aria-label") || ""));
    if (!s) return null;
    const cur = Number(s.value);
    const next = cur >= Number(s.max) ? Number(s.min) : cur + 4;
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    proto.set.call(s, String(Math.min(next, Number(s.max))));
    s.dispatchEvent(new Event("input", { bubbles: true }));
    s.dispatchEvent(new Event("change", { bubbles: true }));
    return { cur, next: Number(s.value) };
  });
  if (!flipped) fail("Scripture size slider not found in panel");
  await sleep(500);
  const after = await page.evaluate(() => {
    const v = document.querySelector(".cxr .cxr-v, .cx-verse, .cx-verse-row");
    return v ? getComputedStyle(v).fontSize : null;
  });
  if (!before || !after || before === after) fail("fontScale UI flip did not repaint the reader", { before, after, flipped });
  log(`fontScale live preview: reader ${before} → ${after} (slider ${flipped.cur} → ${flipped.next}) ✓`);

  // d · THEME flip in the UI → the page theme class changes (.cx-app is the
  // app's body surface: is-dark ↔ is-light).
  const themeClass = () => page.evaluate(() => {
    const app = document.querySelector(".cx-app");
    return (app.className.match(/is-(dark|light)/) || [document.body.className])[0];
  });
  const themeBefore = await themeClass();
  await page.evaluate(() => {
    const seg = [...document.querySelectorAll('.twkx-panel [role="radiogroup"]')]
      .find(g => /theme/i.test(g.getAttribute("aria-label") || ""));
    const btns = [...seg.querySelectorAll('button[role="radio"]')];
    const off = btns.find(b => b.getAttribute("aria-checked") !== "true" && !/auto/i.test(b.textContent));
    off.click();
  });
  await sleep(600);
  const themeAfter = await themeClass();
  if (themeBefore === themeAfter) fail("theme flip did not change the page theme class", { themeBefore, themeAfter });
  log(`theme flip: page theme class '${themeBefore}' → '${themeAfter}' ✓`);

  // e · API keys masked + reveal + honest TEST.
  const keys = await page.evaluate(() => {
    const panel = document.querySelector(".twkx-panel");
    const pw = [...panel.querySelectorAll('input[type="password"]')];
    const eyes = [...panel.querySelectorAll(".twkx-eye, .cx-api-eye")];
    const tests = [...panel.querySelectorAll("button")].filter(b => /^test/i.test((b.textContent || "").trim()));
    return { masked: pw.length, eyes: eyes.length, tests: tests.length };
  });
  if (!keys.masked) fail("no masked (type=password) API key inputs", keys);
  if (!keys.eyes) fail("no reveal eye next to key inputs", keys);
  if (!keys.tests) fail("no TEST button for the AI engine", keys);
  // reveal flips the type — honesty of the eye (React renders async, so
  // click → settle → read → click back).
  const eyeRead = () => page.evaluate(() => {
    const eye = document.querySelector(".twkx-panel .twkx-eye, .twkx-panel .cx-api-eye");
    const row = eye.closest(".twkx-keyrow, .cx-api-row") || eye.parentElement;
    return row.querySelector("input").type;
  });
  const eyeClick = () => page.evaluate(() => {
    document.querySelector(".twkx-panel .twkx-eye, .twkx-panel .cx-api-eye").click();
  });
  const t0 = await eyeRead();
  await eyeClick(); await sleep(200);
  const t1 = await eyeRead();
  await eyeClick(); await sleep(200);
  const reveal = { t0, t1 };
  if (!(reveal.t0 === "password" && reveal.t1 === "text")) fail("reveal eye does not unmask", reveal);
  log(`api keys: ${keys.masked} masked input(s) · reveal eye works (password→text) · TEST button present ✓`);

  // f · DANGER zone isolated + confirm-gated.
  const danger = await page.evaluate(() => {
    const g = document.querySelector('.twkx-group[data-group="DANGER"]');
    if (!g) return null;
    window.__cxConfirmCalls = 0;
    const realConfirm = window.confirm;
    window.confirm = () => { window.__cxConfirmCalls++; return false; }; // refuse — nothing may change
    const btns = [...g.querySelectorAll("button")].filter(b => b.offsetParent !== null);
    btns.forEach(b => b.click());
    window.confirm = realConfirm;
    return { exists: true, btns: btns.length, confirms: window.__cxConfirmCalls };
  });
  if (!danger) fail("DANGER group missing");
  if (!danger.btns) fail("DANGER group has no actions", danger);
  if (danger.confirms < danger.btns) fail("danger actions not all confirm-gated", danger);
  log(`danger zone: isolated group · ${danger.btns} action(s), all confirm-gated ✓`);

  // g · hit targets ≥44px on interactive rows (toggles ride a 44px row).
  const hits = await page.evaluate(() => {
    const small = [];
    document.querySelectorAll(".twkx-panel .twk-toggle, .twkx-panel .twk-btn, .twkx-panel .twkx-x").forEach(el => {
      const r = el.getBoundingClientRect();
      const row = el.closest(".twk-row-h");
      const h = row ? row.getBoundingClientRect().height : r.height;
      if (Math.max(h, r.height) < 43.5) small.push(el.className + ":" + Math.round(h));
    });
    return small;
  });
  if (hits.length) fail("interactive targets under 44px", hits.slice(0, 6));
  log("hit targets: toggles/buttons ride ≥44px rows ✓");

  // h · HELP corpus — current, honest.
  const helpData = JSON.parse(fs.readFileSync(new globalThis.URL("../data/help/articles.json", import.meta.url), "utf8"));
  const arts = helpData.articles || [];
  if (arts.length < 8) fail("help has fewer than 8 articles", arts.length);
  const hay = (a) => (a.title + "\n" + a.body).toLowerCase();
  if (!arts.some(a => /\bpalm\b/.test(hay(a)))) fail("no help article mentions 'palm'");
  if (!arts.some(a => /thread web/.test(hay(a)))) fail("no help article mentions 'thread web'");
  const deadUI = arts.filter(a => /\brails?\b|\bdeck\b/.test(hay(a))).map(a => a.id);
  if (deadUI.length) fail("articles still present rail/deck as live UI", deadUI);
  log(`help: ${arts.length} articles · palm ✓ · thread web ✓ · no rail/deck as live UI ✓`);

  // h2 · HELP tab renders inside the panel.
  await page.evaluate(() => {
    [...document.querySelectorAll('.twkx-mode button')].find(b => /help/i.test(b.textContent)).click();
  });
  await page.waitForSelector(".twkx-help-body .cx-help", { timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll(".cx-help-catcard, .cx-help-row").length >= 5, { timeout: 15000 });
  log("help wiki renders inside the settings window ✓");

  // close, then i · MOBILE 390px sheet.
  await page.keyboard.press("Escape");
  await sleep(300);
  const m = await ctx.newPage();
  const mErrors = [];
  m.on("pageerror", (e) => mErrors.push("pageerror: " + e.message));
  await m.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await m.goto(URL, { waitUntil: "load", timeout: 30000 });
  await m.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
  await sleep(800);
  await m.evaluate(() => window.dispatchEvent(new CustomEvent("codex:open-settings", { detail: {} })));
  await m.waitForSelector(".twkx-panel", { timeout: 10000 });
  const mob = await m.evaluate(() => {
    const p = document.querySelector(".twkx-panel");
    const r = p.getBoundingClientRect();
    return {
      w: Math.round(r.width), full: Math.abs(r.width - window.innerWidth) < 2,
      navRow: getComputedStyle(document.querySelector(".twkx-nav")).flexDirection,
      search: !!p.querySelector(".twkx-search input"),
    };
  });
  if (!mob.full) fail("mobile sheet not full-width at 390px", mob);
  if (!mob.search) fail("mobile sheet lost the search field", mob);
  log(`mobile 390px: full-width sheet (${mob.w}px) · horizontal nav (${mob.navRow}) · search present ✓`);
  if (mErrors.length) fail("mobile pageerrors", mErrors);

  if (jsErrors.length) fail("pageerrors", jsErrors);
  log("ALL GREEN — zero pageerrors");
} finally {
  await browser.close();
}
