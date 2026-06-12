// smoke-windows.mjs — v11 EVERY PANEL ITS OWN WINDOW. The v7.5 study deck
// is dead: no .cx-deck-card, no sys:study window. Builtin panels open as
// independent WM windows (win:builtin:<id>) via window.codexOpenPanel; the
// TRANS window hosts the rebuilt translations instrument (language lanes of
// cards — one tap = primary, ⊕ = compare, permanent offline dots); gnosis +
// disarm keep their v9.3 instrument DOM inside their own windows; dragged
// geometry persists per window across reload. Zero pageerrors.
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const log = (...a) => console.log("[windows]", ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"] });
try {
  // Incognito context = clean profile = honest FIRST OPEN.
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push("pageerror: " + e.message));
  await page.setViewport({ width: 1680, height: 1050 });
  const boot = async () => {
    await page.goto(URL, { waitUntil: "load", timeout: 30000 });
    await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
    await page.waitForFunction(() => document.querySelectorAll(".cx-verse,.cx-verse-row").length > 0, { timeout: 20000 });
    await sleep(800);
  };
  await boot();
  const fail = (m, x) => { throw new Error(m + (x !== undefined ? " · " + JSON.stringify(x) : "")); };

  // a · THE DECK IS DEAD — no deck cards, no study window, ever.
  const dead = await page.evaluate(() => ({
    deckCards: document.querySelectorAll(".cx-deck-card").length,
    study: !!document.querySelector('[data-desk="sys:study"]'),
    deskHasStudy: !!(window.codexDesk && window.codexDesk.state().study),
    panelsApi: !!(window.codexDeskPanels && window.codexDeskPanels.on()),
  }));
  if (dead.deckCards) fail("deck cards still render", dead);
  if (dead.study || dead.deskHasStudy) fail("sys:study still exists", dead);
  if (!dead.panelsApi) fail("codexDeskPanels API missing in desk mode", dead);
  log("deck dead: no .cx-deck-card, no sys:study, panel-window API live ✓");

  // b · codexOpenPanel("trans") → win:builtin:trans with the NEW instrument.
  await page.evaluate(() => window.codexOpenPanel("trans"));
  await page.waitForSelector('[data-wm-id="win:builtin:trans"] .cx-tx-lane .cx-tx-card', { timeout: 15000 });
  const trans = await page.evaluate(() => {
    const bd = document.querySelector('[data-wm-id="win:builtin:trans"]');
    return {
      wm: !!bd.querySelector(".cx-win.cx-wm-win"),
      title: (bd.querySelector(".cx-win-h-title") || {}).textContent || "",
      ctx: (bd.querySelector(".cx-win-h-ctx") || {}).textContent || "",
      lanes: bd.querySelectorAll(".cx-tx-lane").length,
      cards: bd.querySelectorAll(".cx-tx-card").length,
      current: !!bd.querySelector(".cx-tx-current .cx-tx-verse"),
      identity: !!bd.querySelector(".cx-tx-identity .cx-tx-id-glyph"),
      dots: bd.querySelectorAll(".cx-tx-dot").length,
      primaryCard: !!bd.querySelector(".cx-tx-card.is-primary"),
      oldRows: bd.querySelectorAll(".cx-tp-row").length, // old panel must be gone
    };
  });
  if (!trans.wm) fail("trans window not WM-enhanced", trans);
  if (!/TRANSLATIONS/.test(trans.title)) fail("trans window title wrong", trans);
  if (!trans.ctx) fail("trans window must carry the current-ref ctx", trans);
  if (trans.lanes < 2 || trans.cards < 5) fail("language lanes / cards missing", trans);
  if (!trans.current || !trans.identity) fail("THE CURRENT WORD block missing", trans);
  if (trans.dots !== trans.cards) fail("every card must carry its offline dot", trans);
  if (!trans.primaryCard) fail("active card must be marked is-primary", trans);
  if (trans.oldRows) fail("old translations rows leaked into the new instrument", trans);
  log(`trans window: ${trans.lanes} lanes · ${trans.cards} cards · current-word block · ${trans.dots} offline dots ✓`);

  // c · One tap on another card = it becomes primary (reader follows).
  const before = await page.evaluate(() => (window.CODEX_NOW || {}).translation);
  const target = await page.evaluate(() => {
    const bd = document.querySelector('[data-wm-id="win:builtin:trans"]');
    const card = [...bd.querySelectorAll(".cx-tx-card:not(.is-primary):not(.is-ghost)")]
      .find(c => c.querySelector(".cx-tx-card-pick:not([disabled])"));
    if (!card) return null;
    const id = card.getAttribute("data-tx-id");
    card.querySelector(".cx-tx-card-pick").click();
    return id;
  });
  if (!target) fail("no clickable non-primary card found");
  await page.waitForFunction(
    (id) => (window.CODEX_NOW || {}).translation === id,
    { timeout: 15000 }, target
  );
  const flipped = await page.evaluate(() => ({
    now: (window.CODEX_NOW || {}).translation,
    activeCard: (document.querySelector('[data-wm-id="win:builtin:trans"] .cx-tx-card.is-primary') || {}).getAttribute?.("data-tx-id"),
  }));
  if (flipped.activeCard !== target) fail("active card did not follow the tap", { before, target, ...flipped });
  log(`one tap switched primary: ${before} → ${target} (CODEX_NOW + solid card track) ✓`);

  // d · GNOSIS + DISARM open as their own windows, v9.3 DOM intact.
  await page.evaluate(() => { window.codexOpenPanel("gnosis"); window.codexOpenPanel("disarm"); });
  await page.waitForSelector('[data-wm-id="win:builtin:gnosis"] .cx-gnosis-band', { timeout: 15000 });
  await page.waitForSelector('[data-wm-id="win:builtin:disarm"] .cx-disarm-pair', { timeout: 15000 });
  const inst = await page.evaluate(() => {
    const g = document.querySelector('[data-wm-id="win:builtin:gnosis"]');
    const d = document.querySelector('[data-wm-id="win:builtin:disarm"]');
    return {
      gWm: !!g.querySelector(".cx-win.cx-wm-win"),
      bands: g.querySelectorAll(".cx-gnosis-band").length,
      gProse: g.querySelectorAll(".cx-gnosis-band-body").length,
      dWm: !!d.querySelector(".cx-win.cx-wm-win"),
      pairs: d.querySelectorAll(".cx-disarm-pair").length,
      banner: !!d.querySelector(".cx-disarm-banner"),
      openWins: document.querySelectorAll('[data-wm-id^="win:builtin:"]').length,
    };
  });
  if (!inst.gWm || inst.bands < 1) fail("gnosis window / resonance bands wrong", inst);
  if (inst.gProse !== 0) fail("gnosis prose visible before summoning", inst);
  if (!inst.dWm || inst.pairs < 1 || !inst.banner) fail("disarm window / opposition pairs wrong", inst);
  if (inst.openWins !== 3) fail("expected exactly 3 builtin windows open", inst);
  log(`gnosis (${inst.bands} bands) + disarm (${inst.pairs} pairs) float as their own windows, v9.3 DOM intact ✓`);

  // e · Drag two panel windows → per-window geometry persists across reload.
  const dragWin = async (sel, dx, dy) => {
    const head = await page.$(`${sel} .cx-win-h`);
    const hb = await head.boundingBox();
    await page.mouse.move(hb.x + 60, hb.y + 10);
    await page.mouse.down();
    await page.mouse.move(hb.x + 60 + dx, hb.y + 10 + dy, { steps: 8 });
    await page.mouse.up();
    await sleep(300);
    return page.evaluate((s) => {
      const r = document.querySelector(`${s} .cx-win`).getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y) };
    }, sel);
  };
  const gPos = await dragWin('[data-wm-id="win:builtin:gnosis"]', -420, 120);
  const dPos = await dragWin('[data-wm-id="win:builtin:disarm"]', -680, 260);
  await boot();
  const persisted = await page.evaluate(() => {
    const probe = (sel) => {
      const el = document.querySelector(`${sel} .cx-win`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y) };
    };
    return {
      open: document.querySelectorAll('[data-wm-id^="win:builtin:"]').length,
      g: probe('[data-wm-id="win:builtin:gnosis"]'),
      d: probe('[data-wm-id="win:builtin:disarm"]'),
    };
  });
  const near = (a, b) => a && b && Math.abs(a.x - b.x) < 12 && Math.abs(a.y - b.y) < 12;
  if (persisted.open !== 3) fail("open panel-window set should survive reload", persisted);
  if (!near(persisted.g, gPos) || !near(persisted.d, dPos))
    fail("dragged geometry should persist per window", { gPos, dPos, ...persisted });
  log("two dragged windows held their geometry across reload ✓", { gPos, dPos });

  // f · zero pageerrors throughout.
  if (jsErrors.length) fail("JS errors", jsErrors);
  log("PASS");
} finally {
  await browser.close();
}
