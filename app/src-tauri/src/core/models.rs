//! Shared domain types crossing the Rust ↔ frontend boundary.
//!
//! These mirror `app/src/types.ts`. Keep the two in sync: field names here become
//! the JSON keys the frontend sees (serde uses the Rust field names verbatim).

use serde::{Deserialize, Serialize};

/// A single playable track. `id` is the catalog id (a YouTube videoId on the
/// yt-dlp/InnerTube path); for imported-but-unmatched tracks it may be empty
/// until a match pass fills it in.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Track {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    /// Human-readable duration "3:58". `duration_secs` is the source of truth.
    pub duration: String,
    #[serde(default)]
    pub duration_secs: u32,
    /// Cover art URL (real http(s) URL from the catalog), or "" → UI uses a gradient.
    #[serde(default)]
    pub art: String,
    #[serde(default)]
    pub downloaded: bool,
}

impl Track {
    /// Format seconds as "m:ss".
    pub fn fmt_duration(secs: u32) -> String {
        format!("{}:{:02}", secs / 60, secs % 60)
    }
}

/// A playlist plus its tracks (tracks omitted in list views).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Playlist {
    pub id: String,
    pub title: String,
    pub subtitle: String,
    #[serde(default)]
    pub art: String,
    #[serde(default)]
    pub tracks: Vec<Track>,
}

/// Internal result of matching one parsed track against the catalog: its ranked
/// candidates and whether the top one is a confident match. Converted to the
/// serialized `MatchRow` (commands) for the review UI.
pub struct BulkRow {
    pub index: usize,
    pub candidates: Vec<Track>,
    pub confident: bool,
}

/// A track parsed out of a pasted Spotify selection, before matching to the catalog.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ParsedTrack {
    pub title: String,
    pub artist: String,
    #[serde(default)]
    pub album: String,
    #[serde(default)]
    pub duration: String,
}

/// One synced-lyrics line. `time_secs` drives the active-line highlight.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LyricLine {
    pub time_secs: f64,
    pub text: String,
}

/// Lyrics for a track — synced (timed) if available, else plain.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Lyrics {
    pub synced: bool,
    pub lines: Vec<LyricLine>,
    /// Plain fallback when no synced lyrics exist.
    #[serde(default)]
    pub plain: String,
}
