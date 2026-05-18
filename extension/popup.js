/* CODEX popup logic. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const input = $('ref-input');
  const form = $('lookup-form');
  const preview = $('preview');
  const recentsList = $('recents-list');
  const peekBtn = $('peek-btn');

  init();

  async function init() {
    // Prefill from last detected selection (within last 10 min).
    try {
      const { lastSelection, recents = [] } = await chrome.storage.local.get(['lastSelection', 'recents']);
      if (lastSelection && Date.now() - lastSelection.ts < 10 * 60 * 1000) {
        if (lastSelection.parsed) {
          input.value = lastSelection.parsed.rawText || lastSelection.text;
        } else if (lastSelection.text) {
          // No parse — show friendly hint.
          showPreview(`No scripture reference found in “${trunc(lastSelection.text, 60)}”. Try typing one above.`, 'warn');
        }
      }
      renderRecents(recents);
    } catch (e) { /* storage may be unavailable in some contexts */ }

    input.focus();
    input.select();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ref = window.CODEX_REF_PARSER.firstRef(input.value);
    if (!ref) {
      showPreview('Could not parse that as a scripture reference.', 'warn');
      return;
    }
    pushRecent(ref);
    chrome.tabs.create({ url: window.CODEX_REF_PARSER.codexUrl(ref) });
    window.close();
  });

  peekBtn.addEventListener('click', async () => {
    const ref = window.CODEX_REF_PARSER.firstRef(input.value);
    if (!ref) { showPreview('Type a reference first.', 'warn'); return; }
    showPreview('Loading…', '');
    try {
      const url = window.CODEX_REF_PARSER.bibleApiUrl(ref);
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      const text = (data.text || '').trim();
      showPreview(
        `<strong>${escapeHtml(data.reference || ref.rawText)}</strong><br>${escapeHtml(text)}<br><small>${escapeHtml(data.translation_name || '')}</small>`,
        'ok',
        true
      );
    } catch (err) {
      showPreview('Could not fetch verse: ' + err.message, 'warn');
    }
  });

  function renderRecents(recents) {
    recentsList.innerHTML = '';
    if (!recents.length) {
      recentsList.innerHTML = '<li class="empty">No recent lookups yet.</li>';
      return;
    }
    for (const r of recents) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = r.rawText || r.normalized;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: window.CODEX_REF_PARSER.codexUrl(r.normalized) });
        window.close();
      });
      li.appendChild(a);
      recentsList.appendChild(li);
    }
  }

  async function pushRecent(ref) {
    try {
      const { recents = [] } = await chrome.storage.local.get('recents');
      const entry = { normalized: ref.normalized, rawText: ref.rawText, ts: Date.now() };
      const deduped = [entry, ...recents.filter(r => r.normalized !== ref.normalized)].slice(0, 5);
      await chrome.storage.local.set({ recents: deduped });
    } catch (_) {}
  }

  function showPreview(html, kind, isHtml) {
    preview.className = 'preview ' + (kind || '');
    preview.classList.remove('hidden');
    if (isHtml) preview.innerHTML = html; else preview.textContent = html;
  }
  function trunc(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();
