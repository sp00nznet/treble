//! One error type for the whole core, serializable so it can be returned to the
//! frontend as a Tauri command error (the frontend gets a plain string).

use std::fmt;

#[derive(Debug)]
pub enum CoreError {
    /// An external tool (yt-dlp / ffmpeg) is missing from PATH and the bundle.
    ToolMissing(String),
    /// A child process ran but failed.
    Process(String),
    /// Network / HTTP failure (lyrics, etc.). Used as the lyrics/sync paths grow.
    #[allow(dead_code)]
    Network(String),
    /// Local database failure.
    Db(String),
    /// Anything that doesn't fit the buckets above.
    Other(String),
}

impl fmt::Display for CoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CoreError::ToolMissing(s) => write!(f, "required tool not found: {s} (run `npm run fetch-tools`)"),
            CoreError::Process(s) => write!(f, "process error: {s}"),
            CoreError::Network(s) => write!(f, "network error: {s}"),
            CoreError::Db(s) => write!(f, "database error: {s}"),
            CoreError::Other(s) => write!(f, "{s}"),
        }
    }
}

impl std::error::Error for CoreError {}

// Serialize as the Display string so the frontend gets a readable message.
impl serde::Serialize for CoreError {
    // Fully-qualified `Result` — the `Result<T>` alias below would shadow it here.
    fn serialize<S: serde::Serializer>(&self, s: S) -> std::result::Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

impl From<rusqlite::Error> for CoreError {
    fn from(e: rusqlite::Error) -> Self {
        CoreError::Db(e.to_string())
    }
}

impl From<std::io::Error> for CoreError {
    fn from(e: std::io::Error) -> Self {
        CoreError::Process(e.to_string())
    }
}

pub type Result<T> = std::result::Result<T, CoreError>;
