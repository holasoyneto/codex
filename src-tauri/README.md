# CODEX Desktop (Tauri shell)

**Phase 5.5 v1 — Linux first.** macOS and Windows builds follow once Linux distribution channels are stable.

This directory wraps the existing CODEX web app (vanilla HTML / JSX / Node `server.js`) in a native Tauri 2.0 shell with a system tray icon, global hotkey, file associations, an auto-updater, and a sidecar Node process.

---

## Prerequisites

- **Rust** 1.75+ (`rustup install stable`)
- **Node.js** 20+ (used both at build time and as the runtime sidecar)
- **tauri-cli**: `cargo install tauri-cli --version "^2.0"`
- **Linux build deps** (Debian / Ubuntu):
  ```bash
  sudo apt install -y libwebkit2gtk-4.1-dev \
      build-essential curl wget file libxdo-dev \
      libssl-dev libayatana-appindicator3-dev librsvg2-dev \
      patchelf
  ```
- **Linux build deps** (Fedora):
  ```bash
  sudo dnf install -y webkit2gtk4.1-devel openssl-devel \
      curl wget file libappindicator-gtk3-devel librsvg2-devel \
      gcc-c++ make
  ```

---

## Replace the placeholder icons

`icons/icon.png` is a placeholder. Drop real PNGs in `icons/` at these sizes before the first release:

```
icons/32x32.png
icons/128x128.png
icons/128x128@2x.png   (256×256)
icons/icon.png         (512×512 — used by the tray)
icons/icon.ico         (Windows, future)
icons/icon.icns        (macOS, future)
```

`cargo tauri icon ../icon.svg` will regenerate all of these from the CODEX source SVG once a proper square master is provided.

---

## Develop

From `src-tauri/`:

```bash
cargo tauri dev
```

This runs `node ../server.js` via `beforeDevCommand` and loads `http://localhost:3000` in a native webview. The sidecar spawner is **skipped in dev** so you don't double-launch the server.

Hot-reload: edits to `*.jsx` / `*.js` / `*.html` are picked up by a manual browser refresh (`Ctrl+R`) — Tauri does not reload Rust without a rebuild.

---

## Build (release)

```bash
cargo tauri build
```

Outputs land in `src-tauri/target/release/bundle/`:

- `appimage/codex_0.1.0_amd64.AppImage`
- `deb/codex_0.1.0_amd64.deb`
- `rpm/codex-0.1.0-1.x86_64.rpm`

The release binary spawns `node ../server.js` (bundled as a Tauri resource) on launch and kills it on quit. The sidecar listens on `localhost:3000`.

---

## Distribute

### AppImage → AppImageHub

1. Build: `cargo tauri build --bundles appimage`
2. Sign (optional but recommended):
   ```bash
   gpg --detach-sign --armor codex_0.1.0_amd64.AppImage
   ```
3. Submit a PR to [AppImageHub](https://github.com/AppImage/appimage.github.io) with `codex.yml`.

### Flatpak → Flathub

1. Author `app.codex.bible.yml` (manifest), `app.codex.bible.appdata.xml` (metainfo), and a desktop entry.
2. Build locally: `flatpak-builder build-dir app.codex.bible.yml`
3. Submit to [flathub/flathub](https://github.com/flathub/flathub) on a new branch named after the app id.

### AUR (Arch)

1. Write `PKGBUILD` that downloads the AppImage or builds from source (Rust + Node).
2. Generate `.SRCINFO`: `makepkg --printsrcinfo > .SRCINFO`
3. Push to `ssh://aur@aur.archlinux.org/codex.git`.

### .deb upload (apt repo / Cloudsmith / GitHub Releases)

```bash
dpkg -I codex_0.1.0_amd64.deb            # sanity check
reprepro -b /var/www/apt includedeb stable codex_0.1.0_amd64.deb
```

Or upload to a hosted apt server (Cloudsmith, packagecloud, JFrog) and document the user-side install:

```bash
curl -1sLf 'https://dl.codex.app/setup.deb.sh' | sudo -E bash
sudo apt install codex
```

### .rpm upload

```bash
createrepo_c /var/www/rpm/
gpg --detach-sign --armor codex-0.1.0-1.x86_64.rpm
```

Document the user-side install (`/etc/yum.repos.d/codex.repo`).

---

## Auto-updater

Tauri's updater compares the running version against a JSON manifest served from your release endpoint and (if newer) downloads + verifies + applies the bundle.

### Generate a signing keypair

```bash
cargo tauri signer generate -w ~/.tauri/codex.key
```

This prints a base64 **public key** — paste it into `tauri.conf.json` → `plugins.updater.pubkey` (replacing `REPLACE_WITH_GENERATED_TAURI_UPDATER_PUBKEY_BASE64`). Keep the **private key** offline; never commit it.

### Endpoint format

`https://releases.codex.app/{{target}}/{{current_version}}` should return:

```json
{
  "version": "0.2.0",
  "notes": "What's new in 0.2.0",
  "pub_date": "2026-06-01T12:00:00Z",
  "platforms": {
    "linux-x86_64": {
      "signature": "<base64 .sig file>",
      "url": "https://releases.codex.app/dl/codex_0.2.0_amd64.AppImage"
    }
  }
}
```

Sign each release bundle: `cargo tauri signer sign -k ~/.tauri/codex.key codex_0.2.0_amd64.AppImage` — upload both the bundle and the `.sig`.

---

## What this scaffolding includes

| Feature | Status |
| --- | --- |
| Tray icon + menu (Show / VOTD / Quit) | scaffolded |
| Global hotkey `Ctrl+Alt+B` to toggle window | scaffolded |
| File associations `.codex-study` / `.codex-module` | scaffolded |
| Single-instance enforcement (forwards argv) | scaffolded |
| Sidecar `node server.js` spawn + reap | scaffolded |
| Updater (signature verification) | scaffolded — needs real pubkey + endpoint |
| AppImage / .deb / .rpm bundles | wired in `tauri.conf.json` |
| macOS / Windows targets | **future** (Phase 5.5 v2) |
| Real icons | **placeholder** — see above |
| CSP hardening, plugin scopes | **scaffolded** — review before shipping |
| Code signing (Linux package signing, Microsoft Authenticode, Apple Notary) | **future** |

This is intentionally minimal scaffolding. Production hardening (CSP tightening, plugin-permission audit, secrets management, telemetry opt-in flow, crash reporter) is tracked separately in `ROADMAP.md`.
