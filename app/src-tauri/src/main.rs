// Prevents an extra console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod core;

use core::library::Library;
use std::sync::Arc;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // The library DB lives in the app data dir and *is* the unit of sync.
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir).ok();
            let lib = Library::open(&data_dir.join("treble.db"))
                .map_err(|e| format!("failed to open library: {e}"))?;
            app.manage(Arc::new(lib));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::tools_status,
            commands::search,
            commands::resolve_stream,
            commands::get_lyrics,
            commands::parse_spotify,
            commands::import_spotify,
            commands::list_playlists,
            commands::get_playlist,
            commands::list_downloads,
            commands::download_track,
            commands::export_library,
            commands::import_library,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Treble");
}
