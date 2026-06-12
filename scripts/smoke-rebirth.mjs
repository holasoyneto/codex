// smoke-rebirth.mjs — v10 REBIRTH end-to-end:
//   · the reader rebuilt from zero as the MAIN plugin (sys-reader)
//   · red letters from the generated WEB <wj> truth (Mark 1:17 red, 1:18 NOT)
//   · the library dismantled → shelves / oracle / marks plugins + desk windows
//   · every canon on the shelves; apocrypha served via the corpus workflow
//   · customizable dock, READER first — always
//   · galaxy star dossier (codexConstInspect) with READ/NEAR/PATH verbs
//   · open-anything: talmud.* → Sefaria text window
//   · multi-display: ?surface= satellite + BroadcastChannel cursor sync
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const log = (...a) => console.log("[rebirth]", ...a);
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
  await sleep(800);
  const fail = (m, x) => { throw new Error(m + (x !== undefined ? " · " + JSON.stringify(x) : "")); };

  // 1 · The reader is the MAIN PLUGIN and renders in the desk window.
  const boot = await page.evaluate(() => ({
    plugin: !!(window.CODEX_PLUGINS_API && window.CODEX_PLUGINS_API.list().some(p => p.id === "sys-reader")),
    sysPlugins: ["sys-reader","sys-library","sys-oracle","sys-marks"].filter(id =>
      window.CODEX_PLUGINS_API && window.CODEX_PLUGINS_API.list().some(p => p.id === id)),
    cxr: !!document.querySelector('[data-desk="sys:reader"] .cxr'),
  }));
  if (!boot.plugin || !boot.cxr) fail("reader plugin / .cxr missing", boot);
  if (boot.sysPlugins.length !== 4) fail("system plugins missing", boot);
  log("reader is the main plugin; library/oracle/marks registered as plugins ✓");

  // 2 · Verses render through the new reader (network: bolls/bible-api mirrors).
  await page.evaluate(() => window.codexJumpToRef && window.codexJumpToRef("John 1:1"));
  await page.waitForFunction(() => document.querySelectorAll(".cxr-v").length > 10, { timeout: 60000 });
  log(`reader renders verses ✓ (${await page.evaluate(() => document.querySelectorAll(".cxr-v").length)} rows)`);

  // 3 · RED LETTERS — truth-generated. John 1: vv 38-39 red, vv 1-5 never.
  const jhn = await page.evaluate(() => {
    const red = [...document.querySelectorAll(".cxr-v.is-red")].map(n => +n.getAttribute("data-vn"));
    return { red, v1red: red.includes(1), v38: red.includes(38), v39: red.includes(39) };
  });
  if (jhn.v1red) fail("John 1:1 must NOT be red", jhn);
  if (!jhn.v38 || !jhn.v39) fail("John 1:38-39 must be red", jhn);
  // THE reported bug: Mark 1:18 ('they forsook their nets' — narrative) was red.
  await page.evaluate(() => window.codexJumpToRef("Mark 1:1"));
  await page.waitForFunction(() => {
    const n = window.CODEX_NOW; return n && n.book === "Mark" && document.querySelectorAll(".cxr-v").length > 10;
  }, { timeout: 60000 });
  await sleep(400);
  const mrk = await page.evaluate(() => {
    const red = [...document.querySelectorAll(".cxr-v.is-red")].map(n => +n.getAttribute("data-vn"));
    return { v17: red.includes(17), v18: red.includes(18), red };
  });
  if (!mrk.v17) fail("Mark 1:17 ('follow me') must be red", mrk);
  if (mrk.v18) fail("Mark 1:18 (narrative) must NOT be red — the reported bug", mrk);
  log("red letters: Jn 1:38-39 ✓, Jn 1:1 clean ✓, Mk 1:17 ✓, Mk 1:18 clean ✓ (bug fixed)");

  // 4 · DOCK — customizable, reader first, always.
  const dock = await page.evaluate(() => {
    const chips = [...document.querySelectorAll(".cx-wm-dock-launch span")].map(s => s.textContent).filter(Boolean);
    return { chips, first: chips[0] };
  });
  if (dock.first !== "READER") fail("first dock chip must be READER", dock);
  // customization: store an order WITHOUT reader → reader still forced first
  const custom = await page.evaluate(() => {
    localStorage.setItem("codex.dock.v2", JSON.stringify(["canon", "omni", "sword"]));
    window.dispatchEvent(new CustomEvent("codex:desk"));
    return new Promise(res => setTimeout(() => {
      res([...document.querySelectorAll(".cx-wm-dock-launch span")].map(s => s.textContent).filter(Boolean));
    }, 300));
  });
  if (custom[0] !== "READER" || !custom.includes("GALAXY")) fail("custom dock must keep READER first + honor pins", custom);
  await page.evaluate(() => {
    localStorage.removeItem("codex.dock.v2");
    window.dispatchEvent(new CustomEvent("codex:desk"));
  });
  // the ✎ editor opens
  await page.evaluate(() => { [...document.querySelectorAll(".cx-wm-dock-edit")].pop()?.click(); });
  await sleep(200);
  const editor = await page.evaluate(() => ({
    pop: !!document.querySelector(".cx-wm-dockpop"),
    lockedReader: !!document.querySelector(".cx-wm-dockpop-row input[disabled]"),
    rows: document.querySelectorAll(".cx-wm-dockpop-row").length,
  }));
  if (!editor.pop || !editor.lockedReader || editor.rows < 8) fail("dock editor wrong", editor);
  await page.keyboard.press("Escape");
  await page.evaluate(() => document.body.click());
  log(`dock: READER first (law enforced over custom pins), ✎ editor with ${editor.rows} chips ✓`);

  // 5 · THE SHELVES — every canon visible; apocrypha opens via the workflow.
  await page.evaluate(() => window.codexDesk.open("library"));
  await page.waitForSelector('[data-desk="sys:library"] .cxl', { timeout: 10000 });
  const shelves = await page.evaluate(() =>
    [...document.querySelectorAll('[data-desk="sys:library"] .cxl-h')].map(h => h.textContent));
  if (!shelves.some(s => /Pseudepigrapha/i.test(s)) || !shelves.some(s => /Ethiopian/i.test(s)))
    fail("DC shelves must always be visible", shelves);
  // open 1 Enoch ch 1 — current translation (KJV) doesn't carry it; the
  // reader must SERVE it from the Ethiopian/Charles corpus and say so.
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-desk="sys:library"] .cxl-row')];
    rows.find(r => /I Enoch/i.test(r.textContent))?.click();
  });
  await sleep(300);
  await page.evaluate(() => {
    const chs = [...document.querySelectorAll('[data-desk="sys:library"] .cxl-ch')];
    chs.find(c => c.textContent.trim() === "1")?.click();
  });
  await page.waitForFunction(() => {
    const n = window.CODEX_NOW;
    return n && n.bookId === "1en" && document.querySelectorAll(".cxr-v").length > 0;
  }, { timeout: 30000 });
  const enoch = await page.evaluate(() => ({
    served: !!document.querySelector(".cxr-served"),
    servedTxt: (document.querySelector(".cxr-served") || {}).textContent || "",
    verses: document.querySelectorAll(".cxr-v").length,
  }));
  if (!enoch.verses) fail("1 Enoch must render verses", enoch);
  if (!enoch.served) fail("the SERVED FROM workflow chip must show for 1 Enoch", enoch);
  log(`apocrypha workflow: 1 Enoch 1 readable (${enoch.verses} vv), served-from chip ✓`);

  // 6 · ORACLE + MARKS — their own desk windows, their own plugins.
  await page.evaluate(() => { window.codexDesk.open("oracle"); window.codexDesk.open("marks"); });
  await page.waitForSelector('[data-desk="sys:oracle"] .cxo', { timeout: 10000 });
  await page.waitForSelector('[data-desk="sys:marks"] .cxm', { timeout: 10000 });
  const oracle = await page.evaluate(() => ({
    banner: !!document.querySelector('[data-desk="sys:oracle"] .cxo-banner'),
    invocations: document.querySelectorAll('[data-desk="sys:oracle"] .cxo-inv').length,
    bound: (document.querySelector('[data-desk="sys:oracle"] .cxo-bind-ref') || {}).textContent || "",
    ask: !!document.querySelector('[data-desk="sys:oracle"] .cxo-ask input'),
  }));
  if (!oracle.banner || oracle.invocations !== 5 || !oracle.ask) fail("oracle window incomplete", oracle);
  if (!/Enoch/i.test(oracle.bound)) fail("oracle must be BOUND to the reader's position", oracle);
  // marks: mark the current verse, see the row, forget it
  await page.evaluate(() => document.querySelector('[data-desk="sys:marks"] .cxm-add').click());
  await sleep(300);
  const marked = await page.evaluate(() => ({
    rows: document.querySelectorAll('[data-desk="sys:marks"] .cxm-row').length,
    tinted: !!document.querySelector(".cxr-v.has-mark"),
  }));
  if (marked.rows < 1) fail("marking the current verse must create a row", marked);
  if (!marked.tinted) fail("the reader must tint the marked verse live", marked);
  await page.evaluate(() => document.querySelector('[data-desk="sys:marks"] .cxm-x').click());
  await sleep(200);
  log(`oracle bound to ${oracle.bound.trim()} with 5 invocations ✓ · marks round-trip (mark→tint→forget) ✓`);

  // 7 · GALAXY — the star dossier.
  await page.evaluate(() => window.codexOpenConstellation());
  await page.waitForFunction(() => typeof window.codexConstInspect === "function" && document.querySelector(".cx-const-canvas"), { timeout: 60000 });
  await sleep(500);
  await page.evaluate(() => window.codexConstInspect(0)); // Genesis 1
  await page.waitForSelector(".cx-const-info", { timeout: 10000 });
  const dossier = await page.evaluate(() => ({
    title: (document.querySelector(".cx-const-info header b") || {}).textContent || "",
    verbs: [...document.querySelectorAll(".cx-const-info-verbs button")].map(b => b.textContent),
    rows: document.querySelectorAll(".cx-const-info-rows li").length,
  }));
  if (!/GENESIS 1/i.test(dossier.title)) fail("dossier title wrong", dossier);
  if (dossier.verbs.length !== 3 || !dossier.rows) fail("dossier verbs/threads missing", dossier);
  // READ — through the workflow, back to the reader
  await page.evaluate(() => { [...document.querySelectorAll(".cx-const-info-verbs button")][0].click(); });
  await page.waitForFunction(() => (window.CODEX_NOW || {}).bookId === "gen", { timeout: 30000 });
  await page.keyboard.press("Escape"); // close galaxy
  await sleep(300);
  log(`galaxy: star dossier (${dossier.title.trim()}, ${dossier.rows} threads) + READ verb jumps the reader ✓`);

  // 8 · OPEN ANYTHING — a Talmud daf opens as a live text window.
  await page.evaluate(() => window.codexOpenText("talmud.Berakhot.2a"));
  await page.waitForSelector(".cxt-win", { timeout: 10000 });
  const daf = await page.evaluate(() => new Promise(res => {
    const t0 = Date.now();
    const probe = () => {
      const segs = document.querySelectorAll(".cxt-seg").length;
      const err = !!document.querySelector(".cxt-status.is-err");
      if (segs || err || Date.now() - t0 > 25000) res({ segs, err });
      else setTimeout(probe, 500);
    };
    probe();
  }));
  if (!daf.segs && !daf.err) fail("talmud window neither loaded nor reported", daf);
  log(daf.segs ? `talmud: Berakhot 2a live from Sefaria (${daf.segs} segments) ✓` : "talmud: window opened, Sefaria unreachable (honest error state) ✓");

  // 9 · MULTI-DISPLAY — satellite surface + shared cursor.
  const sat = await ctx.newPage();
  sat.on("pageerror", (e) => jsErrors.push("satellite pageerror: " + e.message));
  await sat.setViewport({ width: 1400, height: 900 }); // desk mode needs ≥881px
  await sat.goto(URL + "?surface=oracle&follow=1", { waitUntil: "load", timeout: 60000 });
  await sat.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 60000 });
  // the whole browser is under load here (auto-cache, galaxy layout) —
  // give the surface boot interval room to land.
  await sat.waitForSelector('[data-desk="sys:oracle"] .cxo', { timeout: 45000 });
  await sleep(800);
  const satState = await sat.evaluate(() => ({
    surface: window.codexDisplays.surface(),
    follower: window.codexDisplays.isFollower(),
    study: !!document.querySelector('[data-desk="sys:study"]'),
    library: !!document.querySelector('[data-desk="sys:library"]'),
  }));
  if (satState.surface !== "oracle" || !satState.follower) fail("satellite boot wrong", satState);
  if (satState.study || satState.library) fail("satellite must show ONLY its surface", satState);
  // cursor sync: main navigates → satellite follows over the BroadcastChannel
  await page.bringToFront();
  await page.evaluate(() => window.codexJumpToRef("Romans 8:1"));
  await sat.waitForFunction(() => (window.CODEX_NOW || {}).ref === "Romans 8:1", { timeout: 15000 });
  const satBound = await sat.evaluate(() =>
    (document.querySelector('[data-desk="sys:oracle"] .cxo-bind-ref') || {}).textContent || "");
  if (!/Romans 8:1/.test(satBound)) fail("satellite oracle must rebind to the shared cursor", { satBound });
  await sat.close();
  log("multi-display: ?surface=oracle satellite boots solo, follows the shared cursor (Romans 8:1) ✓");

  if (jsErrors.length) fail("JS errors", jsErrors);
  log("PASS");
} finally {
  await browser.close();
}
