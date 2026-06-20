//! Native cross-platform catalog via [`rustypipe`](https://codeberg.org/ThetaDev/rustypipe)
//! — a pure-Rust YouTube/YouTube-Music InnerTube client. No `yt-dlp`/Python, so
//! the same code resolves music on the phone and the desktop. Default engine.
//!
//! A single shared `RustyPipe` client + Tokio runtime are reused across all calls
//! (connection pooling — critical for bulk Spotify imports of thousands of tracks,
//! which previously built one HTTP client per track and exhausted resources).

use crate::core::catalog::{parse_duration, score_match};
use crate::core::error::{CoreError, Result};
use crate::core::models::{BulkRow, ParsedTrack, Track};
use rustypipe::client::RustyPipe;
use rustypipe::param::StreamFilter;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;

fn runtime() -> &'static tokio::runtime::Runtime {
    static RT: OnceLock<tokio::runtime::Runtime> = OnceLock::new();
    RT.get_or_init(|| {
        tokio::runtime::Builder::new_multi_thread()
            .worker_threads(4)
            .enable_all()
            .build()
            .expect("failed to build Tokio runtime")
    })
}

fn client() -> &'static RustyPipe {
    static RP: OnceLock<RustyPipe> = OnceLock::new();
    RP.get_or_init(|| RustyPipe::builder().build().expect("failed to build RustyPipe client"))
}

// ---- async core ----

async fn search_async(query: &str, limit: u32) -> Result<Vec<Track>> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }
    let res = client()
        .query()
        .music_search_tracks(query)
        .await
        .map_err(|e| CoreError::Network(e.to_string()))?;
    Ok(res.items.items.into_iter().take(limit as usize).map(track_from_item).collect())
}

async fn resolve_async(id: &str) -> Result<String> {
    let work = async {
        let player = client()
            .query()
            .player(id)
            .await
            .map_err(|e| CoreError::Network(e.to_string()))?;
        let stream = player
            .select_audio_stream(&StreamFilter::default())
            .ok_or_else(|| CoreError::Other(format!("no audio stream for {id}")))?;
        Ok(stream.url.clone())
    };
    match tokio::time::timeout(std::time::Duration::from_secs(25), work).await {
        Ok(r) => r,
        Err(_) => Err(CoreError::Other(format!("stream resolve timed out for {id}"))),
    }
}

/// Score and rank candidates for one parsed track.
async fn candidates_for(parsed: &ParsedTrack, limit: usize) -> Vec<Track> {
    let query = if parsed.artist.is_empty() {
        parsed.title.clone()
    } else {
        format!("{} {}", parsed.title, parsed.artist)
    };
    let want = parse_duration(&parsed.duration);
    let found = search_async(&query, 6).await.unwrap_or_default();
    let mut scored: Vec<(Track, f64)> = found
        .into_iter()
        .map(|t| {
            let s = score_match(parsed, &t, want);
            (t, s)
        })
        .collect();
    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(limit.max(1));
    scored.into_iter().map(|(t, _)| t).collect()
}

// ---- sync wrappers (called from non-runtime threads) ----

pub fn search(query: &str, limit: u32) -> Result<Vec<Track>> {
    runtime().block_on(search_async(query, limit))
}

pub fn resolve_stream(id: &str) -> Result<String> {
    runtime().block_on(resolve_async(id))
}

/// Match many parsed tracks against the catalog **concurrently**, reusing the
/// shared client. `candidates_per` controls how many ranked candidates each row
/// keeps (1 for auto-import, more for the review UI). `on_progress(done, current)`
/// is invoked as each row completes; `cancel` stops the run early.
pub fn match_bulk(
    parsed: &[ParsedTrack],
    candidates_per: usize,
    concurrency: usize,
    cancel: &AtomicBool,
    mut on_progress: impl FnMut(usize, &str),
) -> Vec<BulkRow> {
    use futures::stream::{self, StreamExt};

    runtime().block_on(async move {
        let mut rows: Vec<BulkRow> = Vec::with_capacity(parsed.len());
        let mut stream = stream::iter(parsed.iter().enumerate())
            .map(|(index, p)| async move {
                let candidates = candidates_for(p, candidates_per).await;
                let confident = candidates
                    .first()
                    .map(|t| score_match(p, t, parse_duration(&p.duration)) >= crate::core::catalog::CONFIDENT_SCORE)
                    .unwrap_or(false);
                BulkRow { index, candidates, confident }
            })
            .buffer_unordered(concurrency.max(1));

        let mut done = 0usize;
        while let Some(row) = stream.next().await {
            if cancel.load(Ordering::Relaxed) {
                break;
            }
            done += 1;
            let label = parsed.get(row.index).map(|p| p.title.as_str()).unwrap_or("");
            on_progress(done, label);
            rows.push(row);
        }
        rows.sort_by_key(|r| r.index);
        rows
    })
}

/// Resolve many Spotify track IDs to metadata **concurrently** (the embed fetches
/// are blocking ureq calls run on the Tokio blocking pool). Preserves order and
/// drops the few that fail. `on_progress(done)` streams; `cancel` stops early.
pub fn resolve_spotify(
    ids: &[String],
    concurrency: usize,
    cancel: &AtomicBool,
    mut on_progress: impl FnMut(usize),
) -> Vec<ParsedTrack> {
    use futures::stream::{self, StreamExt};

    runtime().block_on(async move {
        let mut indexed: Vec<(usize, ParsedTrack)> = Vec::with_capacity(ids.len());
        let mut stream = stream::iter(ids.iter().cloned().enumerate())
            .map(|(i, id)| async move {
                let p = tokio::task::spawn_blocking(move || crate::core::spotify_import::resolve_id(&id))
                    .await
                    .ok()
                    .flatten();
                (i, p)
            })
            .buffer_unordered(concurrency.max(1));

        let mut done = 0usize;
        while let Some((i, p)) = stream.next().await {
            if cancel.load(Ordering::Relaxed) {
                break;
            }
            done += 1;
            on_progress(done);
            if let Some(p) = p {
                indexed.push((i, p));
            }
        }
        indexed.sort_by_key(|(i, _)| *i);
        indexed.into_iter().map(|(_, p)| p).collect()
    })
}

fn track_from_item(t: rustypipe::model::TrackItem) -> Track {
    let secs = t.duration.unwrap_or(0);
    let artist = t.artists.into_iter().map(|a| a.name).collect::<Vec<_>>().join(", ");
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
        rating: 0,
    }
}

#[cfg(test)]
mod tests {
    // Network test — run explicitly with:
    //   cargo test --features native-catalog live_ -- --ignored --nocapture
    #[test]
    #[ignore]
    fn live_search() {
        let r = super::search("daft punk get lucky", 3).expect("search failed");
        for t in &r {
            println!("  {} — {} ({})  id={}", t.title, t.artist, t.duration, t.id);
        }
        assert!(!r.is_empty(), "rustypipe returned no results");
    }

    #[test]
    #[ignore]
    fn live_stream_fetchable() {
        let r = super::search("rick astley never gonna give you up", 1).expect("search");
        let url = super::resolve_stream(&r[0].id).expect("resolve");
        println!("URL host: {}", url.split('/').nth(2).unwrap_or("?"));
        // Mimic what an <audio> element does: a ranged GET.
        let resp = ureq::get(&url).set("Range", "bytes=0-2047").call();
        match resp {
            Ok(r) => println!(
                "OK status={} type={:?} len={:?} accept-ranges={:?}",
                r.status(),
                r.header("content-type"),
                r.header("content-length"),
                r.header("accept-ranges"),
            ),
            Err(ureq::Error::Status(c, r)) => println!("HTTP {} type={:?}", c, r.header("content-type")),
            Err(e) => println!("ERR {e}"),
        }
    }

    #[test]
    #[ignore]
    fn live_bulk() {
        use crate::core::models::ParsedTrack;
        use std::sync::atomic::AtomicBool;
        let titles = [
            ("Daft Punk", "Get Lucky"),
            ("Rick Astley", "Never Gonna Give You Up"),
            ("Adele", "Hello"),
            ("The Weeknd", "Blinding Lights"),
            ("Fleetwood Mac", "Dreams"),
        ];
        let parsed: Vec<ParsedTrack> = titles
            .iter()
            .map(|(a, t)| ParsedTrack { title: t.to_string(), artist: a.to_string(), ..Default::default() })
            .collect();
        let cancel = AtomicBool::new(false);
        let rows = super::match_bulk(&parsed, 1, 4, &cancel, |d, c| println!("  progress {d}: {c}"));
        for r in &rows {
            let best = r.candidates.first().map(|t| format!("{} — {}", t.title, t.artist));
            println!("  [{}] {:?} -> {:?}", r.index, parsed[r.index].title, best);
        }
        assert_eq!(rows.len(), parsed.len());
        assert!(rows.iter().all(|r| !r.candidates.is_empty()), "some rows had no match");
    }

    // End-to-end on the real Spotify URL dump: extract ids → resolve metadata →
    // match on YouTube Music.
    #[test]
    #[ignore]
    fn live_spotify_import() {
        use std::sync::atomic::AtomicBool;
        let text = std::fs::read_to_string("D:/junk/spotify.txt").expect("read spotify.txt");
        let ids = crate::core::spotify_import::extract_track_ids(&text);
        println!("extracted {} track ids", ids.len());
        let sample: Vec<String> = ids.into_iter().take(10).collect();
        let cancel = AtomicBool::new(false);
        let parsed = super::resolve_spotify(&sample, 8, &cancel, |_| {});
        for p in &parsed {
            println!("  SPOTIFY: {} — {} ({})", p.title, p.artist, p.duration);
        }
        let rows = super::match_bulk(&parsed, 1, 8, &cancel, |_, _| {});
        for r in &rows {
            let best = r.candidates.first().map(|t| format!("{} — {}", t.title, t.artist));
            println!("  YT[{}]: {} -> {:?}", r.index, parsed[r.index].title, best);
        }
        let matched = rows.iter().filter(|r| !r.candidates.is_empty()).count();
        println!("MATCHED {}/{}", matched, parsed.len());
        assert!(!parsed.is_empty(), "spotify resolution returned nothing");
        assert!(matched * 2 >= parsed.len(), "less than half matched");
    }
}
