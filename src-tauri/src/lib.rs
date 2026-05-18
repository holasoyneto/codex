// CODEX Tauri shell — library entrypoint.
//
// All Tauri Builder logic lives here so it can be reused by:
//   - the desktop binary (src/main.rs → calls run())
//   - future mobile shims (iOS/Android Tauri 2.0 multi-target)
//   - integration tests
//
// Phase 5.5 v1 scaffolding — Linux first. macOS + Windows follow once
// the Linux distribution channels (AppImage / Flathub / AUR / .deb /
// .rpm) are stable.
//
// Heavy commenting throughout because this is the seam between the
// existing Node/HTML/JSX codebase and the native shell.

use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, RunEvent, WindowEvent,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Handle to the sidecar `node server.js` process so we can kill it on
/// app exit. Wrapped in a Mutex because Tauri state is shared across
/// threads (the tray event loop in particular).
struct SidecarGuard(Mutex<Option<Child>>);

/// Spawn the bundled Node server as a sidecar. CODEX's frontend talks
/// to `http://localhost:3000` for `/api/chat`, `/api/v1/*`, and static
/// assets — so the desktop shell needs Node running locally.
///
/// In production builds, `server.js` is included via `bundle.resources`
/// in tauri.conf.json and resolved through the AppHandle's resource
/// dir. In dev, `beforeDevCommand` already runs it, so we skip.
fn spawn_sidecar(app: &AppHandle) -> Option<Child> {
    // Skip in dev — `beforeDevCommand` already launched node.
    if cfg!(debug_assertions) {
        return None;
    }

    let resource_path = app
        .path()
        .resource_dir()
        .ok()
        .map(|p| p.join("server.js"))?;

    if !resource_path.exists() {
        eprintln!("CODEX: sidecar server.js not found at {:?}", resource_path);
        return None;
    }

    match Command::new("node")
        .arg(resource_path)
        .env("PORT", "3000")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(child) => Some(child),
        Err(e) => {
            eprintln!("CODEX: failed to spawn node sidecar: {e}");
            None
        }
    }
}

/// Toggle the main window's visibility — bound to the global hotkey.
fn toggle_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let visible = win.is_visible().unwrap_or(false);
        let focused = win.is_focused().unwrap_or(false);
        if visible && focused {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
            let _ = win.unminimize();
        }
    }
}

/// Build the system tray icon + menu.
fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show", "Show CODEX", true, None::<&str>)?;
    let votd_item = MenuItem::with_id(app, "votd", "Verse of the day", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_item, &votd_item, &quit_item])?;

    let _tray = TrayIconBuilder::with_id("main")
        .tooltip("CODEX")
        .icon(Image::from_path("icons/icon.png").unwrap_or_else(|_| {
            // Fallback: 1x1 transparent PNG so dev builds without real
            // icons still produce a visible tray. Real icons go in
            // icons/ at 32/128/256/512/1024 — see README.md.
            Image::new_owned(vec![0u8; 4], 1, 1)
        }))
        .menu(&menu)
        .menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => toggle_main_window(app),
            "votd" => {
                // Frontend listens for this and pops a Verse-of-the-Day modal.
                let _ = app.emit("codex:verse-of-the-day", ());
                toggle_main_window(app);
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // Left-click anywhere on the tray icon → toggle window.
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

/// Register the global hotkey Ctrl+Alt+B to toggle the main window.
fn setup_global_hotkey(app: &AppHandle) -> tauri::Result<()> {
    let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyB);
    app.global_shortcut().on_shortcut(shortcut, move |app, _sc, ev| {
        if ev.state == ShortcutState::Pressed {
            toggle_main_window(app);
        }
    })?;
    Ok(())
}

/// Handle .codex-study / .codex-module file associations. On Linux,
/// double-clicking such a file launches CODEX with the path as argv[1];
/// the single-instance plugin forwards it to the running instance,
/// which forwards it to the frontend via an event.
fn handle_cli_files(app: &AppHandle, args: &[String]) {
    for arg in args.iter().skip(1) {
        if arg.ends_with(".codex-study") || arg.ends_with(".codex-module") {
            let _ = app.emit("codex:open-file", arg.clone());
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Ensure only one CODEX instance — second launches forward
        // their argv to the existing instance (lets file associations
        // open in the already-running window).
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            handle_cli_files(app, &argv);
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(SidecarGuard(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle();

            // Boot sequence: tray, hotkey, sidecar, file-association
            // dispatch, updater check.
            setup_tray(handle)?;
            setup_global_hotkey(handle)?;

            if let Some(child) = spawn_sidecar(handle) {
                let state = app.state::<SidecarGuard>();
                *state.0.lock().unwrap() = Some(child);
            }

            handle_cli_files(handle, &std::env::args().collect::<Vec<_>>());

            // Updater: ask in background on startup. The `dialog: true`
            // config in tauri.conf.json shows a native prompt to the
            // user. Failures (offline, endpoint down) are non-fatal.
            #[cfg(not(debug_assertions))]
            {
                use tauri_plugin_updater::UpdaterExt;
                let h = handle.clone();
                tauri::async_runtime::spawn(async move {
                    if let Ok(Some(update)) = h.updater().and_then(|u| u.check().await) {
                        let _ = update.download_and_install(|_, _| {}, || {}).await;
                    }
                });
            }

            Ok(())
        })
        .on_window_event(|win, event| {
            // Closing the main window hides instead of quits — the app
            // keeps living in the tray. Quit explicitly via tray menu.
            if let WindowEvent::CloseRequested { api, .. } = event {
                if win.label() == "main" {
                    api.prevent_close();
                    let _ = win.hide();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building CODEX tauri application")
        .run(|app, event| {
            // On exit, reap the sidecar so we don't leak `node` procs.
            if let RunEvent::ExitRequested { .. } = event {
                let state = app.state::<SidecarGuard>();
                if let Some(mut child) = state.0.lock().unwrap().take() {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        });
}
