//! Podcasts. Shows are discovered via the **iTunes Search API** (no key needed),
//! which hands back each show's RSS `feedUrl`. Episodes come from parsing that
//! feed; an episode's audio is a direct enclosure URL (usually MP3), so it plays
//! straight in the webview — no yt-dlp involved.

use crate::core::error::{CoreError, Result};
use crate::core::models::Track;
use serde::Serialize;
use serde_json::Value;

#[derive(Serialize, Clone)]
pub struct Podcast {
    pub id: String,
    pub title: String,
    pub author: String,
    pub art: String,
    pub feed_url: String,
}

/// Search Apple Podcasts for shows.
pub fn search(query: &str) -> Result<Vec<Podcast>> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }
    let url = format!("https://itunes.apple.com/search?media=podcast&limit=25&term={}", enc(query));
    let v: Value = ureq::get(&url)
        .call()
        .map_err(|e| CoreError::Network(e.to_string()))?
        .into_json()
        .map_err(|e| CoreError::Network(e.to_string()))?;
    let out = v["results"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|r| {
                    let feed_url = r["feedUrl"].as_str()?.to_string();
                    Some(Podcast {
                        id: r["collectionId"].as_i64().map(|i| i.to_string()).unwrap_or_else(|| feed_url.clone()),
                        title: r["collectionName"].as_str().unwrap_or("Podcast").to_string(),
                        author: r["artistName"].as_str().unwrap_or("").to_string(),
                        art: r["artworkUrl600"].as_str().or_else(|| r["artworkUrl100"].as_str()).unwrap_or("").to_string(),
                        feed_url,
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    Ok(out)
}

/// Fetch + parse a show's RSS feed into playable episodes (newest first).
pub fn episodes(feed_url: &str, show_art: &str) -> Result<Vec<Track>> {
    let resp = ureq::get(feed_url).call().map_err(|e| CoreError::Network(e.to_string()))?;
    let reader = std::io::BufReader::new(resp.into_reader());
    let channel = rss::Channel::read_from(reader).map_err(|e| CoreError::Other(format!("bad RSS feed: {e}")))?;

    let show = channel.title().to_string();
    let chan_art = channel
        .itunes_ext()
        .and_then(|e| e.image())
        .map(|s| s.to_string())
        .or_else(|| channel.image().map(|i| i.url().to_string()))
        .unwrap_or_else(|| show_art.to_string());

    let mut out = Vec::new();
    for item in channel.items() {
        let Some(enc) = item.enclosure() else { continue };
        let url = enc.url().to_string();
        if url.is_empty() {
            continue;
        }
        let secs = item.itunes_ext().and_then(|e| e.duration()).map(parse_duration).unwrap_or(0);
        let art = item
            .itunes_ext()
            .and_then(|e| e.image())
            .map(|s| s.to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| chan_art.clone());
        out.push(Track {
            id: url, // a direct audio URL — resolves to itself for playback
            title: item.title().unwrap_or("Episode").to_string(),
            artist: show.clone(),
            album: show.clone(),
            duration: Track::fmt_duration(secs),
            duration_secs: secs,
            art,
            downloaded: false,
            rating: 0,
        });
    }
    Ok(out)
}

/// iTunes `duration` is "S", "M:SS", or "H:MM:SS".
fn parse_duration(s: &str) -> u32 {
    let parts: Vec<&str> = s.trim().split(':').collect();
    let mut total = 0u32;
    for p in &parts {
        total = total * 60 + p.parse::<u32>().unwrap_or(0);
    }
    total
}

#[cfg(test)]
mod tests {
    #[test]
    #[ignore] // network — cargo test live_podcasts -- --ignored --nocapture
    fn live_podcasts() {
        let shows = super::search("the daily").expect("search");
        println!("found {} shows", shows.len());
        for s in shows.iter().take(3) {
            println!("  {} — {}", s.title, s.author);
        }
        assert!(!shows.is_empty());
        let eps = super::episodes(&shows[0].feed_url, &shows[0].art).expect("episodes");
        println!("'{}' has {} episodes", shows[0].title, eps.len());
        for e in eps.iter().take(3) {
            println!("  ep: {} ({}) {}", e.title, e.duration, &e.id[..e.id.len().min(70)]);
        }
        assert!(!eps.is_empty());
    }
}

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
