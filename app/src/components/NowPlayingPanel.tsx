import { Heart, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Play, Pause, Maximize2, PictureInPicture2, MessageSquareText, ListMusic, Volume2, VolumeX, Loader2, PanelRightClose } from "lucide-react";
import { useStore } from "../store";
import { Scrubber } from "./Scrubber";
import { SleepTimer } from "./SleepTimer";
import { VolumeSlider } from "./VolumeSlider";
import { fmtTime } from "../lib/format";
import { useSyncedLyrics } from "../lib/useSyncedLyrics";
import { useLike } from "../lib/useLike";
import { coverBg } from "../lib/art";

/**
 * Persistent docked Now-Playing panel (the "Studio" layout signature — there is
 * NO bottom player bar). Art → opens full-screen player. Pop-out icons open the
 * mini-player and lyrics windows. See handoff §"Docked Now-Playing panel".
 */
export function NowPlayingPanel() {
  const { state, dispatch } = useStore();
  const np = state.nowPlaying;
  const title = np?.title ?? "Nothing playing";
  const sub = np ? [np.artist, np.album].filter(Boolean).join(" · ") : "Pick a song to start";
  const { lines, activeIndex } = useSyncedLyrics();
  const teaser = np ? lines.slice(Math.max(0, activeIndex), activeIndex + 3) : [];
  const { isLiked, toggle } = useLike();
  const liked = np ? isLiked(np.id) : false;
  // Skip-back restarts the current track if we're >3s in, else goes to the previous.
  const skipBack = () => { if (state.positionSecs > 3) dispatch({ type: "seek", secs: 0 }); else dispatch({ type: "prev" }); };

  return (
    <aside className="player">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span className="eyebrow">Now playing</span>
        <div style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--text-2)" }}>
          <SleepTimer />
          <PictureInPicture2 size={17} className="press" style={{ color: state.miniOpen ? "var(--accent)" : "inherit", cursor: "pointer" }} onClick={() => dispatch({ type: "setMini", open: !state.miniOpen })} aria-label="Mini player" />
          <Maximize2 size={17} className="press" style={{ cursor: "pointer" }} onClick={() => dispatch({ type: "setNp", open: true })} aria-label="Full screen" />
          <PanelRightClose size={17} className="press" style={{ cursor: "pointer" }} onClick={() => dispatch({ type: "setPlayerOpen", open: false })} aria-label="Hide panel" />
        </div>
      </div>

      <button
        className="press"
        onClick={() => dispatch({ type: "setNp", open: true })}
        style={{ position: "relative", width: "100%", aspectRatio: "1", borderRadius: 16, border: "none", background: np ? coverBg(np.art, np.title) : "var(--surface-2)", boxShadow: "0 16px 34px var(--shadow)", marginBottom: 18, cursor: "pointer" }}
      >
        {state.loading && (
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.35)", borderRadius: 16 }}>
            <Loader2 size={40} className="spin" style={{ color: "#fff" }} />
          </span>
        )}
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div className="ellipsis" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 19 }}>{title}</div>
          <div className="ellipsis" style={{ fontSize: 14, color: "var(--text-2)" }}>{sub}</div>
        </div>
        <Heart
          size={18}
          className="press"
          style={{ color: liked ? "var(--accent)" : "var(--text-3)", cursor: np ? "pointer" : "default" }}
          fill={liked ? "currentColor" : "none"}
          onClick={() => np && toggle(np)}
        />
      </div>

      <div style={{ margin: "18px 0 6px" }}>
        <Scrubber />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-3)" }}>
        <span>{fmtTime(state.positionSecs)}</span><span>{fmtTime(state.durationSecs)}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginTop: 16, color: "var(--text-2)" }}>
        <Shuffle size={18} className="press" style={{ color: state.shuffle ? "var(--accent)" : "inherit", cursor: "pointer" }} onClick={() => dispatch({ type: "toggleShuffle" })} />
        <SkipBack size={20} className="press" style={{ cursor: "pointer" }} fill="currentColor" onClick={skipBack} />
        <button className="fab press" style={{ width: 50, height: 50, boxShadow: "0 8px 20px rgba(255,107,92,.4)" }} onClick={() => dispatch({ type: "togglePlay" })}>
          {state.playing ? <Pause size={20} fill="#fff" /> : <Play size={20} fill="#fff" />}
        </button>
        <SkipForward size={20} className="press" style={{ cursor: "pointer" }} fill="currentColor" onClick={() => dispatch({ type: "next" })} />
        {state.repeat === "one"
          ? <Repeat1 size={18} className="press" style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => dispatch({ type: "cycleRepeat" })} />
          : <Repeat size={18} className="press" style={{ color: state.repeat === "all" ? "var(--accent)" : "inherit", cursor: "pointer" }} onClick={() => dispatch({ type: "cycleRepeat" })} />}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, color: "var(--text-3)" }}>
        <span className="press" style={{ display: "flex", cursor: "pointer" }} onClick={() => dispatch({ type: "setVolume", volume: state.volume > 0 ? 0 : 1 })} title={state.volume > 0 ? "Mute" : "Unmute"}>
          {state.volume > 0 ? <Volume2 size={19} /> : <VolumeX size={19} />}
        </span>
        <VolumeSlider />
        <ListMusic size={19} className="press" style={{ cursor: "pointer" }} onClick={() => dispatch({ type: "go", screen: "queue" })} />
      </div>

      <div style={{ flex: 1 }} />

      {teaser.length > 0 && (
        <button
          onClick={() => dispatch({ type: "setNp", open: true })}
          style={{ textAlign: "left", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 13, padding: "15px 16px", cursor: "pointer" }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
            <span className="eyebrow" style={{ color: "var(--accent)" }}>Lyrics</span>
            <MessageSquareText size={14} style={{ color: "var(--text-3)", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); dispatch({ type: "setLyrics", open: true }); }} aria-label="Pop out lyrics" />
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.7, color: "var(--text-3)" }}>
            {teaser.map((l, i) => (
              <span key={i} style={{ display: "block", color: i === 0 ? "var(--text)" : "var(--text-3)", fontWeight: i === 0 ? 600 : 400 }}>{l.text}</span>
            ))}
          </div>
        </button>
      )}
    </aside>
  );
}
