# Roadmap

Treble's UI is **done**; the backend is being wired up screen by screen. This is the honest status.

## ✅ Done

- [x] Full design implemented — every desktop screen, both themes, 4 accents, context menu, full-screen now-playing, pop-out mini-player + lyrics windows
- [x] App shell: frameless titlebar, sidebar, persistent docked "Studio" player (no bottom bar)
- [x] State store (Context + reducer), theming engine, design tokens
- [x] Repo, docs, credits, GPL-3.0 license
- [x] **Rust core scaffold** — `core/` modules (catalog, downloads, lyrics, library, spotify_import, sync) with the Tauri command surface registered
- [x] **Frontend ↔ core bridge** (`src/lib/api.ts`) with browser mock fallback
- [x] **Spotify clipboard parser** — turns a copied Spotify track list into structured tracks
- [x] **LRCLIB lyrics** integration

## 🚧 In progress

- [ ] Wire `catalog::search` (rustypipe) end-to-end into the Search screen
- [ ] Real playback: resolve stream URL → audio element/native player → drive scrubber from `player:position` events
- [ ] Real downloads: `yt-dlp` + `ffmpeg` pipeline on desktop, progress events into the Downloads screen
- [ ] Spotify import: matching pass (parsed tracks → YouTube Music) + "create playlist" wiring
- [ ] SQLite library: persist playlists, liked songs, downloaded/cache state

## 🔜 Next

- [ ] LAN sync: mDNS discovery + library exchange + conflict resolution
- [ ] Android: `tauri android init`, native download path, `MediaStyle` notification, edge-to-edge insets, sideloadable APK in CI
- [ ] Self-host fonts (Bricolage + Hanken) for offline desktop
- [ ] Make the mini-player & lyrics pop-outs real `WebviewWindow`s sharing core events
- [ ] Full Settings surface wired to real values (Content, Storage, Privacy, About)

## 💡 Ideas worth stealing (future)

- **Smart match review** — when Spotify import is unsure about a track, show a little "is this the right
  one?" picker instead of guessing silently.
- **Discord Rich Presence** (desktop) — InnerTune has it; it's a fun, low-cost win.
- **Backup & restore** — export/import the whole library + settings to a file (also the always-available
  sync fallback).
- **Sleep timer & crossfade/gapless** — the Settings UI already has the toggles; make them real.
- **"Start radio"** — the context menu already offers it; rustypipe exposes related-tracks.
- **Local file library** — index music already on disk and mix it with streamed tracks.
- **Last.fm scrobbling** — optional, opt-in.
- **Lyrics contribution** — if LRCLIB is missing lyrics, let users submit them back upstream.
- **Per-track download quality** override and a global storage cap with LRU eviction.
- **Android Auto / desktop media keys** — proper OS media session integration everywhere.

## 🧭 Guiding principles

1. **Credit upstream, always.** Treble is a coat of paint; the foundation is other people's work.
2. **The Rust core owns the truth.** UI is a projection of core state/events.
3. **No accounts, no servers, no telemetry.** Your library is a file on your devices.
4. **Stay warm.** Pixel-faithful to the design; never hardcode a color outside the tokens.
