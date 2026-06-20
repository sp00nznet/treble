import { Pin, X, Maximize2, SkipBack, SkipForward, Shuffle, Repeat, Play, Pause } from "lucide-react";
import { useStore } from "../store";
import { LYRICS } from "../data/mock";
import { isTauri } from "../lib/windows";

/* ============================================================
   Presentational window bodies — used both as in-app overlays
   (browser fallback) and as standalone Tauri windows.
   ============================================================ */

interface MiniProps {
  playing: boolean;
  onTogglePlay: () => void;
  onClose: () => void;
  onExpand: () => void;
}

export function MiniPlayerBody({ playing, onTogglePlay, onClose, onExpand }: MiniProps) {
  return (
    <div style={{ width: "100%", height: "100%", background: "#171210", display: "flex", flexDirection: "column" }}>
      <WindowBar title="Mini player" onClose={onClose} />
      <div style={{ position: "relative", flex: "none", height: 170, background: "linear-gradient(135deg,#FF6B8B,#FFA86B)" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 35%,rgba(10,7,6,.82))" }} />
        <button className="press" onClick={onExpand} style={{ position: "absolute", top: 12, right: 12, width: 30, height: 30, borderRadius: 8, background: "rgba(0,0,0,.35)", color: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Maximize2 size={15} /></button>
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 14 }}>
          <div className="ellipsis" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 19, color: "#fff" }}>Midnight Coast</div>
          <div className="ellipsis" style={{ fontSize: 13, color: "rgba(255,255,255,.75)" }}>Halsey Lane</div>
        </div>
      </div>
      <div style={{ padding: "14px 16px 16px", flex: 1 }}>
        <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,.16)", position: "relative", marginBottom: 8 }}>
          <div style={{ position: "absolute", inset: "0 58% 0 0", background: "linear-gradient(90deg,#FFB35C,#FF6B5C)", borderRadius: 2 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22, color: "rgba(255,255,255,.85)" }}>
          <Shuffle size={18} className="press" />
          <SkipBack size={20} className="press" fill="currentColor" />
          <button className="press" onClick={onTogglePlay} style={{ width: 46, height: 46, borderRadius: "50%", background: "#fff", color: "#1a1008", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            {playing ? <Pause size={20} fill="#1a1008" /> : <Play size={20} fill="#1a1008" />}
          </button>
          <SkipForward size={20} className="press" fill="currentColor" />
          <Repeat size={18} className="press" />
        </div>
      </div>
    </div>
  );
}

export function LyricsBody({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ width: "100%", height: "100%", background: "linear-gradient(180deg,#2a1518,#140f0d 70%)", display: "flex", flexDirection: "column" }}>
      <WindowBar title="Lyrics" onClose={onClose} />
      <div style={{ padding: "10px 22px 14px", display: "flex", alignItems: "center", gap: 12, flex: "none" }}>
        <span style={{ width: 46, height: 46, borderRadius: 9, flex: "none", background: "linear-gradient(135deg,#FF6B8B,#FFA86B)" }} />
        <span style={{ minWidth: 0 }}>
          <span className="ellipsis" style={{ display: "block", fontWeight: 700, fontSize: 15, color: "#fff" }}>Midnight Coast</span>
          <span style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,.6)" }}>Halsey Lane</span>
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 22px 24px", display: "flex", flexDirection: "column", gap: 15 }}>
        {LYRICS.map((l, i) => (
          <div key={i} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: l.active ? 23 : 18, lineHeight: 1.22, letterSpacing: "-.01em", color: l.active ? "#FFB98A" : "rgba(255,255,255,.26)" }}>{l.text}</div>
        ))}
      </div>
    </div>
  );
}

function WindowBar({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div data-tauri-drag-region style={{ height: 30, flex: "none", display: "flex", alignItems: "center", padding: "0 12px", gap: 7 }}>
      <span className="light" style={{ width: 11, height: 11, background: "#ff5f57" }} />
      <span className="light" style={{ width: 11, height: 11, background: "#febc2e" }} />
      <span className="light" style={{ width: 11, height: 11, background: "#28c840" }} />
      <span style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.45)" }}>{title}</span>
      <Pin size={14} className="press" style={{ color: "rgba(255,255,255,.5)" }} />
      <X size={15} className="press" style={{ color: "rgba(255,255,255,.5)" }} onClick={onClose} />
    </div>
  );
}

/* ============================================================
   In-app overlays (browser fallback). Hidden under Tauri — the
   real WebviewWindow shows the body instead.
   ============================================================ */

export function MiniPlayer() {
  const { state, dispatch } = useStore();
  if (!state.miniOpen || isTauri()) return null;
  return (
    <div style={{ position: "fixed", right: 26, bottom: 26, zIndex: 60, width: 340, height: 300, borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,.5)", border: "1px solid rgba(255,255,255,.08)" }}>
      <MiniPlayerBody
        playing={state.playing}
        onTogglePlay={() => dispatch({ type: "togglePlay" })}
        onClose={() => dispatch({ type: "setMini", open: false })}
        onExpand={() => dispatch({ type: "setNp", open: true })}
      />
    </div>
  );
}

export function LyricsWindow() {
  const { state, dispatch } = useStore();
  if (!state.lyricsOpen || isTauri()) return null;
  return (
    <div style={{ position: "fixed", left: 26, bottom: 26, zIndex: 60, width: 360, height: 480, borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,.5)", border: "1px solid rgba(255,255,255,.08)" }}>
      <LyricsBody onClose={() => dispatch({ type: "setLyrics", open: false })} />
    </div>
  );
}
