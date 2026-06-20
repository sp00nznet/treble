/**
 * Real Windows/Linux caption buttons — minimize, maximize/restore, close —
 * blended into the right edge of the custom titlebar (the frameless window has
 * `decorations: false`, so we draw these ourselves and drive them via the Tauri
 * window API). Hidden on mobile, where there's no desktop window chrome.
 */
import { useEffect, useState } from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import { isDesktop } from "../lib/windows";

async function win() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isDesktop()) return;
    let unlisten: (() => void) | undefined;
    (async () => {
      const w = await win();
      setMaximized(await w.isMaximized());
      unlisten = await w.onResized(async () => setMaximized(await w.isMaximized()));
    })();
    return () => unlisten?.();
  }, []);

  if (!isDesktop()) return null;

  return (
    <div className="winctl">
      <button className="winctl-btn" title="Minimize" onClick={async () => (await win()).minimize()}>
        <Minus size={16} />
      </button>
      <button
        className="winctl-btn"
        title={maximized ? "Restore" : "Maximize"}
        onClick={async () => (await win()).toggleMaximize()}
      >
        {maximized ? <Copy size={13} /> : <Square size={13} />}
      </button>
      <button className="winctl-btn winctl-close" title="Close" onClick={async () => (await win()).close()}>
        <X size={16} />
      </button>
    </div>
  );
}
