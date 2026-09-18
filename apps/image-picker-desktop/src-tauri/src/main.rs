// Portable, fully offline shell for the Distributeur d'images: no server, no accounts.
// The frontend (../src) reads the chosen folder directly via the fs plugin and does the
// random draw client-side — Rust here only wires the dialog/fs plugins, no custom commands.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running the Distributeur d'images application");
}
