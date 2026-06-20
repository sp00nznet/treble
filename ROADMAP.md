# Roadmap

Treble's UI is **done**; the backend is being wired up screen by screen. This is the honest status.

## ✅ Done

- [x] Full design implemented — every desktop screen, both themes, 4 accents, context menu, full-screen now-playing, pop-out mini-player + lyrics windows
- [x] App shell: frameless titlebar, sidebar, persistent docked "Studio" player (no bottom bar)
- [x] State store (Context + reducer), theming engine, design tokens
- [x] Repo, docs, credits, GPL-3.0 license
- [x] **Rust core** — `core/` modules (catalog, downloads, lyrics, library, local, spotify_import, sync) + Tauri command surface
- [x] **Frontend ↔ core bridge** (`src/lib/api.ts`) with browser mock fallback
- [x] **Live search → play** — `yt-dlp`-backed search wired to the Search screen; real streamed playback
- [x] **Real downloads** — `yt-dlp` + `ffmpeg` pipeline with live `download:progress` into the Downloads screen
- [x] **Spotify import** — clipboard parser → match on YouTube Music (live progress) → real, playable playlist
- [x] **LRCLIB lyrics** — synced, highlighting the active line from playback position; click a line to seek
- [x] **SQLite library** — playlists, tracks, download state; the portable unit of sync
- [x] **Live scrubber + seek** — every player surface driven by real position; click/seek anywhere
- [x] **Sleep timer** — 15/30/45/60 min + end-of-track, with live countdown
- [x] **Local file library** — scan a folder (tag-read via lofty), play off disk via the asset protocol
- [x] **LAN devices + "Send to…"** — mDNS discovery (`_treble._tcp`) + TCP send; Spotify-Connect-style Devices list and right-click → Send to ▸
- [x] **Native catalog engine** — `rustypipe` (InnerTube) behind the `native-catalog` feature → the Android-parity path

## 🚧 In progress / next

- [x] **Android APK builds** — full native-catalog APK cross-compiles (rustls + rquickjs bindgen) and is
      signed/sideloadable (arm64); Windows symlink workaround in `scripts/build-apk-windows.ps1`
- [ ] **Android polish**: native `MediaStyle` notification, edge-to-edge insets, system back, scoped-storage
      folder picker; multi-ABI universal APK; on-device QA
- [ ] **Sync conflict resolution** — per-device clocks for the snapshot merge (currently last-writer-wins)
- [ ] **Sent-playlist round-trip polish** — open the freshly-merged playlist by its new id after a Send
- [ ] Make the mini-player & lyrics pop-outs real `WebviewWindow`s sharing core events
- [ ] Real queue (next-up / reorder) + prev/next wired to the queue
- [ ] Full Settings surface wired to real values (Content, Storage, Privacy, About) + a Local-files manager
- [ ] Self-host fonts (Bricolage + Hanken) for offline desktop

## 💡 Ideas worth stealing (future)

- **Smart match review** — when Spotify import is unsure about a track, show a little "is this the right
  one?" picker instead of guessing silently. *(Highest-value next feature.)*
- **"Start radio"** — the context menu already offers it; rustypipe exposes related-tracks.
- **Crossfade / gapless** — the Settings UI already has the toggles; make them real.
- **Per-track download quality** override and a global storage cap with LRU eviction.
- **Lyrics contribution** — if LRCLIB is missing lyrics, let users submit them back upstream.
- **Android Auto / desktop media keys** — proper OS media session integration everywhere.
- **Discord Rich Presence** — *parked* (low priority, per project owner).
- **Last.fm scrobbling** — *parked* (low priority, per project owner).

## 🧭 Guiding principles

1. **Credit upstream, always.** Treble is a coat of paint; the foundation is other people's work.
2. **The Rust core owns the truth.** UI is a projection of core state/events.
3. **No accounts, no servers, no telemetry.** Your library is a file on your devices.
4. **Stay warm.** Pixel-faithful to the design; never hardcode a color outside the tokens.
