//! The catalog: searching for music and resolving a playable audio stream.
//!
//! ## Desktop implementation (this file)
//! Shells out to `yt-dlp`, which is native, battle-tested, needs no API keys, and
//! handles YouTube's churn for us. `search` uses `ytsearch`, `resolve_stream`
//! uses `yt-dlp -g` to get a direct audio URL the frontend `<audio>` can play.
//!
//! ## Cross-platform / Android path (follow-up — see ROADMAP.md)
//! `yt-dlp` is Python and can't run on Android. The parity plan is a native Rust
//! InnerTube client ([`rustypipe`](https://codeberg.org/ThetaDev/rustypipe))
//! behind this same module surface, so the frontend contract never changes.

use crate::core::error::{CoreError, Result};
use crate::core::models::{ParsedTrack, Track};
use crate::core::tools;
use serde_json::Value;

/// Search the catalog. Dispatches to the active backend: native `rustypipe`
/// (Android / `native-catalog` feature) or `yt-dlp` (desktop default).
pub fn search(query: &str, limit: u32) -> Result<Vec<Track>> {
    #[cfg(feature = "native-catalog")]
    {
        return crate::core::catalog_native::search(query, limit);
    }
    #[cfg(not(feature = "native-catalog"))]
    {
        ytdlp_search(query, limit)
    }
}

/// yt-dlp-backed search (desktop default).
#[cfg_attr(feature = "native-catalog", allow(dead_code))]
fn ytdlp_search(query: &str, limit: u32) -> Result<Vec<Track>> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }
    let spec = format!("ytsearch{}:{}", limit.max(1), query);
    let out = tools::command("yt-dlp")?
        .args([
            &spec,
            "--dump-json",
            "--flat-playlist",
            "--no-warnings",
            "--ignore-errors",
        ])
        .output()?;

    if !out.status.success() && out.stdout.is_empty() {
        return Err(CoreError::Process(String::from_utf8_lossy(&out.stderr).into_owned()));
    }

    let mut tracks = Vec::new();
    for line in String::from_utf8_lossy(&out.stdout).lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Ok(v) = serde_json::from_str::<Value>(line) {
            if let Some(t) = track_from_json(&v) {
                tracks.push(t);
            }
        }
    }
    Ok(tracks)
}

/// Resolve a direct, streamable audio URL for a catalog id.
/// The URL is temporary (signed) — resolve on demand, don't persist it.
pub fn resolve_stream(id: &str) -> Result<String> {
    // yt-dlp uses YouTube's Android-VR client and bypasses the bot-detection 403
    // that the native (rustypipe) stream endpoint now hits — so prefer it whenever
    // it's available (auto-downloaded on desktop; see core::tools::ensure_ytdlp).
    if tools::ensure_ytdlp() {
        return ytdlp_resolve_stream(id);
    }
    #[cfg(feature = "native-catalog")]
    {
        crate::core::catalog_native::resolve_stream(id)
    }
    #[cfg(not(feature = "native-catalog"))]
    {
        ytdlp_resolve_stream(id)
    }
}

/// yt-dlp-backed stream resolution.
fn ytdlp_resolve_stream(id: &str) -> Result<String> {
    let out = tools::command("yt-dlp")?
        .args(["-f", "bestaudio/best", "-g", "--no-warnings", id])
        .output()?;
    if !out.status.success() {
        return Err(CoreError::Process(String::from_utf8_lossy(&out.stderr).into_owned()));
    }
    let url = String::from_utf8_lossy(&out.stdout)
        .lines()
        .next()
        .unwrap_or("")
        .trim()
        .to_string();
    if url.is_empty() {
        return Err(CoreError::Other(format!("no audio stream for {id}")));
    }
    Ok(url)
}

/// Match a parsed (e.g. Spotify-imported) track to a real catalog track by
/// searching and scoring candidates on title/artist similarity + duration.
/// Returns `None` if nothing reasonable is found.
pub fn match_track(parsed: &ParsedTrack) -> Result<Option<Track>> {
    let query = if parsed.artist.is_empty() {
        parsed.title.clone()
    } else {
        format!("{} {}", parsed.title, parsed.artist)
    };
    let candidates = search(&query, 5)?;
    let want_secs = parse_duration(&parsed.duration);
    let best = candidates
        .into_iter()
        .map(|t| {
            let score = score_match(parsed, &t, want_secs);
            (score, t)
        })
        .max_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
    Ok(best.filter(|(s, _)| *s > 0.3).map(|(_, t)| t))
}

/// Confidence threshold above which a match is taken automatically (no review).
pub const CONFIDENT_SCORE: f64 = 0.62;

/// Return up to `limit` candidates for a parsed track, sorted best-first, each
/// paired with its 0.0–1.0 match score. Used by the non-native (yt-dlp) import path.
#[cfg_attr(feature = "native-catalog", allow(dead_code))]
pub fn match_candidates(parsed: &ParsedTrack, limit: usize) -> Result<Vec<(Track, f64)>> {
    let query = if parsed.artist.is_empty() {
        parsed.title.clone()
    } else {
        format!("{} {}", parsed.title, parsed.artist)
    };
    let want_secs = parse_duration(&parsed.duration);
    let mut scored: Vec<(Track, f64)> = search(&query, 6)?
        .into_iter()
        .map(|t| {
            let s = score_match(parsed, &t, want_secs);
            (t, s)
        })
        .collect();
    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(limit);
    Ok(scored)
}

/// 0.0–1.0 similarity of a candidate to what we're looking for.
pub(crate) fn score_match(parsed: &ParsedTrack, cand: &Track, want_secs: Option<u32>) -> f64 {
    let title = token_overlap(&parsed.title, &cand.title);
    let artist = if parsed.artist.is_empty() {
        0.5
    } else {
        token_overlap(&parsed.artist, &cand.artist)
    };
    let dur = match want_secs {
        Some(w) if cand.duration_secs > 0 => {
            let diff = (w as i64 - cand.duration_secs as i64).unsigned_abs() as f64;
            (1.0 - diff / 15.0).max(0.0) // full credit within ~0s, none past 15s
        }
        _ => 0.5,
    };
    0.5 * title + 0.3 * artist + 0.2 * dur
}

/// Fraction of `a`'s lowercased word tokens present in `b`.
fn token_overlap(a: &str, b: &str) -> f64 {
    let norm = |s: &str| -> Vec<String> {
        s.to_lowercase()
            .split(|c: char| !c.is_alphanumeric())
            .filter(|w| !w.is_empty())
            .map(|w| w.to_string())
            .collect()
    };
    let at = norm(a);
    if at.is_empty() {
        return 0.0;
    }
    let bt = norm(b);
    let hits = at.iter().filter(|w| bt.contains(w)).count();
    hits as f64 / at.len() as f64
}

/// "3:58" → 238 seconds.
pub(crate) fn parse_duration(s: &str) -> Option<u32> {
    let (m, sec) = s.split_once(':')?;
    Some(m.trim().parse::<u32>().ok()? * 60 + sec.trim().parse::<u32>().ok()?)
}

/// Best-effort map of a yt-dlp JSON object to a `Track`.
#[cfg_attr(feature = "native-catalog", allow(dead_code))]
fn track_from_json(v: &Value) -> Option<Track> {
    let id = v.get("id")?.as_str()?.to_string();
    let title = v.get("title").and_then(Value::as_str).unwrap_or("Unknown").to_string();
    let artist = v
        .get("uploader")
        .or_else(|| v.get("channel"))
        .or_else(|| v.get("artist"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim_end_matches(" - Topic")
        .to_string();
    let duration_secs = v.get("duration").and_then(Value::as_f64).unwrap_or(0.0) as u32;
    let art = best_thumbnail(v);
    Some(Track {
        id,
        title,
        artist,
        album: v.get("album").and_then(Value::as_str).unwrap_or("").to_string(),
        duration: Track::fmt_duration(duration_secs),
        duration_secs,
        art,
        downloaded: false,
        rating: 0,
    })
}

/// Pick a reasonable thumbnail URL from yt-dlp's `thumbnails` array or `thumbnail`.
#[cfg_attr(feature = "native-catalog", allow(dead_code))]
fn best_thumbnail(v: &Value) -> String {
    if let Some(arr) = v.get("thumbnails").and_then(Value::as_array) {
        // thumbnails are usually smallest→largest; take the last.
        if let Some(last) = arr.iter().rev().find_map(|t| t.get("url").and_then(Value::as_str)) {
            return last.to_string();
        }
    }
    v.get("thumbnail").and_then(Value::as_str).unwrap_or("").to_string()
}
