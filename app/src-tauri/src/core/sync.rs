//! LAN peer sync (scaffold).
//!
//! The plan (see ARCHITECTURE.md): devices advertise a `_treble._tcp` service over
//! mDNS, discover each other on the same network, and exchange a versioned snapshot
//! of the library (playlists, liked songs, play counts) over a direct local socket.
//! Conflict resolution is last-writer-wins per record with per-device clocks.
//!
//! This module currently defines the wire types and the export/import snapshot
//! (which doubles as the always-available manual backup). Discovery + the socket
//! exchange are the next implementation step — kept out of this commit so the core
//! stays light and compiles fast. See ROADMAP.md → "LAN sync".

use crate::core::error::Result;
use crate::core::library::Library;
use crate::core::models::Playlist;
use serde::{Deserialize, Serialize};

/// Bump when the snapshot shape changes so peers can refuse incompatible versions.
pub const SNAPSHOT_VERSION: u32 = 1;

/// A portable, versioned snapshot of a library — the unit exchanged between peers
/// (and written by manual export / read by manual import).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub version: u32,
    /// Stable per-install id so peers can keep per-device clocks (placeholder for now).
    pub device_id: String,
    pub playlists: Vec<Playlist>,
}

/// A peer discovered on the LAN (populated by mDNS discovery — to come).
#[allow(dead_code)] // constructed once discovery lands (ROADMAP → LAN sync)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Peer {
    pub device_id: String,
    pub name: String,
    pub addr: String,
}

/// Build a snapshot of the current library — used by manual export today and by
/// the LAN exchange once discovery lands.
pub fn export_snapshot(lib: &Library, device_id: &str) -> Result<Snapshot> {
    let mut playlists = Vec::new();
    for p in lib.list_playlists()? {
        if let Some(full) = lib.get_playlist(&p.id)? {
            playlists.push(full);
        }
    }
    Ok(Snapshot { version: SNAPSHOT_VERSION, device_id: device_id.to_string(), playlists })
}

/// Merge a snapshot from a peer/backup into the local library. Last-writer-wins by
/// recreating playlists; track metadata is upserted. (A finer per-record clock
/// merge replaces this when device clocks land.)
pub fn import_snapshot(lib: &Library, snap: &Snapshot) -> Result<usize> {
    let mut n = 0;
    for pl in &snap.playlists {
        lib.create_playlist(&pl.title, &pl.tracks)?;
        n += 1;
    }
    Ok(n)
}
