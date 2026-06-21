/**
 * The bridge between the React UI and the Rust core.
 *
 * Every call into the backend goes through this file — components never `invoke`
 * directly. When running under Tauri it calls the real Rust commands; in a plain
 * browser (`npm run dev`) it falls back to mock data so the whole UI still renders
 * for fast iteration. Keep the function signatures in sync with `commands.rs`.
 */
import { isTauri } from "./windows";
import type { Track } from "../types";
import { TRACKS, PLAYLISTS } from "../data/mock";

// ---- types crossing the boundary (mirror src-tauri/src/core/models.rs) ----

export interface ParsedTrack {
  title: string;
  artist: string;
  album: string;
  duration: string;
}

export interface LyricLine {
  time_secs: number;
  text: string;
}

export interface Lyrics {
  synced: boolean;
  lines: LyricLine[];
  plain: string;
}

export interface CorePlaylist {
  id: string;
  title: string;
  subtitle: string;
  art: string;
  tracks: Track[];
}

export interface ToolsStatus {
  yt_dlp: boolean;
  ffmpeg: boolean;
}

export interface Peer {
  device_id: string;
  name: string;
  addr: string;
  http_addr: string; // companion HTTP API (resolve/search); empty if none
}

/** A message sent to a peer device (mirrors core::sync::SendMessage). */
export type SendMessage =
  | { kind: "Track"; data: Track }
  | { kind: "Playlist"; data: CorePlaylist }
  | { kind: "Snapshot"; data: unknown };

export interface DownloadProgress {
  id: string;
  pct: number;
  done: boolean;
  error: string | null;
}

export interface ImportProgress {
  done: number;
  total: number;
  matched: number;
  current: string;
}

/** One row of the smart-match review (mirrors commands::MatchRow). */
export interface MatchRow {
  parsed: ParsedTrack;
  candidates: Track[];
  confident: boolean;
}

// ---- invoke / event plumbing (lazy-imported so the browser build is clean) ----

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

/** Subscribe to a core event. Returns an unlisten fn. No-op in the browser. */
export async function listen<T>(event: string, cb: (payload: T) => void): Promise<() => void> {
  if (!isTauri()) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  const un = await listen<T>(event, (e) => cb(e.payload));
  return un;
}

// ---- commands ----

export async function toolsStatus(): Promise<ToolsStatus> {
  if (!isTauri()) return { yt_dlp: false, ffmpeg: false };
  return invoke<ToolsStatus>("tools_status");
}

export async function search(query: string): Promise<Track[]> {
  if (!isTauri()) {
    const q = query.toLowerCase();
    return TRACKS.filter((t) => `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(q));
  }
  return invoke<Track[]>("search", { query });
}

/** Resolve a playable audio URL for a track id (temporary for streams — fetch on play). */
export async function resolveStream(id: string): Promise<string> {
  // Local files play straight off disk via the asset protocol — no network.
  if (id.startsWith("local:")) {
    const { convertFileSrc } = await import("@tauri-apps/api/core");
    return convertFileSrc(id.slice("local:".length));
  }
  // Podcast episodes (and any direct-URL track) are already playable URLs.
  if (/^https?:\/\//.test(id)) return id;
  // Prefer an already-downloaded local copy — no need to stream it again.
  if (isTauri()) {
    const local = await invoke<string | null>("downloaded_path", { id }).catch(() => null);
    if (local) {
      const { convertFileSrc } = await import("@tauri-apps/api/core");
      return convertFileSrc(local);
    }
  }
  return invoke<string>("resolve_stream", { id });
}

export interface Podcast {
  id: string;
  title: string;
  author: string;
  art: string;
  feed_url: string;
}

export async function searchPodcasts(query: string): Promise<Podcast[]> {
  if (!isTauri()) return [];
  return invoke<Podcast[]>("search_podcasts", { query });
}

export async function podcastEpisodes(feedUrl: string, art: string): Promise<Track[]> {
  if (!isTauri()) return [];
  return invoke<Track[]>("podcast_episodes", { feedUrl, art });
}

export async function subscribePodcast(show: Podcast): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>("subscribe_podcast", { show });
}

export async function unsubscribePodcast(id: string): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>("unsubscribe_podcast", { id });
}

export async function listSubscriptions(): Promise<Podcast[]> {
  if (!isTauri()) return [];
  return invoke<Podcast[]>("list_subscriptions");
}

export async function listAllTracks(): Promise<Track[]> {
  if (!isTauri()) return [];
  return invoke<Track[]>("list_all_tracks");
}

export async function newPlaylist(name: string): Promise<CorePlaylist> {
  return invoke<CorePlaylist>("new_playlist", { name });
}

// ---- local file library ----

export async function pickFolder(): Promise<string | null> {
  if (!isTauri()) return null;
  return invoke<string | null>("pick_folder");
}

export async function scanLocalFolder(folder: string): Promise<CorePlaylist> {
  return invoke<CorePlaylist>("scan_local_folder", { folder });
}

// ---- LAN sync / send-to-device ----

export async function listPeers(): Promise<Peer[]> {
  if (!isTauri()) return [];
  return invoke<Peer[]>("list_peers");
}

/** Is a desktop companion (yt-dlp resolver) reachable on the LAN? Phones need one to stream. */
export async function companionStatus(): Promise<boolean> {
  if (!isTauri()) return false;
  return invoke<boolean>("companion_status").catch(() => false);
}

export async function sendTo(peerId: string, message: SendMessage): Promise<void> {
  return invoke<void>("send_to", { peerId, message });
}

/** Export the whole library as a portable snapshot (manual backup / sync unit). */
export async function exportLibrary(): Promise<unknown> {
  return invoke<unknown>("export_library");
}

/** Merge a snapshot (manual restore, or one received from a peer). Returns playlists merged. */
export async function importLibrary(snapshot: unknown): Promise<number> {
  if (!isTauri()) return 0;
  return invoke<number>("import_library", { snapshot });
}

export async function getLyrics(t: Track): Promise<Lyrics> {
  if (!isTauri()) {
    return { synced: false, lines: [], plain: "" };
  }
  return invoke<Lyrics>("get_lyrics", {
    title: t.title,
    artist: t.artist,
    album: t.album,
    durationSecs: (t as Track & { duration_secs?: number }).duration_secs ?? 0,
  });
}

export async function parseSpotify(text: string): Promise<ParsedTrack[]> {
  if (!isTauri()) return localParseSpotify(text);
  return invoke<ParsedTrack[]>("parse_spotify", { text });
}

/** Parse → match → save as a real playlist. Listen to `import:progress` for a bar. */
export async function importSpotify(name: string, text: string): Promise<CorePlaylist> {
  if (!isTauri()) {
    // Browser preview: build a playlist from the parsed names against mock tracks.
    const parsed = localParseSpotify(text);
    const tracks = parsed.map((_p, i) => TRACKS[i % TRACKS.length] ?? TRACKS[0]).filter(Boolean);
    return { id: `imported-${name}`, title: name, subtitle: `${tracks.length} songs`, art: tracks[0]?.art ?? "", tracks };
  }
  return invoke<CorePlaylist>("import_spotify", { name, text });
}

export interface ImportRowsEvent {
  name: string;
  rows: MatchRow[];
}

export interface ImportDoneEvent {
  playlist: CorePlaylist;
  total: number;
  matched: number;
  skipped: number;
}

/**
 * Start a background Spotify import. Returns immediately; results arrive via
 * events: `import:progress`, then `import:rows` (small playlists → review) or
 * `import:done` (large playlists → auto-imported), or `import:cancelled`.
 */
export async function importRun(name: string, text: string): Promise<void> {
  return invoke<void>("import_run", { name, text });
}

/** Cancel the in-flight import. */
export async function importCancel(): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>("import_cancel");
}

/** Browser-preview matcher (no backend) — builds review rows from the mock catalog. */
export function prepareImportBrowser(text: string): MatchRow[] {
  const parsed = localParseSpotify(text);
  return parsed.map((p, i) => {
    const alts = [TRACKS[i % TRACKS.length], TRACKS[(i + 1) % TRACKS.length], TRACKS[(i + 2) % TRACKS.length]];
    return { parsed: p, candidates: alts, confident: i % 3 !== 0 };
  });
}

/** Save the user's confirmed selections as a real playlist. */
export async function saveMatchedPlaylist(name: string, tracks: Track[]): Promise<CorePlaylist> {
  if (!isTauri()) {
    return { id: `imported-${name}`, title: name, subtitle: `${tracks.length} songs`, art: tracks[0]?.art ?? "", tracks };
  }
  return invoke<CorePlaylist>("save_matched_playlist", { name, tracks });
}

export async function listPlaylists(): Promise<CorePlaylist[]> {
  if (!isTauri()) return PLAYLISTS.map((p) => ({ ...p, tracks: [] }));
  return invoke<CorePlaylist[]>("list_playlists");
}

export async function getPlaylist(id: string): Promise<CorePlaylist | null> {
  if (!isTauri()) {
    const p = PLAYLISTS.find((p) => p.id === id);
    return p ? { ...p, tracks: TRACKS } : null;
  }
  return invoke<CorePlaylist | null>("get_playlist", { id });
}

export async function deletePlaylist(id: string): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>("delete_playlist", { id });
}

export async function renamePlaylist(id: string, name: string): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>("rename_playlist", { id, name });
}

export async function setRating(trackId: string, rating: number): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>("set_rating", { trackId, rating });
}

/** Open an image picker; returns the chosen file path (or null). */
export async function pickImage(): Promise<string | null> {
  if (!isTauri()) return null;
  return invoke<string | null>("pick_image");
}

/** Set a playlist's cover from an image file; returns the new art reference. */
export async function setPlaylistCover(id: string, srcPath: string): Promise<string> {
  return invoke<string>("set_playlist_cover", { id, srcPath });
}

/** Path to the on-disk log file (for diagnostics). */
export async function getLogPath(): Promise<string | null> {
  if (!isTauri()) return null;
  return invoke<string | null>("get_log_path");
}

/** Write a line into the app log from the frontend (playback events, errors). */
export function uiLog(msg: string): void {
  if (!isTauri()) return;
  void invoke("ui_log", { msg }).catch(() => {});
}

export async function listDownloads(): Promise<Track[]> {
  if (!isTauri()) return TRACKS.filter((t) => t.downloaded);
  return invoke<Track[]>("list_downloads");
}

/** Kick off a download. Progress arrives via the `download:progress` event. */
export async function downloadTrack(track: Track): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>("download_track", { track });
}

/** Download many tracks sequentially (a whole playlist). Progress per track id. */
export async function downloadMany(tracks: Track[]): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>("download_many", { tracks });
}

// ---- liked songs ----

export async function likeTrack(track: Track): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>("like_track", { track });
}
export async function unlikeTrack(id: string): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>("unlike_track", { id });
}
export async function listLiked(): Promise<Track[]> {
  if (!isTauri()) return [];
  return invoke<Track[]>("list_liked");
}
export async function likedIds(): Promise<string[]> {
  if (!isTauri()) return [];
  return invoke<string[]>("liked_ids");
}

/** Append a track to an existing playlist. */
export async function addToPlaylist(playlistId: string, track: Track): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>("add_to_playlist", { playlistId, track });
}

// ---- settings + storage ----

export async function getSetting(key: string): Promise<string | null> {
  if (!isTauri()) { try { return localStorage.getItem(`treble.s.${key}`); } catch { return null; } }
  return invoke<string | null>("get_setting", { key });
}
export async function setSetting(key: string, value: string): Promise<void> {
  if (!isTauri()) { try { localStorage.setItem(`treble.s.${key}`, value); } catch { /* ignore */ } return; }
  return invoke<void>("set_setting", { key, value });
}
export async function getDownloadDir(): Promise<string> {
  if (!isTauri()) return "(browser preview — no downloads)";
  return invoke<string>("get_download_dir");
}
export interface StorageStats { bytes: number; count: number; }
export async function storageStats(): Promise<StorageStats> {
  if (!isTauri()) return { bytes: 0, count: 0 };
  return invoke<StorageStats>("storage_stats");
}
export async function clearDownloads(): Promise<number> {
  if (!isTauri()) return 0;
  return invoke<number>("clear_downloads");
}

// ---- browser-only fallback parser (mirrors core::spotify_import, loosely) ----

function localParseSpotify(text: string): ParsedTrack[] {
  return text
    .split("\n")
    .map((l) => l.trim().replace(/^\d+[.)]\s*/, ""))
    .filter((l) => l && !/^(title|artist|album|#)$/i.test(l))
    .map((line) => {
      if (line.includes("\t")) {
        const [title, artist = "", album = ""] = line.split("\t");
        return { title: title.trim(), artist: artist.trim(), album: album.trim(), duration: "" };
      }
      const m = line.split(/ [—–-] | by /);
      return { title: (m[0] ?? line).trim(), artist: (m[1] ?? "").trim(), album: "", duration: "" };
    })
    .filter((t) => t.title);
}
