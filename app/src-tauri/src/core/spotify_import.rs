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

use crate::core::models::ParsedTrack;

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
}
