//! The local library — a single, portable SQLite database holding playlists,
//! their tracks, liked songs, and download state. This file is the unit of LAN
//! sync (see `core::sync`): it's the whole "your library" in one place.

use crate::core::error::Result;
use crate::core::models::{Playlist, Track};
use rusqlite::{params, Connection};
use std::sync::Mutex;

/// Thread-safe handle to the library DB. Held as Tauri managed state.
pub struct Library {
    conn: Mutex<Connection>,
}

impl Library {
    /// Open (creating if needed) the library at `path` and ensure the schema.
    pub fn open(path: &std::path::Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        let conn = Connection::open(path)?;
        let lib = Library { conn: Mutex::new(conn) };
        lib.init_schema()?;
        Ok(lib)
    }

    fn init_schema(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS tracks (
                id            TEXT PRIMARY KEY,
                title         TEXT NOT NULL,
                artist        TEXT NOT NULL DEFAULT '',
                album         TEXT NOT NULL DEFAULT '',
                duration_secs INTEGER NOT NULL DEFAULT 0,
                art           TEXT NOT NULL DEFAULT '',
                downloaded    INTEGER NOT NULL DEFAULT 0,
                file_path     TEXT
            );
            CREATE TABLE IF NOT EXISTS playlists (
                id       TEXT PRIMARY KEY,
                title    TEXT NOT NULL,
                subtitle TEXT NOT NULL DEFAULT '',
                art      TEXT NOT NULL DEFAULT '',
                created  INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS playlist_tracks (
                playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
                track_id    TEXT NOT NULL REFERENCES tracks(id),
                position    INTEGER NOT NULL,
                PRIMARY KEY (playlist_id, track_id)
            );
            CREATE TABLE IF NOT EXISTS liked (
                track_id TEXT PRIMARY KEY REFERENCES tracks(id),
                added    INTEGER NOT NULL DEFAULT 0
            );
            "#,
        )?;
        Ok(())
    }

    /// Upsert a track row (the catalog is the source of truth for metadata).
    fn upsert_track(conn: &Connection, t: &Track) -> Result<()> {
        conn.execute(
            "INSERT INTO tracks (id, title, artist, album, duration_secs, art, downloaded)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(id) DO UPDATE SET
                title=excluded.title, artist=excluded.artist, album=excluded.album,
                duration_secs=excluded.duration_secs, art=excluded.art",
            params![t.id, t.title, t.artist, t.album, t.duration_secs, t.art, t.downloaded as i64],
        )?;
        Ok(())
    }

    /// All playlists (without their tracks) for the library view.
    pub fn list_playlists(&self) -> Result<Vec<Playlist>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT p.id, p.title, p.subtitle, p.art,
                    (SELECT COUNT(*) FROM playlist_tracks pt WHERE pt.playlist_id = p.id)
             FROM playlists p ORDER BY p.created DESC",
        )?;
        let rows = stmt.query_map([], |r| {
            let count: i64 = r.get(4)?;
            Ok(Playlist {
                id: r.get(0)?,
                title: r.get(1)?,
                subtitle: {
                    let s: String = r.get(2)?;
                    if s.is_empty() { format!("{count} songs") } else { s }
                },
                art: r.get(3)?,
                tracks: vec![],
            })
        })?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    /// One playlist with its ordered tracks.
    pub fn get_playlist(&self, id: &str) -> Result<Option<Playlist>> {
        let conn = self.conn.lock().unwrap();
        let mut pl = match conn.query_row(
            "SELECT id, title, subtitle, art FROM playlists WHERE id = ?1",
            params![id],
            |r| Ok(Playlist { id: r.get(0)?, title: r.get(1)?, subtitle: r.get(2)?, art: r.get(3)?, tracks: vec![] }),
        ) {
            Ok(p) => p,
            Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
            Err(e) => return Err(e.into()),
        };
        let mut stmt = conn.prepare(
            "SELECT t.id, t.title, t.artist, t.album, t.duration_secs, t.art, t.downloaded
             FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id
             WHERE pt.playlist_id = ?1 ORDER BY pt.position",
        )?;
        let rows = stmt.query_map(params![id], |r| {
            let secs: u32 = r.get(4)?;
            Ok(Track {
                id: r.get(0)?,
                title: r.get(1)?,
                artist: r.get(2)?,
                album: r.get(3)?,
                duration: Track::fmt_duration(secs),
                duration_secs: secs,
                art: r.get(5)?,
                downloaded: r.get::<_, i64>(6)? != 0,
            })
        })?;
        pl.tracks = rows.filter_map(|r| r.ok()).collect();
        Ok(Some(pl))
    }

    /// Create a playlist with the given tracks. Returns the new playlist id.
    pub fn create_playlist(&self, title: &str, tracks: &[Track]) -> Result<String> {
        let id = slug(title);
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO playlists (id, title, subtitle, art, created)
             VALUES (?1, ?2, '', ?3, strftime('%s','now'))",
            params![id, title, tracks.first().map(|t| t.art.clone()).unwrap_or_default()],
        )?;
        for (pos, t) in tracks.iter().enumerate() {
            Self::upsert_track(&conn, t)?;
            conn.execute(
                "INSERT OR REPLACE INTO playlist_tracks (playlist_id, track_id, position)
                 VALUES (?1, ?2, ?3)",
                params![id, t.id, pos as i64],
            )?;
        }
        Ok(id)
    }

    /// Mark a track downloaded (and where its file lives).
    pub fn mark_downloaded(&self, track_id: &str, file_path: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE tracks SET downloaded = 1, file_path = ?2 WHERE id = ?1",
            params![track_id, file_path],
        )?;
        Ok(())
    }

    /// Every downloaded track (the Downloads screen).
    pub fn list_downloaded(&self) -> Result<Vec<Track>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, title, artist, album, duration_secs, art FROM tracks WHERE downloaded = 1",
        )?;
        let rows = stmt.query_map([], |r| {
            let secs: u32 = r.get(4)?;
            Ok(Track {
                id: r.get(0)?,
                title: r.get(1)?,
                artist: r.get(2)?,
                album: r.get(3)?,
                duration: Track::fmt_duration(secs),
                duration_secs: secs,
                art: r.get(5)?,
                downloaded: true,
            })
        })?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }
}

/// Make a url-safe, stable-ish id from a title.
fn slug(title: &str) -> String {
    let base: String = title
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    let base = base.trim_matches('-').to_string();
    if base.is_empty() {
        format!("pl-{}", title.len())
    } else {
        format!("{base}-{}", title.len())
    }
}
