/**
 * Resolve a track/playlist `art` value to a CSS `background` string. Handles:
 *  - real cover URLs (`https://…`) → cover image
 *  - local files (`local:<path>`, e.g. an uploaded playlist cover) → asset URL
 *  - CSS gradients (mock data) → used as-is
 */
import { convertFileSrc } from "@tauri-apps/api/core";
import { isTauri } from "./windows";

export function artBg(art?: string): string {
  if (!art) return "var(--surface-2)";
  if (/^https?:\/\//.test(art)) return `center/cover no-repeat url("${art}")`;
  if (art.startsWith("local:")) {
    const path = art.slice("local:".length);
    const url = isTauri() ? convertFileSrc(path) : path;
    return `center/cover no-repeat url("${url}")`;
  }
  return art; // a CSS gradient
}

// Warm, on-brand gradients used as default covers for art-less playlists/albums,
// so every card looks complete and the same size regardless of whether it has art.
const COVER_GRADIENTS = [
  "linear-gradient(135deg,#ff9a5c,#ff6b5c)",
  "linear-gradient(135deg,#ffb35c,#ff7a5c)",
  "linear-gradient(135deg,#ff8e7a,#e0463e)",
  "linear-gradient(135deg,#ffc062,#ff8a5c)",
  "linear-gradient(135deg,#ff7e9d,#ff6b5c)",
  "linear-gradient(135deg,#f5a05c,#ef6f6f)",
];

/**
 * Cover background for a playlist/album. Falls back to a deterministic on-brand
 * gradient (seeded by the title) when there's no real art, so cards are uniform.
 */
export function coverBg(art: string | undefined, seed = ""): string {
  if (art) return artBg(art);
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COVER_GRADIENTS[h % COVER_GRADIENTS.length];
}
