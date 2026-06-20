//! Spotify playlist import — the clipboard parser.
//!
//! When you select tracks in the Spotify desktop app and copy, you get a block of
//! text on the clipboard. The exact shape varies by version, so this parser is
//! deliberately tolerant of the common forms:
//!
//! * Tab-separated `Title\tArtist\tAlbum\t…\t3:58`  (desktop "copy" of a row set)
//! * `Title - Artist`  /  `Title – Artist`  /  `Title — Artist`
//! * `Title by Artist`
//! * Numbered lists (`1. Title - Artist`)
//!
//! The output is matched against the catalog (see `catalog::search`) elsewhere;
//! this module's only job is text → structured `ParsedTrack`s.

use crate::core::error::Result;
use crate::core::models::ParsedTrack;

/// Parse an **Exportify CSV** (github.com/watsonbox/exportify) — a Spotify
/// playlist exported with full metadata via the Spotify API. This is the reliable
/// path for big playlists: every track already has title/artist/album/duration, so
/// there's no per-track Spotify lookup (and no rate-limiting). Returns `None` if
/// the text isn't a recognizable Exportify CSV.
pub fn parse_csv(text: &str) -> Option<Vec<ParsedTrack>> {
    let mut lines = text.lines();
    let header = lines.next()?;
    let cols = csv_split(header);
    let find = |name: &str| cols.iter().position(|c| c.eq_ignore_ascii_case(name));
    let title_i = find("Track Name")?;
    let artist_i = find("Artist Name(s)").or_else(|| find("Artist Name"))?;
    let album_i = find("Album Name");
    let dur_i = find("Track Duration (ms)").or_else(|| find("Duration (ms)"));

    let mut out = Vec::new();
    for line in lines {
        if line.trim().is_empty() {
            continue;
        }
        let f = csv_split(line);
        let at = |i: usize| f.get(i).cloned().unwrap_or_default();
        let title = at(title_i);
        if title.is_empty() {
            continue;
        }
        let dur_ms: u64 = dur_i.map(|i| at(i)).and_then(|s| s.parse().ok()).unwrap_or(0);
        let duration = if dur_ms > 0 { format!("{}:{:02}", dur_ms / 60000, (dur_ms / 1000) % 60) } else { String::new() };
        out.push(ParsedTrack {
            title,
            artist: at(artist_i),
            album: album_i.map(at).unwrap_or_default(),
            duration,
        });
    }
    Some(out)
}

/// Split one CSV line, honoring quoted fields (incl. escaped `""`).
fn csv_split(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut cur = String::new();
    let mut in_q = false;
    let mut chars = line.chars().peekable();
    while let Some(c) = chars.next() {
        if in_q {
            if c == '"' {
                if chars.peek() == Some(&'"') {
                    cur.push('"');
                    chars.next();
                } else {
                    in_q = false;
                }
            } else {
                cur.push(c);
            }
        } else {
            match c {
                '"' => in_q = true,
                ',' => {
                    fields.push(cur.trim().to_string());
                    cur.clear();
                }
                _ => cur.push(c),
            }
        }
    }
    fields.push(cur.trim().to_string());
    fields
}

/// Pull Spotify **track IDs** out of pasted text. Copying tracks in the Spotify
/// desktop app puts a list of `https://open.spotify.com/track/<id>` URLs (or
/// `spotify:track:<id>` URIs) on the clipboard — NOT "Title — Artist" text — so
/// these have to be resolved to real metadata before matching (see `resolve_id`).
/// IDs are 22-char base62.
pub fn extract_track_ids(text: &str) -> Vec<String> {
    let mut ids = Vec::new();
    let bytes = text.as_bytes();
    let mut i = 0;
    while let Some(p) = text[i..].find("track") {
        let after = i + p + "track".len();
        if after < text.len() && (bytes[after] == b'/' || bytes[after] == b':') {
            let id: String = text[after + 1..].chars().take_while(|c| c.is_ascii_alphanumeric()).collect();
            if id.len() >= 22 {
                ids.push(id[..22].to_string());
            }
            i = after + 1 + id.len();
        } else {
            i = after;
        }
    }
    ids
}

/// Resolve one Spotify track ID to title/artist/duration via the public embed
/// page (no auth, no API key). Retries with backoff to ride out rate-limiting
/// (Spotify throttles after a few hundred rapid requests). Returns `None` only
/// after all attempts fail.
pub fn resolve_id(id: &str) -> Option<ParsedTrack> {
    for attempt in 0u64..4 {
        if attempt > 0 {
            std::thread::sleep(std::time::Duration::from_millis(300 * attempt));
        }
        match fetch_track(id) {
            Ok(t) => return Some(t),
            Err(retryable) if !retryable => break, // 404 etc — don't retry
            Err(_) => continue,
        }
    }
    crate::tlog!("spotify resolve failed: {id}");
    None
}

/// Returns Ok(track) or Err(retryable). `retryable` is false for a definitive
/// "not found" so we don't waste retries.
fn fetch_track(id: &str) -> std::result::Result<ParsedTrack, bool> {
    let url = format!("https://open.spotify.com/embed/track/{id}");
    let resp = ureq::get(&url).set("User-Agent", "Mozilla/5.0").call();
    let html = match resp {
        Ok(r) => r.into_string().map_err(|_| true)?,
        Err(ureq::Error::Status(404, _)) => return Err(false),
        Err(_) => return Err(true), // 429/5xx/network — retry
    };
    let obj = extract_entity(&html).ok_or(true)?;
    let v: serde_json::Value = serde_json::from_str(&obj).map_err(|_| true)?;
    let title = v.get("name").or_else(|| v.get("title")).and_then(|x| x.as_str()).ok_or(true)?.to_string();
    let artist = v
        .get("artists")
        .and_then(|a| a.as_array())
        .map(|a| a.iter().filter_map(|x| x.get("name").and_then(|n| n.as_str())).collect::<Vec<_>>().join(", "))
        .unwrap_or_default();
    let dur_ms = v.get("duration").and_then(|d| d.as_u64()).unwrap_or(0);
    let duration = if dur_ms > 0 { format!("{}:{:02}", dur_ms / 60000, (dur_ms / 1000) % 60) } else { String::new() };
    Ok(ParsedTrack { title, artist, album: String::new(), duration })
}

/// Extract the balanced `{...}` object that follows `"entity":` in the embed page.
fn extract_entity(html: &str) -> Option<String> {
    let key = "\"entity\":";
    let start = html.find(key)? + key.len();
    let bytes = html.as_bytes();
    let mut i = start;
    while i < html.len() && bytes[i] != b'{' {
        i += 1;
    }
    let begin = i;
    let (mut depth, mut in_str, mut esc) = (0i32, false, false);
    while i < html.len() {
        let c = bytes[i];
        if in_str {
            if esc {
                esc = false;
            } else if c == b'\\' {
                esc = true;
            } else if c == b'"' {
                in_str = false;
            }
        } else {
            match c {
                b'"' => in_str = true,
                b'{' => depth += 1,
                b'}' => {
                    depth -= 1;
                    if depth == 0 {
                        return Some(html[begin..=i].to_string());
                    }
                }
                _ => {}
            }
        }
        i += 1;
    }
    None
}

/// Sequential resolve of many IDs (non-native fallback; the default build resolves
/// these concurrently — see `catalog_native::resolve_spotify`).
#[cfg_attr(feature = "native-catalog", allow(dead_code))]
pub fn resolve_ids_seq(ids: &[String], mut on_progress: impl FnMut(usize)) -> Result<Vec<ParsedTrack>> {
    let mut out = Vec::new();
    for (i, id) in ids.iter().enumerate() {
        if let Some(p) = resolve_id(id) {
            out.push(p);
        }
        on_progress(i + 1);
    }
    Ok(out)
}

/// Parse a pasted Spotify selection into tracks. Unparseable / header lines are skipped.
pub fn parse(text: &str) -> Vec<ParsedTrack> {
    let mut out = Vec::new();
    for raw in text.lines() {
        let line = strip_numbering(raw.trim());
        if line.is_empty() || is_header(line) {
            continue;
        }
        if let Some(t) = parse_line(line) {
            if !t.title.is_empty() {
                out.push(t);
            }
        }
    }
    out
}

fn parse_line(line: &str) -> Option<ParsedTrack> {
    // Tab-separated (richest form).
    if line.contains('\t') {
        let cols: Vec<&str> = line.split('\t').map(str::trim).filter(|c| !c.is_empty()).collect();
        if cols.len() >= 2 {
            let duration = cols.last().filter(|c| looks_like_duration(c)).map(|c| c.to_string());
            return Some(ParsedTrack {
                title: cols[0].to_string(),
                artist: cols[1].to_string(),
                album: cols.get(2).filter(|c| !looks_like_duration(c)).map(|c| c.to_string()).unwrap_or_default(),
                duration: duration.unwrap_or_default(),
            });
        }
    }
    // "Title <sep> Artist" with a few dash variants, or "Title by Artist".
    for sep in [" — ", " – ", " - ", " by "] {
        if let Some((title, artist)) = line.split_once(sep) {
            let title = title.trim();
            let artist = artist.trim();
            if !title.is_empty() && !artist.is_empty() {
                return Some(ParsedTrack {
                    title: title.to_string(),
                    artist: artist.to_string(),
                    album: String::new(),
                    duration: String::new(),
                });
            }
        }
    }
    // Bare title (artist unknown — matcher will still try).
    Some(ParsedTrack { title: line.to_string(), ..Default::default() })
}

/// Drop leading list numbering like "12." or "3)" or "•".
fn strip_numbering(s: &str) -> &str {
    let s = s.trim_start_matches(['•', '-', '*']).trim_start();
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() && bytes[i].is_ascii_digit() {
        i += 1;
    }
    if i > 0 && i < bytes.len() && (bytes[i] == b'.' || bytes[i] == b')') {
        return s[i + 1..].trim_start();
    }
    s
}

fn is_header(line: &str) -> bool {
    let l = line.to_ascii_lowercase();
    matches!(l.as_str(), "title" | "artist" | "album" | "#" | "title\tartist" | "date added")
}

/// "3:58" / "12:05" looks like a duration.
fn looks_like_duration(s: &str) -> bool {
    matches!(s.split_once(':'), Some((m, sec))
        if !m.is_empty() && m.chars().all(|c| c.is_ascii_digit())
            && sec.len() == 2 && sec.chars().all(|c| c.is_ascii_digit()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tab_separated() {
        let t = parse("Midnight Coast\tHalsey Lane\tNeon Tide\t3:58");
        assert_eq!(t.len(), 1);
        assert_eq!(t[0].title, "Midnight Coast");
        assert_eq!(t[0].artist, "Halsey Lane");
        assert_eq!(t[0].album, "Neon Tide");
        assert_eq!(t[0].duration, "3:58");
    }

    #[test]
    fn dash_and_numbering() {
        let t = parse("1. Golden — The Idle Hours\n2) Hollow - Atlas Bay");
        assert_eq!(t.len(), 2);
        assert_eq!(t[0].title, "Golden");
        assert_eq!(t[0].artist, "The Idle Hours");
        assert_eq!(t[1].artist, "Atlas Bay");
    }

    #[test]
    fn skips_headers_and_blanks() {
        let t = parse("Title\tArtist\n\nPaper Planes\tNorah Vale");
        assert_eq!(t.len(), 1);
        assert_eq!(t[0].title, "Paper Planes");
    }

    #[test]
    fn csv_exportify() {
        let csv = "\"Track URI\",\"Track Name\",\"Artist Name(s)\",\"Album Name\",\"Track Duration (ms)\"\n\
                   \"spotify:track:abc\",\"Get Lucky\",\"Daft Punk, Pharrell Williams\",\"Random Access Memories\",\"369000\"";
        let r = parse_csv(csv).expect("should parse exportify csv");
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].title, "Get Lucky");
        assert_eq!(r[0].artist, "Daft Punk, Pharrell Williams");
        assert_eq!(r[0].album, "Random Access Memories");
        assert_eq!(r[0].duration, "6:09");
    }

    #[test]
    fn csv_rejects_plain_text() {
        assert!(parse_csv("Get Lucky — Daft Punk\nHello — Adele").is_none());
    }

    #[test]
    fn extract_ids_from_urls() {
        let ids = extract_track_ids("https://open.spotify.com/track/7cHRys0Lhk9642dLaPUMkm?si=x\nspotify:track:6E48z2ncRLN3BJncBKkmRl");
        assert_eq!(ids, vec!["7cHRys0Lhk9642dLaPUMkm", "6E48z2ncRLN3BJncBKkmRl"]);
    }
}
