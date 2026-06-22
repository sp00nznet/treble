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
| **RustyPipe** (ThetaDev) | Native Rust client for the YouTube / YouTube Music InnerTube API — powers catalog & search on every platform. | https://codeberg.org/ThetaDev/rustypipe |
| **NewPipe / NewPipeExtractor** | The original reverse-engineering of YouTube's private API that this whole ecosystem descends from. Treble **embeds NewPipeExtractor** to resolve playable streams on Android *on-device* — and **ports NewPipe's `po_token` / BotGuard generator** (see below). | https://newpipe.net · https://github.com/TeamNewPipe/NewPipeExtractor |
| **FFmpeg** | Audio muxing, transcoding, and format conversion for downloads. | https://ffmpeg.org |

### 📱 On-device Android streaming (a direct code port)

Standalone YouTube playback on the phone — no desktop companion — is built **directly on NewPipe's code**,
not just inspired by it. The following are ported into `android-newpipe/` (GPLv3, © NewPipe contributors),
adapted only to run outside the NewPipe app:

| Borrowed | From | Notes |
|---|---|---|
| `po_token` / BotGuard generator (`PoTokenWebView`, `PoTokenProviderImpl`, helpers, `po_token.html`) | [NewPipe](https://github.com/TeamNewPipe/NewPipe) (GPLv3) | Runs YouTube's BotGuard VM in an offscreen WebView to mint the `po_token` YouTube now requires for playback. Every ported file keeps a NewPipe attribution header. |
| BotGuard VM approach behind `po_token.html` | [BgUtils — LuanRT](https://github.com/LuanRT/BgUtils) | NewPipe's runner adapts LuanRT's BotGuard work; credited upstream of us. |
| **NanoHTTPD** | https://github.com/NanoHttpd/nanohttpd (BSD-3) | Tiny localhost HTTP server that exposes the on-device resolver to the Rust core. |
| **RxJava / RxAndroid** | https://github.com/ReactiveX/RxJava (Apache-2.0) | Async plumbing the ported `po_token` generator depends on. |
| **Mozilla Rhino** | https://github.com/mozilla/rhino (MPL-2.0) | Runs YouTube's player JS for signature deobfuscation; pulled in transitively by NewPipeExtractor. |

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
