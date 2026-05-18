/* CODEX new-tab page — verse of the day rotation. */
(function () {
  'use strict';

  // 30 well-known verses to rotate through. Day-of-year mod 30.
  const POOL = [
    'john 3:16', 'psalms 23:1', 'genesis 1:1', 'romans 8:28', 'philippians 4:13',
    'jeremiah 29:11', 'isaiah 40:31', 'matthew 6:33', 'proverbs 3:5-6', 'joshua 1:9',
    '1 corinthians 13:4-7', 'galatians 5:22-23', 'psalms 46:10', 'isaiah 41:10',
    'matthew 28:19-20', 'john 14:6', 'romans 12:2', 'ephesians 2:8-9',
    '2 timothy 1:7', 'hebrews 11:1', 'james 1:5', '1 peter 5:7',
    'psalms 119:105', 'micah 6:8', 'lamentations 3:22-23',
    'matthew 5:14-16', 'colossians 3:23', 'deuteronomy 31:6',
    'revelation 21:4', 'psalms 27:1'
  ];

  function pickVerse() {
    const start = new Date(new Date().getFullYear(), 0, 0);
    const doy = Math.floor((Date.now() - start) / 86400000);
    return POOL[doy % POOL.length];
  }

  async function load() {
    const raw = pickVerse();
    const ref = window.CODEX_REF_PARSER.firstRef(raw);
    if (!ref) return;
    document.getElementById('vod-ref').textContent = ref.rawText;
    const link = document.getElementById('vod-link');
    link.href = window.CODEX_REF_PARSER.codexUrl(ref);
    try {
      const r = await fetch(window.CODEX_REF_PARSER.bibleApiUrl(ref));
      const data = await r.json();
      document.getElementById('vod-text').textContent = (data.text || '').trim();
      if (data.reference) document.getElementById('vod-ref').textContent = data.reference;
    } catch (e) {
      document.getElementById('vod-text').textContent = '(Offline — open CODEX to read this verse.)';
    }
  }

  document.getElementById('quick-lookup').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = document.getElementById('ref-input').value;
    const ref = window.CODEX_REF_PARSER.firstRef(val);
    location.href = ref ? window.CODEX_REF_PARSER.codexUrl(ref) : ('https://codex.app/?q=' + encodeURIComponent(val));
  });

  load();
})();
