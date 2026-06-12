// GENERATED from oracle2.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
// CODEX — oracle2.jsx · v10 THE ORACLE — rebuilt from zero as its own
// plugin (sys-oracle), pulled out of the library rail.
//
// The old oracle was a 2,000-line chat appendix buried in a drawer. The
// rebuilt oracle is an INSTRUMENT bound to the reader:
//
//   · the BINDING — a live chip shows the verse the oracle is looking at
//     (window.CODEX_NOW); every invocation carries that context silently.
//   · INVOCATIONS — one-tap scholarly moves on the current verse:
//     ILLUMINATE (plain meaning) · CONTEXT (history/culture) · TONGUE
//     (Hebrew/Greek beneath the translation) · THREADS (cross-refs) ·
//     CONTRA (the strongest readings AGAINST the obvious one).
//   · honesty is load-bearing: a fixed banner names it an AI companion,
//     not scripture; answers are asked to cite chapter and verse, and the
//     refs in every answer are clickable — the reader is one tap away
//     from checking the oracle's work.
//
// Engine: POST /api/chat (same endpoint every AI surface uses), provider +
// model from the user's tweaks. Thread persists in codex.oracle.v10.

const ORACLE2_KEY = "codex.oracle.v10";
const ORACLE2_MAX = 40;

const ORACLE2_SYSTEM = `You are THE ORACLE — the scholarly companion inside CODEX, a Bible-study instrument.
Voice: precise, warm, unhurried. A careful scholar, never a preacher.
Rules:
- CITE chapter and verse (e.g. John 1:14) for every claim that has one.
- When traditions disagree, SAY SO and name the positions. Never present one side as settled.
- Hebrew/Greek: give the word in its own script + transliteration + gloss.
- Keep answers tight: 2-5 short paragraphs maximum. No filler, no emoji.
- You are not scripture and you say so when the line could blur.`;

const ORACLE2_INVOCATIONS = [
{ id: "illuminate", glyph: "✦", label: "ILLUMINATE", prompt: (ref) => `Illuminate ${ref}: the plain meaning in its immediate context, in your tight scholarly voice.` },
{ id: "context", glyph: "◔", label: "CONTEXT", prompt: (ref) => `Give the historical and cultural context a first-century (or original-era) hearer would bring to ${ref}.` },
{ id: "tongue", glyph: "א", label: "TONGUE", prompt: (ref) => `Take me beneath the translation of ${ref}: the key Hebrew or Greek words, their script, transliteration, range of meaning, and what the English flattens.` },
{ id: "threads", glyph: "❂", label: "THREADS", prompt: (ref) => `The strongest cross-references for ${ref} — where else the canon speaks to this, and what each thread adds. Cite each.` },
{ id: "contra", glyph: "⚖", label: "CONTRA", prompt: (ref) => `Steelman the readings AGAINST the obvious interpretation of ${ref}. The strongest scholarly objections and minority positions, fairly stated.` }];


function oracle2Load() {
  try {return JSON.parse(localStorage.getItem(ORACLE2_KEY) || "[]");} catch {return [];}
}
function oracle2Save(msgs) {
  try {localStorage.setItem(ORACLE2_KEY, JSON.stringify(msgs.slice(-ORACLE2_MAX)));} catch {}
}

// Linkify "Book C:V" references so every claim is checkable in one tap.
function Oracle2Refs({ text }) {
  const books = window.CODEX_DATA && window.CODEX_DATA.books || [];
  if (!books.length || !text) return text || null;
  const names = books.map((b) => b.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length);
  const re = new RegExp(`\\b(${names.join("|")})\\s+(\\d+)(?::(\\d+(?:[-–]\\d+)?))?`, "g");
  const out = [];
  let last = 0,m;
  while (m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const ref = m[0];
    out.push(/*#__PURE__*/
      React.createElement("a", { key: m.index, href: "#", className: "cxo-ref",
        onClick: (e) => {e.preventDefault();if (window.codexJumpToRef) window.codexJumpToRef(ref);} },
      ref
      )
    );
    last = m.index + ref.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : text;
}

function OracleX() {
  const [now, setNow] = useState(() => window.CODEX_NOW || {});
  const [msgs, setMsgs] = useState(oracle2Load);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const onNow = (e) => {const n = e.detail || window.CODEX_NOW;if (n && n.ref) setNow(n);};
    window.addEventListener("codex:now", onNow);
    return () => window.removeEventListener("codex:now", onNow);
  }, []);

  useEffect(() => {oracle2Save(msgs);}, [msgs]);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, busy]);

  // The binding: current verse text rides along as silent context.
  const contextBlock = () => {
    const n = window.CODEX_NOW;
    if (!n || !n.bookId) return "";
    let text = "";
    try {
      const tr = window.CODEX_DATA?.tweaks?.primaryTranslation || "web";
      const cached = window.BIBLE && window.BIBLE.getCachedChapter ?
      window.BIBLE.getCachedChapter(n.bookId, n.chapter, tr) : null;
      if (cached) {
        const v = cached.find((x) => x.n === n.verse);
        if (v) text = typeof v.text === "string" ? v.text : v[tr] || "";
      }
    } catch {}
    return `\n[READER CONTEXT — the user is at ${n.ref}${text ? `: “${text}”` : ""}]`;
  };

  const ask = (question) => {
    const q = String(question || "").trim();
    if (!q || busy) return;
    setErr(null);
    const userMsg = { role: "user", content: q, ref: now.ref || "", ts: Date.now() };
    const thread = [...msgs, userMsg];
    setMsgs(thread);
    setBusy(true);
    const tweaks = window.CODEX_DATA && window.CODEX_DATA.tweaks || {};
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: tweaks.provider,
        model: tweaks.model,
        system: ORACLE2_SYSTEM + contextBlock(),
        messages: thread.slice(-12).map((m) => ({ role: m.role === "oracle" ? "assistant" : "user", content: m.content })),
        max_tokens: 1200
      })
    }).
    then((r) => r.json()).
    then((d) => {
      if (d && d.text) setMsgs((t) => [...t, { role: "oracle", content: d.text.trim(), ts: Date.now() }]);else
      throw new Error(d && d.error || "the oracle returned silence");
    }).
    catch((e) => setErr(String(e.message || e))).
    finally(() => setBusy(false));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    ask(input);
    setInput("");
  };

  return (/*#__PURE__*/
    React.createElement("div", { className: "cxo" }, /*#__PURE__*/
    React.createElement("div", { className: "cxo-banner", role: "note" }, "\u25EC AI COMPANION \xB7 NOT SCRIPTURE \xB7 EVERY CITED REF IS ONE TAP FROM THE TEXT \u2014 CHECK ITS WORK"

    ), /*#__PURE__*/


    React.createElement("div", { className: "cxo-bind" }, /*#__PURE__*/
    React.createElement("span", { className: "cxo-bind-dot", "aria-hidden": true }), /*#__PURE__*/
    React.createElement("span", { className: "cxo-bind-lbl" }, "BOUND TO"), /*#__PURE__*/
    React.createElement("button", { className: "cxo-bind-ref",
      onClick: () => {if (now.ref && window.codexJumpToRef) window.codexJumpToRef(now.ref);},
      title: "The oracle reads over your shoulder \u2014 click to return there" },
    now.ref || "the reader"
    ),
    msgs.length ? /*#__PURE__*/
    React.createElement("button", { className: "cxo-clear", onClick: () => {setMsgs([]);oracle2Save([]);}, title: "Burn the thread" }, "CLEAR") :
    null
    ), /*#__PURE__*/


    React.createElement("div", { className: "cxo-invoke", role: "toolbar", "aria-label": "Invocations" },
    ORACLE2_INVOCATIONS.map((inv) => /*#__PURE__*/
    React.createElement("button", { key: inv.id, className: "cxo-inv", disabled: busy || !now.ref,
      onClick: () => ask(inv.prompt(now.ref)),
      title: inv.prompt(now.ref || "the current verse") }, /*#__PURE__*/
    React.createElement("i", { "aria-hidden": true }, inv.glyph), inv.label
    )
    )
    ), /*#__PURE__*/

    React.createElement("div", { className: "cxo-thread", ref: scrollRef, "aria-live": "polite" },
    !msgs.length && !busy ? /*#__PURE__*/
    React.createElement("div", { className: "cxo-empty" }, /*#__PURE__*/
    React.createElement("span", { "aria-hidden": true }, "\u25EC"), /*#__PURE__*/
    React.createElement("p", null, "The oracle waits. Invoke a move above, or ask anything about ", now.ref || "the text", ".")
    ) :
    null,
    msgs.map((m, i) => /*#__PURE__*/
    React.createElement("div", { key: i, className: `cxo-msg is-${m.role}` },
    m.role === "user" ? /*#__PURE__*/
    React.createElement(React.Fragment, null, /*#__PURE__*/
    React.createElement("span", { className: "cxo-msg-who" }, "YOU", m.ref ? ` · ${m.ref}` : ""), /*#__PURE__*/
    React.createElement("p", null, m.content)
    ) : /*#__PURE__*/

    React.createElement(React.Fragment, null, /*#__PURE__*/
    React.createElement("span", { className: "cxo-msg-who" }, "\u25EC ORACLE"),
    m.content.split(/\n{2,}/).map((p, j) => /*#__PURE__*/React.createElement("p", { key: j }, /*#__PURE__*/React.createElement(Oracle2Refs, { text: p })))
    )

    )
    ),
    busy ? /*#__PURE__*/
    React.createElement("div", { className: "cxo-msg is-oracle is-busy" }, /*#__PURE__*/
    React.createElement("span", { className: "cxo-msg-who" }, "\u25EC ORACLE"), /*#__PURE__*/
    React.createElement("p", { className: "cxo-consult" }, /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null), " consulting\u2026")
    ) :
    null,
    err ? /*#__PURE__*/
    React.createElement("div", { className: "cxo-err" }, /*#__PURE__*/
    React.createElement("b", null, "THE ORACLE IS DARK"), /*#__PURE__*/
    React.createElement("code", null, err)
    ) :
    null
    ), /*#__PURE__*/

    React.createElement("form", { className: "cxo-ask", onSubmit: onSubmit }, /*#__PURE__*/
    React.createElement("input", {
      ref: inputRef,
      value: input,
      onChange: (e) => setInput(e.target.value),
      placeholder: now.ref ? `Ask about ${now.ref}…` : "Ask the oracle…",
      "aria-label": "Ask the oracle",
      spellCheck: false,
      disabled: busy }
    ), /*#__PURE__*/
    React.createElement("button", { type: "submit", disabled: busy || !input.trim(), "aria-label": "Send" }, "\u2B90")
    )
    ));

}

(function registerOraclePlugin() {
  if (typeof window === "undefined") return;
  const reg = () => {
    if (!window.CODEX_PLUGINS_API) return false;
    return window.CODEX_PLUGINS_API.register({
      id: "sys-oracle",
      name: "The Oracle",
      version: "10.0.0",
      panels: [{
        id: "oracle",
        label: "ORACLE",
        glyph: "◬",
        render() {return React.createElement(OracleX);}
      }]
    });
  };
  if (!reg()) document.addEventListener("DOMContentLoaded", reg, { once: true });
})();

Object.assign(window, { OracleX });
})();
