//! Locates the external binaries Treble shells out to on desktop (`yt-dlp`,
//! `ffmpeg`). They are looked up first in the app's bundled `binaries/` directory
//! (populated by `npm run fetch-tools`), then on the system `PATH`.

use crate::core::error::{CoreError, Result};
use std::path::PathBuf;
use std::process::Command;

/// Platform-specific executable name.
fn exe(name: &str) -> String {
    if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_string()
    }
}

/// Directory next to the running executable where bundled tools live.
fn bundled_dir() -> Option<PathBuf> {
    let exe_path = std::env::current_exe().ok()?;
    let dir = exe_path.parent()?.join("binaries");
    if dir.is_dir() {
        Some(dir)
    } else {
        // Dev fallback: `app/src-tauri/binaries` relative to the crate.
        let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries");
        dev.is_dir().then_some(dev)
    }
}

/// Resolve a tool to an invocable path. Returns the bare name (relying on PATH)
/// if no bundled copy exists — the actual run will surface a clear error if it's
/// genuinely missing.
pub fn resolve(name: &str) -> String {
    if let Some(dir) = bundled_dir() {
        let candidate = dir.join(exe(name));
        if candidate.is_file() {
            return candidate.to_string_lossy().into_owned();
        }
    }
    name.to_string()
}

/// True if a tool can actually be invoked (used for friendly "missing tool" errors).
pub fn is_available(name: &str) -> bool {
    let path = resolve(name);
    Command::new(&path)
        .arg("--version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Build a `Command` for a tool, erroring early if it's clearly unavailable.
pub fn command(name: &str) -> Result<Command> {
    let path = resolve(name);
    if !is_available(name) {
        return Err(CoreError::ToolMissing(name.to_string()));
    }
    Ok(Command::new(path))
}
