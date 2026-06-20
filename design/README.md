# Handoff: Treble — Music Client UI (Desktop + Mobile)

## Overview
**Treble** is a cross-platform music client (Tauri desktop + Android, in the spirit of NekoTune / InnerTune — a YouTube Music–style streaming client). This package documents the **UI/UX design** for the full app: home, search, explore, library (incl. podcasts), album/playlist detail, full-screen now playing, synced lyrics, downloads/offline, a complete settings surface, a persistent docked player, a right-click context menu, and pop-out **mini-player** and **lyrics** windows. A matching **mobile board** (Android screens + iOS scaffold) is included. It is a **Spotify-adjacent but visually distinct** product with its own warm amber/coral identity, light + dark themes, and a frameless macOS-style window.

> **Name:** "Treble" is a working brand name (a play on _treble_ / _treble-maker_). Swap freely — it appears only in the sidebar logo and the titlebar.

## About the Design Files
The files in this bundle are **design references created in HTML** — interactive prototypes that show the intended look, layout, and behavior. **They are not production code to copy verbatim.** They use a small custom rendering runtime (`support.js`, the `.dc.html` Design Component format) purely so the prototype is editable; **do not port that runtime.** Two design files: `Treble.dc.html` (desktop) and `Treble Mobile.dc.html` (phone).

Your task: **recreate these designs in the target codebase's environment.** This is a Tauri desktop app, so the natural target is a **web frontend framework (React, Svelte, Vue, or SolidJS) inside the Tauri shell**, with Rust on the backend for playback/downloads/caching. If you're starting fresh, React + Vite + Tailwind (or CSS variables as shown here) is a clean fit. Use the codebase's established patterns and component library if one exists.

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing, radii, shadows, and interaction states are all final and intentional. Recreate the UI pixel-faithfully, then wire it to real data/playback. The exact hex values, fonts, and measurements below are authoritative.

## ▶ Started implementation — `../treble-app/`
A runnable **Tauri + React + TypeScript + Vite** scaffold has been started from this design and lives next to this folder at **`treble-app/`**. It already implements the design tokens, theming (light/dark + 4 accents), the app shell (frameless titlebar + sidebar + persistent docked player), the store, and the **Home / Library / Settings** screens; remaining screens + overlays are stubbed with `TODO`s pointing back here. See `treble-app/README.md` to run it and `treble-app/CLAUDE.md` for working instructions. Continue building there — this `design_handoff` folder stays the visual + behavioral source of truth.

---

## Global Layout & Window

The app is a **frameless desktop window** (`100vw × 100vh`, no OS title bar — `decorations: false` in Tauri). Structure top-to-bottom:

```
┌───────────────────────────────────────────────────────────┐
│ TITLEBAR  (46px)  — drag region                           │
├──────────┬──────────────────────────────┬─────────────────┤
│   NAV    │        CENTER (scrolls)       │  DOCKED PLAYER  │
│  230px   │           flex: 1             │     300px       │
│          │                               │  (Now Playing)  │
└──────────┴──────────────────────────────┴─────────────────┘
```

- **Design width target:** 1440 × 900 (min window ~1100 wide).
- **Titlebar (46px):** `-webkit-app-region: drag` on the bar; `no-drag` on all interactive children. Left: macOS traffic lights (red `#ff5f57`, amber `#febc2e`, green `#28c840`, 12px circles, 8px gap) + back/forward chevrons. Center: a search-trigger pill (420px, opens Search). Right: theme toggle button + account chip. Background `--panel`, bottom border `--border`.
- **Nav rail (230px):** logo + primary nav + playlists list (scrolls). Background `--panel`.
- **Center pane:** the only vertically-scrolling region; background `--bg`. Swaps content by active screen.
- **Docked Now-Playing panel (300px):** always visible (this is the signature "Studio" layout — there is **no bottom player bar**). Background `--panel`, left border `--border`. Contains art, track meta, scrubber, transport, volume/queue, and a lyrics teaser. Clicking the art / expand / lyrics opens the **full-screen Now Playing** overlay.

### Theming
Implemented with **CSS custom properties** on a root element; toggling theme swaps the variable values (instant, no re-render of the tree). Accent is also a swappable token. Default theme = **light**; both must be supported.

---

## Design Tokens

### Typography
- **Display / headings:** `Bricolage Grotesque` (weights 700–800). Used for screen titles, track/section headings, logo, big lyrics. Tight tracking (`letter-spacing: -0.02em` on large sizes).
- **UI / body:** `Hanken Grotesque` (weights 400–800). Everything else.
- Both via Google Fonts. (Self-host in production.)
- Scale in use: screen H1 30–32px/800; hero detail title 54px/800; section H2 20–22px/700; card title 14–15px/700; body 13–14px/500–600; meta/labels 11–13px; uppercase eyebrow labels 11–12px/700, `letter-spacing: .08em`, `text-transform: uppercase`.

### Color — Light theme (default)
| Token | Value | Use |
|---|---|---|
| `--bg` | `#faf7f2` | App background (warm off-white) |
| `--panel` | `#f1ece3` | Nav rail, docked player, titlebar |
| `--surface` | `#ffffff` | Cards, inputs, raised rows |
| `--surface-2` | `#f4efe7` | Hover rows, track fills, segmented bg |
| `--border` | `rgba(0,0,0,.07)` | Hairline borders |
| `--border-2` | `rgba(0,0,0,.05)` | Subtler dividers |
| `--text` | `#2a2620` | Primary text |
| `--text-2` | `#6b655e` | Secondary text |
| `--text-3` | `#a59d94` | Tertiary / meta / index numbers |
| `--shadow` | `rgba(0,0,0,.13)` | Card/art shadow color |

### Color — Dark theme
| Token | Value |
|---|---|
| `--bg` | `#141210` |
| `--panel` | `#100e0c` |
| `--surface` | `#1c1917` |
| `--surface-2` | `#252119` |
| `--border` | `rgba(255,255,255,.07)` |
| `--border-2` | `rgba(255,255,255,.05)` |
| `--text` | `#f5f1ea` |
| `--text-2` | `#a8a098` |
| `--text-3` | `#6f675f` |
| `--shadow` | `rgba(0,0,0,.5)` |

### Accent (swappable, 4 presets) — `{light, dark, gradient}`
The gradient is used for play buttons, progress fills, and the logo mark; the flat color for active states, links, and highlights. `--accent-soft` is a ~12–14% alpha tint used for active-nav glow and section header washes.

| Preset | Light flat | Dark flat | Gradient |
|---|---|---|---|
| **Amber** (default) | `#E2622E` | `#FF9A5C` | `linear-gradient(135deg,#FFB35C,#FF6B5C)` |
| Coral | `#E0463E` | `#FF7A6B` | `linear-gradient(135deg,#FF8A6B,#FF4E5C)` |
| Rose | `#D2456A` | `#FF8AB0` | `linear-gradient(135deg,#FF8AB0,#E84E7C)` |
| Gold | `#B5851A` | `#F2C24E` | `linear-gradient(135deg,#FFD27A,#F2A93E)` |

`--accent-soft`: Amber light `rgba(226,98,46,.12)`, dark `rgba(255,138,76,.14)` (analogous alpha tints per preset).

### Spacing, radius, shadow
- **Spacing:** screen padding `30px 34px 40px`; card gaps 12–18px; section vertical rhythm ~38px between blocks.
- **Radius:** cards/art 10–16px; pills/chips 20–24px (full); inputs 9–12px; nav items 8–9px; circular play buttons & avatars 50%.
- **Shadows:** art/cards `0 8px 20px var(--shadow)`; large detail art `0 20px 44px var(--shadow)`; primary play FAB `0 8px 20px rgba(255,107,92,.4)`; docked-panel art `0 16px 34px var(--shadow)`.

### Album art
All artwork in the prototype is **CSS gradient placeholders** (135° linear gradients). In production these are real cover images. Keep the square aspect ratio, the radius, and the drop shadow.

### Icons
Inline **SVG, 1.5–2px stroke, round caps/joins**, 18–24px (line icons) — a Lucide/Feather-style set works perfectly. Filled SVGs for play/pause/prev/next, heart, and the "downloaded" check. Use your codebase's icon library; match weights.

---

## Screens / Views

### 1. Home (`screen: 'home'`) — default
- **Header:** eyebrow greeting in `--accent` (time-aware: "Good morning/afternoon/evening"), H1 "Welcome back, Kaz" (Bricolage 32/800). Right: filter chips **All / Music / Podcasts** (active = `--accent` bg, white text; inactive = `--surface` + border).
- **Quick picks:** 3-col grid of horizontal cards (height 66px, `--surface`, art square left, title, play FAB revealed on hover at right). 6 items.
- **Made for you:** section H2 + "Show all". 5-col grid of vertical cards (`--surface` card, square art, title + 2-line clamp subtitle). Hover: card lifts `translateY(-4px)`, play FAB fades up in.
- **Recently played:** track-list rows — grid `30px | 1fr | 1fr | 70px` = index/play · title+art+artist · album · duration. Row hover: bg `--surface-2`, index number swaps to a small play icon.

### 2. Search (`screen: 'search'`)
- Large search input (52px, icon-left, "What do you want to listen to?").
- **Recent searches:** rounded chips with circular thumbnail + label.
- **Browse all:** 4-col grid of genre tiles (120px, gradient bg, bold white title, decorative rotated square bottom-right). 12 genres: Pop, Hip-Hop, Rock, Indie, Electronic, Jazz, Classical, R&B, Lo-fi, Ambient, Metal, Folk.

### 3. Explore (`screen: 'explore'`)
- Hero band with `--accent-soft` radial wash: eyebrow "EXPLORE" + H1 "Fresh sounds & deep cuts".
- **New releases:** 5-col vertical cards (same card pattern as Made-for-you, no surface bg).
- **Charts:** 2-col list cards (art + title + subtitle + chevron). "Top 50 — Global", "Viral 50", "New Music Friday", "Indie Rising".

### 4. Library (`screen: 'library'`)
- H1 "Your Library" + "+ New" button (accent).
- **Tabs:** Playlists / Albums / Artists / **Podcasts** / Songs (segmented pills; active = accent). Tab switches the grid below.
- 5-col grid. **Artists** tab uses circular art + centered text; **Podcasts** uses 14px-radius art + show name + publisher; others use rounded-square art + left text.

### 5. Album / Playlist Detail (`screen: 'detail'`)
- **Header:** `--accent-soft → transparent` gradient. 212px square art (shadow `0 20px 44px`), eyebrow "Playlist", giant title (Bricolage 54/800, tight), description (max 520px), owner avatar + "Kaz · 24 songs, 1h 38m".
- **Action bar:** 56px circular play FAB (accent gradient) + heart + download + more (`…`).
- **Track table:** grid `30px | 1fr | 1fr | 90px | 60px` = #/play · title+art+artist · album · date added · duration. Header row with uppercase labels + clock icon. Same hover behavior as Home rows.
- Opened by clicking any playlist (nav rail or anywhere), card, or quick pick.

### 6. Now Playing — Full screen (overlay, `npOpen: true`)
This is the **"Lyrics split"** signature view. `position: fixed; inset: 0; z-index: 50`. Own draggable titlebar strip with a collapse button (top-right).
- **Left (46%, max 560px):** dark gradient panel `linear-gradient(180deg,#3a1c20,#140f0d 70%)`. 300px square art (shadow `0 28px 64px rgba(0,0,0,.55)`), title (Bricolage 34/800, white), "artist · album", heart, gradient progress bar + times, transport row with a **white** circular play FAB (64px).
- **Right (flex):** big synced lyrics, Bricolage 700. **Active line** is large (42px) in a warm tint (`#FFB98A`); past/future lines are dimmed white (`rgba(255,255,255,.18–.28)`). Lines are clickable to seek; transition color `.3s`. This doubles as the **synced-lyrics view**.

### 7. Downloads / Offline (`screen: 'downloads'`)
- H1 "Downloads" + "Available offline" subtitle.
- **Storage card:** progress bar ("2.4 GB of 8 GB", 30% fill, accent gradient) + "Auto-download" toggle (on).
- Track list grid `1fr | 1fr | 30px | 60px` = title+art+artist · album · green "downloaded" check (`#2BAE66`) · duration.

### 7b. Queue (`screen: 'queue'`, opened from the docked panel's queue icon)
- H1 "Queue" + "Clear queue" pill.
- **Now playing** card on `--accent-soft` with an animated 4-bar **equalizer** (the `@keyframes eqb` indicator).
- **Next up** list, grid `24px | 1fr | 1fr | 60px` = drag handle · title+art+artist · album · duration. Rows are reorderable in production (drag handle shown); right-click opens the same context menu.

### 8. Settings (`screen: 'settings'`, max-width 780px)
Grouped into titled cards (uppercase eyebrow label above each `--surface` card). Controls: **segmented** (pill group, active = `--surface` + shadow + accent text), **toggle** (42×24 pill, on = `--accent` track + knob right), **value row** (label + tappable `--surface-2` pill showing current value + chevron — opens a picker in production), and **buttons**. This mirrors the InnerTune / NekoTune settings surface:
- **Appearance** — Theme (Light / Dark / **Auto** = follow system); Accent color (4 swatches); Player text alignment (Center / Sided); Progress slider style (Default / **Squiggly**); Grid item size (Small / Big); Default open tab (value); Pure black (toggle, dark-mode only in spirit).
- **Content & account** — Account row (avatar + name + Sign out); Content language (value); Content country (value); Hide explicit content (toggle); LrcLib lyrics (toggle); KuGou lyrics (toggle).
- **Player & audio** — Audio quality (Auto / High / Low); Skip silence (toggle); Audio normalization (toggle); sub-group *Queue & behavior*: Persistent queue, Auto-load more, Crossfade, Gapless playback, Stop on window close (toggles).
- **Storage** — Song cache bar (1.8 GB / 4 GB), Image cache bar (240 MB / 512 MB), Clear song cache / Clear images buttons.
- **Privacy** — Pause listening history (toggle); Pause search history (toggle); Clear listening / Clear searches buttons.
- **About** — App icon + "Treble · Version 1.0.0 · Desktop" + Check for updates; GitHub repository; Open-source licenses.

> Anything not yet wired in InnerTune's set but worth carrying on desktop: Discord Rich Presence integration and Backup & restore (export/import library + settings) — both appear as additional Settings cards in their app; add when those features land.

### 9. Right-click context menu (on any song row)
Opens at the cursor on `contextmenu`; backdrop dismisses. 236px `--surface` panel, song header (art + title + artist), then grouped items separated by hairlines: **Play · Play next · Add to queue** / **Add to playlist ▸ · Save to Liked Songs · Start radio (songs like this)** / **Go to album · Go to artist** / **Download · Share**. "Add to playlist" swaps the panel to a sub-view (Back · New playlist · each playlist). Rows hover to `--surface-2`.

### 10. Mini / floating player (separate always-on-top window)
Opened from the docked panel's pop-out icon. 340px dark rounded window with its own 30px drag bar (traffic lights + pin + close), a 170px art block with a gradient scrim + expand-to-full button, track title/artist over the art, scrubber + times, and a centered transport row with a white play FAB. In production this is a real second Tauri window (`always_on_top`, `decorations:false`).

### 11. Pop-out lyrics / transcription window (separate window)
Opened from the lyrics-teaser pop-out icon. 360×480 dark window, own drag bar (pin + close), a compact track header (art + title/artist), then the scrolling synced lyrics (active line tinted `#FFB98A`, others dimmed). Same data as the full-screen lyrics; also a separate Tauri window in production.

### Docked Now-Playing panel (persistent, all screens)
Square art (click → full screen), title/artist, heart, gradient scrubber + times, transport row (shuffle · prev · **play/pause FAB** accent gradient 50px · next · repeat), volume slider + queue button, and a **lyrics teaser card** (`--surface`, accent "LYRICS" label, 3 lines with the active line emphasized) that expands to full screen on click.

---

## Interactions & Behavior
- **Navigation:** nav-rail items set the active screen; the active item gets `--surface` bg + `--accent` text + subtle shadow. Library + Detail both keep "Library" highlighted.
- **Open detail:** clicking a playlist (rail), card, quick pick, or chart row → Detail screen with that title.
- **Now Playing overlay:** open via docked-panel art / expand icon / lyrics teaser; close via collapse button. (Could also bind `Esc`.)
- **Right-click context menu:** `contextmenu` on a song row opens the menu at the cursor with the song captured; backdrop click or another right-click dismisses; "Add to playlist" opens an in-place sub-view.
- **Mini player & lyrics windows:** pop-out icons in the docked panel header (mini) and lyrics teaser (lyrics) open floating windows; each has its own close button. In production these are separate Tauri windows, not in-DOM overlays.
- **Play/pause:** toggles icon between play triangle and pause bars (docked FAB + full-screen + mini all share state).
- **Theme toggle:** titlebar button **and** Settings segmented control both flip light/dark/auto by rewriting the CSS variables on the root.
- **Accent:** Settings swatches rewrite `--accent`, `--accent-soft`, `--accent-grad`.
- **Hover states:** track rows → `--surface-2` bg + index→play swap; cards → lift + play FAB; all buttons use a `.pressable` pattern (`:hover` brightness 1.06, `:active` scale .94, transitions ~.12s).
- **Transitions:** card lift `transform/box-shadow .18s ease`; lyric color `.3s`; pressable `.12s`. (No heavy entrance animation.)
- A 3-bar **equalizer** keyframe (`@keyframes eqb`) is defined for an optional "now playing" indicator on the active track.

## State Management
Minimal local UI state in the prototype; in production back these with your player/store:
- `screen` — active route (home/search/explore/library/detail/downloads/settings/queue).
- `themePref` ('light' | 'dark' | 'auto') + derived `dark`; `accent` ('Amber' | 'Coral' | 'Rose' | 'Gold') — persist to disk/localStorage.
- `libTab` — active Library tab (incl. Podcasts).
- `npOpen` / `miniOpen` / `lyricsOpen` — full-screen player, mini-player window, lyrics window visibility.
- `menu` ({x, y, song}) + `menuView` ('main' | 'playlists') — context menu.
- `sw` (toggle map) + `en` (enum map) — all Settings values.
- `playing` — transport state. `detailTitle` — which playlist/album is open.
- **Real app needs:** current track + queue, playback position/duration (drives scrubbers), liked state, download/cache status per track, synced-lyrics data with timestamps (drives active-line highlight), search query + results, and library collections. Routing should map to these screens (consider a router rather than a single `screen` enum).

## Assets
- **Fonts:** Bricolage Grotesque, Hanken Grotesque (Google Fonts — self-host for desktop/offline).
- **Icons:** inline SVG line/filled set — replace with your icon library (Lucide/Feather match the style).
- **Album art:** gradient placeholders in the prototype → real cover images in production.
- No raster/brand assets are required from this bundle.

## Mobile (Android + iOS) — `Treble Mobile.dc.html`

The mobile file is a **fully interactive phone prototype**, not a static board. It carries **all the same screens** as desktop, built **once** and rendered with **either Android or iOS chrome** via a platform switch. Both **light and dark** themes are supported (same token system as desktop). Primary target is **Android** (Jetpack Compose, or React Native / Flutter sharing the product), with **iOS** fully laid out alongside it.

**How to drive the prototype (review only — not app chrome):** above the phone are a **platform toggle** (Android ⇄ iOS), a **theme toggle**, and a **screen jumper** (chips for every screen). In the real app, navigation comes from the bottom tab bar + mini player, not these chips.

- **Frame:** 390 × 844. Corner radius 34 (Android) / 46 (iOS).
- **Chrome (the only platform difference):**
  - **Android** — 38px status bar (time + signal/wifi/battery), standard bottom nav, no home indicator.
  - **iOS** — 54px status bar with a **Dynamic Island** pill, and a **home-indicator** bar at the bottom of the nav and full-screen player. Status height is set via a `--status-h` CSS var swapped on platform change; screens pad to it.
- **Navigation:** bottom tab bar — **Home · Search · Library · Settings** (active = accent, filled icon + label). A **mini player** (dark rounded bar: art + title/artist + heart + play/pause) sits directly above the tab bar on all browse screens; tap it to open Now Playing.
- **Screens (every one, both platforms):**
  - **Home** — greeting + chips (All / Music / Explore), 2-col quick picks, "Made for you" horizontal scroll, recently-played list.
  - **Search** — search field, recent-search chips, 2-col genre tiles.
  - **Explore** — accent-wash header, "New releases" scroll, "Charts" list.
  - **Library** — chips **Playlists / Albums / Artists / Podcasts** (switch the list); Artists use circular art.
  - **Playlist detail** — centered art header, action row (heart · download · **play FAB** · shuffle · more), track list.
  - **Downloads** — storage card (bar + auto-download toggle) + list with green "downloaded" checks.
  - **Settings** — account row; Appearance (Theme Light/Dark + Accent swatches); Player & audio (Audio quality value + Skip silence / Normalization / Crossfade / Gapless toggles); Privacy & about (Pause history toggle + About row). Condensed mirror of the desktop settings surface.
  - **Now Playing** (overlay) — art-forward full screen: `down / playing-from / queue` top bar, big art, title/artist + heart, scrubber, transport, devices/share/**lyrics** footer.
  - **Lyrics** (overlay) — gradient bg, active line tinted `#FFB98A`, control bar pinned bottom.
  - **Queue** (overlay) — now-playing card with animated equalizer + reorderable "Next up" list.
- Now Playing / Lyrics / Queue are **pushed full-screen overlays** (hide the tab bar); everything else is a tab. The desktop's docked side panel collapses to the mini player on phones.

### Wiring it up (state & navigation)
The prototype's logic mirrors what production needs:
- **`screen`** — current route. Bottom-tab taps set `home / search / library / settings`; Explore is reached from Home, Detail from any list/card, Downloads from Library/Settings. Now Playing opens from the mini player or a track tap; Lyrics from the player's lyrics button; Queue from the player's queue icon. Use a real navigation stack/router in production (the overlays are modal routes).
- **`platform`** (`android | ios`) — in production this is the build target, not runtime state; it only gates chrome (status bar height, Dynamic Island, home indicator). Keep all screen code shared; branch **only** on chrome.
- **`dark`** + **`accent`** — same CSS-variable theming as desktop; persist to preferences. `applyTheme()` rewrites the tokens; `applyChrome()` sets `--status-h` per platform.
- **`libTab`**, **`playing`**, per-setting toggles — local UI state; back these with your library store + media session.
- **Platform parity to implement natively:** Android → Material bottom nav, edge-to-edge insets, `MediaStyle` notification, system back. iOS → safe-area insets, Dynamic Island / lock-screen Now Playing, swipe-back. The **shared layer** is every screen, the warm tokens, playback/library logic, and the synced-lyrics renderer.

## Screenshots
Rendered references live in `screenshots/`:
- `desktop-home-light.png`, `desktop-home-dark.png` — Home in both themes
- `desktop-search.png`, `desktop-library.png`, `desktop-detail.png`, `desktop-settings.png` — core screens
- `desktop-now-playing.png` — full-screen lyrics-split player
- `desktop-floating-windows.png` — mini player + pop-out lyrics windows
- `desktop-context-menu.png` — right-click song menu
- `mobile-android-home.png` — Android Home; `mobile-ios-home.png` — iOS Home (Dynamic Island)
- `mobile-now-playing.png`, `mobile-ios-lyrics.png`, `mobile-settings.png` — mobile player / lyrics / settings

> Note: desktop shots were captured in a ~910px-wide preview, so the center column reads narrower than the 1440px design target; spacing breathes more at full width.

## Files
- `Treble.dc.html` — the full **desktop** application UI (all screens, both themes, context menu, mini player, lyrics window, full settings). **Primary reference.**
- `Treble Mobile.dc.html` — the **mobile** prototype: every screen for **both Android & iOS**, interactive (platform/theme/screen controls), with bottom-tab nav, mini player, and full-screen player/lyrics/queue overlays.
- `Directions_explored.dc.html` — the earlier exploration: 3 Home directions (Aurora / Editorial / Studio) + 3 Now-Playing treatments (Ambient / Lyrics-split / Visualizer). Context for _why_ the chosen direction looks the way it does; **Studio + Lyrics-split were selected.**
- `screenshots/` — rendered PNGs of every screen (see above).
- `support.js` — the prototype runtime only. **Do not port.**

> To view a prototype: open a `.dc.html` in a browser. The `.dc.html` files are self-rendering.
