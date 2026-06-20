# Build a signed, sideloadable arm64 Treble APK on Windows.
#
# Why this script exists: `tauri android build` symlinks the compiled .so into the
# Gradle project, and Windows blocks symlink creation unless Developer Mode is on
# (or you run elevated). If you CAN enable Developer Mode, just use
# `npm run android:build` directly — it's simpler. This script is the no-Dev-Mode
# path: it lets Tauri compile the Rust .so, then copies the native libs into
# jniLibs ourselves, runs Gradle with the rust steps excluded, and signs the APK.
#
# Prereqs (see scripts/setup-android.md): Android SDK + NDK, LLVM/libclang, the
# Rust android targets, and a keystore. Adjust the versions below to match yours.

$ErrorActionPreference = 'Continue'
$ndkVer   = '26.1.10909125'
$clangVer = '21'
$buildTools = '34.0.0'

$env:JAVA_HOME    = (Get-Command java).Source | Split-Path | Split-Path  # or set explicitly
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:NDK_HOME     = "$env:ANDROID_HOME\ndk\$ndkVer"
$env:LIBCLANG_PATH = 'C:\Program Files\LLVM\bin'
$sysroot = ($env:NDK_HOME -replace '\\','/') + '/toolchains/llvm/prebuilt/windows-x86_64/sysroot'
$env:BINDGEN_EXTRA_CLANG_ARGS = "--sysroot=`"$sysroot`" -isystem `"C:/Program Files/LLVM/lib/clang/$clangVer/include`""

$app = Split-Path $PSScriptRoot -Parent | Join-Path -ChildPath 'app'
$tauri = Join-Path $app 'src-tauri'
$gen = Join-Path $tauri 'gen\android'
$abiDir = Join-Path $gen 'app\src\main\jniLibs\arm64-v8a'

Write-Host '==> Compiling the Rust core (the symlink step will fail on Windows; that is expected)...'
Push-Location $app
npm run android:build   # builds libtreble_lib.so, then errors at the symlink — ignored
Pop-Location

Write-Host '==> Staging native libs into jniLibs...'
New-Item -ItemType Directory -Force -Path $abiDir | Out-Null
Copy-Item (Join-Path $tauri 'target\aarch64-linux-android\release\libtreble_lib.so') $abiDir -Force
Copy-Item "$sysroot/usr/lib/aarch64-linux-android/libc++_shared.so" $abiDir -Force

Write-Host '==> Assembling the APK with Gradle (rust tasks excluded)...'
Push-Location $gen
.\gradlew.bat assembleUniversalRelease `
  -x rustBuildUniversalRelease -x rustBuildArm64Release -x rustBuildArmRelease `
  -x rustBuildX86Release -x rustBuildX86_64Release --console=plain
Pop-Location

$unsigned = Join-Path $gen 'app\build\outputs\apk\universal\release\app-universal-release-unsigned.apk'
$ks = Join-Path (Split-Path $app -Parent) 'treble.keystore'
$out = Join-Path (Split-Path $app -Parent) 'Treble-1.0.0-arm64.apk'
$bt = "$env:ANDROID_HOME\build-tools\$buildTools"

if (-not (Test-Path $ks)) {
  Write-Host '==> Creating a debug keystore...'
  & "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -v -keystore $ks -alias treble -keyalg RSA `
    -keysize 2048 -validity 10000 -storepass treble123 -keypass treble123 -dname 'CN=Treble, O=Treble, C=US'
}

Write-Host '==> Aligning + signing...'
& "$bt\zipalign.exe" -f -p 4 $unsigned "$out.aligned"
& "$bt\apksigner.bat" sign --ks $ks --ks-pass pass:treble123 --key-pass pass:treble123 --out $out "$out.aligned"
Remove-Item "$out.aligned" -Force -ErrorAction SilentlyContinue
& "$bt\apksigner.bat" verify $out

Write-Host "==> Done: $out"
