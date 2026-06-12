// smoke-map.mjs — Verse Map (GEOINT console) interaction smoke.
// Boots the app, opens the verse menu, clicks MAP, and asserts the modal
// reaches a body / error state (the existing AI-pipeline assertion). Then
// probes the v2 surface: era readout (#cx-map-era), the foot TIME SCRUB
// (drag → era changes), cinematic fly-to (codex:now dispatch → camera
// telemetry __CODEX_MAP_CAM moves), POI click → in-surface dossier card,
// ✦ READ chip → CODEX_NOW changes, plus the legacy layer toggles. Map
// dossier caches are pre-seeded so the run is deterministic offline (the
// AI fetch path is exercised by other suites; here the camera/dossier
// surface is under test). Zero pageerrors required.
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const log = (...a) => console.log("[map]", ...a);

// Map-dossier fixtures — schema mirrors MAP_PROMPT's contract.
const fixture = (place, lat, lng, polities) => ({
  place, modernEquivalent: "Fixture", region: "Levant", era: "Iron Age II",
  century: "10th cent. BCE", verseYear: -950, lat, lng,
  pointsOfInterest: [
    { name: "Bethlehem",      lat: 31.7054, lng: 35.2024, kind: "city", from: -3000, to: 2026, wiki: "Bethlehem" },
    { name: "Sea of Galilee", lat: 32.83,   lng: 35.59,   kind: "lake", from: -3000, to: 2026, wiki: "Sea_of_Galilee" },
  ],
  summary: "Smoke fixture — deterministic offline body.",
  populations: "p.", structures: "s.", neighbours: "n.", period: "q.",
  polities,
});
const POL_JER = [
  { from: -2000, to: -1200, name: "Canaan" },
  { from: -1200, to:  -930, name: "Tribal confederacy" },
  { from:  -930, to:  -586, name: "Kingdom of Judah" },
  { from:  -586, to:  1917, name: "Imperial periods" },
  { from:  1917, to:  2026, name: "Modern era" },
];
const POL_ROME = [
  { from: -750, to: -509, name: "Roman Kingdom" },
  { from: -509, to:  -27, name: "Roman Republic" },
  { from:  -27, to:  476, name: "Roman Empire" },
  { from:  476, to: 2026, name: "Italian periods" },
];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push("pageerror: " + e.message));
  page.on("console", (m) => { /* CORS = bible-api throttling; the loader falls back to its bolls mirror by design */ if (m.type()==="error" && !/Failed to load resource|CORS policy/i.test(m.text())) jsErrors.push(m.text()); });

  await page.goto(URL, { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
  await page.waitForFunction(() => document.querySelectorAll(".cx-verse,.cx-verse-row").length > 0, { timeout: 20000 });
  await page.waitForFunction(() => !!(window.CODEX_NOW && window.CODEX_NOW.bookId), { timeout: 20000 });
  log("booted; verses present");

  // Seed dossier + gazetteer caches keyed off the live cursor so the modal
  // reaches a body instantly and every probe below is deterministic.
  const seeded = await page.evaluate((fixJer, fixRome) => {
    const n = window.CODEX_NOW;
    for (let v = 1; v <= 15; v++) {
      localStorage.setItem(`codex.maps.${n.bookId}.${n.chapter}.${v}`, JSON.stringify(fixJer));
    }
    const ch2 = n.chapter === 1 ? 2 : 1;
    localStorage.setItem(`codex.maps.${n.bookId}.${ch2}.1`, JSON.stringify(fixRome));
    const tv = n.verse === 7 ? 8 : 7;
    const osis = `${n.bookId}.${n.chapter}.${tv}`;
    localStorage.setItem("codex.poirefs.jerusalem", JSON.stringify([osis]));
    localStorage.setItem("codex.poirefs.rome",      JSON.stringify([osis]));
    return { bookId: n.bookId, chapter: n.chapter, ch2, ref: n.ref, osis };
  }, fixture("Jerusalem", 31.778, 35.235, POL_JER), fixture("Rome", 41.9, 12.5, POL_ROME));
  log("seeded:", JSON.stringify(seeded));

  const opened = await (async () => {
    // v10: rows are .cxr-v — a REAL right-click (synthetic contextmenu
    // dispatches don't reliably reach React 18's delegated listener), and
    // Escape first to clear any first-run chrome over the desk.
    await page.keyboard.press("Escape");
    await new Promise(r => setTimeout(r, 400));
    const row = await page.$(".cxr-v, .cx-vnum");
    if (!row) return false;
    const rb = await row.boundingBox();
    await page.mouse.click(rb.x + rb.width / 2, rb.y + 5, { button: "right" });
    return true;
  })();
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

  // Wait for the map body (cached or AI-generated) or an explicit error —
  // the original AI-pipeline assertion stays load-bearing.
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
    scrub: !!document.querySelector(".cx-mapx-scrub-track"),
    alist: document.querySelectorAll(".cx-mapx-alist button").length,
    eraglow: !!document.querySelector(".cx-mapx-eraglow"),
  }));
  log("state:", JSON.stringify(state));

  // ── ERA READOUT — FootScrub broadcasts on mount, before any gesture ────
  const eraBefore = await page.evaluate(() => (document.getElementById("cx-map-era")||{}).textContent || "");
  log("era readout (initial):", JSON.stringify(eraBefore));

  // ── TIME SCRUB — drag across the polity chronology → era changes ───────
  let scrubChanged = false;
  const track = await page.$(".cx-mapx-scrub-track");
  if (track) {
    const tb = await track.boundingBox();
    await page.mouse.move(tb.x + tb.width * 0.05, tb.y + tb.height / 2);
    await page.mouse.down();
    await page.mouse.move(tb.x + tb.width * 0.95, tb.y + tb.height / 2, { steps: 10 });
    await page.mouse.up();
    await new Promise(r => setTimeout(r, 400));
    const after = await page.evaluate(() => ({
      era: (document.getElementById("cx-map-era")||{}).textContent || "",
      live: window.__CODEX_MAP_ERA && window.__CODEX_MAP_ERA.name,
    }));
    scrubChanged = !!after.era && after.era !== eraBefore;
    log("scrub:", JSON.stringify({ before: eraBefore, after: after.era, live: after.live, scrubChanged }));
  } else log("scrub: track missing");

  // ── CINEMATIC FLY-TO — codex:now dispatch → camera telemetry moves ─────
  const camBefore = await page.evaluate(() => window.__CODEX_MAP_CAM ? { lat: window.__CODEX_MAP_CAM.lat, lng: window.__CODEX_MAP_CAM.lng } : null);
  await page.evaluate((s) => {
    window.dispatchEvent(new CustomEvent("codex:now", { detail: {
      bookId: s.bookId, chapter: s.ch2, verse: 1, ref: "SMOKE FLY",
    }}));
  }, seeded);
  await new Promise(r => setTimeout(r, 2800)); // flyTo eases ~1.8s
  const camAfter = await page.evaluate(() => window.__CODEX_MAP_CAM ? { lat: window.__CODEX_MAP_CAM.lat, lng: window.__CODEX_MAP_CAM.lng } : null);
  const flew = !!(camBefore && camAfter) &&
    (Math.abs(camAfter.lat - camBefore.lat) > 3 || Math.abs(camAfter.lng - camBefore.lng) > 3);
  log("fly-to:", JSON.stringify({ camBefore, camAfter, flew }));

  // ── POI CLICK → in-surface dossier card (never a popup) ───────────────
  const poiClicked = await page.evaluate(() => {
    // Prefer a real Leaflet marker; the a11y mirror dispatches the identical
    // codex:map-poi event, so it is a faithful fallback.
    const mk = document.querySelector(".cx-map-mark-leaflet") || document.querySelector(".cx-map-poi-leaflet");
    if (mk) { mk.click(); return "marker"; }
    const btn = document.querySelector(".cx-mapx-alist button");
    if (btn) { btn.click(); return "alist"; }
    return null;
  });
  await page.waitForFunction(() => !!document.querySelector(".cx-mapx-dossier"), { timeout: 8000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelectorAll(".cx-mapx-readchip").length > 0, { timeout: 8000 }).catch(() => {});
  const dossier = await page.evaluate(() => ({
    card: !!document.querySelector(".cx-mapx-dossier"),
    name: (document.querySelector(".cx-mapx-dossier-name")||{}).textContent || "",
    chips: document.querySelectorAll(".cx-mapx-readchip").length,
    chipText: (document.querySelector(".cx-mapx-readchip")||{}).textContent || "",
    honest: !!document.querySelector(".cx-mapx-dossier-foot"),
  }));
  log("dossier:", JSON.stringify({ via: poiClicked, ...dossier }));

  // ── ✦ READ chip → reader routes → CODEX_NOW changes ───────────────────
  const refBefore = await page.evaluate(() => (window.CODEX_NOW || {}).ref || "");
  await page.evaluate(() => { const c = document.querySelector(".cx-mapx-readchip"); if (c) c.click(); });
  const refChanged = await page.waitForFunction(
    (before) => window.CODEX_NOW && window.CODEX_NOW.ref && window.CODEX_NOW.ref !== before,
    { timeout: 20000 }, refBefore
  ).then(() => true).catch(() => false);
  const refAfter = await page.evaluate(() => (window.CODEX_NOW || {}).ref || "");
  log("read chip:", JSON.stringify({ refBefore, refAfter, refChanged }));

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
  const ok = (state.hasBody || state.hasErr)
    && state.scrub && state.eraglow && state.alist > 0
    && !!eraBefore && scrubChanged
    && flew
    && dossier.card && dossier.chips > 0
    && refChanged
    && jsErrors.length === 0;
  log(ok ? "PASS" : "FAIL");
  process.exitCode = ok ? 0 : 1;
} finally {
  await browser.close();
}
