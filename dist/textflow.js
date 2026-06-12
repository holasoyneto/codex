// GENERATED from textflow.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
// CODEX — textflow.jsx · v10 OPEN ANYTHING — the workflow for texts the
// canon shelf can't serve.
//
// Surfaces all over CODEX cite texts that are not Bible chapters: Talmud
// dapim (daf-yomi plan, Jewish-study panel), Mishnah, Zohar. Clicking them
// used to go nowhere — "many texts clicked can't even be read". Now:
//
//   window.codexOpenText(spec)
//     "talmud.Berakhot.2a" / "Berakhot 2a" → a floating TEXT window,
//       fetched live from Sefaria (CC) with Hebrew + English side by side
//     anything parseable as a Bible ref     → window.codexJumpToRef
//       (the rebuilt reader's source-resolution workflow takes it from
//        there — apocrypha and Greek additions included)
//
// The window mimics the MONAD chrome (cx-win-backdrop/cx-win) so wm.js
// gives it drag / resize / snap / a dock chip for free.

const TEXTFLOW_TRACTATES = [
"Berakhot", "Shabbat", "Eruvin", "Pesachim", "Shekalim", "Yoma", "Sukkah", "Beitzah",
"Rosh Hashanah", "Taanit", "Megillah", "Moed Katan", "Chagigah", "Yevamot", "Ketubot",
"Nedarim", "Nazir", "Sotah", "Gittin", "Kiddushin", "Bava Kamma", "Bava Metzia",
"Bava Batra", "Sanhedrin", "Makkot", "Shevuot", "Avodah Zarah", "Horayot", "Zevachim",
"Menachot", "Chullin", "Bekhorot", "Arakhin", "Temurah", "Keritot", "Meilah", "Tamid",
"Niddah"];


// Normalize "talmud.Berakhot.2a" / "Berakhot 2a" / "berakhot.2a" → Sefaria tref.
function textflowParse(spec) {
  const s = String(spec || "").trim();
  if (!s) return null;
  const cleaned = s.replace(/^talmud[.\s]+/i, "").replace(/[.\s]+/g, " ").trim();
  const m = cleaned.match(/^(.+?)\s+(\d+[ab]?)$/i);
  if (m) {
    const name = m[1].toLowerCase();
    const tractate = TEXTFLOW_TRACTATES.find((t) => t.toLowerCase() === name) ||
    TEXTFLOW_TRACTATES.find((t) => t.toLowerCase().startsWith(name));
    if (tractate) return { kind: "sefaria", tref: `${tractate}.${m[2]}`, label: `${tractate} ${m[2]}` };
  }
  if (/^talmud\b/i.test(s)) return null; // talmud-shaped but unparseable
  return { kind: "bible", ref: s };
}

function TextWindow({ win, onClose }) {
  const [state, setState] = useState({ loading: true, err: null, en: [], he: [], title: win.label });
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const r = await fetch(`https://www.sefaria.org/api/texts/${encodeURIComponent(win.tref)}?context=0&commentary=0`);
        if (!r.ok) throw new Error(`Sefaria ${r.status}`);
        const d = await r.json();
        if (dead) return;
        const arr = (x) => Array.isArray(x) ? x.flat(2).filter(Boolean) : x ? [x] : [];
        setState({
          loading: false, err: null,
          en: arr(d.text), he: arr(d.he),
          title: d.ref || win.label
        });
      } catch (e) {
        if (!dead) setState((s) => ({ ...s, loading: false, err: String(e.message || e) }));
      }
    })();
    return () => {dead = true;};
  }, [win.tref]);

  const strip = (h) => String(h || "").replace(/<[^>]+>/g, "");
  const n = Math.max(state.en.length, state.he.length);

  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-win-backdrop", "data-wm-id": `win:text:${win.tref}`, "data-wm-glyph": "\u2138" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-win cxt-win" }, /*#__PURE__*/
    React.createElement("header", { className: "cx-win-h" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-win-h-glyph", "aria-hidden": true }, "\u2138"), /*#__PURE__*/
    React.createElement("span", { className: "cx-win-h-title" }, state.title), /*#__PURE__*/
    React.createElement("span", { className: "cx-win-h-ctx" }, "TALMUD"), /*#__PURE__*/
    React.createElement("button", { className: "cx-win-x", onClick: () => onClose(win), "aria-label": "Close", title: "Close" }, "\xD7")
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-win-body cxt-body" }, /*#__PURE__*/
    React.createElement("div", { className: "cxt-banner", role: "note" }, "\u2138 LIVE FROM SEFARIA.ORG \xB7 COMMUNITY TRANSLATION \xB7 NOT BUNDLED \u2014 VERIFY AGAINST A PRINTED DAF"),
    state.loading ? /*#__PURE__*/
    React.createElement("div", { className: "cxt-status" }, /*#__PURE__*/React.createElement("span", { className: "cxr-pulse", "aria-hidden": true }), "UNROLLING ", win.label.toUpperCase(), "\u2026") :
    state.err ? /*#__PURE__*/
    React.createElement("div", { className: "cxt-status is-err" }, /*#__PURE__*/
    React.createElement("b", null, "THE SCROLL IS SEALED"), /*#__PURE__*/
    React.createElement("code", null, state.err), /*#__PURE__*/
    React.createElement("span", null, "Sefaria needs a live connection \u2014 check the network and reopen.")
    ) : /*#__PURE__*/

    React.createElement("div", { className: "cxt-scroll" },
    Array.from({ length: n }, (_, i) => /*#__PURE__*/
    React.createElement("div", { key: i, className: "cxt-seg" },
    state.he[i] ? /*#__PURE__*/React.createElement("p", { className: "cxt-he", dir: "rtl", lang: "he" }, strip(state.he[i])) : null,
    state.en[i] ? /*#__PURE__*/React.createElement("p", { className: "cxt-en" }, strip(state.en[i])) : null
    )
    ),
    !n ? /*#__PURE__*/React.createElement("div", { className: "cxt-status" }, "Sefaria returned an empty section for ", win.label, ".") : null
    )

    )
    )
    ));

}

function TextFlowRoot() {
  const [wins, setWins] = useState([]);
  useEffect(() => {
    window.codexOpenText = (spec) => {
      const parsed = textflowParse(spec);
      if (!parsed) {
        try {window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: `Can't resolve "${spec}" to a readable text`, kind: "warn" } }));} catch {}
        return false;
      }
      if (parsed.kind === "bible") {
        if (window.codexJumpToRef) window.codexJumpToRef(parsed.ref);
        return true;
      }
      setWins((prev) => prev.some((w) => w.tref === parsed.tref) ? prev : [...prev, parsed]);
      return true;
    };
    return () => {delete window.codexOpenText;};
  }, []);
  const close = (win) => setWins((prev) => prev.filter((w) => w.tref !== win.tref));
  return /*#__PURE__*/React.createElement(React.Fragment, null, wins.map((w) => /*#__PURE__*/React.createElement(TextWindow, { key: w.tref, win: w, onClose: close })));
}

(function mountTextflow() {
  if (typeof document === "undefined") return;
  const go = () => {
    try {
      const el = document.createElement("div");
      el.id = "cx-textflow";
      document.body.appendChild(el);
      ReactDOM.createRoot(el).render(/*#__PURE__*/React.createElement(TextFlowRoot, null));
    } catch (e) {/* never break boot */}
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go, { once: true });else
  go();
})();

Object.assign(window, { TextFlowRoot, textflowParse });
})();
