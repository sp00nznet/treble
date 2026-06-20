import { Shuffle, ListMusic, Trash2 } from "lucide-react";
import { useStore } from "../store";
import { isArtUrl } from "../types";
import { artBg } from "../lib/art";

export function Queue() {
  const { state, dispatch } = useStore();
  const np = state.nowPlaying;
  const next = state.queue.slice(state.queueIndex + 1);

  return (
    <div className="screen" style={{ maxWidth: 860 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 className="h1" style={{ fontSize: 30 }}>Queue</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`chip press${state.shuffle ? " active" : ""}`} style={{ display: "flex", alignItems: "center", gap: 7 }} onClick={() => dispatch({ type: "toggleShuffle" })}>
            <Shuffle size={16} /> Shuffle
          </button>
          <button className="chip press" style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--text-2)" }} onClick={() => dispatch({ type: "clearQueue" })} disabled={next.length === 0}>
            <Trash2 size={16} /> Clear
          </button>
        </div>
      </div>

      {np ? (
        <>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Now playing</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 12, borderRadius: 12, background: "var(--accent-soft)", marginBottom: 28 }}>
            <span style={{ width: 52, height: 52, borderRadius: 9, flex: "none", background: isArtUrl(np.art) ? `center/cover no-repeat url(${np.art})` : np.art }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="ellipsis" style={{ display: "block", fontSize: 15, fontWeight: 700, color: "var(--accent)" }}>{np.title}</span>
              <span style={{ display: "block", fontSize: 13, color: "var(--text-2)" }}>{np.artist}{np.album ? ` · ${np.album}` : ""}</span>
            </span>
            {state.playing && (
              <span style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 20 }}>
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="eqbar" style={{ animationDelay: `${i * 0.18}s` }} />
                ))}
              </span>
            )}
            <span style={{ fontSize: 13, color: "var(--text-3)" }}>{np.duration}</span>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-2)", padding: "30px 0" }}>
          <ListMusic size={20} /> <span style={{ fontSize: 14 }}>Nothing playing. Pick a song and it'll show up here.</span>
        </div>
      )}

      {next.length > 0 ? (
        <>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Next up · {next.length}</div>
          {next.map((t, i) => (
            <div
              key={`${t.id}-${i}`}
              className="trk"
              style={{ gridTemplateColumns: "1fr 1fr 60px" }}
              onClick={() => dispatch({ type: "play", track: t, queue: state.queue })}
              onContextMenu={(e) => { e.preventDefault(); dispatch({ type: "openMenu", x: e.clientX, y: e.clientY, track: t }); }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <span className="trk-art" style={{ background: artBg(t.art) }} />
                <span style={{ minWidth: 0 }}>
                  <span className="ellipsis" style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{t.title}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--text-2)" }}>{t.artist}</span>
                </span>
              </span>
              <span className="ellipsis" style={{ fontSize: 13, color: "var(--text-2)" }}>{t.album}</span>
              <span style={{ fontSize: 13, color: "var(--text-3)", textAlign: "right" }}>{t.duration}</span>
            </div>
          ))}
        </>
      ) : np ? (
        <div style={{ color: "var(--text-2)", fontSize: 14, padding: "4px 2px" }}>Nothing queued after this. Play a playlist or right-click a song → <b>Add to queue</b>.</div>
      ) : null}
    </div>
  );
}
