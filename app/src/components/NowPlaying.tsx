import { Heart, SkipBack, SkipForward, Shuffle, Repeat, Play, Pause, Minimize2, Loader2 } from "lucide-react";
import { useStore } from "../store";
import { Scrubber } from "./Scrubber";
import { fmtTime } from "../lib/format";
import { useSyncedLyrics } from "../lib/useSyncedLyrics";
import { isArtUrl } from "../types";

/**
 * Full-screen Now Playing — the "Lyrics split" signature view.
 * Mounted by App.tsx when state.npOpen. In Tauri this fills the window.
 */
export function NowPlaying() {
  const { state, dispatch } = useStore();
  const np = state.nowPlaying;
  const title = np?.title ?? "Nothing playing";
  const sub = np ? [np.artist, np.album].filter(Boolean).join(" · ") : "";
  const { lines, activeIndex, seekToLine } = useSyncedLyrics();

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", background: "#140f0d" }}>
      <div data-tauri-drag-region style={{ position: "absolute", top: 0, left: 0, right: 0, height: 46, display: "flex", alignItems: "center", padding: "0 16px", gap: 8, zIndex: 5 }}>
        <span className="light" style={{ background: "#ff5f57" }} />
        <span className="light" style={{ background: "#febc2e" }} />
        <span className="light" style={{ background: "#28c840" }} />
        <div style={{ flex: 1 }} />
        <button className="press" onClick={() => dispatch({ type: "setNp", open: false })} style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(255,255,255,.1)", color: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Minimize2 size={18} />
        </button>
      </div>

      {/* left: art + controls */}
      <div style={{ width: "46%", maxWidth: 560, flex: "none", background: "linear-gradient(180deg,#3a1c20,#140f0d 70%)", padding: "72px 56px 44px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ position: "relative", width: 300, height: 300, borderRadius: 18, background: np && isArtUrl(np.art) ? `center/cover no-repeat url(${np.art})` : np?.art || "rgba(255,255,255,.08)", boxShadow: "0 28px 64px rgba(0,0,0,.55)", marginBottom: 34 }}>
          {state.loading && (
            <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.4)", borderRadius: 18 }}>
              <Loader2 size={56} className="spin" style={{ color: "#fff" }} />
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 34, color: "#fff", letterSpacing: "-.01em" }}>{title}</div>
            <div style={{ fontSize: 17, color: "rgba(255,255,255,.66)", marginTop: 5 }}>{sub}</div>
          </div>
          <Heart size={26} className="press" style={{ color: "#FF9A5C", marginTop: 8 }} fill="currentColor" />
        </div>
        <div style={{ margin: "30px 0 7px" }}>
          <Scrubber theme="dark" />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,.5)" }}><span>{fmtTime(state.positionSecs)}</span><span>{fmtTime(state.durationSecs)}</span></div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 30, marginTop: 26, color: "#fff" }}>
          <Shuffle size={24} className="press" />
          <SkipBack size={28} className="press" fill="currentColor" />
          <button className="press" onClick={() => dispatch({ type: "togglePlay" })} style={{ width: 64, height: 64, borderRadius: "50%", background: "#fff", color: "#2a1408", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 10px 30px rgba(0,0,0,.4)" }}>
            {state.playing ? <Pause size={26} fill="#2a1408" /> : <Play size={26} fill="#2a1408" />}
          </button>
          <SkipForward size={28} className="press" fill="currentColor" />
          <Repeat size={24} className="press" />
        </div>
      </div>

      {/* right: lyrics */}
      <div style={{ flex: 1, minWidth: 0, padding: "72px 64px", overflowY: "auto", display: "flex", flexDirection: "column", justifyContent: "center", gap: 20 }}>
        {lines.length === 0 && (
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, color: "rgba(255,255,255,.3)" }}>
            {np ? "No lyrics found for this track." : "Nothing playing."}
          </div>
        )}
        {lines.map((l, i) => {
          const active = i === activeIndex;
          return (
            <div
              key={i}
              onClick={() => seekToLine(i)}
              style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: active ? 42 : 30, lineHeight: 1.18, letterSpacing: "-.01em", color: active ? "#FFB98A" : "rgba(255,255,255,.24)", cursor: "pointer", transition: "color .3s, font-size .2s" }}
            >
              {l.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
