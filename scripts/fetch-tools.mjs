#!/usr/bin/env node
/**
 * Fetches the external binaries Treble shells out to on desktop (`yt-dlp`, and a
 * note on `ffmpeg`) into `app/src-tauri/binaries/`, where `core::tools` looks for
 * them first (before falling back to PATH). These are NOT committed (see
 * .gitignore) — every dev/CI run grabs the right build for the current OS.
 *
 * Usage:  npm run fetch-tools         (from app/)
 *         node scripts/fetch-tools.mjs (from repo root)
 */
import { mkdir, chmod } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { platform } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "app", "src-tauri", "binaries");

const YTDLP = {
  win32: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
  linux: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp",
  darwin: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos",
};

async function download(url, dest) {
  process.stdout.write(`  ↓ ${url}\n`);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  await pipeline(res.body, createWriteStream(dest));
}

async function main() {
  const os = platform();
  const ytUrl = YTDLP[os];
  if (!ytUrl) {
    console.error(`Unsupported platform: ${os}`);
    process.exit(1);
  }
  await mkdir(outDir, { recursive: true });

  const ytName = os === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const ytDest = join(outDir, ytName);
  console.log("Fetching yt-dlp …");
  await download(ytUrl, ytDest);
  if (os !== "win32") await chmod(ytDest, 0o755);

  console.log(`\n✓ yt-dlp → ${ytDest}`);
  console.log(
    "\nffmpeg: a system ffmpeg on PATH is used for transcoding. To bundle a\n" +
      "standalone build, drop the binary in app/src-tauri/binaries/ as well\n" +
      `(${os === "win32" ? "ffmpeg.exe" : "ffmpeg"}). See docs/BUILDING.md.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
