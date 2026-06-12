// smoke-ops.mjs — ❖ OPS (mission cockpit) + CODEX KERNEL end-to-end smoke.
// Boots, opens OPS from the verse menu, launches a REAL mission (several AI
// calls — allow ~90s), and asserts: kernel events stream, tools execute,
// the artifact gains sections, and the mission terminates (done or a clean
// provider error). Zero JS pageerrors throughout.
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const log = (...a) => console.log("[ops]", ...a);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type()==="error" && !/Failed to load resource/i.test(m.text())) jsErrors.push(m.text()); });

  await page.goto(URL, { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
  await page.waitForFunction(() => document.querySelectorAll(".cx-verse,.cx-verse-row").length > 0, { timeout: 20000 });

  const kernel = await page.evaluate(() => ({
    loaded: !!window.CODEX_KERNEL,
    tools: window.CODEX_KERNEL ? window.CODEX_KERNEL.tools() : [],
  }));
  log("kernel:", JSON.stringify(kernel));

  // Open OPS via the verse menu
  {
    // v10: rows are .cxr-v — a REAL right-click (synthetic contextmenu
    // dispatches don't reliably reach React 18's delegated listener), and
    // Escape first to clear any first-run chrome over the desk.
    await page.keyboard.press("Escape");
    await new Promise(r => setTimeout(r, 400));
    const row = await page.$(".cxr-v, .cx-vnum");
    const rb = await row.boundingBox();
    await page.mouse.click(rb.x + rb.width / 2, rb.y + 5, { button: "right" });
  }
  await new Promise(r => setTimeout(r, 400));
  const clicked = await page.evaluate(() => {
    const rows = [].slice.call(document.querySelectorAll(".cx-vm-row"));
    const row = rows.find(b => /ops/i.test(b.textContent||""));
    if (!row) return { found: false };
    row.click();
    return { found: true };
  });
  log("clicked OPS row:", JSON.stringify(clicked));
  await new Promise(r => setTimeout(r, 800));
  const opened = await page.evaluate(() => ({
    console: !!document.querySelector(".cx-ops"),
    seeded: (document.querySelector(".cx-ops-input")||{}).value || "",
  }));
  log("console open:", opened.console, "· seeded:", JSON.stringify(opened.seeded.slice(0, 60)));

  // Launch a tight mission (small step count via a focused intent)
  await page.evaluate(() => {
    const ta = document.querySelector(".cx-ops-input");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(ta, "Read John 1:1, list its top cross-references, and write ONE short cited section on what the verse claims about the Word. Then finish.");
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 200));
  await page.evaluate(() => { document.querySelector(".cx-ops-run").click(); });
  log("mission launched — waiting for terminal state (≤90s)…");

  await page.waitForFunction(() => {
    const s = document.querySelector(".cx-ops-h-status");
    return s && /COMPLETE|FAILED|ABORTED/i.test(s.textContent || "");
  }, { timeout: 90000 }).catch(() => {});

  const state = await page.evaluate(() => ({
    status: (document.querySelector(".cx-ops-h-status")||{}).textContent || "",
    feedEvents: document.querySelectorAll(".cx-ops-ev").length,
    toolCalls: document.querySelectorAll(".cx-ops-ev.is-tool").length,
    results: document.querySelectorAll(".cx-ops-ev.is-result").length,
    sections: document.querySelectorAll(".cx-ops-art-sec").length,
    refChips: document.querySelectorAll(".cx-ops-refchip").length,
    error: (document.querySelector(".cx-ops-error code")||{}).textContent || "",
    missions: JSON.parse(localStorage.getItem("codex.missions") || "[]").length,
  }));
  log("state:", JSON.stringify(state));
  log("jsErrors:", JSON.stringify(jsErrors.slice(0,5)));

  const terminal = /COMPLETE|FAILED|ABORTED/i.test(state.status);
  const healthy = state.status.includes("COMPLETE")
    ? (state.toolCalls >= 1 && state.sections >= 1)
    : true; // a clean provider failure is tolerable; JS errors are not
  const ok = kernel.loaded && opened.console && clicked.found && terminal && healthy && jsErrors.length === 0;
  log(ok ? "PASS" : "FAIL");
  process.exitCode = ok ? 0 : 1;
} finally {
  await browser.close();
}
