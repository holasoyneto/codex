# CODEX — Browser Extension

Highlight any scripture reference on the web and look it up instantly in CODEX.

## What it does

1. **Right-click highlighted text** → "Look up '…' in CODEX" → opens the passage in CODEX (or shows a friendly hint if no reference is found).
2. **Toolbar popup** → type a passage (e.g. `John 3:16`, `1 Cor 13:4-7`, `Ps 23`) → opens CODEX, or peek the verse text inline without leaving the page.
3. **New-tab page** (optional, opt-in) → verse of the day, beautifully typeset, rotating daily from a curated set of 30 well-known passages.

The reference parser understands the full 66-book Protestant canon plus common deuterocanonicals (Tobit, Judith, Wisdom, Sirach, Baruch, 1–2 Maccabees), plus dozens of abbreviation variants (Gn / Gen / Genesis, Jn / Jhn / John, 1 Cor / 1Cor / I Cor, etc.).

## Install (developer mode)

### Chrome / Edge / Brave / Arc

1. Open `chrome://extensions`
2. Toggle **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select this `extension/` directory
5. Pin the CODEX icon to your toolbar

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `extension/manifest.json`

Firefox has full MV3 support as of v115+. The same manifest works on both browsers.

### Safari (macOS)

Safari Web Extensions require an Xcode wrapper. Use Apple's converter:

```sh
xcrun safari-web-extension-converter ./extension
```

Then build & sign the generated Xcode project to load it into Safari.

## Disabling the new-tab override

Some users find new-tab overrides invasive. If you'd rather keep your browser's default new tab:

- **Quick fix:** delete the `chrome_url_overrides` block from `manifest.json` and reload the extension.
- **Or:** rename the bundled `manifest-newtab.json` → `manifest.json` (it's the same extension minus the override). This is the variant we recommend submitting to the Chrome Web Store.

## Submission to stores (high-level)

Actual submission is a human task. In brief:

- **Chrome Web Store** — zip the directory, upload at `https://chrome.google.com/webstore/devconsole`, pay the $5 dev fee, fill out the listing. Review usually 1–3 business days.
- **Firefox AMO** — sign and upload at `https://addons.mozilla.org/developers/`. Self-distribution requires AMO signing.
- **Safari** — convert via `safari-web-extension-converter`, distribute through the Mac App Store or via a notarized standalone app.

Use the no-newtab-override variant (`manifest-newtab.json`) for store submissions — store reviewers tend to flag new-tab overrides as a policy concern, and end users can install the override variant by sideloading.

## Privacy

This extension collects **no data**, runs **no analytics**, and ships **no trackers**.

Network requests are made only to:

- `bible-api.com` — when you click "Peek verse" in the popup, or to fetch the verse-of-the-day on the new-tab page. (Public Bible verse API.)
- `codex.app` — when you click through to open a passage in CODEX itself.

All other state (recent lookups, last detected selection) lives in your browser's local `chrome.storage.local`. Nothing is ever sent anywhere else.

## License

Follows the parent CODEX project's license. (See the repository root.) If the parent project has no explicit license, this extension is released under the MIT License.

## Architecture notes

| File | Purpose |
| --- | --- |
| `manifest.json` | MV3 manifest, Chrome + Edge + Firefox compatible. |
| `manifest-newtab.json` | Variant without the new-tab override (store-submission). |
| `background.js` | Service worker — context menu registration + message routing. |
| `content.js` | Content script — detects scripture refs in current selection on `mouseup`, stashes for popup. |
| `ref-parser.js` | Pure-JS scripture-reference parser. Loaded by content script, service worker, popup, and new-tab page. |
| `popup.html` / `.js` / `.css` | Toolbar popup UI. |
| `newtab.html` / `.js` / `.css` | Optional verse-of-the-day new-tab page. |
| `icons/icon.svg` | Extension icon (same glyph as the CODEX app). |

The ref parser is exposed both as `window.CODEX_REF_PARSER` (for classic scripts) and as a CommonJS module (for tests).
