/**
 * Environment helpers. The mini-player and lyrics views render as in-app
 * draggable overlays (see FloatingWindows.tsx) so they share the store + theme.
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** True on the Android (or iOS) build — no desktop window chrome there. */
export function isMobile(): boolean {
  return typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Desktop = running under Tauri with real OS window controls. */
export function isDesktop(): boolean {
  return isTauri() && !isMobile();
}
