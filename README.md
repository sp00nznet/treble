<div align="center">

# 🎵 Treble

### *A warm little music client for people who still make playlists.*

**Win32 · Linux · Android — one warm amber UI, your whole library, everywhere.**

[![build](https://github.com/sp00nznet/treble/actions/workflows/build.yml/badge.svg)](https://github.com/sp00nznet/treble/actions/workflows/build.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-E2622E.svg)](LICENSE)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-FF9A5C.svg)](https://tauri.app)
[![Rust core](https://img.shields.io/badge/core-Rust-FF6B5C.svg)](https://www.rust-lang.org/)
[![Status: prototype](https://img.shields.io/badge/status-prototype-FFB35C.svg)](ROADMAP.md)

*Treble (n.) — the high notes. Also: a treble-maker.* 🎶

</div>

---

## What is this?

Treble is a cross-platform music client with a soul: a warm amber/coral interface (light **and** dark),
a signature "Studio" layout where the now-playing panel lives docked on the right instead of a sad little
bar at the bottom, and a split-screen lyrics view that actually feels good to read.

Under that pretty face, Treble pulls its catalog from **YouTube Music** (a fully native Rust
[InnerTube](https://codeberg.org/ThetaDev/rustypipe) client, so search runs the *same* on your laptop
**and** your phone), streams and downloads tracks for real offline listening — and on Android it resolves
playable streams **entirely on-device** via embedded
[NewPipeExtractor](https://github.com/TeamNewPipe/NewPipeExtractor) and a ported `po_token` generator (no
desktop companion required) — fetches time-synced lyrics, and can **import a playlist you already have —
straight from your clipboard**.

> **We did not build the hard parts.** Treble is a nice coat of paint on a *mountain* of work by other
> people — the folks who reverse-engineered YouTube's API, wrote the downloaders, built the lyrics
> databases, and made the cross-platform app framework. See **[CREDITS](CREDITS.md)**. Go star their repos.

## The pitch, in pictures

*Real screenshots of the desktop app (Windows build).*

| | |
|---|---|
| ![Home](screenshots/home.png) | ![Now Playing](screenshots/nowplaying.png) |
| **Home** — warm, time-aware, your playlists front and center | **Now Playing** — docked studio panel, live scrubber, real playback |
| ![Library](screenshots/library.png) | ![Playlist](screenshots/playlist.png) |
| **Library** — playlists, Liked Songs, podcasts & local files | **Playlist** — sortable columns, star ratings, custom covers, bulk download |
| ![Search](screenshots/search.png) | ![Settings](screenshots/settings.png) |
| **Search** — instant YouTube Music results | **Settings** — theme, download quality & location, region |

<p align="center">
  <img src="screenshots/fullplayer.png" alt="Full-screen player" width="640"><br>
  <em>The full-screen immersive player — album art, scrubber, transport, and a time-synced lyrics pane.</em>
</p>

### …and on Android

*Real screenshots from the sideloaded APK — a phone-native shell (bottom tabs, art-forward player), not the desktop UI crammed onto a phone. YouTube playback resolves **on-device** (no desktop needed) and keeps going with the screen locked.*

<p align="center">
  <img src="screenshots/and_home.png" width="200" alt="Android home">
  <img src="screenshots/and_search.png" width="200" alt="Android search">
  <img src="screenshots/and_nowplaying.png" width="200" alt="Android now playing">
  <img src="screenshots/and_lyrics.png" width="200" alt="Android lyrics">
</p>
<p align="center">
  <img src="screenshots/and_search_results.png" width="200" alt="Android search results">
  <img src="screenshots/and_library.png" width="200" alt="Android library">
  <img src="screenshots/and_settings.png" width="200" alt="Android settings">
</p>

## ✨ Features

- 🎧 **Real playback & full downloads** — stream from YouTube Music or save tracks for offline (`yt-dlp` + `ffmpeg` on desktop).
- 📲 **On-device streaming on Android** — the phone resolves playable YouTube streams itself via embedded [NewPipeExtractor](https://github.com/TeamNewPipe/NewPipeExtractor) + a ported `po_token`/BotGuard generator, and keeps playing in the background (foreground media service) with the screen locked. No desktop companion needed.
- 📋 **Playlist import** — paste a playlist (a CSV export, track links, or plain *Title — Artist* lines), hit **Import** in Treble, and we parse it, match every track on YouTube Music, and save it as a real, playable Treble playlist.
- 🎤 **Time-synced lyrics** — pulled from [LrcLib](https://lrclib.net), highlighting the active line as it plays; click any line to seek. Pop-out window or full-screen split view.
- 📡 **"Send to…" any device on your Wi-Fi** — cast-style handoff. Treble devices find each other over the LAN (mDNS); right-click a song → **Send to ▸** and it plays on the other device. No cloud, no account, nothing leaves your network.
- 📁 **Local files too** — point Treble at a music folder and it indexes your own files (tags and all) right alongside streamed tracks.
- 😴 **Sleep timer** — 15/30/45/60 minutes or end-of-track, with a live countdown.
- 🌗 **Light + dark, 4 accents** — Amber, Coral, Rose, Gold. Instant theme swap, no reload.
- 🪟 **Pop-out mini-player & lyrics windows** — real always-on-top windows on desktop.
- 📱 **Actually cross-platform** — Win32, Ubuntu/Linux, and a **sideloadable Android APK** from one codebase.

## 📥 Download

Windows installer and a sideloadable arm64 Android APK on the
**[Releases page](https://github.com/sp00nznet/treble/releases/latest)**. Desktop transcoding wants
`ffmpeg` on your PATH; `yt-dlp` ships inside the installer.

## 🚀 Quick start

```bash
git clone https://github.com/sp00nznet/treble
cd treble/app
npm install

npm run dev          # fast UI iteration in a browser tab
npm run desktop      # the real frameless desktop app (Tauri)
npm run desktop:build  # produce a win32 / linux bundle
```

**Prerequisites:** Node 18+, the [Rust toolchain](https://rustup.rs), and the
[Tauri 2 system deps](https://tauri.app/start/prerequisites/) for your OS. `ffmpeg` is bundled by
`scripts/fetch-tools` (see [docs/BUILDING.md](docs/BUILDING.md)).

Building the Android APK? See **[docs/BUILDING.md → Android](docs/BUILDING.md#android)** — you'll need
the Android SDK/NDK once, then `npm run android:build` spits out a sideloadable APK.

## 🧱 How it's built

```
treble/
├── app/                     the application
│   ├── src/                 React + TypeScript frontend (the warm UI)
│   │   ├── lib/api.ts        ← the bridge: typed calls into the Rust core (mock fallback in browser)
│   │   └── screens/          home · search · library · detail · downloads · settings · queue
│   └── src-tauri/           the Rust core — runs identically on desktop + Android
│       └── src/core/        catalog · downloads · lyrics · library · import · sync
├── design/                  the original design handoff (the source of truth for the look)
├── CREDITS.md               🙏 everyone whose work this stands on
├── ARCHITECTURE.md          how the pieces fit together
└── ROADMAP.md               what's done, what's next
```

One **Rust core**, three platforms. Catalog & search are native Rust
([`rustypipe`](https://codeberg.org/ThetaDev/rustypipe)) so the *exact same code* runs on the desktop app
and the Android APK. Stream resolution is the one platform-specific bit: `yt-dlp` on desktop, and embedded
[NewPipeExtractor](https://github.com/TeamNewPipe/NewPipeExtractor) + a ported `po_token` generator on
Android (no Python runtime required on your phone). Full story in **[ARCHITECTURE.md](ARCHITECTURE.md)**.

## 🗺️ Status

Treble is an **early but real prototype**. The entire UI is built and the architecture is in place; the
backend is being wired screen by screen. Track it in **[ROADMAP.md](ROADMAP.md)**.

## ⚖️ A note on being a good citizen

Treble is a personal, educational, open-source music client in the long tradition of
[NewPipe](https://newpipe.net), [InnerTune](https://github.com/z-huang/InnerTune), and
[yt-dlp](https://github.com/yt-dlp/yt-dlp). Use it for your own music, respect artists, respect the
terms of service of the platforms you connect to, and please **buy merch / concert tickets / records**
from the people who make the music you love. Don't be weird with it.

## 🤝 Contributing

This is a hobby project with big dreams. Issues, ideas, and PRs welcome — start with
[ROADMAP.md](ROADMAP.md) to see where the gaps are. Be kind, credit upstream, keep it warm.

## 📜 License

[GPL-3.0](LICENSE) — same spirit as the projects Treble is built on. If you build on Treble, keep it open.

<div align="center">

*Made with 🧡 and an unreasonable number of CSS custom properties.*

</div>
