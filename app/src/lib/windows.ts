/**
 * Multi-window helpers. Under Tauri the mini-player and lyrics views open as
 * real always-on-top `WebviewWindow`s pointing at `index.html?window=<kind>`
 * (see StandaloneWindow + main.tsx). In a plain browser there is no window
 * manager, so callers fall back to the in-app fixed overlay.
 */
export type FloatingKind = "mini" | "lyrics";

const SIZES: Record<FloatingKind, { width: number; height: number; title: string }> = {
  mini: { width: 340, height: 300, title: "Mini player" },
  lyrics: { width: 360, height: 480, title: "Lyrics" },
};

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function openFloating(kind: FloatingKind): Promise<boolean> {
  if (!isTauri()) return false;
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const existing = await WebviewWindow.getByLabel(kind);
  if (existing) {
    await existing.setFocus();
    return true;
  }
  const s = SIZES[kind];
  // Constructing the window opens it; errors surface on the 'tauri://error' event.
  new WebviewWindow(kind, {
    url: `index.html?window=${kind}`,
    width: s.width,
    height: s.height,
    title: s.title,
    decorations: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
  });
  return true;
}

export async function closeFloating(kind: FloatingKind): Promise<boolean> {
  if (!isTauri()) return false;
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const w = await WebviewWindow.getByLabel(kind);
  if (w) await w.close();
  return true;
}

/**
 * Open/close a floating view, falling back to an in-app overlay (via the
 * provided dispatch callback) when not running under Tauri.
 */
export async function toggleFloating(kind: FloatingKind, open: boolean, fallback: () => void) {
  if (isTauri()) {
    await (open ? openFloating(kind) : closeFloating(kind));
  } else {
    fallback();
  }
}
