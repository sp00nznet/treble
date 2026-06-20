import { Plus } from "lucide-react";
import { useStore } from "../store";
import { LIBRARY } from "../data/mock";

const TABS = ["Playlists", "Albums", "Artists", "Podcasts", "Songs"];

export function Library() {
  const { state, dispatch } = useStore();
  const tab = state.libTab;
  const items = LIBRARY[tab] ?? LIBRARY.Playlists;

  return (
    <div className="screen">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 className="h1" style={{ fontSize: 30 }}>Your Library</h1>
        <button className="chip active press" style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Plus size={16} /> New
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {TABS.map((t) => (
          <button key={t} className={`chip${tab === t ? " active" : ""}`} onClick={() => dispatch({ type: "setLibTab", tab: t })}>
            {t}
          </button>
        ))}
      </div>

      <div className="grid-5">
        {items.map((m) => (
          <div key={m.id} className="card" style={{ border: "none", background: "transparent", padding: 0 }} onClick={() => dispatch({ type: "openDetail", id: m.id })}>
            <div className="art" style={{ background: m.art, borderRadius: m.shape === "circle" ? "50%" : "var(--r-art)", marginBottom: 11 }} />
            <div className="ellipsis" style={{ fontSize: 14, fontWeight: 700, textAlign: m.shape === "circle" ? "center" : "left" }}>{m.title}</div>
            <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2, textAlign: m.shape === "circle" ? "center" : "left" }}>{m.subtitle}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
