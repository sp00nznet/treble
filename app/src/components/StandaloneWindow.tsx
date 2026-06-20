import { useState } from "react";
import { MiniPlayerBody, LyricsBody } from "./FloatingWindows";
import type { FloatingKind } from "../lib/windows";

/**
 * Body rendered when this webview was opened as a standalone floating window
 * (index.html?window=mini|lyrics). It has no app shell. Playback state here is
 * local for the scaffold — wire it to the main window via Tauri events
 * (emit/listen on a "player:state" channel) when the audio backend lands.
 */
export function StandaloneWindow({ kind }: { kind: FloatingKind }) {
  const [playing, setPlaying] = useState(true);

  const close = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } catch {
      /* not under Tauri */
    }
  };

  const expand = async () => {
    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const main = await WebviewWindow.getByLabel("main");
      await main?.setFocus();
      // TODO: emit an event the main window listens for to open full-screen Now Playing.
    } catch {
      /* noop */
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      {kind === "mini" ? (
        <MiniPlayerBody track={null} playing={playing} onTogglePlay={() => setPlaying((p) => !p)} onClose={close} onExpand={expand} />
      ) : (
        <LyricsBody onClose={close} />
      )}
    </div>
  );
}
