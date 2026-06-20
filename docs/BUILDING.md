# Building Treble

One codebase, three targets. Here's how to get each one running and packaged.

## Prerequisites (all platforms)

- **Node 18+** and npm
- **Rust** (stable) — install via [rustup](https://rustup.rs)
- **Tauri 2 system dependencies** — follow https://tauri.app/start/prerequisites/ for your OS
- **FFmpeg** — bundled into the app by `scripts/fetch-tools` (see below). A system `ffmpeg` also works for dev.

```bash
cd app
npm install
```

### Bundled tools (yt-dlp + ffmpeg)

Desktop downloads use `yt-dlp` and `ffmpeg`. They are **not** committed to the repo; fetch the right
binaries for your OS into `app/src-tauri/binaries/` once:

```bash
npm run fetch-tools     # downloads yt-dlp + ffmpeg for your platform
```

(The script is in `scripts/fetch-tools.mjs`; `binaries/` is git-ignored.)

## Run (development)

```bash
npm run dev          # UI only, in a browser tab — fastest iteration, uses mock data
npm run desktop      # the real frameless Tauri window with the live Rust core
```

`npm run dev` runs the React UI in a normal browser; since there's no Tauri context, `src/lib/api.ts`
serves mock data so every screen is populated. `npm run desktop` runs the actual app with the Rust core.

## Win32 (Windows)

```bash
npm run desktop:build
```

Produces an `.exe` and an `.msi` installer under `app/src-tauri/target/release/bundle/`.

## Linux (Ubuntu)

Install the Tauri Linux deps first (webkit2gtk etc. — see the prerequisites link), then:

```bash
npm run desktop:build
```

Produces a `.deb` and an AppImage under `app/src-tauri/target/release/bundle/`.

## Android

> The Android build uses the **native Rust catalog** (`rustypipe`, the `native-catalog` cargo feature)
> instead of `yt-dlp` — see [ARCHITECTURE.md](../ARCHITECTURE.md). The `android:*` npm scripts pass that
> feature automatically.

> **One-time setup required.** You need the Android SDK + NDK and `ANDROID_HOME` / `NDK_HOME` set.
> `scripts/setup-android.md` walks through it; the short version:

1. Install **Android Studio** (or the command-line tools) and, via the SDK Manager:
   - Android SDK Platform (API 34+)
   - NDK (Side by side)
   - Android SDK Build-Tools + Platform-Tools
2. Set environment variables:
   ```bash
   export ANDROID_HOME="$HOME/Android/Sdk"          # Windows: %LOCALAPPDATA%\Android\Sdk
   export NDK_HOME="$ANDROID_HOME/ndk/<version>"
   ```
3. Add the Rust Android targets:
   ```bash
   rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
   ```
4. Initialize the Android project (once):
   ```bash
   npm run android:init      # wraps `tauri android init`
   ```
5. Build a sideloadable APK:
   ```bash
   npm run android:build     # wraps `tauri android build --apk`
   ```
   The APK lands in `app/src-tauri/gen/android/app/build/outputs/apk/`. Copy it to your phone and
   install it (enable "install unknown apps" for your file manager).

For day-to-day testing on a connected device/emulator:

```bash
npm run android          # tauri android dev
```

## Troubleshooting

- **`webkit2gtk` not found (Linux)** — install the Tauri Linux prerequisites; Ubuntu needs
  `libwebkit2gtk-4.1-dev` and friends.
- **Rust build is slow the first time** — `rustypipe` + `reqwest` pull a large dependency tree; the
  first `cargo` build takes a while, subsequent ones are cached.
- **Android `init` fails** — double-check `ANDROID_HOME`/`NDK_HOME` and that the Rust Android targets are
  installed (`rustup target list --installed`).
