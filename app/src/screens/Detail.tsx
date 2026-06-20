import { Play, Heart, Download, MoreHorizontal, Clock } from "lucide-react";
import { useStore } from "../store";
import { PLAYLISTS, TRACKS, ART } from "../data/mock";

/** Album/playlist detail. Looks up state.detailId; falls back to a default playlist. */
export function Detail() {
  const { state } = useStore();
  const pl = PLAYLISTS.find((p) => p.id === state.detailId) ?? PLAYLISTS[1];
  const dates = ["2 days ago", "5 days ago", "1 week ago", "2 weeks ago", "3 weeks ago", "Mar 12", "Mar 8", "Feb 28"];

  return (
    <div>
      <header style={{ padding: "40px 34px 24px", display: "flex", gap: 26, alignItems: "flex-end", background: "linear-gradient(180deg,var(--accent-soft),transparent)" }}>
        <div style={{ width: 212, height: 212, borderRadius: 14, flex: "none", background: pl.art === undefined ? ART[3] : pl.art, boxShadow: "0 20px 44px var(--shadow)" }} />
        <div style={{ paddingBottom: 6 }}>
          <div className="eyebrow" style={{ color: "var(--text-2)" }}>Playlist</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 54, lineHeight: 1.02, letterSpacing: "-.03em", margin: "8px 0 14px" }}>{pl.title}</h1>
          <div style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.5, maxWidth: 520 }}>
            The slow-burn nocturne mix. Warm synths, lonely guitars, and headlights on an empty highway.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13, color: "var(--text-2)" }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg,#7A6CFF,#FF6B8B)" }} />
            <span style={{ fontWeight: 700, color: "var(--text)" }}>Kaz</span><span>·</span><span>24 songs, 1h 38m</span>
          </div>
        </div>
      </header>

      <div style={{ padding: "18px 34px 8px", display: "flex", alignItems: "center", gap: 18 }}>
        <button className="fab press" style={{ width: 56, height: 56, boxShadow: "0 10px 24px rgba(255,107,92,.4)" }}><Play size={24} fill="#fff" /></button>
        <Heart size={26} className="press" style={{ color: "var(--accent)" }} fill="currentColor" />
        <Download size={24} className="press" style={{ color: "var(--text-2)" }} />
        <MoreHorizontal size={24} className="press" style={{ color: "var(--text-2)" }} />
      </div>

      <div style={{ padding: "8px 34px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "30px 1fr 1fr 90px 60px", gap: 16, padding: "0 12px 8px", borderBottom: "1px solid var(--border)", marginBottom: 6 }} className="eyebrow">
          <span>#</span><span>Title</span><span>Album</span><span>Date added</span><span style={{ textAlign: "right" }}><Clock size={15} /></span>
        </div>
        {TRACKS.map((t, i) => (
          <DetailRow key={t.id} index={i} date={dates[i % dates.length]} track={t} />
        ))}
      </div>
    </div>
  );
}

import type { Track } from "../types";
function DetailRow({ track, index, date }: { track: Track; index: number; date: string }) {
  const { dispatch } = useStore();
  return (
    <div
      className="trk"
      style={{ gridTemplateColumns: "30px 1fr 1fr 90px 60px" }}
      onClick={() => dispatch({ type: "play", track })}
      onContextMenu={(e) => { e.preventDefault(); dispatch({ type: "openMenu", x: e.clientX, y: e.clientY, track }); }}
    >
      <span className="idx">{index + 1}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span className="trk-art" style={{ background: track.art }} />
        <span style={{ minWidth: 0 }}>
          <span className="ellipsis" style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{track.title}</span>
          <span style={{ display: "block", fontSize: 12, color: "var(--text-2)" }}>{track.artist}</span>
        </span>
      </span>
      <span className="ellipsis" style={{ fontSize: 13, color: "var(--text-2)" }}>{track.album}</span>
      <span style={{ fontSize: 13, color: "var(--text-3)" }}>{date}</span>
      <span style={{ fontSize: 13, color: "var(--text-3)", textAlign: "right" }}>{track.duration}</span>
    </div>
  );
}
