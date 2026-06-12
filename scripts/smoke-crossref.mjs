// smoke-crossref.mjs — THE THREAD WEB contract.
// Opens the TSK cross-references panel as a floating MONAD window
// (codexOpenWindow, the smoke-monad pattern) and proves the ego-graph:
//   · canvas.cx-xrefg-canvas present, node count > 3 for John 1:1
//   · window.codexXrefCenter(ref) re-centers programmatically and the
//     breadcrumb trail (.cx-xrefg-crumb) GROWS
//   · a real canvas click on an orbit node re-centers too (one gesture deep)
//   · double-click ground truth (optional): reader navigates to the node
//   · accessibility mirror: .cx-xrefg-alist real buttons present
//   · zero pageerrors
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const log = (...a) => console.log("[xref]", ...a);
const PW = '[data-wm-id="win:plugin:crossrefs-tsk:crossrefs"]';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type()==="error" && !/Failed to load resource/i.test(m.text())) jsErrors.push(m.text()); });
  await page.setViewport({ width: 1680, height: 1050 });

  await page.goto(URL, { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
  await page.waitForFunction(() => document.querySelectorAll(".cx-verse,.cx-verse-row").length > 0, { timeout: 20000 });
  await new Promise(r => setTimeout(r, 900)); // plugins register
  log("booted; verses present");

  // ── 1. open the panel as a floating window ────────────────────────────
  const opened = await page.evaluate(() =>
    window.codexOpenWindow && window.codexOpenWindow({ id: "plugin:crossrefs-tsk:crossrefs", title: "CROSS-REFS", glyph: "✝" }));
  log("codexOpenWindow:", opened);
  if (!opened) { console.error("[xref] FAIL — codexOpenWindow refused"); process.exit(1); }

  // TSK is a 5 MB module — first parse can take a while. Poll for the real
  // instrument: the canvas AND the a11y mirror buttons.
  await page.waitForFunction((PW) => {
    const sc = document.querySelector(PW);
    return !!(sc && sc.querySelector("canvas.cx-xrefg-canvas") &&
      sc.querySelectorAll(".cx-xrefg-alist button").length > 3 &&
      typeof window.codexXrefState === "function");
  }, { timeout: 60000 }, PW);
  await new Promise(r => setTimeout(r, 600)); // settle layout tween

  const st0 = await page.evaluate((PW) => {
    const sc = document.querySelector(PW);
    const cv = sc.querySelector("canvas.cx-xrefg-canvas");
    const r = cv.getBoundingClientRect();
    const s = window.codexXrefState();
    return {
      canvas: !!cv, cw: Math.round(r.width), ch: Math.round(r.height),
      center: s.center, count: s.count, chain: s.chain.length,
      crumbs: sc.querySelectorAll(".cx-xrefg-crumb").length,
      alistBtns: sc.querySelectorAll(".cx-xrefg-alist button").length,
      alistRole: (sc.querySelector(".cx-xrefg-alist") || {}).getAttribute?.("role") || "",
      counts: (sc.querySelector(".cx-xrefg-counts") || {}).textContent || "",
    };
  }, PW);
  log("initial:", JSON.stringify(st0));
  const canvasOk = st0.canvas && st0.cw > 50 && st0.ch > 50;
  const nodesOk = st0.count > 3; // John 1:1 → 41 in TSK
  const a11yOk = st0.alistBtns > 3 && st0.alistRole === "list";
  log("canvas ok:", canvasOk, "· nodes>3:", nodesOk, "· a11y list buttons:", a11yOk);

  // ── 2. programmatic re-center via the automation hook ─────────────────
  const hookKey = await page.evaluate(() => window.codexXrefCenter("gen.1.1"));
  await new Promise(r => setTimeout(r, 800)); // 300ms tween + render
  const st1 = await page.evaluate((PW) => {
    const sc = document.querySelector(PW);
    const s = window.codexXrefState();
    return { center: s.center, count: s.count, chain: s.chain.length,
      crumbs: sc.querySelectorAll(".cx-xrefg-crumb").length };
  }, PW);
  log("after codexXrefCenter('gen.1.1'):", JSON.stringify({ hookKey, ...st1 }));
  const recenterOk = hookKey === "gen.1.1" && st1.center === "gen.1.1" && st1.crumbs > st0.crumbs;
  log("programmatic recenter + breadcrumb grew:", recenterOk);

  // ── 3. real canvas click on an orbit node re-centers (one gesture) ────
  const target = await page.evaluate((PW) => {
    const sc = document.querySelector(PW);
    const cv = sc.querySelector("canvas.cx-xrefg-canvas");
    const r = cv.getBoundingClientRect();
    const s = window.codexXrefState();
    const nd = s.nodes.find(n => Number.isFinite(n.x) && Number.isFinite(n.y));
    return nd ? { key: nd.key, px: r.left + nd.x, py: r.top + nd.y } : null;
  }, PW);
  let clickOk = false;
  if (target) {
    await page.mouse.click(target.px, target.py);
    await new Promise(r => setTimeout(r, 900)); // 240ms dbl-click window + tween
    const st2 = await page.evaluate((PW) => {
      const sc = document.querySelector(PW);
      const s = window.codexXrefState();
      return { center: s.center, crumbs: sc.querySelectorAll(".cx-xrefg-crumb").length };
    }, PW);
    clickOk = st2.center === target.key && st2.crumbs > st1.crumbs;
    log("canvas click on", target.key, "→", JSON.stringify(st2), "· recentered:", clickOk);
  } else {
    log("canvas click: no node coords exposed ✗");
  }

  // ── 4. crumb click re-centers BACK along the trail ────────────────────
  const backOk = await page.evaluate((PW) => {
    const sc = document.querySelector(PW);
    const crumbs = [...sc.querySelectorAll(".cx-xrefg-crumb")];
    if (crumbs.length < 2) return false;
    crumbs[0].click(); // the host crumb — re-center to the start
    return true;
  }, PW);
  await new Promise(r => setTimeout(r, 600));
  const st3 = await page.evaluate((PW) => {
    const sc = document.querySelector(PW);
    const s = window.codexXrefState();
    return { center: s.center, chain: s.chain.length, crumbs: sc.querySelectorAll(".cx-xrefg-crumb").length };
  }, PW);
  const trailOk = backOk && st3.chain === 0 && st3.crumbs === 1;
  log("crumb-back to host:", JSON.stringify(st3), "· trail ok:", trailOk);

  // ── 5. double-click ground truth (OPTIONAL — logged, not gating) ──────
  let dblNavigated = false;
  try {
    const titleBefore = await page.evaluate(() => (document.querySelector(".cxr-loc b, .cx-reader-titles h1")||{}).textContent || "");
    const t2 = await page.evaluate((PW) => {
      const sc = document.querySelector(PW);
      const cv = sc.querySelector("canvas.cx-xrefg-canvas");
      const r = cv.getBoundingClientRect();
      const s = window.codexXrefState();
      const nd = s.nodes.find(n => Number.isFinite(n.x) && Number.isFinite(n.y) && n.key.split(".")[0] !== s.center.split(".")[0]);
      return nd ? { key: nd.key, px: r.left + nd.x, py: r.top + nd.y } : null;
    }, PW);
    if (t2) {
      // headless Chrome never synthesizes dblclick — the panel detects two
      // clicks on the same node within 350ms itself, so click twice.
      await page.mouse.click(t2.px, t2.py);
      await new Promise(r => setTimeout(r, 120));
      await page.mouse.click(t2.px, t2.py);
      await new Promise(r => setTimeout(r, 2500));
      const titleAfter = await page.evaluate(() => (document.querySelector(".cxr-loc b, .cx-reader-titles h1")||{}).textContent || "");
      dblNavigated = !!titleAfter && titleAfter !== titleBefore;
      log("dblclick", t2.key, "· reader title:", JSON.stringify(titleBefore), "→", JSON.stringify(titleAfter), "· navigated:", dblNavigated, "(optional)");
    } else log("dblclick: no cross-book node found (optional, skipped)");
  } catch (e) { log("dblclick optional check errored:", e.message); }

  // ── 6. ¶ text zoom-in summons prose under the canvas ──────────────────
  await page.evaluate((PW) => {
    const sc = document.querySelector(PW);
    const b = [...sc.querySelectorAll(".cx-xrefg-chip")].find(x => /¶/.test(x.textContent || ""));
    if (b) b.click();
  }, PW);
  await new Promise(r => setTimeout(r, 1500));
  const textState = await page.evaluate((PW) => {
    const sc = document.querySelector(PW);
    const el = sc.querySelector(".cx-xrefg-text");
    return { present: !!el, sample: el ? (el.textContent || "").slice(0, 80) : "" };
  }, PW);
  log("¶ text unfold:", JSON.stringify(textState), "(informational)");

  log("js errors:", JSON.stringify(jsErrors.slice(0, 5)));
  const ok = canvasOk && nodesOk && a11yOk && recenterOk && clickOk && trailOk && jsErrors.length === 0;
  log(ok ? "PASS — the thread web breathes." : "FAIL — see above.");
  process.exitCode = ok ? 0 : 1;
} finally {
  await browser.close();
}
