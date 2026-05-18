/* CODEX content script — lightweight: detect ref in current selection on click,
 * stash it so the popup can prefill. Future: hover tooltip.
 */
(function () {
  'use strict';
  if (!window.CODEX_REF_PARSER) return;

  let lastDetected = null;

  function readSelection() {
    const sel = window.getSelection && window.getSelection();
    return sel ? sel.toString().trim() : '';
  }

  function handle(eventName) {
    const text = readSelection();
    if (!text || text.length > 400) return;
    const ref = window.CODEX_REF_PARSER.firstRef(text);
    if (!ref) return;
    if (lastDetected && lastDetected.normalized === ref.normalized) return;
    lastDetected = ref;

    // Stash for the popup.
    try {
      chrome.storage && chrome.storage.local && chrome.storage.local.set({
        lastSelection: { text, ts: Date.now(), parsed: ref, source: eventName }
      });
    } catch (_) { /* extension context may be gone on SPA nav */ }

    // Dispatch a custom event so future on-page tooltips can subscribe.
    try {
      window.dispatchEvent(new CustomEvent('codex:ref-detected', { detail: ref }));
    } catch (_) {}
  }

  document.addEventListener('mouseup', () => handle('mouseup'), true);
  document.addEventListener('keyup', (e) => {
    // Ctrl/Cmd+C and arrow-key selection
    if (e.key === 'Shift' || e.shiftKey) handle('keyup');
  }, true);
})();
