import { GripVertical, Shuffle } from "lucide-react";
import { useStore } from "../store";
import { TRACKS } from "../data/mock";

export function Queue() {
  const { state, dispatch } = useStore();
  const np = state.nowPlaying ?? TRACKS[0];
  const next = TRACKS.filter((t) => t.id !== np.id);

  return (
    <div className="screen" style={{ maxWidth: 860 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 className="h1" style={{ fontSize: 30 }}>Queue</h1>
        <button className="chip press" style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--text-2)" }}>
          <Shuffle size={16} /> Clear queue
        </button>
      </div>

      <div className="eyebrow" style={{ marginBottom: 12 }}>Now playing</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 12, borderRadius: 12, background: "var(--accent-soft)", marginBottom: 28 }}>
        <span style={{ width: 52, height: 52, borderRadius: 9, flex: "none", background: np.art }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="ellipsis" style={{ display: "block", fontSize: 15, fontWeight: 700, color: "var(--accent)" }}>{np.title}</span>
          <span style={{ display: "block", fontSize: 13, color: "var(--text-2)" }}>{np.artist} · {np.album}</span>
        </span>
        <span style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 20 }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="eqbar" style={{ animationDelay: `${i * 0.18}s` }} />
          ))}
        </span>
        <span style={{ fontSize: 13, color: "var(--text-3)" }}>{np.duration}</span>
      </div>

      <div className="eyebrow" style={{ marginBottom: 12 }}>Next up · from Late Night Drive</div>
      {next.map((t) => (
        <div
          key={t.id}
          className="trk"
          style={{ gridTemplateColumns: "24px 1fr 1fr 60px" }}
          onClick={() => dispatch({ type: "play", track: t })}
          onContextMenu={(e) => { e.preventDefault(); dispatch({ type: "openMenu", x: e.clientX, y: e.clientY, track: t }); }}
        >
          <GripVertical size={18} style={{ color: "var(--text-3)" }} />
          <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <span className="trk-art" style={{ background: t.art }} />
            <span style={{ minWidth: 0 }}>
              <span className="ellipsis" style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{t.title}</span>
              <span style={{ display: "block", fontSize: 12, color: "var(--text-2)" }}>{t.artist}</span>
            </span>
          </span>
          <span className="ellipsis" style={{ fontSize: 13, color: "var(--text-2)" }}>{t.album}</span>
          <span style={{ fontSize: 13, color: "var(--text-3)", textAlign: "right" }}>{t.duration}</span>
        </div>
      ))}
    </div>
  );
}
