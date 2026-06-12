// smoke-oracle-ops.mjs — THE ARTIFACTS ENGINE + ORACLE ASCENSION + OPS:
//   · boots (smoke-desk pattern), opens the oracle window
//   · MOCKS the model (fetch stub on /api/chat, keyed by system prompt) —
//     returns markdown + a scripture ref + codex:buttons + codex:chart
//   · asserts: rendered heading + table DOM, ref-chip click moves CODEX_NOW,
//     directive button opens a panel window, SVG chart present
//   · ai-busy orb appears during an artificially-delayed call, then vanishes
//   · tabs: create / switch threads (codex.oracle.threads.v1)
//   · kernel: app_settings_get returns tweaks; app_settings_set round-trips
//     fontScale and back (echo chip string asserted)
//   · OPS: a mocked mission (tool step → section with codex:chart → done)
//     renders an SVG chart artifact + a collapsible tool result
//   · zero pageerrors throughout
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:7777/";
const log = (...a) => console.log("[oracle-ops]", ...a);
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
  await page.waitForFunction(() => document.querySelectorAll(".cx-verse,.cx-verse-row,.cxr-v").length > 0, { timeout: 30000 });
  await sleep(600);
  const fail = (m, x) => { throw new Error(m + (x !== undefined ? " · " + JSON.stringify(x) : "")); };

  // ── 0 · the model mock — intercept /api/chat, keyed by system prompt ──
  await page.evaluate(() => {
    const orig = window.fetch.bind(window);
    window.__mock = { oracle: [], kernel: [], calls: 0, unmatched: 0 };
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      const path = url.replace(/^https?:\/\/[^/]+/, "");
      if (path === "/api/chat" && init && String(init.method || "").toUpperCase() === "POST") {
        window.__mock.calls++;
        let sys = "";
        try {
          const body = JSON.parse(init.body || "{}");
          sys = typeof body.system === "string" ? body.system : JSON.stringify(body.system || "");
        } catch {}
        let q = null;
        if (/THE ORACLE/.test(sys)) q = window.__mock.oracle;
        else if (/CODEX KERNEL/.test(sys)) q = window.__mock.kernel;
        const next = (q && q.length) ? q.shift() : (window.__mock.unmatched++, { text: "(mock: no scripted reply)", delay: 0 });
        if (next.delay) await new Promise(r => setTimeout(r, next.delay));
        return new Response(JSON.stringify({ text: next.text }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return orig(input, init);
    };
  });
  log("model mocked (fetch stub keyed by system prompt) ✓");

  // ── 1 · open the oracle window ──
  await page.evaluate(() => window.codexDesk.open("oracle"));
  await page.waitForSelector('[data-desk="sys:oracle"] .cxo', { timeout: 15000 });
  const surface = await page.evaluate(() => ({
    banner: !!document.querySelector('[data-desk="sys:oracle"] .cxo-banner'),
    invocations: document.querySelectorAll('[data-desk="sys:oracle"] .cxo-inv').length,
    tabs: document.querySelectorAll('[data-desk="sys:oracle"] .cxo2-tab').length,
    toolsToggle: !!document.querySelector('[data-desk="sys:oracle"] .cxo2-tools'),
    artifacts: !!(window.CODEX_ARTIFACTS && window.CODEX_ARTIFACTS.Rich),
    busyBus: !!(window.CODEX_AI_BUSY && window.CODEX_AI_BUSY.begin),
  }));
  if (!surface.banner || surface.invocations !== 5) fail("v10 goods missing (banner/invocations)", surface);
  if (surface.tabs < 1) fail("thread tabs missing", surface);
  if (!surface.toolsToggle) fail("⚒ TOOLS toggle missing", surface);
  if (!surface.artifacts || !surface.busyBus) fail("artifacts engine / busy bus not loaded", surface);
  log("oracle window: banner + 5 invocations + tabs + ⚒ TOOLS + engine ✓");

  // ── 2 · a rich, artificially-delayed reply ──
  const RICH = [
    "## The Word at the threshold",
    "",
    "| Greek | Translit | Gloss |",
    "|---|---|---|",
    "| λόγος | logos | word, reason |",
    "",
    "**Augustine** read this with Romans 8:28 in view — a CONTESTED linkage some modern critics reject.",
    "",
    "```codex:buttons",
    '[{"label":"Open gematria","action":{"kind":"panel","id":"gem"}}]',
    "```",
    "",
    "```codex:chart",
    '{"type":"bar","title":"Logos by corpus","data":[{"label":"John","value":4},{"label":"Epistles","value":2}]}',
    "```",
  ].join("\n");
  await page.evaluate((rich) => { window.__mock.oracle.push({ text: rich, delay: 1800 }); }, RICH);
  await page.evaluate(() => {
    const input = document.querySelector('[data-desk="sys:oracle"] .cxo-ask input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, "What is the Logos?");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await sleep(120);
  await page.evaluate(() => document.querySelector('[data-desk="sys:oracle"] .cxo-ask button[type="submit"]').click());

  // the ai-busy orb must exist DURING the delayed call…
  await page.waitForSelector("#cx-ai-orb", { timeout: 4000 });
  const orb = await page.evaluate(() => {
    const el = document.getElementById("cx-ai-orb");
    return { label: el.getAttribute("aria-label") || "", core: !!el.querySelector(".cx-ai-orb-core") };
  });
  if (!/ORACLE/i.test(orb.label) || !orb.core) fail("busy orb wrong", orb);
  log("ai-busy orb pulses during the call (label: " + orb.label + ") ✓");

  // …and vanish once the reply lands.
  await page.waitForFunction(() => !document.getElementById("cx-ai-orb"), { timeout: 15000 });
  await page.waitForSelector('[data-desk="sys:oracle"] .cxo-msg.is-oracle .cx-art', { timeout: 10000 });
  const rendered = await page.evaluate(() => {
    const root = document.querySelector('[data-desk="sys:oracle"] .cxo-msg.is-oracle .cx-art');
    return {
      heading: (root.querySelector(".cx-art-h") || {}).textContent || "",
      tableCells: root.querySelectorAll("table.cx-art-table td").length,
      refChips: [...root.querySelectorAll(".cx-art-ref")].map(b => b.textContent.trim()),
      buttons: [...root.querySelectorAll(".cx-art-btn")].map(b => b.textContent.trim()),
      chartSvg: !!root.querySelector(".cx-art-chart svg"),
      chartValues: [...root.querySelectorAll(".cx-art-chart svg text")].map(t => t.textContent),
      rawHtmlLeak: /<\/?(script|iframe|style)/i.test(root.innerHTML),
      bold: !!root.querySelector("strong"),
    };
  });
  if (!/Word at the threshold/.test(rendered.heading)) fail("heading not rendered", rendered);
  if (rendered.tableCells < 3) fail("markdown table not rendered", rendered);
  if (!rendered.refChips.some(r => /Romans 8:28/.test(r))) fail("scripture ref chip missing", rendered);
  if (!rendered.buttons.some(b => /gematria/i.test(b))) fail("codex:buttons not rendered", rendered);
  if (!rendered.chartSvg) fail("codex:chart SVG missing", rendered);
  if (!rendered.chartValues.some(v => v === "4")) fail("chart must carry honest value labels", rendered);
  if (rendered.rawHtmlLeak) fail("SECURITY: raw model HTML leaked into the DOM", rendered);
  log(`rich reply: heading ✓ table(${rendered.tableCells} cells) ✓ ref chips ${JSON.stringify(rendered.refChips)} ✓ chart+values ✓ no raw HTML ✓`);

  // ── 3 · ref chip click → the reader moves (the universal law) ──
  await page.evaluate(() => {
    const chip = [...document.querySelectorAll('[data-desk="sys:oracle"] .cx-art-ref')]
      .find(b => /Romans 8:28/.test(b.textContent));
    chip.click();
  });
  await page.waitForFunction(() => (window.CODEX_NOW || {}).ref === "Romans 8:28", { timeout: 30000 });
  log("ref chip click → CODEX_NOW = Romans 8:28 ✓");

  // ── 4 · directive button → a real panel window opens ──
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('[data-desk="sys:oracle"] .cx-art-btn')]
      .find(b => /gematria/i.test(b.textContent));
    btn.click();
  });
  await sleep(700);
  const panel = await page.evaluate(() => ({
    listed: window.codexDeskPanels ? window.codexDeskPanels.list() : [],
    win: !!document.querySelector('[data-wm-id="win:builtin:gem"]'),
  }));
  if (!panel.listed.includes("gem") && !panel.win) fail("codex:buttons panel action did not open GEMATRIA", panel);
  log("directive button → GEMATRIA window open ✓", JSON.stringify(panel.listed));

  // ── 5 · tabs: create + switch ──
  const tabState = await page.evaluate(() => {
    document.querySelector('[data-desk="sys:oracle"] .cxo2-tab-new').click();
    return new Promise(res => setTimeout(() => {
      const tabs = [...document.querySelectorAll('[data-desk="sys:oracle"] .cxo2-tab')];
      res({
        count: tabs.length,
        freshEmpty: !!document.querySelector('[data-desk="sys:oracle"] .cxo-empty'),
        activeIdx: tabs.findIndex(t => t.classList.contains("is-active")),
      });
    }, 300));
  });
  if (tabState.count < 2 || !tabState.freshEmpty) fail("new tab must be a fresh empty thread", tabState);
  const backState = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('[data-desk="sys:oracle"] .cxo2-tab')];
    const other = tabs.find(t => !t.classList.contains("is-active"));
    other.click();
    return new Promise(res => setTimeout(() => {
      res({
        msgs: document.querySelectorAll('[data-desk="sys:oracle"] .cxo-msg').length,
        persisted: (JSON.parse(localStorage.getItem("codex.oracle.threads.v1") || "[]")).length,
      });
    }, 300));
  });
  if (backState.msgs < 2) fail("switching back must restore the conversation", backState);
  if (backState.persisted < 2) fail("threads must persist to codex.oracle.threads.v1", backState);
  log(`tabs: create→empty, switch→restored (${backState.msgs} msgs, ${backState.persisted} threads persisted) ✓`);

  // ── 6 · kernel app-control tools: settings round-trip ──
  const settings = await page.evaluate(async () => {
    const K = window.CODEX_KERNEL;
    const before = JSON.parse(await K.call("app_settings_get"));
    const had = Object.prototype.hasOwnProperty.call(before, "fontScale");
    const prev = before.fontScale;
    const echo = await K.call("app_settings_set", { key: "fontScale", value: 23 });
    const mid = JSON.parse(await K.call("app_settings_get", { key: "fontScale" }));
    // restore
    if (had) await K.call("app_settings_set", { key: "fontScale", value: prev });
    else {
      const s = JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}");
      delete s.fontScale;
      localStorage.setItem("codex.tweaks.v1", JSON.stringify(s));
    }
    const fin = JSON.parse(await K.call("app_settings_get", { key: "fontScale" }));
    const tools = K.tools();
    return { echo, mid, fin, had, prev, tools: tools.filter(t => /app_settings|open_panel|set_translation|focus_mode/.test(t)) };
  });
  if (!settings.echo.startsWith("⚙ set fontScale 23")) fail("settings write must echo a ⚙ chip", settings);
  if (settings.mid.value !== 23) fail("app_settings_set did not round-trip", settings);
  if (settings.had ? settings.fin.value !== settings.prev : settings.fin.set) fail("fontScale not restored", settings);
  if (settings.tools.length < 5) fail("app-control tools missing from the kernel registry", settings);
  log(`kernel settings: get ✓ set→23 ✓ restore ✓ (echo: "${settings.echo.slice(0, 40)}…") · tools ${JSON.stringify(settings.tools)} ✓`);

  // ── 7 · OPS — mocked mission renders an SVG chart artifact ──
  await page.evaluate(() => {
    const sec = {
      thought: "chart what I counted",
      section: {
        heading: "Logos density",
        body: "Counted from the tool result.\n\n```codex:chart\n{\"type\":\"bar\",\"title\":\"hits\",\"data\":[{\"label\":\"John\",\"value\":4},{\"label\":\"Genesis\",\"value\":1}]}\n```\nSee John 1:1.",
      },
    };
    window.__mock.kernel.push({ text: JSON.stringify({ thought: "peek settings", tool: "app_settings_get", args: {} }) });
    window.__mock.kernel.push({ text: JSON.stringify(sec) });
    window.__mock.kernel.push({ text: JSON.stringify({ thought: "wrap", done: { title: "Logos study", summary: "A mocked mission." } }) });
    window.codexOpenOps("");
  });
  await page.waitForSelector(".cx-ops", { timeout: 10000 });
  await page.evaluate(() => {
    const ta = document.querySelector(".cx-ops-input");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(ta, "Trace the Logos (mocked).");
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await sleep(150);
  await page.evaluate(() => document.querySelector(".cx-ops-run").click());
  await page.waitForFunction(() => {
    const s = document.querySelector(".cx-ops-h-status");
    return s && /COMPLETE|FAILED|ABORTED/i.test(s.textContent || "");
  }, { timeout: 30000 });
  const ops = await page.evaluate(() => ({
    status: (document.querySelector(".cx-ops-h-status") || {}).textContent || "",
    chartSvg: !!document.querySelector(".cx-ops-art-sec .cx-art-chart svg"),
    artRefs: document.querySelectorAll(".cx-ops-art-sec .cx-art-ref").length,
    collapsible: document.querySelectorAll(".cx-ops-ev.is-result details").length,
    gist: (document.querySelector(".cx-ops-ev.is-result summary .cx-ops-ev-gist") || {}).textContent || "",
    saveStudy: !!Array.from(document.querySelectorAll(".cx-ops-art-actions button")).find(b => /SAVE AS STUDY/i.test(b.textContent)),
    read: !!Array.from(document.querySelectorAll(".cx-ops-art-actions button")).find(b => /READ/.test(b.textContent)),
  }));
  if (!/COMPLETE/i.test(ops.status)) fail("mocked mission must complete", ops);
  if (!ops.chartSvg) fail("OPS artifact must render the codex:chart SVG", ops);
  if (ops.artRefs < 1) fail("OPS artifact must render live ref chips", ops);
  if (ops.collapsible < 1 || !ops.gist) fail("step feed must show collapsible tool results", ops);
  if (!ops.saveStudy) fail("SAVE AS STUDY must stay", ops);
  log(`OPS: mission COMPLETE ✓ chart SVG ✓ ref chips(${ops.artRefs}) ✓ collapsible result ("${ops.gist.slice(0, 40)}…") ✓ SAVE AS STUDY${ops.read ? " + READ" : ""} ✓`);

  // ── 8 · hygiene ──
  const mockStats = await page.evaluate(() => window.__mock && { calls: window.__mock.calls, unmatched: window.__mock.unmatched });
  log("mock stats:", JSON.stringify(mockStats));
  if (jsErrors.length) fail("JS errors", jsErrors);
  log("PASS");
} finally {
  await browser.close();
}
