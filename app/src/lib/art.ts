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
