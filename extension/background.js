/* CODEX background service worker (MV3). */
importScripts('ref-parser.js');

const MENU_ID = 'codex-lookup';
const CODEX_BASE = 'https://codex.app/';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Look up '%s' in CODEX",
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  const selection = (info.selectionText || '').trim();
  const ref = self.CODEX_REF_PARSER.firstRef(selection);
  if (ref) {
    await pushRecent(ref);
    chrome.tabs.create({ url: self.CODEX_REF_PARSER.codexUrl(ref) });
  } else {
    // No ref found — stash the raw selection so the popup can show a friendly message.
    await chrome.storage.local.set({
      lastSelection: { text: selection, ts: Date.now(), parsed: null }
    });
    // Best-effort: open the toolbar popup. Not all browsers support openPopup().
    if (chrome.action && chrome.action.openPopup) {
      try { await chrome.action.openPopup(); } catch (_) { /* user gesture required on some browsers */ }
    }
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'codex/parse') {
    const refs = self.CODEX_REF_PARSER.parse(msg.text || '');
    sendResponse({ refs });
    return true;
  }
  if (msg.type === 'codex/open') {
    chrome.tabs.create({ url: self.CODEX_REF_PARSER.codexUrl(msg.ref) });
    sendResponse({ ok: true });
    return true;
  }
});

async function pushRecent(ref) {
  const { recents = [] } = await chrome.storage.local.get('recents');
  const entry = { normalized: ref.normalized, rawText: ref.rawText, ts: Date.now() };
  const deduped = [entry, ...recents.filter(r => r.normalized !== ref.normalized)].slice(0, 5);
  await chrome.storage.local.set({ recents: deduped, lastSelection: { text: ref.rawText, ts: Date.now(), parsed: ref } });
}
