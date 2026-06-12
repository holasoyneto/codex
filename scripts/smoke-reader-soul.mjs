// smoke-reader-soul.mjs — v11.3 THE SOUL of the reader:
//   1 · AI page titles render as the chapter's serif heading (seed: John 1
//       → "The Prologue · ΛΟΓΟΣ"), with the book+chapter fallback.
//   2 · In-reader overlays: ⟁ gnosis glosses appear inline beside their
//       verses, tap unfolds, engagement persists as tweak keys.
//   3 · The golden Name: KJV "God"/"LORD" in covenant-gold .cxr-name spans;
//       divineHebrew renders the Tetragrammaton as יהוה; Psalm 82's "gods"
//       is NEVER gilded (conservative by law).
//   4 · The verse menu remade minimal: ⚔⌬◎ verbs · ✦ mark · ⊕ compare ·
//       '⌘ more…' → omnibar pre-seeded with the ref; Esc closes.
//   5 · Secondary readers: ⧉ window.codexNewReader() spawns a pinned reader
//       with an INDEPENDENT cursor; ?surface=reader&ref=… boots a satellite
//       tab on the requested page.
// Zero pageerrors throughout. Boot pattern per smoke-desk.mjs.
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const log = (...a) => console.log("[soul]", ...a);
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
  await page.waitForFunction(() => document.querySelectorAll(".cxr-v").length > 0, { timeout: 20000 });
  await sleep(600);

  const fail = (m, x) => { throw new Error(m + (x !== undefined ? " · " + JSON.stringify(x) : "")); };
  const goto = async (bookId, ch) => {
    await page.evaluate((b, c) => window.codexGoto(b, c, 1), bookId, ch);
    await page.waitForFunction((b) => {
      const n = window.CODEX_NOW;
      return n && n.bookId === b && document.querySelectorAll('[data-desk="sys:reader"] .cxr-v').length > 0;
    }, { timeout: 20000 }, bookId);
    await sleep(400);
  };

  // ── 1 · AI PAGE TITLE — John 1 renders the seed title as a serif h1. ──
  await goto("jhn", 1);
  const title = await page.evaluate(() => ({
    main: (document.querySelector('[data-desk="sys:reader"] .cxr-title-main') || {}).textContent || "",
    sub: (document.querySelector('[data-desk="sys:reader"] .cxr-title-sub') || {}).textContent || "",
  }));
  if (!/Prologue/.test(title.main)) fail("John 1 heading should carry the seed title", title);
  log(`AI page title ✓ "${title.main}" · "${title.sub.trim()}"`);
  // fallback: a chapter with no seed/cache shows book+chapter, never blank
  await goto("jhn", 2);
  const fb = await page.evaluate(() => (document.querySelector('[data-desk="sys:reader"] .cxr-title-main') || {}).textContent || "");
  if (!/John\s*2|·/.test(fb) || !fb.trim()) fail("un-companioned chapter should fall back to book+chapter", fb);
  log(`title fallback ✓ "${fb}"`);
  await goto("jhn", 1);

  // ── 2 · GNOSIS OVERLAY — ⟁ glosses inline, tap unfolds, tweak persists. ──
  await page.click('[data-desk="sys:reader"] .cxr-chip-ov[data-ov="gnosis"]');
  await page.waitForFunction(() => document.querySelectorAll('[data-desk="sys:reader"] .cxr-gloss.is-gnosis').length > 0, { timeout: 8000 });
  const gnosis = await page.evaluate(() => {
    const all = [...document.querySelectorAll('[data-desk="sys:reader"] .cxr-gloss.is-gnosis')];
    const anchored = all.filter(g => !g.closest(".cxr-glosses-ch"));
    let tw = {};
    try { tw = JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}"); } catch {}
    return { total: all.length, anchored: anchored.length, tweak: tw.overlayGnosis === true };
  });
  if (gnosis.total !== 5) fail("John 1 seed carries 5 gnosis glosses", gnosis);
  if (gnosis.anchored < 3) fail("most John 1 glosses should anchor inline to their verses", gnosis);
  if (!gnosis.tweak) fail("engaging gnosis should persist tweak overlayGnosis", gnosis);
  log(`gnosis overlay ✓ ${gnosis.total} glosses (${gnosis.anchored} verse-anchored), tweak persisted`);
  // tap unfolds
  await page.click('[data-desk="sys:reader"] .cxr-gloss.is-gnosis');
  await sleep(200);
  const unfolded = await page.evaluate(() => {
    const g = document.querySelector('[data-desk="sys:reader"] .cxr-gloss.is-gnosis.is-open .cxr-gloss-body');
    return g ? g.textContent.trim().length : 0;
  });
  if (unfolded < 40) fail("tapping a gloss should unfold its full body", unfolded);
  log(`gloss tap unfolds ✓ (${unfolded} chars)`);
  // a second overlay can ride at the same time
  await page.click('[data-desk="sys:reader"] .cxr-chip-ov[data-ov="talmud"]');
  await page.waitForFunction(() => document.querySelectorAll('[data-desk="sys:reader"] .cxr-gloss.is-talmud').length > 0, { timeout: 8000 });
  const both = await page.evaluate(() => ({
    g: document.querySelectorAll('[data-desk="sys:reader"] .cxr-gloss.is-gnosis').length,
    t: document.querySelectorAll('[data-desk="sys:reader"] .cxr-gloss.is-talmud').length,
  }));
  if (!both.g || !both.t) fail("two overlays should coexist", both);
  log(`overlays stack ✓ gnosis ${both.g} + talmud ${both.t}`);
  await page.click('[data-desk="sys:reader"] .cxr-chip-ov[data-ov="talmud"]'); // rest it again
  await sleep(200);

  // ── 3 · THE GOLDEN NAME ──────────────────────────────────────────────
  await page.evaluate(() => window.codexSetPrimary("kjv"));
  await page.waitForFunction(() => {
    const v = document.querySelector('[data-desk="sys:reader"] .cxr-v[data-vn="1"] .cxr-text');
    return v && /the Word was with God/.test(v.textContent);
  }, { timeout: 20000 });
  const gold = await page.evaluate(() => {
    const names = [...document.querySelectorAll('[data-desk="sys:reader"] .cxr-v .cxr-name')].map(n => n.textContent);
    return { count: names.length, god: names.includes("God") };
  });
  if (!gold.god) fail("KJV John 1 should render 'God' in a gold .cxr-name span", gold);
  log(`golden Name ✓ ${gold.count} gilded tokens in John 1, 'God' among them`);

  // always-render-the-Name-in-Hebrew → Psalm 23 LORD → יהוה
  await page.evaluate(() => {
    const k = "codex.tweaks.v1";
    let t = {}; try { t = JSON.parse(localStorage.getItem(k) || "{}"); } catch {}
    t.divineHebrew = true;
    localStorage.setItem(k, JSON.stringify(t));
    window.dispatchEvent(new CustomEvent("tweakchange", { detail: { divineHebrew: true } }));
  });
  await goto("psa", 23);
  const yhwh = await page.evaluate(() => {
    const spans = [...document.querySelectorAll('[data-desk="sys:reader"] .cxr-name-yhwh')];
    return { count: spans.length, text: spans[0] ? spans[0].textContent : "", rtl: spans[0] ? spans[0].getAttribute("dir") : "" };
  });
  if (!yhwh.count || yhwh.text !== "יהוה" || yhwh.rtl !== "rtl") fail("Psalm 23 with divineHebrew should render יהוה (RTL-isolated)", yhwh);
  log(`always-Hebrew ✓ ${yhwh.count}× יהוה in Psalm 23`);

  // Psalm 82 — "gods" must NEVER gild (the conservative clause)
  await goto("psa", 82);
  const ps82 = await page.evaluate(() => {
    const txt = [...document.querySelectorAll('[data-desk="sys:reader"] .cxr-v .cxr-text')].map(n => n.textContent).join(" ");
    const gilded = [...document.querySelectorAll('[data-desk="sys:reader"] .cxr-name, [data-desk="sys:reader"] .cxr-name-yhwh')].map(n => n.textContent);
    return { hasGods: /\bgods\b/.test(txt), godsGilded: gilded.some(t => /^gods$/i.test(t.trim())) };
  });
  if (!ps82.hasGods) fail("Psalm 82 should contain 'gods'", ps82);
  if (ps82.godsGilded) fail("'gods' must never render gold", ps82);
  log("Psalm 82 ✓ 'gods' present, never gilded");
  // the old engine is gone
  const oldGone = await page.evaluate(() => ({
    divine: !!window.CODEX_DIVINE,
    oldSpans: document.querySelectorAll(".cxr-verses .cx-divine").length,
  }));
  if (!oldGone.divine || oldGone.oldSpans) fail("CODEX_DIVINE engine should exist; cx-divine gone from scripture", oldGone);
  log("old yhwhMode/cx-divine path gone from the reader ✓");

  // ── 4 · VERSE MENU — minimal by law. ─────────────────────────────────
  await page.click('[data-desk="sys:reader"] .cxr-v[data-vn="6"] .cxr-vn');
  await page.waitForSelector(".cx-vm", { timeout: 5000 });
  const vm = await page.evaluate(() => {
    const m = document.querySelector(".cx-vm");
    return {
      ref: (m.querySelector(".cx-vm-ref") || {}).textContent || "",
      verbs: m.querySelectorAll(".cx-vm-verb").length,
      rows: m.querySelectorAll(".cx-vm-row").length,
      labels: [...m.querySelectorAll(".cx-vm-lbl")].map(n => n.textContent),
      more: [...m.querySelectorAll(".cx-vm-row")].some(r => /more…/.test(r.textContent)),
    };
  });
  if (!/Psalms 82:6/.test(vm.ref)) fail("menu header should carry the ref", vm);
  if (vm.verbs !== 3 || vm.rows > 3) fail("menu must be MINIMAL: 3 verbs + ≤3 rows", vm);
  if (!vm.more) fail("menu must end in '⌘ more…'", vm);
  log(`verse menu ✓ ${vm.ref} · ${vm.verbs} verbs + ${vm.rows} rows · more… present`);
  // arrows walk, Esc closes
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  const walked = await page.evaluate(() => document.activeElement && document.activeElement.className.includes("cx-vm"));
  if (!walked) fail("arrow keys should walk the menu rows");
  await page.keyboard.press("Escape");
  await sleep(200);
  if (await page.$(".cx-vm")) fail("Esc should close the verse menu");
  log("menu keyboard ✓ arrows walk · Esc closes");
  // '⌘ more…' → omnibar pre-seeded with the ref
  await page.click('[data-desk="sys:reader"] .cxr-v[data-vn="6"] .cxr-vn');
  await page.waitForSelector(".cx-vm", { timeout: 5000 });
  await page.evaluate(() => {
    [...document.querySelectorAll(".cx-vm .cx-vm-row")].find(r => /more…/.test(r.textContent)).click();
  });
  await page.waitForSelector(".cx-omni-input", { timeout: 5000 });
  const omniQ = await page.evaluate(() => document.querySelector(".cx-omni-input").value);
  if (!omniQ.startsWith("Psalms 82:6")) fail("omnibar should open pre-seeded with the ref", omniQ);
  log(`'⌘ more…' ✓ omnibar seeded "${omniQ.trim()}"`);
  await page.keyboard.press("Escape");
  await sleep(300);

  // ── 5 · SECONDARY READERS — independent cursor. ──────────────────────
  await page.evaluate(() => window.codexNewReader());
  await page.waitForFunction(() => document.querySelectorAll('[data-desk^="pinned:"] .cxr-v').length > 0, { timeout: 20000 });
  const pin0 = await page.evaluate(() => ({
    loc: (document.querySelector('[data-desk^="pinned:"] .cxr-loc b') || {}).textContent || "",
    wm: !!document.querySelector('[data-desk^="pinned:"] .cx-win.cx-wm-win'),
    spawnBtn: !!document.querySelector('[data-desk="sys:reader"] .cxr-spawn-btn'),
  }));
  if (pin0.loc !== "Psalms") fail("pinned reader should spawn on the spawning cursor", pin0);
  if (!pin0.wm) fail("pinned reader should be a WM window", pin0);
  if (!pin0.spawnBtn) fail("the ⧉ spawner should sit in the reader window header", pin0);
  log("⧉ pinned reader spawned ✓ (WM window, header spawner present)");
  // main navigates; the pinned reader does NOT follow
  await goto("mrk", 2);
  const split = await page.evaluate(() => ({
    main: (document.querySelector('[data-desk="sys:reader"] .cxr-loc b') || {}).textContent || "",
    pinned: (document.querySelector('[data-desk^="pinned:"] .cxr-loc b') || {}).textContent || "",
  }));
  if (split.main !== "Mark" || split.pinned !== "Psalms") fail("pinned reader must keep its own cursor", split);
  log(`independent cursor ✓ main=${split.main} 2 · pinned=${split.pinned} 82`);
  // and its own ‹ › arrows move only itself
  await page.click('[data-desk^="pinned:"] .cxr-nav[aria-label="Next chapter"]');
  await sleep(800);
  const split2 = await page.evaluate(() => ({
    main: (document.querySelector('[data-desk="sys:reader"] .cxr-loc') || {}).textContent || "",
    pinned: (document.querySelector('[data-desk^="pinned:"] .cxr-loc') || {}).textContent || "",
  }));
  if (!/Mark2/.test(split2.main.replace(/\s|\/\d+/g, ""))) fail("main reader must not follow the pinned reader's nav", split2);
  if (!/Psalms83/.test(split2.pinned.replace(/\s|\/\d+/g, ""))) fail("pinned ‹ › should turn the pinned page", split2);
  log("pinned ‹ › ✓ turns only its own page");
  // pinned set survives reload
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
  await page.waitForFunction(() => document.querySelectorAll('[data-desk^="pinned:"] .cxr-v').length > 0, { timeout: 20000 });
  const pinnedAfter = await page.evaluate(() => (document.querySelector('[data-desk^="pinned:"] .cxr-loc b') || {}).textContent || "");
  if (pinnedAfter !== "Psalms") fail("pinned readers should survive reload", pinnedAfter);
  log("pinned reader survives reload ✓");

  // browser-tab variant: ?surface=reader&ref=…
  const tab = await ctx.newPage();
  tab.on("pageerror", (e) => jsErrors.push("tab pageerror: " + e.message));
  await tab.goto(URL + "?surface=reader&ref=" + encodeURIComponent("John 3"), { waitUntil: "load", timeout: 30000 });
  await tab.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
  await tab.waitForFunction(() => {
    const n = window.CODEX_NOW;
    return n && n.book === "John" && +n.chapter === 3 && document.querySelectorAll(".cxr-v").length > 0;
  }, { timeout: 20000 });
  log("?surface=reader&ref=John 3 ✓ satellite tab boots on the page");
  await tab.close();

  if (jsErrors.length) fail("JS errors", jsErrors);
  log("PASS");
} finally {
  await browser.close();
}
