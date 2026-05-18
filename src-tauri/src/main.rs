// CODEX desktop — binary entrypoint.
//
// All real logic lives in `lib.rs::run()` so it can be reused by mobile
// targets and tests. This file is intentionally tiny.
//
// Suppress the console window on Windows release builds. Linux ignores
// this attribute; the project targets Linux first (Phase 5.5 v1).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    codex_lib::run();
}
