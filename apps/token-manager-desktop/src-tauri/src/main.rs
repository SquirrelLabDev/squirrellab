// Portable, fully offline shell for the Gestionnaire de tokens: no server, no accounts.
// The frontend (../src) reads/writes a single JSON file directly via the fs plugin — that
// file is meant to live on a shared drive (OneDrive, network share) so colleagues who open
// it with this same executable see each other's changes without any central server.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running the Gestionnaire de tokens application");
}
