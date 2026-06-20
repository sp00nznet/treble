//! Real offline downloads. Shells out to `yt-dlp` to fetch best audio and
//! `ffmpeg` (invoked by yt-dlp) to transcode to mp3, streaming progress back via
//! a callback so the UI's Downloads screen can show a live bar.
//!
//! Output path is deterministic — `<dir>/<id>.mp3` — so the caller knows where the
//! file landed without parsing yt-dlp's output.

use crate::core::error::{CoreError, Result};
use crate::core::tools;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::Stdio;

/// Download by fetching a resolved stream URL directly — no yt-dlp/ffmpeg needed.
/// Saves the raw audio stream; the container (m4a / webm) is whatever the source
/// serves, both of which play fine in the webview. Progress comes from
/// Content-Length when present.
pub fn download_native<F: FnMut(f32)>(url: &str, dir: &Path, id: &str, mut on_progress: F) -> Result<PathBuf> {
    std::fs::create_dir_all(dir)?;
    let resp = ureq::get(url).call().map_err(|e| CoreError::Network(e.to_string()))?;
    let total: f64 = resp.header("Content-Length").and_then(|s| s.parse().ok()).unwrap_or(0.0);
    let ext = match resp.content_type() {
        ct if ct.contains("webm") => "webm",
        ct if ct.contains("mp4") || ct.contains("m4a") || ct.contains("aac") => "m4a",
        ct if ct.contains("mpeg") || ct.contains("mp3") => "mp3",
        _ => "m4a",
    };
    let target = dir.join(format!("{id}.{ext}"));
    let mut reader = resp.into_reader();
    let mut file = std::fs::File::create(&target)?;
    let mut buf = [0u8; 64 * 1024];
    let mut written: f64 = 0.0;
    loop {
        let n = reader.read(&mut buf)?;
        if n == 0 {
            break;
        }
        file.write_all(&buf[..n])?;
        written += n as f64;
        if total > 0.0 {
            on_progress(((written / total) * 100.0).min(99.0) as f32);
        }
    }
    on_progress(100.0);
    Ok(target)
}

/// Download a track's audio to `dir` as mp3. `on_progress` is called with 0.0–100.0.
/// Returns the path to the finished file.
pub fn download<F: FnMut(f32)>(id: &str, dir: &Path, mut on_progress: F) -> Result<PathBuf> {
    std::fs::create_dir_all(dir)?;
    let out_template = dir.join("%(id)s.%(ext)s");
    let target = dir.join(format!("{id}.mp3"));

    let mut child = tools::command("yt-dlp")?
        .args([
            "-x",
            "--audio-format",
            "mp3",
            "--audio-quality",
            "0",
            "-o",
        ])
        .arg(&out_template)
        .args(["--newline", "--no-warnings", "--no-playlist", id])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    if let Some(stdout) = child.stdout.take() {
        for line in BufReader::new(stdout).lines().map_while(|l| l.ok()) {
            if let Some(pct) = parse_progress(&line) {
                on_progress(pct);
            }
        }
    }

    let status = child.wait()?;
    if !status.success() {
        let mut err = String::new();
        if let Some(stderr) = child.stderr.take() {
            for line in BufReader::new(stderr).lines().map_while(|l| l.ok()) {
                err.push_str(&line);
                err.push('\n');
            }
        }
        return Err(CoreError::Process(format!("yt-dlp failed: {}", err.trim())));
    }

    on_progress(100.0);
    if target.is_file() {
        Ok(target)
    } else {
        Err(CoreError::Other(format!("download finished but {} is missing", target.display())))
    }
}

/// Parse a yt-dlp `--newline` progress line like `[download]  42.3% of  4.10MiB ...`.
fn parse_progress(line: &str) -> Option<f32> {
    let line = line.trim();
    if !line.starts_with("[download]") {
        return None;
    }
    let pct = line.split_whitespace().find(|tok| tok.ends_with('%'))?;
    pct.trim_end_matches('%').parse::<f32>().ok()
}
