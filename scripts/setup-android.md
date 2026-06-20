# Android setup (one-time)

Treble's Android app is the **same** Tauri + React + Rust app as desktop, packaged as a
sideloadable APK. You need the Android SDK/NDK once; after that it's two npm scripts.

> The Android build uses the **native Rust catalog** (`rustypipe`, the `native-catalog` cargo feature)
> for search + stream resolution — `yt-dlp` can't run on Android, but `rustypipe` is pure Rust and runs
> everywhere. The `npm run android:*` scripts pass that feature for you. What still needs on-device
> verification (no SDK in this environment): the `MediaStyle` notification, edge-to-edge insets, and
> the native download path — see [ROADMAP.md](../ROADMAP.md).

## 1. Install the Android toolchain

Install **Android Studio** (easiest — it bundles the SDK Manager) or the standalone
command-line tools. Then, via **SDK Manager**, install:

- **Android SDK Platform** — API level **34** or newer
- **NDK (Side by side)** — the latest stable
- **Android SDK Build-Tools**
- **Android SDK Platform-Tools** (gives you `adb`)
- **Android SDK Command-line Tools**

## 2. Set environment variables

`tauri android` needs `ANDROID_HOME` and `NDK_HOME`.

**Linux / macOS** (`~/.bashrc` / `~/.zshrc`):
```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export NDK_HOME="$ANDROID_HOME/ndk/$(ls "$ANDROID_HOME/ndk" | sort -V | tail -1)"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
```

**Windows (PowerShell profile):**
```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:NDK_HOME = (Get-ChildItem "$env:ANDROID_HOME\ndk" | Sort-Object Name | Select-Object -Last 1).FullName
```

Confirm: `adb --version` works and `echo $ANDROID_HOME` / `echo $env:ANDROID_HOME` is set.

## 3. Add the Rust Android targets

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

## 3b. libclang + bindgen (needed by the native catalog)

The native catalog (`rustypipe`) pulls **rquickjs**, which compiles QuickJS from C
and generates bindings with **bindgen**. rquickjs-sys ships no prebuilt Android
bindings, so bindgen runs at build time and needs **libclang**, the NDK **sysroot**,
and clang's **builtin headers** (for `stdbool.h` etc.). Install LLVM (e.g.
`winget install LLVM.LLVM`), then set these before building:

```powershell
# Windows — adjust the clang major version + NDK host folder to match yours
$env:LIBCLANG_PATH = 'C:\Program Files\LLVM\bin'
$sysroot = ($env:NDK_HOME -replace '\\','/') + '/toolchains/llvm/prebuilt/windows-x86_64/sysroot'
$env:BINDGEN_EXTRA_CLANG_ARGS = "--sysroot=`"$sysroot`" -isystem `"C:/Program Files/LLVM/lib/clang/21/include`""
```
```bash
# Linux/macOS equivalent (host folder is linux-x86_64 / darwin-x86_64)
export LIBCLANG_PATH="$(llvm-config --libdir)"
export BINDGEN_EXTRA_CLANG_ARGS="--sysroot=$NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/sysroot"
```

> Use forward slashes and quote any path with spaces — bindgen parses these args
> shell-style. (You can skip all of this by building the APK *without* the
> `native-catalog` feature, which drops the in-app YouTube Music engine.)

## 4. Initialize the Android project (once)

From `app/`:
```bash
npm run android:init      # = tauri android init
```

This generates `app/src-tauri/gen/android/` (a Gradle project). It's git-ignored — it's
generated, not source. The app icons are already in place (`src-tauri/icons/android/`).

## 5. Build a sideloadable APK

```bash
npm run android:build     # = tauri android build --apk
```

Output:
```
app/src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk
```

> The release APK is **unsigned**. To install it you can either build a debug APK
> (`tauri android build --apk --debug`, which is debug-signed and installs directly) or sign the
> release APK with your own debug keystore:
> ```bash
> # one-time: a personal debug keystore
> keytool -genkey -v -keystore ~/treble-debug.keystore -alias treble \
>   -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android -dname "CN=Treble"
> # sign:
> "$ANDROID_HOME"/build-tools/<ver>/apksigner sign --ks ~/treble-debug.keystore \
>   --ks-pass pass:android app-universal-release-unsigned.apk
> ```

## 6. Sideload onto your phone

- **Via USB:** enable Developer Options + USB debugging, then `adb install path/to/app.apk`.
- **Manually:** copy the APK to the phone and open it; allow "install unknown apps" for your
  file manager when prompted.

## Day-to-day dev

With a device/emulator connected:
```bash
npm run android          # = tauri android dev (hot-reloads the webview)
```

## Troubleshooting

- **`Android Studio project not found`** → run `npm run android:init` first.
- **`NDK not found`** → `NDK_HOME` is unset or points at a missing version; re-check step 2.
- **`linker not found` / target errors** → you missed step 3 (`rustup target add …`).
- **App installs but won't open** → check `adb logcat | grep -i treble` for the Rust panic.
