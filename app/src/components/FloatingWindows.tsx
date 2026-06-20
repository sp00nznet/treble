import { useRef, useState } from "react";
import { X, Maximize2, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Play, Pause } from "lucide-react";
import { useStore } from "../store";
import { useSyncedLyrics } from "../lib/useSyncedLyrics";
import { Scrubber } from "./Scrubber";
import { fmtTime } from "../lib/format";
import { isArtUrl } from "../types";

const artBg = (art?: string) =>
  art && isArtUrl(art) ? `center/cover no-repeat url(${art})` : art || "var(--surface-2)";

/* ============================================================
   Themed floating panels — mini player & lyrics. These render
   in-app (draggable overlays) and share the store directly, so
   the transport controls work and they follow the app theme.
   ============================================================ */

/** A draggable floating shell, dismissable, that follows the app theme. */
function FloatingShell({ title, onClose, start, width, height, children }: {
  title: string; onClose: () => void; start: { right?: number; left?: number; bottom: number };
  width: number; height: number; children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    // Don't start a drag when pressing a control (e.g. the close button) — otherwise
    // pointer-capture swallows its click.
    if ((e.target as HTMLElement).closest("[data-ctl]")) return;
    const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    drag.current = { dx: e.clientX - box.left, dy: e.clientY - box.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const x = Math.max(0, Math.min(window.innerWidth - width, e.clientX - drag.current.dx));
    const y = Math.max(28, Math.min(window.innerHeight - 40, e.clientY - drag.current.dy));
    setPos({ x, y });
  };
  const onPointerUp = () => { drag.current = null; };

  const placement: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y }
    : { right: start.right, left: start.left, bottom: start.bottom };

  return (
    <div style={{ position: "fixed", zIndex: 60, width, height, ...placement, borderRadius: 16, overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 24px 60px var(--shadow)", color: "var(--text)", display: "flex", flexDirection: "column" }}>
      <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        style={{ height: 32, flex: "none", display: "flex", alignItems: "center", padding: "0 12px", gap: 8, cursor: "grab", borderBottom: "1px solid var(--border)", touchAction: "none" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--text-3)" }}>{title}</span>
        <span style={{ flex: 1 }} />
        <button data-ctl className="press" onClick={onClose} aria-label="Close" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, border: "none", background: "transparent", color: "var(--text-3)", cursor: "pointer", borderRadius: 6 }}>
          <X size={15} />
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{children}</div>
    </div>
  );
}

export function MiniPlayer() {
  const { state, dispatch } = useStore();
  if (!state.miniOpen) return null;
  const np = state.nowPlaying;
  const skipBack = () => { if (state.positionSecs > 3) dispatch({ type: "seek", secs: 0 }); else dispatch({ type: "prev" }); };

  return (
    <FloatingShell title="Mini player" onClose={() => dispatch({ type: "setMini", open: false })} start={{ right: 26, bottom: 26 }} width={340} height={296}>
      <div style={{ position: "relative", flex: "none", height: 150, background: artBg(np?.art) }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 35%,rgba(0,0,0,.7))" }} />
        <button className="press" onClick={() => dispatch({ type: "setNp", open: true })} style={{ position: "absolute", top: 12, right: 12, width: 30, height: 30, borderRadius: 8, background: "rgba(0,0,0,.4)", color: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Maximize2 size={15} /></button>
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 12 }}>
          <div className="ellipsis" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "#fff" }}>{np?.title ?? "Nothing playing"}</div>
          <div className="ellipsis" style={{ fontSize: 13, color: "rgba(255,255,255,.8)" }}>{np?.artist ?? ""}</div>
        </div>
      </div>
      <div style={{ padding: "12px 16px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
        <Scrubber />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-3)", margin: "5px 0 8px" }}>
          <span>{fmtTime(state.positionSecs)}</span><span>{fmtTime(state.durationSecs)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, color: "var(--text-2)" }}>
          <Shuffle size={18} className="press" style={{ color: state.shuffle ? "var(--accent)" : "inherit", cursor: "pointer" }} onClick={() => dispatch({ type: "toggleShuffle" })} />
          <SkipBack size={20} className="press" style={{ cursor: "pointer" }} fill="currentColor" onClick={skipBack} />
          <button className="fab press" onClick={() => dispatch({ type: "togglePlay" })} style={{ width: 46, height: 46 }}>
            {state.playing ? <Pause size={20} fill="#fff" /> : <Play size={20} fill="#fff" />}
          </button>
          <SkipForward size={20} className="press" style={{ cursor: "pointer" }} fill="currentColor" onClick={() => dispatch({ type: "next" })} />
          {state.repeat === "one"
            ? <Repeat1 size={18} className="press" style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => dispatch({ type: "cycleRepeat" })} />
            : <Repeat size={18} className="press" style={{ color: state.repeat === "all" ? "var(--accent)" : "inherit", cursor: "pointer" }} onClick={() => dispatch({ type: "cycleRepeat" })} />}
        </div>
      </div>
    </FloatingShell>
  );
}

export function LyricsWindow() {
  const { state, dispatch } = useStore();
  const track = state.nowPlaying;
  const { lines, activeIndex } = useSyncedLyrics();
  if (!state.lyricsOpen) return null;

  return (
    <FloatingShell title="Lyrics" onClose={() => dispatch({ type: "setLyrics", open: false })} start={{ left: 26, bottom: 26 }} width={360} height={480}>
      <div style={{ padding: "12px 22px 12px", display: "flex", alignItems: "center", gap: 12, flex: "none", borderBottom: "1px solid var(--border)" }}>
        <span style={{ width: 44, height: 44, borderRadius: 9, flex: "none", background: artBg(track?.art) }} />
        <span style={{ minWidth: 0 }}>
          <span className="ellipsis" style={{ display: "block", fontWeight: 700, fontSize: 15 }}>{track?.title ?? "Nothing playing"}</span>
          <span className="ellipsis" style={{ display: "block", fontSize: 12, color: "var(--text-2)" }}>{track?.artist ?? ""}</span>
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 22px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        {lines.length === 0 && (
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--text-3)" }}>
            {track ? "No lyrics found." : "Nothing playing."}
          </div>
        )}
        {lines.map((l, i) => (
          <div key={i} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: i === activeIndex ? 22 : 17, lineHeight: 1.22, letterSpacing: "-.01em", color: i === activeIndex ? "var(--accent)" : "var(--text-3)", transition: "color .2s,font-size .2s" }}>{l.text}</div>
        ))}
      </div>
    </FloatingShell>
  );
}
