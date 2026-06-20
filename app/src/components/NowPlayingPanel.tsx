import { Heart, SkipBack, SkipForward, Shuffle, Repeat, Play, Pause, Maximize2, ExternalLink, ListMusic, Volume2 } from "lucide-react";
import { useStore } from "../store";
import { toggleFloating } from "../lib/windows";

/**
 * Persistent docked Now-Playing panel (the "Studio" layout signature — there is
 * NO bottom player bar). Art → opens full-screen player. Pop-out icons open the
 * mini-player and lyrics windows. See handoff §"Docked Now-Playing panel".
 */
export function NowPlayingPanel() {
  const { state, dispatch } = useStore();
  const np = state.nowPlaying;
  const title = np?.title ?? "Midnight Coast";
  const sub = np ? `${np.artist} · ${np.album}` : "Halsey Lane · Neon Tide";

  return (
    <aside className="player">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span className="eyebrow">Now playing</span>
        <div style={{ display: "flex", gap: 6, color: "var(--text-2)" }}>
          <ExternalLink size={17} className="press" onClick={() => toggleFloating("mini", true, () => dispatch({ type: "setMini", open: true }))} />
          <Maximize2 size={17} className="press" onClick={() => dispatch({ type: "setNp", open: true })} />
        </div>
      </div>

      <button
        className="press"
        onClick={() => dispatch({ type: "setNp", open: true })}
        style={{ width: "100%", aspectRatio: "1", borderRadius: 16, border: "none", background: "linear-gradient(135deg,#FF6B8B,#FFA86B)", boxShadow: "0 16px 34px var(--shadow)", marginBottom: 18, cursor: "pointer" }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div className="ellipsis" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 19 }}>{title}</div>
          <div className="ellipsis" style={{ fontSize: 14, color: "var(--text-2)" }}>{sub}</div>
        </div>
        <Heart size={18} className="press" style={{ color: "var(--accent)" }} fill="currentColor" />
      </div>

      <div style={{ margin: "18px 0 6px", height: 5, borderRadius: 3, background: "var(--surface-2)", position: "relative" }}>
        <div style={{ position: "absolute", inset: "0 58% 0 0", background: "var(--accent-grad)", borderRadius: 3 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-3)" }}>
        <span>1:42</span><span>3:58</span>
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
        <div style={{ flex: 1, margin: "0 10px", height: 4, borderRadius: 2, background: "var(--surface-2)", position: "relative" }}>
          <div style={{ position: "absolute", inset: "0 35% 0 0", background: "var(--text-3)", borderRadius: 2 }} />
        </div>
        <ListMusic size={19} className="press" onClick={() => dispatch({ type: "go", screen: "queue" })} />
      </div>

      <div style={{ flex: 1 }} />

      <button
        onClick={() => dispatch({ type: "setNp", open: true })}
        style={{ textAlign: "left", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 13, padding: "15px 16px", cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
          <span className="eyebrow" style={{ color: "var(--accent)" }}>Lyrics</span>
          <ExternalLink size={14} style={{ color: "var(--text-3)" }} onClick={(e) => { e.stopPropagation(); toggleFloating("lyrics", true, () => dispatch({ type: "setLyrics", open: true })); }} />
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.7, color: "var(--text-3)" }}>
          Engine humming low and slow<br />
          <span style={{ color: "var(--text)", fontWeight: 600 }}>Driving down the midnight coast</span><br />
          Headlights chasing yesterday
        </div>
      </button>
    </aside>
  );
}
