// Portable shell for the Gestionnaire de tokens frontend (see ../../token-manager/public).
// No local server: the window loads the shared static frontend, which talks to whatever
// remote API the user configures on first launch (see public/api.js).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running the Gestionnaire de tokens application");
}
