import { Play } from "lucide-react";
import { useStore } from "../store";
import { QUICK_PICKS, MADE_FOR_YOU, TRACKS } from "../data/mock";
import { TrackRow } from "../components/TrackRow";

export function Home() {
  const { dispatch } = useStore();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="screen">
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 26 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>{greeting}</div>
          <h1 className="h1" style={{ marginTop: 3 }}>Welcome back, Kaz</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="chip active">All</button>
          <button className="chip">Music</button>
          <button className="chip">Podcasts</button>
        </div>
      </header>

      {/* quick picks */}
      <div className="grid-3" style={{ marginBottom: 38 }}>
        {QUICK_PICKS.map((q) => (
          <button
            key={q.id}
            className="navitem"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", height: 66, padding: 0 }}
            onClick={() => dispatch({ type: "openDetail", id: q.id })}
          >
            <span style={{ width: 66, height: 66, flex: "none", background: q.art }} />
            <span className="ellipsis" style={{ fontSize: 14, fontWeight: 700, padding: "0 12px" }}>{q.title}</span>
          </button>
        ))}
      </div>

      {/* made for you */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 className="h2">Made for you</h2>
        <span className="eyebrow" style={{ cursor: "pointer" }}>Show all</span>
      </div>
      <div className="grid-5" style={{ marginBottom: 40 }}>
        {MADE_FOR_YOU.map((m) => (
          <div key={m.id} className="card" onClick={() => dispatch({ type: "openDetail", id: m.id })}>
            <div className="art" style={{ background: m.art, marginBottom: 12, position: "relative" }}>
              <span className="fab" style={{ position: "absolute", right: 9, bottom: 9, width: 44, height: 44, boxShadow: "0 8px 18px rgba(255,107,92,.45)" }}>
                <Play size={18} fill="#fff" />
              </span>
            </div>
            <div className="ellipsis" style={{ fontSize: 15, fontWeight: 700 }}>{m.title}</div>
            <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 3, lineHeight: 1.4 }}>{m.subtitle}</div>
          </div>
        ))}
      </div>

      {/* recently played */}
      <h2 className="h2" style={{ marginBottom: 14 }}>Recently played</h2>
      <div>
        {TRACKS.slice(0, 6).map((t, i) => (
          <TrackRow key={t.id} track={t} index={i} columns="30px 1fr 1fr 70px" />
        ))}
      </div>
    </div>
  );
}
