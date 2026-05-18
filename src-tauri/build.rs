// Tauri build script — generates platform glue at compile time.
// Reads tauri.conf.json, embeds icons, wires plugin permissions, etc.
fn main() {
    tauri_build::build()
}
