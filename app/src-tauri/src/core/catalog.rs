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
    // YouTube's InnerTube now bot-blocks rustypipe search with a 403, so prefer
    // yt-dlp (which bypasses it, the same way stream resolution does) whenever it's
    // available. Fall back to the native client only if yt-dlp isn't present
    // (e.g. on Android, where yt-dlp can't run).
    if tools::ensure_ytdlp() {
        match ytdlp_search(query, limit) {
            Ok(v) if !v.is_empty() => return Ok(v),
            Ok(_) => crate::tlog!("yt-dlp search: 0 results"),
            Err(e) => crate::tlog!("yt-dlp search failed ({e}); trying native"),
        }
    }
    #[cfg(feature = "native-catalog")]
    {
        crate::core::catalog_native::search(query, limit)
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
        .args(["-f", "bestaudio/best", "-g", "--no-warnings"])
        .arg(tools::ytdlp_target(id))
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

/// Drop bracketed promo junk like "(Official Video)", "[Lyrics]", "(Audio)" from
/// a title while keeping meaningful parentheticals (e.g. "(Remastered)", "(feat …)").
#[cfg_attr(feature = "native-catalog", allow(dead_code))]
fn strip_promo_brackets(s: &str) -> String {
    const JUNK: &[&str] = &[
        "official", "lyric", "audio", "video", "visualizer", "visualiser",
        "hd", "4k", "hq", "explicit", "color coded", "colour coded", "m/v", " mv",
    ];
    let mut out = String::new();
    let mut buf = String::new();
    let mut depth = 0;
    let mut open = '(';
    for ch in s.chars() {
        match ch {
            '(' | '[' if depth == 0 => { depth = 1; open = ch; buf.clear(); }
            ')' | ']' if depth == 1 => {
                depth = 0;
                let low = buf.to_lowercase();
                if !JUNK.iter().any(|k| low.contains(k)) {
                    out.push(open);
                    out.push_str(&buf);
                    out.push(ch);
                }
            }
            _ if depth == 1 => buf.push(ch),
            _ => out.push(ch),
        }
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Turn a raw YouTube video title + channel into a clean (title, artist).
/// Handles the ubiquitous "Artist - Title (Official Video)" shape.
#[cfg_attr(feature = "native-catalog", allow(dead_code))]
fn clean_yt_title(raw_title: &str, channel: &str) -> (String, String) {
    let cleaned = strip_promo_brackets(raw_title);
    let chan = channel
        .trim_end_matches(" - Topic")
        .trim_end_matches("VEVO")
        .trim()
        .to_string();
    // "Artist - Title" → split off the leading artist.
    if let Some((a, rest)) = cleaned.split_once(" - ") {
        let rest = rest.trim();
        if !rest.is_empty() && !a.trim().is_empty() {
            return (rest.to_string(), a.trim().to_string());
        }
    }
    (cleaned.trim().to_string(), chan)
}

/// Best-effort map of a yt-dlp JSON object to a `Track`.
#[cfg_attr(feature = "native-catalog", allow(dead_code))]
fn track_from_json(v: &Value) -> Option<Track> {
    let id = v.get("id")?.as_str()?.to_string();
    let raw_title = v.get("title").and_then(Value::as_str).unwrap_or("Unknown");
    let channel = v
        .get("uploader")
        .or_else(|| v.get("channel"))
        .or_else(|| v.get("artist"))
        .and_then(Value::as_str)
        .unwrap_or("");
    // YouTube titles are messy ("Artist - Title (Official Video)"); clean them so
    // they display nicely AND so the LRCLIB lyrics lookup (title/artist) matches.
    let (title, artist) = clean_yt_title(raw_title, channel);
    let duration_secs = v.get("duration").and_then(Value::as_f64).unwrap_or(0.0) as u32;
    // flat-playlist search results often omit thumbnails — derive one from the id.
    let art = {
        let t = best_thumbnail(v);
        if t.is_empty() { format!("https://i.ytimg.com/vi/{id}/mqdefault.jpg") } else { t }
    };
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
