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

(The script is in `scripts/fetch-tools.mjs`; `binaries/` is git-ignored.) `bundle.resources` copies
`binaries/` next to the installed exe, so `desktop:build` runs `fetch-tools` itself — an installer
whose app can't resolve a single stream isn't worth shipping.

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
> feature automatically. Playable streams are resolved **on-device** by an embedded copy of
> **NewPipeExtractor** plus a ported `po_token` generator (see [`android-newpipe/`](../android-newpipe/)
> and [CREDITS.md](../CREDITS.md)).

> **One-time setup required.** You need the Android SDK + NDK, `ANDROID_HOME` / `NDK_HOME` set, **and
> LLVM/libclang** (the native catalog's `rquickjs` generates bindings with bindgen).
> [`scripts/setup-android.md`](../scripts/setup-android.md) walks through all of it; the short version:

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
5. Apply the on-device NewPipe integration. `gen/android/` is generated (and git-ignored), so the
   NewPipe resolver, `po_token` generator, and foreground-playback service live in
   [`android-newpipe/`](../android-newpipe/) and are (re-)applied by a script — **run this after every
   `android:init`**:
   ```bash
   bash scripts/apply-newpipe.sh
   ```
6. Build a sideloadable APK:
   ```bash
   npm run android:build     # wraps `tauri android build --apk`
   ```
   The APK lands in `app/src-tauri/gen/android/app/build/outputs/apk/`. Copy it to your phone and
   install it (enable "install unknown apps" for your file manager).

   > **Windows note:** `tauri android build` needs Developer Mode (for symlinks). If you can't enable it,
   > use [`scripts/build-apk-windows.ps1`](../scripts/build-apk-windows.ps1), which compiles the core,
   > stages the native libs into `jniLibs`, runs Gradle, and signs a sideloadable arm64 APK.

For day-to-day testing on a connected device/emulator:

```bash
npm run android          # tauri android dev
```

## Releases (CI)

[`.github/workflows/build.yml`](../.github/workflows/build.yml) builds the Windows installers and the
arm64 APK on every push, and on a `v*` tag attaches them to a GitHub Release:

```bash
# bump the version in app/package.json, app/src-tauri/Cargo.toml and tauri.conf.json first
git tag v0.1.0 && git push origin v0.1.0
```

**APK signing.** Without secrets the workflow signs with a throwaway key, which means a new release
can't install over an older one. To sign with the real keystore, add two repo secrets
(*Settings → Secrets and variables → Actions*):

```powershell
# ANDROID_KEYSTORE_B64
[Convert]::ToBase64String([IO.File]::ReadAllBytes("treble.keystore")) | Set-Clipboard
# ANDROID_KEYSTORE_PASS — the keystore/key password (both must match)
```

## Troubleshooting

- **App window shows `asset not found: index.html`** — the frontend wasn't embedded (a stale
  incremental build reused a cached core lib without re-running the asset embed). `npm run desktop:build`
  now force-cleans the core first to prevent this; if you hit it another way, run
  `npm run clean:core` then rebuild.
- **`webkit2gtk` not found (Linux)** — install the Tauri Linux prerequisites; Ubuntu needs
  `libwebkit2gtk-4.1-dev` and friends.
- **Rust build is slow the first time** — `rustypipe` + `reqwest` pull a large dependency tree; the
  first `cargo` build takes a while, subsequent ones are cached.
- **Android `init` fails** — double-check `ANDROID_HOME`/`NDK_HOME` and that the Rust Android targets are
  installed (`rustup target list --installed`).
