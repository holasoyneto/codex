// audit-darkmode.mjs — contrast + unskinned-text walk over every plugin
// panel (windowed) and the study deck builtins, in dark mode.
// Flags: WCAG contrast < 4.5 on body text (<3 on ≥18px), default-black text,
// serif leaks in chrome. Run: node scripts/audit-darkmode.mjs
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox","--disable-gpu"] });
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
await page.setViewport({ width: 1880, height: 1100 });
await page.goto("http://localhost:7777/", { waitUntil: "load", timeout: 30000 });
await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
await sleep(800);
await page.evaluate(() => {
  const tw = JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}");
  tw.autoTheme = false; tw.manualDark = true;
  localStorage.setItem("codex.tweaks.v1", JSON.stringify(tw));
});
await page.reload({ waitUntil: "load" });
await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
await sleep(1500);

const AUDIT_FN = `
function auditRegion(root, name) {
  const lum = ([r,g,b]) => { const f = c => { c/=255; return c<=0.03928? c/12.92 : Math.pow((c+0.055)/1.055,2.4); }; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
  const parse = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(",").map(Number); return { rgb: [p[0],p[1],p[2]], a: p.length>3? p[3] : 1 }; };
  const blend = (top, bot) => top.a >= 1 ? top.rgb : top.rgb.map((c,i) => Math.round(c*top.a + bot[i]*(1-top.a)));
  const bgOf = (el) => {
    let cur = el, acc = null;
    while (cur && cur !== document.documentElement) {
      const c = parse(getComputedStyle(cur).backgroundColor);
      if (c && c.a > 0) { acc = acc ? blend({rgb:acc.rgb,a:acc.a}, c.rgb) && acc : c; if (c.a >= 1) break; if (!acc) acc = c; }
      cur = cur.parentElement;
    }
    // composite remaining alpha over the page base (near-black starfield)
    const base = [8,10,16];
    if (!acc) return base;
    return acc.a >= 1 ? acc.rgb : blend(acc, base);
  };
  const out = [];
  const seen = new Set();
  root.querySelectorAll("*").forEach(el => {
    if (!el.checkVisibility || !el.checkVisibility()) return;
    const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join("");
    if (!txt || txt.length < 2) return;
    const cs = getComputedStyle(el);
    const col = parse(cs.color); if (!col) return;
    const bg = bgOf(el);
    const fg = col.a >= 1 ? col.rgb : col.rgb.map((c,i) => Math.round(c*col.a + bg[i]*(1-col.a)));
    const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
    const size = parseFloat(cs.fontSize);
    const big = size >= 18 || (size >= 14 && parseInt(cs.fontWeight) >= 700);
    const min = big ? 3 : 4.5;
    const key = el.className + "|" + Math.round(ratio*10);
    if (ratio < min && !seen.has(key)) {
      seen.add(key);
      out.push({ name, cls: String(el.className).slice(0,60), txt: txt.slice(0,40), ratio: Math.round(ratio*100)/100, size, color: cs.color, bg: "rgb("+bg.join(",")+")" });
    }
  });
  return out;
}
window.__auditRegion = auditRegion;
`;
await page.evaluate(AUDIT_FN);

const panels = await page.evaluate(() => (window.CODEX_PLUGINS_API?.getPanels?.() || []).map(p => ({ id: `plugin:${p.pluginId}:${p.id}`, glyph: p.glyph, label: p.label })));
console.log(`[audit] ${panels.length} plugin panels`);
let findings = [];
for (const p of panels) {
  await page.evaluate((p) => window.codexOpenWindow({ id: p.id, title: p.label || p.id, glyph: p.glyph }), p);
  await sleep(2200);
  const f = await page.evaluate((id) => {
    const bd = document.querySelector(`[data-wm-id="win:${id}"]`);
    return bd ? window.__auditRegion(bd, id) : [{ name: id, cls: "(window failed to open)", ratio: 0 }];
  }, p.id);
  findings.push(...f);
  await page.evaluate((id) => {
    const x = document.querySelector(`[data-wm-id="win:${id}"] .cx-win-x`);
    if (x) x.click();
  }, p.id);
  await sleep(300);
}
// study deck builtins
await page.evaluate(() => window.codexDesk.open("study"));
await sleep(1500);
const deckCards = await page.evaluate(() => [...document.querySelectorAll('[data-desk="sys:study"] [class*="deck"]')].length);
const deckF = await page.evaluate(() => {
  const bd = document.querySelector('[data-desk="sys:study"]');
  return bd ? window.__auditRegion(bd, "study-deck") : [];
});
findings.push(...deckF);
// library + reader chrome
for (const [id, open] of [["sys:library", true], ["sys:reader", false]]) {
  if (open) { await page.evaluate(() => window.codexDesk.open("library")); await sleep(1200); }
  const f = await page.evaluate((id) => {
    const bd = document.querySelector(`[data-desk="${id}"]`);
    return bd ? window.__auditRegion(bd, id) : [];
  }, id);
  findings.push(...f);
}
findings.sort((a,b) => a.ratio - b.ratio);
console.log(`[audit] ${findings.length} low-contrast findings`);
for (const f of findings.slice(0, 60)) console.log(JSON.stringify(f));
await browser.close();
