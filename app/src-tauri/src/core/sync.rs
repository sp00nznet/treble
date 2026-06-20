//! LAN peer sync + "Send to device".
//!
//! Treble devices advertise a `_treble._tcp` service over **mDNS** and discover
//! each other on the same network — no cloud, no account, no configuration. Each
//! device runs a tiny TCP listener; sending a track / playlist / library snapshot
//! to a peer is a single local socket write. This is the engine behind the
//! Spotify-Connect-style **Devices** list and the right-click **Send to ▸**.
//!
//! Events emitted to the frontend:
//! - `sync:peer-found` / `sync:peer-lost`  — a `Peer` appeared / went away
//! - `sync:received`                        — a `SendMessage` arrived from a peer

use crate::core::error::{CoreError, Result};
use crate::core::library::Library;
use crate::core::models::{Playlist, Track};
use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

const SERVICE_TYPE: &str = "_treble._tcp.local.";

/// Bump when the snapshot shape changes so peers can refuse incompatible versions.
pub const SNAPSHOT_VERSION: u32 = 1;

/// A portable, versioned snapshot of a library — the unit exchanged between peers
/// (and written by manual export / read by manual import).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub version: u32,
    pub device_id: String,
    pub playlists: Vec<Playlist>,
}

/// A peer discovered on the LAN.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Peer {
    pub device_id: String,
    pub name: String,
    pub addr: String, // "ip:port"
}

/// Something one device sends to another.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "data")]
pub enum SendMessage {
    /// Play this track now.
    Track(Track),
    /// Import this playlist and open it.
    Playlist(Playlist),
    /// Merge this library snapshot.
    Snapshot(Snapshot),
}

/// Identity for this install. Stable per machine (derived from hostname/user).
pub struct Identity {
    pub device_id: String,
    pub name: String,
}

impl Identity {
    pub fn detect() -> Self {
        let name = std::env::var("COMPUTERNAME")
            .or_else(|_| std::env::var("HOSTNAME"))
            .or_else(|_| std::env::var("USER"))
            .or_else(|_| std::env::var("USERNAME"))
            .unwrap_or_else(|_| "Treble device".to_string());
        let mut h = DefaultHasher::new();
        name.hash(&mut h);
        Identity { device_id: format!("{:x}", h.finish()), name }
    }
}

/// Running LAN service: holds the mDNS daemon and the live peer list. Managed as
/// Tauri state so commands can list peers and send to them.
pub struct SyncService {
    identity: Identity,
    peers: Arc<Mutex<Vec<Peer>>>,
    _daemon: Option<ServiceDaemon>,
}

impl SyncService {
    /// Start advertising + browsing + listening. Networking is best-effort: a
    /// network without mDNS yields an empty peer list rather than an error, so
    /// the service is always available as Tauri state.
    pub fn start(app: AppHandle) -> Self {
        let identity = Identity::detect();
        let peers: Arc<Mutex<Vec<Peer>>> = Arc::new(Mutex::new(Vec::new()));
        let daemon = Self::try_network(&app, &identity, &peers)
            .map_err(|e| eprintln!("LAN sync unavailable: {e}"))
            .ok();
        SyncService { identity, peers, _daemon: daemon }
    }

    fn try_network(app: &AppHandle, identity: &Identity, peers: &Arc<Mutex<Vec<Peer>>>) -> Result<ServiceDaemon> {
        // 1. TCP listener for inbound sends.
        let listener = TcpListener::bind("0.0.0.0:0").map_err(|e| CoreError::Other(e.to_string()))?;
        let port = listener.local_addr().map(|a| a.port()).unwrap_or(0);
        spawn_listener(listener, app.clone());

        // 2. Local IP for advertising.
        let ip = local_ip_address::local_ip()
            .map(|i| i.to_string())
            .unwrap_or_else(|_| "127.0.0.1".to_string());

        // 3. mDNS daemon: register our service + browse for peers.
        let daemon = ServiceDaemon::new().map_err(|e| CoreError::Other(e.to_string()))?;
        let host = format!("treble-{}.local.", identity.device_id);
        let info = ServiceInfo::new(
            SERVICE_TYPE,
            &identity.name,
            &host,
            ip.as_str(),
            port,
            &[("id", identity.device_id.as_str()), ("name", identity.name.as_str())][..],
        )
        .map_err(|e| CoreError::Other(e.to_string()))?;
        daemon.register(info).map_err(|e| CoreError::Other(e.to_string()))?;

        let browse = daemon.browse(SERVICE_TYPE).map_err(|e| CoreError::Other(e.to_string()))?;
        spawn_browser(browse, app.clone(), peers.clone(), identity.device_id.clone());

        Ok(daemon)
    }

    pub fn list_peers(&self) -> Vec<Peer> {
        self.peers.lock().unwrap().clone()
    }

    pub fn device_id(&self) -> &str {
        &self.identity.device_id
    }

    /// Send a message to a known peer (by device id).
    pub fn send_to(&self, peer_id: &str, msg: &SendMessage) -> Result<()> {
        let addr = {
            let peers = self.peers.lock().unwrap();
            peers
                .iter()
                .find(|p| p.device_id == peer_id)
                .map(|p| p.addr.clone())
                .ok_or_else(|| CoreError::Other(format!("peer {peer_id} not found")))?
        };
        let mut stream = TcpStream::connect(&addr).map_err(|e| CoreError::Other(e.to_string()))?;
        let bytes = serde_json::to_vec(msg).map_err(|e| CoreError::Other(e.to_string()))?;
        stream.write_all(&bytes).map_err(|e| CoreError::Other(e.to_string()))?;
        Ok(())
    }
}

/// Accept inbound connections, read one JSON `SendMessage`, emit `sync:received`.
fn spawn_listener(listener: TcpListener, app: AppHandle) {
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(mut stream) = stream else { continue };
            let app = app.clone();
            std::thread::spawn(move || {
                let mut buf = String::new();
                if stream.read_to_string(&mut buf).is_ok() {
                    if let Ok(msg) = serde_json::from_str::<SendMessage>(&buf) {
                        let _ = app.emit("sync:received", msg);
                    }
                }
            });
        }
    });
}

/// Track peers as they resolve / disappear; emit found/lost events. Skips self.
fn spawn_browser(
    browse: mdns_sd::Receiver<ServiceEvent>,
    app: AppHandle,
    peers: Arc<Mutex<Vec<Peer>>>,
    self_id: String,
) {
    std::thread::spawn(move || {
        while let Ok(event) = browse.recv() {
            match event {
                ServiceEvent::ServiceResolved(info) => {
                    let id = info
                        .get_property_val_str("id")
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| info.get_fullname().to_string());
                    if id == self_id {
                        continue; // don't list ourselves
                    }
                    let name = info
                        .get_property_val_str("name")
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| info.get_fullname().to_string());
                    let addr = info
                        .get_addresses()
                        .iter()
                        .next()
                        .map(|a| format!("{a}:{}", info.get_port()))
                        .unwrap_or_default();
                    if addr.is_empty() {
                        continue;
                    }
                    let peer = Peer { device_id: id.clone(), name, addr };
                    {
                        let mut list = peers.lock().unwrap();
                        if !list.iter().any(|p| p.device_id == id) {
                            list.push(peer.clone());
                        }
                    }
                    let _ = app.emit("sync:peer-found", peer);
                }
                ServiceEvent::ServiceRemoved(_, fullname) => {
                    let mut list = peers.lock().unwrap();
                    if let Some(pos) = list.iter().position(|p| fullname.contains(&p.name)) {
                        let removed = list.remove(pos);
                        let _ = app.emit("sync:peer-lost", removed);
                    }
                }
                _ => {}
            }
        }
    });
}

/// Build a snapshot of the current library — used by manual export and the LAN
/// exchange.
pub fn export_snapshot(lib: &Library, device_id: &str) -> Result<Snapshot> {
    let mut playlists = Vec::new();
    for p in lib.list_playlists()? {
        if let Some(full) = lib.get_playlist(&p.id)? {
            playlists.push(full);
        }
    }
    Ok(Snapshot { version: SNAPSHOT_VERSION, device_id: device_id.to_string(), playlists })
}

/// Merge a snapshot from a peer/backup into the local library.
pub fn import_snapshot(lib: &Library, snap: &Snapshot) -> Result<usize> {
    let mut n = 0;
    for pl in &snap.playlists {
        lib.create_playlist(&pl.title, &pl.tracks)?;
        n += 1;
    }
    Ok(n)
}
