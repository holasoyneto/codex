// audit-shots.mjs — UI audit screenshot walker.
// Boots the live app, walks the major surfaces (reader, library, right-rail
// tabs, verse menu, Mirror/Map/Art/Compare windows, settings, footer) at
// desktop and mobile widths, and dumps PNGs to /tmp/codex-ui-audit for
// visual inspection. Collects JS errors per step.
// Run: node scripts/audit-shots.mjs   (server must be on :7777)
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const OUT = "/tmp/codex-ui-audit";
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log("[audit]", ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--force-device-scale-factor=1"] });

async function boot(page) {
  await page.goto(URL, { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
  await page.waitForFunction(() => document.querySelectorAll(".cx-verse,.cx-verse-row").length > 0, { timeout: 20000 }).catch(() => {});
  await sleep(600);
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  log("shot:", name);
}

async function esc(page, times = 2) {
  for (let i = 0; i < times; i++) { await page.keyboard.press("Escape"); await sleep(200); }
}

async function openVerseMenu(page) {
  await page.evaluate(() => {
    const n = document.querySelectorAll(".cx-vnum")[2] || document.querySelector(".cx-vnum");
    const r = n.getBoundingClientRect();
    n.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + 3, clientY: r.top + 3 }));
  });
  await sleep(450);
}

async function clickMenuRow(page, re) {
  return page.evaluate((src) => {
    const rx = new RegExp(src, "i");
    const rows = [].slice.call(document.querySelectorAll(".cx-vm-row, button, [role='menuitem']"));
    const row = rows.find(b => rx.test(b.textContent || ""));
    if (!row) return false;
    row.click();
    return true;
  }, re);
}

async function walk(viewport, suffix) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/i.test(m.text())) errs.push(m.text()); });
  await boot(page);
  await shot(page, `reader${suffix}`);

  // Library (left rail)
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("codex:open-library")));
  await sleep(700);
  await shot(page, `library${suffix}`);
  await esc(page);

  // Right rail — walk every tab.
  await page.evaluate(() => {
    const btn = document.querySelector(".cx-tab");
    if (btn) btn.click();
  });
  await sleep(600);
  const tabs = await page.evaluate(() =>
    [].slice.call(document.querySelectorAll(".cx-tab")).map(t => (t.querySelector(".cx-tab-lbl")?.textContent || t.textContent || "").trim())
  );
  log(`tabs${suffix}:`, JSON.stringify(tabs));
  for (let i = 0; i < tabs.length; i++) {
    const ok = await page.evaluate((idx) => {
      const ts = document.querySelectorAll(".cx-tab");
      if (!ts[idx] || ts[idx].className.includes("is-locked")) return false;
      ts[idx].click();
      return true;
    }, i);
    if (!ok) continue;
    await sleep(1400);
    await shot(page, `panel-${(tabs[i] || i).toLowerCase().replace(/[^a-z0-9]+/g, "-")}${suffix}`);
  }
  await esc(page);

  // Verse menu
  await openVerseMenu(page);
  await shot(page, `verse-menu${suffix}`);

  // Consoles from the verse menu: Mirror, Map, Art, Compare
  for (const name of ["mirror", "map", "art", "compare"]) {
    await openVerseMenu(page);
    const ok = await clickMenuRow(page, name === "compare" ? "compare" : name);
    await sleep(1600);
    if (ok) await shot(page, `win-${name}${suffix}`);
    else log(`menu row not found: ${name}${suffix}`);
    await esc(page, 3);
  }

  // Settings
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("codex:open-settings", { detail: {} })));
  await sleep(800);
  await shot(page, `settings${suffix}`);
  await esc(page);

  // Oracle
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("codex:shortcut", { detail: { action: "toggle-oracle" } })));
  await sleep(900);
  await shot(page, `oracle${suffix}`);
  await esc(page);

  log(`errors${suffix}:`, JSON.stringify(errs, null, 1));
  await page.close();
  return errs;
}

try {
  const desktopErrs = await walk({ width: 1440, height: 900 }, "");
  const mobileErrs = await walk({ width: 390, height: 844, isMobile: true, hasTouch: true }, "-m");
  log("DONE. desktop errors:", desktopErrs.length, "mobile errors:", mobileErrs.length);
} finally {
  await browser.close();
}
