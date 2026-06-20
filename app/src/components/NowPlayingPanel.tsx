import { Heart, SkipBack, SkipForward, Shuffle, Repeat, Play, Pause, Maximize2, ExternalLink, ListMusic, Volume2, Loader2 } from "lucide-react";
import { useStore } from "../store";
import { toggleFloating } from "../lib/windows";
import { Scrubber } from "./Scrubber";
import { SleepTimer } from "./SleepTimer";
import { fmtTime } from "../lib/format";
import { useSyncedLyrics } from "../lib/useSyncedLyrics";
import { isArtUrl } from "../types";

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

  return (
    <aside className="player">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span className="eyebrow">Now playing</span>
        <div style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--text-2)" }}>
          <SleepTimer />
          <ExternalLink size={17} className="press" onClick={() => toggleFloating("mini", true, () => dispatch({ type: "setMini", open: true }))} />
          <Maximize2 size={17} className="press" onClick={() => dispatch({ type: "setNp", open: true })} />
        </div>
      </div>

      <button
        className="press"
        onClick={() => dispatch({ type: "setNp", open: true })}
        style={{ position: "relative", width: "100%", aspectRatio: "1", borderRadius: 16, border: "none", background: np && isArtUrl(np.art) ? `center/cover no-repeat url(${np.art})` : np?.art || "var(--surface-2)", boxShadow: "0 16px 34px var(--shadow)", marginBottom: 18, cursor: "pointer" }}
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
        <Heart size={18} className="press" style={{ color: "var(--accent)" }} fill="currentColor" />
      </div>

      <div style={{ margin: "18px 0 6px" }}>
        <Scrubber />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-3)" }}>
        <span>{fmtTime(state.positionSecs)}</span><span>{fmtTime(state.durationSecs)}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginTop: 16, color: "var(--text-2)" }}>
        <Shuffle size={18} className="press" />
        <SkipBack size={20} className="press" fill="currentColor" />
        <button className="fab press" style={{ width: 50, height: 50, boxShadow: "0 8px 20px rgba(255,107,92,.4)" }} onClick={() => dispatch({ type: "togglePlay" })}>
          {state.playing ? <Pause size={20} fill="#fff" /> : <Play size={20} fill="#fff" />}
        </button>
        <SkipForward size={20} className="press" fill="currentColor" />
        <Repeat size={18} className="press" />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, color: "var(--text-3)" }}>
        <Volume2 size={19} className="press" />
        <div
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            dispatch({ type: "setVolume", volume: (e.clientX - r.left) / r.width });
          }}
          style={{ flex: 1, margin: "0 10px", height: 4, borderRadius: 2, background: "var(--surface-2)", position: "relative", cursor: "pointer" }}
          title="Volume"
        >
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${state.volume * 100}%`, background: "var(--text-3)", borderRadius: 2 }} />
        </div>
        <ListMusic size={19} className="press" onClick={() => dispatch({ type: "go", screen: "queue" })} />
      </div>

      <div style={{ flex: 1 }} />

      {teaser.length > 0 && (
        <button
          onClick={() => dispatch({ type: "setNp", open: true })}
          style={{ textAlign: "left", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 13, padding: "15px 16px", cursor: "pointer" }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
            <span className="eyebrow" style={{ color: "var(--accent)" }}>Lyrics</span>
            <ExternalLink size={14} style={{ color: "var(--text-3)" }} onClick={(e) => { e.stopPropagation(); toggleFloating("lyrics", true, () => dispatch({ type: "setLyrics", open: true })); }} />
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
