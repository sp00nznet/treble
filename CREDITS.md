# 🙏 Credits

Treble is **a nice interface on a lot of work other people built.** Almost everything that makes Treble
actually *do* something — find music, play it, download it, show lyrics, run on three platforms — comes
from the projects below. This file exists because they deserve top billing, not a footnote.

If you enjoy Treble, the kindest thing you can do is **go star their repositories and support them.**

---

## 🎬 The engine — finding & playing music

| Project | What Treble uses it for | Link |
|---|---|---|
| **yt-dlp** | The gold-standard media downloader. Powers full-quality desktop downloads. | https://github.com/yt-dlp/yt-dlp |
| **RustyPipe** (ThetaDev) | Native Rust client for the YouTube / YouTube Music InnerTube API. This is *the* reason Treble can run the same catalog engine on desktop **and** Android. | https://codeberg.org/ThetaDev/rustypipe |
| **NewPipe / NewPipeExtractor** | The original reverse-engineering of YouTube's private API that this whole ecosystem descends from. | https://newpipe.net · https://github.com/TeamNewPipe/NewPipeExtractor |
| **FFmpeg** | Audio muxing, transcoding, and format conversion for downloads. | https://ffmpeg.org |

## 🎤 Lyrics

| Project | What Treble uses it for | Link |
|---|---|---|
| **LRCLIB** | Free, open, community lyrics database — the source for Treble's time-synced lyrics. | https://lrclib.net · https://github.com/tranxuanthang/lrclib |
| **KuGou / others** | Additional lyrics providers (planned, mirroring InnerTune's provider set). | — |

## 📋 Spotify import

| Project | What Treble owes it | Link |
|---|---|---|
| **spotDL** | Pioneered the "Spotify metadata → match on YouTube → download" model that Treble's clipboard import is built on. | https://github.com/spotDL/spotify-downloader |

## 📱 The spiritual predecessors (YouTube Music clients)

Treble's whole *concept* — a beautiful, free, ad-free YouTube Music client with downloads and a great
settings surface — is lifted lovingly from these Android apps. The settings layout, library tabs, and
lyrics provider toggles are directly inspired by them.

| Project | Link |
|---|---|
| **InnerTune** (z-huang) | https://github.com/z-huang/InnerTune |
| **OuterTune** (DD3Boh) | https://github.com/DD3Boh/OuterTune |
| **Metrolist / NekoTune** and the wider InnerTune fork family | https://github.com/mostafaalagamy/Metrolist |
| **ViMusic** | https://github.com/vfsfitvnm/ViMusic |

## 🧱 The app framework & frontend

| Project | What Treble uses it for | Link |
|---|---|---|
| **Tauri 2** | The cross-platform shell — desktop **and** Android — with a Rust backend and a webview frontend. | https://tauri.app |
| **Rust** | The whole core: catalog, downloads, library, sync. | https://www.rust-lang.org |
| **React + Vite + TypeScript** | The frontend UI runtime and build tooling. | https://react.dev · https://vitejs.dev |
| **Lucide** | The clean line-icon set used throughout the UI. | https://lucide.dev |
| **SQLite** (via `rusqlite`) | The local, portable library database. | https://www.sqlite.org |

## 🔤 Typography

| Typeface | Designer | Use |
|---|---|---|
| **Bricolage Grotesque** | Mathieu Triay (ATÉ) | Display / headings / the Treble logotype |
| **Hanken Grotesque** | Alfredo Marco Pradil | UI / body text |

Both are open-source fonts. In production they're self-hosted; see [docs/BUILDING.md](docs/BUILDING.md).

## 🎨 The design

The Treble look — the warm "Studio" layout, the lyrics-split now-playing view, the four-accent token
system, the light/dark palettes — comes from the original **Treble design handoff**, preserved in
[`design/`](design/). It set the visual direction this implementation follows pixel-faithfully.

---

### Did we miss you?

If your work is in Treble and you're not credited here, that's a bug — please
[open an issue](https://github.com/sp00nznet/treble/issues) and we'll fix it immediately. Everyone who
helped build the foundation deserves their name on it.
