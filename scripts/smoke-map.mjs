// smoke-map.mjs — Verse Map (GEOINT console) interaction smoke.
// Boots the app, opens the verse menu, clicks MAP, and asserts the modal
// reaches a body / error state. Also probes the new GEOINT affordances:
// layer toggles (⌖ resonance, ◈ network), the cursor readout slot, and the
// Leaflet container. Mirrors smoke-mirror.mjs structure.
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const log = (...a) => console.log("[map]", ...a);

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
    // No \b here: the row text runs glyphs/labels together ("◎MAPplace · era…"),
    // so a word boundary between "MAP" and "place" never exists.
    const row = rows.find(b => /map/i.test(b.textContent||""));
    if (!row) return { found:false, rows: [].slice.call(document.querySelectorAll(".cx-vm-row")).map(r=>r.textContent.trim()) };
    row.click();
    return { found:true };
  });
  log("clicked MAP row:", JSON.stringify(clicked));

  await new Promise(r => setTimeout(r, 1500));
  log("modal (.cx-map) opened:", await page.evaluate(() => !!document.querySelector(".cx-map")));

  // Wait for the map body (cached or AI-generated) or an explicit error.
  await page.waitForFunction(() => {
    return document.querySelector(".cx-map-body, .cx-map-err");
  }, { timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1200));

  const state = await page.evaluate(() => ({
    loading: !!document.querySelector(".cx-map-loading"),
    hasBody: !!document.querySelector(".cx-map-body"),
    hasErr: !!document.querySelector(".cx-map-err"),
    errText: (document.querySelector(".cx-map-err code")||{}).textContent || "",
    leaflet: !!document.querySelector(".cx-map-leaflet .leaflet-container, .cx-map-leaflet.leaflet-container"),
    layerToggles: document.querySelectorAll(".cx-map-layer").length,
    cursorSlot: !!document.getElementById("cx-map-cursor"),
    timeline: !!document.querySelector(".cx-map-timeline"),
  }));
  log("state:", JSON.stringify(state));

  // Toggle the network layer (◈) — should never throw even with no history.
  if (state.hasBody && state.layerToggles >= 7) {
    const toggled = await page.evaluate(() => {
      const btns = [].slice.call(document.querySelectorAll(".cx-map-layer"));
      const net = btns.find(b => (b.getAttribute("title")||"").match(/known sites/i));
      if (!net) return { found:false };
      net.click();
      return { found:true };
    });
    await new Promise(r => setTimeout(r, 700));
    toggled.netMarkers = await page.evaluate(() => document.querySelectorAll(".cx-map-net").length);
    log("network toggle:", JSON.stringify(toggled));
  }

  log("jsErrors:", JSON.stringify(jsErrors.slice(0,5)));
  const ok = (state.hasBody || state.hasErr) && jsErrors.length === 0;
  log(ok ? "PASS" : "FAIL");
  process.exitCode = ok ? 0 : 1;
} finally {
  await browser.close();
}
