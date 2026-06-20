//! The local library — a single, portable SQLite database holding playlists,
//! their tracks, liked songs, and download state. This file is the unit of LAN
//! sync (see `core::sync`): it's the whole "your library" in one place.

use crate::core::error::Result;
use crate::core::models::{Playlist, Track};
use crate::core::podcasts::Podcast;
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
            CREATE TABLE IF NOT EXISTS ratings (
                track_id TEXT PRIMARY KEY,
                rating   INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS subscriptions (
                id       TEXT PRIMARY KEY,
                title    TEXT NOT NULL,
                author   TEXT NOT NULL DEFAULT '',
                art      TEXT NOT NULL DEFAULT '',
                feed_url TEXT NOT NULL,
                added    INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
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
            "SELECT t.id, t.title, t.artist, t.album, t.duration_secs, t.art, t.downloaded,
                    COALESCE(rt.rating, 0)
             FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id
             LEFT JOIN ratings rt ON rt.track_id = t.id
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
                rating: r.get::<_, i64>(7)? as u8,
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

    /// Append a single track to an existing playlist (no-op if already present).
    pub fn add_to_playlist(&self, playlist_id: &str, t: &Track) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        Self::upsert_track(&conn, t)?;
        let pos: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(position) + 1, 0) FROM playlist_tracks WHERE playlist_id = ?1",
                params![playlist_id],
                |r| r.get(0),
            )
            .unwrap_or(0);
        conn.execute(
            "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position)
             VALUES (?1, ?2, ?3)",
            params![playlist_id, t.id, pos],
        )?;
        Ok(())
    }

    /// Delete a playlist and its track links.
    pub fn delete_playlist(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM playlist_tracks WHERE playlist_id = ?1", params![id])?;
        conn.execute("DELETE FROM playlists WHERE id = ?1", params![id])?;
        Ok(())
    }

    /// Rename a playlist (keeps the id so track links stay intact).
    pub fn rename_playlist(&self, id: &str, title: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE playlists SET title = ?1 WHERE id = ?2", params![title, id])?;
        Ok(())
    }

    /// Ensure a track row exists (so it can be flagged downloaded / liked even if
    /// it isn't in any playlist).
    pub fn ensure_track(&self, t: &Track) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        Self::upsert_track(&conn, t)
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
                rating: 0,
            })
        })?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    /// All distinct tracks in the library (the "Songs" tab), with ratings.
    pub fn list_all_tracks(&self) -> Result<Vec<Track>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT t.id, t.title, t.artist, t.album, t.duration_secs, t.art, t.downloaded,
                    COALESCE(rt.rating, 0)
             FROM tracks t LEFT JOIN ratings rt ON rt.track_id = t.id
             ORDER BY t.title COLLATE NOCASE",
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
                downloaded: r.get::<_, i64>(6)? != 0,
                rating: r.get::<_, i64>(7)? as u8,
            })
        })?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    // ---- podcast subscriptions ----

    pub fn subscribe(&self, p: &Podcast) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO subscriptions (id, title, author, art, feed_url, added)
             VALUES (?1, ?2, ?3, ?4, ?5, strftime('%s','now'))",
            params![p.id, p.title, p.author, p.art, p.feed_url],
        )?;
        Ok(())
    }

    pub fn unsubscribe(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM subscriptions WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn list_subscriptions(&self) -> Result<Vec<Podcast>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, title, author, art, feed_url FROM subscriptions ORDER BY added DESC")?;
        let rows = stmt.query_map([], |r| {
            Ok(Podcast { id: r.get(0)?, title: r.get(1)?, author: r.get(2)?, art: r.get(3)?, feed_url: r.get(4)? })
        })?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    /// Set a track's 0–5 star rating (0 clears it).
    pub fn set_rating(&self, track_id: &str, rating: u8) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO ratings (track_id, rating) VALUES (?1, ?2)
             ON CONFLICT(track_id) DO UPDATE SET rating = excluded.rating",
            params![track_id, rating.min(5) as i64],
        )?;
        Ok(())
    }

    /// Set a playlist's cover art (a file path / URL).
    pub fn set_playlist_art(&self, id: &str, art: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE playlists SET art = ?1 WHERE id = ?2", params![art, id])?;
        Ok(())
    }

    // ---- liked songs ----

    /// Add a track to Liked Songs (upserting the track row so it survives even if
    /// it isn't in any playlist).
    pub fn like(&self, t: &Track) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        Self::upsert_track(&conn, t)?;
        conn.execute(
            "INSERT OR IGNORE INTO liked (track_id, added) VALUES (?1, strftime('%s','now'))",
            params![t.id],
        )?;
        Ok(())
    }

    pub fn unlike(&self, track_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM liked WHERE track_id = ?1", params![track_id])?;
        Ok(())
    }

    /// Just the ids of liked tracks (the frontend keeps this set for quick lookup).
    pub fn liked_ids(&self) -> Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT track_id FROM liked")?;
        let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    /// Liked Songs as a track list (most-recently-liked first).
    pub fn list_liked(&self) -> Result<Vec<Track>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT t.id, t.title, t.artist, t.album, t.duration_secs, t.art, t.downloaded,
                    COALESCE(rt.rating, 0)
             FROM liked l JOIN tracks t ON t.id = l.track_id
             LEFT JOIN ratings rt ON rt.track_id = t.id
             ORDER BY l.added DESC",
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
                downloaded: r.get::<_, i64>(6)? != 0,
                rating: r.get::<_, i64>(7)? as u8,
            })
        })?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    // ---- downloads ----

    /// The on-disk path of a downloaded track, if it's downloaded (so playback can
    /// prefer the local file over streaming). Caller checks the file still exists.
    pub fn downloaded_path(&self, id: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let p = conn
            .query_row(
                "SELECT file_path FROM tracks WHERE id = ?1 AND downloaded = 1",
                params![id],
                |r| r.get::<_, Option<String>>(0),
            )
            .ok()
            .flatten();
        Ok(p)
    }

    /// File paths of every downloaded track (for clear-cache / storage stats).
    pub fn downloaded_paths(&self) -> Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT file_path FROM tracks WHERE downloaded = 1 AND file_path IS NOT NULL")?;
        let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    /// Clear the downloaded flag/path for every track (after deleting the files).
    pub fn clear_downloaded(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE tracks SET downloaded = 0, file_path = NULL WHERE downloaded = 1", [])?;
        Ok(())
    }

    // ---- settings (key/value) ----

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let v = conn
            .query_row("SELECT value FROM settings WHERE key = ?1", params![key], |r| r.get::<_, String>(0))
            .ok();
        Ok(v)
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
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
