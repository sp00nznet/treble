# CLAUDE.md — working notes for Treble

You are continuing the implementation of **Treble**, a Tauri + React + TS music client, from a
design that already exists. Read this before editing.

## Sources of truth
- **Design prototypes** (in `../design/`):
  - `Treble.dc.html` — the full desktop app (every screen, both themes, context menu, mini
    player, lyrics window, full settings). This is the visual + interaction spec.
  - `Treble Mobile.dc.html` — the mobile app (Android + iOS, all screens).
  - `README.md` — written spec: exact tokens, per-screen layout, interactions, state model.
  - `screenshots/` — rendered references.
- When a measurement, color, or behavior is unclear, the prototype + README are authoritative.
  Match them **pixel-faithfully** — exact hex, spacing, radii, font sizes.

## Ground rules
- **Theming:** only ever use `var(--token)` (see `src/styles/tokens.css`). To change theme/accent
  use the store + `applyTheme()` — never hardcode hex in components.
- **Type:** display = `Bricolage Grotesque`, UI/body = `Hanken Grotesque`. Use the `.h1/.h2`
  helpers or `var(--font-display)`.
- **No bottom player bar** — Treble uses the persistent docked right-hand `NowPlayingPanel`
  (the "Studio" layout). Keep it.
- **State** lives in `src/store.tsx` (Context + reducer). Add actions there; keep components thin.
- Prefer extending `global.css` classes over scattering inline styles, but inline is fine for
  one-offs (the existing components mix both — match the local style).

## Recommended order of work
1. Make the floating **mini-player** & **lyrics** windows real Tauri `WebviewWindow`s
   (`FloatingWindows.tsx` already renders the correct window bodies as overlays).
2. Replace `src/data/mock.ts` with a real data layer + a Rust/Tauri audio backend (register
   commands in `src-tauri/src/main.rs`); drive the scrubbers from real playback position.
3. Extend `Settings.tsx` to the full surface (Content, Storage, Privacy, About — README §8).
4. Self-host fonts; add keyboard shortcuts (Esc closes overlays, ⌘K focuses search).

## Conventions
- Icons: `lucide-react` (already a dep). Swap to custom SVG only where the design's mark differs.
- Keep `npm run build` (tsc) green — `strict` + `noUnusedLocals` are on.
- Commit screen-by-screen; keep each screen a single file under `src/screens/`.
