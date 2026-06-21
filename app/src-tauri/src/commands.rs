//! Tauri command surface — the *only* way the frontend reaches the core.
//! Each function here is a thin wrapper around `core::*` that also emits progress
//! events the UI listens to (`download:progress`, `import:progress`).

use crate::core::library::Library;
use crate::core::models::{BulkRow, Lyrics, ParsedTrack, Playlist, Track};
use crate::core::sync::{Peer, SendMessage, Snapshot, SyncService};
use crate::core::podcasts::{self, Podcast};
use crate::core::{catalog, downloads, local, lyrics, spotify_import, sync, tools};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

/// Cancellation flag for the in-flight Spotify import (one import at a time).
static IMPORT_CANCEL: AtomicBool = AtomicBool::new(false);

/// Playlists above this size skip the per-track review and auto-import in the
/// background (you can't sanely eyeball thousands of rows).
const REVIEW_MAX: usize = 60;

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

// NOTE: search / resolve_stream / get_lyrics are `async` on purpose. In Tauri,
// *synchronous* commands run on the main thread and block the UI — these do
// network I/O and spawn yt-dlp, so they run on the blocking pool instead.

#[tauri::command]
pub async fn search(query: String) -> CmdResult<Vec<Track>> {
    tauri::async_runtime::spawn_blocking(move || catalog::search(&query, 18))
        .await
        .map_err(|e| crate::core::error::CoreError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn resolve_stream(sync: State<'_, Arc<SyncService>>, id: String) -> CmdResult<String> {
    let sync = sync.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::tlog!("resolve_stream: {id}");
        let r = resolve_any(&sync, &id);
        match &r {
            Ok(u) => crate::tlog!("resolve_stream ok ({} chars)", u.len()),
            Err(e) => crate::tlog!("resolve_stream ERR: {e}"),
        }
        r
    })
    .await
    .map_err(|e| crate::core::error::CoreError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn get_lyrics(title: String, artist: String, album: String, duration_secs: u32) -> CmdResult<Lyrics> {
    tauri::async_runtime::spawn_blocking(move || lyrics::fetch(&title, &artist, &album, duration_secs))
        .await
        .map_err(|e| crate::core::error::CoreError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn search_podcasts(query: String) -> CmdResult<Vec<Podcast>> {
    tauri::async_runtime::spawn_blocking(move || podcasts::search(&query))
        .await
        .map_err(|e| crate::core::error::CoreError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn podcast_episodes(feed_url: String, art: String) -> CmdResult<Vec<Track>> {
    tauri::async_runtime::spawn_blocking(move || podcasts::episodes(&feed_url, &art))
        .await
        .map_err(|e| crate::core::error::CoreError::Other(e.to_string()))?
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

/// All tracks in the library (the "Songs" tab).
#[tauri::command]
pub fn list_all_tracks(lib: State<Arc<Library>>) -> CmdResult<Vec<Track>> {
    lib.list_all_tracks()
}

/// Create a new, empty playlist; returns it.
#[tauri::command]
pub fn new_playlist(lib: State<Arc<Library>>, name: String) -> CmdResult<Playlist> {
    let id = lib.create_playlist(&name, &[])?;
    lib.get_playlist(&id).map(|o| o.unwrap_or(Playlist { id, title: name, ..Default::default() }))
}

// ---- podcast subscriptions ----

#[tauri::command]
pub fn subscribe_podcast(lib: State<Arc<Library>>, show: Podcast) -> CmdResult<()> {
    lib.subscribe(&show)
}

#[tauri::command]
pub fn unsubscribe_podcast(lib: State<Arc<Library>>, id: String) -> CmdResult<()> {
    lib.unsubscribe(&id)
}

#[tauri::command]
pub fn list_subscriptions(lib: State<Arc<Library>>) -> CmdResult<Vec<Podcast>> {
    lib.list_subscriptions()
}

/// Path to the on-disk log file (for the Settings "view log" affordance).
#[tauri::command]
pub fn get_log_path() -> Option<String> {
    crate::core::log::path().map(|p| p.to_string_lossy().into_owned())
}

/// Write a message from the frontend into the log (playback events, errors).
#[tauri::command]
pub fn ui_log(msg: String) {
    crate::tlog!("[ui] {msg}");
}

#[tauri::command]
pub fn delete_playlist(lib: State<Arc<Library>>, id: String) -> CmdResult<()> {
    crate::tlog!("delete_playlist {id}");
    lib.delete_playlist(&id)
}

#[tauri::command]
pub fn rename_playlist(lib: State<Arc<Library>>, id: String, name: String) -> CmdResult<()> {
    crate::tlog!("rename_playlist {id} -> {name}");
    lib.rename_playlist(&id, &name)
}

#[tauri::command]
pub fn set_rating(lib: State<Arc<Library>>, track_id: String, rating: u8) -> CmdResult<()> {
    lib.set_rating(&track_id, rating)
}

/// Replace a playlist's cover with an image file (copied into app data). Returns
/// the new art reference (a `local:` path the frontend resolves via the asset
/// protocol).
#[tauri::command]
pub fn set_playlist_cover(app: AppHandle, lib: State<Arc<Library>>, id: String, src_path: String) -> CmdResult<String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| crate::core::error::CoreError::Other(e.to_string()))?
        .join("covers");
    std::fs::create_dir_all(&dir).ok();
    let ext = std::path::Path::new(&src_path).extension().and_then(|e| e.to_str()).unwrap_or("png");
    let dest = dir.join(format!("{id}.{ext}"));
    std::fs::copy(&src_path, &dest)?;
    let art = format!("local:{}", dest.to_string_lossy().replace('\\', "/"));
    lib.set_playlist_art(&id, &art)?;
    Ok(art)
}

/// Native file picker for an image (playlist cover).
#[cfg(desktop)]
#[tauri::command]
pub fn pick_image(app: AppHandle) -> Option<String> {
    app.dialog()
        .file()
        .add_filter("Image", &["png", "jpg", "jpeg", "webp", "gif"])
        .blocking_pick_file()
        .and_then(|p| p.into_path().ok())
        .map(|p| p.to_string_lossy().into_owned())
}

#[cfg(mobile)]
#[tauri::command]
pub fn pick_image(_app: AppHandle) -> Option<String> {
    None
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

/// One row of the "smart match" review: the parsed Spotify track + its ranked
/// candidates. `confident` is true when the top candidate is a strong match (so
/// the UI can auto-accept it and only surface the uncertain ones for review).
#[derive(Serialize, Clone)]
pub struct MatchRow {
    pub parsed: ParsedTrack,
    pub candidates: Vec<Track>,
    pub confident: bool,
}

/// Emitted when matching finishes for a small playlist — the rows to review.
#[derive(Serialize, Clone)]
struct ImportRows {
    name: String,
    rows: Vec<MatchRow>,
}

/// Emitted when a large playlist finished auto-importing.
#[derive(Serialize, Clone)]
struct ImportDone {
    playlist: Playlist,
    total: usize,
    matched: usize,
    skipped: usize,
}

/// Cancel the in-flight import.
#[tauri::command]
pub fn import_cancel() {
    IMPORT_CANCEL.store(true, Ordering::Relaxed);
}

/// Start importing a pasted Spotify selection. Runs entirely on a background
/// thread (never blocks the UI), matches tracks concurrently against YouTube
/// Music, and is cancellable. Small playlists emit `import:rows` for review;
/// large ones auto-import and emit `import:done`. Progress streams on
/// `import:progress`; cancellation emits `import:cancelled`.
#[tauri::command]
pub fn import_run(app: AppHandle, lib: State<Arc<Library>>, name: String, text: String) {
    let lib = lib.inner().clone();
    IMPORT_CANCEL.store(false, Ordering::Relaxed);
    std::thread::spawn(move || do_import(app, lib, name, text));
}

fn do_import(app: AppHandle, lib: Arc<Library>, name: String, text: String) {
    // Best source: an Exportify CSV (full metadata, no per-track lookup). Else
    // Spotify track URLs (resolve each via the embed page). Else "Title — Artist".
    let ids = spotify_import::extract_track_ids(&text);
    let parsed = if let Some(csv) = spotify_import::parse_csv(&text) {
        crate::tlog!("import start: Exportify CSV with {} tracks", csv.len());
        csv
    } else if !ids.is_empty() {
        let n = ids.len();
        crate::tlog!("import start: {} spotify URLs (resolving via embed)", n);
        let progress = |done: usize| {
            let _ = app.emit("import:progress", ImportProgress { done, total: n, matched: done, current: format!("Reading Spotify… {done}/{n}") });
        };
        let r = resolve_step(&ids, progress);
        crate::tlog!("import: resolved {}/{} tracks from Spotify ({} failed)", r.len(), n, n - r.len());
        r
    } else {
        spotify_import::parse(&text)
    };

    if IMPORT_CANCEL.load(Ordering::Relaxed) {
        let _ = app.emit("import:cancelled", ());
        return;
    }

    let total = parsed.len();
    if total == 0 {
        // Empty input, or Spotify resolution failed for everything.
        let n = ids.len();
        let _ = app.emit("import:done", ImportDone { playlist: Playlist::default(), total: n, matched: 0, skipped: n });
        return;
    }
    let review = total <= REVIEW_MAX;
    let per = if review { 4 } else { 1 };

    let progress = |done: usize, current: &str| {
        let _ = app.emit("import:progress", ImportProgress { done, total, matched: done, current: format!("Matching… {current}") });
    };
    let rows = match_step(&parsed, per, progress);
    let matched_count = rows.iter().filter(|r| !r.candidates.is_empty()).count();
    crate::tlog!("import: matched {}/{} on YouTube Music", matched_count, total);
    // Log exactly which tracks had no YouTube Music match (so they can be checked).
    for r in &rows {
        if r.candidates.is_empty() {
            let p = &parsed[r.index];
            crate::tlog!("import: NO MATCH — {} — {}", p.title, p.artist);
        }
    }

    if IMPORT_CANCEL.load(Ordering::Relaxed) {
        let _ = app.emit("import:cancelled", ());
        return;
    }

    if review {
        let match_rows: Vec<MatchRow> = rows
            .into_iter()
            .map(|r| MatchRow {
                parsed: parsed[r.index].clone(),
                candidates: r.candidates,
                confident: r.confident,
            })
            .collect();
        let _ = app.emit("import:rows", ImportRows { name, rows: match_rows });
    } else {
        // Auto-import: take the best candidate for each matched track.
        let tracks: Vec<Track> = rows.into_iter().filter_map(|r| r.candidates.into_iter().next()).collect();
        let matched = tracks.len();
        match lib.create_playlist(&name, &tracks).and_then(|id| lib.get_playlist(&id)) {
            Ok(Some(pl)) => {
                let _ = app.emit("import:done", ImportDone { playlist: pl, total, matched, skipped: total - matched });
            }
            _ => {
                let _ = app.emit("import:done", ImportDone { playlist: Playlist { title: name, ..Default::default() }, total, matched, skipped: total - matched });
            }
        }
    }
}

/// Resolve Spotify IDs → metadata, backend-aware: concurrent (default) or sequential.
#[cfg(feature = "native-catalog")]
fn resolve_step(ids: &[String], on_progress: impl FnMut(usize)) -> Vec<ParsedTrack> {
    // Lower concurrency for Spotify (it rate-limits aggressively); retries in
    // resolve_id ride out throttling.
    crate::core::catalog_native::resolve_spotify(ids, 4, &IMPORT_CANCEL, on_progress)
}

#[cfg(not(feature = "native-catalog"))]
fn resolve_step(ids: &[String], on_progress: impl FnMut(usize)) -> Vec<ParsedTrack> {
    spotify_import::resolve_ids_seq(ids, on_progress).unwrap_or_default()
}

/// Match step, backend-aware: concurrent via rustypipe (default), else sequential.
#[cfg(feature = "native-catalog")]
fn match_step(parsed: &[ParsedTrack], per: usize, on_progress: impl FnMut(usize, &str)) -> Vec<BulkRow> {
    crate::core::catalog_native::match_bulk(parsed, per, 8, &IMPORT_CANCEL, on_progress)
}

#[cfg(not(feature = "native-catalog"))]
fn match_step(parsed: &[ParsedTrack], per: usize, mut on_progress: impl FnMut(usize, &str)) -> Vec<BulkRow> {
    let mut rows = Vec::with_capacity(parsed.len());
    for (index, p) in parsed.iter().enumerate() {
        if IMPORT_CANCEL.load(Ordering::Relaxed) {
            break;
        }
        let scored = catalog::match_candidates(p, per).unwrap_or_default();
        let confident = scored.first().map(|(_, s)| *s >= catalog::CONFIDENT_SCORE).unwrap_or(false);
        on_progress(index + 1, &p.title);
        rows.push(BulkRow { index, candidates: scored.into_iter().map(|(t, _)| t).collect(), confident });
    }
    rows
}

/// Save the user's confirmed track selections as a real, playable playlist.
#[tauri::command]
pub fn save_matched_playlist(lib: State<Arc<Library>>, name: String, tracks: Vec<Track>) -> CmdResult<Playlist> {
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

/// Where downloads land: the user-configured folder, else `<app-data>/downloads`.
fn downloads_dir(app: &AppHandle, lib: &Library) -> PathBuf {
    if let Ok(Some(d)) = lib.get_setting("download_dir") {
        if !d.trim().is_empty() {
            return PathBuf::from(d);
        }
    }
    app.path()
        .app_data_dir()
        .map(|d| d.join("downloads"))
        .unwrap_or_else(|_| PathBuf::from("downloads"))
}

/// Map the user's quality preference to a yt-dlp `--audio-quality` value.
fn quality_arg(lib: &Library) -> String {
    match lib.get_setting("quality").ok().flatten().as_deref() {
        Some("low") => "7",
        Some("normal") => "5",
        Some("high") => "2",
        _ => "0", // "best" / unset
    }
    .to_string()
}

/// Fetch one track to `dir`, emitting `download:progress`. Blocking — callers run
/// it on a background thread (one-shot for `download_track`, in a loop for
/// `download_many`). Records the file in the library and ensures the row exists.
/// Ask the in-app NewPipeExtractor service (Android only) to resolve a playable
/// URL. It runs YouTube's player-JS deobfuscation on-device (like NewPipe) and is
/// served over localhost so we can call it like any other resolver.
#[cfg(target_os = "android")]
fn newpipe_resolve(id: &str) -> Option<String> {
    let url = format!("http://127.0.0.1:28923/resolve?id={id}");
    match ureq::get(&url).timeout(std::time::Duration::from_secs(35)).call() {
        Ok(resp) => match resp.into_string() {
            Ok(body) if body.starts_with("http") => {
                crate::tlog!("NewPipe resolved on-device ({} chars)", body.len());
                Some(body)
            }
            // The Kotlin side returns the real failure reason — log it so it shows
            // up in the Treble log (Settings → log path), no adb required.
            Ok(body) => { crate::tlog!("NewPipe could not resolve: {}", &body[..body.len().min(220)]); None }
            Err(e) => { crate::tlog!("NewPipe read error: {e}"); None }
        },
        Err(e) => { crate::tlog!("NewPipe server unreachable (not started?): {e}"); None }
    }
}
#[cfg(not(target_os = "android"))]
fn newpipe_resolve(_id: &str) -> Option<String> {
    None
}

/// Resolve a playable stream URL across every available backend:
/// on-device NewPipeExtractor (Android) → local yt-dlp (desktop) → a desktop
/// companion on the LAN (phones) → the native rustypipe client (last resort).
fn resolve_any(sync: &SyncService, id: &str) -> CmdResult<String> {
    if let Some(u) = newpipe_resolve(id) {
        return Ok(u);
    }
    if tools::ensure_ytdlp() {
        return catalog::resolve_stream(id);
    }
    if let Some(u) = sync.resolve_via_peer(id) {
        return Ok(u);
    }
    catalog::resolve_stream(id)
}

fn run_download(app: &AppHandle, lib: &Library, dir: &Path, quality: &str, sync: &SyncService, track: &Track) {
    let id = track.id.clone();
    let emit = |pct: f32, done: bool, error: Option<String>| {
        let _ = app.emit("download:progress", DownloadProgress { id: id.clone(), pct, done, error });
    };
    // Already downloaded? report done immediately.
    if matches!(lib.downloaded_path(&track.id), Ok(Some(p)) if std::path::Path::new(&p).is_file()) {
        emit(100.0, true, None);
        return;
    }
    let result = if tools::ensure_ytdlp() {
        // Desktop: yt-dlp downloads best audio as mp3.
        downloads::download(&track.id, dir, quality, |pct| emit(pct, false, None))
    } else {
        // Phone (no yt-dlp): resolve via a desktop companion, then fetch the audio
        // directly from Google. This is the offline "Send to device" path.
        match resolve_any(sync, &track.id) {
            Ok(url) => downloads::download_native(&url, dir, &track.id, |pct| emit(pct, false, None)),
            Err(e) => Err(e),
        }
    };
    match result {
        Ok(path) => {
            // Make sure the track row exists before flagging it downloaded.
            let _ = lib.ensure_track(track);
            let _ = lib.mark_downloaded(&track.id, &path.to_string_lossy());
            emit(100.0, true, None);
        }
        Err(e) => emit(0.0, true, Some(e.to_string())),
    }
}

/// Download a track for offline playback. Runs on a background thread and streams
/// `download:progress` events; the final event has `done: true`.
#[tauri::command]
pub fn download_track(app: AppHandle, lib: State<Arc<Library>>, sync: State<Arc<SyncService>>, track: Track) -> CmdResult<()> {
    let dir = downloads_dir(&app, &lib);
    let quality = quality_arg(&lib);
    let lib = lib.inner().clone();
    let sync = sync.inner().clone();
    std::thread::spawn(move || run_download(&app, &lib, &dir, &quality, &sync, &track));
    Ok(())
}

/// Download many tracks (a whole playlist) sequentially on a single background
/// thread, so we never spawn hundreds of yt-dlp processes at once. Each track
/// streams its own `download:progress` events keyed by track id.
#[tauri::command]
pub fn download_many(app: AppHandle, lib: State<Arc<Library>>, sync: State<Arc<SyncService>>, tracks: Vec<Track>) -> CmdResult<()> {
    let dir = downloads_dir(&app, &lib);
    let quality = quality_arg(&lib);
    let lib = lib.inner().clone();
    let sync = sync.inner().clone();
    std::thread::spawn(move || {
        crate::tlog!("download_many: {} tracks", tracks.len());
        for t in &tracks {
            run_download(&app, &lib, &dir, &quality, &sync, t);
        }
        crate::tlog!("download_many: done");
    });
    Ok(())
}

/// The local file path of a downloaded track (so playback can prefer it over
/// streaming). Returns null if not downloaded or the file is missing.
#[tauri::command]
pub fn downloaded_path(lib: State<Arc<Library>>, id: String) -> Option<String> {
    match lib.downloaded_path(&id) {
        Ok(Some(p)) if std::path::Path::new(&p).is_file() => Some(p),
        _ => None,
    }
}

// ---- liked songs ----

#[tauri::command]
pub fn like_track(lib: State<Arc<Library>>, track: Track) -> CmdResult<()> {
    lib.like(&track)
}

#[tauri::command]
pub fn unlike_track(lib: State<Arc<Library>>, id: String) -> CmdResult<()> {
    lib.unlike(&id)
}

#[tauri::command]
pub fn list_liked(lib: State<Arc<Library>>) -> CmdResult<Vec<Track>> {
    lib.list_liked()
}

/// Append a track to an existing playlist.
#[tauri::command]
pub fn add_to_playlist(lib: State<Arc<Library>>, playlist_id: String, track: Track) -> CmdResult<()> {
    lib.add_to_playlist(&playlist_id, &track)
}

#[tauri::command]
pub fn liked_ids(lib: State<Arc<Library>>) -> CmdResult<Vec<String>> {
    lib.liked_ids()
}

// ---- settings + storage ----

#[tauri::command]
pub fn get_setting(lib: State<Arc<Library>>, key: String) -> CmdResult<Option<String>> {
    lib.get_setting(&key)
}

#[tauri::command]
pub fn set_setting(lib: State<Arc<Library>>, key: String, value: String) -> CmdResult<()> {
    lib.set_setting(&key, &value)
}

/// Where downloads currently land (the configured folder, or the default).
#[tauri::command]
pub fn get_download_dir(app: AppHandle, lib: State<Arc<Library>>) -> String {
    downloads_dir(&app, &lib).to_string_lossy().into_owned()
}

#[derive(Serialize)]
pub struct StorageStats {
    bytes: u64,
    count: usize,
}

/// Total size + count of downloaded files (for the Settings storage card).
#[tauri::command]
pub fn storage_stats(lib: State<Arc<Library>>) -> StorageStats {
    let paths = lib.downloaded_paths().unwrap_or_default();
    let mut bytes = 0u64;
    let mut count = 0usize;
    for p in &paths {
        if let Ok(meta) = std::fs::metadata(p) {
            bytes += meta.len();
            count += 1;
        }
    }
    StorageStats { bytes, count }
}

/// Delete every downloaded file and reset the library's download flags.
#[tauri::command]
pub fn clear_downloads(lib: State<Arc<Library>>) -> CmdResult<usize> {
    let paths = lib.downloaded_paths().unwrap_or_default();
    let mut removed = 0;
    for p in &paths {
        if std::fs::remove_file(p).is_ok() {
            removed += 1;
        }
    }
    lib.clear_downloaded()?;
    crate::tlog!("clear_downloads: removed {} files", removed);
    Ok(removed)
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
/// Desktop only — Android has no folder picker (scoped storage is a follow-up).
#[cfg(desktop)]
#[tauri::command]
pub fn pick_folder(app: AppHandle) -> Option<String> {
    app.dialog()
        .file()
        .blocking_pick_folder()
        .and_then(|p| p.into_path().ok())
        .map(|p| p.to_string_lossy().into_owned())
}

#[cfg(mobile)]
#[tauri::command]
pub fn pick_folder(_app: AppHandle) -> Option<String> {
    None
}

/// Scan a folder for audio files and save them as a "Local Files" playlist.
#[tauri::command]
pub async fn scan_local_folder(lib: State<'_, Arc<Library>>, folder: String) -> CmdResult<Playlist> {
    let tracks = tauri::async_runtime::spawn_blocking(move || local::scan_folder(&PathBuf::from(&folder)))
        .await
        .map_err(|e| crate::core::error::CoreError::Other(e.to_string()))??;
    crate::tlog!("local scan: {} tracks", tracks.len());
    let id = lib.create_playlist("Local Files", &tracks)?;
    lib.get_playlist(&id).map(|o| o.unwrap_or_default())
}

// ---- LAN sync / send-to-device ----

/// Peers currently discovered on the local network.
#[tauri::command]
pub fn list_peers(sync: State<Arc<SyncService>>) -> Vec<Peer> {
    sync.list_peers()
}

/// Whether this device can stream at all: the in-app NewPipe resolver is up
/// (Android), or a desktop companion is reachable on the LAN. Drives the phone's
/// "open Treble on your computer" hint (shown only when neither is available).
#[tauri::command]
pub fn companion_status(sync: State<Arc<SyncService>>) -> bool {
    newpipe_up() || sync.has_companion()
}

#[cfg(target_os = "android")]
fn newpipe_up() -> bool {
    ureq::get("http://127.0.0.1:28923/ping")
        .timeout(std::time::Duration::from_secs(2))
        .call()
        .map(|r| r.into_string().map(|s| s.contains("newpipe")).unwrap_or(false))
        .unwrap_or(false)
}
#[cfg(not(target_os = "android"))]
fn newpipe_up() -> bool {
    false
}

/// Send a track / playlist / snapshot to a peer by device id.
#[tauri::command]
pub fn send_to(sync: State<Arc<SyncService>>, peer_id: String, message: SendMessage) -> CmdResult<()> {
    sync.send_to(&peer_id, &message)
}
