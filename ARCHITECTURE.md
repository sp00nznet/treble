# Architecture

Treble is **one Rust core wrapped in one React UI, shipped to three platforms** (Win32, Linux, Android)
through Tauri 2. This document explains how the pieces fit and *why* it's shaped this way.

```
┌──────────────────────────────────────────────────────────────┐
│                     FRONTEND  (React + TS)                     │
│   screens/  components/  store.tsx  theme.ts                   │
│                          │                                     │
│                  src/lib/api.ts   ← the ONLY bridge            │
│        (typed wrappers over Tauri `invoke` + event listeners;  │
│         falls back to mock data when run in a plain browser)   │
└──────────────────────────┬───────────────────────────────────┘
                           │  Tauri IPC (commands + events)
┌──────────────────────────┴───────────────────────────────────┐
│                    RUST CORE  (src-tauri/src/core)             │
│                                                                │
│   catalog        search / browse / resolve stream URLs         │
│                  → RustyPipe (InnerTube). Native on every OS.   │
│   downloads      fetch stream → ffmpeg mux/transcode → disk     │
│                  → yt-dlp on desktop; native fetch on Android.  │
│   lyrics         time-synced lyrics → LRCLIB HTTP API           │
│   library        playlists / tracks / cache state → SQLite      │
│   spotify_import parse clipboard track list → match → playlist  │
│   sync           LAN peer discovery (mDNS) + library exchange   │
└────────────────────────────────────────────────────────────────┘
```

## Why a native Rust catalog (and not just yt-dlp everywhere)?

The user asked for **full desktop/Android parity.** `yt-dlp` is Python — it can't run on Android without
shipping a Python runtime, which is miserable. So the *catalog* layer (search, browse, metadata) is
**native Rust** via [`rustypipe`](https://codeberg.org/ThetaDev/rustypipe), which speaks YouTube's
InnerTube API directly — **the same compiled code finds music on your laptop and your phone.**

**Resolving a *playable* stream is the hard part, and it's platform-specific.** YouTube now gates stream
URLs behind a `po_token` (BotGuard), so a bare InnerTube call doesn't return a working URL. Treble handles
it differently per platform:

- **Desktop:** `yt-dlp` (constantly updated, handles the `po_token`/signature dance) resolves and
  downloads. `ffmpeg` muxes.
- **Android:** an embedded copy of **NewPipeExtractor** runs YouTube's player JS locally (via Rhino) and a
  **ported NewPipe `po_token` generator** mints the token in an offscreen WebView — all **on-device**, no
  Python and no desktop companion. It's exposed to the Rust core over a localhost HTTP server. See
  [`android-newpipe/`](android-newpipe/) and [CREDITS.md](CREDITS.md).

`catalog::resolve_stream` dispatches through `resolve_any`: on-device NewPipe (Android) → `yt-dlp`
(desktop) → a desktop "companion" peer on the LAN (fallback) → native. The frontend contract never changes.

| Concern | Desktop (Win32/Linux) | Android |
|---|---|---|
| Search / metadata | `rustypipe` | `rustypipe` (same code) |
| Resolve playable stream | `yt-dlp` | embedded **NewPipeExtractor** + ported `po_token` (on-device) |
| Download to disk | `yt-dlp` + `ffmpeg` (bundled) | native fetch of the resolved URL |
| Background playback | OS-native | foreground media service (keeps streaming with screen off) |
| Lyrics | LRCLIB | LRCLIB |
| Library DB | SQLite file | SQLite file |

## The frontend ↔ core contract

The frontend **never** talks to the network or the filesystem directly. Everything goes through
`app/src/lib/api.ts`, which:

1. wraps each Rust command in a typed async function (`search(q)`, `streamUrl(id)`, `download(id)`,
   `getLyrics(id)`, `importSpotify(text)`, `listPlaylists()`, …);
2. listens to core **events** (`player:position`, `download:progress`, `sync:peer-found`) and pipes them
   into the store; and
3. **falls back to `data/mock.ts`** when `window.__TAURI__` is absent — so `npm run dev` in a browser
   still renders a fully populated UI for fast iteration.

This keeps components dumb and the platform boundary in exactly one file.

## State & playback

- UI state lives in `src/store.tsx` (Context + reducer) — see [app/CLAUDE.md](app/CLAUDE.md).
- **Playback position, queue, and download progress are driven by core events**, not UI timers. The Rust
  side owns the truth; the scrubbers and progress bars are projections of `player:position` /
  `download:progress`.
- The pop-out mini-player and lyrics windows are real Tauri `WebviewWindow`s; they subscribe to the same
  events so every surface stays in sync.

## Spotify import flow

```
clipboard text ──► spotify_import::parse ──► [{title, artist, album, duration}, …]
                                              │
                                  for each ──► catalog::match (rustypipe search, best-match heuristic)
                                              │
                                              ▼
                                   library::create_playlist  ──►  a real, playable Treble playlist
```

Spotify's desktop client puts a clean tab-separated `Title<TAB>Artist<TAB>Album` block on the clipboard
when you select tracks and copy. The parser is tolerant of that format and a few common fallbacks
(numbered lists, "Title — Artist"). Matching uses a title+artist+duration similarity score against
YouTube Music search results.

## LAN sync (no cloud, no account)

Devices advertise a `_treble._tcp` service over **mDNS**. When two Treble instances are on the same
network they discover each other, then exchange a compact, versioned snapshot of the library (playlists,
liked songs, play counts) over a direct local socket. Conflict resolution is last-writer-wins per record
with a vector of per-device clocks. Downloaded *audio files* are not synced over LAN by default (they're
large and device-local), but the *playlist* that references them is — so "download on desktop, see it on
mobile, re-download there" works.

> Why LAN and not a server? Zero infrastructure, zero accounts, nothing leaves your home network, and it
> can't get shut down. The trade-off — both devices must be online together on the same network to
> sync — is fine for a personal app. A manual export/import file is the always-available fallback.

## Build targets

| Target | Command | Output |
|---|---|---|
| Win32 | `npm run desktop:build` | `.exe` / `.msi` |
| Linux (Ubuntu) | `npm run desktop:build` | `.deb` / AppImage |
| Android | `npm run android:build` | sideloadable `.apk` |

See [docs/BUILDING.md](docs/BUILDING.md) for the full per-platform setup.
