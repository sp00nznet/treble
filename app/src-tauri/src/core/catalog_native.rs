//! Native cross-platform catalog via [`rustypipe`](https://codeberg.org/ThetaDev/rustypipe)
//! — a pure-Rust YouTube/YouTube-Music InnerTube client. This is the **Android**
//! engine: it needs no `yt-dlp`/Python, so the same code resolves music on the
//! phone and the desktop. Enabled by the `native-catalog` cargo feature.
//!
//! `rustypipe` is async; we run it on a small per-call Tokio runtime so the rest
//! of the (synchronous) core and the Tauri command layer are unchanged.

use crate::core::error::{CoreError, Result};
use crate::core::models::Track;
use rustypipe::client::RustyPipe;
use rustypipe::param::StreamFilter;

fn block_on<F: std::future::Future>(fut: F) -> Result<F::Output> {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| CoreError::Other(e.to_string()))?;
    Ok(rt.block_on(fut))
}

/// Search YouTube Music for tracks.
pub fn search(query: &str, limit: u32) -> Result<Vec<Track>> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }
    let query = query.to_string();
    block_on(async move {
        let rp = RustyPipe::builder().build().map_err(|e| CoreError::Other(e.to_string()))?;
        let res = rp
            .query()
            .music_search_tracks(&query)
            .await
            .map_err(|e| CoreError::Network(e.to_string()))?;
        let tracks = res
            .items
            .items
            .into_iter()
            .take(limit as usize)
            .map(track_from_item)
            .collect();
        Ok(tracks)
    })?
}

/// Resolve a direct, streamable audio URL for a video id.
pub fn resolve_stream(id: &str) -> Result<String> {
    let id = id.to_string();
    block_on(async move {
        let rp = RustyPipe::builder().build().map_err(|e| CoreError::Other(e.to_string()))?;
        let player = rp
            .query()
            .player(&id)
            .await
            .map_err(|e| CoreError::Network(e.to_string()))?;
        let stream = player
            .select_audio_stream(&StreamFilter::default())
            .ok_or_else(|| CoreError::Other(format!("no audio stream for {id}")))?;
        Ok(stream.url.clone())
    })?
}

fn track_from_item(t: rustypipe::model::TrackItem) -> Track {
    let secs = t.duration.unwrap_or(0);
    let artist = t
        .artists
        .into_iter()
        .map(|a| a.name)
        .collect::<Vec<_>>()
        .join(", ");
    let album = t.album.map(|a| a.name).unwrap_or_default();
    let art = t.cover.last().map(|c| c.url.clone()).unwrap_or_default();
    Track {
        id: t.id,
        title: t.name,
        artist,
        album,
        duration: Track::fmt_duration(secs),
        duration_secs: secs,
        art,
        downloaded: false,
    }
}
