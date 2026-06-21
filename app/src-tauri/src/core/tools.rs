//! Locates the external binaries Treble shells out to on desktop (`yt-dlp`,
//! `ffmpeg`). They are looked up first in the app's bundled `binaries/` directory
//! (populated by `npm run fetch-tools`), then on the system `PATH`.

use crate::core::error::{CoreError, Result};
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use std::sync::OnceLock;

/// Writable per-user bin dir (app data) where Treble auto-downloads yt-dlp.
static APP_BIN: OnceLock<PathBuf> = OnceLock::new();

/// Set the app-data bin directory (called once at startup).
pub fn set_app_bin(dir: PathBuf) {
    std::fs::create_dir_all(&dir).ok();
    let _ = APP_BIN.set(dir);
}

/// Create a `Command` with `CREATE_NO_WINDOW` on Windows. Without this, a GUI app
/// (windows_subsystem=windows, no console) spawning a console tool like yt-dlp
/// HANGS waiting on a console — this is why playback "did nothing".
fn new_command(path: &str) -> Command {
    let c = Command::new(path);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let mut c = c;
        c.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
        return c;
    }
    #[allow(unreachable_code)]
    c
}

/// Platform-specific executable name.
fn exe(name: &str) -> String {
    if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_string()
    }
}

/// Directory next to the running executable where bundled tools live.
fn bundled_dir() -> Option<PathBuf> {
    let exe_path = std::env::current_exe().ok()?;
    let dir = exe_path.parent()?.join("binaries");
    if dir.is_dir() {
        Some(dir)
    } else {
        // Dev fallback: `app/src-tauri/binaries` relative to the crate.
        let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries");
        dev.is_dir().then_some(dev)
    }
}

/// Resolve a tool to an invocable path. Returns the bare name (relying on PATH)
/// if no bundled copy exists — the actual run will surface a clear error if it's
/// genuinely missing.
pub fn resolve(name: &str) -> String {
    // app-data bin (auto-downloaded) first, then the bundled dir, then PATH.
    for dir in [APP_BIN.get().cloned(), bundled_dir()].into_iter().flatten() {
        let candidate = dir.join(exe(name));
        if candidate.is_file() {
            return candidate.to_string_lossy().into_owned();
        }
    }
    name.to_string()
}

/// yt-dlp download URL for this platform.
fn ytdlp_url() -> &'static str {
    if cfg!(windows) {
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
    } else if cfg!(target_os = "macos") {
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
    } else {
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
    }
}

/// Ensure yt-dlp is present (download it into the app-data bin on first run).
/// yt-dlp is needed because it bypasses YouTube's bot-detection that 403s the
/// native client on the stream endpoint. Returns true if usable afterwards.
pub fn ensure_ytdlp() -> bool {
    // yt-dlp is a desktop-only helper — it's a native binary that can't run on
    // Android/iOS, so never try to download it there (it would just waste mobile
    // data on a binary that can't execute). Mobile uses the native rustypipe path.
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        return false;
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
    use std::sync::atomic::{AtomicBool, Ordering};
    static READY: AtomicBool = AtomicBool::new(false);
    if READY.load(Ordering::Relaxed) {
        return true;
    }
    if is_available("yt-dlp") {
        READY.store(true, Ordering::Relaxed);
        return true;
    }
    let Some(dir) = APP_BIN.get() else { return false };
    let dest = dir.join(exe("yt-dlp"));
    crate::tlog!("downloading yt-dlp -> {}", dest.display());
    match download(ytdlp_url(), &dest) {
        Ok(()) => {
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = std::fs::set_permissions(&dest, std::fs::Permissions::from_mode(0o755));
            }
            let ok = is_available("yt-dlp");
            if ok {
                READY.store(true, Ordering::Relaxed);
            }
            crate::tlog!("yt-dlp ready: {ok}");
            ok
        }
        Err(e) => {
            crate::tlog!("yt-dlp download failed: {e}");
            false
        }
    }
    }
}

fn download(url: &str, dest: &std::path::Path) -> Result<()> {
    let resp = ureq::get(url).call().map_err(|e| CoreError::Network(e.to_string()))?;
    let mut reader = resp.into_reader();
    let tmp = dest.with_extension("part");
    let mut file = std::fs::File::create(&tmp)?;
    std::io::copy(&mut reader, &mut file).map_err(|e| CoreError::Other(e.to_string()))?;
    file.flush().ok();
    drop(file);
    std::fs::rename(&tmp, dest)?;
    Ok(())
}

/// True if a tool can actually be invoked (used for friendly "missing tool" errors).
pub fn is_available(name: &str) -> bool {
    use std::collections::HashSet;
    use std::sync::Mutex;
    static CONFIRMED: Mutex<Option<HashSet<String>>> = Mutex::new(None);
    // A tool that's confirmed present stays present for the session — cache it so
    // we don't spawn `--version` on every stream resolve.
    if let Ok(g) = CONFIRMED.lock() {
        if g.as_ref().is_some_and(|s| s.contains(name)) {
            return true;
        }
    }
    let path = resolve(name);
    let ok = new_command(&path)
        .arg("--version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false);
    if ok {
        if let Ok(mut g) = CONFIRMED.lock() {
            g.get_or_insert_with(HashSet::new).insert(name.to_string());
        }
    }
    ok
}

/// Build a `Command` for a tool, erroring early if it's clearly unavailable.
pub fn command(name: &str) -> Result<Command> {
    let path = resolve(name);
    if !is_available(name) {
        return Err(CoreError::ToolMissing(name.to_string()));
    }
    Ok(new_command(&path))
}

/// Turn a track id into a yt-dlp target argument. A bare YouTube video id is
/// wrapped in a full watch URL so ids that begin with `-` (e.g. `-grXcm3YGXM`)
/// aren't mis-parsed by yt-dlp as command-line flags.
pub fn ytdlp_target(id: &str) -> String {
    if id.starts_with("http://") || id.starts_with("https://") {
        id.to_string()
    } else {
        format!("https://www.youtube.com/watch?v={id}")
    }
}
