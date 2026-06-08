// One-off interaction smoke: open the verse menu → click Cross-References →
// verify the right rail opens, the tab switches, and the panel renders refs.
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:3000/";
const log = (...a) => console.log("[xref]", ...a);

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

  // Inspect the plugin registry + tab ids BEFORE interacting.
  const reg = await page.evaluate(() => {
    const api = window.CODEX_PLUGINS_API;
    const panels = api && api.getPanels ? api.getPanels() : [];
    const actions = api && api.getVerseActions ? api.getVerseActions() : [];
    return {
      panelIds: panels.map(p => `plugin:${p.pluginId}:${p.id}`),
      verseActions: actions.map(a => ({ label: a.label, pluginId: a.pluginId })),
      railTabIds: (window.railTabs ? window.railTabs() : []).map(t => t.id),
    };
  });
  log("registered panel tab ids:", JSON.stringify(reg.panelIds));
  log("xref verse action present:", reg.verseActions.some(a => /cross-ref/i.test(a.label)));
  log("railTabs has crossrefs tab:", reg.railTabIds.filter(id => /crossref/i.test(id)));

  // Open the verse menu via contextmenu on a verse number.
  const opened = await page.evaluate(() => {
    const n = document.querySelector(".cx-vnum");
    if (!n) return false;
    const r = n.getBoundingClientRect();
    n.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left+3, clientY: r.top+3 }));
    return true;
  });
  await new Promise(r => setTimeout(r, 400));
  const menuOpen = await page.evaluate(() => !!document.querySelector(".cx-vm"));
  log("verse menu opened:", menuOpen);
  if (!menuOpen) { console.error("[xref] FAIL — verse menu did not open"); process.exit(1); }

  // Click the Cross-References row.
  const clicked = await page.evaluate(() => {
    const rows = [].slice.call(document.querySelectorAll(".cx-vm-row"));
    const row = rows.find(b => /cross-ref/i.test(b.textContent||""));
    if (!row) return { found:false };
    row.click();
    return { found:true };
  });
  log("clicked Cross-References row:", JSON.stringify(clicked));
  if (!clicked.found) { console.error("[xref] FAIL — no Cross-References row in the menu"); process.exit(1); }

  // Give the panel time to switch + load TSK.
  await page.waitForFunction(() => {
    const app = document.querySelector(".cx-app");
    return app && /right-open/.test(app.className);
  }, { timeout: 8000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2500));

  const after = await page.evaluate(() => {
    const app = document.querySelector(".cx-app");
    const rail = document.querySelector(".cx-rail-r");
    const railText = rail ? rail.textContent.slice(0, 400) : "(no rail)";
    // active tab
    const activeTab = document.querySelector("[class*='tab'].is-active, .cx-pane-tab.is-active, .cx-rail-tab.is-active");
    return {
      rightOpen: !!(app && /right-open/.test(app.className)),
      activeTabText: activeTab ? activeTab.textContent.trim().slice(0,40) : "(none)",
      crossrefNodes: document.querySelectorAll("[class*='xref'],[class*='crossref'],.cx-cr,.cx-crossrefs").length,
      mentionsTSK: /treasury|cross|xref/i.test(railText),
      refLinks: document.querySelectorAll(".cx-rail-r a, .cx-rail-r [role='link'], .cx-rail-r [class*='ref']").length,
      railText,
    };
  });
  log("AFTER click:", JSON.stringify({ rightOpen: after.rightOpen, activeTabText: after.activeTabText, crossrefNodes: after.crossrefNodes, mentionsTSK: after.mentionsTSK, refLinks: after.refLinks }, null, 1));
  log("rail text sample:", JSON.stringify(after.railText));
  log("js errors:", JSON.stringify(jsErrors));

  const ok = after.rightOpen && (after.crossrefNodes > 0 || after.mentionsTSK);
  log(ok ? "panel opened and rendered ✓" : "panel did NOT open/render ✗");

  // Now test ref-click navigation: click the first ref (not a chain/back btn)
  // and confirm the reader navigates away from John 1.
  const titleBefore = await page.evaluate(() => (document.querySelector(".cx-reader-titles h1")||{}).textContent || "");
  const navClick = await page.evaluate(() => {
    const rail = document.querySelector(".cx-rail-r");
    if (!rail) return { found:false };
    const btns = [].slice.call(rail.querySelectorAll("button"));
    // a ref button looks like "Genesis 1:1" — has a digit:digit, not "chain"/"back"
    const ref = btns.find(b => /\d+:\d+/.test(b.textContent||"") && !/chain|back/i.test(b.textContent||""));
    if (!ref) return { found:false, sample: btns.slice(0,8).map(b=>b.textContent.trim()) };
    ref.click();
    return { found:true, label: ref.textContent.trim() };
  });
  log("ref-click:", JSON.stringify(navClick));
  await new Promise(r => setTimeout(r, 2500));
  const titleAfter = await page.evaluate(() => (document.querySelector(".cx-reader-titles h1")||{}).textContent || "");
  const navigated = !!navClick.found && titleAfter && titleAfter !== titleBefore;
  log("reader title before:", JSON.stringify(titleBefore), "→ after:", JSON.stringify(titleAfter), "| navigated:", navigated);

  console.log((ok && navigated) ? "[xref] PASS — panel renders AND ref-click navigates." : "[xref] PARTIAL/FAIL — see above.");
  process.exit(ok && navigated && jsErrors.length === 0 ? 0 : 1);
} finally {
  await browser.close();
}
