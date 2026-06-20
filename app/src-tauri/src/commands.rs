//! Tauri command surface — the *only* way the frontend reaches the core.
//! Each function here is a thin wrapper around `core::*` that also emits progress
//! events the UI listens to (`download:progress`, `import:progress`).

use crate::core::library::Library;
use crate::core::models::{Lyrics, ParsedTrack, Playlist, Track};
use crate::core::sync::{Peer, SendMessage, Snapshot, SyncService};
use crate::core::{catalog, downloads, local, lyrics, spotify_import, sync, tools};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

type CmdResult<T> = std::result::Result<T, crate::core::error::CoreError>;

/// Which external tools are available (drives a friendly Settings/Downloads hint).
#[derive(Serialize)]
pub struct ToolsStatus {
    pub yt_dlp: bool,
    pub ffmpeg: bool,
}

#[tauri::command]
pub fn tools_status() -> ToolsStatus {
    ToolsStatus {
        yt_dlp: tools::is_available("yt-dlp"),
        ffmpeg: tools::is_available("ffmpeg"),
    }
}

#[tauri::command]
pub fn search(query: String) -> CmdResult<Vec<Track>> {
    catalog::search(&query, 20)
}

#[tauri::command]
pub fn resolve_stream(id: String) -> CmdResult<String> {
    catalog::resolve_stream(&id)
}

#[tauri::command]
pub fn get_lyrics(title: String, artist: String, album: String, duration_secs: u32) -> CmdResult<Lyrics> {
    lyrics::fetch(&title, &artist, &album, duration_secs)
}

#[tauri::command]
pub fn parse_spotify(text: String) -> Vec<ParsedTrack> {
    spotify_import::parse(&text)
}

#[tauri::command]
pub fn list_playlists(lib: State<Arc<Library>>) -> CmdResult<Vec<Playlist>> {
    lib.list_playlists()
}

#[tauri::command]
pub fn get_playlist(lib: State<Arc<Library>>, id: String) -> CmdResult<Option<Playlist>> {
    lib.get_playlist(&id)
}

#[tauri::command]
pub fn list_downloads(lib: State<Arc<Library>>) -> CmdResult<Vec<Track>> {
    lib.list_downloaded()
}

/// Progress payload while matching imported tracks to the catalog.
#[derive(Serialize, Clone)]
struct ImportProgress {
    done: usize,
    total: usize,
    matched: usize,
    current: String,
}

/// Parse a pasted Spotify selection, match each track to the catalog (emitting
/// `import:progress`), and save the result as a real, playable playlist.
#[tauri::command]
pub fn import_spotify(
    app: AppHandle,
    lib: State<Arc<Library>>,
    name: String,
    text: String,
) -> CmdResult<Playlist> {
    let parsed = spotify_import::parse(&text);
    let total = parsed.len();
    let mut tracks: Vec<Track> = Vec::new();
    for (i, p) in parsed.iter().enumerate() {
        let _ = app.emit(
            "import:progress",
            ImportProgress {
                done: i,
                total,
                matched: tracks.len(),
                current: format!("{} — {}", p.title, p.artist),
            },
        );
        if let Ok(Some(t)) = catalog::match_track(p) {
            tracks.push(t);
        }
    }
    let _ = app.emit(
        "import:progress",
        ImportProgress { done: total, total, matched: tracks.len(), current: String::new() },
    );
    let id = lib.create_playlist(&name, &tracks)?;
    lib.get_playlist(&id).map(|o| o.unwrap_or_default())
}

/// Download payload streamed to the Downloads screen.
#[derive(Serialize, Clone)]
struct DownloadProgress {
    id: String,
    pct: f32,
    done: bool,
    error: Option<String>,
}

/// Download a track for offline playback. Runs on a background thread and streams
/// `download:progress` events; the final event has `done: true`.
#[tauri::command]
pub fn download_track(app: AppHandle, lib: State<Arc<Library>>, track: Track) -> CmdResult<()> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| crate::core::error::CoreError::Other(e.to_string()))?
        .join("downloads");
    let lib = lib.inner().clone();
    std::thread::spawn(move || {
        let id = track.id.clone();
        let emit = |pct: f32, done: bool, error: Option<String>| {
            let _ = app.emit("download:progress", DownloadProgress { id: id.clone(), pct, done, error });
        };
        match downloads::download(&track.id, &dir, |pct| emit(pct, false, None)) {
            Ok(path) => {
                let _ = lib.create_playlist("Downloads", std::slice::from_ref(&track)); // ensure track row exists
                let _ = lib.mark_downloaded(&track.id, &path.to_string_lossy());
                emit(100.0, true, None);
            }
            Err(e) => emit(0.0, true, Some(e.to_string())),
        }
    });
    Ok(())
}

/// Export the whole library as a portable snapshot (manual backup / sync unit).
#[tauri::command]
pub fn export_library(lib: State<Arc<Library>>, sync: State<Arc<SyncService>>) -> CmdResult<Snapshot> {
    sync::export_snapshot(lib.inner(), sync.device_id())
}

/// Import a snapshot (manual restore / received from a peer). Returns playlists merged.
#[tauri::command]
pub fn import_library(lib: State<Arc<Library>>, snapshot: Snapshot) -> CmdResult<usize> {
    sync::import_snapshot(lib.inner(), &snapshot)
}

// ---- local file library ----

/// Open a native folder picker; returns the chosen path (or null if cancelled).
#[tauri::command]
pub fn pick_folder(app: AppHandle) -> Option<String> {
    app.dialog()
        .file()
        .blocking_pick_folder()
        .and_then(|p| p.into_path().ok())
        .map(|p| p.to_string_lossy().into_owned())
}

/// Scan a folder for audio files and save them as a "Local Files" playlist.
#[tauri::command]
pub fn scan_local_folder(lib: State<Arc<Library>>, folder: String) -> CmdResult<Playlist> {
    let tracks = local::scan_folder(&PathBuf::from(&folder))?;
    let id = lib.create_playlist("Local Files", &tracks)?;
    lib.get_playlist(&id).map(|o| o.unwrap_or_default())
}

// ---- LAN sync / send-to-device ----

/// Peers currently discovered on the local network.
#[tauri::command]
pub fn list_peers(sync: State<Arc<SyncService>>) -> Vec<Peer> {
    sync.list_peers()
}

/// Send a track / playlist / snapshot to a peer by device id.
#[tauri::command]
pub fn send_to(sync: State<Arc<SyncService>>, peer_id: String, message: SendMessage) -> CmdResult<()> {
    sync.send_to(&peer_id, &message)
}
