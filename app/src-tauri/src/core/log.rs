//! Dead-simple file logger. Writes timestamped lines to `treble.log` in the app
//! data dir (and to stderr in debug). Used to diagnose imports and playback in
//! the field — `get_log_path` exposes the location to the UI.

use std::io::Write;
use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

static LOG_PATH: OnceLock<PathBuf> = OnceLock::new();

pub fn init(path: PathBuf) {
    let _ = LOG_PATH.set(path);
}

pub fn path() -> Option<&'static PathBuf> {
    LOG_PATH.get()
}

/// Append a line with a seconds-since-epoch timestamp.
pub fn write(msg: &str) {
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let line = format!("[{secs}] {msg}");
    if let Some(p) = LOG_PATH.get() {
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(p) {
            let _ = writeln!(f, "{line}");
        }
    }
    #[cfg(debug_assertions)]
    eprintln!("{line}");
}

#[macro_export]
macro_rules! tlog {
    ($($arg:tt)*) => { $crate::core::log::write(&format!($($arg)*)) };
}
