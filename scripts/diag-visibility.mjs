// Diagnostic: capture what the USER actually sees when clicking the title and
// Cross-References — real screenshots + on-screen visibility geometry (not just
// DOM text). Saves PNGs to /tmp for inspection.
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.SMOKE_URL || "http://localhost:3000/";
const W = Number(process.env.W || 1280), H = Number(process.env.H || 860);
const log = (...a) => console.log("[diag]", ...a);

function geom() {
  // runs in page
  const vis = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return { sel, exists:false };
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const onScreen = r.width>0 && r.height>0 && r.right>0 && r.bottom>0 && r.left<innerWidth && r.top<innerHeight;
    return { sel, exists:true, x:Math.round(r.left), y:Math.round(r.top), w:Math.round(r.width), h:Math.round(r.height),
      display:cs.display, visibility:cs.visibility, opacity:cs.opacity, transform:cs.transform, zIndex:cs.zIndex, onScreen };
  };
  const app = document.querySelector(".cx-app");
  // what's at the center of where the right rail should be?
  const probe = (x,y) => { const e=document.elementFromPoint(x,y); return e? (e.tagName+'.'+(e.className||'').toString().split(' ').slice(0,2).join('.')).slice(0,50):'none'; };
  return {
    appClass: app ? app.className : "(no app)",
    grid: (()=>{const g=document.querySelector('.cx-grid');return g?getComputedStyle(g).gridTemplateColumns:'no grid';})(),
    scrim: vis(".cx-rail-scrim"),
    railR: vis(".cx-rail-r"),
    railL: vis(".cx-lib") .exists ? vis(".cx-lib") : vis(".cx-rail-l"),
    xrefPane: document.querySelector(".cx-xref-pane") ? vis(".cx-xref-pane") : { sel:".cx-xref-pane", exists:false },
    topCenterEl: probe(Math.round(innerWidth*0.5), Math.round(innerHeight*0.4)),
    rightAreaEl: probe(Math.round(innerWidth*0.85), Math.round(innerHeight*0.5)),
  };
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox","--disable-gpu","--disable-dev-shm-usage",`--window-size=${W},${H}`] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H });
  await page.goto(URL, { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(() => window.__CODEX_READY__ === true, { timeout: 45000 });
  await page.waitForFunction(() => document.querySelectorAll(".cx-verse,.cx-verse-row").length > 0, { timeout: 20000 });
  log(`booted ${W}x${H}`);

  await page.screenshot({ path: "/tmp/diag-1-initial.png" });
  log("initial geom:", JSON.stringify(await page.evaluate(geom), null, 1));

  // --- TITLE CLICK ---
  await page.evaluate(() => { const h=document.querySelector(".cx-reader-titles h1"); if(h) h.click(); });
  await new Promise(r=>setTimeout(r,800));
  await page.screenshot({ path: "/tmp/diag-2-title-click.png" });
  log("AFTER TITLE CLICK geom:", JSON.stringify(await page.evaluate(geom), null, 1));

  // reset: press Escape / click scrim to close
  await page.keyboard.press("Escape").catch(()=>{});
  await new Promise(r=>setTimeout(r,300));

  // --- OPEN VERSE MENU + CLICK CROSS-REFERENCES (real path) ---
  await page.evaluate(() => {
    const n=document.querySelector(".cx-vnum"); const r=n.getBoundingClientRect();
    n.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true,clientX:r.left+3,clientY:r.top+3}));
  });
  await new Promise(r=>setTimeout(r,400));
  await page.evaluate(() => {
    const rows=[].slice.call(document.querySelectorAll(".cx-vm-row"));
    const row=rows.find(b=>/cross-ref/i.test(b.textContent||"")); if(row) row.click();
  });
  await new Promise(r=>setTimeout(r,2500));
  await page.screenshot({ path: "/tmp/diag-3-crossref-click.png" });
  log("AFTER CROSS-REF CLICK geom:", JSON.stringify(await page.evaluate(geom), null, 1));

  log("screenshots: /tmp/diag-1-initial.png /tmp/diag-2-title-click.png /tmp/diag-3-crossref-click.png");
} finally {
  await browser.close();
}
