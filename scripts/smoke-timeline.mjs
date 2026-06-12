// smoke-timeline.mjs — Biblical Timeline v2 (THE RIVER) interaction smoke.
// Boot pattern from smoke-monad.mjs: open the plugin window via
// codexOpenWindow({ id: "plugin:biblical-timeline:timeline" }), then drive
// the river itself:
//   · wheel-zoom (centered on cursor) shrinks the visible span
//   · drag pans the center (inertia is allowed to settle)
//   · event click → view centers on it + in-river detail card with ✦ READ
//     ref chips (never a modal)
//   · ref chip click → reader routes → CODEX_NOW changes
//   · minimap strip present · zero pageerrors
// View telemetry: timeline publishes window.__CODEX_TL_VIEW {center, span}.
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const log = (...a) => console.log("[timeline]", ...a);
const PW = '[data-wm-id^="win:plugin:"]'; // plugin-window scope (monad pattern)

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type()==="error" && !/Failed to load resource|CORS policy/i.test(m.text())) jsErrors.push(m.text()); });
  await page.setViewport({ width: 1680, height: 1050 });

  await page.goto(URL, { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
  await page.waitForFunction(() => document.querySelectorAll(".cx-verse,.cx-verse-row").length > 0, { timeout: 20000 });
  await new Promise(r => setTimeout(r, 900)); // plugins register
  log("booted");

  const opened = await page.evaluate(() =>
    window.codexOpenWindow && window.codexOpenWindow({ id: "plugin:biblical-timeline:timeline", title: "TIMELINE", glyph: "⏳" }));
  await page.waitForFunction((PW) => !!document.querySelector(`${PW} .cx-tl2-river`), { timeout: 15000 }, PW).catch(() => {});
  await page.waitForFunction(() => !!window.__CODEX_TL_VIEW, { timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 600));
  const boot = await page.evaluate((PW) => ({
    river: !!document.querySelector(`${PW} .cx-tl2-river`),
    view: window.__CODEX_TL_VIEW || null,
    events: document.querySelectorAll(`${PW} .cx-tl2-ev`).length,
    clusters: document.querySelectorAll(`${PW} .cx-tl2-cluster`).length,
    strata: document.querySelectorAll(`${PW} .cx-tl2-strata`).length,
    mini: !!document.querySelector(`${PW} .cx-tl2-mini`),
    now: !!document.querySelector(`${PW} .cx-tl2-now-tag`),
    honest: !!document.querySelector(`${PW} .cx-tl2-river`) && /scholarly|conventional|approximate|contested/i.test(document.querySelector(`${PW} .cx-tl2-root`).textContent || ""),
    zoomButtons: [].slice.call(document.querySelectorAll(`${PW} button`)).filter(b => /^(1y|50y|500y)$/i.test((b.textContent||"").trim())).length,
  }), PW);
  log("boot:", JSON.stringify({ opened: !!opened, ...boot }));

  // ── EVENT CLICK → centers + in-river detail card with ref chips ───────
  // Click first (at full span) so the card's chips are exercised before the
  // view is zoomed/panned. Clusters fold dense runs; pick a single node.
  const target = await page.evaluate((PW) => {
    const evs = [].slice.call(document.querySelectorAll(`${PW} .cx-tl2-ev`));
    if (!evs.length) return null;
    const el = evs[Math.floor(evs.length / 2)];
    const m = (el.getAttribute("aria-label") || "").match(/c\.\s*(AD\s*)?(\d+)(\s*BC)?/i);
    el.click();
    return { label: el.getAttribute("aria-label"), year: m ? (m[3] ? -parseInt(m[2],10) : parseInt(m[2],10)) : null };
  }, PW);
  await new Promise(r => setTimeout(r, 900)); // animateTo ~520ms
  const card = await page.evaluate((PW) => ({
    card: !!document.querySelector(`${PW} .cx-tl2-card`),
    title: (document.querySelector(`${PW} .cx-tl2-card-title`)||{}).textContent || "",
    chips: document.querySelectorAll(`${PW} .cx-tl2-refchip`).length,
    honest: !!document.querySelector(`${PW} .cx-tl2-card-honest`),
    center: window.__CODEX_TL_VIEW ? window.__CODEX_TL_VIEW.center : null,
    span: window.__CODEX_TL_VIEW ? window.__CODEX_TL_VIEW.span : null,
  }), PW);
  const centered = target && target.year != null && card.center != null
    ? Math.abs(card.center - target.year) < Math.max(8, card.span * 0.05)
    : !!card.card; // year unparsable → card presence carries the assertion
  log("event click:", JSON.stringify({ target, ...card, centered }));

  // ── ✦ READ ref chip → CODEX_NOW changes ───────────────────────────────
  const refBefore = await page.evaluate(() => (window.CODEX_NOW || {}).ref || "");
  const chipPicked = await page.evaluate((PW) => {
    const now = window.CODEX_NOW || {};
    const chips = [].slice.call(document.querySelectorAll(`${PW} .cx-tl2-refchip`));
    if (!chips.length) return null;
    // pick a chip that lands somewhere OTHER than the current cursor so the
    // CODEX_NOW change is observable
    const pick = chips.find(c => {
      const o = (c.getAttribute("data-osis") || "").split("-")[0].split(".");
      return !(String(now.bookId||"").toLowerCase().startsWith(o[0]) && String(now.chapter) === o[1] && String(now.verse) === (o[2]||"1"));
    }) || chips[0];
    const osis = pick.getAttribute("data-osis");
    pick.click();
    return osis;
  }, PW);
  const refChanged = await page.waitForFunction(
    (before) => window.CODEX_NOW && window.CODEX_NOW.ref && window.CODEX_NOW.ref !== before,
    { timeout: 25000 }, refBefore
  ).then(() => true).catch(() => false);
  const refAfter = await page.evaluate(() => (window.CODEX_NOW || {}).ref || "");
  log("ref chip:", JSON.stringify({ chipPicked, refBefore, refAfter, refChanged }));

  // ── WHEEL ZOOM — continuous, centered on cursor ────────────────────────
  const river = await page.$(`${PW} .cx-tl2-river`);
  const rb = await river.boundingBox();
  const spanBefore = await page.evaluate(() => window.__CODEX_TL_VIEW.span);
  await page.mouse.move(rb.x + rb.width * 0.5, rb.y + rb.height * 0.35);
  for (let i = 0; i < 4; i++) { await page.mouse.wheel({ deltaY: -420 }); await new Promise(r => setTimeout(r, 90)); }
  await new Promise(r => setTimeout(r, 350));
  const spanAfter = await page.evaluate(() => window.__CODEX_TL_VIEW.span);
  const zoomed = spanAfter < spanBefore * 0.75;
  log("wheel zoom:", JSON.stringify({ spanBefore: Math.round(spanBefore), spanAfter: Math.round(spanAfter), zoomed }));

  // ── DRAG PAN (+ inertia settles) ──────────────────────────────────────
  // Close the detail card first — it (correctly) swallows pointerdown.
  await page.evaluate((PW) => { const x = document.querySelector(`${PW} .cx-tl2-card-x`); if (x) x.click(); }, PW);
  await new Promise(r => setTimeout(r, 200));
  const centerBefore = await page.evaluate(() => window.__CODEX_TL_VIEW.center);
  await page.mouse.move(rb.x + rb.width * 0.7, rb.y + rb.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(rb.x + rb.width * 0.3, rb.y + rb.height * 0.3, { steps: 12 });
  await page.mouse.up();
  await new Promise(r => setTimeout(r, 900)); // let inertia decay
  const centerAfter = await page.evaluate(() => window.__CODEX_TL_VIEW.center);
  const spanNow = await page.evaluate(() => window.__CODEX_TL_VIEW.span);
  const panned = Math.abs(centerAfter - centerBefore) > spanNow * 0.1;
  log("drag pan:", JSON.stringify({ centerBefore: Math.round(centerBefore), centerAfter: Math.round(centerAfter), panned }));

  // ── MINIMAP — present and reflects the window ─────────────────────────
  const mini = await page.evaluate((PW) => ({
    mini: !!document.querySelector(`${PW} .cx-tl2-mini`),
    win: !!document.querySelector(`${PW} .cx-tl2-mini-win`),
    dots: document.querySelectorAll(`${PW} .cx-tl2-mini-dot`).length,
  }), PW);
  log("minimap:", JSON.stringify(mini));

  log("jsErrors:", JSON.stringify(jsErrors.slice(0, 5)));
  const ok = !!opened && boot.river && boot.strata > 0 && boot.honest
    && boot.zoomButtons === 0           // discrete 1y/50y/500y buttons are dead
    && card.card && card.chips > 0 && card.honest && centered
    && refChanged
    && zoomed && panned
    && mini.mini && mini.win && mini.dots > 0
    && jsErrors.length === 0;
  log(ok ? "PASS" : "FAIL");
  process.exitCode = ok ? 0 : 1;
} finally {
  await browser.close();
}
