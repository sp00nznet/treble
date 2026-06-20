//! Time-synced lyrics via [LRCLIB](https://lrclib.net) — a free, open, no-key
//! community lyrics database. We ask for an exact match by artist/track (and
//! duration when known) and parse the LRC `[mm:ss.xx]` timestamps.

use crate::core::error::Result;
use crate::core::models::{LyricLine, Lyrics};
use serde_json::Value;

const BASE: &str = "https://lrclib.net/api";

/// Fetch lyrics for a track. Returns empty (`lines: []`) when nothing is found —
/// a missing lyric is normal, not an error.
pub fn fetch(title: &str, artist: &str, album: &str, duration_secs: u32) -> Result<Lyrics> {
    // Try the exact-get endpoint first (best quality match), then search.
    if let Some(l) = try_get(title, artist, album, duration_secs) {
        return Ok(l);
    }
    if let Some(l) = try_search(title, artist) {
        return Ok(l);
    }
    Ok(Lyrics::default())
}

fn try_get(title: &str, artist: &str, album: &str, duration_secs: u32) -> Option<Lyrics> {
    let mut url = format!(
        "{BASE}/get?track_name={}&artist_name={}",
        enc(title),
        enc(artist)
    );
    if !album.is_empty() {
        url.push_str(&format!("&album_name={}", enc(album)));
    }
    if duration_secs > 0 {
        url.push_str(&format!("&duration={duration_secs}"));
    }
    let v: Value = ureq::get(&url).call().ok()?.into_json().ok()?;
    parse_record(&v)
}

fn try_search(title: &str, artist: &str) -> Option<Lyrics> {
    let url = format!("{BASE}/search?track_name={}&artist_name={}", enc(title), enc(artist));
    let v: Value = ureq::get(&url).call().ok()?.into_json().ok()?;
    // search returns an array; take the first record that has any lyrics.
    v.as_array()?
        .iter()
        .find_map(parse_record)
}

/// Turn an LRCLIB record into our `Lyrics` (synced preferred, plain fallback).
fn parse_record(v: &Value) -> Option<Lyrics> {
    let synced = v.get("syncedLyrics").and_then(Value::as_str).unwrap_or("");
    if !synced.is_empty() {
        let lines = parse_lrc(synced);
        if !lines.is_empty() {
            return Some(Lyrics { synced: true, lines, plain: String::new() });
        }
    }
    let plain = v.get("plainLyrics").and_then(Value::as_str).unwrap_or("");
    if !plain.is_empty() {
        return Some(Lyrics { synced: false, lines: vec![], plain: plain.to_string() });
    }
    None
}

/// Parse LRC text: lines like `[01:23.45] some words`. Multiple timestamps per
/// line are expanded into one `LyricLine` each.
fn parse_lrc(lrc: &str) -> Vec<LyricLine> {
    let mut out = Vec::new();
    for raw in lrc.lines() {
        let mut rest = raw;
        let mut stamps = Vec::new();
        while rest.starts_with('[') {
            if let Some(end) = rest.find(']') {
                let inside = &rest[1..end];
                if let Some(secs) = parse_stamp(inside) {
                    stamps.push(secs);
                }
                rest = rest[end + 1..].trim_start();
            } else {
                break;
            }
        }
        let text = rest.trim().to_string();
        for time_secs in stamps {
            out.push(LyricLine { time_secs, text: text.clone() });
        }
    }
    out.sort_by(|a, b| a.time_secs.partial_cmp(&b.time_secs).unwrap_or(std::cmp::Ordering::Equal));
    out
}

/// "mm:ss.xx" or "mm:ss" → seconds.
fn parse_stamp(s: &str) -> Option<f64> {
    let (m, rest) = s.split_once(':')?;
    let mins: f64 = m.trim().parse().ok()?;
    let secs: f64 = rest.trim().parse().ok()?;
    Some(mins * 60.0 + secs)
}

/// Minimal percent-encoding for query values (RFC 3986 unreserved kept as-is).
fn enc(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}
