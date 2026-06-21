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
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::time::Duration;
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
    pub addr: String,      // "ip:port" — the send-to JSON listener
    pub http_addr: String, // "ip:port" — the companion HTTP API (resolve/search). Empty if none.
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

        // 1b. Companion HTTP API (stream resolve / search) — the engine behind
        // "use my desktop to play on my phone": a phone with no yt-dlp asks a
        // desktop peer to resolve a playable URL, then streams it directly.
        let http_listener = TcpListener::bind("0.0.0.0:0").map_err(|e| CoreError::Other(e.to_string()))?;
        let http_port = http_listener.local_addr().map(|a| a.port()).unwrap_or(0);
        spawn_http_server(http_listener);

        // 2. Local IP for advertising.
        let ip = local_ip_address::local_ip()
            .map(|i| i.to_string())
            .unwrap_or_else(|_| "127.0.0.1".to_string());

        // 3. mDNS daemon: register our service + browse for peers.
        let daemon = ServiceDaemon::new().map_err(|e| CoreError::Other(e.to_string()))?;
        let host = format!("treble-{}.local.", identity.device_id);
        let http_port_s = http_port.to_string();
        let info = ServiceInfo::new(
            SERVICE_TYPE,
            &identity.name,
            &host,
            ip.as_str(),
            port,
            &[
                ("id", identity.device_id.as_str()),
                ("name", identity.name.as_str()),
                ("http", http_port_s.as_str()),
            ][..],
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

    /// Ask any desktop companion on the LAN to resolve a playable stream URL for
    /// a video id (it runs yt-dlp). Returns the first peer that answers. This is
    /// how a phone (which can't run yt-dlp) plays YouTube: resolve via the desktop,
    /// then stream the URL directly.
    pub fn resolve_via_peer(&self, id: &str) -> Option<String> {
        let peers = self.peers.lock().unwrap().clone();
        for p in peers.iter().filter(|p| !p.http_addr.is_empty()) {
            let url = format!("http://{}/resolve?id={}", p.http_addr, id);
            if let Ok(resp) = ureq::get(&url).timeout(Duration::from_secs(25)).call() {
                if let Ok(body) = resp.into_string() {
                    if body.starts_with("http") {
                        crate::tlog!("companion {} resolved a stream", p.name);
                        return Some(body);
                    }
                }
            }
        }
        None
    }

    /// True if at least one desktop companion (with the HTTP API) is reachable.
    pub fn has_companion(&self) -> bool {
        self.peers.lock().unwrap().iter().any(|p| !p.http_addr.is_empty())
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

/// Companion HTTP API: a tiny request/response server so phones can borrow this
/// desktop's catalog engine (yt-dlp). Hand-rolled HTTP/1.1 (GET only) — no extra
/// dependency. Routes: `/resolve?id=`, `/search?q=&limit=`, `/ping`.
fn spawn_http_server(listener: TcpListener) {
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(stream) = stream else { continue };
            std::thread::spawn(move || { let _ = handle_http(stream); });
        }
    });
}

fn handle_http(mut stream: TcpStream) -> std::io::Result<()> {
    let mut reader = BufReader::new(stream.try_clone()?);
    let mut line = String::new();
    reader.read_line(&mut line)?;
    let path = line.split_whitespace().nth(1).unwrap_or("/").to_string();
    let (route, query) = path.split_once('?').unwrap_or((path.as_str(), ""));

    let (status, ctype, body): (&str, &str, String) = match route {
        "/resolve" => match query_get(query, "id") {
            Some(id) => match crate::core::catalog::resolve_stream(&id) {
                Ok(u) => ("200 OK", "text/plain", u),
                Err(e) => ("502 Bad Gateway", "text/plain", e.to_string()),
            },
            None => ("400 Bad Request", "text/plain", "missing id".into()),
        },
        "/search" => {
            let q = query_get(query, "q").map(|s| url_decode(&s)).unwrap_or_default();
            let limit = query_get(query, "limit").and_then(|s| s.parse().ok()).unwrap_or(30);
            let tracks = crate::core::catalog::search(&q, limit).unwrap_or_default();
            ("200 OK", "application/json", serde_json::to_string(&tracks).unwrap_or_else(|_| "[]".into()))
        }
        "/ping" => ("200 OK", "text/plain", "treble".into()),
        _ => ("404 Not Found", "text/plain", "not found".into()),
    };

    let resp = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {ctype}\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    stream.write_all(resp.as_bytes())?;
    Ok(())
}

/// Get a value from a `k=v&k2=v2` query string.
fn query_get(query: &str, key: &str) -> Option<String> {
    query.split('&').find_map(|kv| {
        let (k, v) = kv.split_once('=')?;
        if k == key { Some(v.to_string()) } else { None }
    })
}

/// Minimal URL-decode (`%XX` + `+`) for the search query.
fn url_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = String::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        match b[i] {
            b'+' => out.push(' '),
            b'%' if i + 2 < b.len() => {
                if let Ok(c) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                    out.push(c as char);
                    i += 3;
                    continue;
                }
                out.push('%');
            }
            c => out.push(c as char),
        }
        i += 1;
    }
    out
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
                    let host_ip = info.get_addresses().iter().next().map(|a| a.to_string());
                    let Some(host_ip) = host_ip else { continue };
                    let addr = format!("{host_ip}:{}", info.get_port());
                    let http_addr = info
                        .get_property_val_str("http")
                        .map(|p| format!("{host_ip}:{p}"))
                        .unwrap_or_default();
                    let peer = Peer { device_id: id.clone(), name, addr, http_addr };
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
