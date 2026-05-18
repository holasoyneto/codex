// builder.jsx
// CODEX — Phase 2.5 Sermon / Study Builder.
//
// A clipboard-meets-outline tool for sermon prep. Users drop verses, notes,
// panel excerpts, and cross-refs into named sections, then export as
// Markdown, PDF (via print), or a shareable URL hash.
//
// Self-registers as the "sermon-builder" plugin — adds a STUDIES right-rail
// tab and an "Add to Study" verse-menu action. Other panels can dispatch a
// `codex:add-to-study` CustomEvent with `{ type, ... }` payload to append
// to the active study.
//
// State lives in localStorage at codex.studies.v1.

(function () {
  if (typeof window === "undefined") return;
  const { useState, useEffect, useMemo, useCallback, useRef } = React;

  const LS_KEY = "codex.studies.v1";

  // ── ULID-ish (timestamp + random suffix; good enough for local ids) ──
  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  // ── Persistence ─────────────────────────────────────────────────────
  function loadStore() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return { studies: [], activeStudyId: null };
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.studies)) return { studies: [], activeStudyId: null };
      return parsed;
    } catch {
      return { studies: [], activeStudyId: null };
    }
  }
  function saveStore(s) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) { console.warn("studies: save failed", e); }
  }

  // ── Book lookup for verse formatting ────────────────────────────────
  function bookName(bookId) {
    try {
      const books = (window.CODEX_DATA && window.CODEX_DATA.books) || [];
      const b = books.find((x) => x.id === bookId);
      return b ? b.name : bookId;
    } catch { return bookId; }
  }
  function formatRef(ref) {
    if (!ref || typeof ref !== "string") return ref || "";
    const [bid, ch, v] = ref.split(".");
    if (!bid || !ch) return ref;
    return `${bookName(bid)} ${ch}${v ? ":" + v : ""}`;
  }

  // ── Module-level event bus so the panel-less importer (URL hash) and
  //    inflight verseAction dispatches both find the store ──────────────
  function makeEmptyStudy(title) {
    const now = Date.now();
    return {
      id: uid("study"),
      title: title || "Untitled study",
      created: now,
      modified: now,
      sections: [{ id: uid("section"), heading: "I. ", items: [] }],
    };
  }

  // Apply a study object to the store (for URL imports).
  function importStudyObject(studyObj) {
    if (!studyObj || !Array.isArray(studyObj.sections)) return false;
    const store = loadStore();
    // Re-id to avoid collisions
    const copy = {
      ...studyObj,
      id: uid("study"),
      created: Date.now(),
      modified: Date.now(),
      sections: studyObj.sections.map((s) => ({
        id: uid("section"),
        heading: s.heading || "",
        items: Array.isArray(s.items) ? s.items.slice() : [],
      })),
    };
    store.studies.push(copy);
    store.activeStudyId = copy.id;
    saveStore(store);
    window.dispatchEvent(new CustomEvent("codex:studies-changed"));
    return true;
  }

  // ── URL-hash import on load ─────────────────────────────────────────
  function tryImportFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const enc = params.get("study");
      if (!enc) return;
      const json = decodeURIComponent(escape(atob(enc)));
      const obj = JSON.parse(json);
      if (importStudyObject(obj)) {
        // Strip the param so it doesn't re-import on next reload.
        params.delete("study");
        const next = window.location.pathname + (params.toString() ? "?" + params.toString() : "") + window.location.hash;
        window.history.replaceState({}, "", next);
      }
    } catch (e) { console.warn("studies: URL import failed", e); }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryImportFromUrl, { once: true });
  } else { tryImportFromUrl(); }

  // ── External event listener — appends to active study even when the
  //    panel isn't mounted, so verse-menu / panel buttons always work ──
  window.addEventListener("codex:add-to-study", (ev) => {
    const item = ev && ev.detail;
    if (!item || !item.type) return;
    const store = loadStore();
    let study = store.studies.find((s) => s.id === store.activeStudyId);
    if (!study) {
      study = makeEmptyStudy("New study");
      store.studies.push(study);
      store.activeStudyId = study.id;
    }
    if (study.sections.length === 0) {
      study.sections.push({ id: uid("section"), heading: "Notes", items: [] });
    }
    const last = study.sections[study.sections.length - 1];
    last.items.push({ ...item, _id: uid("item") });
    study.modified = Date.now();
    saveStore(store);
    window.dispatchEvent(new CustomEvent("codex:studies-changed"));
    // Brief toast
    try {
      const t = document.createElement("div");
      t.className = "cx-builder-toast";
      t.textContent = `Added to “${study.title}”`;
      document.body.appendChild(t);
      setTimeout(() => t.classList.add("cx-builder-toast--in"), 10);
      setTimeout(() => { t.classList.remove("cx-builder-toast--in"); setTimeout(() => t.remove(), 400); }, 1800);
    } catch {}
  });

  // ── Markdown export ─────────────────────────────────────────────────
  function studyToMarkdown(study) {
    if (!study) return "";
    const lines = [`# ${study.title || "Untitled study"}`, ""];
    for (const sec of study.sections) {
      lines.push(`## ${sec.heading || ""}`, "");
      for (const it of sec.items) {
        if (it.type === "verse") {
          lines.push(`> **${formatRef(it.ref)}** ${it.translation ? `*(${String(it.translation).toUpperCase()})*` : ""}`);
          lines.push(`> ${String(it.text || "").trim()}`, "");
        } else if (it.type === "note") {
          lines.push(String(it.body || "").trim(), "");
        } else if (it.type === "panel") {
          lines.push(`**${it.kind || "Panel"}${it.source ? " — " + formatRef(it.source) : ""}:** ${String(it.body || "").trim()}`, "");
        } else if (it.type === "crossref") {
          lines.push(`- ↗ **${formatRef(it.ref)}**${it.note ? " — " + it.note : ""}`);
        }
      }
      lines.push("");
    }
    return lines.join("\n");
  }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
  }

  function shareUrlFor(study) {
    // utf8-safe base64
    const json = JSON.stringify({
      title: study.title,
      sections: study.sections.map((s) => ({ heading: s.heading, items: s.items })),
    });
    const enc = btoa(unescape(encodeURIComponent(json)));
    const u = new URL(window.location.href);
    u.search = "?study=" + enc;
    u.hash = "";
    return u.toString();
  }

  // ── React component ─────────────────────────────────────────────────
  function BuilderPanel(ctx) {
    const [store, setStore] = useState(() => loadStore());
    const fileInputRef = useRef(null);
    const dropZoneRef = useRef(null);

    // Listen for external changes (event-driven appends).
    useEffect(() => {
      const h = () => setStore(loadStore());
      window.addEventListener("codex:studies-changed", h);
      window.addEventListener("storage", h);
      return () => {
        window.removeEventListener("codex:studies-changed", h);
        window.removeEventListener("storage", h);
      };
    }, []);

    const update = useCallback((mutator) => {
      setStore((prev) => {
        const next = JSON.parse(JSON.stringify(prev));
        mutator(next);
        saveStore(next);
        return next;
      });
    }, []);

    const active = store.studies.find((s) => s.id === store.activeStudyId) || null;

    // ── Study CRUD ──
    const newStudy = () => update((s) => {
      const st = makeEmptyStudy(`Study ${s.studies.length + 1}`);
      s.studies.push(st); s.activeStudyId = st.id;
    });
    const switchTo = (id) => update((s) => { s.activeStudyId = id; });
    const deleteStudy = (id) => {
      if (!confirm("Delete this study? This can't be undone.")) return;
      update((s) => {
        s.studies = s.studies.filter((x) => x.id !== id);
        if (s.activeStudyId === id) s.activeStudyId = s.studies[0] ? s.studies[0].id : null;
      });
    };
    const renameStudy = (id, title) => update((s) => {
      const st = s.studies.find((x) => x.id === id);
      if (st) { st.title = title; st.modified = Date.now(); }
    });

    // ── Section / item ops ──
    const addSection = () => update((s) => {
      const st = s.studies.find((x) => x.id === s.activeStudyId);
      if (!st) return;
      const n = st.sections.length + 1;
      const roman = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][n-1] || String(n);
      st.sections.push({ id: uid("section"), heading: `${roman}. `, items: [] });
      st.modified = Date.now();
    });
    const removeSection = (sid) => update((s) => {
      const st = s.studies.find((x) => x.id === s.activeStudyId);
      if (!st) return;
      st.sections = st.sections.filter((x) => x.id !== sid);
      st.modified = Date.now();
    });
    const renameSection = (sid, heading) => update((s) => {
      const st = s.studies.find((x) => x.id === s.activeStudyId);
      const sec = st && st.sections.find((x) => x.id === sid);
      if (sec) { sec.heading = heading; st.modified = Date.now(); }
    });
    const addNote = (sid) => update((s) => {
      const st = s.studies.find((x) => x.id === s.activeStudyId);
      const sec = st && st.sections.find((x) => x.id === sid);
      if (sec) { sec.items.push({ type: "note", body: "New note — click to edit", _id: uid("item") }); st.modified = Date.now(); }
    });
    const addVerseFromContext = (sid) => {
      if (!ctx || !ctx.bookId || !ctx.chapter) { alert("No active verse — tap a verse in the reader first."); return; }
      const v = ctx.verse || 1;
      let text = "";
      let translation = ctx.translation || "kjv";
      try {
        if (window.BIBLE && typeof window.BIBLE.getCachedChapter === "function") {
          const ch = window.BIBLE.getCachedChapter(ctx.bookId, ctx.chapter, translation);
          if (ch && Array.isArray(ch.verses)) {
            const vv = ch.verses.find((x) => x.n === v);
            if (vv) text = (vv[translation] || vv.text || "").trim();
          }
        }
      } catch {}
      update((s) => {
        const st = s.studies.find((x) => x.id === s.activeStudyId);
        const sec = st && st.sections.find((x) => x.id === sid);
        if (sec) {
          sec.items.push({ type: "verse", ref: `${ctx.bookId}.${ctx.chapter}.${v}`, text, translation, _id: uid("item") });
          st.modified = Date.now();
        }
      });
    };
    const removeItem = (sid, idx) => update((s) => {
      const st = s.studies.find((x) => x.id === s.activeStudyId);
      const sec = st && st.sections.find((x) => x.id === sid);
      if (sec) { sec.items.splice(idx, 1); st.modified = Date.now(); }
    });
    const editItem = (sid, idx, patch) => update((s) => {
      const st = s.studies.find((x) => x.id === s.activeStudyId);
      const sec = st && st.sections.find((x) => x.id === sid);
      if (sec && sec.items[idx]) { Object.assign(sec.items[idx], patch); st.modified = Date.now(); }
    });

    // ── Drag and drop reordering ──
    const dragRef = useRef(null);
    const onSectionDragStart = (sid) => (e) => {
      dragRef.current = { kind: "section", sid };
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", sid); } catch {}
    };
    const onSectionDrop = (targetSid) => (e) => {
      e.preventDefault();
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag || drag.kind !== "section" || drag.sid === targetSid) return;
      update((s) => {
        const st = s.studies.find((x) => x.id === s.activeStudyId);
        if (!st) return;
        const from = st.sections.findIndex((x) => x.id === drag.sid);
        const to = st.sections.findIndex((x) => x.id === targetSid);
        if (from < 0 || to < 0) return;
        const [m] = st.sections.splice(from, 1);
        st.sections.splice(to, 0, m);
        st.modified = Date.now();
      });
    };
    const onItemDragStart = (sid, idx) => (e) => {
      e.stopPropagation();
      dragRef.current = { kind: "item", sid, idx };
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", `${sid}:${idx}`); } catch {}
    };
    const onItemDrop = (targetSid, targetIdx) => (e) => {
      e.preventDefault(); e.stopPropagation();
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag || drag.kind !== "item") return;
      update((s) => {
        const st = s.studies.find((x) => x.id === s.activeStudyId);
        if (!st) return;
        const fromSec = st.sections.find((x) => x.id === drag.sid);
        const toSec = st.sections.find((x) => x.id === targetSid);
        if (!fromSec || !toSec) return;
        const [m] = fromSec.items.splice(drag.idx, 1);
        if (!m) return;
        const idx = Math.min(targetIdx, toSec.items.length);
        toSec.items.splice(idx, 0, m);
        st.modified = Date.now();
      });
    };
    const allowDrop = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };

    // ── File drop import ──
    useEffect(() => {
      const el = dropZoneRef.current;
      if (!el) return;
      const over = (e) => { e.preventDefault(); el.classList.add("cx-builder-dropactive"); };
      const leave = () => el.classList.remove("cx-builder-dropactive");
      const drop = async (e) => {
        e.preventDefault(); leave();
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (!f) return;
        try {
          const text = await f.text();
          const obj = JSON.parse(text);
          if (importStudyObject(obj)) setStore(loadStore());
          else alert("That file doesn't look like a CODEX study.");
        } catch { alert("Couldn't parse that file."); }
      };
      el.addEventListener("dragover", over);
      el.addEventListener("dragleave", leave);
      el.addEventListener("drop", drop);
      return () => {
        el.removeEventListener("dragover", over);
        el.removeEventListener("dragleave", leave);
        el.removeEventListener("drop", drop);
      };
    }, []);

    // ── Exports ──
    const exportMd = () => { if (active) download(`${(active.title || "study").replace(/[^\w\-]+/g,"_")}.md`, studyToMarkdown(active), "text/markdown"); };
    const exportJson = () => { if (active) download(`${(active.title || "study").replace(/[^\w\-]+/g,"_")}.codex-study`, JSON.stringify(active, null, 2), "application/json"); };
    const exportPdf = () => {
      if (!active) return;
      document.body.classList.add("cx-builder-printing");
      const cleanup = () => document.body.classList.remove("cx-builder-printing");
      window.addEventListener("afterprint", cleanup, { once: true });
      setTimeout(() => window.print(), 50);
    };
    const copyMd = async () => {
      if (!active) return;
      try { await navigator.clipboard.writeText(studyToMarkdown(active)); alert("Copied as Markdown."); }
      catch { alert("Clipboard not available."); }
    };
    const share = async () => {
      if (!active) return;
      const url = shareUrlFor(active);
      if (navigator.share) {
        try { await navigator.share({ title: active.title, url }); return; } catch {}
      }
      try { await navigator.clipboard.writeText(url); alert("Share URL copied to clipboard."); }
      catch { prompt("Share URL:", url); }
    };

    // ── Render ──
    return (
      <div className="cx-builder">
        <header className="cx-builder-hdr">
          <div className="cx-builder-titlerow">
            <span className="cx-builder-glyph">❡</span>
            <b>STUDIES</b>
            <button className="cx-builder-btn" onClick={newStudy} title="New study">+ New</button>
          </div>
          <div className="cx-builder-studylist">
            {store.studies.length === 0 ? (
              <div className="cx-builder-empty">No studies yet. Tap <b>+ New</b> to start.</div>
            ) : (
              store.studies.map((s) => (
                <div key={s.id} className={`cx-builder-studyrow ${s.id === store.activeStudyId ? "is-active" : ""}`}>
                  <button className="cx-builder-studybtn" onClick={() => switchTo(s.id)} title={`Switched to ${s.title}`}>
                    <span className="cx-builder-studytitle">{s.title}</span>
                    <span className="cx-builder-studymeta">
                      {s.sections.length} sec · {s.sections.reduce((n, x) => n + x.items.length, 0)} items
                    </span>
                  </button>
                  <button className="cx-builder-del" onClick={() => deleteStudy(s.id)} title="Delete study">×</button>
                </div>
              ))
            )}
          </div>
        </header>

        <div className="cx-builder-active" ref={dropZoneRef}>
          {!active ? (
            <div className="cx-builder-empty">
              Drop a <code>.codex-study</code> file here, or create a new study above.
            </div>
          ) : (
            <>
              <input
                className="cx-builder-title-input"
                value={active.title}
                onChange={(e) => renameStudy(active.id, e.target.value)}
                placeholder="Study title"
              />

              {active.sections.map((sec) => (
                <section
                  key={sec.id}
                  className="cx-builder-section"
                  draggable
                  onDragStart={onSectionDragStart(sec.id)}
                  onDragOver={allowDrop}
                  onDrop={onSectionDrop(sec.id)}
                >
                  <div className="cx-builder-sechead">
                    <span className="cx-builder-grip" title="Drag to reorder section">⋮⋮</span>
                    <input
                      className="cx-builder-heading-input"
                      value={sec.heading}
                      onChange={(e) => renameSection(sec.id, e.target.value)}
                      placeholder="Section heading"
                    />
                    <button className="cx-builder-del" onClick={() => removeSection(sec.id)} title="Remove section">×</button>
                  </div>

                  <ul className="cx-builder-items">
                    {sec.items.length === 0 ? (
                      <li className="cx-builder-empty cx-builder-itemempty"
                          onDragOver={allowDrop} onDrop={onItemDrop(sec.id, 0)}>
                        Empty — drop items here, or use the buttons below.
                      </li>
                    ) : sec.items.map((it, idx) => (
                      <li
                        key={it._id || idx}
                        className={`cx-builder-item cx-builder-item--${it.type}`}
                        draggable
                        onDragStart={onItemDragStart(sec.id, idx)}
                        onDragOver={allowDrop}
                        onDrop={onItemDrop(sec.id, idx)}
                      >
                        <span className="cx-builder-grip" title="Drag to reorder">⋮⋮</span>
                        <div className="cx-builder-itembody">
                          {it.type === "verse" && (
                            <>
                              <span className="cx-builder-refbadge">{formatRef(it.ref)}</span>
                              {it.translation ? <span className="cx-builder-trbadge">{String(it.translation).toUpperCase()}</span> : null}
                              <div className="cx-builder-verse-text">{it.text || <em>(no text)</em>}</div>
                            </>
                          )}
                          {it.type === "note" && (
                            <textarea
                              className="cx-builder-note"
                              value={it.body || ""}
                              onChange={(e) => editItem(sec.id, idx, { body: e.target.value })}
                              placeholder="Note…"
                              rows={Math.min(8, Math.max(2, String(it.body || "").split("\n").length))}
                            />
                          )}
                          {it.type === "panel" && (
                            <>
                              <span className="cx-builder-kindbadge">{it.kind || "Panel"}</span>
                              {it.source ? <span className="cx-builder-srcbadge">{formatRef(it.source)}</span> : null}
                              <div className="cx-builder-panel-text">{it.body}</div>
                            </>
                          )}
                          {it.type === "crossref" && (
                            <>
                              <span className="cx-builder-refbadge">↗ {formatRef(it.ref)}</span>
                              <input
                                className="cx-builder-xrefnote"
                                value={it.note || ""}
                                onChange={(e) => editItem(sec.id, idx, { note: e.target.value })}
                                placeholder="(note)"
                              />
                            </>
                          )}
                        </div>
                        <button className="cx-builder-del" onClick={() => removeItem(sec.id, idx)} title="Remove item">×</button>
                      </li>
                    ))}
                  </ul>

                  <div className="cx-builder-sectools">
                    <button className="cx-builder-btn" onClick={() => addNote(sec.id)}>+ Note</button>
                    <button className="cx-builder-btn" onClick={() => addVerseFromContext(sec.id)} title="Add the current verse from the reader">+ Verse from current</button>
                  </div>
                </section>
              ))}

              <div className="cx-builder-addsec">
                <button className="cx-builder-btn" onClick={addSection}>+ Section</button>
              </div>

              <footer className="cx-builder-foot">
                <div className="cx-builder-exportrow">
                  <button className="cx-builder-btn" onClick={exportMd} title="Download Markdown">⇣ Markdown</button>
                  <button className="cx-builder-btn" onClick={exportPdf} title="Print to PDF">⇣ PDF</button>
                  <button className="cx-builder-btn" onClick={copyMd} title="Copy as Markdown">⧉ Copy</button>
                  <button className="cx-builder-btn" onClick={share} title="Share URL">↗ Share</button>
                  <button className="cx-builder-btn" onClick={exportJson} title="Export .codex-study">⇣ .codex-study</button>
                </div>
                <div className="cx-builder-hint">
                  Add verses via the verse menu’s <b>Add to Study</b>, or drop a <code>.codex-study</code> file onto this panel to import.
                </div>
              </footer>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Print-only container that mirrors the active study cleanly ──
  // When the user hits Export PDF we briefly add a body class; CSS hides
  // app chrome and reveals .cx-builder-printable holding the rendered study.
  // We inject/refresh that node on demand.
  function syncPrintable() {
    let node = document.getElementById("cx-builder-printable");
    if (!node) {
      node = document.createElement("div");
      node.id = "cx-builder-printable";
      document.body.appendChild(node);
    }
    const store = loadStore();
    const active = store.studies.find((s) => s.id === store.activeStudyId);
    if (!active) { node.innerHTML = ""; return; }
    const md = studyToMarkdown(active);
    // Light MD → HTML for print (paragraphs, headings, blockquotes, lists).
    const lines = md.split("\n");
    const out = [];
    let inList = false, inQuote = false;
    for (const ln of lines) {
      if (/^# /.test(ln))      { if (inList) { out.push("</ul>"); inList = false; } if (inQuote) { out.push("</blockquote>"); inQuote = false; } out.push(`<h1>${escapeHtml(ln.slice(2))}</h1>`); }
      else if (/^## /.test(ln)){ if (inList) { out.push("</ul>"); inList = false; } if (inQuote) { out.push("</blockquote>"); inQuote = false; } out.push(`<h2>${escapeHtml(ln.slice(3))}</h2>`); }
      else if (/^> /.test(ln)) { if (inList) { out.push("</ul>"); inList = false; } if (!inQuote) { out.push("<blockquote>"); inQuote = true; } out.push(`<div>${mdInline(ln.slice(2))}</div>`); }
      else if (/^- /.test(ln)) { if (inQuote) { out.push("</blockquote>"); inQuote = false; } if (!inList) { out.push("<ul>"); inList = true; } out.push(`<li>${mdInline(ln.slice(2))}</li>`); }
      else if (ln.trim() === ""){ if (inList) { out.push("</ul>"); inList = false; } if (inQuote) { out.push("</blockquote>"); inQuote = false; } out.push(""); }
      else                     { if (inList) { out.push("</ul>"); inList = false; } if (inQuote) { out.push("</blockquote>"); inQuote = false; } out.push(`<p>${mdInline(ln)}</p>`); }
    }
    if (inList) out.push("</ul>");
    if (inQuote) out.push("</blockquote>");
    node.innerHTML = out.join("\n");
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
  function mdInline(s) {
    return escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");
  }
  window.addEventListener("beforeprint", () => {
    if (document.body.classList.contains("cx-builder-printing")) syncPrintable();
  });

  // ── Plugin registration ─────────────────────────────────────────────
  function doRegister() {
    if (!window.CODEX_PLUGINS_API || typeof window.CODEX_PLUGINS_API.register !== "function") return false;
    return window.CODEX_PLUGINS_API.register({
      id: "sermon-builder",
      name: "Sermon & Study Builder",
      version: "1.0.0",
      panels: [{
        id: "builder",
        label: "STUDIES",
        glyph: "❡",
        render(ctx) { return React.createElement(BuilderPanel, ctx || {}); },
      }],
      verseActions: [{
        label: "Add to Study",
        icon: "❡",
        handler(verseRef) {
          // verseRef may be a string ("Book C:V") or context object.
          let detail;
          if (verseRef && typeof verseRef === "object" && verseRef.bookId) {
            const v = verseRef.verse || 1;
            let text = verseRef.text || "";
            const tr = verseRef.translation || "kjv";
            if (!text) {
              try {
                if (window.BIBLE && window.BIBLE.getCachedChapter) {
                  const ch = window.BIBLE.getCachedChapter(verseRef.bookId, verseRef.chapter, tr);
                  const vv = ch && ch.verses && ch.verses.find((x) => x.n === v);
                  if (vv) text = (vv[tr] || vv.text || "").trim();
                }
              } catch {}
            }
            detail = { type: "verse", ref: `${verseRef.bookId}.${verseRef.chapter}.${v}`, text, translation: tr };
          } else {
            detail = { type: "verse", ref: String(verseRef || ""), text: "", translation: "kjv" };
          }
          window.dispatchEvent(new CustomEvent("codex:add-to-study", { detail }));
        },
      }],
    });
  }
  if (!doRegister()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", doRegister, { once: true });
    } else {
      window.addEventListener("load", doRegister, { once: true });
    }
  }

  // Expose helpers for other modules / panels
  window.CODEX_StudyBuilder = {
    addItem: (item) => window.dispatchEvent(new CustomEvent("codex:add-to-study", { detail: item })),
    importStudy: importStudyObject,
    studyToMarkdown,
  };
})();
