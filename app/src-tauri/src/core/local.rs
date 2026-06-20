//! Local file library — index music already on disk and play it alongside
//! streamed tracks. Tracks get a `local:<absolute-path>` id so the frontend can
//! resolve them through Tauri's asset protocol (`convertFileSrc`) without a
//! network round-trip; metadata comes from the file's tags via `lofty`.

use crate::core::error::Result;
use crate::core::models::Track;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::tag::Accessor;
use std::path::Path;
use walkdir::WalkDir;

const AUDIO_EXTS: &[&str] = &[
    "mp3", "flac", "m4a", "aac", "ogg", "opus", "wav", "wma", "aiff", "aif", "alac",
];

/// Recursively scan `folder` for audio files and read their tags into `Track`s.
pub fn scan_folder(folder: &Path) -> Result<Vec<Track>> {
    let mut tracks = Vec::new();
    for entry in WalkDir::new(folder).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_file() || !is_audio(path) {
            continue;
        }
        if let Some(track) = read_track(path) {
            tracks.push(track);
        }
    }
    tracks.sort_by(|a, b| (a.artist.to_lowercase(), a.title.to_lowercase()).cmp(&(b.artist.to_lowercase(), b.title.to_lowercase())));
    Ok(tracks)
}

fn is_audio(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| AUDIO_EXTS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn read_track(path: &Path) -> Option<Track> {
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("Unknown").to_string();
    // Forward slashes so the id round-trips cleanly through convertFileSrc + the
    // asset-protocol scope glob (which matches with `/`).
    let id = format!("local:{}", path.to_string_lossy().replace('\\', "/"));

    // Tags are best-effort: a file with no tags still becomes a playable track.
    let (mut title, mut artist, mut album, mut secs) = (stem.clone(), String::new(), String::new(), 0u32);
    if let Ok(tagged) = lofty::read_from_path(path) {
        secs = tagged.properties().duration().as_secs() as u32;
        if let Some(tag) = tagged.primary_tag().or_else(|| tagged.first_tag()) {
            if let Some(t) = tag.title() {
                title = t.to_string();
            }
            if let Some(a) = tag.artist() {
                artist = a.to_string();
            }
            if let Some(al) = tag.album() {
                album = al.to_string();
            }
        }
    }

    Some(Track {
        id,
        title,
        artist,
        album,
        duration: Track::fmt_duration(secs),
        duration_secs: secs,
        art: String::new(),
        downloaded: true, // local files are inherently offline
    })
}
