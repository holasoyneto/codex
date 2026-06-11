# NATIVE — the plan for real macOS and iOS apps

*Status: PLAN ONLY (2026-06-11). Nothing here is built yet. The web app
stays canonical; native shells wrap the same `dist/`.*

## Strategy in one line

**One codebase, three shells.** The PWA remains the source of truth;
macOS and iOS are thin native shells around the exact same front-end,
each buying real native capabilities (menu bar, widgets, Siri, Keychain,
App Store distribution) — never a rewrite.

## Stack decision

| Option | macOS | iOS | Verdict |
|---|---|---|---|
| **Tauri 2** | ✅ tiny (~10 MB), WKWebView, scaffold already in `src-tauri/` | ✅ stable since v2 (2024), Xcode target generated | **Recommended — one stack for both** |
| Capacitor | ⚠️ no real desktop story | ✅ most battle-tested web→App Store path, big plugin ecosystem | **Fallback for iOS** if Tauri's iOS plugins fall short |
| Swift WKWebView wrapper | ✅ | ✅ | Full control, but we'd own all bridge/update plumbing — last resort |
| Electron | ⚠️ 150 MB+, against the app's soul | ❌ | No |

The deciding facts: `src-tauri/` already exists (Tauri 2 schema,
`app.codex.bible`), Tauri uses the system WebView (no bundled Chromium —
fits "2026, not 1986"), and one Rust core serves both platforms.

## Phase N0 — readiness (web repo only, ships before any native code)

The PWA must run perfectly inside a WKWebView **without a service worker**
(WKWebView has no SW). Each item is small and benefits the web app too:

1. **Native detection + SW bypass** — `window.__TAURI__` (or Capacitor
   global) → skip `sw.js` registration entirely; assets come from disk,
   so FRESH's job is done by app updates. Keep version.js what's-new card.
   Verify boot-contract treats "no SW" as healthy (it should already —
   GH Pages first-load runs SW-less).
2. **Environment hygiene** — fix the stale `devUrl: 3000` → 7777;
   `beforeBuildCommand: "npm run build"`; audit for absolute `/` paths
   (GH Pages already forced relative — mostly done).
3. **Storage safety** — IDB + localStorage work in WKWebView, but iOS can
   evict under pressure. Mitigations: corpora bundles re-seed from the app
   package (already how bundles work); add explicit export/import of
   user data (marks, notes, studies) — also a good web feature.
4. **API-key custody** — today the Anthropic key sits in localStorage.
   Add a tiny adapter: native → OS Keychain (Tauri `keychain`/stronghold
   plugin); web → localStorage as today.

## Phase N1 — macOS (Tauri 2)

- **Window chrome**: transparent titlebar + overlay traffic lights so the
  starfield runs to the top edge — the PROPHET trace already left room.
  macOS close/minimize map to the real window; CODEX desk windows stay
  inside the canvas (the WM is part of the product, not a bug).
- **Native menu bar**: File / Go / Window menus mapped to existing APIs
  (`codexDesk`, `codexOpenOmni`, `codexJumpToRef`) — ⌘K, ⌘L (library),
  focus mode, next/prev chapter as first-class menu items with shortcuts.
- **Deep links**: register `codex://` (e.g. `codex://John.1.1`) → jumpToRef.
- **Dock**: streak count as dock badge; jump-back-in from dock menu.
- **Distribution**: notarized DMG from GitHub Actions first (free,
  immediate); Mac App Store later if wanted. Auto-update via
  tauri-plugin-updater pointed at GitHub Releases.

## Phase N2 — iOS (Tauri 2 iOS target; Capacitor fallback)

- Same `dist/`, mobile layout already exists and was just re-audited
  (44 px targets, safe areas, swipe nav, compact briefing).
- **App Review survival kit** (guideline 4.2 "minimum functionality" —
  the answer to "it's just a website"):
  - fully-offline scripture: WLC + SBLGNT + KJV bundles in the app package
  - **WidgetKit** verse-of-the-day + streak widget (port of `widget.html`)
  - **Siri Shortcuts / App Intents**: "Read today's chapter", "Continue reading"
  - native share sheet for verses/studies; haptics on verse actions
  - respect Dynamic Type for reader font scaling
- **Signing**: requires an Apple Developer account ($99/yr) — *user action*.
  TestFlight first, App Store after the widget + intents land.

## Phase N3 — store hygiene

- Privacy labels: trivially clean (no tracking, no accounts, local-first).
- Licensing screen: public-domain notices + **SBLGNT CC BY 4.0 attribution**
  (required), Charles 1913, bolls.life source credits.
- AI features in review: BYO-API-key is allowed but flag it in review
  notes; longer-term option is a tiny hosted proxy tier so the app works
  out of the box.

## Risks, honestly

1. **No SW in WKWebView** → covered by N0-1; nothing else depends on SW.
2. **iOS storage eviction** → bundles re-seed; export/import covers user data.
3. **Tauri-iOS plugin maturity** (widgets/intents need Swift anyway —
   they're native targets in the Xcode project regardless of wrapper) →
   if the bridge fights us, swap the iOS shell to Capacitor; `dist/`
   doesn't change.
4. **"Repackaged website" rejection** → the N2 survival kit is the defense;
   offline original-language corpora is a genuinely native-grade feature.

## Order of work (when we start)

N0 (readiness, ~1 session) → N1 (macOS DMG, ~1–2 sessions) →
N2 (iOS TestFlight, ~2–3 sessions + Apple account) → N3 (store polish).
macOS first: no review gatekeeper, immediate daily-driver value on the
Studio Display, and it forces N0 correctness that iOS then inherits.
