# Treble

A warm, cross-platform music client — **Tauri + React + TypeScript + Vite**. This is the
**started implementation** of the Treble design (see `../design_handoff_treble_music_client/`
for the full design references, screenshots, and screen-by-screen spec).

> Status: **scaffold (UI-complete)**. The app shell, theming, design tokens, store, **all desktop
> screens** (Home, Search, Explore, Library, Detail, Downloads, Queue, Settings) and the **overlays**
> (full-screen Now Playing, right-click context menu, floating mini-player + lyrics windows) are
> implemented and runnable against mock data. What remains is the real backend (audio, library,
> downloads), splitting the floating windows into real Tauri `WebviewWindow`s, and polish.
> Open this in **Claude Code** and continue.

## Prerequisites
- Node 18+ and npm
- Rust toolchain + the Tauri 2 system deps (see https://tauri.app/start/prerequisites/)

## Run
```bash
npm install
npm run dev          # web preview in the browser (fast iteration)
npm run desktop      # tauri dev — the real frameless desktop window
npm run desktop:build
```
`npm run dev` runs the UI in a normal browser tab (the titlebar's traffic lights are cosmetic
there). `npm run desktop` runs it inside the actual Tauri window (frameless, draggable titlebar).

## Architecture
```
src/
  main.tsx              app entry — mounts <StoreProvider><App/>
  App.tsx               shell: <Titlebar/> + <Sidebar/> + screen switch + <NowPlayingPanel/>
  store.tsx             Context + useReducer app state (screen, theme, accent, playback…)
  theme.ts              ACCENTS map + applyTheme() — single source of theming truth
  types.ts              Track / Playlist / LibraryItem / Screen / Accent…
  data/mock.ts          placeholder catalog (gradient art) — replace with real data layer
  styles/
    tokens.css          design tokens — light :root + [data-theme="dark"] (verbatim from design)
    global.css          component classes (sidebar, titlebar, cards, rows, player…)
  components/
    Titlebar.tsx        frameless titlebar (drag region + search + theme toggle + account)
    Sidebar.tsx         nav rail + playlists
    NowPlayingPanel.tsx persistent docked player (Studio layout — no bottom bar)
    TrackRow.tsx        one song row
  screens/
    Home.tsx Search.tsx Explore.tsx Library.tsx Detail.tsx Downloads.tsx Queue.tsx Settings.tsx  ✅ all built
    Placeholder.tsx     fallback (now unused — kept for new routes)
  components/
    NowPlaying.tsx      ✅ full-screen lyrics-split overlay
    ContextMenu.tsx     ✅ right-click track menu (+ add-to-playlist sub-view)
    FloatingWindows.tsx ✅ MiniPlayer + LyricsWindow (browser overlays; make Tauri windows)
src-tauri/              Rust side — window config (frameless 1440×900), commands go here
```

## Theming
`applyTheme(theme, accent)` sets `data-theme` on `<html>` (driving the neutral palette in
`tokens.css`) and writes the `--accent*` CSS variables. The store calls it whenever theme/accent
change (and listens to the OS theme in `auto` mode). **Never hardcode colors** — use the
`var(--token)` values.

## What's left (all specced in the handoff README)
- Wire a real audio backend (Rust/Tauri commands) + library / search / downloads data layer;
  replace `src/data/mock.ts`. Sync playback state to the floating windows via Tauri events
  (emit/listen on a `player:state` channel — the windows currently keep local state).
- Extend Settings to the full surface (Content, Storage, Privacy, About — see README §8)
- Self-host the fonts; swap `lucide-react` glyphs where the design uses a custom mark
- Mobile (Android / iOS) is a separate target — see `Treble Mobile.dc.html` in the handoff

## Multi-window & shortcuts (done)
- The **mini-player** and **lyrics** views open as real always-on-top Tauri `WebviewWindow`s
  (`src/lib/windows.ts` → `index.html?window=mini|lyrics` → `StandaloneWindow`). In a plain
  browser they fall back to in-app fixed overlays. Window perms are in
  `src-tauri/capabilities/default.json`.
- Keyboard: **⌘K / Ctrl+K** jumps to Search, **Esc** closes the top overlay (menu → now playing
  → lyrics → mini). See the effect in `App.tsx`.

See **CLAUDE.md** for working instructions.
