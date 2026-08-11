#!/usr/bin/env node
/**
 * Fetches the external binaries Treble shells out to on desktop (`yt-dlp` and
 * `ffmpeg`) into `app/src-tauri/binaries/`, where `core::tools` looks for them
 * first (before falling back to PATH) and where the desktop bundler picks them up
 * as a resource. These are NOT committed (see .gitignore) — every dev/CI run grabs
 * the right build for the current OS.
 *
 * Both are skipped if already present; delete a binary to re-fetch it.
 *
 * Usage:  npm run fetch-tools         (from app/)
 *         node scripts/fetch-tools.mjs (from repo root)
 */
import { mkdir, chmod, mkdtemp, copyFile, rm, readdir } from "node:fs/promises";
import { createWriteStream, existsSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { platform, tmpdir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "app", "src-tauri", "binaries");

const YTDLP = {
  win32: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
  linux: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp",
  darwin: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos",
};

// yt-dlp transcodes to mp3 by invoking ffmpeg, so a download fails outright without
// it. These are the three archives that ship a single static ffmpeg with no runtime
// deps; each one buries the binary at a different depth, hence the recursive find.
// Only ffmpeg is kept — ffplay/ffprobe are another ~150 MB of installer for nothing.
// Windows is Gyan's build off GitHub's CDN rather than gyan.dev/builds/…, which
// serves the identical zip at ~100 KB/s. Pinned, so bump the version by hand.
const FFMPEG = {
  win32: "https://github.com/GyanD/codexffmpeg/releases/download/9.0/ffmpeg-9.0-essentials_build.zip",
  linux: "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz",
  darwin: "https://evermeet.cx/ffmpeg/getrelease/zip",
};

async function download(url, dest) {
  process.stdout.write(`  ↓ ${url}\n`);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  await pipeline(res.body, createWriteStream(dest));
}

/** First file named `name` anywhere under `dir`. */
async function find(dir, name) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      const hit = await find(p, name);
      if (hit) return hit;
    } else if (entry.name === name) {
      return p;
    }
  }
  return null;
}

/** Downloads an archive, pulls `name` out of it, drops it in binaries/. */
async function extractInto(url, name, dest) {
  const tmp = await mkdtemp(join(tmpdir(), "treble-tools-"));
  try {
    const archive = join(tmp, url.endsWith(".tar.xz") ? "dl.tar.xz" : "dl.zip");
    await download(url, archive);
    // `tar` rather than an unzip dependency: it's bsdtar on Windows 10+ and macOS
    // (which reads zip), and GNU tar on Linux (which reads the .tar.xz). Windows
    // names System32 explicitly — under Git Bash a GNU tar shadows it on PATH and
    // reads "C:\…" as a remote host ("Cannot connect to C:").
    const tar =
      platform() === "win32"
        ? join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe")
        : "tar";
    execFileSync(tar, ["-xf", archive, "-C", tmp], { stdio: "inherit" });
    const found = await find(tmp, name);
    if (!found) throw new Error(`${name} not found inside ${url}`);
    await copyFile(found, dest);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

async function main() {
  const os = platform();
  if (!YTDLP[os]) {
    console.error(`Unsupported platform: ${os}`);
    process.exit(1);
  }
  await mkdir(outDir, { recursive: true });
  const exe = (n) => (os === "win32" ? `${n}.exe` : n);

  const ytDest = join(outDir, exe("yt-dlp"));
  if (existsSync(ytDest)) {
    console.log(`yt-dlp already present → ${ytDest}`);
  } else {
    console.log("Fetching yt-dlp …");
    await download(YTDLP[os], ytDest);
    if (os !== "win32") await chmod(ytDest, 0o755);
  }

  const ffDest = join(outDir, exe("ffmpeg"));
  if (existsSync(ffDest)) {
    console.log(`ffmpeg already present → ${ffDest}`);
  } else {
    console.log("Fetching ffmpeg (a big archive — only the binary is kept) …");
    await extractInto(FFMPEG[os], exe("ffmpeg"), ffDest);
    if (os !== "win32") await chmod(ffDest, 0o755);
  }

  console.log(`\n✓ ${ytDest}\n✓ ${ffDest}\n\n(delete either to re-fetch a newer build)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
