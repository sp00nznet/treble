import { Heart, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Play, Pause, Minimize2, Loader2 } from "lucide-react";
import { useStore } from "../store";
import { Scrubber } from "./Scrubber";
import { fmtTime } from "../lib/format";
import { useSyncedLyrics } from "../lib/useSyncedLyrics";
import { useLike } from "../lib/useLike";
import { coverBg } from "../lib/art";

/**
 * Full-screen Now Playing — the "lyrics split" view. Themed with the app's tokens
 * so it follows light/dark like the rest of Treble.
 */
export function NowPlaying() {
  const { state, dispatch } = useStore();
  const np = state.nowPlaying;
  const title = np?.title ?? "Nothing playing";
  const sub = np ? [np.artist, np.album].filter(Boolean).join(" · ") : "";
  const { lines, activeIndex, seekToLine } = useSyncedLyrics();
  const { isLiked, toggle } = useLike();
  const liked = np ? isLiked(np.id) : false;
  const skipBack = () => { if (state.positionSecs > 3) dispatch({ type: "seek", secs: 0 }); else dispatch({ type: "prev" }); };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", background: "var(--bg)", color: "var(--text)" }}>
      <div data-tauri-drag-region style={{ position: "absolute", top: 0, left: 0, right: 0, height: 46, display: "flex", alignItems: "center", padding: "0 16px", zIndex: 5 }}>
        <div style={{ flex: 1 }} />
        <button className="press" onClick={() => dispatch({ type: "setNp", open: false })} style={{ width: 34, height: 34, borderRadius: 9, background: "var(--surface)", color: "var(--text-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} title="Collapse">
          <Minimize2 size={18} />
        </button>
      </div>

      {/* left: art + controls */}
      <div style={{ width: "46%", maxWidth: 560, flex: "none", background: "linear-gradient(180deg,var(--accent-soft),var(--bg) 72%)", padding: "72px 56px 44px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ position: "relative", width: 300, height: 300, borderRadius: 18, background: np ? coverBg(np.art, np.title) : "var(--surface-2)", boxShadow: "0 28px 64px var(--shadow)", marginBottom: 34 }}>
          {state.loading && (
            <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.35)", borderRadius: 18 }}>
              <Loader2 size={56} className="spin" style={{ color: "#fff" }} />
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 34, letterSpacing: "-.01em" }}>{title}</div>
            <div style={{ fontSize: 17, color: "var(--text-2)", marginTop: 5 }}>{sub}</div>
          </div>
          <Heart size={26} className="press" style={{ color: liked ? "var(--accent)" : "var(--text-3)", marginTop: 8, cursor: np ? "pointer" : "default", flex: "none" }} fill={liked ? "currentColor" : "none"} onClick={() => np && toggle(np)} />
        </div>
        <div style={{ margin: "30px 0 7px" }}>
          <Scrubber />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-3)" }}><span>{fmtTime(state.positionSecs)}</span><span>{fmtTime(state.durationSecs)}</span></div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 30, marginTop: 26, color: "var(--text-2)" }}>
          <Shuffle size={24} className="press" style={{ color: state.shuffle ? "var(--accent)" : "inherit", cursor: "pointer" }} onClick={() => dispatch({ type: "toggleShuffle" })} />
          <SkipBack size={28} className="press" style={{ cursor: "pointer" }} fill="currentColor" onClick={skipBack} />
          <button className="fab press" onClick={() => dispatch({ type: "togglePlay" })} style={{ width: 64, height: 64, boxShadow: "0 10px 30px rgba(255,107,92,.4)" }}>
            {state.playing ? <Pause size={26} fill="#fff" /> : <Play size={26} fill="#fff" />}
          </button>
          <SkipForward size={28} className="press" style={{ cursor: "pointer" }} fill="currentColor" onClick={() => dispatch({ type: "next" })} />
          {state.repeat === "one"
            ? <Repeat1 size={24} className="press" style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => dispatch({ type: "cycleRepeat" })} />
            : <Repeat size={24} className="press" style={{ color: state.repeat === "all" ? "var(--accent)" : "inherit", cursor: "pointer" }} onClick={() => dispatch({ type: "cycleRepeat" })} />}
        </div>
      </div>

      {/* right: lyrics */}
      <div style={{ flex: 1, minWidth: 0, padding: "72px 64px", overflowY: "auto", display: "flex", flexDirection: "column", justifyContent: "center", gap: 20 }}>
        {lines.length === 0 && (
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, color: "var(--text-3)" }}>
            {np ? "No lyrics found for this track." : "Nothing playing."}
          </div>
        )}
        {lines.map((l, i) => {
          const active = i === activeIndex;
          return (
            <div
              key={i}
              onClick={() => seekToLine(i)}
              style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: active ? 42 : 30, lineHeight: 1.18, letterSpacing: "-.01em", color: active ? "var(--accent)" : "var(--text-3)", cursor: "pointer", transition: "color .3s, font-size .2s" }}
            >
              {l.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
